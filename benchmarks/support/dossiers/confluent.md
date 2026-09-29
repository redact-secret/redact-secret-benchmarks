---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: confluent
families:
  - id: confluent:cloud-api-secret
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.confluent.io/cloud/current/security/authenticate/workload-identities/service-accounts/api-keys/overview.html
        - https://docs.confluent.io/cloud/current/release-notes/index.html
        - https://docs.confluent.io/cloud/current/security/authenticate/identity-faq.html
      issues:
        - redact-secret/redact-secret-benchmarks#234
        - redact-secret/redact-secret#738
      evidence: null
      researchedAt: 2026-09-24
    blockedBy: The checksum recipe is recomputed from the provider's own snippet, not yet checked against a freshly issued secret; every scope is assumed to issue the same shape.
  - id: confluent:cloud-api-secret-legacy
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.confluent.io/cloud/current/security/authenticate/workload-identities/service-accounts/api-keys/overview.html
        - https://docs.confluent.io/cloud/current/release-notes/index.html
        - https://docs.confluent.io/cloud/current/security/authenticate/identity-faq.html
      issues:
        - redact-secret/redact-secret-benchmarks#233
      evidence: null
      researchedAt: 2026-09-24
    blockedBy: Provider states no length or alphabet for the unprefixed form; 64 comes from doc examples, provider test data and two scanner rules, one doc example shows 60. No legacy secret can be newly issued.
---

# Confluent Cloud

Confluent Cloud authenticates API access with a key id and an API secret. The
key id is documented as "not considered secret information"; the secret is
shown once at creation. On 2025-07-30 Confluent started prefixing newly created
secrets, as described on its
[API key overview](https://docs.confluent.io/cloud/current/security/authenticate/workload-identities/service-accounts/api-keys/overview.html)
page. Older secrets keep working unprefixed.

## Families

### `confluent:cloud-api-secret` — Cloud API secret (cflt-prefixed)

- **Shape:** literal `cflt`, then 60 characters from `A-Z a-z 0-9 + /` (64 in
  all). The final 6 characters are a Base64-encoded CRC-32 checksum of the 54
  body characters before them. The provider's own detection snippet fixes the
  recipe: CRC-32 over the 54 body characters excluding the prefix, little-endian
  bytes, standard Base64, first 6 characters. The #234 pass recomputed the
  documented example this way and found big-endian or prefix-included variants
  fail it. Six Base64 characters carry 36 bits and the CRC is 32, so the last
  character can take only four values (derived by the #234 pass, unchecked
  against an issued secret).
- **Sources:** T1: the overview page (prefix, length, alphabet, checksum and
  snippet). The boundary day is worded three ways ("after", "on or after",
  "starting") across the page, the release notes and the identity FAQ, and older
  secrets are said to "may not" carry the prefix on one page and "do not" on
  another. Kingfisher has a checksum-validating rule; gitleaks and trufflehog
  match 64 characters with no `cflt` or checksum handling.
- **Issuance:** Cloud API keys created from the Console or CLI. Not attempted.
- **Collisions:** the 16-character key id (public), resource ids (`lkc-`,
  `lsrc-`, `env-`, `sa-`), the SCIM token `cflt-scim_<JWT>`, and the NASDAQ
  ticker in prose. The legacy 64-character shape overlaps this family's
  alphabet and length.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (evidence-backed table: T1 on prefix, body and checksum, #738).

### `confluent:cloud-api-secret-legacy` — Cloud API secret (unprefixed, pre-2025-07-30)

- **Shape:** an unprefixed 64-character run over `A-Z a-z 0-9 + /`. No
  checksum is documented. Confluent's CLI-table examples, Flink example and
  Terraform provider test data show 64; one Connect API Basic-auth example shows
  60 (probably a hand-edited placeholder).
- **Sources:** T2. Provider examples and provider test fixtures corroborate
  length and alphabet; gitleaks (`[a-z0-9]{64}`, `(?i)`, no `+` or `/`) and
  trufflehog (`[a-zA-Z0-9+/]{64}`, key and secret pair required) supply the
  rule shape and the keyword gate. Kingfisher imports the gitleaks lineage and
  is not independent.
- **Issuance:** not possible; new secrets are prefixed. Cannot be re-observed.
- **Collisions:** any 64-character base64-alphabet run, including a 64-hex
  digest, so the value is only claimed beside a `confluent` keyword. A
  prefixed secret also satisfies this shape. Percent-encoding of `+` and `/`
  inside URL userinfo breaks the run.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (keyword-gated legacy shape, confidence-gated).

## Candidates that are not families yet

- **SCIM token (`cflt-scim_<JWT>`).** Different credential, JWT-shaped.
- **Basic-auth blob** (`base64(key:secret)`). Secret-bearing but not a 64-run.
- **Confluent Platform master keys and OAuth/OIDC tokens.** Out of scope.

## Open questions

1. Does every key scope (Kafka, Schema Registry, Flink, Tableflow, global) issue
   the same `cflt` shape? The docs say "API secrets" generically.
2. Can an unprefixed secret still be minted after 2025-07-30, given the
   conflicting wording?
3. Is the last character of an issued secret always one of the four derived
   values? One issued secret would confirm it (#234 checklist).
4. Real length of the unprefixed form (64 versus the 60-character example).
5. The product module doc gave the cut-over as 2026-07-30 while every provider
   source says 2025-07-30; check whether it was corrected.

## Research log

- redact-secret-benchmarks#234 — `cflt` broad-discovery pass (20 sources);
  closed 2026-09-24, routed to #209.
- redact-secret-benchmarks#233 — legacy broad-discovery pass (20 sources);
  closed 2026-09-24, routed to #207.
- redact-secret#738 — product issue that adopted the documented checksum after
  #234; closed 2026-09-24.
