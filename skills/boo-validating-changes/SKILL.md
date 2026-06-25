---
name: boo-validating-changes
description: >
  Independently validates an OpenSpec change folder in a fresh context, in one
  of two modes: adversarial plan validation before implementation (is this
  plan buildable and honest), or post-implementation validation that the diff
  satisfies specs/ and that every checked task's claim is true. Use for
  "validate this plan," "is this change folder ready to build," "verify the
  implementation matches the spec," "check it was built right." Do NOT use for
  general code-quality review of a diff; use boo-reviewing-code. Do NOT use to
  produce or fix a plan; use boo-planning-changes. Do NOT use to implement;
  use boo-implementing-changes.
metadata:
  version: "1.0"
---

# Validating Changes

Fresh-context validation of OpenSpec change folders. The planner validating its own plan and the implementer checking its own boxes are claims; this skill treats both as wrong until proven.

## Size

Classify small/medium/large from requirement count and task count in the change folder. Default: small (single capability, under ~10 tasks). Announce with one-line justification. Accept `$size` override.

## Mode selection

Read `openspec/changes/<id>/tasks.md` first:
- Any task unchecked: **plan mode**.
- All tasks checked: **implementation mode**.
- Operator may force a mode; a mixed state with no operator instruction means ask once.

## Process

1. Resolve the change-id and read proposal.md, design.md, specs/, tasks.md in full. Run `openspec validate <id>` (probe the CLI surface with `openspec --help` first); record the result.
2. Select mode per the rule above and announce it.

Plan mode (adversarial, before any code exists):

3. Verify every file path design.md cites actually exists and behaves as described; a cited file that does not exist is a Blocking finding.
4. Check internal consistency: proposal scope, specs/ requirements, and tasks.md must describe the same change. Anything in one and missing from the others is a finding.
5. Check task quality: each task sized 5-20 minutes, independently verifiable, with a named verification command. Vague tasks are findings.
6. Dispatch `adversarial-validator` (assume the plan fails; find how) and `junior-developer` (artifact review: hidden assumptions, unanswered questions) against the full folder.
7. Verdict: Ready to implement, or Revise with findings. Stop; never fix the plan.

Implementation mode (after tasks are checked):

3. Treat every checked box as a claim. Re-run each task's named verification command; a verification that cannot run or fails flips that task to unproven.
4. Trace each requirement and scenario in specs/ to implementing code at file:line. Requirements with no implementing code are findings; scenarios with no covering test are findings.
5. Diff audit: `git diff --stat` against the pre-change baseline. Edits outside tasks.md scope are findings; tasks claiming edits the diff does not show are Blocking.
6. Check design.md `## Implementation notes`: divergences recorded there are legitimate; divergence discovered in code but absent from the notes is a Blocking finding (silent redesign).
7. Dispatch `adversarial-validator` against the conformance summary; add `test-engineer` when scenario coverage is the weak point.
8. Verdict: Implemented as specified, Divergent (enumerated), or Incomplete. Stop; never fix the code and never archive.

## What NOT to do

- Do not fix, re-plan, or re-implement anything. Findings only.
- Do not archive the change; the operator archives after a passing verdict.
- Do not accept a checked box, a passing CI badge, or the implementer's report as evidence; re-derive from commands and code.
- Do not grade general code quality; that is boo-reviewing-code's job and the two verdicts are independent.

## Gotchas

- **A checked box is a claim, not evidence**: the entire skill exists because self-reported completion drifts from reality.
- **OpenSpec profile**: the installed CLI version may differ from assumed commands. Run `openspec --help` to verify.
- **Baseline matters in implementation mode**: diff against the ref where implementation started, not HEAD~1; ask the operator if the baseline is ambiguous.
- **Evidence rule**: every finding cites file:line or a command output captured this run. No finding from memory.
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
# Validation: <change-id> (<plan | implementation> mode)

## Verdict
<Ready to implement | Revise> or <Implemented as specified | Divergent | Incomplete>

## openspec validate
<command output summary>

## Traceability

| Requirement / Task | Evidence (file:line or command) | Status |
|--------------------|--------------------------------|--------|

## Findings

**V1: <title>** (Blocking | Advisory)
- **Location:** <file:line or artifact>
- **Evidence:** <what was observed>
- **Impact:** <why it blocks or matters>

## Claims I did not verify
- <verifications that could not run, with reason>
```

## Failure modes

- **Change folder missing**: the id does not exist under openspec/changes/. Report and stop.
- **Mixed task state, no operator mode**: ask once which mode; do not guess.
- **Verification command cannot run**: mark that task unproven, name the blocker, and cap the verdict at Divergent.
- **Empty specs/**: nothing to validate conformance against. Report; plan mode can still check tasks and design, implementation mode stops.
