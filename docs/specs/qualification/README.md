# Engine v1 qualification evidence

[engine-v1.json](engine-v1.json) is schema-validated aggregate evidence from all six methods and all three pinned scanners. It contains no holdout case rows.

- Engine 1.1.0 · accounting 1.1 · report schema 2
- Status: **`execution-qualified`**
- Run ID: 7a6ce4a5-9736-40a8-ba40-cd8988c75d1e
- Completed: 2026-09-19T17:47:07.313Z
- Source fingerprint: 421ea59224d25f443661f99cbbb8a697fee42e54421af488e633da0a92df481f (revision c0eba10, clean tree)
- Cases / variants: 2,253 / 6,107 (twin 56/112, benign 206/206, metamorphic 641/3,047, mutation 641/2,033, differential 697/697, holdout 12/12)
- Every scanner completed and agreed across 2 replays; 0 generation errors; 0 `not-measured` assertions
- `unresolvedGroups`: none — every scored stratum resolves at 1.000 against the 0.9 floor
- Review queue: 1,615 entries, **0 `unknown`**, 1,233 open, 382 resolved (`benchmarks/review-ledger.json`, triaged in [#28](https://github.com/redact-secret/redact-secret-benchmarks/issues/28))
- Public holdout lifecycle controls: 12/12 assertions passed for each scanner
- Development findings: 3,783 failed assertions
- Unit tests: 187 passed; real-adapter integration tests: 7 passed; TypeScript, production build, fixture-storage, pin-manifest and evidence validation: passed

Execution itself is unchanged from the v1.0 evidence this file replaces: all six
methods ran with all three pinned scanners. The prior run here was `incomplete`
because engine v1.1 counts an unreviewed disagreement as an unfinished measurement
([decision](../../decisions/2026-09-19-tighten-evaluation-accounting-v1-1.md)), and
`benchmarks/review-ledger.json` shipped empty — the engine never writes it. Every
one of the 1,615 queue entries now carries a ledger row: 382 were resolved because
the authored corpus expectation was already correct and the disagreement was fully
explained by a peer's narrower or unvalidated pattern coverage (never by converting
a disagreement into new ground truth); the remaining 1,233 stay `open` — the large
majority (1,120) because a mutation operator broke the fixture's lexical contract
and no negative truth is inferable from scanner output by construction, the rest
because the underlying fixture is still tier `T0`/pending, because two entries
disagree only on classification granularity the corpus never asserted, or because
they are confirmed product-level findings (a length-boundary false positive on
several token families' negative twins) routed toward `promote-finding` rather than
resolved here. `open` rows are a legitimate standing state and do not block.
Nobody should bulk-mark entries to turn this green: that is the failure mode the
ledger exists to make visible.

The checked-in holdout is a public conformance corpus, not independently maintained protected detector evidence. No stable-support claim follows. GitHub prerequisite issues #1–#8 remain open in the recorded milestone snapshot; the formal milestone-closure gate was tested and correctly failed before consuming a holdout attempt. No prerequisite was silently removed from scope.

See [reproduction and internal architecture](../evaluation-engine-v1.md) and [protected holdout operations](../../../holdout/README.md).
