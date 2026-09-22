# Internal evaluation engine

Implements steps 1–4 of the [accepted decision](../decisions/2026-09-17-build-evaluation-engine-now.md):
the common engine, Twin and Benign, Metamorphic and Mutation, and Differential.
This is benchmark infrastructure for detector development. Holdout now has a
[separate lifecycle](../../holdout/README.md); the [v1 qualification suite](evaluation-engine-v1.md)
runs all six methods. Stable support claims and a public plugin API remain out of scope.

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
npm run eval -- --method=mutation --seed=experiment-1
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

Discovery assertions and disagreements do not fail the command. Scanner and transformation-generation errors
always do; `--strict` also fails on unavailable or unsupported scanners. `--fail-on-assertions`
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
| `benchmarks/engine/runner.ts`, `execution.ts` | The development boundary and shared generation/execution/report core. The isolated holdout lifecycle reuses the core without exposing row reports. |
| `scanners/index.mjs` | Published-package/Gitleaks/TruffleHog adapters. They receive input identity and content, without expectations, and retain explicitly mapped native detector families. |

This is an internal contract, intentionally free to evolve. A new method or
operator is a `.ts` module implementing `Method` or `Operator` from
`benchmarks/engine/types.ts`, plus registration in the corresponding `index.ts`; the engine and scanner integration need
no new method branch. The case loader is the initial corpus-to-case bridge;
additional case sources can use the same engine model. Duplicate registrations,
case IDs, variant IDs and paths are rejected. Development and regression are
the only accepted visibility values in ordinary runs; holdout requires its
isolated lifecycle entry point and cannot enter development reports.

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
single/double quotes, JSON, YAML or Markdown. JSON/quote operators reject inputs needing escaping.
Every secret and envelope boundary is mapped during construction, including
multiple spans and multibyte text. Absolute assertions require correct transformed
ranges; `same-detection` requires both absolute assertions to pass and preserves
the span-outcome vector (or silence). Two misses cannot pass an invariant.
Changing a context can expose a masking-policy boundary; it does not by itself
prove a provider-format defect.

Every attempted operator is reported under `generation`, including unsupported
input/parameter combinations. Unsupported transformations do not produce fake
variants or assertions. Generation/validation errors are sanitized, recorded
separately under `generationErrors`, and fail the command; they are never
relation violations. The remaining valid variants still run. Operator IDs must
be unique within a case; unknown operators remain configuration errors.

**Mutation** exercises prefix, alphabet, length, boundary and structural
properties through registered operators:

| Operators | Scope / expectation |
| --- | --- |
| `lexical.length-minus-one`, `lexical.length-plus-one` | Single-secret T1/T2 lexical contracts; preserve when the changed value still satisfies the contract, otherwise defer. |
| `lexical.replace-last`, `lexical.invalid-alphabet` | Same lexical scope; validity is checked against the source contract. |
| `lexical.prefix-change` | Seed chooses a different prefix character; resolved numeric `choice` can be supplied for replay. |
| `boundary.remove-delimiter` | Seed chooses an existing dot, underscore or dash to remove; resolved numeric `index` can be replayed. |
| `structural.remove-segment` | SendGrid and Slack segmented lexical contracts only; seed chooses a non-prefix segment, recorded as `index`. |
| `authored.twin` | Existing reviewed twin expectation; `must-flip` and integrity checks. |

All non-twin source fixtures enter the mutation attempt matrix so unsupported
families and controls remain visible. PEM/DER/JWTs and multi-secret AWS pairs do
not receive arbitrary lexical/segmented mutations. A failed full-token regex is
**not** automatically a negative: valid substrings and independent contextual
findings may remain. Such mutations use `review-required`, become T0, and enter
the review queue. `expectationEffect` explicitly declares `preserve`,
`invalidate` (authored twin), or `defer`; it never depends on scanner output.

Default seeds derive from source category/fixture identity. `--seed=experiment-1`
names a reproducible experiment and salts those source seeds. Resolved numeric
parameters, source/content/transformation hashes and operator versions accompany
each generated variant. `byOperator` counts generated, unsupported and errored
attempts and groups assertions by method/scanner/tier. Failure entries include
the responsible transformation. Seed changes can produce the same finite choice;
they are not guaranteed to produce unique variants.

**Differential** compares each canonical fixture between redact-secret and each
selected peer independently. It records `none`, `redact-secret-only`, `peer-only`,
`range-disagreement` or `classification-disagreement`. Native labels are mapped
explicitly in `scanners/families.mjs`; unknown labels remain unmapped. Family
comparison requires identical observed ranges and complete mappings on both
sides. Otherwise classification is `unsupported`, while range comparisons remain
available. Case target labels never substitute for observed detector families.
Findings are deduplicated and sorted; output ordering cannot create disagreements.
Classification and ranges are retained for agreements as well as disagreements.

