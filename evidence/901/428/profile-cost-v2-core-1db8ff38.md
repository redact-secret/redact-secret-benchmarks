# #428 official profile-cost v2 result for core `1db8ff38`

> **Superseded** for the release decision by [`final-core-8f97f14d.md`](final-core-8f97f14d.md): the Beta.11 candidate moved to core `8f97f14d` (redact-secret #991 and #992). This record stays as history.

**All six PII families stay `pending`.** The official `pii-profile-cost-v2` workflow now has a complete result for this candidate, so `profile-cost` is no longer `unresolved`. It is `not-met`. The package-budget overrun is accepted ([`package-budget-acceptance-core-1db8ff38.md`](package-budget-acceptance-core-1db8ff38.md)), so `runtime-and-package-cost` is `met`. The protected partition is unspent and is not eligible.

This record adds files next to [`final-core-1db8ff38.md`](final-core-1db8ff38.md) and edits no earlier evidence except the regenerated report and disposition, which are re-derived byte for byte by `tests/pii-beta11.test.mjs`. It makes no support claim. Mode: candidate build (qualified product run 36480272622), Linux x86_64 GitHub-hosted runner, not the published package.

## Dispatch

- Ref `workbench/428-448-accept-package-budget`, head `687b763d5389c25bb6cc982ba24762072be03b90`, plan commitment `cea9ad84...2740e`. `benchmarkBaseCommit` was re-pointed from the pre-cherry-pick `5a5d03b6` to `956e5502` on the merged `develop` line. No workflow file was edited.
- Runs ([`pii-profile-cost-v2-runs.json`](core-1db8ff38b16e/pii-profile-cost-v2-runs.json)): A/A 36514261465, 36514268541, 36515595459; freeze 36518165455; candidate 36518206043; size 36518167672. All succeeded on that head.
- A first dispatch on head `8757fdd5` failed at the end of the candidate phase: the v2 report validator still listed the v1 eight artifacts, and the producer binds ten (the two `_pii` Wasm builds). The validator was fixed, the plan re-frozen and the whole protocol re-run. See `docs/decisions/2026-09-29-fix-pii-profile-cost-v2-candidate-artifact-roster.md`. Nothing from the first attempt is reused.
- Peers: the workflow provisions pinned trufflehog 3.97.4 itself before the candidate phase. The local rescore reads no peer scanner.

## Result

| Gate | Status | Why |
| --- | --- | --- |
| runtime-and-package-cost | met | node +40,040 B and wasm +311,457 B over 32,768 B are accepted; core within; runtime medians pass |
| size-regression-budget | met | every #143 row within budget or accepted |
| profile-cost | **not-met** | runtime/memory verdict `regression`, and 38 open size rows (below) |
| protected-partition | not-run | public gate failed; 0/1 spent |

Runtime and memory (activation cost, PII on against PII off in the same artifact, thresholds frozen from the three A/A runs): 162 of 640 metric evaluations regress, 342 within budget, 136 not applicable, 0 invalid. By surface: rust-native 32, node-native 32, node-wasm 33, chromium-wasm 41, python 16, cli 8. By metric: whole-input 80, incremental 65, initialize 13, node retained RSS 4. The largest is `rust-native/full/global/validator-heavy` whole input, median ratio 18.1.

Size against the pre-PII commit `f26dee26`: 41 regressing rows, 3 covered by the #143 ledger (`size/wasm/full/gzip`, `size/wasm/common/gzip`, `size/npm/wasm/packed`), 38 open. The open rows are the CLI binaries, node addons, Python wheels and sdist, the crate, the default Wasm raw and brotli rows, `npmPackages` core/node/wasm unpacked and node packed (+197,541 B on this Linux pack), and the four browser-bundle rows. The ledger has no row for any of them at this candidate, and its trigger ids cannot express the PII activation-cost cells. The `_pii` Wasm builds are reported without a frozen budget (807,866 and 627,322 B raw).

Nothing was waived or changed to get this result. Accepting the activation-cost regressions or the open size rows is a separate maintainer decision that this record does not make.

## Protected partition

Not eligible: the public gate `profile-cost` fails, so all six epochs stay unspent (0/1). If it later passes, the custodian step is an isolated agent session that registers at least 20 cases per family (120 total for the global families plus a new custodian-held US SSN epoch), per `docs/specs/blind-evaluation.md` and `pii-populations.md`. The orchestrator never sees the fixtures, and a new candidate needs a new freeze and epoch.
