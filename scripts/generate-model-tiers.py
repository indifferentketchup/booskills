#!/usr/bin/env python3
"""Build Pi/OMP ~/.paseo/model-tiers.json from the legacy OpenCode registry."""

from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "model-registry" / "source-model-tiers.json"
OUT_HOME = Path(os.environ.get("PASEO_MODEL_TIERS", Path.home() / ".paseo" / "model-tiers.json"))
OUT_REPO = REPO / "model-registry" / "model-tiers.json"

GATEWAY: dict[str, str] = {
    "mimo-v2.5": "litellm/openrouter/xiaomi/mimo-v2.5",
    "mimo-v2.5-pro": "litellm/openrouter/xiaomi/mimo-v2.5-pro",
    "minimax-m3": "litellm/minimax-m3",
    "minimax-m2.7": "litellm/minimax-m2.7",
    "minimax-m2.5": "litellm/openrouter/minimax/minimax-m2.5",
    "qwen3.7-plus": "litellm/openrouter/qwen/qwen3.7-plus",
    "qwen3.7-max": "litellm/openrouter/qwen/qwen3.7-max",
    "qwen3.6-plus": "litellm/openrouter/qwen/qwen3.6-plus",
    "glm-5": "litellm/openrouter/z-ai/glm-5",
    "glm-5.1": "litellm/openrouter/z-ai/glm-5.2",
    "kimi-k2.6": "litellm/moonshot/kimi-k2.6",
    "kimi-k2.5": "litellm/moonshot/kimi-k2.5",
    "kimi-k2.7-code": "litellm/moonshot/kimi-k2.7-code",
}

CLAUDE_PI = {
    "opus": "anthropic/claude-opus-4-8",
    "fable": "anthropic/claude-fable-5",
    "sonnet": "anthropic/claude-sonnet-4-6",
    "haiku": "anthropic/claude-haiku-4-5",
}

KEY_ALIASES: dict[str, str] = {
    "claude-opus-4-8": "opus",
    "claude-fable-5": "fable",
    "claude-sonnet-4-6": "sonnet",
    "claude-haiku-4-5": "haiku",
    "gpt-5.1-codex-mini": "gpt-5.1-mini",
    "nemotron-cascade-2-30b-a3b": "qwen3.6-35b-a3b",
}

EXTRA_ATTRIBUTES: dict[str, dict] = {
    "step-3.7-flash": {
        "grade": "B",
        "modalities": ["text"],
        "ctx_max": 256000,
        "ctx_sweet_spot": 128000,
        "roles": {"impl": 0.65, "ui": 0.35, "audit": 0.55, "research": 0.6, "planning": 0.55},
        "traits": ["cheap", "fast", "coding", "high-volume"],
        "routable": True,
    },
    "step-3.7-flash:free": {
        "grade": "F",
        "modalities": ["text"],
        "ctx_max": 128000,
        "ctx_sweet_spot": 64000,
        "roles": {"impl": 0.45, "ui": 0.2, "audit": 0.35, "research": 0.4, "planning": 0.35},
        "traits": ["free", "fallback"],
        "routable": True,
    },
    "minimax-m2.5:free": {
        "grade": "F",
        "modalities": ["text"],
        "ctx_max": 205000,
        "ctx_sweet_spot": 128000,
        "roles": {"impl": 0.5, "ui": 0.2, "audit": 0.4, "research": 0.45, "planning": 0.4},
        "traits": ["free", "cheap", "text"],
        "routable": True,
    },
    "nemotron-3-ultra-550b-a55b:free": {
        "grade": "F",
        "modalities": ["text"],
        "ctx_max": 128000,
        "ctx_sweet_spot": 64000,
        "roles": {"impl": 0.4, "ui": 0.15, "audit": 0.3, "research": 0.35, "planning": 0.3},
        "traits": ["free", "experimental"],
        "routable": True,
    },
    "composer-1.5": {
        "grade": "A",
        "modalities": ["text", "image"],
        "ctx_max": 200000,
        "ctx_sweet_spot": 128000,
        "roles": {"ui": 0.9, "impl": 0.55, "audit": 0.45, "research": 0.5, "planning": 0.5},
        "traits": ["ui", "frontend", "cursor", "multimodal"],
        "routable": True,
    },
    "composer-2.5": {
        "grade": "S",
        "modalities": ["text", "image"],
        "ctx_max": 200000,
        "ctx_sweet_spot": 128000,
        "roles": {"ui": 0.95, "impl": 0.6, "audit": 0.5, "research": 0.55, "planning": 0.55},
        "traits": ["ui", "frontend", "cursor", "multimodal", "agentic"],
        "routable": True,
    },
    "gemini-3.1-pro": {
        "grade": "S",
        "modalities": ["text", "image", "video"],
        "ctx_max": 1000000,
        "ctx_sweet_spot": 256000,
        "roles": {"research": 0.85, "ui": 0.75, "planning": 0.8, "impl": 0.65, "audit": 0.6},
        "traits": ["multimodal", "frontier", "long-context", "reasoning"],
        "routable": True,
    },
    "laguna-m.1": {
        "grade": "A",
        "modalities": ["text"],
        "ctx_max": 256000,
        "ctx_sweet_spot": 128000,
        "roles": {"impl": 0.8, "audit": 0.65, "research": 0.6, "planning": 0.55, "ui": 0.35},
        "traits": ["coding", "agentic"],
        "routable": True,
    },
    "owl-alpha": {
        "grade": "B",
        "modalities": ["text"],
        "ctx_max": 128000,
        "ctx_sweet_spot": 64000,
        "roles": {"research": 0.7, "impl": 0.55, "audit": 0.5, "planning": 0.5, "ui": 0.25},
        "traits": ["research", "experimental"],
        "routable": True,
    },
    "qwen3.5-9b": {
        "grade": "L",
        "modalities": ["text"],
        "ctx_max": 32768,
        "ctx_sweet_spot": 16384,
        "roles": {"impl": 0.45, "ui": 0.1, "audit": 0.35, "research": 0.35, "planning": 0.3},
        "traits": ["local", "cheap", "small"],
        "routable": True,
    },
    "embed": {
        "grade": "L",
        "modalities": ["text"],
        "ctx_max": 8192,
        "ctx_sweet_spot": 4096,
        "roles": {"impl": 0.1, "ui": 0.0, "audit": 0.1, "research": 0.2, "planning": 0.05},
        "traits": ["embedding", "local"],
        "routable": False,
        "routable_note": "embedding model; not for agent routing",
    },
}


