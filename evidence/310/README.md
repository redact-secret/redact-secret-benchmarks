# Evidence: redact-secret#310 — Postman API keys, benchmark corpus extension

**Result:** 3/3 authored positives are leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6 predates the detector); gitleaks 8.30.1
and trufflehog 3.97.4 each match all 3 byte-exactly; trufflehog false-alarms
on 6 of the 9 negative twins (the separator and alphabet mutations its
looser `[A-Za-z0-9-]{59}` body accepts), gitleaks on none; 0 alarms on the
6 independent controls from any scanner.

This file records the benchmark side of
[redact-secret/redact-secret#310](https://github.com/redact-secret/redact-secret/issues/310),
per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; does not contain the detector. |
| `redact-secret` (detector landed) | `bf559d1018d24c9414542a4243fd33354747e503` (merge of PR #668) on `main`, unreleased at measurement time; registry pinned at `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `2c41ee27ce3584bde55b87c4f58eb300b3b4854a`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`83264205-335a-4b73-8f0e-1a21f412f854`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contract `postman-api-key` (T2, tool-corroborated:
`^PMAK-[0-9a-fA-F]{24}-[0-9a-fA-F]{34}$`, gitleaks's structured shape;
learning.postman.com documents only the `X-API-Key` header). 18
`detector-coverage` fixtures:

- 3 positives — `PMAK-` + 24 hex + `-` + 34 hex, bare / quoted /
  Unicode-prefix+CRLF;
- 9 negative twins — length (33-byte second segment), separator (a hex byte
  in place of the internal dash, still 59 bytes), alphabet (one non-hex
  byte in the second segment);
- 6 independent controls — `prefix-only`, `short-body`, `mask`,
  `reference` (`POSTMAN_API_KEY=${POSTMAN_API_KEY}`), `label-prose`,
  `public-id` (a collection UID).

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 positives | secret span | MISS ×3 | EXACT ×3 | EXACT ×3 |
| 3 length twins (58-byte body) | silence | silent | silent | silent |
| 3 separator twins (no dash at offset 24) | silence | silent | silent | FLAGGED ×3 |
| 3 alphabet twins (a `g` in segment 2) | silence | silent | silent | FLAGGED ×3 |
| 6 controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 3 false negatives — a coverage gap of the
  pinned package, recorded as 6 `open`
  `differential-coverage-gap/postman-api-key` ledger rows (one per peer),
  each noting that PR #668 closed it on `main`; open until a release
  carrying the detector is pinned. No `known-gaps.json` record (the product
  issue exists and is closed).
- **trufflehog 3.97.4:** 6 false alarms on the separator and alphabet twins
  — its `postman` detector matches `PMAK-[a-zA-Z-0-9]{59}`, a superset that
  asserts no internal hex-dash-hex structure. The contract deliberately
  freezes gitleaks's narrower structured shape, so these twins measure that
  precision difference; recorded as resolved
  `peer-only/trufflehog/range-matches-corpus` rows (redact-secret's silence
  matches the must-not-flag expectation).
- **gitleaks 8.30.1:** byte-exact on every positive and silent on every twin
  and control — the pinned rule this contract mirrors.
- 15 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check
npm run eval -- --method=differential,benign,twin --detector=postman-api-key
```
