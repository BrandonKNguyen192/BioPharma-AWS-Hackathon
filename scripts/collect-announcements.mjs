/**
 * Collect discovery-grade pipeline announcements from SEC EDGAR and GDELT.
 *
 * Raw responses are inputs to build-pipeline-signals.mjs. They are not product
 * facts and must pass through the reviewed ledger before display.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = process.env.RADAR_OUT_DIR || join(ROOT, "tmp", "radar");
const EDGAR = "https://efts.sec.gov/LATEST/search-index";
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";
const UA = "ClearTrialHackathon cleartrial@hackathon.demo";
const START_DATE = process.env.RADAR_START_DATE || "2025-01-01";
const END_DATE = process.env.RADAR_END_DATE || new Date().toISOString().slice(0, 10);

const SPONSORS = [
  { id: "bms", drugs: ["nivolumab", "Opdivo", "pumitamig", "iberdomide"] },
  { id: "pfizer", drugs: ["elranatamab", "palbociclib", "sunitinib"] },
  { id: "merck", drugs: ["pembrolizumab", "Keytruda"] },
  { id: "roche", drugs: ["atezolizumab", "Tecentriq", "bevacizumab"] },
  { id: "astrazeneca", drugs: ["durvalumab", "Imfinzi", "olaparib"] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, { tries = 4 } = {}) {
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (response.ok) return response.json();
    if (![403, 429, 500, 502, 503, 504].includes(response.status) || attempt === tries) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
    }
    await sleep(attempt * 3000);
  }
}

function drugQuery(sponsor) {
  return `(${sponsor.drugs.map((drug) => `"${drug}"`).join(" OR ")})`;
}

async function collectEdgar(sponsor) {
  const params = new URLSearchParams({
    q: `${drugQuery(sponsor)} ("clinical trial" OR "Phase 1" OR "Phase 2" OR "Phase 3" OR IND)`,
    dateRange: "custom",
    startdt: START_DATE,
    enddt: END_DATE,
    forms: "8-K,10-K,10-Q",
    from: "0",
    size: "100",
  });
  return fetchJson(`${EDGAR}?${params}`);
}

async function collectGdelt(sponsor) {
  const params = new URLSearchParams({
    query: `${drugQuery(sponsor)} ("clinical trial" OR phase OR IND OR enrollment OR readout)`,
    mode: "ArtList",
    format: "json",
    maxrecords: "250",
    startdatetime: `${START_DATE.replaceAll("-", "")}000000`,
    enddatetime: `${END_DATE.replaceAll("-", "")}235959`,
  });
  return fetchJson(`${GDELT}?${params}`);
}

await mkdir(OUT, { recursive: true });
const manifest = {
  schemaVersion: "1.0.0",
  collectedAt: new Date().toISOString(),
  dateRange: { start: START_DATE, end: END_DATE },
  sources: [],
};

for (const sponsor of SPONSORS) {
  try {
    const edgar = await collectEdgar(sponsor);
    const count = edgar.hits?.hits?.length ?? 0;
    await writeFile(join(OUT, `edgar-${sponsor.id}.json`), JSON.stringify(edgar, null, 2));
    manifest.sources.push({ sponsor: sponsor.id, source: "edgar", status: "collected", count });
    console.log(`EDGAR ${sponsor.id}: ${count} hits`);
  } catch (error) {
    manifest.sources.push({ sponsor: sponsor.id, source: "edgar", status: "failed", error: error.message });
    console.warn(`EDGAR ${sponsor.id}: ${error.message}`);
  }

  await sleep(1000);

  try {
    const gdelt = await collectGdelt(sponsor);
    const count = gdelt.articles?.length ?? 0;
    await writeFile(join(OUT, `gdelt-${sponsor.id}.json`), JSON.stringify(gdelt, null, 2));
    manifest.sources.push({ sponsor: sponsor.id, source: "gdelt", status: "collected", count });
    console.log(`GDELT ${sponsor.id}: ${count} articles`);
  } catch (error) {
    manifest.sources.push({ sponsor: sponsor.id, source: "gdelt", status: "failed", error: error.message });
    console.warn(`GDELT ${sponsor.id}: ${error.message}`);
  }

  await sleep(5000);
}

await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
const total = manifest.sources.reduce((sum, source) => sum + (source.count ?? 0), 0);
console.log(`done: ${total} discovery records collected across ${manifest.sources.length} source queries`);
