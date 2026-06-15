// Server-only helpers for the model-router control panel.
// Resolves the sibling router.mjs and the ~/.paseo config it reads/writes.
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPO_MODEL_ROUTER = path.resolve(process.cwd(), "..");
// Paths are env-overridable so the app runs identically host-native or in Docker
// (the container sets ROUTER_PATH and PASEO_DIR; bind-mount ~/.paseo to PASEO_DIR).
export const ROUTER_PATH = process.env.ROUTER_PATH || path.join(REPO_MODEL_ROUTER, "router.mjs");
export const PASEO_DIR = process.env.PASEO_DIR || path.join(os.homedir(), ".paseo");
export const REGISTRY_PATH = path.join(PASEO_DIR, "model-tiers.json");
export const PRESETS_DIR = path.join(PASEO_DIR, "presets");

export async function readRegistry() {
  return JSON.parse(await fs.readFile(REGISTRY_PATH, "utf8"));
}

export async function writeRegistry(registry) {
  await fs.copyFile(REGISTRY_PATH, `${REGISTRY_PATH}.ui-bak`);
  await fs.writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export async function listPresets() {
  const entries = await fs.readdir(PRESETS_DIR);
  return entries.filter((name) => name.endsWith(".json")).map((name) => name.replace(/\.json$/, "")).sort();
}

function presetPath(name) {
  return path.join(PRESETS_DIR, `${name}.json`);
}

export async function readPreset(name) {
  return JSON.parse(await fs.readFile(presetPath(name), "utf8"));
}

export async function writePreset(name, obj) {
  const filePath = presetPath(name);
  await fs.copyFile(filePath, `${filePath}.ui-bak`);
  await fs.writeFile(filePath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

export async function deletePreset(name) {
  const filePath = presetPath(name);
  await fs.copyFile(filePath, `${filePath}.ui-bak`);
  await fs.unlink(filePath);
}

export async function createPreset(name, template) {
  const obj = template
    ? { ...template, preset: name }
    : { preset: name, concurrency: 1, providers: {}, preferences: [], agents: {} };
  const filePath = presetPath(name);
  await fs.writeFile(filePath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

export async function renamePreset(oldName, newName) {
  const obj = await readPreset(oldName);
  obj.preset = newName;
  await writePreset(newName, obj);
  await deletePreset(oldName);
}

export async function runRouter(req) {
  const args = ["--json", "--role", req.role, "--task", req.task || "", "--model-tiers", REGISTRY_PATH];
  if (req.preset) args.push("--preset", path.join(PRESETS_DIR, `${req.preset}.json`));
  if (req.priority) args.push("--priority", req.priority);
  if (req.difficulty) args.push("--difficulty", req.difficulty);
  if (Number(req.contextTokens) > 0) args.push("--context-tokens", String(req.contextTokens));
  if (req.requires) args.push("--requires", req.requires);
  if (Number(req.fanout) > 1) args.push("--fanout", String(req.fanout));
  if (req.residentLocal) args.push("--resident-local", req.residentLocal);

  try {
    const { stdout } = await execFileAsync("node", [ROUTER_PATH, ...args], { timeout: 15000 });
    return { ok: true, result: JSON.parse(stdout) };
  } catch (error) {
    const message = (error.stderr || error.message || "router failed").toString().trim();
    return { ok: false, error: message };
  }
}
