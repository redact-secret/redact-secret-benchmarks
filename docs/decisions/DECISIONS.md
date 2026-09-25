# Architecture decisions

These records preserve accepted benchmark-methodology and process choices:
what this repository measures, how it scores and gates a result, and how it
routes findings to the product repo. They provide context for future
planning and implementation but do not authorize Git or release actions.

A resweep, review, or measurement run that led to a decision below is
recorded separately under `docs/reports/`, not here — see the decision's own
`Context` section for the link. `npm run decisions:validate` enforces that
every record here has valid frontmatter and is indexed exactly once.

- [Adopt measurement protocol v4](2026-09-17-adopt-measurement-protocol-v4.md)
- [Build the Evaluation Engine as benchmark infrastructure now](2026-09-17-build-evaluation-engine-now.md)
- [Govern benchmark-to-product regression promotion](2026-09-18-govern-benchmark-promotion.md)
- [Redesign the benchmark site on the Redact Secret design system](2026-09-19-redesign-benchmark-site.md)
- [Tighten evaluation accounting (engine v1.1)](2026-09-19-tighten-evaluation-accounting-v1-1.md)
- [Extend negative twins to the assignment context, and publish un-probeable families](2026-09-20-extend-twins-to-assignment-context.md)
- [Fill per-family twin coverage below the stable threshold](2026-09-20-fill-per-family-twin-coverage.md)
- [Add an untargeted benign corpus: authored-synthetic, T3, action-split, ungated](2026-09-21-add-untargeted-benign-corpus.md)
- [Anchor cross-repo promotion authority in known-gaps.json](2026-09-21-anchor-cross-repo-promotion-authority-in-known-gaps.md)
- [Author PyPI macaroon positives synthetically](2026-09-21-author-pypi-macaroon-positives-synthetically.md)
- [Check that no fixture pair may be lexically inseparable](2026-09-21-check-lexical-separability.md)
- [Clear `benign.minimumAxes` for the three DigitalOcean token families](2026-09-21-clear-digitalocean-benign-axis-diversity.md)
- [Correct the five twins #553 ruled untenable](2026-09-21-correct-the-five-twins-553-ruled-untenable.md)
- [Measure benign axis diversity, not just a bare case count](2026-09-21-measure-benign-axis-diversity.md)
- [Produce the first `stable` families](2026-09-21-produce-first-four-stable-families.md)
- [Settle mechanical mutation review classes as `not-assertable`](2026-09-21-settle-mechanical-mutation-review-classes.md)
- [Settle differential disagreements on pending fixtures as not-assertable](2026-09-22-settle-differential-disagreements-on-pending-fixtures.md)
- [Store benchmark measurement evidence per core issue under `evidence/`](2026-09-22-store-benchmark-evidence-per-core-issue.md)
- [Own performance evaluation and recalibrate Linux x86_64 thresholds](2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md)
- [Define external adversarial fixture intake and provenance](2026-09-22-define-external-adversarial-intake.md)
- [Lift five families out of un-probeable and widen context coverage for the floor families](2026-09-22-lift-five-families-out-of-un-probeable.md)
- [Run the performance evaluation for real and retire the by-construction verdict](2026-09-23-run-the-performance-evaluation-for-real.md)
- [Require pinned peer scanners for classification claims](2026-09-23-require-pinned-peer-scanners-for-classification.md)
- [Enforce fixture profiles by claim and publish per-family coverage debt](2026-09-24-enforce-fixture-profiles-and-publish-coverage-debt.md)
- [Decouple pin freshness from pin consistency](2026-09-23-decouple-pin-freshness-from-pin-consistency.md)
- [Qualify T2 families empirically without changing their provenance](2026-09-24-qualify-t2-empirically.md)
- [Qualify T2 families as empirically stable through independent corroboration](2026-09-24-qualify-empirical-stable-by-corroboration.md) (amends the entry above)
- [Amend #207's added scope to 348 family-fixture assignments](2026-09-24-amend-207-scope-to-348-assignments.md)
- [Settle classification disagreements where only the peer's label is coarser](2026-09-24-settle-peer-coarser-classification-disagreements.md)
- [Stop asserting provider-undecided format properties](2026-09-24-stop-asserting-provider-undecided-format-properties.md) (amends the corroboration decision)
- [Settle arrival-family classification rows labelled by the owning shared detector](2026-09-24-settle-arrival-classification-by-owning-detector.md) (amends the peer-coarser decision)
- [Label arrival families typed inside a shared detector by the product's finding type](2026-09-24-map-product-finding-types-to-arrival-families.md) (narrows the entry above)
- [Score arrival families the product types inside a shared detector](2026-09-24-score-arrival-families-by-finding-type.md) (amends the beta8 evidence spec; builds on the entry above)
- [Protect holdout from statistical scorer tuning with a tuning manifest](2026-09-25-protect-holdout-from-statistical-scorer-tuning.md)
- [Classify a pack the project assembles from external inputs as maintainer regression](2026-09-25-classify-project-assembled-external-inputs-as-maintainer-regression.md) (proposed; applies the adversarial intake decision to #140)
- [Introduce reviewed performance-regression budgets derived from recorded variance](2026-09-25-introduce-reviewed-performance-regression-budgets.md)
- [Qualify adapter boundaries black-box by sink containment](2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md)
