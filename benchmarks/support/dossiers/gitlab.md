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
    blockedBy: null
  - id: gitlab:routable-personal-access-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.gitlab.com/security/tokens/
        - https://gitlab.com/gitlab-org/gitlab/-/blob/87cb885dccf8cfa81ee5aa734b7f2e796413e221/lib/authn/token_field/generator/routable_token.rb
        - https://gitlab.com/gitlab-org/gitlab/-/blob/87cb885dccf8cfa81ee5aa734b7f2e796413e221/app/models/personal_access_token.rb
        - https://gitlab.com/gitlab-org/gitlab/-/merge_requests/169322
        - https://gitlab.com/gitlab-org/gitlab/-/work_items/623418
        - https://gitlab.com/gitlab-org/security-products/secret-detection/secret-detection-rules/-/blob/e1c7e83815a7e55cc1514dd59d4e56459e39cbfb/rules/mit/gitlab/gitlab.toml
        - https://handbook.gitlab.com/handbook/engineering/architecture/design-documents/cells/routable_tokens/
        - https://github.com/gitleaks/gitleaks/blob/b58d3f102cf3a2c84cb7f923d05c25c9b1aed84b/cmd/generate/config/rules/gitlab.go
        - https://github.com/trufflesecurity/trufflehog/blob/48b58d3bf3f02ba17bf23b87f095499bc80c6fd7/pkg/detectors/gitlab/v3/gitlab_v3.go
        - https://github.com/trufflesecurity/trufflehog/issues/4551
        - https://github.com/gitleaks/gitleaks/issues/1655
        - https://github.com/semgrep/semgrep-network-broker/issues/189
        - https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns
      issues:
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#518
        - redact-secret/redact-secret#1012
        - redact-secret/redact-secret#1022
        - redact-secret/redact-secret-benchmarks#528
      evidence: https://github.com/redact-secret/redact-secret/blob/4fb78827f1ddf5b3106f25130ca510a836ada186/docs/audits/evidence/1012/gitlab-routable-personal-access-token.md
      researchedAt: 2026-09-29
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
    blockedBy: null
---

# GitLab

