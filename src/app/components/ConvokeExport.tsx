"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { AggregateRow } from "@/lib/signal-store";

/**
 * Convoke ("AI operating system for biopharma") ingests internal evidence into
 * a structured ontology that downstream agents reason over.
 *
 * The exchange runs both ways. Inbound, development stage and catalyst dates
 * come from Convoke's knowledge graph at build time (see src/lib/programs.ts).
 * Outbound, this emits the artifact their platform ingests: a versioned,
 * self-describing decision record of which protocol criteria are costing
 * recruitment, with verbatim source text and provenance for each claim, now
 * annotated with the program each criterion is gating.
 *
 * Enrichment is resolved server-side and passed in, so this component never
 * pulls the trial or program datasets into the client bundle.
 */
export function ConvokeExport({
  rows,
  totalSearches,
  trialCount,
  programContext,
}: {
  rows: AggregateRow[];
  totalSearches: number;
  trialCount: number;
  /** Keyed by NCT id. Absent means no tracked program — omit, never zero. */
  programContext: Record<
    string,
    {
      asset: string;
      stage: string;
      indication: string;
      indicationMatched: boolean;
      status: string;
      nextCatalyst: { name: string; reportedDate: string } | null;
    }
  >;
}) {
  const [done, setDone] = useState(false);

  function download() {
    const artifact = {
      artifact: "cleartrial.protocol_optimization_signal",
      schemaVersion: "1.1.0",
      generatedAt: new Date().toISOString(),
      provenance: {
        trialSource: "ClinicalTrials.gov API v2",
        programSource:
          "Convoke Knowledge Graph via mcp.convoke.bio — query_program_tracker, query_catalyst_calendar",
        trialsMonitored: trialCount,
        prescreensAggregated: totalSearches,
        method:
          "Deterministic rule evaluation of published eligibility criteria against de-identified patient pre-screens. No patient-identifiable data included.",
        programJoin:
          "Trial interventions matched to Convoke drug entities on primary entity_id. catalystReportedDate is the granularity the source stated, not a precise day.",
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
        // Present only when Convoke has a program for one of the trial's
        // interventions. An absent key means unknown, not "no program".
        ...(programContext[r.exampleTrial]
          ? { gatingProgram: programContext[r.exampleTrial] }
          : {}),
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
