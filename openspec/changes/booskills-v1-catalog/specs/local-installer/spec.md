## ADDED Requirements

### Requirement: Installer script existence and runnability
A shell script SHALL exist at scripts/install.sh. It SHALL be executable (chmod +x) and SHALL accept no required arguments. It MAY accept an optional --copy flag to force copy mode instead of symlink mode.

#### Scenario: Script exists and is executable
- **WHEN** checking scripts/install.sh
- **THEN** the file exists, is a shell script, and has executable permission

#### Scenario: Script runs without errors
- **WHEN** executing `scripts/install.sh` on a machine where the target directories exist or can be created
- **THEN** the script exits with code 0 and produces no error output

### Requirement: Per-skill symlinks to ~/.agents/skills/
The installer script SHALL create one symlink per skill at ~/.agents/skills/<skill-name> pointing to /home/samkintop/opt/booskills/skills/<skill-name>/. Platforms that auto-scan .agents/skills/ (Pi, Codex, OpenCode) discover <name>/SKILL.md exactly one level deep, so a parent wrapper directory is invisible to them (see research/investigation-skill-discovery.md). The installer SHALL remove the legacy v1.0.0 parent symlink ~/.agents/skills/booskills when it points into this repo. If a per-skill link already exists and points to the correct target, the script SHALL skip it silently. If a name exists and does not resolve into this repo, the script SHALL report the collision and continue with the remaining skills, exiting non-zero at the end.

If the platform rejects symlinks at this path, the script SHALL fall back to copying the skills/ directory contents. The script SHALL NOT use `npx skills add` or any remote package manager.

#### Scenario: Skills symlink created
- **WHEN** running scripts/install.sh on a fresh machine with no existing ~/.agents/skills entries for these skills
- **THEN** one symlink exists per skill at ~/.agents/skills/<skill-name> pointing to /home/samkintop/opt/booskills/skills/<skill-name>/

#### Scenario: Existing correct symlink skipped
- **WHEN** running scripts/install.sh where the per-skill links already point to the correct targets
- **THEN** the script skips that entry silently and continues

#### Scenario: Conflicting symlink reported
- **WHEN** running scripts/install.sh where a skill name exists at ~/.agents/skills/ and does not resolve into this repo
- **THEN** the script reports the conflict and exits with a non-zero code

#### Scenario: No npx skills add
- **WHEN** scanning scripts/install.sh for the string "npx skills add"
- **THEN** it does not appear

### Requirement: Codex agent TOMLs symlink to ~/.codex/agents/
The installer script SHALL create symlinks for each agents/codex/*.toml file at ~/.codex/agents/<name>.toml pointing to /home/samkintop/opt/booskills/agents/codex/<name>.toml. If ~/.codex/agents/ does not exist, the script SHALL create it. If a symlink already exists pointing to the correct target, the script SHALL skip it silently. If a .toml file with the same name exists but is not a symlink, the script SHALL report a conflict and exit with a non-zero code.

#### Scenario: Codex agent symlinks created
- **WHEN** running scripts/install.sh
- **THEN** symlinks exist at ~/.codex/agents/adversarial-security-analyst.toml (and each of the other 11 agents) pointing to the corresponding file in the repo

#### Scenario: Target directory created if missing
- **WHEN** running scripts/install.sh and ~/.codex/agents/ does not exist
- **THEN** the script creates the directory before symlinking

### Requirement: OpenCode agent files symlink to ~/.config/opencode/agents/
The installer script SHALL create symlinks for each agents/*.md file at ~/.config/opencode/agents/<name>.md pointing to /home/samkintop/opt/booskills/agents/<name>.md. If ~/.config/opencode/agents/ does not exist, the script SHALL create it. If a symlink already exists pointing to the correct target, the script SHALL skip. If a .md file with the same name exists but is not a symlink, the script SHALL report a conflict.

#### Scenario: OpenCode agent symlinks created
- **WHEN** running scripts/install.sh
- **THEN** symlinks exist at ~/.config/opencode/agents/adversarial-security-analyst.md (and each other agent) pointing to the corresponding file in the repo

### Requirement: Installation verification step
The installer script SHALL verify each created symlink or copy after creation by checking that the target resolves and the file is readable. If any verification fails, the script SHALL report which paths failed and exit with a non-zero code. On success, the script SHALL print a summary of all created links/copies.

#### Scenario: Verification reports success
- **WHEN** running scripts/install.sh successfully
- **THEN** the output includes a summary listing each symlink created and its target

#### Scenario: Verification detects broken link
- **WHEN** a symlink created by the script points to a target that does not resolve
- **THEN** the script reports the broken link and exits with a non-zero code

### Requirement: Claude Code local install path
The installer script SHALL NOT install skills or agents into .claude/ directories. Claude Code plugin registration is handled separately via .claude-plugin/marketplace.json and `claude plugin marketplace add /home/samkintop/opt/booskills`, which is the documented Claude Code plugin mechanism. The installer script MAY print an informational note about this step.

#### Scenario: No .claude/ writes from installer
- **WHEN** scanning scripts/install.sh for paths containing ".claude/"
- **THEN** no write operations target .claude/ directories (informational notes about the separate step are allowed)