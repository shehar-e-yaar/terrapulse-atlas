import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Code2,
  ExternalLink,
  Leaf,
  RotateCcw,
  Route as RouteIcon,
  Sparkles,
  Thermometer,
  X,
} from "lucide-react";
import type { Place } from "../types";
export function LocationInspector({
  place,
  onClose,
  onRoute,
  onAsk,
  busy,
}: {
  place: Place | null;
  onClose: () => void;
  onRoute: (p: Place) => void;
  onAsk: (p: Place) => void;
  busy: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [place?.id]);
  return (
    <AnimatePresence>
      {place && (
        <motion.section
          key={place.id}
          className="inspector-shell"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          aria-label="Location inspector"
        >
          <motion.div
            className="inspector-flipper"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.55 }}
          >
            <div
              className="inspector-face glass"
              aria-hidden={flipped}
              {...{ inert: flipped ? "" : undefined }}
            >
              <div className="inspector-top">
                <span className="eyebrow">
                  <i />
                  SELECTED PLACE
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Show raw record"
                    onClick={() => setFlipped(true)}
                  >
                    <Code2 size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Close inspector"
                    onClick={onClose}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              <h2>{place.name}</h2>
              <p className="coordinates">
                {place.coordinates[1].toFixed(4)}° N &nbsp;{" "}
                {place.coordinates[0].toFixed(4)}° E
              </p>
              <div className="inspector-metrics">
                <div>
                  <span>
                    <Thermometer size={12} /> SCENARIO
                  </span>
                  <strong className="thermal-text">
                    {place.temp_c.toFixed(1)}
                    <small>°C</small>
                  </strong>
                </div>
                <div>
                  <span>
                    <Leaf size={12} /> CANOPY*
                  </span>
                  <strong>
                    {place.canopy_pct}
                    <small>%</small>
                  </strong>
                </div>
                <div>
                  <span>MODEL INDEX</span>
                  <strong>
                    {place.risk}
                    <small>/100</small>
                  </strong>
                </div>
              </div>
              <button
                className="primary-button"
                onClick={() => onRoute(place)}
                disabled={busy}
              >
                <RouteIcon size={15} />
                Find nearby green space
                <ArrowUpRight size={15} />
              </button>
              <button
                className="text-button"
                onClick={() => onAsk(place)}
                disabled={busy}
              >
                <Sparkles size={12} />
                Ask copilot about this place
              </button>
            </div>
            <div
              className="inspector-face inspector-back glass"
              aria-hidden={!flipped}
              {...{ inert: !flipped ? "" : undefined }}
            >
              <div className="inspector-top">
                <span className="eyebrow">SOURCE / DATA LINEAGE</span>
                <button
                  className="icon-button"
                  aria-label="Return to place"
                  onClick={() => setFlipped(false)}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <h2>Every place, traceable.</h2>
              <pre>
                {JSON.stringify(
                  {
                    id: place.id,
                    kind: place.kind,
                    heat_kind: place.heat_kind,
                    temp_c: place.temp_c,
                    canopy_pct: place.canopy_pct,
                    observed_at: null,
                    partition: place.partition,
                    coordinates: place.coordinate_quality,
                  },
                  null,
                  2,
                )}
              </pre>
              <a href={place.source_url} target="_blank" rel="noreferrer">
                Open coordinate source
                <ExternalLink size={12} />
              </a>
            </div>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
