---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: vercel
families:
  - id: vercel:access-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: vercel:personal-access-token
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/accounts/access-tokens
        - https://vercel.com/docs/rest-api/authentication/create-an-auth-token
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-27
    blockedBy: The vcp_ marker is provider-documented but no reviewed source states a body length, alphabet, checksum or boundary; the REST reference also shows an unprefixed 24-character bearer value beside vcp_ metadata.
  - id: vercel:integration-token
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-27
    blockedBy: Provider sources establish only the vci stem; whether the underscore is part of the value, and any body grammar, is undocumented.
  - id: vercel:app-access-token
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/sign-in-with-vercel/tokens
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-27
    blockedBy: The vca_ marker appears in one opaque provider example; no body grammar or boundary is documented.
  - id: vercel:app-refresh-token
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/sign-in-with-vercel/tokens
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-27
    blockedBy: The vcr_ marker reuses the app-access example body; no independent body observation or grammar is documented.
  - id: vercel:api-key
    research:
      verdict: not-found
      tier: T0
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys
        - https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/cli/test/unit/commands/ai-gateway/coding-agents-setup.test.ts
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-27
    blockedBy: The vck_ marker is confirmed by Vercel CLI code and docs; no reviewed source states a body length, alphabet or boundary.
---

# Vercel

Vercel's 2026-02-09
[changelog](https://vercel.com/changelog/new-token-formats-and-secret-scanning)
gave each credential type a prefix: `vcp` for personal access tokens, `vci`
for integration tokens, `vca` for app access tokens, `vcr` for app refresh
tokens and `vck` for API keys. The five classes are recorded as separate
families. The product's `vercel-token` detector reports all five under one
compatibility finding type; that shared type is not a research result for any of
them.

The research outcome for all five is the same one the #858 record calls
"pending, T0": the prefixes identify the class, and no provider-controlled
source states a body length, alphabet, checksum or boundary. The `not-found`
verdict here means the body grammar is not established; it does not mean the
prefix is unknown.

## Families

### `vercel:access-token` — Compatibility aggregate (unreviewed Vercel token shapes)

- **Sources:** not a credential family. Taxonomy keeps it as the routing row
  for the aggregate `vercel-token` detector, bounded by #858 and #373. It is
  left unresearched; its profile cells combine five implementation hypotheses
  and must not be read as evidence for any modern class.

### `vercel:personal-access-token` — Personal access token

- **Shape:** literal `vcp_` marker (Access tokens guide). Body unknown. The
  guide's masked filler is not a generated value.
- **Sources:** T1 on the marker only. The Create an Auth Token reference shows
  `token.prefix` as `vcp_` next to an unprefixed 24-character `bearerToken`
  example; the reference does not say whether that is legacy issuance, stale
  example data or a current class. #858 records the contradiction and does not
  use the example.
- **Collisions:** deployment, project, team, integration and client ids are
  sibling identifiers. An unprefixed 24-character value is not a valid
  positive or negative on that width alone.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (evidence-backed table: pending, T0).

### `vercel:integration-token` — Integration token

- **Shape:** the changelog prints only `vci`. The current detector's `vci_` is
  an implementation hypothesis: no provider-controlled page or code found by
  the #858 review prints a `vci_` value. Body unknown.
- **Sources:** provider changelog and the integration documentation page (class
  meaning only).
- **Current contract in core:** same pending, T0 row.

### `vercel:app-access-token` — App access token

- **Shape:** `vca_` appears in the Sign in with Vercel token examples, which
  call the format opaque. Body unknown.
- **Sources:** the two provider pages above; one shared example body.
- **Current contract in core:** same pending, T0 row.

### `vercel:app-refresh-token` — App refresh token

- **Shape:** `vcr_`, same page and same reused example body as `vca_`, so it is
  not a second body observation. Body unknown.
- **Current contract in core:** same pending, T0 row.

### `vercel:api-key` — API key

- **Shape:** `vck_`, appears in Vercel's public CLI unit-test fixtures for masking
  and labelling an AI Gateway API key (pinned permalink above). That establishes
  the marker only.
- **Current contract in core:** same pending, T0 row.

## Candidates that are not families yet

- **Unprefixed opaque credentials.** The REST `bearerToken` example and the
  OAuth integration code-exchange examples. Unsupported by a dedicated Vercel
  rule; issuance status unresolved. Contextual generic detection may report
  them.

## Open questions

1. Is the unprefixed 24-character `bearerToken` in the Create an Auth Token
   reference a legacy, stale or current value? #858 leaves it unresolved.
2. Is `_` part of a `vci` token? Needs a provider-controlled example.
3. What are the body length, alphabet and boundary of each class? A provider
   statement or a reviewed, promoted finding would unblock one class at a time
   (#858, handoff to #373).
4. Should `vercel:access-token` stay in the taxonomy once the five classes have
   their own contracts?

## Research log

- redact-secret#858 — splits the five classes and records them pending, T0;
  corrects #516 in three places (inferred `vci_`, a "conservative" 20-character
  floor, and a resolved unprefixed 24-character surface). Closed 2026-09-27.
- redact-secret-benchmarks#367 — 2026-09-26 source ledger that found the
  changelog and the REST contradiction.
- redact-secret-benchmarks#373 — benchmark counterpart, blocked on #858;
  closed 2026-09-27 with the classes split and no positive manufactured.
