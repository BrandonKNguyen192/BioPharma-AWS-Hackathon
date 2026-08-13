import assert from "node:assert/strict";
import { closestMisses, matchTrial } from "../src/lib/match";
import type { PatientProfile, Trial } from "../src/lib/types";

const profile: PatientProfile = {
  cancerType: "non-small cell lung cancer",
  stage: "stage IV",
  stageNumber: 4,
  priorTherapies: [],
  priorTherapyClasses: [],
  priorLinesCount: null,
  biomarkers: [],
  pdl1Percent: null,
  ecog: 1,
  hasBrainMets: null,
  ageYears: 58,
  quotes: [],
};

function trial(id: string, inclusion: string[], exclusion: string[] = []): Trial {
  return {
    nctId: id,
    title: id,
    officialTitle: null,
    status: "RECRUITING",
    phase: "PHASE1",
    conditions: ["Non-small Cell Lung Cancer"],
    interventions: [],
    inclusion,
    exclusion,
    url: `https://clinicaltrials.gov/study/${id}`,
  };
}

const onePass = matchTrial(trial("one", ["Age at least 18 years"]), profile);
assert.equal(onePass.verdict, "likely");
assert.equal(onePass.fit, 100);
assert.deepEqual(onePass.coverage, { checked: 1, total: 1, unreadable: 0, pct: 100 });

const mostlyUnreadable = matchTrial(
  trial("unreadable", ["Age at least 18 years", ...Array.from({ length: 23 }, (_, index) => `Clinician-only requirement number ${index + 1}`)]),
  profile,
);
assert.notEqual(mostlyUnreadable.verdict, "eligible");
assert.equal(mostlyUnreadable.coverage.checked, 1);
assert.equal(mostlyUnreadable.coverage.total, 24);

const uncertain = matchTrial(
  trial("uncertain", [
    "Age at least 18 years",
    "ECOG performance status 0 or 1",
    "PD-L1 expression at least 50%",
    "Measurable disease by RECIST",
    "Documented KRAS G12C mutation",
  ]),
  profile,
);
assert.equal(uncertain.openQuestions.length, 3);
assert.equal(uncertain.verdict, "needs_review", "unknowns must outrank an eligible label");

const excluded = matchTrial(trial("excluded", ["Age at least 65 years"]), profile);
assert.equal(excluded.verdict, "excluded");
assert.deepEqual(closestMisses([onePass, excluded]).map((result) => result.trial.nctId), ["excluded"]);
assert.deepEqual(closestMisses([onePass]), []);

console.log("all production matcher checks pass");
