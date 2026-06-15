---
name: boo-refining-ideas
description: >
  Interviews the operator to turn a rough idea into a buildable requirements
  sketch through targeted questions, for backend and frontend work alike. Use
  when an idea is fuzzy: "I want something that...", "thinking about adding...",
  "not sure how to approach...". Do NOT use when requirements are already
  clear; go straight to boo-planning-changes. Produces input for boo-planning-changes,
  never a proposal or code.
metadata:
  version: "1.0"
---

# Refining Ideas

## Size

Always small. One idea fits one session. Accept `$size` override.

## Process

1. Read the idea. Infer everything answerable from project context. Do NOT ask what the codebase already answers.
2. Ask in rounds of MAX 3 questions, highest-leverage first. Question categories: actor/trigger, success criterion, data touched, integration points, explicit non-goals, backend/frontend split.
3. After each round, restate the sharpened idea and ask "Proceed or another round?"
4. Stop when the sketch passes the test: "Could boo-planning-changes run on this without asking the operator anything?"
5. Output the requirements sketch. Do not write a proposal or code.

## What NOT to do

- Never propose a design. The output is a requirements sketch, not a solution.
- Never exceed 3 questions per round.
- Never ask anything answerable by reading the repo.
- Never pad with filler ("great idea!").

## Gotchas

- **Evidence rule**: when the operator makes a claim about the system, verify it against the codebase before accepting it.
- **Inference boundaries**: if the repo does not answer the question, ask. Do not fabricate an answer.
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
# Requirements Sketch

## Problem Statement
<2-3 sentences>

## Actors
<list>

## Success Criteria
<testable statements>

## In Scope
<list>

## Out of Scope (explicit)
<list>

## Open Questions
<questions the operator declined to answer>

## Surface Split
<backend vs frontend boundaries>
```

## Failure modes

- **Already clear requirements**: the idea is specific enough for boo-planning-changes. Hand off directly.
- **No project context**: the repo is empty or inaccessible. Ask the operator for context directly.
- **Operator cannot answer questions**: sketch what is known and flag the gaps.
