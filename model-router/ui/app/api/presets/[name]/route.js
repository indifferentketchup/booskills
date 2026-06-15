import { NextResponse } from "next/server";
import { readPreset, writePreset, deletePreset } from "../../../../lib/paseo.js";

export async function GET(_req, { params }) {
  try {
    const { name } = await params;
    const obj = await readPreset(name);
    return NextResponse.json(obj);
  } catch (error) {
    if (error.code === "ENOENT") {
      return NextResponse.json({ error: `preset "${await params.then((p) => p.name)}" not found` }, { status: 404 });
    }
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { name } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const existing = await readPreset(name);
    if (body.concurrency !== undefined) {
      const val = Number(body.concurrency);
      if (Number.isNaN(val) || val < 1 || val > 100) {
        return NextResponse.json({ error: "concurrency must be 1-100" }, { status: 400 });
      }
      existing.concurrency = val;
    }
    if (body.preferences !== undefined) {
      if (!Array.isArray(body.preferences)) {
        return NextResponse.json({ error: "preferences must be an array of strings" }, { status: 400 });
      }
      existing.preferences = body.preferences;
    }
    if (body.providers !== undefined) {
      if (typeof body.providers !== "object" || Array.isArray(body.providers)) {
        return NextResponse.json({ error: "providers must be a role->array map" }, { status: 400 });
      }
      for (const [role, arr] of Object.entries(body.providers)) {
        if (!Array.isArray(arr)) {
          return NextResponse.json({ error: `providers.${role} must be an array` }, { status: 400 });
        }
      }
      existing.providers = body.providers;
    }
    if (body.agents !== undefined) {
      if (typeof body.agents !== "object" || Array.isArray(body.agents)) {
        return NextResponse.json({ error: "agents must be a persona->modelId map" }, { status: 400 });
      }
      existing.agents = body.agents;
    }
    await writePreset(name, existing);
    return NextResponse.json({ ok: true, preset: existing });
  } catch (error) {
    if (error.code === "ENOENT") {
      return NextResponse.json({ error: `preset "${name}" not found` }, { status: 404 });
    }
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { name } = await params;
    await deletePreset(name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return NextResponse.json({ error: `preset "${await params.then((p) => p.name)}" not found` }, { status: 404 });
    }
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