GitLab documents a prefix table for its tokens on the
[token overview](https://docs.gitlab.com/security/tokens/) page. Personal
access tokens use `glpat-`; runner authentication tokens use `glrt-`, or
`glrtr-` when created through a registration token. The runner
authentication family was researched in #230, the legacy personal access token
family was inventoried in #518 (T1 on the prefix), and the routable personal
access token was researched on 2026-09-29 (#473, `ready` at T2).

## Families

### `gitlab:legacy-personal-access-token` — Legacy personal access token

- **Sources:** T1 for the `glpat-` prefix (token overview, observed 2026-09-20). The prefix also covers impersonation, project and group access tokens. Inventoried per family in #518, whose decision records the administrator-customized prefix as unsupported (T3 policy).
- **Open caveat:** Only the glpat- prefix is provider-documented (T1); the 20-character body is tool-corroborated, and an administrator-configured personal access token prefix is unsupported.

### `gitlab:routable-personal-access-token` — Routable personal access token

- **Verdict (#1012, 2026-09-29):** `ready`, T1: the product research record reads GitLab's own generator and validator as provider code that states the grammar (payload 27 to 300, `.`, 2 base36 version, `.`, 2 base36 payload length, 7 base36 CRC-32), and the contract is merged to product main under #1022 (PR #1039, unreleased). The benchmarks#473 pass the same day had recorded `ready`, T2, reading the same code as T2; the two readings differ only in tier. The #473 text follows. This resolves the condition #518 set for the routable form ("a provider or independently-agreeing tool source states the payload's own length or alphabet"): GitLab's own code and rules now state both.
- **Shape:** prefix `glpat-`, a base64url payload with no padding (`0-9a-zA-Z_-`), then either `.` + 2-character base36 length + 7-character base36 CRC32 (unversioned), or `.` + 2-character base36 version + `.` + 2-character base36 length + 7-character base36 CRC32 (versioned). GitLab's rules bound the payload at 27 to 300 characters. The random part is 16 bytes, followed by a routing payload of newline-separated `key:value` pairs and a trailing length byte.
- **Provider code (T2, not documentation).** `routable_token.rb` at `87cb885` (GitLab, 2026-03-18) writes `{prefix}{payload}.{version}.{length}{crc}`, a token version of 1 rendered as `01`, a two-character base36 payload length and a seven-character base36 CRC32 over everything before it, routing keys limited to `c g o p u t` with at least one of `c` or `o`, and a 159-byte routing-payload cap. `personal_access_token.rb` at the same commit declares the PAT field routable with the `o` (organization) and `u` (user) keys and the default `glpat-` prefix, or an instance prefix in front of it.
- **Provider rules (T2).** GitLab's own secret-detection rules at `e1c7e83` carry three PAT rules: legacy (20 characters), routable (single dot) and routable-versioned (`.<2>.<9>` tail). The two routable rules use the 27 to 300 payload bound. GitLab's rollout issue #623418 (undated in the fetch) says routable PATs began in 18.0 and became unconditional in 18.3, and that the versioned form is the default from 18.3.
- **Peer corroboration.** gitleaks `gitlab.go` at `b58d3f1` has `gitlab-pat-routable` in the single-dot form only, so it misses the versioned default; TruffleHog `gitlab/v3` at `48b58d3` matches both dots (`{27,300}` payload, 2-character version, 9-character tail) and cites GitLab's MR 169322 as its source, after issue #4551 (2025-11-13) reported the format change. Semgrep's network-broker issue #189 (2025-12-29) reports the same drift, a hard-coded `.01.` segment and tokens over 54 characters.
- **Independent voices.** gitleaks issue #1655 (2024-11-24) quotes the design document. The MR that introduced the PAT change (169322, opened 2024-10-15, behind the `routable_pat` flag) gives 43 to 316 characters overall. The design document in the handbook is still marked proposed, and was not re-read in full this pass, so it corroborates nothing on its own.
- **Contradictions, bounded.** (1) gitleaks' single-dot form against GitLab's versioned form: GitLab's code and rules decide it, and a contract must accept both dots or state which it claims. (2) TruffleHog accepts `-`, `=` and `_` in the payload, GitLab's rules do not allow `=`; the generator emits unpadded base64url, so `=` is not a produced character. (3) The design document omits the version segment the code emits. Neither the version value (`01`) nor the version's existence should be hard-coded, per the Semgrep report.
- **Not established.** Whether unversioned routable PATs were ever issued outside pre-release, which instances mint them (self-managed below 18.0 keeps the 20-character form), and any admin-customized prefix (unsupported per #518). GitLab's docs page on token prefixes says nothing of the payload, so the prefix stays the only T1 fact. No token was issued or observed; the checksum can be checked offline from the code alone.
- **Collisions.** The routing payload decodes to readable text; other `gl` prefixes belong to other families; the 20-character legacy body is a different family (`gitlab:legacy-personal-access-token`).

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
- **Open caveat:** Prefix is documented; the 20-character body and routable grammar come from GitLab server code and gitleaks. glrtr-, instance-prefixed and unversioned routable forms are unverified. No issued token captured.

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
5. Was the unversioned single-dot routable PAT ever minted in production? Only the versioned form is confirmed as the 18.3+ default.

## Research log

- redact-secret-benchmarks#230 — broad-discovery pass (25 sources); closed
  2026-09-24, routed to #212.
- redact-secret#518 — inventory of GitLab's 13 documented token prefixes (decided 2026-09-20).
- redact-secret#726 — freezes the wave-2 contract (T2, empirical route).
- redact-secret#730 — implementation record; moved `glrt-` out of the
  personal access token detector.
- redact-secret-benchmarks#473 (2026-09-29) — wide-first pass on the routable PAT: `ready` T2. Searched: GitLab docs, server code, rules repo, MRs, work items and handbook; gitleaks, TruffleHog and Semgrep issues and code; GitHub's pattern table; Hacker News (no hit). Reddit was unreachable and the GitLab forum search returned no thread on the PAT format, so neither is covered.
