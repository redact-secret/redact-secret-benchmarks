# PII evidence v2 post-#37 adoption preparation

The successor package is **blocked before canonical measurement**, not
ready-for-acceptance. Its input directory is
`benchmarks/inputs/pii-evidence-snapshot-v2-post37-candidate/`.
The original mapping-2 proposal remains byte-identical. Active v1 pins,
measurements, authority and qualification policy remain unchanged.

## Release prerequisite

The proposed snapshot is `public-pii-phi/2026-10-08/ee61c7afc32d`, content
digest `ee61c7afc32db4db320e57051ff762eee5ca70942a7b740a383a1d8e54e397bb`.
Both GitHub release and tag lookups returned 404 on 2026-10-09, and the upstream
release registry contains only v1. Committed source bytes at
`d6825d5985c7fbc83d54e49f5c0b5426e5d852a2` were verified and deterministically
packed locally. That proves the proposed archive bytes, not a release:

- tar: `ae0324a180361a70bd6f225859fe46f7fde6f02f4d9d317a2336ae432c0a2e36`
- tar.gz: `e86648cf7c54fd6fcc62a17e58859aa334557b6cb9ba30954d12a42cc087c626`
- manifest: `acf14bf012740f25083a6c50134afffa406605061138208bbe83d7f83ad8eb0b`
- source manifest: `0230e2c92daefe0292284c5e61ebd520585ced52be96e77484dd23340a54a82f`

`review.json` records exact archive members. After upstream release, resolve the
tag to its actual commit and independently retrieve and verify both archive
digests, manifest, content and source-manifest digests and every archive member.
The proposed source commit is not a substitute for tag resolution. If the tag
uses a registration commit, regenerate the pin/preflight/proposal with that
commit and the same verified snapshot bytes. Changed bytes require a new
snapshot identity and a new review.

## Named consumer migration

Merged pii-eval #37 is source
`0cd2ec43387d5e420b4c4ca6678a9b63fae5001a`, source archive
`f7c9866d762f5a51d075e3ed8e4298c185ca1c78d8d5d144d1cb8493514c1c84`
over `git archive --format=tar HEAD`. Import explicitly opts into mapping 3,
population version 3, protocol `pii-v1` revision 3 and corpus/artifact schema
1.5 together. Default upstream import still uses the old semantics.

The locked Darwin release build is recorded in the candidate runtime registry;
its binary is local verification only. The preflight launches only `verify`
and `import`, never a scanner. Unknown runtime identities, contracts, mapping
kinds and jurisdictions refuse. The original v1/runtime-1 and v2/runtime-2
contracts remain independently readable.

The imported population digest changes from
`2bff16441b6e3ef3be72ecb8cacedfdb404053981d1d086546a00f2c4c407d52` to
`7d140c084151b642fd3edb492ec2de4e72acbd1eb9c4f912cc62ce7caf8cff16`.
The binding digest changes from
`299c406c1f7e5ae49dfd819e42c713da54d99952b1b3219db3451bdcbcc6e864` to
`c59620a7ba4c5a1e98f2939d72fb859f0053ea3aba5af83fd44399acef6ae1f4`.
The corpus gains evidence metadata, text-negative assertions and authored
context-dependent values. The binding names the new mapping and losses.
Original output bytes remain unchanged; omitted zero loss classes in the new
binding are explicitly reported as zero in the benchmark preflight.

Counts remain 118 authored Cases, 115 carried Cases, 3 Cases without fixtures,
18 skipped case/rule pairs, 123 imported Cases, 285 fixtures/variants/occurrences,
198 located and 87 range-less occurrences. These units are not interchangeable.

Losses versus the old v2 import are contexts 102 → 0, PHI domain 74 → 0,
context-dependent flattening 35 → 0, identity without span 44 → 0 and sensitivity
without span 47 → 4. The four remaining rows are one ambiguous medical-record
identifier and three ambiguous health-plan member identifiers. Their authored
sensitive expectations lack a span. `review.json` records their exact source
Case/fixture/variant IDs without input text. They are evaluator limitations,
not measured scanner failures or passes. Context-dependent sensitivity remains
authored uncertainty requiring review, even when represented faithfully.

## Exact product and Linux prerequisites

