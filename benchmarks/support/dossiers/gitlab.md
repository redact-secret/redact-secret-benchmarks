---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: gitlab
families:
  - id: gitlab:legacy-personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.gitlab.com/security/tokens/
      issues:
        - redact-secret/redact-secret#518
      evidence: https://github.com/redact-secret/redact-secret/blob/54c9ab35cb693e0cd3aedc8f858ca19ab77e4363/docs/decisions/2026-09-20-inventory-gitlab-token-families.md
      researchedAt: 2026-09-20
    blockedBy: "Only the glpat- prefix is provider-documented (T1); the 20-character body is tool-corroborated, and an administrator-configured personal access token prefix is unsupported."
  - id: gitlab:routable-personal-access-token
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
  - id: gitlab:runner-authentication-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://docs.gitlab.com/security/tokens/
        - https://docs.gitlab.com/ci/runners/new_creation_workflow/
        - https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/authn/token_field/generator/routable_token.rb
        - https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/authn/token_field/base.rb
      issues:
        - redact-secret/redact-secret-benchmarks#230
        - redact-secret/redact-secret#726
        - redact-secret/redact-secret#730
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/726/README.md
      researchedAt: 2026-09-25
    blockedBy: Prefix is documented; the 20-character body and routable grammar come from GitLab server code and gitleaks. glrtr-, instance-prefixed and unversioned routable forms are unverified. No issued token captured.
---

# GitLab

GitLab documents a prefix table for its tokens on the
[token overview](https://docs.gitlab.com/security/tokens/) page. Personal
access tokens use `glpat-`; runner authentication tokens use `glrt-`, or
`glrtr-` when created through a registration token. Only the runner
authentication family has research recorded for this batch; the two legacy
personal access token family was inventoried in #518 (T1 on the prefix), and the
routable one is recorded there as pending.

## Families

### `gitlab:legacy-personal-access-token` — Legacy personal access token

- **Sources:** T1 for the `glpat-` prefix (token overview, observed 2026-09-20). The prefix also covers impersonation, project and group access tokens. Inventoried per family in #518, whose decision records the administrator-customized prefix as unsupported (T3 policy).

### `gitlab:routable-personal-access-token` — Routable personal access token

- **Sources:** none reviewed in this batch. Unresearched; #518 records the routable form as pending until a source states the payload length or alphabet. The #230 pass notes
  that GitLab's routable-token generator is shared with `glpat-` (versioned and
  unversioned routable forms exist); that is context, not a verdict for this
  family.

### `gitlab:runner-authentication-token` — Runner authentication token

- **Shape:** prefix `glrt-` followed by one of three bodies. (a) Legacy: 20
  characters of a URL-safe alphabet from GitLab's `friendly_token`
  (`[A-Za-z0-9_-]` minus `l`, `I`, `O`, `0`). (b) Partition-prefixed:
  `t<hex>_` then the 20 characters, seen in a March 2025 forum post. (c)
  Routable, from GitLab 18.0: a base64url payload (27 to 300 characters), `.`,
  a 2-character base36 version, `.`, a 2-character base36 payload length and a
  7-character base36 CRC32 of everything before it.
- **Sources:** T1 for the prefix (token overview and new-runner-workflow
  pages). Body and checksum come from GitLab's own server code
  (`routable_token.rb`, Devise's `friendly_token`) and its secret-detection
  rules, so they are provider code but not documentation; gitleaks agrees on
  the legacy body. The design document is `proposed` and omits the version
  segment the code emits. The tier is T2.
- **Issuance:** `POST /user/runners` or the runner creation UI. Not
  attempted. Registration tokens (`GR1348941` plus 20 characters) are a
  separate, deprecated class.
- **Collisions:** other `gl` prefixes (`glpat-`, `gldt-`, `glcbt-`) are real
  GitLab secrets, not clean negatives. `glrtr-` is a superstring of `glrt` and
  is not matched by a `glrt-` rule. Runner ids and `s_` + 12 hex system ids are
  public. Instance-prefixed tokens (`<prefix>-glrt-`) exist behind a feature
  flag and are documented as not production ready.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (Beta.8 wave 2, empirical route): exact 20-byte body or the routable form with
  the length holder and CRC32 checked offline; `glrtr-`, instance-prefixed and
  unversioned forms are unclaimed.

## Candidates that are not families yet

- **Runner registration token (`GR1348941` + 20).** Registers runners rather
  than authenticating as one; GitLab's own rules list it separately. Pre-2022
  registration tokens were unprefixed.
- **`glrtr-` runner tokens.** Documented prefix; current shape unverified.
- **Other prefixes** (`gldt-`, `glcbt-`, `glptt-`, `glft-`, `glimt-`, `glagent-`,
  `glwt-`, `glsoat-`, `glffct-`, `gloas-`). Listed on the token overview page;
  inventoried in #518: all supported except the routable runner form and the unprefixed runner registration token; `glsoat-` and `glffct-` were added there.

## Open questions

1. Does a `t<hex>_` segment ever precede a routable payload?
2. Is `glrtr-` routable? It probably takes shape (c) with that prefix; needs a
   token issued through a registration token.
3. Was the unversioned single-dot routable form ever issued for runners?
4. Version window in which the partition-prefixed shape was minted.
5. The routable personal access token family has no source stating its payload length or alphabet (#518 records it as pending).

## Research log

- redact-secret-benchmarks#230 — broad-discovery pass (25 sources); closed
  2026-09-24, routed to #212.
- redact-secret#518 — inventory of GitLab's 13 documented token prefixes (decided 2026-09-20).
- redact-secret#726 — freezes the wave-2 contract (T2, empirical route).
- redact-secret#730 — implementation record; moved `glrt-` out of the
  personal access token detector.
