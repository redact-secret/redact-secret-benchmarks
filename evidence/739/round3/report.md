# Batch 2, round 3: replay of the exact candidate 4e004108 on unchanged inputs

Candidate: unpublished redact-secret commit `4e0041081aad22d0101bd52db52017b67b5bd3db` (core main after PR #1235; declared 0.1.0-beta.13, not released). Previous candidate: `a148dadf4a43b5441ed88386d055428b2e278f25` (rounds 1 and 2). Baseline: published beta.13 as measured in round 2 (identity unchanged, observations reused). Surfaces: Node, WASM, Python and CLI (whole, 7-byte and 1-byte streams). Platform darwin-arm64, Node v22.16.0. Peers: not run (the harness is product-only). Corpora are frozen and were not edited: round 2 `sha256:a312308a141e3157c859f62e53c5e0762ca91c2e0083d0e02497848ebee8b921` (1935 cases), round 1 `sha256:74fed38245503b63d55247f0da2da8e27a271de5467b3b06146ebef0c4f7a4f1` (486 cases), Batch 1 `sha256:ddd709174816443e2234594f040d0dae27e3b78b5dce68f2396296bffde8708c` (82 cases). No expectation was rewritten to fit the candidate.

## Results (a case fails when any surface, whole or streamed, fails it)

| corpus / run | positives passing | controls clean | whole == stream | four surfaces and modes identical |
| --- | ---: | ---: | ---: | ---: |
| round 2, candidate 4e004108, 7-byte chunks | 1010 / 1010 | 555 / 555 | 7740/7740 | 1935/1935 |
| round 2, candidate 4e004108, 1-byte chunks | 1010 / 1010 | 555 / 555 | 7740/7740 | 1935/1935 |
| round 2, previous candidate a148dadf, 7-byte chunks (round 2) | 1002 / 1010 | 539 / 555 | 7740/7740 | 1935/1935 |
| round 2, published beta.13, 7-byte chunks (round 2) | 980 / 1010 | 539 / 555 | 7740/7740 | 1935/1935 |
| round 1, candidate 4e004108, 7-byte chunks | 200 / 200 | 203 / 203 | 1944/1944 | 486/486 |
| round 1, candidate 4e004108, 1-byte chunks | 200 / 200 | 203 / 203 | 1944/1944 | 486/486 |
| round 1, previous candidate a148dadf, 7-byte chunks (round 1) | 200 / 200 | 203 / 203 | 1944/1944 | 486/486 |

Batch 1 controls (82 cases, 656 surface x case x mode entries): 0 differences against the accepted `af1e71e0` observations at 7-byte chunks; 0 at 1-byte chunks. Round-1 corpus against the round-1 observations of a148dadf: 0 differences.

## Candidate against the previous candidate (a148dadf), by semantic case ID

25 distinct cases differ (200 observations of surface x mode, 8 per case); the same 25 at 1-byte chunks. Every difference is a changed observation of one of the three fixes:

- empty form value followed by &name= (control now clean): 15
- HubSpot personalAccessKey / HUBSPOT_PERSONAL_ACCESS_KEY positives (now pass): 8
- Atlas password placeholder control (now clean): 1
- unscored observations (unsupported, not scored): 1

Regressions (a previously passing or clean case that now fails or is flagged): 0. Cases still failing or flagged: 0. Cases differing beyond the 25 that core announced: 0 (the list below is the whole difference).

| case | kind | on a148dadf | on 4e004108 |
| --- | --- | --- | --- |
| `airtable:oauth-refresh-token:r2:refresh_token-form-empty-null:control` | control | flagged | clean |
| `asana:oauth-client-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |
| `asana:oauth-refresh-token:r2:refresh_token-form-empty-null:control` | control | flagged | clean |
| `box:oauth-client-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |
| `box:oauth-refresh-token:r2:refresh_token-form-empty-null:control` | control | flagged | clean |
| `dropbox:app-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |
| `dropbox:refresh-token:r2:refresh_token-form-empty-null:control` | control | flagged | clean |
| `hubspot:app-client-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |
| `hubspot:oauth-refresh-token:r2:refresh_token-form-empty-null:control` | control | flagged | clean |
| `hubspot:personal-access-key:r2:HUBSPOT_PERSONAL_ACCESS_KEY-docker-compose:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:HUBSPOT_PERSONAL_ACCESS_KEY-env-eof:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:HUBSPOT_PERSONAL_ACCESS_KEY-env:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:HUBSPOT_PERSONAL_ACCESS_KEY-export-quoted:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:personalAccessKey-legacy-portals:unsupported` | unsupported | observed, not scored | observed, not scored |
| `hubspot:personal-access-key:r2:personalAccessKey-yaml-account:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:personalAccessKey-yaml-eof-crlf:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:personalAccessKey-yaml-quoted:positive` | positive | fails | passes |
| `hubspot:personal-access-key:r2:personalAccessKey-yaml-same-shape:positive` | positive | fails | passes |
| `meta:user-access-token:r2:access_token-form-empty-null:control` | control | flagged | clean |
| `mongodb-atlas:database-user-password:r2:password-member-placeholders:control` | control | flagged | clean |
| `salesforce:external-client-app-consumer-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |
| `x:oauth1-access-token-secret:r2:oauth_token_secret-form-empty-null:control` | control | flagged | clean |
| `x:oauth2-refresh-token:r2:refresh_token-form-empty-null:control` | control | flagged | clean |
| `zendesk:oauth-client-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |
| `zoom:oauth-app-client-secret:r2:client_secret-form-empty-null:control` | control | flagged | clean |

Unscored observation that changed (not a pass or a fail):

- `hubspot:personal-access-key:r2:personalAccessKey-legacy-portals:unsupported`: a148dadf none; 4e004108 55-91 contextual_secret/redact. Observed only: legacy `portals` layout, no contract.

## Side effects of the three fixes on other rows

- #1232 trade-off: an unquoted assignment whose value genuinely begins with `&name=` is no longer reported as that whole value. The frozen corpora contain no such positive (positives whose expected value starts with `&`: round 2 0, round 1 0, Batch 1 0). The 15 round-2 cases with an assignment followed directly by `&name=` are exactly the 15 empty-value controls above (kinds: control); round 1 has 0, Batch 1 0. A one-off synthetic probe with the candidate build (not a corpus case, nothing scored) confirms the accepted trade-off: `password=&name=<alphanumerics>` yields no finding.
- #1233: only the two exact names change anything; no other row moved (HubSpot positives and one unscored layout are the only HubSpot differences).
- #1234: the new password-word list affected one control (the Atlas `YOUR_PASSWORD` placeholder); the password-field and URI userinfo positives, the low-entropy warn cases and all other password-named cases are unchanged.

## Dispositions of the 17 rows that reproduced a candidate gap

17 of 17 rows are `fixed by candidate 4e004108, replay verified on Node, WASM, Python and CLI (whole, 7-byte and 1-byte streams)`; 0 remain open.

| family | group | core issue | previously failing case IDs | on 4e004108 |
| --- | --- | --- | --- | --- |
| `meta:user-access-token` | G1 | redact-secret#1232 | `access_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `airtable:oauth-refresh-token` | G2 | redact-secret#1232 | `refresh_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `asana:oauth-refresh-token` | G2 | redact-secret#1232 | `refresh_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `box:oauth-refresh-token` | G2 | redact-secret#1232 | `refresh_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `dropbox:refresh-token` | G2 | redact-secret#1232 | `refresh_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `hubspot:oauth-refresh-token` | G2 | redact-secret#1232 | `refresh_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `x:oauth2-refresh-token` | G2 | redact-secret#1232 | `refresh_token-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `asana:oauth-client-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `box:oauth-client-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `dropbox:app-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `hubspot:app-client-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `salesforce:external-client-app-consumer-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `zendesk:oauth-client-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `zoom:oauth-app-client-secret` | G3 | redact-secret#1232 | `client_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `hubspot:personal-access-key` | G5 | redact-secret#1233 | `personalAccessKey-yaml-account:positive`, `personalAccessKey-yaml-quoted:positive`, `personalAccessKey-yaml-eof-crlf:positive`, `personalAccessKey-yaml-same-shape:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-env:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-export-quoted:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-env-eof:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-docker-compose:positive` | passes (0 failing, 0 flagged) |
| `x:oauth1-access-token-secret` | G5 | redact-secret#1232 | `oauth_token_secret-form-empty-null:control` | passes (0 failing, 0 flagged) |
| `mongodb-atlas:database-user-password` | G6 | redact-secret#1234 | `password-member-placeholders:control` | passes (0 failing, 0 flagged) |

## Unchanged, recorded and not resolved here

- `x:oauth1-access-token-secret`: the evidence handoff lists `oauth_token` as a public lookalike; the adopted contract keeps the default `contextual_secret`. The candidate observation is unchanged (observed, not scored). Contract-evidence conflict, owners decide.
- `mongodb-atlas:programmatic-api-private-key`: evidence ready, contract P2 names no layout; no positive exists, only agreed controls (all clean). The Atlas private-key source stays unresolved. Contract-evidence conflict.
- `mongodb-atlas:database-user-password`: percent-escaped URI password; the contract keeps the escapes inside the span, the evidence records the encoding as unresolved. Observed, not scored. Contract-evidence conflict.
- Unsupported-policy variants (prefixed or upper-case names, single quotes, percent values, legacy layouts) remain observed and never scored; `x:app-only-bearer-token` percent-containing forms still redact only the prefix before the first `%`.

Nothing here repins, changes an official run, promotes support, releases, or touches owner acceptance or authority. This is a local replay on one host (darwin-arm64): it does not replace a linux-x64 official run.
