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
