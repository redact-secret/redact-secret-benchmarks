# Network-address PII candidate evidence

The exact merged candidate exposes deterministic IPv4/IPv6 activation and passes the Node-addon/Node-Wasm public-finding controls, but support remains `pending` because identity-only classification, diagnostic-balanced, benign-heavy, and protected-partition qualification evidence is not yet complete.

## Source identities

- Product source: clean `redact-secret/redact-secret` commit `941053baecdc4b99f98e085429ac26bf24fe0bee` (PR #885 merge).
- Candidate npm facade: SHA-256 `ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1`.
- Candidate evidence commitment: SHA-256 `64b7e887bc8299fd3ad5f14e1033263508b7294c0bf07ab6b647d93438782d99`.
- Candidate components: Node `bcec150cd0178bc71e8a461e3df002dc1ebb4cc02549a38646597391c8ace63d`; Wasm `6e521e71e707a84cfc7199f515bb29b576286dac06fbdad28c23b9c5e59ece6b`.
- Benchmark source: clean `redact-secret/redact-secret-benchmarks` commit `7c639ba2a979048a601b89a755f1b0a05cd3a349`.
- Benchmark lockfile SHA-256: `2ecd8c21606d6e32c42af4aa26140364f895f89a55014eb4d979da66d18e5a3e`.
- Candidate evidence run: `c0e78906-a1ad-469d-9037-3e14c392c6bb`, full-suite candidate mode, 3,422 selected/scanned/written, status `complete`.
- Candidate scanner configuration SHA-256: `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783`.
- Corpus SHA-256: `53a2f5fd8f60db2d3587c05eaaf440aab41a152eae19b893226cd2322deabb37`.

The candidate run is candidate-only product evidence. It does not make a peer-scanner support comparison. TruffleHog was nevertheless resolved to the repository pin `3.97.4` before every evaluation command; no `stable` count is claimed here.

## PII binding result

- Family: `pii:global:network-address`, family contract v1, selector `pii:family:global:network-address`.
- Activation identity: `credentials=full;selectors=pii:global;families=pii:global:network-address;vocabulary=pii-context/v1`.
- Activation evidence commitment: `b893d6218e8e9b6632ad90825c34bc82e05d069b29cc3a5505b72231c6b81911`.
- Qualification plan commitment: `1700856f519f2921f39fe706abda9e4d0b15e2fdb67469ac397b77bfd02d746e`.
- Qualification evidence commitment: `a2cf4d57d96d4eec3d00f8158d7f05a99e8f22c3df3e62272ab9b71e1c89b05f` (`not-qualified`).
- Support matrix commitment: `139fce2c4812e39b56ba08cc133fe34357d94d58d9d3c059a0867cfccd066b8f` (`pending`).
- Measured surfaces: installed Node native addon and installed Node Wasm fallback. Both returned the same global and exact-family selector closure and passed the public sensitive-finding checks, public absence controls, URL-neutral behavior, invalid spelling controls, and PII-off invariance. The black-box API cannot distinguish an identity-established non-sensitive candidate from an unmatched candidate, so identity-only classification remains explicitly unresolved.
- Class accounting is separate in `pii-family-qualification-v1.json`: private/ULA, link-local, CGNAT, Teredo, translation, ORCHIDv2, constants, multicast, documentation, RFC 2544, BMWG, RFC 9637, mapped inheritance, URL neutrality, invalid spelling, version collision, and identifier-boundary controls are measured across both surfaces. Public/global remains unresolved because this evidence uses no arbitrary public address fixture.
- Remaining reasons are recorded mechanically in `pii-support-matrix-v2.json`: identity-only classification, public/global, the two committed population comparisons, and the protected partition are not measured, so `provisional` is forbidden.

Only official private, local, special-purpose, documentation, and benchmark address spaces appear in the qualification plan. The committed evidence artifacts contain no candidate plaintext.

## Reproduce

First, from a clean product checkout at `941053baecdc4b99f98e085429ac26bf24fe0bee`, run the full-suite candidate evaluation against the exact benchmark input revision `7c639ba2a979048a601b89a755f1b0a05cd3a349`:

```sh
export PATH="$PWD/.peer-bin:$PATH"
trufflehog --version
npm run benchmark:candidate -- --benchmark-ref 7c639ba2a979048a601b89a755f1b0a05cd3a349 --benchmark-repo /absolute/path/to/redact-secret-benchmarks --output-dir /absolute/path/to/evidence/875
```

Then check out benchmark implementation commit `4a298f144493d40b1441166655fafb7a7423593c` (the first #388 PR commit, which contains the qualification/record scripts and frozen plan), place the emitted artifacts under `evidence/875/artifacts/`, and run:

```sh
export PATH="$PWD/.peer-bin:$PATH"
trufflehog --version
npm run pii:qualify:candidate -- --candidate-evidence=evidence/875/candidate-evidence-v1.json --core=evidence/875/artifacts/redact-secret-core-0.1.0-beta.9.tgz --node=evidence/875/artifacts/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz --wasm=evidence/875/artifacts/redact-secret-wasm-0.1.0-beta.9.tgz --plan=benchmarks/evaluation/domains/pii/network-address-qualification-v1.json --activation-output=evidence/875/pii-activation-evidence-v1.json --qualification-output=evidence/875/pii-family-qualification-v1.json
npm run pii:support:record -- --candidate-evidence=evidence/875/candidate-evidence-v1.json --activation-evidence=evidence/875/pii-activation-evidence-v1.json --qualification-evidence=evidence/875/pii-family-qualification-v1.json --output=evidence/875/pii-support-matrix-v2.json
npm run eval:validate -- evidence/875/candidate-evidence-v1.json
```

This evidence resolves [benchmark issue #388](https://github.com/redact-secret/redact-secret-benchmarks/issues/388) for [product issue #875](https://github.com/redact-secret/redact-secret/issues/875). Future revalidation and promotion remain governed by benchmark issue #10 and product issue #390.
