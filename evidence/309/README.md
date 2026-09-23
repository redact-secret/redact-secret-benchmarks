# Evidence: redact-secret#309 — Confluent Cloud API secrets, benchmark corpus extension

**Result:** 3/3 `cflt`-prefixed positives and 3/3 legacy keyword-context
positives are leaked by the pinned published package (`@redact-secret/core`
0.1.0-beta.6 predates both detectors) and by both pinned peers (gitleaks
8.30.1, trufflehog 3.97.4: 0/6 each); 1 false alarm — gitleaks flags the
documented-public API key ID control; 0 alarms on the other 19 controls.

This file records the benchmark side of
[redact-secret/redact-secret#309](https://github.com/redact-secret/redact-secret/issues/309).
That issue's last checklist item was ticked by an automated reconciliation
that pointed at product-repo files (`docs/coverage/coverage-report.md`,
`detector-inventory.json`); no corpus, assignment or comparison existed in
this repository before this change. Format per
[`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; contains neither detector. |
| `redact-secret` (detectors landed) | `10e0bb25b668d3c10c3534fc3819d9a49d5fc989` (merge of PR #667) on `main`, unreleased at measurement time; registry pinned at `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `0c0825a9d70f64b3bccaac89472798ea3abd6271`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`463c6814-2cdd-4e39-8761-0c94e8a5e09e`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contracts in `benchmarks/lib/assessment.ts`: `confluent-cloud-api-secret`
(T1, provider-documented on docs.confluent.io: `^cflt[A-Za-z0-9+/]{60}$`) and
`confluent-cloud-api-secret-legacy` (T2 corroboration, no value grammar,
scored as policy beside a same-line `confluent` keyword, like
`twilio-auth-token`). 26 `detector-coverage` fixtures:

- prefixed: 3 positives (`cflt` + 60 base64 × bare / quoted / Unicode+CRLF),
  6 twins (length 63; prefix `cflx`), 6 controls (`prefix-only`,
  `short-body`, `mask`, `reference`, `label-prose`, `public-id` — the API key
  ID `ABCD1234567890AB` docs.confluent.io calls "not considered secret
  information", plus a cluster id);
- legacy: 3 positives (`confluent ` + bare 64-byte base64 body), 3 twins
  (length 63), 5 controls (`missing-keyword`, `short-token`, `mask`,
  `reference`, `label-prose`).

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 prefixed positives | secret span | MISS ×3 | MISS ×3 | MISS ×3 |
| 3 legacy positives (policy) | secret span | MISS ×3 | MISS ×3 | MISS ×3 |
| 9 twins | silence | silent | silent | silent |
| `public-id` (key ID + cluster id) | silence | silent | FLAGGED `[24,40)` (the 16-char key ID) | silent |
| 10 other controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives, a coverage gap of the
  pinned package (PR #667 closed it on `main`). Because both peers are also
  silent these are agreements, not review-queue rows; no `known-gaps.json`
  record is opened (the product issue exists and is closed).
- **gitleaks 8.30.1:** silent on every positive by construction of its own
  rules — `confluent-secret-key` needs an assignment operator between the
  keyword and a lowercase-only `[a-z0-9]{64}` body, so a mixed-case or
  `+`/`/`-bearing secret in the provider's documented alphabet, or one with
  no operator, never matches; it has no rule for the `cflt` prefix at all.
  One false alarm: `confluent-access-token` flags the API key ID
  (`CONFLUENT_CLOUD_API_KEY=ABCD1234567890AB`), an identifier the provider
  documents as public. Recorded as a resolved
  `peer-only/gitleaks/range-matches-corpus` ledger row.
- **trufflehog 3.97.4:** silent on every positive by design — its
  `confluent` detector emits a result only when a 16-character key ID and a
  64-character secret both appear near a `confluent` keyword; no positive
  here pairs the two (the key ID is deliberately kept in a control). It has
  no rule for the `cflt` prefix.
- **Twins:** every scanner stays silent on all nine.
- 12 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check
npm run eval -- --method=differential,benign,twin --detector=confluent-cloud-api-secret,confluent-cloud-api-secret-legacy
```
