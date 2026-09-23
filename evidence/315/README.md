# Evidence: redact-secret#315 — Okta API tokens, benchmark corpus extension

**Result:** 6/6 authored positives are leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6 predates the detector); gitleaks 8.30.1
matches the 3 `OKTA_API_TOKEN=` positives byte-exactly and misses the 3
`Authorization: SSWS` positives (its rule needs an assignment operator);
trufflehog 3.97.4 reports none of the 21 fixtures (its detector needs an Okta
tenant domain in the same input); gitleaks false-alarms on the 3 `=`-alphabet
twins; 0 alarms on the other 6 twins and 6 controls.

This file records the benchmark side of
[redact-secret/redact-secret#315](https://github.com/redact-secret/redact-secret/issues/315),
per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; does not contain the detector. |
| `redact-secret` (detector landed) | `065ec76c7978ee60c5de8412bd04b91d39c2c275` (merge of PR #681) on `main`, unreleased at measurement time; this is also the registry pin. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `57665d36d41c838db5839362ccc0f27b745fd67a`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`68b7890a-eea1-4663-95d6-863005162fee`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contract `okta-api-token` (T2, tool-corroborated: `^00[A-Za-z0-9_-]{40}$`;
Okta's own guide shows the token only as `Authorization: SSWS 00…`, which is
the twinSource for the prefix twin). 21 `detector-coverage` fixtures:

- 6 positives — the token after `Authorization: SSWS ` (the product's
  High-confidence context) and after `OKTA_API_TOKEN=` (its Medium,
  keyword context), each bare / quoted / Unicode-prefix+CRLF;
- 9 negative twins — length (39-byte body), prefix (`01`), alphabet (one
  `=` byte, which gitleaks's class admits and trufflehog's and the contract's
  do not);
- 6 independent controls — `prefix-only`, `short-body`, `mask`, `reference`,
  `label-prose`, `public-id` (a tenant URL and an OAuth client id).

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 `Authorization: SSWS` positives | secret span | MISS ×3 | MISS ×3 | MISS ×3 |
| 3 `OKTA_API_TOKEN=` positives | secret span | MISS ×3 | EXACT ×3 | MISS ×3 |
| 3 `=`-alphabet twins | silence | silent | FLAGGED ×3 | silent |
| 6 other twins | silence | silent | silent | silent |
| 6 controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives, a coverage gap of the
  pinned package. The 3 keyword-context misses are 3 `open`
  `differential-coverage-gap/okta-api-token` ledger rows (gitleaks peer), each
  noting that PR #681 closed the gap on `main`; the SSWS-header misses are
  agreements with both peers (no queue row) and are recorded here only.
- **gitleaks 8.30.1:** its `okta-access-token` rule needs an `okta` keyword
  followed by an assignment-like operator, so it recognizes the env
  assignment and not the documented `Authorization: SSWS` header form. Its
  body class `[\w=\-]{40}` admits `=`, so the three alphabet twins are false
  alarms against the contract's narrower `[A-Za-z0-9_-]` — the one
  disagreement between the two pinned tools, recorded as resolved
  `peer-only/gitleaks/range-matches-corpus` rows.
- **trufflehog 3.97.4:** its `okta` detector emits a result only when the
  input also carries an Okta tenant domain (`*.okta.com`, `*.oktapreview.com`,
  `*.okta-emea.com`); no positive here pairs the token with a domain (the
  tenant URL is deliberately kept in the public-id control), so it is silent
  by design on every fixture.
- **Not fixtured:** a context-less `00…` value (neither SSWS nor an okta
  keyword on its line), an accepted product false negative per the
  mailgun/mailchimp precedent.
- 24 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Fixed-candidate rerun

The product candidate built from `065ec76c7978ee60c5de8412bd04b91d39c2c275`
(product `main`, which contains this detector) was run over the full corpus
after this family landed — okta-api-token: 6/6 positives EXACT (SSWS header and keyword context alike), 0/15 controls flagged. Run identity, artifact hashes and the
whole-suite table are in [`evidence/670/README.md`](../670/README.md) (run
`02d79b79-7718-49b6-999b-f6ce603bba50`, raw evidence
[`evidence/670/candidate-evidence-v1.json`](../670/candidate-evidence-v1.json)).
The open `differential-coverage-gap` ledger rows above describe the pinned
published package, not this candidate; they close when a release carrying
the detector is pinned.

## Command

```sh
export PATH=/opt/homebrew/Cellar/trufflehog/3.97.4/bin:$PATH
trufflehog --version                                            # must print 3.97.4
npm run fixtures:generate && npm run queue:check
npm run eval -- --method=differential,benign,twin --detector=okta-api-token
```
