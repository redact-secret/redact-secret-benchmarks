---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: slack
families:
  - id: slack:bot-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.slack.dev/authentication/tokens
      issues:
        - redact-secret/redact-secret#371
      evidence: https://github.com/redact-secret/redact-secret/blob/54c9ab35cb693e0cd3aedc8f858ca19ab77e4363/docs/decisions/2026-09-17-freeze-slack-bot-token-segment-grammar.md
      researchedAt: 2026-09-17
    blockedBy: null
  - id: slack:user-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.slack.dev/authentication/tokens
        - https://docs.slack.dev/changelog/2016/08/23/token-lengthening
        - https://docs.slack.dev/authentication/using-token-rotation/
      issues:
        - redact-secret/redact-secret-benchmarks#229
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#730
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-27
    blockedBy: null
  - id: slack:app-level-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.slack.dev/authentication/tokens
        - https://docs.slack.dev/apis/events-api/using-socket-mode
        - https://github.com/slackapi/java-slack-sdk/blob/49b62a6b866bf43eb4c3bfe9c8423a65400d2928/docs/english/guides/socket-mode.md#L180
        - https://github.com/slackapi/slack-cli/blob/20dd73092a65d3797180f95f0ee765053d7ef634/internal/goutils/strings_test.go#L198-L202
      issues:
        - redact-secret/redact-secret-benchmarks#222
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#729
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/slack-app-level-token.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: slack:workflow-webhook-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.slack.dev/authentication/tokens
      issues:
        - redact-secret/redact-secret-benchmarks#45
        - redact-secret/redact-secret-benchmarks#127
        - redact-secret/redact-secret#512
      evidence: null
      researchedAt: 2026-09-29
    blockedBy: null
---

# Slack

