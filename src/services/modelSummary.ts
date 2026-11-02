import type { Place } from "../types";
import { awsConfig } from "./awsLocationService";
export async function modelSummary(
  question: string,
  records: Place[],
  signal?: AbortSignal,
): Promise<string | null> {
  if (!awsConfig.agentUrl) return null;
  try {
    const r = await fetch(awsConfig.agentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, records: records.slice(0, 8) }),
      signal: AbortSignal.any([
        signal || new AbortController().signal,
        AbortSignal.timeout(8000),
      ]),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.summary === "string" ? d.summary.slice(0, 1500) : null;
  } catch {
    return null;
  }
}
