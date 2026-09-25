# PII readiness of the beta.9 evidence model (#258)

**No beta.9 PII support claim.** This is a design study. It adds no PII
detector, fixture, corpus entry, category or detector assignment, and it
measures no product output. Every value below is reserved, a published test
or format example, a mask, or synthetic. None belongs to a real person.
Redact Secret's architecture still lists PII detection as a non-goal
([ARCHITECTURE.md](https://github.com/redact-secret/redact-secret/blob/275f633e854139c9ba73add6d1e0da4635261699/ARCHITECTURE.md)),
so PII in beta.10 needs a product decision before any of the extensions below.

**Result.** The evidence model's structure carries over to PII: five groups,
halving under caps, monotonicity, integer arithmetic and whole-value negative
grammars. Its fitted content does not. Under `evidence-aggregation/v1`, all 25
PII study shapes score `none` or `low`. The shapes move only when the
credential vocabulary or string length moves them. A Luhn-valid test PAN and
its Luhn-invalid twin get the same band. Evidence strength and sensitivity are
different axes, and PII is the first place they come apart.

## Inputs and method

| What | Identity |
| --- | --- |
| Harness | [`benchmarks/studies/pii-readiness.ts`](../../benchmarks/studies/pii-readiness.ts) (`pii-readiness-study/1`), `npm run study:pii-readiness`, tests in [`tests/pii-readiness-study.test.mjs`](../../tests/pii-readiness-study.test.mjs) |
| Features | `evidence-features/v1` via [`benchmarks/lib/evidence-features.ts`](../../benchmarks/lib/evidence-features.ts) ([candidate features](../specs/candidate-features.md) §3) |
| Context and negative classes | the benchmark's `contextClass` and `negativeClass` (same spec, §3) |
| Band | a study mirror of the constants in redact-secret [`engine.md`, "Shadow evidence aggregation"](https://github.com/redact-secret/redact-secret/blob/275f633e854139c9ba73add6d1e0da4635261699/docs/specs/engine.md#shadow-evidence-aggregation) at `275f633e`: randomness ramp on Shannon entropy (about 3.88 to 4.78 bits, cap 60), credential context 40, strict negative 140, bands `low` 7, `medium` 43, `high` 61 |
| Contract | [`decision-freeze-the-shadow-evidence-score-and-confidence-contract`](https://github.com/redact-secret/redact-secret/blob/275f633e854139c9ba73add6d1e0da4635261699/docs/decisions/2026-09-25-freeze-the-shadow-evidence-score-and-confidence-contract.md) |
| Shapes | NANP 555-0100..0199 phone numbers; RFC 2606 / 6761 email domains; SSN areas 000, 666 and 9xx (never assigned); card-network and processor test PANs plus a one-digit Luhn-invalid twin; RFC 5737 / 3849 documentation addresses; the Unix epoch date in two contexts; the canonical ISBN-13 checksum example; a published IBAN format example; three masks; one synthetic credential for reference (a core golden-vector string) |

The study scores each shape as if the product had emitted it as an
`entropy` or `contextual` candidate. No PII candidate exists in the product,
so the question is what the model would do, not what it does. Only bands and
entropy are shown. Per-shape scores and group contributions are left out, as
section 11 of the contract asks for benchmark output. These are
documentation shapes, not corpus candidates, but the same rule applies.

## Observations

Entropy (`shannon_entropy_q16` in bits), context class and v1 band, grouped.
The harness prints every row.

| Shapes | Entropy (bits) | Context class | Validation | Reserved range | v1 band |
| --- | ---: | --- | --- | --- | --- |
| phone, 5 rows | 1.81 to 2.69 | `bare` / `other-name`; `credential-name` only under `password=` | none | 555-01xx | `none`; `low` under `password=` |
| email, 3 rows | 3.52 to 4.08 | `other-name` | none | example domains | `none`; `low` for the 50-character address |
| SSN, reserved areas, 3 rows | 2.55 to 3.28 | `other-name` | structure fails | never assigned | `none` |
| SSN masks `000000000`, `XXX-XX-XXXX`, `***-**-****` | 0.00 to 0.68 | `other-name` | structure fails | | `none`. Only the unsegmented mask matches the `mask` grammar |
| PAN, 4 test + 1 Luhn twin | 0.34 to 3.01 | `other-name` | Luhn pass; the twin fails | test PAN (not the twin) | `none`, twin included |
| IP documentation, 2 rows | 2.45 to 2.66 | `other-name` | none | RFC 5737 / 3849 | `none` |
| date, `dob=` vs `release_date=` | 2.17 | `other-name` both | none | | `none` both |
| ISBN-13, IBAN example | 3.10, 3.79 | `other-name` | checksum pass | | `none` |
| synthetic credential under `API_KEY=` | 5.00 | `credential-name` | | | `high` |

Checksum strength, from exact enumeration: a pass rate `r` among random
inputs of the same shape carries at most `log2(1/r)` bits of evidence.

| Check | Pass rate | Bits |
| --- | ---: | ---: |
| Luhn (PAN) | 1 / 10 | 3.32 |
| ISBN-13 | 1 / 10 | 3.32 |
| IBAN mod-97 | about 1 / 97 | 6.60 |
| SSN structure (area, group, serial) | 0.889 | 0.17 |

For comparison, credential checksums (for example GitHub's 32-bit token
checksum) carry about 32 bits.

## 1. Which evidence groups transfer directly

| Group | Mechanism | v1 content | For PII |
| --- | --- | --- | --- |
| `randomness` | transfers | ramp fitted to credentials | **Not as positive evidence.** PII values come from small alphabets with fixed structure, so their entropy stays below the ramp (all but one row score 0). Where entropy is higher, it tracks length, not secrecy: the long reserved email crosses the ramp start and reaches `low` with no other evidence. For PII the features are useful the other way round, as placeholder and sequence detectors (`smallest_period`, `longest_run`, `adjacent_repeat_permille` flag `000000000` and runs such as `4111…`). |
| `lexical` | transfers directly | cap 0, no signal | **The best fit.** PII formats are lexical: segment lengths, separators, class layout. `evidence-features/v1` has class counts and `class_transitions`, but no segment-length profile, so `XXX-XX-XXXX` and `123-45-6789` look similar to it. |
| `contextual` | transfers | credential name vocabulary | **Mechanism yes, vocabulary no.** `patient_phone=` and `support_phone=` both give `other-name` and 0 points. `password=` in front of a phone number gives `credential-name` and `low`. PII context also appears as column headers, form labels and prose more than as assignments. |
| `validation` | transfers | no signal, cap 40 as a placeholder | **The group PII needs most.** Its points must scale with checksum strength. Luhn and ISBN-13 are worth 3.32 bits and SSN structure 0.17 bits, against about 32 for a credential checksum, so one flat cap would overstate them by an order of magnitude. The core's known limitation (context plus validation reaches `high` without randomness) is the right route for PII, but it needs a refit and a new model identity. |
| `negative` | transfers | strict whole-value grammars | **The rule transfers, the grammars do not.** `000000000` is a `mask`. `XXX-XX-XXXX` and `***-**-****` are not, because the `mask` grammar needs a single repeated symbol. The reserved ranges this study relies on (555-01xx, example domains, never-assigned SSN areas, test PANs, documentation IP blocks) are sets of values, not placeholder syntax. |

## 2. What needs a beta.10 evidence-model extension

Each item below changes feature semantics, group membership or caps, so each
is a new `evidence-features/vN` or `evidence-aggregation/vN` identity
(contract §10). None fits in v1.

1. **Base rates.** v1 has no notion of prevalence, and it does not need one:
   every true credential positive is a secret. A PII family needs a stated
   population with a benign base rate (support lines, sample addresses,
   order numbers that happen to pass Luhn). This belongs to calibration
   (benchmarks#255 §4), not to the product score.
2. **Validation strength.** Points per validation signal should be a function
   of its bits of evidence, capped per family. A 3.32-bit Luhn pass cannot
   be weighted like a 32-bit credential checksum. A failed checksum, like
   the PAN twin, should be recorded as a failure too. Today it is
   indistinguishable from "no validation signal".
3. **Context-sensitive sensitivity.** A second output alongside the
   evidence score (below), driven by context (`dob=` vs `release_date=`,
   `patient_*` vs `support_*`, a table's header row). This is not more
   `contextual` points.
4. **Reserved and documentation ranges as negative evidence.** Named,
   reviewed, whole-value reserved-range grammars (for example
   `nanp-fictional`, `rfc2606-domain`, `ssn-never-assigned`,
   `documented-test-pan`, `rfc5737-test-net`, `rfc3849-documentation`),
   with the same §6 rule: the whole value must match, nothing fuzzy. Plus a
   segmented-mask grammar (`XXX-XX-XXXX`, `***-**-****`), which the
   single-symbol `mask` misses. One trade-off needs a decision. A
   documented test PAN is Luhn-valid and reserved at the same time, so it
   is positive `validation` and `negative` at once. The negative cap has
   to cover validation, or the test value keeps a band.
5. **Detectable but not sensitive.** ISBN-13 and the IBAN format example
   pass their checksums as easily as a real PAN passes Luhn. "This is a
   well-formed identifier of kind K" and "this kind is personal data" must be
   separate facts. The first is evidence and the second is a property of the
   family.

## 3. Probability, confidence and sensitivity

The contract already separates the ordinal evidence score from a calibrated
probability (§1) and says a shadow band proposes a `Confidence` and never
states a probability (§2). PII needs a third quantity kept apart from both:

- **Confidence / band**: how sure the scanner is that the span is an
  instance of family K. An ISBN can be `high` and harmless.
- **Calibrated probability**: the frequency of true instances at a score, in
  one stated population. It changes with the base rate. In an illustrative
  population where one in a hundred 16-digit numbers is a real card number,
  a Luhn pass alone (likelihood ratio at most 10) gives a posterior of about
  9%, not 90%.
- **Sensitivity**: the harm of exposure, set by the family and its context
  (a date of birth vs a build date, a patient vs a support line). A
  `low`-confidence SSN fragment can be more sensitive than a `high`-confidence
  ISBN.

Three rules for beta.10 follow:

- A band must never be read as severity, and sensitivity must never raise a
  band.
- Policy actions for PII should key on family and sensitivity, with
  confidence as a gate, not as a proxy for sensitivity.
- Neither sensitivity nor a probability may appear as a score-named public
  field (contract §9).

For credentials these three coincide closely enough that conflating them has
been harmless. For PII they do not.

## 4. Benchmark stratification before PII arrives

Yes, stratification is needed before the first PII family arrives. Today the
strata are family, context and origin basis
([statistical tuning](../specs/statistical-tuning.md) §6), and `must-redact`
and `policy` spans are already reported apart
([calibration](../specs/calibration-experiments.md) §4). That precedent
extends as follows:

1. **Domain.** `credential` vs `pii`, never merged into one aggregate
   leaked-span or false-alarm rate. A PII family's many benign lookalikes
   would otherwise mask credential regressions, and the reverse.
2. **Sensitivity.** A declared sensitivity per authored span, next to
   `kind`, so leaks are reported per sensitivity level and not only per
   family.
3. **Reserved and documentation controls.** A named control class separate
   from twins and independent controls, so the false alarm rate on reserved
   values (which should be 0 once a reserved grammar exists) is not diluted
   by other controls.
4. **Validation.** Checksum-bearing vs structure-only families, and
   checksum pass vs fail twins, as a twin `mutationKind` (`validation`).
   This is the one-property probe for the validation group.
5. **Population and base rate.** Any calibrated probability or precision
   figure must carry its population label. Leaked-span and false-alarm rates
   are conditional on the true class and do not depend on base rate; the
   calibration transforms do.
6. **Locale.** Phone, national-ID and postal families are per jurisdiction,
   so locale is a family dimension, not a free-text note.

Leaked-span rate, false-alarm rate, collateral ratio and twin discrimination
remain the right metrics. The gap is in their strata, not in the metrics.

## Recommended beta.10 follow-up

One redact-secret issue (the product decision) and one benchmarks issue (the
strata), both under the beta.10 PII epic:

- **Product:** decide whether PII enters the core at all (it is an
  architecture non-goal today). If it does, define `evidence-features/v2`
  and `evidence-aggregation/v2` with segment-shape lexical features,
  strength-weighted validation, reserved-range and segmented-mask grammars,
  and a sensitivity output that is kept apart from the band.
- **Benchmarks:** add the domain, sensitivity, reserved-control, validation
  twin, population and locale strata to measurement and calibration before
  the first PII fixture is authored.
