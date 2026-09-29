---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: slack
families:
  - id: slack:bot-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: slack:user-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.slack.dev/authentication/tokens
        - https://docs.slack.dev/changelog/2016/08/23/token-lengthening
      issues:
        - redact-secret/redact-secret-benchmarks#229
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#730
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-27
    blockedBy: Prefix and section anatomy are provider-stated; numeric-section widths and the secret's alphabet are tool-only and disagree. Needs one issued xoxp token (checklist in #229).
  - id: slack:app-level-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.slack.dev/authentication/tokens
        - https://docs.slack.dev/apis/events-api/using-socket-mode
      issues:
        - redact-secret/redact-secret-benchmarks#222
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#729
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-27
    blockedBy: Only the xapp- prefix is provider-documented; section widths and alphabet are tool-only and contradictory (four sections, 97 characters versus two sections, 42). Needs one issued token (#222 checklist).
  - id: slack:workflow-webhook-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---

# Slack

Slack issues OAuth and app credentials whose strings start with a type prefix
and are divided into dash-separated sections; the final section is the secret.
The provider's [tokens page](https://docs.slack.dev/authentication/tokens) lists
the prefixes and gives no section widths or alphabet. Slack's 2016
[token lengthening note](https://docs.slack.dev/changelog/2016/08/23/token-lengthening)
tells integrators to expect up to 255 characters and not to rely on any
semantics in the string. The user-token and app-level families are researched
here; the bot-token and workflow-webhook families were not in the sources
reviewed.

## Families

### `slack:bot-token` — Bot token

- **Sources:** none reviewed in this batch. Unresearched.

### `slack:user-token` — User token

- **Shape:** prefix `xoxp-`, three numeric sections, then the secret section,
  dash-separated. Slack's example shows three-digit placeholder sections, so
  widths are not stated. Slack documents that secrets issued before August 2016
  can be 6 or 10 characters instead of 32.
- **Sources:** T1 for prefix, section semantics and the short legacy secrets
  (the two provider pages above). Widths are tool-only and differ: gitleaks
  10 to 13 digits per section and a 28 to 34 character secret, Nosey Parker 12
  digits and lowercase hex, trufflehog two numeric sections and an open tail.
  Slack's own CLI redacts `xoxp-` on prefix alone.
- **Issuance:** OAuth v2 user token, legacy tester token (no longer issued), and
  possibly the service token. Not attempted. Revocable with `auth.revoke`.
- **Collisions:** `xoxe.xoxp-` (rotating user or app-configuration token),
  `xoxc-` (browser session token, same skeleton, 64 hex secret per one scanner
  rule), `xoxb-`, `xoxe-` and the CLI's `xoxp-1-...` service-token example are
  distinct credentials. Team, user and enterprise ids are public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (Beta.8 wave 2; `xoxp-` plus three numeric sections plus a final section, no
  width rule).

### `slack:app-level-token` — App-level token

- **Shape:** prefix `xapp-`. Tools and provider placeholders suggest a
  one-digit version section, an app-id-like section, a 13-digit section and a
  64-hex secret (97 characters), but no provider text states any of it. The
  contract freezes only four sections in digit, alphanumeric, digit,
  alphanumeric order with open widths.
- **Sources:** T1 for the prefix and role (tokens page, Socket Mode guide,
  which shows `Authorization: Bearer xapp-1-123`). Everything else is T2 or
  weaker: gitleaks and osv-scalibr agree on 1/11/13/64, Kingfisher's rule is an
  import of that shape, and Nosey Parker's rule is two sections and 42
  characters. Slack's CLI test placeholders disagree on section order.
- **Issuance:** Basic Information > App-Level Tokens, scope chosen at creation
  (`connections:write`, `authorizations:read`, `app_configurations:write`).
  Not attempted.
- **Collisions:** `xoxa-2-` and other sectioned Slack prefixes share the
  skeleton; `xapp-store` and similar words are not tokens; app config tokens
  (`xoxe.xoxp-`) are a different credential; app ids are public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (Beta.8 wave 1, empirical route).

### `slack:workflow-webhook-token` — Workflow webhook token

- **Sources:** none reviewed in this batch. Unresearched. The tokens page lists
  the `xwfp-` prefix.

## Candidates that are not families yet

- **`xoxe.xoxp-` and `xoxe-`** (rotating user and app-configuration tokens and
  their refresh tokens). Documented on Slack's rotation and app-manifest pages;
  tool widths disagree (146 versus 147 for the refresh token). No taxonomy
  entry.
- **`xoxc-` and `xoxd-`** (browser session token and cookie). Found through
  scanner rules and community posts only.
- **Service and configuration tokens.** Named on the tokens page without a
  prefix.

## Open questions

1. Real widths of the three numeric sections and of the `xoxp-` and `xapp-`
   secrets; hex-only or alphanumeric (checklists in #229 and #222).
2. Is the second `xapp-` section the public app id? Scanner samples disagree.
3. Have `xapp-` version digits other than `1` been issued?
4. Should rotating `xoxe.xoxp-` tokens join `slack:user-token` or get their
   own family? #229 raised it; no ruling was read here.
5. `slack:bot-token` and `slack:workflow-webhook-token` need their own passes.

## Research log

- redact-secret-benchmarks#222 — `xapp-` broad-discovery pass (23 sources);
  closed 2026-09-24, routed to #211.
- redact-secret-benchmarks#229 — `xoxp-` broad-discovery pass (30 sources);
  closed 2026-09-24, routed to #212.
- redact-secret#726 — freezes both contracts (app-level T2, user T1).
- redact-secret#729 and #730 — implementation of the app-level and user-token
  contracts.
- redact-secret-benchmarks#367 — 2026-09-26 fixture-debt reconciliation for
  both families; no grammar change.
