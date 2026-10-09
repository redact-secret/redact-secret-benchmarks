# PII peer accuracy readiness

The inventory `benchmarks/pii-peer-readiness-v1.json` records the remaining
contract work for #576. It is not a peer run. Its strict consumer rejects
measurement counts, support claims, an invented ready adapter or an expectation
rule omitted from the reviewed contract. The issue remains open until actual
same-population peer artifacts satisfy the contract below.

## Authored expectations

Identity and sensitivity are separate. The existing six-family plans author the
candidate UTF-8 range, type expectation and sensitivity before execution;
`scripts/lib/pii-population-conversion.mjs` carries those facts into the neutral
pii-eval snapshot. Scanner findings populate observations, never expected truth.
Reserved/example values need the authority named by the family contract; a
scanner choosing to redact them does not make them sensitive. Unestablished
identity or sensitivity remains unresolved and contributes no invented pass.

The family bases remain in `pii-identity-oracle.md` and
`pii-benign-collision-evidence.md`: network syntax/allocation, email syntax and
reserved domains, published payment-card test controls, SWIFT IBAN structure,
SSA SSN allocation, and the narrow NANPA phone grammar and reserved controls.
SSN and IBAN have no structurally valid authority-reserved non-sensitive
namespace. A checksum or a validator hit alone is not sensitivity evidence.

## Reusable populations and missing coverage

The four `b11-population-v2` snapshots retain their own identity and denominator.
Their authored memberships can be reused by another pii-eval adapter without
creating a second evaluator here. All cases currently use `schema-only`; the
method-restricted metrics remain not applicable. Range-less memberships remain
unresolved. These populations do not establish independent review or sufficient
diversity for a general peer accuracy claim.

The upstream pii-evidence importer at pii-eval
`e99128f5633c5905497342623e249ad90d902800` offers another public population:
snapshot `public-pii-phi/2026-10-07/9d4e8e036bbb`, 55 mapped cases and 139
variants. It records 41 range-less occurrences and explicit mapping losses for
unlocated identity/sensitivity, context-dependent sensitivity, contexts and PHI
domains. Its provenance calls the source mostly unlabeled, authored by one
project without independent review, and not real-world accuracy evidence.
Importing it cannot silently resolve those gaps or pool it with another corpus.

## Adapter admission and evidence

At the reviewed upstream revision, `crates/pii-eval-adapters/src/inventory.rs`
records flare-redact 1.6.1 and OpenRedaction 1.1.5 as throughput-only. The CLI
configuration admits only the redact-secret-core adapter. The inventory pins the
source revision and the inventory/configuration byte digests; it does not
pretend a remote source is checked on every website build.

A peer needs a reviewed mapping from its actual output to family, half-open
UTF-8 range and sensitivity capabilities, plus offset conformance vectors.
Unsupported classification, ranges, jurisdiction or actions remain unsupported;
they are never inferred from changed output or detector names. Pin package and
extra artifacts, adapter/normalization version, configuration and activation.
Then execute each peer on the exact same snapshot/protocol as the product and
validate the resulting pii-eval public artifacts. Replays are reproducibility
checks, not extra samples. Publication must preserve scanner identity, authored
counts, effective N, absent/unsupported/withheld states and per-family strata.

The [bounded local observations](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/reports/pii-peer-local-defaults.md) now
record reviewed default adapters and eight validated same-population artifacts.
Independent ground-truth/diversity review, sensitivity semantics and a canonical
release comparison remain unavailable. `/comparison/accuracy/?data=pii` therefore
retains its labelled runtime preview and links the separate exploratory record. Neither timing observations nor “every value replaced” counts
are relabelled as accuracy. Protected execution and support qualification are
separate and do not gate this public work.
