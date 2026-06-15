# Platform packaging notes (provided context for BooSkills research)

Trust class: **web** (digested from official docs on 2026-06-11) and **codebase** (forks/han, forks/impeccable read directly). Single-pass digests; spot-check load-bearing claims against the source URLs before they drive a recommendation.

Decision this feeds: how to structure the BooSkills repo (canonical source -> four platform packages) and how skills dispatch agents per platform.

## Claude Code (source: code.claude.com/docs/en/plugins, /en/skills; corroborated against forks/han, read directly)

- Plugin = `<plugin>/.claude-plugin/plugin.json` (`name`, `description`, `version`; manifest optional if default locations used) + component dirs at plugin root: `skills/<name>/SKILL.md`, `agents/<name>.md`, `hooks/hooks.json`, `.mcp.json`, `bin/`.
- Skill frontmatter (all optional): `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context: fork`, `agent`, `hooks`, `paths`, `shell`. Description + when_to_use truncated at 1,536 chars in listings. SKILL.md should stay under 500 lines.
- Agents: flat `.md` in `agents/`, frontmatter `name`, `description`, `tools` (supports `Bash(git *)` patterns), `model`; body = system prompt. Dispatched via Agent/Task tool as `plugin-name:agent-name`. Skills that dispatch need `Agent` in `allowed-tools`.
- Distribution: repo-root `.claude-plugin/marketplace.json` (`name`, `owner`, `plugins[]` with relative `source` paths); install `/plugin marketplace add owner/repo` then `/plugin install name@marketplace`. han is the proven multi-plugin monorepo example (meta-plugin via `dependencies`).
- Namespacing: `/plugin-name:skill-name`, `subagent_type: "plugin-name:agent-name"`.

## Pi (source: pi.dev/docs/latest/extensions, /skills)

- Distribution unit = "Pi package": `package.json` with `"keywords": ["pi-package"]` and optional `"pi": {"skills": ["./skills"], "extensions": [...], "prompts": [...], "themes": [...]}`. Convention auto-discovery: a literal `skills/` dir is scanned without the `pi` field. Skills-only catalog needs zero TypeScript; extensions are TS code (`export default function (pi: ExtensionAPI)`) and are NOT needed for skills.
- Skill frontmatter: required `name` (1-64 chars, `[a-z0-9-]`), `description` (<=1024 chars, skill not loaded without it); optional `license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation`. agentskills.io layout (`scripts/`, `references/`, `assets/`).
- **No subagent/persona concept.** Personas have no native home; options: persona-as-reference-file read inline, persona-as-prompt-template (`prompts/` dir), or custom TS extension spawning sub-sessions (undocumented primitive).
- Install: `npm:pkg`, `git:github.com/user/repo@ref`, or local path, written to `~/.pi/agent/settings.json` or `.pi/settings.json`.
- Skill discovery also reads `~/.agents/skills/` and `.agents/skills/`.

## Codex (source: developers.openai.com/codex/plugins/build, /codex/skills, /codex/subagents.md)

- Plugin = `.codex-plugin/plugin.json` (`name`, `version`, `description` required; `skills: "./skills/"` pointer; paths must start `./`). Skills layout same agentskills.io shape; frontmatter `name` + `description` only; optional per-skill `agents/openai.yaml` (interface/policy/dependencies).
- Skill selector budget: ~2% of context window or 8,000 chars; description is the trigger surface. Invoke via `$skill-name` or auto-match.
- **Subagents exist but are TOML files** in `~/.codex/agents/` or `.codex/agents/` (`name`, `description`, `developer_instructions`, optional `model`, etc.). **Plugins cannot ship agents** (manifest has no agents pointer). Shipping personas to Codex requires an install script writing TOML into `.codex/agents/`, or degrading to inline personas.
- Standalone skills also discovered at `$CWD/.agents/skills`, `~/.agents/skills`, `/etc/codex/skills`.
- Distribution: `marketplace.json` at `$REPO_ROOT/.agents/plugins/` or `~/.agents/plugins/`; `/plugins` command in CLI. Public directory "coming soon".

## OpenCode (source: opencode.ai/docs/plugins, /skills, /agents)

