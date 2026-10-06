# Scope accounting

Mode: **published** · origin: local exploratory run, engine v0.1.0-alpha.11 (released tag), snapshot-2026.10.05 · platform: darwin-arm64

Counts are the engine's (credential-eval ADR 0016) over the findings each artifact retains. Nothing was re-classified, filtered or scored here; an unresolved type is neither a false positive nor ignored; a profile is a separate configuration, not a speed-up; Unknown means no accounting was recorded, not zero.

## local-diagnostic

Engine 0.1.0-alpha.11 · credential-eval-protocol/1 · run class exploratory · config sha256:f7e51869466f · evidence records-tree-sha256:924cd5b9b068e0d5ec5039bce962c63a484cb7fdec61b8b1e6603b1c530884b7

| Scanner | Configuration | State | Retained findings | Native label | Mapped credential | Credential-related unmapped | Out of scope | Ambiguous | Label unavailable | Unrecognized label |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| openredaction | default · sha256:b1db3e9c340b | accounted | 360,782 | 360,782 | 1,260 | 102 | 359,420 | 0 | 0 | 0 |
| openredaction-credential-bearing | profile of openredaction · sha256:cf4b7c9a535f | accounted | 1,393 | 1,393 | 1,261 | 104 | 28 | 0 | 0 | 0 |
| openredaction-credentials | profile of openredaction · sha256:6ebc6c138820 | accounted | 1,383 | 1,383 | 1,249 | 106 | 28 | 0 | 0 | 0 |

### openredaction: native types (top 15 of 116)

Classification openredaction-1.1.5 · accounting v1 · multi-label findings 0 · conflicting label sets 0

| Native type | Findings | With family | Reviewed scope | Status |
| --- | ---: | ---: | --- | --- |
| NAME | 333,419 | 0 | pii-or-identifier | not-credential |
| INSTAGRAM_USERNAME | 23,904 | 0 | pii-or-identifier | not-credential |
| XBOX_GAMERTAG | 656 | 0 | pii-or-identifier | not-credential |
| CARD_AUTH_CODE | 454 | 0 | pii | not-credential |
| BEARER_TOKEN | 229 | 229 | credential | mapped |
| AWS_SECRET_KEY | 206 | 206 | credential | mapped |
| GENERIC_SECRET | 156 | 156 | credential | mapped |
| GITHUB_TOKEN | 140 | 140 | credential | mapped |
| GENERIC_API_KEY | 137 | 137 | credential | mapped |
| USERNAME | 88 | 0 | pii-or-identifier | not-credential |
| STRIPE_API_KEY | 86 | 86 | credential | mapped |
| PHONE_UK | 79 | 0 | pii-or-identifier | not-credential |
| SENDGRID_API_KEY | 79 | 79 | credential | mapped |
| STANDING_ORDER_REF | 70 | 0 | pii-or-identifier | not-credential |
| HEROKU_API_KEY | 65 | 0 | credential | unresolved |

### openredaction-credential-bearing: native types (top 15 of 25)

Classification openredaction-1.1.5 · accounting v1 · multi-label findings 0 · conflicting label sets 0

| Native type | Findings | With family | Reviewed scope | Status |
| --- | ---: | ---: | --- | --- |
| BEARER_TOKEN | 229 | 229 | credential | mapped |
| AWS_SECRET_KEY | 206 | 206 | credential | mapped |
| GENERIC_SECRET | 156 | 156 | credential | mapped |
| GITHUB_TOKEN | 140 | 140 | credential | mapped |
| GENERIC_API_KEY | 137 | 137 | credential | mapped |
| STRIPE_API_KEY | 86 | 86 | credential | mapped |
| SENDGRID_API_KEY | 80 | 80 | credential | mapped |
| HEROKU_API_KEY | 67 | 0 | credential | unresolved |
| DATABASE_CONNECTION | 38 | 38 | credential | mapped |
| SLACK_TOKEN | 38 | 38 | credential | mapped |
| NPM_TOKEN | 34 | 34 | credential | mapped |
| AWS_ARN | 28 | 0 | resource-identifier | not-credential |
| OPENAI_API_KEY | 27 | 27 | credential | mapped |
| AWS_ACCESS_KEY | 24 | 24 | credential | mapped |
| PRIVATE_KEY | 16 | 16 | credential | mapped |

### openredaction-credentials: native types (top 15 of 24)

Classification openredaction-1.1.5 · accounting v1 · multi-label findings 0 · conflicting label sets 0

| Native type | Findings | With family | Reviewed scope | Status |
| --- | ---: | ---: | --- | --- |
| BEARER_TOKEN | 229 | 229 | credential | mapped |
| AWS_SECRET_KEY | 206 | 206 | credential | mapped |
| GENERIC_SECRET | 156 | 156 | credential | mapped |
| GITHUB_TOKEN | 141 | 141 | credential | mapped |
| GENERIC_API_KEY | 137 | 137 | credential | mapped |
| STRIPE_API_KEY | 86 | 86 | credential | mapped |
| SENDGRID_API_KEY | 80 | 80 | credential | mapped |
| HEROKU_API_KEY | 67 | 0 | credential | unresolved |
| DATABASE_CONNECTION | 38 | 38 | credential | mapped |
| SLACK_TOKEN | 38 | 38 | credential | mapped |
| NPM_TOKEN | 34 | 34 | credential | mapped |
| AWS_ARN | 28 | 0 | resource-identifier | not-credential |
| OPENAI_API_KEY | 27 | 27 | credential | mapped |
| AWS_ACCESS_KEY | 24 | 24 | credential | mapped |
| PRIVATE_KEY | 16 | 16 | credential | mapped |

### openredaction-credential-bearing against openredaction

Outcome deltas (profile minus default): EXACT -7 · COVERED 0 · OVERBROAD 0 · PARTIAL -91 · MISS +98 · benign controls flagged -629 · retained findings -359,389 · denominators equal: true

The profile is a separate scanner configuration, not a speed-up of the default. Both results are kept; the difference is a recorded configuration effect, not a change of any outcome.

### openredaction-credentials against openredaction

Outcome deltas (profile minus default): EXACT -5 · COVERED -5 · OVERBROAD -4 · PARTIAL -91 · MISS +105 · benign controls flagged -629 · retained findings -359,399 · denominators equal: true

The profile is a separate scanner configuration, not a speed-up of the default. Both results are kept; the difference is a recorded configuration effect, not a change of any outcome.

