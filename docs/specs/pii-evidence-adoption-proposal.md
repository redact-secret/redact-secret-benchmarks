# Pending PII evidence adoption proposal

This is a helper-generated, scanner-free proposal for
`public-pii-phi/2026-10-08/ee61c7afc32d`, not an active adoption or product claim.
The proposed tag is not published. The source snapshot is pinned to committed
evidence revision `d6825d5985c7fbc83d54e49f5c0b5426e5d852a2` and exact digests.

The reviewed consumer was built from merged `pii-eval` revision
`74b35e4aeffeef9c8679f3d7809cfe4415a0bc42` with the locked command recorded in
`benchmarks/pii-evidence/candidate-runtimes.json`. That registry binds its source
archive, source files, toolchain, mapping revision and local binary receipt.
The historical Linux execution engine and its pending Linux consumer receipt
remain unchanged; this Darwin build is not a new canonical execution receipt.

The preflight verified and imported all 118 evidence Cases and 285 fixtures.
Mapping revision 2 produces population version 2: 123 corpus Cases, 198 located
and 87 range-less occurrences. Scoped global/US/GB birth-date families share one
evidence kind. UK NINO maps to the ISO GB national insurance family. The prior
released snapshot retains mapping revision 1 and its exact historical digests.

`preflight.json` records the actual import counts, all five losses, family
coverage and output digests. `candidate.json`, `summary.md` and
`acceptance-plan.json` were produced by the preparation helper using the initial
preflight as the previous population. The test suite validates the preflight and
recomputes the proposal exactly. The initial active snapshot/consumer pins, four
existing population pins, PII authority and product criteria are untouched.

Reproduce in a checkout containing this reviewed registry, with the exact clean
consumer source and local binary:

```sh
node scripts/preflight-pii-evidence.mjs --source-dir <pii-eval> --consumer-bin <exact-binary> --snapshot-dir <candidate-dir> --candidate-snapshot-pin benchmarks/inputs/pii-evidence-snapshot-v2-candidate/snapshot-pin.json --candidate-consumer-pin benchmarks/inputs/pii-evidence-snapshot-v2-candidate/consumer-pin.json --out <new-preflight.json>
node scripts/prepare-pii-evidence-adoption.mjs --preflight <new-preflight.json> --previous benchmarks/pii-evidence/preflight.json --out-dir results-output/pii-evidence-adoption/<new-name>
```

The proposal has zero scanner executions and no owner acceptance. Fresh
canonical measurement needs a separately authorized Linux build/execution and
cost decision. Active adoption also needs explicit maintainer acceptance.
Preparation supplies neither and cannot change product authority or support.

Typed candidate inputs are in `benchmarks/inputs/pii-evidence-snapshot-v2-candidate/`. These records are proposals only; they do not change active pins, owner acceptance or either authority.
