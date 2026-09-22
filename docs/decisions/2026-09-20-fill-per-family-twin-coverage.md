---
decision_id: decision-fill-per-family-twin-coverage
status: accepted
scope: benchmarks
title: Fill per-family twin coverage below the stable threshold
decided_at: 2026-09-20
---

# Fill per-family twin coverage below the stable threshold

## Context

[Issue #46](https://github.com/redact-secret/redact-secret-benchmarks/issues/46)
builds on [#36](https://github.com/redact-secret/redact-secret-benchmarks/issues/36),
which put every detector family into exactly one twin-probe state (`discriminated`,
`not-discriminated`, `un-probeable` or `not-measured`) but only required *one*
twin per family. `docs/specs/support-status.md`'s `stable` criterion
(`benchmarks/support/status-criteria.json`) requires a T1, provider-documented
positive contract and at least five discriminated twin pairs; T2 and T3
contracts cannot reach `stable` regardless of twin count. **"A family targeting
stable" is therefore exactly the set of T1 contracts** — the only families this
project could ever certify — and #46 asks each of them to carry a twin per
structural dimension its provider source actually asserts, not just one.

Measurement protocol v4 §2.5 names five mutable dimensions a twin may violate:
prefix namespace, body length, alphabet, boundary character (which covers both
a delimiter/separator and an internal marker such as a checksum position) and
public-vs-secret prefix — exactly `MUTATION_KINDS` in `benchmarks/lib/assessment.ts`.
Issue #46's "separator" and "checksum/marker" are informal names for the
`boundary` axis, not new kinds; this work introduces no new `mutationKind`.

## Decision

Add a twin, per the table below, for every dimension each T1 family's
`providerSource` documents but no twin yet covered. Favor a real, differently
documented provider prefix over an arbitrary corruption when one exists
(precedent: `aws-access-key`'s `AIDA` twin); fall back to a corruption that
still breaks the family's shared stem when the documented alternative is
itself accepted by the pinned scanner (`gitlab-token`, `slack-token`, below).
Record a provider-documented dimension this project's single-property twin
methodology cannot construct — the checksum `github-token` and `npm-token`
document — as a method-level limitation on the contract's `review` field,
never as family-level `un-probeable`, since both families already carry a
discriminated twin on another dimension.

## The 14 T1 families

| Family | Dimension(s) asserted by the provider source | Twin(s) | Status |
| --- | --- | --- | --- |
| `aws-access-key` | prefix only (length/alphabet are tool-corroborated) | prefix (`AIDA`, #36) | complete |
| `github-token` | prefix | prefix (`github_pat_`, #46) | complete — see checksum note below |
| `gitlab-token` | prefix | prefix (`xlpat-`, #46) | complete |
| `shopify-token` | prefix | prefix (`shpxx_`, pre-#36) | complete |
| `vault-token` | prefix, minimum length | prefix (`hvx.`, #46) + length (pre-#36) | complete |
| `stripe-token` | prefix (including the public `pk_` namespace) | public-prefix (pre-#36) | complete |
| `slack-token` | prefix | prefix (`xoyb-`, #46) + boundary (pre-#36) | complete |
| `pypi-token` | prefix | prefix (`pypx-`, #36) | complete |
| `cloudflare-token` | prefix | prefix (`cfux_`, #46) + alphabet (pre-#36) | complete |
| `digitalocean-token` | prefix | prefix (`dox_v1_`, #46) + length (pre-#36) | complete |
| `npm-token` | prefix, delimiter | prefix (`npmx_`, #46) + boundary/delimiter (`npm-`, #46) | complete — see checksum note below |
| `sendgrid-token` | fixed length only | length (pre-#36) | complete |
| `private-key` | RFC 7468 labels | public-prefix (pre-#36) | complete |
| `jwt` | three base64url segments | boundary (pre-#36) + alphabet (`+`, #46) | complete |

Every T1 family now has a twin for every dimension its `providerSource`
documents. No family in this set is `unrecorded`, `not-measured` or
family-level `un-probeable` (the 14 structurally un-probeable families —
`vercel-token`, `supabase-token` and 12 others — are T0/T2 and were never in
scope here; #36 already dated and recorded each).

## The checksum dimension is provider-documented but not twin-constructible

`github-token` and `npm-token` both document a checksum (CRC32, Base62-encoded,
in the token's last six characters — github.blog's
"Behind GitHub's new authentication token formats" and npm's
"npm has a new access token format" changelog, both re-verified 2026-09-20).
A checksum-only mutation keeps the prefix, length and alphabet valid, so the
result still satisfies this project's `pattern` regex — which encodes shape,
never checksum validity — the same way a valid-shaped, wrong-checksum token
would still satisfy any shape-only scanner. `tests/assessment.test.mjs`
independently enforces this: every twin's content must fail the contract's
`pattern` on every line, and a checksum-corrupted body does not. The checksum
is recorded as provider-documented but outside what this project's
single-property-regex-violation twin methodology can express — a dimension-level
limitation of the method, not a family-level `un-probeable` (both families
already have a discriminated prefix twin from their other, twin-constructible
dimension).

## Two prefix twins needed a fallback mutation

Precedent (`aws-access-key`'s `AIDA` twin, `gitlab-token`'s `gldt-` deploy-token
type) favors using a real, differently-documented provider prefix over an
arbitrary corruption when one exists. Two attempts at that failed empirically
against the pinned `redact-secret` scanner (`npm run bench -- --category=common-formats`,
2026-09-20):

- `gitlab-token`: a twin using `gldt-` (GitLab's documented deploy-token prefix)
  was flagged — the scanner accepts more of the `gl-` stem than this contract's
  `glpat-`-anchored pattern. Replaced with `xlpat-`, which breaks the `gl-` stem
  every documented GitLab token prefix shares, and is discriminated.
- `slack-token`: a twin using `xoxp-` (Slack's documented user-token prefix) was
  flagged for the same reason against the `xox-` stem. Replaced with `xoyb-`,
  which breaks the stem, and is discriminated.

Both replacements are recorded on their contracts' `review` field with today's
date and the empirical reason, matching how #33 and #36 recorded a documented
dimension that turned out not to be independently testable.

## Reporting

Per-family twin coverage was already reported on `/coverage` (`twinProbeSection`,
`benchmarks/lib/twin-probe.ts`, #36) and per-family, per-dimension coverage was
already reported on each suite page ("Twin mutation axis, by family",
`src/pages/suite.ts`, pre-dating this issue). Both sections read live from the
fixture corpus and needed no code change; they now show the added dimensions
once the corpus is regenerated (`npm run fixtures:generate`) and the site
rebuilt (`npm run bench && npm run build`).

## Verification

`npm run bench` against the pinned `redact-secret` scanner (0.1.0-beta.5,
run `2026-09-21T00:01:27.207Z-1b5119`) shows every T1 family in this table at
`discriminated`, with strictly more discriminated pairs than before this issue
and no family that was previously `discriminated` regressing. The two
pre-existing `not-discriminated` families outside this issue's T1 scope
(`sendgrid-token`, 16/18, and `bearer-token`, T3, 0/3) are unchanged — neither
is touched by this work, and `bearer-token` cannot reach `stable` regardless
(T3, no provider source).
