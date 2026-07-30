#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

// Unvalidated starting guesses. Tests assert ordering, never these magnitudes.
const SEVERITY_WEIGHT = { error: 3, warning: 1, info: 0.25 };
const DEFICIT_TO_POINTS = 6;
const CHURN_WINDOW_DAYS = 180;

const SCRIPT_VERSION = "1.0";
const EXPECTED_SCHEMA = "1";

const USAGE = `Usage: health-score.mjs [path] [options]

  --base <ref>    score only files changed against <ref> (implies --changes)
  --changes       score only files changed from HEAD
  --staged        score only staged files
  --top <n>       emit only the top n files by hotspot
  --human         human-readable table instead of JSON
  --help          show this message
`;

function requireValue(flag, value) {
  if (value === undefined || value.startsWith("-")) throw new Error(`${flag} requires a value`);
  return value;
}

function requireCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) throw new Error(`--top requires a positive integer, got: ${value}`);
  return count;
}

function parseArgs(argv) {
  const opts = { path: ".", base: null, changes: false, staged: false, top: null, human: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    else if (arg === "--base") opts.base = requireValue(arg, argv[++i]);
    else if (arg === "--changes") opts.changes = true;
    else if (arg === "--staged") opts.staged = true;
    else if (arg === "--top") opts.top = requireCount(requireValue(arg, argv[++i]));
    else if (arg === "--human") opts.human = true;
    else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    else opts.path = arg;
  }
  return opts;
}

// aislop documents --base as "diff base for --changes", so it filters nothing on
// its own. Passing it through alone would score the full scope and call it scoped.
function aislopArgs(opts) {
  const args = ["scan", "--json"];
  if (opts.changes || opts.base) args.push("--changes");
  if (opts.staged) args.push("--staged");
  if (opts.base) args.push("--base", opts.base);
  args.push(opts.path);
  return args;
}

function runAislop(opts) {
  const override = process.env.HEALTH_SCORE_AISLOP_JSON;
  if (override) return assertScanUsable(JSON.parse(readFileSync(override, "utf8")));

  const result = spawnSync("aislop", aislopArgs(opts), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === "ENOENT") {
    throw new Error("missing prerequisite: aislop is not installed or not on PATH");
  }
  // aislop exits 1 whenever the tree holds an error-severity finding, while still
  // emitting complete JSON. Exit code is not a failure signal here.
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`aislop failed (exit ${result.status}): ${result.stderr?.trim() || "no stderr"}`);
  }
  return assertScanUsable(parsed);
}

// An aislop error is JSON too: {"error": "Path does not exist: ..."} with no
// scoreable key. Left unchecked it reads as a clean scope with zero findings,
// so a failed scan would report as "nothing to fix".
function assertScanUsable(scan) {
  if (scan.error) throw new Error(`aislop could not scan: ${scan.error}`);
  if (typeof scan.scoreable !== "boolean") {
    throw new Error("aislop returned no scoreable flag; refusing to report an unscored scope as clean");
  }
  return scan;
}

function git(args, cwd) {
  const result = spawnSync("git", args, { encoding: "utf8", cwd });
  return result.status === 0 ? result.stdout.trim() : null;
}

function repoRoot() {
  return git(["rev-parse", "--show-toplevel"]) ?? process.cwd();
}

function headInfo(root) {
  const line = git(["log", "-1", "--format=%H %cI"], root);
  if (!line) return null;
  const [sha, date] = line.split(" ");
  return { sha, date };
}

function windowStart(headDate) {
  const start = new Date(headDate);
  start.setUTCDate(start.getUTCDate() - CHURN_WINDOW_DAYS);
  return start.toISOString();
}

// --follow matters: without it a renamed file loses its pre-rename commits, and a
// rename is itself a recent edit, so the undercount lands on the hottest files.
function churnFor(path, root, since) {
  const all = git(["log", "--follow", "--format=%cI", "--", path], root);
  if (!all) return { tracked: false, commits: 0, lastCommit: null };
  const windowed = git(["log", "--follow", "--format=%cI", `--since=${since}`, "--", path], root);
  const dates = windowed ? windowed.split("\n").filter(Boolean) : [];
  return { tracked: true, commits: dates.length, lastCommit: all.split("\n")[0] };
}