`core-target.json` freezes the benchmark's published beta.14 baseline at
`0c62fd38bca75c5b28b042dc79789b708ebf1d17`. The annotated product tag resolves
to that commit; the published npm integrity pins and freshly retrieved package
bytes agree. It records all three package tree digests, native-addon and four
WASM binary hashes, adapter 1.0.0, selectors `pii:global`/`pii:us`, configuration
and activation digests. These are product identities, not reused observations.
Hardening engineering evidence #883 is not an accepted replacement artifact.
A comparison candidate is not required by evidence-adoption policy.

Upstream Linux CI 37970072564 at the exact merged consumer source succeeded.
Its downloaded engine artifact 11634793093 contains only `pii-eval`, build info
and checksums. Engine binary SHA-256 is
`5b87aa1758b8b0fd3330b64ee616a9633a8ba179794e57dcf3551605a40261b8`.
This is not a Linux importer build or a v2 measurement receipt.

The existing measurement path still binds the initial engine/protocol/schema:
source/engine fetching, comparison plan/cost scope, driver import/configuration,
receipt and public-artifact consumers must opt into the new exact tuple together.
Its comparison/adoption validator also requires two products. Baseline-only
execution must be supported in that existing path without making a candidate
mandatory. Do not dispatch a nominally new preflight through the old engine.

There has been no canonical v2 Linux importer build, fresh scanner measurement,
scanner replay, artifact replay or v2 publication record. The previous cost
approval was spent on v1 and cannot authorize this tuple. `review.json` records
the decision not to dispatch while release and compatibility prerequisites are
missing. Any future approved execution stays public/synthetic, one exact tuple,
at most one job/15 minutes and zero protected runs. Build the importer with the
pinned archive, Cargo.lock and Rust 1.98.1, seal its observed Linux binary receipt
before use, then reverify/import v2 and validate fresh measurement/replay bytes.

## Coverage and acceptance

The proposed coverage inventory now uses the successor mapping. All 12 source
kinds remain: 9 measurement-unavailable and 3 evidence-deferred, with zero in
the other seven states. Deferred entries retain their zero accepted source Case
counts, including the unresolved national-ID placeholder. Product identity and
capability remain unbound on proposed rows; old v1 observations never join v2.
Representable PHI/context axes no longer carry an obsolete lost-axis label,
while per-kind fidelity and metric accounting stay explicitly unavailable.

`coverage-delta.json` independently records evidence and evaluator changes:
10 → 12 kinds, 49 → 118 authored Cases, 139 → 285 fixtures, added birth-date and
UK NINO kinds, no removed kinds. Product-change attribution is unavailable,
not a claim that the product improved or regressed.

Candidate digest is
`6e23de67bbaf05a792bfa54f70812bc5ebf290061c6c3699a78020012b6f4274`.
`scanner.json` proposes the published product identity. `candidate.json` and
`acceptance-plan.json` were generated by the existing preparation helper.
`ownerAcceptance` is null, `canApply` is false, and all active writes are absent.
Only after released-source verification, reviewed path compatibility, a fresh
exact cost decision, canonical build/import/measurement/replays and independently
supplied maintainer acceptance may the existing guarded apply retain the full
v1 history and update active records. Never generate acceptance in preparation.

## Reproduce preparation

Use clean detached upstream checkouts at the commits above and the exact pinned
Rust toolchain. Build the importer with
`cargo build --locked --release -p pii-eval-cli --bin pii-eval-evidence -j 2`.
The benchmark checks its source archive, source-file and observed binary hashes.

```sh
node scripts/preflight-pii-evidence.mjs \
  --source-dir <pii-eval> --consumer-bin <exact-release-binary> \
  --snapshot-dir <pii-evidence>/snapshots/public-pii-phi/2026-10-08/ee61c7afc32d \
  --candidate-snapshot-pin benchmarks/inputs/pii-evidence-snapshot-v2-post37-candidate/snapshot-pin.json \
  --candidate-consumer-pin benchmarks/inputs/pii-evidence-snapshot-v2-post37-candidate/consumer-pin.json \
  --out <new-preflight.json>
node scripts/prepare-pii-evidence-adoption.mjs \
  --preflight <new-preflight.json> --previous benchmarks/pii-evidence/preflight.json \
  --scanner benchmarks/inputs/pii-evidence-snapshot-v2-post37-candidate/scanner.json \
  --out-dir results-output/pii-evidence-adoption/<new-directory>
```

These commands neither dispatch measurement nor apply adoption. The next
external prerequisite is the actual immutable upstream v2 release.
