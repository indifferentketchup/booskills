# Standing Rules

Canonical source for the standing-rules blocks stamped into every skill's Gotchas section.

Skills dispatch standalone to fresh contexts (Paseo, Pi, Codex, OpenCode) where no repo-level
rules file is loaded, so always-true rules must travel inside each SKILL.md. This file keeps
that deliberate duplication from drifting: edit the blocks here, then run
`bash scripts/stamp-standing-rules.sh` to sync every skill. Never hand-edit a stamped block.

A skill opts in to a block by containing its start/end marker comments. The `core` block
belongs in every skill. The `pi` block (subagent dispatch and visibility) belongs in skills
that dispatch agent personas.

## Core (every skill)

<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Subagent dispatch and visibility (skills that dispatch agent personas)

<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json` (Pi/OMP `provider/model` strings); supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback (Pi/OMP)**: when Paseo MCP is absent, use native subagent dispatch. On Pi/Oh My Pi, route via `boo-router` then `task()` with the routed `provider/model` string; OMP session roles come from `~/.omp/agent/config.yml` (`modelRoles`), synced by `omp-preset` / `paseo-preset`. Pi has no per-task model param: use preset `agents` pins, OMP `modelRoles.task`, or session defaults. If the platform has no subagent dispatch at all, read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
