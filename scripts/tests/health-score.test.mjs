import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "../health-score.mjs");
const FIXTURES = join(HERE, "fixtures");

function run(args = [], { fixture, cwd, path: pathEnv } = {}) {
  const env = { ...process.env };
  if (fixture) env.HEALTH_SCORE_AISLOP_JSON = join(FIXTURES, fixture);
  if (pathEnv !== undefined) env.PATH = pathEnv;
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env, cwd });
}

function report(args = [], opts) {
  const result = run(args, opts);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function hasAislop() {
  return spawnSync("aislop", ["--version"], { encoding: "utf8" }).error === undefined;
}

function gitRepo(steps) {
  const dir = mkdtempSync(join(tmpdir(), "health-score-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  git("config", "commit.gpgsign", "false");
  steps({ dir, git, write: (name, body) => writeFileSync(join(dir, name), body) });
  return dir;
}

test("output is byte-identical across runs", () => {
  const first = run([], { fixture: "scoreable.json" });
  const second = run([], { fixture: "scoreable.json" });
  assert.equal(first.status, 0);
  assert.equal(first.stdout, second.stdout);
});

test("output carries no upstream timing field", () => {
  const raw = run([], { fixture: "scoreable.json" }).stdout;
  assert.ok(!raw.includes("elapsed"), "timing field leaked into output");
});

test("a valid-JSON scan is parsed even though aislop exits non-zero on findings", () => {
  const parsed = report([], { fixture: "scoreable.json" });
  assert.ok(parsed.files.length > 0);
  assert.equal(parsed.scoreable, true);
});

test("a missing aislop binary is reported as a named prerequisite", () => {
  const result = run(["."], { path: "/nonexistent-path-for-test" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /aislop/);
});

test("unparseable aislop output is reported as an aislop failure, not a missing binary", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-bad-"));
  const bad = join(dir, "bad.json");
  writeFileSync(bad, "not json at all");
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: bad },
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /missing prerequisite/);
  rmSync(dir, { recursive: true, force: true });
});

// The fixture cases cannot cover this: they never spawn the binary, so a
// regression in exit-code handling would pass every one of them.
test("live aislop run against a tree with findings still scores", { skip: hasAislop() ? false : "aislop not on PATH" }, () => {
  const repo = resolve(HERE, "../..");
  const result = spawnSync(process.execPath, [SCRIPT, "model-router/"], { encoding: "utf8", cwd: repo });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.scoreable, true);
  assert.doesNotMatch(result.stderr, /missing prerequisite/);
});

test("blocking is true for errors and fixable warnings only", () => {
  const byPath = new Map(report([], { fixture: "severities.json" }).files.map((f) => [f.path, f]));
  assert.equal(byPath.get("a.js").blocking, true, "error");
  assert.equal(byPath.get("b.js").blocking, true, "fixable warning");
  assert.equal(byPath.get("c.js").blocking, false, "non-fixable warning");
  assert.equal(byPath.get("d.js").blocking, false, "info");
});

test("deficit sums severity weights and score clamps into range", () => {
  const byPath = new Map(report([], { fixture: "severities.json" }).files.map((f) => [f.path, f]));
  assert.equal(byPath.get("a.js").deficit, 3);
  assert.equal(byPath.get("c.js").deficit, 1);
  assert.equal(byPath.get("d.js").deficit, 0.25);
  for (const file of byPath.values()) {
    assert.ok(file.score >= 0 && file.score <= 100);
  }
});

test("an unscoreable scope reports coverage and no per-file scores", () => {
  const parsed = report([], { fixture: "unscoreable.json" });
  assert.equal(parsed.scoreable, false);
  assert.deepEqual(parsed.files, []);
  assert.equal(parsed.coverage.unsupportedFiles, 42);
});

test("an unexpected schemaVersion warns without failing", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-schema-"));
  const drifted = join(dir, "drifted.json");
  writeFileSync(drifted, JSON.stringify({ schemaVersion: "2", cliVersion: "0.12.0", scoreable: true, coverage: {}, diagnostics: [] }));
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: drifted },
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /schemaVersion/);
  rmSync(dir, { recursive: true, force: true });
});

