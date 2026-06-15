#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COPY_MODE=false

if [ "${1:-}" = "--copy" ]; then
    COPY_MODE=true
fi

SKILLS_DIR="$HOME/.agents/skills"
CODEX_DIR="$HOME/.codex/agents"
OPENCODE_DIR="$HOME/.config/opencode/agents"

CREATED=()
SKIPPED=()
FAILED=()

create_link() {
    local target="$1"
    local link_path="$2"
    local label="$3"

    if [ -L "$link_path" ]; then
        local current_target
        current_target="$(readlink "$link_path")"
        if [ "$current_target" = "$target" ]; then
            SKIPPED+=("$label (already linked correctly)")
            return 0
        else
            echo "ERROR: $link_path exists and points to $current_target, not $target"
            exit 1
        fi
    elif [ -e "$link_path" ]; then
        echo "ERROR: $link_path exists and is not a symlink. Remove it manually and re-run."
        exit 1
    fi

    mkdir -p "$(dirname "$link_path")"

    if [ "$COPY_MODE" = true ]; then
        cp -r "$target" "$link_path" 2>/dev/null || {
            FAILED+=("$label (copy failed)")
            return 1
        }
    else
        ln -s "$target" "$link_path" 2>/dev/null || {
            echo "WARNING: Symlink failed for $link_path, falling back to copy"
            cp -r "$target" "$link_path" 2>/dev/null || {
                FAILED+=("$label (link+copy failed)")
                return 1
            }
        }
    fi

    if [ -e "$link_path" ]; then
        CREATED+=("$label -> $target")
    else
        FAILED+=("$label (could not verify)")
    fi
}

# Skills: one symlink per skill, flat at ~/.agents/skills/<skill-name>.
# Platforms that auto-scan this directory (OpenCode, Pi, Codex) discover
# <name>/SKILL.md exactly one level deep; a parent wrapper dir is invisible
# to them. See research/investigation-skill-discovery.md.
echo "--- Installing skills ---"

# Upgrade path: remove the legacy parent symlink from the v1.0.0 layout.
LEGACY_PARENT="$SKILLS_DIR/booskills"
if [ -L "$LEGACY_PARENT" ] && [ "$(readlink "$LEGACY_PARENT")" = "$REPO_DIR/skills" ]; then
    rm "$LEGACY_PARENT"
    echo "  [UPGRADE] removed legacy parent symlink $LEGACY_PARENT"
fi

for skill_md in "$REPO_DIR/skills/"*/SKILL.md; do
    skill_dir="$(dirname "$skill_md")"
    name="$(basename "$skill_dir")"
    # Collision policy: skip-and-report when the name exists and is not ours.
    if [ -e "$SKILLS_DIR/$name" ] || [ -L "$SKILLS_DIR/$name" ]; then
        if [ "$(readlink -f "$SKILLS_DIR/$name" 2>/dev/null)" != "$skill_dir" ]; then
            FAILED+=("skill:$name (collision: $SKILLS_DIR/$name exists and is not from this repo)")
            continue
        fi
    fi
    create_link "$skill_dir" "$SKILLS_DIR/$name" "skill:$name"
    # Codex: both the codex CLI and Paseo's codex fallback scan ~/.codex/skills
    # (Paseo's fallback does NOT scan ~/.agents/skills), so link there too.
    if [ -e "$HOME/.codex/skills/$name" ] || [ -L "$HOME/.codex/skills/$name" ]; then
        if [ "$(readlink -f "$HOME/.codex/skills/$name" 2>/dev/null)" != "$skill_dir" ]; then
            FAILED+=("codex-skill:$name (collision: ~/.codex/skills/$name exists and is not from this repo)")
            continue
        fi
    fi
    create_link "$skill_dir" "$HOME/.codex/skills/$name" "codex-skill:$name"
done

# Model router: stable CLI path for the boo-router skill and the grade presets.
# The skill also bundles scripts/router.mjs as a symlink, but a fixed path under
# ~/.paseo/bin matches paseo-preset / apply-agent-models and is callable directly.
echo "--- Installing model router ---"
create_link "$REPO_DIR/model-router/router.mjs" "$HOME/.paseo/bin/model-router" "model-router"

# Codex agent TOMLs
echo "--- Installing Codex agents ---"
for toml in "$REPO_DIR/agents/codex/"*.toml; do
    name="$(basename "$toml")"
    create_link "$toml" "$CODEX_DIR/$name" "codex:$name"
done

# OpenCode agent .md files
# OpenCode rejects Claude-format agent frontmatter (comma-string tools, bare
# model names) at session creation, so it gets its own rendering. The files
# are GENERATED (not symlinked) because the per-agent model line comes from
# the active Paseo preset's "agents" map; re-run apply-agent-models.sh (or
# switch presets) to refresh them.
echo "--- Installing OpenCode agents ---"
bash "$REPO_DIR/scripts/apply-agent-models.sh"

echo ""
echo "=== Installation Summary ==="
echo "Created: ${#CREATED[@]}"
echo "Skipped: ${#SKIPPED[@]}"
echo "Failed:  ${#FAILED[@]}"
echo ""

for item in "${CREATED[@]}"; do
    echo "  [OK] $item"
done
for item in "${SKIPPED[@]}"; do
    echo "  [SKIP] $item"
done
for item in "${FAILED[@]}"; do
    echo "  [FAIL] $item"
done

echo ""
echo "Claude Code: register this plugin manually with:"
echo "  claude plugin marketplace add $REPO_DIR"

if [ "${#FAILED[@]}" -gt 0 ]; then
    exit 1
fi
