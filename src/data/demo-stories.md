# ClearTrial — Demo Patient Stories

Five plain-English patient narratives for the demo. All are **fictional composites**
built from the structural and emotional beats of real posts on public cancer-patient
communities (Cancer Survivors Network lung cancer board, archived 2016-2020; pattern
sources listed at the bottom). No real person is depicted; no identifying detail
survives. They are written the way people actually write — imperfect, emotional,
specific — and each carries the clinical facts the extractor needs, stated the way a
patient would state them.

Each story is tagged with the profile it is designed to produce and the demo dynamic
it exercises (match / near-miss exclusion / needs-review).

---

## 1 · Daniel, 58 — the anchor story

> I'm 58. Last year I was diagnosed with stage IV non-small cell lung cancer. I went
> through four rounds of carboplatin and pemetrexed, but my last scan showed it had
> spread further. My oncologist mentioned my PD-L1 is around 60%. My ECOG is 1 and
> there's no sign it's reached my brain. I've been on ClinicalTrials.gov for hours and
> I genuinely can't tell which of these studies I'd even be allowed to join. I feel
> like I'm running out of time and options.

- Profile: NSCLC · stage IV · prior platinum+chemo (4 lines) · PD-L1 60% · ECOG 1 ·
  no brain mets · age 58
- Demo dynamic: clean extraction; checkpoint-naive → shows the flagship "possible
  match" flow; some trials require prior checkpoint → near-miss exclusions.

## 2 · Marta, 64 — progressed after immunotherapy

> I was diagnosed fourteen months ago with stage IV non-small cell lung cancer. I did
> six rounds of carboplatin, pemetrexed, and Keytruda, and it worked for a while. But
> my last scan showed the tumors in my lungs growing and a new spot on my liver. My
> PD-L1 was 90%. I had one small brain metastasis that was treated with radiation and
> it's been stable ever since. My doctor says my performance status is still 1. I've
> been trying to find trials for people who have already had immunotherapy, because I
> don't think I can go back to that.

- Profile: NSCLC · stage IV · prior platinum+chemo+checkpoint · PD-L1 90% · ECOG 1 ·
  brain mets: treated/stable (nuance!) · age 64
- Demo dynamic: exercises the checkpoint-prior rules and the brain-mets nuance — a
  treated, stable lesion should not auto-exclude; trials with "no untreated CNS
  mets" language must be handled carefully (good near-miss material).

## 3 · Frank, 62 — KRAS mutation, hunting for targeted trials

> I'm 62 and I have stage IV lung cancer — adenocarcinoma with a KRAS G12C mutation.
> I did carboplatin, pemetrexed, and Keytruda for about eight months, but my scans
> started showing it was growing again. My PD-L1 was 40%. I'm ECOG 1 and it hasn't
> spread to my brain. I heard there are new drugs for KRAS now, so I've been looking
> for a trial that will take someone who already had chemo and immunotherapy. The
> problem is I can't figure out which studies actually want people like me.

- Profile: NSCLC adenocarcinoma · KRAS G12C · prior platinum+chemo+checkpoint ·
  PD-L1 40% · ECOG 1 · no brain mets · age 62
- Demo dynamic: biomarker story. The dataset has two KRAS G12C trials — both
  first-line-only ("no prior systemic therapy for advanced disease"), so Frank should
  land in the **near-miss / excluded** section with the exact blocking criterion
  quoted. That is the dashboard signal made visible on the patient side.

## 4 · Margaret, writing for her father Henry, 71 — fragile, low PD-L1

> My father is 71 and has stage IV squamous cell lung cancer. He did carboplatin and
> radiation, and then it spread to his liver. His PD-L1 is only about 5%. He's
> fragile — he's at ECOG 2 and uses oxygen at night. No brain mets. We're looking for
> anything, any trial, that might still be an option for someone his age who's
> already had chemo. He's a fighter, but he's tired, and I don't want to bring him
> something that isn't even a possibility.

- Profile: NSCLC squamous · stage IV · prior platinum · PD-L1 5% · ECOG 2 · no brain
  mets · age 71
- Demo dynamic: the exclusion showcase — low PD-L1 and ECOG 2 should rule her father
  out of the immunotherapy trials on screen, with "not a fit right now" cards that
  quote the exact threshold. Also exercises age rules. The "fragile patient" voice
  makes the human stake visible.

## 5 · Carol, writing for her husband Jack, 67 — small cell, time pressure

> My husband Jack is 67. He was diagnosed last June with extensive-stage small cell
> lung cancer. He had four rounds of carboplatin and etoposide, and it shrank at
> first. But his last scan shows it's growing again in his chest and lymph nodes. No
> brain mets. He's exhausted — ECOG 2. His PD-L1 was never high, around 10%. I've
> spent night after night on ClinicalTrials.gov and I still can't tell what he'd even
> qualify for. We don't have much time, and every hour I spend on that site feels like
> an hour I'm taking from him.

- Profile: SCLC (small cell) · extensive-stage · prior platinum+chemo · PD-L1 10% ·
  ECOG 2 · no brain mets · age 67
- Demo dynamic: caregiver voice; small-cell profile should be gated away from the
  NSCLC trials (disease-area gate) and toward the few relevant studies — showing the
  condition gate working and the honesty of "there are fewer options for small cell."

---

## Demo notes (for the pitch flow)

1. **Story 1** is the main demo path: clean extraction → ranked cards → email draft.
2. **Story 3 and 4** are the pivot setup: on-screen "why not" exclusions whose blocking
   criteria feed the researcher dashboard ("prior systemic therapy required" and
   "PD-L1 threshold" / "ECOG ceiling" signals).
3. **Story 2** demonstrates the nuance handling (treated brain met, prior checkpoint)
   — the cards that say "needs your doctor to confirm."
4. **Story 5** shows the disease-area gate and the honest "fewer options" outcome.
5. All five are designed to be dropped into the app as "use an example story" options,
   replacing/joining the current single example.

## Sources of inspiration (public posts, pattern-level only)

- Cancer Survivors Network (ACS), Lung Cancer board, archived via Wayback Machine:
  - "Stage 4 lung cancer" (2020) — wife's IO progression, "anybody have anything
    better to use" (→ Story 2's hunt-for-next beat).
  - "Stage 4 Rare & Complex Lung Cancer" (2020) — EGFR+/PD-L1+ adenocarcinoma with
    treated brain lesion, targeted therapy progression (→ Story 3's biomarker +
    treated-brain-mets beat).
  - "Hi. My husband has advanced small cell lung cancer" (2020) — caregiver voice,
    declining husband, family history (→ Story 5).
  - "It's been a rough year" (2016) — husband on a new clinical trial, dramatic
    functional decline, compounding grief (→ Story 4/5's time-pressure and fragility).
  - "Elderly and Alimta" (2016) — 85yo mother, low PD-L1, weighing chemo after
    progression (→ Story 4's low-PD-L1/fragile beat).
- All composites are anonymized; no usernames, locations beyond what the story needs,
  or identifiable details were retained.
