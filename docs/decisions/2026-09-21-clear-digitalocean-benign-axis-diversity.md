# Clear `benign.minimumAxes` for the three DigitalOcean token families

Date: 2026-09-21 · Status: accepted · Extends: `2026-09-21-measure-benign-axis-diversity.md`, `2026-09-21-resweep-differential-queue-post-d1-d6-issue-98.md`

## Context

[Issue #105](https://github.com/redact-secret/redact-secret-benchmarks/issues/105)
targeted `digitalocean-token`, the shared detector behind all three
`digitalocean:*` taxonomy families (`oauth-token`, `personal-access-token`,
`refresh-token` — distinguished only by the `doo_v1_`/`dop_v1_`/`dor_v1_`
prefix over a common 64-hex body). Measured at this branch's base commit
(`eb66d48`), `npm run eval:classify` read `digitalocean-token` `provisional`
with a single reason:

```
benign.minimumAxes: 1 < 3 (axes present: near-miss)
```

`benignCases` was already 6 (above the floor of 5) — every one of them a
`near-miss` variant (`prefix-only`, `short-body`, `invalid-alphabet`,
`leading-/trailing-/dash-identifier-embedding`, all from #369). `#93`
(`2026-09-21-measure-benign-axis-diversity.md`) authored the missing
`placeholder`/`reference` axes for the 23 families that carried only a
same-axis near-miss pair, but `digitalocean-token` was never in that scope —
it already cleared `minimumCases` via #369's near-miss variants alone, so it
never appeared in #93's case-count-deficient list. It sat at `benignAxes: 1`
this whole time without anyone noticing, because the case-count floor and the
axis floor measure different things.

Every other gate was already clear on the base commit
(`twinFailures: 0`, `metamorphicCriticalFailures: 0`,
`mutationUnresolvedCritical: 0`, `differentialUnresolvedContractDisagreements: 0`),
confirming the issue's own framing: `minimumAxes` was the only remaining gate,
and the product-repo pin's `mutation.unresolvedCritical: 102` figure it warned
might be stale, was — the Epic D ledger sweeps already resolved it.

## Decision

Add three benign controls to `digitalocean-token` in
`fixtures/generated/detector-coverage.mjs`, mirroring the exact template #93
already applied elsewhere (`mask`/`label-prose` → `placeholder`,
`reference` → `reference`):

- `digitalocean-token-mask`: `doo_v1_` + 64 `*` characters (placeholder;
  instantiates the OAuth-token prefix, not `dop_v1_` again, since the
  detector's evidence is shared across all three taxonomy families —
  `familiesForDetector('digitalocean-token')` — so the axis controls need not
  be authored three times over one prefix to clear every family's gate).
- `digitalocean-token-label-prose`: documentation prose naming all three
  prefixes without embedding a token value (placeholder).
- `digitalocean-token-reference`: `DIGITALOCEAN_ACCESS_TOKEN=${DIGITALOCEAN_TOKEN}`
  (reference), matching `doctl`'s own documented environment-variable name.

This raises `digitalocean-token` to `benignCases: 9` across
`benignAxes: 3` (`near-miss`, `placeholder`, `reference`), clearing the gate
for all three `digitalocean:*` families at once, per the issue's own
instruction not to design the axis taxonomy three times.

## The differential-queue side effect, and why this PR is much bigger than three fixtures

`benchmarks/engine/cases.ts` hashes an entire corpus **category file** as
`sourceHash` (`hash(corpus)`), not per-fixture, and every differential
review-queue id embeds that hash
(`benchmarks/engine/execution.ts`: `hash({case: g.case.id, source:
g.case.provenance.sourceHash, ...entry})`). `digitalocean-token`'s three new
controls live in `detector-coverage.mjs`, the same category file that backs
**every** T1/T2 credential family's `detector-coverage` fixtures. Editing it
reshapes the differential id of every case sourced from that file, including
cases nothing about this change touched — exactly the effect
`2026-09-21-resweep-differential-queue-post-d1-d6-issue-98.md` and
`2026-09-21-produce-first-four-stable-families.md` already documented as "a
recurring, expected state."

First measurement after the three-fixture change: `npm run eval:classify`
read `{"stable":3,...}`, down from `{"stable":9,...}` on the base commit —
six of the nine base-commit `stable` families (`cloudflare-token`, `jwt`,
`private-key`, `shopify-token`, `stripe-token`, `vault-token`;
`gitlab-token`/`npm-token`/`sendgrid-token` stayed `stable`, unaffected)
dropped to `provisional` purely on `differential.unresolvedContractDisagreements`,
with zero change to their underlying fixture content. `aws-access-key` was
already `provisional` at the base commit for an unrelated reason, so it is
not a regression, but its reshaped ids are part of the same 355-id resweep
below. Mutation-method review-queue ids do **not** depend on `sourceHash`
(`v.provenance.fixtureHash = hash(f)` is per-variant, not per-category), so
only the differential queue was affected.

### Full resweep, not a scoped one

Fixing only the families that flipped `stable → provisional` would have left
every other `detector-coverage` family (most of which were already
`provisional` for unrelated reasons, so a reshaped, unresolved differential id
does not change their headline status) with an invisible, growing gap between
the corpus and the ledger — exactly the kind of silent accumulation
`scripts/check-review-queue-coverage.mjs`'s `npm run queue:check` CI gate
(#98) exists to catch. Running it after the fixture change failed with
**355** differential review-queue ids carrying no ledger row at all (0 passed
on the base commit).

Each of the 355 was verified mechanically — redact-secret's actual observed
spans on this run, compared byte-exact against the fixture's own authored
`expected` secret span(s), never assumed — the same method D1/D2/D7/#98 used:

- **308** matched an already-established template exactly and were marked
  `resolved`: `redact-secret-only/<peer>/range-matches-corpus` (290: peer
  reports no finding at all where redact-secret matches the corpus exactly),
  `peer-only/<peer>/range-matches-corpus` (11: redact-secret's silence
  matches the corpus's must-not-flag expectation, peer flags anyway),
  `range-disagreement/trufflehog/peer-measures-broader-span` (6: trufflehog
  reports the whole credential/URI construct as one span where the corpus's
  own authored span is the narrower inner substring — all six on
  `connection-string`'s `postgres`/`mongodb` variants), and
  `range-disagreement/trufflehog/peer-deduplicates-repeated-value` (1:
  `digitalocean-token-repeated`, trufflehog reports only one of two identical
  repeated occurrences).
- **47** did not verify against an established template and were recorded
  `open`, reusing #98's own two classes verbatim (same measured state, new
  ids only): `differential-coverage-gap/<family>` (39: `pulumi-access-token`
  18, `terraform-cloud-token` 15, `supabase-management-token` 3,
  `generic-token` 3 — redact-secret reports nothing while a peer matches the
  corpus's own authored expected span exactly) and
  `differential-boundary-unconfirmed/<family>` (8: `linear-token` 4,
  `slack-token` 4 — redact-secret flags a span the corpus's must-not-flag
  expectation does not assert, with no corroborating twin failure). This is
  the *exact* family/count breakdown #98 already recorded — confirming these
  47 are the same unresolved backlog reshaped, not new content this issue
  introduced.

No entry was resolved to make a gate pass: every `resolved` disposition
required redact-secret's own output to byte-exactly match the corpus's
authored ground truth first, matching #98's own rule.

## Verification

`npm run eval:classify` (base commit `eb66d48`, this branch): distribution
moved from `{"stable":9,"provisional":35,"pending":2,"unsupported":0}` to
`{"stable":10,"provisional":34,"pending":2,"unsupported":0}` of 46 families —
`digitalocean-token` is the only status change (`provisional` → `stable`,
empty `reasons`); every other family's status is byte-identical to the base
measurement. `npm run queue:check`, `npm run fixtures:check`,
`npm run pins:manifest:check`, `npm run decisions:validate`,
`npm run typecheck` and the full test suite (340/340) all pass.
`leakedSpanRate` is unaffected: this issue adds zero `must-redact` positives,
only `must-not-flag` controls, so no T1/T2 family's leak accounting changes.
