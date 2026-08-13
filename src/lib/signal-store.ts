/**
 * In-memory aggregation of why interested patients failed to match.
 *
 * Privacy: this store never sees patient text. It receives only rule kinds
 * (e.g. "prior_checkpoint_inhibitor") and counts. That is the whole point —
 * sponsors learn which protocol criteria cost them recruitment without
 * ever holding identifiable patient data.
 *
 * Hackathon scope: process memory. A production build would be a real store
 * behind the same interface.
 */

import type { RuleKind, UnmatchedSignal } from "./types";

export interface AggregateRow {
  kind: RuleKind;
  label: string;
  /** Number of distinct patient searches blocked at least once by this rule. */
  patientsBlocked: number;
  exampleTrial: string;
  exampleCriterion: string;
}

interface Store {
  searches: number;
  /** How many of `searches` came from the seed rather than a real search. */
  seeded: number;
  byCancer: Map<string, number>;
  rows: Map<RuleKind, AggregateRow>;
}

/** Survives hot reload in dev. */
const g = globalThis as unknown as { __clearTrialStore?: Store };

function store(): Store {
  if (!g.__clearTrialStore) {
    g.__clearTrialStore = { searches: 0, seeded: 0, byCancer: new Map(), rows: new Map() };
    seed(g.__clearTrialStore);
  }
  return g.__clearTrialStore;
}

/**
 * Seeded cohort representing searches already run through ClearTrial.
 * Counts are illustrative of a pilot cohort; every criterion quoted is real
 * text from the trials in src/data/trials.json.
 *
 * The NCT ids must exist in that file. They are not decoration: the dashboard
 * resolves them to Convoke program context, and a stale id silently degrades
 * every seeded row to "no program". An earlier revision drifted out of sync
 * when the dataset was refetched — if you re-run scripts/fetch-trials.mjs,
 * re-run scripts/test-programs.mjs, which fails when a seeded id is missing.
 */
function seed(s: Store) {
  s.searches = 47;
  // Recorded separately so the dashboard can state the simulated/live split
  // rather than presenting a seeded cohort as though it were all real traffic.
  s.seeded = 47;
  s.byCancer.set("non-small cell lung cancer", 31);
  s.byCancer.set("melanoma", 9);
  s.byCancer.set("renal cell carcinoma", 7);

  const seeded: AggregateRow[] = [
    // Leading row is deliberately the criterion a pretreated patient actually
    // trips, so a live search visibly increments the top bar rather than
    // telling a story disconnected from what the patient just saw.
    {
      kind: "prior_any_therapy",
      label: "Prior systemic therapy (treatment-naive required)",
      patientsBlocked: 28,
      exampleTrial: "NCT07361510",
      exampleCriterion:
        "Participants must have no prior systemic anti-tumor therapy for locally advanced or metastatic NSCLC.",
    },
    {
      kind: "prior_platinum",
      label: "Prior platinum chemotherapy",
      patientsBlocked: 24,
      exampleTrial: "NCT06712316",
      exampleCriterion:
        "Previous chemotherapy (platinum-based) or PD(L)-1 for treating NSCLC in either neoadjuvant/adjuvant or locally advanced/metastatic setting.",
    },
    {
      kind: "prior_checkpoint_inhibitor",
      label: "Prior PD-1/PD-L1 immunotherapy",
      patientsBlocked: 19,
      exampleTrial: "NCT06712316",
      exampleCriterion:
        "Participants who received prior treatment with anti-VEGF monoclonal antibody, or PD(L)-1/VEGF bispecific antibody.",
    },
    {
      kind: "ecog",
      label: "ECOG performance status ceiling",
      patientsBlocked: 11,
      exampleTrial: "NCT07361510",
      exampleCriterion:
        "Participants must have an Eastern Cooperative Oncology Group (ECOG) Performance Status 0-1.",
    },
    {
      kind: "brain_mets",
      label: "Brain / CNS metastases",
      patientsBlocked: 6,
      exampleTrial: "NCT06712355",
      exampleCriterion:
        "Participants with untreated brain metastases that are symptomatic or large (e.g., greater than 2 cm).",
    },
  ];
  for (const r of seeded) s.rows.set(r.kind, r);
}

/** Fold one search's exclusion reasons into the aggregate. */
export function recordSignals(cancerType: string | null, signals: UnmatchedSignal[]) {
  const s = store();
  s.searches += 1;

  const key = (cancerType ?? "unspecified").toLowerCase();
  s.byCancer.set(key, (s.byCancer.get(key) ?? 0) + 1);

  for (const sig of signals) {
    const row = s.rows.get(sig.kind);
    if (row) {
      row.patientsBlocked += 1;
    } else {
      s.rows.set(sig.kind, {
        kind: sig.kind,
        label: sig.label,
        patientsBlocked: 1,
        exampleTrial: sig.exampleTrial,
        exampleCriterion: sig.exampleCriterion,
      });
    }
  }
}

export interface DashboardData {
  totalSearches: number;
  /** Of totalSearches, how many are seeded vs run in this process. */
  seededSearches: number;
  liveSearches: number;
  topCancer: { name: string; count: number } | null;
  rows: AggregateRow[];
  /** Share of searches blocked by the single most common criterion, 0-100. */
  topBlockerPct: number;
}

export function getDashboardData(): DashboardData {
  const s = store();
  const rows = [...s.rows.values()].sort((a, b) => b.patientsBlocked - a.patientsBlocked);

  const topCancerEntry = [...s.byCancer.entries()].sort((a, b) => b[1] - a[1])[0];
  const topBlockerPct =
    rows.length > 0 && s.searches > 0
      ? Math.round((rows[0].patientsBlocked / s.searches) * 100)
      : 0;

  return {
    totalSearches: s.searches,
    seededSearches: s.seeded,
    liveSearches: Math.max(0, s.searches - s.seeded),
    topCancer: topCancerEntry ? { name: topCancerEntry[0], count: topCancerEntry[1] } : null,
    rows,
    topBlockerPct,
  };
}
