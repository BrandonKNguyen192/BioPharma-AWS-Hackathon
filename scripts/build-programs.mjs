/**
 * ClearTrial — step 2 of the Convoke enrichment pipeline.
 *
 * Merges the raw Convoke MCP responses saved under tmp/ with the asset map from
 * build-program-queries.mjs, and writes src/data/programs.json — the committed
 * file the dashboard reads.
 *
 * Runs offline against saved responses. Convoke's /mcp endpoint authenticates
 * per-user over OAuth, so there is no static API key a CI job could hold; the
 * two queries are issued once from an authenticated MCP client and their raw
 * JSON is dropped in tmp/. See RUNBOOK.md for the exact queries. This is
 * deliberate, not a limitation to route around: the enrichment must never run
 * per-request.
 *
 * Everything here is a pure transform of those files. No network.
 *
 * De-branding: the `organizations` field is NOT requested and NOT persisted.
 * The sponsor is queried by name to scope the catalyst calendar, but the name
 * never lands in the working tree.
 *
 * Usage: node scripts/build-programs.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const TMP = join(ROOT, "tmp");
const OUT = join(ROOT, "src", "data", "programs.json");

/**
 * Development stage, least to most advanced. Index doubles as the rank used to
 * pick the lead program for an asset. "Unspecified" sorts lowest on purpose:
 * an unknown stage must never outrank a known one.
 */
const STAGE_ORDER = [
  "Unspecified",
  "Preclinical",
  "Phase 1",
  "Phase 1/2",
  "Phase 2",
  "Phase 2/3",
  "Phase 3",
  "Regulatory Approval",
  "Market",
];

/**
 * Minimum confidence to accept Convoke's canonical rename of one of our asset
 * spellings.
 *
 * Below this the resolver is guessing between compound codes — it mapped
 * "BMS-986458" to "BMS-986489" at 0.874, which are two different molecules.
 * A near-miss rename would silently attach one asset's development stage to
 * another. Rejected inputs keep our spelling and simply carry no program data,
 * which the dashboard renders as "no program data" rather than a wrong stage.
 */
const CONFIDENCE_MIN = 0.9;

/**
 * Indication mappings are held to confidence === 1, stricter than assets.
 *
 * Below 1 the resolver returns semantic inversions at high confidence:
 * "Colorectal Cancer (CRC)" resolves to "Non-Colorectal Cancer (Non-CRC)" at
 * 0.989, and "Relapsed and/or Refractory Multiple Myeloma" to "Acute
 * Promyelocytic Leukemia" at 0.667. Either would attach one disease's programs
 * to another disease's trial. A rejected condition simply contributes no
 * indication match, and the asset falls back to its most advanced program
 * flagged indicationMatched: false.
 */
const INDICATION_CONFIDENCE_MIN = 1;

/**
 * Convoke names an asset by its canonical entity; the Catalyst Calendar often
 * reports the same asset under a brand or legacy development code. Mapping is
 * explicit rather than fuzzy — a wrong join here would attach a real catalyst
 * date to the wrong drug, which is worse than showing no catalyst at all.
 */
const CATALYST_DRUG_ALIASES = {
  "CC-220": "Iberdomide",
  "CC-92480": "Mezigdomide",
  Krazati: "Adagrasib",
  "BL-B01D1": "Iza-bren",
  "Lisocabtagene Maraleucel": "Liso-cel",
  OPDUALAG: "Relatlimab",
};

/** Case/punctuation-insensitive key, matching build-program-queries.mjs. */
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function readJson(path) {
  return readFile(path, "utf8").then(JSON.parse);
}

// ---------------------------------------------------------------- load inputs

const assetMap = await readJson(join(TMP, "asset-map.json"));

const pages = readdirSync(TMP)
  .filter((f) => /^convoke-programs-p\d+\.json$/.test(f))
  .sort();
if (pages.length === 0) {
  throw new Error("No tmp/convoke-programs-p*.json found. See RUNBOOK.md.");
}

