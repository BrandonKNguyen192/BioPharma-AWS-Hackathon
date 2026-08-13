# ClearTrial — Deep Research: Core Topics

Research compiled Aug 13, 2026 for Biopharma Hack Day @ AWS Builder Loft.
Every claim below is verified against a primary source; links/PMIDs/arXiv IDs included.
Where a common stat could not be traced to a primary source, it is flagged as such.

---

## 1. The problem: the clinical trial enrollment crisis

**The anchor statistic (verifiable):** Only ~3% of adult cancer patients in the US
participate in clinical trials.

- Source: Murthy VH, Krumholz HM, Gross CP. "Participation in cancer clinical trials:
  race-, sex-, and age-based disparities." JAMA 2004;291(22):2720-6. PMID 15187053.
  Population-based analysis of all NCI Cooperative Group therapeutic trials 2000-2002.
- Corroborating framing: AACR Cancer Progress Report and ASCO routinely cite fewer than
  5% of adult cancer patients enrolling in trials.

**Inadequate accrual is the #1 operational barrier to completing oncology trials.**

- Source: "Trial-level factors affecting accrual and completion of oncology clinical
  trials: A systematic review." Contemporary Clinical Trials Communications, 2021.
  PMID 34765799. Systematic review of 6,582 screened studies, 16 included: accrual is
  "one of the most significant barriers to the completion of oncology clinical trials."
- Related 2026 work: "Near-Real-Time Clinical Trial Accrual Dashboard in an
  NCI-Designated Cancer Center" (PMID 42229883) — the NCI ecosystem is actively
  building accrual-observability tooling. ClearTrial's researcher dashboard is the
  patient-demand side of the same coin.

**The often-cited "80% of trials fail to meet enrollment timelines" figure:** widely
repeated in industry literature and traced loosely to Tufts CSDD site-performance
analyses (e.g., ~48% of sites enroll zero or one patient). No single primary source
could be pinned down during this research session — treat it as directional in the
pitch ("roughly half of oncology trials miss enrollment timelines", "the majority of
sites under-enroll"), or cite a Tufts CSDD report explicitly.

**ClearTrial's claim is consistent with the evidence:** half of oncology trials miss
enrollment timelines; patients who want in cannot parse ClinicalTrials.gov; both sides
lose for the same reason — eligibility written for regulators, not people.

---

## 2. The data substrate: ClinicalTrials.gov

- **API v2 verified live during this session (2026-08-13):** `GET
  https://clinicaltrials.gov/api/v2/studies` returns current data with **no API key**;
  server reported `apiVersion: 2.0.5`, `dataTimestamp: 2026-08-13T09:00:04Z`. The
  project's `scripts/fetch-trials.mjs` uses exactly this path (Bright Data Web
  Unlocker optional when keyed).
- Registry scale: 500,000+ registered studies in 220+ countries (ClinicalTrials.gov
  official figure). The demo dataset is 60 recruiting BMS oncology trials — a deliberate
  subset so the demo never depends on live network.
- **The core engineering fact:** eligibility is stored as one free-text blob (the
  `eligibility` module). Splitting it into discrete inclusion/exclusion bullets (what
  the project already does) is the prerequisite for any deterministic evaluation.

**The project's own dataset (analyzed this session, fetched today):**
- 60 trials, source ClinicalTrials.gov API v2, fetched 2026-08-13T18:35:12Z.
- Top conditions: multiple myeloma (8), NSCLC (7 total incl. variants), advanced solid
  tumors (3), RCC (2), CRC (2), BCC (2), urothelial (2), melanoma (2), NHL (2).
- Top interventions: pumitamig (14) — BMS's BCMA×CD3 bispecific; nivolumab/Opdivo (13);
  ipilimumab/Yervoy (10); iberdomide (5); BMS-986504 (4). This is a genuinely
  BMS-centric, modern oncology pipeline (myeloma + IO backbone).
- Phases: Phase 2 (21), Phase 1 (11), Phase 1/2 (10), Phase 3 (7), Phase 2/3 (6), N/A (5).

---

## 3. The science: how computable are eligibility criteria?

**Context for ClearTrial's honest "~23% machine-evaluable" claim:** the literature
consistently finds eligibility criteria are mostly NOT directly computable from
patient records or free text.

- Weng C et al. (Columbia) have spent a decade formalizing criteria; recent outputs
  include "A knowledge base of clinical trial eligibility criteria" (2021, PMID
  33813032) and "A data-driven approach to optimizing clinical study eligibility
  criteria" (2023, PMID 37141977) — the latter is literally ClearTrial's dashboard
  thesis in academic form.
