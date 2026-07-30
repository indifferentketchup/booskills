---
name: boo-removing-dead-code
description: >
  Deletes provably unreachable code in test-guarded batches, proving each
  candidate unreachable across static, dynamic, and entry-point checks before
  removal, and proving the result with passing tests and git diff --stat. Use
  for "delete this dead code," "remove the unused exports," "this file has no
  callers, drop it," or executing dead-code items from a quality audit backlog.
  Do NOT use to find dead code; use boo-auditing-code-quality, which produces
  the candidate list this skill consumes. Do NOT use for behavior-preserving
  restructuring such as extract, inline, rename, move, or dedupe; use
  boo-refactoring-code, whose move catalog contains no deletion.
metadata:
  version: "1.0"
---

# Removing Dead Code

## Size

Classify from the candidate set: small = one symbol or one file, medium = one module's unused surface, large = cross-module removal or a public export. Default: small. Announce with one-line justification. Accept `$size` override.

## Process

1. Pin the candidate set from an external source: a `boo-auditing-code-quality` backlog, `aislop` dead-code diagnostics, or an operator-named target. Restate each candidate as "symbol S in file F, claimed unreachable." The set is frozen here; anything discovered later goes to Deferred, not into this run.
2. Establish the safety net before touching anything: run the project's test command and record the pass state. A red suite stops the run.
3. Prove unreachability per candidate. All three checks must pass, and the scope-level stop condition must not fire:

```
# 1. static + textual: every file type, not just source
grep -rnF "<symbol>" . --exclude-dir=.git

# 2. dynamic: the symbol as a string, key, or property, which import analysis misses
grep -rnE "['\"]<symbol>['\"]|\[\s*['\"]<symbol>['\"]\s*\]|\.<symbol>\b" . --exclude-dir=.git

# 3. entry points: manifests and configs that reference files nothing imports
grep -rnF "<basename>" package.json .claude-plugin/ *.config.* .github/ 2>/dev/null

# stop condition: computed module loading anywhere in scope
grep -rnE "import\(|require\([^'\"]" <scope>
```

   A hit in checks 1 to 3 means the candidate is reachable and is retained. A hit in the stop condition means no symbol in that scope is provable by grep alone: escalate the whole set to step 4 or report it unproven.
4. Dispatch `adversarial-validator` against the proof set with the posture "assume this code is still reachable; find the caller." This runs at every size, including a single symbol. Any candidate it refutes moves to unproven.
5. Delete in batches of one concern. Run the tests after every batch. A batch that turns the suite red is reverted, never debugged forward. A deletion batch never also renames, moves, or fixes.
6. Report, ending with `git diff --stat`.

## What NOT to do

- Do not discover candidates. Arriving with your own list is `boo-auditing-code-quality`'s job, and self-discovered candidates skip the evidence that makes deletion safe.
- Do not delete on static analysis alone. Checks 2 and 3 exist because a string-keyed registry and a manifest entry both reach code that no import statement mentions.
- Do not delete to make a failing test pass. That is a bug, and it belongs to `boo-investigating-failures`.
- Do not bundle behavior changes, renames, or restructuring into a deletion diff.
- Do not delete an exported symbol at a package boundary unless the operator explicitly scoped it. Absence of an in-repo caller says nothing about consumers outside the repo.
- Do not expand past the pinned candidate set, however obvious the adjacent dead code looks.

## Gotchas

