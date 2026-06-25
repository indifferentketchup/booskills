#!/usr/bin/env python3
"""Generate Pi/OMP orchestration preset JSON files into presets/."""

from __future__ import annotations

import json
from pathlib import Path

ROLES = ("impl", "ui", "audit", "research", "planning")
REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "presets"

PERSONAS = (
    "adversarial-security-analyst",
    "adversarial-validator",
    "behavioral-analyst",
    "concurrency-analyst",
    "edge-case-explorer",
    "evidence-based-investigator",
    "junior-developer",
    "risk-analyst",
    "software-architect",
    "structural-analyst",
    "test-engineer",
    "user-experience-designer",
)


def gw(model: str) -> list[str]:
    """Dual-gateway pool: OpenRouter + Kilo."""
    return [f"openrouter/{model}", f"kilo/{model}"]


def deepseek(suffix: str) -> str:
    return f"deepseek/deepseek-v4-{suffix}"


def anthropic(model: str) -> str:
    return f"anthropic/{model}"


def openai_codex(model: str) -> str:
    return f"openai-codex/{model}"


def gemini(model: str) -> str:
    return f"google-antigravity/{model}"


def cursor(model: str) -> str:
    return f"cursor/{model}"


def local(model: str) -> str:
    return f"llama-swap/{model}"


def pool(*entries: str | list[str]) -> list[str]:
    out: list[str] = []
    for entry in entries:
        if isinstance(entry, list):
            out.extend(entry)
        else:
            out.append(entry)
    return out


# Values are provider strings or dual-gateway lists.
M: dict[str, str | list[str]] = {
    "mimo-v2.5-pro": gw("xiaomi/mimo-v2.5-pro"),
    "glm-5.1": gw("z-ai/glm-5.1"),
    "qwen3.7-max": gw("qwen/qwen3.7-max"),
    "gpt-5.5": openai_codex("gpt-5.5"),
    "opus": anthropic("claude-opus-4-8"),
    "fable": anthropic("claude-fable-5"),
    "composer-2.5": cursor("composer-2.5"),
    "gemini-3.1-pro": gemini("gemini-3.1-pro"),
    "deepseek-v4-pro": deepseek("pro"),
    "qwen3.7-plus": gw("qwen/qwen3.7-plus"),
    "kimi-k2.6": gw("moonshotai/kimi-k2.6"),
    "glm-5": gw("z-ai/glm-5"),
    "sonnet": anthropic("claude-sonnet-4-6"),
    "gpt-5.4": openai_codex("gpt-5.4"),
    "composer-1.5": cursor("composer-1.5"),
    "minimax-m3": gw("minimax/minimax-m3"),
    "haiku": anthropic("claude-haiku-4-5"),
    "gpt-5.1-mini": openai_codex("gpt-5.1-codex-mini"),
    "laguna-m.1": gw("poolside/laguna-m.1"),
    "owl-alpha": gw("openrouter/owl-alpha"),
    "step-3.7-flash": gw("stepfun/step-3.7-flash"),
    "mimo-v2.5": gw("xiaomi/mimo-v2.5"),
    "deepseek-v4-flash": deepseek("flash"),
    "qwen3.6-35b-a3b": local("qwen3.6-35b-a3b"),
    "qwen3.6-27b": local("qwen3.6-27b"),
    "nemotron-cascade-30b": local("nemotron-cascade-2-30b-a3b"),
    "qwen3.5-9b": local("qwen3.5-9b"),
    "nemotron-3-ultra-free": gw("nvidia/nemotron-3-ultra-550b-a55b:free"),
    "minimax-m2.5-free": gw("minimax/minimax-m2.5:free"),
    "step-3.7-flash-free": gw("stepfun/step-3.7-flash:free"),
    "local-embed": local("embed"),
}


def expand(*keys: str) -> list[str]:
    out: list[str] = []
    for key in keys:
        value = M[key]
        if isinstance(value, list):
            out.extend(value)
        else:
            out.append(value)
    return out


