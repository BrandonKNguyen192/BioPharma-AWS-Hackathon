# ClearTrial - Unified Research & Architecture Decision

Companion to `RESEARCH.md` (business, regulatory, market, data substrate) and
`RESEARCH2.md` (deterministic-eligibility design, agentic architecture).
Compiled Aug 13, 2026 for Biopharma Hack Day @ AWS Builder Loft.

## 1. The decision in one paragraph

Keep the deterministic TypeScript engine in `src/lib/match.ts` as the only
authority that writes eligibility verdicts. Treat the LLM as extraction and
explanation only, then formalize the agentic layer as small typed worker
functions that report to a primary data layer (an immutable decision log). Do
not adopt LangGraph, CrewAI, or Bedrock AgentCore for the demo. Add two new
roles first: the Criterion Normalizer and the Guardrail Reviewer. Use real
sponsor/trial data from ClinicalTrials.gov plus public press, IR, and financial
disclosures for pipeline visibility, and synthetic data only on the
patient-demand side (seeded cohorts, dashboard aggregates, edge-case tests).

## 2. How the two reports fit together

| | RESEARCH.md | RESEARCH2.md |
|---|---|---|
| Purpose | Why this product exists and what claim is defensible | How to keep the LLM from ever deciding eligibility |
| Core question | Business, market, regulatory, data substrate | Engineering, safety, agent architecture |
| Load-bearing facts | ~3% adult cancer trial enrollment; 23% coverage floor and ~50% EHR-predictable ceiling; FDA CDS guidance Jan 29 2026; TrialGPT 87.3% accuracy and 42.6% screening-time reduction; BMS NVIDIA AI factory | Right-prediction-wrong-reasoning; systematic review of hallucination, leakage, bias; alphaNeSy-CTM up to +30% vs pure LLM; MSK-MATCH 98.6% accuracy at 43s and $0.96 per patient-trial pair |
| Output | Section 11 Now / Next / Later repo backlog | Part B phased agent plan (Phase 0-3) |

The reports agree on the load-bearing architecture: RESEARCH.md says verdicts
must be "deterministic and auditable"; RESEARCH2.md proves why with the
literature. They also line up operationally:

- RESEARCH.md Next item 1 (expand matcher coverage) is exactly the Criterion
  Normalizer in RESEARCH2.md.
- RESEARCH.md Next item 2 (persist the signal store) is the decision-log /
  persist-store work in RESEARCH2.md Phase 2.
- RESEARCH.md Later item 1 (sponsor signal ingestion) is orthogonal to the
  match path: it feeds a pipeline-visibility layer, not eligibility verdicts.

## 3. Deep-research additions (live-verified Aug 13, 2026)

- **ClinicalTrials.gov is still the right substrate, and the demo number is
  defensible.** The exact demo query (sponsor = Bristol-Myers Squibb, recruiting,
  oncology conditions) currently returns **92 studies**. The committed 60 in
  `src/data/trials.json` is a stable, offline, dependency-free subset. Demo
  phrasing: "60 committed real trials, sourced from a current universe of 92."
- **The arXiv frontier confirms the neurosymbolic direction.** Beyond
  alphaNeSy-CTM (2606.20895), SatIR (2604.08849), and the systematic review
  (2509.19327), the same search surfaces newer entrants: "Toward an AI
  Reasoning-Enabled System for Patient-Clinical Trial Matching" (2512.08026),
  TrialMatchAI (2505.08508), and MatchMiner-AI (2412.17228). None overturn the
  design; they reinforce criterion-level, evidence-grounded matching.
- **SEC EDGAR is a concrete pipeline-visibility source.** BMS (CIK 0000014272)
  filed a 10-Q and an 8-K on 2026-07-30, both machine-readable and public. This
  is exactly the "financial reports" channel the AstraZeneca-style feedback
  described. The pipeline layer should combine SEC filings, company IR and
  press pages (Bright Data Web Unlocker when bot-gated), and
  ClinicalTrials.gov updates.
- **IND numbers themselves are not public.** FDA keeps IND content confidential.
  The pipeline layer should track public disclosures - press releases,
  investor presentations, SEC filings, and registry updates - not try to scrape
  IND numbers.

Data strategy, confirmed with the collaborators:

- Real data for the product claims: ClinicalTrials.gov trials (already
  committed) and sponsor press/IR/EDGAR signals (new ingestion path).
- Synthetic data for the demand side only: sample patient stories, seeded
  search cohorts in `signal-store.ts`, dashboard aggregates, and edge-case
  matcher tests. Never present synthetic patient demand as real patient data.

## 4. Unified architecture mapped to the current repo

The invariant: `match.ts` is the only component that writes eligibility
verdicts. Agents write typed zod artifacts; disagreements become `null` or
`needs_review`; no raw patient text enters the shared layer.

