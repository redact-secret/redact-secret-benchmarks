# Email-address PII candidate evidence

The exact merged product candidate exposes deterministic email-family activation and passes installed Node-addon/Node-Wasm public behavior plus exact-source Rust, Python, and CLI conformance. Support remains `pending`: the public API deliberately does not expose identity-only candidates, and diagnostic-balanced, benign-heavy, and protected-partition evidence is not complete.

## Source identities

- Product source: clean `redact-secret/redact-secret` commit `b73daade943f9dea5f86d90a91aa0332083f728a` (PR #886 merge).
- Candidate npm facade SHA-256: `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`.
- Candidate evidence commitment: `0cdd435e4752b4e56b0afbf575a9beee05073edeee2c3a3195dbd6c0cb571532`.
- Candidate components: package `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`; Node `52187755cf73e38d76f750ee3067c5314dd92ef15fafa2f4c729333e75eb2833`; Wasm `7fef99553a86dfe99d176d6e1dfc194638fb6fd233353df37adefd7aafefd874`.
- Benchmark source used by the candidate run: clean `redact-secret/redact-secret-benchmarks` commit `7c639ba2a979048a601b89a755f1b0a05cd3a349`.
- Benchmark lockfile SHA-256: `2ecd8c21606d6e32c42af4aa26140364f895f89a55014eb4d979da66d18e5a3e`.
- Corpus SHA-256: `53a2f5fd8f60db2d3587c05eaaf440aab41a152eae19b893226cd2322deabb37`.
- Candidate scanner configuration SHA-256: `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783`.
- Candidate run: `9e6d328b-ff14-4ac9-b069-bb1dafc3e661`, full-suite candidate mode, 3,422 selected/scanned/written, status `complete`, from `2026-09-27T14:06:00.419Z` through `2026-09-27T14:06:04.115Z` on Node `v22.16.0` (`darwin`, `arm64`).

This is candidate-mode product evidence, not a published-mode or peer-scanner support comparison. TruffleHog was resolved to the repository pin `3.97.4` before evaluation; no `stable` count is claimed.

## PII binding result

- Family: `pii:global:email`, family contract v1, selector `pii:family:global:email`.
- Global activation identity: `credentials=full;selectors=pii:global;families=pii:global:email,pii:global:network-address;vocabulary=pii-context/v1`.
- Activation evidence commitment: `1d0c41edccf198a68478a38a24292bc25502b9694c76952f9817627fff33e0b7`.
- Qualification plan commitment: `aa39f91d00e27d259a70fdb9d1331071f3f7e6556fe2d1d149c502073d239923`.
- Installed-artifact conformance commitment: `2842b1424faca15ce9fbd28c6ef5490d3ee19fbfef9726cacf1cfdc15ca1445a`.
- Exact-source conformance commitment: `4e1d73accb5351e720f05b39a82af0c99fd35a3c67d0c94df896346914dafe9a`.
- Qualification evidence commitment: `084357c872e3e389beacc602b32adc9f112841ccb104fe77d3d243077cadbe41` (`not-qualified`).
- Support matrix commitment: `739db7a87318060c84781e2a3fb2839d9dcf6df778d5ec911eae1debe60acd74` (`pending`).

Installed addon and Wasm lanes record both their native UTF-16 code-unit ranges and deterministically normalized UTF-8 byte ranges. The SMTPUTF8 case is observed as `5..29` natively and `11..39` canonically. Exact-source lanes separately run the committed Rust-native, Python, and CLI conformance inputs from the clean product source commit; source success is not treated as proof of npm artifact equivalence.

The 20 public cases are accounted separately as sensitive positives, reserved/documentation public absence, context-negative public absence, semantic collisions, malformed/unsupported forms, and whole-candidate boundaries. Reserved controls and deterministic synthetic positives are distinct. The public API cannot distinguish an identity-established non-sensitive candidate from an unmatched candidate, so identity-only classification remains unresolved rather than inferred from absence.

The mechanically derived pending reasons are preserved in `pii-support-matrix-v2.json`: identity-only classification, diagnostic-balanced and benign-heavy populations, population comparison, and the protected partition are not qualified. `provisional` is therefore forbidden.

## Reproduce

From a clean product checkout at `b73daade943f9dea5f86d90a91aa0332083f728a`, with TruffleHog `3.97.4` first on `PATH`, create the full-suite candidate evidence against the exact benchmark input revision:

```sh
trufflehog --version
npm run benchmark:candidate -- --benchmark-ref 7c639ba2a979048a601b89a755f1b0a05cd3a349 --benchmark-repo /absolute/path/to/redact-secret-benchmarks --output-dir /absolute/path/to/evidence/876
```

Then, from the benchmark repository commit containing this evidence, run the internally allowlisted qualification lanes and derive the support projection:

```sh
trufflehog --version
npm run pii:qualify:candidate -- --candidate-evidence=evidence/876/candidate-evidence-v1.json --core=/absolute/path/to/redact-secret-core-0.1.0-beta.9.tgz --node=/absolute/path/to/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz --wasm=/absolute/path/to/redact-secret-wasm-0.1.0-beta.9.tgz --plan=benchmarks/evaluation/domains/pii/email-qualification-v1.json --product-source=/absolute/path/to/clean/product-b73daade --activation-output=evidence/876/pii-activation-evidence-v1.json --qualification-output=evidence/876/pii-family-qualification-v1.json
npm run pii:support:record -- --candidate-evidence=evidence/876/candidate-evidence-v1.json --activation-evidence=evidence/876/pii-activation-evidence-v1.json --qualification-evidence=evidence/876/pii-family-qualification-v1.json --output=evidence/876/pii-support-matrix-v2.json
npm run eval:validate -- evidence/876/candidate-evidence-v1.json
```

This evidence resolves [benchmark issue #389](https://github.com/redact-secret/redact-secret-benchmarks/issues/389) for [product issue #876](https://github.com/redact-secret/redact-secret/issues/876). Future promotion and revalidation remain governed by benchmark issue #10 and product issue #390.
