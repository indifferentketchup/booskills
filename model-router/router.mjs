#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as ledger from "./load-ledger.mjs";

const DEFAULT_MODEL_TIERS = "~/.paseo/model-tiers.json";
const DEFAULT_PRESET = "~/.paseo/orchestration-preferences.json";
const ROLES = new Set(["impl", "ui", "audit", "research", "planning"]);
const DIFFICULTIES = new Set(["simple", "standard", "hard"]);
const BUDGETS = new Set(["cost_sensitive", "balanced", "quality"]);
const LOCAL_MODEL_MARKER = "==qwen==/";
const LOCAL_PROVIDER_PREFIX = "llama-swap/";

// Quality grade -> numeric. S>A>B>C; L (local) ranks with C on the quality axis.
const GRADE_VALUE = { S: 4, A: 3, B: 2, C: 1, L: 1 };
// Minimum grade value a task of each difficulty wants. Below floor = under-spec penalty.
const DIFFICULTY_FLOOR = { simple: 1, standard: 2, hard: 3 };

// Routing priority profiles. costWeight penalizes effective cost; speedWeight
// rewards the per-model speed signal; qualityBonus rewards higher grade; effortBias
// steps the recommended reasoningEffort up (+1) or down (-1) within the model's levels.
const PRIORITIES = {
  balanced: { costWeight: 6, speedWeight: 0, qualityBonus: 0, effortBias: 0 },
  "cost-efficiency": { costWeight: 14, speedWeight: 0, qualityBonus: 0, effortBias: -1 },
  speed: { costWeight: 4, speedWeight: 60, qualityBonus: 0, effortBias: -1 },
  quality: { costWeight: 2, speedWeight: 0, qualityBonus: 15, effortBias: 1 },
};
// Back-compat: the legacy --budget values map onto priorities.
const BUDGET_TO_PRIORITY = { cost_sensitive: "cost-efficiency", balanced: "balanced", quality: "quality" };

function expandHome(filePath) {
  if (!filePath) return filePath;
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(expandHome(filePath), "utf8"));
}

