---
name: paseo-boo
description: >
  Routes a BooSkills skill to a true Paseo subagent with role-based provider
  routing from the active orchestration preset. Use when the user wants a
  booskills skill (boo-reviewing-code, boo-investigating-failures, boo-researching,
  boo-planning-changes, boo-implementing-changes, boo-auditing-code-quality,
  boo-analyzing-architecture, boo-mapping-project-context, boo-critiquing-frontend,
  boo-building-ui, boo-refactoring-code, boo-validating-changes) run as
  a Paseo agent, says "boo <skill>" or "/paseo-boo", or asks for specialist
  work fanned out to Paseo-managed agents. Do NOT use to run a skill inline in
  the current session; invoke the skill directly instead. Do NOT use for
  boo-refining-ideas, which is interactive and runs inline. Do NOT use for
  multi-skill pipelines from one goal; use boo-meta.
metadata:
  version: "1.5"
---

# Paseo-Boo Router

Dispatches BooSkills skills to Paseo subagents. This skill contains routing and dispatch logic only: prompt composition, permission supervision, and artifact verification are dispatch concerns. All domain knowledge lives in the skill being dispatched and the agent personas it references.

## Prerequisites

Read the **paseo** skill first. It owns the Paseo agent lifecycle: the `create_agent` / `archive_agent` tool surface, the attached-vs-detached subagent model, provider resolution, and the waiting rules. This skill adds only what is specific to routing a booskills skill: skill-to-role mapping, the dispatch prompt, permission posture, artifact verification, and closure. Where the two disagree, the paseo skill wins on mechanics; do not re-derive lifecycle behavior here.

## Size

Pass-through. If the operator gives a size ($size or words like "large review"), forward it verbatim as the first argument of the dispatched skill. Never classify size here; the dispatched skill sizes its own work.

## Process

1. Resolve the skill to dispatch. Accept the booskills skill name or a close alias ("review this branch" means boo-reviewing-code, "why is this failing" means boo-investigating-failures). If the request maps to no booskills skill, stop and say which skills exist.
2. Read `~/.paseo/orchestration-preferences.json` with an actual file read. Never rely on remembered or default provider strings.
3. Map the skill to a provider role category:
   - boo-reviewing-code, boo-auditing-code-quality, boo-investigating-failures, boo-analyzing-architecture, boo-validating-changes: `audit`
   - boo-researching, boo-mapping-project-context: `research`
   - boo-planning-changes: `planning`
   - boo-implementing-changes, boo-refactoring-code: `impl`
   - boo-critiquing-frontend, boo-building-ui: `ui`
4. Resolve the target working directory: the repo the work concerns, not this session's cwd, unless they are the same. Ask only if genuinely ambiguous.
5. Compose the dispatch prompt. It must be self-contained for a fresh context:
   - "Read `~/.agents/skills/<skill-name>/SKILL.md` and execute it exactly. Your agent personas live in the booskills repo's agents/ directory; follow that skill's subagent dispatch rule: when the Paseo MCP tools are available, spawn each persona as an attached Paseo subagent via `create_agent` so it shows in the operator's agent track; otherwise fall back to native subagents, or sequential persona passes where there is no subagent dispatch."
   - The operator's task statement and any $size override.
   - The standing rules: never commit, never push, never `git add -A`; prove edits with `git diff --stat`; no em dashes in outputs.
   - Weave in any `preferences` strings from orchestration-preferences.json that apply to the role.
