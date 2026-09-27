# PII benign and collision evidence

`pii-benign-collision-v1` defines evidence shape, not country breadth. Its
canonical registry intentionally contains no collision rows. A row is added
only when a proposed or supported family pair has a reviewed reason to share a
lexical space.

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
