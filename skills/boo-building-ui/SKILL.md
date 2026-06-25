---
name: boo-building-ui
description: >
  Builds new frontend UI (pages, screens, components, flows) to high-end design
  standards: deliberate color strategy, typography, layout, motion, full
  interaction-state coverage, accessibility, and an AI-slop self-check before
  handoff. Use for "build a landing page," "add a settings screen," "create
  this component," "make the frontend for X." Do NOT use to critique or grade
  existing UI; use boo-critiquing-frontend. Do NOT use for OpenSpec
  change-folder work; use boo-implementing-changes.
metadata:
  version: "1.0"
---

# Building UI

## Size

Classify small/medium/large from surface count: small = one component or section, medium = a full screen or 2-4 related components, large = a multi-screen flow or a new design-system surface. Default: small. Announce with one-line justification. Accept `$size` override.

## Process

1. Read `references/design-guidance.md` for the canonical design rules (color, typography, layout, motion, interaction, absolute bans, AI slop test). Every build decision defers to it.
2. Recon the existing surface: run `ls frontend/src/components/ui/` (or the project's equivalent primitives path) and read the token/theme source (tailwind config, CSS custom properties, theme file). Only import primitives that exist; if the primitives directory is missing, stop and report.
3. Extending an existing surface? Extract its conventions first (spacing scale, type ramp, radius, motion idiom) and match them. New surface with no prior design? Write the one-sentence physical scene (who uses this, where, under what ambient light, in what mood) and pick a color strategy (restrained / committed / full palette / drenched) before writing any markup.
4. Build incrementally: structure and hierarchy first, then spacing and type, then color, then motion last. One component or section per pass.
5. Cover every interactive state: hover, focus-visible, active, disabled, loading, empty, error. A component without designed states is not done.
6. Accessibility pass: keyboard reachability and focus order, contrast >=4.5:1 body / >=3:1 large text, labels on inputs, `prefers-reduced-motion` alternative for every animation.
7. Self-check against the absolute bans and the two-altitude AI slop test in references/design-guidance.md. Anything matching a ban gets rebuilt with different structure, not tweaked in place.
8. Verify rendering when tooling exists (dev server plus browser tool or screenshot). If verification is not possible, say so explicitly in the report.
9. At medium+, dispatch `user-experience-designer` for a post-build audit and fix what it finds before handoff.

## What NOT to do

- Do not critique or grade existing UI; that is boo-critiquing-frontend's job.
- Do not implement OpenSpec change folders here; use boo-implementing-changes.
- Do not invent primitives or import components that do not exist in the project.
- Do not hardcode colors, spacing, or z-index values where tokens or scales exist.
- Do not ship a build that fails the AI slop test on a promise of polishing later.

## Gotchas

- **BooLab primitive rule**: run `ls frontend/src/components/ui/` and only import primitives that exist. If missing, stop and report.
- **States are scope, not polish**: empty, loading, and error states are part of the build, never follow-up work.
- **Slop test runs at two altitudes**: check first-order (theme guessable from category alone) and second-order (aesthetic guessable from category plus anti-references) per references/design-guidance.md.
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
# UI Build: <target>

## What was built
<components/screens with file paths>

## Design decisions
- Scene sentence: <one sentence> (new surfaces only)
- Color strategy: <restrained | committed | full palette | drenched>
- <other load-bearing choices, one line each>

## State coverage

| Component | hover | focus | disabled | loading | empty | error |
|-----------|-------|-------|----------|---------|-------|-------|

## Verification
<how rendering was verified, or why it could not be>

## Slop self-check
<bans checked and result; both slop-test altitudes>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **No frontend toolchain**: the repo has no frontend source or build setup. Report and stop; never scaffold a framework unasked.
- **Primitives directory missing**: report the actual path checked and stop.
- **Design guidance cannot be loaded**: references/design-guidance.md is missing. Report and stop.
- **Rendering cannot be verified**: no dev server or browser tooling available. Deliver the build and flag verification as not done.
