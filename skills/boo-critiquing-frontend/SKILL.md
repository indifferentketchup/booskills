---
name: boo-critiquing-frontend
description: >
  Critiques frontend UI/UX implementation and design quality: visual
  hierarchy, spacing, typography, interaction states, accessibility, component
  structure. Use for "review my UI," "does this look right," screenshot
  critiques, component quality checks. Do NOT use for backend code review; use
  boo-reviewing-code. Do NOT use for building new UI; use boo-building-ui.
metadata:
  version: "1.0"
---

# Critiquing Frontend

## Size

Classify small/medium/large from the number of components, screens, or flows to critique. Default: small (single component or screen). At medium+, dispatch `user-experience-designer`. Accept `$size` override.

## Process

1. Read `references/design-guidance.md` for the canonical design rules (color, typography, layout, motion, interaction, absolute bans, AI slop test).
2. Run `ls frontend/src/components/ui/` and only reference primitives that exist. If the directory does not exist or is empty, stop and report.
3. Apply the design guidance from references/ against each component or screen.
4. If size is medium or larger, dispatch `user-experience-designer` for a full UX audit.
5. Group findings by severity and produce the report.

## What NOT to do

- Do not use this skill for backend code review. Use boo-reviewing-code.
- Do not use this skill to build new UI. It critiques existing interfaces; building is boo-building-ui's job.

## Gotchas

- **BooLab primitive rule**: run `ls frontend/src/components/ui/` and only reference primitives that exist. If missing, stop and report.
- **Anti-cream / serif default-aesthetic**: for dashboards and tools, avoid recommending cream backgrounds or serif type as a default aesthetic. The warm-neutral AI default (cream/sand/beige body bg) is a tell; recommend neutral or brand-aligned palettes instead.
- **Evidence rule**: every critique cites a specific component file:line and names the UX principle violated.
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
# Frontend Critique: <target>

## Severity Summary

| Severity     | Count |
|--------------|-------|
| Broken       | N     |
| Inconsistent | N     |
| Polish       | N     |

## Findings

### Broken

**B1: <title>**
- **Location:** `component/file.tsx:line`
- **Principle violated:** <UX principle, WCAG criterion, or design rule>
- **Issue:** <description>
- **Suggested fix:** <concrete change>

### Inconsistent

**I1: <title>**
- **Location:** `component/file.tsx:line`
- **Issue:** <description>
- **Suggested fix:** <concrete change>

### Polish

**P1: <title>**
- **Location:** `component/file.tsx:line`
- **Issue:** <description>
- **Suggested fix:** <concrete change>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **No frontend code to critique**: the repo has no frontend source. Report and stop.
- **UI primitives directory missing**: run `ls frontend/src/components/ui/` fails. Report the actual path and stop.
- **Design guidance cannot be loaded**: references/design-guidance.md is missing. Report and stop.
