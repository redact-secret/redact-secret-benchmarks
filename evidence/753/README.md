# Evidence: #753, Group D: role, confidentiality and family modelling (23 rows)

**Final artifact of [#753](https://github.com/redact-secret/redact-secret-benchmarks/issues/753).** Rendered by `scripts/render-groups-cde-final.mjs` from the committed round 1 to 4 data; it replaces the earlier status page, which was written before the contract was adopted and the corpus measured. This repository records observations and accounting; it does not decide product output, and nothing here changes an official pin, the authority, the ledger or a support status.

**Result.** The 23 rows of Group D were measured on a frozen, synthetic corpus of 868 cases (219 positives, 351 controls, 290 unsupported and 8 conflict cases, observed only) on the published beta.13 baseline and on the exact candidate `c6dd6859`, and the candidate's behaviour was then reproduced on the **published** `0.1.0-beta.14` packages. Final dispositions (round 3, unchanged on the published beta.14): fully covered 7; carrier unresolved (observed only) 14; policy-limited 1; covered with recorded policy deviation 1. **Open product gaps: 0. Regressions: 0. Parity divergences: 0.** The failing scored cases that remain (22) are exactly the recorded policy cases named below; they are listed, not hidden, and the policy-limited rows are not called covered.

## 1. Lineage (contract and case)

| Layer | Immutable reference |
| --- | --- |
| Product contract (accepted, class level, conditional per row) | [redact-secret#1229](https://github.com/redact-secret/redact-secret/issues/1229), merged in [#1243](https://github.com/redact-secret/redact-secret/pull/1243) `db0e5c8ddf706988967e971593f509daf460c222`; final record pinned at core `2816897f`: [`evidence/1229/README.md`](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1229/README.md) |
| Evidence epic and research children | [credential-evidence#237](https://github.com/redact-secret/credential-evidence/issues/237) (closed); [#242](https://github.com/redact-secret/credential-evidence/issues/242), [#243](https://github.com/redact-secret/credential-evidence/issues/243), [#244](https://github.com/redact-secret/credential-evidence/issues/244) (closed); inventory [#231](https://github.com/redact-secret/credential-evidence/issues/231) |
| Evidence snapshot the cases are authored from | `snapshot-2026.10.06.5`, commit `574b52ba367e2071d5a9bea3e2da7a9c5057f633` (credential-evidence PR #263); maintainer-only evidence, **not** independent validation |
| Frozen manifest and freeze commit | [`benchmarks/group-d/FROZEN-group-d.json`](../../benchmarks/group-d/FROZEN-group-d.json), freeze commit `a7350c51` (committed before any scanner, CLI, detector or product build ran on the corpus); record [`benchmarks/FREEZE-groups-cde.md`](../../benchmarks/FREEZE-groups-cde.md); sha256 `aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e`, 868 cases |
| Corpus generator and tests | [`benchmarks/group-d/`](../../benchmarks/group-d/) (traceability: `TRACEABILITY.md`), `tests/group-d-corpus.test.mjs`; scorer `benchmarks/batch2/score-r2.mjs` (unchanged) |
| Per-row case lineage | [`lineage.json`](lineage.json): per row, the credential-evidence Cases its corpus cases mirror or extend and how many corpus cases each carries |

Authorship was blind to product output and reviewed by one blind reviewer in two rounds (see the freeze record); expectations come from the evidence Cases, never from product or peer output. Where a Case does not support an expectation the case was downgraded to observed-only (`unsupported`, or `conflict`) and kept in the digest. Values are built at runtime from filler; none is a real credential.

## 2. Identities and digests

| Identity | What | Digest / reference |
| --- | --- | --- |
| **A, baseline** | published 0.1.0-beta.13: `@redact-secret/core`, `wasm`, `node-darwin-arm64` (npm), PyPI `redact-secret` 0.1.0b13, `redact-secret-cli` 0.1.0-beta.13 (crates.io, `cargo install --locked`) | core integrity `sha512-qZkqRN7CIJ+pc0IteRCXSucr1l9KtTc/nJaM5wPL0NvCiZ4AGWLCyrLy8KD95a2MBgxo8vuUJ/UaKhrny7gMJQ==`; addon `9a4444f7adf346c62b5fa2608d8df73677948e0d47ddc3bc8d819b91aad13eda`; wasm `d3d77f29e1c492934cc1bcd13139abd3bea20c42832bbbe68f7c02482b8308db`; CLI `28d6852f1ab9c4e3fe90a99e08ad620c2ea6fb4a0fc67e2e9799a8559050e143` ([round 1 identity](../groups-cde/round1/identity.json)) |
| **B1 / R2, intermediate candidates** | `e1284537` and `e1cc1f31` (unpublished branch commits), kept for the regression history | [round 1](../groups-cde/round1/identity.json), [round 2](../groups-cde/round2/identity.json) |
| **R3, exact final candidate** | redact-secret `c6dd685974b8df6a84514e07e41e35afa711a2ac` (branch `workbench/closeout-batch2-groupcde`, declared 0.1.0-beta.14), built clone-free | tarballs: core `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2`; node `3f077018654be412cca449d49390c0dd1223a4e1bbe33c11446a2701a036f155`; wasm `3354fd36a7f1c5f41535aa0a8bc6a1853c6b734c6a6fdc10089a52a07f091d24`; addon `71d13a68bbabda2afa6c00085617ebf47d557a81cb307574d290dd1169009ea5`; wasm `bb10fdf9322922cbfaac431c94e1ce051692e14fd14f4edb84d7932d47bb18e1`; CLI `7864a2a68b3435aa48f999a6d79a37ae0212da78ad6e25d366de00aefdf6e17e` ([round 3 identity](../groups-cde/round3/identity.json)) |
| **R4, published pin** | published 0.1.0-beta.14 (npm, PyPI 0.1.0b14, crates.io CLI 0.1.0-beta.14), built from core `0c62fd38` per the registry provenance | core integrity `sha512-1h5NxUto2ZEqQD5hfIgbzwDZkmu6WXdlmtF0waG3FcKDhpCEoUphgj4B4VGRyhVhjJOFT58/TrER+3EL1bCnag==`; core tarball `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2` (**equal to R3's**); addon `55aa35f0184dbb330457c91d4cd5da0ee28929847d0a0aaeff7153944eb7d2ec`; wasm `981b9aa776ee810bf3a5f074b46b0a356af8b14044e384970198520bd91abf66`; CLI `95edcc76cb278170a905f96cf94912556011c3cc03359b5560e305aa475f78e1` ([round 4](../groups-cde/round4-published-beta14/report.md)) |

Scanner, config, input and environment digests: the harness `scripts/measure-batch1.mjs` scans with the product defaults (no configuration file); the input digest is the corpus sha256 above, verified by the generator before scanning and by every scoring script (they abort on a mismatch); environment darwin-arm64, Node v22.16.0, one host. Surfaces: Node, WASM (full profile), Python and CLI, each whole and streamed in 7-byte and 1-byte chunks (16 observations per case). Peers were not run (TruffleHog on the host is not the pinned 3.97.4; peers are optional for this correctness track).

## 3. What was measured, per group

Exact span, complete sanitized output coverage (`fullyCovered`: no byte of the expected secret uncovered), finding type and action, overlap (over-wide, partial, miss), and whole-versus-stream and four-surface parity, all with the unchanged `score-r2.mjs`. Credential masking, provider attribution and policy behaviour are kept apart: no case expects a provider attribution (a shared generic finding is never counted as a provider detector), type and action are convention-derived and reported separately (Group C only; D and E carry no type or action expectation, so their `pass` is false by construction and the columns below read `exact` and `fullyCovered`).

| identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported | conflict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A beta.13 | 219 | 159 | 180 | 39 | 351 | 25 | 290 | 8 |
| B1 e1284537 | 219 | 181 | 202 | 17 | 351 | 23 | 290 | 8 |
| R2 e1cc1f31 | 219 | 197 | 218 | 1 | 351 | 8 | 290 | 8 |
| R3 c6dd6859 | 219 | 197 | 218 | 1 | 351 | 0 | 290 | 8 |
| R4 published beta.14 | 219 | 197 | 218 | 1 | 351 | 0 | 290 | 8 |


## 4. Accepted product policy and unresolved properties, per row

From the accepted contract (the core's own per-row tables at `db0e5c8d`, condensed in [`row-policy.json`](../groups-cde/final/row-policy.json)). "Unresolved" properties are asserted nowhere: they contribute no pass or fail.

| Row | Research child | Accepted policy | Unresolved or unsupported properties |
| --- | --- | --- | --- |
| `algolia:admin-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; role is metadata only. The x-algolia-api-key header is read like every role's key; the application id beside it is silent. | None asserted beyond the create-key request carrier. |
| `contentful:delivery-api-access-token` | D1 to D3 (by Case, see lineage) | Shared generic detection; public or confidential status unresolved, so no silence. Bearer, access_token query parameter and accessToken property are read. | Whether a Delivery token may be public; no must-flag Case; observed and controls only. |
| `dropbox:app-auth-token` | D1 to D3 (by Case, see lineage) | Shared generic detection; Authorization Bearer read as bearer_token; the Basic envelope over app key and secret is read whole. | Response format and lifetime. |
| `elastic:cross-cluster-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection where the carrier is shared; the api_key member is read. | The keystore is not a wire carrier; the encoded member (base64 id:api_key) is not a read name when it has no api_key sibling (disclosed blind spot). |
| `elastic:serverless-project-api-key` | D1 to D3 (by Case, see lineage) | Authorization ApiKey over the undecoded value: authorization_credential, redact, no Elastic attribution (the #1212 reading); no alias to the stack key. | None asserted. |
| `figma:plan-access-token` | D1 to D3 (by Case, see lineage) | Shared generic detection; X-Figma-Token read as contextual_secret; no PAT subtype; a bare figd_ value is silent. | Era-specific (generally available 2026-07-23). |
| `hubspot:static-auth-access-token` | D1 to D3 (by Case, see lineage) | Shared generic detection; Authorization Bearer read as bearer_token; not aliased to the private-app token. | None asserted beyond the Bearer carrier. |
| `meta:app-access-token` | D1 to D3 (by Case, see lineage) | Bounded composite claim: access_token as {app-id}\|{app-secret} is one span over the whole composite (public app id included). | The generated token's response member and format are unassertable. |
| `meta:instagram-app-secret` | D1 to D3 (by Case, see lineage) | Shared generic detection; client_secret in a POST form and GET query read as contextual_secret; no alias to the Meta app secret. | Whether the value equals the Meta app secret. |
| `x:oauth1-access-token` | D1 to D3 (by Case, see lineage) | Shared generic detection, the #1241 default; the two halves are separate spans. | Sensitivity of the token half; observed only. |
| `zoom:build-platform-api-key` | D1 to D3 (by Case, see lineage) | x-api-key read as contextual_secret; Bearer as bearer_token; a JWT in either is jwt; no attribution. | Key-and-secret pair versus one string. |
| `zoom:webhook-secret-token` | D1 to D3 (by Case, see lineage) | Role is metadata only for the derived outputs; x-zm-signature silent; plainToken/encryptedToken redacted (recorded deviation). | The secret token's carrier (documentation says both sends the secret and sends a hash); controls only. |
| `algolia:search-only-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; frontend-safe documentation does not justify silence or an admin attribution (same type, action, span as the admin key). | Carrier unresolved for scoring: no must-flag Case; observed only. |
| `algolia:secured-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; derived value, not decoded. | Encoding and whether the parent key is recoverable; observed only. |
| `algolia:write-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; ACL role is metadata. | No must-flag Case; observed only. |
| `algolia:analytics-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; no alias (a distinct key kind or an ACL profile is unresolved). | Data sensitivity; observed only. |
| `algolia:monitoring-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; role is metadata only. | Confidentiality; observed only. |
| `algolia:usage-api-key` | D1 to D3 (by Case, see lineage) | Shared generic detection; the usage-endpoint deprecation is undated so no era. | Observed only. |
| `contentful:preview-api-access-token` | D1 to D3 (by Case, see lineage) | Shared generic detection; distinct from Delivery by host and context only. | Not separable from Delivery by value; observed only. |
| `asana:service-account-token` | D1 to D3 (by Case, see lineage) | Shared generic detection; no alias to the PAT. | No service-account carrier example exists; observed only. |
| `figma:cli-plan-access-token` | D1 to D3 (by Case, see lineage) | Role is metadata only. | CLI and npm-registry carriers unstated; observed only. |
| `jfrog:pairing-token` | D1 to D3 (by Case, see lineage) | A JWT-shaped value is one jwt finding, not a JFrog type; short lifetime does not justify silence. | String form inferred not stated; non-JWT form unassertable; observed only. |
| `canva:authorization-code` | D1 to D3 (by Case, see lineage) | Ambiguity tier: the code redirect parameter and form field are medium confidence, warn, text unchanged; code_verifier redacts. | No must-flag expectation exists for the code; observed only. |

## 5. Per-row final report

`positives exact` and `controls flagged` are on the final candidate R3 and on published beta.13 (A); R4 equals R3 on every case. Observed-only counts are unassertable variants (no pass or fail).

| Row | cases (pos / ctl / unsup / conflict) | evidence Cases | A beta.13 | R3 = R4 | Final disposition |
| --- | --- | ---: | --- | --- | --- |
| `algolia:admin-api-key` | 27 / 33 / 20 / 0 | 2 | 27/27 exact, 0/33 flagged | 27/27 exact, 0/33 flagged | **fully covered**: 27/27 positives exact, 33 controls clean |
| `contentful:delivery-api-access-token` | 0 / 63 / 12 / 0 | 2 | 0/0 exact, 1/63 flagged | 0/0 exact, 0/63 flagged | **carrier unresolved (observed only)**: no scored positive; 63 controls, 0 flagged |
| `dropbox:app-auth-token` | 27 / 37 / 21 / 1 | 4 | 27/27 exact, 0/37 flagged | 27/27 exact, 0/37 flagged | **fully covered**: 27/27 positives exact, 37 controls clean |
| `elastic:cross-cluster-api-key` | 18 / 23 / 9 / 0 | 3 | 1/18 exact, 0/23 flagged | 17/18 exact, 0/23 flagged | **policy-limited**: 1 open: encoded-member-only: an `encoded` member with no `api_key` sibling is not read (bounded sibling reader, #1229 addendum) |
| `elastic:serverless-project-api-key` | 22 / 30 / 16 / 0 | 2 | 0/22 exact, 0/30 flagged | 22/22 exact, 0/30 flagged | **fully covered**: 22/22 positives exact, 30 controls clean |
| `figma:plan-access-token` | 29 / 32 / 21 / 1 | 3 | 29/29 exact, 0/32 flagged | 29/29 exact, 0/32 flagged | **fully covered**: 29/29 positives exact, 32 controls clean |
| `hubspot:static-auth-access-token` | 27 / 38 / 19 / 0 | 3 | 27/27 exact, 0/38 flagged | 27/27 exact, 0/38 flagged | **fully covered**: 27/27 positives exact, 38 controls clean |
| `meta:app-access-token` | 21 / 26 / 13 / 3 | 3 | 0/21 exact, 12/26 flagged | 0/21 exact, 0/26 flagged | **covered with recorded policy deviation**: 21 cases: Meta `APP_ID\|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a)) |
| `meta:instagram-app-secret` | 21 / 31 / 15 / 0 | 4 | 21/21 exact, 11/31 flagged | 21/21 exact, 0/31 flagged | **fully covered**: 21/21 positives exact, 31 controls clean |
| `x:oauth1-access-token` | 0 / 0 / 11 / 1 | 2 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 12 observed-only |
| `zoom:build-platform-api-key` | 27 / 33 / 21 / 0 | 3 | 27/27 exact, 1/33 flagged | 27/27 exact, 0/33 flagged | **fully covered**: 27/27 positives exact, 33 controls clean |
| `zoom:webhook-secret-token` | 0 / 5 / 8 / 2 | 2 | 0/0 exact, 0/5 flagged | 0/0 exact, 0/5 flagged | **carrier unresolved (observed only)**: no scored positive; 5 controls, 0 flagged |
| `algolia:search-only-api-key` | 0 / 0 / 11 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 11 observed-only |
| `algolia:secured-api-key` | 0 / 0 / 9 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 9 observed-only |
| `algolia:write-api-key` | 0 / 0 / 10 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 10 observed-only |
| `algolia:analytics-api-key` | 0 / 0 / 8 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 8 observed-only |
| `algolia:monitoring-api-key` | 0 / 0 / 8 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 8 observed-only |
| `algolia:usage-api-key` | 0 / 0 / 8 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 8 observed-only |
| `contentful:preview-api-access-token` | 0 / 0 / 12 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 12 observed-only |
| `asana:service-account-token` | 0 / 0 / 10 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 10 observed-only |
| `figma:cli-plan-access-token` | 0 / 0 / 8 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 8 observed-only |
| `jfrog:pairing-token` | 0 / 0 / 8 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 8 observed-only |
| `canva:authorization-code` | 0 / 0 / 12 / 0 | 1 | 0/0 exact, 0/0 flagged | 0/0 exact, 0/0 flagged | **carrier unresolved (observed only)**: no scored case; 12 observed-only |

### Counts, kept separate

| Category | Rows | Cases or detail |
| --- | ---: | --- |
| **No-code coverage**: every scored case already passes on published beta.13, no product change needed | 4 | `algolia:admin-api-key`, `dropbox:app-auth-token`, `figma:plan-access-token`, `hubspot:static-auth-access-token` |
| **Qualified improvement**: more scored cases good on R3 than on beta.13 (the candidate fixes, now published in beta.14); no row lost a case | 6 | `contentful:delivery-api-access-token` (+1), `elastic:cross-cluster-api-key` (+16), `elastic:serverless-project-api-key` (+22), `meta:app-access-token` (+12), `meta:instagram-app-secret` (+11), `zoom:build-platform-api-key` (+1) |
| **Historical-only** (retired era, redacted without an authentication claim) | 0 | not applicable to this group (no retired-era row) |
| **Policy limits** (recorded product policy leaves scored cases open or deviating) | 2 | `elastic:cross-cluster-api-key` (policy-limited, 1 cases), `meta:app-access-token` (deviation, 21 cases) |
| **Source-unresolved** (carrier unresolved, observed only; no scored positive, controls clean) | 14 | `contentful:delivery-api-access-token`, `x:oauth1-access-token`, `zoom:webhook-secret-token`, `algolia:search-only-api-key`, `algolia:secured-api-key`, `algolia:write-api-key`, `algolia:analytics-api-key`, `algolia:monitoring-api-key`, `algolia:usage-api-key`, `contentful:preview-api-access-token`, `asana:service-account-token`, `figma:cli-plan-access-token`, `jfrog:pairing-token`, `canva:authorization-code` |
| **Unassertable variants** (unsupported plus conflict cases; contribute no pass or fail) | n/a | 298 cases (290 unsupported, 8 conflict) across all rows |

The primary dispositions partition the rows (fully covered 7, carrier unresolved (observed only) 14, policy-limited 1, covered with recorded policy deviation 1; sum 23); the other counts are separate lenses and overlap with it by design, so they are never added together. Open product gaps: 0. A "fully covered" row means every frozen scored case passes on one host; it does not promote support.

## 6. Gap handoffs

Every confirmed adopted-contract gap of round 1 (a scored case the Case supports and the product failed) is a recorded redact-secret product item with its reproduction (case ids, expected and observed spans in [`round1/gaps.json`](../groups-cde/round1/gaps.json) and [`round1/report.md`](../groups-cde/round1/report.md)). The handoff target for this group is [redact-secret#1229](https://github.com/redact-secret/redact-secret/issues/1229) and, for shared causes, the Batch 2 issues; state as read with `gh` on 2026-10-07:

| Round-1 gap group | cases in this group | handed to | final record | status of the item | R3 = R4 (open = recorded policy cases) |
| --- | ---: | --- | --- | --- | --- |
| `G-brace` brace template placeholder `{NAME}` reported (span stops before the closing brace) (product gap) | 22 | #1234 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1234/addendum-brace-angle-mask-placeholders.md) | closed | 22 closed, 0 open |
| `G-docmask` documented mask/ellipsis/xxx/upper-case-name placeholder reported as a value (product gap) | 1 | #1234 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1234/addendum-brace-angle-mask-placeholders.md) | closed | 1 closed, 0 open |
| `G-meta-pipe-span` Meta `APP_ID\|SECRET`: finding covers the whole pipe pair, expectation is the secret half only (over-span, fully covered) (policy question) | 21 | policy deviation (a), recorded in the same spec row | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/specs/detector-families.md) | recorded; no defect issue | 0 closed, 21 open |
| `G-elastic-encoded` Elastic cross-cluster `encoded` member (base64 `id:key`) not reported; only `api_key` is (product gap) | 17 | #1229 addendum (encoded member with an api_key sibling fixed; encoded-only stays a disclosed limit) | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1229/addendum-elastic-encoded-member.md) | fixed with sibling; encoded-only recorded | 16 closed, 1 open |

Item states from `gh` on 2026-10-07: redact-secret#1229 closed (2026-10-06); #1234 and #1241 closed; **#1247 (curl -u / --user password carrier) and #1256 (bare `token` member) are open maintainer decisions** with their own acceptance criteria. The two deviations (a) Meta `APP_ID|SECRET` redacted whole and (b) the Adobe public client ID under `x-api-key` are policy decisions recorded in the core's detector-families spec, not defects, so no defect item exists for them. No confirmed gap is left without a recorded item; nothing needed filing from this repository.

## 7. Replay of the fixes and regression controls

The candidate fixes were replayed on the **unchanged inputs** (corpus digests verified before every scan) in three rounds, and the Batch 1 and Batch 2 regression controls were replayed on the published beta.14 in round 4 ([`controls`](../groups-cde/round4-published-beta14/report.md#3-regression-controls-batch-1-and-batch-2)): Batch 1 34/34 positives and 42/42 controls, Batch 2 round 1 200/200 and 203/203, round 2 1010/1010 and 555/555, 0 regressions against the accepted Batch 2 round-3 observations ([`evidence/739/round3/report.md`](../739/round3/report.md)). Regression rule: a scored case that was good on A, B1 or R2 and is bad later.

| step | regressions | detail |
| --- | ---: | --- |
| A to B1 (`e1284537`) | 0 | all changes were improvements, none in C or E ([round 1 report](../groups-cde/round1/report.md#a-against-b)) |
| B1 to R2 (`e1cc1f31`) | 0 | none in this group |
| R2 to R3 (`c6dd6859`) | 0 | the round-2 regression is gone; every difference from R2 is a control that became clean |
| R3 vs A, B1 and R2, all cases | 0 | newly introduced leak: none; newly introduced false positive: none; newly introduced parity regression: none |
| R4 (published beta.14) vs R3 | 0 | 0 cases with any different finding on any surface or mode |

Controls flagged by identity: A 25, B1 23, R2 8, R3 0, R4 0 (of 351); positives exact: 159, 181, 197, 197, 197 (of 219). Leaks (positives not fully covered) fell from 39 on A to 1 on R3 and R4.

## 8. Parity

On the published beta.14 (R4), 868 of 868 cases are identical on all 16 observations (Node, WASM, Python, CLI; whole, 7-byte and 1-byte stream), 868 also in the detector name, 0 divergent. R3 and A and B1 and R2: 0 divergent as well ([round 3](../groups-cde/round3/report.md#3-parity), [round 1](../groups-cde/round1/report.md#parity)). Range units differ by surface and are converted to UTF-8 byte offsets by the harness.

## 9. Acceptance criteria, as met by this artifact

| Criterion | Status | Where |
| --- | --- | --- |
| Each row identifies immutable contract/case lineage and accepted product policy, including unsupported/unresolved properties | met | sections 1 and 4, [`lineage.json`](lineage.json) |
| Expected cases authored independently and frozen before execution; synthetic data only | met (maintainer-only evidence, stated, not independent validation) | section 1, freeze record |
| Baseline uses exact published pin and exact candidate/source/artifact identity with scanner/config/input/environment digests | met | section 2, round 3 and round 4 identities |
| Exact span, sanitized output, type/action, overlap and runtime/whole-stream parity; masking, attribution and policy kept apart | met | sections 3 and 8 |
| Every confirmed adopted-contract gap handed to the product issue with reproduction | met | section 6 |
| Replay of exact candidate fixes on unchanged inputs and controls; no new leak, false positive or parity regression | met | section 7 |
| Per-family final report with no-code coverage, qualified improvements, historical-only, policy limits and source-unresolved counts separately | met | section 5 |
| Final artifacts in evidence/753/ and linked back to core/evidence | met | this directory; links in section 1 and 6 |
| Diagnostic outcomes change no official pin, authority, ledger or support status | met | no official-run pin, no credential-qualification authority value, no ledger row and no support status is touched; no workflow was dispatched |
| Performance and slow peer runs remain separate | met | none was run; observations reused by exact identity |

## 10. Honest limits

- Project-authored, maintainer-only evidence: agreement shows consistency with the maintainers' own contract and nothing more. The policy dispositions (#1241, #1247, #1256, deviations (a) and (b)) are the maintainers' decisions; this page records them.
- The candidate was changed to close exactly the cases rounds 1 and 2 reported, on these same corpora; generalisation to unseen carriers is not claimed, and the placeholder grammar has false-positive costs on real traffic that these corpora do not measure.
- One host (darwin-arm64), not a linux-x64 official run; native bytes are host-bound; peers not run.
- The scorer cannot express policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run or any-shape: an over-wide finding is `fullyCovered` but not `exact`.
- Official qualification later uses credential-eval RunArtifacts and the normal adoption path; nothing here is that.

## Links

[round 1](../groups-cde/round1/report.md) (baseline and gap list), [round 2](../groups-cde/round2/report.md) (regression), [round 3](../groups-cde/round3/report.md) (final candidate, all 43 rows), [round 4](../groups-cde/round4-published-beta14/report.md) (published beta.14), data `../groups-cde/round{1,2,3}/scores.json`, `../groups-cde/round4-published-beta14/scores.json`; sibling artifacts [#752](../752/README.md), [#753](../753/README.md), [#754](../754/README.md); earlier focused lanes [#717](../717/README.md), [#739](../739/README.md).