def remap_tier_provider(entry: str) -> str:
    s = str(entry)
    if s.startswith("litellm/"):
        return s
    if s.startswith("opencode-go/"):
        slug = s.split("/", 1)[1]
        return GATEWAY.get(slug, f"litellm/openrouter/{slug}")
    if s.startswith("reasonix/"):
        if "deepseek-v4-flash" in s:
            return "litellm/deepseek/deepseek-v4-flash"
        if "deepseek-v4-pro" in s:
            return "litellm/deepseek/deepseek-v4-pro"
    if s.startswith("deepseek/"):
        return f"litellm/{s}"
    if s.startswith("openrouter/"):
        return f"litellm/{s}"
    if s.startswith("kilo/"):
        return f"litellm/openrouter/{s.split('/', 1)[1]}"
    if s.startswith("==qwen==/"):
        return f"llama-swap/{s.split('/', 1)[1]}"
    if s.startswith("codex/"):
        return f"openai-codex/{s.split('/', 1)[1]}"
    if s.startswith("claude/"):
        short = s.split("/", 1)[1]
        return CLAUDE_PI.get(short, f"anthropic/{short}")
    return s


def transform_tiers(registry: dict) -> None:
    skip = {
        "attributes",
        "model_strengths",
        "pricing",
        "reasoning",
        "permissions",
        "provider_priority",
        "quotas_per_5h",
        "speed",
        "load",
        "fallback",
        "key_aliases",
        "_comment",
    }
    for name, value in list(registry.items()):
        if name in skip or name.startswith("_"):
            continue
        if isinstance(value, list):
            registry[name] = [remap_tier_provider(x) for x in value]
        elif isinstance(value, dict) and "models" in value:
            value["models"] = [remap_tier_provider(x) for x in value["models"]]


def patch_subscription_high(registry: dict) -> None:
    block = registry.get("subscription-high")
    if not isinstance(block, dict):
        return
    block["models"] = [
        "openai-codex/gpt-5",
        "openai-codex/gpt-5.5",
        "anthropic/claude-opus-4-8",
        "anthropic/claude-fable-5",
    ]
    block["neverSubagent"] = True


def patch_provider_priority(registry: dict) -> None:
    registry["provider_priority"] = {
        "_note": (
            "Per-source score bonus for Pi/OMP provider strings (2026-06). "
            "litellm proxy first, then legacy direct deepseek/kilo/openrouter, local llama-swap, "
            "native subscriptions, gateway :free variants; opencode-go kept as legacy fallback."
        ),
        "litellm": 42,
        "deepseek": 38,
        "kilo": 34,
        "openrouter": 30,
        "digitalocean": 28,
        "reasonix": 26,
        "local": 14,
        "local-edge": 8,
        "subscription": 6,
        "gateway-free": 4,
        "opencode-go": 3,
        "other": 0,
    }


def patch_permissions(registry: dict) -> None:
    perms = registry.setdefault("permissions", {})
    perms["_note"] = (
        "Permission profiles for Paseo create_agent (OpenCode-era backends). "
        "On Pi/OMP pass provider/model strings only; these entries apply to boo-router CLI "
        "and any remaining OpenCode dispatch paths."
    )
    perms["_default"] = perms.get("_default", "bypass")
    if "claude" in perms and "anthropic" not in perms:
        perms["anthropic"] = deepcopy(perms["claude"])
    if "codex" in perms and "openai-codex" not in perms:
        perms["openai-codex"] = deepcopy(perms["codex"])


def patch_reasoning_note(registry: dict) -> None:
    reasoning = registry.setdefault("reasoning", {})
    reasoning["_apply"] = (
        "Pi/OMP: set thinking level via OMP modelRoles / session options when supported. "
        "Legacy OpenCode path: options.reasoningEffort=<value>. Skip when effort is 'auto'."
    )


def merge_extra_attributes(registry: dict) -> None:
    attrs = registry.setdefault("attributes", {})
    for key, block in EXTRA_ATTRIBUTES.items():
        attrs.setdefault(key, block)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source registry: {SOURCE}")

    registry = json.loads(SOURCE.read_text(encoding="utf-8"))
    registry["_comment"] = (
        "Canonical model tiers for Pi/OMP provider strings. "
        "Generated by scripts/generate-model-tiers.py from model-registry/source-model-tiers.json. "
        "subscription-high.neverSubagent: those models must NEVER be routed as subagents."
    )
    transform_tiers(registry)
    patch_subscription_high(registry)
    patch_provider_priority(registry)
    patch_permissions(registry)
    patch_reasoning_note(registry)
    registry["key_aliases"] = {
        "_note": "Map Pi provider suffix keys onto legacy attribute/pricing keys.",
        **KEY_ALIASES,
    }
    merge_extra_attributes(registry)

    write_json(OUT_HOME, registry)
    write_json(OUT_REPO, registry)
    print(f"wrote {OUT_HOME}")
    print(f"wrote {OUT_REPO}")


if __name__ == "__main__":
    main()
