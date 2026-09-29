# Browser WASM initialization: 8f97f14 vs ec9224d, paired (#948, #993, #902)

**Verdict: noise.** Run [36570952406](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36570952406)
breached `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` at 1.263 against beta.8, where 1.25 is
allowed. This is the same row that breached at 1.277 on 8f97f14 (run 36555971146) and was measured as noise then
([`../8f97f14-verified/browser-init-paired.md`](../8f97f14-verified/browser-init-paired.md)). Measured head to head,
ec9224d initializes at 0.900–1.019 times 8f97f14 on that row (pooled 0.992, 95% interval [0.912, 1.061]), and at
0.983–0.985 on the steadier medium row, which does the same initialization work. The A/A runs move the small row
−4.7% and +2.7%. No shift is present, and it was not recorded as an accepted tradeoff. Samples:
[`browser-init-paired.json`](browser-init-paired.json).

## Method

`performance-evaluation.yml` on `beta11/rebind-ec9224d-credentials` @ `af180a5`, `rounds=20`: 40 interleaved
fresh-process samples per side per run, on each run's own runner. The budget step of these runs exits "invalid" by
design, because the baseline is not 0.1.0-beta.8; only their `paired.json` is used. Ratios are candidate/baseline
medians (nearest rank); the 95% intervals come from a bootstrap over the samples (4,000 resamples). Runs land on
different CPU models, so only within-run ratios are compared. This is the method of the 8f97f14 check.

## Results (initialization, ms)

| Run | Pair | CPU | Row | Base median / p95 | Cand median / p95 | Median ratio | 95% interval |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| [36573672385](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573672385) | 8f97f14 → ec9224d | Xeon 6973P-C | small-whole | 10.6 / 13.0 | 10.8 / 17.5 | 1.019 | [0.930, 1.131] |
| | | | medium-fixed4096 | 13.4 / 15.0 | 13.2 / 14.3 | 0.985 | [0.949, 1.008] |
| [36573680137](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573680137) | 8f97f14 → ec9224d | EPYC 9V74 | small-whole | 16.0 / 27.4 | 14.4 / 20.5 | 0.900 | [0.809, 1.054] |
| | | | medium-fixed4096 | 17.4 / 18.6 | 17.1 / 18.5 | 0.983 | [0.961, 1.017] |
| [36573688556](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573688556) | 8f97f14 → ec9224d | EPYC 9V45 | small-whole | 11.2 / 19.9 | 11.0 / 14.3 | 0.982 | [0.853, 1.119] |
| | | | medium-fixed4096 | 12.5 / 13.6 | 12.3 / 15.1 | 0.984 | [0.976, 1.024] |
| [36573696216](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573696216) | A/A ec9224d | EPYC 9V45 | small-whole | 11.2 / 14.8 | 11.5 / 18.2 | 1.027 | [0.922, 1.132] |
| | | | medium-fixed4096 | 12.3 / 13.2 | 12.6 / 15.8 | 1.024 | [0.984, 1.041] |
| [36573704005](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36573704005) | A/A 8f97f14 | EPYC 7763 | small-whole | 14.9 / 18.3 | 14.2 / 18.1 | 0.953 | [0.847, 1.077] |
| | | | medium-fixed4096 | 17.0 / 18.1 | 17.2 / 18.7 | 1.012 | [0.977, 1.029] |

Pooled over the three paired runs (120 samples per side): small-whole 0.992 [0.912, 1.061], medium-fixed4096 0.985
[0.922, 1.038]. Processing in the same paired runs: ec9224d/8f97f14 median ratio 1.000–1.018 on small-whole and
0.974–1.000 on medium.

## WASM size

| Full build | gzip (CI, level of `measure-wasm-sizes.mjs`) |
| --- | ---: |
| 8f97f14 (run 36557682258) | 184,422 |
| ec9224d (run 36570952406) | 187,248 |
| change | +2,826 (+1.5%) |

The 8f97f14 check found WebAssembly compile and instantiate take under 1 ms of the 10–17 ms browser initialization, so
a +1.5% module cannot explain a 2–3 ms gap.
