/**
 * Plain English -> structured clinical facts.
 *
 * SERVER ONLY. The OpenAI key never reaches the browser.
 *
 * Safety posture:
 *  - The model extracts only what the patient actually wrote. It is told
 *    explicitly not to infer, diagnose, stage, or recommend treatment.
 *  - Anything not stated comes back null, and the matching engine treats
 *    null as "unknown", never as "passes".
 *  - No patient text is persisted. Only anonymized, aggregate exclusion
 *    reasons reach the researcher view.
 *  - If the key is missing or the call fails, we fall back to a deterministic
 *    local parser so a demo never dies on a network error.
 */

import "server-only";
import OpenAI from "openai";
import type { PatientProfile } from "./types";
import { extractLocally } from "./extract-local";

export { extractLocally };

/**
 * Must be models the active key actually serves. The hackathon group key
 * serves only: gpt-5.4, gpt-4.1-nano, gpt-4-turbo, gpt-5.3-codex.
 *
 * Verified on this key:
 *   gpt-5.4       strict json_schema OK, ~1.1s   <- primary
 *   gpt-4.1-nano  strict json_schema OK, ~0.5s   <- fallback
 *   gpt-4-turbo   rejects json_schema            (unusable here)
 *   gpt-5.3-codex Responses API only             (unusable on chat)
 *
 * Naming a model the key cannot serve does not error loudly — extraction
 * 403s, the local parser silently takes over, and the UI quietly reads
 * "offline mode". Re-check this list if the key changes.
 */
export const PRIMARY_MODEL = "gpt-5.4";
export const FALLBACK_MODEL = "gpt-4.1-nano";

export const EXTRACTION_SYSTEM_PROMPT = `
You convert a patient's own description of their cancer history into structured
clinical data for a clinical-trial eligibility pre-screen.

You are a data extractor. You are NOT a clinician.

Rules, in priority order:
1. Extract ONLY facts the patient explicitly states. If they did not state
   something, return null (or an empty array). Never guess, never infer, never
   fill in what is "typical" for their disease.
2. Do not diagnose. Do not stage a cancer the patient did not stage. Do not
   infer ECOG performance status from lifestyle remarks such as "I still work"
   or "I get tired" — ECOG must be stated as a number to be recorded.
3. Do not recommend treatment or comment on prognosis.
4. Normalize drug names to their generic form where obvious
   (e.g. "Keytruda" -> "pembrolizumab").
5. priorTherapyClasses must be drawn ONLY from this fixed vocabulary, and only
   when the patient's described treatment clearly belongs to that class:
   "platinum"    - carboplatin, cisplatin, oxaliplatin, "platinum-based"
   "checkpoint"  - nivolumab, pembrolizumab, atezolizumab, durvalumab, or the
                   patient plainly describing PD-1/PD-L1 immunotherapy
   "chemo"       - any other cytotoxic chemotherapy
   "targeted"    - EGFR/ALK/KRAS and similar targeted agents
   "radiation"   - radiotherapy
   "surgery"     - resection or surgical removal
6. priorLinesCount: the number of distinct LINES of systemic therapy the
   patient has had. A line is a REGIMEN, not a drug. Drugs named together as
   one course are ONE line — "carboplatin, pemetrexed and Keytruda for eight
   months" is 1, not 3. A new line starts when treatment changes after
   progression or intolerance: "FOLFOX, then FOLFIRI, then regorafenib" is 3.
   Maintenance continuing the same regimen is not a new line.
   Return 0 only when the patient plainly says they have had no systemic
   treatment yet ("I haven't started anything", "treatment naive").
   Return null if you cannot count confidently. Do NOT approximate. Surgery
   and radiation alone are not lines of systemic therapy.
7. pdl1Percent: only when a PD-L1 percentage is stated. "PD-L1 is high" without
   a number is null.
8. hasBrainMets: true or false ONLY if the patient addresses brain/CNS spread.
   Otherwise null.
9. quotes: 2-4 short verbatim fragments (under 12 words each) copied exactly
   from the patient's text, showing where the key facts came from. These are
   displayed back to the patient so they can see what was read.

Return only the structured object.
`.trim();

