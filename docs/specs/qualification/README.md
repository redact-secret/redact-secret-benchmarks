# Engine v1 qualification evidence

[engine-v1.json](engine-v1.json) is schema-validated aggregate evidence from all six methods and all three pinned scanners. It contains no holdout case rows.

- Engine 1.1.0 · accounting 1.1 · report schema 2
- Status: **`execution-qualified`**
- Run ID: 28ca6c2b-f763-4384-8862-5a1a322f3368
- Completed: 2026-09-24T21:23:09.244Z
- Scanners: redact-secret 0.1.0-beta.7 (the released lockfile package), gitleaks 8.30.1, trufflehog 3.97.4, the pins in `qualification/suite-v1.json`
- Source fingerprint: 9c39720b0cc3031c85ea7dbe8146e6294b6dc8b33f7f3898a644caa0d01cda0e (revision fcc12a4, clean tree)
- Cases / variants: twin 638/1,276, benign 944/944, metamorphic 2,102/9,858, mutation 2,102/7,395, differential 2,740/2,740, holdout 12/12
- Every scanner completed and agreed across 2 replays; 0 generation errors
- `unresolvedGroups`: none
- Review queue: 5,430 entries, **0 `unknown`**, 220 open, 1,238 resolved, 3,972 not-assertable (`benchmarks/review-ledger.json`)
- Public holdout lifecycle controls: 12/12 assertions passed for each scanner
- Development findings: 13,028 failed assertions

Regenerated for #213, when the suite's redact-secret pin moved from 0.1.0-beta.4
to the lockfile's 0.1.0-beta.7 (a pin `eval:qualify` enforces, so the stale pin
had stopped the site from publishing any qualification run). The publish
workflow now produces this same report on every staging and production publish
and ships it inside `evaluation-v1.json`; this file is the checked-in reference
copy `validate.yml` re-validates.

The history below describes the first engine v1.1 run (2026-09-19, beta.4).

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