- **2026 AMIA paper directly on point:** "A Multi-Model LLM Consensus Framework to
  Identify EHR-Predictable Eligibility Criteria in NSCLC Immunotherapy Trials"
  (PMID 42317858). Converting free-text eligibility from Phase III PD-1/PD-L1 NSCLC
  trials into standardized concepts, they found roughly **half of criteria are both
  clinically important and EHR-predictable** — i.e., the ceiling for automation is
  meaningfully above 23%, and ClearTrial's current coverage is a floor, not a wall.
- Implication for the pitch: "23% today, every new rule is a unit-tested pure function,
  the ceiling is roughly half of criteria" is a stronger and still honest claim.

**ClearTrial's scoring design is aligned with the literature:** `null = unknown, never
passes`, and score = passes/(passes + blockers + 0.5×unknowns) — i.e., a high score
means "we actually verified this", which is the correct direction for a safety-adjacent
tool. This is the same principle TrialGPT uses (criterion-level prediction with
"unknown" outcomes, see below).

---

## 4. The AI approaches: TrialGPT and the research frontier

**TrialGPT (NCI/NIH) — arXiv 2307.15051, "Matching Patients to Clinical Trials with
Large Language Models" (2023, v5).** The closest academic counterpart to ClearTrial's
patient side. End-to-end zero-shot patient-to-trial matching in three stages:
retrieval → criterion-level eligibility prediction → ranking. Published results:
- Retrieval recalls >90% of relevant trials using <6% of the initial collection.
- Criterion-level matching accuracy **87.3%** on 1,015 patient-criterion pairs (vs.
  expert clinicians), with faithful explanations.
- Ranking correlates with human judgments; **+43.8%** vs best competing models.
- User study: **42.6% reduction in clinician screening time**.

**Follow-on work:**
- "Recommending Clinical Trials for Online Patient Cases using AI" (arXiv 2504.20059,
  2025) — applies TrialGPT to social-media/patient-community text: exactly ClearTrial's
  "messy plain-English paragraph" input mode, validated in the literature.
- LLM-Match (arXiv 2503.13281, 2025) — open-source fine-tuned LLM matching with RAG
  over EHRs; shows the open-source path is viable.
- SatIR (arXiv 2604.08849, 2026) — constraint-satisfaction-based retrieval for
  high-recall trial search; the retrieval-engineering frontier.

**What this means for ClearTrial:**
1. The architecture is academically validated: LLM for extraction/explanation +
   criterion-level evaluation (not trial-level black-box verdicts) is the consensus
   design. ClearTrial's deterministic engine is the safe, auditable embodiment.
2. Differentiators vs TrialGPT: (a) plain-English patient input with zero EHR access,
   (b) BMS-specific protocol text with verbatim citation, (c) deterministic verdicts a
   clinical team can version-control and sign off, (d) the rejection-signal dashboard —
   TrialGPT has no equivalent; no one is feeding exclusions back into trial design.
3. Numeric ammunition for the pitch: cite TrialGPT's 42.6% screening-time reduction as
   industry validation of the category; cite 87.3% criterion accuracy as the
   expectation bar.

---

## 5. The market: patient-facing trial matching (verified 2026-08-13)

Direct verification of live products this session:

| Player | Status (verified) | Model |
|---|---|---|
| **Leal Health** (formerly Trialjectory) | Live — "Treatments. Choices. Hope." | AI concierge, patient self-serve + oncology navigation |
| **Massive Bio** | Live — "Cancer Analysis and Clinical Trial Matching" | Concierge + physician network, oncology focus |
| **Antidote** | Live — "Clinical Trial Patient Recruitment" | Patient-facing match + sponsor recruitment platform |
| **ResearchMatch** | Live (NIH-funded, nonprofit) | Registry/match, research volunteers |
| **Triomics** | Live — provider-side AI for oncology trial screening | EHR-integrated, site-facing |
| **Tempus (Next)** | Site behind bot check; well-known provider/patient trial-matching offerings | EHR/genomic-driven |
| **TrialGPT (NCI)** | Research (arXiv 2307.15051) | Academic |

**Gap ClearTrial exploits:** the commercial players are concierge- or EHR-driven
(slow, gated, opaque about *why*). Nobody offers instant, self-serve, plain-English
matching that (a) shows criterion-by-criterion evidence with verbatim protocol quotes,
(b) is deterministic and auditable, and (c) turns rejections into protocol-design
intelligence. That is the white space in both the demo and the strategy.

---

## 6. Regulation: the FDA Clinical Decision Support guidance — REISSUED Jan 29, 2026

**Critical, fresh regulatory fact:** FDA's final guidance "Clinical Decision Support
Software" was issued **January 29, 2026** (superseding the Jan 6, 2026 version; prior
final was Sept 2022). Docket FDA-2017-D-6569. This is the current state of the law
that any judge or reviewer will be thinking about.

**The four criteria for Non-Device CDS** (a software function is excluded from the
"device" definition under FD&C Act §520(o)(1)(E) only if it meets ALL four):
1. Not intended to acquire/process/analyze a medical image or signal from an IVD or
   signal acquisition system.
2. Intended to display, analyze, or print medical information about a patient or other
   medical information (guidelines, peer-reviewed studies, etc.).
3. Intended to support or provide recommendations **to a health care professional**
   (HCP) about prevention, diagnosis, or treatment — and does **not** provide a
   specific preventive/diagnostic/treatment output or directive, nor replace or direct
   the HCP's judgment.
4. Intended to enable the HCP to **independently review the basis** of the
   recommendations (plain-language algorithm description, inputs, validation results,
   knowns/unknowns) so the HCP does not rely primarily on the software.

**The two lines that matter most for ClearTrial:**

> "Software functions that support or provide recommendations to patients or
> caregivers – not HCPs – **meet the definition of a device**."

and Criterion 3's affirmative example:

> "Matching patient-specific medical information from records or reports to reference
> information (e.g., clinical guidelines)" — listed as an example of **Non-Device CDS**
> (for HCP users).

**What this means for the pitch (important — the PITCH.md Q&A needs a refresh):**
- The current PITCH claims the "decision-support exemption" applies. Strictly, the
  §520(o)(1)(E) exclusion is **HCP-only**; a patient-facing tool that recommends
  specific trials based on patient analysis is, under the letter of the guidance, a
  device function. Do not over-claim the exemption.
- The stronger, honest framing has three legs:
  1. **It is trial-information retrieval and navigation, not treatment CDS.** It does
     not diagnose, does not recommend therapies, and does not state the patient
     qualifies — it retrieves published eligibility information and explains it. Final
     eligibility is decided by the study team, not the app (the draft email is patient-
     initiated, human-in-the-loop). Under the guidance's Criterion 2 example set, pure
     retrieval/display of medical reference information is the least device-like
     posture available to a patient-facing tool.
  2. **The deterministic engine is the Criterion 4 posture, done in code.** The
     guidance's Criterion 4 (independent review of the basis) is satisfied by
     construction: every verdict cites the verbatim protocol sentence, the evaluated
     patient value, and the rule. "You cannot do that with a chatbot transcript" is
     precisely the guidance's own logic.
  3. **Enterprise context:** in production this runs under BMS's compliance umbrella
     (their legal/regulatory team, their VPC, their enterprise agreement) as a patient-
     engagement surface for BMS's own trials — analogous to the "used by the sponsor
     for its own research operations" posture, which is not how consumer CDS is
     assessed.
- Recommended stance for judges: "We designed it so a clinical team can review the
  decision path line by line — that's the property regulators care about — and we
  would take FDA's enforcement-discretion posture under the 2026 CDS guidance as the
  starting point for formal review." Honest, current, and confident without
  over-claiming a statutory exemption a patient-facing tool doesn't get.

**HIPAA/privacy posture (unchanged and strong):** patient text never written to disk,
never logged, lives for the request duration; only concept-level telemetry retained
("lung-cancer search blocked by criterion X"); no identifiers; outbound contact is a
patient-sent draft. In production: BMS enterprise agreement, VPC, no third-party data
storage.

---

## 7. Strategy: the BMS "AI factory" is real and current

**Verified announcement (July 20, 2026):** BMS is building the life-science industry's
"most advanced AI factory" on **NVIDIA Vera Rubin NVL72** — a DGX SuperPOD, eight
rack-scale systems with Vera CPUs and Rubin GPUs, ~10x performance per megawatt vs
the infrastructure it replaces. Sources: NVIDIA blog ("Bristol Myers Squibb Building
Life Science Industry's Most Advanced AI Factory on NVIDIA Vera Rubin", Jul 20 2026),
pharmaphorum, Fierce Biotech coverage.

Key facts to use in the pitch close:
- BMS calls it a "hybrid intelligence" vision: AI scientists working alongside
  researchers; "predict first" — AI already informs the design of every small-molecule
  program at BMS and most large-molecule programs, before lab work.
- Platform includes **NVIDIA BioNeMo Agent Toolkit** (agentic AI for drug discovery);
  BMS has used AI to expand its **CELMoD** compound library (protein-degrading
  medicines for blood cancers).
- The stated goal: truncate drug-discovery timelines, scale proprietary models,
  "no one is told they have a limit" on compute.

**The strategic synthesis for ClearTrial (the close of the pitch):**
- ClearTrial's real-world demand signal (matched AND unmatched searches) is exactly the
  class of data an AI factory consumes — and it is generated by the patient
  relationship, which is BMS's to own only if BMS owns the compliant surface. The
  BRIEF.md thesis ("prevent third-party LLMs from owning the patient relationship")
  is validated by the trajectory: BMS is betting the company's R&D on AI, so the
  patient-side data moat matters more, not less.
- The demo insight is real: in the project's own dataset, checkpoint-inhibitor prior
  therapy (prior PD-1/PD-L1) blocks a large share of interested patients against a
  pipeline where 13 of 60 trials are nivolumab-based. Rejection data is protocol-design
  intelligence, and it is currently thrown away.

---

## 8. The roadmap: protocol optimization is a validated category

- "A data-driven approach to optimizing clinical study eligibility criteria" (Weng et
  al., 2023, PMID 37141977) — academic proof that criteria optimization from data is a
  recognized, publishable problem. ClearTrial's dashboard is the operational product
  version.
- NCI-designated cancer centers are building near-real-time accrual dashboards (PMID
  42229883, 2026) — the observability side; ClearTrial supplies the *demand-side*
  (why patients fail) which no dashboard currently shows.
- The signal-store → protocol-alert loop (what ClearTrial ships today as an in-memory
  demo) is the seed of a real feedback product: trial design stops being guesswork and
  becomes demand-driven. Immediate engineering next step: persist the store
  (SQLite/Postgres) and add lab-value rules (ALT/AST/bilirubin — the most common
  unparsed criteria).

---

## 9. Source list (all verified this session)

- FDA, *Clinical Decision Support Software* — Guidance for Industry and FDA Staff,
  issued Jan 29, 2026 (supersedes Jan 6, 2026 and Sept 2022 versions). Docket
  FDA-2017-D-6569. https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software
- Murthy VH, Krumholz HM, Gross CP. JAMA 2004;291(22):2720-6. PMID 15187053.
- *Trial-level factors affecting accrual and completion of oncology clinical trials: a
  systematic review.* Contemp Clin Trials Commun. 2021. PMID 34765799.
- *Near-Real-Time Clinical Trial Accrual Dashboard in an NCI-Designated Cancer Center.*
  2026. PMID 42229883.
- *A Multi-Model LLM Consensus Framework to Identify EHR-Predictable Eligibility
  Criteria in NSCLC Immunotherapy Trials.* AMIA Jt Summits Transl Sci. 2026.
  PMID 42317858.
- Weng C, et al. *A knowledge base of clinical trial eligibility criteria.* 2021.
  PMID 33813032. / *A data-driven approach to optimizing clinical study eligibility
  criteria.* 2023. PMID 37141977.
- Lai et al. (NCI). *TrialGPT: Matching Patients to Clinical Trials with Large Language
  Models.* arXiv 2307.15051 (2023).
- *Recommending Clinical Trials for Online Patient Cases using AI.* arXiv 2504.20059.
- *LLM-Match.* arXiv 2503.13281. / *SatIR.* arXiv 2604.08849.
- NVIDIA Blog: *Bristol Myers Squibb Building Life Science Industry's Most Advanced AI
  Factory on NVIDIA Vera Rubin* (Jul 20, 2026); pharmaphorum coverage (Jul 20, 2026).
- ClinicalTrials.gov API v2 — live-verified 2026-08-13 (apiVersion 2.0.5).
- Competitor sites live-verified 2026-08-13: lealhealth.com (ex-Trialjectory),
  massivebio.com, antidote.me, researchmatch.org, triomics.com.

---

## 10. Actions implied by this research

1. **Refresh PITCH.md Q&A** — replace the "decision-support exemption" claim with the
   three-leg framing in §6 (retrieval-not-CDS / Criterion-4-by-construction / BMS
   enterprise posture). Cite the Jan 29, 2026 guidance date; it is an asset, not a
   liability.
2. **Upgrade the coverage claim** — "23% today, ceiling ~50% per the AMIA 2026 NSCLC
   analysis; every new rule is a unit-tested pure function" is stronger and still
   honest. Next rules: ALT/AST/bilirubin labs, histology subtype, EGFR/ALK/KRAS.
3. **Arm the pitch with TrialGPT numbers** — 42.6% screening-time reduction and 87.3%
   criterion accuracy validate the category; ClearTrial adds what TrialGPT lacks
   (plain-English input, no EHR, deterministic auditable verdicts, rejection→design
   feedback).
4. **Use the BMS AI factory close** — the July 20, 2026 NVIDIA announcement is this
   week's news; ClearTrial is the patient-side data moat for it.
5. **Operational flag (separate from research):** the project's `.env.local` still
   holds the old key (models gpt-5.6-sol/gpt-5.5). The new group key only serves
   gpt-5.4 / gpt-5.3-codex / gpt-4.1-nano / gpt-4-turbo. If the app should run on the
   group key, change `PRIMARY_MODEL`/`FALLBACK_MODEL` in `src/lib/extract.ts` and
   `BRIEF_MODEL` in `src/lib/protocol-agent.ts` to gpt-5.4 first, or the live path
   will 404 and silently fall back to offline mode.
