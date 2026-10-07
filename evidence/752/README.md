# Evidence: #752, Group C: format-conflict resolution (11 rows)

**Final artifact of [#752](https://github.com/redact-secret/redact-secret-benchmarks/issues/752).** Rendered by `scripts/render-groups-cde-final.mjs` from the committed round 1 to 4 data; it replaces the earlier status page, which was written before the contract was adopted and the corpus measured. This repository records observations and accounting; it does not decide product output, and nothing here changes an official pin, the authority, the ledger or a support status.

**Result.** The 11 rows of Group C were measured on a frozen, synthetic corpus of 646 cases (277 positives, 242 controls, 127 unsupported and 0 conflict cases, observed only) on the published beta.13 baseline and on the exact candidate `c6dd6859`, and the candidate's behaviour was then reproduced on the **published** `0.1.0-beta.14` packages. Final dispositions (round 3, unchanged on the published beta.14): covered with recorded policy deviation 4; fully covered 4; policy-limited 2; carrier unresolved (observed only) 1. **Open product gaps: 0. Regressions: 0. Parity divergences: 0.** The failing scored cases that remain (51) are exactly the recorded policy cases named below; they are listed, not hidden, and the policy-limited rows are not called covered.

## 1. Lineage (contract and case)

| Layer | Immutable reference |
| --- | --- |
| Product contract (accepted, class level, conditional per row) | [redact-secret#1228](https://github.com/redact-secret/redact-secret/issues/1228), merged in [#1243](https://github.com/redact-secret/redact-secret/pull/1243) `db0e5c8ddf706988967e971593f509daf460c222`; final record pinned at core `2816897f`: [`evidence/1228/README.md`](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1228/README.md) |
| Evidence epic and research children | [credential-evidence#236](https://github.com/redact-secret/credential-evidence/issues/236) (closed); [#239](https://github.com/redact-secret/credential-evidence/issues/239), [#240](https://github.com/redact-secret/credential-evidence/issues/240), [#241](https://github.com/redact-secret/credential-evidence/issues/241) (closed); inventory [#231](https://github.com/redact-secret/credential-evidence/issues/231) |
| Evidence snapshot the cases are authored from | `snapshot-2026.10.06.5`, commit `574b52ba367e2071d5a9bea3e2da7a9c5057f633` (credential-evidence PR #263); maintainer-only evidence, **not** independent validation |
| Frozen manifest and freeze commit | [`benchmarks/group-c/FROZEN-group-c.json`](../../benchmarks/group-c/FROZEN-group-c.json), freeze commit `a7350c51` (committed before any scanner, CLI, detector or product build ran on the corpus); record [`benchmarks/FREEZE-groups-cde.md`](../../benchmarks/FREEZE-groups-cde.md); sha256 `f216ca0a72c52d2b268924662d7f4ab66372c9820d0cfe386e3eefa0110dc37d`, 646 cases |
| Errata | errata-1 (nine OAuth `code=` controls downgraded to observed-only, texts byte-identical): corpus sha256 `16036d043fc0dad0e45ec42e2513d2ffec2020da3458a95ed57f09f44fb0e02d` ([`FROZEN-group-c-errata-1.json.proposed`](../../benchmarks/group-c/FROZEN-group-c-errata-1.json.proposed)); the original manifest is untouched and every measurement after round 1 uses errata-1 |
| Corpus generator and tests | [`benchmarks/group-c/`](../../benchmarks/group-c/) (traceability: `TRACEABILITY.md`), `tests/group-c-corpus.test.mjs`; scorer `benchmarks/batch2/score-r2.mjs` (unchanged) |
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
| A beta.13 | 277 | 197 | 212 | 65 | 242 | 27 | 127 | 0 |
| B1 e1284537 | 277 | 197 | 212 | 65 | 242 | 27 | 127 | 0 |
| R2 e1cc1f31 | 277 | 232 | 247 | 30 | 242 | 10 | 127 | 0 |
| R3 c6dd6859 | 277 | 232 | 247 | 30 | 242 | 6 | 127 | 0 |
| R4 published beta.14 | 277 | 232 | 247 | 30 | 242 | 6 | 127 | 0 |

Type and action (convention): R3 pass 232 of 277, type 247, action 247; where a finding touches a C span its type and action equal the convention, so the remaining gap is span width and misses.

## 4. Accepted product policy and unresolved properties, per row

From the accepted contract (the core's own per-row tables at `db0e5c8d`, condensed in [`row-policy.json`](../groups-cde/final/row-policy.json)). "Unresolved" properties are asserted nowhere: they contribute no pass or fail.

| Row | Research child | Accepted policy | Unresolved or unsupported properties |
| --- | --- | --- | --- |
| `adobe:oauth-server-to-server-client-secret` | [#239](https://github.com/redact-secret/credential-evidence/issues/239) | Bounded-context fallback: the client_secret form or query parameter of the client_credentials request. No bare detector. | Bare p8e- plus 32 characters rests on two rule artifacts of unstated basis; hyphen in the body. |
| `adobe:enterprise-web-app-client-secret` | [#239](https://github.com/redact-secret/credential-evidence/issues/239) | Bounded-context fallback: the client_secret form parameter beside org_id. | No grammar recorded; subtype unattributed (tie to Group D). |
| `adobe:oauth-web-app-client-secret` | [#239](https://github.com/redact-secret/credential-evidence/issues/239) | Bounded-context fallback: the Authorization Basic envelope of the token, refresh and revoke requests, whole undecoded value (public client id half included). | No grammar recorded; subtype unattributed (tie to Group D). |
| `airtable:personal-access-token` | [#240](https://github.com/redact-secret/credential-evidence/issues/240) | Bounded-context fallback: Authorization Bearer; the api_key URL parameter is documented as unsupported. | Opaque by provider statement; the pat.14.64-hex layout is two maintainers' artifacts and constrains nothing; format may change. |
| `contentful:cma-personal-access-token` | [#241](https://github.com/redact-secret/credential-evidence/issues/241) | Bounded-context fallback: Authorization Bearer on the creation endpoint's documented form. | CFPAT- begins provider placeholders only; length 43 versus 40+ versus a 64-hex example; bare member of the create response is the bare-token question (#1256 under #1241). |
| `dropbox:access-token` | [#240](https://github.com/redact-secret/credential-evidence/issues/240) | Bounded-context fallback: Authorization Bearer and the access_token response member, at any length. | Opaque, may exceed 1 KB; sl. and a 130+ run are three artifacts with different bounds. |
| `hubspot:private-app-access-token` | [#240](https://github.com/redact-secret/credential-evidence/issues/240) | Bounded-context fallback: Authorization Bearer; the tokenKey body field of the token-information request. | pat-na1-/pat-eu1- is one maintainer's artifact; era-limited (legacy private apps being disabled). |
| `jfrog:reference-token` | [#241](https://github.com/redact-secret/credential-evidence/issues/241) | Era-specific, unresolved: the X-JFrog-Art-Api header or the basic-authentication password. | Two provider statements (64 and 128 characters) kept apart; the curl -u password carrier is #1247; era tie to Group E. |
| `meta:app-secret` | [#241](https://github.com/redact-secret/credential-evidence/issues/241) | Bounded-context fallback: the client_secret parameter; the {app-id}\|{app-secret} composite is decided in Group D (one span over the whole pair). | 32 characters is artifact scope, alphabet not settled; a bare value is never attributable. |
| `salesforce:oauth-refresh-token` | [#241](https://github.com/redact-secret/credential-evidence/issues/241) | Bounded-context fallback: the refresh_token request parameter and response member (a token-endpoint field, never a resource Bearer credential). | 5Aep861 prefix rests on two artifacts of unconfirmed independence; remainders 80 versus 40. |
| `x:oauth1-consumer-secret` | [#241](https://github.com/redact-secret/credential-evidence/issues/241) | Unresolved: the secret is a signing-key input and no transported carrier is named. | Carrier; 50 versus 35 to 44 characters; percent-containing forms are outside the raw-input contract. |

## 5. Per-row final report

`positives exact` and `controls flagged` are on the final candidate R3 and on published beta.13 (A); R4 equals R3 on every case. Observed-only counts are unassertable variants (no pass or fail).

| Row | cases (pos / ctl / unsup / conflict) | evidence Cases | A beta.13 | R3 = R4 | Final disposition |
| --- | --- | ---: | --- | --- | --- |
| `adobe:oauth-server-to-server-client-secret` | 24 / 28 / 9 / 0 | 3 | 24/24 exact, 5/28 flagged | 24/24 exact, 2/28 flagged | **covered with recorded policy deviation**: 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) |
| `adobe:enterprise-web-app-client-secret` | 21 / 28 / 15 / 0 | 4 | 21/21 exact, 5/28 flagged | 21/21 exact, 2/28 flagged | **covered with recorded policy deviation**: 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) |
| `adobe:oauth-web-app-client-secret` | 16 / 15 / 10 / 0 | 4 | 16/16 exact, 2/15 flagged | 16/16 exact, 2/15 flagged | **covered with recorded policy deviation**: 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) |
| `airtable:personal-access-token` | 22 / 21 / 4 / 0 | 3 | 22/22 exact, 0/21 flagged | 22/22 exact, 0/21 flagged | **fully covered**: 22/22 positives exact, 21 controls clean |
| `contentful:cma-personal-access-token` | 33 / 28 / 12 / 0 | 3 | 18/33 exact, 5/28 flagged | 18/33 exact, 0/28 flagged | **policy-limited**: 15 open: a lone `token` member (Contentful create response beside only `name`) is not read: #1256 (bare `token` member) under the bare-`token` rule #1241 (read only beside `sys` or `scopes`) |
| `dropbox:access-token` | 36 / 22 / 12 / 0 | 3 | 36/36 exact, 0/22 flagged | 36/36 exact, 0/22 flagged | **fully covered**: 36/36 positives exact, 22 controls clean |
| `hubspot:private-app-access-token` | 35 / 22 / 11 / 0 | 3 | 18/35 exact, 0/22 flagged | 35/35 exact, 0/22 flagged | **fully covered**: 35/35 positives exact, 22 controls clean |
| `jfrog:reference-token` | 33 / 22 / 9 / 0 | 3 | 0/33 exact, 0/22 flagged | 18/33 exact, 0/22 flagged | **policy-limited**: 15 open: `curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) |
| `meta:app-secret` | 22 / 23 / 17 / 0 | 4 | 7/22 exact, 10/23 flagged | 7/22 exact, 0/23 flagged | **covered with recorded policy deviation**: 15 cases: Meta `APP_ID\|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a)) |
| `salesforce:oauth-refresh-token` | 35 / 21 / 13 / 0 | 3 | 35/35 exact, 0/21 flagged | 35/35 exact, 0/21 flagged | **fully covered**: 35/35 positives exact, 21 controls clean |
| `x:oauth1-consumer-secret` | 0 / 12 / 15 / 0 | 2 | 0/0 exact, 0/12 flagged | 0/0 exact, 0/12 flagged | **carrier unresolved (observed only)**: no scored positive; 12 controls, 0 flagged |

### Counts, kept separate

| Category | Rows | Cases or detail |
| --- | ---: | --- |
| **No-code coverage**: every scored case already passes on published beta.13, no product change needed | 3 | `airtable:personal-access-token`, `dropbox:access-token`, `salesforce:oauth-refresh-token` |
| **Qualified improvement**: more scored cases good on R3 than on beta.13 (the candidate fixes, now published in beta.14); no row lost a case | 6 | `adobe:oauth-server-to-server-client-secret` (+3), `adobe:enterprise-web-app-client-secret` (+3), `contentful:cma-personal-access-token` (+5), `hubspot:private-app-access-token` (+17), `jfrog:reference-token` (+18), `meta:app-secret` (+10) |
| **Historical-only** (retired era, redacted without an authentication claim) | 0 | not applicable to this group (no retired-era row) |
| **Policy limits** (recorded product policy leaves scored cases open or deviating) | 6 | `adobe:oauth-server-to-server-client-secret` (deviation, 2 cases), `adobe:enterprise-web-app-client-secret` (deviation, 2 cases), `adobe:oauth-web-app-client-secret` (deviation, 2 cases), `contentful:cma-personal-access-token` (policy-limited, 15 cases), `jfrog:reference-token` (policy-limited, 15 cases), `meta:app-secret` (deviation, 15 cases) |
| **Source-unresolved** (carrier unresolved, observed only; no scored positive, controls clean) | 1 | `x:oauth1-consumer-secret` |
| **Unassertable variants** (unsupported plus conflict cases; contribute no pass or fail) | n/a | 127 cases (127 unsupported, 0 conflict) across all rows |

The primary dispositions partition the rows (covered with recorded policy deviation 4, fully covered 4, policy-limited 2, carrier unresolved (observed only) 1; sum 11); the other counts are separate lenses and overlap with it by design, so they are never added together. Open product gaps: 0. A "fully covered" row means every frozen scored case passes on one host; it does not promote support.

## 6. Gap handoffs

Every confirmed adopted-contract gap of round 1 (a scored case the Case supports and the product failed) is a recorded redact-secret product item with its reproduction (case ids, expected and observed spans in [`round1/gaps.json`](../groups-cde/round1/gaps.json) and [`round1/report.md`](../groups-cde/round1/report.md)). The handoff target for this group is [redact-secret#1228](https://github.com/redact-secret/redact-secret/issues/1228) and, for shared causes, the Batch 2 issues; state as read with `gh` on 2026-10-07:

| Round-1 gap group | cases in this group | handed to | final record | status of the item | R3 = R4 (open = recorded policy cases) |
| --- | ---: | --- | --- | --- | --- |
| `G-brace` brace template placeholder `{NAME}` reported (span stops before the closing brace) (product gap) | 16 | #1234 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1234/addendum-brace-angle-mask-placeholders.md) | closed | 16 closed, 0 open |
| `G-docmask` documented mask/ellipsis/xxx/upper-case-name placeholder reported as a value (product gap) | 5 | #1234 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1234/addendum-brace-angle-mask-placeholders.md) | closed | 5 closed, 0 open |
| `G-xapikey-clientid` `x-api-key` header whose value the evidence names a public client ID (control flagged) (policy question) | 6 | policy deviation (b), recorded in the detector-families spec row of #1228/#1229/#1230 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/specs/detector-families.md) | recorded; no defect issue | 0 closed, 6 open |
| `G-authcode` control carries an OAuth `code=` value; the product reads it as a credential (warn) (corpus erratum candidate) | 9 | corpus erratum (errata-1 applied on this side); no product issue | [record](../groups-cde/round1/report.md) | n/a | 0 closed, 0 open |
| `G-meta-pipe-span` Meta `APP_ID\|SECRET`: finding covers the whole pipe pair, expectation is the secret half only (over-span, fully covered) (policy question) | 15 | policy deviation (a), recorded in the same spec row | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/specs/detector-families.md) | recorded; no defect issue | 0 closed, 15 open |
| `G-token-member` bare `token` / `tokenKey` JSON member value not read (Contentful CMA PAT, HubSpot private-app token) (product gap) | 32 | #1256 (open) under #1241 (closed); tokenKey: #1228 addendum | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1228/addendum-contentful-create-response-token.md) | open decision | 17 closed, 15 open |
| `G-jfrog` `X-JFrog-Art-Api` header and `curl -u user:<secret>` password not read (JFrog reference token / API key) (product gap) | 33 | header: #1228 addendum (fixed); curl -u password: #1247 (open) | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1228/addendum-jfrog-art-api-header.md) | header fixed; password open decision | 18 closed, 15 open |

Item states from `gh` on 2026-10-07: redact-secret#1228 closed (2026-10-06); #1234 and #1241 closed; **#1247 (curl -u / --user password carrier) and #1256 (bare `token` member) are open maintainer decisions** with their own acceptance criteria. The two deviations (a) Meta `APP_ID|SECRET` redacted whole and (b) the Adobe public client ID under `x-api-key` are policy decisions recorded in the core's detector-families spec, not defects, so no defect item exists for them. No confirmed gap is left without a recorded item; nothing needed filing from this repository.

## 7. Replay of the fixes and regression controls

The candidate fixes were replayed on the **unchanged inputs** (corpus digests verified before every scan) in three rounds, and the Batch 1 and Batch 2 regression controls were replayed on the published beta.14 in round 4 ([`controls`](../groups-cde/round4-published-beta14/report.md#3-regression-controls-batch-1-and-batch-2)): Batch 1 34/34 positives and 42/42 controls, Batch 2 round 1 200/200 and 203/203, round 2 1010/1010 and 555/555, 0 regressions against the accepted Batch 2 round-3 observations ([`evidence/739/round3/report.md`](../739/round3/report.md)). Regression rule: a scored case that was good on A, B1 or R2 and is bad later.

| step | regressions | detail |
| --- | ---: | --- |
| A to B1 (`e1284537`) | 0 | all changes were improvements, none in C or E ([round 1 report](../groups-cde/round1/report.md#a-against-b)) |
| B1 to R2 (`e1cc1f31`) | 0 | none in this group |
| R2 to R3 (`c6dd6859`) | 0 | the round-2 regression is gone; every difference from R2 is a control that became clean |
| R3 vs A, B1 and R2, all cases | 0 | newly introduced leak: none; newly introduced false positive: none; newly introduced parity regression: none |
| R4 (published beta.14) vs R3 | 0 | 0 cases with any different finding on any surface or mode |

Controls flagged by identity: A 27, B1 27, R2 10, R3 6, R4 6 (of 242); positives exact: 197, 197, 232, 232, 232 (of 277). Leaks (positives not fully covered) fell from 65 on A to 30 on R3 and R4.

## 8. Parity

On the published beta.14 (R4), 646 of 646 cases are identical on all 16 observations (Node, WASM, Python, CLI; whole, 7-byte and 1-byte stream), 646 also in the detector name, 0 divergent. R3 and A and B1 and R2: 0 divergent as well ([round 3](../groups-cde/round3/report.md#3-parity), [round 1](../groups-cde/round1/report.md#parity)). Range units differ by surface and are converted to UTF-8 byte offsets by the harness.

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
| Final artifacts in evidence/752/ and linked back to core/evidence | met | this directory; links in section 1 and 6 |
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

