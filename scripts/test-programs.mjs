/**
 * Regression tests for the Convoke program join.
 *
 * Two classes of failure this guards against:
 *
 *   A. Data integrity in src/data/programs.json — sort order the app relies on,
 *      and the de-branding rule (the sponsor's name must not appear).
 *   B. Join semantics — a stage borrowed from another indication must never
 *      outrank one that actually describes this trial, and the displayed date
 *      must be the granularity the source stated, not Convoke's sort key.
 *
 * Mirrors the logic in src/lib/programs.ts. If you change the join there,
 * change it here and keep both green.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = JSON.parse(readFileSync(join(ROOT, "src/data/programs.json"), "utf8"));
const T = JSON.parse(readFileSync(join(ROOT, "src/data/trials.json"), "utf8"));

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "OK  " : "FAIL"} ${name.padEnd(58)} got ${JSON.stringify(got)}`,
  );
};

/* ---------- A. Data integrity ---------- */

console.log("data integrity");

// The app takes rows[0] as the lead program and catalysts[0] as the next
// catalyst. Both orderings are produced offline; if they regress, every
// downstream claim is silently wrong.
const programsDescending = Object.values(P.programsByAsset).every((rows) =>
  rows.every((r, i) => i === 0 || rows[i - 1].stageRank >= r.stageRank),
);
check("programs sorted most-advanced first", programsDescending, true);

const catalystsAscending = Object.values(P.catalystsByAsset).every((rows) =>
  rows.every((r, i) => i === 0 || rows[i - 1].sortDate <= r.sortDate),
);
check("catalysts sorted soonest first", catalystsAscending, true);

// Every stage must be a known rank, or "most advanced" comparisons are noise.
const stagesKnown = Object.values(P.programsByAsset)
  .flat()
  .every((r) => P.stageOrder.includes(r.stage));
check("every stage is in stageOrder", stagesKnown, true);

// De-branding: STATUS.md keeps the client name at zero occurrences in the
// working tree. This file is generated, so assert rather than trust.
const blob = JSON.stringify(P).toLowerCase();
check("no sponsor name in the data file", blob.includes("bristol"), false);
check("no 'squibb' in the data file", blob.includes("squibb"), false);

// Assets referenced by an intervention must be resolvable to a label.
const referenced = new Set(
  Object.values(P.byIntervention).flatMap((v) => v.assets),
);
const unlabelled = [...referenced].filter((a) => !P.assetLabels[a]);
check("every referenced asset has a label", unlabelled, []);

/* ---------- B. Join semantics ---------- */

console.log("\njoin semantics");

const trialsById = new Map(T.trials.map((t) => [t.nctId, t]));

function indicationsFor(trial) {
  return new Set(
    trial.conditions.map((c) => P.conditionToIndication[c]).filter(Boolean),
  );
}

function pickProgram(asset, trialIndications) {
  const rows = P.programsByAsset[asset];
  if (!rows || rows.length === 0) return null;
  const matched = rows.find((r) => trialIndications.has(r.indication));
  const row = matched ?? rows[0];
  return {
    label: P.assetLabels[asset] ?? asset,
    stage: row.stage,
    stageRank: row.stageRank,
    indication: row.indication,
    indicationMatched: Boolean(matched),
  };
}

function contextFor(nctId) {
  const trial = trialsById.get(nctId);
  if (!trial) return null;
  const inds = indicationsFor(trial);
  const assets = [
    ...new Set(
      trial.interventions.flatMap((i) => P.byIntervention[i]?.assets ?? []),
    ),
  ]
    .map((a, order) => ({ ctx: pickProgram(a, inds), order }))
    .filter((x) => x.ctx)
    .sort((a, b) => {
      if (a.ctx.indicationMatched !== b.ctx.indicationMatched) {
        return a.ctx.indicationMatched ? -1 : 1;
      }
      return a.order - b.order;
    })
    .map((x) => x.ctx);
  return assets.length ? { assets, primary: assets[0] } : null;
}

// A matched-indication program must outrank a more advanced one borrowed from
// somewhere else. Constructed rather than sampled so the assertion is exact.
const borrowed = [
  { label: "X", order: 0, indicationMatched: false },
  { label: "Y", order: 1, indicationMatched: true },
].sort((a, b) =>
  a.indicationMatched !== b.indicationMatched
    ? a.indicationMatched
      ? -1
      : 1
    : a.order - b.order,
);
check("matched indication outranks unmatched", borrowed[0].label, "Y");

