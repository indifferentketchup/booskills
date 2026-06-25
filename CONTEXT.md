# Context Map: BooSkills

## Structure

```
booskills/
├── skills/                    # 16 skill SKILL.md files (the catalog)
│   ├── boo-analyzing-architecture/
│   ├── boo-auditing-code-quality/
│   ├── boo-building-ui/       # references/design-guidance.md symlinks to critiquing-frontend's
│   ├── boo-critiquing-frontend/
│   ├── boo-implementing-changes/
│   ├── boo-investigating-failures/
│   ├── boo-mapping-project-context/
│   ├── boo-meta/              # goal-to-pipeline router across the catalog
│   ├── boo-planning-changes/
│   ├── boo-refactoring-code/
│   ├── boo-refining-ideas/
│   ├── boo-researching/
│   ├── boo-reviewing-code/
│   ├── boo-router/            # wraps model-router/router.mjs; picks one provider per dispatch (L/C/B/A/S presets)
│   ├── boo-validating-changes/ # fresh-context plan + implementation validation for OpenSpec changes
│   └── paseo-boo/
├── agents/                    # 12 agent personas (canonical)
│   ├── adversarial-security-analyst.md
│   ├── adversarial-validator.md
│   ├── behavioral-analyst.md
│   ├── concurrency-analyst.md
│   ├── edge-case-explorer.md
│   ├── evidence-based-investigator.md
│   ├── junior-developer.md
│   ├── risk-analyst.md
│   ├── software-architect.md
│   ├── structural-analyst.md
│   ├── test-engineer.md
│   ├── user-experience-designer.md
│   ├── codex/                 # Codex TOML renderings (12 files)
│   └── opencode/              # OpenCode .md renderings (12 files)
├── openspec/                  # OpenSpec change workflow
│   ├── config.yaml
│   ├── specs/                 # (empty)
│   └── changes/
│       ├── booskills-v1-catalog/   # Active change folder
│       └── archive/                # (empty)
├── scripts/
│   ├── install.sh             # Symlink/copy installer for skills + agents
│   ├── apply-agent-models.sh  # Applies model assignments to agent renderings
│   └── stamp-standing-rules.sh # Syncs STANDING_RULES.md blocks into every skill's Gotchas
├── evals/                     # Trigger evals: <skill>.json labeled queries + README protocol
├── model-router/              # Deterministic model selector (router.mjs + README); wrapped by skills/boo-router
├── docs/adr/                  # Architecture decision records (0001 = deterministic router)
├── README.md                   # Entry-point documentation
├── research/
│   ├── booskills-structure-research.md
│   ├── platform-packaging-notes.md
│   └── architecture-analysis-report.md  # Complexity verdict + risk assessments
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .opencode/
│   ├── package.json           # @opencode-ai/plugin dependency
│   └── skills/                # Symlinked copies of skills/ (opencode rendering)
├── .claude/
│   ├── commands/opsx/         # /opsx: slash commands (apply, archive, explore, propose, sync)
│   └── skills/                # Symlinked copies of skills/ (claude rendering)
├── SKILL_CATALOG_SPEC.md      # Build spec: what each skill contains (plus post-v1 additions)
├── SKILL_GUIDELINES.md        # Format/convention canon
├── STANDING_RULES.md          # Canonical standing-rules blocks, stamped into all skills
└── forks/                     # Vendored reference (gitignored, not mapped)
```

## Services / Ports

No services. BooSkills is a local agent-skill catalog, not a running application. There are no ports, servers, or network entry points. Skills are consumed by agent platforms (Claude Code, Pi, Codex, OpenCode, Paseo) that read SKILL.md files and dispatch the listed agents.

Distribution entry point: `scripts/install.sh` symlinks `skills/` to `~/.agents/skills/booskills/`, agent TOMLs to `~/.codex/agents/`, and agent .md files to `~/.config/opencode/agents/`.

## Data Stores

None. All state lives on disk as files. The OpenSpec workflow uses folder-based artifact management (`openspec/changes/<id>/`).

## External Dependencies

