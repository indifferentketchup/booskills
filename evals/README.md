# Trigger Evals

Labeled trigger queries per skill, per SKILL_GUIDELINES.md section 3. There is no built-in
runner; this is a manual (or scripted) protocol:

1. For each query in `should_trigger`, ask a fresh session with the full catalog loaded.
   Run 3 times. The skill passes if it triggers in >= 0.5 of runs.
2. For each entry in `near_miss`, the query must route to the `expected` skill (or no skill
   when `expected` is null), never to this one. Near-misses share keywords with this skill
   but belong to a neighbor; they are the valuable negatives.
3. Failures are description bugs: fix the description's triggers or not-clause, not the body.

One file per skill: `<skill-name>.json` with `should_trigger` (strings) and `near_miss`
(objects with `query` and `expected`).
