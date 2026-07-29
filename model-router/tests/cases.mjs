// Golden-snapshot matrix for model-router/router.mjs. Every case is deterministic:
// --no-ledger, frozen fixtures under model-router/tests/fixtures/. See tasks.md
// groups 1.6a-1.6d and design.md "Harness shape: two layers" for the rationale.

const REGISTRY = "model-router/tests/fixtures/registry.json";
const CLOUD = "model-router/tests/fixtures/preset-cloud.json";
const LOCAL = "model-router/tests/fixtures/preset-local.json";
const PINNED = "model-router/tests/fixtures/preset-pinned.json";
const SOURCES = "model-router/tests/fixtures/preset-sources.json";
const STEPDOWN = "model-router/tests/fixtures/preset-reasoning-stepdown.json";
const CLAMP = "model-router/tests/fixtures/preset-reasoning-clamp.json";

const base = (preset, extra = []) => [
  "--preset", preset,
  "--model-tiers", REGISTRY,
  "--no-ledger",
  "--json",
  ...extra,
];

// --- 1.6a: core lookup cases (role, difficulty, priority, --budget alias) ---
const roleCases = ["impl", "ui", "audit", "research", "planning"].map((role) => ({
  id: `role-${role}`,
  args: ["--role", role, "--task", `t-${role}`, ...base(CLOUD)],
}));

const difficultyCases = ["simple", "standard", "hard"].map((difficulty) => ({
  id: `difficulty-${difficulty}`,
  args: ["--role", "impl", "--task", "t-diff", "--difficulty", difficulty, ...base(CLOUD)],
}));

const priorityCases = ["balanced", "cost-efficiency", "speed", "quality"].map((priority) => ({
  id: `priority-${priority}`,
  args: ["--role", "impl", "--task", "t-prio", "--priority", priority, ...base(CLOUD)],
}));

const budgetCases = ["cost_sensitive", "balanced", "quality"].map((budget) => ({
  id: `budget-${budget}`,
  args: ["--role", "impl", "--task", "t-budget", "--budget", budget, ...base(CLOUD)],
}));

const budgetAndPriorityCase = {
  id: "budget-and-priority-both-set",
  args: ["--role", "impl", "--task", "t-both", "--budget", "quality", "--priority", "cost-efficiency", ...base(CLOUD)],
};

// --- 1.6b: elimination / filter cases ---
const eliminationCases = [
  {
    id: "over-256k-band",
    args: ["--role", "impl", "--task", "t-256k", "--context-tokens", "400000", ...base(CLOUD)],
  },
  {
    id: "context-sweet-spot-penalty",
    args: ["--role", "impl", "--task", "t-sweet", "--context-tokens", "130000", ...base(CLOUD)],
  },
  {
    id: "context-ceiling-elimination",
    args: ["--role", "impl", "--task", "t-ceiling", "--context-tokens", "150000", ...base(CLOUD)],
  },
  {
    id: "modality-elimination",
    args: ["--role", "impl", "--task", "t-modality", "--requires", "image", ...base(CLOUD)],
  },
  {
    id: "neversubagent-guardrail",
    args: ["--role", "impl", "--task", "t-guardrail", ...base(CLOUD)],
  },
];

// --- 1.6c: locality, residency, pinned ---
const localityCases = [
  {
    id: "local-fanout-penalty",
    args: ["--role", "impl", "--task", "t-fanout", "--fanout", "3", ...base(LOCAL)],
  },
  {
    id: "local-resident-bonus",
    args: ["--role", "impl", "--task", "t-resident", "--resident-local", "qwen3.6-27b", ...base(LOCAL)],
  },
  {
    id: "pinned-role",
    args: ["--role", "impl", "--task", "t-pinned", ...base(PINNED)],
  },
];

// --- 1.6d: sources classification (all 14 branches) + reasoning step-down/clamp ---
const sourceBranches = [
  "litellm", "deepseek", "xiaomi", "minimax-code", "digitalocean", "kilo",
  "openrouter", "reasonix", "local", "local-edge", "opencode-go",
  "subscription", "gateway-free", "other",
];
const sourcesCases = sourceBranches.map((branch) => ({
  id: `sources-${branch}`,
  args: ["--role", "impl", "--task", `t-src-${branch}`, ...base(SOURCES)],
}));

const reasoningCases = [
  {
    id: "reasoning-step-down",
    args: ["--role", "impl", "--task", "t-stepdown", "--context-tokens", "800000", ...base(STEPDOWN)],
  },
  {
    id: "reasoning-clamp",
    args: ["--role", "impl", "--task", "t-clamp", "--difficulty", "hard", ...base(CLAMP)],
  },
];

export const CASES = [
  ...roleCases,
  ...difficultyCases,
  ...priorityCases,
  ...budgetCases,
  budgetAndPriorityCase,
  ...eliminationCases,
  ...localityCases,
  ...sourcesCases,
  ...reasoningCases,
];
