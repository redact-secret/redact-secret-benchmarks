# Review the sk_org_/whsec_/xwfp_/lin_oauth_/vercel-token/supabase-token pending fixtures now that redact-secret#512/#513/#515/#516 are closed (#127)

Date: 2026-09-22 · Status: accepted · Extends: `2026-09-22-settle-differential-disagreements-on-pending-fixtures.md` §4,
which explicitly left this review out of scope; follows `#45`'s contract-review procedure

## Context

#125 settled 120 `differential.t0-pending-fixture` rows (60 candidate-keyed,
60 published-package-keyed; both peers × 30 fixtures across `stripe-token`
`sk_org_`/`whsec_`, `slack-token` `xwfp-`, `linear-token` `lin_oauth_`,
`vercel-token` and `supabase-token`) as not-assertable, because three of the
five families' pending reasons named a redact-secret product issue
(`redact-secret#512`, `redact-secret#513`) as the thing being waited on, and
by 2026-09-22 all four relevant product issues had closed:
`redact-secret#512` (PR #532), `#513` (PR #533), `#515` (PR #535), `#516`
(PR #536). #127 asks this repository to re-read its own ground truth now
that the product side has answered, per `#45`'s procedure and this
repository's boundary rule (`AGENTS.md`): scanner or product adoption is
never evidence on its own.

## Independent provider re-verification (2026-09-22)

Each family's provider page was re-fetched live, independently of what the
four closed product PRs cite, before touching any contract:

| family / shape | page(s) checked | body length or alphabet documented? |
| --- | --- | --- |
| `stripe-token` `sk_org_`, `whsec_` | `docs.stripe.com/keys` (key-types table, names `sk_org_...`), `docs.stripe.com/webhooks` (states `whsec_` prefix, shows only the literal placeholder `whsec_...`) | No — prefix only, for either shape |
| `slack-token` `xwfp-` | `docs.slack.dev/authentication/tokens` — "Workflow token strings begin with `xwfp-`." | No — prefix only |
| `supabase-token` `sb_secret_`/`sb_publishable_` | `supabase.com/docs/guides/api/api-keys` — shows `sb_publishable_...` / `sb_secret_...` as prefixed rows only | No — prefix only |
| `vercel-token` `vcp_` (and siblings by extension) | `vercel.com/docs/accounts/access-tokens` — "Personal access tokens begin with the prefix `vcp_`", shows only the masked placeholder `vcp_xxxxxxxxxxxxxxxxxxxxxxxx` | No — prefix only, placeholder is redaction filler, not a generated example |
| `linear-token` `lin_oauth_` | product's own `redact-secret#570`/`#571` history (`lin_oauth_` kept an unevidenced open-floor guard after `#551`'s attempt to tighten it into an exact length regressed real tokens) | No — re-confirmed unchanged, no independent Linear OAuth grammar page found |

No page, for any of the five shapes, states a body length or alphabet. This
matches — and independently confirms — what each closed product PR itself
found when it adopted (or declined to adopt) the shape:

- **`redact-secret#513` (PR #533)**: added `sk_org_`/`whsec_` on the
  key-types/webhooks pages' prefix documentation alone; the PR's own code
  comment records a 20-byte alnum-run floor as "this family's existing
  support-policy choice, not independently evidenced for these two
  prefixes."
- **`redact-secret#512` (PR #532)**: completed `xoxp-`/`xoxe-`/`xoxe.xoxb-`/
  `xoxe.xoxp-` on tool-corroborated section grammar, but left `xapp-` and
  `xwfp-` an unpromoted interim guard: `xwfp-` "has no tool source at all,"
  clearing neither the two-source nor the provider-plus-tool bar.
- **`redact-secret#515` (PR #535)**: split `sbp_`/`sbp_v0_` into an
  independent `supabase-management-token` detector, but left `sb_secret_`'s
  `at_least(20, is_alnum_dash)` shape unchanged, naming two
  mutually-contradictory unmerged third-party proposals for the body length
  as its own reason not to fabricate one.
- **`redact-secret#516` (PR #536)**: a dedicated taxonomy audit
  (`docs/audits/evidence/516/README.md` in the product tree) that authored
  no detector at all: all five Vercel prefix classes stay `pending`, "no
  source — provider or tool — states a body length or alphabet."
- **`redact-secret#570`/`#571`** (not named in #127, found while re-checking
  the product tree for `linear-token`): `#551` briefly turned `lin_oauth_`'s
  open floor into an exact length on the same tool-agreement grounds used
  elsewhere in the crate; `#570` found that regressed real OAuth tokens
  (nothing enforces a maximum), and `#571` restored the open, unevidenced
  floor. Confirms, rather than resolves, the pre-existing gap.

## Disposition: all five stay pending, per outcome 2

Per #127's own two-outcome framing, every one of the five shapes stays
`pending`/T0 in this corpus: the product adopted (or continued to track) each
one on provider-prefix documentation alone — or, for `sk_secret_` and
`vercel-token`, on prefix documentation without even a shipped detector rule
— never on a documented body grammar this repository's own bar requires.
Raising a tier because a scanner (including the product's own) now detects
the shape would be exactly the inference `AGENTS.md`'s boundary rule and
`#45` forbid.

What changed is **only** the pending reason text in
`benchmarks/lib/assessment.ts` (`classifyFixture`'s `detector-coverage`
branch for `stripe-token`/`slack-token`, and the `contracts['supabase-token']`
/`contracts['vercel-token']` entries): each now names the closed issue and
its PR, states plainly that the product's own adoption is prefix-only
evidence, and restates this corpus's unmet bar — instead of pointing at
`redact-secret#512`/`#513`/`#515`/`#516` as something still being waited on,
which is no longer true. `linear-token`'s reason cited no product issue
before and needed no such rewrite; it now also records the `#570`/`#571`
re-check so a future reader does not have to re-derive that the gap is
unchanged. `validateContracts()` and the full assessment/detector-coverage
test suite (354/354) pass unchanged.

## Differential resweep (the #105/#120/#125 pattern)

Editing `detector-coverage`'s per-fixture assessment reasons changes
`fixtures/generated/detector-coverage.mjs`'s built corpus content, so
`cases.ts`'s `sourceHash = hash(corpus)` for that one category changes, and
every differential/twin/metamorphic id sourced from it re-keys — regardless
of which specific fixture's reason text moved, because the hash covers the
whole category. Confirmed by measurement, both keyings, with
`trufflehog --version` printing `3.97.4` from
`/opt/homebrew/Cellar/trufflehog/3.97.4/bin/trufflehog` immediately before
each run (this machine's default `trufflehog` on `PATH` is 3.97.5 and was
not used):

| queue | ids re-keyed | pure re-key (identical comparison, only the id moved) | newly distinguishable (fixture hash changed too) |
| --- | --- | --- | --- |
| published-package (`queue:check`'s keying) | 353 | 293 | 60 |
| candidate (`--candidate-*`, product `8838b91e`) | 345 | 285 | 60 |

Every id was checked mechanically, the same way D1/D2/D7/#98/#105/#120/#125
did it: for each of the 638 re-keyed ids, the case identity
(`category--fixtureId--method`) and the full comparison payload (scanner
observations, classifications, peer tool versions/configuration — everything
the id hashes except the category `sourceHash` and, for the 60-per-queue
subset, `evidence.input.fixtureHash`) were matched byte-for-byte against
their pre-edit counterpart. Where the match was exact, the prior ledger
row's `status` and `note` were carried over verbatim to the new id: the
underlying redact-secret/peer disagreement is unchanged, only its id moved.
Where `evidence.input.fixtureHash` also changed (the fixture's own
`assessment.reason` is part of what that hash covers) — exactly the 30
fixtures × 2 peers × 2 keyings = 120 rows across the five families this
issue reviews — the prior row was still `not-assertable` under
`decision=differential.t0-pending-fixture` (#125, §4 of the linked record),
and every one of these fixtures is still tier T0 today, so the same class
applies unchanged; those 120 rows were re-recorded under their new ids with
that class, citing this record instead of #125's.

**Fate of the 120 rows this issue's review touches**: 0 became adjudicable
(no shape moved out of T0, so no tier decision exists to adjudicate a
disagreement against); all 120 re-landed `not-assertable` under
`Class: decision=differential.t0-pending-fixture`, with the same reasoning
#125 recorded. No new decided class was needed.

`benchmarks/review-ledger.json`: 5,378 → 6,076 entries (698 added: 353
published-package + 345 candidate; 0 removed). `npm run queue:check` (the
CI job's published-package keying) and `npm run decisions:validate` both
pass against the updated ledger; a direct check of the candidate-mode queue
(there is no packaged `queue:check` for candidate mode) confirms 0
unresolved ids there too.

## Fresh `eval:classify` under redact-secret-benchmarks#572's conditions

```
product              redact-secret main @ 8838b91e99d822420a644c0e487bdd3a217c904d, clean
candidate artifacts   built from that commit by this repo's own buildCandidate steps (scripts/benchmark-candidate.mjs):
                      core   a8f7abedfff82b41f33264ff5e7f31326f8280b818d66644139a8a6ddd233ed7
                      wasm   bb28b62f45c896ca3ff0c2724141ba602703cc687759455ede1a3f6406d6495c
                      (both identical to the #125 record, confirming a reproducible build)
                      node   590b182774f1031346a97a3818abc6fda9c11bbd42837179df450e3a7df99a1c (darwin-arm64; not
                      reproducible across builds per the #125 record, recorded per run)
peer scanners         gitleaks 8.30.1, trufflehog 3.97.4 (/opt/homebrew/Cellar/trufflehog/3.97.4/bin first on
                      PATH; confirmed by `trufflehog --version` immediately before each run)
benchmarks revision   f93dc92940b5c3924a7a5e19c8e04f079dbc5a15, dirty (this record's own uncommitted changes)
```

| run | mode | runId | distribution |
| --- | --- | --- | --- |
| candidate (#572 conditions) | `--candidate-*` | `74b47383-c123-450b-af78-ba61ddcd627d` | `{"stable":17,"provisional":27,"pending":2,"unsupported":0}` |
| published package `0.1.0-beta.5` | default | `33340a9e-0e4b-4ca5-a8f5-6b59e8521987` | `{"stable":13,"provisional":31,"pending":2,"unsupported":0}` |

Both distributions exactly reproduce the #125 record's own final numbers,
confirming the resweep changed no family's status — only this issue's five
pending reasons changed, and none of the five families' shapes moved tier.

Per-family status in the candidate run (the four families named `#127`,
`linear-token` included though its reason text was unchanged):

| family | status | positive-contract tier | `differentialUnresolvedContractDisagreements` |
| --- | --- | --- | --- |
| `stripe-token` | stable | T1 | 0 |
| `slack-token` | stable | T1 | 0 |
| `linear-token` | provisional | T2 | 0 |
| `vercel-token` | pending | T0 | 0 |
| `supabase-token` | pending | T0 | 0 |

`stripe-token` and `slack-token` read `stable` on their existing T1
contracts (`sk_/rk_` and `xoxb-`); the `sk_org_`/`whsec_` and `xwfp-` shapes
this record reviews are separate, still-pending shapes within those
families and do not block the family's status, the same relationship #45
already established for every other multi-shape family in this corpus.
`vercel-token` and `supabase-token` are wholly T0 (every shape pending), so
the family itself reads `pending`. `linear-token` was already `provisional`
on its T2 `lin_api_` contract before this review and is unaffected;
`lin_oauth_` remains the family's own separate pending shape.

## Result

- None of the five families' pending reasons in `benchmarks/lib/assessment.ts`
  points at a closed product issue as the thing being waited on; each states
  its own unmet bar (a documented body length or alphabet, or a pinned tool
  registration) and, where applicable, names the closed issue and PR that
  adopted the shape on lesser evidence.
- No shape moved out of T0: independent re-verification of the provider
  pages found the same prefix-only documentation the closed product PRs
  themselves found. `validateContracts()` and the assessment test suite
  pass.
- The differential resweep is complete under both keyings; `npm run
  queue:check` and `npm run decisions:validate` pass; `npm test` (354/354)
  passes.
- The 120 `decision=differential.t0-pending-fixture` rows this review
  touches: 0 adjudicated, 120 re-landed not-assertable under the same class,
  now under ids keyed to this record's corpus content.

## Explicitly out of scope

- Any product-side change. The five families' shapes remain product news,
  not something this repository fixes.
- Authoring a body-length/alphabet contract from an unmerged or
  self-contradicting third-party source (`supabase-token`'s two conflicting
  proposals, per `redact-secret#515`'s own PR) — fabricating a number here
  would trade a safe floor for an unverified one, the same call the product
  side already declined to make.
- The pre-existing, unrelated 276 stale `open · t0-pending-fixture` ledger
  rows no current queue produces (#125 already left these alone; this
  record does not touch them either).
