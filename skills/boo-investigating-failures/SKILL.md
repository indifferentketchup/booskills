---
name: boo-investigating-failures
description: >
  Diagnoses a runtime failure, bug, regression, or unexpected behavior and
  produces a root-cause finding with a proposed fix, validated adversarially.
  Use when something is broken, erroring, flaky, or behaving wrong, including
  "why is this failing," "this worked yesterday," stack traces, and log
  excerpts. Do NOT use for reviewing proposed changes; use boo-reviewing-code. Do
  NOT use for general codebase questions; use boo-mapping-project-context.
metadata:
  version: "1.0"
---

# Investigating Failures

## Size

Classify small/medium/large from number of symptoms, subsystems involved, and whether the failure spans integration boundaries. Default: small (single symptom, single layer). Announce with one-line justification. Accept `$size` override.

## Process

1. Reproduce or characterize the failure first. Record the exact command, observed vs expected output, and any logs or stack traces.
2. If the `boocontext` MCP tools are available, run `boocontext_explore` with the failure description to locate relevant code citations cheaply (routes, schemas, components, libs, middleware, events, hot files). Then run `boocontext_callgraph` on the failing function/symbol to get callers and callees. Pass these citations to the investigators. Skip when the tools are absent; the investigators work from direct reads.
3. Dispatch `evidence-based-investigator` to gather concrete evidence (E# items with file:line).
4. If the symptom suggests concurrency issues (races, deadlocks, async errors), dispatch `concurrency-analyst`.
5. If the symptom suggests logic divergence or data flow issues, dispatch `behavioral-analyst`.
6. Based on the evidence, form a root-cause statement and propose a fix as a described change (never applied).
7. Dispatch `adversarial-validator` against the evidence summary and proposed fix. Produce V# validation findings.
8. Produce the final report. Do not apply the fix.

## What NOT to do

- Do not apply the fix yourself. The fix goes to boo-implementing-changes or a direct dispatch.
- Do not conclude root cause from a single web source. Web claims need corroboration.
- A passing test is not evidence the bug is absent. Tests prove only the paths they cover.

## Gotchas

- **Evidence rule**: codebase citations (file:line) stand alone. Web claims need corroboration or a single-source flag. No evidence means defer with reopen trigger.
- **Sizing**: default is small. Escalate only on concrete signals - symptom count, subsystem span, integration involvement.
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json` (Pi/OMP `provider/model` strings); supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback (Pi/OMP)**: when Paseo MCP is absent, use native subagent dispatch. On Pi/Oh My Pi, route via `boo-router` then `task()` with the routed `provider/model` string; OMP session roles come from `~/.omp/agent/config.yml` (`modelRoles`), synced by `omp-preset` / `paseo-preset`. Pi has no per-task model param: use preset `agents` pins, OMP `modelRoles.task`, or session defaults. If the platform has no subagent dispatch at all, read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->
- **Recon before write**: gather evidence before forming conclusions.
- **boocontext is optional**: the MCP tools are not on every machine or harness. Probe, use when present, fall back to direct reads when absent. A `boocontext_*` tool returning `UNSAFE` or empty means fall back, not stop.

## Output format

```
# Investigation: <failure description>

## Reproduction
<exact command, observed vs expected>

## Evidence

**E1: <title>**
- **Source:** `file:line`
- **Finding:** <verbatim snippet>
- **Relevance:** <connection to issue>

## Root Cause
<statement>

## Proposed Fix
<described change, not applied>

## Validation Findings

**V1: <title>**
- **Strategy:** Challenge the Evidence | Challenge the Fix | Challenge the Assumptions
- **Result:** Confirmed | Refuted | Partially Refuted
- **Impact:** <what needs to change>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **Irreproducible failure**: symptoms cannot be reliably triggered. Report what is known, note the limitation, and stop.
- **Ambiguous symptoms**: multiple possible root causes, no evidence to disambiguate. List all hypotheses with evidence for each.
- **No codebase access**: cannot read the code. Report and stop.
