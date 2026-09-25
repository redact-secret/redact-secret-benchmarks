# Beta.8 arrival families: candidate re-measure on product `main` 2420e80 (#208, #212)

Issues: [#208](https://github.com/redact-secret/redact-secret-benchmarks/issues/208),
[#212](https://github.com/redact-secret/redact-secret-benchmarks/issues/212).
The no-regression check also covers
[#210](https://github.com/redact-secret/redact-secret-benchmarks/issues/210) and
[#211](https://github.com/redact-secret/redact-secret-benchmarks/issues/211).
Previous measurement: [candidate 4f92665](2026-09-24-beta8-arrival-candidate-remeasure.md).
It left 15 candidate-keyed open ledger rows, all tied to four `observed` known
gaps. Product PR [redact-secret#766](https://github.com/redact-secret/redact-secret/pull/766)
(merge `2420e80`) addresses those four gaps. This report re-measures the same
families against that merge, using the same method as the previous report.

This report measures and records. It asserts no product output. Differential
results against gitleaks and trufflehog are observations, not ground truth.

## Measurement identity

| Item | Value |
| --- | --- |
| Product | redact-secret `main` at `2420e8064f47e5764ac0daf19507609af15f08d7` (merge of #766) |
| Benchmarks | `0bceccd56f2c0806ffc55c031a452f781cb5a16f` (`develop`) for `benchmark:candidate` and the first candidate `eval:classify`; `ea8108c6d15a51b0e73d6733dfcec11cd07c25c7` (this branch after the ledger and known-gap commits, clean tree) for both final `eval:classify` runs |
| Candidate core tarball | `8b6e759b98201ebfed797a5389eca57a3aa52fef1bc96783d522c60418662520` |
| Candidate node-darwin-arm64 tarball | `2e0070a2d77be998ec34092892748d9b05794a49422381fd732a62f8838a4270` |
| Candidate wasm tarball | `668ff1ee00a340799887a90b32ff5ca5cb5fa889bf309607fde00d4bf87c50e9` |
| Lock hash | `cbbb00a192cf384857e286d9e81a8851bb43797d47410a0618e21690ff050363` |
| Peers | gitleaks 8.30.1, trufflehog 3.97.4 (the pinned keg first on `PATH`, printed in the same command as each run) |
| Cases / variants | 8526 / 22213 |
| `benchmark:candidate` run (`eval:candidate`, fixed + expanded corpora) | `ffa9dbb1-a450-4058-a1ba-1460b5a9e4a4` |
| Candidate `eval:classify`, before the ledger change | `4128e2af-7b5c-4a0b-a8e3-111b1d24d954` (benchmarks `0bceccd`) |
| Candidate `eval:classify`, final | `e7a4729f-3981-4fb6-8763-29b2d2a4eeb8` |
| Published `eval:classify`, final (`@redact-secret/core` 0.1.0-beta.7) | `75154ca5-7897-432a-ad84-fad8e2da9b1a` |

The candidate was built by product `scripts/benchmark-candidate.mjs` from a
clean detached worktree of `2420e80`. The benchmark repository was a scratch
`git clone` of this branch with the GitHub `origin` URL. The candidate declares
version 0.1.0-beta.7 because the product is not tagged, so its source commit is
the identity. The core tarball hash is the same as at 4f92665 because the core
package holds only JavaScript. The node addon and wasm tarballs carry the
detectors, and their hashes differ.

`eval:candidate` on the fixed and expanded corpora reported:

- fixed corpus (150 fixtures): 2 negative flags and 0 required-positive
  misses, the same as at 4f92665;
- expanded corpus (2590 fixtures): 47 negative flags (50 at 4f92665), 0
  required-positive misses and 0 policy misses of 318 (9 at 4f92665).

## What changed between 4f92665 and 2420e80

Each candidate scanned every generated fixture directly: 2705 fixtures across
all `fixtures/generated/*.json` categories. The full findings were compared
(range, detector, type, confidence and action). **Exactly 15 fixtures
changed**, all in `beta8-208` and `beta8-212`:

| Fixture | 4f92665 | 2420e80 |
| --- | --- | --- |
| `beta8-208--xai-api-key-key-metadata-public-id` (control) | generic-token `[128,141)` medium/warn | nothing |
| `beta8-208--groq-api-key-masked-console-placeholder` (control) | generic-token `[32,88)` medium/warn | nothing |
| `beta8-212--fireworks-ai-api-key-keychain-reference-reference` (control) | generic-token `[15,43)` high/redact | nothing |
| 9 `beta8-212--pinecone-api-key-legacy-*` positives (`dotenv`, `export`, `legacy-init`, `yaml-config`, `actions-env`, `compose-env`, `langchain`, `terraform-output`, `shell-key`) | nothing | `pinecone-api-key` / `pinecone_api_key` high/redact at the authored span |
| 3 `beta8-212--pinecone-api-key-legacy-*` positives (`api-key-header`, `ts-legacy-init`, `n8n-credential`) | generic-token / `contextual_secret` high/redact | `pinecone-api-key` / `pinecone_api_key` high/redact, same span |

No other fixture changed in any family. This matches the 15-fixture CLI diff in
the #766 description, which was reproduced here independently with the npm
candidate artifacts.

## Stable counts

| Mode | Stable | Documented | Empirical | Provisional | Pending | Families |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Candidate (product `main` 2420e80) | **54** | 38 | 16 | 12 | 1 | 67 |
| Candidate (product `main` 4f92665, previous report) | 53 | 37 | 16 | 13 | 1 | 67 |
| Published 0.1.0-beta.7 | 40 | 30 | 10 | 26 | 1 | 67 |

The only status change in candidate mode is `fireworks-ai-api-key`, which goes
from provisional to **stable · documented**. No family left stable. The
published count is unchanged because the published package is unchanged.

## Profiles

`npm run beta8:profiles` counts fixtures, not scanner output, so it did not
change: every arrival target meets its profile and has no debt (see the table in
the [previous report](2026-09-24-beta8-arrival-candidate-remeasure.md#profiles)).

## #208: AI inference families

| Family | Candidate positives exact | Controls clean | Twins silent | Candidate status | Open rows (candidate keying) |
| --- | --- | --- | --- | --- | ---: |
| replicate-api-token | 9/9 | 9/9 | 5/6 (1 `bearer-token` co-detection) | stable · documented | 0 |
| xai-api-key | 9/9 | **9/9** (was 8/9) | 2/6 (4 co-detections) | provisional | **0** (was 2) |
| groq-api-key | 9/9 | **9/9** (was 8/9) | 5/6 | provisional | **0** (was 2) |
| openrouter-api-key | 9/9 | 9/9 | 3/6 | stable · documented | 0 |

- **xAI control:** `beta8-208--xai-api-key-key-metadata-public-id` is clean.
  The ACL scope `api-key:endpoint:chat` is no longer flagged (known gap
  `product-727`).
- **Groq control:** `beta8-208--groq-api-key-masked-console-placeholder` is
  clean. The masked `gsk_****…` display is no longer flagged (known gap
  `product-264`).
- xAI and Groq are now blocked only by the `stable-empirical` floors: 32
  fixtures < 40, 6 twin pairs < 8 and 6 positive/context cases < 10. No
  behavioural blocker remains: `benign.falseAlarms`, `metamorphic`, `mutation`
  and `differential` carry no reasons for either family.

Ledger (candidate keying): replicate 11 resolved, 60 not-assertable. xAI 13
resolved, 60 not-assertable. Groq 9 resolved, 60 not-assertable. OpenRouter 10
resolved, 72 not-assertable. **0 open.**

## #212: second-wave families

| Family | Candidate positives exact | Controls clean | Twins silent | Candidate status | Open rows (candidate keying) |
| --- | --- | --- | --- | --- | ---: |
| perplexity-api-key | 8/8 | 10/10 | 3/6 (co-detections) | provisional | 0 |
| fireworks-ai-api-key | 8/8 | **11/11** (was 10/11) | 4/5 | **stable · documented** (was provisional) | **0** (was 2) |
| pinecone-api-key | 8/8 | 11/11 | 3/5 (co-detections) | provisional | 0 |
| gitlab-runner-authentication-token | 7/7 | 11/11 | 6/6 | provisional | 0 |
| slack-user-token (arrival) | 8/8 | 11/11 | 3/5 (co-detections) | — | 0 |
| pinecone-api-key-legacy (arrival, T3 context-gated, policy) | **12/12** policy positives (was 3/12) | 24/24 | 12/12 | — | **0** (was 9) |

- **Fireworks control:**
  `beta8-212--fireworks-ai-api-key-keychain-reference-reference` is clean. The
  `{keychain:…}` reference is no longer redacted (known gap `product-730`).
  With no other blocker, the T1 family is stable · documented.
- **pinecone-api-key-legacy:**
  - All 12 policy positives are redacted at the authored span. The 9
    provider-named ones were missed at 4f92665 (known gap `product-702`).
  - All 24 controls stay clean, and all 12 context twins stay silent.
  - Every positive is now labelled by the product's `pinecone-api-key`
    detector (`pinecone_api_key`), including the three that generic-token used
    to catch.
  - The benchmark's family adapter does not map the product's
    `pinecone-api-key` label (the redact-secret family list in
    `scanners/families.mjs` holds the legacy shared-detector ids only), so these
    findings classify as unmapped. That is the existing behaviour for every
    registry-id label.
- Perplexity, Pinecone and the GitLab runner token are still blocked only by
  the `stable-empirical` floors.

Ledger (candidate keying):

- perplexity: 17 resolved, 55 not-assertable.
- fireworks: 19 resolved, 55 not-assertable.
- pinecone: 10 resolved, 55 not-assertable.
- gitlab-runner: 20 resolved, 54 not-assertable.
- slack-user-token: 7 resolved, 24 not-assertable.
- pinecone-api-key-legacy: 12 resolved. **0 open.**

## #210 and #211: no regression

The direct scans of the #210 and #211 fixtures are identical at 4f92665 and
2420e80, finding for finding. Their candidate statuses are the same as before:

- langsmith-api-key and langfuse-secret-key are provisional on the
  `stable-empirical` floors only;
- the four #211 families are still arrival ids.

Their candidate-keyed ledger counts are unchanged:

- LangSmith 8 resolved, 66 not-assertable;
- Langfuse 17 resolved, 66 not-assertable;
- github-fine-grained-pat 5 resolved, 50 not-assertable;
- slack-app-level-token 13 resolved, 30 not-assertable;
- notion-integration-token 18 resolved, 50 not-assertable;
- stripe-webhook-signing-secret 21 resolved, 5 not-assertable;
- **0 open.**

## Review ledger: both keyings

`npm run queue:check` passes in the published keying: 5430 rows, 0 missing. The
same check with the candidate as the product scanner (candidate keying) passes
after this change: 5305 rows, 0 missing.

The candidate queue changed in two ways:

- **18 ids left the candidate queue.** These are the 15 open rows and 3 resolved
  pinecone-legacy trufflehog rows. At 2420e80 the product either agrees with the
  peer or is silent on the control, or (for the 3 relabelled rows) the
  classification changed and so did the id. Every one of the 18 ids is still in
  the published queue, because beta.7 still behaves as recorded.
- **12 ids entered the candidate queue.** Each is a trufflehog
  `redact-secret-only` row on a pinecone-api-key-legacy positive. The product
  reports the authored span exactly, and trufflehog 3.97.4 reports nothing: its
  Pinecone detector claims only `pcsk_` keys. They were matched against the
  4f92665 dump on every field except `id` and `fixtureHash`, and none matched,
  because the product classification changed from `generic-token` to unmapped.
  So they were not remapped. Each is recorded `resolved` under the existing
  class `redact-secret-only/trufflehog/range-matches-corpus`, with
  `firstSeenRun` `4128e2af-…`.

**Candidate-keyed open rows: 0** in the arrival families (15 before this
change), and 0 across the whole candidate queue.

The 15 formerly open rows stay `open` in the ledger. Their ids occur only in the
published keying now, where 0.1.0-beta.7 still has the false alarms and the
misses. This follows the precedent for published-only rows (heroku, confluent,
`product-756`): a published-keyed row stays open until a release carrying the
fix is pinned here. Each note now records:

- the fix (redact-secret#766, merge 2420e80);
- what the candidate reports instead;
- that the row stays open only as a record of the published package.

The published keying's arrival families hold 151 open rows, unchanged. They
re-key at the next published release.

## Known gaps: observed → fixed

`docs/decisions/2026-09-18-govern-benchmark-promotion.md` requires the forward
path `observed → reviewed → promoted → fixed`, and the validator requires every
intermediate transition. Each record therefore carries all three new
transitions, dated 2026-09-24:

- **reviewed:** the independently authored expectation already cited in
  `expectationReview` (`benchmarks/lib/beta8/208.ts` or `212.ts`, the research
  issue and, for Pinecone, the provider authentication page);
- **promoted:** the product issue and redact-secret#766;
- **fixed:** commit `2420e80`, redact-secret#766 and this report.

| Record | Product issue | Status | `fix.commit` | Proposed `productManifestRecordId` | Canonical product fixtures (added by #766) |
| --- | --- | --- | --- | --- | --- |
| `product-727` | redact-secret#727 | fixed | `2420e80` | `benchmark-gap-727` | `generic-token-negative-colon-namespaced-acl-scope`, `generic-token-positive-colon-scope-shaped-value-after-a-space` |
| `product-264` | redact-secret#264 | fixed | `2420e80` | `benchmark-gap-264` | `generic-token-negative-partially-masked-console-display`, `generic-token-positive-mask-with-one-visible-side` |
| `product-730` | redact-secret#730 | fixed | `2420e80` | `benchmark-gap-730` | `generic-token-negative-keychain-secret-store-reference`, `generic-token-positive-keychain-reference-embedded-in-a-value` |
| `product-702` | redact-secret#702 | fixed | `2420e80` | `benchmark-gap-702` | 4 `pinecone-api-key-positive-legacy-uuid-*`, `pinecone-api-key-overlap-legacy-uuid-api-key-property`, 4 `pinecone-api-key-negative-legacy-uuid-*` |

The canonical fixture ids all exist in the product's
`conformance/fixtures/synchronous-corpus.json` at 2420e80. The product
`conformance/benchmark-regressions.json` has no record for these four ids yet.
The proposed manifest record ids are carried here only, and no product issue
was opened or edited. None of the four is `verified`, which needs a passing
product qualification run and is out of scope. `product-702` covers only the
nine Pinecone fixtures. redact-secret#702 also covers Okta, Mailchimp, Mailgun
and `POSTMAN_API_KEY=`, which #766 does not change.

## Still open

- **`pins:check` reports registry drift.** Product
  `crates/secret-scan-core/src/detectors` changed after the pinned `f2082ab`
  (#766 edits `generic_token.rs`, `pinecone.rs` and `mod.rs`). Refreshing the
  registry snapshot moves `detector-inventory.json` `redactSecretRevision`. The
  #150 coupling (`benchmarks/lib/pin-drift.ts`) then requires
  `performance-criteria.json` `baseline.sourceCommit` to match, which means a
  performance re-baseline. That is left to the maintainer, and the pin is not
  refreshed here.
  **Update:** #260 (merged into `develop`, then into this branch) pins the
  registry to product `3144bb3`, which includes 2420e80/#766, and re-derives
  the performance criteria. `pins:check` and the `pin-drift` CI check now pass.
  The candidate measurement above was not re-run.
- **The recorded reason for `pinecone-api-key-legacy` is stale.**
  `benchmarks/lib/beta8/212.ts` and the `pinecone:legacy-api-key` taxonomy note
  still say the product detector leaves the bare UUID unclaimed. At 2420e80 the
  product's `pinecone-api-key` detector claims it under a Pinecone API-key name.
  Two changes remain for a follow-up, and neither is made here:
  - editing the reason re-keys the `beta8-212` category;
  - mapping the family to its owning detector is a classification decision.
- **The `stable-empirical` profile.** xAI, Groq, LangSmith, Langfuse,
  Perplexity, Pinecone and the GitLab runner token still need 40 fixtures, 8
  twin pairs and 10 positive/context cases before they can be empirical-stable.
- **Published-mode rows.** The 151 published-keyed open rows in the arrival
  families re-key at the next published release.
