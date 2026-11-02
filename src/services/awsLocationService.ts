import type { Place, Route } from "../types";
export const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION || "ap-south-1",
  key: import.meta.env.VITE_AWS_LOCATION_API_KEY || "",
  dataUrl: import.meta.env.VITE_SPATIAL_DATA_URL || "",
  agentUrl: import.meta.env.VITE_AGENT_ENDPOINT || "",
};
export function awsStyleUrl() {
  return `https://maps.geo.${awsConfig.region}.amazonaws.com/v2/styles/Standard/descriptor?key=${encodeURIComponent(awsConfig.key)}&color-scheme=Dark`;
}
export function distance(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180,
    dlat = (b[1] - a[1]) * rad,
    dlon = (b[0] - a[0]) * rad,
    s =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export function nearestGreen(from: Place, rows: Place[]) {
  return rows
    .filter((p) => p.kind === "park" && p.id !== from.id)
    .sort(
      (a, b) =>
        distance(from.coordinates, a.coordinates) -
        distance(from.coordinates, b.coordinates),
    )[0];
}
async function post(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Service responded ${r.status}`);
  return r.json();
}
export async function geocode(
  query: string,
): Promise<{ name: string; coordinates: [number, number] }[]> {
  if (!awsConfig.key) return [];
  const d = await post(
    `https://places.geo.${awsConfig.region}.amazonaws.com/v2/search-text?key=${encodeURIComponent(awsConfig.key)}`,
    {
      QueryText: query,
      BiasPosition: [74.34, 31.55],
      Filter: { IncludeCountries: ["PAK"] },
      MaxResults: 5,
    },
  );
  return (d.ResultItems || []).map(
    (p: { Title: string; Position: [number, number] }) => ({
      name: p.Title,
      coordinates: p.Position,
    }),
  );
}
export async function calculateRoute(from: Place, to: Place): Promise<Route> {
  let note =
    "Direct geographic connection; not a navigable route. Access, shade and opening hours unverified.";
  if (awsConfig.key) {
    try {
      const d = await post(
        `https://routes.geo.${awsConfig.region}.amazonaws.com/v2/routes?key=${encodeURIComponent(awsConfig.key)}`,
        {
          Origin: from.coordinates,
          Destination: to.coordinates,
          TravelMode: "Pedestrian",
          LegGeometryFormat: "Simple",
        },
      );
      const r = d.Routes?.[0];
      const coordinates = r?.Legs?.flatMap(
        (l: { Geometry?: { LineString?: [number, number][] } }) =>
          l.Geometry?.LineString || [],
      );
      if (!coordinates?.length) throw new Error("No route geometry");
      return {
        from,
        to,
        coordinates,
        distanceKm: r.Summary.Distance / 1000,
        durationMin: r.Summary.Duration / 60,
        provider: "Amazon Location",
        note: "Pedestrian route. Park access and cooling facilities are unverified.",
      };
    } catch {
      note =
        "AWS routing unavailable. Showing a straight-line estimate; not navigable.";
    }
  }
  return {
    from,
    to,
    coordinates: [from.coordinates, to.coordinates],
    distanceKm: distance(from.coordinates, to.coordinates),
    durationMin: null,
    provider: "Straight-line estimate",
    note,
  };
}
