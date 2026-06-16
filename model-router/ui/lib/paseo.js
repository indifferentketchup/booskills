// Server-only helpers for the model-router control panel.
// Resolves the sibling router.mjs and the ~/.paseo config it reads/writes.
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

// llama-swap base URL — override via env when running in Docker or on a non-default port.
export const LLAMA_SWAP_URL = process.env.LLAMA_SWAP_URL || "http://localhost:8080";

const execFileAsync = promisify(execFile);

const REPO_MODEL_ROUTER = path.resolve(process.cwd(), "..");
// Paths are env-overridable so the app runs identically host-native or in Docker
// (the container sets ROUTER_PATH and PASEO_DIR; bind-mount ~/.paseo to PASEO_DIR).
export const ROUTER_PATH = process.env.ROUTER_PATH || path.join(REPO_MODEL_ROUTER, "router.mjs");
export const PASEO_DIR = process.env.PASEO_DIR || path.join(os.homedir(), ".paseo");
export const REGISTRY_PATH = path.join(PASEO_DIR, "model-tiers.json");
export const PRESETS_DIR = path.join(PASEO_DIR, "presets");

export async function readRegistry() {
  return JSON.parse(await fs.readFile(REGISTRY_PATH, "utf8"));
}

export async function writeRegistry(registry) {
  await fs.copyFile(REGISTRY_PATH, `${REGISTRY_PATH}.ui-bak`);
  await fs.writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export async function listPresets() {
  const entries = await fs.readdir(PRESETS_DIR);
  return entries.filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, "")).sort();
}

function presetPath(name) {
  const resolved = path.join(PRESETS_DIR, `${name}.json`);
  if (!resolved.startsWith(PRESETS_DIR + path.sep)) throw new Error("path traversal rejected");
  return resolved;
}

export async function readPreset(name) {
  return JSON.parse(await fs.readFile(presetPath(name), "utf8"));
}

