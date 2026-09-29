---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: onepassword
families:
  - id: onepassword:service-account-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://developer.1password.com/docs/service-accounts/security/
      issues:
        - redact-secret/redact-secret#860
        - redact-secret/redact-secret#913
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/onepassword.md
      researchedAt: 2026-09-28
    blockedBy: "Length is variable by construction, with one T1 example; the minimum of 250 Base64url bytes after the prefix is project policy, not a provider fact."
---

# 1Password

1Password service accounts hand automation a token (`OP_SERVICE_ACCOUNT_TOKEN`) that embeds the account's key material, so a leak exposes every vault the account can read. Provider documentation: [service account security](https://developer.1password.com/docs/service-accounts/security/).

## Families

### `onepassword:service-account-token` — Service account token (ops_)

- **Shape:** prefix `ops_`, then a Base64url body beginning `eyJ` (Base64 of a JSON object opening), variable length, optional `=` padding kept inside the span. The docs example is 634 characters; the observed range in the research is 634 to 870.
- **Sources:** T1 from the provider page: the format "uses `ops_` as the token prefix" and the rest is "Base64 URL encoded". The `eyJ` lead follows from that and from the docs example (R4, R5). The documented alphabet is Base64url, so the handoff uses `[A-Za-z0-9_-]` rather than the alphanumeric-only samples or gitleaks' standard-Base64 class. The 250-byte floor matches an existing gitleaks floor and is policy. Re-checked 2026-09-28.
- **Issuance:** not attempted.
- **Collisions:** the Connect server token (`OP_CONNECT_TOKEN`) is a standard JWT. The Account Secret Key is a separate credential. `op://vault/item/field` secret references are not secrets.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **Connect server token.** A standard three-segment JWT; the generic JWT detection applies.
- **Account Secret Key** (the `A3-` form). A separate credential with its own grammar; a candidate for later research.

## Open questions

1. Does the dashboard serialization differ in length or alphabet from the CLI serialization? Reported but not confirmed.
2. Research on the Account Secret Key grammar has not started.

## Research log

- redact-secret#860 — epic (open); [research table #39](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5852386967); [Tier B re-rank](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871765611) (READY); [rulings R4, R5](https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5871306275).
- redact-secret#913 — implementation issue (closed).
- [Final disposition record](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/disposition.md) lists it READY, 2026-09-28.
