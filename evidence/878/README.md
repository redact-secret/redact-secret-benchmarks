# IBAN PII candidate evidence

The exact merged product candidate exposes deterministic IBAN-family
activation and passes installed Node-addon/Node-Wasm behavior plus exact-source
Rust, Python, and CLI conformance. Support remains `pending`: the public API
does not expose identity-only candidates, and the diagnostic-balanced,
benign-heavy, comparison, and protected-partition evidence is not complete.

## Source identities

- Product source: clean `redact-secret/redact-secret` commit
  `c810623a3348da3b15cb06dc4e13bf5c39113154` (PR #889 merge).
- Candidate npm facade SHA-256:
  `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`.
- Candidate evidence commitment:
  `83bda533b5657d1073d8f291f6d56228896d9541eae02e6082f9207b2bda3789`.
- Candidate components: package `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`;
  Node `c272309e704401558d588580681de3668bbc6c87b914bd5900274f71f9db454d`;
  Wasm `935bb38fb4ca5c79693dfe9dd16b0f6ddbcb963636476f10deab4a98dfc64978`.
- Benchmark source: clean `redact-secret/redact-secret-benchmarks` commit
  `a14f4327f4c9ee7c21a21d8bee448d81f04896cc`.
- Benchmark lockfile SHA-256:
  `2ecd8c21606d6e32c42af4aa26140364f895f89a55014eb4d979da66d18e5a3e`.
- Corpus SHA-256:
  `fbc432625be7203ae36138c36fb30cab7a194b60510e6996a4d5898a70c09af4`.
- Candidate scanner configuration SHA-256:
  `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783`.
- Candidate run `b111d1a9-e1e2-45ad-8f93-7aff50541106` was full-suite
  candidate mode with 3,533 selected, scanned, and written fixtures, status
  `complete`, from `2026-09-27T15:51:02.098Z` through
  `2026-09-27T15:51:06.042Z` on Node `v22.16.0` (`darwin`, `arm64`).

This is candidate-mode product evidence, not a published-mode or peer-scanner
support comparison. TruffleHog was resolved to the repository pin `3.97.4`
before evaluation. No release-support count is claimed.

## IBAN binding result

- Family: `pii:global:iban`, family contract v1, selector
  `pii:family:global:iban`.
- Country authority: SWIFT ISO 13616 IBAN Registry Release 103, dated
  2026-09-17; the product contract derives exactly 89 country/length rows.
- Validator: bounded built-in `iban-mod97` v1 under ISO 13616-1:2020, with a
  34-byte maximum candidate.
- Global activation identity:
  `credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address;vocabulary=pii-context/v1`.
- Activation evidence commitment:
  `87bd16b4d7f3e1c072fc25e4ba7d9928f0faafc80f29a61defd3ea0badebc3c9`.
- Qualification plan commitment:
  `9ead94bd2da5df320d8a7fa44a8838c6449769bfc6d4e9fad69732b2bb400f6e`.
- Installed-artifact conformance commitment:
  `a098baedddfd50f3f0c44631084accc882835a81df360105ee5b391f254ad6f8`.
- Exact-source conformance commitment:
  `facbc55cc3270c19ffb1501409cf12d9469fab1aa769d25970e30371438c8372`.
- Qualification evidence commitment:
  `5c987f1acf75d0d3d70ef1b948a899a380811f144be9b69aaef4a7d85c493437`
  (`not-qualified`).
- Support matrix commitment:
  `72ba2360c096b66a6869b65b39fbcdca17a4931587887053ebda8f471d37b8c0`
  (`pending`).

The qualification plan uses only the issue-878 deterministic fixture: its BBAN
begins with the explicit `SYNX` marker and zeros, is checksum-valid, and has no
real-world account, bank, owner, or allocation provenance. The plan keeps
validator-valid positives, a checksum failure, an exact-country wrong-length
failure, an unknown country, and a checksum-valid context collision as separate
classes. It also records documentation/example suppression, reference syntax,
unsupported formatting, and whole-candidate boundary controls. Raw synthetic
values remain confined to the safe qualification plan. Installed observations
contain only case IDs, outcomes, metadata, and ranges; the support projection
contains only commitments and aggregate states.

Both installed surfaces agree on native UTF-16 and canonical UTF-8 ranges,
including the Korean/astral-offset print form. Exact-source lanes separately
run the committed Rust-native, Python, and CLI IBAN fixture from the clean
product commit. That source evidence is kept separate from npm artifact
equivalence.

Identity-only classification cannot be inferred from public absence. Both
population views and their baseline/candidate comparisons remain explicitly
`not-measured`; protected-partition evidence is unresolved. Consequently the
family is `not-qualified` and the generated support row remains `pending` with
the mechanically derived reason codes. No missing mass is renormalized.

## Reproduce

From a clean product checkout at
`c810623a3348da3b15cb06dc4e13bf5c39113154`, with TruffleHog `3.97.4` first
on `PATH`, create the candidate evidence against the immutable benchmark input:

```sh
trufflehog --version
npm run benchmark:candidate -- --benchmark-ref a14f4327f4c9ee7c21a21d8bee448d81f04896cc --benchmark-repo /absolute/path/to/redact-secret-benchmarks --output-dir /absolute/path/to/evidence/878
```

Then run the repository-owned qualification lanes and derive the support row:

```sh
trufflehog --version
npm run pii:qualify:candidate -- --candidate-evidence=evidence/878/candidate-evidence-v1.json --core=/absolute/path/to/redact-secret-core-0.1.0-beta.9.tgz --node=/absolute/path/to/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz --wasm=/absolute/path/to/redact-secret-wasm-0.1.0-beta.9.tgz --plan=benchmarks/evaluation/domains/pii/iban-qualification-v1.json --product-source=/absolute/path/to/clean/product-c810623a --activation-output=evidence/878/pii-activation-evidence-v1.json --qualification-output=evidence/878/pii-family-qualification-v1.json
npm run pii:support:record -- --candidate-evidence=evidence/878/candidate-evidence-v1.json --activation-evidence=evidence/878/pii-activation-evidence-v1.json --qualification-evidence=evidence/878/pii-family-qualification-v1.json --output=evidence/878/pii-support-matrix-v2.json
npm run eval:validate -- evidence/878/candidate-evidence-v1.json
```

This evidence addresses [benchmark issue #391](https://github.com/redact-secret/redact-secret-benchmarks/issues/391)
for [product issue #878](https://github.com/redact-secret/redact-secret/issues/878).
Promotion remains governed by benchmark issue #10 and product issue #390.
