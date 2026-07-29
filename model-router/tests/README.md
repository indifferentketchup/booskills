# model-router regression harness

Run with `npm test` (from repo root) or `node --test model-router/tests/*.test.mjs`.

Two layers:

- **Golden snapshots** (`router.golden.test.mjs`, cases from `cases.mjs`): execs `router.mjs` with `--no-ledger` against frozen fixtures in `fixtures/`, deep-compares the full JSON output to `snapshots.json`. To update after an intentional scoring change, run `UPDATE_SNAPSHOTS=1 npm test` and review the resulting `git diff snapshots.json` before committing it. That diff is the review artifact; read it, don't just regenerate and move on.
- **Ledger-enabled smoke**: runs the same router without `--no-ledger`, the one path the snapshot layer cannot reach (`--no-ledger` is what makes snapshots deterministic in the first place). Points `ROUTER_LOAD_LEDGER` at a temp file so it never touches your real `~/.paseo/router-load.jsonl`. Asserts structure only (exit code, JSON parses, provider is in the requested pool, reason strings aren't double-formatted), never exact scores, since scores legitimately move with host load.

**What this harness proves, and what it doesn't:** a green run means behavior is *unchanged* from the committed baseline. It does not mean the behavior is *correct*: the baseline itself was only spot-checked by hand against `--explain` for five representative cases (see `tasks.md` task 1.10), not exhaustively verified. Treat a snapshot diff as something to read and reason about, not a rubber stamp.

**No CI runs this automatically.** There is no `.github/workflows/` in this repo and no configured remote runner. Nothing currently enforces that this suite passes before a `router.mjs` change ships except running it yourself. Given this repo has a documented history of changes landing on `main` outside an explicit review step, consider wiring a local `pre-push` git hook that runs `npm test`, though note that mitigation only covers landings that go through an interactive `git push`; it's unconfirmed whether the out-of-band landing history mentioned above actually goes through one.

Fixtures under `fixtures/` are hand-authored, not copied from the real `presets/`/`model-registry/`. Real presets only reach 3 of `sourceOf()`'s 14 provider-classification branches and contain no `neverSubagent`-flagged model, so copying them would leave large parts of `router.mjs` unprotected. See `openspec/changes/router-quality-hardening/design.md` for the full rationale.
