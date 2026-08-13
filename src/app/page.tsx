"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Database,
  FileHeart,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppShell } from "./components/AppShell";
import { ExtractionPanel } from "./components/ExtractionPanel";
import { TrialCard } from "./components/TrialCard";
import { TRIALS_META } from "@/lib/trials";
import type { MatchResponse } from "@/lib/types";

const TRIAL_COUNT = TRIALS_META.count;

const DEMO_STORY = `I'm 58. Last year I was diagnosed with stage IV non-small cell lung cancer. I went through four rounds of carboplatin and pemetrexed, but my last scan showed it had spread further. My oncologist mentioned my PD-L1 is around 60%. My ECOG is 1 and there's no sign it's reached my brain. I've been on ClinicalTrials.gov for hours and I genuinely can't tell which of these studies I'd even be allowed to join. I feel like I'm running out of time and options.`;

export default function PatientPortal() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (text.trim().length < 10) {
      setError("Please describe your situation in a sentence or two.");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      setData(json as MatchResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const matches = data?.results.filter((r) => r.verdict !== "excluded") ?? [];
  const nearMisses = data?.nearMisses ?? [];

  return (
    <AppShell
      active="patient"
      title="Patient matching"
      description={`${TRIAL_COUNT} recruiting studies`}
      actions={
        <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--ct-surface-strong)] px-4 text-xs font-medium text-[var(--ct-text-muted)] shadow-sm hover:text-[var(--ct-text)]">
          <span className="hidden sm:inline">Researcher view</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <section className="ct-intake-hero">
        <div className="ct-intake-main">
          <div className="flex items-center gap-4">
            <div className="ct-assistant-avatar">
              <FileHeart className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm text-[var(--ct-text-muted)]">Hi, I&apos;m ClearTrial.</p>
              <h2 className="mt-0.5 text-2xl font-semibold leading-tight text-[var(--ct-text)] sm:text-3xl">
                Which trials could fit?
              </h2>
            </div>
          </div>

          <div className="ct-composer">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              aria-label="Describe your diagnosis and treatment history"
              placeholder="Describe your diagnosis, treatment history, recent results, and anything your care team has told you. Everyday language is fine."
              className="ct-input min-h-40 w-full resize-none p-5 text-sm leading-7 sm:text-[15px]"
            />
            <div className="ct-composer-footer">
              <button
                type="button"
                onClick={() => setText(DEMO_STORY)}
                className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ct-text-soft)] hover:text-[var(--ct-text)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Use example
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="ct-icon-submit"
                aria-label={loading ? "Finding trials" : "Find trials"}
                title={loading ? "Finding trials" : "Find trials"}
              >
                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-[var(--ct-rose-text)]">{error}</p>}
        </div>

        <aside className="ct-intake-aside">
          <div>
            <div className="mb-6 flex items-center justify-between">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ct-surface)]">
                <Database className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-[var(--ct-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--ct-text-muted)]">
                Live evidence
              </span>
            </div>
            <p className="text-4xl font-semibold tabular-nums text-[var(--ct-text)]">{TRIAL_COUNT}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--ct-text-muted)]">
              Recruiting studies sourced from ClinicalTrials.gov and checked criterion by criterion.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs text-[var(--ct-text-muted)]">
            <LockKeyhole className="h-3.5 w-3.5" />
            Your story is not stored
          </div>
        </aside>
      </section>

      {loading && (
        <section className="ct-soft-panel mt-5 p-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            {["Reading your description", "Finding clinical concepts", "Checking trial criteria"].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 text-sm text-[var(--ct-text-muted)]"
                style={{ animation: `ct-fade 400ms ease-out ${i * 220}ms both` }}
              >
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[var(--ct-violet-text)]" />
                {step}
              </div>
            ))}
          </div>
        </section>
      )}

      {data && (
        <div className="ct-results-layout">
          <div className="min-w-0 space-y-5">
            <section>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="ct-section-label">Recommended studies</p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--ct-text)]">
                    {matches.length > 0
                      ? `${Math.min(matches.length, 5)} worth asking about`
                      : "No clear matches yet"}
                  </h2>
                </div>
                <span className="text-xs text-[var(--ct-text-soft)]">Ranked by fit and evidence</span>
              </div>

              <div className="space-y-3">
                {matches.slice(0, 5).map((result) => (
                  <TrialCard key={result.trial.nctId} result={result} />
                ))}
              </div>

              {matches.length === 0 && (
                <div className="ct-soft-panel p-6 text-sm leading-6 text-[var(--ct-text-muted)]">
                  Nothing matched cleanly. The studies below show which published requirement ruled you out so you can discuss it with your care team.
                </div>
              )}
            </section>

            {nearMisses.length > 0 && (
              <section className="space-y-3 pt-3">
                <div>
                  <p className="ct-section-label">Near matches</p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ct-text)]">
                    One criterion away from {nearMisses.length} other {nearMisses.length === 1 ? "study" : "studies"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--ct-text-soft)]">
                    Only anonymous aggregate exclusion reasons are shared with trial designers.
                  </p>
                </div>
                {nearMisses.map((result) => (
                  <div key={result.trial.nctId} className="space-y-2">
                    <TrialCard result={result} />
                    {result.blockers[0] && (
                      <div className="rounded-2xl bg-[var(--ct-rose-bg)] px-4 py-3">
                        <p className="text-[11px] font-semibold text-[var(--ct-rose-text)]">Exact exclusion language</p>
                        <p className="mt-1 text-xs italic leading-5 text-[var(--ct-text-muted)]">“{result.blockers[0].source}”</p>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="flex gap-3 rounded-2xl bg-[var(--ct-surface-soft)] p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ct-text-soft)]" />
              <p className="text-xs leading-5 text-[var(--ct-text-soft)]">
                ClearTrial is an eligibility pre-screen, not medical advice or a diagnosis. Published protocol rules determine these results; the study team makes the final eligibility decision.
              </p>
            </section>
          </div>

          <aside className="ct-results-sidebar ct-soft-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="ct-section-label">Your profile</p>
                <h2 className="mt-1 text-base font-semibold text-[var(--ct-text)]">What we understood</h2>
              </div>
              <span className="rounded-full bg-[var(--ct-surface-soft)] px-2.5 py-1 text-[10px] text-[var(--ct-text-soft)]">
                {data.usedFallback ? "offline" : `${(data.elapsedMs / 1000).toFixed(1)}s`}
              </span>
            </div>
            <ExtractionPanel profile={data.profile} />
          </aside>
        </div>
      )}
    </AppShell>
  );
}
