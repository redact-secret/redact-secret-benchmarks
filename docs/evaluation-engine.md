# Internal evaluation engine

Implements steps 1–4 of the [accepted decision](decisions/2026-09-17-build-evaluation-engine-now.md):
the common engine, Twin and Benign, Metamorphic and Mutation, and Differential.
This is benchmark infrastructure for detector development. Holdout, stable
support qualification, and a public plugin API are not implemented.

## Running

All code under `benchmarks/` is TypeScript. Run `npm ci` first; the npm
commands load `tsx` so execution works on every supported Node version.
`npm run typecheck` checks both the engine and the UI with strict TypeScript.
For direct invocation, use `node --import tsx benchmarks/evaluate.ts`.

```sh
npm run eval
npm run eval -- --method=twin,benign --scanner=redact-secret
npm run eval -- --detector=github-token
npm run eval:discover -- --method=metamorphic,mutation
npm run eval -- --method=differential --strict
npm run eval -- --method=twin --scanner=redact-secret --fail-on-assertions
```

Every invocation deterministically reconstructs the generated corpus in memory
and loads the two static corpora from the existing catalog. It validates corpus
structure, assessments, and cryptographic source controls before generation.
It does not need a prior benchmark run. Unknown or empty selections fail.
Comma-separated method, detector, and scanner selections are supported.

The default report is `results-output/evaluation.json` (gitignored). Use
`--output=results-output/another-run.json` to retain multiple runs. Reports are
written atomically after scanner execution, including when a scanner fails.
No dashboard schema or existing `npm run bench` behavior is changed.

Discovery assertions and disagreements do not fail the command. Scanner errors
always do; `--strict` also fails on unavailable scanners. `--fail-on-assertions`
opts into failing on scored assertions. It does **not** make this a qualification
gate: draft source cases, unreviewed mutations, missing optional scanners, and
differential incompleteness are explicitly reported. Use `--strict` alongside it
when every selected scanner is required. No stable-support claim follows from
these flags. A differential run needs redact-secret and at least one peer to
make a complete comparison; selecting only one scanner yields incomplete
differential evidence, never agreement.

## Contracts and extension points

| Layer | Contract and ownership |
| --- | --- |
| `benchmarks/engine/types.ts` | TypeScript contracts for cases, variants, methods, operators, scanner observations and results. |
| `benchmarks/types.ts` | Shared fixture, assessment, UTF-8 range and scoring types. |
| `benchmarks/engine/model.ts` | Runtime validation and generation. EvaluationCase: identity, method, targets, visibility, seed fixture, operator specs, source and provenance. GeneratedVariant: parent identity, transformed fixture, expectation strategy, operator/version and hashes. |
| `benchmarks/methods/` | Method modules implement `id`, `version`, `validateCase`, `generate`, and `evaluate`; register in `index.ts`. |
| `benchmarks/operators/` | Operators implement `id`, `version`, `supports`, and `generate`; register in `index.ts`. Twin and Mutation share the authored-twin operator. |
| `benchmarks/engine/assertions.ts` | Absolute presence/absence and relational assertions, using the existing UTF-8 range lattice. |
| `benchmarks/engine/runner.ts` | Validation, generation, scratch files, scanner execution, failure isolation, cleanup and report assembly. No method-specific dispatch branches. |
| `scanners/index.mjs` | Existing published-package/Gitleaks/TruffleHog adapters, unchanged. They receive input identity and content, without expectations. |

This is an internal contract, intentionally free to evolve. A new method or
operator is a `.ts` module implementing `Method` or `Operator` from
`benchmarks/engine/types.ts`, plus registration in the corresponding `index.ts`; the engine and scanner integration need
no new method branch. The case loader is the initial corpus-to-case bridge;
additional case sources can use the same engine model. Duplicate registrations,
case IDs, variant IDs and paths are rejected. Development and regression are
the only accepted visibility values; holdout is rejected rather than silently
included in ordinary runs.

## Implemented methods

**Twin** imports all 56 authored common-format pairs. The positive must be
detected within its authored envelopes, the negative must be silent, and the
pair must flip. Integrity checks require a valid positive reference, matching
family, one declared semantic mutation, changed content and unchanged context
outside the secret (ignoring legacy trailing whitespace differences).
`authored-single-property` records an author declaration, not an algorithmic
proof of semantic edit distance: replacing a private key with its corresponding
public key can change many bytes. Positive preservation, negative rejection and
pair discrimination remain separately inspectable assertions.

