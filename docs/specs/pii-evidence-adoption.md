# PII evidence snapshot pin and preflight

The released public snapshot is an independent population. Evidence owns its
authored cases, fixtures, expectations and provenance; pii-eval verifies and
maps them. Benchmarks records metadata and measurements without copying the
authored truth into its taxonomy. The proposed composition policy remains in
`benchmarks/pii-population-policy.json`.

## Identities

`benchmarks/pii-evidence/snapshot-pin.json` is the upstream version-one pin:
release repository, annotated-tag commit, compressed and uncompressed archive
digests, manifest/source-manifest digests and files-v1 content digest.
`consumer-pin.json` separately binds pii-eval source `e99128f`, its archive,
Cargo.lock, toolchain file, fetch helper, adapter shim, mapping revision one,
pii-v1 revision two and corpus/public-artifact schema 1.4.

The measured engine is the prebuilt Linux binary from successful upstream CI
37637513834, artifact 11490276889. It is not the historical four-population
engine `b1c097e`. Its archive contains the measurement engine, build-info and
SHA256SUMS; it does not contain the auxiliary `pii-eval-evidence` importer.
The importer pin therefore states `pending-source-build`. The recorded Darwin
importer is local verification only, never a Linux binary identity.

One separately cost-approved Ubuntu job may compile the auxiliary importer from
the exact source archive, lockfile and toolchain. Before using it, the driver
must seal a build receipt with command, source, toolchain and observed binary
hash, verify the executable against that receipt, and reverify/import the exact
population and binding. The reviewed collector freezes that Linux receipt and
hash. This does not replace or loosen the existing prebuilt measurement-engine
pin. Pending receipt and fresh cost approval keep the committed preflight
candidate nonrunnable.

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

The initial verified snapshot has 49 producer cases, 139 fixtures and eight
skipped case/rule pairs. Import produces 55 cases, 139 variants, 98 located and
41 range-less occurrences. These are different units. Mapping losses overlap:
contexts-not-carried 37; phi-domain-not-carried 37; sensitivity-context-dependent-
flattened 11; identity-weakened-no-span 17; sensitivity-weakened-no-span 19.
All five classes remain explicit, including zero counts in future candidates.

The binding carries email 92, phone 10, US SSN 9, medical-record-number 17,
health-plan-member-id 9, health-claim-identifier 1 and prescription-order-
identifier 1 variants. Payment-card and IBAN mapping kinds are absent.
Unknown kinds, jurisdictions or contract versions refuse instead of being
guessed. pii-eval #37 leaves lost PHI/context claims pending; it does not block
all public adoption.

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
existing PII page. Schema 1.4 unprojected artifacts need a separate strict
consumer; absence of family projection must be labelled explicitly. No support
promotion or protected execution follows from this preflight.

Published beta.14 source `0c62fd` is the fresh public baseline. Qualified,
unpublished `5696d7e` is a separate comparison candidate despite equal version
text. Current main `01531b7` is not an accepted substitute: its custom-workerd
qualification failed. Historical beta.12 is a Darwin measurement, so comparison
with a new Linux run is descriptive with the platform difference explicit.
The spent previous comparison approval does not authorize this population.
