# #428 final disposition: core `1127bf91`

**All six PII families stay `pending`.** Every public gate that is not about cost passes for every family on the exact final candidate. The public gates that still fail are cost gates only:

- `runtime-and-package-cost` fails.
- `size-regression-budget` fails.
- `profile-cost` is unresolved: the official Linux workflow has not run on this candidate.

The protected partition was not read or run. Each family's epoch is unspent at 0/1. Credential and PII counts are kept separate throughout, and no combined score exists.

This record is the final #428 run for [redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901). It adds files next to the interim records ([`README.md`](README.md) for `79c0a661`, and [`plan-set-v2-interim.md`](plan-set-v2-interim.md)) and edits neither.

## Candidate and evidence

- **Source.** `redact-secret/redact-secret` `1127bf91323797be89b4413c8051f9a9a85da43b`. It includes:
  - #930 (pii-context/v2, #922, #924–#927);
  - #944 (#940, #943; pii-context/v2 amended in place, activation identity unchanged);
  - #938 (#929 plus 13 credential detectors);
  - #947/#937 (PII runtime split out of the default Wasm builds).

  The version string is still `0.1.0-beta.10`. No beta.11 release exists.
- **Artifacts.** Built locally from a detached worktree (darwin-arm64). Tarball SHA-256 digests:
  - core `4681ad42…d29a1`
  - node-darwin-arm64 `4fb0161a…41608`
  - wasm `e62e3f26…1201f`
  - identity example `cd40bbeb…c09ef`

  The Artifact qualification CI run `36463771960` completed after the freeze, so the freeze records it as not available. It passed, with inventory `5ea986f5…75061`. Its Wasm payloads match the local build byte for byte in raw size, and within 20 bytes compressed.
- **Freeze.** [`core-1127bf913237/pii-beta11-freeze-v2.json`](core-1127bf913237/pii-beta11-freeze-v2.json), committed at `8dd3b08` before any scan. Commitment `8703fbce…db1c5`. Population plan set `b11-population-v2`.
- **Measurement.** Committed at `096aab4`:
  - [observation](core-1127bf913237/pii-beta11-observation-v2.json)
  - [operational](core-1127bf913237/pii-beta11-operational-v2.json) (`67d165d1…0098f`)
  - [report](core-1127bf913237/pii-beta11-report-v2.json) (`33047096…1deb0`)
  - [disposition](core-1127bf913237/pii-beta11-disposition-v2.json) (`9d20cf86…7b58e`)

  `tests/pii-beta11.test.mjs` re-derives the report and disposition byte for byte.
