---
name: boo-planning-changes
description: >
  Produces a validated OpenSpec change folder (proposal.md, specs/, design.md,
  tasks.md) under openspec/changes/<id>/ for a feature or modification. Use
  when requirements are clear enough to plan: "plan this feature," "spec out
  X," or when handed a requirements sketch from boo-refining-ideas. Do NOT use for
  fuzzy ideas; use boo-refining-ideas first. Do NOT use for executing an existing
  plan; use boo-implementing-changes.
metadata:
  version: "1.0"
---

# Planning Changes

## Size

Classify small/medium/large from complexity, number of files touched, and cross-cutting concerns. Default: small (single-file change, no cross-cutting concerns). Accept `$size` override.

## Hard contract

The skill's only output is the OpenSpec change folder. It never writes application code.

## Process

1. Precondition: run `ls openspec/` to verify an openspec/ directory exists. If not, stop and report (operator runs `openspec init` manually; this skill never initializes).
2. Consume the requirements sketch or interrogate the request against the codebase. Recon: read the files the change will touch.
3. Generate the change folder per OpenSpec artifact structure:
   - `proposal.md` (why + what changes)
   - `specs/` (requirements + scenarios)
   - `design.md` (technical approach citing actual file paths and existing patterns)
   - `tasks.md` (checklist; every task sized 5-20 min, each independently verifiable)
4. YAGNI gate every requirement and task. Items without evidence go to `## Deferred (YAGNI)` with reopen triggers.
5. Validate: run `openspec validate <id>` (verify the exact command against the installed CLI version); fix until pass.
6. Dispatch `adversarial-validator` + `junior-developer` against the plan. Fold V# findings into the design.
7. Present the folder path, task count, and size classification. Stop.

## What NOT to do

- Do not write application code. The only output is the change folder.
- Do not initialize openspec/ yourself. That is the operator's manual step.
- Do not skip the validation step. An unvalidated plan is not complete.

## Gotchas

- **OpenSpec profile**: the installed CLI version may differ from assumed commands. Run `openspec --help` to verify.
- **`tasks.md` is the contract**: vague tasks ("improve error handling") are validation failures.
- **Evidence rule**: every requirement and task cites evidence. No evidence = defer with reopen trigger.
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json`; supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback**: when the Paseo MCP tools are not available, use the platform's native subagent dispatch. On a platform with no subagent dispatch at all (for example Pi), read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
# Plan: <change-id>

## Folder
openspec/changes/<id>/

## Task count
<N>

## Size
<small/medium/large> -- <one-line justification>

## Validation
openspec validate <id>: passed
Adversarial validator: <N V# findings folded in>
Junior developer: <N JD# findings folded in>

## Next step
Validate independently with boo-validating-changes <id>, then implement with boo-implementing-changes <id>
```

## Failure modes

- **openspec/ missing**: report and stop. Operator runs `openspec init` manually.
- **Validation fails**: list errors, fix, re-run until pass.
- **Empty requirements**: no description of what to build. Ask for a requirements sketch or run boo-refining-ideas first.
