"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
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
  const excluded = data?.results.filter((r) => r.verdict === "excluded") ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-teal-400" />
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                ClearTrial
              </h1>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Tell us about your cancer in your own words — no medical terms
              needed. We will show you which studies you may qualify for, and
              explain exactly why.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Searching {TRIAL_COUNT} active Bristol Myers Squibb oncology
              trials from ClinicalTrials.gov
            </p>
          </div>
          <a
            href="/dashboard"
            className="shrink-0 text-sm text-slate-500 transition-colors hover:text-slate-300"
          >
            Researcher view →
          </a>
        </header>

        <section className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="For example: I was diagnosed with… I've already tried… My recent results showed…"
            className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Reading your history…
                </>
              ) : (
                <>
                  Find trials
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <button
              onClick={() => setText(DEMO_STORY)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Use the example story
            </button>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </section>

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="space-y-3">
              {["Reading your description", "Identifying clinical concepts", "Checking eligibility criteria"].map(
                (s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 text-sm text-slate-400"
                    style={{ animation: `ct-fade 400ms ease-out ${i * 260}ms both` }}
                  >
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-teal-400" />
                    {s}…
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {data && (
          <>
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-200">
                  What we understood
                </h2>
                <span className="text-[11px] text-slate-600">
                  {data.usedFallback
                    ? "offline mode"
                    : `${data.model} · ${(data.elapsedMs / 1000).toFixed(1)}s`}
                </span>
              </div>
              <ExtractionPanel profile={data.profile} />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-slate-200">
                {matches.length > 0
                  ? `${Math.min(matches.length, 5)} trial${Math.min(matches.length, 5) === 1 ? "" : "s"} worth asking about`
                  : "No clear matches yet"}
              </h2>
              {matches.slice(0, 5).map((r) => (
                <TrialCard key={r.trial.nctId} result={r} />
              ))}
              {matches.length === 0 && (
                <p className="text-sm text-slate-500">
                  Nothing matched cleanly. The studies below explain what ruled
                  you out — that reason is sent, anonymously, to the teams who
                  design these trials.
                </p>
              )}
            </section>

            {excluded.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-slate-400">
                  Why other studies ruled you out
                </h2>
                {excluded.slice(0, 3).map((r) => (
                  <TrialCard key={r.trial.nctId} result={r} />
                ))}
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <p className="text-xs leading-relaxed text-slate-500">
                  ClearTrial is an eligibility pre-screen, not medical advice and
                  not a diagnosis. Eligibility is decided by code against
                  published protocol criteria — the language model only reads
                  your description and explains the result. A study team makes
                  the final determination. Your text is not stored; only
                  anonymous, aggregate reasons for exclusion are shared with
                  trial designers.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
