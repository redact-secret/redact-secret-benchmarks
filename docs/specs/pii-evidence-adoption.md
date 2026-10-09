# PII evidence snapshot pin and preflight

The released public snapshot is an independent population. Evidence owns its
authored cases, fixtures, expectations and provenance; pii-eval verifies and
maps them. Benchmarks records metadata and measurements without copying the
authored truth into its taxonomy. The proposed composition policy remains in
`benchmarks/pii-population-policy.json`.

## Identities

The active pin is released v2 `public-pii-phi/2026-10-08/ee61c7afc32d`, content
`ee61c7afc32db4db320e57051ff762eee5ca70942a7b740a383a1d8e54e397bb`,
release commit `e22bbc16cb9009de1a6a91e97e7322ebbc32bcf0`.
`consumer-pin.json` binds pii-eval `bfa93c79013dd9804fe16abedbc27990e76d01fb`,
mapping revision 3, pii-v1 protocol 3 and corpus/public-artifact schema 1.5.
The Linux measurement engine is from upstream run 37983467352; canonical
consumer build/import and current comparison are retained from benchmarks run 38000504948.
The initial v2 published-only run 37983968336 remains immutable in history.
The pin's `pending-source-build` field describes the immutable build plan.
The actual Linux importer is sealed in `build-receipt.json`, SHA-256
`070d000f2f9012e44dced295f4d0d82aa6f4111eefec5773f422fe082334af75`.

`adoption.json` binds the requested core repin authorization recorded in issue #898,
candidate `a561477392b7cb02d8b4010db1ecd3668a6f2512f197431f6c9c88a8073e7a9c`.
The original v2 acceptance in #841, candidate
`5010b3ae838adc760fdbcbb65b1db6324226a178c36959af34f65d4d71856693`, is preserved.
`history.json` preserves v1 and v2 complete original measurement/replay bytes;
`benchmarks/pii-evidence-comparison/historical-v1/` keeps the v1 measurement
separately usable. The initial pin/preflight remains immutable under
`benchmarks/inputs/pii-evidence-initial-active-v1/`.

One separately cost-approved Ubuntu job may compile the auxiliary importer from
the exact source archive, lockfile and toolchain. Before using it, the driver
must seal a build receipt with command, source, toolchain and observed binary
hash, verify the executable against that receipt, and reverify/import the exact
population and binding. The reviewed collector freezes that Linux receipt and
hash. This does not replace or loosen the existing prebuilt measurement-engine
pin. The scanner-free preflight stays nonrunnable; the separate canonical receipt
proves the executed measurement.

## Scanner-free preflight

```sh
node scripts/preflight-pii-evidence.mjs --check
node scripts/preflight-pii-evidence.mjs \
  --source-dir /path/to/exact/pii-eval \
  --consumer-bin /path/to/pinned/darwin/pii-eval-evidence \
  --snapshot-dir /path/to/released/snapshot --out /tmp/new-preflight.json
```

Use `--fetch` instead of `--snapshot-dir` to invoke the hash-verified upstream
fetch helper. Fetch verifies transport identity and extraction safety; it is
not semantic validation. Preflight runs only `verify` and `import`, in a new
temporary directory, and removes temporary imported content after checking
the output hashes. The upstream reproduction script also launches a scanner
and is deliberately not called. Refused inputs never write the report.

The historical v1 verified snapshot has 49 producer cases, 139 fixtures and eight
skipped case/rule pairs. Import produces 55 cases, 139 variants, 98 located and
41 range-less occurrences. These are different units. Mapping losses overlap:
contexts-not-carried 37; phi-domain-not-carried 37; sensitivity-context-dependent-
flattened 11; identity-weakened-no-span 17; sensitivity-weakened-no-span 19.
All five classes remain explicit, including zero counts in future candidates.

The binding carries email 92, phone 10, US SSN 9, medical-record-number 17,
health-plan-member-id 9, health-claim-identifier 1 and prescription-order-
identifier 1 variants. Payment-card and IBAN mapping kinds are absent.
Unknown kinds, jurisdictions or contract versions refuse instead of being
guessed. Mapping 3 after pii-eval #37 preserves PHI domains and authored context metadata.
V2 has 118 authored cases, 285 fixtures, 123 imported cases and 285 occurrences
(198 located, 87 range-less). Four range-less sensitivity losses remain; the
other four global loss classes are zero. Per-kind loss accounting is unavailable.

## Future proposals and consumption

`--candidate-snapshot-pin FILE` verifies/imports a proposed future release under
the same reviewed consumer. Population/binding digests and mapping counts come
from the verified importer outputs. Closed candidate-report validation permits
changed evidence identities and accounting, but refuses a different consumer
source, binary, protocol or mapping contract. Adoption preparation remains a
proposal; it cannot write active pins, authority or owner acceptance.

The existing four population pins remain byte-identical. Evidence measurements
need their own sidecar because the publication input helper refuses mixed
engine builds. Do not widen `PII_VIEW_IDS` or append the new metric cells to the
existing PII page. Unprojected schemas 1.4 and 1.5 artifacts need a separate strict
consumer; absence of family projection must be labelled explicitly. No support
promotion or protected execution follows from this preflight.

Published beta.14 source `0c62fd38bca75c5b28b042dc79789b708ebf1d17` is the
fresh v2 baseline. The current comparison separately measures qualified unpublished
core `ca09aeb6bb360aed20914e475230836250e2759a` from qualification run
37996223624, also carrying version text beta.14. The source, package, native and
WASM digests distinguish it from the published baseline. All 285 outcomes and
ten metrics are identical. This does not publish the candidate or promote support.
Explicit `pii:global,pii:us` activation preserves that product's configuration,
keeps GB evidence in the full population and does not assert GB support.
Historical candidate/product measurements remain separate from v2.