**Benign** imports the 168 non-twin controls with their existing targets and
evidence tiers. Each control asserts scanner-wide silence. Taxonomy summaries
separate identifiers, encoded values, placeholders, references, near misses and
documentation. Targets are authored case attribution, not a claim that an
adapter reported a particular detector. Unassigned controls remain visible.

**Metamorphic** transforms every non-twin fixture, including controls and T0
observations. Operators add a Unicode prefix or indentation, normalize LF to
CRLF without doubling existing CRLF, and wrap eligible single-line text in
quotes, JSON or Markdown. JSON/quote operators reject inputs needing escaping.
Every secret and envelope boundary is mapped during construction, including
multiple spans and multibyte text. Absolute assertions require correct transformed
ranges; `same-detection` requires both absolute assertions to pass and preserves
the span-outcome vector (or silence). Two misses cannot pass an invariant.
Changing a context can expose a masking-policy boundary; it does not by itself
prove a provider-format defect.

**Mutation** reuses authored twins and adds deterministic length-minus-one,
length-plus-one, replace-last-character and invalid-alphabet operators to eligible
single-secret lexical contracts. Structured keys/JWTs and AWS pairs do not receive
arbitrary lexical operators. Existing authored twins retain their reviewed
expectations. A mutation still satisfying the source contract keeps a derived
positive expectation. A failed full-token regex is **not** automatically a
negative: valid substrings and independent contextual findings may remain.
Such mutations use `review-required`, become T0, produce observations without
scores, and enter the review queue. No expectation depends on scanner output.

**Differential** compares each canonical fixture between redact-secret and each
selected peer independently. It records `none`, `redact-secret-only`, `peer-only`
or `range-disagreement`, plus normalized observations even for agreements.
Every disagreement enters a stable-ID review queue. Missing/error observations
are incomplete comparisons, never empty findings. Agreement is not truth and
creates no assertion pass. Current adapters expose ranges only: classification,
action, and redaction parity are explicitly unsupported by this method.
Existing `npm run test:redaction` still exercises published npm redaction parity.

## Evidence and interpretation

Reports contain per-case observations, assertions, failure pointers and a review
queue. `byMethod`, `byDetector`, and `byTaxonomy` group assertion counts by scanner,
kind, tier and assertion type. Relations carry both source and candidate strata;
a T1-positive/T2-negative pair is never silently folded into a single tier.
There is no overall accuracy score. Counts of failed assertions may include an
absolute failure and its associated relation failure for the same variant.
Case attribution to multiple targets can appear under multiple detector views;
do not sum those views as independent samples.

Presence assertions accept EXACT or COVERED with zero collateral outside all
authored envelopes. OVERBROAD is visible in the existing lattice and fails this
engine's stricter preservation assertion. This does not redefine the benchmark's
leaked-span or historical twin metrics. T0 is always unscored.

Provenance records source category/fixture pointers, case/source/content hashes,
generation seed, method/operator versions, parameter hashes, scanner versions
and modes, git revision/dirty status, lockfile hash and runtime. Generation is
deterministic; timestamps, run ID and scanner durations naturally vary. Source
corpora are still draft pending independent human review; a source-backed
contract is not a claim of independent corpus review or provider issuance.

Only ranges, metadata and hashes reach JSON reports; no fixture content, matched
value, or raw scanner error is serialized. Scratch inputs are created under a
fresh private temporary directory with mode-0600 files and removed in `finally`.
Scanner verification settings and process limits remain those of the existing
adapters. This does not add a network sandbox or enable live verification.

Use the queue's case/variant identity and hashes to reproduce a finding, review
it against the source contract, then author a regression or update detector
implementation in the main repository. This command does not create external
issues, resolve its own queue by consensus, or change detector code.

## Verification

`npm test` includes registry extension, all-corpus deterministic generation,
UTF-8/envelope mapping, twin integrity, mutation review handling, differential
classification, scanner failures, report sanitization and scratch cleanup tests.
`npm run test:integration` exercises the real existing adapters; `npm run eval
-- --strict` exercises all five methods with all three installed scanners.
