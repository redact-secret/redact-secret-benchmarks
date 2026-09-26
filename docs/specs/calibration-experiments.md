# Calibration experiments for the shadow evidence scorer

Status: normative for beta.9
([#255](https://github.com/redact-secret/redact-secret-benchmarks/issues/255),
cross-repo parent
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767)).
Implemented in
[`benchmarks/lib/calibration-experiments.ts`](../../benchmarks/lib/calibration-experiments.ts)
and [`benchmarks/calibration-experiments.ts`](../../benchmarks/calibration-experiments.ts);
the public boundary in
[`benchmarks/lib/calibration-projection.mjs`](../../benchmarks/lib/calibration-projection.mjs).
The product contract is redact-secret's
`decision-freeze-the-shadow-evidence-score-and-confidence-contract`; tuning
rules are [statistical tuning](statistical-tuning.md); the input is the
[candidate-feature dataset](candidate-features.md).

The experiments compare candidate evidence models for the product's shadow
scorer and select one aggregation and band configuration for the product to
implement (redact-secret#770, recorded in its scoring artifact, #798). They
measure shadow behaviour only. Nothing here changes a product threshold,
`Confidence`, action or finding.

```sh
npm run features:extract     # the #254 dataset, from a clean tree if it is to be cited
npm run calibration:run      # -> results-output/calibration/ (maintainer-local)
npm run calibration:run -- --product=<candidate identity json>   # bind the frozen candidate in the manifest draft
```

## 1. Inputs and roles

- Fitting reads only the authored categories named in
  `tuning/shadow-scoring-development-v1.json`. Every fitted value (ramp ends,
  lookup cells, logistic weights, band thresholds) comes from those rows.
  Tests replace evaluation rows with nonsense and check that no fitted value
  moves.
- Every other development category has role `development-evaluation`; all
  regression rows remain `regression`. Both roles are evaluation-only. They
  never admit a configuration: selection reads them only to break a tie
  between otherwise equal ones.
- Holdout is never read. The dataset never reads it, the result records
  `holdoutAccess: "none"`, and the result is checked against every holdout
  identifier.
- Unresolved rows are counted and left out of every rate: a `companion`
  span (neither secret nor control) and a truncated value (more than 256
  symbols, whose features describe a prefix only).

## 2. Evidence model

Every signal is an integer measure over `evidence-features/v1` (or over the
dataset's benchmark-only context and negative classes), oriented so that
larger means more evidence of a credential:

| Group | Signals |
| --- | --- |
| randomness | Shannon entropy per symbol; min-entropy per symbol; class balance (`alphabet_efficiency_permille`); non-repetition (1000 minus the strongest of adjacent-repeat, repeated-bigram and autocorrelation permille, 0 for a periodic value) |
| lexical | analysed length; classes present; class transitions per adjacent pair |
| contextual | credential-bearing context class (`credential-name`, `authorization-header`, `url-userinfo`); `other-name` and `bare` contribute nothing |
| validation | none: neither the feature schema nor the dataset has a checksum or parser signal yet, so the group contributes 0 everywhere |
| negative | whole-value reference or placeholder grammar (section 5) |

A signal becomes points through an integer ramp: 0 at or below `lo`,
the group cap at or above `hi`, `floor(cap × (x − lo) / (hi − lo))` between.
`lo` is the median measure of development controls and `hi` the median of
development `must-redact` spans. Two explainable constants per signal.

Configurations compared (each gets its own band thresholds, section 3):

| Configuration | Within a group | Notes |
| --- | --- | --- |
| `flat-linear` | every signal summed, no groups, no caps | the baseline the contract forbids; shows double counting |
| `grouped-capped-sum` | sum, then cap | |
| `grouped-max` | best signal, capped | |
| `grouped-halving` | the contract's rule: descending `c1 + (c2 >> 1) + (c3 >> 2) + …`, capped | |
| `grouped-halving-no-context` | as above, contextual group removed | shows that statistics alone never reach `high` |
| `grouped-halving-negative-all` / `-none` | negative gate variants (section 5) | |
| `lookup-2d` | randomness is one integer table indexed by entropy bucket × length bucket, made monotone in both axes | the information-density model |
| `logistic-research` | floating-point logistic regression over all features | research reference only; not expressible in the core's fixed-point arithmetic |
| `halving-<signals>-<caps>` | the contract's rule over a signal-subset × cap grid | the candidates the selection chooses from |

Across groups, positive group contributions add and the negative group is
subtracted, saturating at 0 (the contract's §3). A configuration is
**conformant** only if it uses the halving rule, integer arithmetic, every
positive cap is below `t_high`, `cap_randomness + cap_lexical < t_high`,
and `t_low < t_medium < t_high` with `high` reachable.

## 3. Band thresholds

Per configuration, from development rows:

- `t_high`: the smallest threshold above every positive cap and above
  `cap_randomness + cap_lexical` whose false-alarm rate on *independent*
  controls (controls that are not a one-property twin) is at most 2%;
  unreachable if no threshold qualifies.
- `t_medium`: minimises leaked span rate + false alarm rate below `t_high`.
- `t_low`: minimises 2 × leaked span rate + false alarm rate below
  `t_medium`.

A tie resolves to the middle of the lowest plateau. A shadow band proposes
a `Confidence`. It is never read as "the probability of a secret is at
least p".

## 4. Metrics and selection

For each configuration and band cut (a row is flagged when its band is at
least the cut), on development and regression rows, following
[measurement v4](measurement-v4.md) §2.4–2.5 with one candidate per row:

- **leaked span rate**: `must-redact` spans not flagged / `must-redact`
  spans; `policy` spans are reported separately, never merged;
- **false alarm rate**: `must-not-flag` controls flagged / controls, and
  the same over independent controls;
- **collateral ratio**: bytes of flagged controls / bytes of `must-redact`
  spans (a flagged span is exact by construction, so collateral comes from
  controls only);
- **twin discrimination**: pairs whose positive spans are all flagged and
  whose twin is not / pairs;
- **measurable share**: rows scored / rows, with unresolved rows by reason.

Every report for the selected configuration is broken down by family,
context and origin basis ([statistical tuning](statistical-tuning.md) §6).
Brier score and expected calibration error are kept locally for Platt and
isotonic transforms fitted on development rows. Those transforms are
**calibrated estimates for the development population only**. The integer
score is ordinal and is never called a probability.

**Selection** (deterministic, `selection.method`
`calibration-experiments/1:…`): among conformant grid configurations, each
is judged by its *neighbourhood* development balanced error at `medium`,
the mean over itself and its one-step cap neighbours, so a cap setting that
works at one grid point only is penalised. Admissible: within 0.01 of the
best neighbourhood error. Then the fewest fitted parameters, the narrowest
leave-one-category-out range of `t_medium`, the lower neighbourhood error,
the smaller development-to-regression gap, and the id. The selection aims
at simple and robust, not at the best development score.

## 5. Negative evidence gate

Only the whole-value grammars of the product contract's §6 count:
template reference, environment reference, command substitution, angle
placeholder, mask and placeholder vocabulary (`strict`). The dataset's
`dotted-reference` class is **not** negative evidence in the selected
configuration: it also matches dotted credential grammars (JWT-like and
`SG.`-style values), so treating it as negative leaks real spans. That
trade-off is measured by `grouped-halving-negative-all`. A strict match
subtracts at least the largest positive total, so the score floors at 0.

## 6. Publication boundary

- Everything the run writes lands under `results-output/calibration/`
  (git-ignored, mode `0600`, never part of the site build):
  `calibration-experiments-v1.json` and `.md` carry ramps, caps,
  thresholds, per-configuration ids (which encode caps), band
  distributions, calibration curves and logistic weights, and are
  maintainer-local only.
- `calibration-public-projection-v1.json` is the only publishable shape:
  aggregate outcomes of the selected configuration per partition, band cut
  and stratum, plus identities and hashes. Strata with fewer than 5 rows
  are dropped and counted. `projectionProblems` rejects any key outside the
  closed shape, any decision-boundary key (threshold, weight, cap, ramp,
  score, contribution, calibration, distribution…), and any value naming a
  grid configuration or a row. The run refuses to write a projection that
  fails it.
- `npm run features:check-public` (CI, after `npm run build`) fails if the
  experiment result or manifest draft appears under `public/` or `dist/`
  by name or marker, if a calibration projection there fails the
  whitelist, or if any of these outputs stops being git-ignored.
- This page and the committed code state rules, never the selected values.

## 7. Authored tuning partition and generated share

`corpora/development/shadow-scoring-authored.json` adds one independently
authored, never-issued positive and one whole-value reference control for
every reviewed family not already covered by an authored category. The
partition manifest `tuning/shadow-scoring-development-v1.json` admits that
corpus plus the existing authored categories to fitting. Its validator emits
per-family kind/origin counts and requires every applicable family to have a
reviewed positive and control, every tuning row to be authored, and every
development category to appear exactly once as tuning or
`development-evaluation`.

The authored corpus is registered with `calibrationOnly: true`. Candidate
feature extraction and pinning validate it, while public benchmark runs,
candidate evaluation, support profiles, published evaluation JSON, and the
site catalog exclude it. It is tuning evidence, not an extra public suite or
an independent support claim. Its JSON source uses one semantic-preserving
Unicode escape inside each positive span so the Git blob does not itself match
secret-scanning push protection; JSON parsing restores the reviewed bytes, and
the deterministic corpus tests pin both the escapes and the parsed values.

The generated-heavy provider suites remain in the feature dataset and are
evaluated out of fit; no row is relabelled or duplicated. The tuning manifest
therefore records `generatedShare.cap: 0.5` with no override. Calibration and
per-family strata surface any loss on the larger held-out development set.

The draft carries hashes and counts only. Its `product` is the frozen
candidate that carries this scoring; none exists until redact-secret#770
and #798 land, so the draft leaves it `null` (validation uses a labelled
placeholder) and is committed under `tuning/manifests/` only once that
candidate is bound with `--product`.
