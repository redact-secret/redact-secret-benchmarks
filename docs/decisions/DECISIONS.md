# Active decision entry points

This small index points to methodology, governance, execution and publication contracts. Current implementation rules also live in `docs/specs/`, `web/CONVENTIONS.md` and the ADRs cited by those files. An omitted record is not automatically historical, superseded or approved for removal.

All retained ADRs still undergo identity, frontmatter and Decision-heading validation. `npm run decisions:validate` checks these entry links without requiring the historical catalog to grow with every investigation or acceptance receipt.

Owner acceptance records, input-digest records and rollback decisions remain at their original paths. A preservation manifest and an issue-linked ruling are prerequisites for migrating historical records; see `docs/specs/hygiene-records.md` and #847/#848.

- [Adopt measurement protocol v4](2026-09-17-adopt-measurement-protocol-v4.md)
- [Tighten evaluation accounting (engine v1.1)](2026-09-19-tighten-evaluation-accounting-v1-1.md)
- [Govern benchmark-to-product regression promotion](2026-09-18-govern-benchmark-promotion.md)
- [Anchor cross-repo promotion authority in known-gaps.json](2026-09-21-anchor-cross-repo-promotion-authority-in-known-gaps.md)
- [Define external adversarial fixture intake and provenance](2026-09-22-define-external-adversarial-intake.md)
- [Protect holdout from statistical scorer tuning with a tuning manifest](2026-09-25-protect-holdout-from-statistical-scorer-tuning.md)
- [Run the blind evaluation through an isolated custodian agent and release aggregates only](2026-09-25-run-blind-evaluation-through-an-isolated-custodian-agent.md)
- [Judge timing regression budgets on same-job paired ratios](2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md)
- [Run credential-eval officially once per population, and qualify Redact Secret from the artifacts through one adapter](2026-10-01-run-credential-eval-per-population-and-adapt-run-artifacts.md)
- [Adopt evidence snapshots as a candidate first, then an owner-accepted repin that keeps previous runs as historical receipts](2026-10-03-adopt-evidence-snapshots-as-a-candidate-then-an-owner-accepted-repin.md)
- [Store evaluation reports as bounded, digested parts behind a versioned manifest instead of one whole-document JSON string](2026-10-06-store-evaluation-reports-as-bounded-parts-behind-a-manifest.md)
- [Run the four required scanners by default and make the optional OpenRedaction default profile a positive opt-in](2026-10-07-run-the-four-required-scanners-by-default-and-make-openredaction-a-positive-opt-in.md)
- [Record the oracle exit for @redact-secret/core@0.1.0-beta.13, keep the protected-holdout kernel, freeze the legacy review queue, and retire the legacy evaluator only where nothing reads it](2026-10-05-record-the-oracle-exit-and-retire-the-legacy-credential-evaluator.md)
- [Switch the public/synthetic PII measurement authority to pii-eval, keep the legacy evaluator as the bounded oracle, and leave the protected path pending](2026-10-07-switch-the-public-synthetic-pii-measurement-authority-to-pii-eval.md)
- [Build the redesigned site as a Next.js static export with Material UI, in web/](2026-09-30-build-the-new-site-as-a-next-static-export-with-mui.md)
- [Publish the site from validated artifacts under the new authority, and keep the legacy steps as the rollback](2026-10-07-publish-the-site-from-validated-artifacts-under-the-new-authority-and-keep-the-legacy-steps-as-the-rollback.md)
- [Score the IP port suffix outside the network-address span](2026-09-28-score-the-ip-port-suffix-outside-the-network-address-span.md)
