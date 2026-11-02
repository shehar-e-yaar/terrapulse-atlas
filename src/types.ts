export type Place = {
  id: string;
  name: string;
  coordinates: [number, number];
  kind: "urban" | "park" | "industrial" | "campus" | "canal";
  region: string;
  temp_c: number;
  canopy_pct: number;
  vulnerability: number;
  risk: number;
  source_url: string;
  coordinate_quality: string;
  heat_kind: "modeled";
  observed_at: null;
  partition: string;
};
export type Layer = "thermal" | "places" | "green" | "columns";
export type Layers = Record<Layer, boolean>;
export type Route = {
  from: Place;
  to: Place;
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number | null;
  provider: "Amazon Location" | "Straight-line estimate";
  note: string;
};
export type AgentStep = {
  title: string;
  detail: string;
  ms: number;
  status: "running" | "done";
};
export type AgentResult = {
  answer: string;
  citations: Place[];
  route?: Route;
  matches: Place[];
  query: string;
  modelSummary?: string;
};
