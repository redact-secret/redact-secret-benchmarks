# PII benign and collision evidence

`pii-benign-collision-v1` defines evidence shape, not country breadth. Its
canonical registry intentionally contains no collision rows. A row is added
only when a proposed or supported family pair has a reviewed reason to share a
lexical space.

The canonical registry now includes fifteen US SSN controls split between the
diagnostic and benign-heavy populations. They are reserved displays,
deterministic synthetic public/reference cases, an all-nines placeholder,
allocation near misses, and context-negative cases—not cross-family or
cross-jurisdiction collisions. Their five SSA authority bindings remain
distinct: RM 10201.030, the SSN randomization page, RM 10201.035, RM 10201.020,
and GN 03325.002. Structurally valid positive values are deterministically
generated and carry no issuance, assignment, registry, lookup, or person
provenance.

A non-sensitive SSN control must be one the product contract can leave
unflagged. `us-ssn-v1` states there is no structurally valid non-sensitive SSN
namespace and that an unlisted placeholder word does not suppress, so a
structurally valid value under a `placeholder_ssn=` label is a sensitive
occurrence, not a placeholder
([#408](https://github.com/redact-secret/redact-secret-benchmarks/issues/408)).
The `stress-placeholder` control therefore uses the conventional `999999999`
placeholder. The SSN randomization page never assigns areas 900–999, so the
value is type-invalid and identity-unmatched, and its placeholder accounting
axis is exercised by rejection, not by a suppressed valid identity. The
famous advertising numbers are not used for this: they are structurally valid,
and the contract declines to treat placeholder folklore as a validity rule.

The authored eight-class vocabulary is retained end to end. `evidenceClass`
appears in method evidence and the accounting report's `evidenceByClass`
strata. Its separate `accountingClass` maps explicitly, and deliberately
lossily, to the six unchanged `pii-v1` benign axes. Public identifiers and
ordinary reference/account values therefore remain distinct authored classes
even though both account as `public-operational`.
Near misses have no benign axis: they exercise type and validator behavior only
and cannot establish semantic or collision qualification. Collision rows also
have no benign axis; they independently author family, jurisdiction, and
sensitivity expectations.

Each contribution supplies only safe identity, fixture data, and commitments:

- a typed family descriptor whose identity domain, scope, authority, and
  validator identity are checked against the entry and generated case;
- an optional existing context-evidence group;
- an authoritative reserved value or a `sha256-pattern` deterministic
  synthetic fixture, together with its candidate commitment;
- authoritative source provenance, or the exact deterministic generator
  identity, version, seed, and seed commitment; and
- for a collision, one target validator success plus each competitor's
  validator success or failure. All collision families must share one identity
  domain and at least one competitor must validate the same candidate.

The loader composes every row into a validated `PiiCase`; no parallel manual
case is required. Validator id, version, expected state, type, sensitivity,
scope, identity domain, language, and context are rebound by the method before
execution. Runtime artifacts, method evidence, accounting rows, and reports
carry safe identities and outcomes only, never fixture content, generator seed,
or candidate bytes.

Adding a future national-ID family updates the validator consumer data and this
evidence data. It does not add a country-specific evaluator or change the
`pii-v1` metric model. Reports continue to expose authored class strata, validator evidence,
wrong-family and wrong-jurisdiction rates, and the two sensitivity rates as
separate measurements.
