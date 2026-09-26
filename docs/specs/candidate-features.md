# Candidate-feature dataset

Status: normative for beta.9
([#254](https://github.com/redact-secret/redact-secret-benchmarks/issues/254),
cross-repo parent
[redact-secret#767](https://github.com/redact-secret/redact-secret/issues/767)).
Implemented in
[`benchmarks/lib/candidate-features.ts`](../../benchmarks/lib/candidate-features.ts),
structure in
[`schemas/candidate-features-v1.json`](../../schemas/candidate-features-v1.json).
The publication boundary follows redact-secret's
`decision-freeze-the-shadow-evidence-score-and-confidence-contract` (§8, §11)
and [statistical tuning](statistical-tuning.md) §7.

The dataset is what offline threshold and model experiments
([#255](https://github.com/redact-secret/redact-secret-benchmarks/issues/255))
read: one row per candidate value from a reviewed fixture, with a small,
closed set of numeric and categorical features. It runs no scanner and does
not change the measurement-v4 scorer.

```sh
npm run features:extract            # -> results-output/calibration/candidate-features-v1.json
npm run features:extract -- --output=results-output/calibration/<name>.json
npm run features:check-public       # CI: no dataset in public/ or dist/
```

## 1. Inputs and partitions

- Categories come only from `corpora/development/manifest.json`
  (`partition: "development"`, `tuningEligible: true`) and
  `corpora/regression/manifest.json` (`partition: "regression"`,
  `tuningEligible: false`, evaluation-only). Each corpus must resolve,
  including through symlinks, inside `fixtures/`, `corpora/development/` or
  `corpora/regression/`.
- **Holdout is never read.** No path under `holdout/` is opened except the
  checked-in holdout manifests. Their ids, corpus hashes and seed hashes are
  read only so that the build can refuse a dataset that names one. The
  dataset records `holdoutAccess: "none"`. Adversarial packs and #289 abuse
  variants are not inputs either.
- T0 fixtures are pending review and have no ground truth. They are left out
  and counted in `corpora[].excluded.pendingT0Fixtures`.
- `corpusHash` is the SHA-256 of the corpus file's bytes, the same value
  `benchmarks/pin-manifest.json` records, so a tuning manifest's per-category
  `corpusHash` can be checked against the dataset.

## 2. Candidates per fixture

| Fixture | Candidates | `candidateSource` | `role` |
| --- | --- | --- | --- |
| has expected spans | one per expected span, in authored order | `expected-span` | the span's `secret` or `companion` |
| has no expected span (a control) | its longest token | `control-longest-token` | `none` |

A **token** is a maximal run of Unicode scalar values that are neither
whitespace (`\s`) nor one of ``" ' ` = : , ; ( ) [ ] { } < > |``. The
longest token is the one with the most scalar values, the earliest on a tie.
A control with no token (empty or whitespace-only content) contributes no
row and is counted in `excluded.controlsWithoutToken`. This rule is the
benchmark's own. It is not product candidate generation, and a row does not
say the product would emit a candidate there.

Ground truth is copied, never derived: `kind` and `tier` come from the
fixture's `assessment`, `role` from its span, and `contract`, `contextAxis`,
`twinOf` and `mutationKind` from the fixture. `family` is the contract, or
`uncontracted`. `targets` are the fixture's `fixture-detectors.json`
detectors plus arrival targets, sorted. No feature value ever changes any of
these fields.

`origin` is what a tuning manifest's generated-share cap counts
(statistical tuning §5), and `originBasis` says why (`candidate-features/2`,
#255):

- `authored-corpus`: the corpus is outside `fixtures/generated/`; the row is
  `authored`.
- `generator-literal`: the corpus is generated, but the whole candidate
  value appears verbatim (as written, or with JSON string escapes) in a
  generator module under `fixtures/generated/`. A person typed it, so the
  row is `authored`. This is how a placeholder, a reference or a word in
  prose inside a generated corpus is counted.
- `generator-computed`: anything the generator computed, including a
  seeded body, a concatenation and a one-character mutation of a seeded
  body. The row is `generated`.

The rule errs towards `generated`, the direction the cap guards. The dataset
still records every generated development row, but the shadow-scoring
partition admits only reviewed authored categories to fitting and keeps the
generated-heavy categories as `development-evaluation`
([calibration experiments](calibration-experiments.md) §7).

## 3. Feature definitions

### Core vector (`evidence-features/v1`)

`features` is redact-secret's shadow evidence feature vector, schema
**`evidence-features/v1`**: 27 unsigned integers in a fixed order. There is
one definition, redact-secret's
[`docs/specs/engine.md`, "Shadow evidence feature schema"](https://github.com/redact-secret/redact-secret/blob/d7733632bb05082710f71b6684ccf60c7a69377e/docs/specs/engine.md#shadow-evidence-feature-schema)
(redact-secret#769), and
[`benchmarks/lib/evidence-features.ts`](../../benchmarks/lib/evidence-features.ts)
reproduces it. The dataset records that identity in `featureSchema`: the
schema id, the core source revision
(`d7733632bb05082710f71b6684ccf60c7a69377e`), the SHA-256 of the core spec
page and of `features.rs` and `fixed_point.rs` at that revision, the
256-symbol bound and the 27 names in vector order. The tests reproduce the
spec's eight golden vectors and its `log2_q16` reference values.

The core page is normative. In summary:

- The symbol is the Unicode scalar value. Only the first 256 symbols
  (`n = min(total, 256)`) are analysed; `byte_len` is the whole value's
  UTF-8 length and `truncated` says whether symbols were dropped.
- Integer arithmetic only. Q16 values are `real × 65536`;
  `log2_q16` is the core's exact truncating algorithm (implemented with
  `BigInt`); `permille(a, b) = floor(1000·a/b)`, 0 when `b = 0`; every
  division floors, and `a ⊖ b = max(0, a − b)`.

| # | Name | Definition |
| --- | --- | --- |
| 0 | `byte_len` | UTF-8 byte length of the whole value (saturating at `2^32 − 1`) |
| 1 | `analysed_chars` | `n` |
| 2 | `truncated` | 1 when the value has more than 256 symbols |
| 3 | `distinct_symbols` | `d` |
| 4 | `max_symbol_count` | `c_max` |
| 5 | `shannon_entropy_q16` | `H = log2_q16(n) ⊖ floor(Σ c_x·log2_q16(c_x) / n)` |
| 6 | `min_entropy_q16` | `log2_q16(n) ⊖ log2_q16(c_max)` |
| 7 | `information_bits_q16` | `n × H` |
| 8–13 | `class_lower` … `class_non_ascii` | symbols per class: `a–z`, `A–Z`, `0–9`, other U+0021–U+007E, U+0000–U+0020 and U+007F, U+0080+ |
| 14 | `class_count` | classes present |
| 15 | `class_transitions` | adjacent symbol pairs whose class differs |
| 16 | `class_alphabet_size` | `A`: 26, 26, 10, 32, 34 per ASCII class present, plus the distinct non-ASCII symbols |
| 17 | `entropy_efficiency_permille` | `min(1000, permille(H, log2_q16(d)))` when `d ≥ 2` |
| 18 | `alphabet_efficiency_permille` | `min(1000, permille(H, log2_q16(A)))` when `A ≥ 2` |
| 19 | `distinct_ratio_permille` | `permille(d, n)` |
| 20 | `length_permille` | `permille(n, 256)` |
| 21 | `longest_run` | longest run of one symbol |
| 22 | `adjacent_repeat_permille` | `permille(#{s[i] = s[i−1]}, n ⊖ 1)` |
| 23 | `repeated_bigram_permille` | `permille(#{bigrams seen earlier}, n ⊖ 1)` |
| 24 | `smallest_period` | smallest `p ∈ [1, ⌊n/2⌋]` with `s[i] = s[i+p]` throughout, else 0 |
| 25 | `max_autocorrelation_permille` | max over lags `k ∈ [2, min(32, ⌊n/2⌋)]` of `permille(#{s[i] = s[i+k]}, n − k)` |
| 26 | `max_autocorrelation_lag` | smallest lag reaching feature 25, else 0 |

The features are measurements. They carry no weight, cap or threshold.
Those belong to #255 and the product's scoring artifact (redact-secret#798).
When the core schema changes, it gets a new id; this repository then updates
`evidence-features.ts`, its pinned `CORE_FEATURE_SCHEMA` and the golden
vectors, and bumps `extractor.version`.

### Benchmark-only fields

`contextClass` and `negativeClass` below, and the ground-truth and split
fields in section 2, are this repository's. They are not part of the core
feature schema and stay outside the `features` vector. Where the core adds
contextual or negative-evidence signals (#770, #771), those definitions will
replace these on reconciliation.

### Contextual evidence class (`contextClass`)

Read from the candidate's own line only: up to 64 scalar values before it
(`before`), and the rest of the line after it (`after`, a trailing `\r`
dropped). The first class that applies, in this order:

1. `url-userinfo`: `before` ends with `scheme://user:` (`/[a-z][a-z0-9+.-]*:\/\/[^\s/@:]*:$/i`)
   and `after` starts with `@`.
2. `authorization-header`: `before` ends with `authorization` `:`/`=` and an
   optional `bearer`/`basic`/`token`/`digest` scheme, or with a bare
   `bearer `/`basic `.
3. `credential-name` / `other-name`: `before` ends with an assignment
   (`NAME` + optional quote or `]` + `:=`, `=>`, `=` or `:` + optional quote)
   or a CLI flag (`--NAME=` or `--NAME `). `NAME` is normalized (camelCase →
   snake_case, lower-case, `.` and `-` → `_`) and split on `_`. It is
   `credential-name` when a segment is one of `apikey auth bearer credential
   credentials key pass passwd password pwd secret token`, otherwise
   `other-name`. This vocabulary is the benchmark's, deliberately coarse, and
   not the product's name list.
4. `bare`: none of the above.

### Negative-evidence class (`negativeClass`)

The product contract (§6) allows negative evidence only when the **whole**
value matches a named grammar. Here the value either is the delimited form,
or is the entire interior of delimiters that immediately surround it on its
line. The first class that applies:

1. `template-reference`: `{{ … }}` with no inner brace.
2. `environment-reference`: `${NAME}` (with optional `:-default`), `$NAME`
   or `%NAME%`, `NAME` being `[A-Za-z_][A-Za-z0-9_]*`.
3. `command-substitution`: `$( … )` with no inner parenthesis, or a
   backtick-delimited value.
4. `angle-placeholder`: `<` `[A-Za-z0-9_ .-]+` `>`.
5. `mask`: three or more of one symbol from `* x X • # . - 0`.
6. `placeholder-vocabulary`: split on `[_\-.\s]+`, every word (lower-cased)
   is in the placeholder vocabulary (`a access an api auth change changeme
   client dummy example fake goes here id insert key me my nil none null
   password placeholder redacted replace replaceme sample secret tbd the
   todo token undefined value your`) and at least one is a marker
   (`changeme dummy example fake here insert nil none null placeholder
   redacted replace replaceme sample tbd todo undefined your`).
7. `dotted-reference`: an identifier path with at least one `.`
   (`process.env.API_KEY`, `secrets.TOKEN`).
8. `none`.

A prefix, suffix or substring resemblance is never negative. A value that
starts with `EXAMPLE` and continues with random-looking material is `none`.

## 4. Schema, identity and determinism

The dataset (`schemaVersion: 1`, `datasetType: "candidate-features"`,
`visibility: "maintainer-local"`) records:

- `extractor.version`: `candidate-features/2` (`/2` added the per-row
  `originBasis`). Any change to the core
  feature schema it follows, a class vocabulary, the candidate rule or a row
  field bumps it.
- `extractor.sourceHash`: SHA-256 over the canonical JSON of
  `[{file, sha256}]` for `benchmarks/lib/evidence-features.ts`,
  `benchmarks/lib/candidate-features.ts` and `benchmarks/candidate-features.ts`.
- `featureSchema`: the core schema id, repository, source revision, the
  SHA-256 of the core files it was reproduced from, the 256-symbol bound and
  the feature names in vector order.
- `benchmark`: the commit and whether the tree was dirty. A dirty dataset is
  not citable in a tuning manifest.
- `datasetHash`: SHA-256 over the canonical JSON of every field except
  `benchmark`, `datasetHash` and `manifestBinding`. The same inputs and
  extractor therefore give the same hash on any commit.
- `manifestBinding`: exactly the `featureDataset` block a tuning manifest
  records (`schemaVersion`, `extractorVersion`, `extractorSourceHash`,
  `datasetHash`).
- `corpora[]`: per category, the partition, origin, corpus path and hash,
  and row counts by origin, per family and per `contextClass`. These have
  the same shape as a tuning manifest's `corpora.tuning[]` counts.

Rows are sorted by category, then fixture order, then candidate index. The
output has no timestamp. Two runs over the same tree are byte-identical.

## 5. Publication boundary

Candidate-level rows, feature vectors and anything fitted from them are not
public benchmark data.

- A row carries identity (category, fixture id, candidate index, UTF-8
  range), authored ground truth, closed-vocabulary classes and integer
  features. It never carries candidate bytes, a substring of them, a
  character-class run, or any hash of the value. The build refuses a
  dataset in which any string contains an expected-span value of eight or
  more scalar values (`assertNoCandidateBytes`), or names a holdout
  identifier or `holdout/` path (`assertNoHoldout`).
- The dataset is written only under `results-output/`, which is
  git-ignored and never part of the site build. Any other `--output` is
  refused. The file is created with mode `0600`.
- `npm run features:check-public` (CI, after `npm run build`) fails if any
  file under `public/` or `dist/` is named `candidate-features*` or embeds
  the dataset's markers, or if `results-output/` stops being ignored.
- Public projection may report aggregate security outcomes per stratum and
  the dataset's identity (`extractor.version`, `extractor.sourceHash`,
  `datasetHash`), and nothing else from this file.
