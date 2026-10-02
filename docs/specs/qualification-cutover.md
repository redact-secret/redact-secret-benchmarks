# Cutover criteria and legacy credential-evaluator disposition

Issue: [#608](https://github.com/redact-secret/redact-secret-benchmarks/issues/608), part of epic
[#602](https://github.com/redact-secret/redact-secret-benchmarks/issues/602).
Decision: [Record the cutover criteria and the legacy disposition for credential qualification](../decisions/2026-10-01-record-the-cutover-criteria-and-legacy-disposition-for-credential-qualification.md).
Evidence: [qualification-parity.md](qualification-parity.md) and its report `docs/generated/qualification-parity.md`.

This is a decision record. It deletes, retires and switches nothing. The legacy path stays the authority for credential
qualification and the existing site stays as it is. State below is read from the #607 report, built from the canonical
linux-x64 official runs (CI run 36948851341, the three populations and the methods run of #636; run 36933982377 made the same
three plain runs and their semantic digests are equal) and the product policy of #636 and #638; a new official run, a repin or a change
to a product input makes it stale and the report is regenerated. #638 re-read the same canonical artifacts: no input of any official run changed.

## Cutover criteria

Authority for credential qualification moves from the legacy path to the new path only when every row is met.

| # | Criterion | State | Evidence and what is missing |
| --- | --- | --- | --- |
| 1 | Pinned official evidence, eval and scanner identities | Met | `benchmarks/official-runs.json` pins the engine, schema, configuration, five scanners and three populations, and (#636) the methods run: its methods, reference, seed and the product evaluation evidence file by digest. `npm run official-runs:check` passes; the canonical runs are recorded, the methods run included. |
| 2 | Deterministic official RunArtifacts | Met | Each population ran twice per job with equal semantic digests, the methods run too; a second CI run of the three plain runs (36948851341) has the same semantic digests as the first (36933982377); the view rebuilt locally from the downloaded canonical artifacts is byte-identical to the CI view. |
| 3 | Product-owned regression and policy populations preserved | Met | Both are populations of the view with their own denominators and roles; every scanner's outcome on every regression and policy case equals the legacy outcome in the #607 report. |
| 4 | No unexplained qualification verdict drift | **Unmet** | 0 unexplained differences (35,024 compared, 34,678 equal, 346 attributed; `--strict` passes). The verdicts still differ for four families (legacy 127 stable, new path 123), each attributed to a cause that is not a defect of the new path and that this repository cannot resolve alone: three `twin-scope-vocabulary` (anthropic-admin01-key, anthropic-api01-key, elevenlabs-api-key) and one `population-separation` (sendgrid-token). Attributed is not accepted: criterion 4 is met when those four are decided (below). |
| 5 | One published release qualified end to end through the new path | **Unmet** | `@redact-secret/core` 0.1.0-beta.12 ran end to end (official runs and methods run, adapter, view, Next pages) with the axis overlay, the review-ledger mapping, the differential peer scope and the attribution fallback applied, and the result is not accepted: 123 stable against 127. The 123 agree with the legacy path on status. The other four are held back by a floor or a gate the new path measures differently: the engine cannot scope a cross-provider twin the snapshot gives no family (three families, `twinFailures: 2` each), and sendgrid-token has three public control axes where the legacy pooled count (with its regression fixtures) had four. Needed, not applied: credential-evidence carries a family on such a twin, or credential-eval scopes a twin by its parent's family; and a decision on sendgrid-token's fourth control axis (a public fixture, or a policy on the regression corpus). |
| 6 | Next credential pages built from new outputs | **Unmet** | `/evaluation/qualification/` and its family pages are built solely from the view (#606). The report, provider, family and fixture pages still read the legacy files, and the view carries counts, not per-fixture rows, so a fixture page cannot be built from it. |
| 7 | Rollback path to the legacy pipeline | **Unmet** (designed, not built) | Nothing has been switched, so the legacy path is intact. The authority switch below does not exist yet. |

The count difference the first #607 report left unexplained (`elevenlabs-api-key`, `totalFixtures`) was resolved in #635, and
`benchmarks/qualification-inputs.json` records `benchmarks/review-ledger.json` and, since #638, its generated mapping to canonical
occurrences as product-owned, read by the adapter. What remains for criterion 4 is not an unexplained difference but the decisions behind the
four attributed ones.

### Where the 127 stand after #638

#636 left every one of the 127 held by `differential.unresolvedContractDisagreements` (the ledger is keyed by legacy ids) and nine of them also by a floor. #638
decided and applied three product policies, each with an ADR: the legacy review decisions apply to the canonical occurrences they were made for (a generated
mapping by content: same case, peer, disagreement property and bytes; every gitleaks and trufflehog occurrence is settled, the other 6,471 are unreviewed),
the differential gate reads the legacy peers (gitleaks and trufflehog; flare-redact and openredaction are measured and reported, not gate-bearing), and a case the snapshot
leaves unnamed is attributed by the legacy targets the product overlay carries, then by its twin parent. No official run was repeated.

| | Families |
| --- | ---: |
| Stable on the legacy path | 127 |
| Stable on the new path | 123 |
| Stable on both | 123 |
| Legacy stable, new provisional: `twin-scope-vocabulary` | 3 |
| Legacy stable, new provisional: `population-separation` | 1 |

- **anthropic-admin01-key, anthropic-api01-key, elevenlabs-api-key** (`twin-scope-vocabulary`). The snapshot gives a cross-provider twin no family, so credential-eval cannot
  scope it and reads a finding of another known detector as flagged (`twinFailures: 2`); the legacy path read it as co-detected. Before #638 these twins were attributed to no
  family and invisible; attributing them exposes the difference rather than hiding it. The adapter sums the engine's per-case fields and does not re-score. Resolved by
  credential-evidence (a family on the twin) or credential-eval (scope a twin by its parent's family); not decided in this repository.
- **sendgrid-token** (`population-separation`). The legacy floor pooled the regression fixtures of the family and counted four control axes; the public snapshot has three. The no-pooling
  rule of #603 forbids reproducing the pooled count, so this is a legitimate difference: the family needs a fourth reviewed control axis in the public snapshot, or a product policy on the regression corpus.

The eight families that are not stable on the legacy path read the same status on the new path. The remaining differences that are legitimate rather than defects of the new path: the
floors population is the public snapshot alone (the legacy path pooled the regression and policy fixtures), pending fixtures are not scored, the methods run uses the
canonical-id seed (not the legacy category seed), and it scans two peers the legacy run did not (reported, not gate-bearing).

## Authority switch and rollback (design only)

The switch is explicit and reversible, and is one committed value, not a deletion.

- A committed setting names the authority for credential qualification: `legacy` or `next`. The publish workflow and the web
  services read it; nothing infers it. Default `legacy`.
- Both pipelines run in CI while the setting exists, so the oracle stays current and the report can be regenerated.
- Flipping to `next` is one reviewed commit that also records the view's policy revision and the artifacts' semantic digests it
  is authorised for. Rolling back is reverting that commit; no data is migrated, so nothing has to be restored.
- The existing site's UI is not removed by an authority change. It is removed only when #543's UI migration criteria are met
  independently.

## Disposition of the legacy credential evaluator

Four dispositions. **keep**: the new path or a product-owned input uses it, so removing the evaluator must not remove it.
**compat-only**: only the legacy path or the compatibility layer reads it; kept as the oracle for a bounded period, then
reconsidered. **other-domain**: belongs to PII, performance, MCP, the protected holdout or another domain; not part of this
cutover. **remove-after-cutover**: the legacy credential measurement, removable once the criteria above are met and the oracle
period ends. Nothing here is removed by this record. Before removing any file, list its callers (`graft callers <symbol>
--depth 3`) and the `web/` services that import it; the table is from import analysis at this commit.

### Keep: shared with the new path or product-owned

| Files | Why |
| --- | --- |
| `benchmarks/support/status.ts`, `profiles.ts`, `policy-qualified.ts`, `taxonomy.ts`, `empirical.ts`, `policy-holdout-receipt.ts` | The adapter applies `classifyFamilySupport` and these rules unchanged; `status.ts` defines `FamilySupportEvidence`. |
| `benchmarks/support/status-criteria.json`, `fixture-profiles.json`, `policy-qualified-credentials.json`, `empirical-observations.json`, `taxonomy.json`, `population-policy.json` | Product-owned qualification inputs; components of the policy revision. |
| `benchmarks/evaluation/domains/credential/assessment.ts` | Contracts, tiers and control axes; read by the adapter and the product snapshot export. |
| `benchmarks/engine/review-ledger.ts` (the `ReviewLedger` type), `benchmarks/lib/scoring.ts` (`validateCorpus`), `benchmarks/types.ts` | Imported by `benchmarks/qualification/`. Move the types when the engine goes. |
| `benchmarks/qualification/`, `scripts/build-qualification-view.ts`, `build-qualification-parity.ts`, `export-qualification-population.ts`, `run-official-credential-eval.ts`, `provision-official-peers.mjs`, `check-official-runs.mjs`, `benchmarks/official-runs.json`, `benchmarks/qualification-inputs.json`, `schemas/` | The new path. |
| `benchmarks/known-gaps.json`, `benchmarks/review-ledger.json`, `benchmarks/ledger-decisions.json`, `benchmarks/support/public-review-ledger-map.json`, `scripts/build-ledger-rekey.ts` | Promotion authority and ledger joins; the ledger is the source of every review decision and the generated mapping applies it to canonical occurrence ids (#638). |
| `corpora/regression/`, `fixtures/generated/regressions.mjs`, `closed-milestone.mjs`, `policy-qualified-credentials.mjs`, and the authored fixture generators of the product populations | The regression and policy populations remain product-owned. |
| `web/services/qualification.ts`, `web/resolvers/qualification*.ts`, `web/components/qualification/` | Next reads the view only. |

### Compat-only: the legacy path reads them, the new path does not

| Files | Reader today | Condition to reconsider |
| --- | --- | --- |
| `benchmarks/fixture-index.json`, `benchmarks/lib/fixture-index.ts`, `scripts/generate-fixture-index.mjs` | **The Next app**: `web/services/catalog.ts` reads and validates it and checks that its fixture count equals the built catalog. | The Next catalog is fed from the evidence release; then it can go. This answers the question left open in #632: yes, Next still reads `fixture-index.json`. |
| `benchmarks/fixture-detectors.json`, `benchmarks/detectors.json`, `benchmarks/categories.json`, `benchmarks/pin-manifest.json`, `benchmarks/scenarios.json` | The Next app (`catalog.ts`, `peers.ts`, `dossiers.ts`) and the bench. | Same. `categories.json` also lists the product populations: keep those entries. |
| `peer-observations/` (credential suites), `qualification/suite-v1.json` | The legacy classifier and bench; the Next scanner page reads the pins and snapshot summaries. | The Next scanner page reads the official artifacts' scanner identities. |
| `evidence/<n>/<commit>/support-status-*.json` (committed legacy classification records) | The Next `/evaluation/credential/` page (`web/services/domains.ts`). | That page reads the view. |
| `public/results/*.json`, `results-output/*` (generated, not committed) | The legacy site and the Next report, family, detector and fixture pages. | Those pages are migrated, or the legacy site is retired under #543. |
| `src/model.mjs`, `src/pages/data.ts`, `src/support-model.ts`, `src/evaluation-model.ts` (validators) | The legacy site and, as shared validators, the Next services. | The Next services stop importing them. |
| `web/scripts/check-export*.mjs` | Recount every shown number from the legacy files; the independent oracle for the Next app. | Rewritten against the view at cutover. |

The Next app does not read `benchmarks/review-ledger.json` or the review queue: no `web/` file refers to either. Its credential
data is the run reports, the support-status records in `evidence/`, the fixture index, the taxonomy, the dossiers and the
known-gaps file.

### Remove-after-cutover: the legacy credential measurement

| Files | Role |
| --- | --- |
| `benchmarks/engine/` except `review-ledger.ts`: `runner.ts`, `cases.ts`, `execution.ts`, `reporting.ts`, `evidence.ts`, `assertions.ts`, `model.ts`, `provenance.ts`, `public-report.ts`, `registry.ts`, `types.ts` | The TypeScript evaluation engine. `scripts/build-ledger-rekey.ts` recomputes the legacy review queue with it to regenerate the review-ledger mapping, so the engine stays until the mapping is no longer regenerated (the mapping is frozen to the pinned snapshot and methods run). |
| `benchmarks/evaluation/domains/credential/` except `assessment.ts`: `accounting.ts`, `assertions.ts`, `cases.ts`, `contract.ts`, `evidence.ts`, `execution.ts`, `identity.ts`, `normalization.ts`, `public-report.ts`, `qualification.ts`, `reporting.ts`, `review.ts`, `run-summary.ts`, `methods/`, `operators/`, `mixed-parity/` | The credential domain of the engine. The metamorphic, mutation and differential methods move to credential-eval or are re-expressed in its configuration first (criterion 5); until then they are the only measurement of those gates. |
| `benchmarks/methods/`, `benchmarks/operators/` | Method and operator wiring for the engine. |
| `benchmarks/classify-support.ts`, `generate-support-matrix.ts`, `support-matrix-drift.ts`, `benchmarks/support/evidence.ts` (the legacy `familyEvidence` derivation), `matrix.ts`, `drift.ts`, `profile-report.ts` | Legacy classification and the support matrix the legacy site reads. |
| `benchmarks/lib/lattice.ts`, `reporting.ts`, `run-summary.ts`, `peer-observations.ts`, `accounting.ts`, `review-queue-handoff.ts` | Legacy scoring, summary and peer-snapshot plumbing. |
| `benchmarks/run.ts` and `benchmarks/evaluate.ts` (credential suites) | Legacy bench and evaluation runs. |
| The development partition `corpora/development/` and the generated suites of the public population | Superseded by the evidence release; the product populations are not part of this row. |

### Other domains and the protected holdout: not part of this cutover

`benchmarks/evaluation/domains/pii/`, `benchmarks/lib/performance-*.ts`, `scripts/*pii*`, `scripts/measure-*`,
`scripts/*performance*`, `qualification/pii-*`, `qualification/peer-pii-runtime-throughput-v1.json`,
`qualification/runtime-comparison-v2.json`, `benchmarks/mcp-qualification*` and `benchmarks/lib/mcp-*`, the shadow-scoring and
calibration tooling, `benchmarks/evaluation/domains/credential-policy/` and `holdout/` (the protected holdout stays outside
credential-eval), `adversarial/`, `tuning/`, and the Next pages for PII, performance, runtime and features. The Next services
`runtime.ts`, `performance.ts`, `features.ts` and the PII half of `domains.ts` keep their sources.

Anything not listed is kept. A file moves between rows only through a change to this record.
