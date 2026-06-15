# Investigation: BooSkills skill discovery gap (post-build verification)

Date: 2026-06-11. Trigger: operator request to verify everything is working after the v1 build, the OpenCode agent-frontmatter fix, and the archival of the old boo-*/han-*/paseo-boo-* sets.

## Problem statement

The installer publishes the skill catalog as one parent symlink, `~/.agents/skills/booskills -> repo/skills/`. Platforms that auto-scan `~/.agents/skills/` expect `<skill-name>/SKILL.md` exactly one level deep. The 11 skills therefore sit one level too deep and are invisible to auto-discovery on OpenCode, Pi, and (most likely) Codex. The failure is silent: each platform sees one unknown directory with no SKILL.md and skips it. Paseo-routed dispatches are NOT affected because the paseo-boo router passes explicit file paths. Claude Code is NOT affected via this path at all; it consumes the catalog only through the plugin mechanism, which is not yet registered.

What works today: all symlinks resolve (zero broken anywhere); the three agent renderings are consistent (12/12/12), parse, and are installed flat and correctly for Codex and OpenCode; install.sh is idempotent (re-run: 0 created, 25 skipped, 0 failed) and contains no publishing machinery; boocontext and the paseo workflow skills are intact; the archive holds all 152 archived items in five subdirs.

## Evidence summary

- E1 (codebase): scripts/install.sh:65 creates the single parent symlink; skills live at `~/.agents/skills/booskills/<skill-name>/SKILL.md`, two levels deep.
- E2 (web, single-source): OpenCode binary doc string (~line 445725) documents auto-load as `~/.agents/skills/<name>/SKILL.md`, one level. No OpenCode scanner source available locally; recursive symlink-walking cannot be ruled out (see V2).
- E3 (codebase): OpenCode's only other registration channels are explicit `skills.paths` in opencode.json (not configured) and project `.opencode/skills/` (contains only the 5 OpenSpec skills, not the catalog).
- E4 (codebase): Pi mirrors `~/.agents/skills/` entries one-to-one into `~/.pi/agent/skills/<name>` symlinks; a booskills parent entry would carry no root SKILL.md. Pi has not resynced since install; currently no booskills entry exists there.
- E5 (codebase): Paseo desktop manages only its closed PASEO_SKILL_NAMES list (/opt/forks/paseo/packages/desktop/src/integrations/skills/operations.ts:31-42) and ignores foreign dirs; Paseo's own skills install flat.
- E6 (codebase): `~/.codex/skills/` itself uses the flat one-level layout. Codex scan depth of `~/.agents/skills/` is unverified in source (web claim only).
- E7 (codebase): forks/skills/scripts/link-skills.sh:21-35 (prior art) creates one symlink per skill; destination is `~/.claude/skills/` (mechanic relevant, destination different; see V7).
- E8 (codebase): agents are unaffected: 12 TOML symlinks in `~/.codex/agents/`, 12 .md symlinks in `~/.config/opencode/agents/`, all resolving.
- E9 (codebase): skills/paseo-boo/SKILL.md references the booskills/ parent path for routed dispatch; routed dispatch works today (V5).
- E10 (codebase): the Claude Code plugin is structurally valid but unregistered (no booskills in ~/.claude/plugins/installed_plugins.json; han.core@han and others present).
- E11 (codebase): stale legacy files `~/.paseo/boo-orchestration-preferences.json` and `~/.paseo/boo-presets/*.json` (7 files) reference archived boo-* skills; the live orchestration-preferences.json is clean.

## Root cause

The OpenSpec change itself specified the parent-symlink layout; the defect propagated from proposal.md, specs/local-installer/spec.md:15, design.md, and tasks.md 12.1 into install.sh (V1). It survived implementation because task 12.2 verified only that symlinks resolve, not that platforms discover them, and no test exercises cross-platform discovery (no test files exist in the repo).

## Planned fix

