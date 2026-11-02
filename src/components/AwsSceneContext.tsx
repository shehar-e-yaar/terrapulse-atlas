import { useEffect, useState } from "react";
import { Satellite, ArrowUpRight } from "lucide-react";
type Context = {
  source_url: string;
  scene_id: string;
  datetime: string;
  cloud_cover_pct: number;
  bbox: number[];
};
export function AwsSceneContext() {
  const [data, setData] = useState<Context | null>(null),
    [live, setLive] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/aws-context.json`, {
      signal: c.signal,
    })
      .then((r) => r.json())
      .then(async (snapshot: Context) => {
        setData(snapshot);
        try {
          const r = await fetch(snapshot.source_url, {
            signal: AbortSignal.any([c.signal, AbortSignal.timeout(7000)]),
          });
          if (!r.ok) throw new Error();
          const d = await r.json();
          if (d.id === snapshot.scene_id) setLive(true);
        } catch {
          /* The verified pipeline snapshot remains usable offline. */
        }
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  if (!data) return null;
  return (
    <div className="aws-scene-context">
      <Satellite size={18} />
      <div>
        <strong>Amazon S3 · Sentinel-2 scene context</strong>
        <p>
          {data.scene_id} · {data.datetime.slice(0, 10)} ·{" "}
          {data.cloud_cover_pct.toFixed(1)}% cloud cover
        </p>
        <small>
          {live
            ? "Live S3 metadata verified"
            : "Pipeline snapshot · live S3 check unavailable or pending"}
          . Optical context only; heat values are independently modeled.
        </small>
        <a href={data.source_url} target="_blank" rel="noreferrer">
          Inspect original S3 object
          <ArrowUpRight size={12} />
        </a>
      </div>
    </div>
  );
}
