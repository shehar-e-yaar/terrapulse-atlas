import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource, type Map as GLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { FeatureCollection, Polygon } from "geojson";
import type { Layers, Place, Route } from "../types";
import { toGeoJSON } from "../data/lahoreSpatialData";
import { awsConfig, awsStyleUrl } from "../services/awsLocationService";
maplibregl.setWorkerUrl(workerUrl);
export type MapHandle = {
  fly: (p: Place) => void;
  fit: () => void;
  zoom: (delta: number) => void;
  pitch: () => void;
};
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
const heatColor: maplibregl.ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "temp_c"],
  36,
  "#78e6c3",
  40,
  "#f2bc66",
  43,
  "#ff7951",
  46,
  "#e95060",
];
function columns(rows: Place[]): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: rows.map((p) => {
      const [x, y] = p.coordinates,
        r = 0.00045;
      return {
        type: "Feature",
        properties: { ...p, height: Math.max(30, (p.temp_c - 35) * 75) },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [x - r, y - r],
              [x + r, y - r],
              [x + r, y + r],
              [x - r, y + r],
              [x - r, y - r],
            ],
          ],
        },
      };
    }),
  };
}
export const AtlasMap = forwardRef<
  MapHandle,
  {
    rows: Place[];
    layers: Layers;
    selectedIds: string[] | null;
    selected: Place | null;
    route: Route | null;
    onSelect: (p: Place) => void;
    onStatus: (s: string) => void;
  }
