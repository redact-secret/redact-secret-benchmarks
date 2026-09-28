# Unit-safe diagnostics — published @redact-secret/core@0.1.0-beta.10

Diagnostics only (#380). The measurement protocol v4 headline — leaked-span rate, leaked-byte rate, collateral ratio and false-alarm rate per kind × tier — is unchanged and remains authoritative; its counts are reproduced under **v4 reference** and cross-checked. Span units and file units are never combined, and no precision, recall, F1 or scanner ranking is derived.

## Identity

- Mode: **published**
- Product: `@redact-secret/core` version `0.1.0-beta.10` (declared `0.1.0-beta.10`)
- Benchmark lockfile SHA-256: `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939`
- Corpus identity: `f06ddd6cedf4f71477b2efb3dc5c13ca5f062ce1d33f9adc1b3e5472f96dbd6d` (31 categories, pinned by `benchmarks/pin-manifest.json` @ `71d0d8c1da4d5c609c287912075bcd92b8cc4a71`)
- Benchmark revision: `8576326c3aa201bd5b0d6d3a55a77ea326c89ddc`
- Report schema: unit-diagnostics v1; digest `69fdc148d022b97073e40e293edbbceea3153233822b5fc6097bb000119c6046`
- Output verification: scanAndRedact (replayed twice) cross-checked against redact(input, scan(input)); placeholder `default:<SECRET_n>`
- PII: not-measured — PII cases use the pii-v1 profile (sensitivity/jurisdiction expectations, PiiCase model) rather than must-redact/must-not-flag spans; they are measured by the PII domain reports and are never merged into credential units.

## Secret-span units (must-redact, policy)

Detection is the v4 lattice over every finding, any action. Sanitization is measured on the product's actual `scanAndRedact` output: `removed` means no byte of the span survives. A `warn`/`allow` finding is a detection and never a sanitization success.

| Segment | Spans | EXACT | COVERED | OVERBROAD | PARTIAL | MISS | Output removed | Output partial leak | Output leaked | Failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | 563 | 562 | 1 | 0 | 0 | 0 | 556 (98.8%) | 0 | 7 | 0 |
| `credentials|must-redact/T2|family` | 450 | 450 | 0 | 0 | 0 | 0 | 445 (98.9%) | 0 | 5 | 0 |
| `credentials|policy/T3|family` | 380 | 376 | 0 | 0 | 0 | 4 | 335 (88.2%) | 0 | 45 | 0 |
| `credentials|policy/T3|uncontracted` | 44 | 44 | 0 | 0 | 0 | 0 | 40 (90.9%) | 0 | 4 | 0 |

### Sanitization by the action of the findings on the span

| Segment | none: leaked | warn/allow only: leaked | redact/block: removed / partial / leaked | mixed: removed / partial / leaked | Output leaked bytes / secret bytes | Plaintext still in output |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | 0 | 7 | 556 / 0 / 0 | 0 / 0 / 0 | 280 / 44189 | 7 |
| `credentials|must-redact/T2|family` | 0 | 5 | 445 / 0 / 0 | 0 / 0 / 0 | 188 / 31509 | 5 |
| `credentials|policy/T3|family` | 4 | 41 | 335 / 0 / 0 | 0 / 0 / 0 | 1724 / 18536 | 45 |
| `credentials|policy/T3|uncontracted` | 0 | 4 | 40 / 0 / 0 | 0 / 0 / 0 | 48 / 1514 | 4 |

### Collateral in positive files (out-of-envelope diagnostics, not true negatives)

| Segment | Files | Files with out-of-envelope findings | Out-of-envelope findings by action | Output bytes replaced outside envelopes | v4 collateral bytes |
| --- | ---: | ---: | --- | ---: | ---: |
| `credentials|must-redact/T1|family` | 556 | 0 | — | 0 | 0 |
| `credentials|must-redact/T2|family` | 450 | 0 | — | 0 | 0 |
| `credentials|policy/T3|family` | 379 | 0 | — | 0 | 0 |
| `credentials|policy/T3|uncontracted` | 44 | 0 | — | 0 | 0 |

## File units (must-not-flag)

`clean` is the true-negative diagnostic; any finding is the false-positive diagnostic, split by the strongest action it carried. Family strata (a declared contract, including twins read globally here) and global untargeted controls are separate rows and never share a denominator.

| Segment | Files | Clean | Flagged: warn/allow only | Flagged: redact/block | Strongest action | Flagged: own family or unattributed / other family only | v4 flagged (twin-scoped) | Failed |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: |
| `credentials|must-not-flag/T1|family` | 9 | 9 (100.0%) | 0 | 0 | — | 0 / 0 | 0 | 0 |
| `credentials|must-not-flag/T2|family` | 1197 | 1042 (87.1%) | 6 | 149 | redact 149, warn 6 | 0 / 155 | 1 | 0 |
| `credentials|must-not-flag/T2|global-untargeted` | 14 | 14 (100.0%) | 0 | 0 | — | n/a | 0 | 0 |
| `credentials|must-not-flag/T3|family` | 723 | 695 (96.1%) | 1 | 27 | warn 1, redact 27 | 0 / 28 | 2 | 0 |
| `credentials|must-not-flag/T3|global-untargeted` | 216 | 208 (96.3%) | 1 | 7 | redact 7, warn 1 | n/a | 8 | 0 |

## Family strata with any span left readable in the output

| Segment | Family | Spans | Partial leak | Leaked | of which warn/allow only |
| --- | --- | ---: | ---: | ---: | ---: |
| `credentials|must-redact/T1|family` | new-relic-license-key | 9 | 0 | 7 | 7 |
| `credentials|must-redact/T2|family` | mailchimp-api-key | 19 | 0 | 2 | 2 |
| `credentials|must-redact/T2|family` | mailgun-api-key | 16 | 0 | 2 | 2 |
| `credentials|must-redact/T2|family` | okta-api-token | 16 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | cohere-api-key | 15 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | confluent-cloud-api-secret-legacy | 14 | 0 | 6 | 6 |
| `credentials|policy/T3|family` | datadog-api-key | 17 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | datadog-application-key-legacy | 22 | 0 | 2 | 2 |
| `credentials|policy/T3|family` | deepgram-api-key | 15 | 0 | 5 | 3 |
| `credentials|policy/T3|family` | exa-api-key | 8 | 0 | 2 | 0 |
| `credentials|policy/T3|family` | generic-token | 14 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | heroku-api-key-legacy | 16 | 0 | 6 | 6 |
| `credentials|policy/T3|family` | mailgun-api-key-triplet | 12 | 0 | 4 | 4 |
| `credentials|policy/T3|family` | mistral-api-key | 15 | 0 | 1 | 1 |
| `credentials|policy/T3|family` | new-relic-license-key | 3 | 0 | 3 | 3 |
| `credentials|policy/T3|family` | travisci-api-token | 19 | 0 | 8 | 8 |
| `credentials|policy/T3|family` | twilio-api-key-secret | 23 | 0 | 2 | 2 |
| `credentials|policy/T3|family` | twilio-auth-token | 22 | 0 | 3 | 3 |

## Family strata with any flagged control file

| Segment | Family | Files | Warn/allow only | Redact/block | Other family only | v4 flagged |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `credentials|must-not-flag/T2|family` | ai21-api-key | 9 | 0 | 3 | 3 | 1 |
| `credentials|must-not-flag/T2|family` | anthropic-admin01-key | 10 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | anthropic-api01-key | 10 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | anthropic-token | 9 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | atlassian-api-token | 17 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | aws-bedrock-long-term-api-key | 14 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | aws-bedrock-short-term-api-key | 13 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | azure-devops-personal-access-token | 12 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | cohere-api-key | 18 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | confluent-cloud-api-secret | 14 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | confluent-cloud-api-secret-legacy | 16 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | deepgram-api-key | 18 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | elevenlabs-api-key | 14 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | fireworks-ai-api-key | 12 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | github-fine-grained-pat | 9 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | github-token | 45 | 0 | 9 | 9 | 0 |
| `credentials|must-not-flag/T2|family` | gitlab-runner-authentication-token | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | google-api-key | 12 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | groq-api-key | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | heroku-api-key | 12 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | langfuse-secret-key | 17 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | langsmith-api-key | 15 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | mailchimp-api-key | 15 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | microsoft-entra-client-secret | 22 | 0 | 7 | 7 | 0 |
| `credentials|must-not-flag/T2|family` | mistral-api-key | 18 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T2|family` | neon-api-key | 16 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | notion-integration-token | 9 | 1 | 1 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | notion-token | 13 | 1 | 1 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | openai-admin-api-key | 13 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | openai-token | 17 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | openrouter-api-key | 12 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | perplexity-api-key | 15 | 1 | 5 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | pinecone-api-key | 15 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T2|family` | replicate-api-token | 13 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | sendgrid-token | 27 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | sentry-org-auth-token | 15 | 3 | 0 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | sentry-user-auth-token | 15 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T2|family` | slack-app-level-token | 9 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | slack-user-token | 10 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | stripe-webhook-signing-secret | 9 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | supabase-token | 10 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T2|family` | tavily-api-key | 18 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T2|family` | telegram-bot-token | 15 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T2|family` | together-ai-api-key | 18 | 0 | 6 | 6 | 0 |
| `credentials|must-not-flag/T2|family` | xai-api-key | 14 | 0 | 5 | 5 | 0 |
| `credentials|must-not-flag/T3|family` | ai21-api-key | 16 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T3|family` | anthropic-admin01-key | 5 | 0 | 1 | 1 | 1 |
| `credentials|must-not-flag/T3|family` | cohere-api-key | 25 | 0 | 3 | 3 | 0 |
| `credentials|must-not-flag/T3|family` | confluent-cloud-api-secret-legacy | 18 | 0 | 8 | 8 | 0 |
| `credentials|must-not-flag/T3|family` | deepgram-api-key | 25 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | exa-api-key | 15 | 0 | 3 | 3 | 1 |
| `credentials|must-not-flag/T3|family` | heroku-api-key-legacy | 18 | 0 | 2 | 2 | 0 |
| `credentials|must-not-flag/T3|family` | mistral-api-key | 25 | 0 | 4 | 4 | 0 |
| `credentials|must-not-flag/T3|family` | travisci-api-token | 18 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | twilio-api-key-secret | 19 | 0 | 1 | 1 | 0 |
| `credentials|must-not-flag/T3|family` | twilio-auth-token | 19 | 1 | 0 | 1 | 0 |

## v4 reference (authoritative, unchanged)

Counts from the unchanged v4 scorer over the same findings; the diagnostics above reproduce `spans`, `leakedSpans`, `leakedBytes`, `secretBytes`, `collateralBytes`, control `files` and control `flaggedFiles` exactly (checked at generation). v4 scopes a twin's false alarm to its own family, so it can be lower than the any-flag file count above; the "other family only" column is the difference).

| Group | Values |
| --- | --- |
| `must-not-flag/T1` | files 9 · flaggedFiles 0 |
| `must-not-flag/T2` | files 1211 · flaggedFiles 1 |
| `must-not-flag/T3` | files 939 · flaggedFiles 10 |
| `must-redact/T1` | files 556 · spans 563 · leakedSpans 0 · leakedBytes 0 · secretBytes 44189 · collateralBytes 0 |
| `must-redact/T2` | files 450 · spans 450 · leakedSpans 0 · leakedBytes 0 · secretBytes 31509 · collateralBytes 0 |
| `policy/T3` | files 423 · spans 424 · leakedSpans 4 · leakedBytes 152 · secretBytes 20050 · collateralBytes 0 |

## Unscored (T0)

- `credentials|must-not-flag/T0|family`: 19 files, never scored
- `credentials|must-redact/T0|family`: 31 files, never scored