const rows = [];
const resolution = [];
for (const p of pages) {
  const page = await readJson(join(TMP, p));
  if (page.error) throw new Error(`${p} carries an error: ${page.error}`);
  rows.push(...page.items);
  resolution.push(...(page.entity_resolution ?? []));
}

const catalystFile = await readJson(join(TMP, "convoke-catalysts.json"));
const indicationFile = await readJson(join(TMP, "convoke-indications.json"));

// ------------------------------------------------- entity resolution -> maps

/**
 * Convoke resolves our free-text inputs to canonical entities and echoes the
 * mapping. That echo is the join key we need in two directions:
 *   - our asset spelling            -> Convoke drug entity
 *   - ClinicalTrials.gov condition  -> Convoke indication_name
 * Deriving it from the response rather than hand-writing it means the map can
 * never drift from what the query actually matched.
 *
 * The join is on the PRIMARY entity_id, never on drug_name and never on the
 * wider entity_ids list. entity_ids bundles near hits: asking for Bevacizumab
 * returns SCT510, IBI305 and BAT1706 — biosimilars belonging to other
 * companies — and asking for Sunitinib returns Subutinib Maleate, a different
 * molecule entirely. Merging those would credit this portfolio with programs
 * it does not own. Matching drug_id against the single primary entity_id keeps
 * only rows Convoke considers the same drug.
 */
const askedAssets = new Set(assetMap.askList.map(key));
/** Convoke primary drug entity id -> the canonical asset name we key on. */
const primaryIdToAsset = new Map();
/** Our asset spelling -> canonical asset name (collapses code/INN duplicates). */
const assetAliases = {};
const conditionToIndication = {};
/** Every page echoes the same resolution, so collect these deduplicated. */
const lowConfidence = new Set();

for (const r of resolution) {
  if (!r.name) continue;

    // Indication inputs are resolved separately, from convoke-indications.json.
  if (!askedAssets.has(key(r.input))) continue;

  if ((r.confidence ?? 0) < CONFIDENCE_MIN) {
    // Keep our own spelling; it will simply have no programs.
    lowConfidence.add(`${r.input} -> ${r.name} (${r.confidence})`);
    assetAliases[r.input] = r.input;
    continue;
  }

  assetAliases[r.input] = r.name;
  if (r.entity_id) primaryIdToAsset.set(r.entity_id, r.name);
}
for (const a of assetMap.askList) assetAliases[a] ??= a;

/**
 * ClinicalTrials.gov condition string -> Convoke indication name, accepted
 * only at full confidence. Rejections are reported, never silently dropped.
 */
const rejectedIndications = [];
for (const r of indicationFile.resolutions) {
  if (r.name && r.confidence >= INDICATION_CONFIDENCE_MIN) {
    conditionToIndication[r.input] = r.name;
  } else if (r.name) {
    rejectedIndications.push(`${r.input} -> ${r.name} (${r.confidence})`);
  }
}

/**
 * Every spelling an event might use -> canonical asset name: the canonical
 * name itself, the spelling ClinicalTrials.gov used, and the brand/code names
 * the Catalyst Calendar reports.
 */
const catalystNameToAsset = new Map();
for (const [ours, canonical] of Object.entries(assetAliases)) {
  catalystNameToAsset.set(key(canonical), canonical);
  catalystNameToAsset.set(key(ours), canonical);
}
for (const [brand, asset] of Object.entries(CATALYST_DRUG_ALIASES)) {
  catalystNameToAsset.set(key(brand), assetAliases[asset] ?? asset);
}

// ------------------------------------------------------- programs by asset

const programsByAsset = {};
let unmappedDrugRows = 0;

for (const row of rows) {
  const asset = primaryIdToAsset.get(row.drug_id);
  if (!asset) {
    // A near-hit entity the resolver returned alongside the one we asked for
    // (biosimilar, salt form, different molecule). Counted, not silently kept.
    unmappedDrugRows++;
    continue;
  }
  const stageRank = STAGE_ORDER.indexOf(row.development_stage);
  (programsByAsset[asset] ??= []).push({
    indication: row.indication_name,
    stage: row.development_stage,
    stageRank: stageRank < 0 ? 0 : stageRank,
    status: row.program_status,
    targets: row.targets ?? [],
    modalities: row.modalities ?? [],
  });
}

