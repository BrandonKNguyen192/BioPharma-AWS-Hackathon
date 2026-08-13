# BioPharma AWS Hackathon

ClearTrial is a hackathon-built clinical trial intelligence app for oncology.
It helps patients understand which active trials may fit their case and helps
research teams see which protocol criteria are blocking recruitment.

Current state and open items: **[STATUS.md](STATUS.md)**.

See **[OVERVIEW.md](OVERVIEW.md)** for the full write-up: what it does, how
it works, and the commercial case.

## What it does

- Accepts a plain-English patient cancer or illness history
- Extracts structured clinical facts with OpenAI
- Matches the extracted profile against real published trial criteria
- Explains why each trial matched, failed, or needs clinician review
- Aggregates exclusion reasons into a sponsor-facing dashboard

## Technical architecture

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Extraction:** OpenAI structured output
- **Decision engine:** deterministic TypeScript matcher
- **Trial data:** ClinicalTrials.gov recruiting oncology studies, sponsor-agnostic
  (set `TRIAL_SPONSOR` to narrow to one sponsor)
- **Research workflow:** AWS Strands agent for protocol summaries
- **Optional ingestion transport:** Bright Data Web Unlocker

## Sponsor stack

| Tool | How it is used | Where |
|---|---|---|
| **OpenAI** | Structured clinical-fact extraction (strict JSON schema) and explanatory prose | `src/lib/extract.ts` |
| **AWS — Strands Agents SDK** | Researcher-side analyst agent with two real tools over the de-identified exclusion signal | `src/lib/protocol-agent.ts` |
| **Bright Data** | Web Unlocker transport for the trial ingestion pipeline; falls back to the public ClinicalTrials.gov API | `scripts/fetch-trials.mjs` |
| **Convoke** | No public API exists, so rather than fake a call the dashboard exports the artifact their platform would ingest: a versioned decision record with verbatim criteria and provenance | `src/app/components/ConvokeExport.tsx` |
| **HackerSquad** | Developer feedback submitted for the tools used | — |

## Design principle

The language model does **not** decide eligibility.

AI is used to extract facts from messy text and generate explanatory prose.
The actual pass, fail, and unknown decisions are made by deterministic
TypeScript against published trial criteria.

## Getting started

Install dependencies:

```bash
pnpm install
```

Run the app:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

## Environment

Create a local `.env.local` with:

```bash
OPENAI_API_KEY=your_openai_key
BRIGHTDATA_API_KEY=optional_brightdata_key
BRIGHTDATA_ZONE=web_unlocker1
```

Bright Data is optional. If it is not configured, the trial ingestion script
falls back to the public ClinicalTrials.gov API. It can also be used later to
collect publicly available sponsor press releases and reports for clinical trial
announcements and possible IND-related signals.

## Data refresh

Refresh the local trial dataset:

```bash
node scripts/fetch-trials.mjs
```

The app reads a committed JSON snapshot under `src/data/trials.json` so the
demo does not depend on live network calls at runtime.