export async function writePreset(name, obj) {
  const filePath = presetPath(name);
  await fs.copyFile(filePath, `${filePath}.ui-bak`);
  await fs.writeFile(filePath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

export async function deletePreset(name) {
  const filePath = presetPath(name);
  await fs.copyFile(filePath, `${filePath}.ui-bak`);
  await fs.unlink(filePath);
}

export async function createPreset(name, template) {
  const obj = template
    ? { ...template, preset: name }
    : { preset: name, concurrency: 1, providers: {}, preferences: [], agents: {} };
  const filePath = presetPath(name);
  await fs.writeFile(filePath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

export async function renamePreset(oldName, newName) {
  const obj = await readPreset(oldName);
  obj.preset = newName;
  await writePreset(newName, obj);
  await deletePreset(oldName);
}

const OR_KEY_PATH = path.join(PASEO_DIR, "openrouter-key");
const OR_BASE = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

// Read the OpenRouter management key from ~/.paseo/openrouter-key (null if absent).
async function readOrKey() {
  try { return (await fs.readFile(OR_KEY_PATH, "utf8")).trim(); } catch { return null; }
}

// Fetch OpenRouter account credits and per-key daily usage. Returns { ok, credits, keyInfo }.
export async function checkOpenRouter() {
  const key = await readOrKey();
  if (!key) return { src: "openrouter", ok: false, reason: "no key configured" };
  const start = Date.now();
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    const [cr, ki] = await Promise.allSettled([
      fetch(`${OR_BASE}/credits`, { headers }),
      fetch(`${OR_BASE}/key`, { headers }),
    ]);
    const credits = cr.status === "fulfilled" && cr.value.ok ? (await cr.value.json()).data : null;
    const keyInfo = ki.status === "fulfilled" && ki.value.ok ? (await ki.value.json()).data : null;
    return {
      src: "openrouter",
      ok: !!(credits || keyInfo),
      latencyMs: Date.now() - start,
      balance: credits ? credits.total_credits - credits.total_usage : null,
      usageToday: keyInfo?.usage_daily ?? null,
      usageMonth: keyInfo?.usage_monthly ?? null,
      limitRemaining: keyInfo?.limit_remaining ?? null,
    };
  } catch (err) {
    return { src: "openrouter", ok: false, latencyMs: Date.now() - start, reason: String(err.message) };
  }
}

// Poll llama-swap for health and the currently loaded model. Times out at 3 s so a
// downed local server never stalls the dashboard. Returns { ok, latencyMs, models }.
export async function checkLocalProvider() {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const [health, running] = await Promise.allSettled([
      fetch(`${LLAMA_SWAP_URL}/health`, { signal: controller.signal }),
      fetch(`${LLAMA_SWAP_URL}/running`, { signal: controller.signal }),
    ]);
    clearTimeout(timer);
    const ok = health.status === "fulfilled" && health.value.ok;
    let models = [];
    if (running.status === "fulfilled" && running.value.ok) {
      try { models = await running.value.json(); } catch { /* ignore parse error */ }
    }
    return { src: "local", ok, latencyMs: Date.now() - start, models: Array.isArray(models) ? models : [] };
  } catch {
    clearTimeout(timer);
    return { src: "local", ok: false, latencyMs: Date.now() - start, models: [] };
  }
}

// Read-only load snapshot for the dashboard. Shells out to the router the same way
// runRouter does (avoids bundling the router's ledger module into Next), then shapes
// the raw snapshot with the registry's quotas. A missing ledger reports zero load.
export async function readLoad() {
  const { stdout } = await execFileAsync("node", [ROUTER_PATH, "--load-snapshot", "--model-tiers", REGISTRY_PATH], { timeout: 15000 });
  const snap = JSON.parse(stdout);
  const registry = await readRegistry();
  const quotas = registry.quotas_per_5h || {};
  const softCaps = snap.tuning?.concurrency_soft || {};
  const softCap = (src) => softCaps[src] ?? softCaps._default ?? 4;

  const sources = Object.entries(snap.bySrc || {})
    .map(([src, v]) => ({ src, inflight: v.inflight, usage: v.usage, tokens: v.tokens || 0, softCap: softCap(src) }))
    .sort((a, b) => b.inflight - a.inflight || b.usage - a.usage);
  const models = Object.entries(snap.byKey || {})
    .map(([key, v]) => {
      const quota = Number(quotas[key] ?? 0);
      return { key, inflight: v.inflight, usage: v.usage, tokens: v.tokens || 0, quota, remaining: quota ? Math.max(0, quota - v.usage) : null };
    })
    .sort((a, b) => b.inflight - a.inflight || b.usage - a.usage);

  return {
    now: snap.now,
    host: snap.host || {},
    windowSec: snap.tuning?.window_sec ?? 5 * 3600,
    sources,
    models,
    totalInflight: sources.reduce((sum, s) => sum + s.inflight, 0),
  };
}

export async function runRouter(req) {
  const args = ["--json", "--role", req.role, "--task", req.task || "", "--model-tiers", REGISTRY_PATH];
  if (req.preset) args.push("--preset", path.join(PRESETS_DIR, `${req.preset}.json`));
  if (req.priority) args.push("--priority", req.priority);
  if (req.difficulty) args.push("--difficulty", req.difficulty);
  if (Number(req.contextTokens) > 0) args.push("--context-tokens", String(req.contextTokens));
  if (req.requires) args.push("--requires", req.requires);
  if (Number(req.fanout) > 1) args.push("--fanout", String(req.fanout));
  if (req.residentLocal) args.push("--resident-local", req.residentLocal);

  try {
    const { stdout } = await execFileAsync("node", [ROUTER_PATH, ...args], { timeout: 15000 });
    return { ok: true, result: JSON.parse(stdout) };
  } catch (error) {
    const message = (error.stderr || error.message || "router failed").toString().trim();
    return { ok: false, error: message };
  }
}
