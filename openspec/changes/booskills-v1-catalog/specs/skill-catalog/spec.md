## ADDED Requirements

### Requirement: Skill catalog completeness
The skills/ directory SHALL contain exactly 10 subdirectories, each with a SKILL.md, matching the SKILL_CATALOG_SPEC.md roster: reviewing-code, investigating-failures, mapping-project-context, analyzing-architecture, critiquing-frontend, refining-ideas, planning-changes, implementing-changes, auditing-code-quality, and researching.

#### Scenario: Correct number of skill directories
- **WHEN** listing skills/*/SKILL.md
- **THEN** exactly 10 files exist, one per named skill in the catalog

#### Scenario: Each skill directory name matches catalog
- **WHEN** comparing skill directory names to the SKILL_CATALOG_SPEC.md roster
- **THEN** every directory has a corresponding entry and every catalog entry has a corresponding directory

### Requirement: Skill SKILL.md Section 10 skeleton compliance
Every SKILL.md SHALL follow the Section 10 skeleton from SKILL_GUIDELINES.md: YAML frontmatter (name, description, metadata with version), then sections for Size, Process, What NOT to do, Gotchas, Output format (ending with "Claims I did not verify"), Failure modes, and optionally Deferred (YAGNI).

#### Scenario: Frontmatter present and valid
- **WHEN** parsing a SKILL.md's YAML frontmatter
- **THEN** name (gerund form, hyphenated), description, and metadata.version all exist

#### Scenario: All mandatory sections present
- **WHEN** scanning a SKILL.md for section headers
- **THEN** Size, Process, What NOT to do, Gotchas, Output format, and Failure modes all appear as ## or ### headers

#### Scenario: Output format ends with Claims section
- **WHEN** reading the Output format section of a SKILL.md
- **THEN** it includes "Claims I did not verify" as a subsection

### Requirement: Skill line count under 500 lines
Every SKILL.md SHALL be at most 500 lines. Content that would exceed this limit SHALL be moved to references/ subdirectories within the skill directory, with progressive disclosure triggers stated in the skill body ("Read references/<file>.md if <condition>").

#### Scenario: Each skill under line limit
- **WHEN** counting lines in each skills/*/SKILL.md
- **THEN** no file exceeds 500 lines

### Requirement: Skill description under 1024 characters
Every SKILL.md frontmatter description SHALL be at most 1024 characters. The description SHALL include what the skill does, when to use it, and when NOT to use it (neighbor boundary), per SKILL_GUIDELINES.md Section 3.