Every disagreement enters a stable-ID review queue containing input path and
content/fixture hashes, observed ranges and families, tool versions, adapter
configuration and its hash. IDs are stable for identical evidence and change
when tool versions/configuration/input/observations change. Source pointers and
seeds in the enclosing case permit reconstruction without persisting input text.
Missing/error observations yield incomplete comparisons, never empty findings.
An adapter that declares byte ranges unsupported is reported as `unsupported`
and is not executed. This is distinct from unavailable binaries, execution errors,
and a supported scanner returning no findings. Silence alone does not prove
that a scanner lacks a rule. Agreement creates no assertion pass and changes no
authored expectation. Redaction/action parity remains unsupported by this method;
`npm run test:redaction` still exercises published npm redaction parity.

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
generation seed, method/operator versions, resolved numeric/boolean parameters and parameter hashes, scanner versions
and modes, git revision/dirty status, lockfile hash and runtime. Generation is
deterministic; timestamps, run ID and scanner durations naturally vary. Source
corpora are still draft pending independent human review; a source-backed
contract is not a claim of independent corpus review or provider issuance.

Schema version 2 adds generation attempts, operator coverage and differential evidence.
Only ranges, mapped family labels, metadata and hashes reach JSON reports; no fixture content, matched
value, or raw scanner error is serialized. Scratch inputs are created under a
fresh private temporary directory with mode-0600 files and removed in `finally`.
Scanner verification settings and process limits remain those of the existing
adapters. This does not add a network sandbox or enable live verification.

Use the queue's case/variant identity and hashes to reproduce a finding, review
it against the source contract, then author a regression or update detector
implementation in the main repository. This command does not create external
issues, resolve its own queue by consensus, or change detector code.

## Verification

`npm test` includes operator seed/replay tests, unsupported and generation-error
isolation, family comparisons, stable configuration-aware queues, registry extension, all-corpus deterministic generation,
UTF-8/envelope mapping, twin integrity, mutation review handling, differential
classification, scanner failures, report sanitization and scratch cleanup tests.
`npm run test:integration` exercises the real existing adapters; `npm run eval
-- --strict` exercises all five methods with all three installed scanners.

### Issues #5–#7 acceptance evidence (2026-09-17)

| Issue | Implementation and verification |
| --- | --- |
| [#5 Metamorphic](https://github.com/redact-secret/redact-secret-benchmarks/issues/5) | Eight context/encoding operators; source and transformation provenance; absolute and relation assertions; explicit unsupported attempts and isolated generation errors. |
| [#6 Mutation](https://github.com/redact-secret/redact-secret-benchmarks/issues/6) | Registered prefix/alphabet/length/boundary/structural operators, seed-driven choices with parameter replay, explicit preserve/invalidate/defer effects, operator coverage and failure attribution. |
| [#7 Differential](https://github.com/redact-secret/redact-secret-benchmarks/issues/7) | Three normalized adapters, mapped-family/range comparisons, stable evidence-bearing review entries, distinct unsupported/unavailable/error states; authored expectations unchanged. |

The unit suite passed **132 tests**. All **6 real-adapter integration tests**,
strict TypeScript checking, the production build and fixture-storage checks
also passed. The integration controls verify GitHub family mapping for each
adapter independently of expected ranges.

```sh
npm run eval -- --method=metamorphic,mutation,differential --strict --output=results-output/issues-5-7.json
```

The local macOS arm64 run completed with redact-secret **0.1.0-beta.4**,
Gitleaks **8.30.1**, and TruffleHog **3.97.4**. It evaluated **1,703 cases**
(549 Metamorphic, 549 Mutation, 605 Differential), **4,815 variants**, and
reported **zero generation errors**. All three scanners completed successfully.

The report contains **2,806 failed discovery assertions** and **1,381 review
entries**. Of these entries, 414 are differential disagreements: 372
redact-secret-only, 15 peer-only, 25 range disagreements, and 2 mapped-family
disagreements. The other 967 entries are deferred mutation expectations.
There were 340 comparisons with comparable family labels; 870 lacked complete
family/range comparability (including empty or differing ranges).

These are reproducible development observations, not independent samples,
confirmed detector defects, or release qualification. Related absolute and
relation failures may count the same behavior twice. Full sanitized evidence
is in the gitignored report generated by the command above.
