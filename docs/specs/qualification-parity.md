# Old-versus-new qualification comparison

Issue: [#607](https://github.com/redact-secret/redact-secret-benchmarks/issues/607), part of epic
[#602](https://github.com/redact-secret/redact-secret-benchmarks/issues/602).
Decision: [Compare the legacy and the new qualification by attributed difference](../decisions/2026-10-01-compare-the-legacy-and-new-qualification-by-attributed-difference.md).
Inputs: [official-runs.md](official-runs.md), [qualification-adapter.md](qualification-adapter.md).
Output: `docs/generated/qualification-parity.json` and `.md`. Cutover criteria: [qualification-cutover.md](qualification-cutover.md).

This repository measures and records. The comparison states which numbers agree, which differ, and which structural change
causes each difference. It asserts nothing about the product, changes no status, and applies none of its recommendations.

## The goal is not parity

The two paths are different architectures: the legacy path pools one development partition and reads one denominator per
family; the new path measures each population separately with credential-eval and qualifies from the artifacts. Making their
numbers identical would erase the change being evaluated. The comparison asks two questions instead: do the values that
SHOULD be equal agree, and is every other difference caused by a named structural change.

## Three classes

Every compared value is in exactly one.

1. **Must-equal.** Values that should agree under the same release and peer identities. Equal is the result and says nothing
   further. Unequal is a difference to attribute. Includes the product release and each peer version; family membership and
   taxonomy families; the product-owned facts of a family (detectors, contract tier, provider source, empirical observation
   and corroboration records, uncertainty, supported contexts, evidence basis and tier); every scanner's outcome on a case
   present in both paths; known-gap record ids, kinds, statuses and fixture lists.
2. **Expected-structural.** A difference whose cause is one of the structural changes below, recognised by a rule that checks
   the evidence for it in the data of both sides. A cause is never assumed: a count residual is explained only when the
   amounts the matched cases show sum to it exactly, and a status that drops is explained only when every reason the new path
   adds has a cause.
3. **Unexplained.** Any difference no rule attributes. A failure to investigate, never accepted silently. `--strict` makes the
   script exit 1 on one.

A cause carries a confirmation: `confirmed` when the rule recognises it from data both sides hold, `inferred` when the data
narrows the pattern but the root cause has not been confirmed with the owner (listed in the report).

## Structural causes

| Cause | Structural change |
| --- | --- |
| `population-separation` | One pooled denominator became one denominator per population; floor COUNTS read the public snapshot alone, while axis floors read the union of axis labels across populations (#641). |
| `axis-vocabulary` | The snapshot names a case group by scenario, not by source context, and has no benign taxonomy, so axis counts are not the legacy fixture axes. Applies to a view built without the product axis overlay; with it, an axis difference is attributed to the cause its axis ids show (`population-separation`, `canonical-evidence-membership`, `pending-not-scored` or `fixture-attribution`) and is otherwise unexplained. |
| `methods-not-run` | The view has no methods run, so the metamorphic, mutation and differential gates are unmeasured, never zero. |
| `review-occurrence-identity` | The methods run's review queue is keyed by canonical occurrence ids and covers every pinned peer, including peers the legacy run never scanned; the review ledger is keyed by legacy ids. Recognised only when the family has differential occurrences and none of their canonical ids is in the ledger or its generated mapping; with the mapping (#638) it does not arise for the peers both paths scanned. |
| `policy-corpus-bounded` | The T3 route reads the bounded policy corpus alone, where the legacy path pooled every T3 fixture of the family. |
| `legacy-id-rekey` | Legacy fixture, ledger and disputed-property ids do not resolve to canonical ids until the re-key. |
| `twin-scope-vocabulary` | A twin is scoped by the product contract in the legacy lattice and by the case family in the evidence snapshot, so the twin can belong to another family and its flagged or co-detected verdict can differ. Confirmed (#641): the project twin-scope corpus carries the same bytes with the parent's family and the engine reads them as co-detected, as the legacy path did; the public engine verdict on the unscoped copy remains a reported difference and the twin gate reads the project case. |
| `pending-not-scored` | A T0 non-twin fixture has no scored outcome in credential-eval and is excluded from floor counts; the legacy path counted it. A T0 twin is not counted by either side (the legacy lattice drops it). |
| `canonical-evidence-membership` | The snapshot holds fixtures with no legacy counterpart (an intended canonical-evidence change). |
| `fixture-attribution` | The legacy path attributed a fixture by its declared contract and targets; the adapter by targets, family or taxonomy family. Inferred. |

A T2 to project-policy reclassification alone is never a cause (#607): the route is read from the product overlays, not from
the evidence class a case carries.

## What is compared

| Area | Legacy side | New side |
| --- | --- | --- |
| identity | `public/results/run.json` scanner versions | `scanners` of each artifact in the view |
| membership | `support-status.json` families and taxonomy families | view `families[]` |
| status | `support-status.json` status, reasons, profile | view `families[].status` |
| evidence | `families[].evidence` | view `families[].evidence` and per-population counts |
| outcomes | per-suite `rows` of `npm run bench` | per-case results of each RunArtifact |
| known gaps | `benchmarks/known-gaps.json` and the legacy run | view `knownGaps[]` |
| support matrix | `buildSupportMatrix` over the legacy support status (what `npm run eval:matrix` writes) | view `supportMatrix` |
| overview numbers | the legacy support status `familyCount`, `distribution` and `stableDistribution` | view `families[]`, `distribution`, `stableDistribution` (what the qualification overview page shows) |
| review queue and ledger | the legacy review ledger, through the generated mapping (`public-review-ledger-map.json`) | the methods run's differential review queue |

Outcomes are joined case by case. A product population (regression, policy) joins by case id, which is the legacy
`category--fixture` slug, except the project twin-scope copies (#641): they have no legacy fixture of their own, so each is compared with the development fixture it copies (`<copyOf>--<fixture>`) and none counts in a legacy count of the regression population. The public population has canonical ids, so it joins by content: the SHA-256 of the case bytes with
its expected ranges and fixture name, loosened one key at a time, and a pair is made only when the key is held by exactly one
case on each side. Content shared by several cases is counted as ambiguous and never guessed. This is a derived re-key; the
evidence release's own id map is not needed. It needs the evidence snapshot the public artifact was run on
(`--public-snapshot`), checked against the artifact's corpus digest.

Per case and scanner the compared value is the positive span outcomes, or for a control whether anything was observed, whether
it was flagged and whether it was co-detected. A pending case is pending on both sides.

## The support matrix

The matrix is one entry per taxonomy family (provider x credential family), each carrying the status and evidence of the detector family that decided it. The legacy side is `buildSupportMatrix` over the legacy support status, the function `npm run eval:matrix` runs. The new side is the view's `supportMatrix`, a first-class field of the view (docs/specs/qualification-adapter.md), so a consumer reads it without recomputing it. Every leaf of every entry is compared, and the status counts and the stable counts by route.

An entry projects the evidence of its detector family, so the comparison attributes a matrix difference only through the difference the family comparison found in that evidence: a fixture-profile figure through the count difference of the same name, a twin or critical-item figure through its evidence field, the policy aggregate through its own, a fixture-profile cell through the counts and axes it is built from, a status through the status comparison. A difference whose evidence field shows none is unexplained, and so is a product-owned fact (provider, name, corroborating scanners, provider source, supported contexts) that differs. A reason differs in the codes the new path adds, which the status comparison attributes; in a policy gate code only the legacy side names (a gate the pooled T3 fixtures failed and the bounded policy corpus does not, shown by the policy aggregate differing); or in the figures of a code both name, which follow a count difference. Key order is not a value. The status counts are sums of entry statuses: a difference is explained only when the attributed status changes of the entries add up to it exactly.

The same rule compares the page-level numbers of the qualification overview (the family count, the status counts and the stable counts by route) and, per peer, the review queue against the legacy ledger: the occurrences of the methods run and how many a decision settles. A peer the legacy run never scanned has no legacy entry, which is `review-occurrence-identity`; the mapped peers must be equal.

## Status is compared explicitly

The new view reads no stable family while the legacy path reads many. The report does not hide this: each family's status is
compared, each reason the new path adds is attributed, and the report lists the legacy-stable families the new path does not read
stable by the cause set that holds each back (`heldBy`), and flags a reason no rule recognises as unattributed. Whether a
ledger re-key, a peer-set decision or a policy decision is needed before cutover is a recommendation the report states and does not
apply. The review re-key and the differential peer scope are decided and applied (#638); the report shows their effect (occurrences per peer, how many a
legacy decision settles).

An axis difference is attributed only by comparing the axis ids of both sides when the view was built with the axis overlay: an id
only the new side names needs the `canonical-evidence-membership` or `fixture-attribution` adjustment as evidence, and an id only the
legacy side names needs regression or policy cases of the family (`population-separation`), a pending fixture (`pending-not-scored`)
or an attribution move. A review-occurrence difference is attributed only when the methods run holds differential occurrences of the
family and none of their ids is in the ledger.

## Not compared, and why

Listed in the report, never silent: a rendered page against a rendered page (no automated page-data diff exists, and the legacy pages are not a data source of this repository; the numbers they display are compared at their source), the per-population per-scanner counts of a family page (sums of the per-case outcomes compared one to one; the legacy path has no per-population denominator), legacy categories with no suite report (calibration-only), the legacy mutation review entries (the canonical review queue holds
differential occurrences only) and the review occurrences outside the mapping (compared per peer above; the peers the legacy run never scanned have no legacy entry), the internal populations (candidate regression, protected holdout) and a run
that is not a recorded canonical run of `benchmarks/official-runs.json`.

## Regenerating

```bash
# legacy oracle (the existing pipeline, unchanged)
npm run bench
npm run eval:classify                     # results-output/support-status.json

# new path: the canonical artifacts of the official-runs workflow
gh run download <run> -n official-run-public-evidence-snapshot -n official-run-regression-corpus -n official-run-policy-corpus -D <dir>
npm run qualification:view -- --artifacts <dir>   # <dir>/public-evidence-snapshot/methods/artifact.json is the methods run

npm run qualification:parity -- --legacy-status results-output/support-status.json --legacy-results public/results \
  --view public/results/qualification-v1.json --artifacts <dir> \
  --public-snapshot <dir>/public-evidence-snapshot/evidence/credential-eval-corpus-snapshot.json [--strict]
```

The same inputs write the same bytes: no clock, host or path is in the report. The report reads the view's counts, families and per-population artifact identities; the per-case rows the view
gained for #606 (`populations[].cases`) are not read, and regenerating the report from the same canonical artifacts after they were added reproduced it byte for byte. The report names each compared artifact's
recorded run and says so when one is not a canonical run. Re-run it after a new official run or a repin; a different
configuration (for example one that runs the methods) is a different comparison, not a re-verification.

## Tests

`tests/qualification-parity.test.mjs` builds both sides synthetically and asserts the rules relative to what it built: the three
classes, exact reconciliation, the unmeasured-method rule, status attribution, the content join and its refusal to guess, the
twin pattern and its limits, the matrix attribution through the evidence it projects, the sums of the status counts and the review peers. `tests/qualification-adapter.test.mjs` builds the view's `supportMatrix` from synthetic inputs. No ledger value, family count or digest read from the committed tree is asserted, because a repin
re-keys them.
