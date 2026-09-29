# Beta.11 custodian-held blind aggregate: carry-over to candidate 8b6a5fd

Issue: [#382](https://github.com/redact-secret/redact-secret-benchmarks/issues/382)
(parent [#376](https://github.com/redact-secret/redact-secret-benchmarks/issues/376)).
Machine-readable record: [`2026-09-29-beta11-142-blind-carry-over-8b6a5fd.json`](2026-09-29-beta11-142-blind-carry-over-8b6a5fd.json).
Carried aggregate: [`2026-09-28-beta11-142-blind-aggregate.json`](2026-09-28-beta11-142-blind-aggregate.json)
(`runId` `1604909b-bd5f-4c2d-b3ab-3eb1bc7d0d61`, report
[`2026-09-28-beta11-142-blind-evaluation.md`](2026-09-28-beta11-142-blind-evaluation.md)).
This supersedes the carry-overs to `ec9224d`
([`2026-09-29-beta11-142-blind-carry-over-ec9224d.md`](2026-09-29-beta11-142-blind-carry-over-ec9224d.md)) and `8f97f14`
([`2026-09-29-beta11-142-blind-carry-over.md`](2026-09-29-beta11-142-blind-carry-over.md)), which stay as history.

## What this record is

The `beta11-e1` blind aggregate was measured at product `1db8ff38b16e50c51229eb27025452952bf621e1`. It was **not**
measured at the re-bound Beta.11 candidate `8b6a5fde52ecb4dfce13f09c7a947062d21483c7` (product main after PR #994 and
PR #996). By
maintainer decision it is **carried over** to `8b6a5fd`. No new epoch is opened and no blind run is made against
`8b6a5fd`. As with the `8f97f14` carry-over, this departs from rule 2 of
[`docs/specs/blind-evaluation.md`](../specs/blind-evaluation.md), and this record is where the departure and its basis
are written down.

The custodian's private fixtures were not read, touched or scanned for this record. The `beta11-e1` epoch was not run
again, so it is not spent a second time. The aggregate file and its report are unchanged. The evidence class stays
`custodian-blind`, and the numbers stay outside public qualification, regression totals and support status.

The carried figures, unchanged: leaked spans 3/66 (4.6%, Wilson 95% [1.6%, 12.5%]), false alarms 0/27 ([0, 12.5%]),
unstable 0/84.

## Known difference in what the blind epoch measured

**#948 changes the policy the epoch measured.** The epoch ran under the policy in force at `1db8ff3`: a provider-named
credential variable (`OPENAI_API_KEY=`, `SENTRY_AUTH_TOKEN=`) disqualified `generic-token`, so an off-grammar value
under it was silent. At `ec9224d` and `8b6a5fd`, per the amendment of
[`decision-redact-provider-named-credential-assignments`](https://github.com/redact-secret/redact-secret/blob/ec9224d9743066fe73d6e61e9843ef52bd853833/docs/decisions/2026-09-24-redact-provider-named-credential-assignments.md#amendment-a-provider-named-high-signal-name-falls-back-to-generic-token-948),
that value is a `generic-token` credential: redact at 16 bytes and entropy 3.0, otherwise warn. The consequences:

- A blind control that places a near-miss or off-grammar value under a provider credential variable would read silent in
  the carried aggregate and reported at `8b6a5fd`. The carried false-alarm count (0/27) was measured under the old
  policy, so it says nothing about how such controls read now.
- A blind positive of that shape would move from leaked to redacted.
- The record cannot say how many blind fixtures have that shape.

The public corpus had 177 such fixtures, and the benchmark relabelled or scoped them under
[`docs/decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md`](../decisions/2026-09-29-relabel-provider-named-near-miss-controls-under-948.md).
The blind fixtures were not touched.

**#993** silences placeholders, masks, elided displays, Make-escaped references, documented public keys and the Confluent
key id under every contextual name. It can only remove `generic-token` findings. The carried leaked-span count could move
only if a blind positive is one of those shapes.

The #990 layout classes of the `8f97f14` record apply unchanged.

## Basis

### (a) The product diff 8f97f14..8b6a5fd

Two merges: PR #994 (`ec9224d9`, 15 commits) and PR #996 (`8b6a5fde`).

| Change | Detector source | Output |
| --- | --- | --- |
| #948 provider-named fallback (`generic_token.rs`) | yes | intended change: an off-grammar value under a provider credential variable is reported |
| #993 non-secret value exclusions (`generic_token.rs`, `text.rs`) | yes | intended change: the listed non-secret shapes are silent under every name |
| #902 linear PII context association (`pii.rs`) | yes, PII only | byte-identical by design |
| #896 scoped checks | no (scripts) | none |
| #996, #902 Wasm follow-up (`pii.rs` only) | yes, PII only | byte-identical by design |

The earlier diff 1db8ff3..8f97f14 is in the `8f97f14` record.

### (b) Whole-input and incremental differential over the full public corpus

The harness, surface and checks are the ones in the `8f97f14` record: `@redact-secret/core` default entry on the Node
addon, Node v22.16.0, darwin-arm64. It runs whole-input `scanAndRedact` and three incremental sessions with the #427
limits (one append per line, 64-unit chunks, 7-unit chunks), and records digests and finding metadata only.

- **Corpus:** every fixture of every category in `benchmarks/categories.json` at benchmarks `405892a5ba40b6eeef919d2fb818470ee495092c`.
  That is 5,001 fixtures in 47 categories: the 46 scored categories (4,777 fixtures, corpus `d88c19f7…3e2f`) plus the
  calibration-only `shadow-scoring-authored`. The nine fixtures added since the `8f97f14` record are the `beta8-948`
  replacement controls, and the relabel changed no fixture bytes.
- **Builds:**
  - 1db8ff3: the build of candidate run `e56cd9b2…`;
  - 8f97f14: the build of run `74888ff3…`;
  - ec9224d: the build of run `589527ab-8df1-4ae7-a517-26f7567ffb3b`, with core `467111e2…f74c`, node
    `9ceabe01…83d6` and wasm `c3f54788…7d78`;
  - 8b6a5fd: the build of run `e795030e-478e-4d21-9775-57456d832143`, with core `467111e2…f74c`, node
    `19f41652…05ea` and wasm `61d135ba…6f2d`.

| Comparison | Differing fixtures |
| --- | ---: |
| 1db8ff3 → 8f97f14 | 0 (digest files byte-identical, SHA-256 `5e766ac1…9681`) |
| 1db8ff3 → ec9224d | 178 |
| 8f97f14 → ec9224d | 178 (the same set) |
| ec9224d → 8b6a5fd | **0** (digest files byte-identical, SHA-256 `d18cccfb…ee6e`) |
| 1db8ff3 → 8b6a5fd | 178 (the same set as 1db8ff3 → ec9224d) |

**The 178 are exactly the #948 and #993 classes. None falls outside them, and PR #996 adds none.**

- **177 are the #948 class:** the 177 `must-not-flag` fixtures the product's own rescan listed (product
  `docs/audits/evidence/948/README.md` at `ec9224d`). 152 are negative twins and 25 are the relabelled near-miss
  controls. Each gains one `generic-token` `contextual_secret` finding on the value under the provider's own variable.
  By corpus:
  - `context-edges` 42, `detector-coverage` 30, `beta8-207` 28, `beta8-208` 11;
  - `beta8-259` 10, `beta8-263` 10, `beta8-212` 7, `beta8-213f` 7;
  - `credential-formats` 6, `sendgrid-regressions` 6, `beta8-211` 6, `token-contexts` 4, `beta8-213d` 4;
  - `beta8-209` 3, `beta8-210` 2, `beta8-384a` 1.
- **1 is the #993 class:** `beta8-434b--trigger-dev-token-public-key-prefix-twin` loses its `generic-token`
  co-detection on the documented `pk_` public key.
- **Partitions:** 177 of the 178 differ whole-input and in all three incremental partitions.
  `context-edges--long-prefix-twin` differs whole-input only, because every incremental partition fails closed on the
  declared token limit on every build.
- **Incremental versus whole input:** unchanged. On all four builds the same 2 fixtures (`context-edges--long-prefix`
  and `context-edges--long-prefix-twin`) fail every incremental partition with `TOKEN_LIMIT_EXCEEDED`. Every other
  fixture's incremental output equals its whole-input output in all three partitions.

The scored candidate runs agree. At `8b6a5fd` every fixture outcome and family record equals `ec9224d`
([`../../evidence/860/8b6a5fd/README.md`](../../evidence/860/8b6a5fd/README.md)). At `ec9224d` the fixture outcomes that differ from `8f97f14` are the same 177 plus the
one #993 twin. With the #948 relabel recorded, the same 88 families are stable in candidate mode as at `8f97f14`
([`../../evidence/860/ec9224d/README.md`](../../evidence/860/ec9224d/README.md)). Credential mixed-document parity at
`ec9224d` and at `8b6a5fd` shows 0 divergences, with outcomes equal to `8f97f14`
([`../../evidence/860/381/README.md`](../../evidence/860/381/README.md)).

## What the carry-over does not establish

- It does not measure `8b6a5fd` on the blind fixtures. On 5,001 public fixtures, `8b6a5fd` differs from `1db8ff3` only in
  the #948 and #993 classes. The #948 difference is a policy change that alters whole-input output, and blind fixtures
  of that shape would read differently. See "Known difference" above.
- The independence limits of the original aggregate apply unchanged: procedural separation only, wide intervals.

## Reproduce

The harness and install recipe are the ones in the `8f97f14` record
([`2026-09-29-beta11-142-blind-carry-over.md`](2026-09-29-beta11-142-blind-carry-over.md#reproduce)). Run them from the
benchmarks root at `405892a5ba40b6eeef919d2fb818470ee495092c` with further sides installed from the `ec9224d` and
`8b6a5fd` tarballs, and compare the JSON files.
