#!/usr/bin/env bash
# Render per-agent model assignments from the active Paseo orchestration
# preset into the installed OpenCode agent files.
#
# Source of truth: the "agents" map in ~/.paseo/orchestration-preferences.json
# (agent-name -> provider/model id, e.g. "deepseek/deepseek-v4-flash").
# Canonical personas: <repo>/agents/opencode/<name>.md (no model field).
# Output: ~/.config/opencode/agents/<name>.md as a GENERATED COPY with a
# model: line inserted. Generated copies replace the install symlinks on
# purpose: the model line is preset-specific state, not repo content.
# Agents absent from the map get no model line (inherit the session model).
#
# The forbidden-model guard is derived from the model registry's neverSubagent
# tiers (~/.paseo/model-tiers.json), so adding an S-tier model there protects it
# here automatically. No model name is hardcoded except a conservative fallback
# used only when the registry cannot be read.
#
# Invoked by scripts/install.sh and by ~/.paseo/bin/paseo-preset after a
# preset switch. Idempotent.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ACTIVE="$HOME/.paseo/orchestration-preferences.json"
REGISTRY="${MODEL_TIERS:-$HOME/.paseo/model-tiers.json}"
OUT_DIR="$HOME/.config/opencode/agents"

python3 - "$REPO_DIR" "$ACTIVE" "$OUT_DIR" "$REGISTRY" <<'PYEOF'
import json, os, sys, glob

repo, active, out_dir, registry = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]


def fail(msg):
    print(f"REFUSED: {msg}", file=sys.stderr)
    sys.exit(1)


def model_key(model_id):
    """Last path segment, lowercased: 'openrouter/xiaomi/mimo-v2.5' -> 'mimo-v2.5'."""
    return str(model_id).strip().split("/")[-1].lower()


# Forbidden subagent models: derive from any registry tier flagged neverSubagent.
# Exact-key match (not regex) so allowed siblings like gpt-5.4 are never caught.
FALLBACK_FORBIDDEN = {"opus", "fable", "gpt-5", "gpt-5.5"}
forbidden = set(FALLBACK_FORBIDDEN)
known_models = set()
try:
    reg = json.load(open(registry))
    derived = set()
    for value in reg.values():
        if isinstance(value, dict) and value.get("neverSubagent") and isinstance(value.get("models"), list):
            derived.update(model_key(m) for m in value["models"])
    if derived:
        forbidden = derived
    for section in ("attributes", "pricing"):
        if isinstance(reg.get(section), dict):
            known_models.update(k for k in reg[section] if not k.startswith("_"))
except Exception as e:
    print(f"WARNING: could not read registry {registry}: {e}; using fallback guard {sorted(forbidden)}")

# Load the agents map from the active preset.
agents_map = {}
if os.path.exists(active):
    try:
        agents_map = json.load(open(active)).get("agents", {}) or {}
    except Exception as e:
        print(f"WARNING: could not parse {active}: {e}; agents inherit session model")

# Guard: refuse any mapped model whose key is forbidden.
bad = {a: m for a, m in agents_map.items() if model_key(m) in forbidden}
if bad:
    fail(f"subscription-high models can never be subagents: {bad}")

# Same guard for repo canonical Claude personas (agents/*.md model: lines).
for f in glob.glob(os.path.join(repo, "agents/*.md")):
    for line in open(f):
        if line.startswith("model:"):
            if model_key(line.split(":", 1)[1]) in forbidden:
                fail(f"{f} pins a subscription-high model as a subagent: {line.strip()}")
            break

# Discover the persona files we can actually render.
persona_paths = sorted(glob.glob(os.path.join(repo, "agents/opencode/*.md")))
persona_names = {os.path.basename(p)[:-3] for p in persona_paths}

# Warn on map entries that will silently do nothing or point at unknown models.
for name, model in agents_map.items():
    if name not in persona_names:
        print(f"WARNING: agents map names '{name}' but no persona agents/opencode/{name}.md exists (typo?)")
    if known_models and model_key(model) not in known_models:
        print(f"WARNING: '{name}' -> '{model}' is not a known model in the registry (typo?)")


def inject_model(text, model):
    """Insert a model: line into YAML frontmatter, replacing any existing one.
    Returns text unchanged if the file has no '---' frontmatter block."""
    import re
    # Strip newlines to prevent YAML frontmatter injection via multi-line model IDs.
    model = model.replace("\n", "").replace("\r", "")
    if not re.match(r'^[\w./:@=-]+$', model):
        raise ValueError(f"model value contains invalid characters: {model!r}")
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    _, fm, body = parts
    fm_lines = [ln for ln in fm.splitlines() if not ln.strip().startswith("model:")]
    fm_clean = "\n".join(fm_lines).strip("\n")
    return f"---\n{fm_clean}\nmodel: {model}\n---{body}"


os.makedirs(out_dir, exist_ok=True)
written = 0
skipped = 0
for src in persona_paths:
    name = os.path.basename(src)[:-3]
    text = open(src).read()
    model = agents_map.get(name)
    if model:
        injected = inject_model(text, model)
        if injected is None:
            print(f"WARNING: {src} has no parseable frontmatter; rendered without model line")
            skipped += 1
        else:
            text = injected
    dest = os.path.join(out_dir, name + ".md")
    if os.path.islink(dest):
        os.remove(dest)  # replace install symlink with generated copy
    prev = open(dest).read() if os.path.exists(dest) else None
    if prev != text:
        open(dest, "w").write(text)
        written += 1

print(f"opencode agents rendered: {written} updated, "
      f"{len(agents_map)} with explicit model, "
      f"{len(persona_names)} personas, guard={sorted(forbidden)}"
      + (f", {skipped} unparseable" if skipped else ""))
PYEOF
