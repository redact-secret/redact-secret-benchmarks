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
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md
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
        - https://openapi.vercel.sh/
        - https://github.com/vercel/vercel-azure-devops-extension/blob/24183cd1671cdb451e22a20634c2bb19e3478870/vercel-deployment-task-source/src/index.ts#L37-L38
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:integration-token
    research:
      verdict: issuance-gated
      tier: T1
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
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md
      researchedAt: 2026-09-29
    blockedBy: No provider source writes vci_ with the underscore; the 56-character body rests on peer rules only (1 class). Needs ruling Q-VC or one integration token measured (checklist in redact-secret#1013).
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
        - https://github.com/vercel/vercel-azure-devops-extension/blob/24183cd1671cdb451e22a20634c2bb19e3478870/vercel-deployment-task-source/src/index.ts#L37-L38
        - https://github.com/mongodb/kingfisher/blob/88d3f780fad83960aaddfcf732a690049853ccc9/crates/kingfisher-rules/data/rules/vercel.yml#L133-L192
        - https://github.com/betterleaks/betterleaks/blob/2a387a5bad4290a84b9a1eb679bffe70611218cc/cmd/generate/config/rules/vercel.go#L115-L147
        - https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/
      issues:
        - redact-secret/redact-secret#858
        - redact-secret/redact-secret#516
        - redact-secret/redact-secret-benchmarks#367
        - redact-secret/redact-secret-benchmarks#373
        - redact-secret/redact-secret-benchmarks#473
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md
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
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md
      researchedAt: 2026-09-29
    blockedBy: null
  - id: vercel:api-key
    research:
      verdict: issuance-gated
      tier: T1
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
        - redact-secret/redact-secret#1013
      evidence: https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md
      researchedAt: 2026-09-29
    blockedBy: The vck_ marker is provider-backed but no full-length value is; the 56-character body rests on peer rules only (1 class). Needs ruling Q-VC or one AI Gateway key measured (checklist in redact-secret#1013).
---

# Vercel

Vercel's 2026-02-09
[changelog](https://vercel.com/changelog/new-token-formats-and-secret-scanning)
gave each credential type a prefix: `vcp` for personal access tokens, `vci` for
integration tokens, `vca` for app access tokens, `vcr` for app refresh tokens
and `vck` for API keys. The five classes are recorded as separate families. The
product's `vercel-token` detector reports all five under one compatibility
finding type; that shared type is not a research result for any of them.

## Verdicts (2026-09-29, corrected by redact-secret#1013)

The 2026-09-27 record (#858) called all five classes `not-found`, T0: the
prefixes identify the class and no provider statement gives a body grammar. A
wide re-research pass under #473 found full-length provider examples and peer
rules and first called all five `ready` at T2. The same day, redact-secret#1013
([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md)) verified that pass source by source and disagreed on two
classes: the corroborated route (at least 3 dated references, 3 distinct owners
and 2 non-summary classes, per
[the empirical-qualification spec](../../../docs/specs/empirical-qualification.md))
must be counted on the full grammar each class freezes, marker with underscore
plus 56, and for `vci_` and `vck_` the 56-character length comes from peer rules
only. This dossier follows #1013. No page *states* a grammar and no Vercel code
generates or validates a length, alphabet or checksum, so none is T1.

| Family | Verdict | Tier | Corroborated-route count (references / owners / non-summary classes) |
| --- | --- | --- | --- |
| `vercel:access-token` | `rejected` | none | Not a family: the product's compatibility aggregate for the `vercel-token` detector. Nothing to corroborate. |
| `vercel:personal-access-token` | `ready` | T2 | 4 / 4 / 2 (3 / 3 / 2 without Betterleaks): CLI `--token` provider example, Kingfisher, Betterleaks, CredSweeper |
| `vercel:app-access-token` | `ready` (thin) | T2 | 3 / 3 / 2: the Sign in with Vercel provider example, Kingfisher, Betterleaks; both peer rules copy the provider value |
| `vercel:app-refresh-token` | `ready` (thin) | T2 | 3 / 3 / 2 as `vca_`; the docs reuse the `vca_` body, so there is no independent `vcr_` body |
| `vercel:integration-token` | `issuance-gated` | T1 (stem only) | 3 / 3 / 1: Kingfisher, Betterleaks, secretlint. No provider source writes `vci_` with the underscore |
| `vercel:api-key` | `issuance-gated` | T1 (marker only) | 3 / 3 / 1 for the length: Kingfisher, Betterleaks (secretlint is marker-only). The `vck_` marker is provider-backed; no full-length value is |

A provider page that shows only a marker (`vck_...`, a mask, the changelog stem)
or a short test dummy corroborates the marker, not the 56-character body, so it
does not count toward the length. Maintainer ruling Q-VC (treat the five classes
as one generator, so the `vca_`/`vcp_` structure extends to `vci_`/`vck_`) or one
issued value each would make `vci_` and `vck_` `ready` at T2.

Findings from #1013 that change the earlier pass:

- **The 50 + 6 checksum is provider-backed on one value.** The `vca_` example
  on the Sign in with Vercel Tokens page passes Kingfisher's check (the last
  6 characters are base62 of the CRC-32 of the 50 before them; a chance match
  is about 1 in 5.7×10¹⁰), and Vercel's OpenAPI spec calls `tokenSuffix`
  "The token checksum suffix". Backed on one value only, so not frozen.
- **The `vca_`/`vcr_` example predates the changelog** (Wayback 2025-11-28;
  changelog 2026-02-09).
- **The CLI `vcp_` example is hand-written.** Its body ends in a literal
  English word and fails the checksum. It still shows a 56-character body as
  an example shape.
- **Peer rules are less independent than counted.** Kingfisher's `vca_` and
  `vcr_` examples copy the Vercel docs value, its `vcp_`, `vci_` and `vck_`
  examples are synthetic values that pass its own checksum, and Betterleaks
  copies all six Kingfisher examples. CredSweeper's `vcp_` samples fail the
  checksum, so CredSweeper is independent of Kingfisher.
- **No provider source writes `vci_`**: not the docs (`llms-full.txt` has no
  `vci` at all), the OpenAPI enums (`vcp_`, `vca_`, `vcr_` only), the SDK or
  org code. For `vck_` the underscore is provider-backed.
- **Provider masking regexes admit `_` and `-`** (Azure DevOps extension
  `vcp_[A-Za-z0-9_-]+`, `vca_[A-Za-z0-9_-]+`; CLI eval `vcp_[A-Za-z0-9_]+`).
  They are maskers with no length, so the alphabet stays bounded, not settled.

## Shape the T2 verdict freezes

Grammar in words for the three `ready` classes (`vcp_`, `vca_` and `vcr_`, each
with a provider length example). `vci_` and `vck_` would take the same grammar
under ruling Q-VC; until then it is a candidate, not a frozen shape:

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
- **The checksum.** Kingfisher states it (the last 6 characters are the
  base62-encoded CRC32 of the 50 before them), the one checksum-valid provider
  value (`vca_`) and the OpenAPI `tokenSuffix` description support it, and the
  hand-written CLI `vcp_` example fails it. Backed on one provider value, so
  neither the checksum nor the 50 plus 6 split is frozen, and neither is
  required for `vcp_`, `vci_` or `vck_`.
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
   copies Kingfisher's example values, and Kingfisher's `vca_`/`vcr_` examples
   copy Vercel's.** They count as two owners in one class, so `vci_` and `vck_`
   length rests on the peer class alone (1 class < 2) plus the shared-generator
   inference that ruling Q-VC would have to accept.

## Families

### `vercel:access-token` — Compatibility aggregate (unreviewed Vercel token shapes)

- **Verdict:** `rejected`: not a family. The row is the product's compatibility
  aggregate, the routing label for the `vercel-token` detector that reports
  every Vercel class under one finding type (redact-secret#1013 agrees), and
  its taxonomy note says it is not a credential family. There is no shape to research for the row itself. Its profile cells
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
| [Vercel CLI global options](https://vercel.com/docs/cli/global-options) | vercel | provider-example | one `vcp_` + 56-character letters/digits value printed twice (first seen 2026-05-10); hand-written (ends in an English word, fails the checksum), so an example shape, not a generated value |
| [Vercel Access tokens](https://vercel.com/docs/accounts/access-tokens) | vercel | provider docs (marker only) | marker `vcp_`; masked filler is a placeholder, not a value; does not count toward the length |
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
- **Current contract in core:** [`detector-families.md`](https://github.com/redact-secret/redact-secret/blob/main/docs/specs/detector-families.md).
  Since product #1036 (PR #1039, merged to main, unreleased) `vcp_` + exactly 56
  `[A-Za-z0-9]` is reported as its own finding type at T2, and #1042 (PR #1045)
  exempts the listed one-character-run placeholders. `vci_` and `vck_` stay under the
  unqualified `vercel_token` compatibility type until ruling Q-VC.

### `vercel:integration-token` — Integration token

- **Verdict:** `issuance-gated` (redact-secret#1013). The changelog prints only
  the stem `vci`; no provider source writes `vci_` with the underscore or
  shows a value. The underscore, the 56-character length and the alphabet come
  from peer rules (Kingfisher, Betterleaks, secretlint), one class, so the
  corroborated route fails on classes (3 / 3 / 1). GitHub's
  `vercel_integration_access_token` type names the class, not a shape.
- **Candidate shape (not frozen):** `vci_` plus 56 characters, as the sibling
  classes with provider examples. Frozen only if ruling Q-VC accepts one
  generator for all five classes, or once one issued token is measured.
- **Issuance:** create an integration and run the OAuth code exchange; record
  structure only (marker with `_`, total length 60, body alphabet, whether the
  last 6 characters are base62(CRC-32) of the previous 50), then revoke.
- **Gap:** the Building Integrations page (updated 2026-09-16) still shows
  unprefixed 24-character `access_token` and client values in its code-exchange
  examples: legacy or stale, as with the REST example. Whether OAuth code
  exchange now returns `vci_` tokens is undocumented.

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

- **Verdict:** `issuance-gated` on length (redact-secret#1013). The `vck_`
  marker with its underscore is provider-backed: the AI Gateway API Keys doc
  and `vercel ai-gateway` CLI doc show `vck_...` and the mask `vck_` + 4 dots
  + 4 digits, and CLI, AI SDK and Terraform tests use short `vck_` dummies.
  None shows a full-length value, so the 56-character body rests on the peer
  class alone (Kingfisher, Betterleaks; secretlint is marker-only): 3 / 3 / 1.
- **Candidate shape (not frozen):** `vck_` plus 56 characters. Frozen under
  ruling Q-VC, or once one AI Gateway key is measured (the cheapest check:
  create one key in the dashboard; structure only, then revoke).
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
3. Is the trailing CRC32 real for every class? The one checksum-valid provider
   value (`vca_`) and the OpenAPI `tokenSuffix` description say yes for that
   class; the hand-written CLI `vcp_` example fails it.
4. Do OAuth integration code exchanges return `vci_` tokens, and do the five
   classes share one generator (ruling Q-VC)?
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

- redact-secret#1036 and #1042 (2026-09-30 status comment on #1013) — product changes that followed this
  record: the per-class split for `vcp_`, `vca_` and `vcr_` (#1039) and the placeholder exemption (#1045),
  merged to main and unreleased.
- redact-secret#858 — splits the five classes and records them pending, T0;
  corrects #516 in three places (inferred `vci_`, a "conservative" 20-character
  floor, and a resolved unprefixed 24-character surface). Closed 2026-09-27.
- redact-secret#516 — original taxonomy audit; issue text read, no comments.
- redact-secret-benchmarks#367 — 2026-09-26 source ledger that found the
  changelog and the REST contradiction.
- redact-secret-benchmarks#373 — benchmark counterpart, blocked on #858;
  closed 2026-09-27 with the classes split and no positive manufactured.
- redact-secret#1013 — 2026-09-29 source-by-source verification
  ([evidence](https://github.com/redact-secret/redact-secret/blob/add1188fed9993723c59fbce8c867086b9d2049a/docs/audits/evidence/1013/vercel.md)): `vcp_`, `vca_`, `vcr_` ready T2; `vci_` and `vck_` fail
  the class count on length and go back to `issuance-gated` pending Q-VC;
  checksum provider-backed on one value.
- 2026-09-29 — wide re-research under #473 (this record): found the CLI
  `--token` and Sign in with Vercel full-length examples, three peer rule sets,
  and provider code for the prefix-to-class mapping. Verdict changes: five
  families `not-found` T0 to `ready` T2; `vercel:access-token` `unresearched`
  to `rejected`.
