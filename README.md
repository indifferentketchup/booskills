# BooSkills

This is my personal catalog of agent skills, plus the model router and Paseo presets that decide which LLM handles each one. It runs locally and feeds Claude Code, Codex, OpenCode, and Paseo from the same source files. There's no hosted service and no public registry: you clone the repo and symlink it into each platform's own skill directory.

## What it does

17 skills cover the work an agent actually gets asked to do: review a diff, investigate a failure, map an unfamiliar codebase, plan a change through OpenSpec, refactor in small steps, build or critique frontend UI, research a technical question. Each skill is one SKILL.md file (1626 lines total across all 17), written to a shared format so any agent that reads one knows what to expect from the rest.

Next to the skills sit 13 agent personas, structural-analyst, risk-analyst, security-analyst, and so on, each rendered three times: a canonical Claude Code file, a Codex TOML, and an OpenCode markdown file. Same persona, same behavior, regardless of which tool dispatches it.

The piece I spent the most time on is the model router. When a skill needs to hand work to a subagent, it doesn't hardcode a model. It calls `boo-router`, which calls `model-router/router.mjs`, which scores every candidate in the active preset's pool against grade, role fit, effective cost, quota, and current load, and returns one provider string. No LLM sits on the routing path, so a pick is reproducible and you can see why it happened with `--explain`.

Full path from a goal to a running agent: `boo-meta` breaks the goal into a pipeline of skills, `paseo-boo` builds the dispatch prompt for the one it's running, `boo-router` asks the router for a provider, `router.mjs` does the scoring. Four layers for "pick a model" sounds like a lot, but each one owns exactly one job and doesn't repeat what the layer below it already did.

## Install

```bash
git clone git@github.com:indifferentketchup/booskills.git ~/opt/booskills
cd ~/opt/booskills
bash scripts/install.sh          # skills, presets, registry, agents, router CLI
bash scripts/stamp-standing-rules.sh  # sync standing rules into all 17 skills
paseo-preset workhorse             # switch active preset (+ sync OMP modelRoles)
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

- 17 skills, 1626 SKILL.md lines total
- 13 agent personas, 3 platform renderings each (39 files)
- 12 Paseo orchestration presets, all array pools, no pinned model strings
- Model router: 547 lines of scoring logic, 146 lines of load ledger, plus a Next.js control UI
- Routing categories: `impl`, `ui`, `audit`, `research`, `planning`
- Grade tiers: S, A, B, C, D (local), F (edge/embedding)

## Model-router UI

```bash
cd model-router/ui
npm install
LLAMA_SWAP_URL=http://<your-llama-swap-host>:8401 PASEO_DIR=~/.paseo npm run dev
```

Control panel at `http://localhost:3000`, with tabs for Playground, Load dashboard, Provider priority editor, and Preset editor.

## Presets

| Preset | Grade | Pool |
|--------|-------|------|
| `grade-S` | S | GLM-5.1, Qwen3.7-Max, GPT-5.5, Opus, Fable, Composer-2.5, Gemini-3.1-Pro |
| `grade-A` | A | Qwen3.7-Plus, Kimi-K2.6, GLM-5, Sonnet, GPT-5.4, Composer-1.5 |
| `grade-B` | B | Haiku, GPT-5.1-Codex-Mini, Laguna-M.1, Owl-Alpha, Step-3.7-Flash |
| `grade-C` | C | MiniMax-M3, MiMo-V2.5/2.5-Pro, DeepSeek-V4-Flash/Pro |
| `grade-D` | D | Qwen3.6-35b-a3b, Qwen3.6-27b (local, $0) |
| `grade-F` | F | llama-swap embed + gateway free-tier |
| `workhorse` | C | MiniMax-M3, MiMo-V2.5/2.5-Pro, DeepSeek-V4-Flash/Pro |
| `workhorse-local` | D | Local qwen duo |
| `local` | D | Nemotron Cascade 30B + Qwen 9B |
| `free` | C | Gateway free-tier (Nemotron Ultra, MiniMax M2.5, Step 3.7 Flash) |
| `subscription-low` | B | GPT-5.1-Codex-Mini + Haiku |
| `subscription-mid` | A | GPT-5.4 + Sonnet |

Every preset is an array pool, never a single pinned model, so the router picks from the pool per dispatch based on the task in front of it instead of a fixed assignment. Provider strings follow Pi/OMP format: the default Grade C providers use `pi/deepseek/`, `pi/xiaomi/`, and `pi/minimax/`; other cloud gateway models use the `litellm/` proxy; local models use llama-swap.

After editing `scripts/generate-presets.py`, regenerate and reinstall:

```bash
bash scripts/seed-presets.sh       # regenerate presets + model-tiers.json, install CLIs
paseo-preset <name>                # activate preset, sync OMP modelRoles, refresh OpenCode agents
omp-preset <name>                  # sync OMP modelRoles only
```
