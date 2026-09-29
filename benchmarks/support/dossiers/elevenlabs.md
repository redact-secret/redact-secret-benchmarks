---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: elevenlabs
families:
  - id: elevenlabs:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://github.com/elevenlabs/elevenlabs-python/blob/1b45413e916fda868341ad48225c4b7211017849/src/elevenlabs/speech_engine/server.py
        - https://github.com/elevenlabs/elevenlabs-python/blob/fd6d5c29f7d22402420c17b27968f9c861f1b394/src/elevenlabs/speech_engine/resource.py
        - https://github.com/elevenlabs/elevenlabs-js/blob/a46177b4888e542efa8ae2ae3b6bd68b6a0979f4/src/wrapper/speech-engine/SpeechEngineResource.ts
        - https://elevenlabs.io/docs/api-reference/authentication
      issues:
        - redact-secret/redact-secret#788
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#865
        - redact-secret/redact-secret#866
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: T1 covers the sk_ prefix and _residency_ suffix (SDK code, by ruling); the 48-lowercase-hex body is T2 with no provider statement. The legacy 32-hex form is unresearched; needs issued keys (checklist in #788).
---

# ElevenLabs

ElevenLabs issues API keys from `elevenlabs.io/app/developers/api-keys`: user
keys (optional expiry of 15 minutes to 30 days) and service-account keys (no
expiry). A key is sent in the `xi-api-key` header, shown once, and can be
restricted by scope, credit quota and IP. Isolated data-residency
environments (EU, India, Singapore) use a different API host and a different
key. ElevenLabs states it takes part in GitHub's secret scanning partner
program, but GitHub's public pattern page lists no ElevenLabs row. Provider
documentation: [authentication](https://elevenlabs.io/docs/api-reference/authentication).
Whether and how core detects a family is not recorded here.

## Families

### `elevenlabs:api-key` — API key (sk_)

- **Shape:** `sk_` followed by 48 lowercase hexadecimal characters (51 in
  all), with an optional `_residency_<region>` suffix matching
  `_residency_[a-z0-9]+` (regions seen: `in`, `eu`). The suffix belongs to the
  key, so a residency key is redacted whole. Body length and alphabet are
  stated by no provider source.
- **Sources:** T1 by maintainer ruling of 2026-09-27, on provider SDK code
  (the `huggingface:api-token` precedent): a docstring `api_key="sk_..."` in
  `speech_engine/server.py`, and `_RESIDENCY_KEY_SUFFIX` in `resource.py` and
  the JS `SpeechEngineResource.ts`. The docs pages state neither prefix nor
  length. The body is T2: trufflehog v2, betterleaks (Kingfisher aliases it)
  and about 35 code-search fragments, all 48 lowercase hex where fully formed.
- **Issuance:** not attempted. The #788 checklist covers user and
  service-account keys, an isolated-environment key and its suffix, the
  displayed `hint`, and whether an old account still holds a 32-hex key.
- **Collisions:** `sk_` is shared with Stripe (`sk_live_`, `sk_test_`,
  `sk_org_`) and with a planned Pollinations `sk_` plus 32 characters
  key, so the prefix alone cannot attribute a key. The response fields
  `key_id`, `hint` and `hashed_xi_api_key` are non-secret; so are voice ids.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md);
  the spec row records the T1 ruling and the T2 body. #866 covers the
  single-line SDK-argument form generically.

## Candidates that are not families yet

- **Legacy 32-hex keys:** matched by trufflehog v1 only when beside a
  keyword; no provider source documents them. GitGuardian's "Prefixed: No"
  may refer to this form. Not claimed bare.
- **Single-use tokens** for client-side use: a separate credential, no shape
  documented.

## Open questions

1. **Suffix body.** Does a residency key share the 48-hex base? Does `sg`
   exist as a region code?
2. **Legacy form.** Are 32-hex keys still valid, and when did `sk_` start?
   No source dates the change.
3. **GitHub partner status.** ElevenLabs claims it; GitHub's page shows no
   row. Unresolved.
4. **Service-account shape.** Same as a user key? The checklist asks.
5. **Search debts.** The help center returned 403, and a legacy 32-hex code
   search was rate-limited before completing.

## Research log

- redact-secret#788 — discovery pass (Reddit via the Pullpush archive), the
  T1 ruling of 2026-09-27 on SDK code, and the disposition.
- redact-secret#865 — implementation (`sk_` plus hex, residency suffix).
- redact-secret#866 — generic-token SDK-call gap, measured for this family.
- redact-secret#774 — Beta.10 epic close-out; stable at T1 in the benchmarks
  run.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384c.ts`); it also names the ElevenLabs corpus work.
