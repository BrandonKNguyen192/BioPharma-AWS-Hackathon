import Link from "next/link";
import { ArrowLeft, CircleHelp, Database, FileSearch, Radar, ShieldCheck } from "lucide-react";
import { AppShell } from "@/app/components/AppShell";
import { PipelineRadar } from "@/app/components/PipelineRadar";
import { PIPELINE_RADAR, RADAR_SUMMARY } from "@/lib/pipeline-radar";

export default function PipelinePage() {
  return (
    <AppShell
      active="pipeline"
      title="Trial radar"
      description="Public pipeline evidence"
      actions={
        <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--ct-surface-strong)] px-4 text-xs font-medium text-[var(--ct-text-muted)] shadow-sm hover:text-[var(--ct-text)]">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Protocol intelligence</span>
        </Link>
      }
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="ct-section-label">Evidence ledger</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--ct-text)] sm:text-3xl">What the public record reveals</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ct-text-muted)]">
            Sponsor announcements are reconciled with real registry records and portfolio entities. Every milestone preserves who made the claim, the supporting sentence, and what a public source can actually confirm.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ct-violet-bg)] px-3 py-2 text-[11px] font-medium text-[var(--ct-violet-text)]">
          <span className="h-2 w-2 rounded-full bg-[var(--ct-violet-text)]" />
          Reviewed build-time artifact
        </span>
      </div>

      <section className="ct-dashboard-grid">
        <article className="ct-metric-small">
          <Radar className="h-5 w-5 text-[var(--ct-text-soft)]" />
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{RADAR_SUMMARY.signalCount}</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">Reviewed public signals</p>
        </article>
        <article className="ct-metric-small bg-[var(--ct-mint)]">
          <Database className="h-5 w-5 text-[var(--ct-teal-text)]" />
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{RADAR_SUMMARY.exactRegistryLinks}</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">Exact registry links</p>
        </article>
        <article className="ct-metric-small bg-[var(--ct-lilac)]">
          <FileSearch className="h-5 w-5 text-[var(--ct-violet-text)]" />
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{RADAR_SUMMARY.assets}</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">Assets connected</p>
        </article>
        <article className="ct-metric-small">
          <ShieldCheck className="h-5 w-5 text-[var(--ct-text-soft)]" />
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{RADAR_SUMMARY.regulatoryClaims}</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">Attributed regulatory claims</p>
        </article>
      </section>

      <section className="ct-insight-panel mt-5">
        <div className="flex items-start gap-4">
          <CircleHelp className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-teal-text)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--ct-text)]">This is not an IND-number database</p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--ct-text-muted)]">
              FDA ordinarily keeps IND information confidential. ClearTrial therefore reports sponsor-attributed regulatory statements, then independently links the later public study record when possible. A registry match confirms the study, not the private IND action.
            </p>
          </div>
        </div>
      </section>

      <section className="ct-soft-panel mt-5 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ct-section-label">Signal timeline</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ct-text)]">Claims, exact quotations, and registry reconciliation</h2>
          </div>
          <span className="text-xs text-[var(--ct-text-soft)]">Checked {PIPELINE_RADAR.checkedAt}</span>
        </div>
        <PipelineRadar />
      </section>

      <p className="mt-6 text-[11px] leading-5 text-[var(--ct-text-soft)]">
        Discovery sources may include sponsor IR pages, SEC EDGAR, press wires, and GDELT. Only reviewed primary-source claims enter this display. Bright Data is optional transport for blocked pages; ClinicalTrials.gov and Convoke provide registry and entity context. No model or scraper decides whether a regulatory event occurred.
      </p>
    </AppShell>
  );
}
