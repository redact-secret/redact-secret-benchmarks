# Evidence: redact-secret#935: fixed-candidate rerun of its benchmark fixtures

## Rerun at the re-bound Beta.11 candidate 8b6a5fd (current)

**Result:** PASS, unchanged. The Beta.11 candidate moved from `ec9224d` to product main `8b6a5fd` (PR #996, the #902
Wasm follow-up; PII-only code, output byte-identical). Every fixture of this record has the same outcome and finding
count there. The record stays `verified`.

| Fixture | Kind | Candidate `ec9224d` | Candidate `8b6a5fd` |
| --- | --- | --- | --- |
| `beta8-379--connection-string-sqlalchemy-ipv6` | policy | EXACT | EXACT |

- Candidate run `e795030e-478e-4d21-9775-57456d832143` (complete, full suite, 4,777 of 4,777 fixtures, `eval:validate`
  passed), benchmarks `405892a5ba40b6eeef919d2fb818470ee495092c` (clean, the re-pin), corpus `d88c19f7…3e2f` (unchanged).
- Artifacts: core `467111e2…f74c`, node `19f41652…05ea`, wasm `61d135ba…6f2d`.
- Product conformance at `8b6a5fd`: [Artifact qualification run 36581019627](https://github.com/redact-secret/redact-secret/actions/runs/36581019627) (success).
- Raw rows: [`candidate-rerun-8b6a5fd.json`](candidate-rerun-8b6a5fd.json). Family-level summary:
  [`../860/8b6a5fd/README.md`](../860/8b6a5fd/README.md).

The `ec9224d` rerun below is superseded by this one and kept as history.

## Rerun at the re-bound Beta.11 candidate ec9224d (superseded)

**Result:** PASS, unchanged. The Beta.11 candidate was re-bound from `8f97f14` to product main `ec9224d` (PR #994: the
#948 provider-named generic-token fallback, the #993 non-secret value exclusions and the #902 linear PII context
association). Every fixture of this record has the same outcome and finding count there. None of them is among the 177
fixtures #948 changes or the one #993 changes. The record stays `verified`.

| Fixture | Kind | Candidate `8f97f14` | Candidate `ec9224d` |
| --- | --- | --- | --- |
| `beta8-379--connection-string-sqlalchemy-ipv6` | policy | EXACT | EXACT |

- Candidate run `589527ab-8df1-4ae7-a517-26f7567ffb3b` (complete, full suite, 4,777 of 4,777 fixtures, `eval:validate`
  passed), benchmarks `5b03068ae5f1d34ae52549cf05d13c97aaf4ed0f` (clean), corpus `d88c19f7…3e2f` (the #948 relabel and
  the nine `beta8-948` controls; this record's fixtures are unchanged).
- Artifacts: core `467111e2…f74c`, node `9ceabe01…83d6`, wasm `c3f54788…7d78`.
- Product conformance at `ec9224d`: [Artifact qualification run 36570726765](https://github.com/redact-secret/redact-secret/actions/runs/36570726765) (success).
- Raw rows: [`candidate-rerun-ec9224d.json`](candidate-rerun-ec9224d.json). Family-level summary:
  [`../860/ec9224d/README.md`](../860/ec9224d/README.md).

The `8f97f14` rerun below is superseded by this one and kept as history.

## Rerun at the re-bound Beta.11 candidate 8f97f14 (superseded)

**Result:** PASS, unchanged. The Beta.11 candidate was re-bound from `1db8ff3` to product main `8f97f14` (PR #991, the
#980 performance backlog, and PR #992, the #990 streaming fixes). Every fixture of this record has the same outcome
and finding count there. The record stays `verified`.

| Fixture | Kind | Candidate `1db8ff3` | Candidate `8f97f14` |
| --- | --- | --- | --- |
| `beta8-379--connection-string-sqlalchemy-ipv6` | policy | EXACT | EXACT |

- Candidate run `74888ff3-48ed-4459-b2fe-32906a5a95cb` (complete, full suite, 4,768 of 4,768 fixtures, `eval:validate`
  passed), benchmarks `005b19b85368d24910da437f31db701d670a2b8d` (clean), corpus `a89a8d11…6d75` (unchanged).
- Artifacts: core `467111e2…f74c`, node `b32d462b…29f8`, wasm `b6819bfd…e966`.
- Product conformance at `8f97f14`: [Artifact qualification run 36553444981](https://github.com/redact-secret/redact-secret/actions/runs/36553444981) (success).
- Raw rows: [`candidate-rerun-8f97f14.json`](candidate-rerun-8f97f14.json). Family-level summary:
  [`../860/8f97f14/README.md`](../860/8f97f14/README.md).

The `1db8ff3` rerun below is superseded by this one and kept as history.

## Rerun at 1db8ff3 (superseded)

**Result:** PASS. On the fixed candidate `1db8ff3` all 1 of this gap's benchmark fixtures meet their expectation (observed: missed).

Gap: [redact-secret#935](https://github.com/redact-secret/redact-secret/issues/935), connection-string misses the password in dialect+driver:// URLs (postgresql+psycopg://). Known-gap record
`product-935`, fixed by [`4e86505`](https://github.com/redact-secret/redact-secret/commit/4e865058e94bb0ead2d39f73d607a0b8e31a43f5).
This is the benchmark-side rerun that
[`decision-govern-benchmark-promotion`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-18-govern-benchmark-promotion.md)
requires before `verified`. It keeps no fixture content and no matched value.

## Fixture outcomes

| Fixture | Kind | Observed (candidate `b0be64b`) | Candidate `1db8ff3` |
| --- | --- | --- | --- |
| `beta8-379--connection-string-sqlalchemy-ipv6` | policy | missed | exact span |

Raw outcome rows for these fixtures with the run identities: [`candidate-rerun.json`](candidate-rerun.json).

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` candidate | `1db8ff38b16e50c51229eb27025452952bf621e1`, clean, product `main` (the frozen Beta.11 candidate; descends from the fixing commit) |
| `redact-secret-benchmarks` | `3cd8d6525d8d0b80195f896849b3efbd48ca2764`, clean, `develop`; lockfile SHA-256 `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939` |
| Corpus | measurement-v4, hash `a89a8d117ef2e3b80fb2a7e6b612fc5c464030bfc4d9cd05c52204aba8706d75` |
| Candidate run | `009a85fa-e810-4ab8-85a5-a264dba30536`, 2026-09-28T21:41:22.018Z to 2026-09-28T21:41:24.715Z, status `complete`, scope `full-suite`, 4,768 of 4,768 fixtures, `eval:validate` passed |

Detection is unchanged after the candidate. Product `main` after `1db8ff3` adds only `CONTRIBUTION.md` and the manifest
and pin changes of [redact-secret#961](https://github.com/redact-secret/redact-secret/pull/961) (merge `ca20862`), so
this rerun also stands for that merge.

## Scanner and artifacts

Candidate-only rerun (`redact-secret-candidate`, adapter version 2, default detectors, configuration hash
`c1af1eee…`, Node v22.16.0 on darwin-arm64). No peer scanner is involved, so this is
candidate mode with no peer comparison. Installed from isolated npm tarballs built at the candidate commit by
`npm run benchmark:candidate`:

- core facade `0.1.0-beta.10` SHA-256: `4681ad429ebe1b2c7ae9f5d72479ba996c75eb4a118049b6dbe4ea8dcfbd29a1` (identical to the earlier `1db8ff3` build in [`../860/1db8ff3/`](../860/1db8ff3/README.md))
- node darwin-arm64 SHA-256: `fec9c4332aa68426f0cbcd8fc7ee1f6d34d53b2db32530ea17af6fd99fd32d22`
- wasm SHA-256: `af0633663d713456a82d297f23023280cff05ad5f56489e9e72854601af2b1a1`

## Product conformance

The canonical regression fixtures of product manifest record `benchmark-gap-935` pass in
[Artifact qualification run 36480272622](https://github.com/redact-secret/redact-secret/actions/runs/36480272622) at the same commit `1db8ff3`: Rust native host (ubuntu, macOS,
Windows), browser WebAssembly (Chromium, Firefox, WebKit), the CLI, the N-API addon, and the Python wheel. The product
manifest records `productConformance: passed` as of merge
[`ca20862`](https://github.com/redact-secret/redact-secret/blob/ca208625f6811206e6211a29bb2cdf2a6b12ccc5/conformance/benchmark-regressions.json).

## Command

From a clean `redact-secret` checkout at `1db8ff38b16e50c51229eb27025452952bf621e1`:

```sh
npm run benchmark:candidate -- --benchmark-ref 3cd8d6525d8d0b80195f896849b3efbd48ca2764 \
  --benchmark-repo <redact-secret-benchmarks> --output-dir <out>
npm run eval:validate -- <out>/candidate-evidence-v1.json   # from redact-secret-benchmarks at 3cd8d65
```
