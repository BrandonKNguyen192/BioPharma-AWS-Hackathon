# ClearTrial — What it does, how, and why it matters

## The problem

Two failures, one root cause.

A patient with advanced cancer who wants a clinical trial is handed
ClinicalTrials.gov: hundreds of studies whose eligibility is written for
regulators, not people. *"ECOG performance status of 0 or 1."* *"No prior
systemic antitumor therapy for the current NSCLC diagnosis."* Most give up.

Meanwhile the trials themselves run under-enrolled, and sponsors discover which
eligibility criteria were too strict only after enrollment has already slipped.

Both sides lose because the same document is unreadable to the person it
decides about, and because the reasons people fall out are never recorded.

## What it does

**Patient side.** Someone describes their situation in ordinary language — no
medical terms. ClearTrial returns the trials they may qualify for, and for each
one says exactly *why*: which requirement they met, which ruled them out, and
which still needs a doctor. One click drafts an email to the study team that
the patient reviews and sends themselves.

**Researcher side.** Every rejection is kept — anonymously, as a rule name and a
count, never as text. Aggregated, that becomes a ranked answer to a question
sponsors currently cannot answer: *which sentence in our protocol is costing us
the most patients?*

## How it works

```
patient's own words
   ↓  OpenAI, strict JSON schema, told never to infer
structured profile      (unstated facts come back null)
   ↓  deterministic TypeScript against published criteria
verdict per criterion   (pass / fail / unknown — replayable)
   ↓
trial cards + near misses  →  anonymized signal  →  protocol dashboard
```

**The load-bearing decision: the model never decides eligibility.** It does two
jobs — read messy text, and explain a result. Every pass, fail, and unknown is
produced by plain TypeScript running against the trial's published criteria.

That is not a stylistic preference. It is what makes the system:

- **Auditable** — the matching logic is a file a clinical team can read,
  version, and sign off, criterion by criterion.
- **Replayable** — the same input always produces the same verdict, so a
  decision can be reproduced months later.
- **Testable** — each rule is a pure function with unit tests. Two real bugs
  found during the build (a negation inversion that read *"no brain mets"* as
  positive, and a substring match that recommended leukemia trials to lung
  patients) are now permanent regression tests.
- **Safe in one direction** — anything unstated is `unknown`, never `pass`. A
  bad extraction produces *"your doctor needs to confirm this"*, never a false
  match.

**Honesty about coverage.** About 27% of published criteria lines are
machine-evaluable today — a median of 3 per trial. The rest are shown on the
card as *"other requirements your doctor will need to read"*, with the verbatim
text. Every card shows two numbers, never one: **fit** (of what we could check,
how much you met) and **coverage** (how much we could check at all). A trial
where a single requirement was verified is structurally incapable of presenting
as a confident match.

**Real data.** Sixty currently-recruiting oncology trials pulled from
ClinicalTrials.gov, with eligibility criteria quoted verbatim. Ingestion runs
once and commits its output, so a demo never depends on a live network call.

**Degrades instead of breaking.** With no API key, or a failed call, a local
deterministic extractor takes over and the product still works.

## Why it matters commercially

**1. The patient relationship is being taken.** General-purpose AI already
answers these questions, with no auditability, no protocol grounding, and no
accountability for a wrong answer. A sponsor-owned tool that can *show its
work* is the version a regulated business can actually stand behind — and
whoever holds that conversation holds recruitment.

**2. Rejections are the asset, not the waste.** Today a patient who doesn't
qualify simply disappears. Here, that rejection becomes a de-identified signal
attached to a specific sentence in a specific protocol. Which criterion cost the
most patients this month is a question sponsors currently answer at the end of
enrollment, if at all — this answers it continuously.

**3. Recruitment is the expensive part.** Trial delays are measured in months of
lost exclusivity. A criterion that could be safely widened, spotted early, is
worth more than any efficiency gained downstream.

**4. It is buildable inside a regulated environment.** No patient text is
stored or logged. Only concept-level counts persist. The decision path is a
readable file rather than a model's internal state, which is what makes review
tractable rather than theoretical.

## What this is not

An eligibility pre-screen, not medical advice and not a diagnosis. A study team
makes the final determination. Patient demand shown in the dashboard is a
simulated pilot cohort, labelled as such in the interface — the trials and their
criteria are real.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · OpenAI (extraction, strict
JSON schema) · AWS Strands Agents SDK (researcher-side analyst brief) · Bright
Data (ingestion transport, with a public-API fallback) · ClinicalTrials.gov API
v2 (trial data).
