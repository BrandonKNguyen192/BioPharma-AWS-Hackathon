/**
 * ClearTrial — trial data pipeline.
 *
 * Pulls REAL recruiting oncology trials from ClinicalTrials.gov and writes them
 * to src/data/trials.json, which the app reads at build time.
 *
 * Sponsor-agnostic by default. Set TRIAL_SPONSOR to narrow to one sponsor,
 * e.g. TRIAL_SPONSOR="<sponsor name>" node scripts/fetch-trials.mjs
 *
 * This runs ONCE, offline, and commits its output. The demo never makes a
 * network call for trial data — a podium wifi failure cannot break it.
 *
 * Transport:
 *   - If BRIGHTDATA_API_KEY is set, routes the request through Bright Data's
 *     Web Unlocker so the fetch is resilient to rate limiting / geo blocks.
 *   - Otherwise falls back to the public ClinicalTrials.gov API v2 (no key).
 * Either path yields identical, real data.
 *
 * Usage: node scripts/fetch-trials.mjs
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const ENV_LOCAL = join(ROOT, ".env.local");
const OUT = join(HERE, "..", "src", "data", "trials.json");

const CTG = "https://clinicaltrials.gov/api/v2/studies";

/** Optional sponsor filter. Empty = every sponsor. */
const SPONSOR = (process.env.TRIAL_SPONSOR ?? "").trim();

/** Broad oncology coverage. */
const CONDITION_QUERY =
  "carcinoma OR melanoma OR lymphoma OR myeloma OR leukemia OR " +
  "lung cancer OR bladder cancer OR renal cell OR hepatocellular OR " +
  "colorectal OR gastric OR esophageal OR mesothelioma";

function buildUrl() {
  const p = new URLSearchParams();
  if (SPONSOR) p.set("query.spons", SPONSOR);
  p.set("query.cond", CONDITION_QUERY);
  p.set("filter.overallStatus", "RECRUITING");
  p.set("pageSize", "60");
  p.set("sort", "LastUpdatePostDate:desc");
  return `${CTG}?${p.toString()}`;
}

/**
 * For local hackathon use, load `.env.local` when present so this script can
 * be run directly with `node scripts/fetch-trials.mjs` without requiring the
 * caller to export Bright Data credentials into the shell first.
 */
async function loadEnvLocal() {
  try {
    const raw = await readFile(ENV_LOCAL, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (!key || process.env[key]) continue;
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // No local env file is fine; the script falls back to direct public fetch.
  }
}

/** Fetch through Bright Data when credentials exist, else fetch directly. */
async function fetchStudies(url) {
  const key = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_ZONE || "web_unlocker1";

  if (key) {
    console.log("→ transport: Bright Data Web Unlocker");
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zone, url, format: "raw" }),
    });
    if (!res.ok) {
      console.warn(
        `  Bright Data returned ${res.status}; falling back to direct fetch.`,
      );
    } else {
      return JSON.parse(await res.text());
    }
  } else {
    console.log("→ transport: direct ClinicalTrials.gov API v2 (no key set)");
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ClinicalTrials.gov returned ${res.status}`);
  return res.json();
}

/**
 * ClinicalTrials.gov ships eligibility as one free-text blob. Split it into
 * discrete inclusion / exclusion bullets so the matching engine can evaluate
 * criteria individually rather than substring-matching a wall of prose.
 */
function splitCriteria(raw) {
  if (!raw) return { inclusion: [], exclusion: [] };

  const normalized = raw.replace(/\r/g, "");
  // Find the exclusion header; everything before it is inclusion.
  const marker = /exclusion\s+criteria\s*:?/i.exec(normalized);
  const incRaw = marker ? normalized.slice(0, marker.index) : normalized;
  const excRaw = marker ? normalized.slice(marker.index + marker[0].length) : "";

  const bullets = (block) =>
    block
      .replace(/inclusion\s+criteria\s*:?/i, "")
      .split(/\n\s*(?:[*•\-–]|\d+[.)])\s*/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 12)
      .slice(0, 12);

  return { inclusion: bullets(incRaw), exclusion: bullets(excRaw) };
}

function normalize(study) {
  const p = study.protocolSection ?? {};
  const id = p.identificationModule ?? {};
  const status = p.statusModule ?? {};
  const cond = p.conditionsModule ?? {};
  const design = p.designModule ?? {};
  const arms = p.armsInterventionsModule ?? {};
  const elig = p.eligibilityModule ?? {};

  const interventions = (arms.interventions ?? [])
    .map((i) => i.name)
    .filter(Boolean);

  const { inclusion, exclusion } = splitCriteria(elig.eligibilityCriteria);

  return {
    nctId: id.nctId,
    title: id.briefTitle,
    officialTitle: id.officialTitle ?? null,
    status: status.overallStatus ?? null,
    phase: (design.phases ?? []).join("/") || "N/A",
    conditions: cond.conditions ?? [],
    interventions,
    inclusion,
    exclusion,
    url: `https://clinicaltrials.gov/study/${id.nctId}`,
  };
}

async function main() {
  await loadEnvLocal();
  const url = buildUrl();
  const data = await fetchStudies(url);
  const studies = data.studies ?? [];

  const trials = studies
    .map(normalize)
    // Keep only records rich enough to actually match against.
    .filter((t) => t.nctId && t.inclusion.length > 0);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        source: "ClinicalTrials.gov API v2",
        sponsor: SPONSOR || "All sponsors",
        fetchedAt: new Date().toISOString(),
        count: trials.length,
        trials,
      },
      null,
      2,
    ),
  );

  console.log(
    `✓ ${trials.length} real trials (${SPONSOR || "all sponsors"}) → src/data/trials.json`,
  );
  for (const t of trials.slice(0, 5)) {
    console.log(`   ${t.nctId}  ${t.phase.padEnd(14)} ${t.title.slice(0, 62)}`);
  }
}

main().catch((err) => {
  console.error("✗ trial fetch failed:", err.message);
  process.exit(1);
});
