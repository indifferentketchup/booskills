## ADDED Requirements

### Requirement: Git repository initialization
The BooSkills repo SHALL be initialized as a git repository at /home/samkintop/opt/booskills/. A .gitignore file SHALL exclude the forks/ directory (reference material, not shipped) and common editor/OS artifacts (.DS_Store, node_modules/, *.swp, .idea/). The first commit SHALL contain only the repo scaffolding files (no skills, agents, or installer content yet).

#### Scenario: Clean git init
- **WHEN** `git init` is run at /home/samkintop/opt/booskills/
- **THEN** a .git directory exists and `git status` reports an untracked .gitignore

#### Scenario: forks/ directory gitignored
- **WHEN** any file is created under forks/
- **THEN** `git status` does not list those files as untracked

### Requirement: Directory layout
The repo SHALL have this directory structure at the top level:

```
skills/
agents/
agents/codex/
.claude-plugin/
scripts/
```

Each skills/ subdirectory SHALL contain a SKILL.md. Each agents/ .md file SHALL follow the pattern `<persona-name>.md`. Each agents/codex/ .toml file SHALL follow the pattern `<persona-name>.toml`.

#### Scenario: Required directories exist
- **WHEN** the scaffolding is complete
- **THEN** the directories skills/, agents/, agents/codex/, .claude-plugin/, and scripts/ all exist

#### Scenario: No nested skill directories
- **WHEN** listing the skills/ directory
- **THEN** each subdirectory contains exactly one SKILL.md and no other top-level files (references/ and scripts/ subdirectories within a skill dir are allowed)

### Requirement: Claude Code plugin manifests
.claude-plugin/marketplace.json SHALL list the BooSkills plugin with name "booskills", owner, and a source path pointing at the local directory. .claude-plugin/plugin.json SHALL list the plugin name, description, version, and component directories (skills, agents).

The marketplace.json SHALL follow the pattern established in forks/han/.claude-plugin/marketplace.json. The plugin.json SHALL follow the pattern in forks/han/han.core/.claude-plugin/plugin.json. No remote GitHub URL SHALL appear; source paths SHALL be relative local paths.

#### Scenario: marketplace.json valid structure
- **WHEN** .claude-plugin/marketplace.json is parsed
- **THEN** it contains a plugins array with at least one entry whose name is "booskills" and whose source is a relative local path

#### Scenario: plugin.json valid structure
- **WHEN** .claude-plugin/plugin.json is parsed
- **THEN** it contains name, description, version, and at minimum a skills directory pointer

#### Scenario: No remote URLs
- **WHEN** scanning both manifest files for URLs
- **THEN** no file contains a remote GitHub URL (github.com/...) or npm registry URL

### Requirement: SKILL_GUIDELINES.md and SKILL_CATALOG_SPEC.md remain at repo root
The two governing documents (SKILL_GUIDELINES.md and SKILL_CATALOG_SPEC.md) SHALL remain at the repo root as canonical references for skill and agent authoring. They are not gitignored and not moved.

#### Scenario: Governing docs present
- **WHEN** listing the repo root
- **THEN** SKILL_GUIDELINES.md and SKILL_CATALOG_SPEC.md both exist at the top level