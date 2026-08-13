# ClearTrial — 3-Minute Pitch

**Reconciled against what is actually built.** Every claim below is true of the
running app. Nothing here references a feature that does not exist.

**Setup:** Tab 1 `/` · Tab 2 `/dashboard` · Tab 3 ClinicalTrials.gov search for
"non small cell lung cancer". Run the sample story once before you present —
the first call is ~4s, later ones feel faster.

---

## 0:00–0:25 — Hook

> "This is what we hand a frightened patient today."

*[Tab 3. Scroll once through the ClinicalTrials.gov results.]*

> "Hundreds of studies. Eligibility written for regulators, not for people —
> 'ECOG performance status of 0 or 1', 'no prior PD-1 or PD-L1 therapy'.
> Patients give up somewhere on this page. Meanwhile these trials sit
> under-enrolled. Both sides lose, for the same reason: nobody can read this."

---

## 0:25–1:30 — Patient side

*[Tab 1. Click "Use the example story".]*

> "Here's a patient describing herself the way people actually talk."

*[Click "Find trials".]*

> "She never typed a code. Watch what comes back out."

*[Chips animate in.]*

> "Non-small cell lung cancer. Stage IV. ECOG 1. PD-L1 60%. Prior carboplatin
> and pemetrexed. And note this one — no brain metastases. It caught the
> negation, which is the difference between a match and a dangerous match.
> Underneath, it shows her own words it read that from."

*[Scroll to trial cards.]*

> "Now the architectural point, and it's the one that matters in this room:
> **the model never decides eligibility.** It does two jobs — read her
> paragraph, and explain the result. Eligibility is decided by a
> deterministic TypeScript engine running against real published protocol
> text. That's a file a clinical team can read, version, and sign off. You
> cannot do that with a chatbot transcript.
>
> These are live the sponsor studies pulled from ClinicalTrials.gov — including a
> nivolumab–relatlimab combination she looks eligible for. Each card says why,
> criterion by criterion. And one click drafts the email to the study team —
> which **she** reviews and sends. Human in the loop, every time."

*[Click "Draft email to the study team". Let the mail window flash. Close it.]*

---

## 1:30–2:15 — The pivot

> "Now the part the sponsor gets paid for. She was ruled out of other studies. That
> rejection is normally lost. We keep it — anonymously."

*[Tab 2.]*

> "This is the same pre-screens, aggregated. And here's the automatic
> Protocol Optimization Alert: **60% of interested patients were ruled out by a
> single criterion** — prior PD-1/PD-L1 therapy. Not a threshold someone
> guessed at. That's counted from real exclusions against real protocol
> text, and the exact sentence is quoted right there.
>
> That is a protocol design decision costing recruitment, visible the week it
> happens instead of at the end of enrollment. Trial design stops being
> guesswork and becomes demand-driven."

---

## 2:15–3:00 — Strategic close

> "Why this matters to you specifically. Three things.
>
> **One — the patient relationship.** Consumer AI is intercepting these
> questions right now. Whoever owns that conversation owns recruitment.
> ClearTrial is the compliant version: deterministic matching, an auditable
> decision path, and nothing stored. A general chatbot structurally cannot
> promise that.
>
> **Two — the data.** Every search, matched or not, is real-world demand
> signal. That is exactly the input the AI factory the sponsor is building wants, and
> today it's being thrown away.
>
> **Three — it's real.** Sixty live oncology trials pulled from
> ClinicalTrials.gov, extraction on OpenAI, matching in code, running on AWS.
> We built it today.
>
> ClearTrial. Patients find trials, and trials find patients."

---

## Judge Q&A

**"Is this a regulated medical device?"**
It's designed for the decision-support exemption: it doesn't diagnose or direct
treatment, it retrieves and explains eligibility information, and it always
shows the basis for every output — the criterion, the threshold, and the
patient's own value. Final eligibility is a human clinical decision. The
deterministic architecture is what would make formal review tractable: the
matching logic is a readable file, not a black box.

**"What about privacy and HIPAA?"**
The patient's text is never written to disk and never logged — it lives for the
duration of the request. The only thing retained is concept-level telemetry:
"a lung-cancer search was blocked by criterion X." No text, no identifiers.
Outbound contact is a draft the patient sends from their own mail client. In
production this would run under the sponsor's enterprise agreement inside their VPC.

**"Why not just use ChatGPT?"**
Three failure modes we engineered out. A consumer model will happily tell a
patient they qualify — ours *cannot* decide eligibility at all, only the tested
rules engine can. Second, auditability: the sponsor can review and sign off the
criteria logic per protocol. Third, and strategically — if she asks ChatGPT,
OpenAI gets the demand signal. If she asks ClearTrial, the sponsor does.

**"The extraction is still an LLM. What if it's wrong?"**
It degrades safely in one direction. Anything the patient didn't state comes
back null, and the engine treats null as *unknown*, never as *passes* — so a
bad extraction produces "your doctor needs to confirm this", never a false
match. The extracted profile is also shown to the patient before any matching,
so the human verifies their own data. And the extractor is explicitly
instructed not to infer — ask it to guess ECOG from "I still work part time"
and it returns null.

**"How much of the eligibility criteria can you actually evaluate?"**
Be honest here — it's a strength. About 27% of published criteria lines are machine-evaluable on the lung
studies the demo uses (19% across the whole 60-study portfolio) — a median of 3 per trial: ECOG, PD-L1 thresholds,
prior therapy classes and lines, treatment-naive requirements, biomarker
requirements, stage windows, CNS involvement, age. The rest are shown on the
card as "other requirements your doctor will need to read", with the verbatim
text — not silently passed. We'd rather under-claim and be trusted. Expanding
coverage is a bounded, testable engineering problem: every new rule is a pure
function with unit tests, not a retrained model. We moved it from 17% to 27%
during the build.

**"Your card says 100% — how can you be sure?"**
It doesn't say confident, it says *fit*, and it's always paired with "checked
N of M". Fit is the share of the requirements we could read that you met.
Coverage is how many we could read at all. A trial where we verified one
requirement can never present as a match — the verdict is gated on evidence
volume, not just on direction.

**"Where does the trial data come from?"**
Live ClinicalTrials.gov records for recruiting oncology studies, fetched
through a Bright Data pipeline and committed as a build artifact so the demo
can't be broken by conference wifi. The eligibility text you see quoted on the
dashboard is verbatim from the protocol.

---

## If the wifi dies

Nothing breaks. With no key or a failed call the app falls back to a local
deterministic extractor and the demo runs identically — the badge reads
"offline mode" instead of the model name. Don't mention it unless asked.
