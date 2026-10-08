# Released PII evidence comparison

This sidecar measures one released public/synthetic evidence population independently
of the four historical populations. It neither changes PII authority nor qualifies
a family. The proposed population policy remains proposed; loss-sensitive claims
remain pending. Protected execution is zero and not operational.

## Recorded first Linux comparison

[Run 37829344445](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/37829344445)
completed on its first attempt at commit `836a020fe06e1c941185be95da6964f9eb0385a4`.
The single Ubuntu job took 100 seconds including preparation and cleanup; measurement and
scanner-free replay collection took 2,453 ms. Both products used 139 variants,
two scanner replays and two additional scanner-free accounting replays.
The 11 uploaded files and their GitHub provenance are retained here after
strict archive, byte and semantic verification. Protected executions were zero.

All 139 paired public outcomes were unchanged. Five metric values are available
and five remain withheld: two have insufficient evidence and three have zero
denominators. Both products record sensitive-miss 18/18, type-miss 20/20,
wrong-family 0/20 and wrong-jurisdiction 0/8; measurable-share is 39/110.
These are separate metric populations, never summed. Their normalized PII finding
sets are empty; 98 located occurrences retain their residual and 41 rangeless
occurrences are not measured for the output action. The historical beta.12
record has the same input digests and finding sets. This comparison establishes
the recorded measurement and provenance, with no support or accuracy promotion.

## Exact inputs

`benchmarks/pii-evidence-comparison/plan.json` binds the released evidence snapshot,
the imported population and binding digests, 139 variants across 55 corpus cases,
98 located and 41 rangeless occurrences, and the five overlapping mapping-loss
classes. The compact `population-index.json` contains only case, variant,
occurrence, method and mapped-family identities. It is derived from digest-verified
import outputs, has its own plan digest, and is regenerated before any scanner
launch. It contains no text or duplicated authored expectations.

The published baseline is npm beta.14 source `0c62fd38bca75c5b28b042dc79789b708ebf1d17`.
The separate unpublished candidate is beta.14 source
`5696d7e1a2950bdf54fa21244f351e1c4b171f25`, qualification run `37772337995`.
Published packages are checked against exact npm integrity; candidate packages
and native payloads against the frozen qualified inventory. Equal version strings
are never used as proof of equal provenance. The engine uses a candidate tree
binding for both products because its released-product pin names beta.12;
baseline publication provenance is recorded separately.

Both the auxiliary importer and execution engine use reviewed pii-eval source
`e99128f5633c5905497342623e249ad90d902800`. The prebuilt Linux engine is bound to
its successful upstream CI run, ZIP, build-info and binary hashes. Upstream does
not archive the importer. The single approved Ubuntu job may build it from the
exact source archive, lockfile and Rust toolchain using the committed offline
two-worker command. Before use, `seal-importer` reconciles all regular source
files against the verified archive, checks the toolchain, and writes a separate
observed Linux binary receipt. This does not replace the known measurement-engine
pin. Darwin verification has a separate actual binary hash and is never canonical.

## Prepare and execute

`node scripts/pii-evidence-comparison-plan.mjs --check` checks the deterministic
committed plan. `--github-output` refuses unless a fresh cost decision is approved.
A prepared cost file has null decider/date and grants no execution allowance.
The current decision records the user’s explicit “측정 승인해” authorisation for
the frozen published baseline and qualified candidate, without support promotion.
The approved scope is one Ubuntu job, at most 15 minutes including preparation,
two public executions, two scanner replays per execution, and zero protected runs.
The branch-only dispatch guard refuses a second dispatch or run attempt using the
same decision, including when the decision is copied to another commit.

A future release is prepared from an externally reviewed candidate preflight,
the unchanged proposed policy, and the index derived from its verified imports:
`--preflight=<file> --policy=<file> --population-index=<file>
--cost-decision=<file> --write --out=<new-file>`. A future plan cannot overwrite
the current plan through this command. Its fresh decision binds the preflight,
policy and index digests as well as the exact population and product tuple.
`--check --plan=<file> --cost-decision=<file>` checks a selected reviewed plan; the execution driver
accepts `--plan=<file>`. This permits changed population sizes and mappings without
editing the initial archive constants. Unknown mapping kinds or an unreviewed
consumer/engine switch still refuse. Preparing a runtime plan does not accept it
or apply active pins; external acceptance and preserved history belong to #841.
`--snapshot-pin-output=<new-file>` emits the selected plan's exact evidence pin
for the separate read-token fetch step, avoiding a hardcoded initial snapshot.

