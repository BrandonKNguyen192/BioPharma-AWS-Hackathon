/**
 * ClearTrial — Trial Radar: build pipeline signals.
 *
 * Consumes tmp/radar/ raw collections (scripts/collect-announcements.mjs) and
 * produces:
 *   - src/data/trial-registry-meta.json  (CT.gov first-posted dates + lead
 *     sponsors + sponsor-internal trial IDs for every monitored trial)
 *   - src/data/pipeline-signals.json     (evidence-backed milestone signals)
 *
 * Deterministic extraction only — no LLM decides what a signal means. The
 * milestone classification is keyword rules with the source evidence attached,
 * consistent with the engine invariant.
 *
 * Usage: node scripts/build-pipeline-signals.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RAW = join(ROOT, "tmp", "radar");
const OUT_DATA = join(ROOT, "src", "data");

const UA =
  "ClearTrialHackathon cleartrial@hackathon.demo (pipeline radar demo)";

const CTG = "https://clinicaltrials.gov/api/v2/studies";

/* ------------------------------------------------------------------ *
 * Lexicons
 * ------------------------------------------------------------------ */

/** signal drug -> trial dataset intervention spellings */
const DRUG_INTERVENTIONS = {
  nivolumab: ["nivolumab", "nivolumab plus ipilimumab"],
  ipilimumab: ["ipilimumab", "nivolumab plus ipilimumab"],
  pumitamig: ["pumitamig"],
  iberdomide: ["iberdomide"],
  elranatamab: ["elranatamab"],
  palbociclib: ["palbociclib"],
  sunitinib: ["sunitinib"],
  pembrolizumab: ["pembrolizumab"],
  atezolizumab: ["atezolizumab"],
  bevacizumab: ["bevacizumab"],
  durvalumab: ["durvalumab"],
  olaparib: ["olaparib"],
};

/** Drug → sponsor id. The radar groups by the DRUG's owner, not the filer:
 *  a C4 Therapeutics 8-K that mentions palbociclib is still a signal about
 *  Pfizer's asset. */
const DRUG_OWNER = {
  nivolumab: "bms",
  ipilimumab: "bms",
  pumitamig: "bms",
  iberdomide: "bms",
  elranatamab: "pfizer",
  palbociclib: "pfizer",
  sunitinib: "pfizer",
  pembrolizumab: "merck",
  atezolizumab: "roche",
  bevacizumab: "roche",
  durvalumab: "astrazeneca",
  olaparib: "astrazeneca",
};

const SPONSORS = {
  bms: { label: "Bristol Myers Squibb", tokens: ["bristol myers", "bmy"] },
  pfizer: { label: "Pfizer", tokens: ["pfizer"] },
  merck: { label: "Merck & Co", tokens: ["merck"] },
  roche: { label: "Roche / Genentech", tokens: ["genentech", "roche"] },
  astrazeneca: { label: "AstraZeneca", tokens: ["astrazeneca", "azn"] },
};

const INDICATION_MAP = [
  [/myeloma/i, "multiple myeloma"],
  [/non-small cell lung|nsclc|lung cancer|pulmonary/i, "lung cancer (NSCLC)"],
  [/small cell lung|sclc/i, "small cell lung cancer"],
  [/melanoma/i, "melanoma"],
  [/renal cell|kidney|rcc/i, "renal cell carcinoma"],
  [/colorectal|colon|rectal/i, "colorectal cancer"],
  [/lymphoma|hodgkin|dlbcl/i, "lymphoma"],
  [/leukemia|leukaemia|aml|cll/i, "leukemia"],
  [/gastric|stomach|esophageal/i, "gastric/esophageal"],
  [/urothelial|bladder/i, "urothelial carcinoma"],
  [/hepatocell|hcc|liver/i, "hepatocellular carcinoma"],
  [/breast/i, "breast cancer"],
  [/pancrea/i, "pancreatic cancer"],
  [/ovarian/i, "ovarian cancer"],
];

