# BooSkills Security & Code Quality Report

**Date:** 2026-06-15  
**Scope:** `model-router/router.mjs`, `model-router/ui/` (Next.js), `scripts/*.sh`

---

## Executive Summary

The shell scripts and CLI router are clean. The Next.js control UI (`model-router/ui/`) contains two medium-severity vulnerabilities: a path traversal that lets any Tailscale peer read arbitrary `.json` files from `~/.paseo/`, and a YAML injection that can manipulate OpenCode agent system prompts. Code quality is generally good but the router carries a dead `budget` field, divergent locality logic between two functions, and a handful of structural duplications.

---

## Security Findings

### SEC-001 (Medium)  --  Path Traversal via Unvalidated `duplicate` Parameter

**Location:** `model-router/ui/app/api/presets/route.js:33-35`, `model-router/ui/lib/paseo.js:33-38`

**Impact:** Any Tailscale peer with access to port 4319 can read any `.json` file under `~/.paseo/` (including `orchestration-preferences.json` and `model-tiers.json`) by creating a preset that duplicates a `../`-traversed path.

**Exploit path:**
```
POST /api/presets  body: {"name":"exfil","duplicate":"../model-tiers"}
  -> readPreset("../model-tiers")
  -> path.join(~/.paseo/presets, "../model-tiers.json")
  -> reads ~/.paseo/model-tiers.json
GET /api/presets/exfil  <- full registry contents returned
```

`body.duplicate` receives no validation. `body.name` is validated against `/^[a-z0-9-]+$/` but `body.duplicate` is not. `presetPath()` in `lib/paseo.js` performs no boundary assertion after `path.join`.

**Fix:**
```js
// presets/route.js  --  validate duplicate against the existing preset allowlist
if (body.duplicate) {
  const existing = await listPresets();
  if (!existing.includes(body.duplicate)) {
    return NextResponse.json({ error: `preset "${body.duplicate}" not found` }, { status: 404 });
  }
  const template = await readPreset(body.duplicate);
  await createPreset(trimmed, template);
}
```

Defense in depth  --  add boundary assertion in `lib/paseo.js`:
```js
function presetPath(name) {
  const resolved = path.join(PRESETS_DIR, `${name}.json`);
  if (!resolved.startsWith(PRESETS_DIR + path.sep)) throw new Error("path traversal rejected");
  return resolved;
}
```

---

### SEC-002 (Medium)  --  YAML Frontmatter Injection via Newline in Model Value

**Location:** `scripts/apply-agent-models.sh`  --  embedded Python `inject_model` function (line 95–106)

**Impact:** A newline-containing model ID in `~/.paseo/orchestration-preferences.json` injects arbitrary YAML keys into generated OpenCode agent files, allowing an attacker to override agent system prompts. Triggered remotely via the Tailscale-accessible UI's `PUT /api/presets/[name]` endpoint (which accepts arbitrary agent map values with no newline stripping).

**Exhibit:**
```python
# model value is not sanitized before interpolation
return f"---\n{fm_clean}\nmodel: {model}\n---{body}"
```

If `model = "safe-model\nsystem: malicious prompt"`, the output becomes:
```yaml
---
model: safe-model
system: malicious prompt
---
```

**Fix:**
```python
def inject_model(text, model):
    model = model.replace("\n", "").replace("\r", "")
    import re
    if not re.match(r'^[\w./:@-]+$', model.split("/")[-1]):
        raise ValueError(f"model value contains invalid characters: {model!r}")
    ...
```

---

### Network Exposure Note

`docker-compose.yml` acknowledges Tailscale reachability on port 4319 with no authentication. This is the threat actor for both SEC-001 and SEC-002. If all Tailscale peers are trusted, document that explicitly. If not, bind the container to loopback:
```yaml
ports:
  - "127.0.0.1:4319:4319"
```

---

### What Was Checked and Found Clean

- Shell scripts: all use `set -euo pipefail`, variables are quoted, `awk` receives data via `-v`, no user-controlled data reaches `eval` or command substitution.
- Router CLI: uses `execFile` (not `exec`) for subprocess calls  --  no shell injection possible even with adversarial `--task` or `--requires` values.
- Dependencies: `next@16.2.9`  --  CVE-2025-29927 (CVSS 9.1) does not apply because no middleware is defined. `react@19`, `@opencode-ai/plugin@1.16.2`  --  no known CVEs.
- Secrets: no hardcoded API keys, tokens, or credentials found across all files.

---

## Code Quality Findings

### Q1 (Operational risk)  --  Divergent Locality Definitions

**Location:** `model-router/router.mjs:88` (`isLocalProvider`) and `model-router/router.mjs:189` (`sourceOf`)

