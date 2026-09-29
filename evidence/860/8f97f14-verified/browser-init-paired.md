# Browser WASM initialization: 1db8ff3 vs 8f97f14, paired (#990, #980)

**Verdict: noise.** Run [36555971146](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36555971146)
breached `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` at 1.277 against beta.8, where 1.25 is
allowed. Measured head to head, 8f97f14 initializes 1.0–2.7% slower than 1db8ff3 on that row, with per-run intervals
spanning about ±13%. The same row moves −1.3% and +11.0% in A/A runs. On the steadier medium row, which does the same
initialization work, the shift is 0.0–1.8%. No 5% shift is present. Samples: [`browser-init-paired.json`](browser-init-paired.json).

## Method

`performance-evaluation.yml` on `beta11/rebind-8f97f14-credentials` @ `c61df33`, `rounds=20`: 40 interleaved
fresh-process samples per side per run, on each run's own runner. The budget step of these runs exits "invalid" by
design, because the baseline is not 0.1.0-beta.8. Only their `paired.json` is used. Ratios are candidate/baseline
medians (nearest rank). The 95% intervals come from a bootstrap over the samples (4,000 resamples). Runs land on
different CPU models, so only within-run ratios are compared.

## Results (initialization, ms)

| Run | Pair | CPU | Row | Base median / p95 | Cand median / p95 | Median ratio | 95% interval |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| [36556597811](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556597811) | 1db8ff3 → 8f97f14 | Xeon 6973P-C | small-whole | 10.2 / 19.8 | 10.3 / 17.6 | 1.010 | [0.885, 1.146] |
| | | | medium-fixed4096 | 13.8 / 15.5 | 13.9 / 15.6 | 1.007 | [0.972, 1.037] |
| [36556606329](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556606329) | 1db8ff3 → 8f97f14 | EPYC 7763 | small-whole | 14.6 / 17.7 | 15.0 / 19.2 | 1.027 | [0.866, 1.110] |
| | | | medium-fixed4096 | 16.9 / 18.2 | 17.2 / 18.3 | 1.018 | [0.994, 1.042] |
| [36556615116](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556615116) | 1db8ff3 → 8f97f14 | EPYC 9V74 | small-whole | 15.1 / 18.4 | 15.3 / 18.0 | 1.013 | [0.927, 1.067] |
| | | | medium-fixed4096 | 17.4 / 18.5 | 17.4 / 18.6 | 1.000 | [0.983, 1.035] |
| [36556623621](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556623621) | A/A 8f97f14 | EPYC 9V45 | small-whole | 9.1 / 12.8 | 10.1 / 18.1 | 1.110 | [0.949, 1.256] |
| | | | medium-fixed4096 | 11.6 / 13.2 | 11.7 / 13.5 | 1.009 | [0.983, 1.026] |
| [36556627045](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36556627045) | A/A 1db8ff3 | EPYC 7763 | small-whole | 15.8 / 26.2 | 15.6 / 20.5 | 0.987 | [0.854, 1.086] |
| | | | medium-fixed4096 | 17.3 / 18.9 | 17.3 / 18.6 | 1.000 | [0.983, 1.029] |

Processing in the same paired runs: 8f97f14/1db8ff3 median ratio 0.66–0.77 on small-whole and 0.34 on medium.

## WASM size and compile/instantiate split

| Full build | raw | gzip (level 9) |
| --- | ---: | ---: |
| 1db8ff3 (candidate tarball) | 521,777 | 179,383 |
| 8f97f14 (CI, run 36557682258) | 534,232 | 184,422 |
| change | +12,455 (+2.4%) | +5,039 (+2.8%) |

The workflow does not split initialization. A local check timed `WebAssembly.compile` and `WebAssembly.instantiate` of
the two full builds, 60 interleaved fresh Node v22.16.0 processes each, on darwin-arm64. Medians:

| | 1db8ff3 | 8f97f14 | Ratio |
| --- | ---: | ---: | ---: |
| compile | 0.550 ms | 0.561 ms | 1.019 |
| instantiate | 0.265 ms | 0.269 ms | 1.013 |

V8 compiles lazily, so these steps take under 1 ms of the 10–17 ms browser initialization. The +2.8% module adds about
0.015 ms there. The breach in run 36555971146 was a 2.3 ms gap (medians 8.3 ms and 10.6 ms over 12 samples per
side), which is 150 times larger.

## Follow-up

The official run on the same head, [36557682258](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36557682258),
reads 1.082 on this row, within budget, and concludes ACCEPTED.