- "Plugins" are JS/TS hook modules only; **no plugin channel for skills or agents**. Skills are file-dropped: `.opencode/skills/<name>/SKILL.md`, `~/.config/opencode/skills/`, and **Claude-compatible paths** `.claude/skills/` + `~/.claude/skills/` are read natively. Agent-compatible `.agents/skills/` also read.
- Skill frontmatter recognized: `name` (must match dir), `description`, `license`, `compatibility`, `metadata` only; unknown fields ignored. Progressive disclosure via native `skill` tool.
- Agents: markdown in `.opencode/agents/` or `~/.config/opencode/agents/`; frontmatter `description` (required), `mode: subagent`, `model`, `permission`, `temperature`, `steps`, etc.; body = system prompt. Dispatched via `@mention` or Task tool. **No Claude-compatible path for agents**; no declarative skill->agent link; the skill body must name the agent to invoke.
- Distribution for skills/agents = file copy/symlink (installer script); npm only installs JS hook plugins via `opencode.json` `"plugin": [...]`.

## Cross-platform synthesis (working hypothesis, to be validated)

- Common denominator: agentskills.io SKILL.md (name + description) works everywhere. Claude Code is the superset target; Pi/Codex/OpenCode need frontmatter stripped to their recognized sets.
- Agents need 4 renderings: Claude plugin `agents/*.md` (native), OpenCode `agents/*.md` (frontmatter remap, `mode: subagent`), Codex TOML (out-of-band install), Pi (no native concept - inline persona referenced from skill body, sequential lens passes).
- Skill bodies must therefore phrase agent dispatch in a per-platform way, OR phrase it neutrally ("apply the <persona> lens, reading agents/<name>.md; dispatch as a subagent if the platform supports it").
- The `.agents/skills/` path is read by Pi, Codex, AND OpenCode - a possible single non-Claude install target for skills (not agents).

## Paseo (source: paseo.sh/docs/skills, fetched 2026-06-11; thin page, single-source)

- Paseo (the agent supervisor used locally) installs skills to `~/.agents/skills/` and symlinks them per coding agent (Claude Code, Codex named explicitly). Install via desktop app or `npx skills add <owner/repo>` (the skills.sh CLI).
- No Paseo-specific SKILL.md dialect documented; it rides the agentskills.io format and the shared `.agents/skills/` path. Treat Paseo as a fifth consumer reached through that path, not a fifth package format.
- The Paseo SOURCE repo is available locally at /opt/forks/paseo (codebase trust class): `skills/`, `docs/`, `public-docs/`, `packages/`. Read it directly to verify how Paseo discovers, symlinks, and injects skills per provider, and how its agents/subagents relate to skills. This supersedes the thin web page above.

## Additional reference repos in forks/ (codebase trust class, added 2026-06-11)

- `forks/skills` = mattpocock/skills. Distributed via skills.sh CLI (`npx skills add mattpocock/skills`): installer lets the user pick skills and which coding agents to install to. Prior art for the distribution mechanism Paseo recommends. Inspect its repo layout (`skills/` dir, scripts/) for what the skills.sh CLI expects of a publishable catalog.
- `forks/superpowers` = obra/superpowers. One skill set shipped to Claude Code, Codex CLI/App, Factory Droid, Gemini CLI, OpenCode, Cursor, GitHub Copilot CLI. The strongest prior art for cross-platform skill packaging; inspect how it structures per-platform install (note `gemini-extension.json`, `hooks/`, `.codex/`? etc.) and what it does about subagent-less platforms.
- `forks/OpenSpec` = Fission-AI/OpenSpec source (MIT, npm @fission-ai/openspec). Use to verify the exact CLI surface (`openspec validate`, change-folder schema) against code instead of docs; relevant to the planning-changes / implementing-changes skills.

## Local environment facts (codebase trust class, verified 2026-06-11)

- `openspec` CLI v1.4.1 installed at ~/.nvm/.../bin/openspec. `openspec/` does NOT exist yet in /home/samkintop/opt/booskills.
- `skills-ref` validator NOT installed (referenced by SKILL_GUIDELINES.md section 2).
- forks/impeccable: Apache-2.0 license; has `skill/` dir with SKILL.src.md, agents/, reference/, scripts/.
- forks/han: full testdouble/han monorepo, git stripped; han.core/agents/ holds 23 agent .md files; canonical YAGNI rule at han.core/references/yagni-rule.md; evidence rule at docs/evidence.md.
- /home/samkintop/opt/booskills is NOT a git repository.
