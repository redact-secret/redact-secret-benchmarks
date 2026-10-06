# Groups C, D and E, round 2: replay of the candidate with the nine round-1 gap fixes

Same role and rules as round 1: no corpus case, FROZEN manifest, evidence extract or scorer was edited, no product code changed, peers not run. **New candidate** redact-secret `e1cc1f31e58f9c1e9ef6a58fd057c1106976711b` (branch `workbench/closeout-batch2-groupcde`, declared 0.1.0-beta.14, not published; `e1284537` plus nine detector fixes for the round-1 product-gap groups). **Previous candidate (B1)** `e1284537`, round-1 observations reused unchanged. **Baseline (A)** published beta.13, round-1 observations reused. Round-1 `evidence/groups-cde/round1/` is untouched.

## Corpora and what was reused

| group | cases | sha256 (verified by the generator before scanning; the scoring script aborts on a mismatch) |
| --- | ---: | --- |
| C (#752, errata-1) | 646 | `16036d043fc0dad0e45ec42e2513d2ffec2020da3458a95ed57f09f44fb0e02d` |
| D (#753) | 868 | `aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e` |
| E (#754) | 767 | `6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa` |

Group C is the signed-off **errata-1** version (commit `fd7bc762` on `workbench/group-c-errata-1`, cherry-picked onto this measure branch; it touches only the C generator, its index, TRACEABILITY, the proposed manifest and the C test; D and E files are untouched). `FROZEN-group-c.json` (the original freeze) still carries the old digest; the errata digest is the one in `FROZEN-group-c-errata-1.json.proposed`. The three digests were recomputed with each corpus's exported `corpusDigest()` before any scan and match the values above; `tests/group-{c,d,e}-corpus.test.mjs` pass 45 of 45. Errata-1 changed the kind of 9 cases (control->unsupported; the 9 Adobe `code=` controls) and their ids (suffix `:control` to `:unsupported`); every case text is byte-identical to the freeze (checked by regenerating the freeze corpus from `a7350c51`, all 646 texts compared).

**Reused**: because the texts are unchanged, the round-1 A and B1 observation files were reused for all three corpora and re-scored against the errata-1 corpus (the nine cases are looked up by their old id). A and B1 were not re-run on any surface. Only the new candidate was measured.

## Identity of the new candidate

Built clone-free from a fresh clone in an empty directory, same recipe as round 1 (`npm ci --ignore-scripts`, `js:build`, napi addon, `wasm:build` and `wasm:build:common`, `npm pack` and install of the three tarballs, `maturin develop --release` in a venv, `cargo build --release --locked -p redact-secret-cli`). darwin-arm64, Node v22.16.0. Tarball SHA-256: `redact-secret-core-0.1.0-beta.14.tgz` `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2`; `redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz` `4c4371921c57c754761eedf122c70cd40a49bb8cee33e8278485831d5525f174`; `redact-secret-wasm-0.1.0-beta.14.tgz` `b42f93b2c4fb2eb46acfe8065c5eca320b06016cbd3f483a54b01ab4d187d16d`. Addon `3d03ca7d57bbec809016cb17c599c81293d8eb5cf3eacd1117255815eab0b151`, full-profile wasm `d20d226cd3843794d4ee0031d198f351921bfae4246df5814e67220f3bfa84b3`, CLI `e62336604de67e06cf162076c50d7133fadc0afcbaf4e6b239d53b627ee22391`. Harness and scorer unchanged (`scripts/measure-batch1.mjs`, `benchmarks/batch2/score-r2.mjs`); the round-2 scoring script `scripts/report-groups-cde-r2.mjs` adds no scoring rule.

## 1. Headline (new candidate R2 against round-1 candidate B1 and baseline A, all scored on the errata-1 corpus)

| group | identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported | conflict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C (#752, errata-1) | A beta.13 | 277 | 197 | 212 | 65 | 242 | 27 | 127 | 0 |
| C (#752, errata-1) | B1 e1284537 | 277 | 197 | 212 | 65 | 242 | 27 | 127 | 0 |
| C (#752, errata-1) | R2 e1cc1f31 | 277 | 232 | 247 | 30 | 242 | 10 | 127 | 0 |
| D (#753) | A beta.13 | 219 | 159 | 180 | 39 | 351 | 25 | 290 | 8 |
| D (#753) | B1 e1284537 | 219 | 181 | 202 | 17 | 351 | 23 | 290 | 8 |
| D (#753) | R2 e1cc1f31 | 219 | 197 | 218 | 1 | 351 | 8 | 290 | 8 |
| E (#754) | A beta.13 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| E (#754) | B1 e1284537 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| E (#754) | R2 e1cc1f31 | 343 | 297 | 297 | 46 | 186 | 1 | 234 | 4 |
| all | A | 839 | 538 | 584 | 255 | 779 | 54 | 651 | 12 |
| all | B1 | 839 | 560 | 606 | 233 | 779 | 52 | 651 | 12 |
| all | R2 | 839 | 726 | 762 | 77 | 779 | 19 | 651 | 12 |

Note on C controls: round 1 reported 36 of 251 controls flagged on the original freeze; on errata-1 the nine `code=` controls are observed-only, so B1 is 27 of 242 here (the 9 are now in `unsupported`: 118 to 127). C type and action (convention): R2 pass 232 of 277, type 247, action 247 (B1 197/212/212); where a finding touches a C span, type and action equal the convention, so the remaining gap is span width and misses. D and E carry no type or action expectation.

### C (#752, errata-1), per row

| row | pos | exact B1 | exact R2 | fullyCov B1 | fullyCov R2 | misses B1 | misses R2 | ctl | flagged B1 | flagged R2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adobe:oauth-server-to-server-client-secret` | 24 | 24 | 24 | 24 | 24 | 0 | 0 | 28 | 5 | 2 |
| `adobe:enterprise-web-app-client-secret` | 21 | 21 | 21 | 21 | 21 | 0 | 0 | 28 | 5 | 2 |
| `adobe:oauth-web-app-client-secret` | 16 | 16 | 16 | 16 | 16 | 0 | 0 | 15 | 2 | 2 |
| `airtable:personal-access-token` | 22 | 22 | 22 | 22 | 22 | 0 | 0 | 21 | 0 | 0 |
| `contentful:cma-personal-access-token` | 33 | 18 | 18 | 18 | 18 | 15 | 15 | 28 | 5 | 0 |
| `dropbox:access-token` | 36 | 36 | 36 | 36 | 36 | 0 | 0 | 22 | 0 | 0 |
| `hubspot:private-app-access-token` | 35 | 18 | 35 | 18 | 35 | 17 | 0 | 22 | 0 | 0 |
| `jfrog:reference-token` | 33 | 0 | 18 | 0 | 18 | 33 | 15 | 22 | 0 | 0 |
| `meta:app-secret` | 22 | 7 | 7 | 22 | 22 | 0 | 0 | 23 | 10 | 4 |
| `salesforce:oauth-refresh-token` | 35 | 35 | 35 | 35 | 35 | 0 | 0 | 21 | 0 | 0 |
| `x:oauth1-consumer-secret` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0 |

### D (#753), per row

| row | pos | exact B1 | exact R2 | fullyCov B1 | fullyCov R2 | misses B1 | misses R2 | ctl | flagged B1 | flagged R2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `algolia:admin-api-key` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 33 | 0 | 0 |
| `contentful:delivery-api-access-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 63 | 1 | 0 |
| `dropbox:app-auth-token` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 37 | 0 | 0 |
| `elastic:cross-cluster-api-key` | 18 | 1 | 17 | 1 | 17 | 17 | 1 | 23 | 0 | 0 |
| `elastic:serverless-project-api-key` | 22 | 22 | 22 | 22 | 22 | 0 | 0 | 30 | 0 | 0 |
| `figma:plan-access-token` | 29 | 29 | 29 | 29 | 29 | 0 | 0 | 32 | 0 | 0 |
| `hubspot:static-auth-access-token` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 38 | 0 | 0 |
| `meta:app-access-token` | 21 | 0 | 0 | 21 | 21 | 0 | 0 | 26 | 12 | 8 |
| `meta:instagram-app-secret` | 21 | 21 | 21 | 21 | 21 | 0 | 0 | 31 | 9 | 0 |
| `zoom:build-platform-api-key` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 33 | 1 | 0 |
| `zoom:webhook-secret-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |

### E (#754), per row

| row | pos | exact B1 | exact R2 | fullyCov B1 | fullyCov R2 | misses B1 | misses R2 | ctl | flagged B1 | flagged R2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adobe:service-account-jwt-private-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 17 | 1 | 0 |
| `airtable:legacy-api-key` | 28 | 27 | 28 | 27 | 28 | 1 | 0 | 18 | 1 | 0 |
| `dropbox:legacy-long-lived-access-token` | 25 | 24 | 25 | 24 | 25 | 1 | 0 | 16 | 0 | 0 |
| `hubspot:legacy-api-key` | 32 | 0 | 32 | 0 | 32 | 32 | 0 | 19 | 0 | 1 |
| `jfrog:api-key` | 40 | 0 | 22 | 0 | 22 | 40 | 18 | 22 | 0 | 0 |
| `reddit:oauth-access-token` | 86 | 59 | 84 | 59 | 84 | 27 | 2 | 38 | 0 | 0 |
| `reddit:oauth-refresh-token` | 48 | 46 | 48 | 46 | 48 | 2 | 0 | 20 | 0 | 0 |
| `reddit:app-client-secret` | 26 | 0 | 0 | 0 | 0 | 26 | 26 | 15 | 0 | 0 |
| `zendesk:api-token` | 58 | 26 | 58 | 36 | 58 | 22 | 0 | 21 | 0 | 0 |

Rows with no scored case (observed-only) are omitted from these tables and listed in section 6.

## 2. Regressions

A regression is a case that passed (positive exact and fully covered) or was clean (control) on B1 or on A and fails now. **Count: 1. This is a blocker.**

- `hubspot:legacy-api-key:e:query-upper-placeholder:control` (E, row `hubspot:legacy-api-key`, control): expectation, no finding (must-not-flag, Case `hubspot-legacy-api-key-placeholders-references-and-non-values`); input `...?hapikey=YOUR_HAPIKEY` in a curl URL. Observed on R2: `contextual_secret`/`warn` 82-94 (generic-token), the 12-byte placeholder `YOUR_HAPIKEY` on all four surfaces and all modes. B1 and A: clean (the `hapikey` name was unread, so nothing was reported). Likely cause (not verified in product code): the new `hapikey` name admission now reads the slot, and `YOUR_HAPIKEY` is not recognised as a placeholder there by the earlier `YOUR_`-lead rule. It is the only control in the three corpora that became flagged.

No other case that was good on B1 or on A is bad on R2: every positive that was exact and fully covered is still, every clean control is still clean (checked over all 2281 cases).

## 3. Parity

| group | cases | identical on all 16 observations (4 surfaces x whole/stream x 7-byte/1-byte runs) | also identical in detector name | divergent |
| --- | --- | ---: | ---: | ---: |
| C (#752, errata-1) | 646 | 646 | 646 | 0 |
| D (#753) | 868 | 868 | 868 | 0 |
| E (#754) | 767 | 767 | 767 | 0 |

**No divergence**: whole == 7-byte == 1-byte and Node == WASM == Python == CLI for all 2,281 cases (and no divergence in detector name either), so there is none to list.

## 4. Round-1 gap groups

| group (round 1 count) | status | closed | still open | triage now |
| --- | --- | ---: | ---: | --- |
| G-brace (39) | partially closed | 27 | 12 | PRODUCT GAP, mostly fixed; residual open product gap |
| G-angle (1) | closed | 1 | 0 | PRODUCT GAP, fixed |
| G-docmask (6) | closed | 6 | 0 | PRODUCT GAP, fixed |
| G-xapikey-clientid (6) | open | 0 | 6 | POLICY QUESTION, answered: recorded deviation (b), accepted false positive |
| G-authcode (9) | erratum applied | 9 moved to observed-only | 0 | CORPUS ERRATUM CANDIDATE, applied (errata-1): downgraded to observed-only |
| G-meta-pipe-span (36) | open | 0 | 36 | POLICY QUESTION, answered: recorded deviation (a), accepted over-span |
| G-token-member (32) | partially closed | 17 | 15 | PRODUCT GAP (HubSpot `tokenKey`, fixed); policy-limited (Contentful lone `token`) |
| G-jfrog (73) | partially closed | 40 | 33 | PRODUCT GAP (header, fixed); policy-limited (`curl -u`) |
| G-hapikey (32) | closed | 32 | 0 | PRODUCT GAP, fixed |
| G-reddit-token (24) | partially closed | 22 | 2 | PRODUCT GAP, fixed where a revoke context exists; policy-limited otherwise |
| G-reddit-secret (26) | open | 0 | 26 | policy-limited (`curl -u/--user`, #1247) |
| G-zendesk-cred (32) | closed | 32 | 0 | PRODUCT GAP, fixed |
| G-digits24 (7) | closed | 7 | 0 | PRODUCT GAP, fixed (16+ digits, medium/`warn`) |
| G-elastic-encoded (17) | partially closed | 16 | 1 | PRODUCT GAP, fixed with an `api_key` sibling; policy-limited alone |

Remaining open cases, grouped by root cause (counts are scored cases still failing on R2; case ids drop the `<family>:<group>:` prefix, full records in `scores.json`):

- **`curl -u` / `--user` Basic password slot unread (policy-limited, deviation (c), #1247)**: 59.
  - C jfrog:reference-token (15): `fixture-replay-reference-token-curl-basic-password:positive`, `curl-u-password-plain:positive`, `curl-u-password-eof:positive`, `curl-u-password-double-quoted:positive`, `curl-u-password-single-quoted:positive`, `curl-u-password-flag-after:positive`, `curl-u-password-utf8-before-after:positive`, `curl-u-password-crlf:positive`, `curl-u-password-big-preceding:positive`, `curl-u-password-repeat:positive`, `curl-u-password-user-with-digits-and-dots:positive`, `curl-u-password-value-hyphenated:positive`, `curl-u-password-value-dotted-underscore:positive`, `curl-u-password-value-long-150:positive`, `curl-u-password-value-short-16:positive`
  - E jfrog:api-key (18): `fx-api-key-curl-basic-password:positive`, `basic-curl-u-unquoted:positive`, `basic-curl-u-eof:positive`, `basic-curl-u-double:positive`, `basic-curl-u-single:positive`, `basic-curl-u-after-url:positive`, `basic-curl-u-continuation:positive`, `basic-curl-u-crlf:positive`, `basic-curl-u-utf8:positive`, `basic-curl-u-big-preceding:positive`, `basic-curl-u-same-shape-user:positive`, `basic-curl-u-repeat:positive`, `basic-curl-u-era-words:positive`, `basic-shape-hex32:positive`, `basic-shape-alnum64:positive`, `basic-shape-urlsafe40:positive`, `basic-shape-digits24:positive`, `basic-shape-lower16:positive`
  - E reddit:app-client-secret (26): `fx-secret-curl-user-code-flow:positive`, `fx-secret-curl-u-application-only:positive`, `fx-secret-curl-user-revocation:positive`, `basic-user-single:positive`, `basic-user-double:positive`, `basic-user-unquoted:positive`, `basic-u-unquoted-space:positive`, `basic-u-single:positive`, `basic-u-eof:positive`, `basic-u-before-data:positive`, `basic-user-revocation:positive`, `basic-user-refresh:positive`, `basic-user-continuation:positive`, `basic-user-crlf:positive`, `basic-user-utf8:positive`, `basic-user-big-preceding:positive`, `basic-user-same-shape-id:positive`, `basic-user-same-shape-data:positive`, `basic-user-repeat:positive`, `basic-user-neighbouring-secret:positive`, `basic-user-era-words:positive`, `basic-shape-hex32:positive`, `basic-shape-alnum64:positive`, `basic-shape-urlsafe40:positive`, `basic-shape-digits24:positive`, `basic-shape-lower16:positive`
- **bare `token` stays unmatched (policy-limited, #1241): Contentful lone `token` member**: 15.
  - C contentful:cma-personal-access-token (15): `fixture-replay-cma-pat-create-response-token-member:positive`, `token-member-pretty-json-response:positive`, `token-member-json-compact:positive`, `token-member-json-last:positive`, `token-member-json-crlf-tabs:positive`, `token-member-json-spaced-colon:positive`, `token-member-json-same-shape-neighbour:positive`, `token-member-json-utf8-before-after:positive`, `token-member-json-big-preceding:positive`, `token-member-repeat:positive`, `token-member-neighbouring-secret:positive`, `token-member-value-hyphenated:positive`, `token-member-value-dotted-underscore:positive`, `token-member-value-long-150:positive`, `token-member-value-short-16:positive`
- **bare `token=` without revoke or introspect context (policy-limited, #1241)**: 2.
  - E reddit:oauth-access-token (2): `form-utf8-before-after:positive`, `form-repeat:positive`
- **Elastic `encoded` member without an `api_key` sibling (policy-limited)**: 1.
  - D elastic:cross-cluster-api-key (1): `encoded-member-only:positive`
- **residual placeholder, OPEN PRODUCT GAP: `{your-app_id}|<non-brace secret half>` (`<...>`, `********`, empty) reported as the 12-byte `{your-app_id` (`warn`)**: 12.
  - C meta:app-secret (4): `access-token-pipe-benign-2-request-line:control`, `access-token-pipe-benign-2-curl-utf8:control`, `access-token-pipe-benign-3-request-line:control`, `access-token-pipe-benign-3-curl-utf8:control`
  - D meta:app-access-token (8): `query-angle-secret-only:control`, `curl-angle-secret-only:control`, `query-mask:control`, `curl-mask:control`, `query-bullets:control`, `curl-bullets:control`, `query-empty-secret:control`, `curl-empty-secret:control`
- **Meta `APP_ID|SECRET` whole-pair over-span (accepted deviation (a))**: 36.
  - C meta:app-secret (15): `fixture-replay-app-pair-raw-http:positive`, `fixture-replay-app-pair-curl-url:positive`, `fixture-replay-app-pair-url-query-continues:positive`, `access-token-pipe-request-line:positive`, `access-token-pipe-curl-url:positive`, `access-token-pipe-query-continues:positive`, `access-token-pipe-query-eof:positive`, `access-token-pipe-utf8-before-after:positive`, `access-token-pipe-big-preceding:positive`, `access-token-pipe-repeat:positive`, `access-token-pipe-same-shape-app-id:positive`, `access-token-pipe-value-hyphenated:positive`, `access-token-pipe-value-dotted-underscore:positive`, `access-token-pipe-value-long-150:positive`, `access-token-pipe-value-short-16:positive`
  - D meta:app-access-token (21): `fixture-app-pair-curl-url:positive`, `fixture-app-pair-raw-http:positive`, `fixture-app-pair-url-query-continues:positive`, `raw-get-line:positive`, `curl-url-quoted:positive`, `query-continues:positive`, `eof:positive`, `query-first-param:positive`, `curl-single-quoted:positive`, `crlf-end:positive`, `app-id-15-digits:positive`, `app-id-17-digits:positive`, `utf8-before-after:positive`, `big-preceding:positive`, `same-shape-neighbour:positive`, `neighbouring-secret:positive`, `repeat:positive`, `shape-hex32:positive`, `shape-short:positive`, `shape-marker:positive`, `shape-long:positive`
- **`x-api-key` Adobe client ID (accepted deviation (b))**: 6.
  - C adobe:oauth-server-to-server-client-secret (2): `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`
  - C adobe:enterprise-web-app-client-secret (2): `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`
  - C adobe:oauth-web-app-client-secret (2): `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`

- **NEW regression, OPEN PRODUCT GAP** (section 2): the `hapikey=YOUR_HAPIKEY` placeholder control: 1.
  - E hubspot:legacy-api-key (1): `query-upper-placeholder:control`

The Meta `{your-app_id}|X` residual is not covered by the product's own addendum (which lists `{your-app_id}|{your-app_secret}` as silent): with a brace pair both halves are references, but with a non-brace secret half (`<APP_SECRET>`, `<your-app-secret>`, `********`, bullets, empty) the brace app-id half is still reported as the 12-byte `{your-app_id` (the round-1 shape, apparently a cut at `}`). 4 C controls and 8 D controls; no secret leaks, the cost is a `warn` false positive.

## 5. New findings

**Scored cases newly bad: 1** (the regression in section 2). **Scored cases whose findings changed while still failing: 1**: `reddit:oauth-access-token:e:form-repeat:positive` was silent on both occurrences on B1 and now reports the second (`curl -d "token=..."` beside `/revoke_token`, correct under the revoke-context rule) but not the first (a bare `token=...&again=1` line with no revoke context), so it is still a miss on one of its two spans (policy-limited, #1241). No other scored case changed from bad to bad.

**Observed-only cases whose behaviour changed: 35** (27 newly flagged, 5 newly silent, 3 otherwise changed). None is scored.

- Newly flagged (27): `hubspot:private-app-access-token` 1, `jfrog:reference-token` 2, `hubspot:legacy-api-key` 11, `jfrog:api-key` 12, `zendesk:api-token` 1. All are variants of the carriers the nine fixes added: `hapikey` in a YAML URL, fragment, log line, HTML href, upper-case, prefixed-name and percent forms and a JSON member; the `X-JFrog-Art-Api` header in header maps, YAML, lower- and mixed-case and no-space forms (plus three vendor-shaped probe values, `AKCp`+69, `AKCp8`+68 and the 44-character base64 form, in the header slot); the Zendesk vendor-shaped 40-character probe in the credential string; two UUID-shaped values in the `hapikey` slot; a `tokenKey` member nested in an array. Each finding is `contextual_secret`/`redact` on a value in a documented credential slot, so none looks like a false positive.
- Newly silent (5): `fixture-replay-app-pair-lookalike-appsecret-proof-derived:unsupported`, `appsecret-proof-0:unsupported`, `appsecret-proof-1:unsupported`, `fixture-app-pair-lookalike-appsecret-proof-derived:conflict`, `fx-api-token-lookalike-masked-display:conflict`. The three Meta `appsecret-proof-*` cases and the D conflict case were a false positive on the neighbouring `{user-access-token}` placeholder (the brace fix); the Zendesk masked-display conflict was a `warn` on a masked credential string (the `/token:` reader treats a mask as a reference).
- Otherwise changed (3): `repeat-response-and-log:unsupported` (elastic:cross-cluster-api-key); `credential-yaml-quoted:unsupported` (zendesk:api-token); `credential-yaml-unquoted:unsupported` (zendesk:api-token). The two Zendesk YAML-quoted/unquoted variants went from a whole-string `warn` to a token-only `redact` (correct under the policy); the Elastic repeat case gained a finding on its `log: encoded=...` line (a base64 `id:api_key` repeated in a log).
- **16-digit rule, `{name}`/`[name]` placeholder grammar, Zendesk `/token:` reader**: no scored control changed from clean to flagged because of any of them (the only newly flagged control is the `hapikey` regression above), and none of the observed-only changes is a digit run, a bracket/brace placeholder or a `/token:` credential that looks like a false positive. The digit rule's medium/`warn` cap shows in the closed digit cases (see section 4). A caution that the corpora cannot answer: they hold no 16+ digit counters, order numbers or phone numbers in credential-named slots, so the false-positive cost of that rule on real traffic is not measured here.

## 6. Final disposition of all 43 rows

Categories, by rule: *fully covered*: every scored positive exact and fully covered, every scored control clean; *covered with recorded policy deviation*: the only open cases are accepted policy deviations; *policy-limited*: open scored cases whose reason is a recorded product policy, none of them a defect the policy does not explain; *carrier unresolved (observed only)*: no scored positive (controls, if any, are clean); *open product gap*: any open case the recorded policy does not explain. Counts: covered with recorded policy deviation 3; fully covered 15; policy-limited 6; open product gap 3; carrier unresolved (observed only) 16.

| corpus | row | disposition | detail / open cases |
| --- | --- | --- | --- |
| C | `adobe:oauth-server-to-server-client-secret` | covered with recorded policy deviation | 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) Open: G-xapikey-clientid x2. |
| C | `adobe:enterprise-web-app-client-secret` | covered with recorded policy deviation | 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) Open: G-xapikey-clientid x2. |
| C | `adobe:oauth-web-app-client-secret` | covered with recorded policy deviation | 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) Open: G-xapikey-clientid x2. |
| C | `airtable:personal-access-token` | fully covered | 22/22 positives exact, 21 controls clean |
| C | `contentful:cma-personal-access-token` | policy-limited | 15 open: a lone `token` member (Contentful create response beside only `name`) is not read: the bare-`token` rule of #1241 (read only beside `sys` or `scopes`) Open: G-token-member x15. |
| C | `dropbox:access-token` | fully covered | 36/36 positives exact, 22 controls clean |
| C | `hubspot:private-app-access-token` | fully covered | 35/35 positives exact, 22 controls clean |
| C | `jfrog:reference-token` | policy-limited | 15 open: `curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) Open: G-jfrog x15. |
| C | `meta:app-secret` | open product gap | 4 controls (residual brace/angle/mask placeholder: `{your-app_id}|<non-brace secret half>` still `warn`); Meta `APP_ID|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a)) Open: G-meta-pipe-span x15, G-brace x4. |
| C | `salesforce:oauth-refresh-token` | fully covered | 35/35 positives exact, 21 controls clean |
| C | `x:oauth1-consumer-secret` | carrier unresolved (observed only) | no scored positive; 12 controls, 0 flagged |
| D | `algolia:admin-api-key` | fully covered | 27/27 positives exact, 33 controls clean |
| D | `contentful:delivery-api-access-token` | carrier unresolved (observed only) | no scored positive; 63 controls, 0 flagged |
| D | `dropbox:app-auth-token` | fully covered | 27/27 positives exact, 37 controls clean |
| D | `elastic:cross-cluster-api-key` | policy-limited | 1 open: an `encoded` member with no `api_key` sibling is not read (bounded sibling reader, #1229 addendum) Open: G-elastic-encoded x1. |
| D | `elastic:serverless-project-api-key` | fully covered | 22/22 positives exact, 30 controls clean |
| D | `figma:plan-access-token` | fully covered | 29/29 positives exact, 32 controls clean |
| D | `hubspot:static-auth-access-token` | fully covered | 27/27 positives exact, 38 controls clean |
| D | `meta:app-access-token` | open product gap | 8 controls (residual brace/angle/mask placeholder: `{your-app_id}|<non-brace secret half>` still `warn`); Meta `APP_ID|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a)) Open: G-meta-pipe-span x21, G-brace x8. |
| D | `meta:instagram-app-secret` | fully covered | 21/21 positives exact, 31 controls clean |
| D | `x:oauth1-access-token` | carrier unresolved (observed only) | no scored case; 12 observed-only |
| D | `zoom:build-platform-api-key` | fully covered | 27/27 positives exact, 33 controls clean |
| D | `zoom:webhook-secret-token` | carrier unresolved (observed only) | no scored positive; 5 controls, 0 flagged |
| D | `algolia:search-only-api-key` | carrier unresolved (observed only) | no scored case; 11 observed-only |
| D | `algolia:secured-api-key` | carrier unresolved (observed only) | no scored case; 9 observed-only |
| D | `algolia:write-api-key` | carrier unresolved (observed only) | no scored case; 10 observed-only |
| D | `algolia:analytics-api-key` | carrier unresolved (observed only) | no scored case; 8 observed-only |
| D | `algolia:monitoring-api-key` | carrier unresolved (observed only) | no scored case; 8 observed-only |
| D | `algolia:usage-api-key` | carrier unresolved (observed only) | no scored case; 8 observed-only |
| D | `contentful:preview-api-access-token` | carrier unresolved (observed only) | no scored case; 12 observed-only |
| D | `asana:service-account-token` | carrier unresolved (observed only) | no scored case; 10 observed-only |
| D | `figma:cli-plan-access-token` | carrier unresolved (observed only) | no scored case; 8 observed-only |
| D | `jfrog:pairing-token` | carrier unresolved (observed only) | no scored case; 8 observed-only |
| D | `canva:authorization-code` | carrier unresolved (observed only) | no scored case; 12 observed-only |
| E | `adobe:service-account-jwt-private-key` | carrier unresolved (observed only) | no scored positive; 17 controls, 0 flagged |
| E | `airtable:legacy-api-key` | fully covered | 28/28 positives exact, 18 controls clean |
| E | `dropbox:legacy-long-lived-access-token` | fully covered | 25/25 positives exact, 16 controls clean |
| E | `hubspot:legacy-api-key` | open product gap | 1 control (NEW regression: `hapikey=YOUR_HAPIKEY` placeholder control now `warn`) Open: N-regression x1. |
| E | `jfrog:api-key` | policy-limited | 18 open: `curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) Open: G-jfrog x18. |
| E | `reddit:oauth-access-token` | policy-limited | 2 open: `token=` with no revoke/introspect endpoint and no `token_type_hint` is not read: bare-`token` rule of #1241 Open: G-reddit-token x2. |
| E | `reddit:oauth-refresh-token` | fully covered | 48/48 positives exact, 20 controls clean |
| E | `reddit:app-client-secret` | policy-limited | 26 open: `curl -u/--user id:secret` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) Open: G-reddit-secret x26. |
| E | `zendesk:api-token` | fully covered | 58/58 positives exact, 21 controls clean |

Dispositions state what the measurement shows against the maintainers' own contract; none promotes support, and a "fully covered" row means only that every frozen scored case passes on one host.

## 7. Honest limits

- **Project-authored, maintainer-only evidence, not independent validation.** The corpora derive from the maintainers' credential-evidence repository (`snapshot-2026.10.06.5`). The product's own round-1 dispositions (the policy deviations and #1241 limits) were read from its docs in this candidate and are the maintainers' decisions on their own evidence; this report records them, it does not validate them.
- **The corpora were written before round 1 and are not shaped by the candidate, but the candidate was shaped by round 1.** The nine fixes target exactly the round-1 failing cases, so closing them is expected and says little about generalisation. The regression shows the opposite risk: a name admission exposes sibling placeholder shapes.
- **One host** (darwin-arm64, Node v22.16.0), not a linux-x64 official run; the addon and wasm bytes are host-bound. **Peers not run.** **The candidate is not published** (branch commit declaring 0.1.0-beta.14).
- Baseline A and B1 were not re-run; their round-1 observations were re-scored on errata-1 (texts byte-identical, nine ids mapped). The C numbers for A and B1 therefore differ from round 1 only by the nine controls now being observed-only.
- The scorer cannot express policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run or any-shape; an over-wide finding is `fullyCovered` but never `exact`, which is why the Meta pipe cases stay in the `exact` shortfall (36).
- The 16+ digit rule's false-positive cost on real data and the `{name}`/`[name]` grammar's on non-placeholder text are not measurable with these corpora.
- Disk: no limit was hit; build `target` directories and `node_modules` were deleted afterwards.

## Reproduce

```bash
/usr/bin/git cherry-pick fd7bc762   # C errata-1 onto the measure branch
node scripts/measure-batch1.mjs --corpus ../benchmarks/group-<c|d|e>/<corpus module> --chunk 7|1 --label candidate-r2 --out obs.json --node-root <install> --wasm-dir <install>/node_modules/@redact-secret/wasm --python <venv python> --cli <redact-secret> --source-commit e1cc1f31e58f9c1e9ef6a58fd057c1106976711b
node scripts/report-groups-cde-r2.mjs --r1 evidence/groups-cde/round1 --obs-dir evidence/groups-cde/round2 --old-c <freeze a7350c51 copy of benchmarks/batch2 and benchmarks/group-c> --out evidence/groups-cde/round2
node scripts/render-groups-cde-r2-report.mjs --dir evidence/groups-cde/round2 --r1 evidence/groups-cde/round1
```
