# Owner report: acceptance package for snapshot-2026.10.05.2 (PREPARED, NOT APPLIED)

**Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기).** 96 maintainer-only fixtures, 0 independently reviewed, unchanged from snapshot-2026.10.05. Owner acceptance would not be an independent review.

Nothing in this package is applied. The public numbers stay on the accepted `snapshot-2026.10.05` run (37296823599). The registry pins, the runs, the authority file, the ledger and `benchmarks/evidence-adoption.json` `candidate` (the accepted .05 adoption) are untouched on `develop`. No deployment receipt exists for this candidate and no `go-production` was run. Fields the owner sets are `OWNER-TO-SET`.

## What would be accepted

1. **The evidence population** `snapshot-2026.10.05.2` (tag, manifest `sha256:c4133f8f...a88`, corpus `sha256:c114af16...c3c`, source `6dd2ae3c`; 6,524 fixtures, 6,519 exported; **0 added, 0 removed, 11 changed**) on **credential-eval v0.1.0-alpha.5** with the **published `@redact-secret/core` 0.1.0-beta.13**: the engine and the product are the ones already accepted, so the corpus is the only change. Replay: CI run 37332934881 (control, plain and methods, two engine runs with equal semantic digests), archives `official-runs-37332934881` (replay copy) and `official-runs-registry-37332934881` (registry format, verified byte for byte against the patched registry).
2. **The 11 changed cases** are the Polar negatives (6 `polar:api-credential`, 5 `polar:organization-access-token`) that credential-evidence ADR 0022 / #226 moved from T3 / project-policy to **T0 / unresolved**: the maintainer asserts nothing for a glued token boundary or for whether a `polar_ci_` client id or a `polar_cl_` checkout-link secret is confidential. A T0 case is pending, in no denominator and never a zero detection. `maintainer-only`, not reviewed.
3. **The unpublished core build 422e43e3** (PRs #1202, #1204, #1206) is NOT part of this acceptance. It is a release-decision input, below.

## Effect of acceptance (candidate view, run 37332934881)

Engine effect: none (same engine). Corpus effect, every difference attributed, **0 unexplained** (`snapshot-2026.10.05.2.md`, `.comparison.json`; contrast by semantic id with the accepted run, 305 differences, 305 explained, 0 regressions: `snapshot-2026.10.05.2.contrast.md`):

| | accepted (.05) | candidate (.05.2) |
| --- | --- | --- |
| credential families | 123 stable, 11 provisional, 1 pending | **121 stable, 13 provisional**, 1 pending |
| support matrix entries | 136 stable, 15 provisional, 5 pending, 17 unsupported | 134 stable, 17 provisional, 5 pending, 17 unsupported |
| stable by route | documented 87, empirical 36 | documented 85, empirical 36 |

Two families move from stable to provisional, both because their scored evidence shrinks, not because a product result changed: `polar-api-credential` (benign cases 9 to 6, twin pairs 7 to 4; floors `minimumBenignCases` 8 and `minimumTwinPairs` 5) and `polar-token` (twin pairs 8 to 4; floor 5). The status returns when scored evidence meets the floors again, which is the evidence owner's change; this repository does not restore it by dropping a floor or counting an unscored case as a miss. The 11 cases read `pending` for all five scanners (control clear or flagged before). The other 6,508 cases and the product-owned populations are unchanged, and the owner's 394 ledger settlements hold on this run's occurrence ids unchanged (every id is the same).

## The unpublished core candidate on this evidence (not part of the acceptance)

`core-main-422e43e3` (core PR #1206 on top of #1202 and #1204), same engine and peers, measured on the old and the new evidence, the 2x2 in `product-core-main-422e43e3/snapshot-2026.10.05.2/two-by-two.md`: **4 fixed** (terraform marker, exa placeholder, documented-template PEM, amqp), **2 improved** by #1206 (Compose `${NAME:?message}` no longer reads the message as a value; a value equal to its own name no longer reads as a secret: the scored outcome was already a pass, the unexpected `warn` and the 21 bytes of collateral are gone), **0 regressed**, peers identical, interaction 0, 0 unexplained. Candidate runs 37333039985 (accepted evidence, cell B) and 37338401211 (new evidence, cell D); exploratory and internal.

## Decisions the owner takes

| Decision | Status |
| --- | --- |
| Accept `snapshot-2026.10.05.2` (the 2 Polar families become provisional) or keep `.05` public | open |
| Core release carrying #1202, #1204 and #1206, then re-measure the published build | open (product) |
| Credential-evidence: re-assert the Polar negatives so the two families meet the floors again | open (evidence owners) |
| Ledger: 63 proposals stay unresolved (59 without a settled counterpart, 4 observation differences); the 394 owner settlements are carried | decided earlier; nothing new applied |
| The 4 scope statements of #1206 (`scanners/product-scope.json`) | registered as the owner's decision (this PR) |

## Authority values (set by the owner; the patch does not touch the authority)

`new.release` `@redact-secret/core@0.1.0-beta.13`; `new.policyRevision` `rs-policy-1:sha256:ce414548ec792d90e73ff4bc3aae58472ba930f0b33b9017f896271fe2dd4d00`; `new.semanticDigests` policy-corpus `sha256:9a6576c9...9f66f9e`, public-evidence-snapshot `sha256:e539312a...893417e`, public-evidence-snapshot+methods `sha256:b6b0e83a...9024d5`, regression-corpus `sha256:933286b1...fa1728` (full values in `evidenceCandidate.acceptance.authorityValues`); `new.parityReport` unchanged path (regenerated in the patch: 42,611 values, 0 unexplained); `new.decision` the draft decision.

## Apply (when decided)

```bash
git apply docs/generated/evidence-adoption/snapshot-2026.10.05.2.acceptance.patch   # sha256 in the .sha256 file; applies on the merge commit of this PR
# set acceptedBy/acceptedOn in the record and the authority, renew the authority with the values above, write the decision, then:
npm run official-runs:check -- --bindings && npm run qualification-inputs:check && npm run adoption:check && npm run authority:check && npm run decisions:validate
GITHUB_REPOSITORY=redact-secret/redact-secret-benchmarks node scripts/official-run-archive.mjs fetch --out <dir> && node scripts/official-run-archive.mjs verify --dir <dir>
```

The patch also changes the three derived overlays; prove them with the `--check` commands in `evidenceCandidate.acceptance.derivedInputs`. `adoption:check` and `authority:check` are red until the owner fills the fields and renews the authority, by design.
