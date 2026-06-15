---
name: boo-refactoring-code
description: >
  Executes behavior-preserving refactors (extract, inline, rename, move,
  dedupe, de-layer) in small test-guarded steps, one concern per batch, proving
  each step with passing tests and git diff --stat. Use for "refactor this,"
  "clean up this module," "extract this into its own file," or executing an
  audit backlog item. Do NOT use to find refactor candidates; use
  boo-auditing-code-quality. Do NOT use for behavior changes or new features;
  use boo-planning-changes then boo-implementing-changes. Do NOT use on
  failing code; use boo-investigating-failures first.
metadata:
  version: "1.0"
---

# Refactoring Code

## Size

Classify small/medium/large: small = one function or file (rename, extract, inline), medium = one module's internal structure, large = cross-module moves or boundary changes. Default: small. Announce with one-line justification. Accept `$size` override.

## Process

1. Pin the target: a named refactor goal (from the operator or an audit backlog item) with the files in scope. Restate it as "change structure X to Y; observable behavior unchanged." At medium+, if the `boocontext` MCP tools are available, run `boocontext_impact` (or `codesight_get_blast_radius`) on the in-scope files and fold every transitively affected file into the pinned scope before moving anything.
2. Establish the safety net BEFORE touching code: run the tests covering the affected behavior and record the pass state. If the affected behavior has no tests, write characterization tests first (pin what the code does today, quirks included) and get them green.
3. If tests fail before any change: stop. A red suite is boo-investigating-failures territory, not a refactor starting point.
4. Refactor in the smallest steps the language allows, naming each step by its catalog move (extract function, inline variable, move declaration, replace conditional with polymorphism). Run tests after every step; a red step is reverted, not debugged forward.
5. One concern per batch: a rename batch never also restructures; a dedupe batch never also renames. Adjacent slop discovered mid-refactor goes to the report's Deferred list, not into this diff.
6. Prove the result: full test run plus `git diff --stat`. A public API or exported signature changes only if the operator explicitly scoped it; otherwise revert that step.
7. Produce the report.

## What NOT to do

- No behavior changes, bug fixes, or features mixed into a refactor diff. A bug found mid-refactor is reported, never silently fixed.
- No "while I'm here" expansion beyond the pinned scope.
- No refactoring against a red test suite or with no tests at all.
- Do not scan for candidates; that is boo-auditing-code-quality's job.

## Gotchas

- **Behavior-preserving means observable behavior**: public API, outputs, side effects, and error shapes stay identical unless the operator explicitly scoped a signature change.
- **Characterization tests pin bugs too**: when pinning untested behavior, assert what the code does, not what it should do. Fixing the bug is a separate dispatch.
- **Suite cost**: if the full suite is slow, run the focused subset per step and the full suite once at the end; name which runs were focused.
- **boocontext is optional**: the MCP tools are not on every machine or harness. Probe, use when present, fall back to grep-based dependency tracing when absent. A `boocontext_*` tool returning `UNSAFE` or empty means fall back, not stop.
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
# Refactor: <target>

## Goal
<structure X to Y, behavior unchanged>

## Safety net
<tests run before starting; characterization tests added, if any>

## Steps applied

| # | Catalog move | Files | Tests after |
|---|--------------|-------|-------------|
| 1 | extract function | src/foo.ts | pass (focused, 12 tests) |

## Diff summary
<git diff --stat output>

## Deferred (YAGNI)
<adjacent findings left out of scope, each with a reopen trigger>

## Claims I did not verify
- <anything assumed or not checked>
```

## Failure modes

- **Tests red before starting**: stop, report, route to boo-investigating-failures.
- **No tests and characterization is impractical** (no harness, untestable I/O): report the gap and the smallest harness that would unblock; do not refactor blind.
- **A step cannot be made green**: revert the step, report what broke and why the move is unsafe.
- **Scope grows mid-refactor**: stop at the pinned scope; new work goes to Deferred with a reopen trigger.
