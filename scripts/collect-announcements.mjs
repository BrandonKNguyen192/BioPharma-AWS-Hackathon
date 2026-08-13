/**
 * ClearTrial Trial Radar source collector.
 *
 * Discovery is build-time only. Search results are written to tmp/radar and
 * never displayed as facts. A separate reviewed build step is required before
 * a claim can enter src/data/pipeline-radar.json.
 *
 * Direct HTML is preferred. Bright Data is an optional transport fallback for
 * sponsor pages that return a challenge; it is never treated as an authority.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "tmp", "radar");
const ENV_LOCAL = join(ROOT, ".env.local");
const UA = "ClearTrialHackathon research@cleartrial.demo";

const SOURCES = [
  {
    id: "ktx1001-ind-clearance",
    sponsor: "K36 Therapeutics",
    url: "https://www.prnewswire.com/news-releases/k36-therapeutics-announces-fda-clearance-of-investigational-new-drug-application-and-formation-of-clinical-advisory-board-for-lead-program-ktx-1001-301610149.html",
  },
  {
    id: "ktx1001-first-patient",
    sponsor: "K36 Therapeutics",
    url: "https://www.prnewswire.com/news-releases/k36-therapeutics-announces-dosing-of-first-patient-in-ktx-1001-phase-1-clinical-trial-for-relapsed-or-refractory-multiple-myeloma-and-addition-of-mr-michael-heffernan-as-independent-board-director-301793617.html",
  },
  {
    id: "orm6151-acquisition",
    sponsor: "Orum Therapeutics / Bristol Myers Squibb",
    url: "https://www.orumrx.com/news/orum-orm-6151-acquisition-by-bms/",
  },
  {
    id: "pumitamig-lung02-readout",
    sponsor: "BioNTech / Bristol Myers Squibb",
    url: "https://www.biontech.com/int/en/home/mediaroom/news/press-releases/2026/05/Global-Data-for-BioNTech-and-Bristol-Myers-Squibb-s-PD-L1xVEGF-A-Bispecific-Pumitamig-Shows-Encouraging-Efficacy-in-Patients-with-Non-Small-Cell-Lung-Cancer-in-ROSETTA-Lung-02-Trial.html",
  },
  {
    id: "iberdomide-excaliber",
    sponsor: "Bristol Myers Squibb",
    url: "https://news.bms.com/news/details/2025/Bristol-Myers-Squibb-Announces-Phase-3-EXCALIBER-RRMM-Study-Evaluating-Iberdomide-in-Combination-with-Standard-Therapies-Demonstrated-a-Significant-Improvement-in-Minimal-Residual-Disease-Negativity-Rates-in-Relapsed-or-Refractory-Multiple-Myeloma/default.aspx",
  },
];

async function loadEnvLocal() {
  try {
    const raw = await readFile(ENV_LOCAL, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (process.env[key]) continue;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch {
    // Optional local credentials.
  }
}

async function directFetch(url) {
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, redirect: "follow" });
  const body = await response.text();
  if (!response.ok || /Attention Required!|cf-chl-/i.test(body)) throw new Error(`direct ${response.status}`);
  return { body, transport: "direct" };
}

async function brightDataFetch(url) {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key) throw new Error("no Bright Data key");
  const response = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone: process.env.BRIGHTDATA_ZONE || "web_unlocker1", url, format: "raw" }),
  });
  const body = await response.text();
  if (!response.ok || !body.trim()) throw new Error(`Bright Data ${response.status}${body ? `: ${body.slice(0, 120)}` : " empty body"}`);
  return { body, transport: "bright_data" };
}

async function fetchSource(source) {
  try {
    return await directFetch(source.url);
  } catch (directError) {
    try {
      return await brightDataFetch(source.url);
    } catch (brightError) {
      throw new Error(`${directError.message}; ${brightError.message}`);
    }
  }
}

await loadEnvLocal();
await mkdir(OUT, { recursive: true });

const manifest = { schemaVersion: "1.0.0", collectedAt: new Date().toISOString(), documents: [] };
for (const source of SOURCES) {
  try {
    const { body, transport } = await fetchSource(source);
    const sha256 = createHash("sha256").update(body).digest("hex");
    const path = join(OUT, `${source.id}.html`);
    await writeFile(path, body);
    manifest.documents.push({ ...source, status: "collected", transport, sha256, bytes: Buffer.byteLength(body), path: `tmp/radar/${source.id}.html` });
    console.log(`OK ${source.id}: ${transport}, ${Buffer.byteLength(body)} bytes`);
  } catch (error) {
    manifest.documents.push({ ...source, status: "failed", error: error.message });
    console.warn(`FAIL ${source.id}: ${error.message}`);
  }
}

await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`done: ${manifest.documents.filter((document) => document.status === "collected").length}/${SOURCES.length} sources collected`);
