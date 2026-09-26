# Future-promotion gates for the statistical evidence scorer

Status: normative, contract version 1
([#257](https://github.com/redact-secret/redact-secret-benchmarks/issues/257),
cross-repo parent
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767)).
Decided in
[Gate future scorer promotion on hard constraints, not a mixed score](../decisions/2026-09-25-gate-future-scorer-promotion-on-hard-constraints.md).
Contract:
[`benchmarks/scorer-promotion-contract.json`](../../benchmarks/scorer-promotion-contract.json)
(structure:
[`schemas/scorer-promotion-contract-v1.json`](../../schemas/scorer-promotion-contract-v1.json)).
Rules and evaluator:
[`benchmarks/lib/scorer-promotion.ts`](../../benchmarks/lib/scorer-promotion.ts).
`npm run scorer-promotion:check` enforces the contract in CI.

Beta.9 ships the explainable evidence scorer **shadow-only**. Redact-secret's
`decision-freeze-the-shadow-evidence-score-and-confidence-contract` keeps
the scorer from changing detection, `Confidence`, action or findings in
beta.9. This page sets out what a **later** release must show before the
scorer may set `Confidence` or action for ambiguous candidates. It
authorises nothing. Beta.9 passes without question 5 (section 2).

## 1. Framing: constrained optimisation, no mixed score

Promotion is worth doing only if it improves discrimination of ambiguous
`generic-token` candidates, meaning one-property twins told apart and
independent controls left alone. That improvement is the objective. Every
other requirement is a **hard constraint**:

> improve ambiguous-candidate discrimination, subject to false-alarm,
> leaked-span, collateral, invariance, evasion, stability, review,
> measurable-share, holdout and runtime bounds.

- Each gate is judged on its own. A large gain on one gate cannot offset
  a failure on another, no gate carries a weight, and nothing computes or
  publishes F1, accuracy or any other combined figure.
- A question passes only when all of its gates pass. A release is
  `promotable` only when all five questions pass. A gate with no evidence
  is `not-evaluated`, which is never a pass.
