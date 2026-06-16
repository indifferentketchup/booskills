import { NextResponse } from "next/server";
import { readLoad } from "../../../lib/paseo.js";

// Live load snapshot for the dashboard: per-source in-flight, per-model quota
// usage, and host pressure. Read-only; never mutates the ledger. Not cached so
// the panel always reflects the current fan-out.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readLoad());
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
