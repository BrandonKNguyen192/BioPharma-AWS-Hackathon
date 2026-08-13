/**
 * Commercial context for the Researcher Dashboard, joined from Convoke.
 *
 * Answers one question: when a protocol criterion is blocking recruitment,
 * what is it blocking? "A trial" is a recruitment metric. "A Phase 3 program
 * with a readout this year" is a business decision.
 *
 * Two hard rules:
 *
 * 1. RESEARCHER SIDE ONLY. Development stage and catalyst dates in front of a
 *    patient read as a promise about their odds. Nothing here may be imported
 *    into the patient portal.
 *
 * 2. NO INFERENCE. Every value is a lookup in the committed programs.json,
 *    built offline by scripts/build-programs.mjs. Where the data does not
 *    reach, these functions return null and the UI says so. Consistent with
 *    the engine invariant: unstated is unknown, never a guess.
 */

import data from "@/data/programs.json";
import { TRIALS } from "./trials";

interface ProgramRow {
  indication: string;
  stage: string;
  stageRank: number;
  status: string;
  targets: string[];
  modalities: string[];
}

interface CatalystRow {
  eventId: number;
  name: string;
  /** The granularity the source stated: "2026", "Q3 2026", "2027-02-05". */
  reportedDate: string;
  /** Convoke's sortable approximation. Ordering only — never display this. */
  sortDate: string;
  indications: string[];
}

interface ProgramsFile {
  schemaVersion: string;
  source: string;
  retrievedAt: string;
  stageOrder: string[];
  byIntervention: Record<string, { assets: string[]; reason: string | null }>;
  conditionToIndication: Record<string, string>;
  assetLabels: Record<string, string>;
  programsByAsset: Record<string, ProgramRow[]>;
  catalystsByAsset: Record<string, CatalystRow[]>;
}

const file = data as ProgramsFile;

export const PROGRAMS_META = {
  source: file.source,
  retrievedAt: file.retrievedAt,
};

export interface AssetContext {
  /** The spelling the trial record uses, e.g. "Iberdomide" not "CC-220". */
  label: string;
  stage: string;
  stageRank: number;
  status: string;
  /** The indication this stage refers to. */
  indication: string;
  /**
   * False when no program matched the trial's own condition and this is the
   * asset's most advanced program in some other indication. The UI must not
   * present an unmatched stage as if it described this trial.
   */
  indicationMatched: boolean;
  targets: string[];
  modalities: string[];
}

export interface CatalystContext {
  name: string;
  /** Display this. Already carries the source's real granularity. */
  reportedDate: string;
  assetLabel: string;
}

export interface TrialProgramContext {
  /** Primary asset first; see programContextForTrial for the ordering. */
  assets: AssetContext[];
  /**
   * The asset this trial is built around.
   *
   * NOT the most advanced program on the trial. Oncology trials routinely run
   * an investigational asset against an approved comparator, so "most
   * advanced" would almost always name the competitor's approved drug rather
   * than the asset whose recruitment is at stake. ClinicalTrials.gov lists the
   * experimental arm first, so intervention order is the signal — a fact from
   * the trial record, not a judgement about which drug matters.
   */
  primary: AssetContext | null;
  /** Soonest catalyst across the trial's assets, if any is known. */
  nextCatalyst: CatalystContext | null;
}

/**
 * Why a trial has no program context. The two cases must not be conflated:
 * "this trial studies only chemotherapy backbones" is a fact about the
 * protocol, while "this NCT id is not in our dataset" is a fact about our
 * data, and telling a researcher the first when the second is true is a lie.
 */
export type NoContextReason = "trial_not_in_dataset" | "no_tracked_asset";

export function noContextReason(nctId: string): NoContextReason {
  return TRIALS.some((t) => t.nctId === nctId)
    ? "no_tracked_asset"
    : "trial_not_in_dataset";
}

/** Convoke indication names for a trial's ClinicalTrials.gov conditions. */
function indicationsForTrial(conditions: string[]): Set<string> {
  const out = new Set<string>();
  for (const c of conditions) {
    const mapped = file.conditionToIndication[c];
    if (mapped) out.add(mapped);
  }
  return out;
}

/**
 * Pick the program row to show for one asset in the context of one trial.
 * Prefers a program in an indication the trial is actually studying; falls
 * back to the asset's most advanced program, flagged as unmatched.
 */
function pickProgram(
  asset: string,
  trialIndications: Set<string>,
): AssetContext | null {
  const rows = file.programsByAsset[asset];
  if (!rows || rows.length === 0) return null;

  const label = file.assetLabels[asset] ?? asset;
  // rows are pre-sorted most advanced first, so the first hit is the lead.
  const matched = rows.find((r) => trialIndications.has(r.indication));
  const row = matched ?? rows[0];

  return {
    label,
    stage: row.stage,
    stageRank: row.stageRank,
    status: row.status,
    indication: row.indication,
    indicationMatched: Boolean(matched),
    targets: row.targets,
    modalities: row.modalities,
  };
}

