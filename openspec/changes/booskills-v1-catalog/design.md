## Context

BooSkills is a local-only, personal agent-skill catalog. The repo at /home/samkintop/opt/booskills/ currently contains reference forks (han, superpowers, impeccable, skills, OpenSpec) and research docs, but no skills, no agents, no manifests, and no git repository.

The research phase (research/booskills-structure-research.md) settled four decisions:
1. Flat skills/ + agents/ at repo root (superpowers model, no build step)
2. No per-platform transformation (single canonical set, platforms ignore unknown frontmatter)
3. Agents in two formats: agents/*.md (Claude) + agents/codex/*.toml (Codex); Pi degrades to inline persona reference in skill bodies; OpenCode reads the .md files
4. Local-only distribution: Claude Code from local path, others via installer script symlinks

Source material available in forks/:
- forks/han/han.core/agents/ contains 23 agent .md files (12 map to the BooSkills roster)
- forks/han/han.core/skills/ contains skill definitions with process/output/not-to-do patterns
- forks/han/.claude-plugin/marketplace.json proves the meta-plugin manifest pattern
- forks/han/han.core/.claude-plugin/plugin.json proves the plugin component manifest
- forks/impeccable/skill/SKILL.src.md is the critiquing-frontend port source (182 lines, provider-tagged)
- forks/superpowers/skills/ proves single-source, no-build shipping across 7 platforms
- forks/superpowers/skills/subagent-driven-development/SKILL.md proves agent reference via prompt files

## Goals / Non-Goals

**Goals:**
- Ship 10 skill SKILL.md files and 12 agent persona files that validate against SKILL_GUIDELINES.md constraints
- Enable local-path Claude Code install via .claude-plugin/
- Enable Pi, Codex, OpenCode, and Paseo use via symlinks from a local installer script
- Every SKILL.md under 500 lines, description under 1024 chars, frontmatter limited to agentskills.io superset
- Every agent .md preserves persona, domain, posture, and output schema from Han source

**Non-Goals:**
- Public marketplace publishing (YAGNI until shared beyond this machine)
- Build-time transformation of skill content (YAGNI - superpowers proves single source works)
- npm package or skills.sh distribution (YAGNI - local-only)
- OpenCode JS plugin for bootstrap injection (YAGNI)
- Bucket folder organization for 10 skills (YAGNI)
- skills-ref validator integration (not installed)

## Decisions

### D1: Single canonical skill body, no transformation

All platforms read the same SKILL.md content. No build step, no provider tags, no conditional blocks. The superpowers repo (forks/superpowers/skills/) ships 14 skills to 7 platforms from one file each with zero transformation. Pi, Codex, and OpenCode all ignore unknown frontmatter fields. The only platform-specific concern is agent format, handled in agents/, not in skill content.

Alternative considered: impeccable's build-time transformer (forks/impeccable/scripts/build.js producing per-provider output). Rejected: adds a build step without evidence of need.

### D2: Agents in two formats, not inline

agents/*.md in Claude format (frontmatter: name, description, tools, model; body = system prompt) plus agents/codex/*.toml (TOML: name, description, developer_instructions, model). Pi degrades to skill body referencing agents/<name>.md as a persona lens.

Rationale: The 12 agent personas are substantial system prompts (500-1500 lines with protocols, anti-patterns, output schemas). Inlining them into every dispatching skill would bloat skill bodies past the 500-line cap. Separate files keep skill bodies clean and agents reusable across skills.

Alternative considered: superpowers' inline prompt templates (references/*.md referenced from SKILL.md body). Rejected: BooSkills agents have structured output schemas (E#/V# numbering, file:line citations) that benefit from being standalone referenceable documents rather than inline prompt snippets.

### D3: .claude-plugin/marketplace.json for local-path install

Create .claude-plugin/marketplace.json and .claude-plugin/plugin.json following Han's pattern (forks/han/.claude-plugin/marketplace.json, forks/han/han.core/.claude-plugin/plugin.json) with source pointing at the local directory path, not a remote GitHub URL. Claude Code's `plugin marketplace add` accepts a local directory path. No remote repository needed.

Pattern from Han (forks/han/.claude-plugin/marketplace.json): meta-plugin listing multiple plugins. For BooSkills, a single plugin entry pointing at the repo root.

### D4: Installer script with preferred symlinks

Write scripts/install.sh that:
1. Creates one symlink per skill from ~/.agents/skills/<skill-name> to /home/samkintop/opt/booskills/skills/<skill-name>/ (flat layout; see Implementation notes)
2. Creates symlinks from ~/.codex/agents/ pointing to each /home/samkintop/opt/booskills/agents/codex/*.toml
3. Creates symlinks from ~/.config/opencode/agents/ pointing to each /home/samkintop/opt/booskills/agents/*.md
4. Falls back to copy where a platform rejects symlinks (verified per platform, not assumed)
5. Verifies each symlink/file resolves after creation

Symlinks let edits to the repo propagate without reinstalling. The installer script is simpler than skills.sh integration (not needed for local-only use; YAGNI).

### D5: Pi degradation via reference, not transformation

Each skill that dispatches agents includes a Gotcha noting that on platforms without subagent support, the operator applies the named persona lens by reading agents/<name>.md and running analysis in sequential passes. No skill body transformation for Pi.

### D6: Agent port preserves Han output structure

Each agent .md preserves from the Han source: frontmatter (name, description, tools, model), persona opening, domain vocabulary, anti-patterns, protocol headers, and output format (E#/V# numbered findings with file:line). Strip only Han-specific references (plugin path references like `plugins/han/references/`, internal skill dispatch syntax like `/skill-name`, and references/ links that resolve to Han-internal file paths).

### D7: Build order follows SKILL_CATALOG_SPEC.md

1. Repo scaffolding + git init
2. reviewing-code as reference skill (exercises the full skeleton: sizing, fan-out, evidence, YAGNI, output template)
3. Agent roster port (needed by all dispatching skills downstream)
4. Remaining 9 skills in catalog order
5. Installer script
6. Verification

reviewing-code comes first because it exercises the full skill lifecycle and serves as a template. Agent roster must come before skills 3-10 because every dispatching skill references agents.

### D8: critiquing-frontend is a port, not a rewrite

Port forks/impeccable/skill/SKILL.src.md by: removing provider tags (<codex>, <gemini>), removing placeholder syntax ({{variable}}), wrapping in Section 10 skeleton (frontmatter, Size, Process, What NOT to do, Gotchas, Output format, Failure modes, Deferred), adding the BooLab primitive rule and anti-cream Gotcha per SKILL_CATALOG_SPEC, adding size classification and evidence rule.

The substantive design guidance (color, typography, layout, motion, interaction rules) is preserved unchanged from impeccable.

## Risks / Trade-offs

- **Agent persona length may require trimming.** Han agents range from 100-400 lines. Agents that exceed dispatch budgets may need trimming. Mitigation: initial port preserves full content; trim only if dispatch testing shows context overflow, and trim by removing examples rather than domain vocabulary.

- **Codex TOML format may lose markdown formatting.** Han agents use rich markdown formatting; Codex TOML developer_instructions is a single string field. Mitigation: TOML rendering preserves the full markdown body as developer_instructions string; no content loss expected.

- **Symlinks may not work on all target directory structures.** Some platforms may not create parent directories or may reject symlinks. Mitigation: installer script creates parent directories before symlinking, verifies each symlink after creation, and falls back to copy where symlinks fail.

- **Platform path assumptions untested.** The paths in the installer script (~/.agents/skills/, ~/.codex/agents/, ~/.config/opencode/agents/) are from platform docs and Paseo source but not tested on this machine. Mitigation: installer script verifies each path exists and each symlink resolves after creation.

## Open Questions

None at this time. The research phase resolved all structural decisions. Implementation questions (exact agent line counts, exact installer script path handling) are resolved during implementation tasks.
## Implementation notes

- 2026-06-11, post-implementation: the design assumed OpenCode could consume the Claude-format agent .md files directly (symlinked from agents/). Wrong: OpenCode fails session creation entirely (Unexpected server error) when ~/.config/opencode/agents/ contains files with Claude-format frontmatter (comma-string tools, bare model names like "sonnet"). Verified by A/B test: sessions create with the dir absent, fail with it present. Fix: added agents/opencode/ rendering (description + mode: subagent only, persona body unchanged); scripts/install.sh now links from agents/opencode/. This resolves the "OpenCode agent frontmatter compatibility" item in research/booskills-structure-research.md from no-evidence to evidenced.
- 2026-06-11, post-implementation: operator-directed scope addition outside the original 10-skill spec: skills/paseo-boo/ (single Paseo orchestrator routing booskills skills to Paseo subagents with role-based provider routing; replaces the 17 archived paseo-boo-* routers). SKILL_CATALOG_SPEC.md not yet updated to list it.

- 2026-06-11, post-implementation (investigation finding): the original spec mandated a single parent symlink ~/.agents/skills/booskills -> skills/, which places every SKILL.md two levels below ~/.agents/skills/. OpenCode, Pi, and Codex auto-discovery scan exactly one level (<name>/SKILL.md), so all 11 skills were silently undiscoverable on those platforms; only path-based routed dispatch worked. Fix: flat per-skill symlinks with an upgrade step removing the legacy parent link; spec.md and proposal.md corrected to match. Evidence and adversarial validation in research/investigation-skill-discovery.md.
- 2026-06-11, post-implementation (operator request): per-agent model control added. Each Paseo preset now carries an "agents" map (agent name -> opencode model id); scripts/apply-agent-models.sh renders ~/.config/opencode/agents/*.md as generated copies with a model: line from the active preset (replacing install symlinks for these files only; the model line is preset state, not repo content). ~/.paseo/bin/paseo-preset invokes the renderer after every switch; install.sh delegates the opencode agents section to it. Defaults derive from roles: all agents use the audit model, software-architect uses planning, user-experience-designer uses ui, with audit fallback when a role routes outside opencode. Codex TOMLs had their invalid model = "sonnet" lines removed (Claude tier names are not Codex models); per-agent Codex model control is deferred, reopen when Codex dispatches are in real use. Also archived 23 stale han-* agents found in the legacy ~/.config/opencode/agent/ (singular) directory, which OpenCode also reads.
- 2026-06-11, post-implementation (tier rebuild): presets rebuilt around the canonical model-tier taxonomy in ~/.paseo/model-tiers.json (workhorse, workhorse-local, mid, high, subscription-low/mid/high; subscription-high = GPT-5/Opus/Fable is flagged neverSubagent). Preset roster: workhorse, workhorse-local, mid, high, subscription-low, subscription-mid, workhorse-premium + legacy free/local/local-concurrent; balanced/full-spread/subscription-mix archived to ~/.paseo/presets-archive/. apply-agent-models.sh now hard-refuses any subagent assignment matching opus/fable/gpt-5, in both the preset agents map and the repo Claude agent files. That guard immediately caught four han-inherited "model: opus" pins (adversarial-security-analyst, junior-developer, software-architect, user-experience-designer; the first two are reviewing-code's always-dispatched pair). All four set to sonnet; plugin bumped to 1.0.1 and cache refreshed. Agent-port lesson recorded: han agent model fields must be re-tiered, not preserved, when porting.
- 2026-06-11, post-implementation (operator request: align with boocontext): the boocontext MCP server (7 tools: overview/map/health/symbols/callgraph/impact/types, /opt/forks/boocontext) was registered only for OpenCode. Added it to Claude Code (claude mcp add, user scope; verified Connected) and Codex (~/.codex/config.toml [mcp_servers.boocontext]). Pi left alone (no boocontext registration found; out of scope until needed). boo-mapping-project-context (v1.1) and boo-analyzing-architecture (v1.1) now prefer boocontext tools when available and fall back to manual enumeration when absent (progressive disclosure); both gained allowed-tools with mcp__boocontext. Kept as separate skills, not merged: boocontext is a generic MCP analyzer, boo-mapping-project-context adds deploy-surface/CI/doc-drift framing boocontext does not, so the distinctness gate holds. The standalone boocontext skill (~/.agents/skills/boocontext, not part of this repo) is unchanged.
