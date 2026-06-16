---
name: boo-router
description: >
  Resolves the single best provider string for a Paseo dispatch from the active
  orchestration preset's candidate pool, using the deterministic model-router
  script (grade and role fit, effective cost, quota, locality, plus the
  never-subagent guardrail). Use when a role maps to an array of candidates and
  you must pick ONE provider before create_agent, when the operator says "route
  this", "which model for <role>", "pick the model", or just before fanning out
  subagents. Do NOT use to dispatch a skill to a subagent; that is paseo-boo. Do
  NOT use to decompose a goal into a skill pipeline; that is boo-meta.
metadata:
  version: "1.1"
---

# Boo-Router

Resolves one provider for one dispatch. This skill is a thin protocol around the deterministic router script; it holds no model knowledge of its own. The registry (`~/.paseo/model-tiers.json`) and the active preset (`~/.paseo/orchestration-preferences.json`) are the only sources of truth; the script reads both.

## Size

Not sized. One deterministic call per resolution, no fan-out, no agents dispatched.

## Process

1. Gather the request. Required: `role` (one of `impl`, `ui`, `audit`, `research`, `planning`) and a short `task` description. Optional: `difficulty` (`simple`, `standard`, `hard`), `priority` (`cost-efficiency`, `speed`, `quality`, `balanced` - default `balanced`), `context-tokens` (approx input size), `requires` (comma-separated hard modality needs, e.g. `vision,computer-use`), `fanout` (parallel agent count), `resident-local` (the local model currently loaded in llama-swap).
   - Invocation shorthand: `boo-router <preset> <priority>` (e.g. `boo-router workhorse cost-efficiency`) means `--preset ~/.paseo/presets/<preset>.json --priority <priority>`; role and task still come from the operator's request.
   - Priority profiles tune the deterministic scorer (they nudge, they do not override role fit): `cost-efficiency` weights effective cost + quota heavily and leans reasoning lower; `speed` rewards the per-model speed signal (TTFT-oriented) and leans reasoning lower; `quality` rewards higher grade and leans reasoning higher; `balanced` is neutral. Legacy `--budget` (cost_sensitive/balanced/quality) still maps onto these.
2. Run the router (deterministic, no LLM):
   ```
   node ~/.agents/skills/boo-router/scripts/router.mjs --role <role> --task "<task>" \
     [--priority <p>] [--difficulty <d>] [--context-tokens <n>] [--requires <list>] \
     [--fanout <n>] [--resident-local <id>] [--reserve <id>] [--no-ledger] [--preset <path>] --json
   ```
   It defaults to the active preset and registry; pass `--preset`/`--model-tiers` only to override.
   - Load awareness: the router reconciles a shared cross-process ledger (`~/.paseo/router-load.jsonl`) so concurrent fan-out dispatches spread across providers instead of all picking the same top score. Pass `--reserve <id>` on a real dispatch to record the pick as in-flight (the dispatcher, paseo-boo, then calls `--release <id>` at closure); omit it for a preview. `--no-ledger` routes statelessly. The penalties are soft: in-flight crowding vs a per-source `concurrency_soft` cap, remaining 5h quota, and host saturation for local models. They nudge, they never eliminate a candidate.
3. Read `result.provider` from the JSON. Pass EXACTLY that string to `create_agent`'s `provider` field.
4. Apply `result.reasoning` `{ effort, apply }` to the dispatched model. OpenCode uses one unified option, `reasoningEffort` (verified in the opencode binary: it emits `reasoning_effort` for OpenAI/DeepSeek/MiniMax and maps to an Anthropic thinking budget):
   - `effort` is a concrete value (`high`, `max`, `medium`, `none`, etc.) -> set `options.reasoningEffort = <effort>` on the model (OpenCode per-model config options, or the model option at create_agent).
   - `effort: "auto"` -> set nothing; leave the model default. OpenCode rejects `reasoningEffort` on non-reasoning models, so never force it.
   - DeepSeek `effort: "max"` needs a large context window (>=384K) and a generous output cap, and thinking mode ignores `temperature`.
   - Via Paseo, the cleanest path is `create_agent settings.thinkingOptionId = <effort>` (Paseo maps it per backend); the `options.reasoningEffort` form is the standalone path.
