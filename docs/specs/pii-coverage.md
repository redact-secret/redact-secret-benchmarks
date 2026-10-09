# Discovered evidence-kind coverage

This contract implements #858 and #863. It describes evidence coverage and never
assigns stable/provisional product qualification, adopts a snapshot, changes an
authority value, or accepts an owner record.

## Closed row and exact identities

`scripts/lib/pii-coverage-model.mjs` is the closed schema and validator. Unknown
enums, extra fields, duplicate kind keys, omitted independent reasons, unsafe
counts, impossible denominator accounting and falsely derived states refuse.
Arrays are unique and bounded; strings are nonempty, bounded and control-free.

Commitments and population digests are exactly 64 lowercase SHA-256 hex digits.
One matrix identifies exactly one snapshot, product, mapping, protocol,
population, public/protected visibility and active/proposed/baseline/candidate
role. `bindingCommitment` identifies the validated exact run configuration,
activation, engine, scorer and scanner roster binding. It can be null when no
usable exact run exists; a valid observation requires it. The join owns proof
validation before constructing this digest. A digest by itself is not proof.
Every valid observation repeats the exact complete identity and requires a
nonnull product commitment; an unidentified product cannot supply usable
measurement ratios. Explicit capability
requires a source and the exact product commitment. Unknown capability remains
unknown even when generic findings incidentally match the kind.

Rows retain `kindKey`, label, domains, jurisdictions, evidence availability and
separate authored/imported/fixture/variant/occurrence/accepted counts; product
capability and source; required/representable axes and every mapping loss;
recorded observation status, source and per-axis quantities; explicit
applicability contract; and bounded reasons. Both applicable and not-applicable
claims require an explicit source, while silence remains unknown. Unknown imported/variant/occurrence
counts remain null. Navigation and source-case metadata stays in the companion
byte-verified inventory, rather than being manufactured from a measurement row.

## Deterministic precedence

The following conditions are evaluated in order. Each earlier condition wins the
summary state only; all independent axes, quantities and reasons remain visible.

1. Explicit non-applicability with a cited contract: `not-applicable`.
2. Exact explicit product exclusion: `product-not-supported`.
3. Unknown evidence availability: `measurement-unavailable`.
4. Deferred evidence or no accepted case: `evidence-deferred`.
5. Unrepresentable pinned mapping: `evaluator-not-representable`.
6. Unknown capability: `measurement-unavailable`.
7. Declared capability but no usable observation or no observed axis:
   `supported-unmeasured`. Absent, stale, invalid, identity-mismatched and withheld
   runs retain their exact reason; none becomes a zero or a pass. Unknown
   applicability remains an independent reason and does not erase an explicit
   capability declaration when no usable measurement exists.
8. A valid observation with unknown applicability: `measurement-unavailable`.
9. Any recorded miss in a compatible valid observation: `measured-missed`,
   including partial measurement. Success, loss, unresolved and withheld counts
   are retained alongside the miss.
10. Partial/unknown fidelity, any loss, missing required representable/observed
   axes or an empty required-axis observation, incomplete observation, unresolved or withheld outcomes:
   `measured-partial`. An empty required-axis contract cannot imply full support.
11. No measured quantity: `supported-unmeasured`.
12. All required axes faithfully represented and observed with applicable
    expectations satisfied: `measured-supported`.

`evidence-deferred` also describes a source-exposed kind with no released accepted
case. This presentation state does not invent a source acceptance decision or a
source-authored deferred-case count: original availability `none` and the
`no-accepted-cases` reason remain visible.

Thus an explicitly unsupported kind with incidental generic findings remains
unsupported, and a real miss with partial semantic loss remains measured-missed.
A not-applicable/deferred/unsupported/evaluator-gap summary cannot erase a
recorded miss or mapping loss. Full-support wording is reserved for full required
axis coverage, never for declaration plus available cases alone.

`measured = satisfied + missed + unresolved`,
`measured + withheld <= eligible`. A metric's effective N is its own
`satisfied + missed`; unobserved is `eligible - measured - withheld`. Unresolved,
withheld and unobserved quantities are disclosed exclusions. Invalid observations
can retain recorded quantities for diagnosis but contribute no usable metric.
A kind with several axes has several metrics, not one pooled accuracy score.

## Summaries and filtering

