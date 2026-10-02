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

**Update (#608, the authority switch, 2026-10-02).** Authority for credential qualification is the **new path**. The owner of this repository accepted the new
path's verdict (127 stable, equal to the legacy 127 on every family) as Redact Secret's qualification of `@redact-secret/core@0.1.0-beta.12` (criterion 5); the Next credential
report pages are built from the new view when `benchmarks/qualification-authority.json` says `new` and from the legacy files when it says `legacy` (criterion 6); and the rollback
was rehearsed in the switch PR (criterion 7). The legacy path is intact as the oracle for a bounded period, and nothing was deleted or retired: the existing site, the legacy
evaluator and the legacy `web/` services are as they were. ADR: [Switch credential qualification authority to the new path](../decisions/2026-10-02-switch-credential-qualification-authority-to-the-new-path.md).
Text below that describes authority as still legacy, or the switch as designed and not built, describes the state before this change and is superseded where it conflicts with this paragraph.

This record was written to delete, retire and switch nothing, and the switch still deletes and retires nothing. State below is read from the #607 report, built from the canonical
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
| 5 | One published release qualified end to end through the new path | **Met** (accepted by the owner, 2026-10-02) | `@redact-secret/core` 0.1.0-beta.12 went through the official runs and the methods run, the adapter, the view and the Next pages, with the axis overlay, the review-ledger mapping, the differential peer scope, the twin-scope corpus and the attribution fallback applied, and three CI runs agree on every semantic digest. Qualified means the result is accepted as Redact Secret's qualification of that release. The owner accepted it explicitly on 2026-10-02: the new path reads 127 stable families, the legacy path 127, the same families, 0 status differences of 135 and 0 unexplained of the 35,084 values compared at #641 (`--strict` passes); the report regenerated after #644 adds the support matrix, the overview numbers and the review peers and compares 42,611 values, again with 0 unexplained. The acceptance, its date and its owner are in `new` of `benchmarks/qualification-authority.json` and in the switch ADR. It covers the verdict the report records and nothing more: the report still lists what it did not compare (the Next page data, review entries outside the mapping, the candidate-regression inputs and the protected holdout; the peers the legacy run never scanned are measured and reported, not gate-bearing), and the earlier four-family question (sendgrid-token, and the three twin-scope families) was closed by #641 before the acceptance. |
| 6 | Next credential pages built from new outputs | **Met** | `/evaluation/qualification/` (overview, family and case pages) are built solely from the view. With `new`, the report, providers, families, detectors, suite, rows and fixture pages and `/evaluation/credential/` are built from the same view through one seam (`web/services/credential-source.ts`: the view bridged to the `Catalog` and `MeasuredRun` the pages already read), over the population the population policy gives the floors and gates, and each says which pipeline produced its numbers (the `PipelineStamp`). With `legacy` they are built from the legacy files exactly as before, and that path is tested in every CI run. Not re-pointed, on purpose: the comparison, scanner and runtime pages, which compare scanners on the legacy corpora and stay as the oracle (stamped legacy, oracle). A fixture page built from the view says its bytes are not recorded; the view carries none. See [Authority read path](#authority-read-path). |
| 7 | Rollback path to the legacy pipeline | **Rehearsed** (in the switch PR, 2026-10-02) | The setting exists (`benchmarks/qualification-authority.json`), `authority:check` validates it and what reads it, the legacy path was never touched, and rolling back is one value. The rehearsal built both values from one checkout and ran the checks on both; the evidence is in [Rehearsal](#rehearsal-of-the-rollback-criterion-7). |

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

## Authority switch and rollback

The switch is explicit and reversible, and is one committed value, not a deletion.

- `benchmarks/qualification-authority.json` names the authority for credential qualification: `legacy` or `new` (the design called the second value `next`; it collides with the name of the web
  framework). Nothing infers it: no environment variable, no query string, no fallback to the other path. An absent file means `legacy`; a file that does not validate fails the build.
- Both pipelines keep running in CI while the setting exists, so the oracle stays current and the report can be regenerated.
- Flipping to `new` was one reviewed commit that also records the policy revision and the semantic digests of the canonical runs it is authorised for, the parity report and the ADR.
  Rolling back is a commit that sets the value to `legacy`; no data is migrated, so nothing has to be restored.
- The existing site's UI is not removed by an authority change. It is removed only when #543's UI migration criteria are met independently.

### The setting and its gate

```json
{ "schema": "redact-secret/qualification-authority/v1", "authority": "new",
  "legacy": { "role": "oracle", "oracle": { "exitCondition": "…", "decision": "docs/decisions/<adr>.md" } },
  "new": { "release": "@redact-secret/core@<version>", "acceptedOn": "<date>", "acceptedBy": "<owner>", "policyRevision": "rs-policy-1:sha256:<hex>",
           "semanticDigests": { "<population>": "sha256:<hex>", "<population>+methods": "sha256:<hex>" },
           "parityReport": "docs/generated/qualification-parity.json", "decision": "docs/decisions/<adr>.md" } }
```

`npm run authority:check` (in the `validate` workflow) holds three things. The file validates against `schemas/qualification-authority-v1.json` (and the same rules in `benchmarks/qualification/authority.ts`, which a
test keeps equal). While the value is `new`, the authorisation is still true: its policy revision is the one `loadPolicyRevision()` computes from the benchmark-owned inputs now, its semantic
digests are those of the canonical linux-x64 runs `benchmarks/official-runs.json` records (every one, none missing, none extra), the parity report it cites reports 0 unexplained and compared exactly those runs
and that policy, and the decision it cites exists and is accepted. A repin, a new official run or a policy change therefore makes `new` stale and the check fails until a reviewed commit authorises the new view.
While the value is `legacy` nothing is asked of `new`, and its block stays in place. Last, only the listed readers may name the file (`AUTHORITY_READERS`): a new reader is a decision, added there and
to the table below in the same change.

### Authority read path

```
benchmarks/qualification-authority.json
        │  (the only reader in the app)
web/services/authority.ts ──► web/services/credential-source.ts ──► { Catalog, MeasuredRun, fixture bytes, support, pipeline }
                                  │                                        │
                          authority legacy                          authority new
                  catalog.ts + run.ts (the legacy             qualification.ts (the view, checked for shape, pins and
                  corpora and run files, as before)           the authorisation) ► credential-bridge.ts (bridged to the same shapes)
                                  │                                        │
                                  └────────── web/resolvers/pages.ts (one `context()`) ──────────┘
                                                      │
                  report, providers, families, detectors, suites, rows, fixtures, /evaluation/credential, each under a PipelineStamp
```

| Consumer | `legacy` | `new` |
| --- | --- | --- |
| `/report/`, `/report/providers/`, `/report/families/` (and each family), `/report/detectors/` (and each detector), `/report/fixtures/` (and each suite and fixture), `/report/rows/<level>/` | the legacy run files and fixture corpora | the view, over the floors-and-gates population; stamped new, authority |
| `/evaluation/credential/` | the committed support record for the run's mode and build | the view's status distribution; stamped new, authority |
| `/evaluation/qualification/…` | the view (always) | the view (always) |
| `/comparison/accuracy/`, `/comparison/` (run date and mode), `/evaluation/scanner/`, the runtime, performance and feature pages | the legacy files | the legacy files, kept as the oracle (accuracy is stamped legacy, oracle) |
| `/report/findings/` | the known-gaps ledger | the known-gaps ledger (a fixture links only where the view holds it) |
| `check:routes` | recounts every page against the legacy files (`check-export.mjs`, `check-export-rows.mjs`) | recounts every page against the view, independently of the services (`check-export-credential.mjs`); without a view, checks every page says none backs the build |
| The publish workflow (`publish-site.yml`) | builds the Next export under `/next/` from the committed value, so it publishes the legacy-built pages; it does not read the file itself | builds the Next export under `/next/` from the committed value, with the view it builds from the archived canonical RunArtifacts (#643) and `WEB_REQUIRE_QUALIFICATION=1`, so it publishes the new-built pages; it does not read the file itself. The existing site it publishes (the legacy status and matrix) is unchanged by this switch |

With `new` and no usable view (absent, unreadable, built from other pins, or not the authorised one), every report page names the new pipeline and says no view backs the build, shows no number, and gives the commands that
produce one; the taxonomy and the detector registry still list their pages. A build that publishes sets `WEB_REQUIRE_QUALIFICATION=1` (`publish-site.yml` does, #643), so a missing, stale or unauthorised view fails it instead of publishing that state.
A fixture page built from the view says its bytes are not recorded (the view carries expected spans and each scanner's outcome and counts, not the file or where a scanner's ranges are). The accounted rates are computed over the view's case rows with the
accounting the legacy bench uses, so a rate means the same on both pipelines.

### Rollback path (criterion 7)

**What stays untouched, today and through the oracle period.** Everything the legacy path needs to produce its numbers and its site, so that
rolling back never depends on restoring anything: `benchmarks/run.ts`, `benchmarks/evaluate.ts`, `benchmarks/classify-support.ts`,
`benchmarks/generate-support-matrix.ts`, `benchmarks/engine/`, `benchmarks/evaluation/domains/credential/`, `benchmarks/lib/` (lattice, reporting,
peer observations), `benchmarks/review-ledger.json` and the committed peer observations, `src/` (the existing site) and its data model, the `web/`
services and pages that read the legacy files (`web/services/run.ts`, `catalog.ts`, `domains.ts`, `peers.ts`, `dossiers.ts` and `web/app/report/`), and the legacy
steps of the `validate` and `publish-site` workflows (`eval:classify`, `bench --strict`, `eval:publish`). The legacy outputs (`public/results/*`, `results-output/*`)
are generated, never committed, so they are rebuilt by the publish run and there is nothing to restore. The #606, #607 and switch work added files and changed none of the legacy computations: the legacy
`web/` services gained one seam in front of them (`credential-source.ts`) and a refactor that shares the catalog's indexing (`assembleCatalog`).

**How Next switches back.** Set `authority` to `legacy` in `benchmarks/qualification-authority.json` (or revert the commit that set `new`). The legacy pages never stopped reading the legacy files, so the revert
changes which pipeline the credential report pages are built from and what their stamps say. The qualification pages stay as the parallel set. No migration, no data restore, no re-run. `authority:check` then asks nothing of the
new path, and the authorisation block stays for the day it is flipped again.

**How the rollback is verified.** On the revert branch: `npm run eval:classify` and `npm run bench -- --strict` pass, `web` `npm run check` passes, and the staging site
(`develop` push) shows the legacy support status and matrix before `npm run go-production` is used. `web/scripts/with-authority.mjs <legacy|new> -- <command>` builds either value from one checkout without a
commit (it sets the value for the command and restores the file's bytes afterwards), and it is how the CI web job builds the legacy pipeline's export for the browser checks.

### Rehearsal of the rollback (criterion 7)

Rehearsed on 2026-10-02 in the switch PR, from one checkout (the branch rebased on `develop` after #643), by flipping the one value with `web/scripts/with-authority.mjs` and putting it back. The `new` runs used the view of
canonical official run 36964984990 (downloaded from its `qualification-view` artifact into `public/results/`); the legacy run files came from `npm run bench` on the same checkout.

| Step | `legacy` | `new` (with the view) | `new` (no view, the CI state) |
| --- | --- | --- | --- |
| `authority:check` | passes: asks nothing of the new path | passes: policy, the four canonical runs, parity report and ADR hold | n/a (the gate does not read the view) |
| `web` `npm run build` and `check:routes` | passes: every page recounted against the legacy files (160 family pages with fixtures, 110 detector and 67 suite pages, 137 data files); every report page stamped legacy, authority | passes: every page recounted against the view (409 tables, 174 data files, 12,180 rows; hub counts and the three answers; stamps new, authority) | passes: every report page names the new pipeline and says no view backs the build; `WEB_REQUIRE_QUALIFICATION=1` refuses the build |
| `web` `npm run check` (no-sx, header, typecheck, build, routes, Storybook, `check:layout` in Chrome) | passes: 710 stories and pages at 320, 375 and 768px | passes: 705 stories and pages | not applicable: no data pages to lay out (CI builds the legacy export for the browser checks) |
| `web` `npm run test:e2e` (Chrome, 172 tests) | 172 passed | 172 passed | not run |
| `web` `npm run test:coverage` | passes, coverage thresholds met; the unit tests pin their own pipeline, so one run covers both | same run | same run |
| Legacy classification | `npm run bench -- --strict` passes; `npm run eval:classify` reads 127 stable of 135 families and `npm run queue:check` passes, both with no peer binary on `PATH`, as the CI job runs them | unchanged by the value | unchanged by the value |

Not exercised: `npm run check:docker` was started (a container copy with no view, as CI has none) and passed the lint, header and typecheck steps and the legacy build, `check:routes` and Storybook build in the Linux image, but its layout and
Playwright steps did not finish within the 30-minute limit of the session, so the Linux browser checks are left to the CI run of the PR. The pinned trufflehog 3.97.4 is not available on this machine (the keg now prints 3.97.9), so no
measurement that needs a peer binary was run; none is involved in the switch. `pins:check` (known red) is out of scope.


**The oracle period.** The `remove-after-cutover` rows below are not removed at the switch. They are removed only after at least one further published release has been qualified
through the new path and compared with the legacy path (the parity report regenerated, 0 unexplained), the rollback has been rehearsed against that release, and the removal PR lists each file's callers first. The
period is also reviewed on 2027-01-02: if no further release has been qualified by then, the maintainer decides whether to keep the oracle, with a new exit condition recorded in the ADR. A lapse removes nothing.

## What the switch needed, and what remains before the legacy evaluator is retired

Done by the switch PR (#608), in one reviewed change:

1. **Criterion 5: the owner accepted the new path's verdict** for `@redact-secret/core@0.1.0-beta.12`, on 2026-10-02 (127 stable on both paths, 0 status differences, 0 unexplained).
2. **Criterion 7 exercised:** the setting, its schema and `authority:check` exist, and the rollback was rehearsed (above).
3. **Criterion 6:** the Next credential report pages read the authority.
4. **The decision itself:** the switch is one reviewed commit with an ADR that cites the parity report and the policy revision. No workflow, schedule or agent flips it; `go-production` only fast-forwards `main` after `develop` is green.

Remains, before any legacy evaluator file is retired (the bounded oracle period):

1. **A further published release qualified through the new path** and compared with the legacy path: the parity report regenerated for it with 0 unexplained, and the authorisation renewed for its runs.
2. **The rollback rehearsed again** against that release.
3. **A removal PR** that lists each file's callers (`graft callers <symbol> --depth 3`) and the `web/` services that import it, per the dispositions below, and is reviewed. It also rewrites the `web/scripts/check-export*.mjs` recounts against the view
   (they are the legacy oracle for the Next app) and moves the types the new path imports out of the engine.
4. **The Next deploy already supplies the view (#643).** `publish-site.yml` builds the view from the archived canonical RunArtifacts and the export with `WEB_REQUIRE_QUALIFICATION=1`, so under `new` the pages it publishes under `/next/` are the new-built ones, and a build whose view is not the authorised one fails. A `new` publish after a repin or a new run needs the authorisation renewed first (`authority:check`). Reading the value in the workflow itself is not needed and is not done.
5. **Independent of the switch.** The existing site's UI is removed only under #543's criteria. The Next pages that read the legacy files (comparison, PII, performance, scanner) are migrated or kept by their own decisions.
6. **Known gaps that do not gate retirement, stated so they are not forgotten:** the support matrix is carried by the view and compared by the parity report since #644 (0 unexplained), but the legacy matrix and the candidate diff still run on the legacy engine, and no Next page shows a matrix (a page that needs it reads `view.supportMatrix` through the same seam; none is wired here); the report's "Next page data" is still not compared; flare-redact and openredaction review occurrences are measured and unreviewed
   (not gate-bearing); known-gap and fixture ids of the public population wait for the evidence release's id map (a finding links to a fixture page only where the view holds the fixture); a fixture page built from the view has no bytes; there is no per-provider qualification page.

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
| `web/services/qualification.ts`, `web/resolvers/qualification*.ts`, `web/components/qualification/` | Next reads the view only (the components include the `PipelineStamp`). |
| `benchmarks/qualification-authority.json`, `benchmarks/qualification/authority.ts`, `schemas/qualification-authority-v1.json`, `scripts/check-qualification-authority.mjs`, `web/services/authority.ts`, `credential-source.ts`, `credential-bridge.ts`, `web/scripts/check-export-credential.mjs`, `web/scripts/with-authority.mjs` | The switch (#608): the one value, its gate, its single reader, the seam and the bridge from the view. |

### Compat-only: the legacy path reads them, the new path does not

| Files | Reader today | Condition to reconsider |
| --- | --- | --- |
| `benchmarks/fixture-index.json`, `benchmarks/lib/fixture-index.ts`, `scripts/generate-fixture-index.mjs` | **The Next app**: `web/services/catalog.ts` reads and validates it and checks that its fixture count equals the built catalog. | The Next catalog is fed from the evidence release; then it can go. This answers the question left open in #632: yes, Next still reads `fixture-index.json`. |
| `benchmarks/fixture-detectors.json`, `benchmarks/detectors.json`, `benchmarks/categories.json`, `benchmarks/pin-manifest.json`, `benchmarks/scenarios.json` | The Next app (`catalog.ts`, `peers.ts`, `dossiers.ts`) and the bench. | Same. `categories.json` also lists the product populations: keep those entries. |
| `peer-observations/` (credential suites), `qualification/suite-v1.json` | The legacy classifier and bench; the Next scanner page reads the pins and snapshot summaries. | The Next scanner page reads the official artifacts' scanner identities. |
| `evidence/<n>/<commit>/support-status-*.json` (committed legacy classification records) | The Next `/evaluation/credential/` page (`web/services/domains.ts`) while the authority is `legacy`; under `new` it reads the view's distribution. | The oracle period ends. |
| `public/results/*.json`, `results-output/*` (generated, not committed) | The legacy site; the Next comparison and scanner pages always; and the Next report, family, detector and fixture pages while the authority is `legacy`. | The comparison and scanner pages are migrated, and the legacy site is retired under #543. |
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