const MILESTONE_RULES = [
  {
    type: "ind_clearance",
    re: /investigational new drug|\bIND\b|ind[-\s]?enabling|ind clearance/i,
  },
  {
    type: "trial_initiation",
    re:
      /first patient|first subject|initiat(?:e|ed|ing)?\s+(?:a\s+)?(?:clinical\s+)?(?:trial|study|program)|dosing\s+(?:initiated|began|started)|first\s+dose\s+administered|open(?:ed|s)?\s+(?:a\s+)?(?:clinical\s+)?(?:trial|study)/i,
  },
  {
    type: "enrollment",
    re: /enroll(?:ment|ing|ed)?\s+(?:first|patients|participants)|completed\s+enrollment|fully\s+enrolled/i,
  },
  {
    type: "data_readout",
    re: /topline|readout|interim\s+data|data\s+from\s+the|results\s+from\s+the|phase\s+\d\s+(?:trial\s+)?(?:data|results)/i,
  },
  {
    type: "regulatory",
    re:
      /(?:fda\s+)?approv(?:al|ed|e)|accepted\s+by|breakthrough\s+therapy|fast\s+track|priority\s+review|regulatory\s+submission|nda\s+submission|bla\s+submission|accepted\s+for\s+review/i,
  },
  {
    type: "partnership",
    re: /collaborat|partnership|licens|alliance|acquisition|agreement\s+to/i,
  },
];

const PHASE_RE =
  /phase\s*(?:[12]\/)?([1-4])\b|phase\s*(iv|iii|ii|i)\b|pivotal\s+phase\s*([123])/i;

const IND_RE = /\bIND\b|investigational new drug/i;
/** If a literal IND number were ever printed we would flag it; FDA never does. */
const IND_NUMBER_RE = /\bIND\s*#?\s*(\d{4,})\b/i;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, { headers = {}, tries = 3 } = {}) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json", ...headers },
      });
      if (res.status === 429) {
        await sleep(3000 * i);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries) throw e;
      await sleep(1500 * i);
    }
  }
}

function pickIndication(text) {
  for (const [re, label] of INDICATION_MAP) if (re.test(text)) return label;
  return null;
}

function classifyMilestone(text) {
  for (const r of MILESTONE_RULES) if (r.re.test(text)) return r.type;
  return "other";
}

function extractPhase(text) {
  const m = PHASE_RE.exec(text);
  if (!m) return null;
  const v = m[1] ?? m[2] ?? m[3];
  const roman = { i: "1", ii: "2", iii: "3", iv: "4" };
  return roman[v?.toLowerCase()] ?? String(v);
}

function extractDrug(text) {
  const lower = text.toLowerCase();
  for (const [drug] of Object.entries(DRUG_INTERVENTIONS)) {
    if (lower.includes(drug)) return drug;
  }
  for (const [drug, alts] of [
    ["pembrolizumab", ["keytruda"]],
    ["atezolizumab", ["tecentriq"]],
    ["durvalumab", ["imfinzi"]],
    ["nivolumab", ["opdivo"]],
  ]) {
    if (alts.some((a) => lower.includes(a))) return drug;
  }
  return null;
}

/** Filing index URL for a hit (adsh = accession with dashes). */
function filingIndexUrl(hit) {
  const { ciks, adsh } = hit._source;
  if (!ciks?.length || !adsh) return null;
  return `https://www.sec.gov/Archives/edgar/data/${ciks[0]}/${adsh.replaceAll("-", "")}/index.json`;
}

const CONCURRENCY = 4;
async function mapPool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
      await sleep(150); // gentle pacing for SEC rate limits
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

