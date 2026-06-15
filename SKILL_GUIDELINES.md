# Skill Creation Guidelines

Canon for building skills in Paseo. Grounded in the agentskills.io spec, Han's mechanics (skill/agent split, sizing, YAGNI, evidence), and local conventions. One canonical set, vendor-neutral; Paseo translates per backend (Claude, Pi, ChatGPT, OpenCode) at dispatch.

---

## 0. Gate: should this skill exist?

Answer all four before writing anything. Any "no" kills the skill.

1. **Capability test.** Does the agent get this wrong without the skill? Run the task bare first. If output is fine, no skill.
2. **Distinctness test.** Would the model reliably pick this skill over its nearest neighbor? If two descriptions could match the same prompt, merge them (one skill with modes, not two skills).
3. **YAGNI evidence test.** Is there evidence you need it now: a task you actually ran this month, a correction you made twice, a recurring failure? "Might be useful" is not evidence. Defer with a reopen-when trigger instead.
4. **Recurrence test.** Will you run this 3+ more times? One-offs are dispatches, not skills.

## 1. Taxonomy: skill vs agent vs orchestrator

- **Skill = flowchart.** Deterministic process, same shape of output every run. `/code-review`, `/investigate`, `/gap-analysis`. If you can draw it as a flowchart, it is a skill.
- **Agent = judgment.** A persona with a narrow domain and an explicit posture, dispatched by a skill at the steps needing reasoning. `adversarial-security-analyst`, `evidence-based-investigator`.
- **Orchestrator (paseo-boo-*) = router.** Picks the skill, sets size, fans out agents, collects findings. Orchestrators contain no domain knowledge; they contain dispatch logic only.

Rule: skills dispatch agents; orchestrators dispatch skills. Never embed an agent's full persona inside a skill body. Reference it.

## 2. Spec compliance (non-negotiable)

Directory:
```
skill-name/
├── SKILL.md          # required
├── scripts/          # optional, executable helpers
├── references/       # optional, load-on-demand docs
└── assets/           # optional, templates
```

Frontmatter:
```yaml
---
name: reviewing-code          # lowercase, hyphens, matches dir name, no leading/trailing/double hyphens, <=64 chars
description: >                # <=1024 chars, see section 3
  ...
compatibility: ...            # only if env-specific (rare)
metadata:
  version: "1.0"
---
```

Hard limits:
- `SKILL.md` body <= 500 lines, <= ~5000 tokens. Local cap is also 500 lines. No exceptions; overflow goes to `references/`.
- File references one level deep from SKILL.md. No nested reference chains.
- Naming: gerund form (`reviewing-code`, `investigating-failures`, `mapping-project-context`) per local convention; spec-legal.
- Validate before shipping: `skills-ref validate ./skill-name`.

## 3. Descriptions (the triggering surface)

The description carries the entire burden of activation. Name + description are the only thing loaded at startup.

Rules:
- **Imperative, intent-focused.** "Use when the user wants X" not "This skill does X." Match user intent, not implementation.
- **State what it does AND when to use it AND when NOT to.** The not-clause is what separates neighbors. With 20 skills sharing a domain, boundaries matter more than scope.
- **Be pushy about non-obvious triggers.** "...even if they don't say 'security review' explicitly."
- **Name nearest neighbor and the boundary.** "For runtime bug diagnosis use investigating-failures instead."

Template:
```yaml
description: >
  {What it produces, concretely}. Use when {intent phrasings, 2-3 variants
  including ones that don't name the domain}. Do NOT use for {nearest-neighbor
  task}; use {neighbor-skill} instead.
```

Test triggering when it matters (high-use skills): ~20 labeled queries (8-10 should-trigger, 8-10 near-miss negatives), 3 runs each, >=0.5 trigger-rate threshold. Near-misses are the valuable negatives: queries sharing keywords but needing a different skill. Skip the full eval loop for low-stakes skills; do a 3-prompt sanity check minimum. Labeled queries live in `evals/<skill-name>.json`; protocol in `evals/README.md`. Every new skill ships with an eval file.

## 4. Body content rules

**Context economy.** Every token competes with conversation history and other active skills.
- Add only what the agent lacks: project conventions, non-obvious gotchas, exact commands, your output format. Cut anything the model already knows. Test: "Would the agent get this wrong without this line?" If no, delete.
- No preamble, no domain explanations, no "best practices" platitudes.

**Calibrated control.** Match prescriptiveness to fragility.
- Fragile/destructive ops: exact commands, "run exactly this, do not modify."
- Judgment work: state what to look for and why, not step-by-step scripts. Explaining why beats rigid directives for flexible tasks.

**Defaults, not menus.** Pick one tool/approach, give one escape hatch. Never list 4 equal options.

**Procedures over declarations.** Teach the method that generalizes, not the answer to one instance.

**Mandatory sections for every skill:**
1. **Process** — numbered steps. Numbered steps get followed; prose gets interpreted.
2. **What NOT to do** — single biggest lever against drift. Explicitly close the gaps the agent would otherwise fill.
3. **Gotchas** — environment facts that defy reasonable assumptions. Highest-value content. Every correction you make to an agent in practice gets appended here. This is the maintenance loop.
4. **Output format** — concrete template, not prose description. Models pattern-match templates reliably.
5. **Failure modes** — what to do on error/empty/ambiguous input. Skills without failure handling produce confident garbage.

