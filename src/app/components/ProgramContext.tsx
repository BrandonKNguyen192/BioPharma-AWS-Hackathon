/**
 * Commercial context for a blocking criterion, from Convoke.
 *
 * RESEARCHER SIDE ONLY. Do not import into the patient portal — development
 * stage and catalyst dates in front of a patient read as a promise about
 * their odds.
 *
 * Every value is a lookup, and absence is rendered as absence. A criterion
 * blocking a chemotherapy-only arm says so rather than showing a blank chip.
 */

import { Activity, CalendarClock } from "lucide-react";
import { noContextReason, programContextForTrial } from "@/lib/programs";

/** "Phase 3" and above reads as commercially urgent; tint those. */
function stageTone(stage: string) {
  return stage === "Regulatory Approval" ||
    stage === "Market" ||
    stage === "Phase 3" ||
    stage === "Phase 2/3"
    ? "border-[color:var(--ct-teal-border)] bg-[var(--ct-teal-bg)] text-[var(--ct-teal-text)]"
    : "border-[color:var(--ct-slate-chip-border)] bg-[var(--ct-slate-chip-bg)] text-[var(--ct-slate-chip-text)]";
}

/** Compact inline chip for a table row. */
export function ProgramChip({ nctId }: { nctId: string }) {
  const ctx = programContextForTrial(nctId);
  if (!ctx?.primary) return null;

  const lead = ctx.primary;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${stageTone(lead.stage)}`}
      title={
        lead.indicationMatched
          ? `${lead.label}: ${lead.stage} in ${lead.indication}`
          : `${lead.label}: no program in this trial's indication. Most advanced elsewhere is ${lead.stage} in ${lead.indication}.`
      }
    >
      {lead.label} · {lead.stage}
      {!lead.indicationMatched && (
        <span className="text-[var(--ct-text-soft)]">(other indication)</span>
      )}
    </span>
  );
}

/** Full context block for the lead blocking criterion. */
export function ProgramContextBlock({ nctId }: { nctId: string }) {
  const ctx = programContextForTrial(nctId);

  if (!ctx?.primary) {
    return (
      <p className="mt-3 text-xs text-[var(--ct-text-soft)]">
        {noContextReason(nctId) === "trial_not_in_dataset"
          ? `${nctId} is not in the monitored trial set, so no program context can be resolved for it.`
          : "No tracked development program for this trial's interventions — its arms are chemotherapy backbones or supportive agents."}
      </p>
    );
  }

  const { primary: lead, nextCatalyst, assets } = ctx;

  return (
    <div className="mt-4 space-y-2 border-t border-[color:var(--ct-amber-border)] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-[var(--ct-text-muted)]" />
        <span className="text-xs text-[var(--ct-text-muted)]">This criterion is gating</span>
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${stageTone(lead.stage)}`}
        >
          {lead.label} · {lead.stage}
        </span>
        <span className="text-xs text-[var(--ct-text-muted)]">
          {lead.indicationMatched ? (
            <>in {lead.indication}</>
          ) : (
            // Never let an unmatched stage read as if it described this trial.
            <>
              — no program in this trial&apos;s indication; {lead.stage} is its
              most advanced elsewhere ({lead.indication})
            </>
          )}
        </span>
        {lead.status !== "Active" && (
          <span className="rounded border border-[color:var(--ct-border)] px-1.5 py-0.5 text-[10px] text-[var(--ct-text-muted)]">
            {lead.status}
          </span>
        )}
      </div>

      {nextCatalyst && (
        <div className="flex flex-wrap items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-[var(--ct-text-muted)]" />
          <span className="text-xs text-[var(--ct-text-muted)]">
            Next catalyst{" "}
            <span className="text-[var(--ct-text)]">{nextCatalyst.reportedDate}</span>
            {" — "}
            {nextCatalyst.name}
            <span className="text-[var(--ct-text-soft)]"> ({nextCatalyst.assetLabel})</span>
          </span>
        </div>
      )}

      {assets.length > 1 && (
        <p className="text-[11px] text-[var(--ct-text-soft)]">
          {assets.length} tracked assets on this trial:{" "}
          {assets.map((a) => a.label).join(", ")}. Shown above is the
          experimental arm as the registry lists it; the others include
          comparators, which may carry a more advanced stage.
        </p>
      )}
    </div>
  );
}
