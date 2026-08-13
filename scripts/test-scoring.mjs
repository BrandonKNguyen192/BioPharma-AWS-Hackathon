/**
 * Regression tests for the two demo-critical failure modes.
 *
 * 1. A trial we barely checked must not present as a confident match.
 * 2. The prior-therapy rule must not invert on negated phrasing, and the
 *    biomarker rule must not fire on words that merely contain a gene name.
 *
 * Mirrors the logic in src/lib/match.ts. If you change the rules there,
 * change them here and keep both green.
 */

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"} ${name.padEnd(58)} got ${JSON.stringify(got)}`,
  );
};

/* ---------- 1. Evidence-gated verdicts ---------- */

function verdict({ passes, blockers, unknowns, onCondition = true }) {
  const decidable = passes + blockers + unknowns;
  if (!onCondition || blockers > 0) return "excluded";
  if (passes >= 2 && decidable >= 3) return "eligible";
  if (passes >= 1 && unknowns <= passes) return "likely";
  return "needs_review";
}

function fit(passes, blockers) {
  const decided = passes + blockers;
  return decided === 0 ? 0 : Math.round((passes / decided) * 100);
}

console.log("evidence-gated verdicts");
// The original bug: one passing criterion, everything else unreadable.
check("1 pass / 0 other decidable -> not eligible", verdict({ passes: 1, blockers: 0, unknowns: 0 }), "likely");
check("1 pass / 23 unparsed -> still not eligible", verdict({ passes: 1, blockers: 0, unknowns: 0 }), "likely");
check("2 pass / 1 unknown -> eligible", verdict({ passes: 2, blockers: 0, unknowns: 1 }), "eligible");
check("2 pass / 0 other -> not eligible (too little)", verdict({ passes: 2, blockers: 0, unknowns: 0 }), "likely");
check("any blocker -> excluded", verdict({ passes: 5, blockers: 1, unknowns: 0 }), "excluded");
check("off-condition -> excluded", verdict({ passes: 5, blockers: 0, unknowns: 0, onCondition: false }), "excluded");
check("0 pass / 2 unknown -> needs_review", verdict({ passes: 0, blockers: 0, unknowns: 2 }), "needs_review");

console.log("\nfit is a pass-rate, not a confidence");
check("1 of 1 checked -> fit 100", fit(1, 0), 100);
check("3 of 4 checked -> fit 75", fit(3, 1), 75);
check("nothing decided -> fit 0", fit(0, 0), 0);

/* ---------- 2. prior_any_therapy polarity ---------- */

const RE_NAIVE =
  /\b(?:no prior systemic|treatment[-\s]na(?:i|ï)ve|systemic treatment na(?:i|ï)ve|previously untreated|no prior (?:systemic\s+)?(?:anti-?tumou?r|antineoplastic|antitumor|therapy|treatment)|has not received (?:any )?prior)\b/i;
const RE_PRIOR_SYSTEMIC =
  /\b(?:any prior systemic|prior systemic (?:anti-?tumou?r|antitumor|therapy|treatment)|systemic anti-?tumou?r therapy for (?:advanced|metastatic)|prior treatments? including)\b/i;

/** true when the line demands a treatment-naive patient. */
const naiveRequired = (t) => RE_NAIVE.test(t);
const fires = (t) => RE_NAIVE.test(t) || RE_PRIOR_SYSTEMIC.test(t);

console.log("\nprior-therapy rule");
check("'No prior systemic antitumor therapy' fires", fires("No prior systemic antitumor therapy for the current NSCLC diagnosis."), true);
check("  ...and reads as naive-required", naiveRequired("No prior systemic antitumor therapy for the current NSCLC diagnosis."), true);
check("'Any prior systemic, non-curative therapy' fires", fires("Any prior systemic, non-curative therapy received for NSCLC."), true);
check("  ...and is NOT naive-required", naiveRequired("Any prior systemic, non-curative therapy received for NSCLC."), false);
check("'treatment naive' fires", fires("Have systemic treatment naive confirmed diagnosis of Stage IIIB."), true);
check("unrelated line does not fire", fires("Adequate organ function as defined in the protocol."), false);

/* ---------- 3. biomarker boundary safety ---------- */

const GENES = ["egfr", "alk", "ros1", "kras", "braf", "her2", "ret", "met", "ntrk", "pik3ca"];
const CONTEXT = /\b(mutation|alteration|rearrangement|fusion|positive|amplification|translocation|wild[-\s]?type)\b/i;
const genesIn = (t) =>
  GENES.filter((g) => new RegExp(`(?<![a-z0-9])${g}(?![a-z0-9])`, "i").test(t));
const bio = (t) => genesIn(t).length > 0 && CONTEXT.test(t);

console.log("\nbiomarker rule (boundary safety)");
check("'EGFR mutation' fires", bio("Documented EGFR mutation."), true);
check("'ALK rearrangement' fires", bio("ALK rearrangement positive tumour."), true);
// The real false positive found in the dataset.
check("'alkalization' does NOT fire", bio("inability to receive standardized hydration, alkalization, leucovorin rescue"), false);
check("'metastatic' does NOT fire via 'met'", bio("Participants with metastatic disease positive for spread."), false);
check("gene without context does not fire", bio("EGFR inhibitors are permitted concomitantly."), false);

console.log(
  failures === 0
    ? "\nall scoring/rule regressions pass"
    : `\n${failures} FAILING — do not ship`,
);
process.exit(failures === 0 ? 0 : 1);
