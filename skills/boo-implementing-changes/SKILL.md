---
name: boo-implementing-changes
description: >
  Implements an existing validated OpenSpec change folder task-by-task,
  marking tasks.md as it goes, and verifies against specs/. Use when a change
  folder exists under openspec/changes/ and the operator says implement, apply,
  build it, or continue. Do NOT use without a change folder; use
  boo-planning-changes first. Do NOT use for ad-hoc fixes outside the OpenSpec
  flow.
metadata:
  version: "1.0"
---

# Implementing Changes

## Size

Determined by the change folder's task count; report the count. Accept `$size` override to cap how many tasks run in this dispatch: stop at the cap, report remaining tasks unchecked.

## Hard contract

Input is a change-id. Scope is tasks.md, nothing else.

## Process

1. Read proposal.md, design.md, tasks.md from openspec/changes/<id>/. Refuse if tasks.md has unchecked validation errors or the folder fails `openspec validate`.
2. Start fresh context. This skill is its own dispatch, never chained in the planner's context.
3. Execute tasks in order. Per task: implement, run the exact verification command the task names, check the box in tasks.md, and run `git diff --stat` to prove the edit.
4. Deviation rule: if implementation reveals the design is wrong, STOP at that task. Write the discrepancy into design.md under `## Implementation notes`. Report to the operator. Never silently redesign.
5. On completion: run the full verification suite, report per-task status + `git diff --stat` summary. Do not archive.

## What NOT to do

- No work outside tasks.md scope. No "while I'm here" refactors.
- No committing. No archiving. Operator archives manually.
- No marking a task done without its verification step passing.

## Gotchas

- **Source material may not match the design**: if a cited source file does not exist or behaves differently, stop and report. Do not redesign silently.
- **Evidence rule**: every file edit must be verifiable. Prove edits with `git diff --stat`, not with test passes.
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json` (Pi/OMP `provider/model` strings); supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback (Pi/OMP)**: when Paseo MCP is absent, use native subagent dispatch. On Pi/Oh My Pi, route via `boo-router` then `task()` with the routed `provider/model` string; OMP session roles come from `~/.omp/agent/config.yml` (`modelRoles`), synced by `omp-preset` / `paseo-preset`. Pi has no per-task model param: use preset `agents` pins, OMP `modelRoles.task`, or session defaults. If the platform has no subagent dispatch at all, read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
# Implementation: <change-id>

## Per-task status
- [x] 1.1 <task description> -- verified: <command>
- [x] 1.2 <task description> -- verified: <command>
...

## Diff summary
<git diff --stat output>

## Deviations
<if any were recorded in design.md, list them here>

## Next step
Validate with boo-validating-changes <change-id>; operator archives after a passing verdict: openspec archive <change-id>
```

## Failure modes

- **Change folder missing**: specified id does not exist under openspec/changes/. Report and stop.
- **Validation fails on first check**: the change folder has errors. Report validation output and stop.
- **Design conflict**: implementation reveals the design is wrong or incomplete. Write the discrepancy to design.md `## Implementation notes` and report.
- **Verification command cannot run**: the task's verification cannot be executed. Note which verifications were skipped and why.
