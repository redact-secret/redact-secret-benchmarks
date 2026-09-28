# Beta.11 PII: frozen six-family gap ledger (benchmarks #422)

All six beta.10 PII families remain `pending`, and no PII evidence is bound to the exact beta.10 release `af7f863f`. This audit found no confirmed product defect: 30 blocker cells pass, 8 fail (6 on profile-level cost, 2 on the US SSN placeholder fixture error from #408/#411), 33 are not measured and 1 is not run.

This is an audit-only record for
[redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901)
(benchmark issue [#422](https://github.com/redact-secret/redact-secret-benchmarks/issues/422),
parent [#421](https://github.com/redact-secret/redact-secret-benchmarks/issues/421)).
It does not change a detector, fixture, expectation, support status or prior evidence
record. The machine-readable ledger is
[`pii-gap-ledger-v1.json`](pii-gap-ledger-v1.json) (schema
[`schemas/pii-gap-ledger-v1.json`](../../schemas/pii-gap-ledger-v1.json),
content commitment `7fcbba702d93849ce1452ee5a9adf3d20e493179107ec0c6bbda36cb9e5fd116`).
Later #901 children add their own files to this directory. They do not edit this
ledger.

## Source revisions

- **Final beta.10 candidate.** `redact-secret/redact-secret` commit
  `af7f863f29f9fe482dd233c8b7bc5b77dc427314`, annotated tag `v0.1.0-beta.10`.
  Release manifest `docs/releases/0.1.0-beta.10/manifest.json` SHA-256
  `344b1579ac9dae75dda8ed3de58bca79ef2ecbc19c19cd92d4dbb2f0c80a1e28`. Artifact
  inventory SHA-256 `c79f69288e4de2eac698e5361685d364813d213625d0bdb01c457af6b7e38fe6`.
  Conformance identity `3ee338adda67b30d80a0c7b1e74411423388a3e6`. The ledger
  copies every qualified artifact digest from that manifest: crates, npm
  facade, eight Node addons, Wasm payloads and nine Python files.
- **PII evidence binding.** None. No PII qualification, population, activation or
  cost run used the released commit or its artifacts. The per-family records
  bind six different merge commits with 0.1.0-beta.9-versioned artifacts:

  | Record | Family | Product commit | Benchmark input | Core `crates/` drift to final |
  | --- | --- | --- | --- | --- |
  | `evidence/875` | network-address | `941053baecdc` (#885) | `7c639ba2a979` | 25 files |
  | `evidence/876` | email | `b73daade943f` (#886) | `7c639ba2a979` | 19 files |
  | `evidence/877` | payment-card | `bf3631b19895` (#892) | `72de7bf813ee` | 12 files |
  | `evidence/878` | iban | `c810623a3348` (#889) | `a14f4327f4c9` | 14 files |
  | `evidence/879` | us-ssn | `a0709d2a41b7` (#894) | `677bd3f16cbc` | 9 files |
  | `evidence/880` | phone | `2e1bdcf0905f` (#895) | `886dda9016b0` | 0 files |
  | `evidence/286` | all (profile cost) | `2e1bdcf0905f` | `a25309af7add` | 0 files |

  Between the phone merge `2e1bdcf` and the final candidate, only version
  strings, documentation, release scripts and package manifests change;
  `crates/` is identical. That is source equivalence only. The built artifacts
  differ, so the ledger records the final candidate as identified but
  unmeasured for PII. It does not substitute `2e1bdcf`.
- **Benchmark revision.** `redact-secret/redact-secret-benchmarks`
  `0a73b7db198c628dde74fb815d3029eb6c0acf42` (the `develop` base of this
  branch). Lockfile SHA-256
  `97692c4cd77c448583d28ea071290d574a7cbf71ef6962853e490732f4af5aec`.
- **Profile and populations.** `pii-v1` (`qualification/pii-v1.json` SHA-256
  `02e1e012f48f610885b17ba806fd7b47d13de6d5a33ac8b58c094175b57b8df2`). Before-state
  populations are `pii-populations-v1` with commitment `d7025a67…31eb2` over
  corpus `pii-benign-collision-v1` with commitment `b9a2f3b2…a25b18` (the #411-corrected corpus).
- **Frozen files.** The ledger stores the SHA-256 of every JSON file in
  `evidence/875`–`880` and `evidence/286`, plus `qualification/pii-v1.json`.
  `npm run pii:ledger:check` fails if any of them changes.

## Pinned scanner versions

None. This audit runs no scanner and produces no detection observation. It reads
committed evidence, qualification plans and the population corpus. It makes no
peer-scanner comparison, and it claims no `stable` count in either published or
candidate mode.

## Ledger (status → owner)

`not-run`: an eligible procedure exists but was deliberately not executed.
`not-measured`: no instrument or evidence exists yet. `failed`: a recorded gate
did not pass. `passed`: a recorded gate passed, at plan scope and on the
predecessor commit named above.

| Blocker | network-address | email | payment-card | iban | us-ssn | phone |
| --- | --- | --- | --- | --- | --- | --- |
| identity-only-observability | not-measured → #423 | not-measured → #423 | not-measured → #423 | not-measured → #423 | passed → #423 | not-measured → #423 |
| sensitive-positive-false-negative | not-measured → #424 | passed → #424 | passed → #425 | passed → #425 | passed → #426 | passed → #426 |
| benign-false-positive | passed → #424 | passed → #424 | passed → #425 | passed → #425 | passed → #426 | passed → #426 |
| context-validator-collision | passed → #424 | passed → #424 | passed → #425 | passed → #425 | passed → #426 | passed → #426 |
| diagnostic-balanced-population | not-measured → #424 | not-measured → #424 | not-measured → #425 | not-measured → #425 | passed → #426 | not-measured → #426 |
| benign-heavy-population | not-measured → #424 | not-measured → #424 | not-measured → #425 | not-measured → #425 | failed → #426 | not-measured → #426 |
| protected-partition | not-measured → #428 | not-measured → #428 | not-measured → #428 | not-measured → #428 | not-run → #428 | not-measured → #428 |
| cross-surface-output | not-measured → #427 | not-measured → #427 | not-measured → #427 | not-measured → #427 | not-measured → #427 | not-measured → #427 |
| activation | passed → #428 | passed → #428 | passed → #428 | passed → #428 | passed → #428 | passed → #428 |
| performance-size | failed → #428 | failed → #428 | failed → #428 | failed → #428 | failed → #428 | failed → #428 |
| contract-fixture-discrepancy | passed → #424 | passed → #424 | passed → #425 | passed → #425 | failed → #426 | passed → #426 |
| exact-candidate-binding | not-measured → #428 | not-measured → #428 | not-measured → #428 | not-measured → #428 | not-measured → #428 | not-measured → #428 |

Every cell carries a reason code and a detail line in the JSON. The rows that
need reading:

- **Identity-only.** Five families cannot tell a recognized non-sensitive
  candidate from an invalid or unmatched one, because public absence is not
  evidence. US SSN passes only through a source-level private identity lane (see
  evaluator findings). #423 owns all six.
- **Network-address sensitive misses.** No public/global address was ever
  authored, so class `public-global` stays unresolved.
- **Populations.** `pii-populations-v1` holds 15 entries, all US SSN and all
  English. Both views declare zero sensitive mass. The other five families have
  no population evidence at all.
- **US SSN benign-heavy and contract rows.** `evidence/879` records a
  `benign-heavy-stress` regression and calls it a product false positive.
  #408/#411 established that the corpus expectation contradicted `us-ssn-v1`,
  and #411 corrected the corpus. The frozen record is not rewritten. Only a
  local run confirms no-regression, so both cells stay `failed` with resolution
  `corrected-in-corpus-remeasure-pending`. #426 re-measures them on an exact
  candidate.
- **Protected partition.** US SSN has a sealed epoch at 0 of 1 runs
  (`not-run`, public gates failed). No other family has a protected epoch
  (`not-measured`).
- **Performance/size.** No cost figure is attributable to a single family.
  `evidence/286` regresses on every PII profile: `global` 40, `us-ssn-exact` 35,
  `us-jurisdiction` 45 and `beta10-full` 41 of 160 metric evaluations each.
  40 of 65 artifacts exceed the #143 size budget. `evidence/879` adds the
  common-Wasm zero-growth failure. Accepting that cost is a core activation and
  cost decision (core #794 under #901). It is not a detector defect.
- **Cross-surface/output.** Finding and range parity passed on the installed
  Node addon and Wasm, plus Rust/Python/CLI source lanes (except network-address,
  which has no source lane). Nothing measured sanitized output bytes, incremental
  sessions, browser Wasm or credential overlap.

## Fixture corrections vs. product defects

- **Product defects: none confirmed.** No core issue was filed under #901. Every
  failed cell is either a fixture correction or a cost decision.
- **Fixture correction `ssn-placeholder-control-408-411`** (#408, #411) affects
  `evidence/879`. It was corrected in the corpus and still needs re-measurement
  on an exact candidate (#426).
- **Evaluator findings.** These are benchmark-side issues, not product defects:
  - `identity-gate-derived-from-population-state`
    (`scripts/qualify-pii-family-candidate.mjs` L323–L326, #423): three SSN gates
    read one population-state signal.
  - `negative-sensitivity-label-unenforced` (L271–L278, #423): the plan label
    `sensitive:false` is never checked, and on card, SSN and phone it conflates
    non-sensitive with not-established.
  - `facade-commitment-not-build-identity` (#428): all six records bind the same
    npm facade hash across six builds.
  - `latest-record-activation-omits-jurisdiction` (#428): `evidence/880`
    requested only `pii:global`, so US SSN reads as unavailable there.
  - `population-sensitive-mass-zero` (#426).

## Independence audit (before state)

| Family | Plan cases (find/absence) | Distinct positive spans | Cases sharing the dominant positive | Korean cases | Population entries | Main gaps |
| --- | --- | --- | --- | --- | --- | --- |
| network-address | 25 (8/17) | 8 | 3 | 0 | 0 | no public/global positive; two field labels; Korean field unexercised |
| email | 20 (4/16) | 4 | 1 | 2 | 0 | one local part reused in most cases; Korean example label unexercised |
| payment-card | 19 (5/14) | 4 | 12 | 0 | 0 | one seed construction family; one authority test value; no Korean case |
| iban | 21 (2/19) | 1 | 18 | 2 | 0 | one checksum-valid construction, one country; no authority test value |
| us-ssn | 20 (3/17) | 1 | 14 | 0 | 15 | one positive construction; no Korean case; population reuses 2 values and 3 field labels across views, declares 0 twins, 0 sensitive mass |
| phone | 41 (14/27) | 6 | 29 | 5 | 0 | one dominant base construction; NANP only; Korean example label unexercised |

The counts are recomputed mechanically from the plans. Each plan's commitment
equals the commitment its immutable record bound. One-property twins exist only
informally inside plans. No plan or population entry declares `twinOf`, and the
`cross-family-collision` population class is empty. Jurisdiction: only US SSN is
jurisdictional. No second jurisdiction exists, so several-jurisdiction
comparisons are an explicit non-goal (#286, core #795). Per-family non-goals
(contracted unsupported forms) are listed in the JSON `nonGoals`.

## Frozen axis backlog

Consumed in this order by the family-group children. Each item names the views
and languages it must cover and the blocker categories it resolves (JSON
`axisBacklog`).

| # | Owner | Family | Axis | Views | Languages |
| --- | --- | --- | --- | --- | --- |
| 1 | #424 | network-address | `network-public-global-positives` | qualification-plan, diagnostic-balanced, benign-heavy-stress | en, ko |
| 2 | #424 | network-address | `network-operational-log-config-context` | diagnostic-balanced, benign-heavy-stress | en, ko |
| 3 | #424 | network-address | `network-reserved-documentation-benchmark` | diagnostic-balanced, benign-heavy-stress | en |
| 4 | #424 | network-address | `network-version-boundary-url-collisions` | diagnostic-balanced, benign-heavy-stress | en |
| 5 | #424 | network-address | `network-korean-field-context` | qualification-plan, diagnostic-balanced | ko |
| 6 | #424 | email | `email-independent-sensitive-positives` | qualification-plan, diagnostic-balanced | en, ko |
| 7 | #424 | email | `email-reserved-documentation-controls` | diagnostic-balanced, benign-heavy-stress | en |
| 8 | #424 | email | `email-public-contact-addresses` | benign-heavy-stress | en, ko |
| 9 | #424 | email | `email-example-label-context-negatives` | diagnostic-balanced, benign-heavy-stress | en, ko |
| 10 | #424 | email | `email-userinfo-credential-collisions` | diagnostic-balanced, benign-heavy-stress | en |
| 11 | #424 | email | `email-smtputf8-boundary-twins` | qualification-plan, diagnostic-balanced | en, ko |
| 12 | #425 | payment-card | `card-independent-sensitive-positives` | qualification-plan, diagnostic-balanced | en, ko |
| 13 | #425 | payment-card | `card-official-test-values` | diagnostic-balanced, benign-heavy-stress | en |
| 14 | #425 | payment-card | `card-luhn-valid-benign-collisions` | diagnostic-balanced, benign-heavy-stress | en, ko |
| 15 | #425 | payment-card | `card-checksum-invalid-near-miss` | diagnostic-balanced | en |
| 16 | #425 | payment-card | `card-issuer-range-scope-boundary` | qualification-plan, diagnostic-balanced | en |
| 17 | #425 | payment-card | `card-separator-display-twins` | qualification-plan, diagnostic-balanced | en |
| 18 | #425 | payment-card | `card-korean-field-and-example-context` | qualification-plan, diagnostic-balanced, benign-heavy-stress | ko |
| 19 | #425 | iban | `iban-multi-country-positives` | qualification-plan, diagnostic-balanced | en, ko |
| 20 | #425 | iban | `iban-mod97-valid-lookalikes` | diagnostic-balanced, benign-heavy-stress | en |
| 21 | #425 | iban | `iban-reference-documentation-controls` | diagnostic-balanced, benign-heavy-stress | en, ko |
| 22 | #425 | iban | `iban-print-format-separator-twins` | qualification-plan, diagnostic-balanced | en |
| 23 | #426 | us-ssn | `ssn-remeasure-corrected-placeholder` | benign-heavy-stress | en |
| 24 | #426 | us-ssn | `ssn-independent-sensitive-positives` | qualification-plan, diagnostic-balanced | en, ko |
| 25 | #426 | us-ssn | `ssn-korean-field-and-negation` | qualification-plan, diagnostic-balanced, benign-heavy-stress | ko |
| 26 | #426 | us-ssn | `ssn-population-value-and-label-independence` | diagnostic-balanced, benign-heavy-stress | en |
| 27 | #426 | us-ssn | `ssn-ordinary-identifier-collisions` | benign-heavy-stress | en, ko |
| 28 | #426 | us-ssn | `ssn-declared-twins` | qualification-plan, diagnostic-balanced | en |
| 29 | #426 | phone | `phone-independent-sensitive-positives` | qualification-plan, diagnostic-balanced | en, ko |
| 30 | #426 | phone | `phone-reserved-555-and-n11-controls` | diagnostic-balanced, benign-heavy-stress | en |
| 31 | #426 | phone | `phone-order-reference-collisions` | benign-heavy-stress | en, ko |
| 32 | #426 | phone | `phone-extension-seams` | qualification-plan, diagnostic-balanced | en |
| 33 | #426 | phone | `phone-korean-high-signal-vs-ambiguous` | diagnostic-balanced, benign-heavy-stress | ko |

## Reproduce

From a clean checkout of this repository at the commit that adds this directory:

```sh
npm ci
npm run pii:ledger:check
node --import tsx --test tests/pii-gap-ledger.test.mjs
```

The check validates the schema and the content commitment. It recomputes the
independence metrics from the frozen plans and, while the corpus is still the
recorded before-state, the population audit. It re-hashes every frozen evidence
file and rejects any raw case value or unsafe key. The final-candidate
identities come from the product repository at `af7f863f`
(`docs/releases/0.1.0-beta.10/manifest.json`) and from `git diff --shortstat
<commit> af7f863f -- crates` there.
