---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: cohere
families:
  - id: cohere:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.cohere.com/docs/rate-limits
        - https://github.com/gitleaks/gitleaks/blob/83d9cd684c87d95d656c1458ef04895a7f1cbd8e/config/gitleaks.toml
      issues:
        - redact-secret/redact-secret#782
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#868
        - redact-secret/redact-secret#932
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: No provider source states any shape; 40 alphanumeric is one gitleaks rule's inference, so contextual only. Needs one trial and one production key measured (checklist in #782).
---

# Cohere

Cohere issues API keys from its dashboard. There are two entitlements, a free
evaluation (trial) key and a paid production key, both created on the same API
keys page, shown once, and sent as `Authorization: Bearer`. The SDK reads
`CO_API_KEY` and also accepts `COHERE_API_KEY`. Provider documentation:
[rate limits and key types](https://docs.cohere.com/docs/rate-limits).
Whether and how core detects a family is not recorded here.

## Families

### `cohere:api-key` — API key (unprefixed)

Taxonomy id `cohere:api-key` is the research name `cohere:production-api-key`
(#782, epic #774). The mapping is unambiguous: #782 found no source that
distinguishes a production key from a trial key by shape, so the research
premise of a separate production shape is unsupported and one family covers
both. The core spec table also uses `cohere:api-key`.

- **Shape:** no documented prefix; 40 alphanumeric characters
  `[A-Za-z0-9]`, recognised only beside a same-line `cohere` name, `CO_API_KEY`,
  the API host or an SDK constructor. Never a bare 40-character run. The
  length is not provider-stated.
- **Sources:** T2 at best; #868 records that no provider has T1 here. One
  gitleaks rule (`cohere-api-token`, keyword then `[a-zA-Z0-9]{40}`) is the
  only length source. GitGuardian says "Prefixed: False" with no length. The
  SDK does no validation. GitHub secret scanning lists a Cohere pattern
  without publishing it. A vendor blog claims a `co-` prefix; it contradicts
  both scanners, has no example and no second source, and was not adopted.
- **Issuance:** not attempted. Dashboard API keys page, key names cannot
  contain spaces, shown once, revocable in the web UI or CLI. The #782
  checklist compares a trial and a production key.
- **Collisions:** SHA-1-length hex and random ids, `org_` and `user_` ids
  from the check-api-key response, and unrelated `co-` strings.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Keyword-gated provider keys (#868). #932 recognised the Java
  `Cohere.builder().token(...)` form; a `masked_`-led LiteLLM log value stays
  unreported by policy.

## Candidates that are not families yet

- **`co-` prefixed keys:** one vendor blog only; recorded so nobody adopts it.

## Open questions

1. **Exact length.** Is it always 40, and does any trial versus production
   difference exist? The #782 checklist answers both with two issued keys.
2. **TruffleHog.** The probe was inconclusive (file 404, local 3.97.6 binary,
   not the 3.97.4 pin); betterleaks, noseyparker, secretlint and Kingfisher
   were not checked.
3. **Verdict history.** #782 concluded generic coverage sufficient; #868
   landed a contextual T2 row, which the benchmarks ledger keeps `provisional`
   (#774 close-out). This dossier records the landed state. Benchmarks#384's
   [2026-09-27 scope comment](https://github.com/redact-secret/redact-secret-benchmarks/issues/384#issuecomment-5852472147)
   records the maintainer direction to author contracts and corpus for the
   keyword-gated contextual rows (Mistral, Cohere, AI21, Exa, Deepgram), so
   the maintainer treats these rows as live, not `rejected`.
4. **Reddit and Stack Overflow.** Not effectively searched.

## Research log

- redact-secret#782 — discovery pass; disposition generic coverage sufficient,
  no T1, T2 at most as a context contract.
- redact-secret#868 — keyword-gated coverage landed for Cohere among five.
- redact-secret#932 — same-line context forms (Java builder token, Go and
  HTTPie forms for Deepgram) the gate did not recognise.
- redact-secret#774 — Beta.10 epic close-out; `cohere-api-key` provisional T2.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384e.ts`); redact-secret-benchmarks#177 defines the
  empirical path to `stable`.
