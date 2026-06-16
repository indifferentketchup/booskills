// Shared cross-process load ledger for the model router. Every router invocation
// is an independent forked process, so sibling subagents in a Paseo fan-out cannot
// see each other's picks in memory. This append-only JSONL ledger gives them a
// shared view: each pick writes a reservation, each completion writes a release,
// and snapshot() reconciles them into per-provider in-flight load and rolling-window
// usage so the scorer can spread fan-out and respect provider rate limits.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PASEO_DIR = process.env.PASEO_DIR || path.join(os.homedir(), ".paseo");
export const LEDGER_PATH = process.env.ROUTER_LOAD_LEDGER || path.join(PASEO_DIR, "router-load.jsonl");

const COMPACT_BYTES = 262144; // rewrite the ledger once it crosses ~256KB of churn.

// One JSON object per line. A single record stays well under the POSIX PIPE_BUF
// (4096 bytes) atomic-append threshold, so concurrent forks never interleave a
// partial line. The ledger is advisory: a write failure must never break routing.
function appendRecord(record) {
  try {
    fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(record)}\n`);
  } catch {
    // Swallow: an unreadable/unwritable ledger degrades to stateless routing.
  }
}

// Record a pick. `key` is the model key (last path segment), `src` the provider
// source (rate limits are per-source); `id` ties the reservation to its later
// release; `at` is the dispatch time in epoch ms.
export function reserve({ id, key, src, group, at, tokens } = {}) {
  appendRecord({ t: "res", key, src: src || null, id: id || null, grp: group || null, at, tok: tokens || 0 });
}

// Record a completion (success or failure) so the reservation stops counting as
// in-flight. `tokens` is optional actual spend, reserved for future accounting.
export function release(id, { at, tokens } = {}) {
  appendRecord({ t: "rel", id: id || null, at, tok: tokens || 0 });
}

// Reconcile the ledger into per-key and per-source load: `inflight` = live
// reservations (not yet released, not past TTL), `usage` = reservations inside the
// rolling window (every dispatch consumed one request against the 5h cap, released
// or not). Per-key feeds quota (quotas are per model); per-source feeds the
// concurrency cap (rate limits are per provider account).
export function snapshot(now, { windowSec = 5 * 3600, ttlSec = 1800 } = {}) {
  let raw;
  try {
    raw = fs.readFileSync(LEDGER_PATH, "utf8");
  } catch {
    return { byKey: {}, bySrc: {}, total: 0 };
  }

  const windowStart = now - windowSec * 1000;
  const released = new Set();
  const relTokens = {}; // id -> actual token spend from release record
  const reservations = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (rec.t === "rel" && rec.id) { released.add(rec.id); if (rec.tok) relTokens[rec.id] = rec.tok; }
    else if (rec.t === "res") reservations.push(rec);
  }

  const byKey = {};
  const bySrc = {};
  const tally = (bucket, field) => {
    const slot = bucket[field] || (bucket[field] = { inflight: 0, usage: 0, tokens: 0 });
    return slot;
  };
  for (const r of reservations) {
    if (r.at < windowStart) continue; // outside the rolling window
    const done = r.id && released.has(r.id);
    const expired = now - r.at > ttlSec * 1000; // assume leaked if past TTL with no release
    const live = !done && !expired;
    const tok = (r.id && relTokens[r.id]) || r.tok || 0;
    if (r.key) { const s = tally(byKey, r.key); s.usage += 1; s.tokens += tok; if (live) s.inflight += 1; }
    if (r.src) { const s = tally(bySrc, r.src); s.usage += 1; s.tokens += tok; if (live) s.inflight += 1; }
  }

  if (raw.length > COMPACT_BYTES) compact(reservations, released, windowStart);
  return { byKey, bySrc, total: reservations.length };
}

// Drop released, expired, and out-of-window reservations to bound file growth.
// Best-effort: a failure here is harmless, the next snapshot just reads more lines.
function compact(reservations, released, windowStart) {
  try {
    const live = reservations.filter((r) => r.at >= windowStart && !(r.id && released.has(r.id)));
    const body = live.map((r) => JSON.stringify(r)).join("\n");
    fs.writeFileSync(LEDGER_PATH, live.length ? `${body}\n` : "");
  } catch {
    // Leave the ledger as-is; growth is bounded by the next successful compaction.
  }
}

// Host pressure for local-model penalties: cpuSat > 1 means the run queue exceeds
// core count; memSat is the fraction of RAM in use. Both are free os built-ins.
export function hostLoad() {
  const cores = os.cpus()?.length || 1;
  const load1 = os.loadavg()[0] || 0;
  return { cpuSat: load1 / cores, memSat: 1 - os.freemem() / os.totalmem(), cores, load1 };
}

// Default load tuning. Overridable per-deployment by a `load` block in the registry.
// concurrency_soft is keyed by provider source (see sourceOf): cloud sources tolerate
// several concurrent dispatches; local sources serialize on one machine (cap 1).
export const LOAD_DEFAULTS = {
  enabled: true,
  window_sec: 5 * 3600,
  reservation_ttl_sec: 1800,
  inflight_penalty: 12, // per unit of (inflight / soft cap) crowding
  quota_pressure: 25, // ramps in over the last 15% of the rolling 5h quota
  host_load_penalty: 30, // local-only, ramps in past 80% host saturation
  concurrency_soft: { _default: 4, local: 1, "local-edge": 1, digitalocean: 6 },
};

// Soft load penalties for one candidate, never an elimination: in-flight crowding
// (subagent awareness, per source since rate limits are per account), remaining
// rolling-window quota (rate-limit awareness, per model), and host saturation for
// local models (one machine can't truly parallelize a fan-out).
export function loadAdjustment({ src, isLocal, inflight = 0, usage = 0, quota = 0, host, tuning } = {}) {
  const t = tuning || LOAD_DEFAULTS;
  const reasons = [];
  let score = 0;
  const add = (pts, why) => { score += pts; if (pts) reasons.push(`${pts > 0 ? "+" : ""}${pts.toFixed(1)} ${why}`); };

  const softCap = t.concurrency_soft?.[src] ?? t.concurrency_soft?._default ?? 4;

  // Subagent awareness: penalty grows as in-flight load approaches/exceeds the cap.
  if (inflight > 0) add(-(inflight / Math.max(1, softCap)) * t.inflight_penalty, `in-flight ${inflight}/${softCap} on ${src}`);

  // Rate-limit awareness: penalize as remaining quota in the window nears zero.
  if (quota > 0) {
    const headroom = Math.max(0, quota - usage) / quota;
    if (headroom < 0.15) add(-((0.15 - headroom) / 0.15) * t.quota_pressure, `near rate limit (${Math.round(headroom * 100)}% of ${quota}/5h left)`);
  }

  // Host pressure: only local models load this machine; push work to cloud when hot.
  if (isLocal && host && t.host_load_penalty) {
    const sat = Math.max(host.cpuSat, host.memSat);
    if (sat > 0.8) add(-Math.min((sat - 0.8) / 0.2, 2) * t.host_load_penalty, `host saturated (cpu ${Math.round(host.cpuSat * 100)}% mem ${Math.round(host.memSat * 100)}%)`);
  }

  return { score, reasons };
}
