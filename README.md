# BooSkills

Agent skill catalog, deterministic model router, and Paseo orchestration presets  --  personal, local-only.

## What it is

16 specialized skills for AI coding agents, 12 agent personas rendered for 3 platforms, and a deterministic model-router that scores providers by grade, role fit, cost, quota, and live load to pick the best model per dispatch.

**Routing stack:** `boo-meta` (goal decomposition) → `paseo-boo` (dispatch prompt) → `boo-router` → `model-router/router.mjs` (deterministic scoring with load-aware spread).

**Architecture verdict:** appropriately complex (3-layer stack, each layer has a distinct responsibility).

## Install

```bash
git clone git@github.com:indifferentketchup/booskills.git ~/opt/booskills
cd ~/opt/booskills
bash scripts/install.sh          # symlink skills + agents into ~/.agents/
bash scripts/apply-agent-models.sh  # inject per-persona model assignments from Paseo active preset
bash scripts/stamp-standing-rules.sh  # sync standing rules into all 16 skills
```

On Windows: `pwsh scripts/install.ps1` (copy mode; re-run after every pull).

## Docs

| File | Purpose |
|------|---------|
| [SKILL_GUIDELINES.md](SKILL_GUIDELINES.md) | Format and convention canon for all skills |
| [SKILL_CATALOG_SPEC.md](SKILL_CATALOG_SPEC.md) | Build spec: what each skill contains |
| [STANDING_RULES.md](STANDING_RULES.md) | Canonical rules stamped into every skill's Gotchas |
| [CONTEXT.md](CONTEXT.md) | Full project context map (structure, dependencies, conventions) |
| [DISTRIBUTION.md](DISTRIBUTION.md) | How to ship to other machines (private git remote) |
| [research/architecture-analysis-report.md](research/architecture-analysis-report.md) | Architecture complexity verdict and risk assessments |

## Key numbers

- 16 skills (1489 SKILL.md lines total)
- 12 agent personas × 3 platform renderings (36 files)
- 12 Paseo orchestration presets (all array pools, zero pinned strings)
- Deterministic model-router: 547 lines scoring logic, 146 lines load ledger, Next.js control UI
- Routing categories: `impl`, `ui`, `audit`, `research`, `planning`
- Grade tiers: S, A, B, C, D (local), F (edge/embedding)

## Model-router UI

```bash
cd model-router/ui
npm install
LLAMA_SWAP_URL=http://100.101.41.16:8401 PASEO_DIR=~/.paseo npm run dev
```

Control panel at `http://localhost:3000` with Playground, Load dashboard, Provider priority editor, and Preset editor tabs.

## Presets

| Preset | Grade | Pool |
|--------|-------|------|
| `grade-S` | S | Mimo-V2.5-Pro, GLM-5.1, Qwen3.7-Max, GPT-5.5, Opus, Fable |
| `grade-A` | A | DeepSeek-V4-Pro, Qwen3.7-Plus, Kimi-K2.6, GLM-5, Sonnet, GPT-5.4 |
| `grade-B` | B | MiniMax-M2.7, Mimo-V2.5-Pro, Haiku, GPT-5.1-Mini |
| `grade-C` | C | MiMo-V2.5, DeepSeek-V4-Flash (legacy duo) |
| `grade-D` | D | Qwen3.6-35b-a3b, Qwen3.6-27b (local, $0) |
| `grade-F` | F | Edge/embedding models ($0) |
| `workhorse` | C+A | MiMo-V2.5, DeepSeek-V4-Flash, MiniMax-M3 |
| `workhorse-local` | D | Local qwen duo |
| `local` | D | Nemotron Cascade 30B + Qwen 9B |
| `free` | C | OpenCode Zen free-tier models |
| `subscription-low` | B | GPT-5.1-Mini + Haiku |
| `subscription-mid` | A | GPT-5.4 + Sonnet |

All presets use array pools  --  the orchestrator picks by situation via the model-router.
