/**
 * Portfolio-level evidence coverage, computed from the committed dataset.
 *
 * The dashboard previously showed a progress ring inside the "Evidence
 * coverage" card that was actually rendering the top exclusion percentage —
 * the same number as the card beside it, under a name it did not mean. This
 * computes the figure that card is claiming: how much of the published
 * eligibility text the deterministic engine can actually evaluate.
 *
 * Under-claiming is the point. A criterion no rule can read is reported as
 * unreadable rather than quietly counted as satisfied.
 */

import { classify } from "./match";
import { TRIALS } from "./trials";
import type { RuleKind } from "./types";

export interface CoverageStats {
  trials: number;
  /** Every published inclusion + exclusion line across the dataset. */
  totalCriteria: number;
  /** Lines a rule can evaluate. */
  machineEvaluable: number;
  /** Lines that fall through to "a clinician must read this". */
  unreadable: number;
  /** machineEvaluable / totalCriteria, 0-100. */
  pct: number;
  medianPerTrial: number;
  /** Which rules account for the covered lines, most frequent first. */
  byKind: Array<{ kind: RuleKind; count: number }>;
}

let cached: CoverageStats | null = null;

/** Computed once per process — the dataset is a committed build artifact. */
export function coverageStats(): CoverageStats {
  if (cached) return cached;

  const counts = new Map<RuleKind, number>();
  const perTrial: number[] = [];
  let total = 0;
  let evaluable = 0;

  for (const trial of TRIALS) {
    let n = 0;
    for (const line of [...trial.inclusion, ...trial.exclusion]) {
      total += 1;
      const kind = classify(line);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      if (kind !== "unparsed") {
        evaluable += 1;
        n += 1;
      }
    }
    perTrial.push(n);
  }

  perTrial.sort((a, b) => a - b);

  cached = {
    trials: TRIALS.length,
    totalCriteria: total,
    machineEvaluable: evaluable,
    unreadable: total - evaluable,
    pct: total === 0 ? 0 : Math.round((evaluable / total) * 100),
    medianPerTrial: perTrial.length === 0 ? 0 : perTrial[Math.floor(perTrial.length / 2)],
    byKind: [...counts.entries()]
      .filter(([kind]) => kind !== "unparsed")
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
  };
  return cached;
}

/** Human-readable names for the rule kinds, for the provenance panels. */
export const RULE_LABELS: Record<string, string> = {
  ecog: "ECOG performance status",
  pdl1_threshold: "PD-L1 expression threshold",
  prior_platinum: "Prior platinum chemotherapy",
  prior_checkpoint_inhibitor: "Prior PD-1/PD-L1 immunotherapy",
  prior_any_therapy: "Prior systemic therapy / treatment-naive",
  prior_lines: "Prior lines of therapy",
  biomarker: "Tumour biomarker requirement",
  brain_mets: "Brain / CNS metastases",
  measurable_disease: "Measurable disease (RECIST)",
  stage: "Disease stage window",
  age: "Age requirement",
  condition: "Disease area",
  unparsed: "Needs a clinician to read",
};
