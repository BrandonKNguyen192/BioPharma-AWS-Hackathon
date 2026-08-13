/**
 * Protocol Intelligence agent — built on the Strands Agents SDK (AWS).
 *
 * WHY AN AGENT HERE AND NOWHERE ELSE
 * ----------------------------------
 * ClearTrial's core invariant is that no model decides patient eligibility.
 * That path stays deterministic (see match.ts) and this agent is deliberately
 * kept out of it.
 *
 * This is the other half of the product: turning an aggregate of exclusion
 * signals into a written recommendation for the trial design team. That is
 * genuine analytical work — it needs to look up criteria, weigh which
 * requirement is costing the most recruitment, and argue a change. Nobody is
 * harmed by a wrong adjective in a memo, and a human reads it before acting.
 *
 * The agent can only see de-identified aggregates. Its tools cannot reach
 * patient text, because patient text is never stored.
 */

import "server-only";
import { Agent, tool } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { z } from "zod";
import { getDashboardData } from "./signal-store";
import { TRIALS, TRIALS_META } from "./trials";

export const BRIEF_MODEL = "gpt-5.6-sol";

/** Tool 1 — the aggregate exclusion signal. De-identified by construction. */
const getExclusionSignals = tool({
  name: "get_exclusion_signals",
  description:
    "Return the aggregated, de-identified reasons interested patients failed to match BMS oncology trials, ranked by how many pre-screens each reason blocked.",
  inputSchema: z.object({}),
  callback: () => {
    const d = getDashboardData();
    return JSON.stringify({
      totalPrescreens: d.totalSearches,
      trialsMonitored: TRIALS_META.count,
      leadingIndication: d.topCancer,
      exclusions: d.rows.map((r) => ({
        criterion: r.label,
        prescreensBlocked: r.patientsBlocked,
        sharePct: d.totalSearches
          ? Math.round((r.patientsBlocked / d.totalSearches) * 100)
          : 0,
        exampleTrial: r.exampleTrial,
        verbatimCriterion: r.exampleCriterion,
      })),
    });
  },
});

/** Tool 2 — look up the published criteria for a specific trial. */
const getTrialCriteria = tool({
  name: "get_trial_criteria",
  description:
    "Look up the published inclusion and exclusion criteria for a specific trial by its NCT identifier.",
  inputSchema: z.object({
    nctId: z.string().describe("The NCT identifier, e.g. NCT06712316"),
  }),
  callback: (input) => {
    const t = TRIALS.find(
      (x) => x.nctId.toLowerCase() === input.nctId.trim().toLowerCase(),
    );
    if (!t) return `No trial found with id ${input.nctId}.`;
    return JSON.stringify({
      nctId: t.nctId,
      title: t.title,
      phase: t.phase,
      conditions: t.conditions,
      inclusion: t.inclusion,
      exclusion: t.exclusion,
    });
  },
});

/** The shape the dashboard renders. */
const BriefSchema = z.object({
  headline: z
    .string()
    .describe("One sentence naming the single highest-cost criterion."),
  finding: z
    .string()
    .describe(
      "Two or three sentences quantifying the recruitment cost, citing the criterion and the trial it came from.",
    ),
  recommendation: z
    .string()
    .describe(
      "One concrete, conservative protocol change a clinical team could evaluate. Frame as a question for review, never as a directive.",
    ),
  caveat: z
    .string()
    .describe(
      "One sentence on what this signal cannot tell them and what evidence would be needed before acting.",
    ),
});

export type ProtocolBrief = z.infer<typeof BriefSchema>;

const SYSTEM = `
You are a clinical trial operations analyst writing for a Bristol Myers Squibb
protocol design team.

You are given aggregate, de-identified pre-screen data showing which eligibility
criteria most often ruled out interested patients. Use your tools to read the
signal and to look up the exact published criteria of any trial you cite.

Rules:
- Quantify. Name the criterion, the number of pre-screens it blocked, and the
  trial it appears in. Never write a number a tool did not give you.
- Recommend conservatively. Protocol criteria usually exist for patient safety.
  Frame any change as a question for clinical review, not an instruction, and
  never imply a criterion is wrong simply because it is costly.
- Be brief and concrete. This is read by busy people.
- You are describing recruitment feasibility, not making a medical claim about
  any patient.
`.trim();

export async function generateProtocolBrief(): Promise<ProtocolBrief> {
  // Responses API, not chat completions: gpt-5.6-* rejects function tools on
  // /v1/chat/completions unless reasoning_effort is 'none', and we want the
  // reasoning for this analysis step.
  const model = new OpenAIModel({ api: "responses", modelId: BRIEF_MODEL });

  const agent = new Agent({
    model,
    systemPrompt: SYSTEM,
    tools: [getExclusionSignals, getTrialCriteria],
    structuredOutputSchema: BriefSchema,
  });

  const result = await agent.invoke(
    "Review the current exclusion signal and write a protocol optimization brief for the trial design team. Look up the criteria of the trial behind the leading exclusion before you write.",
  );

  // The SDK types structuredOutput as unknown; re-validate rather than cast so
  // a malformed response throws here instead of rendering broken UI.
  return BriefSchema.parse(result.structuredOutput);
}