- **Parity (#427).** [`../427/mixed-parity-core-1127bf913237-plan-v2-report-v1.json`](../427/mixed-parity-core-1127bf913237-plan-v2-report-v1.json), plan v2, committed at `a58f870`. Surfaces: Node addon, Node Wasm, browser Wasm (Chrome 154, with the `@redact-secret/wasm/pii` import mapped), Python, Rust and CLI.
  - Every surface agreed and met every expectation in both selections: 16/16 cases per operation, 574/574 partitions, 606/606 output bytes, 0 values left, 0 range-unit errors.
  - The credential-only control is unchanged with PII off.

## Six-family matrix

Profile `pii-v1`, context `pii-context/v2` (en, ko). Each population cell reads as sensitive detected, then false alarms over non-sensitive plus not-established cases. Counts come from the reviewed view on the Node addon under `pii:global`+`pii:us`. The Node Wasm lane is identical case for case, in every selection.

| Family | Scope | Supported contract | Status | Failed or withheld gates | Oracle plan | Diagnostic-balanced | Benign-heavy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| network-address | global | 875 contract v1 + #925 | pending | runtime-and-package-cost, size-regression-budget, profile-cost (unresolved), protected-partition (not-run) | 8/8, FA 0/17 | 41/41, FA 0/56 | 24/24, FA 0/56 |
| email | global | `email-v1.md` (#926/#927/#943 amendments) | pending | same four | 4/4, FA 0/16 | 44/44, FA 0/42 | 12/12, FA 0/39 |
| payment-card | global | `payment-card-v1.md` | pending | same four | 5/5, FA 0/14 | 71/71, FA 0/90 | 13/13, FA 0/42 |
| iban | global | `iban-v1.md` | pending | same four | 2/2, FA 0/19 | 39/39, FA 0/54 | 5/5, FA 0/45 |
| us-ssn | `us` only | `us-ssn-v1.md` | pending | same four | 3/3, FA 0/17 | 9/9, FA 0/10 | 7/7, FA 0/22 |
| phone | global (NANP `+1`) | `phone-v1.md` | pending | same four | 14/14, FA 0/27 | 9/9, FA 0/12 | 7/7, FA 0/27 |

Every other gate is met for all six families:

- exact-candidate binding;
- activation-v2 (all selections, both surfaces);
- PII-off invariance;
- the oracle-plan public stream;
- identity-only classification, through the #910 seam: 103 exact matches and the 7 pre-registered named-negative cases compared identity-only, with no failures;
- source/artifact equivalence;
- cross-surface determinism;
- the diagnostic-balanced and benign-heavy populations (every `pii-v1` metric);
- population no-regression against beta.10;
- population mass resolved;
- authored-truth agreement (0 deviations);
- contract-fixture discrepancy;
- cross-surface output (#427, above);
- **default-wasm-excludes-pii**;
- trusted accounting source;
- independent evidence.

No new product defect was found.

## Cost (default Wasm vs `_pii` artifacts)

**Split verified.** Both default raw builds (`redact_secret_wasm.js` and `redact_secret_wasm_common.js`) reject `pii:global` with `PII_SELECTOR_UNAVAILABLE`. Both `_pii` builds activate it under the frozen v2 identity.

**Default builds**, local build compared with the evidence/879 baseline `63a834e0`:

| Payload | raw | gzip-9 | brotli-11 | vs 879 baseline (raw / gzip / brotli) |
| --- | ---: | ---: | ---: | --- |
| default full | 515,537 | 176,402 | 138,360 | −214,465 / −94,497 / −76,192 |
| default common | 336,984 | 120,688 | 97,184 | −393,090 / −150,208 / −117,548 (zero-growth budget **passes**) |

**`_pii` builds.** No budget existed before this candidate, so these are reported on their own:

| Payload | raw | gzip-9 | brotli-11 |
| --- | ---: | ---: | ---: |
| `redact_secret_wasm_pii_bg.wasm` | 801,626 | 296,135 | 232,459 |
| `redact_secret_wasm_common_pii_bg.wasm` | 623,066 | 239,288 | 192,464 |

The gates that still fail:

- **`runtime-and-package-cost`** (evidence/879 contract, paired local build):
  - `nodePacked` +34,452 B against a maximum increase of 32,768;
  - `wasmPacked` +302,063 B against 32,768. The npm Wasm tarball now carries four payloads.

  Every runtime median passes, and so does every default-payload byte row.
- **`size-regression-budget`** (#143, beta.8 baseline):
  - `size/wasm/full/gzip`: 176,402 vs 137,639 (+38,763, allowed +6,882)
  - `size/wasm/common/gzip`: 120,688 vs 100,058 (+20,630, allowed +5,003)
  - `size/npm/wasm/packed`: 861,636 vs 254,413
  - `size/npm/node-darwin-arm64/packed`: 624,138 vs 424,514
  - `size/npm/core/packed` is within budget (+2,189).
- **`profile-cost`** is unresolved. [`qualification/pii-profile-cost-v2.json`](../../../qualification/pii-profile-cost-v2.json) is bound to this candidate at `e8853f5`:
  - role `final`;
  - CI run `36463771960`, inventory `5ea986f5…`;
  - chromium PII-on samples run the `_pii` entries;
  - the size roster keeps `_pii` payloads apart from the default rows.

  The workflow checks out its plan from the dispatched ref, and every A/A, freeze, candidate and size run must share one head SHA. It therefore has to be dispatched on a pushed ref that contains `e8853f5`. `develop` still binds the interim candidate. It was not dispatched from this branch because it has not been pushed.

## Protected partition

Not run. No family is eligible, because every family fails public cost gates. Every family is **eligible except for cost alone**: only runtime-and-package-cost, size-regression-budget and profile-cost block it. Each epoch stays unspent at 0/1 with reason `public-gates-failed`. The epoch commitments are in the freeze:

| Family | Epoch |
| --- | --- |
| network-address | `d294e073` |
| email | `fc740d1c` |
| payment-card | `117e65e8` |
| iban | `19abdb65` |
| us-ssn | `dbf70ea7` |
| phone | `37784f66` |

No custodian-held protected corpus is registered for any family on this candidate, and the evidence/879 SSN epoch does not carry over. The protected question goes to the maintainer.

## Support projection and site copy

No status changes, so nothing was regenerated. All six families are `pending` in the published `pii-support-matrix-v2`, and that remains correct.
