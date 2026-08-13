# ClearTrial — Weak-Spot Fixes: Score Honesty & The Invisible Pivot

Fix research for the two demo-critical weaknesses, compiled Aug 13, 2026.
Both root causes verified against the actual code (`src/lib/match.ts`,
`src/app/api/match/route.ts`, `src/app/page.tsx`, `src/app/components/TrialCard.tsx`)
and the live dataset. Every technique is grounded in cited literature.

---

## Part 1 — "Score 100 means we checked one thing"

### 1.1 Root cause (code-verified)

In `matchTrial()`:

- `decidable = evaluated.filter(c => c.kind !== "unparsed")` — **unparsed criteria
  are excluded from the score entirely**. They contribute to neither numerator nor
  denominator.
- `weighted = passes + blockers + 0.5 × unknown(decidable)`; `base = passes/weighted × 100`.
  A trial with 1 decidable passing criterion and 23 unparsed criteria → `weighted = 1`
  → **score = 100**.
- `TrialCard.tsx` renders that number under the literal label **"confidence"** — the
  semantically wrong word: it is a pass-rate of decidable criteria, not a confidence.
- Unparsed criteria **never appear anywhere in the UI** — not in the pass list, not in
  the blockers, not in the open questions. The patient cannot see that 23 of 24
  protocol requirements were never checked. The number "100" + the invisible criteria
  = "fully verified" to any reader.
- Verdict logic can also produce `likely` (passes < 2) at score 100 — so even the
  verdict doesn't rescue the display.

### 1.2 What the literature says about communicating uncertainty

- **"Position Paper: Integrating Explainability and Uncertainty Estimation in Medical
  AI" (arXiv 2509.18132, 2025):** current medical AI "fail[s] to explicitly quantify
  or communicate uncertainty in a way that aligns with clinical reasoning". A single
  scalar "confidence" is precisely the anti-pattern named in this paper.
- **LLM confidence methods (arXiv 2312.03733) and "The challenge of uncertainty
  quantification of LLMs in medicine" (arXiv 2504.05278):** LLM self-reported
  confidence is unreliable — which is why ClearTrial's score must come from the
  deterministic engine's *coverage*, not from any model.
- **GRADE (Guyatt et al., BMJ 2008):** clinical evidence communication is built on
  *certainty of evidence* — what is known vs what is not. "We verified 1 of 24
  criteria" IS the GRADE framing, expressed for patients.
- **Wilson score interval (Brown, Cai & DasGupta, Statistical Science 2001):** the
  standard small-sample correction for proportions. With n=1, a naive 100% pass rate
  is statistically meaningless; the Wilson lower bound makes that explicit. For
  ClearTrial, n = decidable criteria count.
- **UQ360 (arXiv 2106.01410):** the IBM uncertainty toolkit's core lesson — decompose
  uncertainty into *which* kind (epistemic: not enough criteria checked; aleatoric:
  the criteria themselves are ambiguous) and communicate each differently. ClearTrial
  has both: unparsed criteria = epistemic; `unknown` outcomes = aleatoric.
- **Human-in-the-loop AI systematic review (JMIR/PMC 2026, PMID 42072503):** the
  evidence-gated triage design ("needs doctor") is the clinically endorsed pattern.

### 1.3 The fix (deterministic, small, testable)

1. **Decompose the display into two honest numbers:**
   - **FIT** = passes / (passes + blockers) — "of the criteria we could check, you met
     this share".
   - **COVERAGE** = decidable / total criteria — "we checked N of M".
   - Render as: `Fit 100% · checked 1 of 24` plus the explicit line **"23 other
     requirements need your doctor to confirm."** Delete the "confidence" label and
     the bare 100.
2. **Gate verdicts on evidence volume (not just outcomes):**
   - `eligible` requires `passes ≥ 2 AND decidable ≥ 3` (all three decidable).
   - `likely` requires `passes ≥ 1 AND decidable ≥ 1`.
   - else `needs_review`. Deterministic, unit-testable, and it kills the
     "100 with no evidence" reading by construction: a 1-criterion trial can never
     render above `likely`.