// aislop reports paths relative to the directory it scanned, so a scoped run
// yields bare names that resolve from the scope dir, not from cwd.
function toRepoPath(filePath, root, scopeDir) {
  if (isAbsolute(filePath)) return relative(root, filePath);
  for (const base of [scopeDir, process.cwd(), root]) {
    const abs = resolve(base, filePath);
    if (existsSync(abs)) return relative(root, abs);
  }
  return filePath;
}

function rollUp(diagnostics, onUnknownSeverity) {
  const byFile = new Map();
  for (const d of diagnostics) {
    if (!(d.severity in SEVERITY_WEIGHT)) onUnknownSeverity(d.severity);
    const entry = byFile.get(d.filePath) ?? {
      deficit: 0,
      diagnostics: { error: 0, warning: 0, info: 0, unknown: 0, fixable: 0 },
      byEngine: {},
      scoreImpact: [],
      blocking: false,
    };
    entry.deficit += SEVERITY_WEIGHT[d.severity] ?? 0;
    if (d.severity in entry.diagnostics) entry.diagnostics[d.severity]++;
    else entry.diagnostics.unknown++;
    if (d.fixable) entry.diagnostics.fixable++;
    entry.byEngine[d.engine] = (entry.byEngine[d.engine] ?? 0) + 1;
    // Carried for human inspection only. aislop does not document how caps combine
    // across diagnostics, so they stay out of the arithmetic.
    if (d.scoreImpact) entry.scoreImpact.push({ rule: d.rule, ...d.scoreImpact });
    if (d.severity === "error" || (d.severity === "warning" && d.fixable)) entry.blocking = true;
    byFile.set(d.filePath, entry);
  }
  return byFile;
}

function scoreOf(deficit) {
  return Math.min(100, Math.max(0, 100 - Math.round(deficit * DEFICIT_TO_POINTS)));
}

function buildFiles(byFile, root, since, scopeDir) {
  const files = [];
  for (const [filePath, entry] of byFile) {
    const path = toRepoPath(filePath, root, scopeDir);
    const churn = churnFor(path, root, since);
    files.push({
      path,
      score: scoreOf(entry.deficit),
      deficit: Number(entry.deficit.toFixed(2)),
      hotspot: Number((entry.deficit * Math.max(churn.commits, 1)).toFixed(2)),
      diagnostics: entry.diagnostics,
      byEngine: entry.byEngine,
      scoreImpact: entry.scoreImpact,
      churn,
      blocking: entry.blocking,
    });
  }
  files.sort((a, b) => b.hotspot - a.hotspot || a.path.localeCompare(b.path));
  return files;
}

function humanTable(report) {
  if (!report.scoreable) return `scope ${report.scope} is unscoreable by aislop (supported files: ${report.coverage?.supportedFiles ?? 0})`;
  const rows = report.files.map((f) => [f.path, String(f.score), String(f.hotspot), String(f.churn.commits), f.blocking ? "BLOCKING" : ""]);
  const header = ["path", "score", "hotspot", "commits", ""];
  const widths = header.map((_, i) => Math.max(...[header, ...rows].map((r) => r[i].length)));
  const line = (r) => r.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd();
  return [line(header), ...rows.map(line)].join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(USAGE);
    return;
  }

  const scan = runAislop(opts);
  if (scan.schemaVersion !== EXPECTED_SCHEMA) {
    process.stderr.write(`warning: unexpected aislop schemaVersion ${scan.schemaVersion}, expected ${EXPECTED_SCHEMA}\n`);
  }

  const root = repoRoot();
  const head = headInfo(root);
  const report = {
    tool: { aislopVersion: scan.cliVersion ?? null, scriptVersion: SCRIPT_VERSION },
    scope: opts.path,
    head,
    scoreable: scan.scoreable,
    coverage: { supportedFiles: scan.coverage?.supportedFiles ?? 0, unsupportedFiles: scan.coverage?.unsupportedFiles ?? 0 },
    project: { score: scan.score ?? null, label: scan.label ?? null },
    files: [],
  };

  if (report.scoreable) {
    const since = head ? windowStart(head.date) : new Date(0).toISOString();
    const unknown = new Set();
    const rolled = rollUp(scan.diagnostics ?? [], (severity) => unknown.add(severity));
    if (unknown.size > 0) {
      process.stderr.write(`warning: unweighted aislop severities scored as 0: ${[...unknown].sort().join(", ")}\n`);
    }
    report.files = buildFiles(rolled, root, since, resolve(process.cwd(), opts.path));
    if (opts.top !== null) report.files = report.files.slice(0, opts.top);
  }

  process.stdout.write(opts.human ? `${humanTable(report)}\n` : `${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
