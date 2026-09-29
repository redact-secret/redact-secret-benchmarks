# Unit-safe diagnostics — candidate @redact-secret/core@0.1.0-beta.10

> **Superseded** by [`beta-11-unit-diagnostics-candidate-ec9224d.md`](beta-11-unit-diagnostics-candidate-ec9224d.md) (candidate `ec9224d` on the corpus with the #948 relabel). Kept as history.

Diagnostics only (#380). The measurement protocol v4 headline — leaked-span rate, leaked-byte rate, collateral ratio and false-alarm rate per kind × tier — is unchanged and remains authoritative; its counts are reproduced under **v4 reference** and cross-checked. Span units and file units are never combined, and no precision, recall, F1 or scanner ranking is derived.

## Identity

- Mode: **candidate**
- Product: `@redact-secret/core` version `0.1.0-beta.10` (declared `0.1.0-beta.10`)
- Candidate source commit: `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`
- Candidate core artifact SHA-256: `467111e288a3677e0e13d11f907a33e358a3161bfb1109f6115f80b16c33f74c`
- Candidate node artifact SHA-256: `b32d462b2daec575834a7287bec74b679a09f93f28717a56956f0b2169b629f8`
- Candidate wasm artifact SHA-256: `b6819bfd95c911db056f93cb78b3341cba7bfb05a22262f8c44461c0c4e1b966`
- Corpus identity: `36b63ce823c38b1ae6651970c29fff2b2ec32d803f4d04f4d05746a8dfc061f5` (45 categories, pinned by `benchmarks/pin-manifest.json` @ `e4bb1dd90f480f713ed33bbd1bd108992fe10ef0`)
- Benchmark revision: `63a855fab948060fdbd85aa89f852fba0e9d33ec`
- Report schema: unit-diagnostics v1; digest `b4b5196b9ab9ad1ad520d428a7332df71ec3c8c66ceefa96edeb621f9940f0d7`
- Output verification: scanAndRedact (replayed twice) cross-checked against redact(input, scan(input)); placeholder `default:<SECRET_n>`
- PII: not-measured — PII cases use the pii-v1 profile (sensitivity/jurisdiction expectations, PiiCase model) rather than must-redact/must-not-flag spans; they are measured by the PII domain reports and are never merged into credential units.

## Secret-span units (must-redact, policy)

Detection is the v4 lattice over every finding, any action. Sanitization is measured on the product's actual `scanAndRedact` output: `removed` means no byte of the span survives. A `warn`/`allow` finding is a detection and never a sanitization success.

| Segment | Spans | EXACT | COVERED | OVERBROAD | PARTIAL | MISS | Output removed | Output partial leak | Output leaked | Failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | 947 | 946 | 1 | 0 | 0 | 0 | 937 (98.9%) | 0 | 10 | 0 |
| `credentials|must-redact/T2|family` | 465 | 465 | 0 | 0 | 0 | 0 | 462 (99.4%) | 0 | 3 | 0 |
| `credentials|policy/T3|family` | 413 | 408 | 0 | 0 | 0 | 5 | 368 (89.1%) | 0 | 45 | 0 |
| `credentials|policy/T3|uncontracted` | 44 | 44 | 0 | 0 | 0 | 0 | 40 (90.9%) | 0 | 4 | 0 |

### Sanitization by the action of the findings on the span

| Segment | none: leaked | warn/allow only: leaked | redact/block: removed / partial / leaked | mixed: removed / partial / leaked | Output leaked bytes / secret bytes | Plaintext still in output |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | 0 | 10 | 937 / 0 / 0 | 0 / 0 / 0 | 400 / 73566 | 10 |
| `credentials|must-redact/T2|family` | 0 | 3 | 462 / 0 / 0 | 0 / 0 / 0 | 114 / 32786 | 3 |
| `credentials|policy/T3|family` | 5 | 40 | 368 / 0 / 0 | 0 / 0 / 0 | 1756 / 19800 | 49 |
| `credentials|policy/T3|uncontracted` | 0 | 4 | 40 / 0 / 0 | 0 / 0 / 0 | 48 / 1514 | 4 |

### Collateral in positive files (out-of-envelope diagnostics, not true negatives)

| Segment | Files | Files with out-of-envelope findings | Out-of-envelope findings by action | Output bytes replaced outside envelopes | v4 collateral bytes |
| --- | ---: | ---: | --- | ---: | ---: |
| `credentials|must-redact/T1|family` | 940 | 0 | — | 0 | 0 |
| `credentials|must-redact/T2|family` | 465 | 0 | — | 0 | 0 |
| `credentials|policy/T3|family` | 412 | 0 | — | 0 | 0 |
| `credentials|policy/T3|uncontracted` | 44 | 0 | — | 0 | 0 |

## File units (must-not-flag)

`clean` is the true-negative diagnostic; any finding is the false-positive diagnostic, split by the strongest action it carried. Family strata (a declared contract, including twins read globally here) and global untargeted controls are separate rows and never share a denominator.

| Segment | Files | Clean | Flagged: warn/allow only | Flagged: redact/block | Strongest action | Flagged: own family or unattributed / other family only | v4 flagged (twin-scoped) | Failed |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |
| `credentials|must-not-flag/T1|family` | 10 | 10 (100.0%) | 0 | 0 | — | 0 / 0 | 0 | 0 |
| `credentials|must-not-flag/T2|family` | 1675 | 1328 (79.3%) | 4 | 343 | redact 343, warn 4 | 0 / 347 | 1 | 0 |
| `credentials|must-not-flag/T2|global-untargeted` | 14 | 14 (100.0%) | 0 | 0 | — | n/a | 0 | 0 |
| `credentials|must-not-flag/T3|family` | 942 | 909 (96.5%) | 0 | 33 | redact 33 | 0 / 33 | 2 | 0 |
| `credentials|must-not-flag/T3|global-untargeted` | 216 | 214 (99.1%) | 2 | 0 | warn 2 | n/a | 2 | 0 |

## Family strata with any span left readable in the output

| Segment | Family | Spans | Partial leak | Leaked | of which warn/allow only |
| --- | --- | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | new-relic-license-key | 15 | 0 | 10 | 10 |
| `credentials|must-redact/T2|family` | mailgun-api-key | 16 | 0 | 2 | 2 |
| `credentials|must-redact/T2|family` | okta-api-token | 16 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | cohere-api-key | 20 | 0 | 2 | 1 |
| `credentials|policy/T3|family` | confluent-cloud-api-secret-legacy | 19 | 0 | 7 | 7 |
| `credentials|policy/T3|family` | datadog-api-key | 17 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | datadog-application-key-legacy | 22 | 0 | 2 | 2 |
| `credentials|policy/T3|family` | deepgram-api-key | 21 | 0 | 4 | 2 |
| `credentials|policy/T3|family` | exa-api-key | 8 | 0 | 2 | 0 |
| `credentials|policy/T3|family` | generic-token | 14 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | heroku-api-key-legacy | 21 | 0 | 6 | 6 |
| `credentials|policy/T3|family` | mailgun-api-key-triplet | 12 | 0 | 4 | 4 |
| `credentials|policy/T3|family` | mistral-api-key | 15 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | new-relic-license-key | 3 | 0 | 3 | 3 |
| `credentials|policy/T3|family` | travisci-api-token | 19 | 0 | 8 | 8 |
| `credentials|policy/T3|family` | twilio-api-key-secret | 23 | 0 | 2 | 2 |
| `credentials|policy/T3|family` | twilio-auth-token | 28 | 0 | 2 | 2 |

## Family strata with any flagged control file

| Segment | Family | Files | Warn/allow only | Redact/block | Other family only | v4 flagged |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-not-flag/T2|family` | ai21-api-key | 9 | 0 | 3 | 3 | 1 |
| `credentials|must-not-flag/T2|family` | anthropic-admin01-key | 15 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | anthropic-api01-key | 14 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | anthropic-token | 9 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | apify-api-token | 13 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | atlassian-api-token | 17 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | aws-bedrock-long-term-api-key | 17 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | aws-bedrock-short-term-api-key | 13 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | azure-devops-personal-access-token | 12 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | cohere-api-key | 21 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | composio-api-key | 21 | 0 | 11 | 11 | 0 |
| `credentials|must-not-flag/T2|family` | composio-org-api-key | 15 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | composio-user-api-key | 15 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | confluent-cloud-api-secret | 14 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | confluent-cloud-api-secret-legacy | 19 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | convex-deployment-key | 17 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | deepgram-api-key | 20 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-audit-token | 17 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-cli-token | 17 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-personal-token | 17 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-scim-token | 17 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-service-account-identity-token | 17 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-service-account-token | 18 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | doppler-token | 22 | 0 | 9 | 9 | 0 |
| `credentials|must-not-flag/T2|family` | e2b-api-key | 18 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | elevenlabs-api-key | 14 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | firecrawl-api-key | 20 | 0 | 11 | 11 | 0 |
| `credentials|must-not-flag/T2|family` | fireworks-ai-api-key | 12 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | github-fine-grained-pat | 9 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | github-token | 52 | 0 | 10 | 10 | 0 |
| `credentials|must-not-flag/T2|family` | gitlab-runner-authentication-token | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | google-api-key | 12 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | groq-api-key | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | helicone-api-key | 21 | 0 | 11 | 11 | 0 |
| `credentials|must-not-flag/T2|family` | helicone-write-api-key | 19 | 0 | 10 | 10 | 0 |
| `credentials|must-not-flag/T2|family` | heroku-api-key | 12 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | inngest-signing-key | 15 | 2 | 4 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | langfuse-secret-key | 17 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | langsmith-api-key | 15 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | mailchimp-api-key | 20 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | microsoft-entra-client-secret | 22 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | mistral-api-key | 18 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | neon-api-key | 16 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | new-relic-license-key | 18 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | notion-integration-token | 9 | 1 | 1 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | notion-token | 13 | 1 | 1 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | onepassword-service-account-token | 15 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | openai-admin-api-key | 18 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | openai-token | 17 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | openrouter-api-key | 12 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | perplexity-api-key | 15 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | pinecone-api-key | 15 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | posthog-project-secret-api-key | 17 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | posthog-token | 19 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | replicate-api-token | 13 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | resend-api-key | 16 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | sendgrid-token | 27 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | sentry-org-auth-token | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | sentry-user-auth-token | 15 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | slack-app-level-token | 9 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | slack-user-token | 10 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | stripe-token | 11 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | stripe-webhook-signing-secret | 9 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | supabase-token | 10 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | tavily-api-key | 18 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | telegram-bot-token | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | together-ai-api-key | 22 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | trigger-dev-personal-access-token | 13 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | trigger-dev-token | 24 | 0 | 12 | 12 | 0 |
| `credentials|must-not-flag/T2|family` | wandb-api-key | 11 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | xai-api-key | 14 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T3|family` | ai21-api-key | 16 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T3|family` | anthropic-admin01-key | 9 | 0 | 1 | 1 | 1 |
| `credentials|must-not-flag/T3|family` | cohere-api-key | 30 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T3|family` | confluent-cloud-api-secret-legacy | 23 | 0 | 10 | 10 | 0 |
| `credentials|must-not-flag/T3|family` | deepgram-api-key | 32 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T3|family` | exa-api-key | 15 | 0 | 3 | 3 | 1 |
| `credentials|must-not-flag/T3|family` | heroku-api-key-legacy | 24 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T3|family` | mistral-api-key | 25 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T3|family` | travisci-api-token | 18 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | twilio-api-key-secret | 19 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | twilio-auth-token | 23 | 0 | 1 | 1 | 0 |

## v4 reference (authoritative, unchanged)

Counts from the unchanged v4 scorer over the same findings; the diagnostics above reproduce `spans`, `leakedSpans`, `leakedBytes`, `secretBytes`, `collateralBytes`, control `files` and control `flaggedFiles` exactly (checked at generation). v4 scopes a twin's false alarm to its own family, so it can be lower than the any-flag file count above; the "other family only" column is the difference).

| Group | Values |
| --- | --- |
| `must-not-flag/T1` | files 10 · flaggedFiles 0 |
| `must-not-flag/T2` | files 1689 · flaggedFiles 1 |
| `must-not-flag/T3` | files 1158 · flaggedFiles 4 |
| `must-redact/T1` | files 940 · spans 947 · leakedSpans 0 · leakedBytes 0 · secretBytes 73566 · collateralBytes 0 |
| `must-redact/T2` | files 465 · spans 465 · leakedSpans 0 · leakedBytes 0 · secretBytes 32786 · collateralBytes 0 |
| `policy/T3` | files 456 · spans 457 · leakedSpans 5 · leakedBytes 192 · secretBytes 21314 · collateralBytes 0 |

## Unscored (T0)

- `credentials|must-not-flag/T0|family`: 19 files, never scored
- `credentials|must-redact/T0|family`: 31 files, never scored