The workflow obtains exact engine/source artifacts with read-only tokens, then
builds without App tokens. Its public release-fetch step uses only the standard
read token; the scanner driver receives no token. The driver verifies source,
shim, importer receipt, product packages and imported semantics before scanner
launch. Its deadline uses the job's first-step timestamp, so compilation and
fetching do not reset the 15-minute allowance. Local Darwin verification has a
separate 60-second execution limit after input checks.

`run-pii-evidence-comparison.mjs` accepts `--engine`, `--source`,
`--source-archive`, `--consumer`, `--build-receipt` (canonical only), `--shim`,
`--snapshot-dir`, `--node`, `--baseline-{core,node,wasm}`,
`--candidate-{core,node,wasm}`, `--candidate-inventory`, and a fresh `--out`.
`--require-canonical` requires fresh approval, exact Linux binaries, the sealed
importer receipt and the GitHub first-attempt identity. It never executes the
upstream reproduction helper, which would launch an additional scanner run.

Each product runs on the same imported population and its own derived manifest.
The engine's two scanner replays must agree. Two additional scanner-free replay
commands per product recompute matching/accounting/metrics from the actual
observations and original run artifact and must have identical public artifact
digests. Package installations and transient imports are isolated and removed.

## Durable receipt and consumer

The upload allowlist is exactly plan, receipt, separate importer build receipt,
the two public artifacts, and each product's replay manifest, observation set and
original public-synthetic run artifact. No package directory, source archive or
arbitrary working directory is uploaded. Replay input hashes are bound by the
receipt and canonical collection record. The collector also commits all six replay
inputs and the sealed importer build receipt for scanner-free reproduction after
the Actions archive expires; the source gate rehashes those durable bytes. The UI never reads these replay inputs or
the internal run-artifact format.

`record-pii-evidence-comparison.mjs --run-id=<id> --head-sha=<sha> --write`
collects only an already successful first-attempt branch dispatch. It checks the
immutable workflow-head plan and approved cost decision, exact archive member set,
all replay input hashes, receipt bytes and both artifact bytes, then recomputes the
strict public comparison. It refuses an existing record rather than overwriting
history. `--check` validates the durable source or explicit absence.

`loadPiiEvidenceComparison` returns absent, invalid or recorded. Official receipt
consumption requires the independently collected record and exact receipt bytes.
It calls the existing schema-1.4 verifier with its own single unprojected population
pin, without widening the old four-view pin loader. It checks all 139 complete
case/variant/occurrence/method/scanner keys, exact source and artifact identities,
10 metric cells, sufficient counts, bounds and withheld reasons. The result lists
every paired outcome and changed count per mapped family. A changed outcome is
descriptive, not a release or support verdict. Per-family metric projection is
explicitly unavailable because this artifact has no family projection.

The upstream beta.12 Darwin record remains descriptive history. The canonical
Linux comparison has a different platform, engine binary and product package.
Local Darwin verification can match the historical engine binary; explicit axis
flags preserve that distinction without creating a regression verdict. No new result retroactively qualifies the four older
populations, validates missing product primitives, restores lost contexts or PHI
domain information, or activates protected execution.

## Reviewed future product inputs

An optional `--product-tuple=<file>` input supplies a closed
`pii-evidence-reviewed-products/1` record: external `reviewedBy`/`reviewedAt`,
`baseline` published source/version with the fixed npm package roster, exact
registry URLs and SHA512 integrities, and `candidate` source/version, successful
qualification run, inventory digest and exact core/native/WASM artifact hashes.
The engine, importer, protocol and adapter configuration remain fixed by the
reviewed contract. A tuple never grants execution or support acceptance.

The optional variant carries `plan.productTuple` and binds its full digest in
`execution.productTupleDigest`. Prepare a separate plan and a fresh cost decision
for that exact tuple. The CLI emits source/run/version outputs from the validated
variant; versions cannot contain shell or output-file control characters. Current
plans without this field keep their exact historical semantics and digests.

A variant also takes `--execution-paths=<file>` with exactly `planPath` and
`costDecisionPath`, under `benchmarks/pii-evidence-comparison/<safe-id>/` with the
filenames `plan.json` and `cost-decision.json`. The fresh scope binds both origin
paths. Commit the matching population index beside the selected plan. The wrapper
`evidence_plan` input selects that plan; all execution steps require that origin.
Unknown paths, escaping paths, symlinks and mismatched ids are refused before
execution. Copying an approved plan or decision to a different path cannot reuse
its allowance. A retained plan copied to the active view is readable but cannot
execute from that copied address.

Collect a successful variant with `--plan=<origin-path> --out-dir=<origin-directory>`
on the collector. It verifies the selected immutable-head plan, its scoped cost
decision and population index, then retains the full public synthetic replay set
in that fresh versioned directory. Existing records are never overwritten.