function parseArgs(argv) {
  const args = {
    budget: "balanced",
    contextTokens: 0,
    difficulty: "standard",
    fanout: 1,
    modelTiersPath: DEFAULT_MODEL_TIERS,
    presetPath: DEFAULT_PRESET,
    requires: [],
    residentLocal: "",
    task: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index];

    if (arg === "--dry-run-samples") args.dryRunSamples = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--explain") args.explain = true;
    else if (arg === "--role") args.role = next();
    else if (arg === "--task") args.task = next() || "";
    else if (arg === "--difficulty") args.difficulty = next() || "standard";
    else if (arg === "--budget") args.budget = next() || "balanced";
    else if (arg === "--priority") args.priority = next();
    else if (arg === "--context-tokens") args.contextTokens = Number(next() || 0);
    else if (arg === "--fanout") args.fanout = Number(next() || 1);
    else if (arg === "--requires") args.requires = String(next() || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--resident-local") args.residentLocal = next() || "";
    else if (arg === "--preset") args.presetPath = next();
    else if (arg === "--model-tiers") args.modelTiersPath = next();
    else if (arg === "--reserve") args.reserve = next() || "";
    else if (arg === "--release") args.release = next() || "";
    else if (arg === "--tokens") args.tokens = Number(next() || 0);
    else if (arg === "--no-ledger") args.noLedger = true;
    else if (arg === "--load-snapshot") args.loadSnapshot = true;
    else if (arg === "--live-status") args.liveStatus = next() || "";
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function normalizeModelId(provider) {
  return String(provider).replace(/^opencode\//, "");
}

function registryLookupKey(provider, registry) {
  const key = modelKey(provider);
  const aliases = registry.key_aliases;
  if (aliases && typeof aliases[key] === "string") return aliases[key];
  return key;
}

function modelKey(provider) {
  const parts = normalizeModelId(provider).split("/");
  return parts[parts.length - 1];
}

function isLocalProvider(provider) {
  const normalized = normalizeModelId(provider);
  return normalized.startsWith(LOCAL_PROVIDER_PREFIX) || normalized.startsWith(LOCAL_MODEL_MARKER);
}

// Models flagged neverSubagent in any tier object must never be routed (the
// router only ever selects subagents). This is the guardrail the README promised.
function neverSubagentSet(registry) {
  const set = new Set();
  for (const value of Object.values(registry)) {
    if (value && typeof value === "object" && !Array.isArray(value) && value.neverSubagent && Array.isArray(value.models)) {
      for (const id of value.models) set.add(modelKey(id));
    }
  }
  return set;
}

function tierName(modelId, tiers) {
  const normalized = normalizeModelId(modelId);
  for (const [name, value] of Object.entries(tiers)) {
    if (Array.isArray(value) && value.includes(normalized)) return name;
    if (value && Array.isArray(value.models) && value.models.includes(normalized)) return name;
  }
  return "unknown";
}

// Pick the pricing band that matches the request context size. Qwen Plus models
// carry an _over_256k band that roughly triples cost past 256K tokens.
function pricingForContext(key, registry, contextTokens) {
  const base = registry.pricing?.[key] || {};
  if (contextTokens > 256000 && base._over_256k) return { ...base, ...base._over_256k, _band: "over_256k" };
  return base;
}

function effectivePricing(pricing = {}) {
  return {
    input: Number(pricing.effective_input ?? pricing.input ?? 0),
    output: Number(pricing.effective_output ?? pricing.output ?? 0),
    cachedRead: Number(pricing.effective_cached_read ?? pricing.cached_read ?? 0),
  };
}

// Output dominates real spend; weight it 3:1 over input.
function blendedCost(pricing) {
  const e = effectivePricing(pricing);
  return e.output * 0.75 + e.input * 0.25;
}

// Hard filters. Returns null if the candidate survives, else a disqualifying reason.
function disqualify(key, attrs, request, neverSub) {
  if (neverSub.has(key)) return "neverSubagent guardrail (S-tier never routed as subagent)";
  if (!attrs) return null; // unknown model: do not eliminate, it just scores low
  if (attrs.routable === false) return `not routable (${attrs.routable_note || "availability/license hold"})`;
  const mods = attrs.modalities || [];
  for (const need of request.requires) {
    if (!mods.includes(need)) return `missing required modality: ${need}`;
  }
  if (request.contextTokens > 0 && attrs.ctx_max && request.contextTokens > attrs.ctx_max) {
    return `context ${request.contextTokens} exceeds ctx_max ${attrs.ctx_max}`;
  }
  return null;
}

// Soft quality and role-fit score.
function fitScore(attrs, request) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => { score += points; if (points) reasons.push(`${points > 0 ? "+" : ""}${points.toFixed(0)} ${reason}`); };

  if (!attrs) {
    add(50, "unknown model (neutral baseline)");
    return { score, reasons, grade: "?" };
  }

  // Role affinity is the backbone.
  const affinity = attrs.roles?.[request.role] ?? 0.5;
  add(affinity * 100, `role ${request.role} affinity ${affinity}`);

  // Trait overlap with the task/role/requires text.
  const haystack = `${request.task} ${request.role} ${request.requires.join(" ")}`.toLowerCase();
  const hits = (attrs.traits || []).filter((t) => haystack.includes(String(t).toLowerCase()));
  if (hits.length) add(Math.min(hits.length, 4) * 8, `traits: ${hits.slice(0, 4).join(", ")}`);

  // Difficulty headroom: penalize under-spec, do not reward overkill (economics handles that).
  const gradeVal = GRADE_VALUE[attrs.grade] ?? 1;
  const floor = DIFFICULTY_FLOOR[request.difficulty] ?? 2;
  if (gradeVal < floor) add(-(floor - gradeVal) * 40, `under-spec for ${request.difficulty} (grade ${attrs.grade})`);

  // Context sweet-spot: fits the ceiling but degrades past the sweet spot.
  if (request.contextTokens > 0 && attrs.ctx_sweet_spot && request.contextTokens > attrs.ctx_sweet_spot) {
    add(-30, `past ctx sweet-spot ${attrs.ctx_sweet_spot}`);
  }

  // Quality priority: reward higher grade.
  const priority = PRIORITIES[request.priority] || PRIORITIES.balanced;
  if (priority.qualityBonus) add(gradeVal * priority.qualityBonus, `quality priority (grade ${attrs.grade})`);

  return { score, reasons, grade: attrs.grade };
}

// Classify a provider string into a cost/priority source for provider_priority.
// Order matters: check the cloud gateways before the generic opencode markers.
function sourceOf(provider) {
  const s = String(provider);
  if (s.startsWith("deepseek/")) return "deepseek";
  if (s.includes("digitalocean")) return "digitalocean";
  if (s.startsWith("kilo/")) return "kilo";
  if (s.startsWith("openrouter/") || s.includes("openrouter")) return "openrouter";
  if (s.startsWith("reasonix/")) return "reasonix";
  if (s.startsWith(LOCAL_PROVIDER_PREFIX)) return "local";
  if (s.includes("==edge-")) return "local-edge";
  if (s.includes("==")) return "local";
  if (s.includes("opencode-go/")) return "opencode-go";
  if (
    s.startsWith("anthropic/") ||
    s.startsWith("claude/") ||
    s.startsWith("openai-codex/") ||
    s.startsWith("codex/") ||
    s.startsWith("cursor/") ||
    s.startsWith("google-antigravity/")
  ) {
    return "subscription";
  }
  if (s.includes("opencode/opencode/") || s.endsWith(":free")) return "gateway-free";
  return "other";
}

// Economics tiebreak: provider priority, cost, quota, live load, locality, residency.
function economics(provider, key, request, registry, presetIndex, loadCtx) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => { score += points; if (points) reasons.push(`${points > 0 ? "+" : ""}${points.toFixed(1)} ${reason}`); };

  const priority = PRIORITIES[request.priority] || PRIORITIES.balanced;

  // Provider priority: route equivalent models to the preferred source (free DO
  // credits first, then cheap cloud, then local; opencode-go deprioritized).
  const src = sourceOf(provider);
  const pp = registry.provider_priority?.[src];
  if (typeof pp === "number" && pp) add(pp, `provider ${src}`);

  const regKey = registryLookupKey(provider, registry);
  const pricing = pricingForContext(regKey, registry, request.contextTokens);
  const cost = blendedCost(pricing);
  add(-cost * priority.costWeight, `blended cost $${cost.toFixed(3)}/M${pricing._band ? ` (${pricing._band})` : ""}`);

  // Speed priority: reward the per-model responsiveness signal (TTFT-oriented).
  const speed = registry.speed?.[regKey];
  if (priority.speedWeight && typeof speed === "number") add(speed * priority.speedWeight, `speed ${speed}`);

  const quota = Number(registry.quotas_per_5h?.[regKey] ?? (isLocalProvider(provider) ? 200 : 0));
  add(Math.min(quota, 30000) / 1000, `quota ${quota}/5h`);

  const local = isLocalProvider(provider);
  if (local && request.fanout > 1) {
    add(-80, `local penalized for fan-out x${request.fanout}`);
  } else if (local) {
    add(request.priority === "cost-efficiency" ? 20 : 5, "local zero-dollar serial option");
    if (request.residentLocal && key === modelKey(request.residentLocal)) {
      add(25, "already resident in llama-swap (no model swap)");
    }
  }

  add(-presetIndex * 0.01, "preset order");

  // Live load: soft penalties for in-flight crowding, quota exhaustion, and (local
  // only) host saturation. Reconciled from the shared cross-process ledger.
  if (loadCtx) {
    const adj = ledger.loadAdjustment({
      src,
      isLocal: local,
      inflight: loadCtx.bySrc?.[src]?.inflight,
      usage: loadCtx.byKey?.[key]?.usage,
      quota,
      host: loadCtx.host,
      tuning: loadCtx.tuning,
    });
    score += adj.score;
    reasons.push(...adj.reasons);
  }

  return { score, cost, quota, isLocal: local, band: pricing._band || "base", reasons };
}

function scoreCandidate(provider, request, registry, neverSub, presetIndex, loadCtx) {
  const key = modelKey(provider);
  const regKey = registryLookupKey(provider, registry);
  const normalized = normalizeModelId(provider);
  const attrs = registry.attributes?.[regKey];
  const dq = disqualify(key, attrs, request, neverSub);

  if (dq) {
    return { provider, modelId: normalized, key, tier: tierName(normalized, registry), eliminated: true, reason: dq, score: -Infinity, reasons: [`ELIMINATED: ${dq}`] };
  }

  const fit = fitScore(attrs, request);
  const econ = economics(provider, key, request, registry, presetIndex, loadCtx);

  return {
    provider,
    modelId: normalized,
    key,
    tier: tierName(normalized, registry),
    grade: fit.grade,
    eliminated: false,
    score: fit.score + econ.score,
    fitScore: Math.round(fit.score),
    econScore: Number(econ.score.toFixed(1)),
    effectiveCostPerMTok: econ.cost,
    quotaPer5h: econ.quota,
    isLocal: econ.isLocal,
    band: econ.band,
    reasons: [...fit.reasons, ...econ.reasons],
  };
}

// Merge the registry's optional `load` block over the code defaults (concurrency
// caps merge per-source rather than replacing the map wholesale).
function mergeTuning(registry) {
  return {
    ...ledger.LOAD_DEFAULTS,
    ...(registry.load || {}),
    concurrency_soft: { ...ledger.LOAD_DEFAULTS.concurrency_soft, ...(registry.load?.concurrency_soft || {}) },
  };
}

// Resolve the live-load context once per routing call: merged tuning, the
// reconciled cross-process ledger snapshot, and host pressure. Returns null when
// load awareness is disabled, so the scorer falls back to stateless behavior.
function buildLoadContext(request, registry) {
  const tuning = mergeTuning(registry);
  if (request.noLedger || tuning.enabled === false) return null;
  const snap = ledger.snapshot(Date.now(), { windowSec: tuning.window_sec, ttlSec: tuning.reservation_ttl_sec });
  return { byKey: snap.byKey, bySrc: snap.bySrc, host: ledger.hostLoad(), tuning };
}

// Emit the raw load snapshot as JSON for the control UI's dashboard. Self-contained
// so the UI can shell out the same way it runs a routing decision.
function printLoadSnapshot(args) {
  const registry = readJson(args.modelTiersPath);
  const tuning = mergeTuning(registry);
  const snap = ledger.snapshot(Date.now(), { windowSec: tuning.window_sec, ttlSec: tuning.reservation_ttl_sec });
  console.log(JSON.stringify({ now: Date.now(), host: ledger.hostLoad(), byKey: snap.byKey, bySrc: snap.bySrc, tuning }));
}

function chooseProvider(request, preset, registry) {
  if (!ROLES.has(request.role)) throw new Error(`Role must be one of: ${[...ROLES].join(", ")}`);
  if (!DIFFICULTIES.has(request.difficulty)) throw new Error(`Difficulty must be one of: ${[...DIFFICULTIES].join(", ")}`);
  if (!BUDGETS.has(request.budget)) throw new Error(`Budget must be one of: ${[...BUDGETS].join(", ")}`);
  if (!PRIORITIES[request.priority]) throw new Error(`Priority must be one of: ${Object.keys(PRIORITIES).join(", ")}`);

  const roleValue = preset.providers?.[request.role];
  if (!roleValue) throw new Error(`Preset has no provider entry for role: ${request.role}`);

  if (typeof roleValue === "string") {
    return { provider: roleValue, modelId: normalizeModelId(roleValue), rationale: "Preset role is pinned to a single provider.", reasoning: resolveReasoning(roleValue, registry, request.difficulty, request.contextTokens, request.priority), permissions: resolvePermissions(roleValue, registry), fallbacks: [], scores: [] };
  }
  if (!Array.isArray(roleValue)) throw new Error(`Provider entry for ${request.role} must be a string or array`);

  const neverSub = neverSubagentSet(registry);
  const loadCtx = buildLoadContext(request, registry);
  const scored = roleValue.map((provider, index) => scoreCandidate(provider, request, registry, neverSub, index, loadCtx));
  const survivors = scored.filter((c) => !c.eliminated).sort((a, b) => b.score - a.score);

  if (!survivors.length) {
    const why = scored.map((c) => `${c.key} (${c.reason})`).join("; ");
    throw new Error(`All candidates eliminated for role ${request.role}: ${why}`);
  }

  return { provider: survivors[0].provider, modelId: survivors[0].modelId, rationale: buildRationale(survivors[0], request), reasoning: resolveReasoning(survivors[0].provider, registry, request.difficulty, request.contextTokens, request.priority), permissions: resolvePermissions(survivors[0].provider, registry), fallbacks: survivors.slice(1).map((s) => s.provider), scores: scored };
}

// Resolve the recommended OpenCode reasoningEffort for the chosen model at this
// difficulty. "auto" means do not set reasoningEffort (leave the model default).
// Clamps to the model's supported levels and steps effort down under context
// pressure (reasoning consumes output headroom that a near-full window lacks).
function resolveReasoning(provider, registry, difficulty, contextTokens = 0, priorityName = "balanced") {
  const key = modelKey(provider);
  const regKey = registryLookupKey(provider, registry);
  const r = registry.reasoning?.[regKey];
  if (!r) return { effort: "auto", apply: "no reasoning profile in registry; leave model default" };
  if (r.effort === "auto") return { effort: "auto", apply: "model self-manages; do not set reasoningEffort" };

  const levels = Array.isArray(r.levels) ? r.levels : null;
  let effort = r.by_difficulty?.[difficulty] ?? r.default;
  const notes = [];

  // Priority bias: speed/cost-efficiency lean reasoning down, quality leans it up.
  const bias = (PRIORITIES[priorityName] || PRIORITIES.balanced).effortBias;
  if (levels && bias) {
    const i = levels.indexOf(effort);
    const j = Math.max(0, Math.min(levels.length - 1, i + bias));
    if (j !== i) { effort = levels[j]; notes.push(`${bias > 0 ? "raised" : "lowered"} for ${priorityName} priority`); }
  }

  // Clamp to the model's supported set (e.g. OpenAI never accepts "max").
  if (levels && !levels.includes(effort)) {
    effort = levels.includes(r.default) ? r.default : levels[levels.length - 1];
    notes.push(`clamped to supported level ${effort}`);
  }
  // Context-pressure downgrade: past 70% of the model's ctx_max, step down one
  // level so reasoning leaves room for output (levels are ordered low->high).
  const ctxMax = registry.attributes?.[regKey]?.ctx_max;
  if (levels && contextTokens > 0 && ctxMax && contextTokens > ctxMax * 0.7) {
    const i = levels.indexOf(effort);
    if (i > 0) { effort = levels[i - 1]; notes.push(`stepped down for context pressure (>${Math.round(ctxMax * 0.7)})`); }
  }

  const apply = (registry.reasoning?._apply || "") + (notes.length ? ` [${notes.join("; ")}]` : "");
  return { effort, apply };
}

// Resolve the permission posture for the chosen provider's backend. Defaults to
// bypass/yolo (registry permissions._default); settings go to create_agent.
function resolvePermissions(provider, registry) {
  let backend = String(provider).split("/")[0];
  if (backend.startsWith("oc-")) backend = "opencode";
  const backendAliases = {
    anthropic: "claude",
    "openai-codex": "codex",
    claude: "claude",
    codex: "codex",
  };
  const permBackend = backendAliases[backend] ?? backend;
  const mode = registry.permissions?._default || "bypass";
  const p = registry.permissions?.[permBackend];
  if (!p) {
    const piBackends = new Set(["deepseek", "kilo", "openrouter", "cursor", "google-antigravity", "llama-swap"]);
    const note = piBackends.has(backend)
      ? "Pi/OMP session: pass provider/model only; no create_agent permission profile"
      : "no permission profile for this backend; pass nothing";
    return { backend, mode, settings: null, note };
  }
  return { backend, mode, settings: p[mode] ?? null, cliBypass: p.cli_bypass || null };
}

function buildRationale(winner, request) {
  const parts = [
    `${winner.key} (grade ${winner.grade}) won for ${request.role}`,
    `fit ${winner.fitScore}`,
    `econ ${winner.econScore}`,
    `effective cost $${winner.effectiveCostPerMTok.toFixed(3)}/M`,
    `quota ${winner.quotaPer5h}/5h`,
  ];
  if (winner.reasons.length) parts.push(winner.reasons.slice(0, 3).join(", "));
  return parts.join("; ");
}

function printHuman(result, request, presetPath, explain) {
  console.log(`role: ${request.role}  difficulty: ${request.difficulty}  priority: ${request.priority}  fanout: ${request.fanout}`);
  console.log(`preset: ${presetPath}`);
  console.log(`pick: ${result.provider}`);
  console.log(`rationale: ${result.rationale}`);
  if (result.reasoning) {
    console.log(`reasoningEffort: ${result.reasoning.effort}`);
    if (explain && result.reasoning.apply) console.log(`  apply: ${result.reasoning.apply}`);
  }
  if (result.permissions) {
    console.log(`permissions: ${result.permissions.backend} ${result.permissions.mode} -> ${JSON.stringify(result.permissions.settings)}`);
    if (explain && result.permissions.cliBypass) console.log(`  cli: ${result.permissions.cliBypass}`);
  }
  if (result.fallbacks && result.fallbacks.length) {
    console.log(`fallbacks: ${result.fallbacks.join(" -> ")}`);
  }
  if (result.scores.length) {
    console.log("candidates:");
    for (const c of result.scores) {
      if (c.eliminated) {
        console.log(`  - ${c.provider} ELIMINATED: ${c.reason}`);
        continue;
      }
      console.log(`  - ${c.provider} score=${c.score.toFixed(2)} grade=${c.grade} fit=${c.fitScore} econ=${c.econScore} cost=${c.effectiveCostPerMTok.toFixed(3)} quota=${c.quotaPer5h} band=${c.band}`);
      if (explain) for (const r of c.reasons) console.log(`      ${r}`);
    }
  }
}

function usage() {
  console.log(`Usage:
  node model-router/router.mjs --role <role> --task <text> [options]

Options:
  --preset <path>          Active preset JSON path. Default: ${DEFAULT_PRESET}
  --model-tiers <path>     Model registry path. Default: ${DEFAULT_MODEL_TIERS}
  --difficulty <value>     simple, standard, or hard. Default: standard
  --budget <value>         cost_sensitive, balanced, or quality (legacy alias for --priority)
  --priority <value>       cost-efficiency, speed, quality, or balanced. Default: balanced
  --context-tokens <n>     Approximate input context size. Default: 0
  --requires <list>        Comma-separated hard modality needs, e.g. vision,computer-use
  --fanout <n>             Parallel agent count for this dispatch. Default: 1
  --resident-local <id>    Local model currently loaded in llama-swap (residency bonus)
  --reserve <id>           Record this pick as in-flight under <id> (real dispatch)
  --release <id>           Mark dispatch <id> complete; no routing performed
  --tokens <n>             Optional token spend recorded with --reserve/--release
  --no-ledger              Ignore the shared load ledger (stateless routing)
  --live-status <url>      Query <url> for running models to auto-populate --resident-local
  --json                   Print JSON
  --explain                Print full per-candidate scoring trace
  --dry-run-samples        Run sample selections
`);
}

// Query GET /api/providers and return the first loaded local model name.
// Uses execFileSync+curl with args as array (no shell, no injection risk).
function resolveLiveStatus(statusUrl) {
  try {
    const raw = execFileSync("curl", ["-s", "--max-time", "3", statusUrl], { timeout: 4000, encoding: "utf8" });
    const data = JSON.parse(raw);
    for (const p of data.providers ?? []) {
      if (!p.ok || !p.models?.length) continue;
      const m = p.models[0];
      return typeof m === "string" ? m : (m.id || m.model || "");
    }
    return "";
  } catch {
    return "";
  }
}

function runOne(args) {
  const registry = readJson(args.modelTiersPath);
  const preset = readJson(args.presetPath);

  let residentLocal = args.residentLocal;
  if (!residentLocal && args.liveStatus) {
    residentLocal = resolveLiveStatus(args.liveStatus);
  }

  const request = {
    role: args.role,
    task: args.task,
    difficulty: args.difficulty,
    contextTokens: args.contextTokens,
    budget: args.budget,
    priority: args.priority || BUDGET_TO_PRIORITY[args.budget] || "balanced",
    fanout: args.fanout,
    requires: args.requires,
    residentLocal,
    noLedger: args.noLedger,
  };
  const result = chooseProvider(request, preset, registry);

  // Record the pick so sibling fan-out calls see it as in-flight. Only with an
  // explicit --reserve id (a real dispatch); previews and samples never write.
  if (args.reserve && !args.noLedger) {
    ledger.reserve({ id: args.reserve, key: modelKey(result.provider), src: sourceOf(result.provider), at: Date.now(), tokens: args.tokens });
  }

  if (args.json) console.log(JSON.stringify({ request, result }, null, 2));
  else printHuman(result, request, args.presetPath, args.explain);
}

function runSamples(args) {
  const samples = [
    { ...args, presetPath: "~/.paseo/presets/workhorse.json", role: "ui", task: "review a screenshot-heavy frontend flow with visual design risks", requires: ["image"], contextTokens: 120000, difficulty: "standard", fanout: 1, explain: true },
    { ...args, presetPath: "~/.paseo/presets/workhorse.json", role: "impl", task: "apply a mechanical OpenSpec implementation across files", contextTokens: 80000, difficulty: "simple", fanout: 3, explain: true },
    { ...args, presetPath: "~/.paseo/presets/workhorse.json", role: "research", task: "browse a 1M-token repo and synthesize findings", contextTokens: 400000, difficulty: "hard", fanout: 1, explain: true },
  ];
  for (const sample of samples) {
    runOne(sample);
    console.log("");
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  if (args.loadSnapshot) return printLoadSnapshot(args);
  // Release-only: mark a prior dispatch complete so it stops counting as in-flight.
  if (args.release) return ledger.release(args.release, { at: Date.now(), tokens: args.tokens });
  if (args.dryRunSamples) return runSamples(args);
  if (!args.role) throw new Error("--role is required unless --dry-run-samples is used");
  runOne(args);
}

try {
  main();
} catch (error) {
  console.error(`router error: ${error.message}`);
  process.exit(1);
}
