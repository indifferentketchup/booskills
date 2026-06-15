# BooSkills Repo Structure Research

## Decision statement

How should the BooSkills repo be structured to ship one canonical skill catalog (10 skills + 12 agent personas) as installable packages for four platforms: Claude Code plugin, Pi package, Codex plugin, OpenCode? Sub-questions: (a) canonical source layout and frontmatter dialect, (b) translation strategy per platform, (c) agent-persona dispatch per platform with degradation, (d) distribution/install mechanism.

---

## Sub-question A: Canonical source layout and frontmatter dialect

### Options

**Option 1: Flat `skills/` + `agents/` at repo root (superpowers model)**
Same `skills/` dir consumed by all platforms. No build step. Each skill is `skills/<name>/SKILL.md` with agentskills.io frontmatter. Agents are `agents/<name>.md` in Claude format. Minimal per-platform manifests at root.

Evidence: superpowers ships 14 skills to 7 platforms from a single `skills/` dir with zero build-time transformation (`forks/superpowers/skills/`). skills repo does the same (`forks/skills/skills/`).

**Option 2: Source + transformer (impeccable model)**
Canonical source in `skill/SKILL.src.md` with provider tags (`<codex>`, `<gemini>`, etc.) and `{{placeholder}}` syntax. Build-time transformer produces `dist/<provider>/.<config>/skills/` for 14 providers.

Evidence: impeccable's `scripts/build.js` reads from `skill/` and produces per-provider output via `scripts/lib/transformers/factory.js`. The source uses provider-conditional blocks and placeholder replacement.

**Option 3: Deep skill catalog with bucket folders (skills model)**
Skills organized by domain bucket: `skills/engineering/`, `skills/productivity/`, `skills/misc/`. Each bucket has its own README. Plugin manifest lists explicit skill paths.

Evidence: `forks/skills/skills/` uses `engineering/`, `productivity/`, `misc/`, `deprecated/`, `in-progress/`, `personal/` buckets. The `.claude-plugin/plugin.json` at `forks/skills/.claude-plugin/plugin.json` lists every skill path explicitly.

### Recommendation: Option 1 (flat `skills/` + `agents/`)

The SKILL_CATALOG_SPEC already specifies flat `skills/` and `agents/` at root. Superpowers proves this works across 7 platforms. The bucket model adds organizational complexity BooSkills doesn't need at 10 skills. The impeccable transformer is overkill for 4 target platforms.

**Frontmatter dialect:** Use the agentskills.io superset (name, description, license, compatibility, metadata). Unknown fields are ignored by Pi, Codex, and OpenCode. Claude Code reads the full set. No provider-conditional blocks needed in skill bodies; skill bodies should be platform-neutral (superpowers achieves this for 7 platforms from one file).

**Evidence strength:** Codebase (superpowers `skills/` dir, Paseo `packages/desktop/src/integrations/skills/sync.ts:161-181` copies identical skill files to `.agents/`, `.claude/`, `.codex/`). Web (Pi docs: "Convention auto-discovery: a literal `skills/` dir is scanned").

---

## Sub-question B: Translation strategy per platform

### Options

**Option 1: No transformation, single tree consumed via compat paths**

The canonical `skills/` dir is the only skill source. Each platform discovers skills from its own path. No build step. Platform-specific files are thin manifests only.

Evidence: superpowers uses exactly this approach. Same `skills/` dir works for Claude Code (via `.claude-plugin/`), Codex (via `.codex-plugin/plugin.json` with `"skills": "./skills/"`), OpenCode (via `.opencode/plugins/superpowers.js` which registers the skills path), Gemini (via `gemini-extension.json` + `GEMINI.md`), Cursor (via `.cursor-plugin/plugin.json`), and Factory Droid / GitHub Copilot CLI.

**Option 2: Build-time generator producing dist/ packages (impeccable model)**

Transform source to per-provider output with frontmatter stripping, provider-tag compilation, placeholder replacement, and agent format conversion.

