# ClearTrial — Implementation Handoff (for Codex / coding agents)

Compiled Aug 13, 2026, Biopharma Hack Day @ AWS Builder Loft. Target client: BMS.
This file is the implementation brief. Read it first, then the referenced docs.
It is fully self-contained: everything below was verified against the actual code
and live data on 2026-08-13.

---

## 0. Orientation

- App: ClearTrial — two-sided clinical-trial matching. Patients describe cancer
  history in plain English → extracted profile → matched against REAL published
  eligibility criteria from 60 recruiting BMS oncology trials (committed dataset)
  → ranked trial cards with per-criterion explanations + one-click email draft.
  Rejections aggregate anonymously into a researcher dashboard (protocol
  optimization signals).
- Repo: `/Users/brandonnguyen/projects/biopharma-hack`
- Stack: Next.js 16.3 (App Router, Turbopack), React 19, TypeScript, Tailwind v4,
  lucide-react, openai 7.4.0, @strands-agents/sdk 1.13.0, zod 4.4.3, pnpm.
- Run: `pnpm dev` → http://localhost:3002 (3000 was occupied). `pnpm build` and
  `npx tsc --noEmit` are both clean.
- Reading order: `README.md` → `BRIEF.md` → `HANDOFF.md` (contains a live key;
  gitignored — never commit it) → `PITCH.md` → `RESEARCH.md`, `RESEARCH2.md`,
  `RESEARCH3.md` (research backing this brief) → this file. `PLAN.md` is STALE
  (written against an earlier brief; references Anthropic and a liver-enzyme story
  that no longer applies) — do not follow it.

## 1. THE INVARIANT — never violate, everything depends on it

> **The language model NEVER decides eligibility.** It does exactly two jobs:
> (1) extract structured facts from free text (`src/lib/extract.ts`), and
> (2) write explanatory prose after a verdict exists. Every pass/fail/unknown
> verdict comes from deterministic TypeScript in `src/lib/match.ts` against
> published protocol text. A criterion the engine can't confidently parse is
> `unknown` and surfaces as an open question — never silently treated as a pass.

Corollaries:
- Do NOT move matching into the model, add LLM verdicts, or let any agent
  (including future sub-agents) write `MatchResult` verdicts.
- Do NOT make trial data a live fetch at demo time — `src/data/trials.json` is a
  committed build artifact on purpose (podium wifi cannot break the demo).
- Do NOT store patient text — it must never be written to disk or logged.
- Never hand-edit `~/.hermes/config.yaml`-style config; this repo has no such
  constraint, but `.env.local` edits are fine (it is gitignored).

## 2. Environment facts (verified 2026-08-13)

- `.env.local` has `OPENAI_API_KEY` (OLD hackathon key; can serve gpt-5.6-sol,
  gpt-5.6-luna, gpt-5.6-terra, gpt-5.5, gpt-5.4, gpt-5.3-codex, gpt-5-codex) and
  `BRIGHTDATA_API_KEY` (set, but the account's zone `web_unlocker1` returns
  407/422 "Customer has invalid status" → the fetch script falls back to the
  public ClinicalTrials.gov API v2, which needs no key — expected and fine).
- `src/lib/extract.ts`: `PRIMARY_MODEL = "gpt-5.6-sol"`, `FALLBACK_MODEL =
  "gpt-5.5"`; `src/lib/protocol-agent.ts`: `BRIEF_MODEL = "gpt-5.6-sol"`.
- A NEW group key exists (host-provided, ~$2000 pooled, models may change during
  the day). It can ONLY serve: gpt-5.4, gpt-5.3-codex, gpt-4.1-nano, gpt-4-turbo.
  **Decision needed before touching model code:** if the app should run on the new
  key, change the three model constants above to gpt-5.4 (and fallback gpt-5.3-
  codex) — otherwise live extraction 404s and silently falls back to offline mode
  (which still works; badge reads "offline mode"). If the old key stays, change
  nothing. Confirm with the user before switching.
- Pipeline scripts: `scripts/fetch-trials.mjs` (CT.gov API v2 → trials.json),
  `scripts/measure-coverage.mjs`, `scripts/test-negation.mjs`,
  `scripts/test-condition-gate.mjs` (regression tests — keep passing).
- ClinicalTrials.gov API v2 verified live: `apiVersion 2.0.5`, no key required.

---

