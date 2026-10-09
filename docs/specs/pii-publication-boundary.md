# PII publication boundary (#869)

Current publication reads strict `pii-eval` artifacts and benchmark-owned product policy. It does not construct, select, measure or compare raw TypeScript PII accounting rows. Historical observations remain available through an explicit bounded oracle, without changing either authority file, pins, owner acceptance or protected inputs.

## Contracts and used symbols

Runtime and erased type dependencies have separate roles. Graft outgoing caller walks for `validatePiiPopulationContract`, `validatePiiProductBinding` and `validatePiiIdentityOracleProjection` establish the transitive paths below; the import inventory records remaining historical callers.

| Boundary | Runtime symbols and role | Erased types |
| --- | --- | --- |
| `benign-collision-contract.ts` | immutable committed evidence schema and canonical commitment validation; no candidate generator or validator observations | evidence entries, source, family and corpus DTOs |
| `population-contracts.ts` | `piiPopulationContract`, `validatePiiPopulationContract`, roster/dimension keys and canonical commitments: authored membership, weighting, regression limit, partition and protected-row policy | population/report/stratum/diagnostic DTOs and validation options |
| `population-artifacts.ts` | `validatePiiPopulationStructure`: schema, commitment, exact roster/count/status reconciliation. `validatePiiPopulationArtifact`: current absence-only legacy projection. `unmeasuredPiiPopulationArtifacts`: frozen absence artifacts, no measurement | contracts above; no accounting runtime |
| `accounting-types.ts` | none | accounting source/rows/report, unresolved and unavailable metric DTOs; statistical result types from `benchmarks/shared/statistical-primitives.ts` |
| `support-v2.ts` | registry/provenance validation; product activation, trusted binding, qualification thresholds, protected-route and support-status policy; publication synthesis and strict engine projection readback | neutral DTOs above; `PiiAccountingRow` only from the type boundary |
| `publication-product-proof.ts` | pure node/browser readback reconciliation of persisted exact product, engine, scorer and population proof; no measurement or filesystem access | support projection DTOs only |
| `benchmarks/support/pii-publication-product.mjs` | validates the recorded paired comparison and its exact source/core/engine/package-tree identity; fixed repository metadata paths and strict eight-artifact reader | typed binding contract in `.d.mts` |
| `pii-publication-inputs.ts` | strict pin/artifact consumer, synthetic conformance reader, exact product evidence lookup and paired receipt product binding | product, engine and publication DTOs |
| `support-oracle.ts`, `populations.ts`, `accounting.ts` | bounded historical oracle: raw source validation, row selection, diagnostic accounting, population report derivation/reconciliation and historical regression comparison | shared neutral DTOs, re-exported for compatibility |

`validatePiiProductBinding` retains its transitive candidate-evidence, selector closure, arrival-binding and identity-oracle projection validators. Its call to `validatePiiIdentityOracleProjection` checks counts, vocabulary and commitments; it does not call an installed product validator or the reference validator. This does not complete the separate #616 validator-conformance seam.

Neutral engine calculation belongs to `pii-eval`. This change extracts DTOs and validation from the bounded TypeScript oracle, rather than implementing another engine. The oracle's raw-row algorithms and historical comparison outputs remain unchanged. Its tests explicitly import `support-oracle.ts` when they need historical measured rows.

## Current inputs and incompatible metrics

`publish-pii-support.ts --population-mode=not-measured` publishes the frozen canonical legacy population absence reports. They preserve the authored five diagnostic and seven stress strata, declared denominators, weighting, unresolved classifications and null rates. Unbound family summaries remain zero-strata/not-measured; a canonical explicitly bound absence report retains its authored strata. The absence artifacts are schema/commitment checked and tested byte-equal to the oracle's empty-input result.

Strict engine artifacts are independently accepted with `--pii-eval-pins` and `--pii-eval-artifact`. The consumer refuses wrong product/configuration/activation, population identities/digests, scorer/protocol, missing populations and retired or altered artifact digests. Published quantities keep their protocol `pii-v1` labels, exact denominators and withheld values. Their quantity basis says `verdictReads: b11`, `thresholdsApplied: false`; engine quantities never become legacy `b11ScoreTable` verdicts or legacy diagnostic metrics. Engine evidence does not invent family qualification, validator conformance, protected operational readiness or a support status.

## Exact publication product identity

A source-commit match alone is insufficient. `piiEvalMeasurementFrom` resolves the strict paired-comparison product binding through `benchmarks/support/pii-publication-product.mjs`. A population is `measures-publication-product` only when the receipt binds all of:

- publication source commit and core tarball SHA-256;
- engine commit and scorer protocol id/revision;
- engine scanner package-tree SHA-256, candidate product identity and single scanner roster;
- that exact population id and digest.

Missing or invalid proof with the same source commit is `publication-artifact-not-bound`. A different source or a verified other product is `other-product`. Without a measured publication product it is `publication-product-not-measured`. These are measurement identity states, never support verdicts. New matched rows persist `productBinding.proof` (core tarball, engine package tree, engine commit, scorer and population digest), plus the independent expected `publicationProduct` source/core identity. Readback reconciles every proof field with those identities and the scanner/population; a historical source-only matched row without proof is invalid. Trusted activation, when bound, must also agree on the source/core identity. Tests may inject a receipt resolver, but all returned identities are still checked.

The existing paired official comparison from #616/#842 is consumed without another scanner run. A later candidate cannot borrow that comparison. No unverified pin-supplied tarball statement substitutes for the receipt.

## Bounded oracle and rollback

`--population-bundle` alone is refused. Historical raw release bundles require both `--population-bundle=<file>` and `--bounded-population-oracle`. Only that explicit lane dynamically imports `support-oracle.ts`; `populationOracleBindingsFrom` still requires the exact candidate commit and core tarball when a product is provided. The current `populationBindingsFrom` entry point rejects raw legacy bundles. The normal producer uses the current absence mode and strict engine evidence.

The compatibility exports in `populations.ts` and `accounting.ts` preserve existing historical callers. This split does not authorise their deletion or close the oracle period. Rollback, protected aggregates, trusted product activation and accepted policy remain intact. The frozen legacy report schemas stay available for historical evidence.

## Verification

`tests/pii-publication-boundary.test.mjs` checks byte-equal absence/oracle projections, rejection of re-committed measured claims, explicit historical routing, strict engine denominator/withheld preservation, independent scorer/product/population refusal and exact receipt identity mismatches. Existing PII accounting, population, benign evidence, support, strict artifact and protected binding tests continue to verify the bounded oracle and policy. `tests/pii-publication-product-binding.test.mjs` exercises the real recorded exact-product/default resolver, nullable comparison metadata, missing inputs, unsafe view paths and receipt tampering. The shared browser validator also rejects rehashed proof mutations and source-only matched rows. No new scanner measurement or paired official comparison is needed for this split.
