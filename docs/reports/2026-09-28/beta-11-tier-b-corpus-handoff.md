# Beta.11 #860 Tier B credential corpus handoff (#436)

Issue [#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436); product parent
[redact-secret#860](https://github.com/redact-secret/redact-secret/issues/860), counterparts
[#912](https://github.com/redact-secret/redact-secret/issues/912) (Convex),
[#913](https://github.com/redact-secret/redact-secret/issues/913) (1Password),
[#914](https://github.com/redact-secret/redact-secret/issues/914) (Inngest),
[#915](https://github.com/redact-secret/redact-secret/issues/915) (Resend),
[#916](https://github.com/redact-secret/redact-secret/issues/916) (Apify) and
[#917](https://github.com/redact-secret/redact-secret/issues/917) (W&B). Sibling: #434 (Tier A).
Layout and conventions: [`docs/specs/beta8-evidence.md`](../../specs/beta8-evidence.md#beta11-tier-b-slices-436).
The candidate measurement is [`evidence/860/436/README.md`](../../../evidence/860/436/README.md).

This record measures and records; it asserts no product output and moves no support status. Every value
is built at generation time from a public `synthetic` seed; nothing is copied from a provider example,
scanner test vector or issued key, and the finished credential shapes exist only in the gitignored
generated corpus (`npm run fixtures:generate` writes `fixtures/generated/beta8-436a.json` to
`beta8-436f.json`). The only committed literals are the six static calibration rows in
`corpora/development/shadow-scoring-authored.json`, written with the first-character `\u` escape.

## Inputs

- Contracts: the #860 step-3 handoffs frozen at product
  [`54fe385`](https://github.com/redact-secret/redact-secret/tree/54fe385f718c884d7e3dde6b9756e2d70999ca91/docs/audits/evidence/860)
  (`convex.md`, `onepassword.md`, `inngest.md`, `resend.md`, `apify.md`, `wandb.md`, `tier-b-rerank.md`), and the
  orchestrator decision on #917 (W&B length is a tolerant range around 86). Product detector code was not read.
- Benchmark base: `develop` at `d09a25a`. Registry pin (`benchmarks/detectors.json`) unchanged.
- Peers for every measurement here: gitleaks 8.30.1 and trufflehog 3.97.4, provisioned by `npm run peers:provision`
  (checksum-verified, read-only `.peer-bin`). Redact Secret: published `@redact-secret/core` 0.1.0-beta.10. Mode: published.

## Contracts and shapes

All six are T1 unscored arrival families, declared `documented-24`, keyed by the product detector id so they
graduate on a re-pin.

| Family (arrival id) | Supported shape | Not asserted either way |
| --- | --- | --- |
| `convex-deployment-key` | optional `prod:`/`dev:` + cloud name or `preview:`/`project:` + two slugs, the name, one `\|`, `01` + even 74–96 lowercase hex; span is the whole key | cloud `eyJ2` body (issuance-gated, R4); names or slugs outside the bounded class; the `prod;` and leading-glue twins (the remainder after `;`/`:` is itself a valid untyped key, #84) |
| `onepassword-service-account-token` | `ops_eyJ` + at least 250 Base64url bytes, `={0,2}` inside the span | the account Secret Key; a trailing glue byte after a full body (#84) |
| `inngest-signing-key` | `signkey-prod-`/`-test-`/`-branch-` + exactly 64 lowercase hex | event keys; self-hosted bare hex |
| `resend-api-key` | `re_` + 8 + `_` + 24 alphanumerics | a one-case body (the product's mixed-case guard is policy, and a one-case value of the layout would satisfy the contract pattern) |
| `apify-api-token` | `apify_api_` + at least 20 alphanumerics (provider linter, R2) | a body over 128 (product streaming cap; the provider's own rule would flag it); `apify_ui_` Console tokens |
| `wandb-api-key` | `wandb_v1_` + `[A-Za-z0-9_]`, positives at 85, 86 and 87 in all | any length (no length twin); `wandb_v2_`; the legacy 40-hex key |

## Fixtures

Each family has 13 positives: the nine re-rank probe contexts (bare prose, `ENV=`, `export`, Bearer, `X-API-Key`,
JSON `"token"`, JSON `"api_key"`, SDK keyword argument, chat sentence) plus four handoff contexts. Every family meets
`documented-24` with no debt (`npm run beta8:profiles`).

| Family | Category | Total | Pos | Twin | Ctl | Handoff-specific positives |
| --- | --- | --- | --- | --- | --- | --- |
| `convex-deployment-key` | `beta8-436a` | 33 | 13 | 10 | 10 | Compose self-hosted admin key, `Authorization: Convex` curl, Actions `npx convex deploy`, MCP `env`; every typed lead; bodies 74, 76, 96 |
| `onepassword-service-account-token` | `beta8-436b` | 31 | 13 | 9 | 9 | Actions `env`, `op` CLI, Python SDK (`=`), MCP `env`; bodies 250, 627, 630, 866; `==` padding |
| `inngest-signing-key` | `beta8-436c` | 32 | 13 | 9 | 10 | `_FALLBACK` `.env`, `new Inngest({ signingKey })`, hashed-form Bearer curl, Vercel env pull; all three labels |
| `resend-api-key` | `beta8-436d` | 33 | 13 | 11 | 9 | `new Resend(...)`, `resend.api_key =`, MCP `env`, Bearer curl |
| `apify-api-token` | `beta8-436e` | 30 | 13 | 7 | 10 | `new ApifyClient({ token })`, `ApifyClient("...")`, MCP `env` (128), Bearer curl; bodies 20, 36, 128 |
| `wandb-api-key` | `beta8-436f` | 27 | 13 | 6 | 8 | `wandb.login(key=)`, `.netrc` password, `local-` on-prem key (envelope), MCP `env`; split and unsplit bodies |

Another family's credential is a twin, never a control: the 1Password Connect JWT and the Resend `whsec_` secret.

## Published baseline and peer lag (exact-span outcomes)

`npm run bench -- --strict --refresh-peer-snapshots` at benchmark `1f9d3ca`, published mode. Baseline observations
for the product PRs to move, not expectations; the arrival families are unscored.

| Family | redact-secret 0.1.0-beta.10 (pos exact / twins flagged / ctl flagged) | gitleaks 8.30.1 pos exact | trufflehog 3.97.4 pos exact |
| --- | --- | --- | --- |
| `convex-deployment-key` | 3 / 13 (1 partial), 4 / 10, 0 / 10 | 0 / 13 | 0 / 13 |
| `onepassword-service-account-token` | 10 / 13, 6 / 9, 0 / 9 | 0 / 13 | 0 / 13 |
| `inngest-signing-key` | 9 / 13, 6 / 9, 2 / 10 | 8 / 13 | 0 / 13 |
| `resend-api-key` | 9 / 13, 8 / 11, 2 / 9 | 9 / 13 | 0 / 13 |
| `apify-api-token` | 8 / 13, 4 / 7, 0 / 10 | 9 / 13 | 11 / 13 |
| `wandb-api-key` | 7 / 13 (+1 covered), 3 / 6, 0 / 8 | 8 / 13 | 7 / 13 |

Peer lag: neither pinned peer has a Convex, Inngest or Resend rule. gitleaks' `1password-service-account-token`
rule uses the standard-Base64 class and matched none of the Base64url positives. trufflehog's Apify rule is an exact
36, so it misses the 20- and 128-byte positives. trufflehog's `wandb_v1_` rule (v2) is feature-gated off at 3.97.4.
The gitleaks hits on Inngest, Resend, Apify and W&B are generic-rule findings in named contexts.

Every flagged twin is another family's finding (generic-token, bearer-token), which scoring records as
co-detection. The flagged controls are handoff-listed placeholders that a generic layer reports by assignment
name: `Authorization: Bearer signkey-prod-<YOUR-SIGNING-KEY>` and `signingKey: "signkey-test-12345"` (Inngest),
`RESEND_API_KEY=re_123456789` and `resend.api_key = "re_yourkey"` (Resend). The corpus asserts silence there
because the handoffs do.

## Ledger

`benchmarks/review-ledger.json` gains 450 rows: 324 mechanical mutation rows under their decided operator
classes, and 126 differential rows recorded open (`differential-beta10-published-rebaseline`), because
0.1.0-beta.10 predates #912–#917 and cannot adjudicate them. Re-triage them against the merged product.

## Validation

At `1f9d3ca` (rebased on `develop` `d09a25a`): `fixtures:check`, `fixture-index:check`, `arrival:check`, `profiles:check`, `pins:manifest:check`,
`decisions:validate`, `ledger:decisions:check`, `ledger:provenance:check`, `queue:check`, `typecheck`,
`adversarial:check`, `tuning:check`, `scorer-promotion:check`, `support:check:ui`, `performance:*:check`,
`eval:validate`, `baseline:report`, `baseline:check-t3`, `build`, `features:check-public`, `blind:check-public`,
`eval -- --scanner=redact-secret`, `bench -- --strict` and the unit tests (992, including
`tests/beta11-tier-b-corpus.test.mjs`) pass. `eval:classify` in published mode reads 64 stable, 20 provisional,
2 pending of 86 families, identical per family to `develop` at `80a168b`.

## After the product PRs merge

1. Re-pin `benchmarks/detectors.json` to the merged product commit, graduate the six arrival ids
   (`docs/specs/beta8-evidence.md`, "Graduating an arrival family"), give each the `detector-coverage` minimum.
2. Re-triage the 126 open differential rows against the merged product.
3. Re-measure in candidate or published mode with pinned trufflehog 3.97.4, and state the mode.
4. Issuance checks named in the handoffs (Convex cloud body, W&B length, Apify width) would settle the
   unasserted properties above.
