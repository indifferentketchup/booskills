import { NextResponse } from "next/server";
import { listPresets, readPreset, createPreset, renamePreset } from "../../../lib/paseo.js";

export async function GET() {
  try {
    const names = await listPresets();
    return NextResponse.json({ presets: names });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const name = body?.name;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const trimmed = name.trim();
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return NextResponse.json({ error: "name must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }
  try {
    const existing = await listPresets();
    if (existing.includes(trimmed)) {
      return NextResponse.json({ error: `preset "${trimmed}" already exists` }, { status: 409 });
    }
    if (body.duplicate) {
      const template = await readPreset(body.duplicate);
      await createPreset(trimmed, template);
    } else {
      await createPreset(trimmed);
    }
    return NextResponse.json({ ok: true, name: trimmed });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { oldName, newName } = body;
  if (!oldName || typeof oldName !== "string" || !newName || typeof newName !== "string") {
    return NextResponse.json({ error: "oldName and newName are required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(newName.trim())) {
    return NextResponse.json({ error: "newName must be lowercase alphanumeric with hyphens" }, { status: 400 });
  }
  try {
    const existing = await listPresets();
    if (!existing.includes(oldName)) {
      return NextResponse.json({ error: `preset "${oldName}" not found` }, { status: 404 });
    }
    const trimmed = newName.trim();
    if (trimmed !== oldName && existing.includes(trimmed)) {
      return NextResponse.json({ error: `preset "${trimmed}" already exists` }, { status: 409 });
    }
    await renamePreset(oldName, trimmed);
    return NextResponse.json({ ok: true, name: trimmed });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
