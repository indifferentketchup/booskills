#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PRESETS_DIR="${PASEO_PRESETS_DIR:-$HOME/.paseo/presets}"
BIN_DIR="$HOME/.paseo/bin"

echo "--- Generating presets ---"
python3 "$REPO_DIR/scripts/generate-presets.py"

echo "--- Generating model registry ---"
python3 "$REPO_DIR/scripts/generate-model-tiers.py"

echo "--- Installing presets to $PRESETS_DIR ---"
mkdir -p "$PRESETS_DIR"
cp "$REPO_DIR/presets"/*.json "$PRESETS_DIR/"

echo "--- Installing paseo-preset CLI ---"
mkdir -p "$BIN_DIR"
install -m 755 "$REPO_DIR/scripts/paseo-preset" "$BIN_DIR/paseo-preset"
install -m 755 "$REPO_DIR/scripts/omp-preset" "$BIN_DIR/omp-preset"

count="$(ls -1 "$PRESETS_DIR"/*.json | wc -l)"
echo "Installed $count presets."