6. Resolve the provider and reserve the load slot in one call. Generate a short dispatch id (for example `boo-<role>-<epoch>`). Run the router so it picks the provider AND records the pick as in-flight, so a concurrent sibling dispatch sees the load and spreads off a crowded provider:
   ```
   node ~/.agents/skills/boo-router/scripts/router.mjs --role <role> --task "<task>" \
     --preset ~/.paseo/orchestration-preferences.json --reserve <dispatchId> --json
   ```
   Read `result.provider` and keep `<dispatchId>` for the release at closure. Reserve at route time, before `create_agent`, so the slot is visible to siblings the instant it is taken. This applies to pinned roles too (the router returns the pinned string and still records the dispatch), so every fan-out feeds the shared load ledger, not just array-pool roles. Then launch as an **attached subagent** with the Paseo MCP `create_agent` tool so the agent appears in your subagent track. The `paseo run` CLI cannot create a tracked subagent; use the MCP tool. Pass:
   - `title`: "<skill>: <short task>"
   - `provider`: the resolved provider string (for example `claude/opus`)
   - `cwd`: the target dir
   - `initialPrompt`: the composed prompt
   - `detached: false` (the default) so the agent is your subagent, shown in the track and archived with you
   - `notifyOnFinish: true` so you are notified on finish, error, or permission request
   - For an OpenCode-family provider (the provider id is `opencode` or extends it), pass `settings: { modeId: "build", features: { auto_accept: true } }`. Both keys are required: an explicit `modeId` is mandatory because a Claude caller in `bypassPermissions` mode cannot pass that mode down to an opencode child (`create_agent` errors with "cannot inherit mode 'bypassPermissions'... Available modes: build, plan"); `auto_accept` makes the worker (and the personas it fans out) auto-approve OpenCode tool-permission prompts instead of stalling, since Paseo only auto-defaults that for unattended loop/schedule workers, not a normal `create_agent`. Use `modeId: "plan"` instead of `"build"` only if the dispatched skill is strictly read-only and must be barred from edits at the mode level.
   Capture the returned `agentId`. If the Paseo MCP tools (`mcp__paseo__*`) are not available in this session (you were not launched by Paseo, e.g. a plain CLI), do not use `create_agent`; follow the CLI fallback below instead.
7. Supervise on the finish notification only. Because the agent runs with `notifyOnFinish: true`, do NOT call `wait_for_agent` and do NOT poll `get_agent_status` or `list_agents` to check on it (paseo skill rule); move on and let the notification arrive. The notification also fires on errors and permission requests. Two distinct permission layers: OpenCode tool-permission prompts (edit/run inside the worker) are auto-accepted by the `auto_accept` feature set at dispatch and never reach you; Paseo access requests (for example `external_directory` outside the cwd) still surface here. For the latter, read it with `list_pending_permissions` and approve with `respond_to_permission` only for read-only directory scopes inside the target repo or its named reference paths; surface everything else to the operator.
8. Retrieval: when the finish notification arrives, read the agent's report with `get_agent_activity` (a one-time read after finish, not a poll), and verify any artifact it claims to have written actually exists.
9. Closure: relay the outcome with the agent id, then `archive_agent` the subagent once its report is relayed and artifacts verified. Skip the archive only when the operator wants follow-ups on the same agent (a persistent dispatch); otherwise an attached subagent left open just archives with you later. Never archive an agent whose report you have not yet read. Release the load slot so the provider stops counting as in-flight: `node ~/.agents/skills/boo-router/scripts/router.mjs --release <dispatchId>`. Always release, including on a failed or errored dispatch, so a dead agent never holds a slot; the ledger also TTL-expires a reservation after 30 minutes as a backstop.

## CLI fallback (no Paseo MCP tools)

Use this only when `mcp__paseo__*` is absent (a session not launched by Paseo, such as a plain CLI). A tracked subagent is impossible here, since there is no parent agent for it to attach to, so the subagent-track popup will not appear in this mode. Run the dispatch through the `paseo` CLI, keeping the same dispatch -> retrieve -> close shape. Prerequisite: the `paseo` CLI is on PATH and the daemon is running (`paseo status`).

- Dispatch detached so you do not block: `paseo run -d --json --title "<skill>: <short task>" --provider <provider> --cwd <dir> "<prompt>"`. For an OpenCode-family provider, add `--mode full-access` so the worker auto-accepts OpenCode tool-permission prompts instead of stalling. Capture `agentId` from the JSON on stdout. (Never run without `-d`: foreground `paseo run` blocks for the whole 10-30 min run.)
- Supervise: a single background `paseo wait <agentId> --timeout <duration>`, never a foreground poll loop. Handle permission requests with `paseo permit` by the same read-only-scope rule as step 7.
- Retrieve: `paseo logs <agentId>`; verify any claimed artifact exists.
- Close: `paseo archive <agentId>` after relaying, then release the load slot: `node ~/.agents/skills/boo-router/scripts/router.mjs --release <dispatchId>`. A CLI-dispatched agent is detached and is NOT archived with you, so both the explicit archive and the release are required, not optional.
- In your output, say `CLI fallback: detached agent, no subagent track`.

