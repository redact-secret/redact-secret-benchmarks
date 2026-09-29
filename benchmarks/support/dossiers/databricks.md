---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: databricks
families:
  - id: databricks:personal-access-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.databricks.com/aws/en/dev-tools/auth/pat
        - https://learn.microsoft.com/en-us/purview/sit-defn-azure-databricks-personal-access-token
      issues:
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret#697
        - redact-secret/redact-secret#698
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-25
    blockedBy: null
---

# Databricks

Databricks personal access tokens authenticate REST and CLI calls to a
workspace through `Authorization: Bearer`, the `DATABRICKS_TOKEN` variable or a
`token =` line in `.databrickscfg`, as the provider's
[PAT page](https://docs.databricks.com/aws/en/dev-tools/auth/pat) shows. That
page uses `<token>`-style placeholders only. The family was one of the Beta.7
candidates ranked in #582.

## Families

### `databricks:personal-access-token` — Personal access token

- **Shape:** `dapi` followed by 32 lowercase hex characters, optionally followed
  by `-` and a digit after rotation. The suffix rests on four scanner rules only
  and its meaning, digit count and even existence differ across them; since
  2026-09-24 it is outside the benchmark's claim. Uppercase hex is treated as an
  intentional false negative.
- **Sources:** T2. No provider prose states any of the grammar (#582 fetched the
  AWS and Azure PAT pages). gitleaks, trufflehog and Nosey Parker agree on
  `dapi` + 32 lowercase hex. Microsoft Purview's entity page gives only a
  32-character length, admits `A-F`, and its own example contradicts its
  pattern. GitHub's partner list has 12 Databricks secret types; this family
  covers `dapi` only.
- **Issuance:** not attempted; measuring case and suffix needs one issued token
  (#697).
- **Collisions:** workspace hostnames (`dbc-...`, `adb-...`) and the `token_id`
  returned beside `token_value` are public. OAuth client secrets are a separately
  documented scope extension, not this family.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`databricks_personal_access_token`, always redacted; the prefix makes it
  bare-detectable).
- **Open caveat:** No Databricks page states the dapi prefix, length or alphabet; uppercase hex and the optional -<digit> suffix are disputed between sources. Needs one issued token (recorded in #697).

## Candidates that are not families yet

- **Other Databricks secret types** (OAuth client secrets and the rest of the
  12 listed by GitHub). No shape research.

## Open questions

1. Can a real token contain `A-F`? Record yes or no only (#697).
2. What is the `-<digit>` suffix, if it exists? Digit count and semantics differ
   across tools.
3. Does a provider page ever state the prefix, length or alphabet?

## Research log

- redact-secret#582 — Beta.7 ranking; the evidence record shows the provider
  documentation is silent on format (2026-09-23) and includes the Databricks
  broad-discovery pass.
- redact-secret#698 — suffix digit-count dispute between sources (closed 2026-09-25 with no comment; no provider source found).
- redact-secret#697 — records the uppercase-hex dispute for this family and
  Mailchimp; closed 2026-09-25 without a real-key check.
