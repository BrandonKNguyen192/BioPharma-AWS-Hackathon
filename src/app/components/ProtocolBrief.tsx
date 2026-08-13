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
      <div className="rounded-[24px] border border-[color:var(--ct-violet-border)] bg-[var(--ct-violet-bg)] p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--ct-violet-text)]" />
          <h3 className="text-sm font-semibold text-[var(--ct-violet-text)]">
            Analyst brief
          </h3>
          <span className="ml-auto text-[10px] font-semibold uppercase text-[var(--ct-text-soft)]">
            Strands agent
          </span>
        </div>
        <p className="text-sm font-medium text-[var(--ct-text)]">{brief.headline}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ct-text-muted)]">
          {brief.finding}
        </p>
        <div className="mt-4 space-y-2 border-t border-[color:var(--ct-violet-border)] pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--ct-text-soft)]">
              Recommendation
            </p>
            <p className="mt-0.5 text-sm text-[var(--ct-text-muted)]">
              {brief.recommendation}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--ct-text-soft)]">
              Caveat
            </p>
            <p className="mt-0.5 text-xs text-[var(--ct-text-muted)]">{brief.caveat}</p>
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
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--ct-violet-border)] bg-[var(--ct-violet-bg)] px-4 py-2 text-xs font-medium text-[var(--ct-violet-text)] hover:brightness-95 disabled:opacity-50"
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
      {error && <p className="mt-2 text-xs text-[var(--ct-text-soft)]">{error}</p>}
    </div>
  );
}
