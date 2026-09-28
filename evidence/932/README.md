# Evidence: redact-secret#932: fixed-candidate rerun of its benchmark fixtures

**Result:** PASS for the fixed forms. On the fixed candidate `1db8ff3`, 3 of this gap's 4 benchmark fixtures meet their expectation. The remaining policy row stays unreported by product policy (below).

Gap: [redact-secret#932](https://github.com/redact-secret/redact-secret/issues/932), Deepgram/Cohere keyword-gated keys missed in same-line forms the gate does not recognise (HTTPie Token header, Go/Java SDK calls, LiteLLM log). Known-gap record
`product-932`, fixed by [`127260c`](https://github.com/redact-secret/redact-secret/commit/127260c1bec71c181e043839a76607abbd72c6f3).
This is the benchmark-side rerun that
[`decision-govern-benchmark-promotion`](../../docs/decisions/2026-09-18-govern-benchmark-promotion.md)
requires before `verified`. It keeps no fixture content and no matched value.

## Fixture outcomes

| Fixture | Kind | Observed (candidate `b0be64b`) | Candidate `1db8ff3` |
| --- | --- | --- | --- |
| `beta8-379--deepgram-api-key-httpie-token` | policy | missed | exact span |
| `beta8-379--deepgram-api-key-go-client-literal` | policy | missed | exact span |
| `beta8-379--cohere-api-key-litellm-proxy-debug` | policy | missed | missed |
| `beta8-379--cohere-api-key-java-builder-token` | policy | missed | exact span |

`beta8-379--cohere-api-key-litellm-proxy-debug` is a `policy`-kind row and stays unreported at the candidate. That is the product policy the fix recorded, not a defect of this fix: the value sits under a `masked_`-led key, which [`decision-redact-provider-named-credential-assignments`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-24-redact-provider-named-credential-assignments.md) section 2 does not treat as a credential name, and product manifest record `benchmark-gap-932` records it as a policy note. The fixture's expectation is unchanged.

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

The canonical regression fixtures of product manifest record `benchmark-gap-932` pass in
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
