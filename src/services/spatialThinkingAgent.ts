import type { AgentResult, AgentStep, Place, Layers, Route } from "../types";
import { calculateRoute, distance, nearestGreen } from "./awsLocationService";
import { modelSummary } from "./modelSummary";
export const prompts = [
  "Find a cooler place near Shahdara",
  "Compare industrial and canal temperatures",
  "Show places with less than 10% canopy",
  "Explore UVAS campus",
];
export type MapActions = {
  fly: (p: Place) => void;
  filter: (ids: string[]) => void;
  layers: (layers: Partial<Layers>) => void;
  route: (r: Route) => void;
};
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
export function planQuery(text: string, rows: Place[]) {
  const q = normalize(text);
  let target: Place | undefined = rows
    .filter((p) => q.includes(normalize(p.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  const aliases: Record<string, string> = {
    shahdara: "Shahdara",
    uvas: "UVAS",
    gulberg: "Gulberg",
    mall: "Mall Road",
    canal: "Canal Bank",
    sundar: "Sundar",
    lawrence: "Jinnah Gardens",
  };
  if (!target) {
    for (const [a, n] of Object.entries(aliases))
      if (q.includes(a)) {
        target = rows.find((p) =>
          p.name.toLowerCase().includes(n.toLowerCase()),
        );
        if (target) break;
      }
  }
  const routing = /route|nearest|cooler|cooling|relief/.test(q);
  const compare = /compare|versus|\bvs\b/.test(q);
  const canopy = /canopy|trees/.test(q);
  const temperature = /temp|hot|heat|above|over|below/.test(q);
  let threshold: number | undefined;
  let operator: "<" | ">" = ">";
  const original = text.toLowerCase();
  const numeric = original.match(
    /(?:less than|below|under|<|greater than|above|over|>)\s*(\d+(?:\.\d+)?)/,
  );
  if (numeric) {
    threshold = Number(numeric[1]);
    operator = /less|below|under|</.test(numeric[0]) ? "<" : ">";
  }
  let matches = rows.slice();
  if (canopy) {
    const limit = threshold ?? 10;
    matches = matches.filter((p) =>
      operator === "<"
        ? p.canopy_pct < limit
        : p.canopy_pct > (threshold ?? 30),
    );
  } else if (temperature && threshold !== undefined) {
    matches = matches.filter((p) =>
      operator === "<" ? p.temp_c < threshold! : p.temp_c > threshold!,
    );
  } else if (target) {
    matches = /near/.test(q)
      ? matches.filter((p) => distance(p.coordinates, target!.coordinates) < 5)
      : [target];
  } else if (/park|green/.test(q) && !compare) {
    matches = matches.filter((p) => p.kind === "park");
  } else if (/hot|heat/.test(q)) {
    matches = matches.filter((p) => p.temp_c >= 42);
  }
  if (/vulnerab/.test(q))
    matches = matches.filter((p) => p.vulnerability >= 60);
  matches.sort((a, b) => b.temp_c - a.temp_c);
  return {
    target,
    routing,
    compare,
    canopy,
    temperature,
    threshold,
    operator,
    matches,
    recognized:
      !!target ||
      routing ||
      compare ||
      canopy ||
      temperature ||
      /park|green|all|lahore|vulnerab|reset/.test(q),
  };
}
export async function runSpatialAgent(
  text: string,
  rows: Place[],
  actions: MapActions,
  onSteps: (s: AgentStep[]) => void,
  signal?: AbortSignal,
): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  async function operation<T>(
    title: string,
    detail: string,
    fn: () => Promise<T> | T,
  ) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const start = performance.now();
    steps.push({ title, detail, ms: 0, status: "running" });
    onSteps([...steps]);
    await new Promise((r) => setTimeout(r, 180));
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const result = await fn();
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    steps[steps.length - 1] = {
      title,
      detail,
      ms: Math.round(performance.now() - start),
      status: "done",
    };
    onSteps([...steps]);
    return result;
  }
  const p = await operation(
    "Parse spatial request",
    "Local intent parser · place, threshold and action",
    () => planQuery(text, rows),
  );
  if (!p.recognized) {
    await operation(
      "Check supported operations",
      "No matching place or supported spatial operation",
      () => {},
    );
    return {
      answer:
        "I can explore Lahore places, compare industrial and canal scenarios, filter temperatures or canopy, and connect a place to its nearest park. Try “temperature above 42” or search a place name.",
      citations: [],
      matches: [],
      query: "No query executed",
    };
  }
  const query = p.compare
    ? "groupBy(kind).mean(temp_c)"
    : `places.filter(${p.canopy ? `canopy_pct ${p.operator} ${p.threshold ?? (p.operator === "<" ? 10 : 30)}` : p.temperature && p.threshold !== undefined ? `temp_c ${p.operator} ${p.threshold}` : p.target ? `within 5 km / name = ${JSON.stringify(p.target.name)}` : "selected category"}).sort(temp_c DESC)`;
  const matches = await operation(
    "Query spatial dataset",
    `Executed in browser · ${query}`,
    () => p.matches,
  );
  let route: Route | undefined;
  let citations = matches.slice(0, 3);
  let answer = "";
  await operation(
    "Control the map",
    p.routing
      ? "Find nearest park by geographic distance; request route if AWS is configured"
      : "Apply matching records and fly to the first result",
    async () => {
      if (p.compare) {
        actions.filter(rows.map((p) => p.id));
        actions.layers({ thermal: true, green: true });
        const industrial = rows.filter((r) => r.kind === "industrial"),
          canal = rows.filter((r) => r.kind === "canal");
        const mean = (r: Place[]) =>
          r.reduce((s, p) => s + p.temp_c, 0) / r.length;
        answer =
          industrial.length && canal.length
            ? `In this modeled scenario, industrial places average ${mean(industrial).toFixed(1)}°C versus ${mean(canal).toFixed(1)}°C along the canal: a ${(mean(industrial) - mean(canal)).toFixed(1)}°C difference. These are illustrative inputs, not measured temperatures.`
            : "This dataset has insufficient industrial or canal records for a comparison.";
        citations = [industrial[0], canal[0]].filter(Boolean);
        if (citations[0]) actions.fly(citations[0]);
        return;
      }
      actions.filter(matches.map((p) => p.id));
      actions.layers({
        places: true,
        thermal: !p.canopy,
        green: p.canopy || p.routing,
      });
      const from = p.target || matches[0];
      if (from) {
        actions.fly(from);
        if (p.routing && matches.length) {
          const to = nearestGreen(from, rows);
          if (to) {
            route = await calculateRoute(from, to);
            if (signal?.aborted) return;
            actions.route(route);
            citations = [from, to];
            const drop = from.temp_c - to.temp_c;
            answer = `${to.name} is the nearest park candidate to ${from.name} in this dataset (${route.distanceKm.toFixed(2)} km ${route.provider === "Amazon Location" ? "by pedestrian route" : "in a straight line"}). The modeled temperature difference is ${drop.toFixed(1)}°C. ${route.note}`;
          }
        }
      }
    },
  );
  await operation(
    "Summarize results",
    "Return record citations and provenance; no hidden model reasoning",
    () => {
      if (!answer)
        answer = matches.length
          ? `${matches.length} place${matches.length === 1 ? " matches" : "s match"} your query. ${matches[0].name} has a modeled temperature of ${matches[0].temp_c.toFixed(1)}°C and ${matches[0].canopy_pct}% canopy. All environmental values are scenario inputs; click a citation to inspect the source.`
          : "No places match those filters. Try a broader temperature or canopy threshold.";
    },
  );
  const summary = await modelSummary(text, citations, signal);
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  return {
    answer,
    citations,
    route,
    matches,
    query,
    modelSummary: summary || undefined,
  };
}