## 3. TASK A — Score honesty + evidence-gated verdicts (HIGH PRIORITY)

**Problem (user-verified):** score = passes/(passes+blockers+0.5×unknowns) where
`unknowns` only counts *decidable* criteria — `unparsed` criteria are excluded from
the denominator entirely (`decidable = evaluated.filter(c => c.kind !== "unparsed")`
in `matchTrial()`). So a trial with 1 decidable passing criterion and 23 unparsed
criteria scores 100. `TrialCard.tsx` renders that number under the literal label
"confidence", and unparsed criteria never appear anywhere in the UI — the patient
cannot see that 23 of 24 requirements were never checked.

**Fix (deterministic, small, testable):**

1. `src/lib/types.ts` — extend `MatchResult`:
   - `fit: number` — 0-100 = passes / (passes + blockers), the "of the criteria we
     could check, you met this share".
   - `coverage: { decidable: number; total: number }` — checked N of M.
2. `src/lib/match.ts` — `matchTrial()`:
   - Compute `fit` and `coverage` as above (total = evaluated.length; decidable =
     evaluated.filter(kind !== "unparsed").length).
   - Evidence-gate verdicts (keep existing order, add volume gates):
     - `!onCondition` → `excluded` (unchanged)
     - `blockers.length > 0` → `excluded` (unchanged)
     - `openQuestions.length > passes.length` → `needs_review` (unchanged)
     - `passes.length >= 2 AND decidable.length >= 3` → `eligible` (NEW gate)
     - `passes.length >= 1 AND decidable.length >= 1` → `likely` (NEW gate)
     - else → `needs_review`
     - Net effect: a 1-criterion trial can never render above `likely`; a trial
       where we checked 1 of 24 criteria cannot be `eligible`.
   - Keep the scalar `score` for RANKING ONLY (relative order unchanged).
3. `src/app/components/TrialCard.tsx`:
   - Replace the bare number + "confidence" label with: `Fit {fit}%` plus a
     coverage line: `checked {coverage.decidable} of {coverage.total} criteria`.
   - Add a section (collapsible or inline): "Other requirements your doctor will
     confirm — {N} items" listing up to two verbatim `unparsed` sources
     (`evaluated` entries with kind === "unparsed", use `source` field).
   - Verdict badges unchanged.
4. Regression tests — `scripts/test-scoring.mjs` (follow the style of
   `test-negation.mjs`):
   - (1 pass, 0 unparsed, 0 unknown) → verdict NOT eligible; fit 100; coverage 1/1.
   - (1 pass, 23 unparsed) → verdict NOT eligible; fit 100; coverage 1/24.
   - (2 pass, 2 unknown decidable, 1 unparsed) → eligible (decidable=4 ≥ 3, no
     blockers, openQuestions(2) ≤ passes(2)).
   - (1 pass, 1 fail) → excluded regardless of score.
   - assert `coverage.total` equals evaluated.length in all cases.

**Rationale (cite if asked):** medical-AI uncertainty communication (arXiv
2509.18132), GRADE certainty framing, Wilson small-sample logic (Brown/Cai/
DasGupta 2001). See RESEARCH3.md §1.

---

## 4. TASK B — Near-miss exclusions: make the demo pivot visible (HIGH PRIORITY)

**Problem (user-verified):** the pitch says "notice she was ruled out of other
studies" but the patient side shows nothing. Root causes in code:
- `matchAll()` sets `pool = onCondition` trials only (off-condition dropped);
- within the pool, `excluded` sorts last and `route.ts` returns
  `results.slice(0, 12)` — excluded trials can fall off the cut;
