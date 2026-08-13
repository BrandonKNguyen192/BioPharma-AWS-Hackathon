# Deployment Runbook — AWS Amplify Hosting

**Target:** ClearTrial (Next.js 16 SSR) on AWS Amplify Hosting.
**Time:** ~15 minutes, most of it waiting on the first build.

## Architecture note before you start

Strands and Amplify are **not alternatives**. Amplify hosts the Next.js app;
the Strands Agents SDK is a dependency *inside* that app, powering the analyst
brief in `src/lib/protocol-agent.ts`. There is no separate agent deployment.
Ignore the standalone-agent deployment guides — they don't apply here.

Verified before writing this: the production build traces 139 Strands files and
165 OpenAI files into the server bundle, and correctly excludes the unused
`@aws-sdk/client-s3` optional dependency. The SDK will ship with the app.

## Regenerating the Convoke enrichment (only when the trial set changes)

`src/data/programs.json` is committed and read at build time. Amplify never
calls Convoke, so nothing here is on the deployment path — skip this section
unless you have re-run `scripts/fetch-trials.mjs`.

Convoke's `/mcp` authenticates per user over OAuth. There is no static API key
a CI job could hold, so the two queries are issued once from an authenticated
MCP client (Claude Code with the `convoke` server configured) and their raw
JSON saved into `tmp/`. Everything either side of that is offline and
deterministic.

```bash
node scripts/build-program-queries.mjs   # writes tmp/asset-map.json + the ask list
```

Then, from an authenticated MCP client, run and save the raw responses:

1. `query_program_tracker` — `drug` = the printed ask list, `indication` = the
   curated indication list, `task_relevant_fields` = `["targets","modalities"]`.
   Paginate on `next_offset` until `truncated` is false; save each page as
   `tmp/convoke-programs-p<N>.json`. Do **not** request `organizations` — the
   de-branding rule keeps the sponsor's name out of the working tree.
2. `query_program_tracker` again with a single cheap drug and *every* raw
   condition string as `indication`, purely to harvest `entity_resolution`;
   save as `tmp/convoke-indications.json`.
3. `query_catalyst_calendar` — scope by sponsor organization with a forward
   date window. Results come back newest-first, so narrow the window rather
   than paginating to reach near-term events. Save as
   `tmp/convoke-catalysts.json`, keeping `reported_date` alongside `sort_date`.

```bash
node scripts/build-programs.mjs   # merges tmp/ -> src/data/programs.json
node scripts/test-programs.mjs    # data integrity + join semantics + seed drift
```

`build-programs.mjs` reports every row and mapping it rejected. Read that
output: rejections are the mechanism that keeps a wrong claim off the
dashboard, not noise to skim past.

If you re-ran `fetch-trials.mjs`, `test-programs.mjs` will also fail when a
seeded NCT id in `src/lib/signal-store.ts` is no longer in the dataset, or when
a seeded criterion is no longer verbatim. Re-point the seed at real trials
before presenting.

---

## 0. Pre-flight (2 min)

Run locally. All four must pass before you touch the console.

```bash
cd /Users/brandonnguyen/projects/biopharma-hack
node scripts/test-scoring.mjs        # expect: all scoring/rule regressions pass
node scripts/test-negation.mjs       # expect: all negation cases pass
node scripts/test-condition-gate.mjs # expect: all condition-gate cases pass
pnpm build                           # expect: routes listed, no errors
```

Confirm the repo is pushed:

```bash
git status --short                   # expect: empty
git log --oneline -1
```

**Have ready:** the OpenAI API key (the one in `.env.local`).

---

## 1. Create the Amplify app (5 min)

1. Open **https://console.aws.amazon.com/amplify/create/repo**
2. Choose **GitHub** → authorise AWS → select the repository → branch `main`.
   - Private repo: you'll be asked to install the **AWS Amplify GitHub App**.
     Grant access to this one repo only.
3. Amplify detects Next.js SSR and reads the committed `amplify.yml`.
   **Do not edit the build settings** — the spec pins Node 22 and pnpm 10.6.2,
   both of which matter (Amplify's default image can ship a Node older than
   Next 16 supports).

## 2. Set environment variables — BEFORE the first build

**Advanced settings → Environment variables.**

| Key | Value | Required |
|---|---|---|
| `OPENAI_API_KEY` | your key | Yes for live extraction |
| `BRIGHTDATA_API_KEY` | your key | No — ingestion is build-time only |
| `BRIGHTDATA_ZONE` | your zone name | No |

Notes:

- Without `OPENAI_API_KEY` the app still works — it falls back to the local
  deterministic extractor and the UI badge reads **"offline mode"**. It will not
  crash, but you lose the live-extraction moment.
- Bright Data is **not used at runtime**. Trial data is committed at
  `src/data/trials.json`. These vars only matter if you re-run ingestion.

