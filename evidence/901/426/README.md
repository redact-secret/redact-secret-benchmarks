# Beta.11 PII C3: US SSN and phone under benign-heavy stress (benchmarks #426)

On the exact released beta.10 artifacts, US SSN and phone meet every public
expectation the reviewed contracts support. The #408/#411 placeholder failure no
longer reproduces, and both families now have diagnostic-balanced and
benign-heavy populations with declared sensitive mass. No product defect was
confirmed. Three authored expectations were wrong under `pii-context/v1`
tokenization. They are recorded as corpus corrections and kept separate from
product defects. Both families stay `pending`. The remaining blockers are cost,
the protected partition, identity-only observation and cross-surface output.
Each is owned outside this issue.

This is development evidence for
[redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901)
(benchmark issue [#426](https://github.com/redact-secret/redact-secret-benchmarks/issues/426),
parent [#421](https://github.com/redact-secret/redact-secret-benchmarks/issues/421)).
It adds files next to the frozen [#422 ledger](../pii-gap-ledger-v1.json) and does
not edit the ledger, `evidence/879`, `evidence/880` or any earlier record. It makes
no support claim.

## Candidate binding

- **Product:** `redact-secret/redact-secret` `v0.1.0-beta.10`, commit
  `af7f863f29f9fe482dd233c8b7bc5b77dc427314`, release manifest SHA-256
  `344b1579…80a1e28`.
- **Artifacts:** the published `0.1.0-beta.10` npm tarballs (`@redact-secret/core`,
  `@redact-secret/node-darwin-arm64`, `@redact-secret/wasm`), fetched with
  `npm pack`. The measurement accepts them only when they match the release manifest
  digests the ledger copied. The facade tarball SHA-1 must match. All 9 shipped
  manifest files in the addon and Wasm packages must match. That includes the
  `.node` addon and both `.wasm` payloads. The manifest also lists 2
  build-stage loader files that the addon tarball does not ship. This is the
  cheapest faithful path: the registry artifacts *are* the qualified release, so
  nothing is rebuilt. Artifact-set commitment
  `da2c861f41aba0a6fc9bcd596e6f68d37f1d35e5592e9f95d198aa9de58b240e`.
- **Benchmark:** plans frozen at `9e9dd1bd0ac772d57fc786c431a6223ba1ad9d4d`
  before any scan. The evidence records that revision as its checkout. The
  measurement script and the corrections file were uncommitted at run time and
  are committed together with this evidence (Node v22.16.0, darwin-arm64).
- **Scanners:** no peer scanner and no credential evaluation. No `stable` count
  is claimed in either published or candidate mode.

## Frozen plans (populations v2)

| | US SSN | Phone |
| --- | ---: | ---: |
| File | `us-ssn-stress-v2.json` | `phone-stress-v2.json` |
| Plan commitment | `d2d67687…2d23adea` | `83e87d3e…3a5335aa` |
| Cases (qualification-plan / diagnostic / benign-heavy) | 15 / 15 / 21 | 17 / 18 / 26 |
| Declared mass: diagnostic (sensitive / non-sensitive / not-established) | 5000 / 0 / 5000 | 4000 / 2000 / 4000 |
| Declared mass: benign-heavy | 200 / 0 / 9800 | 200 / 1500 / 8300 |
| Distinct sensitive candidates / sensitive cases | 15 / 16 | 23 / 24 |
| Dominant construction share (limit 0.15) | 0.098 | 0.136 |
| Declared one-property twins | 11 | 13 |
| Korean cases | 14 | 15 |
| Candidates reused from the v1 plans | 0 | 0 |

The plans are under `benchmarks/evaluation/domains/pii/`. Each case is written
as prefix, candidate and suffix, and carries its #423 oracle label (identity basis,
sensitivity basis, reference-validator agreement). Each case belongs to exactly one
view. Every view × language that backlog items 23–33 name has at least one case.
`tests/pii-ssn-phone-stress.test.mjs` checks this mechanically against the frozen
ledger. It also checks the frozen commitment, the oracle rules, twin
single-property changes, denominators and masses, and independence.

- **SSN positives.** `us-ssn-sha256-v1` maps a seed to area 001–899 (not 666),
  group 01–99 and serial 0001–9999. There is no person, SSA, registry or
  issuance provenance.
- **SSA exclusions.** Area 000, 666 and 9xx, group 00 and serial 0000 are
  one-component twins of a generated value. The SSA display controls (`000-00-0000`
  and another 000-area value) are identity-invalid, never non-sensitive.
  `us-ssn-v1` has no valid non-sensitive namespace.
- **Phone positives.** `nanp-n9x-sha256-v1` uses N9X area codes, which NANPA
  reserves for expansion, so no subscriber holds one. Exchanges avoid N11 and 555.
  The plan covers every `phone-v1` full display (`NXX-NXX-XXXX`, spaced, compact,
  `(NXX) NXX-XXXX`, `+1…`, `+1 …`, `+1-…`) and the `ext`, `ext.` and `extension`
  markers. The authoritative 555-0100–0199 controls have 555-0099 and 555-0200
  twins. Unsupported country codes (+82, and the +44 Ofcom drama range) are
  labelled not-established. Allocation is never inferred.
- **#408/#411 correction.** A structurally valid SSN under an unlisted
  `placeholder`, `sample` or `test` label is authored sensitive with a finding,
  because `us-ssn-v1` says those words do not suppress. Only type-invalid
  placeholders are benign.

To cover the full `phone-v1` display subset, the #423 phone reference validator
(`identity-oracle.ts`) now also accepts `+1-NXX-NXX-XXXX`, `(NXX) NXX-XXXX` and
`extension`. This is an additive change: every #423 label keeps its verdict.

## Results on the exact candidate

Public-stream counts on the Node addon. The Node Wasm fallback gives identical
counts (0 case-level disagreements across 71 SSN and 102 phone replays). The
"corrected" rows apply the three reviewed corrections below. The raw rows are
measured against the frozen plan.

| Family | View | Detected | Missed | Range mismatch | Absent | False alarm | Weighted FA rate | Sensitive miss rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| US SSN | qualification-plan v2 | 7 | 0 | 0 | 8 | 0 | — | — |
| US SSN | diagnostic-balanced (raw) | 6 | 0 | 0 | 8 | 1 | 0.111 | 0 |
| US SSN | diagnostic-balanced (corrected) | 7 | 0 | 0 | 8 | 0 | 0 | 0 |
| US SSN | benign-heavy-stress | 3 | 0 | 0 | 18 | 0 | 0 | 0 |
| US SSN | frozen v1 plan replay | 3 | 0 | 0 | 17 | 0 | — | — |
| Phone | qualification-plan v2 | 13 | 0 | 0 | 4 | 0 | — | — |
| Phone | diagnostic-balanced (raw) | 8 | 1 | 0 | 9 | 0 | 0 | 0.111 |
| Phone | diagnostic-balanced (corrected) | 8 | 0 | 0 | 10 | 0 | 0 | 0 |
| Phone | benign-heavy-stress (raw) | 2 | 0 | 0 | 23 | 1 | 0.040 | 0 |
| Phone | benign-heavy-stress (corrected) | 3 | 0 | 0 | 23 | 0 | 0 | 0 |
| Phone | frozen v1 plan replay | 14 | 0 | 0 | 27 | 0 | — | — |

- **Identity vs sensitivity.** Authored cells for the SSN v2 plan:
  valid/sensitive 16, valid/not-established 23, invalid/not-established 9,
  not-established 3. For the phone v2 plan: valid/sensitive 24,
  valid/non-sensitive 6, valid/not-established 18, invalid/not-established 4,
  not-established 9. The public stream answers only the sensitive question.
  Product identity-only observation stays typed `not-measured`
  (`product-identity-seam-unavailable`, core#910). It is never inferred from
  absence.
- **Action split.** Every family finding is `redact`: 17 SSN and 24 phone on the
  v2 plans.
- **Output leakage.** `scanAndRedact` output never contains a detected
  candidate. No finding object carries plaintext. After corrections, 0 of 17 SSN
  and 0 of 24 phone sensitive outputs contain their candidate. Incremental
  sessions and browser Wasm output belong to #427.
- **Cross-family overlap.** With `pii:global` and `pii:us` together, no other
  PII or credential finding overlaps an authored candidate. This holds for both v2
  plans and both v1 plans.
- **Activation.** SSN appears under `pii:family:us:ssn` and `pii:us` but not under
  `pii:global`. There it is unavailable and produces 0 findings, which is the
  US-only rule. Exact and closure selections agree case by case. The PII-off run
  produces 0 PII findings. Each surface loaded the expected artifact (`addon` or
  `wasm`).
- **Cost.** Median per-case scan with the exact selector, over 25 samples: SSN
  36.8 µs (p95 49.8 µs), phone 29.3 µs (p95 36.9 µs). These figures are
  informational. The runtime gate belongs to #428. Measured against the frozen
  `evidence/879` zero-growth budget, the beta.10 common Wasm payload still
  **fails**: raw +12,359, gzip +4,581 and brotli +2,776 bytes over the 879
  baseline. Accepting that cost is the core#794 decision.

## Before-state re-measure (backlog item 23)

`pii-population-v1-remeasure.json` holds the `pii-populations-v1` bundle over
the #411-corrected corpus (`pii-benign-collision-v1`). It compares the lockfile
release `0.1.0-beta.9` (baseline) with the exact beta.10 artifacts (candidate).
Both views report `no-regression`. Benign-heavy-stress has 10 measured cases with
0 false alarms, and the `placeholder` stratum has 0. Diagnostic-balanced has 4
measured cases with 0 false alarms. The `evidence/879` benign-heavy failure came
from the #408/#411 fixture error. On an exact candidate it no longer reproduces.
`evidence/879` stays frozen. The v1 populations still declare zero sensitive
mass, which is why the v2 populations above exist.

## Corrections vs. product defects

- **Product defects: none.** No core issue was filed under #901.
- **Corpus corrections** (`pii-c3-reviewed-corrections-v1.json`, reason
  `parenthesized-label-is-not-a-whole-token`). Three v2 cases put a
  natural-language label in parentheses after the candidate: SSN
  `db-en-example-suffix`, phone `db-en-contact-details-after` and phone
  `bh-ko-example-suffix`. `pii-context/v1` splits tokens only on whitespace,
  underscore, hyphen, colon and equals. The family contracts need a whole
  associated label, so a parenthesized label is not associated. The product was
  right and the authored expectation was wrong. The frozen plans are unchanged.
  The measurement accepts a correction only for a case the scan contradicted, and
  after the corrections nothing is left unexplained.
- **Observation for core (not a defect).** Because of this tokenization, a
  trailing `(example)` or `(예시)` does not suppress an SSN or phone field, and
  `(contact details)` does not establish phone context. The product follows the
  contract. Treating parentheses as label boundaries would be a `pii-context`
  contract change with its own false-positive and false-negative trade-off.

## Ledger rows owned by #426 (proposed; the ledger stays frozen)

| Blocker | US SSN | Phone |
| --- | --- | --- |
| sensitive-positive-false-negative | passed on exact candidate (v1 replay + v2) | passed on exact candidate (v1 replay + v2, after corrections) |
| benign-false-positive | passed | passed (after corrections) |
| context-validator-collision | passed | passed |
| diagnostic-balanced-population | passed (v2, sensitive mass 5000) | passed (v2, sensitive mass 4000) |
| benign-heavy-population | passed (v1 re-measure + v2, sensitive mass 200) | passed (v2, sensitive mass 200) |
| contract-fixture-discrepancy | passed (the #408/#411 correction holds on exact candidate) | passed (the 3 v2 corrections are corpus-side) |

Still `pending`, with owners:

- identity-only: `not-measured`, core#910.
- protected partition: **`not-run`**. This evidence does not spend it. #428
  runs it only when every public gate is eligible. The SSN sealed epoch stays
  at 0 of 1 runs.
- runtime and package cost: common Wasm zero-growth `failed`, core#794 / #428.
- cross-surface output: #427.
- exact-candidate binding for the whole qualification record: #428.

The SSN #795 national-ID arrival decision stays conditional on full `pii-v1`
evidence. No other jurisdiction or national-ID family was added.

## Reproduce

```sh
npm ci
mkdir -p /tmp/beta10 && cd /tmp/beta10
for p in core node-darwin-arm64 wasm; do npm pack @redact-secret/$p@0.1.0-beta.10; done
cd -
node --import tsx scripts/measure-pii-ssn-phone-stress.mjs \
  --core=/tmp/beta10/redact-secret-core-0.1.0-beta.10.tgz \
  --node=/tmp/beta10/redact-secret-node-darwin-arm64-0.1.0-beta.10.tgz \
  --wasm=/tmp/beta10/redact-secret-wasm-0.1.0-beta.10.tgz \
  --corrections=evidence/901/426/pii-c3-reviewed-corrections-v1.json \
  --output-dir=/tmp/pii-426
node --import tsx --test tests/pii-ssn-phone-stress.test.mjs
```

A rerun should reproduce every count. Timing medians vary with the host, and the
population bundle's run id differs between runs. On another platform, pass that
platform's `@redact-secret/node-*` tarball. Its shipped files are checked against
the same manifest.
