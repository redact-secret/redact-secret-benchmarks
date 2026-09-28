# PII identity/sensitivity oracle (evaluation-only)

Benchmark issue [#423](https://github.com/redact-secret/redact-secret-benchmarks/issues/423),
product counterpart [redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901).
Code: `benchmarks/evaluation/domains/pii/identity-oracle.ts`. Authored labels:
`benchmarks/evaluation/domains/pii/identity-oracle-v1.json`.

A public PII finding means the product decided an occurrence is sensitive. It
says nothing about a case with no finding. That case may be a recognized
non-sensitive identity, an invalid lookalike or unrecognized text. The oracle
keeps that question out of the public finding stream and answers it on two
separate axes.

## States

| Axis | States |
| --- | --- |
| identity | `valid`, `invalid`, `not-established` |
| sensitivity | `sensitive`, `non-sensitive`, `not-established` |

Legal pairs: `valid/sensitive`, `valid/non-sensitive`, `valid/not-established`,
`invalid/not-established`, `not-established/not-established`. Any other pair is
rejected: sensitivity is established only for a valid identity.

- `invalid` means the authored candidate is a lookalike that the frozen family
  contract rejects: a checksum or allocation failure, an issuer range, a country
  length, an N11 code or a non-canonical spelling.
- `not-established` identity means the contract does not decide identity for the
  text. It covers unsupported shapes, joined boundaries, reference syntax and
  semantic collisions.

## Authored truth

Each plan case carries exactly one label, in plan order. The label is bound to
the plan's SHA-256 (the same `planCommitment` the frozen qualification records
carry), the family, the finding type, the family contract version and the
`pii-context/v1` vocabulary.

- **Identity basis:** `contract-grammar`, `reference-validator` or
  `authority-published-value`. When a family has a reference validator (Luhn,
  ISO 13616 mod-97, SSA allocation, NANP structure, IP syntax), it runs on the
  authored candidate range, never on detector output. `valid` requires the
  validator to accept and the label to cite it. `invalid` requires either a
  validator rejection that the label cites, or a validator acceptance plus a
  `contract-grammar` rule beyond the validator.
- **Sensitivity basis:** `sensitive` requires `contract-context-rule`.
  `non-sensitive` requires `authority-reserved-value` (RFC 2606/6761 domains,
  IANA special-purpose ranges, the Visa test-card suite, NANPA 555-0100–0199)
  and may not cite a context rule. `not-established` cites nothing. A basis made
  only of `validator-hit`, `context-keyword` or `public-finding` is rejected.
  `public-absence` is rejected in every basis.
- The plan's legacy `sensitive` flag is now checked. `sensitive:true` must match
  an oracle `sensitive` label and a public-finding expectation with the same
  range. `sensitive:false` must be `non-sensitive` or `not-established`, and the
  oracle records which. IBAN and US SSN have no authority-reserved value in
  `pii-v1`, so they have no `non-sensitive` row.

## Product observation

The installed artifacts expose public findings only. No public identity or score
surface is added. Product identity-only observation needs the non-public seam in
[redact-secret#910](https://github.com/redact-secret/redact-secret/issues/910),
a maintainer-local example executable that follows the `shadow_evaluation.rs`
pattern. Until it exists, every family reports:

```json
{ "status": "not-measured", "reason": { "code": "product-identity-seam-unavailable", "issue": "redact-secret/redact-secret#910" } }
```

The `identity-only-classification` gate is `unresolved`. When seam output is
supplied (`--product-identity-evidence`), the evaluator admits it only in exact
form: format `redact-secret/pii-identity-evaluation/1`, the same family, source
commit, artifact set and vocabulary, one `{id, family, identity, sensitivity}`
row per authored case, and no other field. `unmatched` with an established
sensitivity is rejected. Its `sensitive` decisions must equal the installed
artifact's public findings case by case (source/artifact equivalence). The gate
is `met` only if every no-finding case agrees: `valid` ⇔ `established`, with the
same sensitivity.

## Public projection

`pii-identity-oracle-projection` v1 carries only these fields:

- fixed-label counts of authored `identity × sensitivity` cells;
- public-stream outcome counts (`detected`/`missed` for sensitive cases,
  `absent`/`false-alarm` for the rest);
- identity-only outcome counts or the typed unavailable reason;
- binding commitments and the gate status.

It carries no case id, value, span, score, threshold or feature, and the
validator rejects extra fields.

## Qualification schema v2

`scripts/qualify-pii-family-candidate.mjs` now emits
`pii-family-qualification` **schemaVersion 2** with an `identityOracle`
projection. Its gates are independent:

- `identity-only-classification` comes from the oracle.
- `diagnostic-population` and `benign-heavy-population` each read their own
  candidate report and baseline comparison (`piiArrivalViewGateStatuses`).
- `population-no-regression` reads the bundle status.

In v1, all three identity/view gates read one population-report state. Frozen
schemaVersion 1 records (`evidence/875`–`880`) keep their meaning and are not
rewritten. `product-binding.ts` accepts both versions, and for v2 it requires the
oracle projection to bind the same family, plan and candidate and to drive the
identity gate.