**Optional patterns, use when they fit:**
- Checklists for multi-step workflows with dependencies.
- Validation loops: do work → run validator → fix → repeat until pass.
- Plan-validate-execute for batch/destructive ops: produce structured plan, validate against source of truth, only then execute.
- Bundled scripts: if agents reinvent the same logic across runs, write it once into `scripts/` with clear error messages.

**Progressive disclosure.** Reference files load on demand. Always state the trigger: "Read `references/api-errors.md` if the API returns non-200." Never a bare "see references/."

## 5. Evidence rule (inherit from Han, applies to all analysis skills)

Every skill that produces a judgment (review, investigation, discovery, gap analysis, architecture, security, critique) carries this posture:

**Trust classes:**
- **Codebase** = trusted current-state anchor. A file path + line number stands alone; no corroboration needed. When codebase contradicts docs, codebase wins on what the system does today.
- **Web** = outside the trust boundary. Single web claim driving a recommendation gets marked `single-source` and cannot stand alone. Two independent sources or it stays flagged.
- **Provided** (operator-pasted material) = same scrutiny as web.

**Proximity heuristic.** Closer to origin = stronger: reproduced failure > passing test > source code > commit history > docs > blog > LLM output. Three inversions: spec-compliance contexts (spec wins over divergent code), regulatory contexts, and passing tests (prove only the tested paths; not symmetric with failing tests).

**No-evidence is a named state, not weak evidence.** Label it, defer the dependent decision, name the reopen trigger:
```
## No evidence yet
### {claim}
**Why no evidence:** {searched X, found nothing applicable}
**Reopen when:** {metric, incident, commitment, dependency landing}
```

**Local evidence discipline (absolute):**
- Findings cite direct file reads or executed commands. Roadmap/changelog files are never valid sole evidence.
- Every analysis report ends with **"Claims I did not verify."**
- Conflicting sources: record both, name the disagreement. Never silently pick one.

## 6. Sizing (inherit from Han)

Skills that fan out to agents classify work first: **small / medium / large**. Default small; escalate only on concrete signals (file count, subsystems touched, security/data/infra surface). Announce the chosen size with a one-line justification. Accept `$size` as first positional override. Size caps roster, iteration depth, and escalation bands. Small = minimum roster, always.

## 7. YAGNI (inherit from Han)

Two gates before any artifact item ships:
1. **Evidence test** — needed now, with evidence?
2. **Simpler-version test** — is there a strictly simpler version satisfying the same evidence?

Failures go to `## Deferred (YAGNI)` with a reopen-when trigger. Never silently dropped. Real triggers: a measured metric, an incident, a commitment, a regulation, a dependency landing. "When we have time" is not a trigger.

Apply YAGNI to the skill catalog itself: skills are artifacts. A skill that fails the evidence test gets archived with a trigger, not kept "just in case."

## 8. Local conventions (always)

- 500-line SKILL.md cap; gerund naming.
- One canonical vendor-neutral set. No per-backend forks. Paseo dispatch translates conventions per target.
- Always-true rules (standing rules) live once in `STANDING_RULES.md` and are stamped into every skill's Gotchas between `standing-rules` marker comments by `scripts/stamp-standing-rules.sh`. The duplication is deliberate: skills dispatch standalone to fresh contexts (Paseo, Pi, Codex, OpenCode) that load no repo-level rules file, so the rules must travel inside each SKILL.md. Edit the source, run the script; never hand-edit a stamped block.
- Agents never `git commit` autonomously, never push. Stage by concern, never `git add -A`. Prove edits with `git diff --stat`, not build pass.
- Backup before any destructive operation; backup command stated first.
- Recon before code. Recon dispatched separately from write batches (BooChat recon separate from BooCoder batches).
- No em dashes in skill bodies or outputs.
- Frontend skills: include "run `ls frontend/src/components/ui/` and only import primitives that exist; if missing, stop and report."
- Skill changes ride the deploy that makes them true.

## 9. Maintenance loop

1. **Correction → gotcha.** Any time you correct an agent mid-task, append the correction to that skill's Gotchas the same day. This is the cheapest, highest-yield improvement mechanism.
2. **Trace review.** Read execution traces, not just outputs. Agent flailing = instructions too vague, instructions misapplied, or too many options without a default.
3. **Quarterly invoke audit.** Pull invoke counts. 0 invokes = archive with reopen trigger. <2% = merge candidate into nearest neighbor.
4. **Reinvented logic → script.** Same logic rebuilt across runs goes into `scripts/`.
5. **One execute-then-revise pass minimum** before any new skill ships. Run it on a real task, feed all results (not just failures) back in.

## 10. Skeleton

```markdown
---
name: doing-the-thing
description: >
  {Concrete output}. Use when {intent variants}. Do NOT use for
  {neighbor task}; use {neighbor} instead.
metadata:
  version: "1.0"
---

# Doing the Thing

## Size
Classify small/medium/large from {signals}. Default small. Announce with one-line justification. Accept $size override.

## Process
1. {Recon step: exact commands}
2. {Analysis step: what to look for and why}
3. {Validation step: validator + fix loop}
4. {Output step: fill template}

## What NOT to do
- Do not {gap the agent would fill}
- Do not {neighbor skill's job}
- Do not commit, push, or modify files outside {scope}

## Gotchas
- {Environment fact that defies assumption}

## Output format
{Concrete template}

Every report ends with:
## Claims I did not verify
- {...}

## Failure modes
- {Error/empty/ambiguous input} → {response}

## Deferred (YAGNI)
{Only when non-empty. Item + reopen-when trigger.}
```
