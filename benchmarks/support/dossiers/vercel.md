---
# Provider dossier — see README.md in this folder and _TEMPLATE.md for guidance.
# Hand-write only research judgement. Status, fixtures and detectors are derived.
provider: vercel
families:
  - id: vercel:access-token
    research:
      verdict: rejected
      tier: null
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/rest-api/authentication/create-an-auth-token
        - https://github.com/trufflesecurity/trufflehog/blob/4dd8831c5f12599465d4d45c3c447b4018a34c85/pkg/detectors/vercel/vercel.go#L25
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:personal-access-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/accounts/access-tokens
        - https://vercel.com/docs/cli/global-options
        - https://vercel.com/docs/cli/tokens
        - https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/cli/src/commands/tokens/add.ts#L36-L41
        - https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L46-L91
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L46-L80
        - https://github.com/Samsung/CredSweeper/blob/1aa60465c4ec064357ead06f5b4da7c3adbce7a8/credsweeper/rules/config.yaml#L1995-L2007
        - https://github.com/secretlint/secretlint/blob/e8fc91351add9eebfd5eec5bdd7cd0d551d5e42a/packages/@secretlint/secretlint-rule-vercel/src/index.ts#L27-L58
        - https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:integration-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
        - https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L92-L132
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L81-L114
        - https://github.com/secretlint/secretlint/blob/e8fc91351add9eebfd5eec5bdd7cd0d551d5e42a/packages/@secretlint/secretlint-rule-vercel/src/index.ts#L27-L58
        - https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:app-access-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/sign-in-with-vercel/tokens
        - https://vercel.com/docs/sign-in-with-vercel/authorization-server-api
        - https://github.com/vercel/vercel-plugin/blob/c632a50838a47a639a160baff8411eb9c6af22bf/.claude/skills/benchmark-sandbox/SKILL.md#L144
        - https://github.com/vercel/turborepo/blob/d7d106538e80f59c80a88ec9503770358197c5fa/crates/turborepo-auth/src/auth/mod.rs#L361
        - https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L133-L192
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L115-L147
        - https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:app-refresh-token
    research:
      verdict: ready
      tier: T2
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/sign-in-with-vercel/tokens
        - https://vercel.com/docs/sign-in-with-vercel/authorization-server-api
        - https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/cli/test/unit/util/login/token-refresh.test.ts#L115-L125
        - https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L193-L251
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L148-L181
        - https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:api-key
    research:
      verdict: ready
      tier: T2
      sources:
        - https://vercel.com/changelog/new-token-formats-and-secret-scanning
        - https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys
        - https://vercel.com/docs/cli/ai-gateway
        - https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/cli/test/unit/commands/ai-gateway/coding-agents-setup.test.ts#L90
        - https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L252-L299
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L182-L212
        - https://github.com/secretlint/secretlint/blob/e8fc91351add9eebfd5eec5bdd7cd0d551d5e42a/packages/@secretlint/secretlint-rule-vercel/src/index.ts#L27-L58
        - https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
      evidence: https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/858/README.md
      researchedAt: 2026-09-29
    blockedBy: null
---

# Vercel

