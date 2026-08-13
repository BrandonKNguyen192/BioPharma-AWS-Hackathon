import { z } from "zod";
import data from "@/data/pipeline-radar-reviewed.json";

const datedValue = z.object({
  reported: z.string(),
  precision: z.enum(["day", "month", "quarter", "year"]),
  sortDate: z.string(),
});

const signalSchema = z.object({
  id: z.string(),
  eventType: z.enum([
    "trial_planned",
    "trial_initiated",
    "first_patient_dosed",
    "enrollment_completed",
    "topline_results",
    "regulatory_submitted",
    "regulatory_accepted",
    "designation_granted",
    "approval_granted",
  ]),
  eventDate: datedValue,
  company: z.string(),
  asset: z.object({ name: z.string(), aliases: z.array(z.string()) }),
  indication: z.string(),
  phase: z.string().nullable(),
  headline: z.string(),
  summary: z.string(),
  source: z.object({
    publisher: z.string(),
    type: z.enum(["company_release", "sec_filing", "regulator", "registry"]),
    url: z.string().url(),
    title: z.string(),
    publishedAt: z.string(),
    quote: z.string(),
  }),
  registryMatch: z.object({
    status: z.enum(["exact", "probable", "ambiguous", "no_match_as_of"]),
    nctId: z.string().nullable(),
    checkedAt: z.string(),
    currentStatus: z.string().nullable(),
    firstPosted: z.string().nullable(),
    reasons: z.array(z.string()),
  }),
  evidence: z.enum(["discovery_only", "secondary_report", "company_asserted", "public_record", "corroborated"]),
  reviewNote: z.string(),
});

const radarSchema = z.object({
  schemaVersion: z.string(),
  generatedAt: z.string(),
  checkedAt: z.string(),
  scope: z.string(),
  sources: z.array(z.string()),
  signals: z.array(signalSchema),
});

export type PipelineSignal = z.infer<typeof signalSchema>;
export const PIPELINE_RADAR = radarSchema.parse(data);

export const RADAR_SUMMARY = {
  signalCount: PIPELINE_RADAR.signals.length,
  assets: new Set(PIPELINE_RADAR.signals.map((signal) => signal.asset.name)).size,
  exactRegistryLinks: PIPELINE_RADAR.signals.filter((signal) => signal.registryMatch.status === "exact").length,
  regulatoryClaims: PIPELINE_RADAR.signals.filter((signal) => signal.eventType.startsWith("regulatory_")).length,
};

export const EVIDENCE_LABELS: Record<PipelineSignal["evidence"], string> = {
  discovery_only: "Discovery only",
  secondary_report: "Secondary report",
  company_asserted: "Company asserted",
  public_record: "Public record",
  corroborated: "Corroborated signal",
};

export const EVENT_LABELS: Record<PipelineSignal["eventType"], string> = {
  trial_planned: "Trial planned",
  trial_initiated: "Trial initiated",
  first_patient_dosed: "First patient dosed",
  enrollment_completed: "Enrollment completed",
  topline_results: "Data readout",
  regulatory_submitted: "Regulatory submission",
  regulatory_accepted: "Regulatory acceptance",
  designation_granted: "Designation granted",
  approval_granted: "Approval granted",
};
