# Unit-safe diagnostics and verified sanitized output

Status: **proposed (2026-09-28), #380.** Decision record:
[`decisions/2026-09-28-report-unit-safe-diagnostics-and-verified-output.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-28-report-unit-safe-diagnostics-and-verified-output.md).
Schema: [`schemas/unit-diagnostics-v1.json`](../../schemas/unit-diagnostics-v1.json).
Code: `benchmarks/lib/unit-diagnostics.ts` (pure scoring and invariants),
`benchmarks/unit-diagnostics.ts` (runner), `benchmarks/lib/unit-diagnostics-report.ts`
(Markdown rendering).

## What it is for

People ask for TP/TN/FP/FN. [Measurement protocol v4](measurement-v4.md) §2.4
removed precision, recall and F1 on purpose: the corpus is positive-heavy and
not a representative sample, so those ratios mean nothing. This report makes
the four counts *inspectable* without reintroducing any of them, and it adds
one thing v4 never measured: whether the product's **actual sanitized output**
still contains the secret.

v4's leaked-span rate, leaked-byte rate, collateral ratio and false-alarm rate
stay the headline and are unchanged. This report is a diagnostic beside them.

## Units

A count means nothing without its unit, so every count has exactly one.

| Rows | Unit | Counts |
| --- | --- | --- |
| `must-redact`, `policy` | one authored **secret span** | detection outcome (v4 lattice: `EXACT`, `COVERED`, `OVERBROAD`, `PARTIAL`, `MISS`) and, separately, sanitization (`removed`, `partial-leak`, `leaked`) |
| `must-not-flag` | one control **file** | `clean` (the TN diagnostic) or flagged (the FP diagnostic), flagged split into `flagged-non-destructive` (`warn`/`allow` only) and `flagged-destructive` (any `redact`/`block`) |

Span units and file units never meet: no 2×2, no ratio across them, no
precision, recall, F1, accuracy or ranking (`reportProblem()` rejects those
keys anywhere in a report).

A finding in a positive file that lies outside every expected span's
envelope is **collateral** (`outOfEnvelopeFindings`, split by action, and
`outputCollateralBytes`, the bytes the output actually replaced outside the
envelopes). It is never a true negative: the file is a positive.

## Detection is not sanitization

Detection reads every finding regardless of action, exactly as v4 does. A
`warn` finding that covers the whole secret is `EXACT` detection.

Sanitization reads the output. The runner calls `scanAndRedact(input)` twice
(replay), `scan(input)` and `redact(input, scan(input))`, and accepts the
output only if

1. both `scanAndRedact` calls agree (else `unstable`);
2. `scan` returns the same findings as `scanAndRedact`, and `redact(input, scan(input))`
   returns the same text (else `output-unverified`);
3. the text equals the input with exactly the `redact`/`block` findings replaced,
   in order, by the documented default placeholder `<SECRET_n>`, byte for byte
   (else `output-unverified`).

When the output is verified, the span's `outputLeakedBytes` is the number of
its bytes outside every replaced range — which, by (3), is the number of its
bytes present in the output at their original position. A finding-free
cross-check, `plaintextInOutput`, records whether the span's whole plaintext
still occurs anywhere in the output.

So a `warn`-only span is always `leaked`: a detection, never a sanitization
success. `reportProblem()` rejects any report where a span with no destructive
finding is `removed` or `partial-leak`, or a `MISS` is anything but `leaked`.

A product exception (`scan-error`, fixed error code only; never the message)
and the two verification failures are **failure states**. They are counted
in the eligible denominator and in `failedSpans`/`failedFiles`, and never in
any outcome or sanitization column.

## Strata

Every segment is one `domain | kind/tier | scope`:

- **kind/tier** as in v4. `policy/T3` never shares a segment with `must-redact`
  T1/T2. T0 rows are listed under `pending` and never scored.
- **scope**: `family` (the fixture declares a contract; a per-family breakdown
  sits under `families`), `uncontracted` (a positive with no contract), or
  `global-untargeted` (a control with no contract, e.g. the untargeted benign
  corpus). Family strata and global untargeted controls never share a
  denominator.
- **domain**: `credentials` today. PII cases are a different case model
  (`pii-v1` profile, sensitivity and jurisdiction expectations) measured by the
  PII domain reports; the report records PII as `not-measured` rather than
  forcing those cases into span/file units.
- **mode**: one report is either `published` (the npm dependency pinned in
  `package-lock.json`) or `candidate` (exact tarballs, with source commit and
  artifact SHA-256s). They are separate files, never merged.

For a flagged family control the report also records whether any finding was
the control's own family (or unattributed) or only other known families
fired (`flaggedAttribution`). v4 scopes a *twin's* false alarm to its own
family, so its `flaggedFiles` can be lower than the any-flag file count; the
report carries v4's reading (`v4.flaggedFiles`) beside the file units, so the
two reconcile.

## Invariants (`reportProblem`)

- `schemaVersion` is 1; `mode` is `published` or `candidate`, and a candidate
  identity is present exactly in candidate mode; `corpus.pinned` is true.
- No forbidden metric key anywhere.
- Per segment and per family stratum: outcomes plus failures sum to the
  eligible spans or files; the action-class and detection × sanitization
  splits sum to their totals; the strongest-action split sums to flagged files
  and its `redact`+`block` equals `flagged-destructive`; family strata sum to
  their segment.
- Warn cannot count as redaction success (above).
- v4 agreement: each segment's `v4` block equals the unchanged v4 scorer's
  counts for the same rows, and at generation time the runner recomputes v4
  groups with `score()` + `aggregateGroups()` and fails unless
  `spans`, `leakedSpans`, `leakedBytes`, `secretBytes`, `collateralBytes`,
  control `files` and control `flaggedFiles` match per kind × tier.
- With the `.rows.json` sidecar: `rowsDigest` matches, every row is
  self-consistent, and aggregating the rows reproduces `segments` and
  `pending` exactly.
- `digest` is a SHA-256 over the report without `generatedAt`, `runtime` and
  `provenance` (the benchmark checkout), so the same product over the same
  pinned corpus reproduces the same digest from any benchmark commit.

## Frozen corpus

The runner reads every non-calibration category in
`benchmarks/categories.json` and refuses to run unless each corpus file's
SHA-256 equals `benchmarks/pin-manifest.json`'s `corpusHashes` entry. The
report records every category hash and one `corpus.identity` over them.
Adding fixtures (e.g. #379) changes the identity: `--check` then says
**stale** (regenerate) rather than **not reproducible**.

## Commands

```sh
# published package (package-lock.json pin)
npm run eval:diagnostics -- --out=results-output/unit-diagnostics/<date>-published

# exact candidate build (e.g. the artifacts `npm run benchmark:candidate` leaves in its output dir)
npm run eval:diagnostics -- --out=results-output/unit-diagnostics/<date>-candidate \
  --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> \
  --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=<40-hex>

# schema + invariants (+ row recomputation when <report>.rows.json is beside it)
npm run eval:diagnostics:validate -- <report.json>...

# reproducibility: rerun and compare digests with a committed report
npm run eval:diagnostics -- --check=<report.json>
```

Each run writes `<out>.json` (the report: segments, v4 reference, identities
and the notable rows — anything not a clean control or a fully-removed span),
`<out>.md` (the human rendering) and `<out>.rows.json` (every row; kept with
the run, not committed).

## What it does not claim

Everything in [measurement-v4 §4](measurement-v4.md#4-what-v4-still-does-not-claim)
applies. In addition: sanitization is measured with the built-in policy, the
default detectors and the default placeholder formatter, over whole inputs;
it says nothing about incremental sessions, custom policies or custom
formatters.
