# Owner report: acceptance package for snapshot-2026.10.04.4 (PREPARED, NOT APPLIED)

**Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기).** 96 maintainer-only fixtures, 0 independently reviewed, unchanged from snapshot-2026.10.04.3. Owner acceptance would not be an independent review.

Nothing in this package is applied. The authority file, the registry pins, the runs, the ledger and `benchmarks/evidence-adoption.json` `candidate` (the accepted .04.3 adoption) are untouched on `develop`. The owner's holds stand: the engine candidate (credential-eval alpha.5 with the published `@redact-secret/core` 0.1.0-beta.13) stays unaccepted until the core release, and the ledger proposals stay unapplied. Fields the owner sets are `OWNER-TO-SET` in the patch.

## What would be accepted

1. **The evidence population** `snapshot-2026.10.04.4` (tag, manifest `sha256:f75a46f8...5f1f`, corpus `sha256:9870d50f...d57c`; +70 added, 5 changed, 0 removed; 6,519 cases) on **credential-eval v0.1.0-alpha.5** with the **published beta.13**. Replay: CI run 37241828378 (control), archive `official-runs-37241828378` (replay copy) and `official-runs-registry-37241828378` (registry format, verified byte for byte against the patched registry).
2. **The evidence of the unpublished core build 1e45cecf** is NOT part of that acceptance. It is a release-decision input: on both corpora it fixes 4 cases (terraform marker, exa placeholder, documented-template PEM, amqp), regresses 0, changes no peer and has 0 unexplained and 0 interaction on the 6,444 common cases (2x2: `product-core-main-1e45cecf/snapshot-2026.10.04.4/two-by-two.md`; candidate run 37253769074, archive `candidate-runs-37253769074`).

## Effect of acceptance (candidate view, run 37241828378)

Engine effect (alpha.4 to alpha.5, previous corpus fixed): 0 families and 0 public cases differ. Corpus effect: 1 family (aws-secret-access-key, 1 support matrix entry) moves from stable to provisional (115 stable, 19 provisional, 1 pending); the reason is the 6 unresolved differential occurrences of added cases plus 14 metamorphic and 2 mutation reference failures on added cases, none from common cases. Report: `snapshot-2026.10.04.4.md`, data `.comparison.json`, 0 unexplained.

## Decisions the owner takes

| Decision | Status |
| --- | --- |
| Accept the engine candidate alpha.5 + beta.13 on .04.4, or keep holding | HELD by the owner |
| Publish a core release carrying PRs #1202 and #1204 | open |
| The 13 provisional product-scope statements (`scanners/product-scope.json`, #622) | open |
| Ledger proposals of the triage | HELD, none applied |
| Evidence corrections (8 cases, `snapshot-2026.10.04.3.expectation-corrections.md`; credential-evidence#221) | for the evidence owners |
| Triage of the .04.4 added cases: 57 root causes are open (core #1203 classified the .04.3 roots only) | needs a core classification |
| Whether the legacy oracle exit needs a parity report at beta.13 (the patch does not regenerate it) | open |

## Apply (when decided)

```bash
git apply docs/generated/evidence-adoption/snapshot-2026.10.04.4.acceptance.patch   # sha256 in the .sha256 file
# set the OWNER-TO-SET fields and the ADR status, then:
npm run official-runs:check && npm run qualification-inputs:check && npm run adoption:check && npm run authority:check
node scripts/official-run-archive.mjs fetch --out <dir> && node scripts/official-run-archive.mjs verify --dir <dir>
```
The patch also changes the overlays (axis overlay, twin-scope map, ledger re-key); prove them with the three `--check` commands in `evidenceCandidate.acceptance.derivedInputs`. `authority:check` is red until the owner renews the authority file, by design.
