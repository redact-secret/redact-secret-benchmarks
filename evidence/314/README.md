# Evidence: redact-secret#314 — Mailgun private API and HTTP signing keys, benchmark corpus extension

**Result:** 6/6 authored positives are leaked by the pinned published package
(`@redact-secret/core` 0.1.0-beta.6 predates the detector); gitleaks 8.30.1
and trufflehog 3.97.4 each match all 6 byte-exactly; gitleaks false-alarms on
all 9 negative twins (its generic rule), trufflehog on none; 0 alarms on the 6
independent controls from any scanner.

This file records the benchmark side of
[redact-secret/redact-secret#314](https://github.com/redact-secret/redact-secret/issues/314),
per [`evidence/README.md`](../README.md).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (published package under test) | `079095e766e4a71e2b7e29413ed17be37bb3315d` (0.1.0-beta.6), the last release tag; does not contain the detector. |
| `redact-secret` (detector landed) | `64889e02e759fd9b2a90320149baea999163d54f` (merge of PR #680) on `main`, unreleased at measurement time; registry pinned at `065ec76c7978ee60c5de8412bd04b91d39c2c275` (the `main` commit carrying every family through #315). |
| `redact-secret-benchmarks` | the commit that adds this file (working tree on top of `bd9263e5ee57875dcd8179faffb99248483f92cd`), clean apart from that change. |

## Pinned scanner versions

Published-package run over the engine's three suite scanners: `redact-secret`
0.1.0-beta.6 (npm package, default detectors), `gitleaks` 8.30.1, `trufflehog`
3.97.4 (keg, version checked in the same shell). Run id
`382aa4de-ea47-4bba-8aea-36fb6aeb419c`, all three `complete`, replays agreed.

## What was authored (before any scanner ran)

Contract `mailgun-api-key` (T2, tool-corroborated: `^key-[a-z0-9]{32}$`; the
provider's own "Create a key" reference shows only the placeholder
`api-key-be-careful`, and the account HTTP-signing-key reference the product
cites for the same `key-` shape could not be re-fetched here, so no
providerSource is claimed). One family carries both credentials, as the
product does. 21 `detector-coverage` fixtures:

- 6 positives — `MAILGUN_API_KEY=key-…` (private API key) and
  `MAILGUN_WEBHOOK_SIGNING_KEY=key-…` (HTTP signing key), each bare / quoted /
  Unicode-prefix+CRLF; every positive carries the same-line `mailgun` keyword
  the product's Medium-confidence gate requires;
- 9 negative twins — length (31-byte body), prefix (`kex-`), alphabet (one
  uppercase byte);
- 6 independent controls — `prefix-only`, `short-body`, `mask`, `reference`,
  `label-prose`, `public-id` (`pubkey-…`, the public validation key, plus a
  sending domain).

## Outcomes, per scanner

| Fixture group | expected | redact-secret 0.1.0-beta.6 | gitleaks 8.30.1 | trufflehog 3.97.4 |
| --- | --- | --- | --- | --- |
| 6 positives | secret span | MISS ×6 | EXACT ×6 | EXACT ×6 |
| 9 twins | silence | silent | FLAGGED ×9 | silent |
| 6 controls (incl. `pubkey-`) | silence | silent | silent | silent |

## FP/FN tradeoffs recorded

- **redact-secret (published):** 6 false negatives, a coverage gap of the
  pinned package, recorded as 12 `open` `differential-coverage-gap/mailgun-api-key`
  ledger rows (one per peer per positive), each noting that PR #680 closed
  the gap on `main`; open until a release carrying the detector is pinned.
  No `known-gaps.json` record (the product issue exists and is closed).
- **gitleaks 8.30.1:** its `mailgun-private-api-token` rule accepts only a
  hex body (`key-[a-f0-9]{32}`), so the synthetic bodies here, drawn from the
  full `[a-z0-9]` alphabet the contract adopts, are matched by its
  `generic-api-key` rule (keyword `key`, assignment, long value) rather than
  the Mailgun rule. The same generic rule is what flags all nine twins — the
  31-byte, `kex-` and uppercase mutations all still look like a long value
  after `MAILGUN_API_KEY=`. Recorded as resolved
  `peer-only/gitleaks/range-matches-corpus` rows.
- **trufflehog 3.97.4:** its "Key-MailGun Token" pattern `key-[a-z0-9]{32}`
  needs no keyword and pins exactly the contracted alphabet: byte-exact on
  every positive, silent on every twin and control.
- **Not fixtured:** a keyword-less `key-…` value (an accepted product false
  negative, per the mailchimp-api-key precedent) and the superseded 32-8-8
  hex "signing key" triplet both peers still carry rules for (a known
  unsupported legacy variant, recorded in the taxonomy).
- 36 mutation review-queue rows are `not-assertable` under the D7 operator
  classes.

## Fixed-candidate rerun

The product candidate built from `065ec76c7978ee60c5de8412bd04b91d39c2c275`
(product `main`, which contains this detector) was run over the full corpus
after this family landed — mailgun-api-key: 6/6 positives EXACT, 0/15 controls flagged (the pubkey- control stays silent). Run identity, artifact hashes and the
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
npm run eval -- --method=differential,benign,twin --detector=mailgun-api-key
```