/** Fetch the filing's primary document text and clip an evidence passage. */
async function enrichFiling(hit) {
  const idxUrl = filingIndexUrl(hit);
  if (!idxUrl) return null;
  try {
    const idx = await fetchJson(idxUrl);
    const docs = (idx.directory?.item ?? []).filter((d) =>
      /\.(htm|html|txt)$/i.test(d.name),
    );
    // Prefer the main filing document: exclude XBRL artifacts (R1.htm-style
    // report docs and *xbrl* names) and pick the largest remaining htm/txt.
    const docs2 = docs.filter(
      (d) => !/^R\d+\.htm$/i.test(d.name) && !/xbrl/i.test(d.name),
    );
    const doc = (docs2.length ? docs2 : docs)
      .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
    if (!doc) return null;
    const base = idxUrl.replace(/index\.json$/, "");
    let text = "";
    for (let i = 1; i <= 4; i++) {
      const res = await fetch(`${base}${doc.name}`, {
        headers: { "User-Agent": UA },
      });
      if (res.status === 429 || res.status === 403) {
        await sleep(2000 * i);
        continue;
      }
      if (!res.ok) {
        await sleep(1000 * i);
        continue;
      }
      text = await res.text();
      break;
    }
    if (!text) return null;
    text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const drug = extractDrug(text);
    const lower = text.toLowerCase();
    // clip around the most load-bearing mention: an IND statement, then the
    // drug, then any trial/phase mention. This keeps the evidence quote
    // showing the actual milestone sentence, not boilerplate.
    const needles = ["investigational new drug", "ind clearance"]
      .map((n) => (IND_RE.test(text) ? n : null))
      .concat([drug && ` ${drug} `, "clinical trial", "phase "])
      .filter(Boolean);
    let start = -1;
    for (const n of needles) {
      const i = lower.indexOf(n);
      if (i !== -1) {
        start = i;
        break;
      }
    }
    const excerpt =
      start === -1
        ? text.slice(0, 400)
        : text.slice(Math.max(0, start - 200), start + 700);
    return {
      drug,
      excerpt,
      phase: extractPhase(text),
      indication: pickIndication(text),
      milestone: classifyMilestone(text),
      indMentioned: IND_RE.test(text),
      indNumberPublished: IND_NUMBER_RE.test(text),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

await mkdir(OUT_DATA, { recursive: true });

// 1. Registry meta for all monitored trials (CT.gov first-posted + sponsor).
const TRIALS = JSON.parse(
  await readFile(join(OUT_DATA, "trials.json"), "utf8"),
).trials;
const ids = TRIALS.map((t) => t.nctId);
const regParams = new URLSearchParams();
regParams.set("query.id", ids.join(","));
regParams.set("fields", "NCTId,StudyFirstPostDate,LeadSponsorName,OrgStudyIdInfo");
regParams.set("pageSize", "100");
const regUrl = `${CTG}?${regParams.toString()}`;
let registryMeta = {};
try {
  const reg = await fetchJson(regUrl);
  registryMeta = Object.fromEntries(
    (reg.studies ?? []).map((s) => {
      const p = s.protocolSection ?? {};
      const id = p.identificationModule ?? {};
      const st = p.statusModule ?? {};
      const sp = p.sponsorCollaboratorsModule ?? {};
      return [
        id.nctId,
        {
          firstPosted: st.studyFirstPostDateStruct?.date ?? null,
          leadSponsor: sp.leadSponsor?.name ?? null,
          internalId: id.orgStudyIdInfo?.id ?? null,
          status: st.overallStatus ?? null,
        },
      ];
    }),
  );
  console.log(`registry meta: ${Object.keys(registryMeta).length} trials`);
} catch (e) {
  console.log(`registry meta failed (using {}): ${e.message}`);
}
await writeFile(
  join(OUT_DATA, "trial-registry-meta.json"),
  JSON.stringify(
    { schemaVersion: "1.0.0", source: "ClinicalTrials.gov API v2", fetchedAt: new Date().toISOString(), trials: registryMeta },
    null,
    2,
  ),
);

// 2. EDGAR filings → signals (enriched with real excerpts).
const signals = [];
for (const [sponsorId, sponsor] of Object.entries(SPONSORS)) {
  let raw;
  try {
    raw = JSON.parse(await readFile(join(RAW, `edgar-${sponsorId}.json`), "utf8"));
  } catch {
    continue;
  }
  const hits = (raw.hits?.hits ?? [])
    .map((h) => ({ h, src: h._source }))
    .filter(({ src }) => {
      const d = src.file_date ?? "";
      return d >= "2025-01-01"; // recency
    })
    .slice(0, 14); // top filings per sponsor query

  const enriched = await mapPool(hits, async ({ h }) => {
    const e = await enrichFiling(h);
    return { h, e };
  });

  for (const { h, e } of enriched) {
    const src = h._source;
    const filingLabel = `${sponsor.label} 8-K filed ${src.file_date}`;
    if (!e?.excerpt) continue;
    const drug = e.drug ?? extractDrug(`${filingLabel} ${e.excerpt}`);
    // Attribute to the drug's owner when resolvable; fall back to the query
    // sponsor. The filer is kept as evidence, not as the attribution.
    const owner = (drug && DRUG_OWNER[drug]) || sponsorId;
    signals.push({
      id: `sig-${sponsorId}-${src.adsh ?? src.file_num?.[0]}`,
      sponsor: owner,
      sponsorLabel: SPONSORS[owner]?.label ?? sponsor.label,
      drug,
      filer: (src.display_names?.[0] ?? "").replace(/\s{2,}/g, " ").slice(0, 80),
      phase: e.phase,
      indication: e.indication,
      milestoneType: e.milestone,
      headline: filingLabel,
      date: src.file_date,
      sourceType: "sec_filing",
      sourceUrl: filingIndexUrl(h),
      sourceDomain: "sec.gov",
      evidence: e.excerpt.trim().slice(0, 500),
      indMentioned: e.indMentioned,
      indNumberPublished: e.indNumberPublished ?? false,
    });
  }
  console.log(`EDGAR ${sponsorId}: ${signals.filter((s) => s.sponsor === sponsorId).length} signals`);
}

// 3. GDELT articles → signals.
for (const [sponsorId, sponsor] of Object.entries(SPONSORS)) {
  let raw;
  try {
    raw = JSON.parse(await readFile(join(RAW, `gdelt-${sponsorId}.json`), "utf8"));
  } catch {
    continue;
  }
  const articles = (raw.articles ?? []).filter((a) => {
    const t = `${a.title ?? ""} ${a.snippet ?? ""}`;
    // keep only trial/pipeline-relevant headlines
    return /(clinical trial|phase \d|investigational|pipeline|ind\b|enroll|dosing|data|readout|approval|myeloma|lung cancer|melanoma|renal|colorectal|lymphoma|leukemia|oncology)/i.test(t);
  });
  for (const a of articles.slice(0, 15)) {
    const text = `${a.title ?? ""} ${a.snippet ?? ""}`;
    const drug = extractDrug(text);
    const indMentioned = IND_RE.test(text);
    // GDELT seendate: YYYYMMDDTHHMMSSZ -> YYYY-MM-DD
    const rawDate = (a.seendate ?? "").trim();
    const date = rawDate.length >= 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : rawDate;
    signals.push({
      id: `sig-${sponsorId}-gdelt-${signals.length}`,
      sponsor: sponsorId,
      sponsorLabel: sponsor.label,
      drug,
      phase: extractPhase(text),
      indication: pickIndication(text),
      milestoneType: classifyMilestone(text),
      headline: (a.title ?? "").trim().slice(0, 160),
      date,
      sourceType: "press_release",
      sourceUrl: a.url ?? null,
      sourceDomain: a.domain ?? null,
      evidence: (a.snippet ?? (a.title ?? "")).trim().slice(0, 500),
      indMentioned,
      indNumberPublished: IND_NUMBER_RE.test(text),
    });
  }
  console.log(`GDELT ${sponsorId}: ${signals.filter((s) => s.sponsor === sponsorId).length} signals`);
}

const withDrug = signals.filter((s) => s.drug);
// Quality pass: drop boilerplate "other" signals with neither a resolvable
// drug nor an indication nor an IND mention — they add noise, not evidence.
let usable = signals.filter(
  (s) =>
    s.drug ||
    s.indication ||
    s.milestoneType !== "other" ||
    s.indMentioned,
);
// Dedupe: the same filing can be collected under several sponsor queries
// (e.g. a C4 Therapeutics 8-K mentions iberdomide AND elranatamab). Keep the
// first copy per source URL.
const seenUrls = new Set();
usable = usable.filter((s) => {
  const key = s.sourceUrl ?? `${s.sourceType}-${s.headline}-${s.date}`;
  if (seenUrls.has(key)) return false;
  seenUrls.add(key);
  return true;
});
const final = {
  schemaVersion: "1.0.0",
  source: "SEC EDGAR full-text search + GDELT DOC API (collected 2026-08-13)",
  count: usable.length,
  signals: usable,
  drugJoin: Object.fromEntries(
    Object.entries(DRUG_INTERVENTIONS).map(([drug, ints]) => [drug, ints]),
  ),
};
await writeFile(join(OUT_DATA, "pipeline-signals.json"), JSON.stringify(final, null, 2));
console.log(`\n✓ ${usable.length} signals (${withDrug.length} with a resolvable drug) → src/data/pipeline-signals.json`);

/* ------------------------------------------------------------------ *
 * 4. Emit src/data/pipeline-radar.json in the dashboard's schema
 *    (src/lib/pipeline-radar.ts). Same real signals, joined to the
 *    registry — this is the file the Pipeline Radar UI renders.
 * ------------------------------------------------------------------ */

const REG = JSON.parse(
  await readFile(join(OUT_DATA, "trial-registry-meta.json"), "utf8"),
).trials;
const TRIALS_LIST = TRIALS;

const EVENT_MAP = (text, milestoneType) => {
  if (/approv|approved|approval/i.test(text)) return "approval_granted";
  if (/breakthrough|fast track|priority review|accepted for review|accepted by/i.test(text))
    return "regulatory_accepted";
  if (milestoneType === "regulatory" || milestoneType === "ind_clearance")
    return "regulatory_submitted";
  if (milestoneType === "trial_initiation") return "trial_initiated";
  if (milestoneType === "enrollment") return "enrollment_completed";
  if (milestoneType === "data_readout") return "topline_results";
  if (milestoneType === "partnership") return "trial_planned";
  return "trial_planned";
};

const radarSignals = [];
for (const s of usable) {
  const spellings = DRUG_INTERVENTIONS[s.drug] ?? (s.drug ? [s.drug] : []);
  const joined = TRIALS_LIST.filter((t) =>
    t.interventions.some((i) => spellings.includes(i.toLowerCase())),
  );
  const firstJoined = joined[0];
  const meta = firstJoined ? REG[firstJoined.nctId] : null;
  const joinedNct = firstJoined?.nctId ?? null;
  const joinedFirstPosted = meta?.firstPosted ?? null;
  const eventDate = s.date.length === 10 ? s.date : s.date.slice(0, 10);

  radarSignals.push({
    id: s.id,
    eventType: EVENT_MAP(`${s.headline} ${s.evidence}`, s.milestoneType),
    eventDate: { reported: eventDate, precision: "day", sortDate: eventDate },
    company: s.sponsorLabel,
    asset: { name: s.drug ?? "unnamed asset", aliases: [] },
    indication: s.indication ?? "not stated",
    phase: s.phase,
    headline: s.headline,
    summary: s.evidence.slice(0, 400),
    source: {
      publisher: s.sourceDomain ?? (s.sourceType === "sec_filing" ? "SEC EDGAR" : "press wire"),
      type: s.sourceType === "sec_filing" ? "sec_filing" : "company_release",
      url: s.sourceUrl ?? "https://www.sec.gov/",
      title: s.headline,
      publishedAt: eventDate,
      quote: s.evidence.slice(0, 300),
    },
    registryMatch: {
      status: joinedNct ? "exact" : "no_match_as_of",
      nctId: joinedNct,
      checkedAt: new Date().toISOString().slice(0, 10),
      currentStatus: meta?.status ?? null,
      firstPosted: joinedFirstPosted,
      reasons: joinedNct
        ? ["drug matched to trial interventions in the monitored portfolio"]
        : ["no monitored trial studies this drug"],
    },
    evidence: joinedNct
      ? "corroborated"
      : s.sourceType === "sec_filing"
        ? "public_record"
        : "company_asserted",
    reviewNote:
      "Regulatory/registry review: matched deterministically against the committed trial portfolio at build time. IND numbers are never published — FDA 21 CFR 312.130 keeps IND submissions confidential.",
  });
}

const radarFile = {
  schemaVersion: "1.1.0",
  generatedAt: new Date().toISOString(),
  checkedAt: new Date().toISOString().slice(0, 10),
  scope: "Oncology pipeline announcements for sponsors in the monitored trial portfolio",
  sources: [
    "SEC EDGAR full-text search (8-K/10-K/10-Q)",
    "GDELT DOC API (press-wire coverage)",
    "ClinicalTrials.gov API v2 (registry join)",
  ],
  signals: radarSignals,
};
await writeFile(join(OUT_DATA, "pipeline-radar.json"), JSON.stringify(radarFile, null, 2));
console.log(`✓ ${radarSignals.length} radar signals → src/data/pipeline-radar.json`);
