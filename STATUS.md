# ClearTrial — Project Status

**Last verified:** Aug 13, 2026. Every figure below was measured, not recalled.
Re-run the commands in §8 before trusting it after further changes.

---

## 1. Repos

| Repo | HEAD | State |
|---|---|---|
| `BrandonKNguyen192/cleartrial` (private) | `529dd6c` | Clean |
| `BrandonKNguyen192/BioPharma-AWS-Hackathon` (public) | `3c0c79d` | Clean |

In sync for everything publishable. Private-only by design and **not** mirrored
publicly: `HANDOFF.md`, `DEPLOY.md`, `PLAN.md`, `BRIEF.md`. `HANDOFF.md` is
gitignored entirely — it contains a live API key.

## 2. Live deployment — verified working

**https://main.d19m8vd3xmzmxc.amplifyapp.com**

| Check | Result |
|---|---|
| `/`, `/dashboard` | 200 |
| `POST /api/match` | `gpt-5.4`, `usedFallback: false`, 2.2s, 12 results, 3 near misses |
| `POST /api/protocol-brief` | 200, 14.2s, Strands brief citing 29/48 (60%) |

The last row is the important one: it proves the Strands SDK bundled correctly
through Amplify's Next.js adapter, which was the deployment's main risk.

**Production behaviours that are expected, not bugs:**

- Analyst brief is ~14s cold vs ~7s warm (Lambda cold start). Run the warm-up
  ritual in `RUNBOOK.md §5` before presenting.
- The signal store is process memory, so dashboard counts reset on cold start
  and differ between concurrent Lambda instances. Do not build a demo beat on a
  counter incrementing live.

## 3. Engine state

- **Coverage: 27%** of published criteria are machine-evaluable (62 of 229
  across 20 lung trials), median 3 per trial, min 0, max 6.
- **Dataset:** 60 real recruiting oncology trials in `src/data/trials.json`,
  committed so the demo never makes a network call for trial data. Sponsor
  filtering is a fetch-time choice via `TRIAL_SPONSOR`; the committed file
  records only `"single-sponsor portfolio"`.
- **Models:** `gpt-5.4` primary, `gpt-4.1-nano` fallback. These are the only
  two models on the active key that support strict `json_schema`. `gpt-4-turbo`
  rejects it; `gpt-5.3-codex` is Responses-API only. **Naming an unavailable
  model does not fail loudly** — extraction 403s, the local parser takes over,
  and the UI quietly reads "offline mode". Re-check if the key changes.
- **Tests:** `test-scoring.mjs` (21 cases), `test-negation.mjs`,
  `test-condition-gate.mjs` — all passing.

## 4. Architecture invariant — do not break this

**The language model never decides eligibility.** It extracts facts from free
text and explains results. Every pass/fail/unknown comes from deterministic
TypeScript in `src/lib/match.ts` against published protocol criteria.

This is the entire compliance and differentiation argument. Anything unstated
is `unknown`, never `pass`. If you add capability, add it as a pure function
plus a unit test — not as model judgment.

Related rule: **Convoke/commercial context belongs on the researcher side
only.** Development stage and catalyst dates in front of a patient read as a
promise about their odds.

## 5. Recent work

- **Score honesty.** Cards previously showed a single "confidence" number that
  read 100 after checking one requirement, while the other twenty were computed
  as unreadable and silently dropped. Now: *fit* (of what we could check, how
  much was met) plus "checked N of M", with unreadable requirements listed
  verbatim. Verdicts are gated on evidence volume, so a barely-checked trial
  cannot present as a match.
- **Near misses.** Added `prior_any_therapy` and `biomarker` rules, and a
  `nearMisses` array computed before the results page limit so the rejection
  explanation can never be truncated away. Coverage 23% → 27%.
- **De-branding.** Client name at 0 occurrences across the working tree. The
  only remaining matches anywhere are `BMS-####` compound codes inside official
  ClinicalTrials.gov study titles — public record, and rewriting them would
  falsify the dataset.
- **Node 22 pinned** in `amplify.yml`; Amplify's default image can ship a Node
  older than Next 16 supports.
- **`data/jwt_secret`** gitignored. An external tool wrote it into the working
  tree; nothing here reads it, and this repo has a public mirror.

### Bugs found in review — regression-tested, do not reintroduce

1. `"no brain mets"` read as brain mets **positive** — the positive pattern
   matches inside the negation, so negation must be tested first.
