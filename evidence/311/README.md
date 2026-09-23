# Evidence: redact-secret#311 — Netlify personal access tokens, benchmark corpus extension

**Result:** 6/6 authored positives are leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6 predates the detector); gitleaks 8.30.1
and trufflehog 3.97.4 each match the 3 `NETLIFY_AUTH_TOKEN=` positives
byte-exactly and miss the 3 bare-token positives (both peers gate on a
`netlify` keyword); 0 false alarms on the 12 controls and twins from any
scanner.

This file records the benchmark side of
[redact-secret/redact-secret#311](https://github.com/redact-secret/redact-secret/issues/311),
per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; does not contain the detector. |
| `redact-secret` (detector landed) | `7f00ac7b24def94b8207db167d03973e011260ad` (merge of PR #666) on `main`, unreleased at measurement time; registry pinned at `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`. |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `41afd0b2c7c43ea4ff0c46778673a90ae5a889a2`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`afd3b64b-7e0c-4d76-8c6d-d691332a5ed7`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contract `netlify-token` (T1: `^nfp_[A-Za-z0-9_]{36}$`; providerSource is
Netlify's staff-authored 2023-11-07 token-format announcement on
answers.netlify.com — `nf` prefix plus identifying character `p`, 40-character
capacity; the `_` delimiter and body alphabet are corroborated by trufflehog's
`netlify/v2`). 18 `detector-coverage` fixtures:

- 6 positives — the bare `nfp_` + 36-byte token and the same token in a
  `NETLIFY_AUTH_TOKEN=` assignment (the CLI's documented variable), each
  bare / quoted / Unicode-prefix+CRLF;
- 6 negative twins — length (39 characters), prefix (`nfx_`, outside the
  announcement's identifying-character set);
- 6 independent controls — `prefix-only`, `short-body`, `mask`,
  `reference`, `label-prose`, `public-id` (a site id).

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 3 bare positives | secret span | MISS ×3 | MISS ×3 | MISS ×3 |
| 3 `NETLIFY_AUTH_TOKEN=` positives | secret span | MISS ×3 | EXACT ×3 | EXACT ×3 |
| 6 twins | silence | silent | silent | silent |
| 6 controls | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives, a coverage gap of the
  pinned package. The 3 keyword-context misses are 6 `open`
  `differential-coverage-gap/netlify-token` ledger rows (one per peer), each
  noting that PR #666 closed the gap on `main`; the 3 bare misses are
  agreements with both peers (no queue row) and are recorded here only.
- **trufflehog 3.97.4:** its `netlify/v2` detector pins exactly
  `nfp_[a-zA-Z0-9_]{36}` but only after a `netlify` keyword
  (`PrefixRegex`), so a bare token is an expected false negative and the
  assignment form is byte-exact.
- **gitleaks 8.30.1:** its `netlify-access-token` rule fixes no prefix at
  all — a keyword-plus-assignment-gated 40–46-byte `[a-z0-9=_\-]` body,
  matched case-insensitively — so it, too, misses the bare token and matches
  the assignment form; it corroborates recognition of a 40-byte token in a
  netlify assignment, never the `nfp_` prefix. The contract (and the product
  detector) require no keyword: the provider-documented prefix and exact
  length are self-identifying.
- **Twins:** every scanner stays silent on all six.
- 15 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Fixed-candidate rerun

The product candidate built from `065ec76c7978ee60c5de8412bd04b91d39c2c275`
(product `main`, which contains this detector) was run over the full corpus
after this family landed — netlify-token: 6/6 positives EXACT (bare and keyword-context alike), 0/12 controls flagged. Run identity, artifact hashes and the
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
npm run eval -- --method=differential,benign,twin --detector=netlify-token
```
