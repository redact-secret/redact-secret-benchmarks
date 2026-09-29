---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: deepgram
families:
  - id: deepgram:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://developers.deepgram.com/guides/fundamentals/authenticating
        - https://github.com/trufflesecurity/trufflehog/blob/363923b901c911a9164f50b6c423f47c15372b1c/pkg/detectors/deepgram/deepgram.go
      issues:
        - redact-secret/redact-secret#789
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#868
        - redact-secret/redact-secret#932
        - redact-secret/redact-secret#936
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: null
---

# Deepgram

Deepgram issues project API keys from the console (Settings, API Keys) and
through a management API, permanent or expiring, shown once. Requests send
`Authorization: Token <key>`, not `Bearer`. The `/v1/auth/grant` endpoint
returns a separate short-lived access token that is a JWT (30 second default),
sent as `Bearer`. The SDK reads `DEEPGRAM_API_KEY`. Provider documentation:
[authenticating](https://developers.deepgram.com/guides/fundamentals/authenticating).
Whether and how core detects a family is not recorded here.

## Families

### `deepgram:api-key` — API key (unprefixed)

- **Shape:** no prefix; 40 characters, lowercase hexadecimal in the benchmark
  taxonomy and `[0-9a-z]` in core's spec (see Open questions), recognised only
  beside a same-line Deepgram name, host or SDK constructor. Never a bare
  40-character run (a Git SHA-1 has the same shape). Length and alphabet are
  not provider-stated.
- **Sources:** T2 at best; #868 records no provider T1. The docs' create-key
  example shows 32 ascending hex digits for both `key` and `api_key_id`, which
  reads as a placeholder and conflicts with every other source, pointing to 40.
  trufflehog (`[0-9a-z]{40}`, keyword `deepgram`) and betterleaks (`[a-f0-9]{40}`,
  entropy filter; Kingfisher aliases it) agree on length and disagree on
  alphabet. A GitHub discussion user reports a working 40-character key, and
  one archived Reddit post held three 40-hex runs. GitGuardian says
  "Prefixed: No" with no length. gitleaks, noseyparker, secretlint and
  osv-scalibr have no rule.
- **Issuance:** not attempted. The #789 checklist records total length (32
  versus 40), charset class, a second key, the shape of the visible key id, an
  expiring or temporary key, and the grant JWT structure.
- **Collisions:** `api_key_id` uses the same example shape as `key`, so a
  stored key id is a lookalike. Project ids and request ids are UUIDs. The
  grant `access_token` is a JWT, a different credential.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Keyword-gated provider keys (#868). The spec keeps `[0-9a-z]{40}`,
  the wider of the two tools. #932 recognised the HTTPie `Authorization:Token`
  and Go `deepgram.NewRESTWithDefaults` forms, and #936 made the `Token`
  header high confidence when the line names a Deepgram API host.
- **Open caveat:** No provider source states length or alphabet; the docs example is a 32-hex placeholder that contradicts the observed 40. Hex versus base36 is disputed between tools. Needs one issued key (checklist in #789).

## Candidates that are not families yet

- **Temporary API keys** (250 per day): mentioned in the docs with no format.
- **Legacy 32-character keys:** a hypothesis that keys were 32 before some
  date would explain the docs example; nothing found supports it.

## Open questions

1. **Alphabet.** Lowercase hex, or `[0-9a-z]`? The spec follows the wider
   trufflehog class; betterleaks and one Reddit observation say hex.
2. **Length.** Is 40 universal, and do 32-character keys exist?
3. **Verdict history.** #789 concluded generic coverage sufficient, pending T1
   evidence; #868 landed a contextual T2 row, kept `provisional` in the
   benchmarks ledger with remaining `createClient` and WebSocket misses
   (#774 close-out). This dossier records the landed state. Benchmarks#384's
   [2026-09-27 scope comment](https://github.com/redact-secret/redact-secret-benchmarks/issues/384#issuecomment-5852472147)
   records the maintainer direction to author contracts and corpus for the
   keyword-gated contextual rows (Mistral, Cohere, AI21, Exa, Deepgram), so
   the maintainer treats these rows as live, not `rejected`.
4. **Staff answer.** The community forum staff thread on short-lived keys was
   not readable.
5. **Kingfisher.** Its native rule directory was not located.

## Research log

- redact-secret#789 — discovery pass; disposition generic coverage sufficient,
  T2 ceiling.
- redact-secret#868 — keyword-gated coverage landed for Deepgram among five.
- redact-secret#932 — same-line context forms the gate did not recognise.
- redact-secret#936 — keyword co-occurrence policy reference; Deepgram `Token`
  header high confidence under a provider host.
- redact-secret#774 — Beta.10 epic close-out; `deepgram-api-key` provisional
  T2.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384e.ts`); redact-secret-benchmarks#177 defines the
  empirical path to `stable`.
