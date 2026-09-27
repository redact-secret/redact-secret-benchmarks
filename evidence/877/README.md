# Payment-card PII candidate evidence

The exact merged product candidate exposes deterministic payment-card-family
activation and passes installed Node-addon/Node-Wasm behavior plus exact-source
Rust, Python, and CLI conformance. Support remains `pending`: the public API
does not expose identity-only candidates, and the diagnostic-balanced,
benign-heavy, comparison, and protected-partition evidence is incomplete.

## Source identities

- Product source: clean `redact-secret/redact-secret` commit
  `bf3631b1989570fbf6fdd8836ff21acc35f7d678` (PR #892 merge).
- Candidate npm facade SHA-256:
  `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`.
- Candidate evidence commitment:
  `a5f98be45c32883799e0af4baec4c133fcd32f9ae64fe9dcb960838a4817253a`.
- Candidate components: package `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`;
  Node `d5f73750eee5bac44aea2fa8b754cc973231a55cef6618b2c97b5cf95ad9b50e`;
  Wasm `9185b041b0e70afce45ab89c694d0cd3beb9ea43c4020c35fe881247eb04f126`.
- Benchmark source: clean `redact-secret/redact-secret-benchmarks` commit
  `72de7bf813ee1e68c737ab09a65154f654eb9182` (PR #399 merge).
- Benchmark lockfile SHA-256:
  `2ecd8c21606d6e32c42af4aa26140364f895f89a55014eb4d979da66d18e5a3e`.
- Corpus SHA-256:
  `fbc432625be7203ae36138c36fb30cab7a194b60510e6996a4d5898a70c09af4`.
- Candidate scanner configuration SHA-256:
  `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783`.
- Candidate run `cecb57ba-15d2-44d8-a538-bd4c0f955ab9` was full-suite candidate
  mode with 3,533 selected, scanned, and written fixtures, status `complete`,
  from `2026-09-27T16:21:46.634Z` through `2026-09-27T16:21:49.698Z` on Node
  `v22.16.0` (`darwin`, `arm64`).

This is candidate-mode product evidence, not a published-mode or peer-scanner
support comparison. TruffleHog was resolved to the repository pin `3.97.4`
before evaluation. No release-support count is claimed.

## Payment-card binding result

- Family: `pii:global:payment-card`, family contract v1, exact selector
  `pii:family:global:payment-card`.
- Authority: ISO/IEC 7812-1:2017 structure, the frozen Visa Acceptance
  supported-brand range subset, ABA IIN assignment semantics, and PCI SSC FAQ
  1137 Luhn guidance.
- Validator: bounded built-in `luhn` v1 with a 19-byte maximum candidate.
- Global activation identity:
  `credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card;vocabulary=pii-context/v1`.
- Activation evidence commitment:
  `c34e695f8b26827ffffb82e2e47a238f70f95c37b6775397e3d421d0c3c4c9e3`.
- Qualification plan commitment:
  `a56d0f7c35b7c6dfbb6eb0d2f7c6f4e857192d7be85866ef278f0f7b532a23f3`.
- Installed-artifact conformance commitment:
  `fbb90819174ebb40e0eb6e41bc7e22fc4468ca38932185ef86b4048ee5d0f417`.
- Exact-source conformance commitment:
  `857bfc6532f9cc3f0b39f38335e620d9f6ae31117950edc916c476f88a75b50e`.
- Qualification evidence commitment:
  `b060032988d2ae263dd766d6a00fe804a8282261386fbca00010bedc73fcc874`
  (`not-qualified`).
- Support matrix commitment:
  `d01f73f88744bd7b01bcd2e06c11430cd6291ed6939893a6f472a02da793db77`
  (`pending`).

Raw plan inputs are limited to exact authoritative test controls and
deterministic issue-877 values with recorded no-real-world provenance.
Checksum-invalid neighbors measure validator correctness only. Luhn-valid
order/reference, account, phone, random-number, and cooking-object examples are
separate semantic-collision axes. Unsupported layouts, identifier/Unicode and
governed-invisible boundaries, negative context, URL query syntax, minimum and
maximum length, and an astral offset are independently observed. Installed
observations publish only stable case IDs, outcomes, actions, and ranges; the
support matrix contains commitments and aggregate states, never candidate
values.

Both installed surfaces agree on native UTF-16 and canonical UTF-8 ranges.
Exact-source lanes separately run the committed Rust-native, Python, and CLI
payment-card conformance fixture from the clean product commit. Identity-only
classification cannot be inferred from public absence. Both population views
and their baseline/candidate comparisons remain explicitly `not-measured`, and
protected-partition evidence is unresolved. The family is therefore
`not-qualified`, and the generated row remains `pending` with mechanically
derived reason codes. No missing mass is renormalized.

## Reproduce

From a clean product checkout at the source commit above, with TruffleHog
`3.97.4` first on `PATH`, create the candidate evidence against the immutable
benchmark merge commit:

```sh
trufflehog --version
npm run benchmark:candidate -- --benchmark-ref 72de7bf813ee1e68c737ab09a65154f654eb9182 --benchmark-repo /absolute/path/to/redact-secret-benchmarks --output-dir /absolute/path/to/evidence/877
```

Then run the repository-owned qualification lanes and derive the support row:

```sh
npm run pii:qualify:candidate -- --candidate-evidence=evidence/877/candidate-evidence-v1.json --core=/absolute/path/to/redact-secret-core-0.1.0-beta.9.tgz --node=/absolute/path/to/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz --wasm=/absolute/path/to/redact-secret-wasm-0.1.0-beta.9.tgz --plan=benchmarks/evaluation/domains/pii/payment-card-qualification-v1.json --product-source=/absolute/path/to/clean/product-bf3631b --activation-output=evidence/877/pii-activation-evidence-v1.json --qualification-output=evidence/877/pii-family-qualification-v1.json
npm run pii:support:record -- --candidate-evidence=evidence/877/candidate-evidence-v1.json --activation-evidence=evidence/877/pii-activation-evidence-v1.json --qualification-evidence=evidence/877/pii-family-qualification-v1.json --output=evidence/877/pii-support-matrix-v2.json
npm run eval:validate -- evidence/877/candidate-evidence-v1.json
```

This evidence addresses [benchmark issue #390](https://github.com/redact-secret/redact-secret-benchmarks/issues/390)
for [product issue #877](https://github.com/redact-secret/redact-secret/issues/877).
Promotion remains governed by benchmark issue #10 and product issue #390.
