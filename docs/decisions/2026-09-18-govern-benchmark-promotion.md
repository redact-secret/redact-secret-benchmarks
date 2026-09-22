---
decision_id: decision-govern-benchmark-promotion
status: accepted
scope: benchmarks
title: Govern benchmark-to-product regression promotion
decided_at: 2026-09-18
---

# Govern benchmark-to-product regression promotion

## Decision

This repository owns evaluation truth: discovery fixtures, generated variants,
differential and holdout evaluation, raw evidence, known-gap lifecycle, and
fixed-candidate revalidation. It continues to own the Evaluation Engine.
[`redact-secret`](https://github.com/redact-secret/redact-secret) owns detector
implementation, minimal canonical regression fixtures, cross-surface
conformance, and release-blocking behavioral contracts. The product's local
rules are fixed by
[`decision-govern-benchmark-regression-promotion`](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-18-govern-benchmark-regression-promotion.md).
The coordinated work is tracked in
[benchmark issue #10](https://github.com/redact-secret/redact-secret-benchmarks/issues/10)
and [product issue #390](https://github.com/redact-secret/redact-secret/issues/390).

The complete benchmark corpus is never copied into the product repository.
Generated exploration variants, competitor output, holdout cases, score
reports, and raw result bundles remain here. Product `assessment/` remains its
bounded cross-language measurement protocol and must not become a second
discovery benchmark.

## Lifecycle

`benchmarks/known-gaps.json` is the authoritative state record. Its validator
enforces the forward path:

`observed → reviewed → promoted → fixed → verified`

`rejected` and `policy-decision` are reviewed alternate dispositions. They end
the active path and require a reason and linked evidence. A later material
change is a new observation or an explicitly reviewed new record; do not erase
the old disposition.

- **Observed:** retain the benchmark fixture ID and corpus SHA-256, exact
  evaluated package/artifact or candidate identity, expected safe metadata,
  actual safe metadata, false-positive or false-negative kind, and the
  reproducible observation link. Raw scanner output stays in benchmark evidence
  storage and must not contain matched plaintext.
- **Reviewed:** record evidence that the expected result was authored and
  reviewed independently of scanner output. A disagreement or peer-scanner
  majority is review input, never ground truth. Do not change an expectation to
  make a scanner pass.
- **Promoted:** link a focused product bug and the product provenance-manifest
  record. Promotion selects the smallest deterministic synthetic or explicitly
  revoked reproducer and necessary controls; it does not transfer the corpus.
- **Fixed:** record the fixing product commit or exact version. This state says
  implementation work exists; it does not claim either acceptance gate passed.
- **Verified:** additionally record the canonical product regression fixture
  identities, fixing commit or version, successful product conformance evidence
  across every required supported surface, and benchmark rerun evidence against
  that exact fixed candidate. Both evidence arrays are mandatory.

Promotion review rejects active or provider-issued credentials. Canonical
product cases use exact UTF-8 ranges, minimal positive and negative controls,
and both whole-input and incremental behavior when applicable. The product
manifest is the cross-reference; benchmark-only fields do not enter canonical
finding objects.

## Fixed-candidate revalidation

Build the exact fixed product revision as immutable package tarballs and invoke
the product repository's `benchmark:candidate` command with a full 40-character
commit for this repository. That command checks out the benchmark revision,
installs its locked dependencies, and invokes the candidate-only entrypoint:

```sh
npm run benchmark:candidate -- \
  --benchmark-ref <full-40-character-benchmark-commit> \
  --filter <detector-id>
```

Omit `--filter` for the full candidate suite. Filtered evidence is explicitly
development-scoped and never substitutes for a whole-suite run. The benchmark
entrypoint and evidence contract are documented in
[`docs/specs/candidate-evaluation.md`](../specs/candidate-evaluation.md).

For findings exercised by other Evaluation Engine methods, the ordinary
published-package discovery command remains separate:

```sh
npm run eval -- --scanner=redact-secret --method=<method>
```

The durable evidence link must identify the candidate version or artifact hash,
lockfile hash, corpus hash, command, scanner configuration/version, run ID,
result status, and the relevant fixture outcomes. A dirty worktree or changed
candidate invalidates comparison unless the evidence explicitly records and
reviews it. Store or attach sanitized evidence; never paste raw scanner output
or matched values into an issue.

## Two-gate acceptance

Every promoted product bug requires both:

1. the canonical `redact-secret` regression passes across the required
   supported whole-input and, where applicable, incremental surfaces; and
2. this repository reruns the exact fixed candidate and links the resulting
   verification evidence.

The benchmark known-gap record moves to `verified` only after both links exist.
Benchmark discovery failures are not direct product release gates, and this
workflow does not authorize versioning, publication, deployment, or issue
closure.

## Historical reconciliation

Product issues
[#292](https://github.com/redact-secret/redact-secret/issues/292),
[#293](https://github.com/redact-secret/redact-secret/issues/293), and
[#294](https://github.com/redact-secret/redact-secret/issues/294) remain closed
historical implementation records. Their known-gap records are `fixed`, not
`verified`. The product manifest records all conformance and benchmark gates as
pending: #292 still lacks a canonical product corpus case; #293 and #294 have
canonical cases but lack recorded full supported-surface evidence; all three
lack linked fixed-candidate benchmark reruns. Nothing in this decision rewrites
their old evidence, checks unfinished acceptance items, or reopens them.

## Consequences

The benchmark repository retains complete evaluation context and can revalidate
new candidates without coupling product CI to discovery infrastructure. The
product repository retains a small, durable, release-blocking behavioral
contract that every supported binding can reuse. The cross-linked manifests
make incomplete gates visible without maintaining two copies of this lifecycle.