3. **Surface unparsed criteria in the card.** "Other protocol requirements your doctor
   will confirm — N items", with up to two verbatim examples. This makes the honest
   "23% coverage" claim *visible on screen* (it currently only exists in the Q&A
   script) and converts the biggest auditability weakness into a demonstration.
4. **Keep the scalar score for ranking only** (relative order is fine), de-emphasize it
   in the UI. Optionally display the Wilson lower bound of FIT when coverage is low
   (e.g. `≥60%` instead of a false-precision `100`).
5. Regression tests: score/verdict fixtures for (1 pass, 0 unparsed), (1 pass,
   23 unparsed), (2 pass, 3 unknown), (blocker present). The 1/23 case must NOT render
   as a 100-eligible card.

---

## Part 2 — The demo pivot has no on-screen evidence

### 2.1 Root cause (code-verified)

- `matchAll()` sets `pool = onCondition` trials only — off-condition trials never
  reach the response.
- Within the pool, `excluded` verdicts sort last, and the route returns
  `results.slice(0, 12)` — excluded trials can fall off the cut entirely.
- `page.tsx` renders the "Why other studies ruled you out" section **only if
  `excluded.length > 0`** — otherwise the section silently disappears.
- The deeper problem (verified against the live dataset + demo profile): almost nothing
  evaluates to `excluded`, because the lines that would rule the demo patient out are
  all `unparsed`. Examples from the dataset:
  - NCT07251582: "No prior systemic antitumor therapy for the current NSCLC diagnosis"
    → no rule fires → unknown, not fail.
  - NCT06956001: "Prior treatments including: Systemic anti-tumor therapy for
    advanced/metastatic NSCLC" → no rule fires → unknown.
  - NCT06692738: "Any prior systemic, non-curative therapy received for NSCLC" → no
    rule fires → unknown.
  So the pitch line "notice she was ruled out of other studies" has **no on-screen
  evidence**, even though the seeded dashboard signal (prior PD-1/PD-L1 blocker) tells
  the analyst story. The demo choreography is internally inconsistent.

### 2.2 Techniques (literature)

- **Contrastive explanation (Miller, Artificial Intelligence 267, 2019):** humans
  understand decisions through contrast — "why X and not Y". The excluded-trials
  section is not a feature; it is *the* explanation mechanism. Making it always
  visible is the recommendation-systems-correct design, not just demo repair.
- **Near-miss explanations (arXiv 2308.14163, "Explaining with Attribute-based and
  Relational Near Misses"):** in decision-critical domains (the paper is medical
  diagnostics), the most informative explanations come from *near misses* — cases that
  almost fit. Rank excluded trials by *closeness* (fewest blockers, most passes) and
  show the single blocking criterion. "You were ruled out of THIS study by exactly
  this sentence" is the near-miss explanation, verbatim.
- **Missing-recommendation transparency (arXiv 2504.11000):** systems where the
  absence of a recommendation is meaningful must explain the absence. The dashboard
  pivot depends on the patient side *seeing* the rejections before the analyst side
  *aggregates* them.
- **Explainable-recommendation evaluation (arXiv 2202.06466):** explanation quality =
  transparency + persuasiveness + satisfaction. Near-miss cards with verbatim criteria
  score on all three.
- **MSK-MATCH (arXiv 2511.05696) & the sociotechnical framework (JMIR AI 2026,
  PMID 42160468):** rejection → human triage is the clinically validated loop;
  surfacing it is the product, not a bug.
- **Counterfactual explanations (Wachter, Mittelstadt & Russell, 2017):** "what would
  have to be different" — the interactive toggle below is exactly this, and the
  deterministic engine can answer it instantly and replayably (an LLM cannot).

### 2.3 The fix

1. **API: dedicated `nearMisses` array.** Top 3 excluded-within-condition trials,
   ranked by closeness (fewest blockers → most passes → highest score), returned
   unconditionally — never cut by `slice(0, 12)`. Each entry carries its blockers with
   verbatim protocol text (already in `EvaluatedCriterion.source`).
