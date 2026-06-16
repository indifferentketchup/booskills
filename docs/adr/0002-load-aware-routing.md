# Load-aware routing via a shared cross-process ledger

The model-router (`model-router/router.mjs`) is invoked once per dispatch as an independent forked process. When Paseo fans out N subagents, the N router calls cannot see each other in memory, so a purely deterministic scorer makes all N pick the same top-scored provider and stacks the whole fan-out on it, tripping rate limits and (for local models) saturating one machine. We decided the router stays deterministic per-call but reads a **shared append-only ledger** (`~/.paseo/router-load.jsonl`, `model-router/load-ledger.mjs`) so concurrent dispatches see each other's in-flight load and rolling-window usage, and **soft-penalize** crowded or near-exhausted providers without ever eliminating them.

## Status

accepted

## Considered Options

- **Query Paseo live state per dispatch** (`list_agents`/`get_agent_status`) for ground-truth concurrency. Rejected as the backbone: it couples the router to the Paseo MCP, does not map every agent to its provider, and gives no rolling-quota signal. Kept as a possible future reconciliation cross-check, not the primary source.
- **TTL-only reservations, no explicit release.** Rejected as the default: in-flight counts lag reality for short tasks and over-count for long ones. We use explicit `--reserve` at route time and `--release` at closure (wired into `paseo-boo`), with a 30-minute TTL only as a crash backstop.
- **Hard concurrency caps (disqualify at the limit).** Rejected: a fully capped pool would eliminate every candidate and error. We use a smooth penalty that ramps with crowding, so the router always returns a pick and spreads by preference, not by exclusion.
- **In-memory state in a long-lived router process.** Rejected: the router is a per-call CLI by design (ADR 0001 keeps it a cheap stateless selector); a shared file is the only state visible across independent forks without standing up a daemon.

## Consequences

- Reservation is written at **route time, before `create_agent`**, so a sibling dispatched a millisecond later already sees the slot taken. Release is keyed by the same dispatch id at closure. `paseo-boo` owns this lifecycle; every dispatch (pinned roles included) feeds the ledger, so quota tracking covers the whole fleet.
- Three soft signals live in `load-ledger.mjs`: in-flight crowding vs a per-source `concurrency_soft` cap (subagent awareness), remaining `quotas_per_5h` over a rolling window (rate-limit awareness), and host saturation from `os.loadavg`/`freemem` for local models only (one GPU cannot truly parallelize a fan-out). All weights default in `LOAD_DEFAULTS` and are overridable by a `load` block in `~/.paseo/model-tiers.json`.
- The default tuning is deliberately gentle: it spreads readily across equal-fit providers (the same model served by several sources, which is the real rate-limit case) but will not trade a quality pick for moderate load. Cranking spread is a registry edit, not a code change.
- The ledger is advisory: a read or write failure degrades to stateless routing, never a stalled dispatch. `--no-ledger` opts out per call. The file self-compacts past ~256KB.
- Load decisions remain auditable via `--explain`, which prints each load penalty and its reason alongside the existing fit/economics trace (consistent with ADR 0001's "you can always see why").
