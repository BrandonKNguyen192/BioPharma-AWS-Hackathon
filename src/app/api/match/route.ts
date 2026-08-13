/**
 * POST /api/match
 *
 * Body: { text: string }
 * Returns a MatchResponse: extracted profile, ranked trials, and the
 * anonymized exclusion signal that feeds the researcher dashboard.
 *
 * No patient text is written to disk or to any log.
 */

import { NextResponse } from "next/server";
import { extractProfile } from "@/lib/extract";
import { matchAll, deriveSignals } from "@/lib/match";
import { TRIALS } from "@/lib/trials";
import { recordSignals } from "@/lib/signal-store";
import type { MatchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT = 6000;

export async function POST(req: Request) {
  const started = Date.now();

  let text: string;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (text.length < 10) {
    return NextResponse.json(
      { error: "Please describe your situation in a sentence or two." },
      { status: 400 },
    );
  }
  if (text.length > MAX_INPUT) text = text.slice(0, MAX_INPUT);

  const { profile, usedFallback, model } = await extractProfile(text);
  const results = matchAll(TRIALS, profile);
  const signals = deriveSignals(results);

  // Aggregate, de-identified only: rule kinds and counts. Never the text.
  recordSignals(profile.cancerType, signals);

  const payload: MatchResponse = {
    profile,
    results: results.slice(0, 12),
    signals,
    usedFallback,
    model,
    elapsedMs: Date.now() - started,
  };

  return NextResponse.json(payload);
}