- `page.tsx` renders the "Why other studies ruled you out" section ONLY if
  `excluded.length > 0` (line ~165), and with the current dataset + demo profile
  almost nothing evaluates to `excluded` because the blocking lines ("No prior
  systemic antitumor therapy", "Prior treatments including: Systemic anti-tumor
  therapy") are all `unparsed`. The demo narrative has no on-screen evidence even
  when the API behaves. (Task C is what makes exclusions actually fire.)

**Fix:**

1. `src/lib/match.ts` — export `closestMisses(results: MatchResult[], n = 3)`:
   filter `verdict === "excluded"`, sort by (fewest blockers asc, most passes desc,
   highest score desc), slice n. This is "near-miss" ranking — trials the patient
   almost fit.
2. `src/lib/types.ts` — add `nearMisses: MatchResult[]` to `MatchResponse`.
3. `src/app/api/match/route.ts` — set `nearMisses: closestMisses(results)` — never
   cut by the top-12 slice.
4. `src/app/page.tsx` — render the section whenever `nearMisses.length > 0`
   (remove the `excluded.length > 0` dependency). Each near-miss card:
   - trial title + NCT + phase,
   - the ONE blocking criterion verbatim (`blockers[0].source` — published
     protocol text),
   - the patient's value vs the requirement (`blockers[0].detail` — code-
     generated),
   - a code-generated "what would change" line (e.g., for a prior-checkpoint
     blocker: "This study requires prior immunotherapy — confirm with your
     oncologist whether your history qualifies."). No LLM involvement; a small
     template per RuleKind is fine.
5. Regression: `scripts/test-scoring.mjs` — build
   results with 2 excluded + 3 eligible; assert nearMisses returns the 2 excluded
   ordered by closeness, and that a response with zero excluded returns [].
6. Stretch (Task F): a "what if" toggle per near-miss card that re-runs
   `matchTrial()` with a modified profile and flips the verdict — instant,
   replayable, deterministic. This is the demo's strongest moment.

**Rationale:** contrastive explanations (Miller 2019), near-miss explanations
(arXiv 2308.14163). See RESEARCH3.md §2.

---

## 5. TASK C — New rules so exclusions actually fire (HIGH PRIORITY, prerequisite for B)

The dataset's most common blocker patterns are currently `unparsed`. Add two rule
kinds to make the demo truthful AND raise coverage past 23%:

1. `src/lib/types.ts` — add `"prior_any_therapy"` and `"biomarker"` to `RuleKind`
   and `SIGNAL_LABELS` equivalents in `match.ts`.
2. `src/lib/match.ts` — `classify()` additions (ORDER MATTERS — negation-aware;
   remember the shipped "no brain mets" bug: negation patterns must be tested
   before positive patterns):
   - `prior_any_therapy` — matches lines demanding therapy-naivety or prior
     therapy, with `RE.priorTherapyContext` present:
     - naive requirements (inclusion): /(no prior (?:systemic )?(?:therapy|treatment|anti[- ]tumor|anti[- ]cancer)|treatment[- ]na(?:i|ï)ve|no history of (?:systemic )?anticancer therapy|not received any prior systemic)/i
     - prior requirements (inclusion): /(has received (?:appropriate )?(?:first[- ]line )?standard of care|must have had at least|received at least \d+ prior)/i
     - exclusion lines: /(prior treatments including|any prior systemic|prior (?:chemotherapy|immunotherapy|targeted therapy) for (?:lung cancer|nsclc)|prior anti[- ]?tumou?r)/i
   - `biomarker` — /(egfr|alk|kras|ros1|braf|met exon|ntrk|ret fusion|her2|mutation|molecular|biomarker|g12c)/i (must ALSO check it's not merely "no known mutations" — see pitfalls).
3. `evaluate()` implementations:
   - `prior_any_therapy`: decide from `p.priorTherapies.length > 0` (or
     priorTherapyClasses non-empty). If the line demands naivety (inclusion) →
     pass iff no prior therapy, fail otherwise (detail: quote the requirement and
     the patient's history). If the line demands prior therapy (inclusion) → pass
     iff prior therapy exists. On exclusion side, apply `flip()` (had therapy →
     ruled out). Unknown only if profile has no therapy info at all.
   - `biomarker`: if the line names specific biomarkers (KRAS G12C, EGFR exon 19,
     ALK) and the patient's `biomarkers[]` states one → pass iff it matches;
     patient biomarker unstated → UNKNOWN ("your doctor must confirm your tumor's
     marker status"), never fail. Negation guard: lines like "no EGFR/ALK
     alterations" are about absence — treat as unknown unless the patient stated
     the marker (safer).
4. New regression tests in `scripts/test-matcher.mts`:
   - "No prior systemic antitumor therapy for the current NSCLC diagnosis" on a
     profile WITH prior therapy → fail (not pass, not unknown).
   - "Prior treatments including: Systemic anti-tumor therapy for
     advanced/metastatic NSCLC" on exclusion side with prior therapy → ruled out.
   - KRAS G12C trial line vs patient with KRAS G12C → pass; vs patient with no
     biomarker stated → unknown.
   - Boundary safety: "no prior PD-(L)1" must not trigger prior_any_therapy's
     naive branch as a pass for someone who HAS had checkpoint (check
     prior_checkpoint_inhibitor fires first — keep classify() order:
     ecog, pdl1, brain_mets, prior_lines, prior_platinum, prior_checkpoint,
     prior_any_therapy, biomarker, stage, measurable, age, unparsed).
5. Optional stretch: lab-value rules (ALT/AST/bilirubin) — most common remaining
   unparsed class; each is a pure function + test.

**Expected demo effect:** with prior_any_therapy + biomarker, the anchor story
(Daniel: prior carboplatin+pemetrexed, no checkpoint) gets excluded from several
NSCLC trials on screen (naive-required trials), and the KRAS story (Frank) lands in
near-misses against the two first-line-only KRAS G12C trials — the dashboard signal
becomes visible on the patient side.

---

## 6. TASK D — Wire the 5 demo stories (EASY, HIGH DEMO VALUE)

- `src/data/demo-stories.json` already exists: 5 stories (Daniel 58 anchor; Marta
  64 post-IO; Frank 62 KRAS; Margaret→Henry 71 fragile low-PD-L1; Carol→Jack 67
  SCLC). See `src/data/demo-stories.md` for per-story profile + demo-dynamic notes.
- Wire into the patient portal: replace the single "Use the example story" button
  with a selector (5 options, anchor preselected) that fills the textarea from
  demo-stories.json. Import the JSON (it is committed, so no fetch).
- Verify each story's extraction + verdicts against the live engine after Task C
  (expectations are documented in demo-stories.md; in particular Marta should
  exercise the treated-brain-mets nuance and Carol should be gated away from NSCLC
  trials by the condition gate).

---

## 7. TASK E — Trial Radar: announced-before-registry intelligence (BUILT)

**Why:** INDs are confidential (21 CFR 312.130 — FDA does not publish IND numbers).
CT.gov registration is required within 21 days of first enrollment (FDAAA §801), so
company press releases / SEC filings are the EARLIEST public signal a trial exists.

**Built and verified 2026-08-13 (real data, committed):**
- `scripts/collect-announcements.mjs` — collects discovery candidates from SEC EDGAR full-text search
  (requires declared UA, e.g. `ClearTrialHackathon cleartrial@hackathon.demo`;
  `dateRange=custom&startdt=...&enddt=...` for recency) and GDELT DOC API (≥5s
  throttle; 429s under burst — retry with backoff). Drug-anchored queries per
  asset owner (nivolumab/Opdivo/pumitamig/iberdomide → BMS; elranatamab/palbociclib/
  sunitinib → Pfizer; pembrolizumab/Keytruda → Merck; atezolizumab/Tecentriq/
  bevacizumab → Roche; durvalumab/Imfinzi/olaparib → AZ). Raw → `tmp/radar/`.
- `scripts/collect-reviewed-sources.mjs` — separately fetches the small set of
  primary sponsor/partner pages used to curate `pipeline-radar-reviewed.json`.
  Direct fetch is preferred; Bright Data is an optional transport fallback only.
- `scripts/build-pipeline-signals.mjs` — deterministic extraction (no LLM): fetches
  the filing's primary document (excludes XBRL R*.htm), clips an evidence passage
  around the most load-bearing mention (IND statement > drug > trial/phase),
  classifies milestone (ind_clearance/trial_initiation/enrollment/data_readout/
  regulatory/partnership), extracts phase/indication/drug, and emits:
  - `src/data/trial-registry-meta.json` — CT.gov first-posted dates + lead sponsors
    + sponsor-internal trial IDs for all 60 monitored trials (verified field:
    `statusModule.studyFirstPostDateStruct.date`; comma-joined `query.id` works).
  - `src/data/pipeline-signals.json` — 60 automatic discovery candidates in the
    current snapshot, with source excerpts for review.
  - `src/data/pipeline-radar.json` — the same unreviewed candidates in the radar
    schema. Asset-name joins are `probable`, never `exact`, and every automatic
    record is `discovery_only` until a person validates the source, indication,
    phase, sponsor, and registry relationship.
- **Attribution rule:** the radar groups by the DRUG's owner, not the filer — a C4
  Therapeutics 8-K mentioning palbociclib is a Pfizer-asset signal. Dedupe by source
  URL (the same filing is collected under several sponsor queries).
- **The four demo stories are supported at different evidence levels:**
  1. Announcement before registry — 2 manually reviewed records have an event
     date earlier than the matched trial's ClinicalTrials.gov first-posted date.
  2. Press release ↔ registry connected — 3 of 4 reviewed records have an exact
     registry link; the earlier KTX-1001 IND announcement is a probable link.
  3. IND clearance without an IND number — the reviewed KTX-1001 sponsor release
     quotes FDA clearance but publishes no IND number. The discovery set contains
     additional IND-language candidates that still require source review.
  4. Catalyst approaching while friction high — joined trial has a Convoke catalyst
     (`nextCatalystForTrial`, programs.ts) AND appears in signal-store friction rows
     (e.g. atezolizumab/NCT06712355 is friction-seeded and Atezolizumab has a
     catalyst in programs.json).
- **UI contract:** `src/lib/pipeline-radar.ts` reads `pipeline-radar-reviewed.json`
  (the curated, reviewed subset; the automatic `pipeline-radar.json` is never
  imported by product code). The component
  renders `PIPELINE_RADAR.signals` with evidence chips, event labels, verbatim
  quotes, registry-match links, and source links). Dashboard teaser passes
  `limit={3}`; the /pipeline evidence ledger renders all.
- Press wires per user: PR.com (`/press_list.php`), EINPressWire
  (`world.einnews.com/search`), BusinessWire/PR Newswire (bot-walled — reach via
  GDELT/RSS).

---

## 8. Stretch tasks (only after A–E)

- **Task F — counterfactual toggle** (see Task B.6): instant engine re-run.
- **Task G — agent-role formalization** (research-backed design in RESEARCH2.md):
  keep the invariant; formalize roles as typed worker functions with zod contracts
  + an immutable decision log; add a Guardrail Reviewer (second-pass negation/
  boundary check on extraction, multi-model consensus on ambiguity — disagreement
  → null → needs_review) and a Criterion Normalizer (LLM proposes RuleKind
  mappings, CODE validates — the bounded path to raise coverage). Do NOT adopt a
  heavyweight agent framework; Strands stays for the analyst brief.
- **Task H — PITCH.md refresh** (research-backed; see RESEARCH.md §6 + RESEARCH2
  Part A): replace the "decision-support exemption" claim — the Jan 29, 2026 FDA
  CDS guidance makes patient-facing CDS a device; use the three-leg framing
  (trial-information retrieval, not treatment CDS; Criterion-4-by-construction;
  BMS enterprise posture). Add the killer numbers: LLM 95% accurate but 68% wrong
  reasoning (arXiv 2504.06581); MSK-MATCH 98.6% accuracy / 20min→43s / $0.96
  (arXiv 2511.05696); TrialGPT 87.3% criterion accuracy, 42.6% screening-time cut
  (arXiv 2307.15051); coverage ceiling ~50% (AMIA 2026, PMID 42317858). The
  "~23% today" claim stands — with "every new rule is a unit-tested function" as
  the growth story.

---

## 9. Definition of done (run before handing back)

- `pnpm build` clean; `npx tsc --noEmit` clean.
- `node scripts/test-negation.mjs && pnpm test:matcher &&
  node scripts/test-scoring.mjs && node scripts/test-programs.mjs` all pass.
- Live run of the anchor story: extraction correct; no "100 = 1 criterion" card;
  ≥2 excluded/near-miss cards render with verbatim blocking criteria; dashboard
  signals visibly trace to them.
- Demo stories selector works for all 5 stories; Carol is gated to non-NSCLC; no
  patient text stored anywhere.
- No LLM writes a verdict (code review gate).

## 10. Reference docs in this repo

- RESEARCH.md — enrollment crisis stats, CT.gov, criteria computability, TrialGPT,
  market, FDA CDS (Jan 29, 2026), BMS AI factory, protocol optimization.
- RESEARCH2.md — design-choice validation + agent architecture (roles table incl.
  Trial Radar #8, data-layer contract, frameworks, phased plan).
- RESEARCH3.md — score-honesty and near-miss fixes (this brief's Tasks A/B).
- src/data/demo-stories.{md,json} — the 5 demo narratives.
- HANDOFF.md — full system map (gitignored; contains a live key; do not commit).
