// Two-layer regression harness for model-router/router.mjs. See design.md
// "Harness shape: two layers" for the rationale behind each layer.
//
// Layer 1 (golden snapshots): every CASES entry passes --no-ledger against frozen
// fixtures, so output is byte-identical run to run. Proves behavior unchanged.
//
// Layer 2 (ledger-enabled smoke): runs WITHOUT --no-ledger, the one path layer 1
// cannot reach, with ROUTER_LOAD_LEDGER pointed at an ephemeral file so it never
// touches the real ~/.paseo/router-load.jsonl. Asserts structure, not exact scores.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ROUTER = path.join(REPO_ROOT, "model-router", "router.mjs");
const SNAPSHOT_PATH = path.join(__dirname, "snapshots.json");
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

function runRouter(args, env = {}) {
  return execFileSync("node", [ROUTER, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function loadSnapshots() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return {};
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
}

// Recursively walk two values and collect every JSON-path where they differ.
// A bare "snapshot mismatch" is useless against a full candidate list; this is
// what makes a failure actually actionable (task 1.7).
function diffPaths(expected, actual, prefix = "$") {
  const diffs = [];
  if (expected === actual) return diffs;
  const bothObjects = expected && actual && typeof expected === "object" && typeof actual === "object";
  if (!bothObjects) {
    diffs.push(`${prefix}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    return diffs;
  }
  const expArr = Array.isArray(expected);
  const actArr = Array.isArray(actual);
  if (expArr !== actArr) {
    diffs.push(`${prefix}: expected ${expArr ? "array" : "object"}, got ${actArr ? "array" : "object"}`);
    return diffs;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    const childPrefix = expArr ? `${prefix}[${key}]` : `${prefix}.${key}`;
    if (!(key in expected)) {
      diffs.push(`${childPrefix}: missing in expected, got ${JSON.stringify(actual[key])}`);
      continue;
    }
    if (!(key in actual)) {
      diffs.push(`${childPrefix}: expected ${JSON.stringify(expected[key])}, missing in actual`);
      continue;
    }
    diffs.push(...diffPaths(expected[key], actual[key], childPrefix));
  }
  return diffs;
}

const existingSnapshots = loadSnapshots();
const updatedSnapshots = {};

// --- Layer 1: golden snapshots ---
for (const { id, args } of CASES) {
  test(`golden: ${id}`, () => {
    const stdout = runRouter(args);
    const actual = JSON.parse(stdout);

    if (UPDATE) {
      updatedSnapshots[id] = actual;
      return;
    }

    const expected = existingSnapshots[id];
    assert.ok(expected !== undefined, `no snapshot recorded for case "${id}"; run with UPDATE_SNAPSHOTS=1 first`);
    const diffs = diffPaths(expected, actual);
    assert.deepEqual(diffs, [], `case "${id}" diverged from its snapshot:\n${diffs.join("\n")}`);
  });
}

after(() => {
  if (!UPDATE) return;
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(updatedSnapshots, null, 2)}\n`);
});

// --- Task 1.9: error-path case (no JSON stdout, its own assertion shape) ---
test("error-path: all candidates eliminated", () => {
  const args = [
    "--role", "impl",
    "--task", "t-impossible",
    "--requires", "vision,computer-use,audio,video",
    "--preset", "model-router/tests/fixtures/preset-cloud.json",
    "--model-tiers", "model-router/tests/fixtures/registry.json",
    "--no-ledger",
    "--json",
  ];
  assert.throws(
    () => runRouter(args),
    (err) => {
      assert.equal(err.status, 1, `expected exit code 1, got ${err.status}`);
      assert.match(String(err.stderr), /All candidates eliminated for role/);
      return true;
    },
  );
});

// --- Layer 2: ledger-enabled smoke (task 1.8) ---
// Never --no-ledger here on purpose: this is the one path every layer-1 case is
// structurally unable to reach (design.md "Layer 2, ledger-enabled smoke").
let ledgerDir;
before(() => {
  ledgerDir = fs.mkdtempSync(path.join(os.tmpdir(), "router-golden-ledger-"));
});
after(() => {
  if (ledgerDir) fs.rmSync(ledgerDir, { recursive: true, force: true });
});

const REASON_SHAPE = /^[+-][\d.]+ \S/;
const DOUBLE_SIGN = /^[+-][\d.]+ [+-][\d.]+ /;

// A fresh ephemeral ledger has inflight=0, usage=0, and (for a non-local preset)
// never reaches the host-saturation branch either, so loadAdjustment()'s in-flight
// branch never fires and merge() is never exercised with a nonzero, non-empty
// result -- add() vs merge() becomes indistinguishable regardless of real host
// state. Seeding a live, unreleased reservation for the preset's own provider
// source forces the in-flight branch deterministically, on every run, on any
// machine, independent of ambient CPU/memory load.
const smokeCases = [
  { id: "smoke-cloud", preset: "preset-cloud.json", seedSrc: "litellm" },
  { id: "smoke-local", preset: "preset-local.json", seedSrc: "local" },
];

function seedInflight(ledgerFile, src, count = 3) {
  const now = Date.now();
  const lines = Array.from({ length: count }, (_, i) =>
    JSON.stringify({ t: "res", key: `smoke-seed-${i}`, src, id: `smoke-seed-${src}-${i}`, at: now }),
  );
  fs.writeFileSync(ledgerFile, `${lines.join("\n")}\n`);
}

for (const { id, preset, seedSrc } of smokeCases) {
  test(`smoke: ${id}`, () => {
    const ledgerFile = path.join(ledgerDir, `${id}.jsonl`);
    seedInflight(ledgerFile, seedSrc);
    const stdout = runRouter(
      [
        "--role", "impl",
        "--task", `t-${id}`,
        "--preset", `model-router/tests/fixtures/${preset}`,
        "--model-tiers", "model-router/tests/fixtures/registry.json",
        "--json",
      ],
      { ROUTER_LOAD_LEDGER: ledgerFile },
    );
    const parsed = JSON.parse(stdout);
    assert.ok(typeof parsed.result.provider === "string" && parsed.result.provider.length > 0);

    const pool = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "model-router", "tests", "fixtures", preset), "utf8"),
    ).providers.impl;
    assert.ok(pool.includes(parsed.result.provider), `provider ${parsed.result.provider} not in requested role's pool`);

    // Prove the merge() path was actually exercised this run, not just structurally
    // present: at least one non-eliminated candidate must carry an in-flight reason
    // sourced from the seeded reservations above. Without this, the assertions below
    // would still pass on a ledger that silently stopped feeding through merge().
    const inflightReasons = (parsed.result.scores ?? [])
      .filter((c) => !c.eliminated)
      .flatMap((c) => c.reasons ?? [])
      .filter((r) => r.includes(`in-flight`) && r.includes(seedSrc));
    assert.ok(
      inflightReasons.length > 0,
      `expected at least one in-flight reason for src "${seedSrc}" (seeded ${3} reservations); merge() path was not exercised`,
    );

    for (const candidate of parsed.result.scores ?? []) {
      if (candidate.eliminated) continue; // "ELIMINATED: ..." is a different message shape entirely
      for (const reason of candidate.reasons ?? []) {
        assert.match(reason, REASON_SHAPE, `malformed reason string: ${JSON.stringify(reason)}`);
        assert.doesNotMatch(
          reason,
          DOUBLE_SIGN,
          `reason string looks double-formatted (add() used where merge() was required): ${JSON.stringify(reason)}`,
        );
      }
    }
  });
}

test("smoke: real production ledger untouched", () => {
  const realLedger = path.join(os.homedir(), ".paseo", "router-load.jsonl");
  const before = fs.existsSync(realLedger) ? fs.statSync(realLedger).mtimeMs : null;
  runRouter(
    [
      "--role", "impl", "--task", "t-isolation-check",
      "--preset", "model-router/tests/fixtures/preset-cloud.json",
      "--model-tiers", "model-router/tests/fixtures/registry.json",
      "--json",
    ],
    { ROUTER_LOAD_LEDGER: path.join(ledgerDir, "isolation-check.jsonl") },
  );
  const after_ = fs.existsSync(realLedger) ? fs.statSync(realLedger).mtimeMs : null;
  assert.equal(before, after_, "real ~/.paseo/router-load.jsonl was touched by the smoke layer");
});