/** JSON Schema mirroring PatientProfile. Strict mode requires every key. */
const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cancerType: { type: ["string", "null"], description: "e.g. 'non-small cell lung cancer'" },
    stage: { type: ["string", "null"], description: "verbatim stage as stated" },
    stageNumber: { type: ["integer", "null"], description: "1-4 when stated" },
    priorTherapies: { type: "array", items: { type: "string" } },
    priorTherapyClasses: {
      type: "array",
      items: {
        type: "string",
        enum: ["platinum", "checkpoint", "chemo", "targeted", "radiation", "surgery"],
      },
    },
    priorLinesCount: {
      type: ["integer", "null"],
      description: "distinct lines (regimens) of systemic therapy; null if not countable",
    },
    biomarkers: { type: "array", items: { type: "string" } },
    pdl1Percent: { type: ["number", "null"] },
    ecog: { type: ["integer", "null"] },
    hasBrainMets: { type: ["boolean", "null"] },
    ageYears: { type: ["integer", "null"] },
    quotes: { type: "array", items: { type: "string" } },
  },
  required: [
    "cancerType",
    "stage",
    "stageNumber",
    "priorTherapies",
    "priorTherapyClasses",
    "priorLinesCount",
    "biomarkers",
    "pdl1Percent",
    "ecog",
    "hasBrainMets",
    "ageYears",
    "quotes",
  ],
} as const;


/** Guard against a model returning a shape we did not ask for. */
function coerce(raw: unknown): PatientProfile {
  const o = (raw ?? {}) as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const int = (v: unknown): number | null => {
    const n = num(v);
    return n === null ? null : Math.round(n);
  };

  const allowed = new Set(["platinum", "checkpoint", "chemo", "targeted", "radiation", "surgery"]);

  return {
    cancerType: typeof o.cancerType === "string" ? o.cancerType : null,
    stage: typeof o.stage === "string" ? o.stage : null,
    stageNumber: int(o.stageNumber),
    priorTherapies: strArr(o.priorTherapies),
    priorTherapyClasses: strArr(o.priorTherapyClasses).filter((c) => allowed.has(c)),
    // A negative or absurd line count is a model error, not a fact. Clamp to
    // null so the matcher reports unknown rather than acting on nonsense.
    priorLinesCount: (() => {
      const n = int(o.priorLinesCount);
      return n === null || n < 0 || n > 20 ? null : n;
    })(),
    biomarkers: strArr(o.biomarkers),
    pdl1Percent: num(o.pdl1Percent),
    ecog: int(o.ecog),
    hasBrainMets: typeof o.hasBrainMets === "boolean" ? o.hasBrainMets : null,
    ageYears: int(o.ageYears),
    quotes: strArr(o.quotes).slice(0, 4),
  };
}


/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export interface ExtractionOutcome {
  profile: PatientProfile;
  usedFallback: boolean;
  model: string | null;
}

export async function extractProfile(text: string): Promise<ExtractionOutcome> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { profile: extractLocally(text), usedFallback: true, model: null };
  }

  const client = new OpenAI({ apiKey: key });

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "patient_profile", strict: true, schema: PROFILE_SCHEMA },
        },
      });

      const content = res.choices[0]?.message?.content;
      if (!content) throw new Error("empty completion");

      const parsed = coerce(JSON.parse(content));
      // If the model returned nothing usable, prefer the local parser.
      if (!parsed.cancerType && parsed.priorTherapies.length === 0) {
        const local = extractLocally(text);
        if (local.cancerType) {
          return { profile: local, usedFallback: true, model };
        }
      }
      return { profile: parsed, usedFallback: false, model };
    } catch (err) {
      console.error(`[extract] ${model} failed:`, (err as Error).message);
    }
  }

  return { profile: extractLocally(text), usedFallback: true, model: null };
}
