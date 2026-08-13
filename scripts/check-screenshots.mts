/**
 * Regression check for the two cards Brandon screenshotted.
 * Run: pnpm exec tsx scripts/check-screenshots.mts
 */
import { readFileSync } from "node:fs";
import { matchTrial, matchAll, classify } from "../src/lib/match";
import { extractLocally } from "../src/lib/extract-local";
import type { PatientProfile, Trial } from "../src/lib/types";

const trials: Trial[] = JSON.parse(
  readFileSync(new URL("../src/data/trials.json", import.meta.url), "utf8"),
).trials;

const base: PatientProfile = {
  cancerType: null, stage: null, stageNumber: null,
  priorTherapies: [], priorTherapyClasses: [], priorLinesCount: null, biomarkers: [],
  pdl1Percent: null, ecog: null, hasBrainMets: null, ageYears: null, quotes: [],
};

const lung: PatientProfile = {
  ...base,
  cancerType: "lung cancer — adenocarcinoma",
  stage: "stage IV", stageNumber: 4,
  priorTherapies: ["carboplatin", "pemetrexed", "pembrolizumab"],
  priorTherapyClasses: ["platinum", "chemo", "checkpoint"],
  priorLinesCount: 1, // carbo+pem+pembro concurrently = ONE line
  biomarkers: ["KRAS G12C"],
  pdl1Percent: 40, ecog: 1, hasBrainMets: false, ageYears: 62,
};

const survey = trials.find((t) => t.nctId === "NCT07339254")!;

console.log("--- permissive line classification ---");
const permissiveLine = survey.inclusion[2];
console.log(JSON.stringify(permissiveLine));
console.log("classify ->", classify(permissiveLine), "(expect: permissive)");

console.log("\n--- survey card, lung patient ---");
const r = matchTrial(survey, lung);
console.log("verdict :", r.verdict, "(was: eligible / 'Looks like a match')");
console.log("fit     :", r.fit, "(was: 100)");
console.log("coverage:", `checked ${r.coverage.checked} of ${r.coverage.total}`);
console.log("passes  :", r.evaluated.filter((c) => c.outcome === "pass").length);

console.log("\n--- is the survey still in the ranked list? ---");
const ranked = matchAll(trials, lung);
const idx = ranked.findIndex((x) => x.trial.nctId === "NCT07339254");
console.log(idx === -1 ? "filtered out (non-interventional)" : `STILL PRESENT at #${idx + 1}`);
console.log("top 3 now:");
for (const x of ranked.slice(0, 3)) {
  console.log(`  ${x.verdict.padEnd(13)} fit=${String(x.fit).padEnd(5)} ${x.trial.nctId}  ${x.trial.title.slice(0, 60)}`);
}

console.log("\n--- no-evidence case must be null, not 0 ---");
const noEvidence = matchAll(trials, { ...base, cancerType: "lung cancer" })
  .filter((x) => x.fit === null).length;
console.log(`${noEvidence} trials report fit=null (previously all rendered "0%")`);

/* ------------------------------------------------------------------ *
 * Prior lines: a line is a regimen, not a drug.
 * ------------------------------------------------------------------ */
console.log("\n--- local extractor line counts ---");
const CASES: [string, number | null][] = [
  ["I did carboplatin, pemetrexed, and Keytruda for about eight months.", null],
  ["I haven't started anything yet — we begin FOLFIRINOX in two weeks.", 0],
  ["FOLFOX with bevacizumab, then FOLFIRI, then regorafenib.", 3],
  ["I've had three prior lines of treatment.", 3],
  ["I was on carboplatin and paclitaxel.", null],
];
let bad = 0;
for (const [text, want] of CASES) {
  const got = extractLocally(text).priorLinesCount;
  const ok = got === want;
  if (!ok) bad += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} got=${String(got).padEnd(5)} want=${String(want).padEnd(5)} ${text.slice(0, 52)}`);
}

console.log("\n--- the regression: 1 line must not read as 3 ---");
const capped: Trial = {
  nctId: "TEST-CAP", title: "Cap at 2 prior lines", officialTitle: null,
  status: "RECRUITING", phase: "PHASE2",
  conditions: ["Lung Non-Small Cell Carcinoma"], interventions: ["Study Drug"],
  inclusion: ["Patients must have received no more than 2 prior lines of systemic therapy."],
  exclusion: [], url: "",
};
const before = { ...lung, priorLinesCount: null };
console.log(`  classes-as-lines (old behaviour): would count ${
  lung.priorTherapyClasses.filter((c) => ["platinum", "checkpoint", "chemo", "targeted"].includes(c)).length
} lines -> exceeds cap of 2 -> FAIL`);
console.log(`  with priorLinesCount=1 :`, matchTrial(capped, lung).evaluated[0].outcome, "<- expect pass");
console.log(`  with priorLinesCount=null:`, matchTrial(capped, before).evaluated[0].outcome, "<- expect unknown, not a wrong fail");

process.exit(bad > 0 ? 1 : 0);
