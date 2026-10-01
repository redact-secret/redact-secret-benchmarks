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
| `population-separation` | One pooled denominator became one denominator per population; floors read the public snapshot alone. |
| `axis-vocabulary` | The snapshot names a case group by scenario, not by source context, and has no benign taxonomy, so axis counts are not the legacy fixture axes. |
| `methods-not-run` | The official configuration runs no metamorphic, mutation or differential method; those gates are unmeasured, never zero. |
| `policy-corpus-bounded` | The T3 route reads the bounded policy corpus alone, where the legacy path pooled every T3 fixture of the family. |
| `legacy-id-rekey` | Legacy fixture, ledger and disputed-property ids do not resolve to canonical ids until the re-key. |
| `twin-scope-vocabulary` | A twin is scoped by the product contract in the legacy lattice and by the case family in the evidence snapshot, so the twin can belong to another family and its flagged or co-detected verdict can differ. Inferred. |
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

Outcomes are joined case by case. A product population (regression, policy) joins by case id, which is the legacy
`category--fixture` slug. The public population has canonical ids, so it joins by content: the SHA-256 of the case bytes with
its expected ranges and fixture name, loosened one key at a time, and a pair is made only when the key is held by exactly one
case on each side. Content shared by several cases is counted as ambiguous and never guessed. This is a derived re-key; the
evidence release's own id map is not needed. It needs the evidence snapshot the public artifact was run on
(`--public-snapshot`), checked against the artifact's corpus digest.

Per case and scanner the compared value is the positive span outcomes, or for a control whether anything was observed, whether
it was flagged and whether it was co-detected. A pending case is pending on both sides.

## Status is compared explicitly

The new view reads no stable family while the legacy path reads many. The report does not hide this: each family's status is
compared, each reason the new path adds is attributed, and a counterfactual says how many legacy-stable families are held back
only by `methods.notRun`, by it and another cause, or by other causes alone. Whether a methods-enabled configuration, an axis
decision or a policy decision is needed before cutover is a recommendation the report states and does not apply.

## Not compared, and why

Listed in the report, never silent: legacy categories with no suite report (calibration-only), the review queue and ledger joins
(no methods ran, and legacy ids need the re-key), the internal populations (candidate regression, protected holdout) and a run
that is not a recorded canonical run of `benchmarks/official-runs.json`.

## Regenerating

```bash
# legacy oracle (the existing pipeline, unchanged)
npm run bench
npm run eval:classify                     # results-output/support-status.json

# new path: the canonical artifacts of the official-runs workflow
gh run download <run> -n official-run-public-evidence-snapshot -n official-run-regression-corpus -n official-run-policy-corpus -D <dir>
npm run qualification:view -- --artifacts <dir>

npm run qualification:parity -- --legacy-status results-output/support-status.json --legacy-results public/results \
  --view public/results/qualification-v1.json --artifacts <dir> \
  --public-snapshot <dir>/public-evidence-snapshot/evidence/credential-eval-corpus-snapshot.json [--strict]
```

The same inputs write the same bytes: no clock, host or path is in the report. The report names each compared artifact's
recorded run and says so when one is not a canonical run. Re-run it after a new official run or a repin; a different
configuration (for example one that runs the methods) is a different comparison, not a re-verification.

## Tests

`tests/qualification-parity.test.mjs` builds both sides synthetically and asserts the rules relative to what it built: the three
classes, exact reconciliation, the unmeasured-method rule, status attribution, the content join and its refusal to guess, the
twin pattern and its limits. No ledger value, family count or digest read from the committed tree is asserted, because a repin
re-keys them.
