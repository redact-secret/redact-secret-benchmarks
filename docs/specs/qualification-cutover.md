# Cutover criteria and legacy credential-evaluator disposition

Issue: [#608](https://github.com/redact-secret/redact-secret-benchmarks/issues/608), part of epic
[#602](https://github.com/redact-secret/redact-secret-benchmarks/issues/602).
Decision: [Record the cutover criteria and the legacy disposition for credential qualification](../decisions/2026-10-01-record-the-cutover-criteria-and-legacy-disposition-for-credential-qualification.md).
Evidence: [qualification-parity.md](qualification-parity.md) and its report `docs/generated/qualification-parity.md`.

**Update (#641, CI run 36964984990).** The regression population gained a project twin-scope category (six cross-provider twins and their positives, with the parent's family), so
the three plain runs were run again (all four canonical records are in `benchmarks/official-runs.json`; the public, policy and methods semantic digests equal those of runs
36933982377 and 36948851341, the regression population's has a new corpus and digest). Axis floors are now judged on the union of axis labels across the policy populations and the twin gate
reads the project case for the six public twins. The new path reads **127 stable families against the legacy 127**, the same 127 families, 35,084 values compared, 34,744 equal, 340
expected-structural, 0 unexplained (`--strict` passes); every status is equal on both paths (135 of 135). The prose below that describes 123 stable is the state after #638 and is superseded where it
conflicts with this paragraph.

This is a decision record. It deletes, retires and switches nothing. The legacy path stays the authority for credential
qualification and the existing site stays as it is. State below is read from the #607 report, built from the canonical
linux-x64 official runs (CI run 36948851341, the three populations and the methods run of #636; run 36933982377 made the same
three plain runs and their semantic digests are equal) and the product policy of #636 and #638; a new official run, a repin or a change
to a product input makes it stale and the report is regenerated. #638 re-read the same canonical artifacts: no input of any official run changed.
#606 then added per-case rows to the view (additive: [ADR](../decisions/2026-10-01-carry-per-case-rows-in-the-qualification-view-and-page-them-by-scope.md));
the parity report was regenerated from the same artifacts and is byte-identical (35,024 values compared, 34,678 equal, 346 attributed, 0 unexplained,
123 of 135 families stable), and the view without its `cases` is the previous view value for value. The legacy pipeline, the legacy site and every
legacy `web/` service and page are unchanged by that work.

## Cutover criteria

Authority for credential qualification moves from the legacy path to the new path only when every row is met.

| # | Criterion | State | Evidence and what is missing |
| --- | --- | --- | --- |
| 1 | Pinned official evidence, eval and scanner identities | Met | `benchmarks/official-runs.json` pins the engine, schema, configuration, five scanners and three populations, and (#636) the methods run: its methods, reference, seed and the product evaluation evidence file by digest. `npm run official-runs:check` passes; the canonical runs are recorded, the methods run included. |
| 2 | Deterministic official RunArtifacts | Met | Each population ran twice per job with equal semantic digests, the methods run too; a second CI run of the three plain runs (36948851341) has the same semantic digests as the first (36933982377); the view rebuilt locally from the downloaded canonical artifacts is byte-identical to the CI view. |
| 3 | Product-owned regression and policy populations preserved | Met | Both are populations of the view with their own denominators and roles; every scanner's outcome on every regression and policy case equals the legacy outcome in the #607 report. |
| 4 | No unexplained qualification verdict drift | **Met** (as of #641: no family differs in status, and every remaining value difference is attributed) | 0 unexplained of 35,024 compared (34,678 equal, 346 attributed; `--strict` passes), re-run after the #606 case rows with every count unchanged. The criterion asks that no difference is unexplained; it does not ask for equal verdicts, which would erase the architecture change the comparison exists to measure (#607: "the goal is not parity"). 123 families are stable on both paths. The other four (legacy 127 stable, new path 123) are each attributed by a rule that checks the evidence on both sides: one `population-separation` (sendgrid-token), confirmed from data both paths hold, and three `twin-scope-vocabulary` (anthropic-admin01-key, anthropic-api01-key, elevenlabs-api-key), inferred: the data narrows the pattern and the owner has not confirmed it. That counts as explained because the report defines unexplained as a difference no rule attributes, and silent drift is what the criterion guards against. It does not mean accepted: whether the new path's verdict on these four is Redact Secret's qualification is decided in criterion 5, and the three inferred attributions are confirmed there. The report still lists what it did not compare (the support matrix, the peers the legacy run never scanned), so "no unexplained drift" covers what was compared. |
| 5 | One published release qualified end to end through the new path | **Unmet** (ran end to end; verdicts now equal on all 135 families; not accepted by an owner) | The mechanism is done and deterministic. `@redact-secret/core` 0.1.0-beta.12 went through the official runs and the methods run, the adapter, the view and the Next overview, family and case pages, with the axis overlay, the review-ledger mapping, the differential peer scope and the attribution fallback applied, and two CI runs agree on every semantic digest. Qualified means the result is accepted as Redact Secret's qualification of that release, and it is not: the new path reads 123 stable, the legacy path 127, and the four differences are decisions this repository cannot make alone (next section). Nobody has accepted the new path's verdict on them and nothing here assumes they will. |
| 6 | Next credential pages built from new outputs | **Met** for the qualification surface; the legacy pages are deliberately not re-pointed | `/evaluation/qualification/` (overview: identity, populations, scanners, families, known-gap inputs), `/evaluation/qualification/families/<family>/` (status, evidence, gates, per-scanner counts) and, new in this change, `/evaluation/qualification/families/<family>/cases/<page>/` and `/evaluation/qualification/unattributed/<page>/` (every case of every population with each scanner's own word, and its path, twin, attribution, expected spans and measurements when opened) are built solely from the pre-derived view; Next never runs credential-eval. An independent check (`web/scripts/check-export-qualification.mjs`) recounts every case row on the built pages against the view. Not built from the view, on purpose: the report, provider, detector, findings and comparison pages, which show legacy-measured scanner comparison and keep reading the legacy files as the oracle (re-pointing them would remove it; ADR of #606). There is no per-provider qualification page: the overview lists each family with its provider. A page that shows legacy-measured data stays labelled as such until the authority switch decides what the navigation presents. |
| 7 | Rollback path to the legacy pipeline | **Specified; exercised at the switch** | Nothing has been switched, so the legacy path is intact and is the whole of the rollback today. The concrete path (what stays untouched, the committed setting, how Next switches back, how to verify it) is in [Rollback path](#rollback-path-criterion-7). It is a specification because the setting it names does not exist yet; the PR that introduces it must rehearse the rollback before the switch is allowed. |

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
  credential-evidence (a family on the twin) or credential-eval (scope a twin by its parent's family); not decided in this repository. Recommended, not applied: the credential-eval
  and credential-evidence owners confirm the cause (it is `inferred` in the report) and choose one of the two fixes; a fix is a new evidence release or engine tag, so it is a repin and a new
  official run here, and the three families are then measured rather than argued.
- **sendgrid-token** (`population-separation`). The legacy floor pooled the regression fixtures of the family and counted four control axes; the public snapshot has three. The no-pooling
  rule of #603 forbids reproducing the pooled count, so this is a legitimate difference of the new architecture, not a defect: the public benchmark shows what the public evidence supports. Recommended,
  not applied: do not pool; the product owner decides whether sendgrid-token reads provisional on the new path until a fourth reviewed control axis exists in the public snapshot (a credential-evidence
  contribution through the handoff states), or whether a product policy gives the regression corpus a floor of its own.

The eight families that are not stable on the legacy path read the same status on the new path. The remaining differences that are legitimate rather than defects of the new path: the
floors population is the public snapshot alone (the legacy path pooled the regression and policy fixtures), pending fixtures are not scored, the methods run uses the
canonical-id seed (not the legacy category seed), and it scans two peers the legacy run did not (reported, not gate-bearing).

### After #641: 127 against 127

| | Families |
| --- | ---: |
| Stable on the legacy path | 127 |
| Stable on the new path | 127 |
| Status differs between the paths | 0 |

Both former differences were benchmarks-owned and are decided with ADRs ([axis coverage](../decisions/2026-10-02-judge-axis-floors-on-the-union-of-axis-labels-across-populations.md),
[twin scope](../decisions/2026-10-02-gate-cross-provider-twins-through-a-project-twin-scope-corpus.md)); neither waited for another repository.

- **sendgrid-token**: its control axes are judged on the union of labels across the public and regression populations (near-miss, ordinary-prose, placeholder, public-identifier and the
  snapshot's `sendgrid-near-miss-values`). Counts stay per population. The new path counts five axes where the legacy path counted four; the fifth comes from public cases with no legacy
  counterpart (`canonical-evidence-membership`). Exactly the same rule applies to every family; four other families cover more axes and keep their status.
- **anthropic-admin01-key, anthropic-api01-key, elevenlabs-api-key**: the twin-scope corpus carries the six twins with the parent's family; credential-eval reads all six as co-detected, as the legacy path
  did, and the twin gate reads that verdict. The public population's own verdict on the unscoped copies still reads flagged and is shown (`twinFailuresScopedElsewhere: 2` per family). That
  cause is now confirmed rather than inferred; a request that credential-evidence give a cross-provider twin its parent's family is filed (redact-secret/credential-evidence#78) and is an improvement
  at the source, not a dependency.

What this does not show: equal verdicts are not acceptance. The new path still differs legitimately in what it counts (floor counts from the public snapshot alone, pending fixtures not scored, the
canonical-id seed of the methods run, two peers the legacy run never scanned), and criterion 5 still needs an owner to accept the new path's verdict. Pin drift and the legacy-id re-key remain out of scope.

## Authority switch and rollback (design only)

The switch is explicit and reversible, and is one committed value, not a deletion. Nothing in this record builds or flips it.

- A committed setting names the authority for credential qualification: `legacy` or `next`. The publish workflow and the web
  services read it; nothing infers it. Default `legacy`.
- Both pipelines run in CI while the setting exists, so the oracle stays current and the report can be regenerated.
- Flipping to `next` is one reviewed commit that also records the view's policy revision and the artifacts' semantic digests it
  is authorised for. Rolling back is reverting that commit; no data is migrated, so nothing has to be restored.
- The existing site's UI is not removed by an authority change. It is removed only when #543's UI migration criteria are met
  independently.

### Rollback path (criterion 7)

**What stays untouched, today and through the oracle period.** Everything the legacy path needs to produce its numbers and its site, so that
rolling back never depends on restoring anything: `benchmarks/run.ts`, `benchmarks/evaluate.ts`, `benchmarks/classify-support.ts`,
`benchmarks/generate-support-matrix.ts`, `benchmarks/engine/`, `benchmarks/evaluation/domains/credential/`, `benchmarks/lib/` (lattice, reporting,
peer observations), `benchmarks/review-ledger.json` and the committed peer observations, `src/` (the existing site) and its data model, the `web/`
services and pages that read the legacy files (`web/services/run.ts`, `catalog.ts`, `domains.ts`, `peers.ts`, `dossiers.ts` and `web/app/report/`), and the legacy
steps of the `validate` and `publish-site` workflows (`eval:classify`, `bench --strict`, `eval:publish`). The legacy outputs (`public/results/*`, `results-output/*`)
are generated, never committed, so they are rebuilt by the publish run and there is nothing to restore. The #606 and #607 work added files and changed none of these.

**The setting.** `benchmarks/qualification-authority.json`, validated by an `authority:check` the switch PR adds to the `validate` workflow:

```json
{ "schema": "redact-secret/qualification-authority/v1", "authority": "legacy",
  "next": { "policyRevision": "rs-policy-1:sha256:<hex>", "semanticDigests": { "<population>": "sha256:<hex>" }, "parityReport": "sha256:<hex>", "decision": "docs/decisions/<adr>.md" } }
```

Absent or `legacy` means legacy, which is today. `next` is refused by `authority:check` unless `next` names the policy revision and the semantic digests of the view the repository
builds, the digest of the committed parity report, and an accepted ADR, so a repin, a new run or a policy change makes `next` stale and the check fails until the new
view is authorised again. Two readers, and no others: the publish workflow (which pipeline's status and support matrix it publishes) and the `web/` navigation (which of the two page sets is presented
as the credential qualification; both sets stay built and linked either way).

**How Next switches back.** Revert the one commit that set `authority` to `next` (or set it to `legacy`). The legacy pages never stopped reading the legacy files, so the revert
changes only what the publish workflow selects and what the navigation presents. The qualification pages stay as the parallel set. No migration, no data restore, no re-run.

**How the rollback is verified.** On the revert branch: `npm run eval:classify` and `npm run bench -- --strict` pass, `web` `npm run check` passes, and the staging site
(`develop` push) shows the legacy support status and matrix before `npm run go-production` is used. The switch PR rehearses exactly this before it merges: it builds both states from one checkout (`legacy` and `next`),
runs those checks on both, and records the result in its ADR. Until that rehearsal exists criterion 7 is specified, not exercised.

**The oracle period.** The `remove-after-cutover` rows below are not removed at the switch. They are removed only after at least one further published release has been qualified
through the new path and compared with the legacy path (the parity report regenerated, 0 unexplained), the rollback has been rehearsed, and the removal PR lists each file's callers first.

## What remains before the authority switch, and who decides

Nothing here is decided by this record, and no check flips authority.

1. **Criterion 5: accept the new path's verdict (as of #641 it equals the legacy status on every family).** Superseded detail of the earlier four-family question follows.  Decided in an ADR by the product owner for the qualification policy (sendgrid-token: pooling is refused by #603, so
   either a fourth reviewed control axis in the public snapshot or a product policy on the regression corpus, or acceptance of provisional) and by the credential-eval and
   credential-evidence owners for the cause and the fix of the three `twin-scope-vocabulary` families (confirm the inferred cause; a family on the twin or scoping by the parent's family). A fix is a
   repin and a new official run here.
2. **Criterion 7 exercised.** Build the setting and `authority:check`, and rehearse the rollback in the switch PR.
3. **The decision itself.** The switch is one reviewed commit by the maintainer of this repository, after 1 and 2, with an ADR that cites the parity report and the policy revision.
   No workflow, schedule or agent flips it; `go-production` only fast-forwards `main` after `develop` is green.
4. **Independent of the switch.** The existing site's UI is removed only under #543's criteria. The Next pages that read the legacy files (report, comparison, PII, performance) are migrated or kept by their own decisions.
5. **Known gaps that do not gate the switch, stated so they are not forgotten:** the support matrix is not compared in the #607 report; flare-redact and openredaction review occurrences are measured and unreviewed
   (not gate-bearing); known-gap and fixture ids of the public population wait for the evidence release's id map; there is no per-provider qualification page.

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
