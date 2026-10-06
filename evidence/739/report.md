# Batch 2 (#739): measured results

> Round 3 (replay of candidate 4e004108 on the unchanged corpora; the 17 rows with a reproduced gap are fixed and replay-verified) is in `round3/report.md`; round 2 is in `round2/report.md`. This file is the round-1 report.

Frozen corpus `sha256:74fed38245503b63d55247f0da2da8e27a271de5467b3b06146ebef0c4f7a4f1` (486 cases: 200 positives, 203 controls, 81 unsupported, 2 conflict), committed before any scan. Expectations come from the evidence handoff (credential-evidence `005a7331`) and the adopted product contract (redact-secret #1231, `a148dadf`), never from observed output.

- Baseline: npm @redact-secret/core 0.1.0-beta.13 (+ @redact-secret/wasm, node-darwin-arm64), PyPI redact-secret 0.1.0b13, crates.io redact-secret-cli 0.1.0-beta.13 built with cargo install --locked. Versions: {"node":"0.1.0-beta.13","wasm":"0.1.0-beta.13","python":"0.1.0b13","cli":"0.1.0-beta.13"}.
- Candidate: unpublished redact-secret commit a148dadf4a43b5441ed88386d055428b2e278f25 (core main after PR #1231; code identical to 3b1a5aa9, includes the Batch 1 fixes af1e71e0, #1202/#1204/#1206 and the #1227 second-wave detectors). Versions: {"node":"0.1.0-beta.13","wasm":"0.1.0-beta.13","python":"0.1.0b13","cli":"0.1.0-beta.13"}.
- Platform darwin-arm64, Node v22.16.0, streamed in 7-byte chunks. Surfaces measured: Node, WASM, Python, CLI (Rust). No separate Rust-library harness exists. Peers: not run (TruffleHog on PATH printed 3.97.6; product-only diagnostics, no peer classification).
- Batch 1 replay on the candidate: same corpus as the accepted #717 run (true); 656 surface x case x mode entries compared with the accepted `af1e71e0` observations, 0 differences.

## Per group

| group | families | measured | not measured (carrier-unresolved) | already-covered / no-code | fixed by an existing core fix | contract-evidence conflict | reproduced gap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| G1 | 23 | 15 | 8 | 15 | 0 | 0 | 0 |
| G2 | 13 | 5 | 8 | 5 | 0 | 0 | 0 |
| G3 | 12 | 4 | 8 | 4 | 0 | 0 | 0 |
| G4 | 4 | 2 | 2 | 1 | 1 | 0 | 0 |
| G5 | 3 | 1 | 2 | 1 | 0 | 0 | 0 |
| G6 | 3 | 3 | 0 | 2 | 0 | 1 | 0 |

## Measured rows

| family | group | positives pass baseline | positives pass candidate | controls flagged (baseline / candidate) | whole = stream, 4 surfaces identical (candidate) | disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `adobe:oauth-server-to-server-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `airtable:oauth-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `asana:personal-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `canva:access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `elastic:access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `elastic:service-account-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `figma:oauth-access-token` | G1 | 14/14 | 14/14 | 0 / 0 | 128/128; 32/32 | already-covered / no-code |
| `figma:scim-api-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `hubspot:oauth-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `hubspot:service-key` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `mongodb-atlas:service-account-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `spotify:access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `x:oauth2-user-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `zendesk:oauth-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `zoom:server-to-server-access-token` | G1 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `adobe:oauth-user-refresh-token` | G2 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `canva:refresh-token` | G2 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `figma:oauth-refresh-token` | G2 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `spotify:refresh-token` | G2 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `zoom:oauth-refresh-token` | G2 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code |
| `dropbox:app-secret` | G3 | 7/7 | 7/7 | 0 / 0 | 68/68; 17/17 | already-covered / no-code |
| `figma:oauth-client-secret` | G3 | 4/4 | 4/4 | 0 / 0 | 56/56; 14/14 | already-covered / no-code |
| `x:oauth2-client-secret` | G3 | 4/4 | 4/4 | 0 / 0 | 56/56; 14/14 | already-covered / no-code |
| `zendesk:oauth-client-secret` | G3 | 7/7 | 7/7 | 0 / 0 | 64/64; 16/16 | already-covered / no-code |
| `elastic:cloud-api-key` | G4 | 0/6 | 6/6 | 0 / 0 | 48/48; 12/12 | fixed in candidate by an existing core fix (no new gap) |
| `x:app-only-bearer-token` | G4 | 7/7 | 7/7 | 0 / 0 | 80/80; 20/20 | already-covered / no-code; unsupported-policy boundary (percent-containing and escaped forms) |
| `x:oauth1-access-token-secret` | G5 | 7/7 | 7/7 | 0 / 0 | 64/64; 16/16 | already-covered / no-code; conflict recorded |
| `mongodb-atlas:database-user-password` | G6 | 7/7 | 7/7 | 0 / 0 | 60/60; 15/15 | already-covered / no-code; conflict recorded |
| `mongodb-atlas:programmatic-api-private-key` | G6 | 0/0 | 0/0 | 0 / 0 | 28/28; 7/7 | contract-evidence conflict; conflict recorded |
| `mongodb-atlas:service-account-secret` | G6 | 4/4 | 4/4 | 0 / 0 | 56/56; 14/14 | already-covered / no-code |

## Contract-evidence conflicts (recorded, not resolved)

- `x:oauth1-access-token-secret`: oauth_token: the evidence handoff names it a public lookalike; the adopted contract (#1225) keeps the default that reads it as contextual_secret and asserts nothing for it. The secret-half expectation is not in conflict.
- `mongodb-atlas:programmatic-api-private-key`: readiness: the evidence handoff marks the row ready (a client-configured Digest input, no wire carrier); the adopted contract (#1226) treats no layout as named and starts it at P2. Only the controls both sides agree on were observed.
- `mongodb-atlas:database-user-password`: percent encoding in a connection-string password: the contract keeps escapes in the span; the evidence records it as unresolved. The password field and plain URI userinfo expectations are not in conflict.

## Not measured

28 rows are carrier-unresolved per credential-evidence#235 and stay unmeasured: not false negatives, true negatives or passing coverage. The follow-up source for each is in `ledger.json` and `readiness.md`.
