import records from "./places.json";
import type { Place } from "../types";
export const places = records as Place[];
export const toGeoJSON = (rows: Place[]) => ({
  type: "FeatureCollection" as const,
  features: rows.map((p) => ({
    type: "Feature" as const,
    id: p.id,
    geometry: { type: "Point" as const, coordinates: p.coordinates },
    properties: { ...p, coordinates: undefined },
  })),
});
export const dataset = {
  version: "lahore-scenario-v1",
  attribution:
    "© OpenStreetMap contributors · ODbL; manually curated anchors marked separately",
  environment: "Deterministic illustrative scenario, not observations",
  observed_at: null,
};
