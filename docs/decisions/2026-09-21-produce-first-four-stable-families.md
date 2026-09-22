---
decision_id: decision-produce-first-four-stable-families
status: accepted
scope: benchmarks
title: Produce the first `stable` families
decided_at: 2026-09-21
---

# Produce the first `stable` families

## Context

[Issue #62](https://github.com/redact-secret/redact-secret-benchmarks/issues/62)
targeted `aws-access-key`, `jwt`, `private-key` and `pypi-token` — four T1,
provider-documented families the issue described as blocked "only by sample
size" (`mutation.unresolvedCritical`, `metamorphic.criticalFailures`,
`twinFailures` and `differential` all 0 as measured at `5610c77`).

Re-measuring at the start of this work (`eval:classify`, current HEAD) showed
that premise was stale: `differential.unresolvedContractDisagreements` was no
longer 0 for any of the three T1-scoped families — 9 for `aws-access-key`, 4
for `jwt`, 18 for `private-key` — pre-existing, untriaged `differential`
review-queue entries unrelated to this issue's fixture work. All 31 were
`detector-coverage` fixtures already in the corpus (not new authoring),
disagreeing with one peer scanner each (`redact-secret-only` in 30 cases,
`peer-only` in 1). `benchmarks/review-ledger.json`'s own history shows this is
a recurring, expected state (`chore(benchmarks): update review ledger`,
`#28`/`#47`): any corpus change perturbs `detector-coverage.json`'s source
hash, which reshapes every `differential` queue id sourced from that file,
regardless of whether the individual fixture changed.

## Decision

Resolve each of the 31 pre-existing differential disagreements as
`redact-secret-only`/`peer-only` against a verified peer-scanner limitation
(below), not left `open` as if untriaged. Split `pypi-token` out of this
issue's scope — its macaroon-structure blocker is unresolved — and author
the fixtures the other three families need to reach `stable`.

## Triaging the pre-existing differential backlog

Each of the 31 disagreements was verified empirically (`gitleaks`, `trufflehog`,
locally pinned to the suite's versions) rather than assumed:

- `aws-access-key` (9): `shape-1` (AKIA-prefixed) is never flagged by
  TruffleHog's AWS detector, which requires a co-located secret access key
  and never flags a standalone ID. `shape-2` (ASIA-prefixed, digits outside
  the base32 alphabet — the contract's own recorded caveat) is additionally
  missed by gitleaks, whose `aws-access-token` rule requires a base32 body;
  confirmed by scanning a pure-base32 ASIA value (matched) against the mixed
  one (not matched).
- `jwt` (4): TruffleHog explicitly skips HMAC-signed (HS256) JWTs — already
  recorded on the `jwt` contract's `review` field — confirmed empirically (0
  findings on the fabricated HS256 fixture). The one `peer-only` case
  (`jwt-missing-signature`) is gitleaks's own `jwt` rule matching a truncated
  `header.payload.` shape that this corpus authors as a benign near-miss
  control; confirmed gitleaks flags the truncated form directly.
- `private-key` (18): all six PEM label variants (`PRIVATE KEY` through
  `ENCRYPTED PRIVATE KEY`) share one placeholder base64 body that decodes to
  prose, not key material — already recorded on the `private-key` contract's
  `review` field. TruffleHog's `privatekey` detector parses PEM content and
  requires decodable key material; confirmed empirically (0 findings on the
  placeholder body). Gitleaks's `private-key` rule is label-structural like
  redact-secret's and agrees, so it is absent from this list.

Every resolution note in `review-ledger.json` follows the same
`redact-secret-only|peer-only/<peer>/range-matches-corpus` template already
used 700+ times elsewhere in the file (`Resolved as authored-expectation-correct:
… a peer rule-coverage gap, not a corpus or redact-secret defect.`) — no new
resolution class was introduced.

## The 15→10 fixtures actually authored

`pypi-token` is **split out**, per the issue's own instruction ("Resolve
[the macaroon blocker] first, or split `pypi-token` out and land the other
three — do not author around it"). Its contract's `review` field already
records why: `pypi-` plus 90 arbitrary characters lacks the encoded macaroon
prefix and structure a real positive requires, and no fixture here fabricates
that structure. `pypi-token`'s own differential backlog (6 entries) is left
untouched — it does not target `stable` in this issue.

For the three T1 families that do:

| family | added | where |
| --- | --- | --- |
| `aws-access-key` | 1 benign control (`mask`, masked/placeholder body) | `fixtures/generated/detector-coverage.mjs` |
| `jwt` | 1 twin (`alphabet`, off `jwt-expired-fabricated`, ×3 contexts) + 3 benign controls (`prefix-only`, `reference`, `mask`) | same |
| `private-key` | 1 twin (`prefix`, off the generic `PRIVATE KEY` positive, ×3 contexts) + 2 benign controls (`prefix-only`, `reference`) | same |

The `private-key` twin swaps the PEM label to `CERTIFICATE` — RFC 7468 §4
documents this as a distinct textual-encoding label. A body-only mutation
(length, alphabet) was tried first and does **not** discriminate: this
detector is label-structural, not body-validating (empirically confirmed —
truncating the placeholder body by one byte left the finding unchanged). The
`jwt` twin injects one non-base64url character into the **payload** segment,
matching the existing `jwt-eddsa` alphabet twin's precedent
(`fixtures/generated/common-formats.mjs`): the same mutation applied to the
**signature** segment instead does not discriminate — redact-secret validates
header/payload charset structurally but not the signature segment's
(empirically confirmed both ways). Every new fixture was scanned directly
against the pinned `redact-secret` package before being committed to the
generator.

## Verification

`npm run eval:classify` (`0.1.0-beta.5`, current HEAD): distribution moved
from `{"stable":0,"provisional":42,"pending":2,"unsupported":0}` to
`{"stable":3,"provisional":39,"pending":2,"unsupported":0}` of 44 families —
`aws-access-key`, `jwt` and `private-key` report `stable` with empty
`reasons`; `pending`/`unsupported` are unchanged, and no other family's
`provisional` reasons changed. `npm run fixtures:generate`,
`npm run fixtures:check`, `npm run pins:manifest`, `npm run typecheck` and the
full test suite (298/298) all pass. No `0.1.0-beta.6` baseline is recorded
here, per the issue's own acceptance criteria — that happens once, at the end
of #61.
