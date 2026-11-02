import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Box,
  ChevronRight,
  Compass,
  Database,
  Flame,
  Globe2,
  Layers3,
  Leaf,
  LocateFixed,
  MapPin,
  Minus,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { AtlasMap, type MapHandle } from "./components/AtlasMap";
import { SpatialAgentDrawer } from "./components/SpatialAgentDrawer";
import { AwsSceneContext } from "./components/AwsSceneContext";
import { LocationInspector } from "./components/LocationInspector";
import { places } from "./data/lahoreSpatialData";
import {
  awsConfig,
  calculateRoute,
  geocode,
  nearestGreen,
} from "./services/awsLocationService";
import { runSpatialAgent } from "./services/spatialThinkingAgent";
import type { AgentResult, AgentStep, Layers, Place, Route } from "./types";
const layerOptions = [
  {
    id: "thermal" as const,
    name: "Thermal intensity",
    sub: "Modeled surface heat",
    icon: Flame,
  },
  {
    id: "places" as const,
    name: "Place clusters",
    sub: "Real Lahore locations",
    icon: MapPin,
  },
  {
    id: "green" as const,
    name: "Green refuge",
    sub: "Parks & open spaces",
    icon: Leaf,
  },
  {
    id: "columns" as const,
    name: "3D risk columns",
    sub: "Illustrative risk index",
    icon: Box,
  },
];
const storyStops = [
  {
    match: "Shahdara",
    title: "01 / Where the city holds heat",
    body: "Begin at Shahdara, a dense northern gateway. The scenario asks: what if a hot day puts this neighborhood under pressure?",
  },
  {
    match: "UVAS",
    title: "02 / A familiar starting point",
    body: "At my university, spatial data becomes personal. Real places ground an otherwise abstract climate question.",
  },
  {
    match: "Canal Bank · Jail",
    title: "03 / The green-blue contrast",
    body: "Compare the canal scenario with industrial areas. The difference illustrates a hypothesis to test with measured satellite data.",
  },
  {
    match: "Jinnah Gardens",
    title: "04 / Follow the green",
    body: "Parks become candidates to investigate. The atlas connects places while making uncertainty, access and data lineage visible.",
  },
];
export default function App() {
  const [rows, setRows] = useState(places),
    [source, setSource] = useState("Bundled OSM snapshot"),
    [layers, setLayers] = useState<Layers>({
      thermal: true,
      places: true,
      green: true,
      columns: false,
    }),
    [selected, setSelected] = useState<Place | null>(null),
    [selectedIds, setSelectedIds] = useState<string[] | null>(null),
    [route, setRoute] = useState<Route | null>(null),
    [open, setOpen] = useState(true),
    [modal, setModal] = useState<"architecture" | "data" | null>(null),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [searchError, setSearchError] = useState(""),
    [remoteResults, setRemoteResults] = useState<
      { name: string; coordinates: [number, number] }[]
    >([]),
    [searchBusy, setSearchBusy] = useState(false),
    [status, setStatus] = useState("Connecting map…"),
    [busy, setBusy] = useState(false),
    [steps, setSteps] = useState<AgentStep[]>([]),
    [result, setResult] = useState<AgentResult | null>(null),
    [question, setQuestion] = useState(""),
    [notice, setNotice] = useState(""),
    [story, setStory] = useState(-1),
    [tourPlaying, setTourPlaying] = useState(false),
    [prompt, setPrompt] = useState("");
  const map = useRef<MapHandle>(null),
    abort = useRef<AbortController | null>(null),
    searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!awsConfig.dataUrl) return;
    const c = new AbortController();
    fetch(awsConfig.dataUrl, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (
          d.type !== "FeatureCollection" ||
          !Array.isArray(d.features) ||
          !d.features.length
        )
          throw new Error();
        const imported = d.features.map(
          (f: {
            geometry: { type: string; coordinates: [number, number] };
            properties: Place;
          }) => {
            const p = { ...f.properties, coordinates: f.geometry.coordinates };
            if (
              f.geometry.type !== "Point" ||
              !p.id ||
              !p.name ||
              !["urban", "park", "industrial", "campus", "canal"].includes(
                p.kind,
              ) ||
              !p.coordinates.every(Number.isFinite) ||
              !Number.isFinite(p.temp_c) ||
              !Number.isFinite(p.canopy_pct) ||
              !Number.isFinite(p.risk) ||
              !Number.isFinite(p.vulnerability) ||
              p.heat_kind !== "modeled" ||
              !/^https:\/\//.test(p.source_url)
            )
              throw new Error();
            return p;
          },
        );
        setRows(imported);
        setSource("Remote spatial GeoJSON connected");
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setSource("Remote dataset unavailable · bundled snapshot");
      });
    return () => c.abort();
  }, []);
  const fly = useCallback((p: Place) => {
    setSelected(p);
    map.current?.fly(p);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setModal(null);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!tourPlaying) return;
    const t = setTimeout(() => {
      if (story >= storyStops.length - 1) {
        setTourPlaying(false);
        return;
      }
      setStory((v) => v + 1);
    }, 6500);
    return () => clearTimeout(t);
  }, [story, tourPlaying]);
  useEffect(() => {
    if (story < 0) return;
    const p = rows.find((p) => p.name.includes(storyStops[story].match));
    if (p) {
      setSelectedIds(null);
      fly(p);
    }
  }, [story, rows, fly]);
  const ask = async (text: string) => {
    if (busy) return;
    setTourPlaying(false);
    setStory(-1);
    setOpen(true);
    setQuestion(text);
    setResult(null);
    setSteps([]);
    setRoute(null);
    setBusy(true);
    const c = new AbortController();
    abort.current = c;
    try {
      const r = await runSpatialAgent(
        text,
        rows,
        {
          fly,
          filter: setSelectedIds,
          layers: (p) => setLayers((v) => ({ ...v, ...p })),
          route: setRoute,
        },
        setSteps,
        c.signal,
      );
      if (!c.signal.aborted) setResult(r);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setNotice("The query could not finish. Please try again.");
    } finally {
      if (abort.current === c) setBusy(false);
    }
  };
  const routeFrom = async (p: Place) => {
    if (busy) return;
    setBusy(true);
    const to = nearestGreen(p, rows);
    try {
      if (to) {
        setSelectedIds(null);
        setLayers((v) => ({ ...v, places: true, green: true }));
        setRoute(await calculateRoute(p, to));
      } else setNotice("No park candidates are available in this dataset.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  const reset = () => {
    abort.current?.abort();
    setSelectedIds(null);
    setSelected(null);
    setRoute(null);
    setStory(-1);
    setTourPlaying(false);
    setResult(null);
    setQuestion("");
    setSteps([]);
    map.current?.fit();
  };
  const matches = rows
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 6);
  const avg = (rows.reduce((s, p) => s + p.temp_c, 0) / rows.length).toFixed(1),
    parks = rows.filter((p) => p.kind === "park").length;
  const awsSearch = async () => {
    if (!search.trim()) return;
    if (!awsConfig.key) {
      setSearchError(
        "Local place search is active. Connect an Amazon Location API key to search beyond this dataset.",
      );
      return;
    }
    setSearchBusy(true);
    setSearchError("");
    try {
      const data = await geocode(search);
      setRemoteResults(data);
      if (!data.length)
        setSearchError(
          "No Amazon Location results. Try a more specific place.",
        );
    } catch {
      setSearchError(
        "Amazon Location search unavailable. Local results remain available.",
      );
    } finally {
      setSearchBusy(false);
    }
  };
  return (
    <main className={`atlas ${open ? "agent-open" : ""}`}>
      <AtlasMap
        ref={map}
        rows={rows}
        layers={layers}
        selectedIds={selectedIds}
        selected={selected}
        route={route}
        onSelect={(p) => {
          setSelected(p);
          if (window.innerWidth <= 700) setOpen(false);
        }}
        onStatus={setStatus}
      />
      <header className="topbar glass">
        <button className="brand" onClick={reset} aria-label="TerraPulse home">
          <span className="brand-symbol">
            <Globe2 size={24} />
          </span>
          <span>
            TerraPulse<sup>ATLAS</sup>
          </span>
        </button>
        <div className="top-location">
          <span>WORKSPACE</span>
          <ChevronRight size={12} />
          <span className="location-label">
            <i /> Lahore, Pakistan
          </span>
        </div>
        <div className="top-actions">
          <button
            className="nav-button"
            aria-label="AWS architecture"
            onClick={() => setModal("architecture")}
          >
            <Workflow size={15} />
            <span>AWS architecture</span>
            <ArrowUpRight size={13} />
          </button>
          <span className="nav-divider" />
          <button className="data-badge" onClick={() => setModal("data")}>
            <span className="live-dot" />
            Scenario explorer
            <BookOpen size={12} />
          </button>
        </div>
      </header>
      <div className="left-rail">
        <section className="atlas-heading">
          <span className="eyebrow">
            31.55° N &nbsp; 74.34° E &nbsp; / &nbsp; LAHORE
          </span>
          <h1>
            A city.
            <br /> Two climates.
          </h1>
          <p>
            Find a cooler way
            <br />
            through Lahore.
          </p>
          <span className="heading-rule" />
        </section>
        <div className="search-wrap">
          <form
            className="map-search glass"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchOpen(true);
              if (matches[0]) {
                fly(matches[0]);
                setSearchOpen(false);
              } else void awsSearch();
            }}
          >
            <Search size={16} />
            <input
              ref={searchInput}
              placeholder="Find a place…"
              aria-label="Search places"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
                setRemoteResults([]);
                setSearchError("");
              }}
            />
            <kbd>/</kbd>
          </form>
          {searchOpen && search && (
            <div className="search-results glass">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    fly(p);
                    setSearchOpen(false);
                    setSearch("");
                  }}
                >
                  <MapPin size={13} />
                  <span>{p.name}</span>
                  <ArrowUpRight size={12} />
                </button>
              ))}
              {!matches.length && <p>No local place matches.</p>}
              {remoteResults.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    map.current?.fly({
                      ...rows[0],
                      coordinates: p.coordinates,
                    });
                    setSearchOpen(false);
                  }}
                >
                  <Search size={13} />
                  <span>{p.name}</span>
                </button>
              ))}
              <button
                className="remote-search"
                onClick={() => void awsSearch()}
                disabled={searchBusy}
              >
                {searchBusy ? "Searching…" : "Search Amazon Location"}
                <ArrowUpRight size={12} />
              </button>
              {searchError && <p>{searchError}</p>}
            </div>
          )}
        </div>
        <section className="layer-panel glass">
          <div className="section-label">
            <span>
              <Layers3 size={14} />
              MAP LAYERS
            </span>
            <SlidersHorizontal size={13} />
          </div>
          {layerOptions.map(({ id, name, sub, icon: Icon }) => (
            <button
              className={`layer-row ${layers[id] ? "active" : ""}`}
              key={id}
              aria-label={name + " " + sub}
              onClick={() => setLayers((v) => ({ ...v, [id]: !v[id] }))}
              aria-pressed={layers[id]}
            >
              <span className={`layer-icon ${id}`}>
                <Icon size={18} />
              </span>
              <span className="layer-label">
                <strong>{name}</strong>
                <small>{sub}</small>
              </span>
              <span className="toggle">
                <span />
              </span>
            </button>
          ))}
          <div className="layer-caption">
            <span className="tiny-dot" />{" "}
            {selectedIds === null ? rows.length : selectedIds.length} places in
            view
            <button
              onClick={() => {
                setSelectedIds(null);
                setRoute(null);
              }}
            >
              Reset
            </button>
          </div>
        </section>
        <button
          className="story-launch glass"
          aria-label="The urban heat divide 4 places. One connected story."
          onClick={() => {
            setStory(0);
            setTourPlaying(true);
          }}
        >
          <span className="play-icon">
            <Play size={15} fill="currentColor" />
          </span>
          <span>
            <strong>The urban heat divide</strong>
            <small>4 places. One connected story.</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
        <button className="source-link" onClick={() => setModal("data")}>
          <Database size={12} />
          Behind the data
          <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="map-caption">
        <span className="map-region">PUNJAB / PAKISTAN</span>
        <h2>LAHORE</h2>
        <div>
          <span />
          THE CITY OF GARDENS
        </div>
      </div>
      <div className="map-tools glass">
        <button onClick={() => map.current?.zoom(1)} aria-label="Zoom in">
          <Plus size={17} />
        </button>
        <button onClick={() => map.current?.zoom(-1)} aria-label="Zoom out">
          <Minus size={17} />
        </button>
        <span />
        <button onClick={() => map.current?.fit()} aria-label="Reset map view">
          <LocateFixed size={17} />
        </button>
        <button
          onClick={() => map.current?.pitch()}
          aria-label="Toggle 3D perspective"
        >
          <Compass size={19} />
        </button>
      </div>
      <div className="map-legend glass">
        <div className="legend-top">
          <Flame size={14} />
          <span>MODELED TEMPERATURE</span>
          <span>°C</span>
        </div>
        <div className="legend-ramp" />
        <div className="legend-values">
          <span>36</span>
          <span>38</span>
          <span>40</span>
          <span>42</span>
          <span>46</span>
        </div>
      </div>
      <div className="metric-strip glass">
        <div>
          <span>PLACE RECORDS</span>
          <strong>
            {rows.length}
            <small>across Lahore</small>
          </strong>
        </div>
        <div>
          <span>SCENARIO MEAN</span>
          <strong>
            {avg}
            <small>°C</small>
          </strong>
        </div>
        <div>
          <span>GREEN CANDIDATES</span>
          <strong>
            {parks}
            <small>unverified access</small>
          </strong>
        </div>
      </div>
      <button className="ask-trigger glass" onClick={() => setOpen((v) => !v)}>
        <Sparkles size={17} />
        {open ? "Hide copilot" : "Ask copilot"}
        <kbd>⌘ K</kbd>
      </button>
      <SpatialAgentDrawer
        open={open}
        onClose={() => setOpen(false)}
        onAsk={(s) => void ask(s)}
        onFly={fly}
        busy={busy}
        steps={steps}
        result={result}
        question={question}
        onCancel={() => {
          abort.current?.abort();
          setBusy(false);
          setNotice("Query cancelled.");
        }}
        externalPrompt={prompt}
      />
      <LocationInspector
        place={selected}
        onClose={() => setSelected(null)}
        onRoute={(p) => void routeFrom(p)}
        onAsk={(p) => {
          setOpen(true);
          setPrompt(`Explore ${p.name}`);
          void ask(`Explore ${p.name}`);
        }}
        busy={busy}
      />
      {route && (
        <section className="route-summary glass">
          <div>
            <span className="eyebrow">{route.provider.toUpperCase()}</span>
            <button
              className="icon-button"
              onClick={() => setRoute(null)}
              aria-label="Clear connection"
            >
              <X size={14} />
            </button>
          </div>
          <h3>{route.to.name}</h3>
          <p>
            <strong>{route.distanceKm.toFixed(2)} km</strong>
            {route.durationMin !== null
              ? ` · ${Math.round(route.durationMin)} min walk`
              : " · direct connection"}
            <span>
              Δ {(route.from.temp_c - route.to.temp_c).toFixed(1)}°C modeled
            </span>
          </p>
          <small>{route.note}</small>
        </section>
      )}
      {story >= 0 && (
        <section className="story-player glass">
          <div className="story-header">
            <span className="eyebrow">THE URBAN HEAT DIVIDE</span>
            <button
              className="icon-button"
              aria-label="Close story"
              onClick={() => {
                setStory(-1);
                setTourPlaying(false);
              }}
            >
              <X size={15} />
            </button>
          </div>
          <div className="story-progress">
            {storyStops.map((_, i) => (
              <button
                key={i}
                className={i <= story ? "done" : ""}
                aria-label={`Story stop ${i + 1}`}
                onClick={() => setStory(i)}
              />
            ))}
          </div>
          <h3>{storyStops[story].title}</h3>
          <p>{storyStops[story].body}</p>
          <div className="story-footer">
            <span>{story + 1} / 4</span>
            <button
              onClick={() => setTourPlaying((v) => !v)}
              aria-label={tourPlaying ? "Pause story" : "Resume story"}
            >
              {tourPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={() => {
                if (story === 3) {
                  setStory(-1);
                  setTourPlaying(false);
                } else setStory((v) => v + 1);
              }}
            >
              {story === 3 ? "Finish" : "Next place"}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      )}
      <footer className="statusbar">
        <span>
          <i />
          {status}
        </span>
        <button onClick={() => setModal("data")}>
          Real coordinates · illustrative environmental values
        </button>
        <span>
          BUILT BY MUHAMMAD SHEHERYAR <ArrowDownLeft size={11} />
        </span>
      </footer>
      {notice && (
        <div className="toast glass" role="status">
          {notice}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              autoFocus
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">TERRAPULSE / OPEN BY DESIGN</span>
            <h2 id="modal-title">
              {modal === "architecture"
                ? "From a place to a spatial insight."
                : "Real places. Honest scenarios."}
            </h2>
            <AwsSceneContext />
            {modal === "architecture" ? (
              <>
                <p>
                  A reusable spatial workflow. Every integration reports what is
                  actually connected.
                </p>
                <div className="architecture-flow">
                  {[
                    {
                      icon: Database,
                      name: "01 / Source",
                      body: "OpenStreetMap places + reproducible scenario enrichment",
                    },
                    {
                      icon: Layers3,
                      name: "02 / Data plane",
                      body: "Python → S3 GeoJSON; optional Glue / Iceberg table",
                    },
                    {
                      icon: Globe2,
                      name: "03 / Map + routes",
                      body: "Amazon Location when configured; public map and direct connections otherwise",
                    },
                    {
                      icon: Sparkles,
                      name: "04 / Copilot",
                      body: "Deterministic spatial tools → visible execution log → MapLibre camera",
                    },
                  ].map(({ icon: Icon, name, body }) => (
                    <div key={name}>
                      <Icon size={23} />
                      <div>
                        <h3>{name}</h3>
                        <p>{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="integration-status">
                  <span>
                    Amazon Location
                    <strong>
                      {awsConfig.key
                        ? "Key configured · requests attempted"
                        : "Not configured"}
                    </strong>
                  </span>
                  <span>
                    Spatial dataset<strong>{source}</strong>
                  </span>
                  <span>
                    Agent<strong>Local deterministic engine</strong>
                  </span>
                  <span>
                    Hosting
                    <strong>
                      Amplify configuration included · deployment unverified
                    </strong>
                  </span>
                </div>
                <p className="modal-note">
                  No cloud resources have been provisioned by this app. SQL
                  examples in the repository are architecture patterns; the
                  copilot executes JavaScript filters over loaded GeoJSON.
                </p>
              </>
            ) : (
              <>
                <p>
                  {rows.length} locations bring Lahore into focus. Imported
                  OpenStreetMap nodes and park centers carry their own source
                  links; ten local anchors are marked as approximate.
                </p>
                <div className="data-facts">
                  <div>
                    <strong>{rows.length}</strong>
                    <span>place records</span>
                  </div>
                  <div>
                    <strong>{parks}</strong>
                    <span>park candidates</span>
                  </div>
                  <div>
                    <strong>0</strong>
                    <span>sensor observations</span>
                  </div>
                </div>
                <h3>What the colors mean</h3>
                <p>
                  Temperature, canopy, vulnerability and risk are deterministic
                  illustrative values generated from each record ID and place
                  category. They demonstrate the workflow and do not represent
                  current weather, satellite measurements, air quality, or
                  surveyed canopy.
                </p>
                <h3>What the connections mean</h3>
                <p>
                  Without AWS credentials, connections show geographic distance,
                  not walking directions. Parks have not been verified as
                  cooling, hydration or medical centers. Opening hours and
                  access are unknown.
                </p>
                <h3>Provenance you can inspect</h3>
                <p>
                  Flip any place card to see its source, coordinate quality and
                  partition. OpenStreetMap data is credited under ODbL. The
                  downloaded extract and reproducible enrichment script are
                  included.
                </p>
                <div className="modal-links">
                  <a
                    href={`${import.meta.env.BASE_URL}data/lahore.geojson`}
                    download
                  >
                    <Database size={14} />
                    Download GeoJSON
                    <ArrowUpRight size={14} />
                  </a>
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap attribution
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
