# Deterministic model router with structured attributes

The model-router (`model-router/router.mjs`) picks one provider from a role's candidate pool. We decided it stays **fully deterministic** with **no LLM on the routing path**, and that it scores on a **structured `attributes` block** in `~/.paseo/model-tiers.json` rather than on the human-readable `model_strengths` prose.

## Status

accepted

## Considered Options

- **LLM-in-the-loop routing** — call a cheap model to judge task fit / difficulty per dispatch. Rejected: it puts cost, latency, and non-determinism on the hot path of every single dispatch, which defeats the purpose of a cheap selector. Difficulty classification, if ever wanted, is the *caller's* job (one preflight, passed in via `--difficulty`).
- **Keep prose keyword-matching** — the original scaffold grepped `model_strengths` text for keywords and hardcoded one model name (`/minimax-m3/`). Rejected: brittle (accidental token matches), can't express degree, can't separate hard constraints from soft preferences, and needs a code change per new model.

## Consequences

- "Smart" comes from better *inputs*, not a smarter brain: structured `grade`/`modalities`/`ctx_max`/`ctx_sweet_spot`/`roles`/`traits`/`routable`, plus live signals passed by the caller (`--requires`, `--resident-local`, `--context-tokens`).
- Maintaining the registry now means maintaining the `attributes` block per model (prose is demoted to documentation the router never reads).
- Economic promos (e.g. MiniMax M3's 3x usage-value deal) are expressed purely as `effective_*` pricing fields, never as special-case code — ending a promo is a registry edit, not a code change.
- Every decision is auditable via `--explain`, including eliminated candidates and their disqualifying reason. This is the "intuitive" property: you can always see why a model won or lost.
