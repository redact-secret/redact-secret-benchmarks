---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: sendgrid
families:
  - id: sendgrid:api-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# SendGrid

SendGrid issues API keys with the prefix `SG.`; full-access and restricted-access keys share one format.

No family in this dossier has a recorded research verdict. Whether and how core detects a family is not recorded here.

## Families

### `sendgrid:api-key` — API key

- **Shape:** SG. prefixed API key (full-access and restricted-access permission scopes share this format).
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).

## Candidates that are not families yet

None recorded.

## Open questions

1. **The API key family is unresearched.** Searched: core and benchmarks issue titles for SendGrid, core `docs/specs`, evidence and decisions, benchmarks `docs/` and `benchmarks/support`. The SendGrid issues (core #285 coverage gap, #402 and #404 candidate regressions and a partial-match bug, #553 twin policy) are false-negative, regression and fixture-policy records, not grammar research.
2. **Lead, not a verdict.** The benchmarks contract for `sendgrid-token` cites a SendGrid support article (https://support.sendgrid.com/hc/en-us/articles/44146758703387-Can-I-Use-a-Reduced-Shorter-API-Key-Size-in-SendGrid) for a fixed total length of 69 characters, and says the `SG.` prefix, the dot-separated 22 and 43 character segments and the alphabet are tool-corroborated, not stated by that page (checked 2026-09-20). Decide whether that row counts as a research record.

## Research log

No research issues. Related non-research issues: core #285, #402, #404, #553.
