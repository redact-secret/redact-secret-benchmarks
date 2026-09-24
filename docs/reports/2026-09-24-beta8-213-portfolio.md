# Beta.8 #213: the 10 + 5 stable promotion portfolio

Issue [#213](https://github.com/redact-secret/redact-secret-benchmarks/issues/213)
asks for exactly 15 existing beta.7 families to reach `stable` in Beta.8: 10
efficiency candidates with the shortest independent paths and 5 market-value
candidates weighted toward runtime and AI-context exposure. The portfolio and
every gate that still binds it have to be published before remediation starts.
This page does that. It records measurements and does not claim anything about
product output (`AGENTS.md` boundary rule). No fixture, expectation, contract,
status criterion, profile or ledger row changed. The machine-readable companion
is [`2026-09-24-beta8-213-portfolio.json`](2026-09-24-beta8-213-portfolio.json).

Inputs: the [#207 re-measure](2026-09-24-beta8-207-remeasure.md), the
[#209 re-measure](2026-09-24-beta8-209-remeasure.md), `benchmarks/known-gaps.json`
(product-738 to product-747, and product-520 still `observed`), and
[the beta.7 results](beta-7/results.md).

## Measurement identities

All three runs are **published mode**: `@redact-secret/core` **0.1.0-beta.7**
from npm with default detectors, not a candidate build. The peers were gitleaks
8.30.1 and trufflehog **3.97.4**, with the Homebrew keg first on `PATH`.
`trufflehog --version` was printed in the same shell as every classification
and queue run.

| Field | Value |
| --- | --- |
| Product | `@redact-secret/core` 0.1.0-beta.7, npm `gitHead` `2b98027bbf38d63f07b75129fe2864ef32ed4732` |
| Artifacts (lock integrity) | core `sha512-3qjqKpmj8APb…A17yQ==`, wasm `sha512-dgTi+xGTc2kv…hhyurQ==`, node-darwin-arm64 `sha512-q5r31KQNZIjL…70eYKHg==` (full values in the JSON) |
| Lock | `package-lock.json` SHA-256 `cbbb00a192cf384857e286d9e81a8851bb43797d47410a0618e21690ff050363` |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 |
| Criteria | `status-criteria.json` schema 1, `fixture-profiles.json` profiles version 1 |

| Run | Benchmark commit | `eval:classify` run id | Cases / variants | Result (of 57) |
| --- | --- | --- | --- | --- |
| Beta.7 publication, pre-#239 criteria | `021b074` (#237 merge) | `42eb75b2-6116-430b-9725-3cfada3c25a1` | 4,444 / 11,917 | 34 stable, 21 provisional, 2 pending |
| **Frozen beta.7 baseline, Beta.8 criteria** | `d5438c5` (#239 merge) | `dfb3d9de-a9c7-423e-b02d-00d54faca2b1` | 4,444 / 11,917 | **0 stable**, 55 provisional, 2 pending |
| **Portfolio measurement** | `102f7e4` (this branch, clean tree) | `44039078-2c49-4d40-9b0c-0a9b0677cabd` | 7,037 / 17,953 | **4 stable** (documented 4, empirical 0), 52 provisional, 1 pending |

The first two were run from a detached worktree of this repository at the
named commit (`npm ci`, fixtures regenerated). All three reproduce the counts
already recorded in [beta-7/results.md](beta-7/results.md) and the #209
re-measure. At `102f7e4` the review queue has 4,161 ids and every one has a
ledger row. That is the `queue:check` condition. The per-family open-row counts
below come from that same evaluation.

## Baseline and what "newly reach stable" means

The first two rows of the run table use the same package and the same corpus.
The 34 → 0 change comes entirely from #239 (#177), which added the
documented-profile floors to `status-criteria.json`. No detector changed.

**The definition used here:** the frozen beta.7 baseline is the published
0.1.0-beta.7 package measured under the Beta.8 status criteria at `d5438c5`,
where 0 of 57 are stable. A family *newly reaches stable* when a clean
`eval:classify` (published, or the final candidate) reads it `stable` with
`qualificationProfile` `documented` or `empirical`. Two sources support this
reading. redact-secret#576's selection rule says "the exact families are
selected only after the new criteria measure the beta.7 baseline", and
[beta-7/results.md](beta-7/results.md) names that re-evaluation as "the beta.8
input that must precede #213's 15-family portfolio selection".

Three consequences need a maintainer's confirmation before remediation starts:

1. **The four families already stable are outside the 15.** Those are
   `anthropic-token`, `azure-devops-personal-access-token`,
   `datadog-application-key` and `notion-token`. They reached stable through
   the #209 fixtures (#238), not through #213 work. They form the
   no-regression set for this portfolio. If a maintainer decides they count
   toward the 15, only 11 more are needed. In that case drop the last-ranked
   picks (E10 cloudflare-token, E9 npm-token, M5 huggingface-token, E8
   linear-token) and keep the 10 + 5 shape for the record.
2. **Under the other reading the target is not reachable from measured
   evidence.** That reading takes the baseline as the 34 families stable at
   beta.7 publication. Every pick below is one of those 34, so none of them
   would count as new. The families not stable at publication are 23. Four
   are T3 and cannot be stable, `vercel-token` is T0, and `supabase-token`
   needs product fix #742 plus a classification-granularity decision. That
   leaves 17 T2 families. Each one needs at least five provider-issued
   observations from two subjects on two dates, and today no T2 family has
   any. Reaching 15 would take at least 14 of those 17: about 70 credentials
   issued by a maintainer. It would also include the two legacy families
   (Heroku, Confluent) that can no longer be issued. The measured pool cannot
   support 15 plausible candidates under that reading.
3. **The "no regression" criterion is read against the Beta.8-criteria
   baseline.** 30 of the 34 legacy-stable families already read provisional.
   That is the criteria change from #239, not a product regression: at
   `d5438c5` every one of the 34 is held only by `documented.*` floor reasons.
   Only later did the #209 fixtures surface product findings on google,
   heroku and confluent. The #206 decision states the same principle when it
   keeps `stable-documented` at `enforcement: reported`.

## Eligible pool

Of the 57 registered detector families at the beta.7 registry pin (`2b98027`,
unchanged since beta.7):

- 4 are already stable, as listed above.
- 4 are T3 (`bearer-token`, `connection-string`, `generic-token`,
  `otpauth-uri`). `status-criteria.json` makes T3 ineligible for either
  profile.
- **49 are eligible**: 31 T1 on the documented route, 17 T2 on the empirical
  route and 1 T0 (`vercel-token`, pending).

Arrival families from #208 and #210–#212 (Replicate, Groq, xAI, OpenRouter,
LangSmith, Langfuse, GitHub fine-grained PAT, Slack app/user tokens, Stripe
webhook secret, Notion `ntn_`, Perplexity, Fireworks, Pinecone ×2, GitLab
runner) are new in Beta.8. They have no product detector at the pin and no
support status (`eval:classify` skips arrival ids), so they are excluded.

## How the table was read

- **Route** is the one the tier gives. T1 goes `documented` and T2 goes
  `empirical`. No provenance was changed, and no family was reclassified.
- **Binding floor debt** is the `documented.*` / `empirical.*` fixture-floor
  reasons that `eval:classify` reports today. Those decide status.
- **#206 debt** is the #206 counter (`benchmarks/support/profiles.ts`, the
  cells in `docs/generated/fixture-profile-coverage.json`). It is measured
  against the profile the family would qualify under: `stable-documented` for
  T1, `stable-empirical` for T2, and `context-constrained-empirical` for the
  four context-gated T2 families. This counter governs, per the #207/#209
  re-measures. `beta8:profiles` is advisory and not used. The debt binds
  nothing today, because `stable-documented` is `enforcement: reported` and
  no contract claims `fixtureProfile`. It will bind when the #206 ratchet
  flips, so the portfolio is sized to clear it too.
- **Behaviour gates** are the counts `eval:classify` reports: twin failures,
  benign false alarms, metamorphic critical failures, unresolved critical
  mutations and unresolved differential disagreements. Stable needs all five
  at 0.
- **Est. fixtures** is a computed lower bound on the fixtures still to author.
  One new control can clear both a control count and a control axis. One new
  positive on a new context can clear both a positive count and a positive
  axis. A twin pair counts as 2. It is not a promise. Every new fixture gets a
  first run, and any product miss or false alarm on it is kept and becomes a
  finding.
- **Blockers** fall into four classes: `benchmark` (benchmark-side authoring
  debt that an agent or benchmark maintainer can clear), `observation`
  (human-only #205 capture with credentials a maintainer issues), `product`
  (a product fix, with its redact-secret issue), and `decision` (a human
  decision that is still pending).
- **Exposure is a judgement, not a measurement.** The repo has no exposure
  metadata, and the taxonomy carries only descriptions and sources. Rubric,
  H=3, M=2, L=1:
  - Runtime: H if a deployed service reads it at request time; M if
    operator/management APIs and scripts use it; L if it is used only in
    developer, CI, publish or IaC work.
  - AI-context: H if it authenticates an AI/ML inference or model service
    (OpenAI; Hugging Face; Google `AIza` keys, which are also the Gemini API
    key format), or if it is routinely handed to coding agents as their own
    tool credential (source control, issue tracker, chat); M if it normally
    lives in the application `.env`/config files an agent reads; L otherwise.
  - Credential impact: H for account-, org- or infrastructure-wide control,
    money movement, identity or supply-chain publish; M for service-scoped
    read/write or messaging; L for ingest-only or telemetry keys.
  - Score = 2·runtime + 2·AI-context + impact. The per-family letters are in
    the JSON (`exposureJudgement`). Changing a letter can reorder the
    market-value list. It cannot move an efficiency pick, because that list
    uses no judgement.

Column key: "Pick" is `E`n (efficiency rank), `M`n (market-value rank), or
`-alt` (alternate). The status chain is legacy beta.7 publication → frozen
Beta.8-criteria baseline → now.

## Full eligible pool (49 families, published mode, `102f7e4`)

### T1 · documented route, benchmark-side debt only (27)

| Family | Pick | Status (legacy → baseline → now) | Binding floor debt | #206 debt (intended profile) | Twin / benign FA / metamorphic / mutation / differential | Open rows | Known gaps | Exposure R/AI/I (score) | Est. fixtures (floors / +#206) | Blockers |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| sendgrid-token | E1 | stable → provisional → provisional | control axes 3/4 | control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | #404 | H/M/M (12) | 1 / 1 | benchmark |
| microsoft-entra-client-secret | E2 | stable → provisional → provisional | controls 7/8; control axes 3/4 | positives 0/6; controls 7/8; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/M/H (13) | 1 / 7 | benchmark |
| github-token | E3 | stable → provisional → provisional | controls 6/8; control axes 3/4 | controls 6/8; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/H/H (13) | 2 / 2 | benchmark |
| slack-token | E4 | stable → provisional → provisional | positive axes 3/4; control axes 3/4 | positive axes 2/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/H/M (14) | 2 / 3 | benchmark |
| aws-access-key | E5 | stable → provisional → provisional | controls 6/8; control axes 3/4 | total 22/24; positives 4/6; controls 6/8; positive axes 3/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/M/H (13) | 2 / 4 | benchmark |
| digitalocean-token | E6 | stable → provisional → provisional | positive axes 2/4; control axes 3/4 | positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/H (9) | 3 / 4 | benchmark |
| docker-token | E7 | stable → provisional → provisional | positive axes 2/4; controls 7/8; control axes 3/4 | positives 3/6; controls 7/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/L/H (7) | 3 / 4 | benchmark |
| linear-token | E8 | stable → provisional → provisional | positive axes 2/4; control axes 3/4 | total 23/24; positives 3/6; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/H/M (10) | 3 / 4 | benchmark |
| npm-token | E9 | stable → provisional → provisional | positive axes 3/4; controls 6/8; control axes 3/4 | total 20/24; controls 6/8; positive axes 2/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/L/H (7) | 3 / 4 | benchmark |
| cloudflare-token | E10 | stable → provisional → provisional | positives 5/6; positive axes 2/4; control axes 3/4 | total 19/24; positives 3/6; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/M/H (11) | 3 / 5 | benchmark |
| gitlab-token | M1 | stable → provisional → provisional | positive axes 3/4; controls 6/8; control axes 3/4 | total 21/24; positives 3/6; controls 6/8; positive axes 2/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/H/H (13) | 3 / 5 | benchmark |
| pypi-token | E-alt1 | stable → provisional → provisional | positives 3/6; positive axes 1/4 | total 20/24; positives 0/6; positive axes 1/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/L/H (7) | 3 / 6 | benchmark |
| huggingface-token | M5 | stable → provisional → provisional | positives 5/6; positive axes 2/4; controls 7/8; control axes 3/4 | total 19/24; positives 0/6; controls 7/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/H/M (12) | 3 / 7 | benchmark |
| datadog-api-key | E-alt2 | stable → provisional → provisional | controls 5/8; control axes 3/4 | positives 0/6; controls 5/8; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/L (9) | 3 / 9 | benchmark |
| grafana-cloud-access-policy-token | E-alt3 | stable → provisional → provisional | controls 5/8; control axes 3/4 | positives 0/6; controls 5/8; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/M (8) | 3 / 9 | benchmark |
| grafana-service-account-token | E-alt4 | stable → provisional → provisional | controls 5/8; control axes 3/4 | positives 0/6; controls 5/8; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/M (8) | 3 / 9 | benchmark |
| new-relic-user-api-key | E-alt5 | stable → provisional → provisional | controls 5/8; control axes 3/4 | positives 0/6; controls 5/8; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/M (8) | 3 / 9 | benchmark |
| pulumi-access-token |  | stable → provisional → provisional | positive axes 1/4; controls 6/8; control axes 3/4 | total 21/24; positives 3/6; controls 6/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/L/H (7) | 5 / 5 | benchmark |
| terraform-cloud-token |  | stable → provisional → provisional | positive axes 1/4; controls 6/8; control axes 3/4 | total 21/24; positives 3/6; controls 6/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/L/H (7) | 5 / 5 | benchmark |
| netlify-token |  | stable → provisional → provisional | positive axes 1/4; controls 6/8 | total 18/24; positives 3/6; controls 6/8; positive axes 1/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | L/L/M (6) | 5 / 6 | benchmark |
| private-key | M2 | stable → provisional → provisional | positive axes 2/4; controls 5/8; control axes 3/4 | controls 5/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/M/H (13) | 5 / 6 | benchmark |
| shopify-token | M3 | stable → provisional → provisional | positive axes 2/4; controls 5/8; control axes 3/4 | total 21/24; controls 5/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/M/H (13) | 5 / 6 | benchmark |
| stripe-token | M4 | stable → provisional → provisional | positive axes 2/4; controls 5/8; control axes 3/4 | controls 5/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/M/H (13) | 5 / 6 | benchmark |
| vault-token |  | stable → provisional → provisional | positive axes 2/4; controls 5/8; control axes 3/4 | total 22/24; controls 5/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/H (11) | 5 / 6 | benchmark |
| jwt | M-alt1 | stable → provisional → provisional | positives 5/6; positive axes 2/4; controls 5/8 | total 17/24; positives 0/6; controls 5/8; positive axes 1/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/M/M (12) | 5 / 9 | benchmark |
| new-relic-license-key |  | stable → provisional → provisional | positive axes 1/4; controls 5/8; control axes 3/4 | total 20/24; positives 0/6; controls 5/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/L (9) | 6 / 9 | benchmark |
| supabase-management-token |  | stable → provisional → provisional | positive axes 1/4; controls 5/8; control axes 3/4 | total 17/24; positives 0/6; controls 5/8; positive axes 1/4; control axes 3/4 | 0 / 0 / 0 / 0 / 0 | 0 | — | M/M/H (11) | 6 / 9 | benchmark |

### T1 · documented route, held by a product fix or a decision (4)

| Family | Pick | Status (legacy → baseline → now) | Binding floor debt | #206 debt (intended profile) | Twin / benign FA / metamorphic / mutation / differential | Open rows | Known gaps | Exposure R/AI/I (score) | Est. fixtures (floors / +#206) | Blockers |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| supabase-token | M-alt4 | pending → pending → provisional | none | positives 5/6 | 3 / 0 / 0 / 6 / 8 | 8 | #742 | H/M/H (13) | 0 / 1 | product + decision |
| google-api-key | M-alt3 | stable → provisional → provisional | none | positives 1/6 | 0 / 0 / 7 / 3 / 1 | 1 | #520 (observed) | H/H/M (14) | 0 / 5 | decision |
| heroku-api-key | E-alt6 | stable → provisional → provisional | none | positives 1/6 | 2 / 0 / 14 / 4 / 2 | 2 | #740 | M/L/H (9) | 0 / 5 | product |
| confluent-cloud-api-secret |  | stable → provisional → provisional | none | positives 0/6 | 4 / 0 / 7 / 8 / 10 | 10 | #738, #739 | H/L/M (10) | 0 / 6 | product + decision |

### T2 · empirical route (17)

| Family | Pick | Status (legacy → baseline → now) | Binding floor debt | #206 debt (intended profile) | Observation debt | Twin / benign FA / metamorphic / mutation / differential | Open rows | Known gaps | Exposure R/AI/I (score) | Est. fixtures (floors / +#206) | Blockers |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| confluent-cloud-api-secret-legacy |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 1 / 7 / 1 / 7 | 7 | #744 | H/L/M (10) | 0 / 0 | observation + product + decision |
| discord-bot-token |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/M (10) | 0 / 0 | observation |
| heroku-api-key-legacy |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 1 / 21 / 3 / 2 | 2 | #743 | M/L/H (9) | 0 / 0 | observation + product |
| sentry-org-auth-token |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | L/M/M (8) | 0 / 0 | observation |
| sentry-user-auth-token |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | L/H/M (10) | 0 / 0 | observation |
| telegram-bot-token |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/M (10) | 0 / 0 | observation |
| twilio-api-key-secret |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 1 / 7 / 1 / 1 | 1 | #746 | H/L/M (10) | 0 / 0 | observation + product |
| twilio-auth-token |  | provisional → provisional → provisional | none | none | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 1 / 7 / 1 / 2 | 2 | #744 | H/L/H (11) | 0 / 0 | observation + product |
| atlassian-api-token |  | provisional → provisional → provisional | none | positives 5/10 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 5 / 1 / 77 / 56 / 22 | 22 | #741, #747 | M/H/M (12) | 0 / 5 | observation + product |
| firebase-server-key |  | provisional → provisional → provisional | none | positives 5/10 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/M (10) | 0 / 5 | observation |
| databricks-personal-access-token |  | provisional → provisional → provisional | positives 6/10; positive axes 1/6; controls 6/14; control axes 4/5 | total 21/40; positives 0/10; controls 6/14; positive axes 1/6; control axes 4/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | M/M/H (11) | 13 / 19 | benchmark + observation |
| mailgun-api-key |  | provisional → provisional → provisional | positives 6/10; positive axes 1/6; controls 6/14; control axes 4/5 | total 21/40; positives 3/10; controls 6/14; positive axes 1/6; control axes 4/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/M (10) | 13 / 19 | benchmark + observation |
| okta-api-token |  | provisional → provisional → provisional | positives 6/10; positive axes 1/6; controls 6/14; control axes 4/5 | total 21/40; positives 0/10; controls 6/14; positive axes 1/6; control axes 4/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/H (9) | 13 / 19 | benchmark + observation |
| openai-token | M-alt2 | provisional → provisional → provisional | positive axes 2/6; controls 7/14; control axes 3/5; twin pairs 6/8 | total 28/40; positives 9/10; controls 7/14; twin pairs 6/8; positive axes 1/6; control axes 3/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | H/H/M (14) | 15 / 16 | benchmark + observation |
| postman-api-key |  | provisional → provisional → provisional | positives 3/10; positive axes 1/6; controls 6/14; control axes 4/5 | total 18/40; positives 0/10; controls 6/14; positive axes 1/6; control axes 4/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | L/M/M (8) | 15 / 22 | benchmark + observation |
| mailchimp-api-key |  | provisional → provisional → provisional | positives 6/10; positive axes 1/6; controls 6/14; control axes 4/5; twin pairs 6/8 | total 18/40; positives 0/10; controls 6/14; twin pairs 6/8; positive axes 1/6; control axes 4/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | H/L/M (10) | 17 / 22 | benchmark + observation |
| datadog-application-key-legacy |  | provisional → provisional → provisional | controls 5/14; control axes 3/5; twin pairs 3/8 | total 19/40; positives 8/10; controls 5/14; twin pairs 3/8; control axes 3/5 | 0/5 obs, 0/2 subjects, 0/2 dates, 0/2 classes; mode, uncertainty, contexts | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/M (8) | 19 / 21 | benchmark + observation |

### T0 · pending (1)

| Family | Pick | Status (legacy → baseline → now) | Binding floor debt | #206 debt (intended profile) | Twin / benign FA / metamorphic / mutation / differential | Open rows | Known gaps | Exposure R/AI/I (score) | Est. fixtures (floors / +#206) | Blockers |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| vercel-token |  | pending → pending → pending | none | none | 0 / 0 / 0 / 0 / 0 | 0 | — | M/L/H (9) | 0 / 0 | benchmark |

`vercel-token` is T0. No positive has cleared review, so no floor applies
yet. A reviewed contract has to come first (benchmark research and review),
and it is not a candidate.

What the pool shows:

- **27 families are held only by benchmark-side authoring debt.** All 27 are
  T1 on the documented route, all 27 were stable at beta.7 publication, and
  every behaviour gate reads 0 for them. The #206 counter and the binding
  counter disagree on only one point: the documented floor counts
  twin-anchored positives and #206 does not. So #206 shows more positive debt
  on most of them.
- **4 T1 families are held by product fixes or decisions.** `heroku-api-key`
  waits on #740. `supabase-token` waits on #742 plus a classification-policy
  decision. `google-api-key` waits on the #520 B3a decision.
  `confluent-cloud-api-secret` waits on #738, #739 and two decisions.
- **Every T2 family needs human-only observation.** No
  `benchmarks/support/empirical-observations.json` record exists. On top of
  that, 5 need product fixes (#741/#747, #743, #744 ×2, #746), 7 carry
  empirical-40 fixture debt (13–19 fixtures each), and the two legacy
  families cannot get new issuance. For the four context-gated families,
  `benchmarks/support/evidence.ts` counts context twins only in
  `context-edges`. So `empirical.contextConstrained.minimumContextTwinPairs`
  (10) will read 0 once a mode is chosen, even though #206 counts the
  `beta8-207` context twins (see the #207 re-measure). That is a
  benchmark-side code follow-up.

## Shared-detector and shared-fix efficiency

Every registry family has its own detector, so no two candidates share a
detector fix. The efficiency is in shared work:

- **One authoring batch clears most of the documented debt.** Of the 27
  benchmark-only families, 24 miss a fourth control axis. Each has
  near-miss, placeholder and reference, and lacks public-identifier,
  ordinary-prose or encoded-value. 21 are short of controls and 19 are short
  of positive axes. One new beta8 corpus module can carry all of it without
  touching any other corpus's hash (`docs/specs/beta8-evidence.md`).
- **Shared providers share research and controls.** The pairs are
  grafana-cloud-access-policy / grafana-service-account, new-relic-license /
  new-relic-user, supabase-token / supabase-management, and datadog-api-key
  with datadog-application-key and its legacy key. A public-identifier or
  near-miss control from the same provider can be authored once per provider.
- **One detector covers several taxonomy families.** github-token covers 5
  taxonomy families; stripe-token 4; digitalocean-token, vault-token,
  terraform-cloud-token and pulumi-access-token 3 each; docker-token and
  shopify-token 2 each. Status is per detector, so promoting one of these
  covers every taxonomy family it maps.
- **Shared product fixes:** #744 covers twilio-auth-token and
  confluent-cloud-api-secret-legacy. The generic-token collateral
  (#739, #746) touches confluent-cloud-api-secret and twilio-api-key-secret.
  A single classification-granularity policy decision closes rows on
  supabase-token (3), confluent-cloud-api-secret (3) and
  confluent-cloud-api-secret-legacy (5), and on 7 arrival-family rows.

## Portfolio

### Efficiency: 10 shortest independent paths

The ranking uses only measured data. The key is the lower bound on fixtures
needed to clear the binding floors, then the bound that also clears the #206
intended profile, then the name. Only families whose remaining gates are all
benchmark-side qualify, because any product or human dependency makes a path
non-independent. Every pick is **T1 `documented`**, provider-documented, and
was stable at beta.7 publication. For every pick all five behaviour gates read
0, it has 0 open ledger rows, and it has no `observed` or unresolved
`promoted` finding that binds the classifier.

| # | Family | Route | Binding gates still open (who clears) | #206 debt to clear too (not binding yet) | Est. fixtures |
| ---: | --- | --- | --- | --- | --- |
| E1 | sendgrid-token | documented | control axes 3/4 (benchmark) | none beyond the axis | 1 / 1 |
| E2 | microsoft-entra-client-secret | documented | controls 7/8; control axes 3/4 (benchmark) | 6 standalone positives | 1 / 7 |
| E3 | github-token | documented | controls 6/8; control axes 3/4 (benchmark) | none beyond the floors | 2 / 2 |
| E4 | slack-token | documented | positive axes 3/4; control axes 3/4 (benchmark) | positive axes 2/4 by group | 2 / 3 |
| E5 | aws-access-key | documented | controls 6/8; control axes 3/4 (benchmark) | total 22/24; positives 4/6; positive axes 3/4 | 2 / 4 |
| E6 | digitalocean-token | documented | positive axes 2/4; control axes 3/4 (benchmark) | positive axes 1/4 by group | 3 / 4 |
| E7 | docker-token | documented | positive axes 2/4; controls 7/8; control axes 3/4 (benchmark) | positives 3/6; positive axes 1/4 | 3 / 4 |
| E8 | linear-token | documented | positive axes 2/4; control axes 3/4 (benchmark) | total 23/24; positives 3/6; positive axes 1/4 | 3 / 4 |
| E9 | npm-token | documented | positive axes 3/4; controls 6/8; control axes 3/4 (benchmark) | total 20/24; positive axes 2/4 | 3 / 4 |
| E10 | cloudflare-token | documented | positives 5/6; positive axes 2/4; control axes 3/4 (benchmark) | total 19/24; positives 3/6; positive axes 1/4 | 3 / 5 |

Notes on the efficiency picks:

- **sendgrid-token:** `product-404` and `product-428-sendgrid` are still
  `promoted` in `known-gaps.json`, but redact-secret#404 and #428 are both
  closed, and neither record binds the classifier today (all five behaviour
  gates are 0). Moving them to `fixed` is a `promote-finding` pass for the
  benchmark, not a gate.
- **microsoft-entra-client-secret:** it has 17 twin pairs and 14 positives,
  but none of the positives is standalone. So #206 reads 0/6 positive cases.
  The binding path is one control. Clearing #206 as well takes six twin-free
  positives.
- **E10 tie:** cloudflare-token and gitlab-token tie at 3 / 5.
  cloudflare-token takes E10 by name order. gitlab-token then goes to the
  market-value list on its exposure score, so neither is dropped.

### Market value: 5 picks weighted to runtime and AI-context exposure

These are chosen from the families that remain after the 10 efficiency picks,
by the exposure score above (a judgement). Only families with a benchmark-only
path qualify. Ties go to the shorter measured path. Every pick is **T1
`documented`**.

| # | Family | Route | Exposure R/AI/I (score) | Binding gates still open (who clears) | #206 debt to clear too | Est. fixtures |
| ---: | --- | --- | --- | --- | --- | --- |
| M1 | gitlab-token | documented | M/H/H (13): coding-agent tool credential, repository and CI control | positive axes 3/4; controls 6/8; control axes 3/4 (benchmark) | total 21/24; positives 3/6; positive axes 2/4 | 3 / 5 |
| M2 | private-key | documented | H/M/H (13): TLS, SSH and signing keys read by running services | positive axes 2/4; controls 5/8; control axes 3/4 (benchmark) | positive axes 1/4 by group | 5 / 6 |
| M3 | shopify-token | documented | H/M/H (13): store admin API at runtime, customer and order data | positive axes 2/4; controls 5/8; control axes 3/4 (benchmark) | total 21/24; positive axes 1/4 | 5 / 6 |
| M4 | stripe-token | documented | H/M/H (13): payment API at runtime, money movement; covers 4 taxonomy families | positive axes 2/4; controls 5/8; control axes 3/4 (benchmark) | positive axes 1/4 by group | 5 / 6 |
| M5 | huggingface-token | documented | M/H/M (12): model and inference platform, often in AI application `.env` | positives 5/6; positive axes 2/4; controls 7/8; control axes 3/4 (benchmark) | total 19/24; positives 0/6 standalone; positive axes 1/4 | 3 / 7 |

Together the 15 need at least **44 new fixtures** to clear the binding floors
and **68** to also clear #206's `stable-documented` cells. Clearing all 27
benchmark-only families would take at least 96 and 159.

### Who clears what, for all 15

- **Benchmark (agent or benchmark maintainer):** author the missing controls
  and positives in a new beta8 corpus module. Run the first measurement.
  Triage the new differential and mutation review-queue ids in
  `benchmarks/review-ledger.json` so that `queue:check` passes. Re-run
  `eval:classify` with trufflehog 3.97.4 and state the mode. This is the only
  class of gate open on any of the 15 today.
- **Product fix:** none is open today. A product fix becomes a gate only if
  a newly authored fixture fails on its first run. That failure is kept and
  goes through `promote-finding`. It is never deleted to hit the target.
- **Maintainer observation:** none. #205 observations apply to T2 only.
- **Human decision:** two are needed before remediation, and neither is
  specific to one family. One is the baseline definition and whether the four
  #209 families count toward the 15 (see above). The other is whether #206's
  `stable-documented` enforcement flips during Beta.8. If it flips, the
  "+#206" column becomes binding.

### Alternates, in the order to use them

| Alt | Family | Route | Why it is not a pick | Open gates (who clears) |
| --- | --- | --- | --- | --- |
| E-alt1 | pypi-token | documented | next shortest (3 / 6), low exposure (7) | positives 3/6; positive axes 1/4 (benchmark) |
| E-alt2 | datadog-api-key | documented | 3 / 9 | controls 5/8; control axes 3/4 (benchmark); #206 wants 6 standalone positives |
| E-alt3 | grafana-cloud-access-policy-token | documented | 3 / 9; shares research with E-alt4 | controls 5/8; control axes 3/4 (benchmark) |
| E-alt4 | grafana-service-account-token | documented | 3 / 9 | controls 5/8; control axes 3/4 (benchmark) |
| E-alt5 | new-relic-user-api-key | documented | 3 / 9 | controls 5/8; control axes 3/4 (benchmark) |
| E-alt6 | heroku-api-key | documented | no floor debt, but depends on a product fix | redact-secret#740 fix, then a fixed-candidate rerun that shows both `-g1` positives exact; 2 open differential rows (product, then benchmark); #206 positives 1/6 |
| M-alt1 | jwt | documented | score 12, path 5 / 9 (longer than huggingface-token) | positives 5/6; positive axes 2/4; controls 5/8 (benchmark) |
| M-alt2 | openai-token | **empirical** (T2 stays T2) | highest AI-context exposure (14), but blocked on human-only observation | 5 observations / 2 projects / 2 dates, 2 corroboration classes, mode, uncertainty, contexts (maintainer); positive axes 2/6, controls 7/14, control axes 3/5, twin pairs 6/8 (benchmark) |
| M-alt3 | google-api-key | documented | exposure 14 (the `AIza` format is also the Gemini key format), but a human decision is pending | redact-secret#520 B3a decision (human); then promote or record an exclusion, plus 7 metamorphic, 3 mutation and 1 differential (product or benchmark, depending on the decision) |
| M-alt4 | supabase-token | documented | 13, but needs a product fix and a policy decision | redact-secret#742 (product); classification-granularity decision for 3 rows (human); #206 positives 5/6 (benchmark) |

## Risks that can still move the count

- **First-run failures.** Each pick adds 1–7 new fixtures, and the product
  runs on them for the first time. A new control that the product flags, or
  a new positive it misses, adds a product gate. Use the alternates in order.
  Do not drop the failing fixture.
- **"Exactly 15."** Status is measured per family. The 12 benchmark-only
  families outside the portfolio stay provisional only because nobody
  authors their debt. If a shared batch is authored for more families than
  selected, the measured stable count can go above 15. Keep the remediation
  batch scoped to the selected families.
- **The two counters.** Status follows the documented floors in
  `status-criteria.json`, which count twin-anchored positives. #206 does not
  count them. Author standalone positives on new context axes so both
  counters clear.
- **Regression guard.** The four stable families have no behaviour failure
  today. azure-devops-personal-access-token, datadog-application-key and
  notion-token each carry #206 positive debt of 5, which binds only if
  enforcement flips. anthropic-token carries none. Beta.7 T1/T2 leaked spans
  are 0/306 and 0/89 ([beta-7/results.md](beta-7/results.md)).

## What is not done

- No fixture, contract, expectation, profile claim, status criterion or
  ledger row was changed. No known-gap record was moved.
- No product code, product issue or product PR.
- The exposure letters are a judgement and are labelled as one. The
  efficiency list uses no judgement.
- The final candidate qualification (#214 and redact-secret#731) is out of
  scope. That record has to repeat the product, benchmark, artifact, lock and
  peer identities above for the candidate build.

## Gates (this change)

These pass on `102f7e4` plus this report. No local `results-output/`
existed, so `tests/classify-support.test.mjs` needed no workaround.

- `npx tsc --noEmit`;
- `npm test` (470/470);
- `npm run fixtures:check`;
- `npm run profiles:check` (73 families, 3 generated files, no drift);
- `npm run queue:check`, with trufflehog 3.97.4 printed in the same shell.
