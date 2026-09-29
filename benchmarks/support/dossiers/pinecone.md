---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: pinecone
families:
  - id: pinecone:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.pinecone.io/reference/api/2026-04/admin/create_api_key
        - https://docs.pinecone.io/reference/api/authentication
      issues:
        - redact-secret/redact-secret-benchmarks#228
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#730
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: Provider docs contradict the observed prefix (pckey_ vs pcsk_) and give no widths; the prefix is provider code, the 5-6 and 63 character widths are tool-only (checklist in benchmarks#228).
  - id: pinecone:legacy-api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.pinecone.io/reference/api/authentication
      issues:
        - redact-secret/redact-secret-benchmarks#228
        - redact-secret/redact-secret-benchmarks#253
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#702
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-25
    blockedBy: No provider source states the UUID shape (unpinned tools only) and no new legacy key can be issued; it is claimable only beside a Pinecone API-key name, never as a bare value.
---

# Pinecone

Pinecone is a managed vector database. API keys are project-scoped, created in
the console under a project's API keys page (shown once), sent in the `Api-Key`
header and read from `PINECONE_API_KEY`. Organizations can also create service
accounts, whose client id and secret are a separate credential exchanged for an
Admin API bearer token.

## Families

### `pinecone:api-key` — API key (`pcsk_`)

- **Shape:** prefix `pcsk_`, then a public label of 5 or 6 letters and digits, `_`,
  and a 63-character letters-and-digits secret (74 or 75 in total). The prefix comes
  from Pinecone's CLI and SDK code and tests; the segment widths come from
  scanner rules (TruffleHog and others). The Admin API docs instead say new
  keys are `pckey_<public-label>_<unique-key>`, and no scanner, sample or report
  shows a `pckey_` value. The switch from UUID keys to `pcsk_` is undated.
- **Sources:** T2. Provider code (CLI help text, SDK tests) for the prefix; scanner
  rules for widths. The `pckey_` text is provider documentation and is unresolved,
  not a negative.
- **Issuance:** not attempted. The free Starter plan issues keys with permissions
  fixed at All. A key made through the Admin API would test `pckey_` (needs a
  service account).
- **Collisions:** service account `client_id` (32 alphanumeric) and `client_secret`
  (about 64 characters of letters, digits, `-`, `_`; no prefix) are other
  credentials. UUIDs everywhere (key, project, service account and organization ids)
  are public. Masked forms: `pcsk***` plus four characters (CLI) and `...` plus four
  (Python `repr`). Index hosts and `PINECONE_ENVIRONMENT` strings are public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record, implemented under #730).

### `pinecone:legacy-api-key` — Legacy API key (bare UUID)

- **Shape:** a lowercase `8-4-4-4-12` hex UUID, used before the `pcsk_` form and
  paired with an `environment`. Only betterleaks, Kingfisher and GitGuardian
  describe it; none is pinned, and no provider source states it. It is lexically
  identical to Pinecone key, project and service-account ids.
- **Sources:** T2, tools only. The authentication page documents the `Api-Key`
  header and `PINECONE_API_KEY` but not the shape.
- **Issuance:** not possible to test; nothing indicates the console still issues UUID
  keys, and whether they still authenticate is unknown.
- **Collisions:** every other UUID in Pinecone output. A UUID under an id-named key
  (`PINECONE_PROJECT_ID`, `X-Project-Id`, `indexId`) is not a key.
- **Current contract in core:** a legacy UUID is claimed only when it is the value
  assigned to a Pinecone API-key name on the same line (accepted 2026-09-24
  decision, linked from [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md));
  a bare UUID stays unclaimed. Issue #702 raised the question for this family.

## Candidates that are not families yet

- **Service account client id and secret**, and the Admin API `access_token` from
  `login.pinecone.io`. Documented, no prefix; a separate family if taken up.
- **`pckey_<label>_<key>`.** Documented by the Admin API, never observed.

## Open questions

1. Why does the Admin API spec say `pckey_` while every observation says `pcsk_`?
2. Is the 5-6 character label shown separately in the console or API?
3. Is the secret body strictly alphanumeric (a looser rule allows `_`)?
4. Do legacy UUID keys still authenticate, and when did Pinecone stop issuing them?

## Research log

- redact-secret-benchmarks#228 — broad-discovery pass (2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts; legacy UUID named as a
  separate context-only candidate.
- redact-secret#730 — implementation of the second-wave families.
- redact-secret#702 — provider-named assignments and context-gated families; drove
  the legacy UUID ruling.
- redact-secret-benchmarks#253 — updated the recorded reason for the legacy family
  after redact-secret#766.