GRADE_S = expand(
    "glm-5.1",
    "qwen3.7-max",
    "gpt-5.5",
    "opus",
    "fable",
    "composer-2.5",
    "gemini-3.1-pro",
)
GRADE_A = expand(
    "qwen3.7-plus",
    "kimi-k2.6",
    "glm-5",
    "sonnet",
    "gpt-5.4",
    "composer-1.5",
)
GRADE_B = expand(
    "minimax-m3",
    "mimo-v2.5-pro",
    "deepseek-v4-pro",
    "haiku",
    "gpt-5.1-mini",
    "laguna-m.1",
    "owl-alpha",
    "step-3.7-flash",
)
GRADE_C = expand("mimo-v2.5", "deepseek-v4-flash")
GRADE_D = expand("qwen3.6-35b-a3b", "qwen3.6-27b")
GRADE_F = expand("local-embed", "nemotron-3-ultra-free")
WORKHORSE = expand("mimo-v2.5", "deepseek-v4-flash", "minimax-m3", "step-3.7-flash")
WORKHORSE_LOCAL = list(GRADE_D)
LOCAL = expand("nemotron-cascade-30b", "qwen3.5-9b")
FREE = expand("nemotron-3-ultra-free", "minimax-m2.5-free", "step-3.7-flash-free")
SUBSCRIPTION_LOW = expand("gpt-5.1-mini", "haiku")
SUBSCRIPTION_MID = expand("gpt-5.4", "sonnet")

BASE_PREFERENCES = [
    "Sam reviews all diffs and commits manually. Agents must not commit. Stage by explicit path, never git add -A.",
    "Prefer minimal scope; lead with the smallest approach.",
    "Subscription-high models (opus, fable, gpt-5, gpt-5.5) are preset pool options for the router but must never be assigned in the agents map or routed as subagents.",
    "Local llama-swap: only one local model resident at a time. When concurrency is 1, dispatch subagents strictly one at a time.",
]

LOCAL_PREFERENCES = BASE_PREFERENCES + [
    "Local models are $0 but serial on a single llama-swap server; never fan out parallel subagents on local-heavy presets.",
]

CLOUD_PREFERENCES = BASE_PREFERENCES + [
    "Default cloud posture: DeepSeek V4 Flash and MiMo 2.5 for bulk work; MiniMax M3 and grade-B models for mid-tier; grade-A/S for explicit quality needs.",
    "Provider strings use Pi/OMP format (provider/model). Gateway models list both openrouter/ and kilo/ variants; OMP coalesces inside sessions.",
]

DEFAULT_AGENTS_CLOUD = {
    "adversarial-security-analyst": deepseek("flash"),
    "adversarial-validator": "openrouter/xiaomi/mimo-v2.5",
    "behavioral-analyst": "openrouter/xiaomi/mimo-v2.5",
    "concurrency-analyst": deepseek("flash"),
    "edge-case-explorer": "openrouter/xiaomi/mimo-v2.5",
    "evidence-based-investigator": "openrouter/xiaomi/mimo-v2.5",
    "junior-developer": deepseek("flash"),
    "risk-analyst": deepseek("flash"),
    "software-architect": "openrouter/z-ai/glm-5",
    "structural-analyst": "openrouter/xiaomi/mimo-v2.5",
    "test-engineer": deepseek("flash"),
    "user-experience-designer": cursor("composer-2.5"),
}

DEFAULT_AGENTS_LOCAL = {
    **DEFAULT_AGENTS_CLOUD,
    "adversarial-security-analyst": local("qwen3.6-35b-a3b"),
    "adversarial-validator": local("qwen3.6-27b"),
    "behavioral-analyst": local("qwen3.6-35b-a3b"),
    "concurrency-analyst": local("qwen3.6-35b-a3b"),
    "edge-case-explorer": local("qwen3.6-27b"),
    "evidence-based-investigator": local("qwen3.6-35b-a3b"),
    "junior-developer": local("qwen3.6-27b"),
    "risk-analyst": local("qwen3.6-35b-a3b"),
    "software-architect": local("qwen3.6-35b-a3b"),
    "structural-analyst": local("qwen3.6-27b"),
    "test-engineer": local("qwen3.6-27b"),
    "user-experience-designer": local("qwen3.6-35b-a3b"),
}