## 3. Deploy

**Save and deploy.** First build ≈ 3–5 min.

Watch the build log for these lines, which the spec prints deliberately:

```
v22.x.x                                  <- Node pinned correctly
env OPENAI_API_KEY: set                  <- key visible to the build
```

If it says `missing`, the variable didn't apply — fix step 2 and redeploy.

---

## 4. Post-deploy verification

Replace `$APP` with your Amplify URL.

```bash
APP=https://main.xxxxx.amplifyapp.com

# 1. Pages render
curl -s -o /dev/null -w "%{http_code}\n" $APP/
curl -s -o /dev/null -w "%{http_code}\n" $APP/dashboard      # expect 200, 200

# 2. Live extraction — the critical check
curl -s -X POST $APP/api/match -H 'Content-Type: application/json' \
  -d '{"text":"I am 58 with stage IV non-small cell lung cancer. I had carboplatin and pemetrexed. PD-L1 is 60%. ECOG 1. No brain mets."}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('model:',d['model'],'| fallback:',d['usedFallback'],'| nearMisses:',len(d['nearMisses']))"
```

**Expected:** `model: gpt-5.4 | fallback: False | nearMisses: 3`

If `fallback: True`, the key isn't reaching the runtime — recheck step 2.

```bash
# 3. Strands agent (slowest path; confirms the SDK shipped)
curl -s -X POST $APP/api/protocol-brief -w "\nHTTP:%{http_code}\n" --max-time 90
```

**Expected:** HTTP 200 with a `brief` object, ~7–15s.

A 502 here means the agent failed — see Troubleshooting. It does **not** break
the dashboard; the deterministic alert renders regardless.

### Manual pass before presenting

- `/` → "Use the example story" → "Find trials"
- Badge next to "What we understood" shows **`gpt-5.4`**, not "offline mode"
- Trial cards show **fit %** and **"checked N of M"**
- "How close you came to…" section renders with quoted blocking sentences
- `/dashboard` → Protocol Optimization Alert renders → "Generate analyst brief"
  returns prose → "Export for Convoke" downloads JSON

---

## 5. Known behaviour differences in production

**These are expected. Don't debug them at the podium.**

| Behaviour | Why | Impact |
|---|---|---|
| Dashboard counts reset or jump | The signal store is **process memory**. Amplify SSR runs on Lambda; each cold start reseeds, and concurrent instances hold separate counts. | Numbers may differ between refreshes. The seeded story still renders. Don't build the pitch on a number incrementing live. |
| Analyst brief slower than local | Lambda cold start plus the model call. | First click may take ~15s. Warm it once before presenting. |
| First request after idle is slow | Lambda cold start. | Load both pages once before you go on stage. |

**Warm-up ritual (do this 5 minutes before presenting):** load `/`, run the
example story, load `/dashboard`, click "Generate analyst brief". Everything is
then warm.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails on `pnpm install` | Node too old / corepack missing | Confirm the build log shows `v22`. If not, Amplify overrode the spec — check Build settings uses `amplify.yml`. |
| Build fails, lockfile mismatch | `--frozen-lockfile` vs a stale lockfile | `pnpm install` locally, commit `pnpm-lock.yaml`, push. |
| App loads, badge says "offline mode" | `OPENAI_API_KEY` not set or not applied | Re-add in console → **Redeploy** (env changes need a rebuild). |
| `/api/protocol-brief` returns 502 | Strands SDK failed, or model rejected | Check Amplify **Function logs**. If it names a model, the key lost access — update `BRIEF_MODEL` in `src/lib/protocol-agent.ts` to one the key serves. |
| `/api/protocol-brief` times out | Exceeds Amplify's SSR timeout | Non-blocking; the deterministic alert still renders. Don't demo the button. |
| `/api/match` 500s | Usually a bad request body | Check Function logs; the route returns 400 for malformed input by design. |

**Getting logs:** Amplify console → your app → **Hosting → Monitoring →
Function logs** (CloudWatch). Server-side `console.error` from the routes lands
there, including the `[extract]` and `[protocol-brief]` messages.

---

## 7. Rollback

Amplify keeps every build.

1. Console → your app → **Deployments**
2. Find the last known-good build → **Redeploy this version**

Takes ~2 minutes. Faster than debugging forward under time pressure.

**Nuclear option:** present from `localhost:3002`. The demo is visually
identical. Keep a local dev server running as a backup tab regardless of
whether the deploy succeeds — that is the actual safety net.

---

## 8. If you later split the agent out

Only worth doing if the agent exceeds ~30s, needs to run on a schedule, or must
be callable by other systems. It is a separate deployment (Lambda, Fargate, or
Bedrock AgentCore) plus a network call from the Next route. Nothing in the
current code needs it.
