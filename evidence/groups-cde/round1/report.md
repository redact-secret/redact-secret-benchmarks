# Groups C, D and E, round 1: measurement of the frozen baselines

Measured by a session that did not author, freeze or review the corpora. Two product identities, four surfaces (Node addon, WASM, Python, CLI), every case whole and streamed in 7-byte and 1-byte chunks. Nothing was edited: no corpus case, no FROZEN manifest, no evidence extract, no scorer (`benchmarks/batch2/score-r2.mjs`, `score.mjs`), no product code. Platform darwin-arm64 (Darwin 25.5.0 arm64), Node v22.16.0, rustc 1.98.1 (48a229cea 2026-09-01), maturin 1.15.0, Python 3.14.7. **Peers not run** (the TruffleHog on this host is not the 3.97.4 pin). Nothing here repins, changes an official run, promotes support or releases.

## Identities

- **A, published baseline** ("published pin as measured in round 2/3"): `@redact-secret/core`, `@redact-secret/wasm` and `@redact-secret/node-darwin-arm64` 0.1.0-beta.13 from npm (core integrity `sha512-qZkqRN7CIJ+pc0IteRCXSucr1l9KtTc/nJaM5wPL0NvCiZ4AGWLCyrLy8KD95a2MBgxo8vuUJ/UaKhrny7gMJQ==`); PyPI `redact-secret` 0.1.0b13; `redact-secret-cli` 0.1.0-beta.13 built from the published crate with `cargo install --locked`. Local artifact SHA-256: addon `9a4444f7adf346c62b5fa2608d8df73677948e0d47ddc3bc8d819b91aad13eda`, full-profile wasm `d3d77f29e1c492934cc1bcd13139abd3bea20c42832bbbe68f7c02482b8308db`, CLI `28d6852f1ab9c4e3fe90a99e08ad620c2ea6fb4a0fc67e2e9799a8559050e143`.
- **B, candidate**: redact-secret `e1284537a5df5a6cfd051fc7211d276a45ee98bf` (branch `workbench/closeout-batch2-groupcde`, declared 0.1.0-beta.14, not published). Built clone-free in an empty directory from a fresh clone: `npm ci --ignore-scripts` (root and `bindings/node`), `npm run js:build`, `npm run build` in `bindings/node`, `npm run wasm:build` and `wasm:build:common` (`--out-dir`, the same steps as `buildCandidate()` in the core's `scripts/benchmark-candidate.mjs`), `npm pack` of core, the staged darwin-arm64 addon and the staged wasm package installed from the tarballs, `maturin develop --release` (Python 0.1.0b14) in a venv, `cargo build --release --locked -p redact-secret-cli`. Tarball SHA-256: `redact-secret-core-0.1.0-beta.14.tgz` `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2`; `redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz` `6f3354662ab590ae8381d4aed7b375d9344b3394f52eb4c946842f51c31e7e6e`; `redact-secret-wasm-0.1.0-beta.14.tgz` `585ee9cd63b0bfa1f009e32ea8d506f4a38a3b4188bbe8d8e0d650865154d919`. The WASM surface is the full profile (`redact_secret_wasm.js`), the one the harness and Batch 2 used. CLI SHA-256 `9d1a67609e9075673e6b5c4996fd7a816f04a3a8a5868eb3b0fd67a2bf17bf24`. The addon and the wasm bytes are host-bound.
- **Supplementary identity, intermediate**: `efe714968c0e8865df936de9ffa3e095aa771b5b` (main as merged, before the five closeout fixes), built the same way, measured at 7-byte chunks only, to separate the five fixes from everything else that changed since beta.13. Not a requested identity; it is used only in the attribution section.

Corpora (frozen, digests verified against each FROZEN manifest before any scan; the report script aborts on a mismatch, `tests/group-{c,d,e}-corpus.test.mjs` pass 44 of 44, and the generators build the case text at run time):

| group | cases | sha256 of `JSON.stringify(cases)` |
| --- | ---: | --- |
| C (#752) | 646 | `f216ca0a72c52d2b268924662d7f4ab66372c9820d0cfe386e3eefa0110dc37d` |
| D (#753) | 868 | `aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e` |
| E (#754) | 767 | `6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa` |

## Method

The harness is Batch 2's, unchanged: `scripts/measure-batch1.mjs` (observation file per corpus, surface, mode; UTF-8 byte offsets; no matched text) with `--corpus` pointing at each group's exported generator module and `--chunk 7|1`. Scoring is the unchanged `scoreCase` of `benchmarks/batch2/score-r2.mjs` (multi-span positives). A case counts as failing when **any** surface, whole or streamed, fails it (the Batch 2 rule). Headline numbers are `exact`, `fullyCovered`, `misses` (positives) and `controlFlagged` (controls); `unsupported` and `conflict` cases are observed only. The expected finding type and action are convention-labelled in C and null in D and E, so `pass` is by construction 0 in D and E; type and action are reported in their own table. The new scripts in this directory's commit (`scripts/report-groups-cde.mjs`, `triage-groups-cde.mjs`, `attribute-groups-cde.mjs`, `render-groups-cde-report.mjs`) only read observations and the corpora; they add no scoring rule.

## Headline (candidate B against published A)

| group | identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported (observed) | conflict (observed) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C (#752) | A published beta.13 | 277 | 197 | 212 | 65 | 251 | 36 | 118 | 0 |
| C (#752) | B candidate e1284537 | 277 | 197 | 212 | 65 | 251 | 36 | 118 | 0 |
| D (#753) | A published beta.13 | 219 | 159 | 180 | 39 | 351 | 25 | 290 | 8 |
| D (#753) | B candidate e1284537 | 219 | 181 | 202 | 17 | 351 | 23 | 290 | 8 |
| E (#754) | A published beta.13 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| E (#754) | B candidate e1284537 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| all | A | 839 | 538 | 584 | 255 | 788 | 63 | 642 | 12 |
| all | B | 839 | 560 | 606 | 233 | 788 | 61 | 642 | 12 |

`exact`: the finding span equals the expected span on every surface and mode. `fullyCovered`: no expected byte is left uncovered (an over-wide finding is fully covered but not exact). `misses`: at least one expected span is untouched by any finding. The Node-whole run of the unchanged `summarize()` agrees with these case-level numbers wherever surfaces agree (they agree on every case, see Parity); its figures are in `scores.json` (`summarizeNodeWhole`).

### Finding type and action (reported separately)

Group C is the only group with a convention-labelled type and action (the type and action Batch 2 assigns the same carrier, or the generic `contextual_secret`/`redact`; the label varies by carrier). On B, 197 of 277 positives pass (exact span, type and action); type matches on 212 and action on 212, which is exactly the 212 positives that a finding touches (A: pass 197, type 212, action 212). So wherever a finding touches an expected span its type and action equal the convention, and the pass shortfall is span width (15 over-wide Meta pipe cases) plus misses, not labelling. Groups D and E carry `expectedType`/`expectedAction` = null by design; no type/action number is scored there. Observed on B, the findings touching D and E positive spans are `contextual_secret`/`redact` (D 137, E 134), `bearer_token`/`redact` (D 54, E 22), `authorization_credential`/`redact` (D 22, E 26) and `contextual_secret`/`warn` (D 4 exact, E 10 over-wide: the Zendesk credential strings and low-entropy cases).

## Scores per row and kind

### Group C (#752)

| row | pos | exact A | exact B | fullyCov A | fullyCov B | misses A | misses B | ctl | flagged A | flagged B | unsupp | conflict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adobe:oauth-server-to-server-client-secret` | 24 | 24 | 24 | 24 | 24 | 0 | 0 | 31 | 8 | 8 | 6 | 0 |
| `adobe:enterprise-web-app-client-secret` | 21 | 21 | 21 | 21 | 21 | 0 | 0 | 31 | 8 | 8 | 12 | 0 |
| `adobe:oauth-web-app-client-secret` | 16 | 16 | 16 | 16 | 16 | 0 | 0 | 18 | 5 | 5 | 7 | 0 |
| `airtable:personal-access-token` | 22 | 22 | 22 | 22 | 22 | 0 | 0 | 21 | 0 | 0 | 4 | 0 |
| `contentful:cma-personal-access-token` | 33 | 18 | 18 | 18 | 18 | 15 | 15 | 28 | 5 | 5 | 12 | 0 |
| `dropbox:access-token` | 36 | 36 | 36 | 36 | 36 | 0 | 0 | 22 | 0 | 0 | 12 | 0 |
| `hubspot:private-app-access-token` | 35 | 18 | 18 | 18 | 18 | 17 | 17 | 22 | 0 | 0 | 11 | 0 |
| `jfrog:reference-token` | 33 | 0 | 0 | 0 | 0 | 33 | 33 | 22 | 0 | 0 | 9 | 0 |
| `meta:app-secret` | 22 | 7 | 7 | 22 | 22 | 0 | 0 | 23 | 10 | 10 | 17 | 0 |
| `salesforce:oauth-refresh-token` | 35 | 35 | 35 | 35 | 35 | 0 | 0 | 21 | 0 | 0 | 13 | 0 |
| `x:oauth1-consumer-secret` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0 | 15 | 0 |

### Group D (#753)

| row | pos | exact A | exact B | fullyCov A | fullyCov B | misses A | misses B | ctl | flagged A | flagged B | unsupp | conflict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `algolia:admin-api-key` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 33 | 0 | 0 | 20 | 0 |
| `contentful:delivery-api-access-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 63 | 1 | 1 | 12 | 0 |
| `dropbox:app-auth-token` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 37 | 0 | 0 | 21 | 1 |
| `elastic:cross-cluster-api-key` | 18 | 1 | 1 | 1 | 1 | 17 | 17 | 23 | 0 | 0 | 9 | 0 |
| `elastic:serverless-project-api-key` | 22 | 0 | 22 | 0 | 22 | 22 | 0 | 30 | 0 | 0 | 16 | 0 |
| `figma:plan-access-token` | 29 | 29 | 29 | 29 | 29 | 0 | 0 | 32 | 0 | 0 | 21 | 1 |
| `hubspot:static-auth-access-token` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 38 | 0 | 0 | 19 | 0 |
| `meta:app-access-token` | 21 | 0 | 0 | 21 | 21 | 0 | 0 | 26 | 12 | 12 | 13 | 3 |
| `meta:instagram-app-secret` | 21 | 21 | 21 | 21 | 21 | 0 | 0 | 31 | 11 | 9 | 15 | 0 |
| `x:oauth1-access-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 1 |
| `zoom:build-platform-api-key` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 33 | 1 | 1 | 21 | 0 |
| `zoom:webhook-secret-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 8 | 2 |
| `algolia:search-only-api-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 0 |
| `algolia:secured-api-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 | 0 |
| `algolia:write-api-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 |
| `algolia:analytics-api-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
| `algolia:monitoring-api-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
| `algolia:usage-api-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
| `contentful:preview-api-access-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 |
| `asana:service-account-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 |
| `figma:cli-plan-access-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
| `jfrog:pairing-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 |
| `canva:authorization-code` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 |

### Group E (#754)

| row | pos | exact A | exact B | fullyCov A | fullyCov B | misses A | misses B | ctl | flagged A | flagged B | unsupp | conflict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adobe:service-account-jwt-private-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 17 | 1 | 1 | 24 | 0 |
| `airtable:legacy-api-key` | 28 | 27 | 27 | 27 | 27 | 1 | 1 | 18 | 1 | 1 | 20 | 0 |
| `dropbox:legacy-long-lived-access-token` | 25 | 24 | 24 | 24 | 24 | 1 | 1 | 16 | 0 | 0 | 24 | 0 |
| `hubspot:legacy-api-key` | 32 | 0 | 0 | 0 | 0 | 32 | 32 | 19 | 0 | 0 | 24 | 0 |
| `jfrog:api-key` | 40 | 0 | 0 | 0 | 0 | 40 | 40 | 22 | 0 | 0 | 32 | 0 |
| `reddit:oauth-access-token` | 86 | 59 | 59 | 59 | 59 | 27 | 27 | 38 | 0 | 0 | 44 | 0 |
| `reddit:oauth-refresh-token` | 48 | 46 | 46 | 46 | 46 | 2 | 2 | 20 | 0 | 0 | 29 | 0 |
| `reddit:app-client-secret` | 26 | 0 | 0 | 0 | 0 | 26 | 26 | 15 | 0 | 0 | 14 | 0 |
| `zendesk:api-token` | 58 | 26 | 26 | 36 | 36 | 22 | 22 | 21 | 0 | 0 | 23 | 4 |

Rows with no positives hold no scored positive claim (14 D rows, `x:oauth1-consumer-secret` in C and `adobe:service-account-jwt-private-key` in E); a clean control there is only a clean control.

## Parity

Per case, one signature `[start, end, type, action]` per observation is compared across four surfaces and the modes whole (taken from the 7-byte and from the 1-byte run), 7-byte stream and 1-byte stream (16 observations per case; the harness also records the whole scan in each chunk run).

| identity | group | cases | identical on all 16 observations | divergent |
| --- | --- | ---: | ---: | ---: |
| A | C (#752) | 646 | 646 | 0 |
| A | D (#753) | 868 | 868 | 0 |
| A | E (#754) | 767 | 767 | 0 |
| B | C (#752) | 646 | 646 | 0 |
| B | D (#753) | 868 | 868 | 0 |
| B | E (#754) | 767 | 767 | 0 |

**No divergence exists**: whole == 7-byte == 1-byte and Node == WASM == Python == CLI for every one of the 2,281 cases on both identities, so there is no divergence to list. A stricter check including the detector name as well gives the same result (0 divergent cases per identity and group). Range units differ by surface (UTF-16 code units, code points, bytes); all offsets were converted to UTF-8 bytes by the harness.

## A against B

| group | scored cases that went bad to good | regressions (good on A, bad on B) | observed-only cases with changed findings |
| --- | ---: | ---: | ---: |
| C (#752) | 0 | 0 | 0 |
| D (#753) | 24 | 0 | 12 |
| E (#754) | 0 | 0 | 0 |

**Regressions: 0.** Every case that passed or was clean on A passes or is clean on B. All 24 improvements are in group D: 22 positives of `elastic:serverless-project-api-key` (the ApiKey authorization carriers, A misses all 22, B exact on all 22, consistent with the Batch 1 ApiKey fix, core #1212, which is not in beta.13) and 2 controls of `meta:instagram-app-secret` (`form-empty`, `fixture-instagram-secret-empty-value`, the empty-form-value fix #1232). Groups C and E are byte-for-byte unchanged between A and B.

### Which of the five closeout fixes changed anything here

Between A and B the product moved from beta.13 to main plus five fixes, so the A-to-B delta cannot by itself attribute anything to the five fixes (placeholders, Atlas slots, Atlas public half, MongoDB URI userinfo, X Bearer percent escapes, HubSpot prefixed names). The supplementary intermediate identity (`efe71496`, before the five) separates them:

| group | cases whose findings differ, intermediate to candidate | scored status changed | published to intermediate: bad to good / good to bad |
| --- | ---: | ---: | --- |
| C (#752) | 0 | 0 | 0 / 0 |
| D (#753) | 2 | 0 | 24 / 0 |
| E (#754) | 0 | 0 | 0 / 0 |

The five fixes changed exactly **2 observed-only cases and no scored case** in these corpora: the percent-containing Bearer value of `dropbox:app-auth-token` (`percent-value:unsupported`, finding [73,93] to [73,111]) and of `hubspot:static-auth-access-token` now cover the whole percent-escaped value instead of the prefix before the first escape. The placeholders fix and the Atlas and HubSpot prefixed-name fixes moved no C, D or E case: every placeholder control that is flagged on B was flagged on the intermediate commit too. Everything else the candidate gained over beta.13 (the 24 above) is already in the intermediate commit.

## Gap list (candidate B)

340 scored cases are missed, under-covered, over-wide or flagged on B (positives not exact-and-fully-covered plus flagged controls): 116 in C, 61 in D, 163 in E; every one of them also fails on A (no gap case improved between A and B, and none regressed). They fall into 14 groups by shared root cause; none is ungrouped (0). Triage labels: PRODUCT GAP (the evidence Case supports the expectation and the product disagrees), POLICY QUESTION (a maintainer decision is needed), CORPUS ERRATUM CANDIDATE (the case itself looks wrong against its Case; proposal only, nothing was changed), UNSCORED OBSERVATION (observed-only, below). Case IDs below drop the shared `<family>:<group>:` prefix; the full records (expected span, observed findings with type/action/span/detector, evidence Case, claims and clause) are in `gaps.json`.

### G-jfrog: `X-JFrog-Art-Api` header and `curl -u user:<secret>` password not read (JFrog reference token / API key)

**Triage: PRODUCT GAP.** The `X-JFrog-Art-Api` header (any case) and the Basic password of `curl -u user:<secret>` are not read. Shared byte-identical fixtures count in both C and E.

- Cases: 73 (C jfrog:reference-token 33; E jfrog:api-key 40).
- Expectation: the secret span only (4 cases carry a second occurrence). Observed on B: no finding x71, contextual_secret/redact x2. Spans for each case are in `gaps.json`.
- Evidence Cases: `jfrog-reference-token-header-and-basic-password-value`, `jfrog-api-key-header-and-basic-password-value`.
- Case IDs:
  - C jfrog:reference-token: `fixture-replay-reference-token-raw-http-art-api-header:positive`, `fixture-replay-reference-token-curl-art-api-header:positive`, `fixture-replay-reference-token-curl-basic-password:positive`, `header-x-jfrog-art-api-raw-http:positive`, `header-x-jfrog-art-api-raw-http-lf:positive`, `header-x-jfrog-art-api-eof:positive`, `header-x-jfrog-art-api-curl-double:positive`, `header-x-jfrog-art-api-curl-single:positive`, `header-x-jfrog-art-api-curl-header-long:positive`, `header-x-jfrog-art-api-utf8-before-after:positive`, `header-x-jfrog-art-api-big-preceding:positive`, `header-x-jfrog-art-api-neighbouring-secret:positive`, `header-x-jfrog-art-api-repeat:positive`, `header-x-jfrog-art-api-trailing-whitespace:positive`, `header-x-jfrog-art-api-same-shape-neighbour:positive`, `header-x-jfrog-art-api-value-hyphenated:positive`, `header-x-jfrog-art-api-value-dotted-underscore:positive`, `header-x-jfrog-art-api-value-long-150:positive`, `header-x-jfrog-art-api-value-short-16:positive`, `curl-u-password-plain:positive`, `curl-u-password-eof:positive`, `curl-u-password-double-quoted:positive`, `curl-u-password-single-quoted:positive`, `curl-u-password-flag-after:positive`, `curl-u-password-utf8-before-after:positive`, `curl-u-password-crlf:positive`, `curl-u-password-big-preceding:positive`, `curl-u-password-repeat:positive`, `curl-u-password-user-with-digits-and-dots:positive`, `curl-u-password-value-hyphenated:positive`, `curl-u-password-value-dotted-underscore:positive`, `curl-u-password-value-long-150:positive`, `curl-u-password-value-short-16:positive`
  - E jfrog:api-key: `fx-api-key-raw-http-art-api-header:positive`, `fx-api-key-curl-art-api-header:positive`, `fx-api-key-curl-basic-password:positive`, `header-raw-http-crlf:positive`, `header-raw-http-lf:positive`, `header-eof:positive`, `header-curl-double:positive`, `header-curl-single:positive`, `header-curl-long-option:positive`, `header-trailing-whitespace:positive`, `header-utf8-before-after:positive`, `header-big-preceding:positive`, `header-repeat:positive`, `header-neighbouring-secret:positive`, `header-same-shape-neighbour:positive`, `header-after-other-headers:positive`, `header-era-words:positive`, `header-era-words-after:positive`, `header-shape-hex32:positive`, `header-shape-alnum64:positive`, `header-shape-urlsafe40:positive`, `header-shape-digits24:positive`, `header-shape-lower16:positive`, `basic-curl-u-unquoted:positive`, `basic-curl-u-eof:positive`, `basic-curl-u-double:positive`, `basic-curl-u-single:positive`, `basic-curl-u-after-url:positive`, `basic-curl-u-continuation:positive`, `basic-curl-u-crlf:positive`, `basic-curl-u-utf8:positive`, `basic-curl-u-big-preceding:positive`, `basic-curl-u-same-shape-user:positive`, `basic-curl-u-repeat:positive`, `basic-curl-u-era-words:positive`, `basic-shape-hex32:positive`, `basic-shape-alnum64:positive`, `basic-shape-urlsafe40:positive`, `basic-shape-digits24:positive`, `basic-shape-lower16:positive`

### G-zendesk-cred: Zendesk `email/token:<token>` credential string: not read in `curl -u`, over-spanned (email included, warn) in JSON/env

**Triage: PRODUCT GAP.** The `email/token:<token>` composite is not read at all in the `curl -u` carrier (20 silent) and, in JSON and `.env` assignment, is reported as one `warn` finding over the whole string including the email (10 over-wide with no leak, but `warn` and not `redact`, and the public email is inside the span); 2 more cases combine a `curl -u` miss with an over-wide or neighbour-only finding. One of the 4 `conflict` Zendesk cases (masked display) is also flagged `warn`.

- Cases: 32 (E zendesk:api-token 32).
- Expectation: the secret span only (1 case carries a second occurrence). Observed on B: no finding x20, contextual_secret/warn x11, contextual_secret/redact x1. Spans for each case are in `gaps.json`.
- Evidence Case: `zendesk-api-token-basic-credential-token-part`.
- Case IDs:
  - E zendesk:api-token: `fx-api-token-curl-basic-credential:positive`, `fx-api-token-json-credentials-string:positive`, `fx-api-token-env-assignment:positive`, `credential-curl-u-double:positive`, `credential-curl-u-single:positive`, `credential-curl-u-unquoted:positive`, `credential-curl-u-eof:positive`, `credential-curl-user-long:positive`, `credential-curl-u-before-url:positive`, `credential-json-string:positive`, `credential-json-string-comma:positive`, `credential-json-last-eof:positive`, `credential-env-assignment:positive`, `credential-env-assignment-quoted:positive`, `credential-env-export-crlf:positive`, `credential-trailing-whitespace:positive`, `credential-plus-address-email:positive`, `credential-subdomain-email:positive`, `credential-uppercase-email:positive`, `credential-token-with-hyphen-underscore:positive`, `credential-utf8-before-after:positive`, `credential-big-preceding:positive`, `credential-same-shape-neighbour:positive`, `credential-repeat:positive`, `credential-neighbouring-secret:positive`, `credential-era-words:positive`, `credential-era-words-env:positive`, `credential-shape-hex32:positive`, `credential-shape-alnum64:positive`, `credential-shape-urlsafe40:positive`, `credential-shape-digits24:positive`, `credential-shape-lower16:positive`

### G-reddit-secret: Reddit client secret in `-u/--user id:secret` Basic password not read

**Triage: PRODUCT GAP.** Basic password in `-u` / `--user id:secret` is not read (same carrier as JFrog `curl -u`).

- Cases: 26 (E reddit:app-client-secret 26).
- Expectation: the secret span only (1 case carries a second occurrence). Observed on B: no finding x25, contextual_secret/redact x1. Spans for each case are in `gaps.json`.
- Evidence Case: `reddit-app-client-secret-basic-password`.
- Case IDs:
  - E reddit:app-client-secret: `fx-secret-curl-user-code-flow:positive`, `fx-secret-curl-u-application-only:positive`, `fx-secret-curl-user-revocation:positive`, `basic-user-single:positive`, `basic-user-double:positive`, `basic-user-unquoted:positive`, `basic-u-unquoted-space:positive`, `basic-u-single:positive`, `basic-u-eof:positive`, `basic-u-before-data:positive`, `basic-user-revocation:positive`, `basic-user-refresh:positive`, `basic-user-continuation:positive`, `basic-user-crlf:positive`, `basic-user-utf8:positive`, `basic-user-big-preceding:positive`, `basic-user-same-shape-id:positive`, `basic-user-same-shape-data:positive`, `basic-user-repeat:positive`, `basic-user-neighbouring-secret:positive`, `basic-user-era-words:positive`, `basic-shape-hex32:positive`, `basic-shape-alnum64:positive`, `basic-shape-urlsafe40:positive`, `basic-shape-digits24:positive`, `basic-shape-lower16:positive`

### G-hapikey: HubSpot legacy `hapikey=` query parameter not read

**Triage: PRODUCT GAP.** The `hapikey` query-parameter name is unknown to the product (only the secret value is expected; no finding touches the public `appId` neighbour in these cases).

- Cases: 32 (E hubspot:legacy-api-key 32).
- Expectation: the secret span only (1 case carries a second occurrence). Observed on B: no finding x31, contextual_secret/redact x1. Spans for each case are in `gaps.json`.
- Evidence Case: `hubspot-legacy-api-key-hapikey-query-parameter-value`.
- Case IDs:
  - E hubspot:legacy-api-key: `fx-raw-http-hapikey-query:positive`, `fx-curl-hapikey-query:positive`, `fx-curl-developer-key-with-app-id:positive`, `query-raw-http-middle:positive`, `query-raw-http-first:positive`, `query-raw-http-last-space:positive`, `query-curl-double:positive`, `query-curl-double-amp:positive`, `query-curl-single:positive`, `query-curl-unquoted:positive`, `query-json-config-url:positive`, `query-json-config-url-last:positive`, `query-eof:positive`, `query-trailing-whitespace:positive`, `query-percent-neighbours:positive`, `query-same-shape-neighbour:positive`, `query-utf8-before-after:positive`, `query-big-preceding:positive`, `query-repeat:positive`, `query-neighbouring-secret:positive`, `query-era-words:positive`, `query-era-words-after:positive`, `query-shape-hex32:positive`, `query-shape-alnum64:positive`, `query-shape-urlsafe40:positive`, `query-shape-digits24:positive`, `query-shape-lower16:positive`, `query-no-http-version:positive`, `developer-key-curl-appid-after:positive`, `developer-key-curl-appid-before:positive`, `developer-key-raw-http:positive`, `developer-key-same-shape-appid:positive`

### G-token-member: bare `token` / `tokenKey` JSON member value not read (Contentful CMA PAT, HubSpot private-app token)

**Triage: PRODUCT GAP.** Bare `token` (Contentful create-response) and `tokenKey` (HubSpot) JSON member names are not credential names to the product; the same value under `password` in the same object is redacted (the `neighbouring-secret` cases show it). Needs a scoped rule (a bare `token` name is a false-positive risk the maintainers should weigh), but the evidence says must-flag.

- Cases: 32 (C contentful:cma-personal-access-token 15; C hubspot:private-app-access-token 17).
- Expectation: the secret span only (2 cases carry a second occurrence). Observed on B: no finding x30, contextual_secret/redact x2. Spans for each case are in `gaps.json`.
- Evidence Cases: `contentful-cma-personal-access-token-bearer-header-and-create-response-member`, `hubspot-private-app-access-token-bearer-header-and-token-key-member`.
- Case IDs:
  - C contentful:cma-personal-access-token: `fixture-replay-cma-pat-create-response-token-member:positive`, `token-member-pretty-json-response:positive`, `token-member-json-compact:positive`, `token-member-json-last:positive`, `token-member-json-crlf-tabs:positive`, `token-member-json-spaced-colon:positive`, `token-member-json-same-shape-neighbour:positive`, `token-member-json-utf8-before-after:positive`, `token-member-json-big-preceding:positive`, `token-member-repeat:positive`, `token-member-neighbouring-secret:positive`, `token-member-value-hyphenated:positive`, `token-member-value-dotted-underscore:positive`, `token-member-value-long-150:positive`, `token-member-value-short-16:positive`
  - C hubspot:private-app-access-token: `fixture-replay-private-app-token-key-raw-http-json-body:positive`, `fixture-replay-private-app-token-key-curl-data-json:positive`, `tokenKey-member-raw-http-json-body:positive`, `tokenKey-member-curl-data-single-quoted:positive`, `tokenKey-member-json-compact:positive`, `tokenKey-member-json-last:positive`, `tokenKey-member-json-crlf-tabs:positive`, `tokenKey-member-json-spaced-colon:positive`, `tokenKey-member-json-same-shape-neighbour:positive`, `tokenKey-member-json-utf8-before-after:positive`, `tokenKey-member-json-big-preceding:positive`, `tokenKey-member-repeat:positive`, `tokenKey-member-neighbouring-secret:positive`, `tokenKey-member-value-hyphenated:positive`, `tokenKey-member-value-dotted-underscore:positive`, `tokenKey-member-value-long-150:positive`, `tokenKey-member-value-short-16:positive`

### G-reddit-token: Reddit revoke-form `token=` parameter not read

**Triage: PRODUCT GAP.** The revoke form field `token=` is not a credential name (same root cause as bare `token` in G-token-member).

- Cases: 24 (E reddit:oauth-access-token 24).
- Expectation: the secret span only (1 case carries a second occurrence). Observed on B: no finding x23, contextual_secret/redact x1. Spans for each case are in `gaps.json`.
- Evidence Case: `reddit-oauth-revoke-token-request-body-token-field`.
- Case IDs:
  - E reddit:oauth-access-token: `fx-revoke-raw-http-form-request-no-hint:positive`, `fx-revoke-curl-data-token-with-refresh-hint:positive`, `form-body-middle:positive`, `form-body-first-eof:positive`, `form-body-last-eol:positive`, `form-body-last-eof:positive`, `form-body-crlf:positive`, `form-curl-d-unquoted:positive`, `form-curl-d-unquoted-eof:positive`, `form-curl-d-double:positive`, `form-curl-d-double-last:positive`, `form-curl-data-single:positive`, `form-curl-data-urlencode:positive`, `form-percent-neighbours:positive`, `form-same-shape-neighbour:positive`, `form-utf8-before-after:positive`, `form-big-preceding:positive`, `form-repeat:positive`, `form-neighbouring-secret:positive`, `form-era-words:positive`, `form-shape-hex32:positive`, `form-shape-alnum64:positive`, `form-shape-urlsafe40:positive`, `form-shape-lower16:positive`

### G-digits24: credential-named member/parameter whose value is 24 digits is silent (evidence: flagged by position, not shape)

**Triage: PRODUCT GAP.** Position-named values of 24 digits are silent in 7 cases (airtable query, dropbox member, Reddit access and refresh member, form and fragment), 4 rows, while hex32, alnum64, urlsafe40 and lower16 in the same slots are flagged. The Cases say the value is flagged by position, whatever its shape. Likely a numeric floor; maintainers should say whether it is intended (security-first default: flag).

- Cases: 7 (E airtable:legacy-api-key 1; E dropbox:legacy-long-lived-access-token 1; E reddit:oauth-refresh-token 2; E reddit:oauth-access-token 3).
- Expectation: the secret span only. Observed on B: no finding x7. Spans for each case are in `gaps.json`.
- Evidence Cases: `airtable-legacy-api-key-url-parameter-value`, `dropbox-legacy-long-lived-access-token-response-member`, `reddit-oauth-refresh-token-response-member-and-request-field`, `reddit-oauth-revoke-token-request-body-token-field`, `reddit-oauth-access-token-response-member`, `reddit-oauth-access-token-bearer-header-and-redirect-fragment`.
- Case IDs:
  - E airtable:legacy-api-key: `query-shape-digits24:positive`
  - E dropbox:legacy-long-lived-access-token: `member-shape-digits24:positive`
  - E reddit:oauth-refresh-token: `form-shape-digits24:positive`, `member-shape-digits24:positive`
  - E reddit:oauth-access-token: `form-shape-digits24:positive`, `member-shape-digits24:positive`, `fragment-shape-digits24:positive`

### G-elastic-encoded: Elastic cross-cluster `encoded` member (base64 `id:key`) not reported; only `api_key` is

**Triage: PRODUCT GAP.** The `api_key` member is exact but the `encoded` member (base64 of `id:api_key`) is not reported; 1 case with only the `encoded` member is wholly silent. The base64 form is itself the credential, so this is a leak of a complete credential.

- Cases: 17 (D elastic:cross-cluster-api-key 17).
- Expectation: the secret span only (16 cases carry a second occurrence). Observed on B: contextual_secret/redact x16, no finding x1. Spans for each case are in `gaps.json`.
- Evidence Case: `elastic-cross-cluster-api-key-create-response-members`.
- Clauses: "span = the fixture secret span only (Case extent)"; "spans = api_key member value and encoded member value (both); id member outside the spans and unasserted".
- Case IDs:
  - D elastic:cross-cluster-api-key: `fixture-cross-cluster-response-curl-output:positive`, `fixture-cross-cluster-response-pretty-json:positive`, `fixture-cross-cluster-response-raw-http-compact-json:positive`, `pretty-json:positive`, `compact-json-raw-http:positive`, `curl-output:positive`, `eof:positive`, `crlf-tabs:positive`, `spaced-colons:positive`, `encoded-first:positive`, `expiration-member:positive`, `nested-array:positive`, `utf8-before-after:positive`, `big-preceding:positive`, `same-shape-id:positive`, `encoded-member-only:positive`, `encoded-padding-variants:positive`

### G-brace: brace template placeholder `{NAME}` reported (span stops before the closing brace)

**Triage: PRODUCT GAP.** Treat a brace template `{NAME}` (and the `{your-app_id}|{your-app_secret}` pair) as a placeholder in a value slot; also stop the span before the closing brace being the whole story (the reported span is `{NAME` without `}`). Recommended as the next fix; it is the largest control group (39 of the 61 flagged controls; with G-angle and G-docmask 46 across 10 rows).

- Cases: 39 (C adobe:oauth-server-to-server-client-secret 3; C adobe:enterprise-web-app-client-secret 3; C meta:app-secret 10; D meta:app-access-token 12; D meta:instagram-app-secret 9; D contentful:delivery-api-access-token 1; E airtable:legacy-api-key 1).
- Expectation: no finding (whole input must not flag). Observed on B: contextual_secret/warn x26, contextual_secret/redact x12, contextual_secret/warn+contextual_secret/redact x1. Spans for each case are in `gaps.json`.
- Evidence Cases: `adobe-client-secret-placeholders-references-and-public-identifiers`, `meta-app-secret-pipe-placeholders-derived-proof-and-non-values`, `meta-instagram-app-secret-placeholders-and-references-non-values`, `contentful-api-token-placeholders-and-token-free-preview-url-non-values`, `airtable-legacy-api-key-placeholders-references-and-non-values`.
- Clauses: "whole-input must-not-flag (Case outcome)"; "whole-input must-not-flag (Case: placeholder, reference, mask, empty field or prose carries no value; no App ID literal appears)"; "whole-input must-not-flag (Case: template, reference, mask or placeholder carries no secret; no app-ID literal appears)".
- Case IDs:
  - C adobe:oauth-server-to-server-client-secret: `client_secret-form-benign-0-body:control`, `client_secret-form-benign-0-query-eof:control`, `client_secret-form-benign-0-curl-utf8:control`
  - C adobe:enterprise-web-app-client-secret: `client_secret-form-benign-0-body:control`, `client_secret-form-benign-0-query-eof:control`, `client_secret-form-benign-0-curl-utf8:control`
  - C meta:app-secret: `fixture-replay-app-pair-lookalike-documented-template:control`, `client_secret-form-benign-2-body:control`, `client_secret-form-benign-2-query-eof:control`, `client_secret-form-benign-2-curl-utf8:control`, `access-token-pipe-benign-0-request-line:control`, `access-token-pipe-benign-0-curl-utf8:control`, `access-token-pipe-benign-2-request-line:control`, `access-token-pipe-benign-2-curl-utf8:control`, `access-token-pipe-benign-3-request-line:control`, `access-token-pipe-benign-3-curl-utf8:control`
  - D meta:app-access-token: `fixture-app-pair-lookalike-documented-template:control`, `query-doc-template:control`, `curl-doc-template:control`, `query-angle-secret-only:control`, `curl-angle-secret-only:control`, `query-mask:control`, `curl-mask:control`, `query-bullets:control`, `curl-bullets:control`, `query-empty-secret:control`, `curl-empty-secret:control`, `user-token-template:control`
  - D meta:instagram-app-secret: `fixture-instagram-secret-environment-reference:control`, `query-angle:control`, `query-env-reference:control`, `query-env-dollar:control`, `query-template:control`, `query-mask:control`, `query-bullets:control`, `query-short-doc-placeholder:control`, `query-empty:control`
  - D contentful:delivery-api-access-token: `preview-url-no-token-query:control`
  - E airtable:legacy-api-key: `query-brace-placeholder:control`

### G-angle: angle placeholder `<...>` reported

**Triage: PRODUCT GAP.** Same family as G-brace: an angle placeholder with spaces (`<contents of private.key>`) under a `private_key:` slot.

- Cases: 1 (E adobe:service-account-jwt-private-key 1).
- Expectation: no finding (whole input must not flag). Observed on B: contextual_secret/warn x1. Spans for each case are in `gaps.json`.
- Evidence Case: `adobe-jwt-service-account-identifiers-and-private-key-references`.
- Case IDs:
  - E adobe:service-account-jwt-private-key: `key-angle-placeholder:control`

### G-docmask: documented mask/ellipsis/xxx/upper-case-name placeholder reported as a value

**Triage: PRODUCT GAP.** Provider-published `CFPAT-123...789` / `CFPAT-xxx` masks and the upper-case reference name `ZOOM_API_KEY` as a value are not placeholders for the product.

- Cases: 6 (C contentful:cma-personal-access-token 5; D zoom:build-platform-api-key 1).
- Expectation: no finding (whole input must not flag). Observed on B: contextual_secret/warn x6. Spans for each case are in `gaps.json`.
- Evidence Cases: `contentful-cma-personal-access-token-documented-placeholders-and-masks`, `zoom-build-api-key-placeholders-and-non-values`.
- Clause: "whole-input must-not-flag (Case: placeholder, reference, mask, empty value or prose carries no value)".
- Case IDs:
  - C contentful:cma-personal-access-token: `fixture-replay-cma-pat-lookalike-contributing-env-placeholder:control`, `cfpat-placeholder-env-0:control`, `cfpat-placeholder-env-0-utf8:control`, `cfpat-placeholder-env-1:control`, `cfpat-placeholder-env-1-utf8:control`
  - D zoom:build-platform-api-key: `json-documented-0:control`

### G-meta-pipe-span: Meta `APP_ID|SECRET`: finding covers the whole pipe pair, expectation is the secret half only (over-span, fully covered)

**Triage: POLICY QUESTION.** Needs a ruling. The Case says the span is the part after the pipe and the app ID is outside it; the product redacts the whole `APP_ID|SECRET` string. No byte leaks (fullyCovered is true for all 36); only the public app ID is over-redacted. Recommend accepting whole-pair redaction (security-first; the D row is itself named `app-access-token`, which is the whole pair) and re-scoring these on `fullyCovered`, or else ask for a span split as a product change.

- Cases: 36 (C meta:app-secret 15; D meta:app-access-token 21).
- Expectation: the secret span only (2 cases carry a second occurrence). Observed on B: contextual_secret/redact x36. Spans for each case are in `gaps.json`.
- Evidence Case: `meta-app-secret-in-app-id-pipe-access-token`.
- Clauses: "span = the fixture secret span only (Case extent)"; "span = the part after the pipe of an app-id|secret access_token value; the app ID before it is outside the span".
- Case IDs:
  - C meta:app-secret: `fixture-replay-app-pair-raw-http:positive`, `fixture-replay-app-pair-curl-url:positive`, `fixture-replay-app-pair-url-query-continues:positive`, `access-token-pipe-request-line:positive`, `access-token-pipe-curl-url:positive`, `access-token-pipe-query-continues:positive`, `access-token-pipe-query-eof:positive`, `access-token-pipe-utf8-before-after:positive`, `access-token-pipe-big-preceding:positive`, `access-token-pipe-repeat:positive`, `access-token-pipe-same-shape-app-id:positive`, `access-token-pipe-value-hyphenated:positive`, `access-token-pipe-value-dotted-underscore:positive`, `access-token-pipe-value-long-150:positive`, `access-token-pipe-value-short-16:positive`
  - D meta:app-access-token: `fixture-app-pair-curl-url:positive`, `fixture-app-pair-raw-http:positive`, `fixture-app-pair-url-query-continues:positive`, `raw-get-line:positive`, `curl-url-quoted:positive`, `query-continues:positive`, `eof:positive`, `query-first-param:positive`, `curl-single-quoted:positive`, `crlf-end:positive`, `app-id-15-digits:positive`, `app-id-17-digits:positive`, `utf8-before-after:positive`, `big-preceding:positive`, `same-shape-neighbour:positive`, `neighbouring-secret:positive`, `repeat:positive`, `shape-hex32:positive`, `shape-short:positive`, `shape-marker:positive`, `shape-long:positive`

### G-xapikey-clientid: `x-api-key` header whose value the evidence names a public client ID (control flagged)

**Triage: POLICY QUESTION.** Needs a ruling. A generic scanner cannot know the `x-api-key` header carries Adobe's public client ID. Recommend: keep flagging (security-first) and move the evidence expectation to observed-only, or keep it scored as a recorded accepted false positive.

- Cases: 6 (C adobe:oauth-server-to-server-client-secret 2; C adobe:enterprise-web-app-client-secret 2; C adobe:oauth-web-app-client-secret 2).
- Expectation: no finding (whole input must not flag). Observed on B: contextual_secret/redact x6. Spans for each case are in `gaps.json`.
- Evidence Case: `adobe-client-secret-placeholders-references-and-public-identifiers`.
- Case IDs:
  - C adobe:oauth-server-to-server-client-secret: `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`
  - C adobe:enterprise-web-app-client-secret: `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`
  - C adobe:oauth-web-app-client-secret: `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`

### G-authcode: control carries an OAuth `code=` value; the product reads it as a credential (warn)

**Triage: CORPUS ERRATUM CANDIDATE.** Propose an erratum: the control input contains an OAuth `code=<value>` (a one-time credential, flagged `warn` by the generic rule) next to a public client ID, and its must-not-flag extent covers the whole input. Either drop the `code` parameter from the generated and replayed variants or downgrade them to unsupported; if maintainers want `code` values unflagged, that is a separate policy for the authorization-code family.

- Cases: 9 (C adobe:oauth-server-to-server-client-secret 3; C adobe:enterprise-web-app-client-secret 3; C adobe:oauth-web-app-client-secret 3).
- Expectation: no finding (whole input must not flag). Observed on B: contextual_secret/warn x9. Spans for each case are in `gaps.json`.
- Evidence Case: `adobe-client-secret-placeholders-references-and-public-identifiers`.
- Case IDs:
  - C adobe:oauth-server-to-server-client-secret: `fixture-replay-public-client-request-client-id-only:control`, `public-only-0:control`, `public-only-0-utf8:control`
  - C adobe:enterprise-web-app-client-secret: `fixture-replay-public-client-request-client-id-only:control`, `public-only-0:control`, `public-only-0-utf8:control`
  - C adobe:oauth-web-app-client-secret: `fixture-replay-public-client-request-client-id-only:control`, `public-only-0:control`, `public-only-0-utf8:control`

### Cross-cutting root causes

- **`curl -u` / `--user` Basic password slot not read** spans three families: JFrog (33 `curl -u` positives in C and E), all 26 Reddit client-secret positives, and the Zendesk `curl -u "email/token:<token>"` positives (20 silent). Reading that slot would address about 80 of the positives, subject to the policy for a literal user part.
- **Bare `token` / `tokenKey` names** (Contentful create response, HubSpot private-app `tokenKey`, Reddit revoke `token=`): 56 positives across three families (G-token-member 32 and G-reddit-token 24).
- **Brace/angle/mask/upper-case placeholders**: 46 controls flagged across 10 rows in C, D and E (G-brace, G-angle, G-docmask). The recent placeholder fix did not reach these slots.
- **Byte-identical shared cases** are counted once per corpus they live in (the JFrog fixtures and the Meta pipe cases appear in both C and D or C and E); totals above are per corpus and are not de-duplicated across corpora.

## Corpus erratum candidates (proposals only; no corpus case was changed)

1. **G-authcode (9 controls, C)**: `adobe:*:gc:fixture-replay-public-client-request-client-id-only:control`, `adobe:*:gc:public-only-0:control` and `public-only-0-utf8:control` (each for the three Adobe rows) put `code=<value>` in a must-not-flag input. The Case names only public identifiers and non-values; a one-time authorization code is neither, and it is flagged `warn` by the generic contextual rule, not by an Adobe detector. Proposal: remove `code=` from the generated variants and downgrade the replayed fixture to `unsupported`, or record a ruling that OAuth `code` values are intentionally not flagged.
2. **G-xapikey-clientid (6 controls, C)**: same Case, but the issue is not the input: the Case labels the `x-api-key` value a public identifier. This is a policy question rather than an erratum, listed here only because the alternative resolution is to downgrade the six controls to `unsupported`.
3. **D `meta:instagram-app-secret` `query-*` controls**: their `access_token={short-lived-access-token}` neighbour is a second placeholder slot whose handling belongs to the access-token rows; the controls are still fair (a placeholder is not a value), but a flagged neighbour parameter hides whether the secret slot itself is clean. No change proposed; noted so the maintainer does not read these 9 flags as an Instagram-secret-slot defect.

No scored positive looks wrong against its Case: every expected span lies on the value the Case names, and the misses are carriers the product does not read.

## Observed-only cases (unsupported and conflict; never scored)

| group | kind | cases | flagged on B | silent on B |
| --- | --- | ---: | ---: | ---: |
| C (#752) | unsupported | 118 | 55 | 63 |
| D (#753) | unsupported | 290 | 223 | 67 |
| D (#753) | conflict | 8 | 3 | 5 |
| E (#754) | unsupported | 234 | 102 | 132 |
| E (#754) | conflict | 4 | 1 | 3 |

Items of interest:

- **UNSCORED OBSERVATION, silent carriers**: `jfrog:reference-token` 0 of 9 observed-only cases flagged (C), `hubspot:legacy-api-key` 1 of 24 (E), `jfrog:api-key` 5 of 32 (E). These rows are silent on their documented carriers for the same reasons as the scored misses above (JFrog header and `-u`, `hapikey`), so no scored claim hides a flagged variant.
- **UNSCORED OBSERVATION, the product reads most observed-only carriers**: `meta:app-access-token` 13 of 13 unsupported cases flagged, `contentful:delivery-api-access-token` and `contentful:preview-api-access-token` 11 of 12 each, `x:oauth1-access-token` 10 of 11, `asana:service-account-token` 9 of 10 (counts from `scores.json`, `observedOnly`). A flagged observed-only carrier is neither a pass nor a false positive until a ruling exists; a leak is only recordable where the carrier is silent (previous bullet).
- **UNSCORED OBSERVATION, conflict cases**: of the 12 conflict cases (8 D, 4 E), B flags 4: `meta:app-access-token` appsecret_proof-derived lookalike (redact, 27-45), `x:oauth1-access-token` authorization header with identity and signature (redact, 254-291), `zoom:webhook-secret-token` validation response (two redact findings), `zendesk:api-token` masked display (`warn`, 26-59). The other 8 are silent.
- Ten observed-only Elastic ApiKey variants (upper-case name, no space after the colon, below-floor value, low entropy, percent value, single-quoted JSON, YAML header, `Proxy-Authorization`, lower-case scheme, and one cross-cluster `Authorization: ApiKey`) were silent on A and are flagged `authorization_credential`/`redact` on B; none is scored.
- Group D: the 14 rows with no positives (the Algolia non-admin keys, Contentful delivery and preview, Asana service account, Figma CLI, JFrog pairing, Canva, `x:oauth1-access-token`, `zoom:webhook-secret-token`) are observed only; case-level findings are in `scores.json` (`observedOnly`).

## Honest limits

- **Project-authored, maintainer-only evidence, not independent validation.** Every expectation derives from the maintainers' own credential-evidence repository (PR #263, tag `snapshot-2026.10.06.5`, commit `574b52ba367e2071d5a9bea3e2da7a9c5057f633`). Agreement with it shows consistency with the maintainers' stated contract and nothing more; disagreement may equally be an evidence or corpus problem, which is why the triage separates product gaps from policy questions and erratum candidates.
- **One host** (darwin-arm64, Node v22.16.0). Not a linux-x64 official run; the addon and wasm bytes are host-bound and were not compared with core's published candidate digests (no candidate package was published).
- **Peers not run.** No TruffleHog or other scanner result appears here.
- **The candidate is not published.** e1284537 is a branch commit declaring 0.1.0-beta.14; the A-to-B delta therefore mixes everything since beta.13 with the five fixes (separated above by the intermediate run, which is a single 7-byte-chunk run).
- Baseline CLI is the published crate `redact-secret-cli` 0.1.0-beta.13 built locally with `cargo install --locked` (no prebuilt release binary was used). Python on both identities is the cp310-abi3 wheel build on Python 3.14.7; candidate Python is an editable `maturin develop` build.
- Scorer limits (policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run, any-shape; see `benchmarks/FREEZE-groups-cde.md`) apply unchanged: an over-wide finding is `fullyCovered` but never `exact`; a finding on an unasserted neighbour is not scored.
- Offsets were converted by the harness to UTF-8 bytes; the numbers depend on that conversion being right on non-ASCII cases, which is exercised by the `utf8-before-after` axes and shows no surface divergence.

## Reproduce

```bash
# corpora (frozen digests are checked first by scripts/report-groups-cde.mjs and by each corpus test)
node scripts/measure-batch1.mjs --corpus ../benchmarks/group-c/corpus-group-c.mjs --chunk 7 --label candidate --out obs.json \
  --node-root <install of the three tarballs> --wasm-dir <root>/node_modules/@redact-secret/wasm --python <venv>/bin/python \
  --cli <target/release/redact-secret> --source-commit e1284537a5df5a6cfd051fc7211d276a45ee98bf
# repeat for group-d/corpus-group-d.mjs and group-e/corpus-e.mjs, --chunk 7 and --chunk 1, and for the published identity
node scripts/report-groups-cde.mjs --obs-dir evidence/groups-cde/round1 --out evidence/groups-cde/round1
node scripts/triage-groups-cde.mjs --scores evidence/groups-cde/round1/scores.json --out evidence/groups-cde/round1/gaps.json
node scripts/attribute-groups-cde.mjs --obs-dir evidence/groups-cde/round1 --out evidence/groups-cde/round1/attribution-intermediate.json
node scripts/render-groups-cde-report.mjs --dir evidence/groups-cde/round1
```

Files: `observations-<published|candidate>-<c|d|e>-c<7|1>.json.gz` and `observations-intermediate-<c|d|e>-c7.json.gz` (per-case findings, no matched text), `scores.json`, `gaps.json`, `attribution-intermediate.json`, `identity.json`, `report.json`, this file.
