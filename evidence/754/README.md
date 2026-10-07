# Evidence: #754, Group E: historical and current-source reconciliation (9 rows)

**Final artifact of [#754](https://github.com/redact-secret/redact-secret-benchmarks/issues/754).** Rendered by `scripts/render-groups-cde-final.mjs` from the committed round 1 to 4 data; it replaces the earlier status page, which was written before the contract was adopted and the corpus measured. This repository records observations and accounting; it does not decide product output, and nothing here changes an official pin, the authority, the ledger or a support status.

**Result.** The 9 rows of Group E were measured on a frozen, synthetic corpus of 767 cases (343 positives, 186 controls, 234 unsupported and 4 conflict cases, observed only) on the published beta.13 baseline and on the exact candidate `c6dd6859`, and the candidate's behaviour was then reproduced on the **published** `0.1.0-beta.14` packages. Final dispositions (round 3, unchanged on the published beta.14): carrier unresolved (observed only) 1; fully covered 5; policy-limited 3. **Open product gaps: 0. Regressions: 0. Parity divergences: 0.** The failing scored cases that remain (46) are exactly the recorded policy cases named below; they are listed, not hidden, and the policy-limited rows are not called covered.

## 1. Lineage (contract and case)

| Layer | Immutable reference |
| --- | --- |
| Product contract (accepted, class level, conditional per row) | [redact-secret#1230](https://github.com/redact-secret/redact-secret/issues/1230), merged in [#1243](https://github.com/redact-secret/redact-secret/pull/1243) `db0e5c8ddf706988967e971593f509daf460c222`; final record pinned at core `2816897f`: [`evidence/1230/README.md`](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1230/README.md) |
| Evidence epic and research children | [credential-evidence#238](https://github.com/redact-secret/credential-evidence/issues/238) (closed); [#245](https://github.com/redact-secret/credential-evidence/issues/245), [#246](https://github.com/redact-secret/credential-evidence/issues/246), [#247](https://github.com/redact-secret/credential-evidence/issues/247) (closed); inventory [#231](https://github.com/redact-secret/credential-evidence/issues/231) |
| Evidence snapshot the cases are authored from | `snapshot-2026.10.06.5`, commit `574b52ba367e2071d5a9bea3e2da7a9c5057f633` (credential-evidence PR #263); maintainer-only evidence, **not** independent validation |
| Frozen manifest and freeze commit | [`benchmarks/group-e/FROZEN-group-e.json`](../../benchmarks/group-e/FROZEN-group-e.json), freeze commit `a7350c51` (committed before any scanner, CLI, detector or product build ran on the corpus); record [`benchmarks/FREEZE-groups-cde.md`](../../benchmarks/FREEZE-groups-cde.md); sha256 `6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa`, 767 cases |
| Corpus generator and tests | [`benchmarks/group-e/`](../../benchmarks/group-e/) (traceability: `TRACEABILITY.md`), `tests/group-e-corpus.test.mjs`; scorer `benchmarks/batch2/score-r2.mjs` (unchanged) |
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
| A beta.13 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| B1 e1284537 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| R2 e1cc1f31 | 343 | 297 | 297 | 46 | 186 | 1 | 234 | 4 |
| R3 c6dd6859 | 343 | 297 | 297 | 46 | 186 | 0 | 234 | 4 |
| R4 published beta.14 | 343 | 297 | 297 | 46 | 186 | 0 | 234 | 4 |


## 4. Accepted product policy and unresolved properties, per row

From the accepted contract (the core's own per-row tables at `db0e5c8d`, condensed in [`row-policy.json`](../groups-cde/final/row-policy.json)). "Unresolved" properties are asserted nowhere: they contribute no pass or fail.

| Row | Research child | Accepted policy | Unresolved or unsupported properties |
| --- | --- | --- | --- |
| `adobe:service-account-jwt-private-key` | [#245](https://github.com/redact-secret/credential-evidence/issues/245) | Historical-only role; shared generic private_key (PEM) detection, no Adobe type; identifiers and key references are not the key. | Encoding, label and length of the key file; any Adobe marker; whether any key still works; no scored positive. |
| `airtable:legacy-api-key` | [#245](https://github.com/redact-secret/credential-evidence/issues/245) | Historical-only; bounded-context fallback: api_key URL parameter or variable, Bearer value. | Prefix, alphabet, length; presentation form; whether a key authenticated after 2024-02-01. |
| `dropbox:legacy-long-lived-access-token` | [#245](https://github.com/redact-secret/credential-evidence/issues/245) | Historical-only (conflicting retirement dates); bounded-context fallback: access_token JSON member, Bearer value; a bare value is silent. | Which date applies; whether existing tokens still authenticate; format. |
| `hubspot:legacy-api-key` | [#245](https://github.com/redact-secret/credential-evidence/issues/245) | Historical account key plus a current developer key in one carrier; the hapikey name admitted as a whole-name vocabulary entry (#1225/#1233 rule) with placeholder and mask exclusions, no HubSpot attribution, no era. | Format; UUID-shaped lead; whether a key authenticated after 2022-11-30. |
| `jfrog:api-key` | [#246](https://github.com/redact-secret/credential-evidence/issues/246) | Era-specific, no shutdown claim; whole-name entry for the documented X-JFrog-Art-API header, shared with the reference token and attributing neither; no bare claim. | Which form applies to which release; the curl -u password carrier is #1247. |
| `reddit:oauth-access-token` | [#247](https://github.com/redact-secret/credential-evidence/issues/247) | Archived (Reddit-pointed) carriers: JSON access_token, URL fragment, lower-case bearer header; token= read with revoke/introspect context. | Lifetime as a current fact; expires_in unit; bare token= is the #1241 rule. |
| `reddit:oauth-refresh-token` | [#247](https://github.com/redact-secret/credential-evidence/issues/247) | Archived (Reddit-pointed): the refresh_token body field, never a resource Bearer credential. | Whether permanent tokens are still issued; lifetime and rotation; format. |
| `reddit:app-client-secret` | [#247](https://github.com/redact-secret/credential-evidence/issues/247) | Current claims historical-only (Reddit-pointed archived carriers); the Basic envelope is one authorization_credential span; client_secret and REDDIT_CLIENT_SECRET are read. | Format; whether registration still shows a secret; the curl -u carrier is #1247. |
| `zendesk:api-token` | [#246](https://github.com/redact-secret/credential-evidence/issues/246) | Era-specific lifecycle; the Basic envelope is one authorization_credential span; exact-span policy for the email/token: composition. | Token prefix, alphabet, length; whether phase 1 was applied; the curl -u carrier is #1247. |

Eras (kept separate from detection by the accepted contract: a historical credential is still redacted without any claim that it authenticates):

- `adobe:service-account-jwt-private-key`: historical-only (E1 retired era)
- `airtable:legacy-api-key`: historical-only (E1 retired era)
- `dropbox:legacy-long-lived-access-token`: historical-only (E1 retired era)
- `hubspot:legacy-api-key`: historical-only (E1 retired era; the developer key is current)
- `jfrog:api-key`: deprecated with continuing legacy use (E2)
- `reddit:oauth-access-token`: current carriers beyond archived documentation (E3)
- `reddit:oauth-refresh-token`: current carriers beyond archived documentation (E3)
- `reddit:app-client-secret`: current carriers beyond archived documentation (E3)
- `zendesk:api-token`: deprecated with continuing legacy use (E2)

## 5. Per-row final report

`positives exact` and `controls flagged` are on the final candidate R3 and on published beta.13 (A); R4 equals R3 on every case. Observed-only counts are unassertable variants (no pass or fail).

| Row | cases (pos / ctl / unsup / conflict) | evidence Cases | A beta.13 | R3 = R4 | Final disposition |
| --- | --- | ---: | --- | --- | --- |
| `adobe:service-account-jwt-private-key` | 0 / 17 / 24 / 0 | 3 | 0/0 exact, 1/17 flagged | 0/0 exact, 0/17 flagged | **carrier unresolved (observed only)**: no scored positive; 17 controls, 0 flagged |
| `airtable:legacy-api-key` | 28 / 18 / 20 / 0 | 3 | 27/28 exact, 1/18 flagged | 28/28 exact, 0/18 flagged | **fully covered**: 28/28 positives exact, 18 controls clean |
| `dropbox:legacy-long-lived-access-token` | 25 / 16 / 24 / 0 | 3 | 24/25 exact, 0/16 flagged | 25/25 exact, 0/16 flagged | **fully covered**: 25/25 positives exact, 16 controls clean |
| `hubspot:legacy-api-key` | 32 / 19 / 24 / 0 | 3 | 0/32 exact, 0/19 flagged | 32/32 exact, 0/19 flagged | **fully covered**: 32/32 positives exact, 19 controls clean |
| `jfrog:api-key` | 40 / 22 / 32 / 0 | 3 | 0/40 exact, 0/22 flagged | 22/40 exact, 0/22 flagged | **policy-limited**: 18 open: `curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) |
| `reddit:oauth-access-token` | 86 / 38 / 44 / 0 | 5 | 59/86 exact, 0/38 flagged | 84/86 exact, 0/38 flagged | **policy-limited**: 2 open: `token=` with no revoke/introspect endpoint and no `token_type_hint` is not read: bare-`token` rule of #1241 |
| `reddit:oauth-refresh-token` | 48 / 20 / 29 / 0 | 3 | 46/48 exact, 0/20 flagged | 48/48 exact, 0/20 flagged | **fully covered**: 48/48 positives exact, 20 controls clean |
| `reddit:app-client-secret` | 26 / 15 / 14 / 0 | 4 | 0/26 exact, 0/15 flagged | 0/26 exact, 0/15 flagged | **policy-limited**: 26 open: `curl -u/--user id:secret` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) |
| `zendesk:api-token` | 58 / 21 / 23 / 4 | 4 | 26/58 exact, 0/21 flagged | 58/58 exact, 0/21 flagged | **fully covered**: 58/58 positives exact, 21 controls clean |

### Counts, kept separate

| Category | Rows | Cases or detail |
| --- | ---: | --- |
| **No-code coverage**: every scored case already passes on published beta.13, no product change needed | 0 | none |
| **Qualified improvement**: more scored cases good on R3 than on beta.13 (the candidate fixes, now published in beta.14); no row lost a case | 8 | `adobe:service-account-jwt-private-key` (+1), `airtable:legacy-api-key` (+2), `dropbox:legacy-long-lived-access-token` (+1), `hubspot:legacy-api-key` (+32), `jfrog:api-key` (+22), `reddit:oauth-access-token` (+25), `reddit:oauth-refresh-token` (+2), `zendesk:api-token` (+32) |
| **Historical-only** (retired era, redacted without an authentication claim) | 4 | `adobe:service-account-jwt-private-key`, `airtable:legacy-api-key`, `dropbox:legacy-long-lived-access-token`, `hubspot:legacy-api-key` |
| **Policy limits** (recorded product policy leaves scored cases open or deviating) | 3 | `jfrog:api-key` (policy-limited, 18 cases), `reddit:oauth-access-token` (policy-limited, 2 cases), `reddit:app-client-secret` (policy-limited, 26 cases) |
| **Source-unresolved** (carrier unresolved, observed only; no scored positive, controls clean) | 1 | `adobe:service-account-jwt-private-key` |
| **Unassertable variants** (unsupported plus conflict cases; contribute no pass or fail) | n/a | 238 cases (234 unsupported, 4 conflict) across all rows |

The primary dispositions partition the rows (carrier unresolved (observed only) 1, fully covered 5, policy-limited 3; sum 9); the other counts are separate lenses and overlap with it by design, so they are never added together. Open product gaps: 0. A "fully covered" row means every frozen scored case passes on one host; it does not promote support.

## 6. Gap handoffs

Every confirmed adopted-contract gap of round 1 (a scored case the Case supports and the product failed) is a recorded redact-secret product item with its reproduction (case ids, expected and observed spans in [`round1/gaps.json`](../groups-cde/round1/gaps.json) and [`round1/report.md`](../groups-cde/round1/report.md)). The handoff target for this group is [redact-secret#1230](https://github.com/redact-secret/redact-secret/issues/1230) and, for shared causes, the Batch 2 issues; state as read with `gh` on 2026-10-07:

| Round-1 gap group | cases in this group | handed to | final record | status of the item | R3 = R4 (open = recorded policy cases) |
| --- | ---: | --- | --- | --- | --- |
| `G-brace` brace template placeholder `{NAME}` reported (span stops before the closing brace) (product gap) | 1 | #1234 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1234/addendum-brace-angle-mask-placeholders.md) | closed | 1 closed, 0 open |
| `G-angle` angle placeholder `<...>` reported (product gap) | 1 | #1234 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1234/addendum-brace-angle-mask-placeholders.md) | closed | 1 closed, 0 open |
| `G-jfrog` `X-JFrog-Art-Api` header and `curl -u user:<secret>` password not read (JFrog reference token / API key) (product gap) | 40 | header: #1228 addendum (fixed); curl -u password: #1247 (open) | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1228/addendum-jfrog-art-api-header.md) | header fixed; password open decision | 22 closed, 18 open |
| `G-hapikey` HubSpot legacy `hapikey=` query parameter not read (product gap) | 32 | #1230 addendum (fixed) | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1230/addendum-hapikey.md) | closed | 32 closed, 0 open |
| `G-reddit-token` Reddit revoke-form `token=` parameter not read (product gap) | 24 | #1230 addendum (revoke/introspect fixed); bare token=: #1256/#1241 | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1230/addendum-revoke-token-parameter.md) | fixed in context; bare form open decision | 22 closed, 2 open |
| `G-reddit-secret` Reddit client secret in `-u/--user id:secret` Basic password not read (product gap) | 26 | curl -u password: #1247 (open) | [record](https://github.com/redact-secret/redact-secret/issues/1247) | open decision | 0 closed, 26 open |
| `G-zendesk-cred` Zendesk `email/token:<token>` credential string: not read in `curl -u`, over-spanned (email included, warn) in JSON/env (product gap) | 32 | #1230 addendum (fixed except curl -u); curl -u: #1247 (open) | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1230/addendum-zendesk-email-token-credential.md) | fixed except curl -u | 32 closed, 0 open |
| `G-digits24` credential-named member/parameter whose value is 24 digits is silent (evidence: flagged by position, not shape) (product gap) | 7 | #1230 addendum (fixed) | [record](https://github.com/redact-secret/redact-secret/blob/2816897f96c405c3eb8c87a0c70eba5df273c121/docs/audits/evidence/1230/addendum-digits-only-values.md) | closed | 7 closed, 0 open |

Item states from `gh` on 2026-10-07: redact-secret#1230 closed (2026-10-06); #1234 and #1241 closed; **#1247 (curl -u / --user password carrier) and #1256 (bare `token` member) are open maintainer decisions** with their own acceptance criteria. The two deviations (a) Meta `APP_ID|SECRET` redacted whole and (b) the Adobe public client ID under `x-api-key` are policy decisions recorded in the core's detector-families spec, not defects, so no defect item exists for them. No confirmed gap is left without a recorded item; nothing needed filing from this repository.

## 7. Replay of the fixes and regression controls

The candidate fixes were replayed on the **unchanged inputs** (corpus digests verified before every scan) in three rounds, and the Batch 1 and Batch 2 regression controls were replayed on the published beta.14 in round 4 ([`controls`](../groups-cde/round4-published-beta14/report.md#3-regression-controls-batch-1-and-batch-2)): Batch 1 34/34 positives and 42/42 controls, Batch 2 round 1 200/200 and 203/203, round 2 1010/1010 and 555/555, 0 regressions against the accepted Batch 2 round-3 observations ([`evidence/739/round3/report.md`](../739/round3/report.md)). Regression rule: a scored case that was good on A, B1 or R2 and is bad later.

| step | regressions | detail |
| --- | ---: | --- |
| A to B1 (`e1284537`) | 0 | all changes were improvements, none in C or E ([round 1 report](../groups-cde/round1/report.md#a-against-b)) |
| B1 to R2 (`e1cc1f31`) | 1 | one: `hubspot:legacy-api-key:e:query-upper-placeholder:control` (`?hapikey=YOUR_HAPIKEY`) turned from clean to `warn`; a blocker, fixed in R3 and recorded in the round-2 report |
| R2 to R3 (`c6dd6859`) | 0 | the round-2 regression is gone; every difference from R2 is a control that became clean |
| R3 vs A, B1 and R2, all cases | 0 | newly introduced leak: none; newly introduced false positive: none; newly introduced parity regression: none |
| R4 (published beta.14) vs R3 | 0 | 0 cases with any different finding on any surface or mode |

Controls flagged by identity: A 2, B1 2, R2 1, R3 0, R4 0 (of 186); positives exact: 182, 182, 297, 297, 297 (of 343). Leaks (positives not fully covered) fell from 151 on A to 46 on R3 and R4.

## 8. Parity

On the published beta.14 (R4), 767 of 767 cases are identical on all 16 observations (Node, WASM, Python, CLI; whole, 7-byte and 1-byte stream), 767 also in the detector name, 0 divergent. R3 and A and B1 and R2: 0 divergent as well ([round 3](../groups-cde/round3/report.md#3-parity), [round 1](../groups-cde/round1/report.md#parity)). Range units differ by surface and are converted to UTF-8 byte offsets by the harness.

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
| Final artifacts in evidence/754/ and linked back to core/evidence | met | this directory; links in section 1 and 6 |
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

