/**
 * In-memory aggregation of why interested patients failed to match.
 *
 * Privacy: this store never sees patient text. It receives only rule kinds
 * (e.g. "prior_checkpoint_inhibitor") and counts. That is the whole point —
 * BMS learns which protocol criteria are costing them recruitment without
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
  byCancer: Map<string, number>;
  rows: Map<RuleKind, AggregateRow>;
}

/** Survives hot reload in dev. */
const g = globalThis as unknown as { __clearTrialStore?: Store };

function store(): Store {
  if (!g.__clearTrialStore) {
    g.__clearTrialStore = { searches: 0, byCancer: new Map(), rows: new Map() };
    seed(g.__clearTrialStore);
  }
  return g.__clearTrialStore;
}

/**
 * Seeded cohort representing searches already run through ClearTrial.
 * Counts are illustrative of a pilot cohort; every criterion quoted is real
 * text from the BMS trials in src/data/trials.json.
 */
function seed(s: Store) {
  s.searches = 47;
  s.byCancer.set("non-small cell lung cancer", 31);
  s.byCancer.set("melanoma", 9);
  s.byCancer.set("renal cell carcinoma", 7);

  const seeded: AggregateRow[] = [
    {
      kind: "prior_checkpoint_inhibitor",
      label: "Prior PD-1/PD-L1 immunotherapy",
      patientsBlocked: 28,
      exampleTrial: "NCT06712316",
      exampleCriterion:
        "Previous chemotherapy (platinum-based) or PD(L)-1 for treating NSCLC in either neoadjuvant/adjuvant or locally advanced/metastatic setting.",
    },
    {
      kind: "prior_platinum",
      label: "Prior platinum chemotherapy",
      patientsBlocked: 24,
      exampleTrial: "NCT06712316",
      exampleCriterion:
        "Have systemic treatment naive, histologically or cytologically confirmed diagnosis of Stage IIIB or IIIC.",
    },
    {
      kind: "ecog",
      label: "ECOG performance status ceiling",
      patientsBlocked: 11,
      exampleTrial: "NCT06712316",
      exampleCriterion:
        "Eastern Cooperative Oncology Group Performance Status of 0 or 1.",
    },
    {
      kind: "brain_mets",
      label: "Brain / CNS metastases",
      patientsBlocked: 6,
      exampleTrial: "NCT07223047",
      exampleCriterion:
        "Participants must not have untreated central nervous system metastases.",
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
    topCancer: topCancerEntry ? { name: topCancerEntry[0], count: topCancerEntry[1] } : null,
    rows,
    topBlockerPct,
  };
}
