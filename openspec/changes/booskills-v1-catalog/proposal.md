## Why

BooSkills needs a v1 build: one canonical agent-skill catalog of 10 skills and 12 agent personas, operational on this machine across Claude Code, Pi, Codex, OpenCode, and Paseo. The research phase (research/booskills-structure-research.md) settled the repo structure, distribution approach, and platform adaptations. This change executes those decisions and writes every file.

Personal, local-only. No npm publish, no skills.sh, no public marketplace. The repo stays on this machine. Distribution is local-path installs and symlinks.

## What Changes

- Initialize git repo with .gitignore (forks/ stays untracked as reference material)
- Create directory layout: skills/, agents/, agents/codex/, .claude-plugin/
- Port 12 agent personas from forks/han/han.core/agents/ to agents/*.md (stripped to persona, domain, posture, output schema with E#/V# numbering and file:line citations)
- Create agents/codex/*.toml renderings of the 12 agents for Codex
- Write 10 skill SKILL.md files per SKILL_CATALOG_SPEC.md and SKILL_GUIDELINES.md Section 10 skeleton
- Port critiquing-frontend from forks/impeccable/skill/SKILL.src.md (content unchanged, structural wrapping)
- Create .claude-plugin/marketplace.json and plugin.json for local-path Claude Code install
- Write local installer script (symlinks preferred; copies only where symlinks fail; no npx skills add)
- Verify: openspec validate passes; each SKILL.md under 500 lines; each description under 1024 chars; frontmatter limited to agentskills.io superset fields

## Capabilities

### New Capabilities

- `repo-scaffolding`: Git repo initialization, .gitignore (forks/ untracked), directory layout (skills/, agents/, agents/codex/, .claude-plugin/), and local-path Claude Code manifests (marketplace.json, plugin.json)
- `agent-roster`: 12 agent persona .md files ported from Han (forks/han/han.core/agents/) preserving persona, domain, posture, and output schema, plus 12 Codex TOML renderings in agents/codex/
- `skill-catalog`: All 10 skill SKILL.md files (reviewing-code, investigating-failures, mapping-project-context, analyzing-architecture, critiquing-frontend, refining-ideas, planning-changes, implementing-changes, auditing-code-quality, researching) following SKILL_GUIDELINES.md Section 10 skeleton, each under 500 lines with description under 1024 chars
- `local-installer`: Shell script that symlinks (preferred) or copies skills/ and agents/ to platform-specific paths (one link per skill at ~/.agents/skills/<skill-name>, ~/.codex/agents/, ~/.config/opencode/agents/), verifies each link, and reports results

### Modified Capabilities

(none - greenfield project)

## Impact

- New repo structure at /home/samkintop/opt/booskills/ (everything under skills/, agents/, and .claude-plugin/ is new)
- forks/ directory remains untracked reference material (gitignored, never shipped)
- Installer script writes to user home paths: ~/.agents/skills/, ~/.codex/agents/, ~/.config/opencode/agents/
- .claude-plugin/ enables local-path Claude Code plugin install (not public marketplace registration)
- No npm package, no skills.sh, no remote GitHub install path

## Deferred (YAGNI)

### Build-time skill transformer
**Why deferred:** Gate 1 (evidence test) fails. No evidence that skill body content needs per-platform transformation. Superpowers ships identical content to 7 platforms. Pi, Codex, and OpenCode all ignore unknown frontmatter fields.
**Reopen when:** A platform requires different skill body content (not just frontmatter stripping) to function, or the catalog exceeds 25 skills and manual frontmatter management becomes a burden.

### skills.sh CLI integration for agent persona distribution
**Why deferred:** Gate 2 (simpler version) fails. A local installer script that symlinks agent files is simpler than integrating with skills.sh's agent handling, which we haven't verified and is not needed for local-only distribution.
**Reopen when:** BooSkills becomes shared beyond this machine and needs a public distribution channel.

### OpenCode JS plugin (like superpowers' superpowers.js)
**Why deferred:** Gate 1 fails for initial ship. OpenCode discovers skills from .agents/skills/ natively. The JS plugin is only needed for bootstrap injection, which BooSkills doesn't require for v1.
**Reopen when:** We need to inject bootstrap context at session start on OpenCode, or when OpenCode's native skill discovery has issues with our layout.

### Per-platform plugin manifests beyond Claude Code
**Why deferred:** Gate 2 (simpler version) applies. Pi uses local path install. Codex discovers .agents/skills/ natively. OpenCode has no plugin channel for skills. The only manifest needed is .claude-plugin/ for local-path install.
**Reopen when:** BooSkills becomes shared beyond this machine and Pi or Codex launches a plugin marketplace requiring manifest registration.

### Bucket folder organization for skills
**Why deferred:** Gate 1 fails. 10 skills fits cleanly in a flat skills/ dir. Bucket folders add navigational overhead without benefit at this scale.
**Reopen when:** The catalog exceeds 25 skills and navigational grouping becomes necessary.

### npm package distribution
**Why deferred:** Gate 1 fails. BooSkills is personal, local-only. No npm publish, no Pi package keywords, no remote distribution needed.
**Reopen when:** BooSkills becomes shared beyond this machine.

### Public marketplace registration
**Why deferred:** Gate 1 fails. .claude-plugin/marketplace.json is for local-path install, not public marketplace registration. No public marketplace registration or remote GitHub install path is needed.
**Reopen when:** BooSkills becomes shared beyond this machine and a public marketplace listing is desired.

### skills-ref validator integration
**Why deferred:** Gate 1 fails. skills-ref CLI is not installed (per research/platform-packaging-notes.md). Manual validation against SKILL_GUIDELINES.md constraints (500-line cap, 1024-char description cap, frontmatter fields) is sufficient for v1.
**Reopen when:** skills-ref CLI is installed and can be added to the verification step.