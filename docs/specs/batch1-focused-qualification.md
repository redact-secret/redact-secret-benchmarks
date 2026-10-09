# Batch 1 focused qualification

Issue: [#717](https://github.com/redact-secret/redact-secret-benchmarks/issues/717), core issues redact-secret#1209-#1213, evidence handoff credential-evidence#232. Decision: [measure Batch 1 with a focused corpus before any full run](https://github.com/redact-secret/redact-secret-benchmarks/blob/hygiene-records-before-removal-872-20261008/docs/decisions/2026-10-05-measure-batch-1-with-a-focused-corpus-before-any-full-run.md).

The focused corpus qualifies five bounded credential carriers (Figma `X-Figma-Token`, Asana `X-Hook-Secret`, Airtable `macSecretBase64`, Elastic `Authorization: ApiKey`, Canva `client_secret` and Basic) on the published build and on an exact candidate, without waiting for the other 101 candidates and without a full performance or peer run.

| Piece | File |
| --- | --- |
| authored cases and per-family contract split (provider fact against project policy) | `benchmarks/corpora/provider-shapes/corpus.mjs` |
| pure scoring (exact, over, under, partial, miss; action; type; overlaps; leaked and collateral bytes; whole/stream parity) | `benchmarks/corpora/provider-shapes/score.mjs` |
| scan every case through Node, WASM, Python and the CLI, whole and streamed | `scripts/measure-focused-corpus.mjs`, `benchmarks/corpora/provider-shapes/python-surface.py` |
| score two runs, write the per-case report | `scripts/report-focused-corpus.mjs` |
| recorded run | `evidence/717/` |

A case is `positive` (expected span is the credential value, or the encoded envelope for Basic and ApiKey; expected action `redact`), `control` (no finding may touch it) or `unsupported` (observed, never scored). Generic `contextual_secret` and `authorization_credential` types are accepted and provider attribution is not promised. Values are built from public seeds with SHA-256 and never from a scanner result, a provider example or an issued credential. A case may change class only with the reason written down in the evidence README. Nothing here edits a pin, the ledger, a support status or the authority file.

The harness records spans, types, detectors and actions only. It is an exploratory measurement, not an official run: the qualification pipeline (`official-runs.yml`, credential-eval) still owns support status.

## Current parameterised commands (#876)

`measure-focused-corpus.mjs --label candidate --source-commit <40-hex product commit> --corpus ../benchmarks/corpora/provider-shapes/corpus.mjs --node-root <exact installed product> --out results-output/<run>/observations.json` retains Node/WASM/Python/CLI whole/stream measurement and explicit chunk sizing. Select bindings with the existing `--wasm-dir`, `--python`, `--cli` flags; this is a product-only diagnostic, not an official scanner run.

`report-focused-corpus.mjs --run-id <identity> --published <observations.json> --candidate <observations.json> --corpus benchmarks/corpora/provider-shapes/corpus.mjs --scorer benchmarks/corpora/provider-shapes/score.mjs --out-dir results-output/<run>/report` binds the exact observations, recorded product commits, corpus digest and scorer module digest. For repeated-secret carriers use the neutral harness's `score-multispan.mjs`; the second occurrence remains independently scored.

Outputs default to fresh ignored `results-output/` paths, refuse existing destinations and accepted historical paths, and stage complete reports before publication. Failed staging removes partial output. These commands offer no accepted-record promotion; adoption continues through the separately reviewed acceptance workflow. Completed round-specific renderers/writers are archived with original observations and outputs in `docs/retention/command-dispositions.json`; restore the original source/tag and inputs, never run a historical writer against current pins.
