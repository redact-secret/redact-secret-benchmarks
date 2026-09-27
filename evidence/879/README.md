# US Social Security number PII candidate evidence

The exact merged product candidate remains `pending`: public population evidence records one known benign placeholder false positive, the common Wasm payload exceeds its zero-growth budget, and the sealed protected holdout remains deliberately unspent at 0/1 runs.

No `provisional` or `stable` support claim is made. The qualification artifact is
`not-qualified`, and the support row mechanically records
`population-comparison-not-qualified`, `population-no-regression`,
`protected-partition`, and `runtime-and-package-cost`.

## Source identities

- Product source: clean `redact-secret/redact-secret` commit
  `a0709d2a41b70217874da9afeffb40fb2a1a2596` (PR #894 merge); baseline is
  its immediate parent `63a834e0a2b44c11f307ece8c539b933dabb68f1`.
- Candidate npm facade SHA-256:
  `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`.
- Candidate evidence commitment:
  `abd77d4f53cbea579d184b0ee24304582aa6b78803481cab6e8117db95ceb939`.
- Candidate artifact-set commitment:
  `0b4e40821cfe93936c4879f29aa9b17f27cb4fdb412f2e35df5d20f134487ea7`.
- Population measurement implementation: benchmark commit
  `b0200d44b0073e633e9a4ab796a6285e07ba3451`; operational measurement
  implementation: `9b9a4fc5c75043118b70d9767f2f99b33351f412`; final qualification and
  redacted-unspent validation: `656e0b2ed5631d0f95741e734cad6d55cf0632a1`.
- The full-suite candidate artifact was built against benchmark commit
  `677bd3f16cbc09c812bb60e2d286cc33111ef37f`, with a clean benchmark tree.
- TruffleHog was resolved to the repository pin `3.97.4` before evaluation.
  These are candidate-mode product measurements, not a published-mode or
  peer-scanner comparison, and no release-support count is claimed.

## Result

Activation and exact-source evidence pass. Installed Node addon and Node Wasm
both expose the canonical `pii:us` closure, agree on public finding/range
behavior, and pass PII-off controls. Rust-native, Python, and CLI conformance
lanes pass against the exact clean product commit. The activation commitment is
`c65eb0ba56a64cb46698c84a602c11760a196342f526b0884ae0c13ae53dc54e`;
the qualification commitment is
`c6580491dca8b49348c429b25efdd9858cdc7b17e35659b203d067838d7e14f1`.

The diagnostic-balanced comparison passes. The benign-heavy-stress comparison
fails only in the committed `stress-placeholder` case: a validator-valid,
non-sensitive placeholder in `jurisdiction:US` changes the false-alarm rate
from 0 to 1. This is a reviewed product false positive under the frozen
contract, not a mislabeled fixture; no candidate text is stored here. The
population bundle commitment is
`62ae87dba6a90b278a0119f5e76e52a9092839d3aa06e917b30ba429350a01b1`.

All eight process-isolated runtime comparisons pass with 10 paired successful
samples per side and profile. Packed core, Node, and Wasm tarballs pass their
budgets; full and aggregate Wasm payloads also pass. The common Wasm payload
fails its frozen zero-growth budget:

| Common Wasm encoding | Baseline bytes | Candidate bytes | Delta | Budget |
| --- | ---: | ---: | ---: | ---: |
| raw | 730,074 | 733,749 | +3,675 | 0 |
| gzip | 270,896 | 272,268 | +1,372 | 0 |
| brotli | 214,732 | 215,420 | +688 | 0 |

The operational commitment is
`0da0ab98b57b971816e6496b022ef374101f25a37389396629398bef2c762b67`.

Because public gates already fail, the protected corpus was not executed. The
separate public attestation binds the sealed epoch and manifest only by opaque
commitments, records `sealed=true`, `maxRuns=1`, `runs=0`, and decision
`not-run` with reason `public-gates-failed`. Its commitment is
`830a3306f7a8d183cc2a6d55117a13db0c8f3268335786511e4f7edac18594da`.
It is evidence of procedural custody and an unspent run budget, not evidence of
protected-corpus performance.

The generated support matrix commitment is
`fc6ea430fc34976ed2497dcec9cbc91d8a16c9c5b85035064abe834d8d002f00`;
its file SHA-256 is
`360e40fe9ecc7b12458f808e9dc3953b6f6c17fc41ac6e9726d22c82aade9cbc`.

## Reproduce and validate

Check out immutable evidence/binding commit
`ccb7ee0d4182a9f043329ab39e90bf32bb8e3101`, put the repository-owned
TruffleHog `3.97.4` binary first on `PATH`, and use the exact candidate tarballs
named by `candidate-evidence-v1.json`. The qualifier and redacted-unspent
validator used to produce these artifacts are the implementation at
`656e0b2ed5631d0f95741e734cad6d55cf0632a1`; the later commit adds only the
sanctioned tuple, documentation, and immutable evidence files needed by the
commands below. The public population and operational artifacts in this
directory are immutable inputs; the protected input is only the redacted
unspent attestation in this directory.

```sh
trufflehog --version
npm run pii:qualify:candidate -- \
  --candidate-evidence=evidence/879/candidate-evidence-v1.json \
  --core=/absolute/path/to/redact-secret-core-0.1.0-beta.9.tgz \
  --node=/absolute/path/to/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz \
  --wasm=/absolute/path/to/redact-secret-wasm-0.1.0-beta.9.tgz \
  --plan=benchmarks/evaluation/domains/pii/us-ssn-qualification-v1.json \
  --product-source=/absolute/path/to/clean/product-a0709d2 \
  --population-evidence=evidence/879/pii-population-arrival-v1.json \
  --operational-evidence=evidence/879/pii-operational-evidence-v1.json \
  --protected-evidence=evidence/879/pii-protected-unspent-attestation-v1.json \
  --activation-output=/tmp/pii-activation-evidence-v1.json \
  --qualification-output=/tmp/pii-family-qualification-v1.json
npm run pii:support:record -- \
  --candidate-evidence=evidence/879/candidate-evidence-v1.json \
  --activation-evidence=evidence/879/pii-activation-evidence-v1.json \
  --qualification-evidence=evidence/879/pii-family-qualification-v1.json \
  --population-evidence=evidence/879/pii-population-arrival-v1.json \
  --output=/tmp/pii-support-matrix-v2.json
npm run eval:validate -- evidence/879/candidate-evidence-v1.json
```

This evidence addresses [benchmark issue #392](https://github.com/redact-secret/redact-secret-benchmarks/issues/392)
for [product issue #879](https://github.com/redact-secret/redact-secret/issues/879).
It supplies the diagnostic pending package requested by
[product issue #795](https://github.com/redact-secret/redact-secret/issues/795),
but does not satisfy that issue's proposal-to-provisional demonstration.
