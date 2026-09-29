---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: mistral
families:
  - id: mistral:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key
        - https://github.com/google/osv-scalibr/blob/110859bf0788ec406a93c1320f8d95c99ab60eea/veles/secrets/mistralapikey/detector.go
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/mistral.go
      issues:
        - redact-secret/redact-secret#781
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#868
        - redact-secret/redact-secret#866
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: No provider source states any shape; 32 alphanumeric rests on scanner rules that read as one assertion. Contextual only, never bare. Needs one issued Studio key (checklist in #781).
  - id: mistral:realtime-client-token
    research:
      verdict: issuance-gated
      tier: T1
      sources:
        - https://docs.mistral.ai/studio-api/audio/speech_to_text/realtime_transcription/client_auth
        - https://github.com/mistralai/client-python/blob/878fdda2ab8ad64439da729a9cfa23eb195dd73f/src/mistralai/client/models/clientsecret.py
      issues:
        - redact-secret/redact-secret#780
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: T1 covers the rt_ prefix and carriers only; no source states body length, alphabet or checksum. Needs hands-on minting via POST /v1/client/sessions (checklist in #780).
---

# Mistral

Mistral issues two credentials that matter here. A Studio (formerly La
Plateforme) API key is created in the console, shown once, workspace-scoped,
with optional expiry, and sent as `Authorization: Bearer`. A server can use it
to mint a short-lived realtime client token that a browser sends when opening
a realtime transcription WebSocket. Provider documentation:
[Studio API keys](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key),
[realtime client auth](https://docs.mistral.ai/studio-api/audio/speech_to_text/realtime_transcription/client_auth).
Whether and how core detects a family is not recorded here.

## Families

### `mistral:api-key` — Studio API key (unprefixed)

Taxonomy id `mistral:api-key` is the research name `mistral:studio-api-key`
(#781, epic #774). It is unambiguously the same credential: the core spec
table uses the research name and names detector `mistral-api-key`.

- **Shape:** no prefix; 32 alphanumeric characters `[A-Za-z0-9]`, recognised
  only beside Mistral context on the same line (a `mistral` key name, the
  `api.mistral.ai` host, a `Mistral(...)` call argument). Not stated by any
  provider source; the SDK model is a plain optional string with no
  validation.
- **Sources:** T2 at best, and #868 says no provider has T1 here. Three tool
  rules (osv-scalibr, betterleaks, pleno-dlp) agree on 32 alphanumeric with a
  mandatory keyword gate, but read as one repeated assertion, not three
  measurements. GitGuardian states "Prefixed: No" and no length. No pinned
  scanner (trufflehog 3.97.4, gitleaks 8.30.1) has a Mistral rule.
- **Issuance:** not attempted. Console "Create new key" with name and expiry;
  "may take a few minutes to be usable" per the console message; connector
  scope option. Codestral keys use a separate console tab; their shape is
  undocumented.
- **Collisions:** any 32-hex hash, request id or other vendor's 32-byte key
  near the word "mistral". The realtime token below is minted by this key and
  is a different shape. Model ids such as `mistral-large-latest` are benign.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Keyword-gated provider keys (#868).

### `mistral:realtime-client-token` — Realtime client token (rt_)

- **Shape:** prefix `rt_`; opaque body. Minted by `POST /v1/client/sessions`
  and returned as `client_secret.value`; the browser sends it in the
  `Sec-WebSocket-Protocol` header as `realtime, <token>`, which the page calls
  the only supported transport. Single-model scope and reusable until expiry.
  Stated lifetime is about 900 seconds, while the page's own example and
  search snippets suggest 60 seconds; the SDK exposes `ttl_seconds`, so treat
  lifetime as configurable and unresolved.
- **Sources:** T1 for the prefix and the two carriers (provider docs). The
  Python SDK types the value as a plain string. No scanner has an `rt_` rule.
  Body grammar: none.
- **Issuance:** not attempted. Needs a Studio key with the
  `create_client_session` permission; the #780 checklist records prefix case,
  lengths across mints, charset and whether `Bearer rt_` is accepted.
- **Collisions:** `rt_` is a common identifier prefix (`rt_config`,
  `rt_timeout`), so a bare-prefix rule would be imprecise. Not the Studio key.
- **Current contract in core:** none recorded; #780 concluded pending, no
  implementation. Keyed environment and `Bearer` contexts fall to generic
  paths; the JSON and WebSocket carriers were measured as uncovered and
  framed as a generic-carrier question, not a Mistral family.

## Candidates that are not families yet

- **Codestral keys** (`CODESTRAL_API_KEY`, `codestral.mistral.ai`): whether
  they share the Studio shape is undocumented.

## Open questions

1. **Studio key shape.** Is it always 32 alphanumeric, and did pre-workspace
   keys differ? One issued key would settle it (#781 checklist).
2. **Verdict history.** #781 and #868 both say generic coverage is enough or
   no T1 exists, yet the family was landed as a contextual T2 row and is
   `provisional` in the benchmarks ledger (#774 close-out). This dossier
   records the landed state; a maintainer may prefer `rejected`.
3. **Realtime token body.** Length, alphabet and checksum are unknown until a
   token is minted.
4. **Lifetime.** 900 versus 60 seconds is unresolved doc drift.
5. **Bearer acceptance.** Does the realtime endpoint accept `Bearer rt_`?
6. **Reddit.** Blocked in both passes; absence there is not evidence.

## Research log

- redact-secret#780 — realtime client token discovery; disposition pending,
  no implementation (2026-09-27).
- redact-secret#781 — Studio key discovery; disposition generic coverage
  sufficient, T2 at best.
- redact-secret#868 — keyword-gated coverage landed for Mistral, Cohere, AI21,
  Deepgram; Exa did not land.
- redact-secret#866 — generic-token SDK-call-argument gap, measured in #781.
- redact-secret#774 — Beta.10 epic; close-out lists `mistral-api-key` as
  provisional T2 and #780 as pending.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384e.ts`); redact-secret-benchmarks#177 defines the
  empirical path to `stable` for T2 families.
