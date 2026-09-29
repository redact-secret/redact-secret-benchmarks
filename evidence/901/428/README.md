# Beta.11 PII E: protected qualification and six-family disposition (benchmarks #428)

**Final disposition:** see [`final-core-8b6a5fde.md`](final-core-8b6a5fde.md) (core `8b6a5fde`, all six `pending`; the report's `profile-cost` is `not-met` with 175 failing cells, accepted by the maintainer as a tradeoff on 2026-09-29, so all six are eligible for the protected run; it supersedes the `ec9224d9`, `8f97f14d`, `1db8ff38` and `1127bf91` records). What follows is the interim record.

**Interim record.** It measures core `79c0a661`, which is not the final beta.11 candidate. [redact-secret#937](https://github.com/redact-secret/redact-secret/issues/937) (built on #929) will move the PII runtime out of the default Wasm builds, so the Wasm artifact set and its cost change after this commit. Rerun this record on the post-#937 commit before any release decision (see [Rerun](#rerun-on-a-new-core-commit)).

All six families stay `pending`. The protected partition was not run, and every epoch is unspent at 0/1. Payment card is the one family where every public gate passes except cost. Under the brief, that family was stopped before any protected run and reported for the orchestrator to decide.

This record belongs to [redact-secret#901](https://github.com/redact-secret/redact-secret/issues/901) (benchmark issue [#428](https://github.com/redact-secret/redact-secret-benchmarks/issues/428), parent [#421](https://github.com/redact-secret/redact-secret-benchmarks/issues/421)). It adds files and edits no earlier record: not the [#422 ledger](../pii-gap-ledger-v1.json), not `evidence/875`–`880`, `evidence/286` or #424–#427. It makes no support claim. PII numerators and denominators are the only counts in it. Credential findings are counted on their own (`credentialFindingCases`) and never merged into a PII number.

## Files

| File | Content |
| --- | --- |
| [`core-79c0a66119fb/pii-beta11-freeze-v1.json`](core-79c0a66119fb/pii-beta11-freeze-v1.json) | Everything frozen before any scan. Committed at `2af6e5d` (commitment `dda7bd9a…5269f`); the measurement came in a later commit |
| [`core-79c0a66119fb/pii-beta11-observation-v1.json`](core-79c0a66119fb/pii-beta11-observation-v1.json) | For each case, lane and selection: family findings (UTF-8 range, action), other PII types, credential count, leak booleans. Also the identity-seam rows. No input or output text |
| [`core-79c0a66119fb/pii-beta11-operational-v1.json`](core-79c0a66119fb/pii-beta11-operational-v1.json) | Paired runtime medians, package and Wasm payload bytes, #143 size rows |
| [`core-79c0a66119fb/pii-beta11-report-v1.json`](core-79c0a66119fb/pii-beta11-report-v1.json) | Every recomputed `pii-v1` gate per family (commitment `7df74103…8fb41`) |
| [`core-79c0a66119fb/pii-beta11-disposition-v1.json`](core-79c0a66119fb/pii-beta11-disposition-v1.json) | The six-row release-facing matrix (commitment `2fbd2dbc…4d56e`) |

`tests/pii-beta11.test.mjs` rebuilds the report and disposition from the committed freeze, observation and operational files and requires them to match byte for byte. It also checks that no case text appears in any of the four files, re-hashes every frozen input, and checks each v2 revision against the case text.

## What was frozen first (`2af6e5d`)

- **Candidate.** `redact-secret/redact-secret` `79c0a66119fb72931fda9adddbe2973a52bb4833` (#930: repairs #922 and #924–#927, vocabulary `pii-context/v2`; includes #910). The version string is still `0.1.0-beta.10`. No beta.11 release exists, and this record claims none. The candidate was built from a temporary detached worktree, which was then removed. Tarball SHA-256 digests:
  - core `4df009d2…b002f`
  - node-darwin-arm64 `80e49812…16680`
  - wasm `dde65143…9e3ff`
  - identity example binary `0b34b556…d2dab`
  - artifact set `520c2cbc…61c43`

  The facade and Wasm tarballs are byte-identical to the #427 build. The native addon is not reproducible between builds. For comparison, the freeze also records the commit's CI inventory from Artifact qualification run `36446845486` (`f4c67df6…590fa`). There, the facade matches, and the CI Wasm payloads differ from the local build by 16 bytes raw.
- **Contracts.** The freeze records hashes at the candidate and at beta.10. Two family contracts were amended in place: `email-v1.md` (#926, labels glued by `=`; #927, `email address` forms) and `payment-card-v1.md` (#927, unspaced `카드번호`). Also changed: `pii-context-v2.json`, the v2 ADR, `detector-families.md` (#925, trailing period after a network address) and `contextual-detection.md`.
- **Plans and truth.**
  - Unchanged: the six #423 oracle qualification plans and the oracle; the #424, #425 and #426 population plans; the #426 corrections; `pii-v1`; the evidence/879 operational contract; the #143 budgets.
  - New and pre-registered: [`pii-context-v2-expectation-revisions-v1.json`](../../../benchmarks/evaluation/domains/pii/pii-context-v2-expectation-revisions-v1.json), with 14 revisions (below).
- **Activation.** The v2 identities are taken from the core guides. Examples: `credentials=full;selectors=pii:global;families=<five global>;vocabulary=pii-context/v2`, and `pii:us` closes over the five plus `pii:us:ssn`.
- **Evaluation schema.** [`beta11-qualification.ts`](../../../benchmarks/evaluation/domains/pii/beta11-qualification.ts), [`beta11-disposition.ts`](../../../benchmarks/evaluation/domains/pii/beta11-disposition.ts), the harness [`scripts/pii-beta11.mjs`](../../../scripts/pii-beta11.mjs) and the shared scorers they import, each by SHA-256.
- **Protected epochs.** Each family has one new epoch commitment, with `maxRuns 1` and `runs 0`. None of the five global families has a registered custodian corpus. The sealed US SSN epoch in `evidence/879` belongs to candidate `a0709d2a` and does not carry over.

## Six-family matrix (interim, core `79c0a661`)

Profile `pii-v1`. Context languages are en and ko under `pii-context/v2`. Populations use the reviewed view and the `pii:global`+`pii:us` lane on the Node addon. The Node Wasm lane gave the same result for every case, selection and family. Reading the population cells:

- The first number pair is sensitive cases detected.
- `FA x/y` is false alarms over non-sensitive plus not-established cases.

| Family | Scope | Supported contract | Status | Failed or withheld gates | Oracle plan | Diagnostic-balanced | Benign-heavy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| network-address | global, `pii:global` / `pii:family:global:network-address` | 875 contract v1 + #925 boundary | pending | population-mass-resolved; runtime-and-package-cost; size-regression-budget; profile-cost (unresolved); protected-partition (not-run) | 8/8, FA 0/17 | 39/39, FA 0/52 | 24/24, FA 0/53 |
| email | global | `email-v1.md` (amended by #926/#927) | pending | benign-heavy-population; population-mass-resolved; runtime-and-package-cost; size-regression-budget; profile-cost; protected-partition | 4/4, FA 0/16 | 42/42, FA 0/38 | 8/8, FA 0/33 |
| payment-card | global | `payment-card-v1.md` (amended by #927) | pending | runtime-and-package-cost; size-regression-budget; profile-cost; protected-partition | 5/5, FA 0/14 | 68/68, FA 0/89 | 10/10, FA 0/41 |
| iban | global | `iban-v1.md` | pending | benign-heavy-population; runtime-and-package-cost; size-regression-budget; profile-cost; protected-partition | 2/2, FA 0/19 | 35/35, FA 0/50 | 1/1, FA 0/41 |
| us-ssn | `us` only, `pii:us` / `pii:family:us:ssn` | `us-ssn-v1.md` | pending | diagnostic-population; benign-heavy-population; runtime-and-package-cost; size-regression-budget; profile-cost; protected-partition | 3/3, FA 0/17 | 7/7, FA 0/8 | 3/3, FA 0/18 |
| phone | global (NANP `+1` only) | `phone-v1.md` | pending | diagnostic-population; benign-heavy-population; runtime-and-package-cost; size-regression-budget; profile-cost; protected-partition | 14/14, FA 0/27 | 8/8, FA 0/10 | 3/3, FA 0/23 |

Every row binds:

- the artifact IDs of the candidate above;
- benchmark freeze `2af6e5d`;
- plan commitments in the freeze;
- report `7df74103…`.

These gates pass for all six families:

- exact-candidate binding;
- activation-v2 (every selection, both surfaces);
- PII-off invariance;
- the oracle-plan public stream;
- identity-only classification;
- source/artifact equivalence;
- cross-surface determinism;
- population no-regression against the lockfile `0.1.0-beta.10`;
- authored-truth agreement (0 reviewed deviations);
- contract-fixture discrepancy;
- cross-surface output (#427 plan v2 on the same source commit);
- trusted accounting source;
- independent evidence.

### Why each family is pending

Every family shares the same three cost gates. The other reasons are family-specific.

- **Cost, shared by all six.**
  - `runtime-and-package-cost` fails. The default common Wasm payload grows against the evidence/879 zero-growth budget: +24,323 B raw, +7,937 B gzip, +5,351 B brotli, both against the paired local build of `63a834e0` and against the frozen 879 baseline. The beta.10 figures were +12,359, +4,581 and +2,776.
  - `size-regression-budget` fails. The #143 rows, against the beta.8 values, are:
    - `size/wasm/full/gzip`: 278,785 vs 137,639 (+141,146, allowed +6,882)
    - `size/wasm/common/gzip`: 278,818 vs 100,058 (+178,760, allowed +5,003)
    - `size/npm/wasm/packed`: 575,112 vs 254,413 (+320,699, allowed +12,721)
    - `size/npm/node-darwin-arm64/packed`: 597,883 vs 424,514 (+173,369, allowed +21,226)
    - `size/npm/core/packed` is within budget (+1,099).
  - `profile-cost` is unresolved. The #286 protocol only runs in the official Linux workflow, which was not dispatched for this candidate.

  The growth is not all PII. #929 found that the common profile has linked every provider detector since #884, and the residual-entropy shadow model (#829) also landed in this range. #937 owns the split, and the per-module attribution is required there.
- **Network address.** The `ip: …:8080` case is still contract-silent: the frozen 875 contract and #925 decide only the trailing period. Separately, the v2 revisions left the `net-dense-equidistant` stratum with declared mass but no v2 authored member, in both views. Both make `population-mass-resolved` fail.
- **Email.** In benign-heavy, context discrimination has 3 twin pairs, below the pii-v1 minimum denominator of 4. The v2 revisions emptied the `email-atext-joined-context` and `email-equidistant-unassociated` strata while their declared mass remains.
- **IBAN.** Benign-heavy has 1 sensitive case, so the sensitive-side metrics have a denominator below 4.
- **US SSN.** In diagnostic-balanced, context discrimination has 3 twin pairs. In benign-heavy there are 3 sensitive cases, so the sensitive-side and wrong-jurisdiction metrics fall below 4.
- **Phone.** In diagnostic-balanced, the non-sensitive flag rate has 3 cases. In benign-heavy there are 3 sensitive and 3 non-sensitive cases.

The population reasons are benchmark-side gaps, not product defects. They need more authored twins or sensitive and non-sensitive cases in those views, and the v1-era masses need to be declared again under v2. No product defect was found, so no core issue was filed.

**Scoring caveat.** A metric with a zero denominator counts as `not-applicable`, the same rule the #424 scorer uses. Under the stricter reading in `qualification.ts` (a required metric with no denominator is unresolved), two more checks would be unresolved: IBAN and SSN `non-sensitive-flag-rate`, which has no authority-reserved value by contract, and benign-heavy context discrimination for IBAN, SSN and phone. None of this changes a status, and payment card has a non-zero denominator for every metric.

## Protected partition

Nothing protected was read or run. Eligibility requires every public gate to pass.

| Family | Eligible | Eligible except for cost alone | State |
| --- | --- | --- | --- |
| network-address, email, iban, us-ssn, phone | no | no | `not-run`, unspent 0/1, `public-gates-failed` with the gates listed above |
| payment-card | no | **yes** | `not-run`, unspent 0/1. Stopped here and reported: the only failures are runtime-and-package-cost, size-regression-budget and profile-cost |

No custodian-held protected corpus is registered for payment card. A post-#937 candidate would also be a new epoch. Spending this epoch is the orchestrator's decision.

## Identity-only outcomes (core seam #910)

The maintainer-local example ran on all six oracle plans. It was built from the candidate commit, and its binary hash is frozen. Its rows were admitted through the shared #423 validator, which fails closed. Source/artifact equivalence held: the example reports `sensitive` exactly when the built artifact emits the public finding, on both the Node addon and the Wasm exact-family lanes. Of 110 eligible no-finding cases:

- 103 match the oracle exactly (identity and sensitivity).
- 0 are identity misses or identity over-acceptances.
- 7 are named-negative cases.

For the 7, the product reports `non-sensitive` and the oracle `not-established`:

- email `named-negative-context`
- card `named-negative-context-wins`
- IBAN `documentation-context` and `korean-example-context`
- SSN `documentation-negative` and `negation-negative`
- phone `negative-context-wins`

The oracle's own rule is that `non-sensitive` needs an authority-reserved value, so context cannot establish non-sensitivity. The product's `non-sensitive` there is the family's named occurrence exclusion. These 7 were therefore compared on identity only, and all 7 have an established identity for an authored `valid` candidate. No label was changed. The rule was pre-registered in the frozen module (`B11_NAMED_NEGATIVE_FORMS`), and a test pins the count at exactly 7. The raw #423 projection, which counts those 7 as `sensitivity-mismatch`, is kept in the report next to the reconciled gate.

## Population re-run and the v2 revisions

Every #424/#425/#426 plan case ran on the exact candidate:

- Node addon and forced Wasm;
- selections: `pii:global`+`pii:us`, exact family, closure, off, and `pii:global` for SSN;
- the lockfile `0.1.0-beta.10` as baseline.

**Frozen-plan view.** Deviations occurred only on pre-registered cases:

- the 13 scored v2 revisions (the 14th, `net-p-trailing-period`, was contract-silent and unscored in the frozen view);
- the three #426 corrections.

**Reviewed view.** 0 deviations in every family, 0 addon/Wasm disagreements, 0 regressions against beta.10, and 0 PII findings while PII is off. The leak check flags one case, and it is not a leak. The check asks whether the target's bytes still appear anywhere in the sanitized output. In phone oracle case `context-stops-at-candidate`, the same number appears a second time on the line, unassociated and unredacted, as the case intends. The redacted target span itself is gone. No gate reads the oracle-plan leak count, and the population views have 0 leaks.

The 14 revisions were derived from contract text before the scan. Each is checked mechanically against the case text:

- #924 forward-only field labels: 7 revisions (email 2, network 3, card 1, IBAN 1);
- #926 email label glued by `=`: 2;
- #927 added forms (`email address`, `이메일 주소`, `카드번호`): 3;
- #927 ASCII case in `IP 주소`: 1;
- #925 trailing period after an address: 1.

No US SSN, phone or oracle-plan case changes under v2.

## Review of earlier corrections

- **#426 `pii-c3-reviewed-corrections-v1.json`: grounded in contract text.**
  - `pii-context` (v1, and unchanged in v2) splits tokens only on whitespace, underscore, hyphen, colon and equals. `(example)`, `(예시)` and `(contact details)` are therefore not the whole reviewed forms.
  - `us-ssn-v1` requires an associated whole example label, and `phone-v1` names only the example labels as exclusions.
  - The corrections were found because the scan disagreed, which is output-triggered discovery. But they apply uniformly: the three corrected cases are the only parenthesized-label cases in the SSN and phone plans. The #425 card plan reads `(예시)`/`(example)` the same way.
  - The v2 contract does not change them, and the candidate matches all three.
- **#424 email v2 corrections: grounded in contract text as of beta.10, now partly superseded.**
  - Under the beta.10 `email-v1.md` text, RFC 5322 `atext` includes `=`, so `key=address` is one candidate starting at the key. All three corrections (two joined cases relabeled `valid/not-established`, and one reserved-domain range fix) follow from that text, not from detector output. They too were found by a first-run disagreement.
  - `email-v1.md` was amended in place by #926. For a reviewed email label key, the candidate now starts after the `=`.
  - The two joined cases therefore become sensitive at the shorter range. They are pre-registered as v2 revisions, and the candidate matches them.
  - The `to=` reserved-range fix still holds, because `to` is not a reviewed label.

## Cost runner re-freeze

[`qualification/pii-profile-cost-v2.json`](../../../qualification/pii-profile-cost-v2.json) re-freezes the #286 protocol as a new version. The v1 plan and files are unchanged, and the v1 test still verifies them. The v2 version:

- names its candidate, role (`interim`), CI run and inventory as reviewed inputs;
- expects `vocabulary=pii-context/v2`;
- adds a `.github/workflows/pii-profile-cost-v2.yml` that reads those inputs from the plan;
- reports any candidate-only PII Wasm artifact (#937) on its own, without a pre-existing budget, and keeps the default `full`/`common` rows under the #143 budgets.

The local harness separates payloads by role in the same way:

- `default-full` and `default-common` go under the 879 and #143 budgets;
- `pii` is reported on its own.

The official A/A, freeze, candidate and size phases have not been dispatched. That needs the reviewed plan on `develop` and a `workflow_dispatch`.

## Not done here, with reasons

- **Support projection.** The repository's projection (`pii:support:record` / `eval:publish:pii-support` → `pii-support-matrix-v2`) binds only product records built by `pii:qualify:candidate`. Two things block binding this candidate:
  - That script's frozen v1 plans pin `vocabulary=pii-context/v1` identities, so a v2 candidate cannot be bound without a reviewed v2 binding path.
  - The US SSN arrival path needs a custodian-attested protected epoch.

  The projection was therefore not regenerated for this interim commit. It still says `pending` for all six, which agrees with this record, so no site copy changes.

  The v1 path still cannot bind a v2 candidate. The final commit's protected disposition now reaches the projection through a separate reviewed v2 binding path (`benchmarks/evaluation/domains/pii/protected-support-bindings-v1.json`), described in [final-core-8b6a5fde.md](final-core-8b6a5fde.md#support-projection-and-site-copy).
- **Browser Wasm, Python, Rust and CLI output.** These surfaces are covered by #427 on the same source commit, not re-run here.

## Rerun on a new core commit

```sh
npm ci
npm run pii:beta11 -- --core-commit=<40-hex> --core-repo=<absolute path to a redact-secret clone> --role=interim|final
# First run: builds, then writes evidence/901/428/core-<sha12>/pii-beta11-freeze-v1.json and stops. Commit it.
npm run pii:beta11 -- --core-commit=<40-hex> --core-repo=<absolute path> --role=interim|final
# Second run (clean tree): verifies the freeze and writes the observation, operational, report and disposition files.
npm run pii:parity:measure -- --target=core-commit --core-commit=<40-hex> --core-repo=<path>   # #427 cross-surface-output gate
node --import tsx --test tests/pii-beta11.test.mjs
```

The harness builds `wasm:build`, `wasm:build:common` and any `wasm:build:*pii*` script the commit defines, and assigns each Wasm payload a role by name. If #937 ships PII as a separate npm package or entry point, review the build and installation steps in the freeze commit for that candidate. The installer takes core, node and wasm tarballs, so it fails closed if PII needs another package.
