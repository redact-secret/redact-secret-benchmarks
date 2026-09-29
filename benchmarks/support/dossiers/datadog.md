---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: datadog
families:
  - id: datadog:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.datadoghq.com/resources/json/full_spec_v1.json
      issues:
        - redact-secret/redact-secret#644
        - redact-secret/redact-secret#575
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/644/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: datadog:application-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.datadoghq.com/account_management/personal-access-tokens/
        - https://docs.datadoghq.com/account_management/service-access-tokens/
        - https://github.com/DataDog/datadog-agent/blob/f0012103d472748fae9f09011b4ebe124c3da98c/pkg/privateactionrunner/util/keys.go
        - https://github.com/DataDog/cloudformation-template/blob/db39dcd1de0019f0bc5b03420a66750c69ef3038/aws_quickstart/datadog_agentless_saas.yaml
      issues:
        - redact-secret/redact-secret#645
        - redact-secret/redact-secret#671
        - redact-secret/redact-secret-benchmarks#162
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/645/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: datadog:application-key-legacy
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.datadoghq.com/resources/json/full_spec_v1.json
        - https://github.com/DataDog/datadog-agent/blob/f0012103d472748fae9f09011b4ebe124c3da98c/pkg/privateactionrunner/util/keys.go
        - https://github.com/DataDog/cloudformation-template/blob/db39dcd1de0019f0bc5b03420a66750c69ef3038/aws_quickstart/datadog_agentless_saas.yaml
        - https://github.com/DataDog/terraform-module-datadog-agentless-scanner/blob/15deadd3c1a1447367636a1435620b6c4a94e91c/azure/arm/agentless-api-call.ps1
      issues:
        - redact-secret/redact-secret#645
        - redact-secret/redact-secret#671
        - redact-secret/redact-secret-benchmarks#162
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/645/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Datadog

Datadog issues three credential shapes that matter here: 32-character API keys (sent as `DD-API-KEY` / `DD_API_KEY`), application keys (a current `ddapp_` generation and a legacy bare-hex generation), and personal or service access tokens (`ddpat_`, `ddsat_`, outside the taxonomy). Provider documentation:
[personal access tokens](https://docs.datadoghq.com/account_management/personal-access-tokens/) (the comparison table with the identifiable prefixes) and the v1 API spec served at docs.datadoghq.com.

## Families

### `datadog:api-key` — API key

- **Shape:** exactly 32 characters, no prefix, no delimiter, no checksum. Lowercase hex in every observed value.
- **Sources:** T1 for length: `ApiKey.key` in the v1 spec has `minLength` and `maxLength` 32, and `securitySchemes.apiKeyAuth` names `DD-API-KEY` and `DD_API_KEY` (fetched 2026-09-23). The v2 schema states no length. The alphabet is tool- and Datadog-code-corroborated only; Datadog's own validators disagree on uppercase `A-F`.
- **Issuance:** not attempted. An empirical check of one fresh key (length 32, any uppercase, any fixed leading text) is specified in the #644 web-search pass.
- **Collisions:** a bare 32-hex run is common (MD5 digests, UUIDs without dashes), so the value needs marker context.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md) (row `datadog:api-key`); evidence [#644 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/644/README.md).
- **Open caveat:** Length 32 and the DD-API-KEY / DD_API_KEY markers are T1; the lowercase-hex alphabet is tool- and provider-code-corroborated only.

### `datadog:application-key` — Application key (ddapp_-prefixed)

- **Shape:** literal `ddapp_` then 34 alphanumeric characters, 40 in total. The prefix table on the personal and service access token pages lists `ddapp_ (new)` for application keys. Datadog's own Agent scrubber alone admits `_` in the body.
- **Sources:** T1 for the prefix (two Datadog docs pages, re-fetched 2026-09-23). Body length and alphabet: Datadog Agent app-key validator, CloudFormation and ARM templates, and an AWS Secrets Manager partner page, none of them a documentation page. The documented CRC32 checksum applies to `ddpat_` only.
- **Issuance:** not attempted; a fresh key would settle body length and alphabet.
- **Collisions:** `ddpat_` and `ddsat_` tokens can be sent where an application key is expected, so a value under an app-key name may not be `ddapp_`.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); evidence [#645 record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/645/README.md). The split from the legacy shape was made in [redact-secret#671](https://github.com/redact-secret/redact-secret/issues/671).
- **Open caveat:** The ddapp_ prefix is T1; the 34-character alphanumeric body is corroborated by Datadog-owned code and AWS only, not by a provider page.

### `datadog:application-key-legacy` — Application key (legacy 40-hex)

- **Shape:** 40 lowercase hex characters, no prefix. Datadog calls application keys legacy features after Q3 2026.
- **Sources:** T2. The v1 spec's `ApplicationKey.hash` has length 40 (provider-domain, length only). Datadog-owned code (Agent, CloudFormation, ARM script) accepts `[a-f0-9]{40}` or the `ddapp_` form, and a CloudFormation changelog names it "the legacy 40-character hex format". The Agent scrubber alone also accepts uppercase; core rejects it on purpose.
- **Issuance:** not attempted.
- **Collisions:** SHA-1 digests and Git commit ids have the same shape, so no bare-value claim is made.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md); the record is the #645 evidence above and the corroboration entry `datadog-application-key-legacy` in `benchmarks/support/empirical-observations.json`.
- **Open caveat:** No identifying element exists: a bare 40-hex value fits a SHA-1 digest, so the shape is only claimed beside a same-line application-key or datadog marker.

## Candidates that are not families yet

- **`ddpat_` personal access tokens and `ddsat_` service access tokens.** Documented with a `<SECRET><CHECKSUM>` grammar (CRC32) on the same pages; GitHub secret scanning added `datadog_pat` and `datadog_sat` in 2026-06. No taxonomy entry yet.

## Open questions

1. Body length and alphabet of `ddapp_` keys: one fresh key would settle them (checklist in the #645 broad-discovery pass).
2. Does uppercase hex ever appear in legacy keys? Datadog's validators disagree.
3. Datadog release notes are login-gated and unread.
4. The #645 issue body still says NOT FOUND – INCOMPLETE and should point at the evidence record.

## Research log

- [redact-secret#644](https://github.com/redact-secret/redact-secret/issues/644) — API key: FOUND for length and marker only; verdict recorded 2026-09-23.
- [redact-secret#645](https://github.com/redact-secret/redact-secret/issues/645) — application key: FOUND for the `ddapp_` prefix only; legacy 40-hex has no identifying element.
- [redact-secret#671](https://github.com/redact-secret/redact-secret/issues/671) — detector gap: `ddapp_` keys were undetected; the family was split into current and legacy (closed 2026-09-23).
- [redact-secret-benchmarks#162](https://github.com/redact-secret/redact-secret-benchmarks/issues/162) — benchmarks promotion intake for the same false negative.
- [redact-secret#575](https://github.com/redact-secret/redact-secret/issues/575) — Epic A roll-up; `datadog:api-key` and `datadog:application-key` were in its second batch.
