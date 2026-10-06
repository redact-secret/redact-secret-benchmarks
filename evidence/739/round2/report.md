# Batch 2, round 2: adversarial measurement of newly ready rows and a harder re-test of round 1

Frozen corpus `sha256:a312308a141e3157c859f62e53c5e0762ca91c2e0083d0e02497848ebee8b921` (1935 cases; first freeze 46a555b8 in 8e447629, three documented errata E1-E3 before the re-measurement; round 1's own corpus 74fed382 is untouched). Expectations: credential-evidence `65602481` handoff and research docs, and the adopted contract (redact-secret #1231, `a148dadf`).

- Baseline: published @redact-secret/core 0.1.0-beta.13 (npm; integrity sha512-qZkqRN7CIJ+pc0IteRCXSucr1l9KtTc/nJaM5wPL0NvCiZ4AGWLCyrLy8KD95a2MBgxo8vuUJ/UaKhrny7gMJQ==), PyPI redact-secret 0.1.0b13, crates.io redact-secret-cli 0.1.0-beta.13 (cargo install --locked). Candidate: unpublished redact-secret commit a148dadf4a43b5441ed88386d055428b2e278f25 (the round-1 candidate: core main has not moved; no candidate package was published by the core session). Same baseline and candidate as round 1.
- Surfaces: Node, WASM, Python, CLI (Rust), whole and streamed at 7-byte and 1-byte chunks. Peers: not run. Platform darwin-arm64, Node v22.16.0.

## Parts

| part | cases | positives (baseline pass / candidate pass / candidate 1-byte pass) | controls (baseline clean / candidate clean / candidate 1-byte clean) | unsupported observed | conflict |
| --- | ---: | --- | --- | ---: | ---: |
| new-rows | 1048 | 525 / 536 / 536 of 544 | 295 / 295 / 295 of 307 | 197 | 0 |
| round1-adversarial | 887 | 455 / 466 / 466 of 466 | 244 / 244 / 244 of 248 | 171 | 2 |

A case counts as failing when any surface, whole or streamed, fails it.

## Axes: what each tests and whether it bit (candidate)

| axis | tests | positives failing | controls flagged | unsupported observed |
| --- | --- | ---: | ---: | ---: |
| direct-slot | the value sits in the evidence-established slot in its plainest layout | 2 / 135 | 0 / 0 | 0 |
| delimiter-after | the byte right after the value (quote, ampersand, comma, brace, space, semicolon, CRLF, end of input) decides the span end | 4 / 371 | 0 / 0 | 0 |
| delimiter-before | the byte right before the value (quote, equals, space, colon, tab) decides the span start | 2 / 107 | 0 / 0 | 0 |
| neighbouring-public-field | a public lookalike (id, expiry, type, scope) next to the secret must stay outside the span | 0 / 111 | 0 / 76 | 0 |
| same-shape-neighbour | a public value with the same alphabet and length as the secret sits next to it: shape alone must not decide | 1 / 64 | 0 / 70 | 0 |
| neighbouring-secret | a second credential in the same document does not shift the first span | 0 / 57 | 0 / 0 | 0 |
| repeat-secret | the same value appears twice in one document: both occurrences are the sensitive span | 0 / 72 | 0 / 0 | 0 |
| utf8-preceding | multi-byte text (emoji, CJK, combining marks) before the slot: byte vs UTF-16 vs code point offsets | 1 / 102 | 0 / 0 | 0 |
| utf8-following | multi-byte text right after the value or delimiter | 0 / 74 | 0 / 0 | 0 |
| end-of-input | the value is the last bytes of the input, with no terminator (finalize path) | 2 / 104 | 0 / 0 | 27 |
| line-ending | CRLF, tabs, indentation and trailing whitespace around the slot | 1 / 90 | 0 / 0 | 0 |
| nesting | the slot is inside a nested JSON array/object, YAML list or URL with other parameters | 2 / 93 | 0 / 0 | 0 |
| big-preceding | a few KB of unrelated text before the slot | 0 / 47 | 0 / 0 | 0 |
| glued-name | a name lookalike glued to the slot name (suffix) that must stay a control, or a prefixed name observed as unsupported | 0 / 27 | 0 / 44 | 63 |
| near-miss-value | the name is right but the value is a placeholder, reference, mask, empty, null or too short | 0 / 0 | 16 / 291 | 72 |
| near-miss-name | the value is secret-shaped but the name or header is not the slot | 0 / 0 | 0 / 187 | 0 |
| alphabet | Bearer values using the whole RFC 6750 b64token alphabet and padding | 0 / 48 | 0 / 0 | 0 |
| value-entropy | a low-entropy literal in the slot: medium confidence and warn | 0 / 43 | 0 / 0 | 0 |
| representation | a variant the handoff or the contract leaves unassertable (percent forms, quote styles, case, ambiguous layouts): observed only | 0 / 0 | 0 / 0 | 296 |
| stream-cut | tiny chunk boundaries (7-byte and 1-byte runs): a cut inside the name, between name and value, inside the value and at the delimiter | 2 / 60 | 0 / 0 | 0 |
| jwt-overlap | a JWT-shaped value under Bearer: one final finding, exact JWT | 0 / 1 | 0 / 0 | 0 |

## Rows with a candidate failure

| family | group | part | failing cases (candidate) | issue |
| --- | --- | --- | --- | --- |
| `meta:user-access-token` | G1 | new-rows | `access_token-form-empty-null:control` | redact-secret#1232 |
| `airtable:oauth-refresh-token` | G2 | new-rows | `refresh_token-form-empty-null:control` | redact-secret#1232 |
| `asana:oauth-refresh-token` | G2 | new-rows | `refresh_token-form-empty-null:control` | redact-secret#1232 |
| `box:oauth-refresh-token` | G2 | new-rows | `refresh_token-form-empty-null:control` | redact-secret#1232 |
| `dropbox:refresh-token` | G2 | new-rows | `refresh_token-form-empty-null:control` | redact-secret#1232 |
| `hubspot:oauth-refresh-token` | G2 | new-rows | `refresh_token-form-empty-null:control` | redact-secret#1232 |
| `x:oauth2-refresh-token` | G2 | new-rows | `refresh_token-form-empty-null:control` | redact-secret#1232 |
| `asana:oauth-client-secret` | G3 | new-rows | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `box:oauth-client-secret` | G3 | new-rows | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `dropbox:app-secret` | G3 | round1-adversarial | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `hubspot:app-client-secret` | G3 | new-rows | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `salesforce:external-client-app-consumer-secret` | G3 | new-rows | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `zendesk:oauth-client-secret` | G3 | round1-adversarial | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `zoom:oauth-app-client-secret` | G3 | new-rows | `client_secret-form-empty-null:control` | redact-secret#1232 |
| `hubspot:personal-access-key` | G5 | new-rows | `personalAccessKey-yaml-account:positive`, `personalAccessKey-yaml-quoted:positive`, `personalAccessKey-yaml-eof-crlf:positive`, `personalAccessKey-yaml-same-shape:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-env:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-export-quoted:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-env-eof:positive`, `HUBSPOT_PERSONAL_ACCESS_KEY-docker-compose:positive` | redact-secret#1233 |
| `x:oauth1-access-token-secret` | G5 | round1-adversarial | `oauth_token_secret-form-empty-null:control` | redact-secret#1232 |
| `mongodb-atlas:database-user-password` | G6 | round1-adversarial | `password-member-placeholders:control` | redact-secret#1234 |

## Fixed in the candidate by an existing core fix

- `elastic:cloud-api-key`: 11 cases fail on the baseline and pass on the candidate (Elastic ApiKey envelope, core #1212 / PR #1215).
- `elastic:ece-api-key`: 11 cases fail on the baseline and pass on the candidate (Elastic ApiKey envelope, core #1212 / PR #1215).

## Unsupported-variant observations (not scored)

- unterminated: 27 cases, 0 produced findings on the candidate
- below-floor: 72 cases, 1 produced findings on the candidate
- prefixed: 63 cases, 63 produced findings on the candidate
- upper: 27 cases, 27 produced findings on the candidate
- single-quoted: 27 cases, 27 produced findings on the candidate
- percent: 46 cases, 46 produced findings on the candidate
- lowercase: 31 cases, 30 produced findings on the candidate
- no-space: 20 cases, 20 produced findings on the candidate
- newline: 45 cases, 1 produced findings on the candidate
- curl-user: 8 cases, 0 produced findings on the candidate
- basic-reference: 2 cases, 2 produced findings on the candidate
- legacy: 1 cases, 0 produced findings on the candidate
- oauth_token-as-public-lookalike: 1 cases, 1 produced findings on the candidate
