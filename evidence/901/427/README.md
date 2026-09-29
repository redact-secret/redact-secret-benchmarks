# Beta.11 PII D: mixed-document, incremental and binding parity (benchmarks #427)

On the published beta.10 release, all six surfaces agree: Node addon, Node Wasm, browser Wasm, Python, Rust and the CLI. They report the same findings, actions and ranges and produce the same sanitized bytes. That holds for every mixed document, both line endings, both PII selections and every chunk partition. Turning PII off leaves credential findings and credential-only output unchanged. The only expectation failures come from the defect already filed as [redact-secret#922](https://github.com/redact-secret/redact-secret/issues/922), and they occur identically on every surface. No new product defect was found, and no status changes.

**Update (exact repaired core, plan v2).** On core `79c0a661` (redact-secret#930, which fixes #922 and #924–#927 and ships `pii-context/v2`), all six surfaces meet every expectation of the new plan v2 in both selections. That is 36 of 36 required PII targets and 11 of 11 credential targets. Cross-surface disagreements, leaked values and range-unit errors are all zero, and the PII-off credential behaviour is unchanged. No new product defect was found. See [Exact repaired core](#exact-repaired-core-79c0a661-plan-v2).

**Update (final Beta.11 candidate `8f97f14d`, plan v2).** On core `8f97f14d` all six surfaces again agree and meet every plan v2 expectation in both selections (16/16 per operation, 574/574 partitions, 606/606 output bytes, 0 values left, 0 range-unit errors); PII-off credential output is unchanged. The report is identical to the `1db8ff38` one apart from commits and artifact hashes, and it supersedes the `1db8ff38` and `1127bf91` reports for the release decision: [`mixed-parity-core-8f97f14d97d7-plan-v2-report-v1.json`](mixed-parity-core-8f97f14d97d7-plan-v2-report-v1.json).

This is baseline development evidence for
[redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901)
(benchmark issue [#427](https://github.com/redact-secret/redact-secret-benchmarks/issues/427),
parent [#421](https://github.com/redact-secret/redact-secret-benchmarks/issues/421)). It fills the
`cross-surface-output` row of the frozen [#422 ledger](../pii-gap-ledger-v1.json) for the published release and
does not edit the ledger or any earlier record. The exact beta.11 candidate is measured later with the same
harness (see [Rerun on a core commit](#rerun-on-a-core-commit)). It claims no support and promotes no status.
Credential and PII outcomes are counted in separate domains; there is no combined score.

## What was measured

| File | Content |
| --- | --- |
| [`mixed-parity-v1.json`](../../../benchmarks/evaluation/domains/pii/mixed-parity/mixed-parity-v1.json) | The frozen plan: 8 documents, 80 lines, expected targets in UTF-8, UTF-16 and code-point units, and the expected sanitized bytes |
| [`mixed-parity-published-beta10-observation-v1.json`](mixed-parity-published-beta10-observation-v1.json) | Per surface, selection and case: findings (type, detector, action, confidence, native and UTF-8 range), output SHA-256, leak booleans, limit probes and deduplicated partition results. It holds no input or output text |
| [`mixed-parity-published-beta10-report-v1.json`](mixed-parity-published-beta10-report-v1.json) | The scored report. It re-scores byte for byte from the observation (`tests/pii-mixed-parity.test.mjs`) |

**Documents.** Every line is one of three kinds:

- A reviewed #424/#425/#426 case, copied verbatim with its reviewed expectation. The source plan's SHA-256 is
  bound, and cases with a #426 correction are refused.
- A reviewed T1 credential fixture, stored as its id and content SHA-256 only. Generated credential inputs must
  not be tracked, so the value is regenerated at run time.
- Authored text with its own contract basis.

`pii-context/v1` associates context only on the same logical line, so each reviewed case keeps its reviewed
outcome inside a longer document. The documents are a support ticket, an application log, a checkout form, an HR
record, a config export with a PEM key, a Korean record with astral symbols, AI tool results and a
credential-only CI log. Together they mix:

- sensitive PII of all six families;
- valid non-sensitive values: NANPA 555-01xx numbers, reserved email domains, RFC 5737 addresses, official card
  test values and IBAN documentation examples;
- identifier collisions and invalid twins;
- public references, ordinary text and credential near-miss twins.

**Frozen before any scan.** The plan and its expected bytes were committed at `163f4ec` before the harness
existed. The harness refuses to run unless the plan is clean and regenerates byte for byte. Development runs
used the same frozen plan and were discarded. The recorded run is from a clean harness commit (`16302b0`).

| Independent units | Count |
| --- | ---: |
| Documents | 8 |
| Required PII targets (30 `redact`, 1 `warn`) | 31 |
| Optional PII targets (contract-contested envelopes) | 5 |
| PII lines that must stay unredacted (non-sensitive or not established) | 15 |
| Credential targets (any replacing action) | 11 |
| Targets tied to a known defect (#922) | 2 |

The following are checks on those units, not independent cases: 2 line-ending variants, 2 selections
(`pii-on` = `pii:global`+`pii:us`, `pii-off`), 3 whole-input operations, 6 surfaces, and 5,804 incremental
partition runs across 6,348 scored operations. Each document is partitioned as:

- one chunk;
- one chunk per code point;
- a cut inside every target;
- five boundary cuts per target (start, start+1, middle, end−1, end);
- a CR|LF split in the CRLF variant;
- three seeded random partitions.

**Envelopes.** Five lines put two candidates or fields on one line, or put an IP before a sentence-final period.
Contract v1 leaves these unassociated, or is silent about them (#424 observations 1, 3 and 6; #425 finding 2),
and the parallel core repair batch may change them. For each of these lines the plan accepts either absence
(the v1-literal outcome) or exactly the listed finding. Anything else is wrong, and every surface must still
agree.

**`warn` is not sanitized success.** Under `phone:`, a local-only `NXX-XXXX` number gets medium identity
confidence (phone-v1). The arbitration ADR makes Medium warn, so the plan expects a `warn` finding and unchanged
text. The report counts that operation as meeting expectation but never as sanitized.

## Candidate binding

- **Artifacts.** The published `0.1.0-beta.10` release, source commit `af7f863f`. The harness checks 13 digests
  against the release-manifest digests frozen in the ledger:
  - the facade tarball SHA-1;
  - the addon `.node` and 8 Wasm package files, each SHA-256 (the npm tarballs also match the lockfile sha512);
  - the macOS arm64 wheel;
  - the `redact-secret` and `redact-secret-cli` `.crate` files.

  The CLI was built with `--locked` from the verified published crate. Its own `Cargo.lock` pins the verified
  core crate checksum. The Rust runner resolves the same registry crate, and its lockfile checksum is checked
  too.
- **Surfaces and range units.**

  | Surface | Loaded artifact | Declared unit |
  | --- | --- | --- |
  | Node addon | `addon` | UTF-16 |
  | Node Wasm fallback | `wasm` | UTF-16 |
  | Browser Wasm | `wasm`, served over HTTP, `browser` condition via import map | UTF-16 |
  | Python extension | wheel | code points |
  | Rust crate | registry crate | UTF-8 |
  | CLI | built binary | UTF-8 |

  The browser surface ran in headless Google Chrome 154.0.8037.57. Every declared `RANGE_UNIT` matched its
  documented unit, and every native range converted back onto a code-point boundary (0 range-unit errors).
- **Host.** darwin-arm64, Node 22.16.0, Python 3.14.7, rustc 1.98.1. No peer scanner ran, and no credential
  `stable` count is claimed in either published or candidate mode.

## Results (published beta.10)

Every surface returned identical results; the rows below hold for each of the six.

| Selection | `scan` / `redact` / `scanAndRedact` expectation met | Incremental partitions met | Output bytes correct | Sanitized success | Whole-input limit probes | Incremental limit probe | Range-unit errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pii-on` | 12/16 each | 408/574 | 432/606 | 355/606 | 162/168 | 12/16 | 0 |
| `pii-off` | 16/16 each | 574/574 | 606/606 | 606/606 | 156/156 | 16/16 | 0 |

The CLI has no separate `redact(findings)` call, no caller-supplied limits, and no caller-controlled chunking.
Those paths are typed `not-applicable`. Its `--json` check and `--redact` path, plus one single and one paced
stdin write per case, matched the table's pattern: `pii-on` 12/16, 24/32 and 36/48; `pii-off` all correct.

**Cross-surface parity.** In all 32 selection × case groups, every operation on every surface produced one
findings signature and one output signature. There were no disagreements. That includes incremental output
against whole-input output, and every CRLF variant.

**Domain accounting (whole-input `scan`, LF+CRLF, identical on every surface).**

| Selection | PII required matched | PII unexpected | Credential required matched | Credential unexpected |
| --- | ---: | ---: | ---: | ---: |
| `pii-on` | 58/62 (missing: the 2 #922 targets × 2 variants) | 0 | 22/22 | 0 |
| `pii-off` | 0/0 | 0 | 22/22 | 0 |

**PII-off credential invariance.** Every surface gave the same results for the credential-only control under
`pii-on` and `pii-off`, both in its findings and in its output bytes. On all 16 cases, the credential findings
under `pii-off` equal the credential findings under `pii-on`, and no PII finding appears while PII is off.

**Envelopes.** All 5 optional targets are absent on every surface and in every operation, which is the
contract-v1-literal outcome. **Warn.** The local-only phone is a `warn` finding everywhere, and its text is
retained.

## Findings

1. **Known product defect, reproduced on every surface:
   [redact-secret#922](https://github.com/redact-secret/redact-secret/issues/922).** The `card_number`
   10-digit NANP-shaped PAN (`payment-form/L08`) and the `phone:` Luhn-valid number (`hr-record/L10`) are both
   missed under `pii:global`+`pii:us`. #425 had shown this for the Node addon and Wasm. It now also holds for
   browser Wasm, Python, Rust and the CLI, in whole-input and incremental operation. Every remaining failure in
   the tables follows from it:
   - the output-byte mismatches in those two documents;
   - the value left after replacement;
   - 6 `findings-under` probes that do not trip because the product finds one fewer finding than the plan
     expects;
   - 4 under-limit incremental probes whose sanitized prefix contains the missed value.

   In each of those probes the prefix is still byte-identical to the whole-input output.
2. **No new defect.** Apart from #922, every surface met every expectation in both selections: action, type,
   range, sanitized bytes, placeholder numbering, `block` on the PEM key, `warn` retention, fail-closed limit
   codes (`INPUT_LIMIT_EXCEEDED`, `FINDING_LIMIT_EXCEEDED`), and incremental sessions that end `failed` with
   only a sanitized prefix emitted.

## Exact repaired core `79c0a661` (plan v2)

**Plan v2.** [`mixed-parity-v2.json`](../../../benchmarks/evaluation/domains/pii/mixed-parity/mixed-parity-v2.json) is derived
mechanically from the frozen v1 plan, which is unchanged (commitment `b4092b25…b6789`, bound as `supersedes`). It changes
exactly one thing: each of the five v1 envelopes is promoted to a required target. The promoted targets keep their v1
ids, ranges, types and actions, and each cites the merged contract text that now decides it:

| Target | Decided by |
| --- | --- |
| `app-log-logfmt/L04/O1` (logfmt `email=`) | email-v1 `key=` label split, #926 |
| `app-log-logfmt/L07/O1` (IP before a sentence-final period) | network-address right-boundary rule, #925 |
| `app-log-logfmt/L08/O1`, `L09/O1`, `payment-form/L10/O1` (same-line fields) | `pii-context/v2` forward-only field-label equidistance, #924 |

No optional target remains. Every other expectation is byte-identical to v1: 36 required PII targets (35 `redact`,
1 `warn`) and 11 credential targets. Plan v2 was frozen at `d650739`, before any scan of the repaired core.

**Build.** The core commit was checked out as a fresh detached worktree at
`79c0a66119fb72931fda9adddbe2973a52bb4833` and built by the harness's core-commit path. Surface component SHA-256:

| Component | SHA-256 |
| --- | --- |
| facade tarball | `4df009d2…c002f` |
| Node addon package | `1454c342…3d24f` |
| Wasm package | `dde65143…9e3ff` |
| wheel | `c62ad9a2…e7152` |
| CLI binary | `10677a93…f3139` |

The core crate tree is `9a1384e6`. The build's package version string is still `0.1.0-beta.10`: core main has not
bumped it. Every surface reports `vocabulary=pii-context/v2` in its activation identity, and so does `selectors=off`,
as the v2 ADR states. The harness ran from benchmark commit `d650739` on a clean tree.

**Results (identical on Node addon, Node Wasm, browser Wasm, Python, Rust and CLI).**

| Selection | `scan` / `redact` / `scanAndRedact` | Incremental partitions | Output bytes correct | Sanitized success | Value left | Whole-input limit probes | Incremental limit probe | Range-unit errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `pii-on` | 16/16 each | 574/574 | 606/606 | 529/606 | 0 | 192/192 | 16/16 | 0 |
| `pii-off` | 16/16 each | 574/574 | 606/606 | 606/606 | 0 | 156/156 | 16/16 | 0 |

Under `pii-on`, the 77 operations short of sanitized success are exactly the operations on the support-ticket
document: its local-only phone is a `warn` finding and keeps its text by contract, as the plan expects. The
CLI covered the same paths as in the baseline and was fully correct: `pii-on` scored 16/16, 16/16, 32/32 and 48/48,
with 42 sanitized because of the same `warn`. The paths it lacks stay typed `not-applicable`.

**Domains (whole-input `scan`, LF+CRLF, every surface).**

| Selection | PII required matched | PII unexpected | Credential required matched | Credential unexpected |
| --- | ---: | ---: | ---: | ---: |
| `pii-on` | 72/72 | 0 | 22/22 | 0 |
| `pii-off` | 0/0 | 0 | 22/22 | 0 |

**Parity and invariance.** In all 32 selection × case groups, every surface and operation produced one findings
signature and one output signature. The credential-only control is identical under `pii-on` and `pii-off` on every
surface. On all 16 cases, the credential findings with PII off equal those with PII on, and no PII finding appears
while PII is off.

**Against the beta.10 baseline.**
- The two #922 targets are now matched everywhere.
- The five former envelopes are present everywhere, exactly at their frozen ranges.
- The knock-on limit and leak failures are gone.
- Nothing that passed before regresses.

**Findings.** No new product defect, so no core issue was filed. #922, #924, #925 and #926 are confirmed fixed on
every surface for the lines these documents exercise. The #927 additions (case folding and new label forms) are not
exercised by this plan.

## Ledger row owned by #427 (proposed; the ledger stays frozen)

| Blocker | All six families |
| --- | --- |
| cross-surface-output | published beta.10: surfaces agree, expectation met except #922 (payment-card, phone). Exact repaired core `79c0a661` (plan v2): surfaces agree, every expectation met in both selections. The versioned beta.11 release artifacts are still to be bound (#428) |

## Rerun on a core commit

The same harness builds an exact clean core commit and runs every surface. It follows the core repository's own
`benchmark-candidate` recipe (`js:build`, the Node addon build, `wasm:build`, `wasm:build:common`, then
`npm pack`), then runs `maturin build --release --locked` for the wheel and
`cargo build --release --locked -p redact-secret-cli` for the CLI. The Rust runner depends on the checkout's
`crates/secret-scan-core` by path. The core commit is checked out in a temporary detached worktree, which is
removed afterwards.

```sh
npm ci
npm run pii:parity:measure -- --target=core-commit \
  --core-commit=<40-hex core commit> --core-repo=<absolute path to a redact-secret clone>
# plan v2 by default (--plan=1 for the frozen v1 plan)
# writes evidence/901/427/mixed-parity-core-<sha12>-plan-v<N>-{observation,report}-v1.json
node --import tsx --test tests/pii-mixed-parity.test.mjs   # re-scores every committed observation
```

The build path was first checked end to end on `af7f863f`, and those results were not recorded. It was then used for
the recorded `79c0a661` run above.

**Vocabulary handling.** Shared benchmark validators now accept `vocabulary=pii-context/v2` next to v1:
- the activation-identity parser;
- the product identity-evidence check, which also requires the declared vocabulary to match the one the activation
  identity reports.

Frozen beta.10 records and the authored #423 oracle stay v1. The arrival-contract selection check defaults to v1, and
a v2 candidate has to name v2 explicitly. The profile-cost runner is hash-frozen by its own implementation freeze, so
it still expects v1. A v2 cost run (#428) needs a reviewed re-freeze.

## Reproduce

```sh
npm ci
node --import tsx scripts/generate-pii-mixed-parity.mjs --check
node --import tsx --test tests/pii-mixed-parity.test.mjs
npm run pii:parity:measure    # re-observes the published release; needs npm, PyPI and crates.io access plus Chrome
```
