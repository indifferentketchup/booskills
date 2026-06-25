"use client";

import { useEffect, useState, useCallback } from "react";
import StyleBlock from "./StyleBlock";
import Presets from "./Presets";

function sourceOf(p) {
  const s = String(p || "");
  if (s.startsWith("deepseek/")) return "deepseek";
  if (s.startsWith("kilo/")) return "kilo";
  if (s.includes("digitalocean")) return "digitalocean";
  if (s.includes("openrouter")) return "openrouter";
  if (s.startsWith("reasonix/")) return "reasonix";
  if (s.startsWith("llama-swap/")) return "local";
  if (s.includes("==edge-")) return "local-edge";
  if (s.includes("==")) return "local";
  if (s.includes("opencode-go/")) return "opencode-go";
  if (s.startsWith("anthropic/") || s.startsWith("claude/") || s.startsWith("codex/") || s.startsWith("openai-codex/") || s.startsWith("cursor/") || s.startsWith("google-antigravity/")) return "subscription";
  if (s.includes("opencode/opencode/") || s.endsWith("-free")) return "opencode-zen";
  return "other";
}
const SOURCE_LABEL = {
  digitalocean: "DigitalOcean", reasonix: "Reasonix", openrouter: "OpenRouter",
  "opencode-zen": "OpenCode Zen", local: "Local", "local-edge": "Local edge",
  "opencode-go": "OpenCode Go", subscription: "Subscription",
};
function Chip({ provider }) {
  const src = sourceOf(provider);
  return (
    <span className="chip" style={{ "--c": `var(--p-${src})` }}>{SOURCE_LABEL[src] || src}</span>
  );
}