- Rates are judged overall **and** per stratum (family and context for
  corpus gates, attack class for #289, kind:tier for holdout). An
  aggregate improvement cannot hide a stratum regression. Strata below a
  gate's `minimumSupport` are listed as unsupported rather than judged.
  The measurable-share gates keep them from making up most of the evidence.
- **Delta** gates compare the promotion candidate (scorer allowed to set
  `Confidence` and action) with the **legacy** result: the same frozen
  corpus on the deterministic path with the scorer shadow-only.
  `delta = candidate − legacy`.

## 2. The five questions, answered separately

The contract answers each question from its own gates, and `evaluatePromotion`
reports a verdict per question. The bounds below are **gate bounds**, a
policy about outcomes. They are not scorer cut-offs, and the contract never
contains the scorer's weights, caps or band cut-offs (section 6).

### Q1. Is the research scorer mathematically coherent and calibrated for its stated population?

Population: the development population that the #255 calibration run states.
A calibrated estimate holds for that population only and is never called a
probability of the product.

| Gate | Metric | Bound |
| --- | --- | --- |
| `q1-contract-conformance` | `scoringArtifact.contractConformant` | true: caps below the high cut-off, randomness + lexical below it, cut-offs strictly increasing, artifact drift clean (#798) |
| `q1-monotonicity` | `scoringArtifact.monotonicityPropertiesHold` | true (product ADR §4 property tests, #770) |
| `q1-band-frequency-monotone` | `calibration.bandFrequencyMonotone` | true; verdict-only |
| `q1-calibration-error` | `calibration.expectedCalibrationError` | ≤ 0.05; verdict-only, the value stays maintainer-local |
| `q1-selection-stable` | `calibration.selectionStableUnderReweighting` | true ([calibration](calibration-experiments.md) §7) |

### Q2. Does it improve the targeted ambiguous population?

Population: `generic-token` candidates of `contextual` and `entropy`
specificity in the evaluation-only sources of the active tuning manifest.

| Gate | Metric | Overall | Every family and context stratum |
| --- | --- | --- | --- |
| `q2-twin-discrimination-gain` (the objective) | `ambiguous.twinDiscriminationRate` | delta ≥ +0.05 | delta ≥ 0 |
| `q2-ambiguous-false-alarm` | `ambiguous.independentFalseAlarmRate` | delta ≤ 0 | delta ≤ 0 |
| `q2-measurable-share` | `ambiguous.measurableShare` | ≥ 0.90 | ≥ 0.80 |

### Q3. Does it preserve security outcomes elsewhere?

Population: every evaluation-only source of the active tuning manifest
(regression, development-evaluation, accepted adversarial packs), all
families. These sources are never tuned on
([statistical tuning](statistical-tuning.md) §1), so fitting to them cannot
satisfy these gates.

| Gate | Metric | Overall | Every family and context stratum |
| --- | --- | --- | --- |
| `q3-leaked-only-under-candidate` | `corpus.leakedOnlyUnderCandidate` | = 0 | = 0 |
| `q3-leaked-span-rate` | `corpus.leakedSpanRate` | delta ≤ 0 | delta ≤ 0 |
| `q3-false-alarm` | `corpus.falseAlarmRate` | delta ≤ 0 | delta ≤ 0.01 |
| `q3-collateral` | `corpus.collateralRatio` | delta ≤ 0 | delta ≤ 0.01 |
| `q3-invariant-specificities` | `corpus.invariantSpecificityChangedOutcomes` | = 0 | |
| `q3-deterministic-positives-retained` | `corpus.deterministicPositivesRemoved` | = 0 | |
| `q3-regression-fixtures` | `corpus.regressionFixturesNewlyFailing` | = 0 | |
| `q3-unstable` | `corpus.unstableCases` | = 0 | |
| `q3-unreviewed` | `corpus.unreviewedChangedOutcomes` | = 0 | |

`private-key`, `provider` and `structural` candidates are invariant: no
outcome of theirs may change (product ADR §5). No emitted candidate may be
removed or narrowed by statistical evidence. Relaxing that needs a new
product decision and a new contract version, and it can never apply to the
invariant specificities. Every fixture whose outcome the promotion changes,
in either direction, needs a review-ledger decision before the gate is read.

### Q4. Does it resist deliberate score-evasion and negative-evidence abuse?

Population: the [#289](https://github.com/redact-secret/redact-secret-benchmarks/issues/289)
deterministic mutation variants, read **only** through the score-evasion
aggregate (section 5). The attacker is assumed to have read the scorer.

| Gate | Metric | Overall | Every attack class |
| --- | --- | --- | --- |
| `q4-evaluated-against-candidate` | `evasion.promotionCandidateMode` | true | |
| `q4-attack-class-coverage` | `evasion.attackClassesBelowFloor` | = 0 (each class ≥ 20 resolved variants) | |
| `q4-invariants` | `evasion.invariantsHold` | true | |
| `q4-no-new-evasion` | `evasion.leakedOnlyUnderCandidate` | = 0 | = 0 |
| `q4-detection-preserved` | `evasion.detectionPreservedRate` | delta ≥ 0 | delta ≥ 0 |
| `q4-negative-evidence-abuse` | `evasion.negativeEvidenceOnPartialMatch` | = 0 | = 0 |
| `q4-evasion-false-alarm` | `evasion.falseAlarmRate` | delta ≤ 0 | |
| `q4-evasion-collateral` | `evasion.collateralRatio` | delta ≤ 0 | |
| `q4-unstable` | `evasion.unstable` | = 0 | |
| `q4-unresolved-share` | `evasion.unresolvedShare` | ≤ 0.05 | |

The bar is relative to the legacy path: promotion must never open a
bypass that the deterministic path closes. A beta.9 shadow-mode aggregate
answers #289's own acceptance criteria. It cannot answer Q4 for a
promotion, because `q4-evaluated-against-candidate` needs the aggregate of
the exact promotion candidate.

### Q5. What independent evidence is required before a later release could enable enforcement?

All of the following, for the **exact** promotion candidate:

| Gate | Metric | Bound | Supplied by |
| --- | --- | --- | --- |
| `q5-new-model-identity` | `identity.newModelIdentity` | true | redact-secret#798 |
| `q5-new-candidate-identity` | `identity.newCandidateIdentity` | true | redact-secret#798 |
| `q5-evidence-identity-consistent` | `identity.evidenceConsistent` | true | #256 (`evidenceIdentityProblems`) |
| `q5-enforcement-decision` | `governance.productEnforcementDecisionAccepted` | true | a new product ADR (product ADR §5) |
| `q5-protected-holdout-independent` | `holdout.independentRun` | true | holdout lifecycle, #256 |
| `q5-holdout-leaked-span` | `holdout.leakedSpanRate` | delta ≤ 0, overall and per kind:tier | holdout |
| `q5-holdout-false-alarm` | `holdout.falseAlarmRate` | delta ≤ 0 | holdout |
| `q5-holdout-twin-direction` | `holdout.twinDiscriminationRate` | delta ≥ 0 | holdout |
| `q5-holdout-measurable-share` | `holdout.measurableShare` | ≥ 0.90 | holdout, #142 |
| `q5-custodian-blind-evaluation` | `blindEvaluation.complete` | true | [#142](https://github.com/redact-secret/redact-secret-benchmarks/issues/142) |
| `q5-cross-runtime-equality` | `runtime.crossRuntimeMismatches` | = 0 | [redact-secret#772](https://github.com/redact-secret/redact-secret/issues/772) |
| `q5-incremental-equality` | `runtime.wholeVsIncrementalMismatches` | = 0 | redact-secret#772 |
| `q5-bounded-worst-case` | `runtime.hostileInputsWithinCriteria` | true | redact-secret#772 |
| `q5-performance-budgets` | `performance.budgetOutcome` | latency, initialization, memory each `within-budget` or `accepted-tradeoff` | [#143](https://github.com/redact-secret/redact-secret-benchmarks/issues/143) |
| `q5-size-budget` | `size.budgetOutcome` | size `within-budget` or `accepted-tradeoff` | #143, with the #772 raw, gzip and brotli deltas |

A `regression`, `invalid-measurement` or `not-evaluated` budget outcome
fails, or leaves the gate unevaluated. `independentRun` means: purpose
`protected`, independence `custodian-declared`, status `complete`, a
sealed epoch that is not contaminated, within the lifecycle budget, and run
after the tuning manifest was frozen with `holdoutAccess: "none"`. Holdout
deltas compare with a reference run of the legacy candidate **in the same
epoch**, so the epoch's run budget is planned for both runs before it is
sealed. A promotion prompted by a holdout result contaminates the epoch
([statistical tuning](statistical-tuning.md) §2).

### Beta.9

`beta9.passesWithoutQuestion5` is `true` and Q5's `beta9Role` is
`not-required`. Q1–Q4 are `informational` for beta.9: the beta.9
qualification record
([#282](https://github.com/redact-secret/redact-secret-benchmarks/issues/282))
records whatever answers exist, and a failing or unevaluated answer does
not block beta.9, because the scorer stays shadow-only. The evaluator
always returns `blocksBeta9: false`.

## 3. Identity: every promotion is a new model and a new candidate

Following redact-secret#798, a promotion changes observable behaviour, so
it is a new model identity (`modelFingerprint`, raised
`scoringArtifactRevision`) and a new frozen candidate
(`candidateArtifactHash`). A shadow-only candidate is never promoted in
place. All evidence one promotion decision cites carries the same tuple:

`sourceRevision`, `candidateArtifactHash`, `scoringArtifactRevision`,
`modelFingerprint`, `scoringArtifactSha256`, `tuningManifestHash`,
`scoringIdentity`.

Evidence keyed to any other tuple is stale. It is regenerated, never
carried over ([statistical tuning](statistical-tuning.md) §4).

## 4. Security rule: nothing depends on secrecy

The attacker is assumed to know the scorer implementation and its
artifact. No gate depends on weights, caps or cut-offs staying secret
(`principles.promotionDependsOnSecretValues: false`), and the evasion gates
assume a white-box adversary. Some Q1 values are `verdict-only`. That is
not because security depends on them. The benchmark simply does not
publish a ready-made map of the decision boundary (product ADR §11).

## 5. The #289 score-evasion aggregate

[#289](https://github.com/redact-secret/redact-secret-benchmarks/issues/289)
publishes exactly one shape,
[`schemas/score-evasion-aggregate-v1.json`](../../schemas/score-evasion-aggregate-v1.json)
(`reportType: "score-evasion-aggregate"`). `evasionAggregateProblems`
rejects anything else, and `metricsFromEvasionAggregate` derives the Q4
metrics from it alone.

- Envelope: `schemaVersion`, `reportType`, `visibility: "public-aggregate"`,
  `mode` (`shadow` | `promotion-candidate`), `holdoutAccess: "none"`,
  `identity` (the section 3 tuple), `benchmark` (`commit`, `dirty: false`),
  `operatorSetHash` (the mutation operators and seeds, hashed rather than
  published).
- `totals` and `attackClasses.<class>` each carry these counts:
  `variants`, `unresolved`, `unstable`, `controls`, `detectionPreserved`,
  `legacyDetectionPreserved`, `leakedSpans`, `legacyLeakedSpans`,
  `leakedOnlyUnderCandidate`, `falseAlarms`, `legacyFalseAlarms`,
  `mustRedactBytes`, `collateralBytes`, `legacyCollateralBytes`,
  `negativeEvidenceApplied`, `negativeEvidenceOnPartialMatch`.
- `invariants`: `protectedSpecificityNeverWeakened`,
  `negativeEvidenceFullGrammarOnly`, `noStatisticalPositiveToNonFinding`,
  `shadowNonEnforcing` (a boolean in shadow mode, `null` in
  promotion-candidate mode).
- Required attack classes: `controlled-repetition`, `periodic-body`,
  `class-distribution`, `length-segmentation`, `placeholder-wrapping`,
  `embedded-reference`, `context-perturbation`,
  `negative-evidence-mixture`, `boundary-discontinuity`.
- Arithmetic is checked: `variants = unresolved + unstable + controls +
  resolved must-redact variants`, candidate and legacy cover the same
  resolved variants, totals are the sum over classes, and a class with
  fewer than 5 variants is never published.

Variants, recipes, operator parameters, per-candidate scores, bands and
contributions stay maintainer-local. How the aggregate is produced (bases,
operators, the candidate projection in shadow mode, the invariant checks) is
[score-evasion.md](score-evasion.md).

## 6. Publication boundary and versioning

- The contract holds gate bounds, metric names and sources. It never holds
  scorer weights, caps, band cut-offs, per-candidate values or evasion
  recipes. The schema is closed, and a forbidden-key check backs it up.
- Public outcomes are gate and question verdicts and aggregate rates and
  counts per stratum with at least 5 rows. `verdict-only` gates publish the
  verdict alone.
- `revisions[-1].contentHash` is the SHA-256 of the contract without its
  revision history. Any change to a gate, bound, question or rule fails CI
  until a new revision with the next `contractVersion` is appended. The
  zero-tolerance gates (leakage, invariance, negative evidence, promotion-only
  leaks) cannot be loosened by a revision at all.

## 7. Using the contract

```ts
import { evaluatePromotion, loadPromotionContract, metricsFromEvasionAggregate } from './benchmarks/lib/scorer-promotion.ts';
const contract = loadPromotionContract(root);
const metrics = { ...corpusMetrics, ...holdoutMetrics, ...runtimeMetrics, ...metricsFromEvasionAggregate(aggregate289, contract) };
const outcome = evaluatePromotion(contract, { metrics });   // per-question verdicts, promotable, blocksBeta9: false
```

Producers of the non-Q4 metrics (the #255 calibration run for Q1, the
per-stratum corpus evaluation for Q2 and Q3, the holdout lifecycle, #142,
the product's #772 qualification and the #143 budget report) supply them
under the metric names above. Wiring each producer is future work. The
contract fixes the names so that work does not have to renegotiate them.
