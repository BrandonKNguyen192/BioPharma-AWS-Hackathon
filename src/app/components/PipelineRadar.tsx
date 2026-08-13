import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FileText, Radar } from "lucide-react";
import {
  EVIDENCE_LABELS,
  EVENT_LABELS,
  PIPELINE_RADAR,
  type PipelineSignal,
} from "@/lib/pipeline-radar";

function evidenceTone(evidence: PipelineSignal["evidence"]): string {
  if (evidence === "corroborated" || evidence === "public_record") return "is-strong";
  if (evidence === "company_asserted") return "is-company";
  return "is-review";
}

/**
 * Reviewed, primary-source evidence ledger. Broad EDGAR/GDELT discoveries stay
 * in the build artifacts until a human confirms the claim and registry join.
 */
export function PipelineRadar({ limit }: { limit?: number }) {
  const signals = [...PIPELINE_RADAR.signals]
    .sort((a, b) => b.eventDate.sortDate.localeCompare(a.eventDate.sortDate))
    .slice(0, limit);

  return (
    <div className="ct-radar-list">
      {signals.map((signal) => (
        <article key={signal.id} className="ct-radar-row">
          <div className="ct-radar-date">
            <span>{signal.eventDate.reported.slice(0, 4)}</span>
            <strong>{signal.eventDate.reported.slice(5)}</strong>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`ct-evidence-chip ${evidenceTone(signal.evidence)}`}>
                {EVIDENCE_LABELS[signal.evidence]}
              </span>
              <span className="ct-event-chip">{EVENT_LABELS[signal.eventType]}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold leading-6 text-[var(--ct-text)]">
              {signal.headline}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[var(--ct-text-muted)]">
              {signal.company} · {signal.asset.name} · {signal.indication}
            </p>
            <blockquote className="ct-radar-quote">“{signal.source.quote}”</blockquote>
            <p className="mt-3 text-[11px] leading-5 text-[var(--ct-text-soft)]">
              {signal.reviewNote}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--ct-text-soft)]">
              {signal.registryMatch.nctId ? (
                <a
                  href={`https://clinicaltrials.gov/study/${signal.registryMatch.nctId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ct-source-link"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {signal.registryMatch.nctId} · {signal.registryMatch.status}
                </a>
              ) : (
                <span className="ct-source-link">
                  <Radar className="h-3.5 w-3.5" />
                  No registry match as of {signal.registryMatch.checkedAt}
                </span>
              )}
              <a href={signal.source.url} target="_blank" rel="noreferrer" className="ct-source-link">
                <FileText className="h-3.5 w-3.5" />
                {signal.source.publisher}
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </article>
      ))}

      {limit && PIPELINE_RADAR.signals.length > limit ? (
        <Link href="/pipeline" className="ct-radar-more">
          Review all {PIPELINE_RADAR.signals.length} public signals
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
