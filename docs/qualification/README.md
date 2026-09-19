# Engine v1 qualification evidence

[engine-v1.json](engine-v1.json) is schema-validated aggregate evidence from all six methods and all three pinned scanners. It contains no holdout case rows.

- Engine 1.1.0 · accounting 1.1 · report schema 2
- Status: **`incomplete`**, reason `unreviewed-queue`
- Run ID: 04b656a9-a9b5-4c4f-807b-ea019c889ec1
- Completed: 2026-09-19T17:23:15.527Z
- Source fingerprint: b282d8e515fe95c567285bd0bef1f24686a40032146f322d83f5ed1807c29fe2 (revision 20e5eb1, clean tree)
- Cases / variants: 2,253 / 6,107 (twin 56/112, benign 206/206, metamorphic 641/3,047, mutation 641/2,033, differential 697/697, holdout 12/12)
- Every scanner completed and agreed across 2 replays; 0 generation errors; 0 `not-measured` assertions
- `unresolvedGroups`: none — every scored stratum resolves at 1.000 against the 0.9 floor
- Review queue: 1,615 entries, **1,615 `unknown`**, 0 open, 0 resolved
- Public holdout lifecycle controls: 12/12 assertions passed for each scanner
- Development findings: 3,783 failed assertions
- Unit tests: 187 passed; real-adapter integration tests: 7 passed; TypeScript, production build, fixture-storage, pin-manifest and evidence validation: passed

Execution itself is unchanged from the v1.0 evidence this file replaces: all six
methods ran with all three pinned scanners. The run is `incomplete` because
engine v1.1 counts an unreviewed disagreement as an unfinished measurement
([decision](../decisions/2026-09-19-tighten-evaluation-accounting-v1-1.md)), and
`benchmarks/review-ledger.json` ships empty — the engine never writes it. The
status becomes `execution-qualified` once every queue entry has a ledger row;
`open` rows are a legitimate standing state and do not block. Nobody should
bulk-mark entries to turn this green: that is the failure mode the ledger exists to
make visible.

The checked-in holdout is a public conformance corpus, not independently maintained protected detector evidence. No stable-support claim follows. GitHub prerequisite issues #1–#8 remain open in the recorded milestone snapshot; the formal milestone-closure gate was tested and correctly failed before consuming a holdout attempt. No prerequisite was silently removed from scope.

See [reproduction and internal architecture](../evaluation-engine-v1.md) and [protected holdout operations](../../holdout/README.md).