Vercel's 2026-02-09
[changelog](https://vercel.com/changelog/new-token-formats-and-secret-scanning)
gave each credential type a prefix: `vcp` for personal access tokens, `vci` for
integration tokens, `vca` for app access tokens, `vcr` for app refresh tokens
and `vck` for API keys. The five classes are recorded as separate families. The
product's `vercel-token` detector reports all five under one compatibility
finding type; that shared type is not a research result for any of them.

## Verdicts (2026-09-29 re-research)

The 2026-09-27 record (#858) called all five classes `not-found`, T0: the
prefixes identify the class and no provider statement gives a body grammar. A
fresh, wide pass (peer scanner rules, provider docs and code, third-party
implementations, community threads) changes the outcome. No page *states* a
grammar, so none is T1. But every class clears the corroboration bar in
[the empirical-qualification spec](../../../docs/specs/empirical-qualification.md)
(at least 3 dated references, 3 distinct owners and 2 non-summary classes), so
each is `ready` at T2. The decisive new evidence:

- Vercel's own docs print full-length **example** tokens for three of the five
  classes. Two distinct example values (60 characters each: the marker, `_`,
  then 56 characters) are on the Sign in with Vercel Tokens page (`vca_`, and
  the same body reused for `vcr_`) and in the `--token` section of the CLI
  global options page (`vcp_`, with a body that ends in the literal word
  `EXAMPLE`). The earlier record found only the masked `vcp_` filler and
  concluded that no provider source gave a length.
- Three scanner rule sets written after the changelog read the same length:
  Kingfisher (MongoDB, 2026-02-11), CredSweeper (Samsung, 2026-02-17) and
  Betterleaks. They cover `vcp_` (all three) and all five classes (Kingfisher,
  Betterleaks).
- Vercel's CLI, turborepo and plugin code use the prefixes as class
  discriminators (`vca_` login token, `vcr_` refresh token, `vck_` gateway key,
  `vcp_` personal token), which settles the prefix-to-class mapping.

| Family | Verdict | Tier | What clears the bar |
| --- | --- | --- | --- |
| `vercel:access-token` | `rejected` | none | Not a credential family (taxonomy: compatibility aggregate). Nothing to corroborate; the legacy unprefixed form it stands in for is a candidate below. |
| `vercel:personal-access-token` | `ready` | T2 | provider-example (CLI `--token` docs, 56-character body), 3 peer rules (Kingfisher, Betterleaks, CredSweeper), provider-owned code (CLI) |
| `vercel:integration-token` | `ready` | T2 | 2 peer rules with the same shape (Kingfisher, Betterleaks), secretlint, GitHub's `vercel_integration_access_token` type, provider changelog. Weakest of the five: no provider example. |
| `vercel:app-access-token` | `ready` | T2 | provider-example (56-character body), provider-owned code (CLI, turborepo, plugin), 2 peer rules |
| `vercel:app-refresh-token` | `ready` | T2 | same docs example body as `vca_` (one observation, not two), provider-owned CLI code, 2 peer rules |
| `vercel:api-key` | `ready` | T2 | provider docs and CLI code confirm the marker and masking, 2 peer rules, secretlint. No provider example carries a full-length value. |

## Shape the T2 verdict freezes

Grammar in words, the same for all five classes (`vcp_`, `vca_` and `vcr_` have
a provider length example; `vci_` and `vck_` rest on peer rules and the
sibling classes):

- a literal class marker (`vcp_`, `vci_`, `vca_`, `vcr_` or `vck_`), including
  the underscore;
- then exactly 56 characters, 60 in all;
- the observed alphabet is ASCII letters and digits;
- boundary: no provider statement. Peer rules require a non-token character
  on both sides.

What T2 does **not** freeze, and the core contract should not lean on:

- **Alphabet beyond letters and digits.** Kingfisher and Betterleaks accept `_`
  and `-` in the body. CredSweeper and secretlint (`{20,60}`) accept letters and
  digits only. Vercel's own CLI eval matches `vcp_` followed by letters, digits
  and `_` with no length. Every provider example is letters and digits only.
  This is a `bounded` disagreement: leave `_` and `-` out of the body.
- **The checksum.** Only Kingfisher states it: the last 6 characters are the
  base62-encoded CRC32 of the 50 before them. No provider source or observation
  confirms it, and Betterleaks does not verify it. The 50 plus 6 split is
  frozen for the same reason: not at all.
- **Any length range.** Third parties use 20+ or 40-80 to hedge; those are
  hedges, not observations.

## Contradictions and how they are bounded

1. **Unprefixed 24-character REST `bearerToken` beside `prefix: "vcp_"`**
   (Create an Auth Token reference). The example data carries 2021-era
   timestamps and the SDK docs generated from the same OpenAPI copy it
   unchanged, so it predates the 2026 format. Bounded: the unprefixed value is
   the legacy form and is excluded from all five families. The CLI `--token`
   example shows that a current `vcp_` token is the prefixed 60-character
   form.
2. **The masked `vcp_` filler in the Access tokens guide** (24 `x` characters).
   It is a placeholder, not a generated value. A third-party PR that derived
   `{24}` from it (agent-sweep, 2026-09) is not counted as corroboration.
3. **CLI docs say `vercel tokens add` needs a "classic personal access token",
   and that team- or project-only tokens are "some `vcp_…` values".** Whether
   "classic" means legacy unprefixed or a full-scope `vcp_` is not stated.
   Recorded as open question 1; it does not change the prefixed grammar.
4. **Kingfisher and Betterleaks agree on all five classes, but Betterleaks
   reuses Kingfisher's example values.** Counted as two rules with one likely
   shared origin, so `vci_` and `vck_` length rests on effectively one
   independent peer plus the shared-generator inference (the three classes
   with provider examples are all 56).

## Families

### `vercel:access-token` — Compatibility aggregate (unreviewed Vercel token shapes)

- **Verdict:** `rejected`. The taxonomy row is the routing label for the
  aggregate `vercel-token` detector, and its note says it is not a credential
  family. There is no shape to research for the row itself. Its profile cells
  combine five implementation hypotheses and must not be read as evidence for
  any modern class.
- **What it stood in for:** legacy unprefixed 24-character tokens. See the
  candidate below; that shape is researched enough to become a family if the
  maintainers want it.

### `vercel:personal-access-token` — Personal access token

- **Shape:** `vcp_` plus 56 characters. Marker from the Access tokens guide
  ("Personal access tokens begin with the prefix `vcp_`") and the changelog.
  Length from the CLI global options page (`--token` and `VERCEL_TOKEN`
  examples; page last updated 2026-05-28) and three peer rules.
- **Corroboration (all read 2026-09-29):**

| Reference | Owner | Class | Supports |
| --- | --- | --- | --- |
| [Vercel CLI global options](https://vercel.com/docs/cli/global-options) | vercel | provider-example | `vcp_` + 56-character letters/digits body in two examples |
| [Vercel Access tokens](https://vercel.com/docs/accounts/access-tokens) | vercel | provider-example | marker `vcp_`; masked filler is not a value |
| [vercel/vercel `tokens/add.ts`](https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/cli/src/commands/tokens/add.ts#L36-L41) | vercel | provider-owned-code | `vcp_` is the personal-token marker; some are team- or project-scoped |
| [Kingfisher `vercel.yml` at v1.82.0](https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L46-L91) | mongodb | peer-scanner-rule | `vcp_` + 50 + 6, alphabet with `_-`, CRC32 claim |
| [Betterleaks `vercel.go`](https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L46-L80) | betterleaks | peer-scanner-rule | `vcp_` + 56, alphabet with `_-` |
| [CredSweeper `config.yaml` at v1.18.5](https://github.com/Samsung/CredSweeper/blob/1aa60465c4ec064357ead06f5b4da7c3adbce7a8/credsweeper/rules/config.yaml#L1995-L2007) | samsung | peer-scanner-rule | `vcp_` + exactly 56 letters/digits (rule added 2026-02-17) |
| [secretlint Vercel rule](https://github.com/secretlint/secretlint/blob/e8fc91351add9eebfd5eec5bdd7cd0d551d5e42a/packages/@secretlint/secretlint-rule-vercel/src/index.ts#L27-L58) | secretlint | peer-scanner-rule | `vcp_` + 20-60 letters/digits; marker and class only |
| [GitHub secret scanning, March 2026](https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/) | github | peer-scanner-rule | `vercel_personal_access_token` type, push protection on by default |

- **Collisions:** deployment, project, team, integration and client ids are
  sibling identifiers; an unprefixed 24-character value is not a valid positive
  or negative on width alone. Team- and project-scoped `vcp_` tokens exist next
  to full-account ones, so the marker does not imply scope.
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md)
  (pending, T0). This verdict does not change core; it unblocks a contract.

### `vercel:integration-token` — Integration token

- **Shape:** `vci_` plus 56 characters. The changelog prints only `vci`. The
  underscore, the length and the alphabet come from peer rules (secretlint,
  Kingfisher and Betterleaks all use `vci_`), and every sibling class with a
  provider example has the `_`.
- **Corroboration (read 2026-09-29):** the changelog (provider-example, class
  and stem); Kingfisher rule (peer, mongodb, `vci_` + 50 + 6); Betterleaks rule
  (peer, betterleaks, `vci_` + 56); secretlint (peer, `vci_` + 20-60 letters
  and digits); GitHub `vercel_integration_access_token` (peer, github, push
  protection on by default). Independent implementations (brainlayer
  `vc[kpi]_` 20+, merged 2026-09-25) confirm the marker only.
- **Gap:** no Vercel page prints a `vci_` value. The Building Integrations
  page (updated 2026-09-16) still shows unprefixed 24-character `access_token`
  and client values in its code-exchange examples: legacy or stale, as with the
  REST example. Whether OAuth code exchange now returns `vci_` tokens is
  undocumented.

### `vercel:app-access-token` — App access token

- **Shape:** `vca_` plus 56 characters. The Sign in with Vercel Tokens page
  (updated 2026-03-30) shows a 60-character example and calls the format opaque
  with server-side validation. Vercel's CLI login stores a `vca_` token
  (`vercel-plugin` benchmark skill; turborepo `starts_with("vca_")` decides
  OAuth vs legacy tokens).
- **Corroboration (read 2026-09-29):** Vercel Tokens doc (provider-example);
  turborepo `auth/mod.rs` L361 (provider-owned-code, vercel); vercel-plugin
  `benchmark-sandbox/SKILL.md` L144 (provider-owned-code); Kingfisher (peer);
  Betterleaks (peer); GitHub `vercel_app_user_access_token` (peer, configurable
  push protection).
- **Note:** access tokens last one hour. Kingfisher documents revocation via
  `https://api.vercel.com/login/oauth/token/revoke` with client credentials.

### `vercel:app-refresh-token` — App refresh token

- **Shape:** `vcr_` plus 56 characters. The docs example reuses the `vca_`
  body, so it is not a second body observation. Refresh tokens last 30 days and
  rotate on use.
- **Corroboration (read 2026-09-29):** Vercel Tokens doc (provider-example,
  shared body); Vercel CLI `token-refresh.test.ts` L115-L125 (provider-owned-code;
  short dummies, so marker and role only); Kingfisher (peer); Betterleaks
  (peer); GitHub `vercel_app_refresh_token` (peer).

### `vercel:api-key` — API key (AI Gateway)

- **Shape:** `vck_` plus 56 characters. Docs and CLI show `vck_...` and the mask
  `vck_••••1234`; CLI tests use short dummies. Length from peer rules only.
- **Corroboration (read 2026-09-29):** AI Gateway API Keys doc and `vercel
  ai-gateway` CLI doc (provider-example, marker and mask); vercel/vercel CLI
  test (provider-owned-code, marker); Kingfisher (peer); Betterleaks (peer);
  secretlint (peer); GitHub `vercel_api_key` (peer, push protection on by
  default).
- **Note:** the AI Gateway doc describes an unauthenticated
  `POST /external/compromised_secret` route for reporting a leaked key. A
  benchmark must never call it with a real value.

## Candidates that are not families yet

- **Legacy unprefixed 24-character tokens.** Trufflehog's Vercel detector
  (v3.97.9 and current `main`) matches only a `vercel`-labelled 24-character
  alphanumeric value; Kingfisher (`vercel.1`), Betterleaks and GitGuardian
  ("prefixed: no") do the same, and Vercel's REST and integrations examples show
  the shape. It is corroborated but context-gated: bare 24-character values
  collide with ids. If the maintainers want it, it needs its own family (for
  example `vercel:legacy-access-token`), not the aggregate row.
- **GitHub `vercel_support_access_token`.** A sixth GitHub type (push protection
  on by default) with no published prefix in any source read.
- **Blob read-write tokens** (`vercel_blob_rw_` plus store id and secret, per a
  third-party rule) and **gateway client secrets** (`vcst_`, per search
  snippets only): no provider page read; not researched here.

## Open questions

1. Is a "classic" personal token (CLI docs) the unprefixed legacy form or a
   full-scope `vcp_`? Does Vercel still issue unprefixed tokens?
2. Do `_` or `-` occur in the 56-character body? A provider statement or one
   locally inspected, revoked token would settle it (structural metadata only).
3. Is the trailing CRC32 real? Only Kingfisher claims it.
4. Do OAuth integration code exchanges return `vci_` tokens?
5. Should the legacy 24-character form become its own family, and should
   `vercel:access-token` then leave the taxonomy?

## Searched with no Vercel-specific result

gitleaks (no Vercel rule at `master`), trufflehog `main` and its 2026-09
release notes (legacy pattern only), detect-secrets, osv-scalibr (Veles),
GitGuardian (legacy detector only), Hacker News, Reddit, Stack Overflow, and
Vercel community threads (one, from 2026-08-15, confirms `vcp_` as the
personal-token marker and says nothing on length). Third-party rules that only
hedge (`{20,}`, `{24}`, `{40,80}`) were read and not counted as observations.

## Research log

- redact-secret#858 — splits the five classes and records them pending, T0;
  corrects #516 in three places (inferred `vci_`, a "conservative" 20-character
  floor, and a resolved unprefixed 24-character surface). Closed 2026-09-27.
- redact-secret#516 — original taxonomy audit; issue text read, no comments.
- redact-secret-benchmarks#367 — 2026-09-26 source ledger that found the
  changelog and the REST contradiction.
- redact-secret-benchmarks#373 — benchmark counterpart, blocked on #858;
  closed 2026-09-27 with the classes split and no positive manufactured.
- 2026-09-29 — wide re-research under #473 (this record): found the CLI
  `--token` and Sign in with Vercel full-length examples, three peer rule sets,
  and provider code for the prefix-to-class mapping. Verdict changes: five
  families `not-found` T0 to `ready` T2; `vercel:access-token` `unresearched`
  to `rejected`.
