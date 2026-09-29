# Unit-safe diagnostics — published @redact-secret/core@0.1.0-beta.10

> **Superseded** by [`../2026-09-29/beta-11-unit-diagnostics-published-ec9224d.md`](../2026-09-29/beta-11-unit-diagnostics-published-ec9224d.md) (the same published 0.1.0-beta.10 on the corpus with the #948 relabel). Kept as history.

Diagnostics only (#380). The measurement protocol v4 headline — leaked-span rate, leaked-byte rate, collateral ratio and false-alarm rate per kind × tier — is unchanged and remains authoritative; its counts are reproduced under **v4 reference** and cross-checked. Span units and file units are never combined, and no precision, recall, F1 or scanner ranking is derived.

## Identity

- Mode: **published**
- Product: `@redact-secret/core` version `0.1.0-beta.10` (declared `0.1.0-beta.10`)
- Benchmark lockfile SHA-256: `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939`
- Corpus identity: `36b63ce823c38b1ae6651970c29fff2b2ec32d803f4d04f4d05746a8dfc061f5` (45 categories, pinned by `benchmarks/pin-manifest.json` @ `9353089ece78bda92734c12d3fa6a308e4f88c2b`)
- Benchmark revision: `25ccd99f07faaa0f045e212690a16750af96e78e`
- Report schema: unit-diagnostics v1; digest `6c4e0a4d3121156cf4ecb1c38bc83570487739940be1d6df7696e62426fb27c2`
- Output verification: scanAndRedact (replayed twice) cross-checked against redact(input, scan(input)); placeholder `default:<SECRET_n>`
- PII: not-measured — PII cases use the pii-v1 profile (sensitivity/jurisdiction expectations, PiiCase model) rather than must-redact/must-not-flag spans; they are measured by the PII domain reports and are never merged into credential units.

## Secret-span units (must-redact, policy)

Detection is the v4 lattice over every finding, any action. Sanitization is measured on the product's actual `scanAndRedact` output: `removed` means no byte of the span survives. A `warn`/`allow` finding is a detection and never a sanitization success.

| Segment | Spans | EXACT | COVERED | OVERBROAD | PARTIAL | MISS | Output removed | Output partial leak | Output leaked | Failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | 947 | 794 | 2 | 0 | 1 | 150 | 781 (82.5%) | 1 | 165 | 0 |
| `credentials|must-redact/T2|family` | 465 | 462 | 0 | 0 | 0 | 3 | 457 (98.3%) | 0 | 8 | 0 |
| `credentials|policy/T3|family` | 413 | 401 | 0 | 0 | 0 | 12 | 355 (86.0%) | 0 | 58 | 0 |
| `credentials|policy/T3|uncontracted` | 44 | 44 | 0 | 0 | 0 | 0 | 40 (90.9%) | 0 | 4 | 0 |

### Sanitization by the action of the findings on the span

| Segment | none: leaked | warn/allow only: leaked | redact/block: removed / partial / leaked | mixed: removed / partial / leaked | Output leaked bytes / secret bytes | Plaintext still in output |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | 150 | 15 | 781 / 1 / 0 | 0 / 0 / 0 | 12746 / 73566 | 165 |
| `credentials|must-redact/T2|family` | 3 | 5 | 457 / 0 / 0 | 0 / 0 / 0 | 298 / 32786 | 8 |
| `credentials|policy/T3|family` | 12 | 46 | 355 / 0 / 0 | 0 / 0 / 0 | 2246 / 19800 | 62 |
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
| `credentials|must-not-flag/T2|family` | 1675 | 1331 (79.5%) | 8 | 336 | redact 336, warn 8 | 0 / 344 | 1 | 0 |
| `credentials|must-not-flag/T2|global-untargeted` | 14 | 14 (100.0%) | 0 | 0 | — | n/a | 0 | 0 |
| `credentials|must-not-flag/T3|family` | 942 | 903 (95.9%) | 4 | 35 | warn 4, redact 35 | 2 / 37 | 8 | 0 |
| `credentials|must-not-flag/T3|global-untargeted` | 216 | 208 (96.3%) | 1 | 7 | redact 7, warn 1 | n/a | 8 | 0 |

## Family strata with any span left readable in the output

| Segment | Family | Spans | Partial leak | Leaked | of which warn/allow only |
| --- | --- | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | apify-api-token | 16 | 0 | 8 | 0 |
| `credentials|must-redact/T1|family` | composio-api-key | 16 | 0 | 7 | 0 |
| `credentials|must-redact/T1|family` | composio-org-api-key | 13 | 0 | 4 | 0 |
| `credentials|must-redact/T1|family` | composio-user-api-key | 13 | 0 | 4 | 0 |
| `credentials|must-redact/T1|family` | convex-deployment-key | 16 | 1 | 12 | 0 |
| `credentials|must-redact/T1|family` | doppler-audit-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | doppler-cli-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | doppler-personal-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | doppler-scim-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | doppler-service-account-identity-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | doppler-service-account-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | doppler-token | 21 | 0 | 11 | 0 |
| `credentials|must-redact/T1|family` | e2b-api-key | 16 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | firecrawl-api-key | 16 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | helicone-api-key | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | helicone-write-api-key | 12 | 0 | 4 | 0 |
| `credentials|must-redact/T1|family` | inngest-signing-key | 16 | 0 | 11 | 4 |
| `credentials|must-redact/T1|family` | new-relic-license-key | 15 | 0 | 10 | 10 |
| `credentials|must-redact/T1|family` | onepassword-service-account-token | 16 | 0 | 7 | 1 |
| `credentials|must-redact/T1|family` | posthog-project-secret-api-key | 11 | 0 | 3 | 0 |
| `credentials|must-redact/T1|family` | posthog-token | 14 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | resend-api-key | 16 | 0 | 7 | 0 |
| `credentials|must-redact/T1|family` | trigger-dev-personal-access-token | 10 | 0 | 3 | 0 |
| `credentials|must-redact/T1|family` | trigger-dev-token | 15 | 0 | 6 | 0 |
| `credentials|must-redact/T1|family` | wandb-api-key | 16 | 0 | 8 | 0 |
| `credentials|must-redact/T2|family` | mailchimp-api-key | 24 | 0 | 5 | 2 |
| `credentials|must-redact/T2|family` | mailgun-api-key | 16 | 0 | 2 | 2 |
| `credentials|must-redact/T2|family` | okta-api-token | 16 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | cohere-api-key | 20 | 0 | 3 | 1 |
| `credentials|policy/T3|family` | confluent-cloud-api-secret-legacy | 19 | 0 | 8 | 7 |
| `credentials|policy/T3|family` | connection-string | 23 | 0 | 1 | 0 |
| `credentials|policy/T3|family` | datadog-api-key | 17 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | datadog-application-key-legacy | 22 | 0 | 2 | 2 |
| `credentials|policy/T3|family` | deepgram-api-key | 21 | 0 | 8 | 4 |
| `credentials|policy/T3|family` | exa-api-key | 8 | 0 | 2 | 0 |
| `credentials|policy/T3|family` | generic-token | 14 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | heroku-api-key-legacy | 21 | 0 | 9 | 8 |
| `credentials|policy/T3|family` | mailgun-api-key-triplet | 12 | 0 | 4 | 4 |
| `credentials|policy/T3|family` | mistral-api-key | 15 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | new-relic-license-key | 3 | 0 | 3 | 3 |
| `credentials|policy/T3|family` | travisci-api-token | 19 | 0 | 8 | 8 |
| `credentials|policy/T3|family` | twilio-api-key-secret | 23 | 0 | 2 | 2 |
| `credentials|policy/T3|family` | twilio-auth-token | 28 | 0 | 5 | 4 |

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
| `credentials|must-not-flag/T2|family` | composio-api-key | 21 | 0 | 10 | 10 | 0 |
| `credentials|must-not-flag/T2|family` | composio-org-api-key | 15 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | composio-user-api-key | 15 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | confluent-cloud-api-secret | 14 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | confluent-cloud-api-secret-legacy | 19 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | convex-deployment-key | 17 | 0 | 4 | 4 | 0 |
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
| `credentials|must-not-flag/T2|family` | perplexity-api-key | 15 | 1 | 5 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | pinecone-api-key | 15 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | posthog-project-secret-api-key | 17 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | posthog-token | 19 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | replicate-api-token | 13 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | resend-api-key | 16 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | sendgrid-token | 27 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | sentry-org-auth-token | 15 | 3 | 0 | 3 | 0 |
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
| `credentials|must-not-flag/T3|family` | heroku-api-key-legacy | 24 | 0 | 3 | 2 | 1 |
| `credentials|must-not-flag/T3|family` | inngest-signing-key | 9 | 1 | 1 | 2 | 2 |
| `credentials|must-not-flag/T3|family` | mistral-api-key | 25 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T3|family` | resend-api-key | 9 | 2 | 0 | 2 | 2 |
| `credentials|must-not-flag/T3|family` | stripe-token | 7 | 0 | 1 | 0 | 1 |
| `credentials|must-not-flag/T3|family` | travisci-api-token | 18 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | twilio-api-key-secret | 19 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | twilio-auth-token | 23 | 1 | 0 | 1 | 0 |

## v4 reference (authoritative, unchanged)

Counts from the unchanged v4 scorer over the same findings; the diagnostics above reproduce `spans`, `leakedSpans`, `leakedBytes`, `secretBytes`, `collateralBytes`, control `files` and control `flaggedFiles` exactly (checked at generation). v4 scopes a twin's false alarm to its own family, so it can be lower than the any-flag file count above; the "other family only" column is the difference).

| Group | Values |
| --- | --- |
| `must-not-flag/T1` | files 10 · flaggedFiles 0 |
| `must-not-flag/T2` | files 1689 · flaggedFiles 1 |
| `must-not-flag/T3` | files 1158 · flaggedFiles 16 |
| `must-redact/T1` | files 940 · spans 947 · leakedSpans 151 · leakedBytes 11396 · secretBytes 73566 · collateralBytes 0 |
| `must-redact/T2` | files 465 · spans 465 · leakedSpans 3 · leakedBytes 110 · secretBytes 32786 · collateralBytes 0 |
| `policy/T3` | files 456 · spans 457 · leakedSpans 12 · leakedBytes 466 · secretBytes 21314 · collateralBytes 0 |

## Unscored (T0)

- `credentials|must-not-flag/T0|family`: 19 files, never scored
- `credentials|must-redact/T0|family`: 31 files, never scored
