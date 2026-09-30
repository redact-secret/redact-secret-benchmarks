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
        - https://github.com/mistralai/platform-docs-public/blob/ecac75b617af32e87a6d59c5d9e39e7029fc35db/openapi-public-doc.yaml#L33436-L33455
        - https://github.com/gitkraken/vscode-gitlens/blob/6492b560fd704d62fc6e0bd4f86c4daa06a4d8e1/packages/plus/ai/src/providers/mistralProvider.ts#L156-L159
      issues:
        - redact-secret/redact-secret#781
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#868
        - redact-secret/redact-secret#866
        - redact-secret/redact-secret#1013
        - redact-secret/redact-secret-benchmarks#384
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/mistral-api-key.md
      researchedAt: 2026-09-29
    blockedBy: null
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
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/mistral-realtime-client-token.md
      researchedAt: 2026-09-29
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
  `api.mistral.ai` host, a `Mistral(...)` call argument). Not stated in
  provider prose, and the SDK model is a plain optional string with no
  validation, but Mistral's own Admin API OpenAPI schema (`APIKeyExtendedOUT`,
  2026-07-24) shows one full-length example key of exactly that shape.
- **Sources:** T2 at best, and #868 says no provider has T1 here. Three tool
  rules (osv-scalibr, betterleaks, pleno-dlp) agree on 32 alphanumeric with a
  mandatory keyword gate, but read as one repeated assertion, not three
  measurements. The redact-secret#1013 pass added the missing second class
  twice: the provider example above, and three independent client validators
  (GitLens since 2025-05-27, GPTPortal, NeuroLink) that accept exactly
  `^[A-Za-z0-9]{32}$`. That is 7 references, 7 owners and 3 non-summary
  classes, recorded in `empirical-observations.json`. GitGuardian states
  "Prefixed: No" for this detector but lists a second, prefixed
  "Mistral AI API Key v2" with an undisclosed prefix; no Mistral source
  mentions one, and the contract bounds it out. No pinned scanner
  (trufflehog 3.97.4, gitleaks 8.30.1) has a Mistral rule.
- **Issuance:** not attempted. Console "Create new key" with name and expiry;
  "may take a few minutes to be usable" per the console message; connector
  scope option. Codestral keys use a separate console tab; their shape is
  undocumented.
- **Collisions:** any 32-hex hash, request id or other vendor's 32-byte key
  near the word "mistral". The realtime token below is minted by this key and
  is a different shape. Model ids such as `mistral-large-latest` are benign.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Keyword-gated provider keys (#868).
- **Open caveat:** No provider prose states a shape; 32 alphanumeric rests on one provider API example, independent validators and scanner rules, so T2, never T1. Contextual only, never bare. The remaining gates are two product false negatives, not evidence: the Kubernetes `name:`/`value:` pair (redact-secret#1016) and the Python subscript assignment `os.environ["MISTRAL_API_KEY"] = "…"` (redact-secret#1038). One issued Studio key would still settle whether a prefixed "v2" key exists.

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
   records the landed state. Benchmarks#384's
   [2026-09-27 scope comment](https://github.com/redact-secret/redact-secret-benchmarks/issues/384#issuecomment-5852472147)
   records the maintainer direction to author contracts and corpus for the
   keyword-gated contextual rows (Mistral, Cohere, AI21, Exa, Deepgram), so
   the maintainer treats these rows as live, not `rejected`.
3. **Realtime token body.** Length, alphabet and checksum are unknown until a
   token is minted.
4. **Lifetime.** 900 versus 60 seconds is unresolved doc drift.
5. **Bearer acceptance.** Does the realtime endpoint accept `Bearer rt_`?
6. **Reddit.** Blocked in both passes; absence there is not evidence.

## Research log

- redact-secret#1013 — 2026-09-29 record for the realtime token
  ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/mistral-realtime-client-token.md)):
  STILL-BLOCKED, issuance only; no public source can state the length, alphabet or separators. Check: mint two or more
  tokens via `POST /v1/client/sessions`, record total length and whether it is constant, the body alphabet (hex,
  base62 or base64url), any `_`, `-` or `.`, and whether `Bearer rt_...` is accepted; then revoke.
- redact-secret#1013 — 2026-09-29 T1/T2 pass ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/mistral-api-key.md)): Studio key
  READY-T2 (provider example + independent validators); realtime token still
  issuance-only.
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