// Most advanced first, so a consumer taking [0] gets the lead program.
for (const list of Object.values(programsByAsset)) {
  list.sort((a, b) => b.stageRank - a.stageRank);
}

// ------------------------------------------------------ catalysts by asset

const catalystsByAsset = {};
let unmappedCatalystDrugs = 0;

for (const ev of catalystFile.events) {
  for (const drug of ev.drugs) {
    const asset = catalystNameToAsset.get(key(drug));
    if (!asset) {
      unmappedCatalystDrugs++;
      continue;
    }
    (catalystsByAsset[asset] ??= []).push({
      eventId: ev.event_id,
      name: ev.event_name,
      // What the source actually stated ("2026", "Q3 2026", "2027-02-05").
      // This is what the UI must show.
      reportedDate: ev.reported_date,
      // Convoke's sortable approximation. Ordering only — never displayed.
      sortDate: ev.sort_date,
      indications: ev.indications,
    });
  }
}

// Soonest first, so a consumer taking [0] gets the next catalyst.
for (const list of Object.values(catalystsByAsset)) {
  list.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
}

// ------------------------------------------------------------------- write

const out = {
  schemaVersion: "1.0.0",
  source: "Convoke Knowledge Graph via mcp.convoke.bio (MCP)",
  tools: ["query_program_tracker", "query_catalyst_calendar"],
  retrievedAt: catalystFile.retrievedAt,
  note:
    "Build-time enrichment. Committed so the app never calls Convoke at " +
    "request time. reportedDate is the granularity the source stated; " +
    "sortDate is an approximation for ordering and must not be displayed.",
  stageOrder: STAGE_ORDER,
  /**
   * Canonical Convoke asset name -> the spelling ClinicalTrials.gov used.
   * Convoke canonicalises to development codes ("Iberdomide" -> "CC-220"), but
   * the researcher is reading a trial record that says Iberdomide. Join on the
   * canonical name, label with this.
   */
  assetLabels: Object.fromEntries(
    Object.entries(assetAliases).map(([ours, canonical]) => [canonical, ours]),
  ),
  /**
   * Raw ClinicalTrials.gov intervention string -> canonical asset names.
   * Exact lookup: the app must not re-normalize anything at runtime.
   */
  byIntervention: Object.fromEntries(
    Object.entries(assetMap.rawToAssets).map(([raw, v]) => [
      raw,
      {
        assets: [...new Set(v.assets.map((a) => assetAliases[a] ?? a))],
        reason: v.reason,
      },
    ]),
  ),
  /** Raw ClinicalTrials.gov condition string -> Convoke indication name. */
  conditionToIndication,
  programsByAsset,
  catalystsByAsset,
};

await writeFile(OUT, JSON.stringify(out, null, 2));

const assetsWithPrograms = Object.keys(programsByAsset).length;
const assetsWithCatalysts = Object.keys(catalystsByAsset).length;
console.log(`program rows merged      : ${rows.length} from ${pages.length} pages`);
console.log(`assets asked / resolved  : ${assetMap.askList.length} / ${assetsWithPrograms}`);
console.log(`assets with a catalyst   : ${assetsWithCatalysts}`);
console.log(
  `conditions mapped        : ${Object.keys(conditionToIndication).length}` +
    ` of ${indicationFile.resolutions.length}`,
);
console.log(`rows dropped (near hits) : ${unmappedDrugRows} program, ${unmappedCatalystDrugs} catalyst`);
if (lowConfidence.size > 0) {
  console.log(
    `\nrejected below ${CONFIDENCE_MIN} confidence (kept as "no program data"):`,
  );
  for (const l of lowConfidence) console.log(`  ${l}`);
}
if (rejectedIndications.length > 0) {
  console.log(
    `\nindications rejected below ${INDICATION_CONFIDENCE_MIN} confidence:`,
  );
  for (const l of rejectedIndications) console.log(`  ${l}`);
}
console.log(`\nwrote ${OUT}`);
