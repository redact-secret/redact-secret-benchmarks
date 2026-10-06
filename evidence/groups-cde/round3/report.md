# Groups C, D and E, round 3: final replay of the candidate with the placeholder-grammar completions

Same role and rules as rounds 1 and 2: no corpus case, FROZEN manifest, evidence extract or scorer was edited, no product code changed, peers not run; `round1/` and `round2/` are untouched. **Final candidate (R3)** redact-secret `c6dd685974b8df6a84514e07e41e35afa711a2ac` (branch `workbench/closeout-batch2-groupcde`, declared 0.1.0-beta.14, not published) = `e1cc1f31` + `c8d661b3` (a `YOUR_<the slot's own name>` placeholder rule, aimed at the round-2 regression) + `c6dd6859` (a pipe composite `{your-app_id}|<placeholder, mask, reference or empty>` is silent when every half is a placeholder; real halves still detected). **Round 2 (R2)** `e1cc1f31`, **round 1 (B1)** `e1284537` and **baseline (A)** beta.13 observations are reused unchanged from their evidence directories and re-scored on the same corpora. Only R3 was measured in this round.

## Corpora

| group | cases | sha256 (recomputed with the corpus generator before scanning; the scoring script aborts on a mismatch) |
| --- | ---: | --- |
| C (#752, errata-1) | 646 | `16036d043fc0dad0e45ec42e2513d2ffec2020da3458a95ed57f09f44fb0e02d` |
| D (#753) | 868 | `aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e` |
| E (#754) | 767 | `6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa` |

Group C is the signed-off errata-1 version (as in round 2; the nine `code=` controls are observed-only), D and E are the freeze. `tests/group-{c,d,e}-corpus.test.mjs` pass. As in round 2, the round-1 A and B1 observations are keyed by the pre-errata ids of the nine C cases; the texts are byte-identical (re-checked against the freeze `a7350c51` by the scoring script).

## Identity of the final candidate

Built clone-free from a fresh clone in an empty directory, same recipe as rounds 1 and 2 (`npm ci --ignore-scripts`, `js:build`, napi addon, `wasm:build` and `wasm:build:common`, `npm pack` and install of the three tarballs, `maturin develop --release` in a venv, `cargo build --release --locked -p redact-secret-cli`). darwin-arm64, Node v22.16.0. Tarball SHA-256: `redact-secret-core-0.1.0-beta.14.tgz` `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2`; `redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz` `3f077018654be412cca449d49390c0dd1223a4e1bbe33c11446a2701a036f155`; `redact-secret-wasm-0.1.0-beta.14.tgz` `3354fd36a7f1c5f41535aa0a8bc6a1853c6b734c6a6fdc10089a52a07f091d24`. Addon `71d13a68bbabda2afa6c00085617ebf47d557a81cb307574d290dd1169009ea5`, full-profile wasm `bb10fdf9322922cbfaac431c94e1ce051692e14fd14f4edb84d7932d47bb18e1`, CLI `7864a2a68b3435aa48f999a6d79a37ae0212da78ad6e25d366de00aefdf6e17e`. Harness (`scripts/measure-batch1.mjs`) and scorer (`benchmarks/batch2/score-r2.mjs`) unchanged; `scripts/report-groups-cde-r3.mjs` adds no scoring rule. Four surfaces, each case whole and in 7-byte and 1-byte chunks.

## 1. Headline (final candidate R3 against round 2 and the earlier identities, all scored on the errata-1 corpus)

| group | identity | positives | exact | fullyCovered | misses | controls | controlFlagged | unsupported | conflict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C (#752, errata-1) | A beta.13 | 277 | 197 | 212 | 65 | 242 | 27 | 127 | 0 |
| C (#752, errata-1) | B1 e1284537 | 277 | 197 | 212 | 65 | 242 | 27 | 127 | 0 |
| C (#752, errata-1) | R2 e1cc1f31 | 277 | 232 | 247 | 30 | 242 | 10 | 127 | 0 |
| C (#752, errata-1) | R3 c6dd6859 | 277 | 232 | 247 | 30 | 242 | 6 | 127 | 0 |
| D (#753) | A beta.13 | 219 | 159 | 180 | 39 | 351 | 25 | 290 | 8 |
| D (#753) | B1 e1284537 | 219 | 181 | 202 | 17 | 351 | 23 | 290 | 8 |
| D (#753) | R2 e1cc1f31 | 219 | 197 | 218 | 1 | 351 | 8 | 290 | 8 |
| D (#753) | R3 c6dd6859 | 219 | 197 | 218 | 1 | 351 | 0 | 290 | 8 |
| E (#754) | A beta.13 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| E (#754) | B1 e1284537 | 343 | 182 | 192 | 151 | 186 | 2 | 234 | 4 |
| E (#754) | R2 e1cc1f31 | 343 | 297 | 297 | 46 | 186 | 1 | 234 | 4 |
| E (#754) | R3 c6dd6859 | 343 | 297 | 297 | 46 | 186 | 0 | 234 | 4 |
| all | A | 839 | 538 | 584 | 255 | 779 | 54 | 651 | 12 |
| all | B1 | 839 | 560 | 606 | 233 | 779 | 52 | 651 | 12 |
| all | R2 | 839 | 726 | 762 | 77 | 779 | 19 | 651 | 12 |
| all | R3 | 839 | 726 | 762 | 77 | 779 | 6 | 651 | 12 |

Note on C controls: round 1 reported 36 of 251 controls flagged on the original freeze; on errata-1 the nine `code=` controls are observed-only, so B1 is 27 of 242 here (the 9 are now in `unsupported`: 118 to 127). C type and action (convention): R3 pass 232 of 277, type 247, action 247 (R2 identical; B1 197/212/212); where a finding touches a C span, type and action equal the convention, so the remaining gap is span width and misses. D and E carry no type or action expectation.

### C (#752, errata-1), per row

| row | pos | exact R2 | exact R3 | fullyCov R2 | fullyCov R3 | misses R2 | misses R3 | ctl | flagged B1 | flagged R2 | flagged R3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adobe:oauth-server-to-server-client-secret` | 24 | 24 | 24 | 24 | 24 | 0 | 0 | 28 | 5 | 2 | 2 |
| `adobe:enterprise-web-app-client-secret` | 21 | 21 | 21 | 21 | 21 | 0 | 0 | 28 | 5 | 2 | 2 |
| `adobe:oauth-web-app-client-secret` | 16 | 16 | 16 | 16 | 16 | 0 | 0 | 15 | 2 | 2 | 2 |
| `airtable:personal-access-token` | 22 | 22 | 22 | 22 | 22 | 0 | 0 | 21 | 0 | 0 | 0 |
| `contentful:cma-personal-access-token` | 33 | 18 | 18 | 18 | 18 | 15 | 15 | 28 | 5 | 0 | 0 |
| `dropbox:access-token` | 36 | 36 | 36 | 36 | 36 | 0 | 0 | 22 | 0 | 0 | 0 |
| `hubspot:private-app-access-token` | 35 | 35 | 35 | 35 | 35 | 0 | 0 | 22 | 0 | 0 | 0 |
| `jfrog:reference-token` | 33 | 18 | 18 | 18 | 18 | 15 | 15 | 22 | 0 | 0 | 0 |
| `meta:app-secret` | 22 | 7 | 7 | 22 | 22 | 0 | 0 | 23 | 10 | 4 | 0 |
| `salesforce:oauth-refresh-token` | 35 | 35 | 35 | 35 | 35 | 0 | 0 | 21 | 0 | 0 | 0 |
| `x:oauth1-consumer-secret` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | 0 | 0 | 0 |

### D (#753), per row

| row | pos | exact R2 | exact R3 | fullyCov R2 | fullyCov R3 | misses R2 | misses R3 | ctl | flagged B1 | flagged R2 | flagged R3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `algolia:admin-api-key` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 33 | 0 | 0 | 0 |
| `contentful:delivery-api-access-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 63 | 1 | 0 | 0 |
| `dropbox:app-auth-token` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 37 | 0 | 0 | 0 |
| `elastic:cross-cluster-api-key` | 18 | 17 | 17 | 17 | 17 | 1 | 1 | 23 | 0 | 0 | 0 |
| `elastic:serverless-project-api-key` | 22 | 22 | 22 | 22 | 22 | 0 | 0 | 30 | 0 | 0 | 0 |
| `figma:plan-access-token` | 29 | 29 | 29 | 29 | 29 | 0 | 0 | 32 | 0 | 0 | 0 |
| `hubspot:static-auth-access-token` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 38 | 0 | 0 | 0 |
| `meta:app-access-token` | 21 | 0 | 0 | 21 | 21 | 0 | 0 | 26 | 12 | 8 | 0 |
| `meta:instagram-app-secret` | 21 | 21 | 21 | 21 | 21 | 0 | 0 | 31 | 9 | 0 | 0 |
| `zoom:build-platform-api-key` | 27 | 27 | 27 | 27 | 27 | 0 | 0 | 33 | 1 | 0 | 0 |
| `zoom:webhook-secret-token` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |

### E (#754), per row

| row | pos | exact R2 | exact R3 | fullyCov R2 | fullyCov R3 | misses R2 | misses R3 | ctl | flagged B1 | flagged R2 | flagged R3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adobe:service-account-jwt-private-key` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 17 | 1 | 0 | 0 |
| `airtable:legacy-api-key` | 28 | 28 | 28 | 28 | 28 | 0 | 0 | 18 | 1 | 0 | 0 |
| `dropbox:legacy-long-lived-access-token` | 25 | 25 | 25 | 25 | 25 | 0 | 0 | 16 | 0 | 0 | 0 |
| `hubspot:legacy-api-key` | 32 | 32 | 32 | 32 | 32 | 0 | 0 | 19 | 0 | 1 | 0 |
| `jfrog:api-key` | 40 | 22 | 22 | 22 | 22 | 18 | 18 | 22 | 0 | 0 | 0 |
| `reddit:oauth-access-token` | 86 | 84 | 84 | 84 | 84 | 2 | 2 | 38 | 0 | 0 | 0 |
| `reddit:oauth-refresh-token` | 48 | 48 | 48 | 48 | 48 | 0 | 0 | 20 | 0 | 0 | 0 |
| `reddit:app-client-secret` | 26 | 0 | 0 | 0 | 0 | 26 | 26 | 15 | 0 | 0 | 0 |
| `zendesk:api-token` | 58 | 58 | 58 | 58 | 58 | 0 | 0 | 21 | 0 | 0 | 0 |

Every positive column is identical between R2 and R3 on every row: the two new fixes moved controls only. Rows with no scored case (observed-only) are omitted here and listed in section 6.

## 2. Regressions

A regression is a scored case that was good (positive exact and fully covered, or control clean) on A, on B1 or on R2 and is bad on R3. **Count: 0.**

The round-2 regression, `hubspot:legacy-api-key:e:query-upper-placeholder:control` (`?hapikey=YOUR_HAPIKEY`, expectation: no finding), is **gone**: on R3 it is clean on all four surfaces and all modes (it was `contextual_secret`/`warn` 82-94 on R2; clean on A and B1). Checked over all 2281 cases against A, B1 and R2: no scored case that was good on any of them is bad now, so no positive lost an exact, fully covered finding to the pipe-composite rule. Exactly 13 cases have different findings on R3 than on R2, all of them controls: the 12 pipe composites (flagged on R2, clean now) and the `YOUR_HAPIKEY` control; every positive, every other control and every observed-only case has findings identical to R2 (so "real halves still detected" holds on every measured positive, including the 36 Meta pipe positives, which still redact the whole pair). 0 scored cases changed their findings while still failing.

## 3. Parity

| group | cases | identical on all 16 observations (4 surfaces x whole/stream x 7-byte/1-byte runs) | also identical in detector name | divergent |
| --- | --- | ---: | ---: | ---: |
| C (#752, errata-1) | 646 | 646 | 646 | 0 |
| D (#753) | 868 | 868 | 868 | 0 |
| E (#754) | 767 | 767 | 767 | 0 |

**No divergence**: whole == 7-byte == 1-byte and Node == WASM == Python == CLI for all 2,281 cases (detector name included), so there is none to list.

## 4. Round-2 residual groups and what still fails

**G-brace remainder (the 12 pipe-composite controls: 4 C `meta:app-secret`, 8 D `meta:app-access-token`): closed.** 12 of 12 are clean on R3 on every surface and mode. Round-1 groups G-brace 39 of 39 closed (0 open), G-angle 1/1, G-docmask 6/6: all 46 placeholder controls of round 1 are clean.

**No scored PRODUCT GAP remains on R3.** Every remaining scored failure is a recorded policy case; they group by cause as follows (counts are scored cases still failing; ids drop the `<family>:<group>:` prefix, full records in `scores.json`):

- **`curl -u` / `--user` Basic password slot unread: policy-limited, #1247, recorded deviation (c)**: 59.
  - C jfrog:reference-token (15): `fixture-replay-reference-token-curl-basic-password:positive`, `curl-u-password-plain:positive`, `curl-u-password-eof:positive`, `curl-u-password-double-quoted:positive`, `curl-u-password-single-quoted:positive`, `curl-u-password-flag-after:positive`, `curl-u-password-utf8-before-after:positive`, `curl-u-password-crlf:positive`, `curl-u-password-big-preceding:positive`, `curl-u-password-repeat:positive`, `curl-u-password-user-with-digits-and-dots:positive`, `curl-u-password-value-hyphenated:positive`, `curl-u-password-value-dotted-underscore:positive`, `curl-u-password-value-long-150:positive`, `curl-u-password-value-short-16:positive`
  - E jfrog:api-key (18): `fx-api-key-curl-basic-password:positive`, `basic-curl-u-unquoted:positive`, `basic-curl-u-eof:positive`, `basic-curl-u-double:positive`, `basic-curl-u-single:positive`, `basic-curl-u-after-url:positive`, `basic-curl-u-continuation:positive`, `basic-curl-u-crlf:positive`, `basic-curl-u-utf8:positive`, `basic-curl-u-big-preceding:positive`, `basic-curl-u-same-shape-user:positive`, `basic-curl-u-repeat:positive`, `basic-curl-u-era-words:positive`, `basic-shape-hex32:positive`, `basic-shape-alnum64:positive`, `basic-shape-urlsafe40:positive`, `basic-shape-digits24:positive`, `basic-shape-lower16:positive`
  - E reddit:app-client-secret (26): `fx-secret-curl-user-code-flow:positive`, `fx-secret-curl-u-application-only:positive`, `fx-secret-curl-user-revocation:positive`, `basic-user-single:positive`, `basic-user-double:positive`, `basic-user-unquoted:positive`, `basic-u-unquoted-space:positive`, `basic-u-single:positive`, `basic-u-eof:positive`, `basic-u-before-data:positive`, `basic-user-revocation:positive`, `basic-user-refresh:positive`, `basic-user-continuation:positive`, `basic-user-crlf:positive`, `basic-user-utf8:positive`, `basic-user-big-preceding:positive`, `basic-user-same-shape-id:positive`, `basic-user-same-shape-data:positive`, `basic-user-repeat:positive`, `basic-user-neighbouring-secret:positive`, `basic-user-era-words:positive`, `basic-shape-hex32:positive`, `basic-shape-alnum64:positive`, `basic-shape-urlsafe40:positive`, `basic-shape-digits24:positive`, `basic-shape-lower16:positive`
- **lone `token` member of the Contentful create response: policy-limited, #1256 (bare `token` member) under the bare-`token` rule #1241**: 15.
  - C contentful:cma-personal-access-token (15): `fixture-replay-cma-pat-create-response-token-member:positive`, `token-member-pretty-json-response:positive`, `token-member-json-compact:positive`, `token-member-json-last:positive`, `token-member-json-crlf-tabs:positive`, `token-member-json-spaced-colon:positive`, `token-member-json-same-shape-neighbour:positive`, `token-member-json-utf8-before-after:positive`, `token-member-json-big-preceding:positive`, `token-member-repeat:positive`, `token-member-neighbouring-secret:positive`, `token-member-value-hyphenated:positive`, `token-member-value-dotted-underscore:positive`, `token-member-value-long-150:positive`, `token-member-value-short-16:positive`
- **`token=` with no revoke or introspect context: policy-limited, bare-`token` rule #1241**: 2.
  - E reddit:oauth-access-token (2): `form-utf8-before-after:positive`, `form-repeat:positive`
- **Elastic `encoded` member with no `api_key` sibling: policy-limited (encoded-member-only)**: 1.
  - D elastic:cross-cluster-api-key (1): `encoded-member-only:positive`
- **Meta `APP_ID|SECRET` redacted whole, public app id included: policy question answered, recorded deviation (a); no byte uncovered, fullyCovered on all 36**: 36.
  - C meta:app-secret (15): `fixture-replay-app-pair-raw-http:positive`, `fixture-replay-app-pair-curl-url:positive`, `fixture-replay-app-pair-url-query-continues:positive`, `access-token-pipe-request-line:positive`, `access-token-pipe-curl-url:positive`, `access-token-pipe-query-continues:positive`, `access-token-pipe-query-eof:positive`, `access-token-pipe-utf8-before-after:positive`, `access-token-pipe-big-preceding:positive`, `access-token-pipe-repeat:positive`, `access-token-pipe-same-shape-app-id:positive`, `access-token-pipe-value-hyphenated:positive`, `access-token-pipe-value-dotted-underscore:positive`, `access-token-pipe-value-long-150:positive`, `access-token-pipe-value-short-16:positive`
  - D meta:app-access-token (21): `fixture-app-pair-curl-url:positive`, `fixture-app-pair-raw-http:positive`, `fixture-app-pair-url-query-continues:positive`, `raw-get-line:positive`, `curl-url-quoted:positive`, `query-continues:positive`, `eof:positive`, `query-first-param:positive`, `curl-single-quoted:positive`, `crlf-end:positive`, `app-id-15-digits:positive`, `app-id-17-digits:positive`, `utf8-before-after:positive`, `big-preceding:positive`, `same-shape-neighbour:positive`, `neighbouring-secret:positive`, `repeat:positive`, `shape-hex32:positive`, `shape-short:positive`, `shape-marker:positive`, `shape-long:positive`
- **`x-api-key` header holding Adobe's public client ID: policy question answered, recorded deviation (b); accepted false positive**: 6.
  - C adobe:oauth-server-to-server-client-secret (2): `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`
  - C adobe:enterprise-web-app-client-secret (2): `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`
  - C adobe:oauth-web-app-client-secret (2): `fixture-replay-client-id-in-x-api-key-header:control`, `client-id-in-x-api-key-header:control`

Total still failing: 119 scored cases (59 #1247, 15 #1256/#1241, 2 #1241, 1 encoded-member-only, 36 deviation (a), 6 deviation (b)). The policy labels come from the candidate's own docs (`docs/specs/detector-families.md`, the #1228/#1229/#1230 evidence addenda) and are the maintainers' decisions on their own evidence; this report records them and does not validate them. No erratum candidate remains open (errata-1 applied the one from round 1).

## 5. Observed-only behaviour changes

Observed-only (`unsupported`, `conflict`) cases whose findings differ between R2 and R3: **0** (C 0, D 0, E 0). The two new fixes touch only scored controls here; every observed-only case, including the 12 conflict cases and the nine downgraded `code=` cases, behaves exactly as on R2. Changes of R2 over B1 are in `round2/report.md` section 5.

## 6. Final disposition of all 43 rows

Categories, by rule (the first sentence of each is the test applied): *fully covered*: every scored positive exact and fully covered, every scored control clean; *covered with recorded policy deviation*: the only open cases are accepted policy deviations; *policy-limited*: open scored cases whose reason is a recorded product policy, none of them a defect the policy does not explain; *carrier unresolved (observed only)*: no scored positive (controls, if any, are clean); *open product gap*: any open case the recorded policy does not explain. Counts: covered with recorded policy deviation 5; fully covered 16; policy-limited 6; carrier unresolved (observed only) 16.

| corpus | row | disposition | detail / open cases |
| --- | --- | --- | --- |
| C | `adobe:oauth-server-to-server-client-secret` | covered with recorded policy deviation | 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) Open: G-xapikey-clientid x2. |
| C | `adobe:enterprise-web-app-client-secret` | covered with recorded policy deviation | 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) Open: G-xapikey-clientid x2. |
| C | `adobe:oauth-web-app-client-secret` | covered with recorded policy deviation | 2 cases: `x-api-key` header holding Adobe's public client ID keeps being flagged (accepted false positive, recorded deviation (b)) Open: G-xapikey-clientid x2. |
| C | `airtable:personal-access-token` | fully covered | 22/22 positives exact, 21 controls clean |
| C | `contentful:cma-personal-access-token` | policy-limited | 15 open: a lone `token` member (Contentful create response beside only `name`) is not read: #1256 (bare `token` member) under the bare-`token` rule #1241 (read only beside `sys` or `scopes`) Open: G-token-member x15. |
| C | `dropbox:access-token` | fully covered | 36/36 positives exact, 22 controls clean |
| C | `hubspot:private-app-access-token` | fully covered | 35/35 positives exact, 22 controls clean |
| C | `jfrog:reference-token` | policy-limited | 15 open: `curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) Open: G-jfrog x15. |
| C | `meta:app-secret` | covered with recorded policy deviation | 15 cases: Meta `APP_ID|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a)) Open: G-meta-pipe-span x15. |
| C | `salesforce:oauth-refresh-token` | fully covered | 35/35 positives exact, 21 controls clean |
| C | `x:oauth1-consumer-secret` | carrier unresolved (observed only) | no scored positive; 12 controls, 0 flagged |
| D | `algolia:admin-api-key` | fully covered | 27/27 positives exact, 33 controls clean |
| D | `contentful:delivery-api-access-token` | carrier unresolved (observed only) | no scored positive; 63 controls, 0 flagged |
| D | `dropbox:app-auth-token` | fully covered | 27/27 positives exact, 37 controls clean |
| D | `elastic:cross-cluster-api-key` | policy-limited | 1 open: encoded-member-only: an `encoded` member with no `api_key` sibling is not read (bounded sibling reader, #1229 addendum) Open: G-elastic-encoded x1. |
| D | `elastic:serverless-project-api-key` | fully covered | 22/22 positives exact, 30 controls clean |
| D | `figma:plan-access-token` | fully covered | 29/29 positives exact, 32 controls clean |
| D | `hubspot:static-auth-access-token` | fully covered | 27/27 positives exact, 38 controls clean |
| D | `meta:app-access-token` | covered with recorded policy deviation | 21 cases: Meta `APP_ID|SECRET` redacted whole, the public app id included (the Case expects the secret half; fully covered, no byte uncovered; recorded deviation (a)) Open: G-meta-pipe-span x21. |
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
| E | `hubspot:legacy-api-key` | fully covered | 32/32 positives exact, 19 controls clean |
| E | `jfrog:api-key` | policy-limited | 18 open: `curl -u user:<password>` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) Open: G-jfrog x18. |
| E | `reddit:oauth-access-token` | policy-limited | 2 open: `token=` with no revoke/introspect endpoint and no `token_type_hint` is not read: bare-`token` rule of #1241 Open: G-reddit-token x2. |
| E | `reddit:oauth-refresh-token` | fully covered | 48/48 positives exact, 20 controls clean |
| E | `reddit:app-client-secret` | policy-limited | 26 open: `curl -u/--user id:secret` password slot not read: stated false negative, issue #1247 (recorded deviation (c)) Open: G-reddit-secret x26. |
| E | `zendesk:api-token` | fully covered | 58/58 positives exact, 21 controls clean |

Dispositions state what the measurement shows against the maintainers' own contract; none promotes support, and a "fully covered" row means only that every frozen scored case passes on one host.
Totals: covered with recorded policy deviation 5; fully covered 16; policy-limited 6; carrier unresolved (observed only) 16 (sum 43). By corpus: C 11 rows, D 23 rows, E 9 rows. Open product gaps: 0.


## 7. What each closed redact-secret issue can honestly claim

Permalinks use the placeholder `<BENCH_COMMIT>` (the benchmarks commit that contains the round-3 directory, 40 hex characters, once pushed). Link these files at that commit: `evidence/groups-cde/round3/report.md` (with the section anchors below), `evidence/groups-cde/round3/scores.json` (per-case, per-row and per-group data), `evidence/groups-cde/round3/identity.json` (candidate identity and digests), and, for reproduction, `scripts/report-groups-cde-r3.mjs`, `scripts/render-groups-cde-r3-report.mjs` and the observation files `evidence/groups-cde/round3/observations-candidate-<c|d|e>-c<7|1>.json.gz`. Earlier rounds: `evidence/groups-cde/round1/report.md` and `evidence/groups-cde/round2/report.md` (round 2 for the regression history). Any claim below applies to candidate `c6dd685974b8df6a84514e07e41e35afa711a2ac`, one host, project-authored evidence.

- **#1228** (Group C, 11 rows): covered with recorded policy deviation 4: `adobe:oauth-server-to-server-client-secret`, `adobe:enterprise-web-app-client-secret`, `adobe:oauth-web-app-client-secret`, `meta:app-secret`; fully covered 4: `airtable:personal-access-token`, `dropbox:access-token`, `hubspot:private-app-access-token`, `salesforce:oauth-refresh-token`; policy-limited 2: `contentful:cma-personal-access-token`, `jfrog:reference-token`; carrier unresolved (observed only) 1: `x:oauth1-consumer-secret`. Evidence: https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/report.md#6-final-disposition-of-all-43-rows, https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/scores.json.
- **#1229** (Group D, 23 rows): fully covered 7: `algolia:admin-api-key`, `dropbox:app-auth-token`, `elastic:serverless-project-api-key`, `figma:plan-access-token`, `hubspot:static-auth-access-token`, `meta:instagram-app-secret`, `zoom:build-platform-api-key`; carrier unresolved (observed only) 14: `contentful:delivery-api-access-token`, `x:oauth1-access-token`, `zoom:webhook-secret-token`, `algolia:search-only-api-key`, `algolia:secured-api-key`, `algolia:write-api-key`, `algolia:analytics-api-key`, `algolia:monitoring-api-key`, `algolia:usage-api-key`, `contentful:preview-api-access-token`, `asana:service-account-token`, `figma:cli-plan-access-token`, `jfrog:pairing-token`, `canva:authorization-code`; policy-limited 1: `elastic:cross-cluster-api-key`; covered with recorded policy deviation 1: `meta:app-access-token`. Evidence: https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/report.md#6-final-disposition-of-all-43-rows, https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/scores.json.
- **#1230** (Group E, 9 rows): carrier unresolved (observed only) 1: `adobe:service-account-jwt-private-key`; fully covered 5: `airtable:legacy-api-key`, `dropbox:legacy-long-lived-access-token`, `hubspot:legacy-api-key`, `reddit:oauth-refresh-token`, `zendesk:api-token`; policy-limited 3: `jfrog:api-key`, `reddit:oauth-access-token`, `reddit:app-client-secret`. Evidence: https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/report.md#6-final-disposition-of-all-43-rows, https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/scores.json.

What each may and may not say:

- **#1228, #1229, #1230**: may say that every scored case of the *fully covered* rows passes on all four surfaces in all three modes, that no scored product gap remains on the Group C, D and E corpora (0 open product gaps), and that the remaining failing cases are exactly the recorded policy cases (#1247 `curl -u`, #1256/#1241 bare `token`, encoded-member-only, deviations (a) and (b)), each named above. May **not** say that the policy-limited rows are covered, that a *carrier unresolved* row is covered (no scored positive exists; its controls are clean, nothing more), or that the fixes generalise beyond the measured shapes: the candidate was changed to close the round-1 and round-2 failures of these same corpora.
- **#1234** (placeholders): the 46 placeholder controls flagged on round 1 (brace `{NAME}` and `{your-app_id}|{your-app_secret}`, angle, documented mask, upper-case reference name) on 10 rows (`adobe:oauth-server-to-server-client-secret`, `adobe:enterprise-web-app-client-secret`, `meta:app-secret`, `meta:app-access-token`, `meta:instagram-app-secret`, `contentful:delivery-api-access-token`, `airtable:legacy-api-key`, `adobe:service-account-jwt-private-key`, `contentful:cma-personal-access-token`, `zoom:build-platform-api-key`) are clean on R3 on every surface and mode, including the 12 pipe composites left open on round 2 and the `YOUR_HAPIKEY` control that regressed on round 2. May say: no placeholder control of these corpora is flagged except the six `x-api-key` client-ID controls (deviation (b), a role question rather than a placeholder). The 12 control closure was measured after c6dd6859; it should be cited together with the round-2 regression history (https://github.com/redact-secret/redact-secret-benchmarks/blob/<BENCH_COMMIT>/evidence/groups-cde/round3/report.md#2-regressions).
- **#1232** (empty form value taking the next parameter): in these corpora the only scored cases that exercise it are the two Instagram empty-value controls, `meta:instagram-app-secret:gd:form-empty:control` and `meta:instagram-app-secret:gd:fixture-instagram-secret-empty-value:control`; both were flagged on published beta.13 and are clean on R3 (and were already clean on the intermediate commit `efe71496`, round 1). Claim no more than that; the 15-family evidence is in Batch 2 (`evidence/739/round3/report.md`).
- **#1224** (X Bearer percent escapes) and **#1225** (HubSpot prefixed names / `personalAccessKey`): Groups C to E hold no scored case for either. Round 1 attributed to the five closeout fixes only two observed-only changes (the percent-containing Bearer value of `dropbox:app-auth-token` and `hubspot:static-auth-access-token`, now covered whole instead of up to the first escape); nothing is scored. These issues should link their Batch 2 evidence, not this report, for row claims. The HubSpot `query-prefixed-name:unsupported` case is flagged on R2 and R3 (observed only); this report cannot attribute that to #1225 rather than to the #1230 `hapikey` rule.
- **#1223** (Batch 2 closeout package), **#1226** (Atlas slots and URI userinfo) and **#1233** (HubSpot `personalAccessKey`): no Group C, D or E row is an Atlas, `personalAccessKey` or Batch 2 closeout row, so none of them has a claim here beyond the aggregate below. #1223 may cite the aggregate: on the three corpora R3 has 0 regressions against A, round 1 and round 2, 0 parity divergences over 2,281 cases, 0 open product gaps, and the policy cases named above.

Aggregate for #1223: positives 839 (exact 726, fully covered 762, misses 77); controls 779 (flagged 6). The 113 positives that are not exact are: 77 policy-limited misses plus 36 fully covered over-wide Meta pipe findings.

## 8. Honest limits

- **Project-authored, maintainer-only evidence, not independent validation.** The corpora derive from the maintainers' credential-evidence repository (`snapshot-2026.10.06.5`) and were written and frozen before any scan; agreement with them shows consistency with the maintainers' own contract and nothing more. The policy dispositions (#1241, #1247, #1256, deviations a and b) are the maintainers' decisions; this report records them.
- **Fixes target the measured failures, so generalisation is not claimed.** The candidate was changed to close exactly the cases round 1 and round 2 reported, on these same corpora. Closing them is expected and says little about unseen carriers; round 2 already showed a name admission exposing a sibling placeholder shape. The placeholder grammar (`{name}`, `[name]`, `YOUR_<slot>`, pipe composites), the 16+ digit rule and the Zendesk `/token:` reader have false-positive costs on real traffic that these corpora do not measure.
- **One host** (darwin-arm64, Node v22.16.0); not a linux-x64 official run; the addon and wasm bytes are host-bound. **Peers not run.** **The candidate is not published** (a branch commit declaring 0.1.0-beta.14).
- A, B1 and R2 were not re-run in this round; their observations from rounds 1 and 2 were re-scored. The scorer cannot express policy tolerance, shared-slot attribution, era neutrality, whole-encoded-run or any-shape: an over-wide finding is `fullyCovered` but never `exact` (36 Meta pipe positives).
- A *fully covered* row means every frozen scored case passes; it does not promote support, change an official run, repin or release anything.
- Disk: no limit was hit; build `target` directories and `node_modules` were deleted afterwards.

## Reproduce

```bash
node scripts/measure-batch1.mjs --corpus ../benchmarks/group-<c|d|e>/<corpus module> --chunk 7|1 --label candidate-r3 --out obs.json --node-root <install> --wasm-dir <install>/node_modules/@redact-secret/wasm --python <venv python> --cli <redact-secret> --source-commit c6dd685974b8df6a84514e07e41e35afa711a2ac
node scripts/report-groups-cde-r3.mjs --r1 evidence/groups-cde/round1 --r2 evidence/groups-cde/round2 --obs-dir evidence/groups-cde/round3 --old-c <freeze a7350c51 copy of benchmarks/batch2 and benchmarks/group-c> --out evidence/groups-cde/round3
node scripts/render-groups-cde-r3-report.mjs --dir evidence/groups-cde/round3 --r1 evidence/groups-cde/round1
```
