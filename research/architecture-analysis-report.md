# Architecture Analysis Report: BooSkills

**Operator question**: "Are we too complicated now?"
**Date**: 2026-06-16
**Pipeline**: boo-mapping-project-context > boo-analyzing-architecture
**Stages completed**: structural-analyst, behavioral-analyst, risk-analyst, software-architect

---

## Verdict

**Appropriately complex** -- the three-layer routing stack is justified by distinct responsibilities per layer, and one code smell (duplicated classification logic) accounts for the only structural issue. The system has the right number of layers for what it does.

---

## Risk Assessments (R1-R10)

Input: behavioral findings B1-B10 from stage 2 analysis. Each scored Likelihood x Severity = Risk Score /25.

| Rank | ID | Title | Finding | L | S | Score | Tier |
|------|-----|-------|---------|---|---|-------|------|
| 1 | R1 | Prompt composition is the only transformation in the stack | B2 | 5 | 4 | **20** | Critical |
| 2 | R2 | Slot leak from implicit reserve/release lifecycle | B4 | 4 | 4 | **16** | High |
| 3 | R4 | Divergent sourceOf() fallback misclassifies new providers | B10 | 4 | 3 | **12** | Medium |
| 4 | R3 | UI cold-starts Node.js process per HTTP request | B6 | 5 | 2 | **10** | Medium |
| 5 | R5 | Router errors flattened to string before UI return | B9 | 5 | 2 | **10** | Medium |
| 6 | R6 | Requirements sketch handoff unvalidated | B7 | 3 | 3 | **9** | Medium |
| 7 | R7 | compact() race window can discard concurrent appends | B5 | 2 | 2 | **4** | Low |
| 8 | R8 | boo-meta is a pure control-flow forwarder | B1 | 2 | 2 | **4** | Low |
| 9 | R9 | boo-router thin wrapper frequently bypassed at runtime | B3 | 3 | 1 | **3** | Low |
| 10 | R10 | change-id handoff is the only verified artifact boundary | B8 | 2 | 1 | **2** | Low |

### Cross-finding interactions

- **B4 + B5 (slot leak + compact race)**: If a slot leak occurs AND compaction runs during the TTL window, the leaked record is discarded before TTL reclaims it, undercounting usage. Low probability but amplifies individual impact.
- **B2 + B7 (prompt composition + sketch handoff)**: If standing rules drift in the prompt AND the requirements sketch is malformed, the agent receives wrong instructions for a wrong plan with no diagnostic trail. Highest-consequence silent failure chain.
- **B10 + B4 (sourceOf divergence + slot leak)**: New provider misclassified by both router ("other") and UI ("subscription") simultaneously; if slot leaks on that source, load display and routing penalties are doubly wrong.
- **B3 + B6 (thin wrapper + cold-start)**: Both reflect the architectural fact that router.mjs is the real runtime; boo-router is documentation.

---

## Architecture Recommendations (A1-A3)

### A1: Unify sourceOf() into a shared module
- **Addresses**: B10, R4, S2
- **Problem**: `sourceOf()` duplicated in `router.mjs:197` and `page.jsx:7` with divergent fallback. router.mjs returns `"other"` (no priority score), page.jsx returns `"subscription"` (wrong color, wrong priority). Every new provider addition requires a manual two-file sync with no compile-time guard.
- **Recommendation**: Extract `sourceOf()` and `SOURCE_LABEL` into `model-router/shared/source.mjs` (~25 lines). Both router.mjs and page.jsx import it. The canonical fallback is `"other"`.
- **YAGNI gate**: Forced by B10 -- divergence already exists today. Two concrete call sites (router.mjs:220, page.jsx:7+25+166) plus load-ledger.mjs referencing source names.
- **Simpler version rejected**: Inlining the same fallback in both files without extraction -- the next provider addition still requires a two-file sync.
- **Risk if deferred**: Every new provider introduction creates a silent classification mismatch between routing and display.

### A2: Preserve structured error data from router.mjs through the UI
- **Addresses**: B9, R5
- **Problem**: `paseo.js:141-143` flattens router errors to `(error.stderr || error.message || "router failed").toString().trim()`. Router.mjs writes structured JSON to stdout on success but only plain text to stderr on failure. Debugging requires manual `--explain` re-runs.
- **Recommendation**:
  1. `router.mjs` -- emit structured JSON to stderr on error: `JSON.stringify({ error: message, role, code })` before `process.exit(1)`.
  2. `paseo.js` -- attempt `JSON.parse(error.stderr)` with string fallback.
- **YAGNI gate**: Forced by B9 -- the flattening already causes diagnostic friction. ~10 line change, no new abstraction.
- **Risk if deferred**: Debugging routing failures requires manual CLI re-run with `--explain`.

### A3: Extract paseo-boo's hardcoded standing-rules prose into a shared data file
- **Addresses**: R1 (partial), B2, S3
- **Problem**: paseo-boo:45 hardcodes standing rules as prose in the dispatch prompt. This is a third copy alongside STANDING_RULES.md and the stamped skill blocks. Rules changes require a manual edit of paseo-boo's SKILL.md beyond the stamp script.
- **Recommendation**: Add `standing-rules.json` next to STANDING_RULES.md with the core rules array. paseo-boo references it by path instead of hardcoded prose. The stamp script becomes the single sync mechanism for all three surfaces.
- **YAGNI gate**: Defer unless standing rules change again. The rules are 2 lines and have changed once. The stamp script covers the 16-skill surface; paseo-boo's prose is the only unmanaged copy.
- **Risk if deferred**: If rules change, operator must manually edit paseo-boo's SKILL.md line 45. Low likelihood, low severity.

---

## Deferred (YAGNI)

| ID | Topic | Reopen trigger |
|----|-------|---------------|
| R2 | Heartbeat mechanism for slot leaks | Measured slot-leak frequency exceeds 10% of dispatches, or concurrent fan-out routinely exceeds 15 agents |
| R3 | Process pooling / memoization for UI cold-start | UI is deployed as a multi-user service (currently single-user control panel) |
| R6 | Schema validation for requirements-sketch handoff | Planners report >20% of sketches silently falling back to codebase interrogation |
| R7 | Atomic compaction for load-ledger | compact() race window manifests as a measurable quota miscount (currently theoretical) |
| R8 | Collapse boo-meta pipeline into direct invocation | The routing table grows beyond 15 entries or the pipeline logic requires conditions/composition operators |
| R9 | Remove boo-router skill | An agent reports confusion between boo-router SKILL.md and paseo-boo's direct script invocation |

### Deferred to system-architect (cross-service concerns)
None. All findings are intra-codebase and within the model-router bounded context.

---

## Claims I did not verify

- **Did not run evals/ trigger suite** -- the `evals/` directory contains trigger queries for each skill. These were not run. Risk: behavioral findings B1-B10 may miss edge cases in skill dispatch that the triggers would reveal.
- **Did not verify paseo daemon behavior** -- the paseo-boo SKILL.md describes reserve/release lifecycle but the actual paseo daemon's crash-detection timing was not tested. R2's slot-leak assessment assumes the daemon does not auto-release on agent crash.
- **Did not read orchestration-preferences.json** -- actual preset contents, role pools, and provider strings were inferred from router.mjs and the skill files. The actual on-disk preferences file may differ, affecting B3's "frequently pinned" claim.
- **Source line counts are approximate** -- based on `wc -l` in the skill files and grep counts in model-router/.
- **Architecture recommendations assume one maintainer** -- the "appropriately complex" verdict reflects a single-developer project; a team of 5+ may reach a different conclusion about the same structure.