`isLocalProvider` only recognizes `==qwen==/` providers as local. `sourceOf` has an `==edge-` category that does NOT match `isLocalProvider`. An `==edge-` provider gets the `local-edge` provider-priority bonus but misses the fan-out penalty (`-80`) and the serial bonus (`+5`/`+20`) that `isLocalProvider` gates. Routing scores for any edge-local provider are silently wrong.

**Recommendation:** Unify under a single `localityOf(provider)` function returning `"qwen" | "edge" | "cloud"`, and derive both the provider-priority source and the economics bonuses from it.

---

### Q2 (Maintainability)  --  `request.budget` Validated but Dead

**Location:** `model-router/router.mjs:276` (validation), `router.mjs:418-419` (resolution)

`budget` is validated against the `BUDGETS` set but routing never reads `request.budget` after `priority` is resolved from it at line 419. The validation rejects calls that pass a non-canonical `budget` value even though only `priority` matters. The field appears in `--json` output and misleads callers into attributing routing significance to it.

**Recommendation:** Either remove the `budget` field from `request` after priority resolution, or remove its validation and document it as a legacy alias only.

---

### Q3 (Correctness)  --  `tierName` Computed Twice Per Candidate, Value Unused in Human Output

**Location:** `model-router/router.mjs:249, 257` (`scoreCandidate`), `router.mjs:379-387` (`printHuman`)

`tierName()` does a linear scan of the full registry for every candidate on every routing call. The `tier` field is never printed in `--json`-off mode. The only consumer is `--json` output, where it appears but is not used by any known caller.

**Recommendation:** Move `tierName` computation into the `--json` output path only, or memoize it.

---

### Q4 (Duplication)  --  Replicated `model_key` Logic Across Script Boundary

**Location:** `model-router/router.mjs:85` (`modelKey`), `scripts/apply-agent-models.sh:38-40` (embedded Python `model_key`)

Both functions extract the last path segment of a model ID. They will diverge if the extraction logic ever changes in one place. The Python also maintains a separate hardcoded `FALLBACK_FORBIDDEN` set that must be kept in sync with the router's registry-derived `neverSubagentSet`.

**Recommendation:** Long-term, make `apply-agent-models.sh` invoke `router.mjs --list-forbidden` (or similar) rather than reimplementing the derivation. Short-term, add a comment in both places noting the coupling.

---

### Q5 (Duplication)  --  `add()` Closure Defined Twice with Different Precision

**Location:** `model-router/router.mjs:154` (`fitScore`), `router.mjs:206` (`economics`)

The mutable-accumulator `add(points, reason)` pattern is structurally identical in both functions. The `if (points)` zero-suppression guard exists in both and must be maintained in sync.

---

### Q6 (Cohesion)  --  Partial Install on Codex Collision

**Location:** `scripts/install.sh:79-95`

When a codex skill collision is detected (line 89-93), the outer `continue` skips the codex `create_link` call  --  but the `~/.agents/skills` link was already created on line 86. The skill ends up half-installed: present in `~/.agents/skills`, absent from `~/.codex/skills`, with a `FAILED` count that implies nothing was installed.

---

### Q7 (Coupling)  --  `runSamples` Spreads Unfiltered CLI Args into Sample Objects

**Location:** `model-router/router.mjs:431-434`

`{ ...args, ... }` copies `dryRunSamples: true` into every sample object. More practically, samples hardcode `presetPath` to `~/.paseo/presets/workhorse.json`  --  if this file does not exist, `--dry-run-samples` throws a filesystem error with no diagnostic message.

---

## Summary Table

| ID | Severity | Area | Title |
|----|----------|------|-------|
| SEC-001 | Medium | UI API | Path traversal in `duplicate` preset parameter |
| SEC-002 | Medium | Shell script | YAML frontmatter injection via model value newlines |
| Q1 | Operational | router.mjs | Divergent locality logic between `isLocalProvider` and `sourceOf` |
| Q2 | Maintainability | router.mjs | `request.budget` validated but dead after priority resolution |
| Q3 | Performance | router.mjs | `tierName` computed per-candidate but unused in human output |
| Q4 | Duplication | router.mjs + sh | `model_key` logic and forbidden-set duplicated across script boundary |
| Q5 | Duplication | router.mjs | `add()` closure defined twice with divergent precision |
| Q6 | Cohesion | install.sh | Partial install when codex collision detected after agents/skills link created |
| Q7 | Coupling | router.mjs | `runSamples` spreads unfiltered args; hardcoded preset path |

---

*Report written to `security_best_practices_report.md`*
