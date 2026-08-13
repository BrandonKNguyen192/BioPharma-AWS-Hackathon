import { TriangleAlert } from "lucide-react";
import { getDashboardData } from "@/lib/signal-store";
import { TRIALS_META } from "@/lib/trials";
import { ConvokeExport } from "@/app/components/ConvokeExport";
import { ProtocolBrief } from "@/app/components/ProtocolBrief";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = getDashboardData();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Protocol Intelligence
            </h1>
            <p className="text-sm text-slate-400">
              Bristol Myers Squibb — Oncology Portfolio
            </p>
            {/*
              The trials and criteria below are real. Patient demand is not:
              the cohort is seeded so the dashboard has a story before any
              searches have run. Say so on the page rather than letting a
              viewer assume 47 real people were screened.
            */}
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
              Simulated pilot cohort · real trial criteria · live searches
              append to these counts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConvokeExport
              rows={data.rows}
              totalSearches={data.totalSearches}
              trialCount={TRIALS_META.count}
            />
            <a
              href="/"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              ← Patient view
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Patient Searches
            </p>
            <p className="text-3xl font-semibold text-white">
              {data.totalSearches}
            </p>
            <p className="text-xs text-slate-500">pre-screens run</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Trials Monitored
            </p>
            <p className="text-3xl font-semibold text-white">
              {TRIALS_META.count}
            </p>
            <p className="text-xs text-slate-500">active BMS oncology</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Top Exclusion
            </p>
            <p className="text-3xl font-semibold text-amber-400">
              {data.topBlockerPct}%
            </p>
            <p className="text-xs text-slate-500">of searches blocked</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Leading Indication
            </p>
            <p className="text-3xl font-semibold text-white">
              {data.topCancer ? data.topCancer.count : 0}
            </p>
            <p className="truncate text-xs text-slate-500">
              {data.topCancer ? data.topCancer.name : "—"}
            </p>
          </div>
        </div>

        {data.rows.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-amber-400" />
              <h2 className="font-semibold text-amber-200">
                Protocol Optimization Alert
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {data.topBlockerPct}% of interested patients were ruled out by
              “{data.rows[0].label}”. This single criterion blocked{" "}
              {data.rows[0].patientsBlocked} searches across the portfolio.
              Relaxing or stratifying it could materially expand the eligible
              pool.
            </p>
            <div className="mt-3 border-l-2 border-amber-500/40 pl-3">
              <p className="font-mono text-[11px] text-amber-400/80">
                {data.rows[0].exampleTrial}
              </p>
              <p className="text-xs italic text-slate-400">
                {data.rows[0].exampleCriterion}
              </p>
            </div>
          </div>
        )}

        <ProtocolBrief />

        <h3 className="mb-3 mt-8 text-sm font-medium text-slate-300">
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
                  <p className="text-sm text-slate-200">{row.label}</p>
                  <p className="text-sm tabular-nums text-slate-400">
                    {row.patientsBlocked}
                  </p>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-800">
                  <div
                    style={{ width: pct + "%" }}
                    className={
                      index === 0
                        ? "h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                        : "h-2 rounded-full bg-slate-600"
                    }
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {row.exampleCriterion}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-600">
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