## Composition rules

- boo-planning-changes output (a change folder) and boo-implementing-changes input meet only across dispatches: finish one agent, then launch the other fresh. Never chain them in one agent.
- Multiple independent dispatches (for example boo-reviewing-code on two branches) may run in parallel as separate `create_agent` calls; each is its own attached subagent in the track.
- For a full pipeline request ("plan and build X"), dispatch sequentially with an operator checkpoint between plan and implementation.

## What NOT to do

- Do not run the skill's work yourself; you route, the subagent executes.
- Do not hardcode or guess provider strings; the preferences file is the only source.
- Do not chain boo-planning-changes and boo-implementing-changes into one agent context.
- Do not dispatch boo-refining-ideas; it interviews the operator and must run inline.
- Do not dispatch boo-meta; routers route, they are not dispatched. A multi-skill goal goes to boo-meta inline, which may then route stages back through this skill.
- Do not auto-approve write or execute permissions outside the target repo.
- Do not restart the Paseo daemon for any reason without explicit operator approval.

## Gotchas

- Notify-on-finish agents must not be waited on or polled: no `wait_for_agent`, no `get_agent_status`/`list_agents` checking loop (paseo skill rule). Read the report with `get_agent_activity` once, after the finish notification fires.
- Paseo permission requests for reference directories (`external_directory`) arrive one subpath at a time; expect several per agent and approve by scope via `respond_to_permission`, never blanket.
- `create_agent` returns `{ agentId }`; capture it for the finish-time activity read, permission responses, follow-up prompts, and `archive_agent`.
- On the CLI fallback, `paseo wait` takes `--timeout <duration>`; `--wait-timeout` belongs to `paseo run` only. Capture `agentId` from `paseo run -d --json` stdout.
- Each skill is symlinked flat at `~/.agents/skills/<skill-name>` pointing at the repo's `skills/<skill-name>/` directory; the dispatched agent reads skills by path, so platform skill discovery is not required for routed dispatches.
- The preferences file also carries freeform `preferences` strings (commit policy, scope posture); they are operator law and go into every dispatch prompt.
- Load awareness lives in the shared ledger `~/.paseo/router-load.jsonl`. `--reserve` at route time and `--release` at closure are a matched pair keyed by the same dispatch id; a missing release leaks a slot until the 30 minute TTL reclaims it. The router only reads the ledger to spread load and respect per-provider 5h quotas; it never blocks a dispatch, so a stale ledger degrades to slightly stale load estimates, never a stall.
<!-- standing-rules:core:start -->
- **No commit**: never commit, push, or stage changes; never `git add -A`. Prove any edits with `git diff --stat`.
- **No em dashes**: never use em dashes (U+2014) in output or files you write.
<!-- standing-rules:core:end -->

## Output format

```
Dispatched: <skill-name> as Paseo agent <agentId>
Provider: <provider> (role: <category>, preset: <preset name>)
Cwd: <target dir>
Task: <one-line task statement>
Supervision: attached subagent, notify-on-finish (agentId <agentId>)
```

On completion, relay the subagent's own report verbatim plus:

```
Artifacts verified: <paths checked, or "none claimed">
Claims I did not verify
- <anything in the subagent report taken on its word>
Closure: archived agent <agentId> (or "kept open for follow-ups")
```

## Failure modes

- Preferences file missing: use `claude/sonnet` for every role, tell the operator once, and continue.
- Provider launch fails (provider not available): report the launch error verbatim (`create_agent`, or `paseo run` on the CLI fallback) and list available providers from `list_providers` (or `paseo provider`); do not silently substitute.
- Requested skill not in the catalog: list the booskills catalog (read `ls` of the skills directory, never a remembered count) and stop.
- Subagent ends with pending permissions the rules above do not cover: surface the request to the operator; never approve blind.
- Subagent reports completion but a claimed artifact does not exist: report the discrepancy as a failed dispatch; do not relay the success claim.