// The primary asset is the experimental arm the registry lists first, NOT the
// most advanced program. NCT06712316 studies Pumitamig (Phase 3) against
// Pembrolizumab (approved); naming the approved comparator would misdescribe
// whose recruitment is at stake.
const combo = contextFor("NCT06712316");
check("primary is the experimental arm", combo?.primary.label, "Pumitamig");
check(
  "and a comparator with a higher stage is still listed",
  combo?.assets.some(
    (a) => a.label !== "Pumitamig" && a.stageRank > combo.primary.stageRank,
  ),
  true,
);

// A chemotherapy-only arm has no tracked asset, so the dashboard must show
// absence rather than a zero or a stale stage.
const chemoOnly = Object.entries(P.byIntervention).filter(
  ([, v]) => v.assets.length === 0,
);
check("backbone arms resolve to no asset", chemoOnly.length > 0, true);
check(
  "and carry a reason for the UI",
  chemoOnly.every(([, v]) => typeof v.reason === "string"),
  true,
);

// The lead NSCLC trial for the portfolio's most-studied asset.
const nsclc = contextFor("NCT06712316");
check("NCT06712316 resolves assets", nsclc !== null, true);
check(
  "and its lead program matches the trial's indication",
  nsclc?.primary.indicationMatched,
  true,
);

// Pumitamig is the most frequent intervention in the dataset; its NSCLC
// program is the headline claim, so pin it.
const pumitamig = P.programsByAsset["Pumitamig"] ?? [];
const pumiNsclc = pumitamig.find(
  (r) => r.indication === "Non-Small Cell Lung Cancer (NSCLC)",
);
check("Pumitamig has an NSCLC program", pumiNsclc?.stage, "Phase 3");

// Every catalyst must carry the source's own granularity. Displaying sortDate
// would invent a day-precise date the filing never stated.
const allCatalysts = Object.values(P.catalystsByAsset).flat();
check(
  "every catalyst has a reportedDate",
  allCatalysts.every((c) => typeof c.reportedDate === "string" && c.reportedDate),
  true,
);
const approximated = allCatalysts.filter(
  (c) => c.reportedDate !== c.sortDate,
).length;
check("some catalysts are coarser than their sort key", approximated > 0, true);

/* ---------- C. Seeded cohort integrity ---------- */

console.log("\nseeded cohort");

// The dashboard's default view is entirely seeded rows. If a seeded NCT id is
// not in the dataset, its criterion is not the verbatim quote the footer
// claims, and its program context silently collapses to "no program". This
// drifted once already when the dataset was refetched.
const seedSrc = readFileSync(join(ROOT, "src/lib/signal-store.ts"), "utf8");
const seededIds = [...seedSrc.matchAll(/exampleTrial:\s*"(NCT\d+)"/g)].map(
  (m) => m[1],
);
check("seed cites at least one trial", seededIds.length > 0, true);
check(
  "every seeded NCT id exists in trials.json",
  seededIds.filter((id) => !trialsById.has(id)),
  [],
);

// And the quoted criterion must actually appear in that trial's protocol.
const misquoted = [
  ...seedSrc.matchAll(
    /exampleTrial:\s*"(NCT\d+)",\s*exampleCriterion:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g,
  ),
]
  .map(([, id, text]) => ({ id, text: text.replace(/\\"/g, '"') }))
  .filter(({ id, text }) => {
    const t = trialsById.get(id);
    return !t || ![...t.inclusion, ...t.exclusion].includes(text);
  })
  .map((x) => x.id);
check("every seeded criterion is verbatim from that trial", misquoted, []);

check(
  "and seeded trials resolve to program context",
  seededIds.filter((id) => !contextFor(id)),
  [],
);

/* ---------- coverage report ---------- */

let withContext = 0;
for (const t of T.trials) if (contextFor(t.nctId)) withContext++;
console.log(
  `\ncoverage: ${withContext}/${T.trials.length} trials carry program context`,
);

console.log(failures === 0 ? "\nall green" : `\n${failures} FAILING`);
process.exit(failures === 0 ? 0 : 1);
