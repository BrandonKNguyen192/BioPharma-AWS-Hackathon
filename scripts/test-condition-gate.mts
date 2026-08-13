import assert from "node:assert/strict";
import { matchAll } from "../src/lib/match";
import type { PatientProfile, Trial } from "../src/lib/types";

const profile: PatientProfile = {
  cancerType: "non-small cell lung cancer",
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

const conditions = [
  ["Non-small Cell Lung Cancer", true],
  ["Carcinoma, Non-Small-Cell Lung", true],
  ["Small Cell Lung Cancer", false],
  ["Relapsed or Refractory Acute Myeloid Leukemia", false],
  ["Advanced Solid Tumors", false],
] as const;

for (const [condition, expected] of conditions) {
  const trial: Trial = {
    nctId: condition,
    title: condition,
    officialTitle: null,
    status: "RECRUITING",
    phase: "PHASE1",
    conditions: [condition],
    interventions: [],
    inclusion: ["Age at least 18 years"],
    exclusion: [],
    url: "https://clinicaltrials.gov",
  };
  const got = matchAll([trial], profile)[0]?.verdict !== "excluded";
  assert.equal(got, expected, condition);
}

console.log("all production condition-gate cases pass");