Evidence: impeccable's `scripts/lib/transformers/factory.js` implements this for 14 providers. Each provider config specifies `frontmatterFields`, `providerTags`, `agentFormat`, `bodyTransform`.

**Option 3: Handwritten per-platform packages**

Separate skill files maintained per platform. No shared source.

No evidence of anyone doing this at scale. All reference repos use a single source.

### Recommendation: Option 1 (no transformation)

YAGNI Gate 1 (evidence test): Do we have evidence that skill content needs per-platform transformation? No. Superpowers ships identical skill content to 7 platforms. Pi, Codex, and OpenCode all ignore unknown frontmatter fields. The only real difference is agent format, which is a separate concern (sub-question C).

YAGNI Gate 2 (simpler version test): Is there a simpler version than build-time transformation? Yes: no transformation at all. Single `skills/` dir, platform-specific discovery. This satisfies the same evidence.

The build-time generator is YAGNI. The evidence comes from:
- Superpowers: identical skills across 7 platforms (`forks/superpowers/skills/`)
- Paseo: copies identical skill files to `.agents/`, `.claude/`, `.codex/` (`forks/paseo/packages/desktop/src/integrations/skills/sync.ts:161-181`)
- Impeccable: its `.agents/skills/` output uses minimal frontmatter (name + description only), which is the common denominator all platforms accept

---

## Sub-question C: Agent-persona dispatch per platform

### Platform capabilities

| Platform | Subagent support | Dispatch mechanism | Agent file format |
|----------|-----------------|-------------------|-------------------|
| Claude Code | Yes | `Agent` tool, `subagent_type: "plugin:agent-name"` | `.md` with frontmatter (name, description, tools, model) |
| Codex | Yes | TOML files in `~/.codex/agents/` or nested in skill `agents/` dir | TOML (name, description, developer_instructions, model) |
| OpenCode | Yes | `@mention` or Task tool | `.md` with frontmatter (description, mode: subagent, model, permission) |
| Pi | No native subagent concept | N/A | No file format; persona inline or sequential passes |
| Paseo | Yes (via `create_agent` API) | `create_agent` with provider param | N/A (Paseo handles at runtime) |

Evidence: platform-packaging-notes.md (web trust class). Superpowers: dispatches subagents via inline prompt templates (`.md` files referenced from skill body), not separate agent persona files (`forks/superpowers/skills/subagent-driven-development/SKILL.md:124-126`).

### Options

**Option 1: One agent format, platform-specific rendering at install**

Ship agents in one canonical format (Claude .md). At install time, render to platform-specific format:
- Claude Code: copy as-is
- OpenCode: remap frontmatter (add `mode: subagent`)
- Codex: convert to TOML
- Pi: embed persona text inline into skill body as a reference section

**Option 2: Ship both formats in the repo**

Keep `agents/` in Claude format AND a `codex-agents/` or `dist/codex/agents/` with TOML versions. OpenCode format is close enough to Claude that it can use the Claude files directly (OpenCode reads `.agents/skills/` and `.opencode/agents/`).

**Option 3: No separate agent files; inline persona in skill body (superpowers model)**

Skills reference their agent personas by reading a reference file and applying the persona lens inline. No separate agent dispatch needed. The skill body contains or references the persona instructions.

Evidence: superpowers does this. `subagent-driven-development/SKILL.md` references `./implementer-prompt.md`, `./spec-reviewer-prompt.md`, `./code-quality-reviewer-prompt.md` as inline prompt templates, not as dispatched agent files. The skill body itself carries the dispatch logic.

### Recommendation: Option 2 (ship both formats) for v1, with Option 3 as the long-term direction

Rationale: BooSkills' agent personas are rich (12 personas with E#/V# finding schemas, file:line citation formats, domain-specific postures). These are not simple prompt templates; they are substantial system prompts that the skill dispatches as subagents. Inlining them into every skill that uses them would bloat skill bodies and violate the 500-line cap.

