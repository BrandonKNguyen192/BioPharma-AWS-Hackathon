"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Expandable provenance for a dashboard metric.
 *
 * The product's whole claim is that every number traces to a criterion you can
 * read. A headline figure with no way to open it asks for that on trust. This
 * makes the derivation part of the interface rather than something you have to
 * take our word for.
 */
export function MetricDrilldown({
  label = "How this is calculated",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full text-[11px] font-medium text-[var(--ct-text-soft)] transition-colors hover:text-[var(--ct-text)]"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
        {open ? "Hide derivation" : label}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-[color:var(--ct-border)] pt-3 text-xs leading-5 text-[var(--ct-text-muted)]">
          {children}
        </div>
      )}
    </div>
  );
}

/** The literal arithmetic behind a figure. */
export function Derivation({ formula, result }: { formula: string; result: string }) {
  return (
    <p className="font-mono text-[11px] leading-5 text-[var(--ct-text-soft)]">
      {formula} <span className="text-[var(--ct-text)]">= {result}</span>
    </p>
  );
}

/** A single provenance row: a count, a name, and where it came from. */
export function SourceRow({
  count,
  name,
  detail,
  source,
}: {
  count: string | number;
  name: string;
  detail?: string;
  source?: string;
}) {
  return (
    <div className="flex gap-3 border-b border-[color:var(--ct-border)] pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 tabular-nums font-semibold text-[var(--ct-text)]">
        {count}
      </span>
      <div className="min-w-0">
        <p className="text-[var(--ct-text)]">{name}</p>
        {detail && <p className="mt-0.5 italic text-[var(--ct-text-soft)]">“{detail}”</p>}
        {source && (
          <p className="mt-0.5 font-mono text-[10px] text-[var(--ct-text-soft)]">{source}</p>
        )}
      </div>
    </div>
  );
}
