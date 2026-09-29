---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: groq
families:
  - id: groq:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://console.groq.com/docs/production-readiness/security-onboarding
        - https://github.com/trufflesecurity/trufflehog/blob/363923b901c911a9164f50b6c423f47c15372b1c/pkg/detectors/groq/groq.go
      issues:
        - redact-secret/redact-secret-benchmarks#218
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#727
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: No provider source states length or alphabet; the 52-character body is tool-corroborated plus a four-sample maintainer observation (checklist in benchmarks#218).
---

# Groq

Groq (GroqCloud) serves LLM inference through an OpenAI-compatible API. The
only credential documented is the API key, created at `console.groq.com/keys`
and scoped to a project. Not to be confused with xAI's Grok (`xai:api-key`).

## Families

### `groq:api-key` — API key

- **Shape:** prefix `gsk_` followed by 52 letters and digits (56 in total). The
  provider pages show the prefix only as a placeholder and state no length or
  alphabet. TruffleHog (since 2024-05), secretlint, betterleaks and noseyparker
  agree on 52; a gitleaks proposal and blogs that copy it say 48 with no
  primary source. A four-sample maintainer observation of public `.env` files
  found an internal `WGdyb3FY` segment at body offsets 20 to 27; it is
  unconfirmed and is not a grammar requirement.
- **Sources:** T2. Provider docs and the Python SDK give the prefix, env var
  (`GROQ_API_KEY`) and Bearer header, and the SDK validates nothing. Body: scanner
  rules and the observation report, so the body claim is empirical.
- **Issuance:** not attempted; needs a GroqCloud account. The console checklist is
  in benchmarks#218.
- **Collisions:** xAI `xai-` keys (the `GROK_API_KEY` vs `GROQ_API_KEY` mix-up is
  seen in the wild). Groq response ids (`chatcmpl-`, `req_`, `file_`, `batch_`)
  are public. `gsk_` also occurs in unrelated identifiers, so the prefix alone
  is weak.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record; the internal segment is not required).

## Candidates that are not families yet

- **Base64-encoded key.** GitHub secret scanning lists a base64 form; no
  Groq-specific grammar for it was recorded.
- **Older key "versions".** GitHub's pattern table hints at more than one
  version; the older shape is unknown.

## Open questions

1. Is `WGdyb3FY` present in every key (all projects, all dates)?
2. Do keys issued before Projects existed differ in shape?
3. Is there a checksum? None was observed or documented.
4. What are GitHub's "token versions" for this type?

## Research log

- redact-secret-benchmarks#218 — broad-discovery pass (2026-09-24). No provider
  staff statement found; the forum is retired.
- redact-secret#727 — implementation of the committed AI inference credential families for Beta.8 (closed 2026-09-24).
- redact-secret#726 — freeze of the Beta.8 contracts (this family: 52
  alphanumeric, empirical route).
