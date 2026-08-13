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
 * text from the trials in src/data/trials.json.
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
      exampleTrial: "NCT06692738",
      exampleCriterion:
        "Any prior treatment with an anti-PD-1 or anti-PD-L1 agent.",
    },
    {
      kind: "prior_platinum",
      label: "Prior platinum chemotherapy",
      patientsBlocked: 24,
      exampleTrial: "NCT06694454",
      exampleCriterion:
        "Willingness to undergo tumor resection surgery per standard of care guidelines following induction therapy (platinum chemotherapy).",
    },
    {
      kind: "ecog",
      label: "ECOG performance status ceiling",
      patientsBlocked: 11,
      exampleTrial: "NCT06694454",
      exampleCriterion: "ECOG Performance Status <= 1",
    },
    {
      kind: "brain_mets",
      label: "Brain / CNS metastases",
      patientsBlocked: 6,
      exampleTrial: "NCT05276726",
      exampleCriterion:
        "Has CNS metastases or carcinomatous meningitis, except treated CNS metastases with no evidence of radiographic progression.",
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
