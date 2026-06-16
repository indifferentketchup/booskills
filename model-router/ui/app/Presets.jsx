"use client";

import { useState, useCallback } from "react";

const CANONICAL_ROLES = ["impl", "ui", "audit", "research", "planning"];

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function IconDup() { return <svg viewBox="0 0 16 16" className="icon-svg" aria-hidden="true"><rect x="5" y="1" width="9" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="2" y="4" width="9" height="13" rx="1" fill="var(--coat-2)" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function IconTrash() { return <svg viewBox="0 0 16 16" className="icon-svg" aria-hidden="true"><path d="M2 4h12M5.33 4V2.67a1 1 0 011-1h3.34a1 1 0 011 1V4m2 0v9.33a1 1 0 01-1 1H4.33a1 1 0 01-1-1V4h9.34z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function IconPen() { return <svg viewBox="0 0 16 16" className="icon-svg" aria-hidden="true"><path d="M2 11.33V14h2.67L13.2 5.47 10.53 2.8 2 11.33zM11.73 3.53l.74.74-1.07 1.07-.74-.74 1.07-1.07z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>; }
function IconX() { return <svg viewBox="0 0 16 16" className="icon-svg ic-del" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" /></svg>; }

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

export default function Presets({ opts }) {
  const [presets, setPresets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState("idle");
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
