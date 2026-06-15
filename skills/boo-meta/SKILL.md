---
name: boo-meta
description: >
  Decomposes an operator goal into a pipeline of booskills catalog skills,
  announces the pipeline, then executes the stages in order, fanning
  independent stages out in parallel. Also answers in plan-only mode: map the
  pipeline and stop without executing. Use when a request spans multiple
  skills or the right skill is unclear: "boo-meta <goal>," "take this from
  idea to shipped," "fix and clean this up," "which skills should handle
  this," "boo-meta plan <goal>," "what's the flow for this." Do NOT
  use when one skill obviously matches; invoke it directly. Do NOT use to
  dispatch a single named skill to a Paseo agent; use paseo-boo. Do NOT use to
  find installable third-party skills; use find-skills.
metadata:
  version: "1.2"
---

# Boo-Meta Router

Routes goals to pipelines of catalog skills. This skill contains dispatch logic only: goal decomposition, ordering, checkpoints, and fan-out. All domain knowledge lives in the skills it dispatches.

## Size

Pass-through. Forward any `$size` override verbatim to every dispatched stage. The pipeline announcement reports stage count, not a size class.

## Modes

- **Execute** (default): announce the pipeline, then run it.
- **Plan-only**: when the operator leads with `plan` or asks for the flow/map/steps without execution ("what's the flow for this," "map out the boo plan"), produce the announcement with the handoff notes filled in and STOP. Execute nothing, dispatch nothing, read nothing beyond what routing itself needs. End with the resume line so the operator can run it later, in full or from any stage.

## Routing table

Match the goal to the closest shape; compose when a goal spans shapes.

| Goal shape | Pipeline |
|------------|----------|
| Fuzzy idea ("I want something that...") | boo-refining-ideas (inline) > boo-planning-changes > boo-validating-changes (plan) > CHECKPOINT > boo-implementing-changes > boo-validating-changes (impl) > boo-reviewing-code |
| Clear feature or change | boo-planning-changes > boo-validating-changes (plan) > CHECKPOINT > boo-implementing-changes > boo-validating-changes (impl) > boo-reviewing-code |
| Bug, regression, "this is broken" | boo-investigating-failures > CHECKPOINT > boo-implementing-changes (planned fix) > boo-validating-changes (impl) > boo-reviewing-code |
| Codebase cleanup, "make it good" | boo-auditing-code-quality > CHECKPOINT > boo-refactoring-code per backlog item > boo-reviewing-code |
| New UI surface | boo-building-ui > boo-critiquing-frontend |
| Architecture verdict | boo-mapping-project-context > boo-analyzing-architecture |
| Unknown tech or library decision | prepend boo-researching to whichever pipeline follows |
| Unfamiliar repo, no context map | prepend boo-mapping-project-context |

## Process

1. Restate the goal in one sentence and match it against the routing table. A goal matching exactly one skill is routed directly with a one-line note; never wrap a single-skill task in a pipeline.
2. YAGNI-trim the pipeline: drop any stage whose output the goal does not need. The smallest pipeline that satisfies the goal wins.
3. Announce the pipeline (output format below) before executing anything. In plan-only mode, stop here.
4. Execute stages in order. Per stage, read `skills/<name>/SKILL.md` and execute it; when Paseo is available (probe `~/.paseo/orchestration-preferences.json`) and the operator asked for fan-out, route dispatchable stages through paseo-boo instead.
5. Hand artifacts forward explicitly: requirements sketch to planner, change-id to implementer, backlog items to refactorer, build paths to critic. A stage that needs a missing artifact is a pipeline bug; stop and report.
6. Fan out in parallel only stages with no data dependency (reviews of disjoint branches, refactors of disjoint backlog items, critique alongside audit). Everything else runs sequentially. Honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`: when it is `1` (local heavy-weight presets on a single llama-swap server), run independent stages one at a time too, never in parallel.
7. At each CHECKPOINT, stop and present the stage output to the operator before any stage that writes code. Never auto-continue through a checkpoint.
8. After the final stage, relay each stage's report and verdict in one summary.

## What NOT to do

- Do not do any stage's work yourself; you route, the skills execute.
- Do not invent skills or stages not in the catalog; if no skill fits, say so and stop.
- Do not skip checkpoints, and never chain boo-planning-changes and boo-implementing-changes in one agent context; the implementer starts fresh.
- Do not dispatch boo-refining-ideas anywhere; it interviews the operator and always runs inline.
- Do not re-run a failed stage with tweaks; a failed stage stops the pipeline and gets reported.
- In plan-only mode, do not execute or dispatch anything, and do not start "just the first read-only stage" helpfully; the plan is the deliverable.

## Gotchas

- **Paseo is optional**: without it, run every stage inline and sequentially; the pipeline logic is unchanged.
- **Concurrency cap**: a preset with `concurrency: 1` (local heavy-weight models) forces strictly sequential dispatch; never fan out stages or subagents in parallel under it, even when they are independent.
- **Pipelines are defaults, not law**: the operator can reorder or drop stages at the announcement; their edit is final.
- **Mid-pipeline discoveries reroute**: an investigation that reveals a design flaw hands off to boo-planning-changes, not to a bigger fix; announce the reroute as a new pipeline.
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

Announcement, before execution:

```
# Pipeline: <goal restated in one sentence>

| Stage | Skill | Mode | Waits on | Produces |
|-------|-------|------|----------|----------|
| 1 | boo-auditing-code-quality | inline | - | prioritized backlog |
| 2 | CHECKPOINT (operator) | - | 1 | go / edit / stop |
| 3 | boo-refactoring-code x3 (parallel, disjoint files) | paseo | 2 | refactor reports + diffs |
| 4 | boo-reviewing-code | inline | 3 | merge verdict |

Dropped stages: <stage + why, or "none">

Run it: say "go" (or "go from stage N"), or run any stage yourself with /<skill-name> and the artifact it waits on.
```

Final summary, after execution:

```
# Pipeline result: <goal>

| Stage | Skill | Outcome |
|-------|-------|---------|

<each stage's verdict line, then the full report of the final stage>

## Claims I did not verify
- <anything relayed from a stage on its word>
```

## Failure modes

- **No skill fits the goal**: say which shapes were considered and stop; offer the closest skill or plain execution outside the catalog.
- **Goal too fuzzy to route**: route to boo-refining-ideas inline; its sketch re-enters routing.
- **A stage fails or its artifact is missing**: stop the pipeline, report the stage's own failure output, list completed stages.
- **Operator rejects the pipeline at announcement**: apply their edits and re-announce once; a second rejection means hand routing back to the operator.