- **Entry points are the usual false positive.** In this repo alone, `scripts/install.sh` symlinks files by path, `.claude-plugin/marketplace.json` names plugins, and `package.json`'s `files` array allowlists every shipped script individually. All three reach files that no source file imports.
- **Deleted code is recoverable, deleted history is not.** Deletion is reversible through git, so the risk is not the deletion itself; it is deleting something reachable and discovering it in production. Weight the proof accordingly.
- **A green suite is weak evidence for deletion.** Tests prove the paths they cover. An untested reachable path stays green after you delete it and fails in production. Where coverage is absent, say so rather than treating the green run as proof.
- **`grep -F` for the symbol, not a regex.** Symbol names containing regex metacharacters silently match the wrong things or nothing at all.
- **Evidence rule**: every retained candidate cites the file:line that reached it; every deleted candidate cites the three checks that came back empty.
<!-- standing-rules:pi:start -->
- **Subagent visibility**: when the Paseo MCP tools (`mcp__paseo__*`) are available, spawn each agent persona as an attached Paseo subagent with `create_agent` (`detached: false`, `notifyOnFinish: true`; for an opencode provider also pass `settings.modeId: "build"` and `settings.features.auto_accept: true`) so every persona appears in the operator's Paseo agent track. Resolve each persona's provider/model from the active preset's `agents` map in `~/.paseo/orchestration-preferences.json` (Pi/OMP `provider/model` strings); supervise on the finish notification (never poll) and read each result with `get_agent_activity`.
- **Subagent fallback (Pi/OMP)**: when Paseo MCP is absent, use native subagent dispatch. On Pi, route via `boo-router` then `task()` with the routed `provider/model` string (`pi/<provider>/<model>` for native DeepSeek/Xiaomi/MiniMax; gateway models without a native Pi integration still route via OMP's litellm proxy, `omp/litellm/<route>`). Legacy OMP session roles come from `~/.omp/agent/config.yml` (`modelRoles`), synced by `omp-preset` / `paseo-preset`; Pi has no modelRoles file yet. Pi has no per-task model param: use preset `agents` pins, OMP `modelRoles.task` (OMP sessions only), or session defaults. If the platform has no subagent dispatch at all, read each `agents/<name>.md` persona and apply its lens in sequential passes.
- **Subagent concurrency**: honor the active preset's `concurrency` value in `~/.paseo/orchestration-preferences.json`. When it is `1` (local heavy-weight presets, around 27b/35b or larger on a single llama-swap server), dispatch subagents STRICTLY ONE AT A TIME: launch one, wait for its finish notification and read its result, then launch the next. This overrides any parallel fan-out. Absent or higher `concurrency` means parallel fan-out is fine.
<!-- standing-rules:pi:end -->
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
# Dead Code Removal: <scope>

## Candidate set
<where the list came from; count>

## Safety net
<test command, pass state before starting>

## Deleted

| # | Symbol / file | Static | Dynamic | Entry point | Batch | Tests after |
|---|---------------|--------|---------|-------------|-------|-------------|
| 1 | `oldHelper` in src/util.ts | none | none | none | 1 | pass (48) |

## Unproven, retained

| # | Symbol / file | Failed check | Evidence |
|---|---------------|--------------|----------|
| 1 | `pluginName` in src/reg.ts | dynamic | src/loader.ts:31 string-keyed lookup |

## Batches

| # | Concern | Files | Tests after |
|---|---------|-------|-------------|

## Diff summary
<git diff --stat output>

## Deferred (YAGNI)
<adjacent dead code found but outside the pinned set, each with a reopen trigger>

## Claims I did not verify
- <anything assumed, uncovered by tests, or not checked>
```

## Failure modes

- **Tests red before starting**: stop, report, route to `boo-investigating-failures`. Delete nothing.
- **No covering tests for the affected surface**: report the coverage gap and do not delete on static analysis alone. Name the smallest test that would unblock it.
- **`adversarial-validator` refutes every candidate**: report the reachability evidence and stop. A run that deletes nothing because nothing was dead is a success.
- **A batch turns the suite red**: revert that batch, report what broke and which candidate's proof was wrong. Do not continue past it.
- **Empty candidate set**: nothing pinned. Report and stop; run `boo-auditing-code-quality` first.
- **Stop condition fires**: computed module loading in scope means grep cannot prove unreachability. Report every candidate as unproven unless `adversarial-validator` clears it.