**Concrete structure:**
- `agents/*.md` in Claude format (name, description, tools, model in frontmatter; body = system prompt)
- `agents/codex/*.toml` in Codex format (same content, TOML wrapper)
- OpenCode: read the Claude `.md` files from `.agents/` path (OpenCode reads agent-compatible `.agents/skills/` path, and `.opencode/agents/` with `mode: subagent` frontmatter)
- Pi: no separate files; skill body references the persona by name and describes the lens to apply ("apply the adversarial-security-analyst lens, reading the persona in references/agents/adversarial-security-analyst.md")

**Degradation strategy:**
- Pi: skill body includes a "Persona fallback" section that describes what the agent would do if subagents were available. The skill runs sequentially, applying each persona lens in turn. This is documented in the skill's "Gotchas" section.
- Codex: agent TOML files ship nested in the skill's own `agents/` dir, which Codex auto-discovers on install (impeccable pattern: `forks/impeccable/scripts/lib/transformers/factory.js:273-281`).

**Evidence:** impeccable ships Codex agents nested in skill `agents/` dirs (`factory.js:56` - `CODEX_SKILL_PROVIDERS`). Paseo's Codex agent provider reads skills from `~/.codex/skills/` (`forks/paseo/packages/server/src/server/agent/providers/codex-app-server-agent.ts:676-677`). Superpowers uses inline prompt templates for subagents, not separate agent files.

---

## Sub-question D: Distribution/install mechanism

### Options

**Option 1: skills.sh CLI + Claude Code marketplace (hybrid)**

- `npx skills add owner/booskills` for Pi, Codex, OpenCode (skills.sh handles platform selection and file copy)
- Claude Code marketplace install via `.claude-plugin/marketplace.json`
- Paseo desktop app syncs from `~/.agents/skills/` to `.claude/` and `.codex/`

Evidence: mattpocock/skills uses `npx skills add mattpocock/skills` for distribution (`forks/skills/README.md:27-28`). Paseo docs: "Manual: `npx skills add getpaseo/paseo`, this installs to `~/.agents/skills/` and sets up symlinks for each agent" (`forks/paseo/public-docs/skills.md:17`). Paseo desktop app syncs to three locations (`forks/paseo/packages/desktop/src/integrations/skills/sync.ts:157-191`).

**Option 2: Git submodule / direct clone (superpowers model)**

Users clone or submodule the repo. Platform-specific manifests at root are discovered natively. No CLI needed.

Evidence: superpowers installs via plugin marketplace (Claude, Codex, Cursor), `gemini extensions install` (Gemini), `opencode.json` plugin spec (OpenCode), `droid plugin install` (Factory Droid). No skills.sh involvement.

**Option 3: npm package (Pi-native model)**

Ship as npm package with `"keywords": ["pi-package"]`. Pi discovers skills from `skills/` dir in the package.

Evidence: Pi docs: "Distribution unit = Pi package: package.json with keywords: ["pi-package"]" (platform-packaging-notes.md:17). But Pi also reads `~/.agents/skills/`, so this is not the only path.

### Recommendation: Option 1 (skills.sh + Claude marketplace)

This is the simplest distribution that covers all four targets:

1. **Claude Code marketplace:** `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json` at repo root. Install: `/plugin marketplace add owner/booskills` then `/plugin install booskills@marketplace`.

2. **Pi, Codex, OpenCode via skills.sh:** `npx skills add owner/booskills`. The skills.sh CLI lets users pick which skills and which platforms. It copies skills to the right directories (`.agents/skills/`, `.claude/skills/`, etc.).

3. **Paseo:** Desktop app auto-syncs from `~/.agents/skills/` (populated by skills.sh or manual install). No Paseo-specific packaging needed.

4. **Agent persona installation:** Handled by a small install script that:
   - Copies Claude `.md` agents to `.claude/agents/` (for Claude Code)
   - Copies Codex `.toml` agents to `.codex/agents/` (for Codex)
   - Copies OpenCode `.md` agents to `.opencode/agents/` (for OpenCode)
   - For Pi: embeds persona text into skill body or references from skill body

