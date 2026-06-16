"use client";

import { useEffect, useState, useCallback } from "react";
import StyleBlock from "./StyleBlock";

const CANONICAL_ROLES = ["impl", "ui", "audit", "research", "planning"];

function sourceOf(p) {
  const s = String(p || "");
  if (s.includes("digitalocean")) return "digitalocean";
  if (s.includes("openrouter")) return "openrouter";
  if (s.startsWith("reasonix/")) return "reasonix";
  if (s.includes("==edge-")) return "local-edge";
  if (s.includes("==")) return "local";
  if (s.includes("opencode-go/")) return "opencode-go";
  if (s.startsWith("claude/") || s.startsWith("codex/")) return "subscription";
  if (s.includes("opencode/opencode/") || s.endsWith("-free")) return "opencode-zen";
  return "subscription";
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
  const [form, setForm] = useState({ preset: "credits-first", role: "impl", priority: "balanced", difficulty: "standard", task: "", contextTokens: 0, requires: "", fanout: 1, residentLocal: "" });
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
          <Field label="Preset"><select value={form.preset} onChange={set("preset")}>{(opts?.presets || ["credits-first"]).map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
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

function Load() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [auto, setAuto] = useState(true);
  const [pulse, setPulse] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/load", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "load read failed"); return; }
      setError(null); setData(d); setPulse(true); setTimeout(() => setPulse(false), 400);
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
                    <p className="cand-reason">{m.quota > 0 ? `${m.remaining} of ${m.quota} requests left this 5h window` : `${m.usage} dispatched this window`}</p>
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

/* ------------------------------------------------------------------ */
/*  Presets tab                                                        */
/* ------------------------------------------------------------------ */
function Presets({ opts }) {
  const [presets, setPresets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(null);          // loaded preset being edited
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState("idle");       // idle | loading | saving | saved | error
  const [error, setError] = useState(null);
  const [createName, setCreateName] = useState("");
  const [createErr, setCreateErr] = useState(null);
  const [createState, setCreateState] = useState("idle");

  useEffect(() => { if (opts?.presets) setPresets(opts.presets); }, [opts]);

  async function loadEdit(name) {
    setState("loading"); setError(null);
    try {
      const r = await fetch(`/api/presets/${encodeURIComponent(name)}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error); setState("error"); return; }
      setSelected(name);
      setEdit(structuredClone(d));
      setDirty(false);
      setState("idle");
    } catch (err) { setError(String(err)); setState("error"); }
  }

  function updatePreset(fn) {
    setEdit((prev) => { const n = { ...prev }; fn(n); return n; });
    setDirty(true);
  }

  function addRole(role) {
    updatePreset((p) => { p.providers = { ...p.providers, [role]: p.providers[role] || [] }; });
  }
  function removeRole(role) {
    updatePreset((p) => { const np = { ...p.providers }; delete np[role]; p.providers = np; });
  }

  async function saveEdit() {
    if (!edit) return;
    setState("saving"); setError(null);
    try {
      const body = { concurrency: edit.concurrency, preferences: edit.preferences, agents: edit.agents, providers: edit.providers };
      const r = await fetch(`/api/presets/${encodeURIComponent(edit.preset)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.error); setState("error"); return; }
      setDirty(false); setState("saved"); setTimeout(() => setState("idle"), 2000);
    } catch (err) { setError(String(err)); setState("error"); }
  }

  async function handleDelete(name) {
    if (!window.confirm(`Delete preset "${name}"? A .ui-bak backup will be kept.`)) return;
    try {
      const r = await fetch(`/api/presets/${encodeURIComponent(name)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) { setError(d.error); return; }
      setPresets((p) => p.filter((n) => n !== name));
      if (selected === name) { setSelected(null); setEdit(null); }
      setError(null);
    } catch (err) { setError(String(err)); }
  }

  async function handleDuplicate(source) {
    const target = source + "-copy";
    try {
      const r = await fetch("/api/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: target, duplicate: source }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error); return; }
      setPresets((p) => [...p, target].sort());
      setError(null);
    } catch (err) { setError(String(err)); }
  }

  async function handleRename(oldName, newName) {
    if (!newName || !/^[a-z0-9-]+$/.test(newName)) return;
    try {
      const r = await fetch("/api/presets", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ oldName, newName }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error); return; }
      setPresets((p) => p.map((n) => (n === oldName ? newName : n)).sort());
      setSelected((s) => (s === oldName ? newName : s));
      setEdit((e) => (e ? { ...e, preset: newName } : null));
      setError(null);
    } catch (err) { setError(String(err)); }
  }

  async function handleCreate() {
    if (!createName || !/^[a-z0-9-]+$/.test(createName)) {
      setCreateErr("Name must be lowercase alphanumeric with hyphens");
      return;
    }
    setCreateState("saving"); setCreateErr(null);
    try {
      const r = await fetch("/api/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: createName }) });
      const d = await r.json();
      if (!r.ok) { setCreateErr(d.error); setCreateState("error"); return; }
      setPresets((p) => [...p, createName].sort());
      setCreateName("");
      setCreateState("saved"); setTimeout(() => setCreateState("idle"), 2000);
    } catch (err) { setCreateErr(String(err)); setCreateState("error"); }
  }

  if (!presets.length) return <div className="panel"><div className="empty"><div className="spinner" aria-hidden="true" /><p>Loading presets...</p></div></div>;

  return (
    <div className="grid twin">
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2>Presets</h2>
        <div className="create-row">
          <input className="input-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="new-preset-name" />
          <button className="btn btn-sm primary" onClick={handleCreate} disabled={!createName || createState === "saving"}>{createState === "saving" ? "Creating..." : "Create"}</button>
        </div>
        {createState === "saved" && <output className="tag good">Created</output>}
        {createErr && <span className="tag bad" role="alert">{createErr}</span>}
        {error && !edit && <div className="error-sm" role="alert">{error}</div>}

        <ul className="preset-list">
          {presets.map((name) => (
            <li key={name} className={`preset-row ${selected === name ? "preset-row--sel" : ""}`}>
              <button className="preset-row__name" onClick={() => loadEdit(name)} title={`Edit ${name}`}>{name}</button>
              <div className="preset-row__actions">
                <button className="icon-btn" onClick={() => handleDuplicate(name)} title="Duplicate" aria-label={`Duplicate ${name}`}><IconDup /></button>
                <RenameBtn current={name} onRename={(nn) => handleRename(name, nn)} />
                <button className="icon-btn icon-del" onClick={() => handleDelete(name)} title="Delete" aria-label={`Delete ${name}`}><IconTrash /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {state === "loading" && <div className="panel"><div className="empty"><div className="spinner" aria-hidden="true" /><p>Loading preset...</p></div></div>}
      {state === "error" && !edit && <div className="panel error" role="alert">{error}</div>}
      {!edit && state !== "loading" && state !== "error" && (
        <div className="panel"><div className="empty"><p><strong>Select a preset</strong> on the left to edit its concurrency, preferences, role pools, and agents. Or create a blank one above and add roles to it.</p></div></div>
      )}
      {edit && (
        <PresetEditor edit={edit} dirty={dirty} state={state} error={error}
          actions={{ update: updatePreset, addRole, removeRole, save: saveEdit }} />
      )}
    </div>
  );
}

function PresetEditor({ edit, dirty, state, error, actions }) {
  const { update: onUpdate, addRole: onAddRole, removeRole: onRemoveRole, save: onSave } = actions;
  const roleKeys = Object.keys(edit.providers || {});
  const addable = CANONICAL_ROLES.filter((r) => !roleKeys.includes(r));
  return (
    <div className="panel form">
      <h2>{edit.preset}</h2>
      {error && state === "error" && <div className="error-sm" role="alert">{error}</div>}
      <Field label="Concurrency">
        <input type="number" min={1} max={100} value={edit.concurrency} onChange={(e) => onUpdate((p) => { p.concurrency = Number(e.target.value) || 1; })} />
      </Field>
      <Field label="Preferences (one per line)">
        <textarea className="input-tall" value={(edit.preferences || []).join("\n")} onChange={(e) => onUpdate((p) => { p.preferences = e.target.value.split("\n"); })} />
      </Field>

      <div className="editor-section">
        <div className="editor-section__head">
          <h3>Role pools</h3>
          {addable.length ? (
            <select className="input-sm" value="" aria-label="Add role" onChange={(e) => { if (e.target.value) onAddRole(e.target.value); }}>
              <option value="">+ add role</option>
              {addable.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <span className="tag good" title="impl, ui, audit, research, planning are all present">all 5 roles added</span>
          )}
        </div>
        {roleKeys.length === 0 && <p className="sub dim">No roles yet. Add one above. Roles are the fixed set impl / ui / audit / research / planning.</p>}
        {roleKeys.map((role) => (
          <RoleEditor key={role} role={role} providers={edit.providers[role] || []} onChange={(arr) => onUpdate((p) => { p.providers = { ...p.providers, [role]: arr }; })} onRemove={() => onRemoveRole(role)} />
        ))}
      </div>

      <div className="editor-section">
        <h3>Agents (persona to model)</h3>
        <AgentsEditor agents={edit.agents || {}} onChange={(a) => onUpdate((p) => { p.agents = a; })} />
      </div>

      <div className="saverow">
        <button className="btn primary" onClick={onSave} disabled={!dirty || state === "saving"}>{state === "saving" ? "Saving..." : "Save"}</button>
        {state === "saved" && <output className="tag good">Saved</output>}
        {dirty && state !== "saving" && <span className="tag warn">Unsaved changes</span>}
      </div>
    </div>
  );
}

function RenameBtn({ current, onRename }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current);
  const [err, setErr] = useState(null);
  const dialogRef = useCallback((el) => { if (el && !el.open) el.showModal(); }, []);

  function submit() {
    if (!val || !/^[a-z0-9-]+$/.test(val)) { setErr("lowercase alphanumeric + hyphens"); return; }
    onRename(val);
    setOpen(false);
    setErr(null);
  }

  return (
    <span style={{ position: "relative" }}>
      <button className="icon-btn" onClick={() => { setOpen(true); setVal(current); setErr(null); }} title="Rename" aria-label={`Rename ${current}`}><IconPen /></button>
      {open && (
        <dialog ref={dialogRef} className="mini-dialog" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) { e.currentTarget.close(); setOpen(false); } }}>
          <div className="mini-inner" onClick={(e) => e.stopPropagation()}>
            <label className="field"><span>Rename</span><input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
            {err && <span className="tag bad" style={{ marginTop: "6px", display: "inline-block" }}>{err}</span>}
            <div className="mini-actions">
              <button className="btn btn-sm" onClick={() => { setOpen(false); }}>Cancel</button>
              <button className="btn btn-sm primary" onClick={submit}>Rename</button>
            </div>
          </div>
        </dialog>
      )}
    </span>
  );
}

function RoleEditor({ role, providers, onChange, onRemove }) {
  const [newProv, setNewProv] = useState("");

  function move(from, to) {
    if (to < 0 || to >= providers.length) return;
    const arr = [...providers];
    const [it] = arr.splice(from, 1);
    arr.splice(to, 0, it);
    onChange(arr);
  }

  return (
    <div className="role-block">
      <div className="role-block__head">
        <span className="role-name">{role}</span>
        <button className="icon-btn icon-del" onClick={onRemove} title="Remove role" aria-label={`Remove role ${role}`}><IconX /></button>
      </div>
      <ul className="cand-edlist">
        {providers.map((p, i) => (
          <li key={`${p}-${i}`} className="cand-edrow">
            <span className="cand-edrow__idx">{i + 1}</span>
            <code className="cand-edrow__code">{p}</code>
            <div className="cand-edrow__btns">
              <button className="icon-btn icon-sm" onClick={() => move(i, i - 1)} disabled={i === 0} title="Move up" aria-label="Move up">&#8593;</button>
              <button className="icon-btn icon-sm" onClick={() => move(i, i + 1)} disabled={i === providers.length - 1} title="Move down" aria-label="Move down">&#8595;</button>
              <button className="icon-btn icon-sm icon-del" onClick={() => { const arr = [...providers]; arr.splice(i, 1); onChange(arr); }} title="Remove" aria-label="Remove">&#10005;</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="cand-addrow">
        <input className="input-sm" value={newProv} onChange={(e) => setNewProv(e.target.value)} placeholder="oc-digitalocean/digitalocean/model-id" onKeyDown={(e) => { if (e.key === "Enter" && newProv.trim()) { onChange([...providers, newProv.trim()]); setNewProv(""); } }} />
        <button className="btn btn-sm primary" onClick={() => { if (newProv.trim()) { onChange([...providers, newProv.trim()]); setNewProv(""); } }} disabled={!newProv.trim()}>Add</button>
      </div>
    </div>
  );
}

function AgentsEditor({ agents, onChange }) {
  const [addKey, setAddKey] = useState("");
  const [addVal, setAddVal] = useState("");

  function add() {
    if (!addKey.trim() || !addVal.trim()) return;
    onChange({ ...agents, [addKey.trim()]: addVal.trim() });
    setAddKey(""); setAddVal("");
  }

  return (
    <div>
      <div className="cand-addrow" style={{ marginBottom: "12px" }}>
        <input className="input-sm" value={addKey} onChange={(e) => setAddKey(e.target.value)} placeholder="persona name" />
        <input className="input-sm" value={addVal} onChange={(e) => setAddVal(e.target.value)} placeholder="model-id" onKeyDown={(e) => { if (e.key === "Enter" && addKey.trim() && addVal.trim()) { add(); } }} />
        <button className="btn btn-sm primary" onClick={add} disabled={!addKey.trim() || !addVal.trim()}>Add</button>
      </div>
      {Object.keys(agents).length === 0 && <p className="sub dim">No agents configured.</p>}
      <ul className="agent-list">
        {Object.entries(agents).map(([key, val]) => (
          <li key={key} className="agent-row">
            <span className="agent-key">{key}</span>
            <code className="agent-val">{val}</code>
            <button className="icon-btn icon-sm icon-del" onClick={() => { const n = { ...agents }; delete n[key]; onChange(n); }} title="Remove" aria-label={`Remove ${key}`}>&#10005;</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icon sprites (inline SVG)                                          */
/* ------------------------------------------------------------------ */
function IconDup() { return <svg viewBox="0 0 16 16" className="icon-svg" aria-hidden="true"><rect x="5" y="1" width="9" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="2" y="4" width="9" height="13" rx="1" fill="var(--coat-2)" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function IconTrash() { return <svg viewBox="0 0 16 16" className="icon-svg" aria-hidden="true"><path d="M2 4h12M5.33 4V2.67a1 1 0 011-1h3.34a1 1 0 011 1V4m2 0v9.33a1 1 0 01-1 1H4.33a1 1 0 01-1-1V4h9.34z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function IconPen() { return <svg viewBox="0 0 16 16" className="icon-svg" aria-hidden="true"><path d="M2 11.33V14h2.67L13.2 5.47 10.53 2.8 2 11.33zM11.73 3.53l.74.74-1.07 1.07-.74-.74 1.07-1.07z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function IconX() { return <svg viewBox="0 0 16 16" className="icon-svg ic-del" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" /></svg>; }

/* ------------------------------------------------------------------ */
/*  StyleBlock (all component CSS)                                     */
/* ------------------------------------------------------------------ */
