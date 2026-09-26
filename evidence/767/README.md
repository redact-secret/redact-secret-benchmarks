# Beta.9 explainable-evidence qualification

**Result:** QUALIFIED as an immutable, reproducible, non-enforcing shadow
scoring foundation for beta.9; enforcement promotion is explicitly deferred.

This record resolves
[core #767](https://github.com/redact-secret/redact-secret/issues/767) and
[benchmark #282](https://github.com/redact-secret/redact-secret-benchmarks/issues/282).
It binds the result to the exact identities below. A change to the feature set,
aggregation, weights, bands, scoring artifact, product candidate or benchmark
revision invalidates the record.

## Immutable identities

| Item | Identity |
| --- | --- |
| Product source | `93ddf510a31563d58c7d4c202363ef65c4d92d55`, clean; `@redact-secret/core@0.1.0-beta.9` candidate |
| Package / Node / WASM SHA-256 | `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` / `be03070faa6b02f69966f95667bcb44cb3f90ead627cfb8a8a2421068bfcf19a` / `9784a4bddbb0cd5bffb290b57a5d6fe9df4642b7148abe0713c978ffcb7c2375` |
| Benchmark source | `853149ffbb2c8efef89e5c74178bf61ee783da7d`, clean; lockfile `2fd997ca616a659b7801cf630bfde2441b2df106499df3cfc86b6aee016d568b` |
| Candidate scanner | `redact-secret-candidate`; configuration `c1af1eee97cce08f227e7a07ef3338f8de48b9e37dd771f014c8f6cf1b79d783` |
| Feature dataset | schema `evidence-features/v1`; extractor `candidate-features/2`; dataset `4ea0a82f61b719b4611f8e7e2caafd01edda5b5dfa7c2691bffd6ac17d0e199c` |
| Aggregation contract | `grouped-halving/1`; experiment `calibration-experiments/1` |
| Shadow artifact | revision 3; SHA-256 `eb929a09af8d896463c57371c6a5948fce05f38d99dd3b0bb5bc8d14fcb7a6cf`; model fingerprint `4104fb2c6f046169f63e991dd7594c099af5fcea01deecae7afe1c7015579975` |
| Scoring identity | `838aa57db8e2331c8540a42da823ffda8802d681952f4dc7af20e6001c5693a2` |
| Calibration selection | `23683daf5738b9cf3de583ade589f06677cfb2bcf581bff38e889b1eddae9509`; public projection SHA-256 `dbaeeec46291638d828f65ac4bfe72aa61a219f606f25754130ee601efbc1470` |
| Tuning manifest | private draft content SHA-256 `9744417741f04ab37aca44f4e0e8d08387f085ac4f95b5cb310d53c987322b68`; status `active`; holdout access `none`; generated tuning share 0, override not applied |
| Fixed corpus | measurement-v4 hash `c30b888ffe9bde280e01373aa52238a512628ecabb5b797acd7457b4d36de950` |
| Performance policy | `regression-budgets-v1`, baseline `0.1.0-beta.8`; policy file SHA-256 `3f4c777c15d7c273ad29f22680ca86e47485a8184b407052429e294e0ab58c79` |
| Runtime | local candidate/calibration/evasion: Node `v22.16.0`, `darwin`/`arm64`; performance: `linux-x64-node22-chromium`; determinism: Ubuntu, macOS, Windows and WASI |

The related public adapter boundary is frozen separately at
`redact-secret-adapters` `be3f2ad5088d108867b7bae13933d706d8f1f861`:
`@redact-secret/adapter@0.1.2` content digest
`sha256:181853358a4c7a0bb75d404c60bc6039a0749ff25a7a7ff88ef1d11308c893d2`,
`@redact-secret/adapter-ai-context@0.1.0-alpha.1`
`sha256:9b2b8ea10041043fb852fa76502e893113c1511fec90a5c2ebc698d357093fe1`,
and `@redact-secret/adapter-mcp@0.1.0-alpha.1`
`sha256:961d84eb2cc24ee4faba7d0524ca120d90a58fd40a50fb4201f44d771f320a30`.
That boundary's independent public-package evidence is
[`evidence/843/public-release-2026.09.26/README.md`](../843/public-release-2026.09.26/README.md);
it is not part of the shadow-scoring measurement.

## Exact runs

- Candidate run `a3197f80-8a2b-4efb-ba63-eddfa31878f0`, 2026-09-26T10:22:41.644Z
  through 2026-09-26T10:22:44.862Z: `complete`, 2,990 selected, scanned and
  written fixtures, no failures. The sanitized record is
  [`candidate-evidence-v1.json`](candidate-evidence-v1.json).
- Core Artifact qualification workflow
  [36233877397](https://github.com/redact-secret/redact-secret/actions/runs/36233877397):
  exact product source, artifact inventory and cross-runtime determinism.
- Paired performance workflow
  [36235533809](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36235533809):
  exact product and benchmark sources; accepted with no failed checks.
- Blind run `5ebdef2d-9330-4b07-996f-889856c9fb2c`: `complete`. Its evidence
  class, aggregate and limitations remain separate in the
  [#142 report](../../docs/reports/2026-09-26-beta9-142-blind-evaluation.md);
  no blind count is combined with this public qualification.

## Results by required question

### Shadow discrimination

The public projection records 186 authored tuning rows across 77 applicable
families, a 0 generated share and no override. The exact selected configuration
is measurable on every authored development row. Its evaluation operating
point covers 2,919 rows with 0.9973 measurable share and discriminates 103 of
681 authored twin pairs. These are ordinal shadow outcomes, not probabilities,
and do not alter product detection, confidence or action.

### Fixed-corpus regressions outside the target population

The exact candidate completed all 2,990 fixtures. No fixture-level outcome
changed from the `0.1.0-beta.8` baseline, and no must-redact or policy fixture
had a `MISS` or `PARTIAL` outcome. This is candidate-only evidence; no peer
scanner comparison is inferred from it.

### Adversarial score evasion and negative-evidence abuse

The public aggregate
[`score-evasion-aggregate.json`](score-evasion-aggregate.json) records 2,763
variants, 0 unresolved and 0 unstable. It records 711 leaked spans versus 540
under the legacy projection, including 171 leaked only under the candidate;
false alarms were 361 versus 371. Negative evidence applied 10 times and never
to a partial grammar match. All four safety invariants hold, including
shadow-only non-enforcement, but the leakage result does not satisfy the future
promotion question. No mutation recipe or per-candidate score is published.

### Measurability and calibration regressions

The calibration projection
[`calibration-public-projection-v1.json`](calibration-public-projection-v1.json)
records 100% measurable share and no unresolved authored row in either the
development or evaluation partitions. On the broader 2,919-row evaluation
operating point, 8 rows are unresolved and measurable share is 0.9973. The
projection separately exposes leaked-span, policy, false-alarm, collateral and
twin aggregates; it deliberately exposes no weights, thresholds or candidate
features.

### Protected and blind evidence

The statistical tuning manifest records `holdoutAccess: none`; this
qualification neither opened nor iterated against a protected holdout and
therefore spent no protected-holdout run budget. The
checked-in `holdout/manifest.json` is a public-conformance control, not a
protected corpus. The distinct custodian-blind evaluation completed once
against its frozen epoch; only its separate #142 report is linked above.

### Cross-runtime determinism

Artifact qualification produced identical shadow output on Ubuntu, macOS,
Windows and WASI: 0 cross-runtime mismatches, 3,862 comparisons per runtime,
and the same output SHA-256
`916d2235624f27f2925f019686713d51c7cc873411850a8b3edcff20f6e2c9ab`.
Each runtime carried feature schema `evidence-features/v1`, artifact revision 3
and the frozen model fingerprint above.

### Performance and size

The exact paired performance run accepted all measured gates: 10 latency,
10 initialization and 16 memory triggers were within budget, with no
regressions. Size was not measured by that workflow. The exact core Artifact
qualification measured the Linux aarch64 CLI at 930,616 bytes, 7.729% above
the beta.8 baseline; this candidate-bound, detector-pack footprint is the
reviewed accepted tradeoff in
[`evidence/772/93ddf510/README.md`](../772/93ddf510/README.md).
No future candidate inherits that acceptance.

## Qualification boundary

This record establishes a reproducible, adversarially evaluated shadow scoring
foundation. It does not claim a public probability, expose a score through the
API, or enable scorer-driven detection, confidence or action changes.
Enforcement promotion is deferred to a later release and requires every hard
constraint in the future-promotion contract from
[benchmark #257](https://github.com/redact-secret/redact-secret-benchmarks/issues/257),
including the adversarial question that this candidate does not satisfy.

## Reproduction

Provision the pinned peers first, even though the candidate command itself is
candidate-only; TruffleHog must report 3.97.4 before any classification claim.

```sh
npm run peers:provision
export PATH="$PWD/.peer-bin:$PATH"
trufflehog --version

# From clean core 93ddf510a31563d58c7d4c202363ef65c4d92d55:
npm run benchmark:candidate -- \
  --benchmark-ref 853149ffbb2c8efef89e5c74178bf61ee783da7d \
  --output-dir <absolute-output-directory>

# From clean benchmark 853149ffbb2c8efef89e5c74178bf61ee783da7d:
npm run eval:validate -- <absolute-output-directory>/candidate-evidence-v1.json
npm run features:extract
npm run calibration:run
npm run evasion:run -- --product <clean-core-checkout>
```

The candidate evidence carries no peer-scanner comparison. The separately
rechecked candidate support matrix used pinned TruffleHog 3.97.4 and reported
80 of 108 taxonomy families stable in **candidate** mode; it is a support claim,
not a score and not part of the qualification totals above.
