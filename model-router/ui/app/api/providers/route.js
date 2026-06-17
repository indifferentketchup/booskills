import { NextResponse } from "next/server";
import { checkLocalProvider } from "../../../lib/paseo.js";

// Provider health snapshot: polls each source that exposes a live health API.
// Currently: local inference (llama-swap /health + /running).
// Not cached so the panel stays current.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const local = await checkLocalProvider();
    return NextResponse.json({ providers: [local] });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
