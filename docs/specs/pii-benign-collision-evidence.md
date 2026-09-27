# PII benign and collision evidence

`pii-benign-collision-v1` defines evidence shape, not country breadth. Its
canonical registry intentionally contains no collision rows. A row is added
only when a proposed or supported family pair has a reviewed reason to share a
lexical space.

The eight evidence classes map explicitly to the six `pii-v1` benign axes.
Near misses have no benign axis: they exercise type and validator behavior only
and cannot establish semantic or collision qualification. Collision rows also
have no benign axis; they independently author family, jurisdiction, and
sensitivity expectations.

Each contribution supplies only safe identity and commitments:

- an existing validator registration and consumer-family identity;
- an existing PII family and jurisdiction identity;
- an optional existing context-evidence group;
- a candidate commitment, never the candidate in the evidence registry;
- authoritative source provenance, or a deterministic generator identity,
  version, and seed commitment; and
- for a collision, one target validator success plus each competitor's
  validator success or failure.

Adding a future national-ID family updates the validator consumer/family data
and this evidence data. It does not add a country-specific evaluator or change
the accounting model. Reports continue to expose validator evidence,
wrong-family and wrong-jurisdiction rates, and the two sensitivity rates as
separate measurements.
