# Beta.11 PII C1: email and network-address population evidence (benchmarks #424)

On the exact released beta.10 artifacts, both families match every frozen expectation. That covers 189 authored cases on two installed surfaces, in both populations. Neither family regresses against the published beta.9 baseline. Both stay `pending`. The reasons are conditional and listed below, and nothing is promoted. No product defect was found, so no core issue was filed under [redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901).

This is development evidence for [benchmark issue #424](https://github.com/redact-secret/redact-secret-benchmarks/issues/424)
(parent [#421](https://github.com/redact-secret/redact-secret-benchmarks/issues/421)). It resolves axis-backlog items 1–11 of the frozen
[#422 ledger](../pii-gap-ledger-v1.json) and adds files only. It does not edit the ledger, `evidence/875`–`880` or any v1 qualification plan. The machine-readable
record is [`pii-email-network-population-evidence-v1.json`](pii-email-network-population-evidence-v1.json)
(artifact commitment `7e4b81e9f30f4f4ad96243ebfc8a9eea6f4a56fdd9580a4a8b405ce9731b3290`). It carries case ids, commitments and counts only: no candidate
value, span or sanitized text.

## What was measured, and against what

- **Frozen plans.** One population plan per family:
  [`email-population-plan-v2.json`](../../../benchmarks/evaluation/domains/pii/email-population-plan-v2.json) (plan commitment `690474fd…6ccbd`)
  and [`network-address-population-plan-v1.json`](../../../benchmarks/evaluation/domains/pii/network-address-population-plan-v1.json)
  (plan commitment `19fbd389…3d284`). Every case carries a #423 identity/sensitivity oracle label bound to the plan commitment and validated by
  `validatePiiOracleFamily`. Every case also carries an axis, stratum, views, context language, source, tier and an optional one-property twin.
  The plans were committed before any scan (`50ce54e`). The validator in
  [`email-network-population.ts`](../../../benchmarks/evaluation/domains/pii/email-network-population.ts) re-derives every identity-valid sensitivity
  label with a contract-derived reference of `pii-context/v1` association and the families' authority-reserved values. Expectations come from
  email contract v1 (`docs/contracts/pii/email-v1.md`) and network-address contract v1 (`docs/audits/evidence/875/README.md`) at `af7f863f`.
- **Candidate.** The published `0.1.0-beta.10` npm artifacts, which are the exact release built from `af7f863f29f9fe482dd233c8b7bc5b77dc427314`.
  This path installs the registry tarballs, so nothing is rebuilt. Each tarball's shasum and SHA-512 integrity must equal
  `release_evidence.registries` in the product release manifest (SHA-256 `344b1579…e28`, the one the ledger binds). The darwin-arm64 addon inside
  the tarball must equal the manifest's qualified addon digest (`effe64bb…9809`). Artifact-set commitment: `924108bb…cdd8a`.
- **Baseline.** The published `0.1.0-beta.9` artifacts (source `f726f2ff`, manifest SHA-256 `3393c6e2…d3f3`), verified the same way. Beta.9
  predates both families. It has no `piiActivation` and ignores the PII selector, so its PII outcome is "no finding" everywhere.
- **Surfaces.** The installed Node addon and forced Node Wasm (the node package removed), `initialize({ pii: ['pii:global'] })`, `scan` and
  `scanAndRedact` per case. The candidate activation identity is
  `credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:global:phone;vocabulary=pii-context/v1`.
  Findings and sanitized output agree on every case (`scanRedactDisagreements` 0). The two surfaces give identical per-case outcomes for both
  releases.
- **Run.** `29530999-4a9d-4043-99d4-b1e1aec5b424`, 2026-09-28, Node v22.16.0 darwin/arm64. The benchmark revision was clean at `2d58525c`
  (lockfile SHA-256 `97692c4c…af5aec`).

No peer scanner and no credential eval was run, so the run involves no TruffleHog version and makes no `stable` claim in either published or
candidate mode. Credential findings in overlap cases are counted apart from PII and are never scored.

## Populations and denominators

Both views are declared per stratum as integer assumption mass over 10,000 `declared-assumption-unit`. They are not prevalence claims, and missing
mass is never renormalized. `diagnostic-balanced` (development-only) gives each present stratum equal mass. `benign-heavy-stress`
(evaluation-only) gives sensitive strata 2% of the mass (200) and splits the rest across benign strata. Strata are homogeneous in authored
identity × sensitivity. pii-v1 metrics are case counts with Wilson bounds (z 1.96, minimum denominator 4).

| Family | Cases | Strata | Twins | Distinct sensitive candidates | Max cases per candidate | Korean cases (sensitive) | Reuse of v1 plan positives | Duplicate inputs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| email | 93 | 17 | 28 | 36 (36 local parts, 36 domains) | 4 | 14 (6) | 0 | 0 |
| network-address | 96 | 17 | 19 | 34 | 3 | 15 (8) | 0 | 0 |

Before this record: email had 4 distinct positives and 1 dominant local part. Network-address had 8 positives, none public/global and none Korean.

## Results (candidate `0.1.0-beta.10`, both surfaces identical; counts only)

Identity-only observation is typed `not-measured` in every row (`product-identity-seam-unavailable`,
[redact-secret#910](https://github.com/redact-secret/redact-secret/issues/910)). The authored identity cells are shown instead. The sensitivity
columns come from the public finding stream.

| Family | View | Cases | Authored identity cells (valid/sens · valid/non · valid/n-e · invalid · n-e) | Sensitive detected / cases | Range mismatch | Non-sensitive false alarms | Not-established false alarms | False alarms by action | Leaked sensitive cases | Collateral cases (bytes) | Unsupported syntax: finding / cases | Contract-silent: finding / cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| email | qualification-plan | 48 | 29 · 0 · 6 · 4 · 9 | 29 / 29 | 0 | 0 / 0 | 0 / 19 | none | 0 | 0 (0) | 0 / 13 | 0 / 0 |
| email | diagnostic-balanced | 80 | 36 · 7 · 20 · 4 · 13 | 36 / 36 | 0 | 0 / 7 | 0 / 37 | none | 0 | 0 (0) | 0 / 13 | 0 / 0 |
| email | benign-heavy-stress | 41 | 6 · 11 · 20 · 0 · 4 | 6 / 6 | 0 | 0 / 11 | 0 / 24 | none | 0 | 0 (0) | 0 / 0 | 0 / 0 |
| network-address | qualification-plan | 21 | 17 · 0 · 4 · 0 · 0 | 17 / 17 | 0 | 0 / 0 | 0 / 4 | none | 0 | 0 (0) | 0 / 0 | 0 / 0 |
| network-address | diagnostic-balanced | 92 | 34 · 15 · 30 · 5 · 8 | 34 / 34 | 0 | 0 / 15 | 0 / 41 | none | 0 | 0 (0) | 0 / 8 | 1 / 2 |
| network-address | benign-heavy-stress | 78 | 20 · 19 · 26 · 5 · 8 | 20 / 20 | 0 | 0 / 19 | 0 / 37 | none | 0 | 0 (0) | 0 / 8 | 1 / 2 |

Credential overlap: 5 email cases (both views) produce a credential finding beside the PII outcome. It is counted apart from PII and never
scored.

Benign axes present: email has reserved-documentation, public-identifier, context-negative, collision and unsupported-syntax. Network-address has
reserved-documentation, operational, public-identifier, context-negative, collision and unsupported-syntax, plus contract-silent, which is
reported only.

**Baseline → candidate.** Beta.9 detects nothing and flags nothing. The candidate adds every authored sensitive detection and no false alarm,
leak or collateral in any stratum. The verdict is `no-regression` for both views, both families and both surfaces. Deltas are per stratum in the
JSON and are never aggregated across families or with credentials.

## Conditional `pii-v1` reasons (no promotion)

| Gate | email | network-address |
| --- | --- | --- |
| exact-candidate-artifact | met | met |
| cross-surface-determinism (addon/Wasm) | met | met |
| diagnostic-population (every pii-v1 metric met) | met | met |
| benign-heavy-population | **not-met**: context-discrimination has 3 twin pairs, under the pii-v1 minimum denominator of 4 | met |
| population-no-regression | met | met |
| population-mass-resolved | met | **not-met**: contract-silent strata hold 625 (diagnostic) and 817 (stress) of 10,000 declared units with no authored truth |
| authored-truth-agreement | met (0 disagreements) | met (0 disagreements) |
| min benign cases / axes, independent evidence | met | met |
| identity-only-classification | unresolved (#910) | unresolved (#910) |
| protected-partition, trusted-accounting-source, runtime-and-package-cost | unresolved (#428) | unresolved (#428) |
| cross-surface-output (browser Wasm, incremental, other lanes) | unresolved (#427) | unresolved (#427) |

Support state stays `pending` for both. For the ledger rows owned by #424, this record supplies the missing measurement:

- `sensitive-positive-false-negative`: network class `public-global` is now measured (12 labelled public/global cases, 0 missed), and email positives are independent.
- `benign-false-positive` and `context-validator-collision`: measured at population level, with 0 false alarms.
- `diagnostic-balanced-population` and `benign-heavy-population`: both measured, with the reasons above.
- `contract-fixture-discrepancy`: one authoring correction, below.

The ledger itself stays frozen.

## Authoring correction (fixture correction, not a product defect)

The first scan of the frozen plans (`50ce54e`, run `78b5b693…`, report `873948db…`) disagreed on three email cases. Adjudicated against the
contract text, all three were authoring errors. Email contract v1 bounds a candidate on the left by "something other than local-part atom
syntax". RFC 5322 `atext` includes `=`, so a `key=address` spelling forms one candidate that starts at the key and carries no field label. Two
cases were authored as sensitive and one reserved case had its range start at the address. The frozen
[`email-population-plan-v1.json`](../../../benchmarks/evaluation/domains/pii/email-population-plan-v1.json) is kept unchanged. The v2 plan
records its file digest, plan commitment, first run and the three corrections. It relabels the two joined cases `valid/not-established`, adds
their colon-delimited sensitive twins, and fixes the reserved range. The validator now enforces the whole-candidate rule, so the v1 plan fails
for exactly this recorded reason. The same first run also counted a finding on a contract-silent network case as a false alarm. That stratum was
declared with no authored truth. It is now reported as observed behavior and unresolved mass, not scored (commits `28064f7`, `2d58525`).

## Contract observations (conformant behavior, recorded for the family owners)

None of these is a detector defect: each follows the frozen contract text, and the product matched the authored label. They are the
false-negative and ambiguity trade-offs these populations expose:

1. **Logfmt `email=address`.** Because `=` is `atext`, `key=address` never gets a public email finding. `key: address` does.
2. **Label forms outside the vocabulary.** `email address:` and `이메일 주소:` are not reviewed forms. The field-gap rule then blocks `email`, so
   those occurrences stay not-established. `<address>` after a label and display-name forms are blocked the same way.
3. **Dense single-space key/value lines.** `k: v k: v` leaves every value after the first unassociated, because the literal equidistance rule
   counts the preceding candidate. This happens across families too: a bare email just before `ip:` blocks the address. A comma delimiter, or
   any intervening word, restores association.
4. **Mixed-script Korean forms.** `ip 주소` has no case folding, so `IP 주소:` is not associated.
5. **Punctuated negatives.** `example,` is not a token boundary, so `For example, email:` stays sensitive. `For example: email:` does not.
6. **Contract-silent network spellings.** The contract does not decide IPv4 followed by `:port`, or a sentence-final period. The candidate
   redacts the address before `:port` and emits nothing before a trailing period. These are candidates for a contract clarification, not for a
   defect.

## Reproduce

From this repository at the commit that adds this directory, with the product repository checked out at a commit containing
`docs/releases/0.1.0-beta.9/` and `docs/releases/0.1.0-beta.10/` (for example `9ab0fa02`):

```sh
npm ci
mkdir -p /tmp/c1-artifacts && cd /tmp/c1-artifacts
for v in 0.1.0-beta.9 0.1.0-beta.10; do npm pack @redact-secret/core@$v @redact-secret/node-darwin-arm64@$v @redact-secret/wasm@$v; done
cd -
npm run pii:populations:email-network -- --artifacts-dir=/tmp/c1-artifacts --product-repo=/absolute/path/to/redact-secret --output=evidence/901/424/pii-email-network-population-evidence-v1.json
node --import tsx --test tests/pii-email-network-population.test.mjs
npm run pii:ledger:check
```

The script refuses any tarball whose registry shasum or integrity differs from the manifest. It also refuses a candidate manifest other than
the one the #422 ledger binds. Run id and timestamps differ between runs, and every count reproduces.