`scripts/lib/pii-coverage-summary.mjs` recounts validated rows. Unique discovered
kinds equal the exclusive nine-state partition. Capability, mapping, loss,
domain and jurisdiction slices are separate axes. PII and PHI can overlap, as can
jurisdictions; slice memberships must not be summed as a unique-kind total.

The descriptive coverage ratio states its measured-supported numerator, full
discovered-kind denominator, exact identity and every excluded state count. It
is a kind coverage ratio, not detection accuracy. An empty denominator returns
null/unavailable. Filtering controls selected rows only and never changes the
headline inventory denominator. Summary validation recomputes every field and
refuses stored duplicate/drop/overlap or edited-denominator errors.

Grains remain separate: authored cases, imported cases, fixtures, variants and
occurrences are never interchangeable. The summary's `grainMemberships` are
explicit per-kind memberships, which can overlap when a case contains several
kinds. They are not unique source totals. A null count makes its total unavailable
and retains the known subtotal plus the number of unknown kinds. Unique source
totals belong to the independently verified inventory.

Matrices and summaries never pool public/protected or different populations,
snapshot roles, or baseline/candidate products. Each observation must match its
matrix identity exactly. Comparisons display separately validated matrices and
must name each side's identity and denominator.

## Verification

`node --test tests/pii-coverage-model.test.mjs` exercises all nine precedence
states; unknown metadata, empty/invalid/stale runs, partial semantic loss,
unsupported incidental matches and partial observation with a real miss;
identity/enum/duplicate/count/refusal controls; full-denominator filtering;
nonexclusive slices; separate metric grains; and empty/unsupported-only recounts.

The 648 synthetic availability/capability/mapping/observation/applicability
combinations exercise every overlapping precedence condition.

No product-output assertions or real/protected fixture contents are introduced.

## Source inventory and exact joins

The inventory reads original manifest and snapshot taxonomy bytes under
`benchmarks/inputs/pii-coverage/`, checks their pinned SHA-256 identities and
reconciles the full taxonomy against accepted and zero-case source coverage.
The active and proposed inventories are separate. Missing or ambiguous metadata
refuses; no product detector or scanner run is needed for a new exposed kind.
Source deferred-case/fixture and per-kind occurrence/loss accounting are not
exposed by the current contract and remain explicitly unavailable.

The exact measured baseline and candidate source catalogs bind `AVAILABLE_FAMILIES`
to immutable source revisions and original source-file/blob identities. They
declare activation families, not grammar completeness or product qualification.
The reviewed importer mapping joins kind identities to these families. An
unmapped placeholder remains unknown; absence from the exhaustive family catalog
is explicit product exclusion. Proposed rows have no bound product or run.

The existing strict comparison consumer validates all measurement inputs before
the join accepts them. Its schema carries per-case/assertion observations but
does not provide a faithful per-kind metric contract. Those observations remain
inspectable alongside each kind; per-kind denominators are withheld, and no
family accuracy is inferred. Global overlapping import losses remain visible.

## Deltas and publication

`scripts/lib/pii-coverage-delta.mjs` compares stable kind IDs, source grains,
domain/jurisdiction membership, mapping and bound capability/measurement states.
Renames and reclassifications require explicit reviewed mappings. Active versus
proposed is distinct from accepted before/after. The proposal never borrows an
active observation, changes pins or supplies owner acceptance.

Evidence, evaluator and product changes are separate attribution fields. An
unknown proposed product is unavailable, not a changed artifact. The current
mapping commitment includes population identity, so scope and mapping effects
cannot always be isolated. A snapshot delta cannot establish a product
regression; that requires a separately held-constant product comparison.
Immutable source/archive locators and digests remain recorded, while full
reproduction stays unavailable until the original source archive is verified.

`scripts/pii-coverage-publication.mjs` recomputes membership, source fields,
summaries and deltas, and binds source and contract bytes. Existing
`pii:evidence:publish` and `pii:evidence:publication:check` commands include it.
The web prebuild generates the ignored public projection without scanning.
`web/scripts/check-export-pii-coverage.mjs`, in `check:routes`, independently
recounts rendered kind rows, states, summaries and exact identities. An absent
run can publish explicit unavailable coverage; malformed or mixed evidence
refuses. The same page works under both credential authority branches without
reading or changing either authority file.