2. **UI: always render the section** when `nearMisses.length > 0`. Each near-miss card:
   trial name + NCT, the ONE blocking criterion (verbatim quote), the patient's value
   vs the requirement, and a "what would change" line (counterfactual, code-generated:
   "this study requires prior immunotherapy — confirm with your oncologist whether
   your history qualifies").
3. **The rule additions that make the demo true (highest-value engineering fix):**
   add `prior_any_therapy` ("no prior systemic therapy", "treatment-naive",
   "prior treatments including systemic anti-tumor therapy") and `biomarker`
   (EGFR/ALK/KRAS/MET requirement lines) to `classify()`/`evaluate()`. These are the
   two most common blocker patterns in the dataset, and with them the demo patient is
   genuinely excluded from 2-4 NSCLC trials on screen — the pivot has evidence, and
   the dashboard alert is visibly grounded in the patient-side flow. Both rules are
   pure functions + regression tests, per the architecture invariant.
4. **Demo-script touch:** the example story should state "I have not had immunotherapy
   yet" (checkpoint-naive) — this makes the seeded "prior PD-1/PD-L1" dashboard signal
   consistent with the patient-side exclusions wherever they fire.
5. **Stretch (killer demo of the deterministic engine):** a "what if" toggle per
   near-miss card ("What if you had prior immunotherapy?") that re-runs the engine
   instantly and flips the card from excluded → eligible. Instant, replayable,
   unit-testable — the exact property a chatbot cannot offer, demonstrated live in
   ten seconds. It also directly foreshadows the dashboard: "this criterion is why
   patients fall out of your trial."

---

## Part 3 — Implementation order (all small, all testable)

1. `src/lib/types.ts` — add `coverage`/`fit` fields + `nearMisses` to `MatchResponse`.
2. `src/lib/match.ts` — compute fit/coverage; evidence-gated verdicts; export
   `closestMisses()`; add `prior_any_therapy` + `biomarker` rules.
3. `src/app/api/match/route.ts` — return `nearMisses` (and count of unparsed).
4. `src/app/components/TrialCard.tsx` — fit/coverage display, "doctor must confirm"
   unparsed section, remove "confidence" label.
5. `src/app/page.tsx` — always-render "Why other studies ruled you out" from
   `nearMisses`; (stretch) counterfactual toggle.
6. Regression tests in `scripts/` for: 1/23 score case, evidence-gated verdicts,
   prior-any-therapy negation ("no prior systemic therapy" must not flip polarity),
   biomarker boundary safety (the "ALL"/"sm-all" class of bug).
7. Re-run the demo story end-to-end: verify ≥2 excluded cards render with verbatim
   blocking criteria, and the dashboard signal visibly traces to them.

---

## Sources (all verified this session)

- Code: `src/lib/match.ts`, `src/app/api/match/route.ts`, `src/app/page.tsx`,
  `src/app/components/TrialCard.tsx`, `src/data/trials.json` (refetched 2026-08-13).
- Brown, Cai & DasGupta (2001). *Interval Estimation for a Binomial Proportion.*
  Statistical Science 16(2):101-133. (Wilson interval)
- Guyatt GH et al. (2008). *GRADE: going from evidence to recommendations.* BMJ 336.
- Miller T (2019). *Explanation in artificial intelligence: Insights from the social
  sciences.* Artificial Intelligence 267:1-38. (contrastive explanations)
- Wachter S, Mittelstadt B, Russell C (2017). *Counterfactual explanations without
  opening the black box.* Harvard Journal of Law & Technology 31(2).
- arXiv 2308.14163 — near-miss explanations (medical diagnostics).
- arXiv 2504.11000 — missing-recommendation transparency.
- arXiv 2202.06466 — measuring "why" in explainable recommendation.
- arXiv 2509.18132 — explainability + uncertainty in medical AI (position paper).
- arXiv 2312.03733 / 2504.05278 — LLM confidence is unreliable.
- arXiv 2106.01410 — UQ360 uncertainty toolkit.
- arXiv 2511.05696 — MSK-MATCH. / PMID 42160468 — JMIR AI sociotechnical framework.
- PMID 42072503 — human-in-the-loop AI systematic review (2026).