/** Assets studied by a trial, canonicalised. Empty when none are tracked. */
export function assetsForTrial(nctId: string): string[] {
  const trial = TRIALS.find((t) => t.nctId === nctId);
  if (!trial) return [];

  const out = new Set<string>();
  for (const raw of trial.interventions) {
    for (const asset of file.byIntervention[raw]?.assets ?? []) out.add(asset);
  }
  return [...out];
}

/**
 * Full program context for one trial. Returns null when nothing is known —
 * an unknown trial, a chemotherapy-only arm, or assets Convoke has no program
 * for. Callers must render that as absence, not as a zero.
 */
export function programContextForTrial(
  nctId: string,
): TrialProgramContext | null {
  const trial = TRIALS.find((t) => t.nctId === nctId);
  if (!trial) return null;

  const trialIndications = indicationsForTrial(trial.conditions);
  // assetsForTrial preserves the trial record's intervention order, so the
  // index here is the trial's own ordering of its arms.
  const assets = assetsForTrial(nctId)
    .map((a, order) => ({ ctx: pickProgram(a, trialIndications), order }))
    .filter((x): x is { ctx: AssetContext; order: number } => x.ctx !== null)
    .sort((a, b) => {
      // A stage that actually describes this trial's indication outranks one
      // borrowed from a different indication...
      if (a.ctx.indicationMatched !== b.ctx.indicationMatched) {
        return a.ctx.indicationMatched ? -1 : 1;
      }
      // ...then the experimental arm, which the registry lists first.
      return a.order - b.order;
    })
    .map((x) => x.ctx);

  if (assets.length === 0) return null;

  return {
    assets,
    primary: assets[0],
    nextCatalyst: nextCatalystForTrial(nctId),
  };
}

/** Soonest known catalyst across everything a trial is studying. */
export function nextCatalystForTrial(nctId: string): CatalystContext | null {
  let best: { row: CatalystRow; label: string } | null = null;

  for (const asset of assetsForTrial(nctId)) {
    // Pre-sorted soonest first, so index 0 is this asset's next catalyst.
    const row = file.catalystsByAsset[asset]?.[0];
    if (!row) continue;
    if (!best || row.sortDate < best.row.sortDate) {
      best = { row, label: file.assetLabels[asset] ?? asset };
    }
  }

  if (!best) return null;
  return {
    name: best.row.name,
    reportedDate: best.row.reportedDate,
    assetLabel: best.label,
  };
}

/**
 * Flattened context for the Convoke export artifact, keyed by NCT id.
 *
 * Resolved on the server so the client bundle never has to carry trials.json
 * or programs.json. Trials with no tracked program are omitted rather than
 * emitted with nulls — a consumer must not read absence as "no program".
 */
export function exportContextForTrials(nctIds: string[]) {
  const out: Record<
    string,
    {
      asset: string;
      stage: string;
      indication: string;
      indicationMatched: boolean;
      status: string;
      nextCatalyst: { name: string; reportedDate: string } | null;
    }
  > = {};

  for (const nctId of new Set(nctIds)) {
    const ctx = programContextForTrial(nctId);
    if (!ctx?.primary) continue;
    out[nctId] = {
      asset: ctx.primary.label,
      stage: ctx.primary.stage,
      indication: ctx.primary.indication,
      indicationMatched: ctx.primary.indicationMatched,
      status: ctx.primary.status,
      nextCatalyst: ctx.nextCatalyst
        ? {
            name: ctx.nextCatalyst.name,
            reportedDate: ctx.nextCatalyst.reportedDate,
          }
        : null,
    };
  }
  return out;
}

/**
 * Portfolio-level rollup for the dashboard header: how much of the monitored
 * trial set carries a late-stage program. Counts trials, not assets, because
 * the dashboard's unit of recruitment is a trial.
 */
export function portfolioProgramSummary() {
  let withContext = 0;
  let lateStage = 0;
  let withCatalyst = 0;

  for (const trial of TRIALS) {
    const ctx = programContextForTrial(trial.nctId);
    if (!ctx) continue;
    withContext++;
    // "Phase 3" and above, per stageOrder in programs.json.
    if (
      ctx.primary &&
      ctx.primary.stageRank >= file.stageOrder.indexOf("Phase 3")
    ) {
      lateStage++;
    }
    if (ctx.nextCatalyst) withCatalyst++;
  }

  return {
    trialsTotal: TRIALS.length,
    trialsWithContext: withContext,
    trialsLateStage: lateStage,
    trialsWithCatalyst: withCatalyst,
  };
}
