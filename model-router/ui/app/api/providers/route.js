import { NextResponse } from "next/server";
import { checkLocalProvider, checkOpenRouter } from "../../../lib/paseo.js";

// Provider health snapshot: fans out to each source that exposes a live API.
// Local (llama-swap): /health + /running. OpenRouter: /credits + /key.
// Not cached so the panel stays current.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [local, openrouter] = await Promise.all([checkLocalProvider(), checkOpenRouter()]);
    return NextResponse.json({ providers: [local, openrouter] });
  } catch (error) {
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}
