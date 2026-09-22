# Beta.3 published-package comparison

Measured 2026-09-16 using the published npm packages on macOS arm64,
Node.js v22.16.0. Both versions scanned the same **243 files and
128 expected secret spans** across eight suites. Fixture inputs and expected
ranges are unchanged; only release-scope metadata was refreshed. Scoring uses
exact UTF-8 byte ranges, with partial matches counted as FP + FN.

| Suite | beta.1 TP / FP / FN | beta.3 TP / FP / FN |
| --- | ---: | ---: |
| Detection accuracy | 5 / 0 / 0 | 5 / 0 / 0 |
| GitHub token contexts | 4 / 0 / 0 | 4 / 0 / 0 |
| Credential formats | 24 / 0 / 3 | 27 / 0 / 0 |
| Context & boundaries | 23 / 0 / 0 | 23 / 0 / 0 |
| Negative controls | 0 / 0 / 0 | 0 / 0 / 0 |
| SendGrid regressions | 6 / 3 / 24 | 30 / 0 / 0 |
| Reference syntax | 6 / 19 / 0 | 6 / 3 / 0 |
| Beta.3 regressions | 31 / 56 / 2 | 33 / 0 / 0 |
| Total | 99 / 78 / 29 | 128 / 3 / 0 |

Beta.3 detects all 128 expected spans. The closed milestone cohort has no
remaining misses or false positives, and all 30 SendGrid regression positives
match exactly with no findings on its eight negatives. Three false positives
remain in Reference syntax:

- `windows-env`
- `sql-bind`
- `azure-keyvault`

These are observations from synthetic, draft corpora, not a product ranking
or validation of all upstream issue acceptance criteria. Python, browser WASM,
CLI parity, streaming partitions, and release-host acceptance remain outside
this npm whole-input benchmark.

Gitleaks 8.30.1 and TruffleHog 3.97.4 completed all eight suites. Their per-suite
TP/FP/FN counts were unchanged between runs. Live credential verification
remained disabled.

## Reproduce

```sh
npm ci
npm run compare
npm run build
```

The comparison passed fixture-drift validation, 69 unit/redaction tests, four
real-scanner integration tests, and all 24 scanner/category executions.
Generated reports in `public/results/` record versions, hashes, runtime and
revision; they remain gitignored and are included in the local static build.
This document preserves the beta.1 comparison after those latest reports
are replaced by the beta.3 run.

This comparison preserves the original 243-file corpus. The subsequent
[all-detector expansion](../../../fixtures/generated/README.md#all-detector-expansion)
adds 248 files and has separately reported results.

## Range-scoring correction

The table above is the historical exact-range observation on the original
243-file corpus, not a neutral product ranking. Its source document is now
committed. Report schema v2 separately exposes expected-span containment and
broader-only findings without changing exact-range labels or trimming scanner
output to ground truth. The [v2 run summary](range-scoring-v2-results.json)
records the original eight suites plus the subsequent detector-coverage suite,
including hashes, versions, timestamps, and draft status. Do not combine the
expanded corpus with the original 128-span denominator.

The detector-coverage suite follows Redact Secret's own 25-family registry and
is structural regression evidence, not an independent sample. In the v2 run,
TruffleHog contains 54 of its 198 expected spans, including 6 broader-only
findings; its exact-range result remains 48 TP / 6 FP / 150 FN. Containment is
not a redaction-success or precision rate. All three scanners completed all
nine suites with verification disabled for TruffleHog.