DEFAULT_AGENTS_SUB_LOW = {
    **DEFAULT_AGENTS_CLOUD,
    "adversarial-security-analyst": anthropic("claude-haiku-4-5"),
    "adversarial-validator": anthropic("claude-haiku-4-5"),
    "behavioral-analyst": openai_codex("gpt-5.1-codex-mini"),
    "concurrency-analyst": anthropic("claude-haiku-4-5"),
    "edge-case-explorer": openai_codex("gpt-5.1-codex-mini"),
    "evidence-based-investigator": openai_codex("gpt-5.1-codex-mini"),
    "junior-developer": anthropic("claude-haiku-4-5"),
    "risk-analyst": anthropic("claude-haiku-4-5"),
    "software-architect": openai_codex("gpt-5.1-codex-mini"),
    "structural-analyst": openai_codex("gpt-5.1-codex-mini"),
    "test-engineer": anthropic("claude-haiku-4-5"),
    "user-experience-designer": anthropic("claude-haiku-4-5"),
}

DEFAULT_AGENTS_SUB_MID = {
    **DEFAULT_AGENTS_CLOUD,
    "adversarial-security-analyst": anthropic("claude-sonnet-4-6"),
    "adversarial-validator": anthropic("claude-sonnet-4-6"),
    "behavioral-analyst": openai_codex("gpt-5.4"),
    "concurrency-analyst": anthropic("claude-sonnet-4-6"),
    "edge-case-explorer": openai_codex("gpt-5.4"),
    "evidence-based-investigator": openai_codex("gpt-5.4"),
    "junior-developer": anthropic("claude-sonnet-4-6"),
    "risk-analyst": anthropic("claude-sonnet-4-6"),
    "software-architect": openai_codex("gpt-5.4"),
    "structural-analyst": openai_codex("gpt-5.4"),
    "test-engineer": anthropic("claude-sonnet-4-6"),
    "user-experience-designer": anthropic("claude-sonnet-4-6"),
}


def make_preset(name, pool_entries, *, concurrency, preferences, agents):
    providers = {role: list(pool_entries) for role in ROLES}
    missing = [p for p in PERSONAS if p not in agents]
    if missing:
        raise SystemExit(f"{name}: agents map missing personas: {missing}")
    return {
        "preset": name,
        "concurrency": concurrency,
        "preferences": preferences,
        "providers": providers,
        "agents": dict(agents),
    }


PRESETS = [
    ("grade-S", GRADE_S, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_CLOUD),
    ("grade-A", GRADE_A, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_CLOUD),
    ("grade-B", GRADE_B, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_CLOUD),
    ("grade-C", GRADE_C, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_CLOUD),
    ("grade-D", GRADE_D, 1, LOCAL_PREFERENCES, DEFAULT_AGENTS_LOCAL),
    ("grade-F", GRADE_F, 1, LOCAL_PREFERENCES, DEFAULT_AGENTS_LOCAL),
    ("workhorse", WORKHORSE, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_CLOUD),
    ("workhorse-local", WORKHORSE_LOCAL, 1, LOCAL_PREFERENCES, DEFAULT_AGENTS_LOCAL),
    ("local", LOCAL, 1, LOCAL_PREFERENCES, DEFAULT_AGENTS_LOCAL),
    ("free", FREE, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_CLOUD),
    ("subscription-low", SUBSCRIPTION_LOW, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_SUB_LOW),
    ("subscription-mid", SUBSCRIPTION_MID, 4, CLOUD_PREFERENCES, DEFAULT_AGENTS_SUB_MID),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, pool_entries, concurrency, preferences, agents in PRESETS:
        obj = make_preset(
            name,
            pool_entries,
            concurrency=concurrency,
            preferences=preferences,
            agents=agents,
        )
        path = OUT / f"{name}.json"
        path.write_text(f"{json.dumps(obj, indent=2)}\n", encoding="utf-8")
        print(f"wrote {path.relative_to(REPO)}")


if __name__ == "__main__":
    main()
