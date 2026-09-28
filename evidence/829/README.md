# Evidence: redact-secret#829, attacker-known evaluation and promotion gates of the successor shadow scorer

**Result:** all four invariants hold over 2,762 deterministic variants in 9 attack classes (0 unresolved, 0 unstable) against `evidence-aggregation/v3`, the model whose randomness group reads the residual entropy instead of Shannon entropy. Under the projected promotion (flag a statistical finding at shadow band `medium` or above), 171 resolved positives would leak that the legacy path flags. Future-promotion Q4 reads **fail**. The failure is structural to the calibrated operating point, not to the randomness measure: randomness alone stays below `low` and context alone reaches `medium`, so no randomness signal changes an outcome read at `medium`. The model is **not promotable**, and it stays shadow-only and non-enforcing.

This is the rerun of
[redact-secret-benchmarks#289](https://github.com/redact-secret/redact-secret-benchmarks/issues/289)
and the reading of the
[#257 promotion contract](../../docs/specs/scorer-promotion-gates.md)
that [redact-secret#829](https://github.com/redact-secret/redact-secret/issues/829)
asks for. The published record is
[`score-evasion-aggregate.json`](score-evasion-aggregate.json), the closed
shape of [`schemas/score-evasion-aggregate-v1.json`](../../schemas/score-evasion-aggregate-v1.json).
The method is [`docs/specs/score-evasion.md`](../../docs/specs/score-evasion.md).
Variants, scores, bands and the operators that moved a band stay
maintainer-local and are not in this repository. The model was calibrated
on authored development rows only (redact-secret-benchmarks PR #437); it was
not tuned against these variants, the protected holdout or the blind corpus.

## Source revisions

| Item | Identity |
| --- | --- |
| Benchmark | redact-secret-benchmarks `3b78f06fedda8275157198fbdcbdc131e8308815` (`develop`), clean |
| Product | redact-secret `b0be64b0b3636dda5f0167ea9ee6aa64a3112ec0` (`main`, the #829 model merge, PR #923), clean detached checkout |
| Scoring artifact | `docs/contracts/scoring/shadow-scoring-artifact.json` at that commit: revision 5, sha256 `f75d95ca0c792144366996bc44fddcf2cd7bd3e8bdbeaa82f46907c9924fd534` |
| Model | `evidence-aggregation/v3` over `evidence-features/v2`, fingerprint `db9fe32e29e52fc9f85713cfb986b6675b57afca6acf062734ada5c69e0162c4` |
| Scoring identity | `8ac80470de3b218cb44459dfefea3594bedf191ecec399797a4ce26e8e223962` (the artifact's `calibration.scoring.identity`, from the #255 flow at `5823751c16df4776035f5a0bd6f9640f8013a6a7`) |
| Tuning manifest | pending (`tuningManifestHash: null`), as the artifact records; see "Tuning manifest binding" below |
| Candidate | `candidateArtifactHash` `643c4e8a92e359c9faa84f190158aa08318664bd2193c55690a46659321716ae`: the compiled sources (workspace manifests, lockfile, core and CLI crates) at the product commit, because the shadow path compiles the core's own source ([spec](../../docs/specs/score-evasion.md) §2). It is not an npm candidate hash |
| Operator set | `8de2213ed26fa40d14e9fa74c6d8db198da9cd74fe29da8e52eff085dd6dbea9` |
| Host | macOS 26 (darwin 25.5.0) arm64, Node.js 22.16.0, Rust release build |

## Scanner versions

No peer scanner ran, so the TruffleHog pin does not apply. The only detector
is the product at the commit above, through the maintainer-local shadow
evaluation example (`redact-secret/shadow-evaluation/1`, `full` profile),
run twice, and the product CLI's plain check mode, run once.

## Command

```sh
git -C <redact-secret> checkout --detach b0be64b0b3636dda5f0167ea9ee6aa64a3112ec0
npm ci
npm run evasion:run -- --product <redact-secret> \
  --publish evidence/829/score-evasion-aggregate.json
```

A rerun at the same two commits writes the same aggregate. Holdout is never
read.

## Aggregate

37 reviewed bases. "Shadow" is the projected promotion described above,
"legacy" the product's deterministic result. Collateral is in bytes.

| Attack class | Variants | Controls | Preserved (shadow / legacy) | Leaked (shadow / legacy) | Leaked only under shadow | False alarms (shadow / legacy) | Collateral (shadow / legacy) | Negative evidence (applied / partial) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| controlled-repetition | 259 | 70 | 125 / 143 | 64 / 46 | 18 | 36 / 36 | 2,056 / 2,056 | 0 / 0 |
| periodic-body | 264 | 129 | 95 / 112 | 40 / 23 | 17 | 75 / 75 | 2,775 / 2,775 | 0 / 0 |
| class-distribution | 191 | 51 | 87 / 111 | 53 / 29 | 24 | 24 / 24 | 1,045 / 1,045 | 0 / 0 |
| length-segmentation | 291 | 78 | 117 / 117 | 96 / 96 | 0 | 43 / 43 | 2,819 / 2,819 | 0 / 0 |
| placeholder-wrapping | 296 | 80 | 123 / 135 | 93 / 81 | 12 | 42 / 42 | 2,059 / 2,059 | 0 / 0 |
| embedded-reference | 296 | 80 | 95 / 131 | 121 / 85 | 36 | 21 / 21 | 981 / 981 | 0 / 0 |
| context-perturbation | 367 | 99 | 189 / 235 | 79 / 33 | 46 | 61 / 61 | 2,520 / 2,520 | 0 / 0 |
| negative-evidence-mixture | 451 | 262 | 117 / 129 | 72 / 60 | 12 | 37 / 47 | 1,901 / 2,121 | 10 / 0 |
| boundary-discontinuity | 347 | 92 | 147 / 153 | 108 / 102 | 6 | 44 / 44 | 5,760 / 5,760 | 0 / 0 |
| **Total** | **2,762** | **941** | **1,095 / 1,266** | **726 / 555** | **171** | **383 / 393** | **21,916 / 22,136** | **10 / 0** |

Every class has well over the contract's floor of 20 resolved variants.

| Invariant | Held |
| --- | --- |
| `protectedSpecificityNeverWeakened` | yes |
| `negativeEvidenceFullGrammarOnly` | yes |
| `noStatisticalPositiveToNonFinding` | yes |
| `shadowNonEnforcing` | yes |

## Promotion gates (#257, contract version 1)

`evaluatePromotion` over the Q4 metrics derived from the aggregate above
(`metricsFromEvasionAggregate`), plus the metrics this change can supply:
`scoringArtifact.contractConformant` and
`scoringArtifact.monotonicityPropertiesHold` (the product's compile-time model
invariants, drift test and monotonicity property tests pass at the product
commit), and `identity.newModelIdentity` and `identity.newCandidateIdentity`
(new model `evidence-aggregation/v3`, artifact revision 5). No other metric
has a wired producer yet (spec §7), so those gates are `not-evaluated`, which
is never a pass.

| Question | Verdict | Gates |
| --- | --- | --- |
| Q1 coherent and calibrated | not-evaluated | contract conformance **pass**, monotonicity **pass**; band-frequency monotonicity, calibration error, selection stability not evaluated |
| Q2 improves the ambiguous population | not-evaluated | no per-stratum corpus producer yet |
| Q3 preserves security outcomes elsewhere | not-evaluated | no per-stratum corpus producer yet |
| Q4 resists score evasion | **fail** | evaluated-against-candidate **fail** (shadow-mode aggregate); no-new-evasion **fail** (171 overall; every attack class but `length-segmentation` above 0); detection-preserved **fail** (shadow rate below legacy overall and in several classes); attack-class coverage, invariants, negative-evidence abuse, false alarm, collateral, unstable, unresolved share **pass** |
| Q5 independent evidence | not-evaluated | new model identity **pass**, new candidate identity **pass**; evidence-identity consistency, enforcement decision, protected holdout, blind evaluation, runtime, performance and size not evaluated for this candidate |

**Promotable: no.**

## Reading it

- **No product defect.** No invariant broke.
- **Q4 fails for a structural reason.** Under `evidence-aggregation/v3`, as
  under `v2`, randomness alone stays below `low` and credential-bearing
  context alone reaches `medium`. The projection keeps a statistical finding
  only at `medium` or above, so a statistical positive without
  credential-bearing context always drops, whatever its randomness. The
  leaks-only-under-shadow come from bases without such context and from
  operators that remove or change it. A maintainer-local control run of the
  same operators at the same benchmark commit against the `v2` model (product
  `7720ae2a8d383c855a3051b53103657d22154411`, not citable because the
  benchmark tree then held this record uncommitted) gave the same totals:
  171 leaked only under shadow, 1,095 / 1,266 preserved, 383 / 393 false
  alarms. Replacing the randomness measure cannot move Q4 at this operating
  point.
- **What the successor changes is the `high` band.** Benign periodic and
  sequence values in a credential-bearing context no longer reach `high`,
  and inserted repetition no longer lowers random material from `high`
  (product unit tests, redact-secret `docs/specs/engine.md`, "Shadow
  evidence residual features"). That is outside what Q4 reads.
- **Changing the operating point is a calibration decision.** Letting
  randomness alone reach `medium` would change the #255 selection rule and
  is a new model and candidate identity. It is tracked as a follow-up on the
  product side, not tuned here.
- **Negative evidence stayed strict.** It applied only to controls whose
  whole value is a reviewed placeholder form, never on a partial match.

## Tuning manifest binding

The #256 tuning manifest stays a draft (`product: null`), as for beta.9. Its
`product` block is the holdout-frozen npm candidate (the installed
`@redact-secret` packages and the benchmark lockfile), which only a
protected-holdout or qualification run builds, and recording its hash in the
product artifact is itself a new artifact revision and candidate identity.
No holdout run is in scope for #829, so the binding is left to that run.
The draft's deterministic identity is recorded in the product artifact.
