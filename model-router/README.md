# Paseo Smart Model Router

A deterministic, config-driven model selector used by Paseo orchestration. Given a role and task it picks one provider from the active preset's candidate pool, scoring on structured registry attributes with a full `--explain` trace. No LLM runs on the routing path.

## Recommendation

Build the router as a callable script/tool, with the Paseo skill keeping the policy summary and fallback rule.

The script/tool should be the source of executable selection behavior because it can validate candidate pools, explain scoring, use effective pricing consistently, and later accept live quota and local-residency state. A skill-only selection spec is simpler to deploy, but it leaves each agent to re-interpret the same policy and cannot reliably enforce hybrid local constraints.

The skill should still keep a short rule:

- Read the active preset and `~/.paseo/model-tiers.json`.
- If a role maps to a string, use that provider.
- If a role maps to an array, call the router and pass only the returned provider.
- If the router is unavailable, apply the same strength, effective cost, quota, and local-concurrency priorities manually.

## Contract

Input:

- `role`: one of `impl`, `ui`, `audit`, `research`, `planning`.
- `task`: short natural-language task description.
- `difficulty`: `simple`, `standard`, or `hard`.
- `contextTokens`: approximate input context size.
- `provider_priority` (registry block, not a CLI flag): a per-source score bonus so equivalent models route to the preferred provider, then fail over via `fallbacks`. Order (2026-06): digitalocean (free credits) > reasonix > openrouter > opencode-zen > local > local-edge > opencode-go (deprioritized) > subscription. The router classifies a candidate's source from its provider string. The `credits-first` preset is the cross-provider default built on this.
- `priority`: `cost-efficiency`, `speed`, `quality`, or `balanced` (default). Tunes the scorer: cost-efficiency weights cost + quota and leans reasoning down; speed rewards the per-model `speed` signal (TTFT-oriented) and leans reasoning down; quality rewards higher grade and leans reasoning up. It nudges, it does not override role fit. Mirrors DigitalOcean inference-router's cheapest/fastest/optimal policies.
- `budget`: `cost_sensitive`, `balanced`, or `quality` (legacy alias mapped onto `priority`).
- `fanout`: number of agents expected to run in parallel for this dispatch.
- `requires`: comma-separated hard modality needs (e.g. `vision,computer-use`). A candidate that lacks any of these is eliminated, not penalized.
- `residentLocal`: the local model currently loaded in llama-swap. A matching local candidate gets a no-swap bonus.
- `presetPath`: active preset JSON path. Defaults to `~/.paseo/orchestration-preferences.json` (the file `paseo-preset` copies the chosen named preset onto).
- `modelTiersPath`: model registry path. Defaults to `~/.paseo/model-tiers.json`.
- Future input: a `--quota-state <path>` ledger for live remaining quota (no such source exists in Paseo today; see Resolved below).

Output:

- `provider`: the single provider string to pass to `create_agent`.
- `modelId`: normalized model id used for registry lookup.
- `rationale`: concise explanation of the winning factors.
- `reasoning`: recommended thinking setting for the winner as `{ effort, apply }`. `effort` is the OpenCode `reasoningEffort` value (`none`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max`), resolved from the registry `reasoning` block's `by_difficulty[difficulty]` (falling back to `default`); `"auto"` means leave the model default (do not set `reasoningEffort`). `apply` is the note on how to pass it. The orchestrator sets `options.reasoningEffort` after selection; the router does not dispatch. OpenCode emits this as `reasoning_effort` for OpenAI/DeepSeek/MiniMax and as a thinking budget for Anthropic.
- `permissions`: the permission posture for the winner's backend as `{ backend, mode, settings, cliBypass }`. `mode` defaults to `bypass` (fully unattended, registry `permissions._default`). `settings` is what to pass to `create_agent` (opencode `{modeId:"build",features:{auto_accept:true}}`, claude `{modeId:"bypassPermissions"}`, codex `{modeId:"full-access"}`, reasonix `{modeId:"yolo"}`); `cliBypass` is the standalone-CLI flag. Backend is the provider-string prefix. Verified against paseo `list_providers` and the provider source.
- `fallbacks`: the remaining survivors in score order (an ordered failover chain). The orchestrator retries the next entry only on a transient error (registry `fallback.transient`) and fails fast on permanent ones (registry `fallback.permanent`); re-resolve reasoning/permissions per fallback model.
- `scores`: per-candidate scoring details for auditability, including eliminated candidates and their disqualifying reason.

The recommended `reasoning.effort` is clamped to the chosen model's supported `levels` (e.g. OpenAI never gets `max`) and stepped down one level when `contextTokens` exceeds 70% of the model's `ctx_max` (reasoning needs output headroom).

## Scoring Shape

The router is fully deterministic (no LLM on the routing path) and scores the role's candidate array in three strict phases. It reads the structured `attributes` block in the registry, not the `model_strengths` prose (prose is human documentation only).

1. **Filter (eliminate).** A candidate is removed if: it is `neverSubagent` (S-tier guardrail); `routable` is false (license/availability hold); a `requires` modality is not in its `modalities`; or `contextTokens` exceeds its `ctx_max`.
2. **Fit (rank).** Role affinity (`attributes.roles[role]`), trait overlap with the task text, a difficulty under-spec penalty (candidate `grade` below the difficulty floor), and a context sweet-spot penalty (`contextTokens` past `ctx_sweet_spot`).
3. **Economics (tiebreak).** Effective blended cost (output weighted 3:1, `_over_256k` band applied when context crosses 256K), `quotas_per_5h` as static abundance, local fan-out penalty / serial bonus, resident-local no-swap bonus, then preset order.

If every candidate is eliminated the router errors with the per-candidate reasons. If the surviving winner scores poorly (e.g. forced past its context sweet-spot into an expensive band), the `--explain` trace shows exactly why, signaling the preset pool is a bad fit for that request.

## Dry Run

```bash
node model-router/router.mjs --preset ~/.paseo/presets/workhorse-mid.json --role ui --task "review a screenshot-heavy frontend flow" --requires image --difficulty standard --context-tokens 120000 --explain
node model-router/router.mjs --preset ~/.paseo/presets/workhorse-mid.json --role impl --task "apply a mechanical OpenSpec implementation" --difficulty simple --fanout 3
node model-router/router.mjs --dry-run-samples
```

## Resolved (was Open Questions)

- **Active preset source.** `paseo-preset <name>` copies `presets/<name>.json` onto `~/.paseo/orchestration-preferences.json`, so that file *is* the active preset. The router defaults to it; Paseo passes nothing. The `"preset"` field inside is just a label.
- **Live quota source.** None exists in Paseo today (no ledger, no daemon quota state, no provider API surface). The router uses static `quotas_per_5h` as an abundance proxy, with an optional `--quota-state` hook reserved for a future ledger.
- **Task difficulty.** Caller-supplied (`--difficulty`). No model preflight on the routing path, by design.
- **Local residency.** Caller-supplied (`--resident-local`); the router never makes a network call to llama-swap on the hot path.
- **MiniMax M3.** Handled by pure economics: its `effective_input`/`effective_output` (the 3x usage-value deal) make it the cheapest capable mid, so it wins ui/research/planning naturally. When the promo ends, drop the `effective_*` fields from the registry; no router code changes.
