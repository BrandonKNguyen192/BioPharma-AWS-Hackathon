/**
 * Deterministic fallback parser: plain English -> PatientProfile.
 *
 * Split out of extract.ts so it carries NO `server-only` import. It touches no
 * key, no network, and no secret, so gating it behind the server boundary only
 * made it untestable. Everything here must stay pure and synchronous.
 */

import type { PatientProfile } from "./types";

export const EMPTY: PatientProfile = {
  cancerType: null,
  stage: null,
  stageNumber: null,
  priorTherapies: [],
  priorTherapyClasses: [],
  priorLinesCount: null,
  biomarkers: [],
  pdl1Percent: null,
  ecog: null,
  hasBrainMets: null,
  ageYears: null,
  quotes: [],
};

/* ------------------------------------------------------------------ *
 * Deterministic fallback
 * ------------------------------------------------------------------ */

/**
 * A dependency-free parser used when no API key is present or the API call
 * fails. Deliberately conservative: it recognizes only unambiguous phrasing,
 * so it under-extracts rather than inventing facts.
 */
export function extractLocally(text: string): PatientProfile {
  const t = text.toLowerCase();
  const p: PatientProfile = { ...EMPTY, priorTherapies: [], priorTherapyClasses: [], biomarkers: [], quotes: [] };

  const cancers: Array<[RegExp, string]> = [
    [/non-?small[- ]cell lung|nsclc/, "non-small cell lung cancer"],
    [/small[- ]cell lung|sclc/, "small cell lung cancer"],
    [/lung cancer/, "lung cancer"],
    [/melanoma/, "melanoma"],
    [/lymphoma/, "lymphoma"],
    [/myeloma/, "multiple myeloma"],
    [/leukemia|leukaemia/, "leukemia"],
    [/bladder|urothelial/, "bladder cancer"],
    [/renal|kidney/, "renal cell carcinoma"],
    [/hepatocellular|liver cancer/, "hepatocellular carcinoma"],
    [/colorectal|colon cancer/, "colorectal cancer"],
    [/gastric|stomach cancer/, "gastric cancer"],
    [/mesothelioma/, "mesothelioma"],
    [/breast cancer/, "breast cancer"],
  ];
  for (const [re, label] of cancers) {
    if (re.test(t)) { p.cancerType = label; break; }
  }

  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
  const stage = /stage\s+(iv|iii|ii|i|[1-4])\b/.exec(t);
  if (stage) {
    const raw = stage[1];
    p.stageNumber = /^[1-4]$/.test(raw) ? Number(raw) : (roman[raw] ?? null);
    p.stage = `Stage ${raw.toUpperCase()}`;
  } else if (/metastatic|advanced|spread/.test(t)) {
    p.stage = "advanced / metastatic (as described)";
  }

  const drugs: Array<[RegExp, string, string]> = [
    [/carboplatin/, "carboplatin", "platinum"],
    [/cisplatin/, "cisplatin", "platinum"],
    [/oxaliplatin/, "oxaliplatin", "platinum"],
    [/platinum/, "platinum-based chemotherapy", "platinum"],
    [/pemetrexed|alimta/, "pemetrexed", "chemo"],
    [/paclitaxel|taxol/, "paclitaxel", "chemo"],
    [/nivolumab|opdivo/, "nivolumab", "checkpoint"],
    [/pembrolizumab|keytruda/, "pembrolizumab", "checkpoint"],
    [/atezolizumab|tecentriq/, "atezolizumab", "checkpoint"],
    [/durvalumab|imfinzi/, "durvalumab", "checkpoint"],
    [/ipilimumab|yervoy/, "ipilimumab", "checkpoint"],
    [/osimertinib|tagrisso/, "osimertinib", "targeted"],
    [/radiation|radiotherapy/, "radiation therapy", "radiation"],
    [/surgery|resect/, "surgery", "surgery"],
  ];
  for (const [re, name, cls] of drugs) {
    if (re.test(t)) {
      if (!p.priorTherapies.includes(name)) p.priorTherapies.push(name);
      if (!p.priorTherapyClasses.includes(cls)) p.priorTherapyClasses.push(cls);
    }
  }
  if (/\bchemo\b|chemotherapy/.test(t) && !p.priorTherapyClasses.includes("chemo")) {
    p.priorTherapyClasses.push("chemo");
    if (p.priorTherapies.length === 0) p.priorTherapies.push("chemotherapy");
  }

  const pdl1 = /pd-?l1[^.]{0,40}?(\d{1,3})\s*%/.exec(t) ?? /(\d{1,3})\s*%[^.]{0,20}?pd-?l1/.exec(t);
  if (pdl1) {
    p.pdl1Percent = Number(pdl1[1]);
    p.biomarkers.push(`PD-L1 ${pdl1[1]}%`);
  }
  for (const [re, label] of [
    [/egfr/, "EGFR"], [/\balk\b/, "ALK"], [/kras/, "KRAS"],
    [/braf/, "BRAF"], [/\bros1\b/, "ROS1"], [/her2/, "HER2"],
  ] as Array<[RegExp, string]>) {
    if (re.test(t)) p.biomarkers.push(label);
  }

  const ecog = /ecog[^\d]{0,15}(\d)/.exec(t) ?? /performance status[^\d]{0,15}(\d)/.exec(t);
  if (ecog) p.ecog = Number(ecog[1]);

  /*
   * Lines of systemic therapy. Deliberately narrow: only an explicit statement
   * of "no treatment yet", an explicit count, or an unambiguous "A, then B,
   * then C" sequence. Everything else stays null.
   *
   * It must NEVER fall back to counting drugs or drug classes. Concurrent
   * agents in one regimen are one line, and a parser that cannot tell the
   * difference should say so instead of returning a number that reads as
   * authoritative and is wrong in the patient's disfavour.
   */
  if (/\b(?:haven'?t|have not) (?:started|had|received|begun)\b|treatment[- ]na(?:i|ï)ve|\bno (?:prior |previous )?(?:systemic )?(?:treatment|therapy|chemo)\b/.test(t)) {
    p.priorLinesCount = 0;
  } else {
    const stated = /(\d+|one|two|three|four|five)\s+(?:different\s+)?(?:prior\s+|previous\s+)?(?:lines?|regimens?)\b/.exec(t);
    if (stated) {
      const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
      p.priorLinesCount = words[stated[1]] ?? Number(stated[1]);
    } else {
      // "X, then Y, then Z" — each "then" marks a change of regimen.
      const thens = (t.match(/,\s*then\b/g) ?? []).length;
      if (thens >= 1) p.priorLinesCount = thens + 1;
    }
  }

  // Negation MUST be tested before the positive pattern: "no brain mets"
  // contains "brain met", so checking the positive case first would invert
  // the meaning. Getting this backwards is the difference between a match
  // and a dangerous one.
  const NEG_BRAIN =
    /\b(?:no|not|without|negative for|denies|free of|clear of)\b[^.]{0,30}?(?:brain|cns)\b|(?:brain|cns)[^.]{0,30}?\b(?:clear|clean|negative|unremarkable|no evidence)\b/;
  const POS_BRAIN = /brain metast|cns metast|spread to (?:my |the )?brain|mets? in (?:my |the )?brain|brain mets?\b/;

  if (NEG_BRAIN.test(t)) p.hasBrainMets = false;
  else if (POS_BRAIN.test(t)) p.hasBrainMets = true;

  const age = /\b(?:i'?m|i am|age|aged)\s+(\d{2})\b/.exec(t) ?? /\b(\d{2})[- ]years?[- ]old\b/.exec(t);
  if (age) {
    const n = Number(age[1]);
    if (n >= 18 && n <= 100) p.ageYears = n;
  }

  // Pull short verbatim fragments so the UI can show what was read.
  p.quotes = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 120)
    .slice(0, 3);

  return p;
}
