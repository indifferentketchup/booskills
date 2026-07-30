---
name: boo-auditing-code-quality
description: >
  Scans a codebase or module for AI slop, refactor candidates, and optimization
  opportunities, scored against high-quality code standards, producing a
  prioritized remediation backlog. Use for "clean up this codebase," "find the
  slop," "what needs refactoring," periodic health checks, post-vibe-coding
  cleanup. Do NOT use for reviewing a specific diff; use boo-reviewing-code. Do NOT
  use for diagnosing a failure; use boo-investigating-failures. Do NOT use to
  execute refactors; use boo-refactoring-code.
metadata:
  version: "1.1"
---

# Auditing Code Quality

## Size

Classify small/medium/large from tree scope (single module vs whole repo). Default: small (single module). Announce with one-line justification. Accept `$size` override.

## Process

1. Size by tree scope.
2. Run mechanical detectors first, before any agent dispatch. On a JS/TS surface run `aislop scan --json <scope>` and `node scripts/health-score.mjs <scope>`, which rolls aislop's diagnostics into a per-file score and joins them with git churn to rank hotspots. Add stack-specific tools from scripts/ (lint, dead-code, duplication). If the `boocontext` MCP tools are available, run `boocontext_health` (A-F grades, hotspot files, top refactoring targets) and `boocontext_severity` (severity-classified hotspots with git churn  --  INFO/MINOR/MAJOR/CRITICAL across MAINTAINABILITY/RELIABILITY/SECURITY domains) as well. Collect raw output in references/.
3. Agent pass on mechanical hits and sampled hot files, seeded with the hotspot ranking from step 2 so the lenses start where the measured deficit and churn are highest: dispatch `structural-analyst` for refactor candidates, dispatch `behavioral-analyst` for logic quality on high-complexity files.
4. Score each finding: impact (high/med/low) x effort (S/M/L). Order the backlog by the hotspot rank from step 2, not by impression; impact x effort breaks ties within a rank.
5. YAGNI gate optimizations: any optimization without a measured pain point (perf number, incident, recurring friction) goes to Deferred with the metric that would reopen it.
6. Produce the prioritized backlog.

## Detection categories

AI slop categories to detect (concrete grep/heuristic per category):

- Duplicated near-identical helpers across files
- Dead code: unused exports, unreferenced files, unused deps
- Over-abstraction: single-use wrappers, interfaces with one implementation
- Defensive bloat: redundant try/catch that rethrows, null checks on non-nullable paths
- Comment slop: comments restating the line, stale TODOs with no trigger
- Test slop: tests asserting nothing, snapshot-everything, mocks of the thing under test
- Convention drift: patterns inconsistent with dominant codebase convention
- Dependency slop: multiple libs doing the same job, heavyweight dep for one function

## What NOT to do

- Do not fix anything during the audit. Audit output is input to boo-refactoring-code or boo-planning-changes.
- Do not recommend "rewrite it all." Every item must be incremental and dispatchable.
- Never recommend an optimization without evidence of the pain.

## Gotchas

- **Evidence rule**: mechanical tool output is codebase-level evidence. Performance claims need measured numbers.
- **aislop severities are blocking, not advisory**: a diagnostic at `severity: error`, or at `severity: warning` with `fixable: true`, is a blocking finding. `health-score.mjs` precomputes this per file as `blocking: true`; do not re-derive the rule.
- **The measured signal is optional, its absence is not silent**: `aislop` is not installed everywhere and `health-score.mjs` needs it. When it is missing, or when the scope comes back `scoreable: false` (a markdown-heavy directory returns `supportedFiles: 0`), audit on agent judgment and name the missing signal in "Claims I did not verify". Never present an invented score.
- **`aislop scan` exits 1 whenever the tree holds an error-severity finding**, while still printing complete JSON. Read the score from stdout; a non-zero exit is not a failure.
- **boocontext is optional**: the MCP tools are not on every machine or harness. Probe, use when present, fall back to scripts and direct reads when absent. A `boocontext_*` tool returning `UNSAFE` or empty means fall back, not stop. These tools grade code files only; markdown-heavy scopes return no_data. `boocontext_severity` enriches health hotspots with git churn for triage priority (commits + recency = severity).
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json` (Pi/OMP `provider/model` strings); supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback (Pi/OMP)**: when Paseo MCP is absent, use native subagent dispatch. On Pi, route via `boo-router` then `task()` with the routed `provider/model` string (`pi/<provider>/<model>` for native DeepSeek/Xiaomi/MiniMax; gateway models without a native Pi integration still route via OMP's litellm proxy, `omp/litellm/<route>`). Legacy OMP session roles come from `~/.omp/agent/config.yml` (`modelRoles`), synced by `omp-preset` / `paseo-preset`; Pi has no modelRoles file yet. Pi has no per-task model param: use preset `agents` pins, OMP `modelRoles.task` (OMP sessions only), or session defaults. If the platform has no subagent dispatch at all, read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
# Code Quality Audit: <scope>

## Summary
<scope, key findings, overall health>

## Backlog

| # | Category | File:line | Hotspot | Score | Impact | Effort | Finding | Remediation |
|---|----------|-----------|---------|-------|--------|--------|---------|-------------|
| 1 | Dead code | src/foo.ts:42 | 21 | 82 | High | S | ... | ... |

Hotspot and Score come from `health-score.mjs`. Rows sort by Hotspot descending. Blocking findings are marked in the Finding column.

## Mechanical Tool Output
<in references/ subdirectory>

## Deferred (YAGNI)
<optimizations without measured pain, with reopen trigger>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **Empty scope**: no files to audit. Report and stop.
- **Binary-only module**: no source code to examine. Report the limitation.
- **Mechanical tools not available**: run agent-only audit and note the gap.
