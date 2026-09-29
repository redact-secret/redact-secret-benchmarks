---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: neon
families:
  - id: neon:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://neon.com/docs/changelog/2025-01-31
        - https://github.com/betterleaks/betterleaks/blob/6cf4f1a29160b68be7c6390599b9b773234e5a43/cmd/generate/config/rules/neon.go
        - https://github.com/koki-develop/mask-go/blob/3ff232051d4d224314b400d9e973c5a8c7d405d5/builtin_neon_api_key.go
      issues:
        - redact-secret/redact-secret#524
        - redact-secret/redact-secret-benchmarks#259
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/524/README.md
      researchedAt: 2026-09-25
    blockedBy: null
---

# Neon

Neon is a hosted Postgres service. Its API keys (personal, organization and
project-scoped) authenticate the Neon API. Since the
[2025-01-31 changelog entry](https://neon.com/docs/changelog/2025-01-31),
newly created keys carry the `napi_` prefix, which Neon states was added for
secret scanning. Family assessed in #524 alongside three other database-SaaS
credentials.

## Families

### `neon:api-key` — API key

- **Shape:** `napi_` followed by at least 64 alphanumeric characters (`[A-Za-z0-9]`),
  read to the end of the run. Neon's API-keys page calls a key "a
  randomly-generated 64-bit token", which fits no string length, and its only
  written example is not a shape.
- **Sources:** the family tier is T2, following the assessment contract (#259: a T1
  prefix with a tool-corroborated body stays at the weakest frozen field). T1 for the prefix (Neon changelog, quoted in the #524 record).
  The body floor is T2: betterleaks `neon-api-key` (`napi_` + exactly 64) and the
  mask-go library (64 as a floor). The pinned gitleaks 8.30.1 and trufflehog
  3.97.4 have no Neon rule. GitHub secret scanning lists `neon_api_key`
  (expression unpublished), which corroborates the prefix only.
- **Issuance:** Neon Console or API. Not attempted.
- **Collisions:** project, branch and endpoint ids, pooled hostnames with a
  database name, and placeholders are the benign controls in the #524 record.
  A Neon connection URI password is a different credential
  (`connection-string`) and never carries the `napi_` key.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`neon_api_key`, always redacted); frozen in the #524 evidence.
- **Open caveat:** Prefix is T1; the 64-character body floor is T2 (betterleaks exactly 64, mask-go at least 64) and Neon calls a key a "64-bit token". Legacy unprefixed keys are outside the claim. No issued key observed.

## Candidates that are not families yet

The #524 record ranks three further database-SaaS credentials as follow-ups.
None is in the taxonomy.

- **PlanetScale** service token, database password and OAuth token
  (`pscale_tkn_`, `pscale_pw_`, `pscale_oauth_`). The two scanner rules
  disagree on body width (43 versus 32 to 64).
- **CockroachDB Cloud API key** (`CCDB1_` + two segments, per betterleaks).
- **MongoDB Atlas service account secret** (`mdb_sa_sk_` + 40); legacy
  programmatic keys have no marker.

## Open questions

1. Real body length of an issued key, and whether it is fixed or variable.
2. Do legacy unprefixed keys still exist in use, and what do they look like?
3. Do personal, organization and project-scoped keys share one grammar?
4. #524's acceptance box "no new false alarms; T1/T2 leaked spans stay 0" was
   left unticked at close.

## Research log

- redact-secret#524 — assesses Neon, ranks PlanetScale, CockroachDB Cloud and
  MongoDB Atlas, and freezes the Neon grammar; closed 2026-09-25. Deferred from
  beta.6 on 2026-09-21 because neither pinned peer had a Neon rule.
- redact-secret-benchmarks#259 — Beta.8 arrival contracts and arrival-24 fixtures for the Travis CI, Neon, Postman collection key and Mailgun triplet families (redact-secret#773); closed 2026-09-25.
