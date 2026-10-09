# PII scorer basis: the measurement-to-product boundary (#795)

Status: benchmark-side record. This repository measures and records; it asserts no product output. The decision on which protocol defines a product value is
[`docs/decisions/2026-10-07-propose-the-pii-scorer-basis-and-metric-semantics.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-07-propose-the-pii-scorer-basis-and-metric-semantics.md),
**status: accepted by the owner, 2026-10-06** (scorer, denominator and label decision only; source: issue #795 comment 6028908779). PII authority stays `legacy` (`benchmarks/pii-authority.json`, #666), the new artifacts are
exploratory, and no threshold, tolerance, membership, suppression or support verdict changes. Nothing here reads or needs EC2, the custodian, the private ledger or a protected corpus.

## Two protocols, ten shared ids

| Protocol | Owner | Where | Population unit |
| --- | --- | --- | --- |
| `pii-v1` (revision 2) | `pii-eval` (scanner-neutral observations, versioned accounting, deterministic replay) | schema 1.4 artifacts in `benchmarks/pii-eval-population-dual-run/` | authored occurrences of the metric's own kind (valid-type occurrences, authored-sensitive occurrences, axis assertions) |
| `b11` | benchmarks (authored population selection, product scorer, thresholds, status, qualification, publication) | `b11ScoreTable` in `benchmarks/evaluation/domains/pii/beta11-qualification.ts`, frozen Beta.13 report | scored cases of a family and view, split by authored sensitivity |

The registry is `benchmarks/evaluation/domains/pii/metric-basis.mjs`: each quantity is `<protocol>:<metric id>` with one name, one population, one numerator, one denominator and one owner. A consumer shows the
quantity name; a bare metric id is never a label (`web/resolvers/domains.ts` does). `tests/pii-metric-basis.test.mjs` holds it.

**Published labels (accepted projection).** The published support matrix (`pii-support-matrix-v2`) states the quantity of every `pii-v1` metric it carries: each metric entry (population, family and view rows, language and control-class strata) has `quantity: "pii-v1:<id>"` beside the bare `metric.id`, and `piiEvalMeasurement.quantityBasis`
defines the ten quantities (name, owner, population, numerator, denominator) and states `verdictReads: "b11"` and `thresholdsApplied: false`. Labels are derived from the registry in `support-v2.ts`, never typed; a matrix with a missing, swapped or redefined label is refused (`tests/pii-quantity-labels.test.mjs`).
A consumer of the JSON therefore sees `pii-v1:type-miss-rate` ("valid-type occurrence miss rate (generic, every context)"), which cannot be read as the `b11` sensitive miss. The metric values are the artifact's, untouched.

## Per-metric table

Interval for every metric of both protocols: Wilson bound at z = 1.96, precision 6, minimum denominator 4 (`qualification/pii-v1.json` mechanics, `pii-v1-wilson-exact`); a denominator below 4 is withheld as `insufficient-evidence`, a zero one as `zero-denominator`.
`pii-v1` effective N is the measured samples for nine metrics and the eligible samples for `measurable-share`. Both protocols are reported per (population, family) cell and per population; a rate is never pooled across families, populations or metrics.
Consumers: **M** = the PII support matrix (`pii-support-matrix-v2`, `scripts/publish-pii-support.ts`, `piiEvalMeasurement`), **W** = the Next `/evaluation/pii/` rows (`web/services/domains.ts`, `web/resolvers/domains.ts`), **V** = the legacy view gate and thresholds of `qualification/pii-v1.json` (`b11ViewGate`, support classification), which read `b11` only.

| Metric id | `pii-v1` quantity (numerator / eligible population) | `b11` quantity (numerator / denominator) | Same counts in the data | Applicability | Consumers |
| --- | --- | --- | --- | --- | --- |
| `type-miss-rate` | valid-type occurrence miss rate, **generic, every context**: type state `miss` / authored valid-type occurrences, including benign contexts correctly left unflagged | sensitive case without any finding / scored sensitive cases | no | schema-only and every method; every view | pii-v1: M, W. b11: V |
| `wrong-family-rate` | valid-type occurrences whose type state is `wrong-family` / valid-type occurrences | sensitive cases found as another family / scored sensitive cases | no (denominators differ) | every view | pii-v1: M, W. b11: V |
| `wrong-jurisdiction-rate` | valid-type occurrences with a jurisdiction, `wrong-jurisdiction` / those occurrences | SSN sensitive cases flagged under the foreign selection / scored sensitive cases | no | jurisdictional families only (SSN) | pii-v1: M, W. b11: V |
| `sensitive-miss-rate` | authored-sensitive occurrence miss rate: sensitivity state `miss` / authored-sensitive occurrences | sensitive case not detected exactly / scored sensitive cases | **yes, in every cell** | every view | pii-v1: M, W. b11: V |
| `non-sensitive-flag-rate` | authored-non-sensitive occurrences flagged / authored-non-sensitive occurrences | non-sensitive scored cases flagged / non-sensitive scored cases | **yes, in every cell** | every view | pii-v1: M, W. b11: V |
| `context-discrimination-rate` | complete context trios whose endpoints both pass / complete trios (method `context-discrimination`) | twin pairs both correct / twin pairs | no | not applicable on converted `schema-only` populations (reported `not-applicable`, 0 eligible) | pii-v1: M, W. b11: V |
| `benign-suppression-rate` | authored benign cases that pass (method `pii-benign`) / resolved authored benign cases | scored cases that are not authored sensitive with no finding / those cases, **authored not-established counted as benign** | no | not applicable on converted `schema-only` populations | pii-v1: M, W. b11: V |
| `jurisdiction-collision-rate` | collision cases whose family and jurisdiction pass (method `jurisdiction-collision`) / resolved collision cases | SSN scored cases unflagged under the foreign selection / scored cases | no | not applicable on converted `schema-only` populations | pii-v1: M, W. b11: V |
| `range-collateral-rate` | reported spans for authored valid type that are overbroad or partial / exact, overbroad or partial spans | findings of the family not overlapping the case target / findings of the family over scored cases | counts equal in some cells, not all | reported-span families; `pii-v1` denominators are located spans, `b11` all findings | pii-v1: M, W. b11: V |
| `measurable-share` | resolved pass or fail axis assertions / all eligible axis assertions, **unresolved included** (two per membership) | scored cases / cases of the view | no | every view; effective N is the eligible count | pii-v1: M, W. b11: V |

The per-cell numbers behind "same counts" (numerator, denominator or eligible, effective N, interval, status, and the before figures) are in the derived record
[`docs/generated/pii-scorer-basis.json`](../generated/pii-scorer-basis.json) (`node scripts/pii-scorer-basis.mjs --check`; `npm run pii:scorer-basis:check`). It is regenerated, never typed.

## Ownership split

| Concern | Owner |
| --- | --- |
| Case and variant generation, the two outcome axes, matching, the ten `pii-v1` accounts, intervals, withheld reasons, replay, artifact schema | `pii-eval` |
| Which authored memberships form a population, which cases are scored, the product scorer `b11ScoreTable`, the consumer (`pii-eval-artifact-consumer.mjs`), thresholds, support status, qualification and publication | benchmarks |
| Signing, freshness, revocation, protected execution, private audit | custodian and ledger: out of scope, no dependency of this record |

## Not-established memberships

156 of 1,188 memberships (oracle-plan 51, qualification-plan 36, diagnostic-balanced 49, benign-heavy-stress 20) are authored with identity `not-established`, sensitivity `not-established` and no candidate range.
They are separate from the scorer definition: pii-eval schema 1.4 (ADR 0017, 0018) carries them and reports `unresolved` on both outcome axes and the range, action `not-measured`, never a pass or a fail.
Under `pii-v1` such a membership is outside every numerator, denominator, effective N and interval except `measurable-share`, where it adds two `unresolved` assertions. Under `b11` the authored sensitivity `not-established`
(a wider set than the 156: it also covers located memberships) is scored as benign: a finding on it is a `false-alarm` inside `benign-suppression-rate`. That coercion is named in the registry (`coercesNotEstablished`) and is not changed here.
A consumer must carry the memberships (`unresolvedRangeCases`), never drop them and never read unknown as valid or invalid.

## Boundary cases (hand-calculated; `tests/pii-metric-basis.test.mjs`)

Four memberships of one family and view: c1 sensitive, found exactly; c2 sensitive, not found; c3 authored non-sensitive valid-type in a benign context, not flagged; c4 authored not-established, flagged.

| Quantity | `b11` (run through `b11ScoreTable`) | `pii-v1` (by the registry definitions) |
| --- | --- | --- |
| type miss | `type-miss-rate` 1/2 (c2) | `type-miss-rate` 2/3 (c2 and the benign c3, which has a valid type and no finding); c4 outside |
| sensitive miss | 1/2 | 1/2 (equal) |
| non-sensitive flag | 0/1 | 0/1 (equal) |
| benign suppression | 1/2 (c3 absent, c4 counted benign and flagged) | not applicable on `schema-only`; c4 unresolved |
| measurable share | 4/4 | 6 resolved of 8 axis assertions (c4 contributes two `unresolved`) |

## Before and after the 1.4 handoff (pii-v1, sum of the six family cells of a population; descriptive)

Before is the schema 1.2 artifact (only the memberships with a located range); after is schema 1.4 (all memberships). Every located numerator, eligible count, effective N and interval is unchanged; only `total`, `notApplicable` and the `measurable-share` denominator grow.

| Population | Memberships before → after | `type-miss-rate` before → after | `sensitive-miss-rate` | `measurable-share` before → after |
| --- | --- | --- | --- | --- |
| oracle-plan | 95 → 146 | 43/79 → 43/79 | 0/36 → 0/36 | 148/190 → 148/292 |
| qualification-plan | 230 → 266 | 15/191 → 15/191 | 0/176 → 0/176 | 407/460 → 407/532 |
| diagnostic-balanced | 428 → 477 | 143/356 → 143/356 | 0/213 → 0/213 | 678/856 → 678/954 |
| benign-heavy-stress | 279 → 299 | 179/247 → 179/247 | 0/68 → 0/68 | 394/558 → 394/598 |

The `b11` counterparts are `type-miss-rate` 0/36, 0/176, 0/213, 0/68 and `measurable-share` 146/146, 265/266, 477/477, 299/299. `pii-v1` `measurable-share` fell because uncertain samples now count as unresolved; the minimum-denominator
and threshold mechanics are untouched, and no threshold is applied to a `pii-v1` number anywhere in this repository.

## Boundary

- The oracle comparison covers located memberships exactly (`scripts/run-pii-population-dual-run.mjs`, 0 unexplained differences; the range-less ones are checked against what the authors wrote).
- A `b11` verdict never reads a `pii-v1` number and the reverse; the matrix shows both under their quantity names, never combined.
- The accepted projection can be evaluated from the public synthetic artifacts and the frozen report alone.
