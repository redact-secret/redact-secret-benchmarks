---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: anthropic
families:
  - id: anthropic:secret-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://platform.claude.com/docs/en/manage-claude/compliance-api-access
      issues:
        - redact-secret/redact-secret#642
      evidence: https://github.com/redact-secret/redact-secret/blob/0a35cc713feb77419e40436bcfd083f9078c2cb8/docs/audits/evidence/642/README.md
      researchedAt: 2026-09-23
    blockedBy: null
  - id: anthropic:compliance-access-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://platform.claude.com/docs/en/manage-claude/compliance-api-access
        - https://platform.claude.com/docs/en/manage-claude/admin-api-keys
        - https://platform.claude.com/docs/en/manage-claude/compliance-activity-feed
        - https://support.claude.com/en/articles/13015708-access-the-compliance-api
      issues:
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#776
        - redact-secret/redact-secret#862
      evidence: null
      researchedAt: 2026-09-26
    blockedBy: Body length, alphabet and tail are unmeasured for this prefix; needs one issued Enterprise key (checklist in #776).
  - id: anthropic:admin-api-key
    research:
      verdict: ready
      tier: T1
      sources:
        - https://platform.claude.com/docs/en/manage-claude/admin-api-keys
        - https://platform.claude.com/docs/en/manage-claude/admin-api
        - https://platform.claude.com/docs/en/manage-claude/compliance-api-access
      issues:
        - redact-secret/redact-secret#774
        - redact-secret/redact-secret#775
        - redact-secret/redact-secret#862
      evidence: null
      researchedAt: 2026-09-26
    blockedBy: Body grammar is scanner-corroborated only (T2); confirming it needs one issued Console admin key (checklist in #775).
---

# Anthropic

Anthropic issues API credentials from two places. The Claude Console issues
Claude API keys and Admin API keys. The claude.ai Enterprise organization
settings issue Enterprise organization keys (documented by Anthropic as the
"Compliance Access Key"). All three share the `sk-ant-` namespace and are told
apart by the segment after it, so the prefix segment is the discriminator.
Provider documentation: [admin API keys](https://platform.claude.com/docs/en/manage-claude/admin-api-keys),
[compliance API access](https://platform.claude.com/docs/en/manage-claude/compliance-api-access).

Verdicts here record research on the shape (prefix, body, sources). The
tier is T1 for the prefix only in all three families; the body grammar is a
separate, weaker claim spelled out per family. Whether and how core detects a
family is not recorded here.

## Families

### `anthropic:secret-api-key` — Secret API key

- **Shape:** prefix `sk-ant-api03-` (Claude API key, created under Claude
  Console > Settings > API keys). Body: 93 characters from letters, digits,
  underscore and hyphen, then the two characters `AA`, about 108 characters in
  all. The body, alphabet and tail are tool-corroborated, not provider-stated.
- **Sources:** T1 for the prefix (provider table quoted in the #642 evidence).
  Body grammar: scanner rules (gitleaks, trufflehog) per the #642 record and
  the #775 discovery pass; gitleaks and its fork betterleaks share a lineage,
  so that pair counts as one corroboration.
- **Issuance:** not attempted. A key can be created in the Console; no sample
  was minted for this research.
- **Collisions:** the `api01` and `admin01` siblings below differ by one
  segment. The bare `sk-` vendor-prefix path of a generic token rule is
  designed not to claim the `sk-ant-` namespace.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md);
  final evidence in the #642 record linked in the frontmatter.

### `anthropic:compliance-access-key` — Enterprise organization key (sk-ant-api01-)

- **Shape:** prefix `sk-ant-api01-`, created in claude.ai Organization
  settings > API, shown once, does not expire on its own. The same prefix is
  used for any scope set (compliance, analytics, spend limits, members), so
  the value does not say "compliance" and scope is not encoded in it. Body
  length, alphabet and tail: no evidence. Do not extrapolate the `api03` body.
- **Sources:** T1 prefix on the provider documentation pages in the
  frontmatter; the staff help center article covers issuance and "shown once"
  only. No scanner rule handles `api01`. Third-party vendor pages that repeat
  the prefix are community evidence and disagree with the provider on where the
  key is created.
- **Issuance:** needs a Claude Enterprise parent organization and its primary
  owner or an organization owner, with the Compliance API enabled. A
  standalone Console organization cannot create one. The structural-facts
  checklist is in the #776 discovery comment.
- **Collisions:** `sk-ant-api03-` (Console Claude API key) and
  `sk-ant-admin01-` (admin key) differ only in the prefix segment and are
  distinct credential classes. Enterprise `api01` keys are also a documented
  confusable in third-party integration guides, which reject the wrong type.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
  Whether the finding type should say "compliance" or "Enterprise" was a
  product decision raised in #776 and settled in #862 and its follow-ups.

### `anthropic:admin-api-key` — Admin API key (sk-ant-admin01-)

- **Shape:** prefix `sk-ant-admin01-`, created in Claude Console > Settings >
  Admin keys by an organization admin, shown once, with a selectable
  expiration. Console admin keys carry full access to every endpoint that
  accepts an Admin API key. Body: 93 characters from letters, digits,
  underscore and hyphen, then `AA` (110 in all), stated only by scanner rules
  (gitleaks, its fork betterleaks, trufflehog). The provider states no length.
- **Sources:** T1 for the prefix (two provider pages; one writes it
  `sk-ant-admin...` without the version segment). Body: T2, with trufflehog the
  only corroboration independent of the gitleaks lineage. No staff statement
  and no provider SDK source constrains the body.
- **Issuance:** not attempted. A Console organization admin can mint one with
  a short expiry and revoke it; the checklist is in the #775 discovery comment.
- **Collisions:** `sk-ant-api01-` and `sk-ant-api03-` differ by one segment.
  The Admin API also accepts an OAuth bearer token and other key shapes, so an
  admin key is not the only credential seen in that API's headers. A GitHub
  secret-scanning type and several other scanners list it separately.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

- **`sk-ant-oat01-` and `sk-ant-ort01-`** (Claude Code OAuth access and refresh
  tokens). Requested in gitleaks issue 2158; no provider source was found for
  either, so no grammar is recorded.
- **Analytics API key.** Listed on the compliance API access page without a
  prefix, so there is nothing to describe yet.

## Open questions

1. **Enterprise `api01` body.** Length, alphabet and whether it ends in `AA`
   are unknown. One issued key would settle it (#776 checklist). The verdict
   stays `ready` on the prefix alone; the body stays unresearched.
2. **Admin body grammar.** Is it always 93 characters plus `AA`, and does an
   `admin02` exist? Provider text says neither. The #775 checklist covers a
   second key with a different expiry.
3. **`api01` history.** One unsourced blog says `api01` and `api02` were older
   general key generations, which the provider's Enterprise use of `api01`
   appears to contradict. No provider source reconciles them.
4. **OAuth siblings.** Do `sk-ant-oat01-` and `sk-ant-ort01-` have a provider
   source? If so, they need their own taxonomy entries.
5. **Header drift.** The Admin page uses `x-api-key`; the authentication page
   recommends `Authorization: Bearer` and calls `x-api-key` legacy. Context
   fixtures should cover both.
6. **Reddit and forum coverage.** The archive was rate-limited partway
   through, so absence of community posts on `api01` and `admin01` is weak.
7. **Tier of the admin family.** #775 proposed T1 on the prefix with a T2 body
   and asked for a maintainer ruling on that split. The family was later
   implemented (#862), but no explicit ruling comment was read for this
   dossier. Link it here once found.

## Research log

- redact-secret#774 — epic roll-up of the Beta.10 discovery pass, with the
  final per-family close-out.
- redact-secret#775 — admin key discovery, including the Reddit supplement
  and the issuance checklist.
- redact-secret#776 — Enterprise organization key discovery, including the
  Reddit supplement and the issuance checklist.
- redact-secret#862 — implementation issue for the `api01` and `admin01`
  prefixes; names redact-secret-benchmarks#384 as the benchmarks counterpart.
- redact-secret#642 — T1 re-tier record for `anthropic:secret-api-key`,
  linked by permalink in the frontmatter.
- redact-secret#783 was named for this pilot but researches
  `together-ai:api-key`; it belongs in that provider's dossier, not here.
