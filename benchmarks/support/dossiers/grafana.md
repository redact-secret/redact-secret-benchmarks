---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: grafana
families:
  - id: grafana:service-account-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://grafana.com/blog/new-in-grafana-9-1-service-accounts-are-now-ga/
      issues:
        - redact-secret/redact-secret#305
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: Provider text gives only the glsa prefix and that a checksum exists; separators, segment widths and the checksum alphabet are tool-corroborated (T2).
  - id: grafana:cloud-access-policy-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://grafana.com/docs/grafana-cloud/observe-and-act/agent-observability/get-started/grafana-cloud/
        - https://grafana.com/docs/learning-paths/private-data-source-connect/generate-token/
      issues:
        - redact-secret/redact-secret#305
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: Provider text gives only the glc_ prefix; the base64 body alphabet and 32-character floor are tool-corroborated (T2).
---

# Grafana

Grafana issues service account tokens for a Grafana instance and access policy
tokens for Grafana Cloud. Both carry a provider prefix. A third credential, the
legacy Grafana API key, has no prefix of its own and is out of scope of both
families.

Verdicts record research on the shape only. The tier is T1 for the prefix; the
body is a separate, weaker claim spelled out per family. Whether and how core
detects a family is not recorded here.

## Families

### `grafana:service-account-token` — Service account token

- **Shape:** literal `glsa_`, 32 alphanumeric characters, a second `_`, then an
  8-character hexadecimal checksum, 46 characters in all.
- **Sources:** T1 for the prefix and the existence of a checksum: Grafana's
  9.1 service-accounts announcement says tokens can be identified by a "glsa"
  prefix and that a checksum was added. It gives no length. The two `_`
  separators, the 32/8 split and the checksum alphabet come from gitleaks
  8.30.1, with trufflehog's Grafana detector agreeing on the `glsa_` shape.
- **Collisions:** the legacy API key is a base64-encoded JSON object and is a
  different credential.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

### `grafana:cloud-access-policy-token` — Cloud access policy token

- **Shape:** prefix `glc_` followed by a base64-alphabet body (letters, digits,
  `+`, `/`) of at least 32 characters. The body is base64 of a JSON object, so
  in practice it starts with `eyJ`.
- **Sources:** T1 for the prefix: Grafana Cloud's agent-observability guide says
  "Tokens start with glc_" and the private data source connect learning path
  says the value must begin with `glc_`. The learning path wording says the
  token name, which context shows is the value. The alphabet, the 32-character
  floor and the `eyJ` observation come from gitleaks and trufflehog, which
  disagree on the upper bound.
- **Collisions:** none identified. Padding `=` characters are not part of the
  matched grammar.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Legacy Grafana API key.** No prefix; a base64 body beginning `eyJrIjoi`
  that gitleaks and trufflehog match. Excluded by #305 as out of scope.

## Open questions

1. **`glsa_` segment widths.** The 32/8 split is tool-agreed but Grafana states
   no length. One issued service account token would confirm it.
2. **`glc_` ceiling.** Is there an upper bound on the body? Gitleaks says 400,
   trufflehog says a narrower range beginning `eyJ`; no provider text settles it.

## Research log

- redact-secret#305 (2026-09-16) — froze both grammars from Grafana's
  descriptions, gitleaks and trufflehog, and excluded the legacy API key.
- redact-secret#642 (2026-09-23) — re-fetched the provider quotes and re-tiered
  both families to T1 on the prefix; the body stays tool-corroborated. The
  benchmark-side qualification landed in redact-secret-benchmarks#112.
