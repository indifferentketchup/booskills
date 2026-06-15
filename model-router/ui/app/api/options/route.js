import { NextResponse } from "next/server";
import { listPresets, readRegistry } from "../../../lib/paseo.js";

// Form options for the playground: presets, roles, priorities, difficulties,
// plus the active provider_priority so the editor can render it.
export async function GET() {
  try {
    const [presets, registry] = await Promise.all([listPresets(), readRegistry()]);
    const providerPriority = registry.provider_priority || {};
    return NextResponse.json({
      presets,
      roles: ["impl", "ui", "audit", "research", "planning"],
      priorities: ["balanced", "cost-efficiency", "speed", "quality"],
      difficulties: ["simple", "standard", "hard"],
      providerPriority,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
