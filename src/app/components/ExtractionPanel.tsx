"use client";

import { useEffect, useState } from "react";
import type { PatientProfile } from "@/lib/types";

interface Chip {
  label: string;
  value: string;
  tone: "teal" | "violet" | "amber" | "slate";
}

/** Turn the extracted profile into display chips, skipping anything unknown. */
export function profileChips(p: PatientProfile): Chip[] {
  const chips: Chip[] = [];
  if (p.cancerType) chips.push({ label: "Condition", value: p.cancerType, tone: "teal" });
  if (p.stage) chips.push({ label: "Stage", value: p.stage, tone: "teal" });
  if (p.ecog !== null) chips.push({ label: "ECOG", value: String(p.ecog), tone: "violet" });
  if (p.pdl1Percent !== null)
    chips.push({ label: "PD-L1", value: `${p.pdl1Percent}%`, tone: "violet" });
  for (const b of p.biomarkers.slice(0, 3))
    chips.push({ label: "Biomarker", value: b, tone: "violet" });
  for (const t of p.priorTherapies.slice(0, 4))
    chips.push({ label: "Prior therapy", value: t, tone: "amber" });
  if (p.hasBrainMets !== null)
    chips.push({
      label: "CNS involvement",
      value: p.hasBrainMets ? "reported" : "none reported",
      tone: "slate",
    });
  if (p.ageYears !== null) chips.push({ label: "Age", value: String(p.ageYears), tone: "slate" });
  return chips;
}

const TONE: Record<Chip["tone"], string> = {
  teal: "border-[color:var(--ct-teal-border)] bg-[var(--ct-teal-bg)] text-[var(--ct-teal-text)]",
  violet:
    "border-[color:var(--ct-violet-border)] bg-[var(--ct-violet-bg)] text-[var(--ct-violet-text)]",
  amber: "border-[color:var(--ct-amber-border)] bg-[var(--ct-amber-bg)] text-[var(--ct-amber-text)]",
  slate:
    "border-[color:var(--ct-slate-chip-border)] bg-[var(--ct-slate-chip-bg)] text-[var(--ct-slate-chip-text)]",
};

/**
 * Reveals the extracted concepts one at a time. This is the "watch the model
 * read the paragraph" beat of the demo — it is presentation only, the data is
 * already resolved before this renders.
 */
export function ExtractionPanel({ profile }: { profile: PatientProfile }) {
  const chips = profileChips(profile);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (chips.length === 0) return;
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= chips.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 160);
    return () => clearInterval(id);
    // Re-run whenever a new extraction arrives.
  }, [profile, chips.length]);

  if (chips.length === 0) {
    return (
      <p className="text-sm text-[var(--ct-text-soft)]">
        We could not identify specific clinical details. Try mentioning your
        diagnosis, any treatments you have had, and recent test results.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.slice(0, shown).map((c, i) => (
          <span
            key={`${c.label}-${c.value}-${i}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${TONE[c.tone]}`}
            style={{ animation: "ct-pop 240ms ease-out both" }}
          >
            <span className="opacity-60">{c.label}</span>
            <span className="font-medium">{c.value}</span>
          </span>
        ))}
      </div>

      {profile.quotes.length > 0 && shown >= chips.length && (
        <div className="space-y-1.5 rounded-2xl bg-[var(--ct-surface-soft)] p-3.5">
          <p className="text-[11px] font-semibold uppercase text-[var(--ct-text-soft)]">
            Read directly from your words
          </p>
          {profile.quotes.slice(0, 3).map((q, i) => (
            <p key={i} className="text-xs italic text-[var(--ct-text-muted)]">
              “{q}”
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
