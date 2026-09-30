---
decision_id: decision-family-fixture-counting
status: accepted
scope: benchmarks
title: Count a fixture in every family it is related to, once per provider, and recount per evidence level
decided_at: 2026-09-30
---

# Count a fixture in every family it is related to, once per provider, and recount per evidence level

## Context

#560 (part of #543). The new report pages count fixtures per provider and per
family (`web/resolvers/families.ts`). The existing report tree
(`src/pages/report-hierarchy.ts`) counts them another way: a fixture with exactly
one family is in that family, and a fixture with several families or none goes into
one shared "Global / multi-family" bucket. Both were designed to show a fixture
once; they answer different questions, and the difference was undecided.

Measured on the committed index (5,925 fixtures): 116 fixtures have several
families (24 have two, 79 have three, the rest four to eight), 135 have none (all
`must-not-flag` controls with a reviewed `unscopedReason`), so the tree's shared
bucket holds 251. 40 of the 173 families get a different count under the two
rules, and `mailgun:public-validation-key` and `mailgun:legacy-signing-key-triplet`
have only multi-family fixtures: the tree shows them with no fixtures, the new rule
shows 46 each. A family page that says "No fixtures" for a family with 46 reviewed
relationships would be a false statement about the ledger.

The mockups also show one count per family across all levels, while the existing
report groups by evidence level, and no per-level family count exists in any output.

## Decision

1. **The new rule is the counting rule.** A fixture counts in every family it is
   related to; once per provider (a provider count is distinct fixtures); a fixture
   with no family is in no family or provider row and is a footnote count. The
   relationship is a reviewed fact about the fixture (the semantic index), not a
   choice of the report, so the report states it for each family it names rather than
   dropping the fixture to a bucket. It is written once, in
   `docs/specs/taxonomy.md` ("Counting fixtures per family").
2. **The existing tree is not changed.** It is published output, and its
   one-leaf-per-fixture invariant is a reconciliation device (its leaves must add up to
   the fixture total), not a family claim. The two agree exactly on every fixture with
   exactly one family; they differ by the multi-family fixtures only. The difference is
   pinned by `tests/family-counting.test.mjs`, which asserts `new count = tree count +
   multi-family fixtures related to the family` for every family. When the tree is
   retired at cutover, only the rule remains.
3. **Per-level family counts are shown.** The data is in the fixtures (each has one
   evidence level) and the run rows, so the resolver recounts a list at one level
   with the same rule (`resolveFamilyList(catalog, rows, level)`), and the provider and
   family lists get an "Evidence level" control (`?level=T1|T2|T3|T0`, default all
   levels). The levels partition a family's fixtures, so the counts add up to the
   all-levels count. The whole set of levels is pre-rendered and the client island picks
   one, like `?show=`; a family opened from a level list keeps `?level=` and shows only
   that level's rows. A family with no fixtures at a level reads "No fixtures", never
   zeros.

## Consequences

- Provider and family counts for multi-family fixtures differ from the existing
  report. A reader who compares the two sees the difference stated on the spec, not
  a silent mismatch.
- The family counts add up to 6,024 memberships for 5,790 fixtures with a family
  (5,674 single-family and 116 multi-family fixtures counted in every family they
  have), so a page never totals family rows; a provider count is distinct fixtures.
- `check:routes` compares the built family pages with this rule read independently
  from the committed index.
- Rejected: making the existing tree follow the new rule (changes published output and
  breaks its reconciliation), and hiding multi-family fixtures from family rows to keep
  the two views identical (drops evidence a family has).
