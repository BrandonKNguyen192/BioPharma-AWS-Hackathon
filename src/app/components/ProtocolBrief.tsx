"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

interface Brief {
  headline: string;
  finding: string;
  recommendation: string;
  caveat: string;
}

/**
 * Renders the agent-written protocol brief. Purely additive — if the agent
 * fails, the deterministic alert above it is unaffected.
 */
export function ProtocolBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/protocol-brief", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed.");
      setBrief(json.brief as Brief);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (brief) {
    return (
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold text-violet-200">
            Analyst brief
          </h3>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">
            Strands agent
          </span>
        </div>
        <p className="text-sm font-medium text-slate-100">{brief.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {brief.finding}
        </p>
        <div className="mt-4 space-y-2 border-t border-violet-500/15 pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Recommendation
            </p>
            <p className="mt-0.5 text-sm text-slate-300">
              {brief.recommendation}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Caveat
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{brief.caveat}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
      >
        {loading ? (
          <>
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Agent reviewing the portfolio…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate analyst brief
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-slate-500">{error}</p>}
    </div>
  );
}