>(function AtlasMap(
  { rows, layers, selectedIds, selected, route, onSelect, onStatus },
  ref,
) {
  const root = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    latest = useRef({ rows, onSelect, onStatus });
  latest.current = { rows, onSelect, onStatus };
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  useImperativeHandle(
    ref,
    () => ({
      fly(p) {
        map.current?.flyTo({
          center: p.coordinates,
          zoom: 13.3,
          pitch: 50,
          duration: 1600,
          padding:
            window.innerWidth > 1000
              ? { left: 270, right: 420, top: 100, bottom: 170 }
              : { left: 15, right: 15, top: 130, bottom: 300 },
        });
      },
      fit() {
        map.current?.flyTo({
          center: [74.333, 31.552],
          zoom: 11.3,
          pitch: 40,
          bearing: -18,
          duration: 1200,
          padding: 0,
        });
      },
      zoom(d) {
        map.current?.zoomTo((map.current?.getZoom() || 11) + d);
      },
      pitch() {
        map.current?.easeTo({
          pitch: map.current.getPitch() > 10 ? 0 : 55,
          bearing: map.current.getPitch() > 10 ? 0 : -18,
          duration: 900,
        });
      },
    }),
    [],
  );
  useEffect(() => {
    if (!root.current) return;
    let fallback = false,
      disposed = false;
    let m: GLMap;
    const addOverlays = () => {
      if (disposed) return;
      if (m.getSource("places")) return;
      m.addSource("places", {
        type: "geojson",
        data: toGeoJSON(latest.current.rows),
        cluster: true,
        clusterRadius: 35,
        clusterMaxZoom: 12,
      });
      m.addSource("raw", {
        type: "geojson",
        data: toGeoJSON(latest.current.rows),
      });
      m.addSource("columns", {
        type: "geojson",
        data: columns(latest.current.rows),
      });
      m.addSource("route", { type: "geojson", data: empty });
      m.addSource("selection", { type: "geojson", data: empty });
      m.addLayer({
        id: "heat",
        type: "heatmap",
        source: "raw",
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "temp_c"],
            36,
            0.05,
            46,
            1,
          ],
          "heatmap-intensity": 0.6,
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            18,
            14,
            65,
          ],
          "heatmap-opacity": 0.32,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.2,
            "rgba(181,91,43,0.2)",
            0.5,
            "rgba(255,112,64,0.6)",
            1,
            "rgba(255,211,119,0.85)",
          ],
        },
      });
      m.addLayer({
        id: "green",
        type: "circle",
        source: "raw",
        filter: ["==", ["get", "kind"], "park"],
        paint: {
          "circle-color": "#64e3aa",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 15, 35],
          "circle-opacity": 0.13,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#6fedba",
          "circle-stroke-opacity": 0.35,
        },
      });
      m.addLayer({
        id: "columns",
        type: "fill-extrusion",
        source: "columns",
        paint: {
          "fill-extrusion-color": heatColor,
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-opacity": 0.72,
        },
      });
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "places",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#152c2e",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            20,
            22,
            100,
            29,
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#82c6b6",
        },
      });
      m.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "places",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 11,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#d6f7eb" },
      });
      m.addLayer({
        id: "nodes",
        type: "circle",
        source: "places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": heatColor,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3.5, 14, 7],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#102026",
          "circle-opacity": 0.95,
        },
      });
      m.addLayer({
        id: "selected-ring",
        type: "circle",
        source: "selection",
        paint: {
          "circle-radius": 17,
          "circle-color": "#92f5da",
          "circle-opacity": 0.12,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#baffed",
        },
      });
      m.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: {
          "line-width": 12,
          "line-color": "#82f9db",
          "line-opacity": 0.12,
          "line-blur": 8,
        },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#92f5da",
          "line-width": 3,
          "line-dasharray": [3, 2],
        },
      });
      setReady(true);
      latest.current.onStatus(
        awsConfig.key && !fallback
          ? "Amazon Location map connected"
          : "OpenStreetMap · OpenFreeMap vector",
      );
    };
    try {
      m = new maplibregl.Map({
        container: root.current,
        style: awsConfig.key
          ? awsStyleUrl()
          : `${import.meta.env.BASE_URL}map-style.json`,
        center: [74.333, 31.552],
        zoom: 11.3,
        pitch: 40,
        bearing: -18,
        attributionControl: { compact: true },
        maxZoom: 18,
        minZoom: 8,
        canvasContextAttributes: { antialias: true },
      });
      map.current = m;
    } catch {
      setUnsupported(true);
      return;
    }
    m.on("load", addOverlays);
    m.on("style.load", addOverlays);
    let baseErrors = 0;
    m.on("error", () => {
      baseErrors++;
      if (awsConfig.key && !fallback) {
        fallback = true;
        setReady(false);
        m.setStyle(`${import.meta.env.BASE_URL}map-style.json`);
        latest.current.onStatus("AWS map unavailable · public basemap");
      } else if (baseErrors > 3)
        latest.current.onStatus(
          "Basemap unavailable · place overlays remain interactive",
        );
    });
    m.on("click", "clusters", async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const z = await (
        m.getSource("places") as GeoJSONSource
      ).getClusterExpansionZoom(Number(f.properties?.cluster_id));
      if (!disposed && f.geometry.type === "Point")
        m.easeTo({
          center: f.geometry.coordinates as [number, number],
          zoom: z,
          duration: 600,
        });
    });
    for (const layer of ["nodes", "columns", "green"]) {
      m.on("click", layer, (e) => {
        const p = latest.current.rows.find(
          (p) => p.id === e.features?.[0]?.properties?.id,
        );
        if (p) latest.current.onSelect(p);
      });
      m.on("mouseenter", layer, () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", layer, () => {
        m.getCanvas().style.cursor = "";
      });
    }
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(root.current);
    return () => {
      disposed = true;
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const visible =
      selectedIds === null
        ? rows
        : rows.filter((p) => selectedIds.includes(p.id));
    (m.getSource("places") as GeoJSONSource)?.setData(toGeoJSON(visible));
    (m.getSource("raw") as GeoJSONSource)?.setData(toGeoJSON(visible));
    (m.getSource("columns") as GeoJSONSource)?.setData(columns(visible));
  }, [rows, selectedIds, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const groups = {
      thermal: ["heat"],
      places: ["nodes", "clusters", "cluster-count"],
      green: ["green"],
      columns: ["columns"],
    };
    for (const [key, ids] of Object.entries(groups))
      for (const id of ids)
        if (m.getLayer(id))
          m.setLayoutProperty(
            id,
            "visibility",
            layers[key as keyof Layers] ? "visible" : "none",
          );
  }, [layers, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("selection") as GeoJSONSource)?.setData(
      selected ? toGeoJSON([selected]) : empty,
    );
  }, [selected, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("route") as GeoJSONSource)?.setData(
      route
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: route.coordinates,
                },
              },
            ],
          }
        : empty,
    );
    if (route) {
      const b = new maplibregl.LngLatBounds();
      route.coordinates.forEach((c) => b.extend(c));
      m.fitBounds(b, {
        padding:
          m.getContainer().clientWidth > 1000
            ? {
                left: 310,
                right: 430,
                top: Math.min(190, m.getContainer().clientHeight * 0.18),
                bottom: Math.min(270, m.getContainer().clientHeight * 0.25),
              }
            : {
                left: 30,
                right: 30,
                top: Math.min(170, m.getContainer().clientHeight * 0.18),
                bottom: Math.min(280, m.getContainer().clientHeight * 0.3),
              },
        absolutePadding: true,
        maxZoom: 14,
        duration: 1400,
      });
    }
  }, [route, ready]);
  return (
    <div className="map-stage">
      <div className="map-canvas" ref={root} data-testid="map-canvas" />
      {unsupported && (
        <div className="map-unavailable glass">
          <h2>Map graphics unavailable</h2>
          <p>
            Your browser needs WebGL to display the map. The copilot and place
            data still work.
          </p>
        </div>
      )}
      <div className="map-vignette" />
    </div>
  );
});