#### Scenario: Each description under char limit
- **WHEN** measuring each skills/*/SKILL.md frontmatter description
- **THEN** each is at most 1024 characters

#### Scenario: Description includes boundary clause
- **WHEN** reading each description
- **THEN** each contains a "Do NOT use for" or equivalent boundary clause naming the nearest neighbor skill

### Requirement: Skill frontmatter limited to agentskills.io superset
SKILL.md frontmatter SHALL use only fields from the agentskills.io superset: name, description, compatibility (optional), and metadata (with version). Unknown fields are tolerated by Pi, Codex, and OpenCode but SHALL NOT be added. No provider-conditional blocks or placeholder syntax.

#### Scenario: No provider-conditional blocks
- **WHEN** scanning each SKILL.md for <codex>, <gemini>, or similar provider tags
- **THEN** none are found

#### Scenario: No placeholder syntax
- **WHEN** scanning each SKILL.md for {{variable}} patterns
- **THEN** none are found

### Requirement: reviewing-code skill (reference implementation)
The reviewing-code SKILL.md SHALL be the first skill implemented and SHALL exercise the full Section 10 skeleton: sizing (small/medium/large with justification), agent fan-out (always dispatches junior-developer + adversarial-security-analyst; conditionally adds others based on diff scope), evidence rule (codebase citations stand alone), YAGNI gate on advisory recommendations, and classified findings output (blocking / advisory / nit with verdict: approve / approve-with-changes / block).

Its description SHALL include "Do NOT use for whole-codebase health scans with no diff in scope; use auditing-code-quality" and "Do NOT use for diagnosing runtime failures; use investigating-failures."

#### Scenario: reviewing-code exists and dispatches agents
- **WHEN** reading skills/reviewing-code/SKILL.md
- **THEN** the Process section names junior-developer and adversarial-security-analyst as always-dispatched agents

#### Scenario: reviewing-code boundary clauses present
- **WHEN** reading skills/reviewing-code/SKILL.md description
- **THEN** it names both auditing-code-quality and investigating-failures as neighbor boundaries

### Requirement: investigating-failures skill
The investigating-failures SKILL.md SHALL dispatch evidence-based-investigator first, then conditionally dispatch specialists (concurrency-analyst for races/deadlocks, behavioral-analyst for logic divergence). It SHALL produce numbered E# evidence items, a root-cause statement, a proposed fix as a described change (not applied), and V# validation findings. Its What NOT to do section SHALL state: never apply the fix, never conclude root cause from a single web source, and a passing test is not evidence the bug is absent.

#### Scenario: investigating-failures dispatch structure
- **WHEN** reading skills/investigating-failures/SKILL.md
- **THEN** the Process section names evidence-based-investigator as the first-dispatched agent

#### Scenario: investigating-failures NOT-to-dos
- **WHEN** reading the What NOT to do section
- **THEN** it states that the skill never applies fixes and never concludes from a single web source

### Requirement: mapping-project-context skill
The mapping-project-context SKILL.md SHALL produce a context map (structure, services/ports, data stores, external deps, conventions, build/deploy commands). It SHALL NOT produce recommendations (this skill describes, it does not judge). Its Process SHALL enumerate from disk first, trace entry points from code (not docs), and read existing context docs LAST. Its Gotchas section SHALL note that roadmap/changelog files are never valid sole evidence.

#### Scenario: mapping-project-context describes without recommending
- **WHEN** reading skills/mapping-project-context/SKILL.md
- **THEN** the What NOT to do section explicitly states the skill does not produce recommendations

### Requirement: analyzing-architecture skill
The analyzing-architecture SKILL.md SHALL dispatch structural-analyst, behavioral-analyst, concurrency-analyst, and risk-analyst in parallel, then software-architect synthesizes. It SHALL YAGNI gate every recommendation. Its description SHALL name mapping-project-context as prerequisite and reviewing-code as a neighbor boundary.

#### Scenario: analyzing-architecture dispatch structure
- **WHEN** reading skills/analyzing-architecture/SKILL.md
- **THEN** the Process section names all four analyst agents and the software-architect synthesizer

### Requirement: critiquing-frontend skill (port from impeccable)
The critiquing-frontend SKILL.md SHALL be ported from forks/impeccable/skill/SKILL.src.md with the following changes: (1) remove all provider tags (<codex>, <gemini>), (2) remove all placeholder syntax ({{variable}}), (3) wrap in Section 10 skeleton with frontmatter, Size, Process, What NOT to do, Gotchas, Output format, Failure modes, (4) add Gotcha entries for the BooLab primitive rule ("run ls frontend/src/components/ui/ and only reference primitives that exist; if missing, stop and report") and anti-cream/serif default-aesthetic warning for dashboards, (5) add size classification and evidence rule.

The substantive design guidance (color, typography, layout, motion, interaction rules) SHALL be preserved unchanged from the impeccable source.

#### Scenario: No provider tags or placeholders
- **WHEN** scanning skills/critiquing-frontend/SKILL.md for <codex>, <gemini>, or {{variable}}
- **THEN** none are found

#### Scenario: Section 10 skeleton present
- **WHEN** scanning skills/critiquing-frontend/SKILL.md for section headers
- **THEN** Size, Process, What NOT to do, Gotchas, Output format, and Failure modes all appear

#### Scenario: BooLab primitive rule Gotcha present
- **WHEN** reading skills/critiquing-frontend/SKILL.md Gotchas section
- **THEN** it contains the primitive rule about running ls frontend/src/components/ui/

### Requirement: refining-ideas skill
The refining-ideas SKILL.md SHALL describe an interview process that asks up to 3 questions per round, infers answers from project context, and stops when the sketch could be handed to planning-changes without further questions. Its Process SHALL forbid proposing a design, exceeding 3 questions per round, asking anything answerable from the repo, and filler language. Its Output format SHALL be a requirements sketch: problem statement, actors, success criteria, in-scope, explicitly out-of-scope, open questions, backend/frontend surface split.

#### Scenario: refining-ideas question limit
- **WHEN** reading skills/refining-ideas/SKILL.md
- **THEN** the Process section states a maximum of 3 questions per round

### Requirement: planning-changes skill (OpenSpec planner)
The planning-changes SKILL.md SHALL produce a validated OpenSpec change folder (proposal.md, specs/, design.md, tasks.md). Its Process SHALL include: precondition check that openspec/ exists, YAGNI gate on every requirement and task, validation via `openspec validate`, and adversarial-validator + junior-developer dispatch after initial draft. Its Hard contract section SHALL state: the skill's only output is the OpenSpec change folder; it never writes application code.

#### Scenario: planning-changes OpenSpec validation step
- **WHEN** reading skills/planning-changes/SKILL.md
- **THEN** the Process section includes a step to run `openspec validate`

#### Scenario: planning-changes hard contract
- **WHEN** reading skills/planning-changes/SKILL.md
- **THEN** it states that the skill never writes application code

### Requirement: implementing-changes skill (OpenSpec implementer)
The implementing-changes SKILL.md SHALL execute tasks from an existing validated OpenSpec change folder. Its Hard contract section SHALL state: input is a change-id; scope is tasks.md, nothing else. Its Process SHALL include: refuse if validation errors exist; execute tasks in order; check the box in tasks.md after verification; stop and report if design is wrong (no silent redesign). Its What NOT to do section SHALL state: no work outside tasks.md scope, no "while I'm here" refactors, no committing, no archiving.

#### Scenario: implementing-changes deviation rule
- **WHEN** reading skills/implementing-changes/SKILL.md
- **THEN** the Process section includes a step to stop and report when implementation reveals the design is wrong, writing the discrepancy into design.md

### Requirement: auditing-code-quality skill
The auditing-code-quality SKILL.md SHALL be tree-scoped (whole repo or named module, no diff required). Its Process SHALL include: run mechanical detectors first (lint, dead-code, duplication tools per stack in scripts/), then agent pass on mechanical hits plus sampled hot files. Its output SHALL be a prioritized backlog table with finding, category, file:line, impact (high/med/low), effort (S/M/L), and suggested remediation. YAGNI gate: an optimization without a measured pain point goes to Deferred.

#### Scenario: auditing-code-quality mechanical detectors
- **WHEN** reading skills/auditing-code-quality/SKILL.md
- **THEN** the Process section includes running mechanical detectors before the agent pass

#### Scenario: auditing-code-quality YAGNI gate on optimizations
- **WHEN** reading skills/auditing-code-quality/SKILL.md
- **THEN** the YAGNI gate is described: optimizations without a measured pain point go to Deferred

### Requirement: researching skill
The researching SKILL.md SHALL tag every claim with trust class (codebase/web/provided) and corroboration status. Its Process SHALL include: define the decision research serves (research without a decision is a YAGNI failure); gather wide-then-deep preferring primary sources; record conflicting sources both ways. Its Output format SHALL include: decision statement, recommendation, claims table, No evidence yet section, and Claims I did not verify. Its What NOT to do section SHALL state: never let an LLM-generated explanation count as a source; never silently resolve a source conflict.

#### Scenario: researching trust-class tagging
- **WHEN** reading skills/researching/SKILL.md
- **THEN** the Process section instructs tagging every claim with a trust class

### Requirement: Global rules baked into every skill
Every SKILL.md SHALL include these global rules (from SKILL_CATALOG_SPEC.md) in the Gotchas section or as baked-in process constraints: (1) evidence rule: codebase citations stand alone; web claims need corroboration; no-evidence = defer with reopen trigger; (2) sizing: small/medium/large, default small, announce with one-line justification; (3) never commit, never push, never git add -A; (4) no em dashes in outputs; (5) recon dispatched separately from write batches; (6) Pi subagent degradation Gotcha for skills that dispatch agents.

#### Scenario: Evidence rule present
- **WHEN** reading each skills/*/SKILL.md
- **THEN** each contains the evidence rule or references it from the Process or Gotchas section

#### Scenario: Sizing section present
- **WHEN** reading each skills/*/SKILL.md
- **THEN** each has a Size section that specifies default small with one-line justification

#### Scenario: No-commit Gotcha present
- **WHEN** reading each skills/*/SKILL.md
- **THEN** each What NOT to do section or Gotchas section includes the no-commit rule

#### Scenario: No em dashes in skill content
- **WHEN** scanning each skills/*/SKILL.md for the em dash character (U+2014)
- **THEN** none are found