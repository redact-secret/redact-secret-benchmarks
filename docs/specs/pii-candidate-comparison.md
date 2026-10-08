# Current public PII comparison (#615, #616, #647)

This measures and records the exact core #1003 candidate using pii-eval. It does
not accept a support verdict, change PII authority, or execute a protected corpus.

## Frozen inputs

`benchmarks/pii-candidate-comparison/plan.json` is derived by
`scripts/pii-candidate-comparison-plan.mjs`. Baseline is published npm beta.14,
source `0c62fd38bca75c5b28b042dc79789b708ebf1d17`, with lockfile dist integrities.
Candidate is the unpublished, qualified beta.14 build at
`5696d7e1a2950bdf54fa21244f351e1c4b171f25`, qualification run `37772337995`,
inventory SHA256 `ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74`.
Identical package version strings do not mean identical builds.

Engine is pii-eval `b1c097e40bad456e52f904f626cca00b69c45612`, protocol pii-v1
revision 2, public artifact schema 1.4. Its released adapter hardcodes an older
release, so both sides use the engine's tree-pinned candidate adapter. The
baseline's actual published npm provenance remains explicit.

Both sides execute the same four public/synthetic populations, with 146, 266,
477 and 299 memberships. Each run performs two scanner replays. Expectations,
snapshot and roster stay fixed; manifests bind each installed product tree.
Range-less expectations remain unresolved. Available denominators and withheld
cells stay distinct, including family, language and control strata.

## Activation and validator evidence

The driver captures the installed product's reported activation for ten selector
sets, on native Node and forced WASM, for each side: 40 captures. It checks off,
global, US, union and six exact-family selections. Package, binary and declared
family-set identities are verified before execution. The PII-complete WASM
tarball is the full edge-qualified artifact, not the default clean-install WASM.

The engine's semantic artifact binds the core package tree. Native and WASM
extra-artifact verification belongs to the producer receipt and is stated as
such. Activation is configuration evidence, not detection qualification.
Primitive product-validator conformance remains unavailable; the identity-only
example seam does not supply those vectors. The retained reason is
`product-validator-primitive-seam-unavailable`.

## Execution and cost boundary

Local Darwin execution is exploratory verification. It never replaces, or is
compared with, a canonical Linux run. Existing official beta.13 run
`37559349070`, its authority record and its population pins remain unchanged.

The `candidate-comparison` lane of `pii-official-run.yml` calls the reusable
`pii-candidate-comparison.yml` at the same commit. Both plans are committed; the
dispatch input only selects a lane and cannot name an arbitrary product or
engine. The paired job uses Ubuntu 24.04, has a **15-minute timeout**, executes
**eight public runs with two replays each**, and executes **zero protected runs**.
It does not run the full profile-cost measurement.

A fresh owner decision must bind the exact engine, baseline, candidate,
qualification inventory and those limits before official dispatch. Without
`benchmarks/pii-candidate-comparison/cost-decision.json`, the plan remains
exploratory and `--require-canonical` refuses. The historical #796 allowance was
already spent and does not cover this comparison. The dispatch guard rejects
reruns and another dispatch using the same decision, including another commit
that copies it. Infrastructure failure requires a fresh decision; there is no
automatic retry or budget reset.

App tokens are read-only and limited to engine/product downloads. They are not
in the environment of product installation, packing, activation or scanning.
Only the plan, sanitized receipt, descriptive summary and eight public artifacts
are uploaded. No protected state, raw scanner trace or corpus text is uploaded.

## Consumption and remaining gates

The strict comparison consumer verifies the plan, receipt and all eight public
artifacts before producing counts or deltas. Missing or invalid evidence is
displayed explicitly. A summary file is never a source of authority.

The support matrix's optional `piiCurrentQualification` carries the exact new
target and measured evidence separately from historical beta.11 qualification.
All six current families remain pending until the required current gates are
evaluated. Public comparison alone does not satisfy validator conformance,
current profile-cost, independent evidence, or protected qualification.

Protected readiness is [a preparation inventory](pii-protected-requalification-readiness.md),
not a receipt. #667 waits for current public/cost gates and operational custody;
#619 additionally reconciles and freezes credential-policy membership. #647
prepares these targets first and later records results or owner-approved holds.
The [peer accuracy inventory](pii-peer-accuracy-readiness.md) now links reviewed
default adapters and eight validated local artifacts over the same populations.
#576 remains open for independent ground-truth/diversity review, sensitivity
semantics and a canonical release comparison.

The reusable workflow uses GitHub's same-repository `$/` syntax to bind the
running revision ([GitHub announcement](https://github.blog/changelog/2026-07-30-reference-same-repository-actions-with-self-repository-syntax/)).
