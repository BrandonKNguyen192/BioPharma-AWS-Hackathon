import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Database,
  FlaskConical,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import { getDashboardData } from "@/lib/signal-store";
import { coverageStats, RULE_LABELS } from "@/lib/coverage";
import {
  Derivation,
  MetricDrilldown,
  SourceRow,
} from "@/app/components/MetricDrilldown";
import { TRIALS_META } from "@/lib/trials";
import { AppShell } from "@/app/components/AppShell";
import { ConvokeExport } from "@/app/components/ConvokeExport";
import { ProtocolBrief } from "@/app/components/ProtocolBrief";
import {
  ProgramChip,
  ProgramContextBlock,
} from "@/app/components/ProgramContext";
import {
  PROGRAMS_META,
  exportContextForTrials,
  portfolioProgramSummary,
} from "@/lib/programs";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = getDashboardData();
  const coverage = coverageStats();
  // The ring lives in the "Evidence coverage" card, so it shows coverage.
  // It previously rendered topBlockerPct — the neighbouring card's statistic
  // under a name it did not mean.
  const ringValue = Math.max(0, Math.min(100, coverage.pct));
  // Real bar heights, scaled to the largest signal. The previous cluster was
  // eight hardcoded numbers labelled as a chart, which is exactly the claim
  // this product exists to disprove.
  const maxBlocked = data.rows[0]?.patientsBlocked ?? 1;
  const bars = data.rows.slice(0, 8).map((row) => ({
    kind: row.kind,
    label: row.label,
    blocked: row.patientsBlocked,
    height: Math.max(10, Math.round((row.patientsBlocked / maxBlocked) * 82)),
  }));
  const programs = portfolioProgramSummary();
  const exportContext = exportContextForTrials(
    data.rows.map((r) => r.exampleTrial),
  );
  const convokeProps = {
    rows: data.rows,
    totalSearches: data.totalSearches,
    trialCount: TRIALS_META.count,
    // Resolved server-side; keeps trials.json and programs.json out of the
    // client bundle while still annotating the exported artifact.
    programContext: exportContext,
  };

  return (
    <AppShell
      active="dashboard"
      title="Protocol intelligence"
      description="Sponsor portfolio signals"
      actions={
        <>
          <div className="hidden sm:block [&_button]:!h-10 [&_button]:!rounded-full [&_button]:!bg-[var(--ct-surface-strong)] [&_button]:!px-4 [&_button]:!font-medium [&_button]:shadow-sm">
            <ConvokeExport {...convokeProps} />
          </div>
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--ct-surface-strong)] px-4 text-xs font-medium text-[var(--ct-text-muted)] shadow-sm hover:text-[var(--ct-text)]">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Patient view</span>
          </Link>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="ct-section-label">Portfolio overview</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--ct-text)] sm:text-3xl">Where eligibility loses patients</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ct-text-muted)]">
            Real published trial criteria paired with a simulated patient-demand cohort and live de-identified searches.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ct-amber-bg)] px-3 py-2 text-[11px] font-medium text-[var(--ct-amber-text)]">
          <span className="h-2 w-2 rounded-full bg-[var(--ct-amber-text)]" />
          Simulated pilot cohort
        </span>
      </div>

      <section className="ct-dashboard-grid">
        <article className="ct-metric-large">
          <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-medium text-[var(--ct-text)]">Recruitment pressure</p>
              <p className="mt-5 text-6xl font-medium tabular-nums text-[var(--ct-text)] sm:text-7xl">
                {data.topBlockerPct}<span className="text-3xl">%</span>
              </p>
              <p className="mt-4 max-w-[250px] text-sm leading-6 text-[var(--ct-text-muted)]">
                of searches were blocked by the portfolio&apos;s leading exclusion criterion.
              </p>
              <MetricDrilldown label="Where this comes from">
                <Derivation
                  formula={`${data.rows[0]?.patientsBlocked ?? 0} searches blocked ÷ ${data.totalSearches} pre-screens`}
                  result={`${data.topBlockerPct}%`}
                />
                <div className="space-y-2">
                  {data.rows.map((row) => (
                    <SourceRow
                      key={row.kind}
                      count={row.patientsBlocked}
                      name={row.label}
                      detail={row.exampleCriterion}
                      source={row.exampleTrial}
                    />
                  ))}
                </div>
                <p className="text-[var(--ct-text-soft)]">
                  Each row counts distinct searches a rule blocked at least once.
                  Criteria text is quoted verbatim from ClinicalTrials.gov.
                </p>
              </MetricDrilldown>
            </div>
            <div>
              <div
                className="ct-bar-cluster"
                aria-label={`Searches blocked per exclusion criterion, highest ${maxBlocked}`}
              >
                {bars.map((bar, index) => (
                  <span
                    key={bar.kind}
                    className={index === 0 ? "is-filled" : ""}
                    style={{ height: bar.height }}
                    title={`${bar.label}: ${bar.blocked} searches`}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center gap-5 text-xs text-[var(--ct-text-muted)]">
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[var(--ct-mint-strong)]" />Leading criterion</span>
                <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[var(--ct-surface-soft)]" />Other signals</span>
              </div>
            </div>
          </div>
        </article>

        <article className="ct-metric-large">
          <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-base font-medium text-[var(--ct-text)]">Evidence coverage</p>
              <p className="mt-5 text-6xl font-medium tabular-nums text-[var(--ct-text)] sm:text-7xl">{TRIALS_META.count}</p>
              <p className="mt-4 max-w-[250px] text-sm leading-6 text-[var(--ct-text-muted)]">
                active oncology studies monitored from ClinicalTrials.gov. The ring
                is the share of published criteria the engine can evaluate.
              </p>
              <MetricDrilldown label="What we can and cannot read">
                <Derivation
                  formula={`${coverage.machineEvaluable} evaluable ÷ ${coverage.totalCriteria} published criteria across ${coverage.trials} studies`}
                  result={`${coverage.pct}%`}
                />
                <p className="text-[var(--ct-text-soft)]">
                  Portfolio-wide. Coverage is higher in the indications with the
                  most rules written — lung studies sit around 27%.
                </p>
                <p>
                  {coverage.unreadable} of {coverage.totalCriteria} lines fall through
                  to &ldquo;a clinician must read this&rdquo; rather than being counted
                  as satisfied. Median {coverage.medianPerTrial} evaluable criteria per
                  trial.
                </p>
                <div className="space-y-2">
                  {coverage.byKind.map((k) => (
                    <SourceRow
                      key={k.kind}
                      count={k.count}
                      name={RULE_LABELS[k.kind] ?? k.kind}
                      source={`rule: ${k.kind}`}
                    />
                  ))}
                </div>
              </MetricDrilldown>
            </div>
            <div className="ct-ring" style={{ "--ring-value": `${ringValue}%` } as CSSProperties} aria-label={`${ringValue}% top exclusion share`}>
              <span className="absolute inset-0 z-10 flex items-center justify-center text-sm font-semibold text-[var(--ct-text)]">{ringValue}%</span>
            </div>
          </div>
        </article>

        <article className="ct-metric-small">
          <SearchCheck className="h-5 w-5 text-[var(--ct-text-soft)]" />
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{data.totalSearches}</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">Patient pre-screens</p>
          <MetricDrilldown label="Simulated vs live">
            <Derivation
              formula={`${data.seededSearches} seeded + ${data.liveSearches} live`}
              result={String(data.totalSearches)}
            />
            <p>
              The seeded cohort exists so the dashboard has a story before any
              search has run. Searches made in this session are added to it.
              Counts reset when the server restarts — the store is process memory.
            </p>
          </MetricDrilldown>
        </article>

        <article className="ct-metric-small bg-[var(--ct-lilac)]">
          <FlaskConical className="h-5 w-5 text-[var(--ct-violet-text)]" />
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{data.rows.length}</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">Exclusion signals</p>
          <MetricDrilldown label="Which rules fired">
            <p>
              Distinct deterministic rules that ruled at least one patient out.
              Each is a pure function in <span className="font-mono">match.ts</span>{" "}
              with regression tests.
            </p>
            <div className="space-y-2">
              {data.rows.map((row) => (
                <SourceRow key={row.kind} count={row.patientsBlocked} name={row.label} source={`rule: ${row.kind}`} />
              ))}
            </div>
          </MetricDrilldown>
        </article>

        <article className="ct-metric-small bg-[var(--ct-mint)]">
          <Database className="h-5 w-5 text-[var(--ct-teal-text)]" />
          <p className="mt-6 truncate text-2xl font-semibold text-[var(--ct-text)]">{data.topCancer ? data.topCancer.count : 0}</p>
          <p className="mt-1 truncate text-sm text-[var(--ct-text-muted)]">{data.topCancer ? data.topCancer.name : "No leading indication"}</p>
        </article>

        <article className="ct-metric-small">
          <ArrowUpRight className="h-5 w-5 text-[var(--ct-text-soft)]" />
          <p className="mt-6 text-2xl font-semibold text-[var(--ct-text)]">Live</p>
          <p className="mt-1 text-sm text-[var(--ct-text-muted)]">New searches append automatically</p>
        </article>
      </section>

      {data.rows.length > 0 && (
        <section className="ct-insight-panel mt-5">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[var(--ct-teal-text)]">
                <TriangleAlert className="h-5 w-5" />
                <p className="text-sm font-semibold">Protocol optimization alert</p>
              </div>
              <h2 className="mt-4 text-2xl font-semibold leading-tight text-[var(--ct-text)]">
                “{data.rows[0].label}” is the clearest opportunity to widen access.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--ct-text-muted)]">
                This criterion blocked {data.rows[0].patientsBlocked} searches across the portfolio. Relaxing it, adding a stratified cohort, or clarifying the requirement could materially expand the eligible pool.
              </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-[var(--ct-surface)] p-4 md:max-w-sm">
              <p className="font-mono text-[11px] text-[var(--ct-teal-text)]">{data.rows[0].exampleTrial}</p>
              <p className="mt-2 text-xs italic leading-5 text-[var(--ct-text-muted)]">“{data.rows[0].exampleCriterion}”</p>
              {/*
                Convoke turns "a criterion blocked 28 searches" into "a
                criterion is gating a Phase 3 program with a readout this
                year". Researcher side only — never the patient portal.
              */}
              <ProgramContextBlock nctId={data.rows[0].exampleTrial} />
            </div>
          </div>
        </section>
      )}

      <section className="ct-soft-panel mt-5 p-5">
        <p className="ct-section-label">Pipeline exposure</p>
        <p className="mt-2 text-sm leading-6 text-[var(--ct-text-muted)]">
          <span className="font-semibold text-[var(--ct-text)]">
            {programs.trialsLateStage}
          </span>{" "}
          of the {programs.trialsWithContext} monitored trials with a tracked
          development program are Phase 3 or later, and{" "}
          <span className="font-semibold text-[var(--ct-text)]">
            {programs.trialsWithCatalyst}
          </span>{" "}
          have a known upcoming catalyst. Recruitment friction on those is
          schedule risk, not just a funnel metric.
        </p>
        <p className="mt-2 text-[11px] leading-5 text-[var(--ct-text-soft)]">
          {programs.trialsTotal - programs.trialsWithContext} of{" "}
          {programs.trialsTotal} trials have no tracked program — their arms are
          chemotherapy backbones, or the asset is not in the knowledge graph.
          Shown as absent, never as zero.
        </p>
      </section>

      <div className="mt-5">
        <ProtocolBrief />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="ct-section-label">Eligibility friction</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ct-text)]">Exclusion frequency</h2>
          </div>
          <span className="text-xs text-[var(--ct-text-soft)]">Ranked by patients blocked</span>
        </div>

        <div className="space-y-2">
          {data.rows.map((row, index) => {
            const pct = Math.round((row.patientsBlocked / data.rows[0].patientsBlocked) * 100);
            return (
              <article key={row.kind} className="ct-soft-panel grid gap-4 p-4 sm:grid-cols-[34px_minmax(0,1fr)_180px_44px] sm:items-center">
                <span className="text-sm font-semibold tabular-nums text-[var(--ct-text-soft)]">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--ct-text)]">{row.label}</p>
                  <p className="mt-1 truncate text-[11px] text-[var(--ct-text-soft)]">{row.exampleCriterion}</p>
                  <div className="mt-1.5">
                    <ProgramChip nctId={row.exampleTrial} />
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--ct-surface-soft)]">
                  <div className="h-full rounded-full bg-[var(--ct-lilac-strong)]" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-right text-sm font-semibold tabular-nums text-[var(--ct-text)]">{row.patientsBlocked}</p>
              </article>
            );
          })}
        </div>
      </section>

      <p className="mt-6 text-[11px] leading-5 text-[var(--ct-text-soft)]">
        Trials and eligibility criteria: {TRIALS_META.source}. Patient demand is a simulated pilot cohort seeded for this demo; de-identified searches in this session are added to it. No patient-identifiable data is stored. Development stage and catalyst dates: {PROGRAMS_META.source}, retrieved {PROGRAMS_META.retrievedAt} at build time and committed — never queried per request, and shown at the granularity the source stated.
      </p>
    </AppShell>
  );
}
