---
name: boo-analyzing-architecture
description: >
  Evaluates the architecture of a codebase or subsystem and recommends
  intra-codebase structural changes with evidence. Use for "is this well
  structured," coupling/cohesion questions, layering review, "should I split
  this," module boundary decisions. Do NOT use for producing a neutral context
  map; use boo-mapping-project-context. Do NOT use for reviewing one diff; use
  boo-reviewing-code.
allowed-tools: Read, Glob, Grep, Bash(tree*), Agent, mcp__boocontext
metadata:
  version: "1.1"
---

# Analyzing Architecture

## Size

Classify small/medium/large from the number of modules, coupling complexity, and cross-cutting concerns. Default: small (single module, well-bounded). Announce with one-line justification. Accept `$size` override.

## Prerequisite

A current context map must exist. If one does not, run boo-mapping-project-context first.

## Process

1. Verify prerequisite: a context map exists (from boo-mapping-project-context). If not, stop and request it.
2. If the `boocontext` MCP tools are available, gather hard structural evidence first and pass it to the analysts: `boocontext_callgraph` (callers/callees) and `boocontext_impact` (blast radius) seed `structural-analyst` and `behavioral-analyst`; `boocontext_health` (A-F grades, hotspots) seeds `risk-analyst`. This grounds the lenses in measured coupling instead of impressions. Skip when the tools are absent; the analysts still work from direct reads.
3. Dispatch `structural-analyst`, `behavioral-analyst`, `concurrency-analyst`, and `risk-analyst` in parallel (each seeded with the boocontext evidence from step 2 when present).
4. After all four report, dispatch `software-architect` to synthesize findings into recommendations.
5. YAGNI gate every recommendation. Speculative abstractions, module splits justified by future flexibility, and refactoring paths without a measured forcing function go to Deferred.
6. Cross-service or bounded-context concerns are flagged out-of-scope. They belong to system-architect.
7. Produce the analysis report.

## What NOT to do

- Do not produce recommendations without a current context map. Run boo-mapping-project-context first.
- Do not recommend splits or abstractions without evidence of the pain they solve.
- Do not absorb cross-service concerns into intra-codebase recommendations. Flag them and defer.

## Gotchas

- **Evidence rule**: every recommendation cites a specific finding (S#, B#, C#, R#). No finding, no recommendation.
- **Context map is required**: without it, the analysis has no baseline. Stop and request one.
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json`; supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback**: when the Paseo MCP tools are not available, use the platform's native subagent dispatch. On a platform with no subagent dispatch at all (for example Pi), read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->
- **boocontext is optional**: the MCP tools are not on every machine or harness. Probe, use when present, fall back to direct reads when absent. A `boocontext_*` tool returning `UNSAFE` or empty means seed the analysts from direct reads, not stop.

## Output format

```
# Architecture Analysis: <scope>

## Findings

### Structural (S#)
<findings from structural-analyst>

### Behavioral (B#)
<findings from behavioral-analyst>

### Concurrency (C#)
<findings from concurrency-analyst>

### Risk (R#)
<risk assessments from risk-analyst>

## Synthesized Recommendations

**A1: <title>**
- **Addresses:** S1, B3
- **Principle:** SRP / OCP / DIP / etc.
- **Change:** <what to change, with pseudocode>
- **YAGNI evidence:** <forcing function>
- **Risk if deferred:** <reference R#>

## Deferred (YAGNI)
<recommendations without current evidence, with reopen trigger>

## Out of scope (cross-service)
<concerns deferred to system-architect>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **No context map**: prerequisite not met. Stop and request boo-mapping-project-context.
- **Agent returns no findings**: all analysts report no issues. Report "No architectural issues found" and stop.
- **Scope too large**: the system spans multiple bounded contexts. Flag cross-service concerns and scope analysis to one context.
