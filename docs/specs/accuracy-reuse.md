# Accuracy observation reuse

Issue [#706](https://github.com/redact-secret/redact-secret-benchmarks/issues/706), under [#704](https://github.com/redact-secret/redact-secret-benchmarks/issues/704).
Engine contract: credential-eval ADR 0008 (issue #40). Decision: [plan accuracy reuse from verified observation archives](../decisions/2026-10-05-plan-accuracy-reuse-from-verified-observation-archives-and-let-the-engine-replay.md).

This repository measures and records. Reuse concerns normalized accuracy observations, never final scores, and never performance (#709).

## The plan

`scripts/plan-accuracy-reuse.ts` (module `benchmarks/qualification/accuracy-reuse.ts`) produces `reuse-plan.{json,md}` before any scan:

```
node --import tsx scripts/plan-accuracy-reuse.ts --population <id> --snapshot <corpus snapshot> --platform <p> \
  [--archive <observations.json> --archive-digest sha256:<bytes> --source-release <tag>] \
  [--product-version <v> --product-integrity <sri>] [--force-fresh <id,id|all>] [--out <dir>]
```

| Change | Plan | Scans |
| --- | --- | --- |
| Product build or options only | product `fresh`, compatible peers `reused` | no peer scan |
| Fixture bytes, path, context or generated variants | `fixture-changed`: fresh run of the changed population, new bound artifact | all, fallback shown first |
| Expected spans, labels, accounting only | `expectations-only`: compatible observations re-scored | none |
| A scanner's version, adapter, options or build | that scanner `identity-changed` (fields named), others reused | that scanner |
| New evidence release tag, identical inputs | provenance only | none forced |
| `--force-fresh` | named scanners (or `all`) fresh | those |
| No archive, unbound, other protocol, wrong restriction | fresh with the reason, listed under missing evidence | all |
| Archive bytes differ from the recorded digest, unrecorded schema, observation not complete/agreed/replayed at least twice | **refused**, exit 4 | none, never worked around |

The plan states each scanner's origin (`fresh` or `reused`) and reason, the measured input identity of both sides, the archive's source release as provenance, missing evidence, and the saved scans and runner-minutes (from the reused observations' recorded replays and durations). `performanceMeasurements` is always 0.

## Running it

Reuse is for `official-runs.yml`/driver `--mode diagnostic` only: `--reuse-observations <set> --fresh <id>... --observations-out <file>`. The driver refuses an official run, `--fresh` without a set, a scanner not selected, and an engine whose `run --help` does not list `--reuse-observations`. The engine re-verifies every identity, never re-executes a verified observation, carries the original receipts, and records origin as non-semantic provenance, so a mixed-origin run has the semantic digest of a fresh one on the same population. `diagnostic-record.json` records the archive digest and the fresh scanners. Mixed-origin results are exploratory/internal and never promoted or recorded.

A new corpus produces a new bound artifact; earlier archives are immutable. Case-level reuse of unchanged inputs is not built until the engine proves adapter independence.
