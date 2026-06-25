---
name: boo-mapping-project-context
description: >
  Produces or refreshes a complete context map of a project: structure, entry
  points, services, data flow, conventions, dependencies, deploy surface. Use
  for onboarding into an unfamiliar repo, refreshing stale context docs, "what
  is this project," "map out the codebase," and pre-work recon before planning.
  Do NOT use for evaluating architecture quality; use boo-analyzing-architecture.
  Do NOT use for finding specific bugs; use boo-investigating-failures.
allowed-tools: Read, Glob, Grep, Bash(tree*), Agent, mcp__boocontext
metadata:
  version: "1.1"
---

# Mapping Project Context

## Size

Classify small/medium/large from repo size, number of subsystems, and deployment complexity. Default: small (single-service, single deploy surface). Accept `$size` override.

## Process

1. If the `boocontext` MCP tools are available (check for `boocontext_overview`), lead with them: `boocontext_overview` for routes/schema/components/dependency graph, then `boocontext_map` for the context map. They produce the structural backbone faster than hand enumeration. Treat their output as codebase-trust evidence (it reads the code), and still verify the verdict envelope (`SAFE`/`CAUTION`/`UNSAFE`) before trusting a result. If the tools are absent, enumerate from disk instead (steps 2-3).
2. Enumerate from disk to fill gaps boocontext does not cover (deploy surface, CI, env/config files, compose): run `tree`, read package manifests, compose files, configs, and CI files. Trace entry points and service boundaries from code, not from documentation.
3. Read existing context docs (README, CONTEXT.md, wiki) LAST. Diff them against observed reality and flag drift.
4. Small = single-pass (produce the context map directly). Medium/large = dispatch `structural-analyst` for module graph analysis (seed it with the boocontext dependency graph when available).
5. Output the context map with a "Doc drift" section.

## What NOT to do

- Do not produce recommendations. This skill describes; it does not judge.
- Roadmap/changelog files are never valid sole evidence. Every claim cites a file read or executed command.
- Do not read docs before examining the code itself.

## Gotchas

- **Evidence rule**: codebase citations (file:line) stand alone. Roadmap/changelog files are never sole evidence.
- **Sizing**: default is small. Only escalate on concrete signals - repo size, subsystem count.
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json` (Pi/OMP `provider/model` strings); supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback (Pi/OMP)**: when Paseo MCP is absent, use native subagent dispatch. On Pi/Oh My Pi, route via `boo-router` then `task()` with the routed `provider/model` string; OMP session roles come from `~/.omp/agent/config.yml` (`modelRoles`), synced by `omp-preset` / `paseo-preset`. Pi has no per-task model param: use preset `agents` pins, OMP `modelRoles.task`, or session defaults. If the platform has no subagent dispatch at all, read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->
- **Doc drift is a finding**: if code contradicts docs, code wins on what the system does today.
- **Counts must be fresh**: any file or directory count in the report (N skills, N agents, N configs) must come from a command run immediately before writing that line. Counts remembered from earlier in the session produce false drift findings (observed 2026-06-11: a stale glob reported a missing file that existed).
- **boocontext is optional, not required**: the MCP tools are not registered on every machine or harness. Probe for them; never fail or block when absent, just enumerate from disk. When present, they are an accelerator, not the source of truth: a tool returning `UNSAFE` or empty means fall back, not stop.

## Output format

```
# Context Map: <project name>

## Structure
<directory tree or module list>

## Services / Ports
<service name, port, entry point>

## Data Stores
<databases, caches, file stores>

## External Dependencies
<list of external services and their contracts>

## Conventions Observed
<naming, patterns, testing approach, error handling>

## Build / Deploy Commands
<verified by execution where safe>

## Doc Drift
<list of contradictions between docs/reality>
```

## Failure modes

- **No repo access**: cannot read the code. Report and stop.
- **Empty repo**: no files to analyze. Report and stop.
- **Binary-only repo**: no source code to examine. Report the limitation.
