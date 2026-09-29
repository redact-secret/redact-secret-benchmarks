---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: tavily
families:
  - id: tavily:api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.tavily.com/documentation/api-reference/introduction
        - https://docs.tavily.com/documentation/enterprise/generate-keys
        - https://github.com/praetorian-inc/noseyparker/blob/17e2b1380cd3fc36968a86295aa4490fd1baab03/crates/noseyparker/data/default/builtin/rules/tavily.yml
      issues:
        - redact-secret/redact-secret#786
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#867
        - redact-secret/redact-secret-benchmarks#384
      evidence: null
      researchedAt: 2026-09-27
    blockedBy: T1 is the tvly- prefix only; the 32-alphanumeric body is T2 (one scanner rule, three observed samples). Needs one issued development key; tvly-prod- and production width open (checklist in #786).
---

# Tavily

Tavily issues API keys from `app.tavily.com`, sent as `Authorization: Bearer`,
in a JSON body field `api_key`, or in a remote-MCP `tavilyApiKey` query
parameter. Key types are development (default) and production, plus
enterprise-generated expiring keys. Provider documentation:
[API reference](https://docs.tavily.com/documentation/api-reference/introduction),
[generate keys](https://docs.tavily.com/documentation/enterprise/generate-keys).
Whether and how core detects a family is not recorded here.

## Families

### `tavily:api-key` — API key (tvly-)

- **Shape:** `tvly-`, an optional `dev-` segment, then 32 alphanumeric
  characters `[A-Za-z0-9]`. Pre-2025 samples have no `dev-`; 2025 samples and
  the docs' truncated examples do. Whether `tvly-prod-` exists and the width of
  production and enterprise key bodies are unresolved (a third-party page says
  production keys begin plain `tvly-`).
- **Sources:** the spec and #867 record prefix T1, body T2 (the tier field
  above follows that, see Open questions). Provider docs show `tvly-` only in a placeholder (`Bearer tvly-YOUR_API_KEY`) and `tvly-dev-`
  in truncated samples, with no length or alphabet; the SDKs do no validation.
  The 32-character body rests on the noseyparker rule, which predates `dev-`
  and so misses it, and three observed samples. GitGuardian confirms
  "Prefixed" and states no length. No pinned scanner has a Tavily rule.
- **Issuance:** not attempted. The #786 checklist covers one development key
  (prefix, body width, charset), a production key if available, and masked
  display.
- **Collisions:** the `tvly` command-line tool, key names such as
  `development-...-#1`, `request_id` values and the doc placeholder are benign.
  `Bearer tvly-YOUR_API_KEY` was a `bearer-token` false alarm fixed by #870 (Beta.10 epic #774).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md),
  section Together AI and Tavily (#867). `tvly-prod-` and other widths stay
  unclaimed.

## Candidates that are not families yet

- **`tvly-prod-`:** no example anywhere; the `{key_type}-{expiration}-#{index}`
  string in the docs is a key name, not a secret.

## Open questions

1. **Production keys.** Prefix and width; enterprise expiring-key body width.
2. **Alphabet.** Are `-` or `_` ever in the body? Only alphanumerics were seen.
3. **Tier wording.** #786 and the spec say prefix T1, body T2; the #774
   close-out table and the benchmarks ledger say T2 (empirical, stable). This
   dossier uses T1 for the prefix as the brief directs and keeps the split here.
4. **Forum evidence.** No Tavily forum or staff statement was located.

## Research log

- redact-secret#786 — discovery pass; disposition distinct family, pending T2
  corroboration; final comment: T2 (prefix T1).
- redact-secret#867 — implementation for Together AI and Tavily.
- redact-secret#774 — Beta.10 epic close-out; `tavily-api-key` stable,
  T2 empirical.
- redact-secret-benchmarks#384 — benchmarks counterpart (contract in
  `benchmarks/lib/beta8/384d.ts`); redact-secret-benchmarks#177 defines the
  empirical path to `stable`.