Slack issues OAuth and app credentials whose strings start with a type prefix
and are divided into dash-separated sections; the final section is the secret.
The provider's [tokens page](https://docs.slack.dev/authentication/tokens) lists
the prefixes and gives no section widths or alphabet. Slack's 2016
[token lengthening note](https://docs.slack.dev/changelog/2016/08/23/token-lengthening)
tells integrators to expect up to 255 characters and not to rely on any
semantics in the string. The user-token, app-level and bot-token families are researched
here; the workflow-webhook family is recorded on the tokens-page prefix alone (see its section).

## Families

### `slack:bot-token` — Bot token

- **Shape:** `xoxb-` + 10 to 13 digits + `-` + 10 to 13 digits + `-` + at least 18 alphanumerics, as frozen by #371.
- **Sources:** T1 for the prefix and the dash-separated sections (docs.slack.dev tokens page); section widths are tool agreement and the 18-byte floor is a policy choice.
- **Open caveat:** The prefix and dash-separated sections are provider-documented; the 10 to 13 digit section widths are tool agreement and the 18-byte secret floor is a support-policy choice.

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
- **Open caveat:** Prefix and section anatomy are provider-stated; numeric-section widths and the secret's alphabet are tool-only and disagree. Needs one issued xoxp token (checklist in #229).

### `slack:app-level-token` — App-level token

- **Shape:** prefix `xapp-`. Tools and provider placeholders suggest a
  one-digit version section, an app-id-like section, a 13-digit section and a
  64-hex secret (97 characters), but no provider text states any of it. The
  contract freezes only four sections in digit, alphanumeric, digit,
  alphanumeric order with open widths.
- **Sources:** T1 for the prefix and role (tokens page, Socket Mode guide,
  which shows `Authorization: Bearer xapp-1-123`). Everything else is T2 or
  weaker. gitleaks' rule (`(?i)xapp-\d-[A-Z0-9]+-\d+-[a-z0-9]+`, 2023-06-15,
  "based on a limited number of examples") fixes the four-section order with
  open widths; 1/11/13/64 is only its test samples, taken from a third-party
  repository, not a width it enforces (an earlier reading said gitleaks and
  osv-scalibr agree on 1/11/13/64; corrected by redact-secret#1013). osv-scalibr
  is the rule that fixes those widths, Kingfisher's rule is an import of it,
  Docker portcullis (2026-05-08) states the four-segment shape with its own
  ranges, and Nosey Parker's rule is two sections and 42 characters. Slack's
  own placeholders disagree: four sections in the Java SDK guide and sample
  and the Slack CLI tests, one to three elsewhere (Socket Mode page, bolt
  fixtures).
- **Pending ruling Q-SL (redact-secret#1013):** may Slack's four-section
  placeholders (Java SDK guide and `OAuth.java` sample, Slack CLI tests) count
  as provider-example corroboration, with the shorter Slack placeholders
  bounded? If yes, the four-section anatomy clears the corroborated route
  (gitleaks, osv-scalibr, Docker and Slack: at least 4 owners, 2 non-summary
  classes) with widths left open. If no, only one issued token closes it.
  Until then the family has no `empirical-observations.json` record. The fixture
  profile (40 fixtures, 12 positives, 15 controls, 8 twins) and the review rows
  were cleared under #1013, so the ruling is the only open gate.
- **Issuance:** Basic Information > App-Level Tokens, scope chosen at creation
  (`connections:write`, `authorizations:read`, `app_configurations:write`).
  Not attempted.
- **Collisions:** `xoxa-2-` and other sectioned Slack prefixes share the
  skeleton; `xapp-store` and similar words are not tokens; app config tokens
  (`xoxe.xoxp-`) are a different credential; app ids are public.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (Beta.8 wave 1, empirical route).
- **Open caveat:** Only the xapp- prefix is provider-documented; the four-section order rests on peer rules and Slack placeholders that disagree with other Slack placeholders, and widths stay open (osv-scalibr 1/11/13/64, Docker 1/8-16/8-16/32-128 hex, Nosey Parker two sections). READY-T2 only if ruling Q-SL accepts the four-section placeholders; otherwise one issued token (#222 checklist, restated in #1013).

### `slack:workflow-webhook-token` — Workflow webhook token

- **Sources:** `ready`, T1 on the provider-documented prefix `xwfp-` and nothing else (docs/specs/beta8-evidence.md, "Tier follows the evidence": a documented prefix is T1 with the body unspecified, as Anthropic). The tokens page states workflow tokens begin `xwfp-` and gives no section widths or alphabet; the shipped `slack-token` contract cites the same page for the prefix (re-checked 2026-09-20, benchmarks#45). The body grammar is undecided, and per decision `2026-09-24-stop-asserting-provider-undecided-format-properties` a pending fixture never asserts an undecided body. Benchmarks#127 (2026-09-22) keeping the corpus fixtures pending reflects only the missing body grammar, not the prefix verdict; core [#512](https://github.com/redact-secret/redact-secret/issues/512) shipped an open-floor rule for it.

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
4. Answered by #512 (its 2026-09-20 decision): rotating `xoxe.xoxp-` and `xoxe.xoxb-` tokens and refresh tokens are their own supported variants in core, T1 on a single-digit version section with an opaque body; #730 keeps an `xoxp-` inside `xoxe.xoxp-` with the rotation variant. Whether the taxonomy should get a family for them is open.
5. `slack:workflow-webhook-token`: body grammar undecided; #512 deliberately did not promote it beyond the bare `xwfp-` prefix, and benchmarks#127 stays pending on the body alone.

## Research log

- redact-secret#1013 — 2026-09-29 T1/T2 pass for `xapp-` ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/slack-app-level-token.md)):
  READY-T2 conditional on Q-SL; gitleaks width reading corrected.
- redact-secret-benchmarks#222 — `xapp-` broad-discovery pass (23 sources);
  closed 2026-09-24, routed to #211.
- redact-secret-benchmarks#229 — `xoxp-` broad-discovery pass (30 sources);
  closed 2026-09-24, routed to #212.
- redact-secret#371 — froze the bot-token grammar (decided 2026-09-17).
- redact-secret#726 — freezes both contracts (app-level T2, user T1).
- redact-secret#729 and #730 — implementation of the app-level and user-token
  contracts.
- redact-secret-benchmarks#367 — 2026-09-26 fixture-debt reconciliation for
  both families; no grammar change.
- redact-secret-benchmarks#45 and #127 — pending-fixture reviews (2026-09-20 and
  2026-09-22) that kept the `xwfp-` shape T0 pending: prefix documented, body
  not; redact-secret#512 is the core counterpart.
