/**
 * ClearTrial — step 1 of the Convoke enrichment pipeline.
 *
 * Turns the raw `interventions` strings in src/data/trials.json into a clean,
 * deduplicated list of drug assets to ask Convoke about, and records which raw
 * string maps to which asset.
 *
 * Why the map is persisted rather than recomputed at runtime: the app must
 * never re-normalize. It looks a raw intervention string up in the committed
 * programs.json and gets an exact hit or nothing. One normalization, offline,
 * reviewable in a diff.
 *
 * ClinicalTrials.gov intervention names are free text, so this handles:
 *   - combination entries      "Nivolumab plus Ipilimumab"  -> two assets
 *   - cohort labels            "Cohort C1 & C2: KTX-1001 + Carfilzomib (KYPROLIS(R))"
 *   - parenthetical brands     "Daratumumab/rHuPH20 Co-formulation"
 *   - non-drug arms            "Placebo", "SBRT", "Quality-of-Life Assessment"
 *
 * Output: tmp/asset-map.json (gitignored working file, not shipped).
 * Next:   run the two Convoke MCP queries listed in the output, save the raw
 *         responses to tmp/, then run scripts/build-programs.mjs.
 *
 * Usage: node scripts/build-program-queries.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const TRIALS = join(ROOT, "src", "data", "trials.json");
const OUT = join(ROOT, "tmp", "asset-map.json");

/**
 * Arms that are not a drug asset. Convoke has no program for these, and asking
 * would spend credits to learn nothing.
 */
const NOT_AN_ASSET = [
  /^placebo$/i,
  /^sbrt$/i,
  /quality-of-life assessment/i,
  /^non-interventional study$/i,
  /neoantigen dendritic cell vaccine/i,
  // Hyaluronidase used to make a subcutaneous co-formulation possible. A
  // delivery excipient, not an asset with a development program of its own.
  /^rhuph20$/i,
];

/**
 * Supportive/premedication agents. Real drugs, but they are comfort care in
 * these protocols, not the asset whose development stage carries urgency.
 */
const SUPPORTIVE = [
  /^acetaminophen$/i,
  /^diphenhydramine$/i,
  /^montelukast$/i,
  /^celecoxib/i,
  /^dexamethasone$/i,
  /^clarithromycin$/i,
  /^tocilizumab$/i,
  /^calcium folinate$/i,
  /^leucovorin$/i,
];

/**
 * Cytotoxic backbones and regimen acronyms. Decades off patent and shared
 * across every arm, so a "Phase 3 program" reading on them is meaningless.
 * Excluded from the ask, but still recorded in the map as a known skip so the
 * dashboard can say why a trial has no program context rather than going
 * silently blank.
 */
const BACKBONE = [
  /^carboplatin/i,
  /^cisplatin$/i,
  /^platinum$/i,
  /^oxaliplatin$/i,
  /^gemcitabine$/i,
  /^etoposide$/i,
  /^paclitaxel$/i,
  /^nab-?paclitaxel$/i,
  /^docetaxel$/i,
  /^pemetrexed$/i,
  /^cyclophosphamide$/i,
  /^fludarabine$/i,
  /^methotrexate$/i,
  /^temozolomide$/i,
  /^procarbazine$/i,
  /^5-fu$/i,
  /^folfox$/i,
  /^folfiri$/i,
  /^capox$/i,
  /^azacitidine$/i,
];

/** Strip a leading cohort/arm label: "Cohort B1 & B2: KTX-1001+Mezigdomide". */
function stripCohort(s) {
  return s.replace(/^\s*(?:cohort|arm|part|group)\s+[^:]{0,40}:\s*/i, "");
}

/** Drop trailing brand parentheticals: "Carfilzomib (KYPROLIS(R))". */
function stripParens(s) {
  return s.replace(/\s*\([^)]*\)\s*/g, " ");
}

/**
 * Split a combination arm into its component assets. Handles "+", "plus",
 * "and", "/" and the FDC ("fixed dose combination") spellings that appear in
 * this dataset. Dose strings are removed first so "Nivolumab 240 mg /
 * Relatlimab 80 mg" splits cleanly.
 */
function splitCombination(s) {
  const noDose = s.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu)\b/gi, " ");
  return noDose
    .split(/\s*(?:\+|\/|\bplus\b|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Remove descriptive noise left over after splitting: "Drugs Nivolumab",
 * "Iberdomide Hydrochloride", "... FDC", "... Co-formulation".
 */
function tidy(s) {
  return s
    .replace(/^drugs?\s+/i, "")
    .replace(/\bin a fixed[-\s]dose combination\b/gi, " ")
    .replace(/\b(?:fdc|co-?formulation|subcutaneous|sc|hydrochloride)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,;:]+$/, "");
}

/** Canonical key for deduplication. Display keeps the first-seen spelling. */
function key(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function classify(asset) {
  if (NOT_AN_ASSET.some((r) => r.test(asset))) return "not_an_asset";
  if (SUPPORTIVE.some((r) => r.test(asset))) return "supportive";
  if (BACKBONE.some((r) => r.test(asset))) return "backbone";
  return "ask";
}

const file = JSON.parse(await readFile(TRIALS, "utf8"));

/** raw intervention string -> { assets: [...], reason } */
const rawToAssets = {};
/** canonical key -> display name */
const assets = new Map();
const skipped = { not_an_asset: 0, supportive: 0, backbone: 0 };

for (const trial of file.trials) {
  for (const raw of trial.interventions) {
    if (rawToAssets[raw]) continue;

    const parts = splitCombination(stripParens(stripCohort(raw)))
      .map(tidy)
      .filter((p) => p.length > 1);

    const kept = [];
    const reasons = new Set();

    for (const part of parts) {
      const kind = classify(part);
      if (kind === "ask") {
        const k = key(part);
        if (!assets.has(k)) assets.set(k, part);
        kept.push(assets.get(k));
      } else {
        skipped[kind]++;
        reasons.add(kind);
      }
    }

    rawToAssets[raw] = {
      assets: [...new Set(kept)],
      // Only meaningful when assets is empty: tells the UI why.
      reason: kept.length > 0 ? null : [...reasons][0] ?? "unrecognized",
    };
  }
}

const askList = [...assets.values()].sort((a, b) => a.localeCompare(b));

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({ generatedFrom: TRIALS, rawToAssets, askList }, null, 2),
);

const rawCount = Object.keys(rawToAssets).length;
console.log(`raw intervention strings : ${rawCount}`);
console.log(`distinct assets to ask   : ${askList.length}`);
console.log(
  `skipped                  : ${skipped.backbone} backbone, ` +
    `${skipped.supportive} supportive, ${skipped.not_an_asset} non-drug`,
);
console.log(`\nwrote ${OUT}`);
console.log(`\nNow run these two Convoke MCP queries and save the raw JSON:`);
console.log(`  1. query_program_tracker   drug=<askList>  -> tmp/convoke-programs.json`);
console.log(`  2. query_catalyst_calendar forward-dated   -> tmp/convoke-catalysts.json`);
console.log(`Then: node scripts/build-programs.mjs`);
