---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: mailchimp
families:
  - id: mailchimp:marketing-api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://mailchimp.com/developer/marketing/docs/fundamentals/
      issues:
        - redact-secret/redact-secret#582
        - redact-secret/redact-secret#697
        - redact-secret/redact-secret#698
        - redact-secret/redact-secret#699
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/582/README.md
      researchedAt: 2026-09-25
    blockedBy: null
---

# Mailchimp

Mailchimp Marketing API keys authenticate with HTTP Basic auth under any
username. The account's data center (`usNN`) is appended to the key, and the
provider's [fundamentals page](https://mailchimp.com/developer/marketing/docs/fundamentals/)
says it is always appended as `key-dc`. Mandrill (transactional) keys are a
separate product. The family was a Beta.7 candidate ranked in #582.

## Families

### `mailchimp:marketing-api-key` — Marketing API key

- **Shape:** 32 hex characters, a literal `-us`, and a one- or two-digit data
  center number. Provider text gives the shape only through examples: the
  fundamentals page shows a 31-hex-character body with `-us6`, while Mailchimp's
  own WordPress plugin shows 32 hex with `-us19`. Non-`us` data-center literals
  and body letters `g-z` are outside the benchmark claim since 2026-09-24.
- **Sources:** T2. Every scanner rule, a 2009 staff post and 111 of 115 public
  code candidates use 32. Tools split on suffix digits (trufflehog 1 to 2,
  gitleaks exactly 2, Nosey Parker 1 to 3), on uppercase hex (gitleaks and
  Nosey Parker accept it, trufflehog does not; 2 of 115 candidates had `A-F`)
  and on keyword gating. The 2009 staff post advises against regex validation
  because keys may change.
- **Issuance:** Mailchimp account API key page. Not attempted. The UI shows only
  the first four characters of a key afterwards.
- **Collisions:** the `usNN` label and the four-character key preview are
  public; a 32-hex body alone matches any MD5-style digest, which is why the
  detector is keyword-gated.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (`mailchimp_api_key`, confidence-gated on a `mailchimp` keyword; the complete
  shape can also be read without the keyword).
- **Open caveat:** The provider states the shape only by examples, one with a 31-character body; length 32 follows scanners and a 2009 staff regex. Hex case and data-center literals are undecided. Needs one issued key.

## Open questions

1. Is the body 31 or 32 characters today? An issued key would settle it
   (integer only, #699).
2. Can a real key contain `A-F` (#697)?
3. Are non-`us` data-center literals ever issued?

## Research log

- redact-secret#582 — Beta.7 ranking; the Mailchimp broad-discovery pass is
  linked from the evidence record (2026-09-23).
- redact-secret#698 — suffix digit-count dispute between sources (closed 2026-09-25 with no comment; no provider source found).
- redact-secret#697 — uppercase hex dispute; closed 2026-09-25.
- redact-secret#699 — provider example has a 31-character body versus the
  32-character grammar; closed 2026-09-25.
