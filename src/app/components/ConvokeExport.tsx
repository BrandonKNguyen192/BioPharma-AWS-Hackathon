"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { AggregateRow } from "@/lib/signal-store";

/**
 * Convoke ("AI operating system for biopharma") ingests internal evidence into
 * a structured ontology that downstream agents reason over.
 *
 * The shipped hackathon build does not call Convoke directly. Until the MCP
 * integration is authenticated and wired in, we emit the artifact their
 * platform would ingest: a versioned, self-describing decision record of
 * which protocol criteria are costing recruitment, with the verbatim source
 * text and provenance for each claim.
 *
 * That keeps the demo honest: a real handoff format, not a fake network call.
 */
export function ConvokeExport({
  rows,
  totalSearches,
  trialCount,
}: {
  rows: AggregateRow[];
  totalSearches: number;
  trialCount: number;
}) {
  const [done, setDone] = useState(false);

  function download() {
    const artifact = {
      artifact: "cleartrial.protocol_optimization_signal",
      schemaVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      provenance: {
        trialSource: "ClinicalTrials.gov API v2",
        trialsMonitored: trialCount,
        prescreensAggregated: totalSearches,
        method:
          "Deterministic rule evaluation of published eligibility criteria against de-identified patient pre-screens. No patient-identifiable data included.",
      },
      findings: rows.map((r, i) => ({
        rank: i + 1,
        criterionKind: r.kind,
        label: r.label,
        prescreensBlocked: r.patientsBlocked,
        shareOfPrescreens:
          totalSearches > 0
            ? Number((r.patientsBlocked / totalSearches).toFixed(3))
            : 0,
        evidence: {
          exampleTrial: r.exampleTrial,
          verbatimCriterion: r.exampleCriterion,
          sourceUrl: `https://clinicaltrials.gov/study/${r.exampleTrial}`,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(artifact, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cleartrial-protocol-signal-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ct-border)] bg-[var(--ct-surface)] px-3 py-1.5 text-xs text-[var(--ct-text-muted)] transition-colors hover:border-[color:var(--ct-border-strong)] hover:text-[var(--ct-text)]"
      title="Emit a structured decision artifact for ingestion into Convoke"
    >
      <FileDown className="h-3.5 w-3.5" />
      {done ? "Artifact exported" : "Export for Convoke"}
    </button>
  );
}