test("higher churn outranks equal deficit", () => {
  const dir = gitRepo(({ git, write }) => {
    write("hot.js", "a\n");
    write("cold.js", "a\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    for (let i = 0; i < 5; i++) {
      write("hot.js", `a${i}\n`);
      git("commit", "-qam", `hot ${i}`);
    }
  });
  const scan = join(dir, "scan.json");
  writeFileSync(scan, JSON.stringify({
    schemaVersion: "1", cliVersion: "0.12.0", score: 50, label: "x", scoreable: true,
    coverage: { supportedFiles: 2, unsupportedFiles: 0 },
    diagnostics: [
      { filePath: "cold.js", engine: "lint", rule: "r", severity: "warning", fixable: false },
      { filePath: "hot.js", engine: "lint", rule: "r", severity: "warning", fixable: false },
    ],
  }));
  const parsed = JSON.parse(spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", cwd: dir, env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: scan },
  }).stdout);
  assert.equal(parsed.files[0].path, "hot.js");
  assert.equal(parsed.files[0].deficit, parsed.files[1].deficit);
  assert.ok(parsed.files[0].churn.commits > parsed.files[1].churn.commits);
  rmSync(dir, { recursive: true, force: true });
});

test("churn follows renames", () => {
  const dir = gitRepo(({ git, write }) => {
    write("old.js", "a\n");
    git("add", "-A");
    git("commit", "-qm", "one");
    write("old.js", "b\n");
    git("commit", "-qam", "two");
    git("mv", "old.js", "new.js");
    git("commit", "-qm", "rename");
    write("new.js", "c\n");
    git("commit", "-qam", "four");
  });
  const scan = join(dir, "scan.json");
  writeFileSync(scan, JSON.stringify({
    schemaVersion: "1", cliVersion: "0.12.0", score: 50, label: "x", scoreable: true,
    coverage: { supportedFiles: 1, unsupportedFiles: 0 },
    diagnostics: [{ filePath: "new.js", engine: "lint", rule: "r", severity: "warning", fixable: false }],
  }));
  const parsed = JSON.parse(spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", cwd: dir, env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: scan },
  }).stdout);
  assert.equal(parsed.files[0].churn.commits, 4, "pre-rename commits must count");
  rmSync(dir, { recursive: true, force: true });
});

test("an untracked file is ranked on deficit alone, not dropped", () => {
  const dir = gitRepo(({ git, write }) => {
    write("tracked.js", "a\n");
    git("add", "-A");
    git("commit", "-qm", "init");
    write("loose.js", "a\n");
  });
  const scan = join(dir, "scan.json");
  writeFileSync(scan, JSON.stringify({
    schemaVersion: "1", cliVersion: "0.12.0", score: 50, label: "x", scoreable: true,
    coverage: { supportedFiles: 2, unsupportedFiles: 0 },
    diagnostics: [{ filePath: "loose.js", engine: "lint", rule: "r", severity: "error", fixable: false }],
  }));
  const parsed = JSON.parse(spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", cwd: dir, env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: scan },
  }).stdout);
  const loose = parsed.files.find((f) => f.path === "loose.js");
  assert.ok(loose, "untracked file must still be ranked");
  assert.equal(loose.churn.tracked, false);
  assert.equal(loose.churn.commits, 0);
  assert.equal(loose.churn.lastCommit, null);
  assert.equal(loose.hotspot, loose.deficit);
  rmSync(dir, { recursive: true, force: true });
});

// aislop documents --base as "diff base for --changes", so passing it through
// alone would score the full scope while reporting it as scoped.
// Every other test runs same-day, so swapping head.date for Date.now() would
// keep them all green while silently breaking the byte-identical guarantee.
test("the churn window is measured from HEAD, not the wall clock", () => {
  const dir = gitRepo(({ git, write }) => {
    write("old.js", "a\n");
    git("add", "-A");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "ancient", "--date=2020-01-01T00:00:00Z");
    write("old.js", "b\n");
    git("commit", "-qam", "also ancient", "--date=2020-01-02T00:00:00Z");
  });
  spawnSync("git", ["commit", "--amend", "--no-edit", "--date=2020-01-02T00:00:00Z"], {
    cwd: dir,
    env: { ...process.env, GIT_COMMITTER_DATE: "2020-01-02T00:00:00Z" },
  });
  const scan = join(dir, "scan.json");
  writeFileSync(scan, JSON.stringify({
    schemaVersion: "1", cliVersion: "0.12.0", score: 50, label: "x", scoreable: true,
    coverage: { supportedFiles: 1, unsupportedFiles: 0 },
    diagnostics: [{ filePath: "old.js", engine: "lint", rule: "r", severity: "warning", fixable: false }],
  }));
  const parsed = JSON.parse(spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", cwd: dir, env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: scan },
  }).stdout);
  // Every commit predates today by years. A wall-clock window would exclude
  // them all; a HEAD-relative window includes them.
  assert.ok(parsed.files[0].churn.commits > 0, "window must be relative to HEAD, not to today");
  rmSync(dir, { recursive: true, force: true });
});

