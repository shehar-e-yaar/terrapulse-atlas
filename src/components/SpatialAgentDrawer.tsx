import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  Command,
  MapPin,
  PanelRightClose,
  Plus,
  Sparkles,
  Square,
  Terminal,
} from "lucide-react";
import type { AgentResult, AgentStep, Place } from "../types";
import { prompts } from "../services/spatialThinkingAgent";
export function SpatialAgentDrawer({
  open,
  onClose,
  onAsk,
  onFly,
  busy,
  steps,
  result,
  question,
  onCancel,
  externalPrompt,
}: {
  open: boolean;
  onClose: () => void;
  onAsk: (s: string) => void;
  onFly: (p: Place) => void;
  busy: boolean;
  steps: AgentStep[];
  result: AgentResult | null;
  question: string;
  onCancel: () => void;
  externalPrompt: string;
}) {
  const [input, setInput] = useState(""),
    [expanded, setExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (externalPrompt) setInput(externalPrompt);
  }, [externalPrompt]);
  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result, busy]);
  return (
    <aside
      className={`copilot glass ${open ? "is-open" : ""}`}
      aria-label="Spatial copilot"
      aria-hidden={!open}
      {...{ inert: !open ? "" : undefined }}
    >
      <header className="copilot-header">
        <div className="copilot-title">
          <span className="agent-icon">
            <Sparkles size={19} />
          </span>
          <div>
            <h2>Spatial copilot</h2>
            <span className="eyebrow">YOUR CITY, DECODED</span>
          </div>
        </div>
        <button
          className="icon-button close-agent"
          aria-label="Close copilot"
          onClick={onClose}
        >
          <PanelRightClose size={18} />
        </button>
      </header>
      <div className="agent-scroll">
        <div className="engine-status">
          <i />
          LOCAL SPATIAL ENGINE<span>v1.0</span>
        </div>
        <div className="agent-welcome">
          <span className="orb">
            <Sparkles size={25} />
          </span>
          <h3>
            Your city,
            <br />
            in a new light.
          </h3>
          <p>
            Find the heat. Follow the green.
            <br />
            Let the data guide your next move.
          </p>
        </div>
        <div className="prompt-heading">
          <span>START EXPLORING</span>
          <Plus size={12} />
        </div>
        <div className="prompts">
          {prompts.slice(0, 3).map((p, i) => (
            <button key={p} disabled={busy} onClick={() => onAsk(p)}>
              <span className={`prompt-dot dot-${i}`} />
              <span>{p}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
        {question && <div className="user-message">{question}</div>}
        {steps.length > 0 && (
          <div className="execution">
            <button
              className="execution-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              <span>
                <Terminal size={14} />
                {busy ? "Working on the map…" : "Execution complete"}
              </span>
              <ChevronDown
                size={15}
                style={{ transform: expanded ? "rotate(180deg)" : "" }}
              />
            </button>
            {expanded && (
              <div className="execution-steps">
                {steps.map((step, i) => (
                  <div className="execution-step" key={i}>
                    <span
                      className={
                        step.status === "running"
                          ? "step-spinner"
                          : "step-check"
                      }
                    >
                      {step.status === "done" ? <Check size={11} /> : null}
                    </span>
                    <div>
                      <div className="step-title">
                        {step.title}
                        <span>
                          {step.status === "done" ? `${step.ms}ms` : "running"}
                        </span>
                      </div>
                      <p>{step.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="trace-note">
                  Actual operations · no hidden model reasoning
                </div>
              </div>
            )}
          </div>
        )}
        {result && (
          <div className="agent-answer" aria-live="polite">
            <span className="answer-mark">
              <Sparkles size={14} /> SPATIAL INSIGHT
            </span>
            <p>{result.answer}</p>
            {result.modelSummary && (
              <div className="model-summary">
                <small>OPTIONAL MODEL SUMMARY</small>
                <p>{result.modelSummary}</p>
              </div>
            )}
            <div className="citations">
              {result.citations.map((p) => (
                <button key={p.id} onClick={() => onFly(p)}>
                  <MapPin size={11} />
                  {p.name}
                  <ArrowUpRight size={11} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <footer className="agent-footer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !busy) {
              onAsk(input.trim());
              setInput("");
            }
          }}
        >
          <input
            ref={inputRef}
            id="spatial-query"
            aria-label="Ask a spatial question"
            placeholder="Ask about Lahore…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
          />
          {busy ? (
            <button type="button" onClick={onCancel} aria-label="Cancel query">
              <Square size={15} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send query"
            >
              <ArrowUp size={19} />
            </button>
          )}
        </form>
        <div className="agent-disclosure">
          <span>Modeled heat. Real places.</span>
          <span>
            <Command size={10} /> K
          </span>
        </div>
      </footer>
    </aside>
  );
}
