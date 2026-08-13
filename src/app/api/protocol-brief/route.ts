/**
 * POST /api/protocol-brief
 *
 * Runs the Strands agent over the de-identified exclusion signal and returns a
 * written brief for the trial design team.
 *
 * This endpoint is allowed to fail. The dashboard's static Protocol
 * Optimization Alert is computed deterministically and renders regardless, so
 * a failure here degrades the page rather than breaking it.
 */

import { NextResponse } from "next/server";
import { generateProtocolBrief } from "@/lib/protocol-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "No model key configured — showing the deterministic alert only." },
      { status: 503 },
    );
  }

  try {
    const brief = await generateProtocolBrief();
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[protocol-brief]", (err as Error).message);
    return NextResponse.json(
      { error: "Could not generate the brief. The alert above still applies." },
      { status: 502 },
    );
  }
}