test("a scoreable scope with no diagnostics is empty, not unscoreable", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-clean-"));
  const clean = join(dir, "clean.json");
  writeFileSync(clean, JSON.stringify({
    schemaVersion: "1", cliVersion: "0.12.0", score: 100, label: "Healthy", scoreable: true,
    coverage: { supportedFiles: 9, unsupportedFiles: 0 }, diagnostics: [],
  }));
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: clean },
  });
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.scoreable, true, "clean is not the same as unscoreable");
  assert.deepEqual(parsed.files, []);
  rmSync(dir, { recursive: true, force: true });
});

test("an aislop error response is a failure, never a clean scope", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-err-"));
  const errored = join(dir, "err.json");
  writeFileSync(errored, JSON.stringify({ error: "Path does not exist: /no/such/path" }));
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: errored },
  });
  assert.notEqual(result.status, 0, "an errored scan must not exit 0");
  assert.match(result.stderr, /Path does not exist/);
  assert.doesNotMatch(result.stdout, /"scoreable": true/);
  rmSync(dir, { recursive: true, force: true });
});

test("a scan with no scoreable flag is refused rather than assumed healthy", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-noflag-"));
  const vague = join(dir, "vague.json");
  writeFileSync(vague, JSON.stringify({ schemaVersion: "1", cliVersion: "0.12.0", diagnostics: [] }));
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: vague },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scoreable/);
  rmSync(dir, { recursive: true, force: true });
});

test("malformed --top and a valueless --base are rejected, not silently ignored", () => {
  for (const args of [["--top", "abc"], ["--top", "0"], ["--top", "-1"], ["--base"]]) {
    const result = run(args, { fixture: "scoreable.json" });
    assert.notEqual(result.status, 0, `${args.join(" ")} must not exit 0`);
    assert.match(result.stderr, /requires/);
  }
  assert.equal(report(["--top", "2"], { fixture: "scoreable.json" }).files.length, 2);
});

test("an unweighted severity is counted, warned about, and never scored as clean", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-sev-"));
  const odd = join(dir, "odd.json");
  writeFileSync(odd, JSON.stringify({
    schemaVersion: "1", cliVersion: "0.12.0", score: 50, label: "x", scoreable: true,
    coverage: { supportedFiles: 1, unsupportedFiles: 0 },
    diagnostics: [{ filePath: "x.js", engine: "lint", rule: "r", severity: "critical", fixable: true }],
  }));
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8", env: { ...process.env, HEALTH_SCORE_AISLOP_JSON: odd },
  });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /unweighted aislop severities/);
  const file = JSON.parse(result.stdout).files[0];
  assert.equal(file.diagnostics.unknown, 1, "unknown severities land in a declared bucket");
  assert.ok(!("critical" in file.diagnostics), "no undeclared key is injected into the schema");
  rmSync(dir, { recursive: true, force: true });
});

test("per-severity counts are tallied independently of the fixable count", () => {
  const byPath = new Map(report([], { fixture: "severities.json" }).files.map((f) => [f.path, f]));
  assert.deepEqual(byPath.get("a.js").diagnostics, { error: 1, warning: 0, info: 0, unknown: 0, fixable: 0 });
  assert.deepEqual(byPath.get("b.js").diagnostics, { error: 0, warning: 1, info: 0, unknown: 0, fixable: 1 });
  assert.deepEqual(byPath.get("d.js").diagnostics, { error: 0, warning: 0, info: 1, unknown: 0, fixable: 0 });
});

test("the aislop version reaches the output", () => {
  assert.equal(report([], { fixture: "scoreable.json" }).tool.aislopVersion, "0.12.0");
});

test("--base implies --changes, since --base alone scopes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "health-score-shim-"));
  const argvLog = join(dir, "argv.txt");
  const shim = join(dir, "aislop");
  writeFileSync(shim, `#!/bin/sh\nprintf '%s\\n' "$@" > ${argvLog}\necho '{"schemaVersion":"1","cliVersion":"0.0.0","scoreable":true,"coverage":{},"diagnostics":[]}'\n`, { mode: 0o755 });

  const result = spawnSync(process.execPath, [SCRIPT, "--base", "HEAD~1"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, HEALTH_SCORE_AISLOP_JSON: "" },
  });
  assert.equal(result.status, 0, result.stderr);

  const argv = readFileSync(argvLog, "utf8").split("\n").filter(Boolean);
  assert.ok(argv.includes("--base"), "argv must carry --base");
  assert.ok(argv.includes("--changes"), "argv must add --changes alongside --base");
  rmSync(dir, { recursive: true, force: true });
});