2. The disease gate matched `"ALL"` inside `"sm-all"`, recommending acute
   leukemia trials to a lung cancer patient. Now word-boundary matched.
3. A naive `/alk/` biomarker rule matches `"alkalization"`, which appears
   verbatim in the dataset. Boundary-safe matching required for every gene
   token.

## 6. Sponsors

| Sponsor | Tier | State |
|---|---|---|
| OpenAI | Gold | ✅ Real — extraction + Strands agent on `gpt-5.4` |
| AWS | Gold | ✅ Real — Strands Agents SDK, deployed on Amplify |
| Convoke | 💎 Diamond | ⏳ MCP server added to Claude Code config; **needs `/mcp` OAuth** |
| Bright Data | Gold | 🔴 Account manually suspended |
| HackerSquad | 💎 Diamond | ❌ Nothing yet |

**Bright Data detail:** zone `web_unlocker1` exists and is Active — the zone
name was never the problem. `GET api.brightdata.com/status` returns
`can_make_requests: false`, `status: "suspend_manual"`. A $100 workshop bonus
was applied Aug 13 but no payment method is on file. Their booth can lift the
suspension; do not add a personal card. Note it is not load-bearing regardless
— ClinicalTrials.gov's public API is free and unblocked, and the ingestion
falls back to it cleanly. The version where Bright Data earns its place is
scraping bot-gated sponsor IR/press pages for the pipeline-visibility layer
described in `RESEARCH.md`.

**Developer feedback for all 5 tools: not submitted.** Explicitly scored on the
event dashboard. ~10 minutes, highest points-per-minute remaining.

## 7. Open items, highest value first

1. **Developer feedback ×5** — ~10 min, pure points.
2. **HackerSquad signup** — ~5 min; a Diamond sponsor currently at zero.
3. **Convoke** — authenticate `/mcp`, then build-time enrichment writing
   `src/data/programs.json`, joined on `trial.interventions` (133 distinct
   drugs; Pumitamig ×14, Nivolumab ×13, Ipilimumab ×10). **Only 5 credits
   exist — build-time only, never per-request.** Value: the dashboard can say
   a criterion is blocking a *Phase 3 program with a near-term catalyst*
   rather than just "a trial", which turns a recruitment metric into business
   urgency. Researcher side only.
4. **Bright Data** — blocked on the booth, not on code.
5. **Rehearse the 3 minutes.** The largest remaining risk is delivery, not
   engineering.

### Known weak spots not yet fixed

- Signal store is in-memory; a restart reseeds. Persisting it behind the same
  interface in `signal-store.ts` is the fix.
- Patient portal is visually plainer than the dashboard.
- Coverage past 27% is a bounded problem: the next highest-value rules are lab
  thresholds (ALT/AST/bilirubin, currently all `unparsed`) and histology
  subtype.

## 8. Verify before trusting this file

```bash
cd /Users/brandonnguyen/projects/biopharma-hack
node scripts/test-scoring.mjs
node scripts/test-negation.mjs
node scripts/test-condition-gate.mjs
node scripts/measure-coverage.mjs
pnpm build

APP=https://main.d19m8vd3xmzmxc.amplifyapp.com
curl -s -X POST $APP/api/match -H 'Content-Type: application/json' \
  -d '{"text":"I am 58 with stage IV non-small cell lung cancer. I had carboplatin and pemetrexed. PD-L1 is 60%. ECOG 1. No brain mets."}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['model'], d['usedFallback'], len(d['nearMisses']))"
```

Expect: `gpt-5.4 False 3`. If `usedFallback` is `True`, the key is missing from
the Amplify environment or the model constants name something the key cannot
serve.

## 9. Document map

| File | Purpose | Public? |
|---|---|---|
| `OVERVIEW.md` | What it does, how, commercial case | Yes |
| `RUNBOOK.md` | AWS Amplify deployment + troubleshooting | Yes |
| `README.md` | Quick start, sponsor stack | Yes |
| `RESEARCH.md` / `RESEARCH2.md` / `RESEARCH3.md` / `RESEARCH_SYNTHESIS.md` | Market, architecture, weak-spot research | Yes |
| `STATUS.md` | This file | Yes |
| `PITCH.md` | 3-minute script + judge Q&A | Private |
| `HANDOFF.md` | Full handoff incl. credentials | **Gitignored** |
| `DEPLOY.md`, `PLAN.md`, `BRIEF.md` | Planning history | Private |