This is simpler than Option 2 (superpowers model) because it uses the skills.sh distribution channel that Pi and Paseo already support. It is simpler than Option 3 (npm) because it doesn't require maintaining package.json for non-JS skills.

**Evidence:** Paseo's install path is `npx skills add getpaseo/paseo` which installs to `~/.agents/skills/` (`forks/paseo/public-docs/skills.md:17`). The skills.sh CLI handles platform selection and file copy for Pi, Codex, OpenCode (`forks/skills/README.md:27-28`). Claude Code marketplace is the proven distribution channel for plugin-based skills (superpowers, han, impeccable all use it).

---

## Claims table

| Claim | Source | Trust class | Corroboration |
|-------|--------|-------------|---------------|
| Pi reads `~/.agents/skills/` and `.agents/skills/` | platform-packaging-notes.md (from pi.dev/docs) | Web | Single-source; Pi docs page not re-fetched in this pass |
| Codex reads `$CWD/.agents/skills` and `~/.agents/skills` | platform-packaging-notes.md (from developers.openai.com) | Web | Single-source; Codex docs page not re-fetched in this pass |
| OpenCode reads `.agents/skills/` path | platform-packaging-notes.md (from opencode.ai/docs) | Web | Single-source; OpenCode docs page not re-fetched in this pass |
| Codex plugins cannot ship agents | platform-packaging-notes.md:27 | Web | Corroborated by impeccable: Codex agents ship nested in skill `agents/` dir, not via plugin manifest (`factory.js:273-281`) |
| Paseo syncs to `.agents/`, `.claude/`, `.codex/` | `forks/paseo/packages/desktop/src/integrations/skills/sync.ts:157-191` | Codebase | Direct file read |
| Paseo install is `npx skills add getpaseo/paseo` | `forks/paseo/public-docs/skills.md:17` | Codebase | Direct file read |
| Superpowers ships one skills dir to 7 platforms | `forks/superpowers/skills/` dir + README.md install sections | Codebase | Direct file read; 7 platforms listed in README |
| Superpowers has no build step for skills | `forks/superpowers/package.json` (no build script), no `scripts/build.js` | Codebase | Direct file read |
| Superpowers dispatches subagents via inline prompt templates | `forks/superpowers/skills/subagent-driven-development/SKILL.md:124-126` | Codebase | Direct file read |
| Impeccable generates per-provider output from single source | `forks/impeccable/scripts/build.js`, `scripts/lib/transformers/factory.js` | Codebase | Direct file read |
| Impeccable ships Codex agents nested in skill dirs | `forks/impeccable/scripts/lib/transformers/factory.js:56,273-281` | Codebase | Direct file read |
| skills.sh CLI installs to multiple platforms | `forks/skills/README.md:27-33` | Codebase | Direct file read |
| Paseo uses no Paseo-specific SKILL.md dialect | `forks/paseo/skills/paseo/SKILL.md` - standard agentskills.io format | Codebase | Direct file read |
| Han uses meta-plugin with marketplace.json | `forks/han/.claude-plugin/marketplace.json`, `forks/han/han.core/.claude-plugin/plugin.json` | Codebase | Direct file read |
| Codex TOML agent format | platform-packaging-notes.md:27 | Web | Single-source; not re-fetched |

---

## No evidence yet

### skills.sh CLI source code
**Why no evidence:** The skills.sh CLI (`npx skills add`) is referenced by mattpocock/skills and Paseo docs, but the CLI source code is not available in the forks. We cannot verify exactly what platforms it supports, how it handles agent files, or what repo layout it expects beyond `skills/` with SKILL.md files.
**Reopen when:** skills.sh CLI source is available, or we test `npx skills add` against a test repo to observe actual behavior.

