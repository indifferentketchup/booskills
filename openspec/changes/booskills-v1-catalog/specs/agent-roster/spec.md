## ADDED Requirements

### Requirement: Agent roster completeness
The agents/ directory SHALL contain exactly 12 .md files, one for each agent in the SKILL_CATALOG_SPEC.md roster: adversarial-security-analyst, adversarial-validator, evidence-based-investigator, junior-developer, structural-analyst, behavioral-analyst, concurrency-analyst, risk-analyst, software-architect, test-engineer, edge-case-explorer, and user-experience-designer.

#### Scenario: Correct number of agent files
- **WHEN** listing agents/*.md
- **THEN** exactly 12 files exist, one per named agent in the catalog

#### Scenario: Each agent filename matches catalog
- **WHEN** comparing agent filenames to the SKILL_CATALOG_SPEC.md roster
- **THEN** every file has a corresponding entry in the roster and every roster entry has a corresponding file

### Requirement: Agent persona preservation
Each agent .md file SHALL preserve from its Han source (forks/han/han.core/agents/<name>.md) the following elements: frontmatter (name, description, tools, model), persona opening paragraph, domain vocabulary section, anti-patterns section, protocol headers, and output format (E#/V# numbered findings with file:line citations where applicable).

Each agent .md file SHALL NOT contain Han-internal path references (patterns like `plugins/han/references/`, relative paths to Han skill dispatch syntax like `/skill-name`), or references/ links that resolve to Han-internal file paths.

#### Scenario: Core persona content preserved
- **WHEN** reading an agent .md file (e.g., adversarial-security-analyst.md)
- **THEN** it contains the domain vocabulary section, anti-patterns section, and output format section from the Han source

#### Scenario: Han-internal references stripped
- **WHEN** reading an agent .md file
- **THEN** no reference to `plugins/han/` paths or Han-specific dispatch syntax (e.g., `/code-review`, `/investigate`) appears

#### Scenario: Evidence rule output schema preserved
- **WHEN** reading an agent .md file that produces numbered findings
- **THEN** the output format section specifies E# numbered evidence items or V# numbered validation findings with file:line citations

### Requirement: Agent frontmatter format
Each agent .md file SHALL have YAML frontmatter with the following fields: name (matching the filename without .md), description (under 1024 characters), tools (list of tool names the agent uses), and model (the model identifier). This matches the Claude Code agent format.

#### Scenario: Frontmatter fields present
- **WHEN** parsing an agent .md file's YAML frontmatter
- **THEN** name, description, tools, and model fields all exist and name matches the filename stem

#### Scenario: Description length under limit
- **WHEN** measuring each agent description
- **THEN** each is under 1024 characters

### Requirement: Codex TOML renderings
The agents/codex/ directory SHALL contain exactly 12 .toml files, one per agent. Each TOML file SHALL contain: name, description, developer_instructions (the full markdown body from the .md file as a string), and model. The TOML filename SHALL match the agent name.

#### Scenario: Correct number of TOML files
- **WHEN** listing agents/codex/*.toml
- **THEN** exactly 12 files exist, one per agent in the roster

#### Scenario: TOML content mirrors .md content
- **WHEN** comparing adversarial-security-analyst.toml developer_instructions to adversarial-security-analyst.md body (below frontmatter)
- **THEN** the content is substantively identical (allowing for TOML string escaping)

#### Scenario: TOML parses without error
- **WHEN** each .toml file is parsed by a TOML parser
- **THEN** parsing succeeds and produces name, description, developer_instructions, and model keys

### Requirement: Pi degradation via skill body reference
Skills that dispatch agents SHALL include a Gotcha in their Gotchas section noting that on platforms without native subagent support (Pi), the operator applies the named persona lens by reading agents/<name>.md and running the analysis in sequential passes. No skill body SHALL be transformed or duplicated for Pi.

#### Scenario: Pi Gotcha present in dispatching skills
- **WHEN** reading a skill's SKILL.md that dispatches agents
- **THEN** the Gotchas section contains an entry describing the Pi fallback behavior