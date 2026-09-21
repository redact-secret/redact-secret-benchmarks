# Check that no fixture pair may be lexically inseparable

Date: 2026-09-21 · Status: accepted

## Context

[Issue #84](https://github.com/redact-secret/redact-secret-benchmarks/issues/84)
triaged the whole corpus by hand: 462 positive spans against 297
credential-like `must-not-flag` tokens, flagging a pair when their lexical
shape was identical and no frozen contract pattern in
`benchmarks/lib/assessment.ts` separated them. 30 pairs survived. A follow-up
comment on the issue corrected the one pair first read as a true contradiction
(`openai-token-legacy-*-twin` vs `openai-token-shape-1-bare`): the two
fixtures are in different assessment classes — `policy/T3` and a
contract-scoped `must-not-flag/T2` — and a policy-layer finding is satisfied
beneath the contract, never in conflict with it. Nothing catches this class of
defect today; #82 (already resolved) was found only because a peer scanner
happened to detect the shape this repo's own corpus missed.

## Decision

1. **`fixtures:check` runs an automated version of the triage**
   (`benchmarks/lib/lexical-separability.ts`, wired into
   `scripts/generate-fixtures.mjs` unconditionally, so it also runs on plain
   `fixtures:generate` and `--ensure`). It fails the build the same way
   `validateContracts`/`validateAssessment` already do.
2. **Two fixtures are only compared when a single detector, at a single
   contract, would have to reconcile them.** The positive's `kind` must be
   `must-redact` at a scored tier (never `policy` — restated from the issue's
   correction above), and the negative must declare the *same* `contract` — a
   twin scoped to family A says nothing about family B firing. This alone
   resolves every pair the issue's original triage called "context-discriminated"
   or "documented-example vocabulary reached via a differently-scoped
   negative": those families' positives are `policy/T3` in this corpus today,
   so they were never eligible for comparison once the scoping is enforced.
3. **"Lexically inseparable" means the negative's raw content contains an
   isolated occurrence of the contract's frozen `pattern`,** searched
   unanchored (not extracted from a declared span, since a `must-not-flag`
   fixture asserts none exists) but boundary-gated: a match immediately
   continued by another identifier character (`[A-Za-z0-9_-]`) on either side
   does not count. The `*-identifier-embedding` controls (#64) glue a
   fully-formed, contracted token directly into a wider identifier with no
   delimiter — exactly the `confirmed-boundary-false-positive` shape the
   product scanner is deliberately boundary-gated against — so an embedded
   occurrence is the control's whole point, not an unresolved collision.
   Structural contracts (`private-key`, `jwt`) have no `pattern`; they are
   verified by parsing (`validate-structures.ts`) and are out of scope here.
4. **An unavoidable collision is recorded, never inferred**:
   `assessment.lexicalExemption: { reason, citation }` on the negative.
   `validateLexicalExemptions` rejects a missing reason or citation, an
   exemption on anything but a `must-not-flag` fixture, and — to keep
   exemptions from rotting — an exemption on a fixture that no longer actually
   collides.
5. **The underlying authoring rule for twins is unchanged and now checked**:
   a twin's mutation axis is valid only when the mutated value falls outside
   every format the provider issues, and a twin constrains only its own
   contract family.

## Outcome on today's corpus

Re-running the check (`tests/lexical-separability.test.mjs`, "today's full
generated corpus has zero unexplained lexically inseparable pairs") finds
**zero violations**, none of them via an exemption — every one of the issue's
30 surviving pairs is explained by kind/contract scoping or by the
boundary-gated identifier-embedding rule above, matching the issue's own
corrected read that the corpus holds no true contradiction. The exemption
field exists as infrastructure for the day a real one shows up (e.g. AWS's own
`AKIAIOSFODNN7EXAMPLE`), not because today's corpus currently needs it.

Building the checker also surfaced one real, independent defect:
`supabase-management-token-invalid-alphabet` mutated its body with a
conditional `.toUpperCase()`, which no-ops when the targeted byte lands on a
digit (`[a-z0-9]`'s digits have no case). The synthetic seed happened to land
on a digit, so the control silently satisfied its own contract's frozen
pattern. Fixed in `fixtures/generated/detector-coverage.mjs` by inserting a
literal `"A"` unconditionally, the same technique the versioned-shape alphabet
twin next to it already used.

## Consequences

- A future family's `pattern` is now load-bearing for more than positive
  classification: an over-loose pattern (like `aws-access-key`'s
  `^AKIA[A-Z2-7]{16}$`, which does not cover `ASIA`) can quietly let an
  otherwise-innocuous-looking negative collide with a differently-scoped
  positive once both exist. The check only ever compares within one contract,
  so this is caught at authoring time, not release time.
- Any future conditional-mutation helper (`.toUpperCase()`, `.replace()` on a
  matched class) should prefer unconditional literal insertion, per the fix
  above — a mutation that can no-op on some seeds is a corpus defect waiting
  to happen, not just here.