- **Han (testdouble/han)**: upstream source for agent personas and skill mechanics. Vendored in `forks/` (gitignored). Not a runtime dependency.
- **OpenCode plugin SDK**: `@opencode-ai/plugin@1.16.2` in `.opencode/package.json`. Used for opencode skill registration.
- **Claude Code plugin system**: local-path install via `.claude-plugin/` manifests. No npm package or remote registry.
- **Platform targets**: Claude Code, Pi, Codex, OpenCode, Paseo. Skills are vendor-neutral; Paseo translates conventions per backend at dispatch.

## Conventions Observed

- **Skill structure**: every SKILL.md follows Section 10 skeleton from SKILL_GUIDELINES.md: frontmatter (name, description, metadata), Size, Process, What NOT to do, Gotchas, Output format, Claims I did not verify, Failure modes, Deferred (YAGNI).
- **Agent structure**: persona + domain + posture + output schema with E#/V# numbered findings and file:line citations. Each agent .md has YAML frontmatter with name, description, tools, model.
- **Naming**: skills use boo-prefixed gerund form (`boo-reviewing-code`, not `review-code`); `paseo-boo` is the router exception. Agents use role nouns (`structural-analyst`).
- **Evidence rule**: codebase citations (file:line) stand alone; web claims need corroboration or `single-source` flag; no-evidence is a named state.
- **No autonomous commits**: agents never git commit, never push. Edits proven with `git diff --stat`.
- **No em dashes**: forbidden in skill bodies and outputs.
- **Standing rules stamping**: the No commit / No em dashes / Pi degradation gotchas are duplicated in every skill on purpose (skills dispatch standalone); canonical source is `STANDING_RULES.md`, synced by `scripts/stamp-standing-rules.sh`. Never hand-edit a stamped block.
- **Trigger evals**: every skill has `evals/<skill-name>.json` with should-trigger queries and near-miss negatives; protocol in `evals/README.md`.
- **YAGNI gate**: every artifact item must pass evidence test + simpler-version test before shipping.
- **Sizing**: small/medium/large, default small, announced with one-line justification.
- **Multi-platform agents**: canonical .md in `agents/`, plus platform-specific renderings in `agents/codex/` (TOML) and `agents/opencode/` (.md with different frontmatter).

## Build / Deploy Commands

- **Install locally**: `bash scripts/install.sh` (symlinks preferred; `--copy` flag for copy mode)
- **Validate OpenSpec change**: `openspec validate <id>` (exact CLI surface TBD per installed version)
- **Git status**: active on `main` branch, tagged v0.2.0 (architecture analysis), pushed to `indifferentketchup/booskills`

## Doc Drift

1. **Resolved 2026-06-12**: `paseo-boo`, `boo-building-ui`, and `boo-refactoring-code` postdate the v1 spec; SKILL_CATALOG_SPEC.md now records them in a "Post-v1 additions" section.
2. **Top-level `openspec/specs/` is empty.** The change folder `booskills-v1-catalog/specs/` holds 4 spec files, but no main specs have been synced yet; expected state until the change is archived or synced.
3. **Presets restructured 2026-06-17**: grade-L renamed to grade-D, grade-F added (edge/embedding). All 12 presets now use array pools (zero pinned strings). workhorse-mid/premium/hybrid, credits-first, local-concurrent, mid, high removed. Router picks model by fit per dispatch. Canonical JSON lives in `presets/`; `scripts/generate-presets.py` regenerates them, `scripts/seed-presets.sh` installs to `~/.paseo/presets/`, `~/.paseo/bin/paseo-preset` switches the active file. **2026-06-26 Pi/OMP migration**: presets emit `provider/model` strings (no `opencode-go`); `bash scripts/seed-presets.sh` regenerates presets + `model-tiers.json`, installs `paseo-preset`/`omp-preset`; `paseo-preset` syncs OMP `modelRoles` and OpenCode agent models. **2026-06-25 grade tweak**: Mimo-V2.5-Pro and DeepSeek-V4-Pro demoted to grade-B; grade-B uses MiniMax-M3 (not M2.7).
