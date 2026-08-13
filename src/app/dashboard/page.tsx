import { TriangleAlert } from "lucide-react";
import { getDashboardData } from "@/lib/signal-store";
import { TRIALS_META } from "@/lib/trials";
import { ConvokeExport } from "@/app/components/ConvokeExport";
import { ProtocolBrief } from "@/app/components/ProtocolBrief";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = getDashboardData();

  return (
    <main className="min-h-screen bg-[var(--ct-bg)] px-6 py-10 text-[var(--ct-text)] transition-colors">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--ct-text)]">
              Protocol Intelligence
            </h1>
            <p className="text-sm text-[var(--ct-text-muted)]">
              Oncology Trial Portfolio
            </p>
            {/*
              The trials and criteria below are real. Patient demand is not:
              the cohort is seeded so the dashboard has a story before any
              searches have run. Say so on the page rather than letting a
              viewer assume 47 real people were screened.
            */}
            <p className="ct-card mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-[var(--ct-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ct-amber-text)]/70" />
              Simulated pilot cohort · real trial criteria · live searches
              append to these counts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ConvokeExport
              rows={data.rows}
              totalSearches={data.totalSearches}
              trialCount={TRIALS_META.count}
            />
            <a
              href="/"
              className="text-sm text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text)]"
            >
              ← Patient view
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="ct-card rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ct-text-soft)]">
              Patient Searches
            </p>
            <p className="text-3xl font-semibold text-[var(--ct-text)]">
              {data.totalSearches}
            </p>
            <p className="text-xs text-[var(--ct-text-soft)]">pre-screens run</p>
          </div>
          <div className="ct-card rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ct-text-soft)]">
              Trials Monitored
            </p>
            <p className="text-3xl font-semibold text-[var(--ct-text)]">
              {TRIALS_META.count}
            </p>
            <p className="text-xs text-[var(--ct-text-soft)]">active oncology</p>
          </div>
          <div className="ct-card rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ct-text-soft)]">
              Top Exclusion
            </p>
            <p className="text-3xl font-semibold text-[var(--ct-amber-text)]">
              {data.topBlockerPct}%
            </p>
            <p className="text-xs text-[var(--ct-text-soft)]">of searches blocked</p>
          </div>
          <div className="ct-card rounded-xl p-5">
            <p className="text-[11px] uppercase tracking-wide text-[var(--ct-text-soft)]">
              Leading Indication
            </p>
            <p className="text-3xl font-semibold text-[var(--ct-text)]">
              {data.topCancer ? data.topCancer.count : 0}
            </p>
            <p className="truncate text-xs text-[var(--ct-text-soft)]">
              {data.topCancer ? data.topCancer.name : "—"}
            </p>
          </div>
        </div>

        {data.rows.length > 0 && (
          <div className="rounded-xl border border-[color:var(--ct-amber-border)] bg-[var(--ct-amber-bg)] p-6">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-[var(--ct-amber-text)]" />
              <h2 className="font-semibold text-[var(--ct-amber-text)]">
                Protocol Optimization Alert
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ct-text-muted)]">
              {data.topBlockerPct}% of interested patients were ruled out by
              “{data.rows[0].label}”. This single criterion blocked{" "}
              {data.rows[0].patientsBlocked} searches across the portfolio.
              Relaxing or stratifying it could materially expand the eligible
              pool.
            </p>
            <div className="mt-3 border-l-2 border-[color:var(--ct-amber-border)] pl-3">
              <p className="font-mono text-[11px] text-[var(--ct-amber-text)]/80">
                {data.rows[0].exampleTrial}
              </p>
              <p className="text-xs italic text-[var(--ct-text-muted)]">
                {data.rows[0].exampleCriterion}
              </p>
            </div>
          </div>
        )}

        <ProtocolBrief />

        <h3 className="mb-3 mt-8 text-sm font-medium text-[var(--ct-text-muted)]">
          Exclusion frequency
        </h3>

        <div className="space-y-5">
          {data.rows.map((row, index) => {
            const pct = Math.round(
              (row.patientsBlocked / data.rows[0].patientsBlocked) * 100,
            );
            return (
              <div key={row.kind}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-[var(--ct-text)]">{row.label}</p>
                  <p className="text-sm tabular-nums text-[var(--ct-text-muted)]">
                    {row.patientsBlocked}
                  </p>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-[var(--ct-surface-strong)]">
                  <div
                    style={{ width: pct + "%" }}
                    className={
                      index === 0
                        ? "h-2 rounded-full bg-gradient-to-r from-[var(--ct-amber-text)] to-[var(--ct-accent-hover)]"
                        : "h-2 rounded-full bg-[var(--ct-border-strong)]"
                    }
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-[var(--ct-text-soft)]">
                  {row.exampleCriterion}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-[var(--ct-text-soft)]">
          Trials and eligibility criteria: {TRIALS_META.source} —{" "}
          {TRIALS_META.count} active {TRIALS_META.sponsor} studies, quoted
          verbatim. Patient demand is a simulated pilot cohort seeded for this
          demo; searches run in this session are aggregated de-identified and
          added to it. No patient-identifiable data is stored.
        </p>
      </div>
    </main>
  );
}