export default function Page() {
  const [tab, setTab] = useState("playground");
  const [opts, setOpts] = useState(null);
  const [optsError, setOptsError] = useState(null);

  useEffect(() => {
    fetch("/api/options").then((r) => r.json()).then((d) => {
      if (d.error) setOptsError(d.error); else setOpts(d);
    }).catch((e) => setOptsError(String(e)));
  }, []);

  const tabs = [
    { id: "playground", label: "Playground" },
    { id: "load", label: "Load" },
    { id: "priority", label: "Provider priority" },
    { id: "presets", label: "Presets" },
  ];

  return (
    <main className="page">
      <header className="head">
        <div>
          <h1>Model Router</h1>
          <p className="sub">Deterministic routing across DigitalOcean, Reasonix, OpenRouter, local, and OpenCode Go. Preview a decision, tune provider priority, or edit presets and role pools.</p>
        </div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      {optsError && <div className="panel error" role="alert">Could not load options: {optsError}. Is the router/registry present at ~/.paseo?</div>}

      {tab === "playground" && <Playground opts={opts} />}
      {tab === "load" && <Load />}
      {tab === "priority" && <Priority opts={opts} />}
      {tab === "presets" && <Presets opts={opts} />}

      <StyleBlock />
    </main>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function Meta({ k, v }) {
  return <span className="metabit"><span className="metak">{k}</span><span className="metav">{v ?? "-"}</span></span>;
}

/* ------------------------------------------------------------------ */
/*  Playground tab                                                     */
/* ------------------------------------------------------------------ */
function Playground({ opts }) {
  const [form, setForm] = useState({ preset: "workhorse", role: "impl", priority: "balanced", difficulty: "standard", task: "", contextTokens: 0, requires: "", fanout: 1, residentLocal: "" });
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run(e) {
    e.preventDefault();
    setState("loading"); setError(null);
    try {
      const r = await fetch("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "router error"); setState("error"); return; }
      setResult(d); setState("done");
    } catch (err) { setError(String(err)); setState("error"); }
  }

  const candidates = (result?.result?.scores || []).slice().sort((a, b) => (b.eliminated ? -1 : a.eliminated ? 1 : b.score - a.score));
  const live = candidates.filter((c) => !c.eliminated);
  const maxScore = Math.max(1, ...live.map((c) => c.score || 0));
  const minScore = Math.min(0, ...live.map((c) => c.score || 0));

  return (
    <div className="grid">
      <form className="panel form" onSubmit={run}>
        <div className="row">
          <Field label="Preset"><select value={form.preset} onChange={set("preset")}>{(opts?.presets || ["workhorse"]).map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Role"><select value={form.role} onChange={set("role")}>{(opts?.roles || ["impl"]).map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
        </div>
        <div className="row">
          <Field label="Priority"><select value={form.priority} onChange={set("priority")}>{(opts?.priorities || ["balanced"]).map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Difficulty"><select value={form.difficulty} onChange={set("difficulty")}>{(opts?.difficulties || ["standard"]).map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
        </div>
        <Field label="Task"><textarea rows={2} value={form.task} onChange={set("task")} placeholder="short task description (drives trait fit)" /></Field>
        <div className="row">
          <Field label="Context tokens"><input type="number" min={0} step={1000} value={form.contextTokens} onChange={set("contextTokens")} /></Field>
          <Field label="Fan-out"><input type="number" min={1} value={form.fanout} onChange={set("fanout")} /></Field>
        </div>
        <Field label="Requires (modalities)"><input value={form.requires} onChange={set("requires")} placeholder="e.g. image,computer-use" /></Field>
        <button className="btn primary" type="submit" disabled={state === "loading"}>{state === "loading" ? "Routing..." : "Route"}</button>
      </form>

      <section className="panel result" aria-live="polite">
        {state === "idle" && <div className="empty"><p>Pick a preset and role, then <strong>Route</strong> to see the chosen model, its cost source, reasoning effort, permissions, and the fallback chain.</p></div>}
        {state === "loading" && <div className="empty"><div className="spinner" aria-hidden="true" /><p>Scoring candidates...</p></div>}
        {state === "error" && <div className="error" role="alert"><strong>Routing failed.</strong><pre>{error}</pre></div>}
        {state === "done" && result && (
          <>
            <div className="pick">
              <div className="pick-head">
                <Chip provider={result.result.provider} />
                <span className="grade">grade {result.result.scores?.find((s) => s.provider === result.result.provider)?.grade || "?"}</span>
              </div>
              <code className="pick-id">{result.result.provider}</code>
              <div className="meta">
                <Meta k="reasoningEffort" v={result.result.reasoning?.effort} />
                <Meta k="permissions" v={`${result.result.permissions?.backend} ${result.result.permissions?.mode}`} />
              </div>
              <p className="why">{result.result.rationale}</p>
            </div>

            {result.result.fallbacks?.length > 0 && (
              <div className="fallbacks">
                <h3>Fallback chain</h3>
                <ol>{result.result.fallbacks.map((f) => <li key={f}><Chip provider={f} /> <code>{f}</code></li>)}</ol>
              </div>
            )}

            <div className="cands">
              <h3>Candidates</h3>
              <ul className="candlist">
                {candidates.map((c) => (
                  <li key={c.provider} className={c.eliminated ? "cand out" : "cand"}>
                    <div className="cand-top">
                      <Chip provider={c.provider} />
                      <code className="cand-id">{c.key}</code>
                      {c.eliminated ? <span className="tag bad">eliminated</span> : <span className="score">{c.score?.toFixed(1)}</span>}
                    </div>
                    {c.eliminated ? <p className="cand-reason">{c.reason}</p> : (
                      <>
                        <div className="bar"><span style={{ width: `${Math.max(2, ((c.score - minScore) / (maxScore - minScore || 1)) * 100)}%`, background: `var(--p-${sourceOf(c.provider)})` }} /></div>
                        <p className="cand-reason">{(c.reasons || []).slice(0, 4).join(" · ")}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Load tab                                                           */
/* ------------------------------------------------------------------ */
function pct(n) { return `${Math.round((n || 0) * 100)}%`; }

function LoadBar({ value, max, over, src }) {
  const ratio = max > 0 ? value / max : 0;
  const width = Math.max(2, Math.min(ratio, 1) * 100);
  const background = over ? "var(--bad)" : src ? `var(--p-${src})` : "var(--heather)";
  return <div className="bar"><span style={{ width: `${width}%`, background }} /></div>;
}

function fmtTokens(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tok`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K tok`;
  return `${n} tok`;
}

function Load() {
  const [data, setData] = useState(null);
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState(null);
  const [auto, setAuto] = useState(true);
  const [pulse, setPulse] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [lr, pr] = await Promise.all([
        fetch("/api/load", { cache: "no-store" }),
        fetch("/api/providers", { cache: "no-store" }),
      ]);
      const ld = await lr.json();
      if (!lr.ok) { setError(ld.error || "load read failed"); return; }
      setError(null); setData(ld); setPulse(true); setTimeout(() => setPulse(false), 400);
      if (pr.ok) { const pd = await pr.json(); setProviders(pd.providers || []); }
    } catch (err) { setError(String(err)); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, [auto, refresh]);

  if (error) return <div className="panel error" role="alert">Could not read load: {error}. Is the ledger at ~/.paseo/router-load.jsonl readable?</div>;
  if (!data) return <div className="panel"><div className="empty"><div className="spinner" aria-hidden="true" /><p>Reading load ledger...</p></div></div>;

  const host = data.host || {};
  const windowHrs = Math.round((data.windowSec || 18000) / 3600);
  const idle = !data.sources.length && !data.models.length;

  return (
    <div className="grid">
      <section className="panel form">
        <div className="editor-section__head">
          <h2>Live load</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className={`refresh-dot ${pulse ? "on" : ""}`} aria-hidden="true" />
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "6px", margin: 0 }}>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> <span>Auto</span>
            </label>
            <button className="btn btn-sm" onClick={refresh}>Refresh</button>
          </div>
        </div>
        <p className="sub">In-flight dispatches and rolling {windowHrs}h usage, reconciled from the shared router ledger. The router soft-penalizes a source as it fills its concurrency cap and a model as it nears its 5h quota. <strong>{data.totalInflight}</strong> agent(s) in flight now.</p>

        <h3 style={{ marginBottom: "8px" }}>Host pressure</h3>
        <div className="meta">
          <Meta k="CPU" v={pct(host.cpuSat)} />
          <Meta k="memory" v={pct(host.memSat)} />
          <Meta k="load (1m)" v={(host.load1 ?? 0).toFixed(2)} />
          <Meta k="cores" v={host.cores} />
        </div>
        <div className="bar"><span style={{ width: pct(Math.min(host.cpuSat || 0, 1)), background: (host.cpuSat || 0) > 0.8 ? "var(--bad)" : "var(--p-local)" }} /></div>
        <p className="sub dim">Local-model picks are penalized once host saturation passes 80%, steering fan-out to cloud instead of thrashing this machine.</p>

        {providers && providers.map((p) => (
          <div key={p.src} style={{ marginTop: "16px" }}>
            {p.src === "local" && (
              <>
                <h3 style={{ marginBottom: "8px" }}>
                  Local inference
                  <span className="tag" style={{ marginLeft: "8px", background: p.ok ? "var(--p-local)" : "var(--bad)", color: "#fff" }}>{p.ok ? "up" : "down"}</span>
                </h3>
                <div className="meta">
                  <Meta k="latency" v={`${p.latencyMs}ms`} />
                  {p.models?.length > 0 && <Meta k="loaded" v={p.models.map((m) => m.id || m).join(", ")} />}
                </div>
                {!p.ok && <p className="sub dim">llama-swap not reachable. Local models will still be scored but host-health data is unavailable.</p>}
              </>
            )}
          </div>
        ))}
      </section>

      <section className="panel">
        {idle && <div className="empty"><p>No active dispatches and no usage in the window. The ledger fills as <code>paseo-boo</code> reserves a pick at dispatch and releases it at closure.</p></div>}

        {data.sources.length > 0 && (
          <div className="cands">
            <h3>By source (concurrency)</h3>
            <ul className="candlist">
              {data.sources.map((s) => (
                <li key={s.src} className={`cand ${s.inflight > s.softCap ? "out" : ""}`}>
                  <div className="cand-top">
                    <span className="chip" style={{ "--c": `var(--p-${s.src})` }}>{SOURCE_LABEL[s.src] || s.src}</span>
                    <span className="score">{s.inflight}/{s.softCap}</span>
                    {s.inflight > s.softCap && <span className="tag bad">over cap</span>}
                  </div>
                  <LoadBar value={s.inflight} max={s.softCap} over={s.inflight > s.softCap} src={s.src} />
                  <p className="cand-reason">{s.inflight} in flight · {s.usage} dispatched this window</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.models.length > 0 && (
          <div className="cands">
            <h3>By model (5h quota)</h3>
            <ul className="candlist">
              {data.models.map((m) => {
                const near = m.quota > 0 && m.remaining / m.quota < 0.15;
                return (
                  <li key={m.key} className="cand">
                    <div className="cand-top">
                      <code className="cand-id">{m.key}</code>
                      {m.quota > 0 ? <span className="score">{m.usage}/{m.quota}</span> : <span className="tag">no quota set</span>}
                      {m.inflight > 0 && <span className="tag warn">{m.inflight} in flight</span>}
                      {near && <span className="tag bad">near limit</span>}
                    </div>
                    {m.quota > 0 && <LoadBar value={m.usage} max={m.quota} over={near} />}
                    <p className="cand-reason">{m.quota > 0 ? `${m.remaining} of ${m.quota} requests left this 5h window` : `${m.usage} dispatched this window`}{m.tokens > 0 ? ` · ${fmtTokens(m.tokens)}` : ""}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider priority tab                                              */
/* ------------------------------------------------------------------ */
function Priority({ opts }) {
  const [pp, setPp] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => { if (opts?.providerPriority) setPp({ ...opts.providerPriority }); }, [opts]);

  if (!pp) return <div className="panel"><div className="empty"><div className="spinner" aria-hidden="true" /><p>Loading provider priority...</p></div></div>;

  const sources = Object.keys(pp).filter((k) => !k.startsWith("_"));
  const max = Math.max(1, ...sources.map((s) => Math.abs(pp[s])));

  async function save() {
    setState("saving"); setError(null);
    try {
      const body = {}; for (const s of sources) body[s] = Number(pp[s]);
      const r = await fetch("/api/registry", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerPriority: body }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setState("error"); return; }
      setDirty(false); setState("saved"); setTimeout(() => setState("idle"), 2000);
    } catch (err) { setError(String(err)); setState("error"); }
  }

  return (
    <div className="panel form">
      <p className="sub">Higher = preferred source. Among providers serving the same model, the highest wins and the rest become the fallback chain. Saved to <code>~/.paseo/model-tiers.json</code> (a .ui-bak backup is written first).</p>
      <ul className="pplist">
        {sources.map((s) => (
          <li key={s}>
            <label htmlFor={`pp-${s}`} className="pp-name"><Chip provider={s === "subscription" ? "claude/x" : `x/${s}/x`} /> {SOURCE_LABEL[s] || s}</label>
            <div className="bar pp-bar"><span style={{ width: `${(Math.abs(pp[s]) / max) * 100}%`, background: pp[s] < 0 ? "var(--bad)" : `var(--p-${s})` }} /></div>
            <input id={`pp-${s}`} type="number" value={pp[s]} onChange={(e) => { setPp({ ...pp, [s]: e.target.value === "" ? 0 : Number(e.target.value) }); setDirty(true); }} />
          </li>
        ))}
      </ul>
      <div className="saverow">
        <button className="btn primary" onClick={save} disabled={!dirty || state === "saving"}>{state === "saving" ? "Saving..." : "Save priority"}</button>
        {state === "saved" && <output className="tag good">Saved</output>}
        {dirty && state !== "saving" && <span className="tag warn">Unsaved changes</span>}
        {state === "error" && <span className="tag bad" role="alert">{error}</span>}
      </div>
    </div>
  );
}
