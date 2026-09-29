---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: perplexity
families:
  - id: perplexity:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.perplexity.ai/docs/admin/api-key-management
      issues:
        - redact-secret/redact-secret-benchmarks#226
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#730
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-24
    blockedBy: null
---

# Perplexity

Perplexity issues API keys from the API console (`console.perplexity.ai/project/keys`,
project-scoped since 2025-04; earlier `perplexity.ai/settings/api` and
`/account/api`). Since 2026-04 a key is revealed once; before that the console
could show it again. Keys can be rotated through `generate_auth_token` and
`revoke_auth_token` (2025-09).

## Families

### `perplexity:api-key` — API key

- **Shape:** prefix `pplx-` followed by 48 letters and digits (53 in total). The
  provider's rotation docs show a `pplx-` value but with an obviously shortened
  body, and never state a length or alphabet. Gitleaks (2025-04) and osv-scalibr
  say exactly 48 alphanumeric; flare-redact allows 40 to 60; one redaction rule
  allows 10 or more with `_` and `-`. The official CLI validates only that a key is
  non-empty printable ASCII.
- **Sources:** T2. The prefix is provider documentation; the body is scanner rules.
  No provider staff statement on length was found.
- **Issuance:** not attempted; a project may need billing set up first. The console
  checklist is in benchmarks#226.
- **Collisions:** model ids (`pplx-7b-online`, `pplx-embed-v1-4b`), package and
  command names (`pplx-cli`, `pplx-api`), hostnames such as `pplx-res.cloudinary.com`
  and `*.pplx.app`, and an OpenRouter key stored under `PERPLEXITY_API_KEY`.
  GitGuardian marks the type "not prefixed", which contradicts the other sources.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (frozen in the #726 record, implemented under #730).
- **Open caveat:** The provider shows the pplx- prefix but no length or alphabet; the 48-character alphanumeric body is scanner-only and two of the scanners likely share lineage (checklist in benchmarks#226).

## Candidates that are not families yet

- **Analytics API key** (org-scoped, documented on the computer analytics page).
  Format not documented; may or may not use `pplx-`.
- **MCP OAuth access tokens.** Supported alongside a pasted Bearer key; shape unknown.

## Open questions

1. Did keys issued before 2025-04 (pplx-api era) or before 2026-04 differ in shape?
2. Does the key encode a project or group id?
3. Is anything beyond letters and digits ever present?
4. Env var names in use: `PERPLEXITY_API_KEY` (canonical), `PPLX_API_KEY`
   (LangChain and Perplexity's own cookbook), `PERPLEXITYAI_API_KEY` (LiteLLM).

## Research log

- redact-secret-benchmarks#226 — broad-discovery pass (2026-09-24). No format
  thread found on Reddit, Stack Overflow or Hacker News.
- redact-secret#726 — freeze of the Beta.8 contracts (wave 2, empirical route).
- redact-secret#730 — implementation of the second-wave families.