5. Apply `result.permissions` `{ backend, mode, settings }`. The default `mode` is `bypass` (fully unattended, per operator policy). Pass `settings` to `create_agent`: opencode -> `{ modeId: "build", features: { auto_accept: true } }`; claude/claude-ib -> `{ modeId: "bypassPermissions" }`; codex -> `{ modeId: "full-access" }`; reasonix -> `{ modeId: "yolo" }`. For the standalone CLI path use `cliBypass` (e.g. claude `--dangerously-skip-permissions`, codex `--dangerously-bypass-approvals-and-sandbox`). To downgrade from yolo, read the backend's `safe`/`readonly` entry from the registry `permissions` block instead.
6. Keep `result.fallbacks` (the remaining survivors, in score order) for failover. If the dispatched model fails, retry the next provider in the chain ONLY for a transient error (registry `fallback.transient`: 408/409/425/429/5xx, RateLimit/Timeout/Connection/Overloaded/ContextOverflow); fail fast on permanent errors (registry `fallback.permanent`: 400/401/403/404/422, auth/validation/not-found). Re-resolve reasoning + permissions for the fallback model (its backend and supported levels differ). The router has already clamped `effort` to the model's supported levels and stepped it down under context pressure, so use the value as given.
7. Relay `result.rationale` as the why. For the full per-candidate trace plus the reasoning and permission notes, re-run with `--explain` instead of `--json`.
8. If the script cannot run (no `node`, file missing), use the manual fallback: read the active preset and registry yourself and apply the same order: eliminate `neverSubagent` and non-`routable` candidates, then any whose `modalities` miss a `requires` need or whose `ctx_max` is below `context-tokens`; rank survivors by `attributes.roles[role]`, then effective cost (output-weighted, `_over_256k` band when context crosses 256K), then quota, then locality; default to the first array element when nothing distinguishes them. For reasoning, read `reasoning[<model>].by_difficulty[difficulty]` (or `.default`) from the registry and set `options.reasoningEffort` the same way as step 4; skip it when the entry is `{ "effort": "auto" }`.

## What NOT to do

- Do not pass an array, the `scores` list, or any object to `create_agent`; pass the single `provider` string only.
- Do not route a subscription-high model (`gpt-5`, `gpt-5.5`, `opus`, `fable`) as a subagent; the router eliminates them by the `neverSubagent` guardrail, never re-add one by hand.
- Do not invent or remember provider strings; the active preset and registry are the only sources.
- Do not call an LLM to judge task fit; routing is deterministic by design.
- Do not dispatch the agent yourself (that is paseo-boo) or decompose a multi-skill goal (that is boo-meta).

## Gotchas

- The active preset is `~/.paseo/orchestration-preferences.json` (the file `paseo-preset` copies a named preset onto), not a file under `presets/`. Switch grade pools with `paseo-preset grade-L|grade-C|grade-B|grade-A|grade-S`.
- Provider strings carry the provider prefix: `opencode/opencode-go/<model>` (cloud gateway), `opencode/deepseek/<model>` (DeepSeek direct API, used for `deepseek-v4-flash` and `deepseek-v4-pro`), `opencode/==qwen==/<model>` (local, llama-swap), `claude/<model>`, `codex/<model>`. The `agents` map values omit the `opencode/` prefix; the router handles both. The router keys attributes/pricing/quota by the last path segment, so the provider namespace can change without touching the registry.
- Local models are served through the OpenCode provider's `==qwen==` namespace; only one is resident in llama-swap at a time, so pass `--resident-local <id>` to earn the no-swap bonus and avoid thrashing.
- A role may be a pinned string (not an array) in the preset; the router returns it as-is with no scoring. That is expected, not a failure.
- The MiniMax M3 promo is priced via the registry `effective_*` fields, not router code; if a pick looks too M3-favorable, check whether the promo ended and the fields were removed.
- Provider priority: the registry `provider_priority` block adds a per-SOURCE bonus so equivalent models route to the preferred provider. Current order (2026-06): digitalocean (free GitHub Student credits, spend first) > reasonix > openrouter > opencode-zen (free) > local (sam-desktop) > local-edge > opencode-go (DEPRIORITIZED, usage low, last-resort fallback) > subscription. Source is classified from the provider string. The `credits-first` preset is the cross-provider default that exploits this; switch with `paseo-preset credits-first`.
- Cross-provider pools: a role pool may list the same logical model via several providers (e.g. deepseek-v4-pro via oc-digitalocean, reasonix, oc-openrouter, opencode-go). The router picks the highest-priority source and returns the rest as the `fallbacks` chain, so a dead provider fails over to the next.
- New providers all extend opencode in Paseo, so `oc-digitalocean`/`oc-openrouter`/`oc-sam-desktop`/`oc-embedding` resolve to the opencode permission posture (build + auto_accept); reasonix stays yolo. DigitalOcean's flash id is literally `deepseek-4-flash` (missing the v).
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
Routed: <role> -> <provider>
reasoningEffort: <effort> (or "auto" = left at model default)
Permissions: <backend> <mode> -> <settings to pass to create_agent> (default mode = bypass/yolo)
Fallbacks: <provider2> -> <provider3> (ordered failover chain, transient errors only)
Preset: <active preset name>
Why: <rationale line from result.rationale>
```

Every report ends with:
## Claims I did not verify
- <anything taken on the script's word without re-running --explain>

## Failure modes

- Role has no entry in the active preset: the router errors `Preset has no provider entry for role`; report it and stop.
- All candidates eliminated: the router errors with each candidate's disqualifying reason; relay them and stop. The usual cause is a pool with no model meeting a hard modality or context need; suggest a different preset.
- `node` missing or script absent: use the manual fallback in Process step 5; say you used it.
- Registry or preset unparseable: report the failing path and the parse error; never guess a provider.
