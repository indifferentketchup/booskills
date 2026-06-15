import { NextResponse } from "next/server";
import { readRegistry, writeRegistry } from "../../../lib/paseo.js";

// GET the provider_priority map; PUT a new one (validated, numeric values only).
export async function GET() {
  try {
    const registry = await readRegistry();
    return NextResponse.json({ providerPriority: registry.provider_priority || {} });
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
  const incoming = body?.providerPriority;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "providerPriority object required" }, { status: 400 });
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (key.startsWith("_")) continue;
    if (typeof value !== "number" || Number.isNaN(value)) {
      return NextResponse.json({ error: `priority for ${key} must be a number` }, { status: 400 });
    }
  }
  try {
    const registry = await readRegistry();
    // Preserve the _note and any meta keys; only overwrite numeric source weights.
    const next = { ...(registry.provider_priority || {}) };
    for (const [key, value] of Object.entries(incoming)) {
      if (!key.startsWith("_")) next[key] = value;
    }
    registry.provider_priority = next;
    await writeRegistry(registry);
    return NextResponse.json({ ok: true, providerPriority: next });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
