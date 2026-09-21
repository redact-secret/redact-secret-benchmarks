# Correct the five twins #553 ruled untenable

Date: 2026-09-21 · Status: accepted

## Context

[redact-secret/redact-secret#553](https://github.com/redact-secret/redact-secret/issues/553)
investigated five `must-not-flag` twins that still fire on `main` and reached a
disposition for each, recorded on this side as `benchmarks/known-gaps.json`'s
`product-553` entry: all five are fixture-authoring errors, not detector
defects, and correcting them was explicitly routed here as
[#78](https://github.com/redact-secret/redact-secret-benchmarks/issues/78).
That routing had gone unaddressed — #66, which #553 cited, closed without
touching twin re-authoring. This decision records the correction taken for
each of the five, per #78's requirement that no twin be reclassified
identically without its own reasoning.

The co-detection scoring mechanism this decision leans on for four of the five
fixtures was built separately, in
[#82](https://github.com/redact-secret/redact-secret-benchmarks/issues/82)
(`benchmarks/lib/lattice.ts`'s `scopeFamily` parameter to `scoreRow`,
documented in `docs/evaluation-methods/02-negative-twin.md`). This decision
does not re-litigate that mechanism; it applies it.

## The five, and the route taken

| fixture | route | why |
| --- | --- | --- |
| `detector-coverage--bearer-token-header-bare-twin` | 1: re-author | see "Bearer twins" below |
| `detector-coverage--bearer-token-header-quoted-twin` | 1: re-author | same |
| `detector-coverage--bearer-token-header-unicode-crlf-twin` | 1: re-author | same |
| `sendgrid-regressions--base62-bearer-twin` | 2: expected co-detection | see "SendGrid twins" below |
| `sendgrid-regressions--base62-generic-key-twin` | 2: expected co-detection | see "SendGrid twins" below, own reasoning |

No twin was removed. All five keep asserting silence on their own contract
family; none was deleted to clear a gate.

## Bearer twins: the mutation index was untenable, not the twin's premise

`fixtures/generated/detector-coverage.mjs`'s `bearer-token` twin substituted
one byte outside the RFC 6750 b64token alphabet at index 20 of the 40-byte
synthetic value. `bearer-token`'s match is anchored: it reads `"Bearer" 1*SP`
then greedily consumes a b64token-alphabet run from that fixed position and
checks only that head run against `MIN_TOKEN_LEN` (16); it does not rescan
past the first invalid byte for a second run. The evidence in
`benchmarks/known-gaps.json` (`product-553`, `evidence[0..2]`) shows exactly
one reported span per fixture, `end - start === 20`, confirming this: at index
20 the anchored head run is 20 bytes, over the floor, so the detector matched
regardless of the mutation.

The fix moves the mutation to index 8 — inside the first 16 bytes — so the
anchored head run itself falls under the floor. This is the same "mutate
at/inside the length floor rather than deep in the value" technique already
used by the `otpauth-uri` Base32 alphabet twin in the same file. No second
anchor exists for the 31-byte tail past the invalid byte to be an independent
match candidate, so it does not need to also fall under the floor.

Applies to all three bearer-token-header twins (`bare`, `quoted`,
`unicode-crlf`): they share one `addTwin` call and one mutation.

## SendGrid twins: expected co-detection, verified against the recorded evidence

Both `base62-bearer-twin` and `base62-generic-key-twin` already declare
`detectors: ["sendgrid-token"]`, so `classifyFixture` already assigns them
`contract: "sendgrid-token"` (`benchmarks/lib/assessment.ts`), and
`benchmarks/lib/scoring.ts` already passes that contract to `scoreRow` as
`scopeFamily` for any fixture carrying `twinOf`. No fixture-authoring change
was needed for either: the #82 mechanism, once merged, scopes both twins'
`flagged` reading to `sendgrid-token` alone.

Verified directly against the exact findings `product-553`'s audit recorded
(`benchmarks/known-gaps.json`, `evidence[3..4]`), by calling `scoreRow` with
those findings' families:

- `base62-bearer-twin`: `bearer-token` fires (67-byte Bearer credential,
  correctly — `sendgrid-token` correctly declined the one-byte-short value).
  `scoreRow([], [{family:'bearer-token'}], 'sendgrid-token')` →
  `{flagged:false, coDetected:true}`.
- `base62-generic-key-twin`: `generic-token` fires (`api_key=` is a
  `HIGH_SIGNAL_NAMES` match, warned on unconditionally per
  `docs/decisions/2026-09-20-warn-unconditionally-on-high-signal-contextual-names.md`
  — `sendgrid-token` again correctly declined the truncated value).
  `scoreRow([], [{family:'generic-token'}], 'sendgrid-token')` →
  `{flagged:false, coDetected:true}`.

`base62-generic-key-twin` is not an instance of the bearer disposition: it is
not touched by #553's bearer ADR at all, and its co-detecting family
(`generic-token`, not `bearer-token`) and its reason (the standing
unconditional-warn decision on high-signal contextual names, not a length
floor) are its own. Both resolve to route 2 for independent reasons that
happen to share one scoring mechanism.

## Verification

- `npm test` (317/317), `npm run typecheck`, `npm run fixtures:check`, `npm run
  pins:check:local` and `npm run decisions:validate` all pass after the
  bearer-token-header mutation fix and regenerating
  `benchmarks/pin-manifest.json` / `benchmarks/generated-corpora.json`.
- The SendGrid co-detection outcome above was verified with `scoreRow`
  directly, against evidence already recorded from a real product run
  (`product-553`, candidate `0.1.0-beta.5` / `0cc48374d005a44334bf727e49125165ec7d4157`),
  not a fresh candidate build.
- **Not verified here:** a fresh candidate run of product `main` re-scoring all
  five fixtures end to end (`benchmarks-#78`'s acceptance criterion "A
  candidate run of product `main` shows 0 `flagged:1` rows for these
  fixtures"), and the live `twinFailures` / `differential.unresolvedContractDisagreements`
  support-status counters, both of which require the `release-regression-check`
  workflow against a checked-out `redact-secret` product repo. Neither was
  available in this session.
