# Adopt measurement protocol v4

Date: 2026-09-17 · Status: accepted · Supersedes: schema-v3 cohort scoring

## Context

`docs/measurement-v4.md` identifies six defects in the v3 protocol: exact-range
equality as the only success, one `cohort` field carrying three questions,
positive-only precision exported and then disowned, format evidence sourced from
the competitors being measured, boolean containment hiding overbreadth, and an
overview that is a composite of different runs. The proposal was reviewed and
accepted. This record fixes the answers to its open questions (§8) and records
what the implementation changed beyond the spec.

## Decisions on the open questions

1. **Envelope granularity: per span.** An envelope is authored on the span it
   widens, with a reason. Per-fixture envelopes would let one rationale cover
   unrelated spans; the extra authoring is small because envelopes are built by
   the generators (`quoted()`, `uri()`).
2. **Collateral denominator: secret bytes.** `collateralBytes / secretBytes` is
   scale-free and grows without bound when a scanner reports a whole file,
   which is the behaviour we want visible. Dividing by file bytes would reward
   large fixtures.
3. **Two findings straddling one secret are `PARTIAL` and leaked.** Confirmed.
   Two separate redactions do not guarantee one covered secret; a redaction
   product should not be credited for it. Consequence: the leaked span rate
   counts outcomes `PARTIAL` and `MISS`, so a perfectly straddled secret is a
   leaked span with zero leaked bytes. The byte rate stays the honest
   secondary number.
4. **T2 comparability: compare within T2, tier visible.** T2 groups are rendered
   the same way as T1 with the tier badge and chip filter; hiding them would
   remove the only view of formats no provider documents. Cross-tier
   comparison stays impossible by construction.
5. **Policy on the overview: yes, as its own section.** Policy rows are a third
   section under a "project policy · never merged with must-redact" label. A
   tab would hide the largest single group of authored expectations.

## Decisions made during implementation

- **T1 means the provider documents the prefix scheme the contract requires.**
  Where the provider documents only the namespace and the body length or
  alphabet comes from tool rules, the contract stays T1 and records what the
  provider actually establishes in `providerSource.covers`. A contract can
  never claim more than its `covers` text. Contracts with no provider format
  documentation (OpenAI, Anthropic, Hugging Face, Docker, Linear, SendGrid)
  are T2 with the reason recorded.
- **Vault contract follows the provider.** HashiCorp documents `hvs.`/`hvb.`/
  `hvr.` plus "24 or more" characters and calls the structure opaque, so the
  T1 contract is `^hv[sbr]\.[A-Za-z0-9_-]{24,}$`. The pinned tools' 90–120
  rule is corroboration. Effect on the corpus: the three `hvr.` detector-
  coverage contexts move from pending (T0) to policy (T3, endpoint companion
  absent); pending drops from 36 to 33 files and policy rises from 155 to 158.
  No fixture bytes changed.
- **Supabase stays T0.** The provider documents the `sb_secret_` prefix but not
  the body; the pinned detector covers `sbp_`. The prefix evidence is recorded
  as `candidateSource` so the promotion path is visible.
- **Twins are authored for every `common-formats` positive except the AWS
  ID/secret pair**, which has no single-mutation twin (dropping the secret line
  and changing the ID prefix are two changes). 56 twins, six of them T1
  (Stripe `pk_` publishable keys and an RFC 7468 `PUBLIC KEY` block). Twins
  declare `twinOf`, `mutation` and a `mutationKind` from
  {length, alphabet, prefix, boundary, public-prefix}; a twin is T1 only for
  `public-prefix` under a T1 contract. Un-twinned positives in other suites are
  reported as a coverage gap (`twins.pairs / twins.positives`).
- **Report rows carry `kind`, `tier`, `contract`, `twinOf` and the projected
  spans (with envelope ranges) rather than the full assessment object**; the
  reason text lives in the catalog. `reportProblem()` recomputes every row
  outcome and every group from the rows, and rejects any `precision`,
  `recall`, `f1`, `tp`, `fp`, `fn`, `tn`, `contained` or `broader` field.
- **Baselines** are `baselines/<version>.json`, saved only from a complete run
  (`run.json` with `partial: false`). `docs/release-comparison.md` is generated
  from them; `docs/beta-4-results.md` and `docs/beta-3-results.md` remain as
  historical v2 snapshots and are no longer maintained.
- **Corpus schema 2.** Every span carries `role`; envelopes and twin fields are
  validated in `validateCorpus`. Hand-authored corpora are annotated by the
  generator without changing content bytes or ranges.

## Consequences

- Reports with `schemaVersion < 4` are rejected with "Legacy report: rerun npm
  run bench". The dashboard aggregates only reports sharing the newest run id
  and names stale suites.
- The six v3 defects have a measured answer: D1 → lattice, D2 → three axes,
  D3 → removal plus twin discrimination, D4 → provider-first tiers, D5 →
  collateral ratio, D6 → run id and baselines.
- Follow-ups: author twins for suites beyond `common-formats` (#316–#325 remain
  the plan), find a serialized PyPI macaroon control, and obtain body-shape
  evidence for Supabase and Vercel.