| Role | Typed artifact | LLM or code | File today | Status |
|---|---|---|---|---|
| Intake / Extractor | `PatientProfile` | LLM structured + zod re-coercion | `src/lib/extract.ts` | Exists |
| Criterion Normalizer | `RuleKind` + parameters | LLM classify, code gate | `classify()` in `src/lib/match.ts` | Partial (regex) |
| Evidence Grounder | verbatim criterion quote | Code + retrieval | `src/lib/match.ts` | Exists |
| Guardrail Reviewer | disagreement flag | LLM second pass | New | New |
| Explainer | trial-card prose | LLM post-verdict | UI components | Exists |
| Signal Analyst | `ProtocolBrief` | Strands agent | `src/lib/protocol-agent.ts` | Exists |
| Privacy Scrubber | scrubbed artifacts | Rules + LLM check | New | New |
| Decision Engine | `MatchResult` verdicts | Code only | `src/lib/match.ts` | Exists |
| Orchestrator | pipeline order, timeouts, fallbacks | Code (thin router) | `src/app/api/match/route.ts` | Exists |

## 5. Actionable outcome

**Phase 0 - before judging (hours, zero new dependencies):**

1. Add the immutable decision log: append `{ nctId, criterion source, patient
   value, rule, outcome }` per verdict. The existing Convoke export is the seed;
   make it the runtime spine.
2. Add invariant tests: every agent artifact zod-round-trips; verdicts originate
   only from `match.ts`; no raw patient text enters the shared layer.
3. Align model constants with the active key: `PRIMARY_MODEL` / `FALLBACK_MODEL`
   in `src/lib/extract.ts` and `BRIEF_MODEL` in `src/lib/protocol-agent.ts`
   still reference `gpt-5.6-sol` / `gpt-5.5`, which the group key does not
   serve; move to a `gpt-5.4`-class model first or the live path falls back.

**Phase 1 - demo-day stretch:**

4. Guardrail Reviewer: second-pass negation / abbreviation / boundary re-check;
   disagreement maps to `null` -> `needs_review`. Reuse
   `scripts/test-negation.mjs` and `scripts/test-condition-gate.mjs` as the
   fixture suite.
5. Parallel per-trial evaluation in `src/app/api/match/route.ts`
   (`Promise.all` over trials; each trial is independent).

**Phase 2 - post-hack, highest product value:**

6. Criterion Normalizer with a deterministic gate for ALT/AST/bilirubin,
   histology subtype, and EGFR/ALK/KRAS biomarker rules. Every new `RuleKind` is
   a pure function plus a unit test. This is the bounded path past 23% coverage.
7. Persist the signal store (SQLite or Postgres behind the `signal-store.ts`
   interface), keeping de-identified rows only.
8. Add extractor evals on a small gold set (demo paragraph + variations, plus
   the negation and boundary regressions).

**Phase 3 - separate product track (pipeline visibility):**

9. Sponsor signal ingestion: new `scripts/fetch-sponsor-signals.mjs`,
   `src/data/sponsor-signals.json`, `src/lib/sponsor-signals.ts`, and a
   pipeline UI surface (`src/app/pipeline/page.tsx`).
10. Convoke-backed reconciliation as the canonicalization layer for sponsor,
    asset, indication, and program identity.
11. Broader disease-area support only after the oncology demo is strong.

## 6. Metrics and invariants to defend

- Coverage: 23% today is a floor; the AMIA 2026 NSCLC analysis puts the
  EHR-predictable ceiling around half of criteria. "Unknown never passes" is
  the safe direction.
- Benchmarks to cite: TrialGPT 87.3% criterion accuracy and 42.6% screening-time
  reduction; MSK-MATCH 98.6% patient-level accuracy, 43 seconds, $0.96 per
  patient-trial pair; alphaNeSy-CTM up to +30% relative over pure LLM matching.
- Cost target: stay well under $0.96 per patient-trial pair via retrieval-first
  ranking, parallel evaluation, and cheap-model routing for high-confidence
  extractions.
- Privacy: no patient free text persisted or logged; concept-level telemetry
  only; audit inter-agent channels the way AgentLeak audits shared memory.

## 7. Pitch-ready lines

- "We match real BMS trials from ClinicalTrials.gov, and every verdict is a
  deterministic rule you can diff and sign off."
- "The model never decides eligibility; it reads messy patient language and
  explains a decision path the code made."
- "Rejections are anonymized protocol-design intelligence, and we pull the same
  public signals from press releases and financial reports to give pipeline
  visibility."

All claims here trace to the source lists in `RESEARCH.md` and `RESEARCH2.md`;
the additions in section 3 were live-verified against ClinicalTrials.gov,
arXiv, and SEC EDGAR on Aug 13, 2026.
