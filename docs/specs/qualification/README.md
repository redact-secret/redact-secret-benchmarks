# Engine v1 qualification evidence

[engine-v1.json](engine-v1.json) is schema-validated aggregate evidence from all six methods and all three pinned scanners. It contains no holdout case rows.

- Engine 1.1.0 · accounting 1.1 · report schema 2
- Status: **`execution-qualified`**
- Run ID: 92964c1a-d023-4bd3-8165-c0f6803c1bcc
- Completed: 2026-09-26T20:45:44.342Z
- Scanners: redact-secret 0.1.0-beta.9 (the released lockfile package), gitleaks 8.30.1, trufflehog 3.97.4, the pins in `qualification/suite-v1.json`
- Source fingerprint: d3c904ae5482d0aa52076c0f3c8e01e358fe5c29d2a7c0b04e298d02657d071f (revision c3a3714, clean tree)
- Cases / variants: twin 698/1,396, benign 1,016/1,016, metamorphic 2,292/10,675, mutation 2,292/8,165, differential 2,990/2,990, holdout 12/12
- Every scanner completed and agreed across 2 replays; 0 generation errors
- `unresolvedGroups`: none
- Review queue: 5,965 entries, **0 `unknown`**, 12 open, 1,521 resolved, 4,432 not-assertable (`benchmarks/review-ledger.json`)
- Public holdout lifecycle controls: 12/12 assertions passed for each scanner
- Development findings: 12,820 failed assertions

Refreshed for the 0.1.0-beta.9 release after the suite and lockfile pins moved
from 0.1.0-beta.8. The publish workflow produces this same report on every
staging and production publish and ships it inside `evaluation-v1.json`; this
file is the checked-in reference copy `validate.yml` re-validates.

The history below describes the first engine v1.1 run (2026-09-19, beta.4).

Execution itself is unchanged from the v1.0 evidence this file replaces: all six
methods ran with all three pinned scanners. The prior run here was `incomplete`
because engine v1.1 counts an unreviewed disagreement as an unfinished measurement
([decision](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-19-tighten-evaluation-accounting-v1-1.md)), and
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

The checked-in `engine-v1.json` is frozen at the Beta.11 suite. CI validates it against the snapshot it was produced with, `npm run eval:validate -- docs/specs/qualification/engine-v1.json --suite=evidence/449/suite-v1.json`; without `--suite` the live `qualification/suite-v1.json` decides, which is how new evidence is checked.

See [reproduction and internal architecture](../evaluation-engine-v1.md) and [protected holdout operations](../../../holdout/README.md).
