# Model Router Control (local UI)

A local Next.js control panel for the deterministic model-router. Two surfaces:

- **Playground** - pick preset / role / priority / difficulty / task / context, run the router, and see the chosen provider, its cost source, `reasoningEffort`, permissions, the fallback chain, and the full candidate score table with per-candidate reasons.
- **Provider priority** - edit the `provider_priority` weights in `~/.paseo/model-tiers.json` (DigitalOcean-first cost posture) and save to disk.

It calls the sibling `../router.mjs` and reads/writes `~/.paseo` directly. Local-only; no network, no auth, no telemetry.

## Run

### Docker (recommended; persistent)

```bash
cd model-router
docker compose -f ui/docker-compose.yml up -d --build   # http://localhost:4319
```

Bind-mounts your `~/.paseo` read-write (override with `PASEO_DIR=...`), runs as the
node user (uid 1000) so saved presets/registry stay owned by you, and restarts
unless stopped. Reachable over Tailscale at `http://<this-host>:4319`. The router
runs inside the container against the mounted config via `ROUTER_PATH` /
`PASEO_DIR` (no host node needed). If your host user is not 1000:1000, set
`DOCKER_USER=$(id -u):$(id -g)` and uncomment `user:` in the compose file.

### Dev (no Docker)

```bash
cd model-router/ui
npm install
npm run dev      # http://localhost:4319
```

## How it works

- Paths come from `PASEO_DIR` and `ROUTER_PATH` env vars, falling back to
  `~/.paseo` and the sibling `../router.mjs` when unset (so host-native and Docker
  behave identically).

- `app/api/route`  -> spawns `node ../router.mjs --json ...` and returns the verdict.
- `app/api/options` -> lists presets + enum options + current provider_priority.
- `app/api/registry` (GET/PUT) -> reads/writes `provider_priority` (writes a `.ui-bak` backup first; only numeric source weights are overwritten, the `_note` is preserved).

## Notes

- Requires `~/.paseo/model-tiers.json` and `~/.paseo/presets/*.json` to exist (the router's registry + presets).
- Saving provider priority edits live config the running Paseo reads on demand.