### Codex official plugin marketplace
**Why no evidence:** platform-packaging-notes.md states "Public directory 'coming soon'" for Codex plugin distribution. The official marketplace may change. Superpowers ships to Codex via the official marketplace, suggesting it works now.
**Reopen when:** Codex public plugin directory ships or distribution model changes.

### OpenCode agent frontmatter compatibility with Claude .md format
**RESOLVED 2026-06-11 (codebase evidence):** OpenCode does NOT tolerate Claude-format agent frontmatter. Session creation fails outright (Unexpected server error) when ~/.config/opencode/agents/ contains files with comma-string tools or bare model names. Verified by A/B test during v1 implementation. Fix shipped: agents/opencode/ rendering with description + mode: subagent only; installer links from there. See openspec/changes/booskills-v1-catalog/design.md Implementation notes.

### Pi persona-as-reference-file behavior
**Why no evidence:** Pi docs mention "persona-as-reference-file read inline" as an option for subagent-less platforms. We have not tested whether Pi agents actually load and follow reference files referenced from skill bodies.
**Reopen when:** Test Pi skill that references `references/agents/<name>.md` to verify the agent reads and applies the persona.

---

## Deferred (YAGNI)

### Build-time skill transformer
**Why deferred:** Gate 1 (evidence test) fails. No evidence that skill content needs per-platform transformation. Superpowers ships identical content to 7 platforms. Pi, Codex, and OpenCode ignore unknown frontmatter fields. The only platform-specific concern is agent format, which is a separate, smaller problem.
**Reopen when:** A platform requires different skill body content (not just frontmatter stripping) to function. Or when the catalog exceeds 25 skills and manual frontmatter management becomes a maintenance burden.

### skills.sh CLI integration for agent persona distribution
**Why deferred:** Gate 1 passes (skills.sh is the distribution channel for Pi/Codex/OpenCode). Gate 2 (simpler version) fails: a simple installer script that copies agent files to the right directories is simpler than integrating with skills.sh's agent handling, which we haven't verified.
**Reopen when:** skills.sh adds explicit agent/persona support, or when we have evidence that skills.sh copies agent files from the repo.

### OpenCode JS plugin (like superpowers' superpowers.js)
**Why deferred:** Gate 1 fails for initial ship. OpenCode discovers skills from `.agents/skills/` natively. The JS plugin is only needed for bootstrap injection (session-start context), which BooSkills doesn't require for v1.
**Reopen when:** We need to inject bootstrap context at session start on OpenCode, or when OpenCode's native skill discovery has issues with our layout.

### Per-platform plugin manifests beyond Claude Code
**Why deferred:** Gate 2 (simpler version) applies. Pi uses npm/git install, not a marketplace. Codex uses `.codex-plugin/` but also discovers `.agents/skills/` natively. OpenCode has no plugin channel for skills. The only marketplace that requires a manifest is Claude Code.
**Reopen when:** Pi or Codex launches a plugin marketplace that requires manifest registration.

### Bucket folder organization for skills
**Why deferred:** Gate 1 fails. 10 skills fits cleanly in a flat `skills/` dir. Bucket folders (engineering/, productivity/) add navigational overhead without benefit at this scale.
**Reopen when:** The catalog exceeds 25 skills and navigational grouping becomes necessary.

---

## Claims I did not verify

- The exact skills.sh CLI behavior when encountering agent `.md` files in a repo (whether it copies them, ignores them, or routes them to platform-specific agent dirs)
- Whether Pi's `skills/` auto-discovery works identically to `~/.agents/skills/` discovery (the docs imply both work but we haven't tested parity)
- Whether OpenCode's `.opencode/agents/` path is strictly required or whether `.agents/` agent files are also discovered
- The exact Codex marketplace install flow (the docs say "coming soon" for public directory; superpowers apparently uses it, suggesting it works for approved plugins)
- Whether `npx skills add` supports picking individual skills from a repo or only installs all skills
- The exact frontmatter fields Pi ignores vs. errors on (e.g., does `allowed-tools` cause a parse error or is it silently dropped?)