F1. Rewrite the skills section of scripts/install.sh: iterate `repo/skills/*/SKILL.md`, create one symlink per skill `~/.agents/skills/<skill-name> -> repo/skills/<skill-name>`. Explicit first-class step: detect and remove the old `~/.agents/skills/booskills` parent symlink (V8). Collision policy: skip-and-report when `~/.agents/skills/<name>` exists and does not point into this repo (verified zero current collisions, V3).
F2. Update skills/paseo-boo/SKILL.md: dispatch path becomes `~/.agents/skills/<skill-name>/SKILL.md`; the Gotcha keeps its (correct) reasoning that routed dispatch does not depend on discovery, with the new path example. Apply F2 in the same change as F1 so there is no window where the routed path is wrong (V/risk 5).
F3 (expanded per V1). Update the normative artifacts, not just design.md: specs/local-installer/spec.md and proposal.md change to the flat per-skill layout; design.md gains an Implementation note recording the deviation and the evidence.
F4 (operator decisions, not auto-applied):
   - Register the Claude Code plugin: `claude plugin marketplace add /home/samkintop/opt/booskills` then `/plugin install booskills@booskills`.
   - Stale `~/.paseo/boo-presets/` + `boo-orchestration-preferences.json`: legacy files referencing archived skills; delete or keep at operator discretion (not touched).
   - Optional: also link skills into `~/.claude/skills/` per-skill (prior-art destination, E7) as a stopgap until the plugin is registered.

## Validation findings (adversarial)

- V1: root-cause attribution confirmed and strengthened: the parent link is mandated in four spec artifacts; F3 expanded accordingly.
- V2: OpenCode one-level claim is documentation-only (single source); if OpenCode walks recursively the defect downgrades from invisibility to naming pollution. Fix unchanged either way.
- V3: zero name collisions between the 11 skill names and the 47 existing `~/.agents/skills/` entries.
- V4: Pi handles symlink-to-symlink chains (kernel-resolved); no Pi cleanup needed; Pi self-heals on next sync.
- V5: paseo-boo routed dispatches work today; blast radius is auto-discovery only. Urgency reduced, defect real.
- V6: Claude Code never read `~/.agents/skills/`; its access gap is purely the unregistered plugin (F4).
- V7: prior-art citation corrected: link-skills.sh proves the per-skill mechanic, not the `~/.agents/skills` destination convention; the destination convention rests on Paseo source + platform docs.
- V8: upgrade path must explicitly remove the old parent symlink; F1 amended.

## Adjustments made

- F3 expanded from "note in design.md" to updating spec.md and proposal.md (triggered by V1).
- F1 amended with explicit parent-symlink removal step (triggered by V8).
- F1+F2 ordering constraint added (triggered by remaining-risk 5).
- Blast-radius language corrected: routed dispatch operational, Claude Code out of scope for this path (triggered by V5, V6).

## Confidence and remaining risks

Validator confidence: medium. Remaining risks: OpenCode scan depth unverified at source level (worst case after fix: none; flat layout satisfies both interpretations); Codex scan depth web-sourced only; Paseo/Pi resync timing is a post-fix manual or scheduled event; no automated test exists for cross-platform discovery (a discovery smoke-test script is a candidate, deferred: reopen if a platform silently drops skills again).

## Final summary

Root cause: the OpenSpec change specified a parent-symlink install layout that violates the one-level discovery convention of every `~/.agents/skills/` consumer. Fix: flat per-skill symlinks plus removal of the parent link, with the spec artifacts corrected to match. Why correct: the flat layout is what Paseo's own installer produces (codebase, operations.ts/paths.ts), what Codex's own skills dir uses, and what the OpenCode doc string specifies; it satisfies both the one-level and recursive interpretations of V2. Validation outcome: root cause confirmed and tightened to the spec artifacts; fix amended with an explicit upgrade step and atomic ordering. Remaining risks: scan-depth claims for OpenCode/Codex are doc-sourced, and resync timing on Pi/Paseo is external to the fix.

## Claims I did not verify

- OpenCode's and Codex's actual scanner implementations (no source available locally; doc strings and layout conventions only).
- Whether Pi's next sync runs automatically or needs a manual trigger.
- Behavior of any platform when both the parent link and per-skill links coexist (the fix removes the window, so this state should never occur).
