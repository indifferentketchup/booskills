import { NextResponse } from "next/server";
import { runRouter } from "../../../lib/paseo.js";

// Run the deterministic router for one request and return its JSON verdict.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body?.role) return NextResponse.json({ error: "role is required" }, { status: 400 });

  const out = await runRouter(body);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 422 });
  return NextResponse.json(out.result);
}
