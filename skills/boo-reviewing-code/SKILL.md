---
name: boo-reviewing-code
description: >
  Reviews a diff, branch, or PR before merge and produces classified findings
  with file:line citations. Use when changes exist and need a verdict before
  merging, including "look this over," "is this safe to ship," "check my
  branch." Do NOT use for whole-codebase health scans with no diff in scope;
  use boo-auditing-code-quality. Do NOT use for diagnosing runtime failures; use
  boo-investigating-failures. Do NOT use to validate an OpenSpec change folder
  against its specs; use boo-validating-changes.
metadata:
  version: "1.0"
---

# Reviewing Code

## Size

Classify small/medium/large from files touched, subsystems/surfaces affected, and whether security, data, or infrastructure paths are involved. Default: small (single-file change, no cross-cutting concerns). Announce chosen size with one-line justification. Accept `$size` override.

## Process

1. Size the review. If no size override provided, classify from the diff scope.
2. Always dispatch `junior-developer` and `adversarial-security-analyst`.
3. Add conditional agents based on what changed files touch:
   - Tests or test infrastructure changed: dispatch `test-engineer`.
   - Edge-case surface (validation, parsing, user input): dispatch `edge-case-explorer`.
   - Module boundaries or file organization changed: dispatch `structural-analyst`.
   - Data flow, error handling, or state logic changed: dispatch `behavioral-analyst`.
   - Async, threading, or concurrent access changed: dispatch `concurrency-analyst`.
4. Collect all findings. Classify each as:
   - **Blocking** -- must be resolved before merge. Correctness, security, data loss.
   - **Advisory** -- should be addressed but does not block merge. Apply YAGNI gate: if the advisory recommendation lacks evidence of a real problem (a past incident, a performance metric, a bug report), defer it with a reopen trigger.
   - **Nit** -- style preference or minor improvement. No gate needed.
5. Produce the review report with verdict. Stop. Do not modify any files.

## What NOT to do

- Do not fix code during the review. Findings only, no edits.
- Do not report findings on unchanged code. That is the audit skill's job (boo-auditing-code-quality).
- Do not flag style preferences on lines the diff did not touch.

## Gotchas

- **Evidence rule**: codebase citations (file:line) stand alone. Web claims need corroboration or a single-source flag. No evidence means defer with a reopen trigger.
- **Sizing**: default is small. Only escalate on concrete signals -- file count, subsystem span, security/data/infra surface.
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
# Review: <branch/PR/diff identifier>

## Scope
<Files and ref range reviewed>

## Size
<small/medium/large> -- <one-line justification>

## Summary
<1-3 sentence verdict>

| Classification | Count |
|----------------|-------|
| Blocking       | N     |
| Advisory       | N     |
| Nit            | N     |

## Findings

### Blocking

**B1: <title>**
- **Location:** `file:line`
- **Evidence:** <exact code snippet>
- **Standard violated:** <pattern or principle reference>
- **Risk:** <why this must be resolved before merge>

### Advisory

**A1: <title>**
- **Location:** `file:line`
- **Finding:** <description>
- **YAGNI gate:** <evidence of real problem, or defer trigger>

### Nits

**N1: <title>** -- <one-line note>

## Verdict

**Approve** | **Approve with changes** | **Block**

<Blocking findings enumerated if blocked>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **Empty diff**: no changes to review. Report and stop.
- **Unresolvable merge conflict**: cannot determine diff baseline. Report and stop.
- **Missing repo**: no git repository found. Report and stop.
- **Ambiguous scope**: diff cannot be isolated to a meaningful change set. Request operator clarification.
