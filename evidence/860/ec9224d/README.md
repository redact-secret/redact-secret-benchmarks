# Evidence: redact-secret#860 families and the Beta.11 candidate re-bound to product main ec9224d

> **Superseded** by [`../8b6a5fd/README.md`](../8b6a5fd/README.md): the candidate moved to product main `8b6a5fd` (PR #996,
> PII-only, output byte-identical); every family record and fixture outcome is identical there. This file stays as
> history and keeps the #948 analysis.

**Result:** candidate mode (product `ec9224d`, the re-bound Beta.11 candidate) reads **88 stable of 110** families
(documented 63, empirical 25; 20 provisional, 2 pending), the same families and profiles as at `8f97f14`. Published
mode (`@redact-secret/core` 0.1.0-beta.10) reads **61 stable of 110** (documented 38, empirical 23; 47 provisional, 2
pending), also the same families. This holds after the #948 contract change is recorded in the corpus
([`docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](../../../docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md)).
With the labels as they stood before that record, candidate mode read **55 stable**. The loss of those 33 families
is broken down below. The registry is pinned to `ec9224d`, and the pinned revision has an ACCEPTED performance
evaluation. Nothing here is a release claim.

This supersedes [`../8f97f14/README.md`](../8f97f14/README.md) as the current measurement; that file stays as history.
Parity and runtime: [`../381/README.md`](../381/README.md). No matched plaintext or example credential is retained here.

## Why the candidate moved

The maintainer decided that product PR #994 (merge `ec9224d9`) ships in Beta.11:

- **#948 (intended output change).** `generic-token` claims an off-grammar value under a provider-named credential
  variable (`OPENAI_API_KEY=`, `SENTRY_AUTH_TOKEN=`) at the generic floors (redact at 16 bytes and entropy 3.0, warn
  from 8). The amendment is to `decision-redact-provider-named-credential-assignments` (2026-09-29).
- **#993 (intended output change).** Placeholders, masks, elided displays, Make-escaped references, documented public
  keys and the Confluent key id are silent under every name.
- **#902.** PII context association is linear. Output is byte-identical by design.
- **#896.** Scripts and docs only.

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `ec9224d9743066fe73d6e61e9843ef52bd853833` (main: PR #994 merge), clean; declared 0.1.0-beta.10 |
| `redact-secret-benchmarks` | re-pin `af180a5abc28e64b456aa431455de66da016d061`; relabel `5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f` (both on branch `beta11/rebind-ec9224d-credentials`, clean); lockfile `14dbaa9e…3939` |
| Candidate artifacts (`benchmark:candidate`, darwin-arm64) | core `467111e288a3677e0e13d11f907a33e358a3161bfb1109f6115f80b16c33f74c`, node `9ceabe011fb58b259fe79bc9b25a0ba3b96b6cfc028d9257844207aaf0a083d6`, wasm `c3f5478881e3cac1d038543a331e5d4b3c47bceb076ab71d99f2c43f8d2c7d78` |
| Candidate run of record | `589527ab-8df1-4ae7-a517-26f7567ffb3b` at `5b03068`: complete, full suite, 4,777 fixtures, corpus `d88c19f7b57b61a484045851c28962b243c92e800b99fc49130fc4f6bb843e2f` ([`candidate-evidence-v1.json`](candidate-evidence-v1.json), `eval:validate` passed) |
| Candidate run, labels before the relabel | `2852d0eb-fcce-4025-864d-597636210c4d` at `af180a5`: complete, 4,768 fixtures, corpus `a89a8d11…6d75` ([retained original](https://github.com/redact-secret/redact-secret-benchmarks/blob/51d59f1bb27d0c2a129899fadd686e248412be82/evidence/860/ec9224d/candidate-evidence-v1-labels-af180a5.json); [verified archive](https://github.com/redact-secret/redact-secret-benchmarks/releases/tag/hygiene-before-cleanup-845-20261008)) |
| Classification of record (`5b03068`, clean) | candidate `aced36e8-2bb6-434c-84a2-ef2a84444a22` ([`support-status-candidate.json`](support-status-candidate.json)); published `3cef0f0c-0b23-4612-9b69-13dde0e38501` ([`support-status-published.json`](support-status-published.json)); fixture index `085358df…c29e`, taxonomy `86380e35…60dc` |
| Classification, labels before the relabel (`af180a5`, clean) | candidate `4dbd7c8a-99c9-4196-aca1-9de972e00006` ([`support-status-candidate-labels-af180a5.json`](support-status-candidate-labels-af180a5.json)) |
| Pinned peers | trufflehog 3.97.4, gitleaks 8.30.1 (`npm run peers:provision`, read-only `.peer-bin` first on `PATH`); snapshots refreshed at `5b03068` because the corpus changed |

## Changes since 8f97f14

### Fixture outcomes

Of the 4,768 fixtures in both the `8f97f14` run and the run with unchanged labels, **178 differ, and all are expected.**

| Change | Fixtures | Cause |
| --- | ---: | --- |
| Negative twin, scored: `clean`, 0 → 1 finding (`generic-token`, recorded as `coDetected`) | 146 | #948 |
| Negative twin, T0 disputed-property history: `observed`, 0 → 1 finding | 6 | #948 |
| Non-twin near-miss control under the provider's own variable: `clean` → `flagged:1` | 25 | #948 |
| `beta8-434b--trigger-dev-token-public-key-prefix-twin`: `clean`, 1 → 0 findings | 1 | #993 (documented `pk_` public key now silent) |

The 177 #948 fixtures are exactly the list and per-corpus counts of the product rescan (product
`docs/audits/evidence/948/README.md` at `ec9224d`). No positive's outcome, finding count or span changed, and no other
control changed.

After the relabel, the run of record differs from the `8f97f14` run as follows:

- the same 146 + 6 twins and the #993 twin;
- the 25 near-miss controls now read `policy/T3 EXACT` (24 redact and 1 warn, as authored from the floors);
- the nine new `beta8-948` replacement controls are all `clean`.

### Family status

| Mode | 8f97f14 | ec9224d, labels unchanged (`af180a5`) | ec9224d, #948 recorded (`5b03068`) |
| --- | --- | --- | --- |
| Candidate | 88 (documented 63, empirical 25) | **55** (documented 50, empirical 5) | 88 (documented 63, empirical 25) |
| Published (0.1.0-beta.10) | 61 (38, 23) | 61 (38, 23) | 61 (38, 23) |

With the labels unchanged, 33 families lost `stable` in candidate mode, for two reasons.

**22 families lost `stable` only because their twins now also get a generic finding.** In every case the twin's own
scoped assertion held: no typed finding for the twin's family. But each such twin raised a new differential row
(product `generic-token` against a silent peer) with no ledger decision, which counts as an unresolved contract
disagreement. Rows per family:

| Family | Rows | Family | Rows |
| --- | ---: | --- | ---: |
| github-token | 18 | langfuse-secret-key | 3 |
| grafana-cloud-access-policy-token | 14 | langsmith-api-key | 3 |
| sendgrid-token | 9 | neon-api-key | 3 |
| grafana-service-account-token | 7 | openrouter-api-key | 3 |
| new-relic-user-api-key | 7 | replicate-api-token | 3 |
| groq-api-key | 4 | xai-api-key | 3 |
| openai-token | 4 | confluent-cloud-api-secret | 2 |
| pinecone-api-key | 4 | fireworks-ai-api-key | 2 |
| atlassian-api-token | 3 | perplexity-api-key | 2 |
| databricks-personal-access-token | 3 | heroku-api-key | 1 |
| gitlab-token | 3 | notion-token | 1 |

**11 families lost `stable` because a near-miss control became a benign false alarm.** The metamorphic, mutation and
differential rows derived from the same controls came with it:

| Family | Benign false alarms | Metamorphic | Mutation | Differential |
| --- | ---: | ---: | ---: | ---: |
| heroku-api-key-legacy | 3 | 29 | 3 | 7 |
| mailgun-api-key | 2 | 22 | 2 | 14 |
| sentry-org-auth-token | 2 | 14 | 2 | 11 |
| sentry-user-auth-token | 2 | 14 | 2 | 7 |
| twilio-auth-token | 2 | 14 | 2 | 2 |
| datadog-api-key | 1 | 15 | 1 | 12 |
| travisci-api-token | 1 | 15 | 1 | 3 |
| discord-bot-token | 1 | 7 | 1 | 3 |
| telegram-bot-token | 1 | 7 | 1 | 7 |
| postman-api-key | 1 | 7 | 1 | 1 |
| twilio-api-key-secret | 1 | 7 | 1 | 1 |

The differential column includes those families' twin rows. mailchimp-api-key and
confluent-cloud-api-secret-legacy took the same kind of hits but were provisional already. Six more provisional
families gained twin differential rows only: anthropic-token, github-fine-grained-pat, okta-api-token,
slack-app-level-token, slack-user-token and stripe-webhook-signing-secret.

**How the decision handles them.** None of these is a product regression. Each is the amended product decision applied
to its own stated input, so the corpus records the contract change:

- **Twins, 152 fixtures and 170 rows.** No fixture changes. A twin's reading is already scoped to its own family, which
  is exactly "no typed provider finding; a generic finding is co-detection". The rows are resolved in the ledger with
  the co-detection classes used since redact-secret#702, each citing #948.
- **Near-miss controls, 25 fixtures.** Each moves from `must-not-flag`/T2 to `policy`/T3 on `generic-token`. The value
  is the authored span, and the action is authored from the floors. Their 31 candidate rows are resolved (the product
  matches the authored span exactly). Their 20 published rows stay open as the release gap.
- **Replacement controls, 9 fixtures in `beta8-948`.** These keep six families at their #206 cells.

After this, every family record equals `8f97f14` in both modes except for three kinds of change:

- the fixture counts of the eight families whose relabelled controls were not replaced. For example twilio-auth-token
  goes from 62 to 60 total fixtures and from 22 to 20 benign cases, and heroku-api-key-legacy from 65 to 62 and from
  27 to 24. Every cell is still met.
- **generic-token**, which gains the 25 policy positives:
  - Candidate mode: 68 of 68 exact, actions 62 redact and 6 warn, no unexpected action. It is still provisional, on the
    protected holdout, exactly as at `8f97f14`.
  - Published mode: 0.1.0-beta.10 predates #948, so the 25 read as misses there. That is 25 exact-span and 25
    leaked-span policy failures, 223 metamorphic, 25 mutation and 20 open differential rows. generic-token stays
    provisional, as it was.
- **Nothing else.** No family gained or lost status, profile or reasons in either mode, apart from generic-token's
  published reasons.

## Known gaps

The records were rerun from the run of record. Every record stays fixed and verified, and none of their fixtures is
among the 178. Per-record files:
[`../../911/`](../../911/), [`../../931/`](../../931/) to [`../../935/`](../../935/) and [`../../949/`](../../949/).
Product conformance at `ec9224d`:
[Artifact qualification run 36570726765](https://github.com/redact-secret/redact-secret/actions/runs/36570726765)
(success).

| Record | State | At 8f97f14 | At ec9224d |
| --- | --- | --- | --- |
| product-911 (untargeted benign shapes) | verified | 6 clean, 1 warn (`pytest-fake-fixtures`, policy) | same |
| product-931 (Mailchimp `-us<dc>`) | verified | 3/3 exact | 3/3 exact |
| product-932 (Deepgram/Cohere forms) | verified | 3/3 exact (the LiteLLM `masked_` line split to policy) | 3/3 exact; the split line still MISS |
| product-933 (previous-line context) | verified | 3/3 exact | 3/3 exact |
| product-934 (repeated-filler placeholders) | verified | 2/2 clean | 2/2 clean |
| product-935 (`postgresql+psycopg`) | verified | exact | exact |
| product-949 (Inngest/Resend placeholders) | verified | 3/3 clean | 3/3 clean |
| product-936 | policy-decision (unchanged) | New Relic and older keyword spans warn | same |

## Performance at the pin

`performance-evaluation.yml` run [36578221354](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36578221354)
is the evaluation of record. It was dispatched on this branch at `60aa582`, which carries the accepted rows below,
against candidate `ec9224d` and paired with baseline 0.1.0-beta.8 (`3144bb3`). The workflow concludes **success,
ACCEPTED**:

- Latency (10 rows), initialization (10) and memory (16) are all within budget, and the RC acceptance criteria all pass.
- The 3 flagged size rows read as accepted tradeoffs.
- Median processing ratios against beta.8 are 0.237–0.269 on the medium workloads and 0.223–0.839 on the small ones.
- The rust-core initialization ratio reads 1.85–2.17 on a median under 0.1 ms. That is below the trigger's 2 ms paired
  floor, so it is within budget, as at 8f97f14.

Reports: [`../ec9224d-verified/`](../ec9224d-verified/).

Earlier runs of the same candidate, kept for the record:

- [36570952406](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36570952406), before
  acceptance, dispatched at `af180a5`. It failed on the 3 size rows and on
  `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` (1.263 against 1.25 allowed). Its
  `wasm-sizes.json` and `quickstart-bundle.json` are the measurements the ledger rows cite, and they are byte-for-byte
  the sizes 36578221354 measured.
- [36577599714](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36577599714), at `60aa582`,
  failed on the same initialization row alone (1.597).
- Paired runs at `rounds=20` measured that row:
  - 8f97f14 → ec9224d: [36573672385](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573672385), [36573680137](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573680137), [36573688556](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573688556);
  - A/A: [36573696216](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573696216) (ec9224d), [36573704005](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573704005) (8f97f14);
  - beta.8 → ec9224d: [36578230121](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36578230121), [36578238482](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36578238482);
  - beta.8 → 8f97f14: [36578245944](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36578245944).

  Head to head, ec9224d is 0.900–1.019 times 8f97f14 on the row (pooled 0.992), so there is no shift. Against beta.8,
  both commits sit at about 1.1–1.25 on this row (ec9224d pooled 1.192 [1.104, 1.268]; 8f97f14 1.115 [1.030, 1.246]).
  With 12 samples a side, an official run breaches when its sample falls high. This was not recorded as an accepted
  tradeoff. **The headroom is thin, and this is flagged for the maintainer:**
  [`../ec9224d-verified/browser-init-paired.md`](../ec9224d-verified/browser-init-paired.md).

Rows recorded in `benchmarks/accepted-regressions.json` for candidate `ec9224d`. The sizes moved, so the 8f97f14 rows
were re-recorded under the maintainer's acceptance of the Beta.11 WASM and package growth, with PR #994 shipping in
Beta.11:

| Trigger | Baseline (0.1.0-beta.8) | At 8f97f14 | At ec9224d | Source |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 184,422 | 187,248 (+1.5%) | run 36570952406 `wasm-sizes.json` (36578221354 identical) |
| `size/wasm/common/gzip` | 100,058 | 125,295 | 127,661 (+1.9%) | run 36570952406 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 191,801 | 194,628 (+1.5%) | run 36570952406 `quickstart-bundle.json` |
| `size/npm/wasm/packed` | 254,413 | 887,249 | 917,465 (+3.4%) | candidate tarball, [`../ec9224d-verified/npm-packed-sizes.json`](../ec9224d-verified/npm-packed-sizes.json) |
| `size/npm/node-darwin-arm64/packed` | 424,514 | 635,892 | 655,692 (+3.1%) | candidate tarball |
| `size/node-addon/aarch64-apple-darwin` | 1,004,128 | 1,422,800 | 1,460,896 (+2.7%) | the `.node` binary inside that tarball |

The increment over 8f97f14 is PR #994, whose only core source changes are `generic_token.rs` and `text.rs` (#948,
#993) and `pii.rs` (#902). No per-change split was built. Not recorded:
`size/npm/core/packed` is within budget and unchanged (41,901; the core tarball is byte-identical to 8f97f14's). Native
addon, wheel and CLI rows for other targets were not built on this host. The node tarball is not byte-reproducible
across two builds of the same commit on this host (655,695 and 655,692 bytes). The run of record is used.

## Commands

```sh
npm run peers:provision && export PATH="$PWD/.peer-bin:$PATH"   # trufflehog 3.97.4, gitleaks 8.30.1
# product worktree at ec9224d (clean)
npm run benchmark:candidate -- --benchmark-ref 5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f \
  --benchmark-repo <redact-secret-benchmarks clone> --output-dir <dir>
# benchmarks worktree at 5b03068 (clean)
npm run eval:classify -- --candidate-package=<dir>/artifacts/redact-secret-core-0.1.0-beta.10.tgz \
  --candidate-node-package=<dir>/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --candidate-wasm-package=<dir>/artifacts/redact-secret-wasm-0.1.0-beta.10.tgz \
  --candidate-source-commit=ec9224d9743066fe73d6e61e9843ef52bd853833 --output=<dir>/support-status-candidate.json
npm run eval:classify -- --output=<dir>/support-status-published.json
# the labels-unchanged figures: the same two commands with --benchmark-ref af180a5… and a worktree at af180a5
# after a corpus change: npm run peers:snapshots:refresh (pinned peers), then npm run queue:check
gh workflow run performance-evaluation.yml --ref beta11/rebind-ec9224d-credentials -f candidate_revision=ec9224d9743066fe73d6e61e9843ef52bd853833
# paired/A-A check of one row: add -f baseline_revision=<commit> -f rounds=20
```

## Restoring the historical pre-relabel candidate

The pre-relabel JSON left HEAD under #849 after scoped runtime, organization-code and issue-reference review. Its canonical post-relabel sibling remains here. The retained tag keeps source `51d59f1bb27d0c2a129899fadd686e248412be82`; separate asset `evidence-860-pre-relabel-af180a5.json.gz` restores 1,663,484 original bytes with SHA256 `db98b4a699573c58a1843d9720639f446e2848921df589e5e749b52e11ffdad4`. A fresh release download and tag restoration both matched original Git bytes.

Run `node scripts/retention-inventory.mjs --ref 51d59f1bb27d0c2a129899fadd686e248412be82`, then `node scripts/restore-retained-file.mjs --fetch --file evidence/860/ec9224d/candidate-evidence-v1-labels-af180a5.json`. Output stays under ignored `results-output/retained/`. This historical darwin candidate never substitutes for a canonical official linux run.
