# Beta.8 arrival families: candidate re-measure on product `main` (#208, #210, #211, #212)

Issues: [#208](https://github.com/redact-secret/redact-secret-benchmarks/issues/208),
[#210](https://github.com/redact-secret/redact-secret-benchmarks/issues/210),
[#211](https://github.com/redact-secret/redact-secret-benchmarks/issues/211),
[#212](https://github.com/redact-secret/redact-secret-benchmarks/issues/212).
Product counterparts: redact-secret/redact-secret#727, #728, #729 and #730. All
four are merged on product `main`; #730 landed through PR #763 (`f2082ab`).
First runs, all in published mode against `@redact-secret/core` 0.1.0-beta.7:
[#208](2026-09-24-beta8-208-first-run.md), [#210](2026-09-24-beta8-210-first-run.md),
[#211](2026-09-24-beta8-211-first-run.md), [#212](2026-09-24-beta8-212-first-run.md).

This report measures and records. It asserts no product output. Differential
results against gitleaks and trufflehog are observations, not ground truth.

## Measurement identity

| Item | Value |
| --- | --- |
| Product | redact-secret `main` at `4f9266580536c8e37f60be0b415e57fa284e04cd`, which includes #727–#730 |
| Benchmarks | `61347d79328aa9f67ebfef4ba9420781f0532566` for `benchmark:candidate`; `7a142fdfb96ddae65301ac88aa5ebccb9f0da74d` (this branch after the ledger triage, clean tree) for the candidate `eval:classify` |
| Candidate core tarball | `8b6e759b98201ebfed797a5389eca57a3aa52fef1bc96783d522c60418662520` |
| Candidate node-darwin-arm64 tarball | `6fc68e49977f5465af2fdac41ba952d2998ef419f1961b3f791133205f2b0d5f` |
| Candidate wasm tarball | `09726fc1908e4ed0f3ed3188618ade451f604d43fb9e60c869bd4c7495581969` |
| Lock hash | `cbbb00a192cf384857e286d9e81a8851bb43797d47410a0618e21690ff050363` |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 (the pinned keg first on `PATH`, printed in the same command as each run) |
| Cases / variants | 8526 / 22213 |
| `benchmark:candidate` run (`eval:candidate`, fixed + expanded corpora) | `3e1bf4c6-fc80-471b-9391-563f58ad679b` |
| Candidate `eval:classify` run | `b738d57d-3aa3-4d2a-ba83-1a02a7ee3d99` |
| Published `eval:classify` run (`@redact-secret/core` 0.1.0-beta.7) | `c6839381-58cf-47d5-9717-4fa8cdcaa1ca` (benchmarks `629bb42`, clean tree) |

The candidate was built by product `scripts/benchmark-candidate.mjs` from a
clean detached worktree of `4f92665`. The benchmark repository was a scratch
`git clone` of this branch with the GitHub `origin` URL. The candidate declares
version 0.1.0-beta.7 because the product is not tagged; its source commit is the
identity. The core tarball hash equals the one in the #213 final measurement,
because the core package holds only JavaScript. The node addon and wasm tarballs
carry the detectors and differ.

`eval:candidate` on the fixed and expanded corpora reported: fixed corpus (150
fixtures) 2 negative flags, 0 required-positive misses; expanded corpus (2590
fixtures) 50 negative flags, 0 required-positive misses, 9 policy misses of 318.
Those corpora do not contain the `beta8-*` categories. The rest of this report
comes from `eval:classify`, the review queue and direct scans of the generated
`beta8-208`/`-210`/`-211`/`-212` fixtures.

## Stable counts

| Mode | Stable | Documented | Empirical | Provisional | Pending | Families |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Candidate (product `main` 4f92665) | **53** | 37 | 16 | 13 | 1 | 67 |
| Published 0.1.0-beta.7 | 40 | 30 | 10 | 26 | 1 | 67 |

The family count is 67: #213's 57 plus the ten arrival families that graduated
to registry detectors in #243. In candidate mode the 51 families that were
stable in the #213 final measurement are all still stable. The two new ones are
`replicate-api-token` and `openrouter-api-key`, both `stable · documented`. The
six families still typed only inside a shared detector or left unclaimed
(`github-fine-grained-pat`, `slack-app-level-token`,
`stripe-webhook-signing-secret`, `notion-integration-token`,
`pinecone-api-key-legacy`, `slack-user-token`) are arrival ids. They carry no
support status.

## Profiles

`npm run beta8:profiles` counts fixtures, not scanner output, so both modes
read the same. Every target meets its profile with no debt. The ten registry
families count 32 fixtures because their detector-coverage fixtures now join the
24 arrival fixtures.

| Issue | Target | Profile | Total | Pos | Ctl | Twins (ctx) | Pos axes | Ctl axes | Debt |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| #208 | groq-api-key | arrival-24 | 32 | 12 | 14 | 6 (0) | 8 | 6 | none |
| #208 | openrouter-api-key | arrival-24 | 32 | 12 | 14 | 6 (0) | 8 | 6 | none |
| #208 | replicate-api-token | arrival-24 | 32 | 12 | 14 | 6 (0) | 7 | 6 | none |
| #208 | xai-api-key | arrival-24 | 32 | 12 | 14 | 6 (0) | 8 | 6 | none |
| #210 | langfuse-secret-key | arrival-24 | 32 | 11 | 16 | 5 (0) | 8 | 6 | none |
| #210 | langsmith-api-key | arrival-24 | 32 | 11 | 16 | 5 (0) | 8 | 6 | none |
| #211 | github-fine-grained-pat | arrival-24 | 24 | 10 | 9 | 5 (0) | 10 | 6 | none |
| #211 | notion-integration-token | arrival-24 | 24 | 10 | 9 | 5 (0) | 10 | 5 | none |
| #211 | slack-app-level-token | arrival-24 | 24 | 10 | 9 | 5 (0) | 10 | 5 | none |
| #211 | stripe-webhook-signing-secret | arrival-24 | 25 | 10 | 10 | 5 (0) | 9 | 6 | none |
| #212 | fireworks-ai-api-key | arrival-24 | 32 | 11 | 16 | 5 (0) | 7 | 6 | none |
| #212 | gitlab-runner-authentication-token | arrival-24 | 32 | 10 | 16 | 6 (0) | 5 | 6 | none |
| #212 | perplexity-api-key | arrival-24 | 32 | 11 | 15 | 6 (0) | 7 | 6 | none |
| #212 | pinecone-api-key | arrival-24 | 32 | 11 | 16 | 5 (0) | 8 | 6 | none |
| #212 | pinecone-api-key-legacy | context-48 | 48 | 12 | 24 | 12 (12) | 9 | 6 | none |
| #212 | slack-user-token | arrival-24 | 24 | 8 | 11 | 5 (0) | 8 | 6 | none |

## How the detection tables were read

The tables below scan each generated `beta8-*` fixture directly with the
candidate and with the published package:

- A positive counts as exact when every authored `secret` span has a finding
  with exactly that byte range.
- A control counts as clean when the product reports nothing on it.
- A twin counts as silent when the product reports nothing. Where it reports
  something, the finding is from another family (`bearer-token` or
  `generic-token`). The twin method scores that as co-detection, not as a
  failure.

In candidate mode, no twin assertion fails for any family except
`pinecone-api-key-legacy`. There the anchor positive is missed, so its context
twins cannot pass.

## Review ledger: both keyings

`npm run queue:check` (published keying) and the same check run with the
candidate as the product scanner (candidate keying) both pass: every
review-queue id has a ledger row. The published queue has 5430 rows and the
candidate queue 5311, and 0 are missing in either. The two keyings share 5198
ids: the candidate declares the published version string, and the ids hash
outputs, not the build.

In the candidate keying, the 134 open rows the #213 final measurement reported
(product `99d83c4`) had come down to 20 before this change. #243 graduated the
families and triaged them against `f2082ab`. All 20 were in arrival families.
This change settles 5 of them and records the other 15 against known gaps:

| Rows | Family | Disposition |
| ---: | --- | --- |
| 5 | stripe-webhook-signing-secret | `not-assertable`, `decision=differential.arrival-owning-detector-classification` (new ADR, below) |
| 2 | xai-api-key | open; product false alarm on a control; known gap `product-727` (observed) |
| 2 | groq-api-key | open; product false alarm on a control; known gap `product-264` (observed) |
| 2 | fireworks-ai-api-key | open; product false alarm on a control; known gap `product-730` (observed) |
| 9 | pinecone-api-key-legacy | open; policy-scored positives missed; known gap `product-702` (observed) |

Candidate-keyed open rows for these families after this change: **15**. All 15
are differential rows on a real product behaviour. None is a peer artefact or
an untriaged row.

In the published keying, the arrival families hold 151 open rows. The 15 above
are shared with the candidate. The other 136 exist only in the published
keying. They record beta.7 behaviour for detectors that beta.7 did not ship:
`differential-coverage-gap/<family>`,
`differential-boundary-unconfirmed/gitlab-runner-authentication-token`, the four
`differential-shared-detector-twin/slack-app-level-token` rows, and one
`pinecone-api-key` placeholder false alarm (`product-756`, fixed). For every one
of them, the candidate either produces no disagreement or produces a row that is
already resolved. They stay open as records of the published package, following
the #213 precedent for heroku, google and confluent. They re-key when a release
is published.

## #208: AI inference families

| Family | Candidate positives exact | Controls clean | Twins silent | Candidate status | Published beta.7 positives exact | Published status |
| --- | --- | --- | --- | --- | --- | --- |
| replicate-api-token | 9/9 | 9/9 | 5/6 (1 `bearer-token` co-detection) | **stable · documented** | 2/9 | provisional |
| xai-api-key | 9/9 | **8/9** | 2/6 (4 co-detections) | provisional | 5/9 | provisional |
| groq-api-key | 9/9 | **8/9** | 5/6 | provisional | 2/9 | provisional |
| openrouter-api-key | 9/9 | 9/9 | 3/6 | **stable · documented** | 3/9 | provisional |

Candidate blockers:

- `xai-api-key` and `groq-api-key`:
  - `benign.falseAlarms` 1, from the flagged control;
  - `metamorphic.criticalFailures` 7, `mutation.unresolvedCritical` 1 and
    `differential.unresolvedContractDisagreements` 2, all on that same control;
  - the `stable-empirical` floors: 32 fixtures < 40, 6 twin pairs < 8, and 6
    positive/context cases < 10.
- **xAI control.** `beta8-208--xai-api-key-key-metadata-public-id`: generic-token
  reports `[128,141)` (`endpoint:chat`, inside the ACL entry
  `"api-key:endpoint:chat"`) at medium/warn.
- **Groq control.** `beta8-208--groq-api-key-masked-console-placeholder`:
  generic-token reports `[32,88)` (`gsk_` + 48 asterisks + 4 visible characters,
  after `Secret:`) at medium/warn.
- The published beta.7 flags both controls identically, so neither is a
  regression.

Ledger (candidate keying): replicate 11 resolved, 60 not-assertable. xAI 13
resolved, 60 not-assertable, 2 open. Groq 9 resolved, 60 not-assertable, 2 open.
OpenRouter 10 resolved, 72 not-assertable.

## #210: LangSmith and Langfuse

| Family | Candidate positives exact | Controls clean | Twins silent | Candidate status | Published beta.7 positives exact | Published status |
| --- | --- | --- | --- | --- | --- | --- |
| langsmith-api-key | 8/8 | 11/11 | 3/5 (2 `generic-token` co-detections) | provisional | 2/8 | provisional |
| langfuse-secret-key | 8/8 | 11/11 | 3/5 (2 `generic-token` co-detections) | provisional | 3/8 | provisional |

The only candidate blockers are the `stable-empirical` floors: 32 < 40
fixtures, 5 < 8 twin pairs and 6 < 10 positive/context cases. There is no
behavioural blocker. Ledger (candidate keying): LangSmith 8 resolved, 66
not-assertable; Langfuse 17 resolved, 66 not-assertable. **0 open.**

## #211: developer credential families (all four stay arrival ids)

| Family | Candidate positives exact | Controls clean | Twins silent | Candidate product label | Published beta.7 positives exact |
| --- | --- | --- | --- | --- | --- |
| github-fine-grained-pat | 10/10 | 9/9 | 4/5 (1 `bearer-token`) | `github-token` | 10/10 |
| slack-app-level-token | 10/10 | 9/9 | 4/5 (1 `bearer-token`) | `slack-token` | 10/10 |
| stripe-webhook-signing-secret | 10/10 (policy-scored) | 10/10 | 4/5 (1 `generic-token`) | `stripe-token`, type `stripe_webhook_signing_secret` | 10/10 (type `stripe_credential`) |
| notion-integration-token | 10/10 | 9/9 | 3/5 (1 `bearer-token`, 1 `generic-token`) | product notion detector | 10/10 |

The candidate fixes the two Slack twins that beta.7's interim `xapp-` guard
flagged: the `_` section separator and a letter in the digit section. Both are
silent in candidate mode, and the four published-keyed
`differential-shared-detector-twin/slack-app-level-token` rows have no candidate
counterpart.

Ledger (candidate keying):

- github-fine-grained-pat: 5 resolved, 50 not-assertable.
- slack-app-level-token: 13 resolved, 30 not-assertable.
- notion-integration-token: 18 resolved, 50 not-assertable.
- stripe-webhook-signing-secret: 21 resolved, 5 not-assertable. **0 open.**

The five stripe rows were the `classification-granularity-unasserted` rows that
the peer-coarser ADR kept open. They are the canonical dotenv, export, python,
compose and actions fixtures, and gitleaks is the peer on each. In every row,
redact-secret and gitleaks report the authored span byte-for-byte:

- redact-secret labels the span `stripe-token`, the shared detector that owns
  `whsec_` in the product source and in the family's recorded reason;
- gitleaks labels it `generic-token`, because it has no `whsec_` rule.

`docs/decisions/2026-09-24-settle-arrival-classification-by-owning-detector.md`
amends the peer-coarser decision for exactly this case. Condition 3 there
("the product's label is the targeted family") can never hold for an arrival
id, because the adapter maps by detector id. The amendment's conditions are:

- canonical variant;
- identical authored, product and peer ranges;
- the product label is the recorded owning detector;
- the peer label is `generic-token`.

Rows on twins or with other ranges stay open. The class is registered in
`benchmarks/ledger-decisions.json`, and the workbench shows it as its own
decided group.

## #212: second-wave families

| Family | Candidate positives exact | Controls clean | Twins silent | Candidate status | Published beta.7 positives exact | Published status |
| --- | --- | --- | --- | --- | --- | --- |
| perplexity-api-key | 8/8 | 10/10 | 3/6 (co-detections) | provisional | 4/8 | provisional |
| fireworks-ai-api-key | 8/8 | **10/11** | 4/5 | provisional | 3/8 | provisional |
| pinecone-api-key | 8/8 | 11/11 | 3/5 (co-detections) | provisional | 3/8 | provisional |
| gitlab-runner-authentication-token | 7/7 | 11/11 | 6/6 | provisional | 3/7 | provisional |
| slack-user-token (arrival) | 8/8 | 11/11 | 3/5 (co-detections) | — | 7/8 | — |
| pinecone-api-key-legacy (arrival, T3 context-gated, policy) | **3/12** policy positives | 24/24 | 12/12 | — | 3/12 | — |

Candidate blockers:

- **perplexity, pinecone, gitlab-runner:** only the `stable-empirical` floors
  (32 < 40 fixtures, twin pairs and positive/context cases short).
- **fireworks-ai-api-key (T1):**
  - `beta8-212--fireworks-ai-api-key-keychain-reference-reference`: generic-token
    redacts `[15,43)` (`{keychain:fireworks-api-key}`) at high/redact;
  - `benign.falseAlarms` 1, `metamorphic.criticalFailures` 7,
    `mutation.unresolvedCritical` 1 and
    `differential.unresolvedContractDisagreements` 2, all on that control.

  The published beta.7 flags it identically.
- **pinecone-api-key-legacy** (misses in both modes):
  - the product redacts the legacy UUID under `apiKey:` / `Api-Key:` names
    (`api-key-header`, `ts-legacy-init`, `n8n-credential`, through
    generic-token);
  - it reports nothing on the 9 fixtures that name the key with a
    provider-named identifier: `PINECONE_API_KEY=` (dotenv, export,
    actions-env, compose-env), `pinecone_api_key` (yaml-config, langchain,
    terraform-output), `api_key=` in `pinecone.init` (legacy-init) and
    `PINECONE_KEY=` (shell-key).
  - The product's pinecone-api-key detector leaves the bare UUID unclaimed on
    purpose (redact-secret#730, CHANGELOG). The inconsistency is inside
    generic-token, and it matches the open redact-secret#702 ("Provider-named
    assignments are not caught by generic detection").

Ledger (candidate keying):

- perplexity: 17 resolved, 55 not-assertable.
- fireworks: 19 resolved, 55 not-assertable, 2 open.
- pinecone: 10 resolved, 55 not-assertable.
- gitlab-runner: 20 resolved, 54 not-assertable.
- slack-user-token: 7 resolved, 24 not-assertable.
- pinecone-api-key-legacy: 3 resolved, 9 open.

## Known gaps recorded (observed)

Each record is at `observed` in `benchmarks/known-gaps.json`:

- candidate: `sourceCommit` `4f92665`, lock `cbbb00a1…0363`;
- evidence: the corpus hash of the category measured
  (`beta8-208` `4a5f0c22…42c9`, `beta8-212` `6e78193c…5e0e`);
- each links to the closest product issue. None of them is promoted, and no
  product issue was opened or edited.

| Record | Kind | Fixtures | Linked product issue | Observation |
| --- | --- | ---: | --- | --- |
| `product-727` | false positive | 1 | redact-secret#727 (closed; the #208 family implementation) | generic-token flags the ACL scope string `endpoint:chat` in xAI key metadata |
| `product-264` | false positive | 1 | redact-secret#264 (closed; masked values flagged as contextual secrets) | generic-token flags a partially masked `gsk_****…Tn4q` console value |
| `product-730` | false positive | 1 | redact-secret#730 (open; the #212 family implementation) | generic-token redacts a `{keychain:…}` secret-store reference |
| `product-702` | false negative | 9 | redact-secret#702 (open; provider-named assignments) | the legacy bare-UUID Pinecone key is missed under provider-named identifiers |

The 15 open ledger rows name their record. They stay open until the record is
promoted and fixed, or closed by a policy decision. The next step for each is a
`promote-finding` pass.

## Still open

- **15 candidate-keyed open rows**, all backed by the four observed records
  above. These are real product behaviours. Until they close:
  - xai-api-key, groq-api-key and fireworks-ai-api-key cannot be stable;
  - #208's and #212's "controls remain clean" and "critical ledger entries are
    resolved" do not hold for those three families and for
    pinecone-api-key-legacy.
- **The `stable-empirical` profile.** The eight T2 registry families need 40
  fixtures, 8 twin pairs and 10 positive/context cases before they can be
  empirical-stable. #210 and #212 (Perplexity, Pinecone, GitLab runner) are
  blocked only by this.
- **Published-mode rows.** The 136 published-only open rows re-key at the next
  published release.
- **`pins:check`** reports no pin drift at `629bb42`.
