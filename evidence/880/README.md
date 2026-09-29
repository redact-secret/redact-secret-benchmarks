# Phone PII candidate evidence

The exact merged product candidate exposes deterministic phone-family
activation and passes installed Node-addon/Node-Wasm behavior plus exact-source
Rust, Python, and CLI conformance. Support remains `pending`: the public API
does not expose identity-only candidates, and the diagnostic-balanced,
benign-heavy, comparison, operational, and protected-partition gates remain
unresolved.

## Source identities

- Product source: clean `redact-secret/redact-secret` commit
  `2e1bdcf0905f7a374c4c54b7caac41303cd7d88b` (PR #895 merge).
- Candidate npm facade SHA-256:
  `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`.
- Candidate evidence commitment:
  `23c2ba74a93aa4091691572cbc99a3bd4cc23fa19b6a08111ca0d292d6bddc4e`.
- Candidate components: package `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`;
  Node `5ae2b64e606fd0a6f6b6e7349fca5ac9239698a11a8505535d0f13ea2b17b2fc`;
  Wasm `70b49aa76ce65b8a86ecaa44f9f3c9dbd3132318d044aa54911cda1c6be391dc`.
- Benchmark source: clean `redact-secret/redact-secret-benchmarks` commit
  `886dda9016b0f8a44ddc732b457aa2362377b224`.
- Benchmark lockfile SHA-256:
  `2ecd8c21606d6e32c42af4aa26140364f895f89a55014eb4d979da66d18e5a3e`.
- Corpus SHA-256:
  `fbc432625be7203ae36138c36fb30cab7a194b60510e6996a4d5898a70c09af4`.
- Candidate scanner configuration SHA-256:
  `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783`.
- Candidate run `54c034a4-e6e7-435f-be9c-71fa35d043d5` was full-suite candidate
  mode with 3,533 selected, scanned, and written fixtures, status `complete`,
  from `2026-09-27T20:49:25.586Z` through `2026-09-27T20:49:28.104Z` on Node
  `v22.16.0` (`darwin`, `arm64`).

This is candidate-mode product evidence, not a published-mode or peer-scanner
support comparison. TruffleHog was resolved to the repository pin `3.97.4`
before evaluation. No stable, provisional, or release-support count is claimed.

## Phone binding result

- Family: `pii:global:phone`, family contract v1, exact selector
  `pii:family:global:phone`.
- Authority: ITU-T E.164, the deliberately narrow NANPA structure, and exact
  555-0100 through 555-0199 exchange-plus-line reserved controls.
- Global activation identity:
  `credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:global:phone;vocabulary=pii-context/v1`.
- Activation evidence commitment:
  `8a0b0178905d6dc902b0097c254711a761c49d1fa00f8554c9ceeeef4e5f6583`.
- Qualification plan commitment:
  `8e00a1029d2eef67fbbddc705362a7e4f61d8a8cca54bbba8436f9c00dbc5c18`.
- Installed-artifact conformance commitment:
  `a12837b99da2bbd6cc0449493daae7fc1d3ea0c47df9ad08e1f7568402e8cec6`.
- Exact-source conformance commitment:
  `4503dc44a094ec07b05e8387c6eccef6793378f46836a2d6d7bfe3c964e0d879`.
- Qualification evidence commitment:
  `bc4566502c3eee964e421a451a7dfe225e9e3991ee239b568d1b528f2e6ec2f0`
  (`not-qualified`).
- Support matrix commitment:
  `4984d17cf4974e578438fd7d97ce029a82153218f5086aa36daf1855d922ef69`
  (`pending`).

Raw plan inputs are deterministic, syntactically valid constructions with no
subscriber, allocation, or real-world provenance, plus the exact authoritative
555 controls; they are confined to the safe qualification plan. Installed
observations publish only stable case IDs, outcomes, actions, and ranges. The
support matrix contains commitments and aggregate states, never candidate text.

The plan separately observes English and Korean context (including NFD and the
governed-invisible rule), bare identity absence, ambiguous and named-negative
context, real N11 exclusions, valid 988 exchanges, exact 555 controls,
supported one- and six-digit extensions, malformed and repeated extension
seams, ordinary `extra`/`xylophone` prose, semantic collisions, unsupported
formats, whole-candidate boundaries, bounded shared `contact details`
association, and UTF-8/UTF-16 offset conversion. Both installed surfaces agree,
and exact-source lanes independently run the committed Rust-native, Python, and
CLI phone conformance fixtures from the clean product commit.

Public absence does not establish identity-only classification. Both population
views and comparisons, runtime/package cost, and the protected partition remain
unresolved. The family is therefore `not-qualified`, and its generated support
row remains `pending`. No missing mass is inferred or renormalized.

## Reproduce

From a clean product checkout at the source commit above, with TruffleHog
`3.97.4` first on `PATH`, create the candidate evidence against the immutable
benchmark commit:

```sh
trufflehog --version
npm run benchmark:candidate -- --benchmark-ref 886dda9016b0f8a44ddc732b457aa2362377b224 --benchmark-repo /absolute/path/to/redact-secret-benchmarks --output-dir /absolute/path/to/evidence/880
```

Then run the repository-owned qualification lanes and derive the support row:

```sh
npm run pii:qualify:candidate -- --candidate-evidence=evidence/880/candidate-evidence-v1.json --core=/absolute/path/to/redact-secret-core-0.1.0-beta.9.tgz --node=/absolute/path/to/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz --wasm=/absolute/path/to/redact-secret-wasm-0.1.0-beta.9.tgz --plan=benchmarks/evaluation/domains/pii/phone-qualification-v1.json --product-source=/absolute/path/to/clean/product-2e1bdcf --activation-output=evidence/880/pii-activation-evidence-v1.json --qualification-output=evidence/880/pii-family-qualification-v1.json
npm run pii:support:record -- --candidate-evidence=evidence/880/candidate-evidence-v1.json --activation-evidence=evidence/880/pii-activation-evidence-v1.json --qualification-evidence=evidence/880/pii-family-qualification-v1.json --output=evidence/880/pii-support-matrix-v2.json
npm run eval:validate -- evidence/880/candidate-evidence-v1.json
```

This evidence addresses [benchmark issue #393](https://github.com/redact-secret/redact-secret-benchmarks/issues/393)
for [product issue #880](https://github.com/redact-secret/redact-secret/issues/880).
Promotion remains governed by benchmark issue #10 and product issue #390.
