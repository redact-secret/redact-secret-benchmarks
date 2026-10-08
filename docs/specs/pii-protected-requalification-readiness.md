# Protected requalification readiness: preparation only

Tracks [#667](https://github.com/redact-secret/redact-secret-benchmarks/issues/667) and
[#619](https://github.com/redact-secret/redact-secret-benchmarks/issues/619). This document records prerequisites,
not a run, acceptance, authority change, waiver, seal or budget reservation. Protected work waits until ready.
Public/synthetic pii-eval measurement proceeds independently of protected custody and EC2 deployment.

The public contract inventory is [the generated readiness record](../generated/pii-protected-readiness.json).
`node scripts/check-pii-protected-readiness.mjs` checks it against its deterministic generator and public source
hashes. After a reviewed source change, `--write` regenerates it. Neither command reads protected state or runs
an evaluator. Preparation membership is not measured coverage.

## Current PII target and evidence boundary

[#667's 2026-10-08 target](https://github.com/redact-secret/redact-secret-benchmarks/issues/667#issuecomment-6059642093)
is core `5696d7e1a2950bdf54fa21244f351e1c4b171f25`, PR #1284. Artifact qualification run
`37772337995` succeeded, attempt 1, with inventory SHA-256
`ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74`.
The unpublished candidate tarballs carry the same `0.1.0-beta.14` version label as the published baseline.
Their source and package digests differ; the version label alone does not freeze an evaluation.

This qualification is artifact evidence only. Six-family candidate-bound public probes, arrival runtime/package
cost, regression-budget disposition and official profile-cost evidence are **unmeasured for this target**.
A separate public comparison receipt may record the new pii-eval public measurement; it must preserve exact
artifact, engine, population and configuration identities. It does not mark any cost or protected gate met.

Historical beta13 target `401158d09a677b110fa60209256ba184b1f08f8f`, its unspent attestation, older cost acceptances,
and the 38m31s Ubuntu cost sequence remain historical evidence. Do not copy their verdicts, reuse their
commands as a current plan, reconstruct spent beta11 failures, or infer a fresh epoch from an old `0/1`.
This preparation creates **no epoch and spends no attempt**.

## #667 public and cost checklist

Every applicable gate needs evidence bound to the exact target before protected eligibility is claimed.
The generated record enumerates the gate ids from the retained disposition contract; this is a preparation
inventory, not permission to use the legacy evaluator as the new public measurement authority.

1. Freeze exact source, independently verified artifact bytes, benchmark revision, engine/configuration,
   family selections and authored population identities. Record activation/context-v2, PII-off invariance,
   identity classification, source/artifact equivalence and cross-surface output/determinism.
2. Recompute oracle, diagnostic-balanced and benign-heavy-stress populations; account for authored truth,
   resolved population mass, no regression and reviewed discrepancies. `pii-v1` requires benign cases **6**,
   benign axes **3**, denominator **4**, replays **2**, Wilson z **1.96**. Each applicable metric compares its
   declared interval bound with **0.5**, in its own upper/lower direction. Jurisdictional and reported-span
   applicability stays scoped; no missing denominator becomes a pass.
3. Measure arrival runtime on Node addon and Node Wasm with at least **10 paired samples** and **2 warmups**.
   The paired median regresses only when it exceeds **both +50% and +5 ms**. The generated record preserves
   the selection mapping, sample protocol and metric scope from `pii-national-id-arrival-v1`.
4. Arrival byte increases: packed core/Node/Wasm each **32,768 B**; default full Wasm raw **65,536 B**, gzip
   and Brotli each **32,768 B**; default common raw/gzip/Brotli each **0 B**; aggregate default payload raw
   **65,536 B**, gzip/Brotli **32,768 B**. The frozen evidence/879 common baseline is a separate zero-growth
   comparison. Split PII payloads are reported separately with **no frozen budget**. The default-Wasm-excludes-PII
   gate applies only when the artifact has split PII builds.
5. Recompute the #143 regression size rows and exact-target acceptances. A packed Node/Wasm acceptance covers
   only its matching trigger and candidate; it never waives runtime, other payloads or another commit. Preserve
   no-frozen-budget rows. The generated record includes the current numeric size trigger budgets.
6. Prepare a reviewed `pii-profile-cost-v2` target re-freeze: its committed plan currently names another source
   commit. Official Linux only: **3 distinct full-matrix A/A runs**, A/A-only threshold freeze, candidate with
   immutable thresholds, size collection, sanitized validation. Samples per side **12**, warmups **2**, fresh
   processes, ABBA order, same-job pairs, CPU identity, transient retries at most **2**. The generated record
   preserves the latency/initialization/memory formulas and size floors, unavailable cells and artifact roster.
   Local timings and the successful qualification build cannot substitute for this official protocol.

There is no new cost dispatch authorization in this document. Prepare the complete plan before any separately
covered official dispatch; no expensive workflow is triggered by generating or checking readiness.

## #667 protected checklist and maximum claim

`protected-path-live` remains **pending-not-operational**. Before a new protected attempt:

1. Finish exact-target public/cost eligibility above and the independently owned custody readiness below.
2. A genuinely separate authorized custodian session authors a fresh SSN seed with **at least 20 cases** in
   the protected zone. The reviewer actually reviews labels before attesting. Neither session shares protected
   content with product work or the orchestrator. Preserve family/view floors, sensitivity and identity axes.
3. Seal the reviewed population and bind exact engine, adapter, scanner, runtime, configuration, semantic
   population, custody commitment, plan, policy activation and budget identities. Do not substitute a package
   tree digest for a staged-file digest or a semantic population digest for a custody commitment.
4. Execute only under the exact authorized request/plan and fresh epoch's **one-attempt** rule. Exposure or
   uncertain failure is consumed; never reset budgets or run protected data for parity. Resolve every required
   trust question, with **0 unresolved**, then release only approved aggregate/commitment evidence.

All gates met can support **provisional**, not stable, for this protected requalification path. Otherwise retain
its precise blocking reason. No aggregate, seal, epoch or receipt has been produced by this preparation.

## #619 membership and frozen receipt preparation

The issue asks to inventory current membership, including generic subdivisions, before freezing. Today's
`credential-policy-v1` machine contract, corpus validator, retained kernel and receipt consumer agree on:

| Detector family | Taxonomy family | Bounded action |
| --- | --- | --- |
| bearer-token | generic:bearer-token | redact |
| connection-string | generic:connection-string-password | redact |
| otpauth-uri | generic:otp-seed | redact |
| generic-token | generic:unclassified-assignment-literal | fixture-resolved warn or redact |

These are current machine membership, not a claim that the historical four-family run qualifies today's target.
Generic assignment review must inventory high-signal/high-confidence **redact**, high-signal below that
contract **warn**, ambiguous-name stronger-contract **warn**, and excluded/unsupported controls. These slices
are not additional taxonomy families or measured cells. Confirm current vocabulary, value floors, assignment
operators, direct-literal exclusions and action resolution against the frozen target's reviewed policy contract.
No `block` or arbitrary-assignment support is claimed. Ory and Baseten's pending T3 intake is outside this
profile; T3 evidence alone does not add a family to it. If intended subdivisions require new membership, revise
and validate the contract/kernel/receipt together before freezing, preserving #660's kernel.

Per included family, public qualification needs positive cases **6**, positive axes **4**, benign cases **8**,
benign axes **4**, twin pairs **5**; exact misses, leaks, overbreadth, collateral, redact/block control false
alarms, unexpected/unresolved actions and unresolved critical failures are all **0**. Public conformance and
protected holdout are both required. Public synthetic cases cannot replace the protected holdout.

The JSON `receiptDraft` is deliberately **not a receipt**: exact product/benchmark revisions and report are
null until known. The real receipt has schemaVersion **2**, profileId `credential-policy-v1`, exact 40-hex
productRevision and benchmarkRevision, and a validated `credential-policy-holdout` report (report schema **1**).
That report must be complete, protected, custodian-declared and have a complete product scanner. Freeze
protocol, current membership and public prerequisites first; confirm an authorized custodian path and fresh
attempt rules before execution. Publish only the permitted aggregate after validating exact bindings.

## Historical local custody and operational hold

[The blind specification](blind-evaluation.md#2-roles-and-responsibilities) records the local separate-session
custodian route used before the new service: freeze identities/configuration/replays, keep the corpus outside
repositories, and release whitelisted aggregates only. Independence is **procedural-separation**,
organizational independence **false**. File permissions are **not a sandbox**. The orchestrator must not read
its private corpus, run directories, transcripts or ledger. Historical attempts are spent at reservation,
including crashes, once per candidate identity per epoch.

[Custodian ADR 0003](https://github.com/redact-secret/private-custodian/blob/main/docs/adr/0003-legacy-protected-lifecycle-handoff.md)
and [the migration inventory](https://github.com/redact-secret/private-custodian/blob/main/docs/legacy-migration.md)
preserve that legacy lifecycle until reviewed handoff; no real handoff has happened. That preserves historical
authority and budget semantics, not proof that a new pii-eval operational path is ready. A local directory's
existence or an old successful aggregate does not satisfy current protected-path-live. A different local host
route needs its own reviewed readiness evidence and policy; none is selected or activated here.

The selected new custody arrangement is still unverified EC2 with persistent control/state, separated signer,
exporter/checkpoints and isolated per-attempt workers. [#71](https://github.com/redact-secret/private-custodian/issues/71)
requires exact-host isolation; [#72](https://github.com/redact-secret/private-custodian/issues/72) requires catalog,
operator/disclosure policy, production v2 trust pins, approved delivery/revocation and deployed synthetic end-to-end.
Pending engineering includes author/seal CLI, authenticated delivery, durable attempt fencing and daemon adapter
selection. pii-eval #30's merged production adapters still need exact artifact provenance/current custodian
synthetic integration and host sizing evidence. Ledger #15's offline compatibility is completed; operational
writer/export/checkpoint/rotation #9–#12 remain separate prerequisites. Benchmarks never obtains ledger access.

Restricted activation, the exact first protected evaluation, benchmark authority cutover and exact projection
release/destination are separate approvals. This document grants none of them and records no owner waiver.
The next safe work is candidate-bound public measurement and offline preparation, while protected execution
waits for actual readiness.

## Recorded credential reconciliation for #647

These credential statuses come from the canonical NEW qualification view, not the local legacy
support-status report or the PII candidate. The released product is `0.1.0-beta.14`; they are not
claims about current candidate `5696d7e1`. The source is `public/results/qualification-v1.json`,
with byte SHA-256 `7a2863ff29f044f0eba33034ebd6e6526cbeba60a9f63a1fa72bd47470ed08c6`
and policy revision `rs-policy-1:sha256:94c247cf72ea74fa1f226af3392764e58a3bf64ad7af5056c3d68926a844f0da`.
The recorded credential distribution is **129 stable, 33 provisional, 5 pending, 17 unsupported**.
PII historical and current distributions are excluded. Each provisional/pending row below retains
its measured reason; no row is promoted or given an owner-approved deferral.

- policy-corpus: `sha256:47854ffdc5d0f75a6088b395b8f84d62b17469d6c91a32b18d9c1df5e33bb1ef`.
- public-evidence-snapshot: `sha256:4bec6e539482ad55f5d2e9ad25d84b5958d24050ada07271a33d50c6d4118586`.
- regression-corpus: `sha256:afedeab625b51e2bc842286c1ab93da7fcdc9e188c8b4b44573055e35d5f7e7b`.

For corroborated empirical families, observed-route floors are optional, not a prerequisite added
to the corroborated route. Missing corroboration, contradiction resolution, uncertainty or supported
contexts remains research work. For documented families with zero axis-qualified cases, this view
reports that floor even when other legacy fixture accounting reports authored cases.

| Family | Recorded status | Remaining measured or research reason |
| --- | --- | --- |
| `anthropic:admin-api-key` | provisional | mutation.unresolvedCritical: 2 > 0 |
| `anthropic:compliance-access-key` | provisional | mutation.unresolvedCritical: 2 > 0 |
| `aws:iam-user-secret-access-key` | provisional | metamorphic.criticalFailures: 7 > 0; mutation.unresolvedCritical: 1 > 0; differential.unresolvedContractDisagreements: 6 > 0 |
| `baseten:api-key` | provisional | qualificationProfile: tier T3 has no eligible documented, empirical, or bounded policy-qualified route; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `buildkite:access-token` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `fly:access-token` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `generic:bearer-token` | provisional | policy.positive-cases: 2 (requires 6); policy.positive-axes: 2 (requires 4); policy.benign-cases: 1 (requires 8); policy.benign-axes: 1 (requires 4); policy.twin-pairs: 1 (requires 5); policy.critical-failure: 20 (requires 0); policy.protected-holdout: not-run (requires pass on frozen candidate); metamorphic.criticalFailures: 14 > 0; mutation.unresolvedCritical: 2 > 0; differential.unresolvedContractDisagreements: 4 > 0 |
| `generic:connection-string-password` | provisional | policy.positive-cases: 2 (requires 6); policy.positive-axes: 2 (requires 4); policy.benign-cases: 1 (requires 8); policy.benign-axes: 1 (requires 4); policy.twin-pairs: 1 (requires 5); policy.critical-failure: 2 (requires 0); policy.protected-holdout: not-run (requires pass on frozen candidate); differential.unresolvedContractDisagreements: 2 > 0 |
| `generic:otp-seed` | provisional | policy.positive-cases: 3 (requires 6); policy.positive-axes: 3 (requires 4); policy.benign-cases: 3 (requires 8); policy.benign-axes: 3 (requires 4); policy.twin-pairs: 1 (requires 5); policy.protected-holdout: not-run (requires pass on frozen candidate) |
| `generic:unclassified-assignment-literal` | provisional | policy.positive-cases: 2 (requires 6); policy.positive-axes: 2 (requires 4); policy.benign-cases: 1 (requires 8); policy.benign-axes: 1 (requires 4); policy.twin-pairs: 1 (requires 5); policy.critical-failure: 294 (requires 0); policy.protected-holdout: not-run (requires pass on frozen candidate); benign.falseAlarms: 1 > 0; metamorphic.criticalFailures: 252 > 0; mutation.unresolvedCritical: 36 > 0; differential.unresolvedContractDisagreements: 6 > 0 |
| `github:app-server-to-server-token` | provisional | differential.unresolvedContractDisagreements: 23 > 0 |
| `github:app-user-to-server-token` | provisional | differential.unresolvedContractDisagreements: 23 > 0 |
| `github:classic-personal-access-token` | provisional | differential.unresolvedContractDisagreements: 23 > 0 |
| `github:oauth-access-token` | provisional | differential.unresolvedContractDisagreements: 23 > 0 |
| `github:oauth-refresh-token` | provisional | differential.unresolvedContractDisagreements: 23 > 0 |
| `mapbox:secret-access-token` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `mistral:realtime-client-token` | pending | Beta.10 research disposition (redact-secret#780, benchmarks #384): pending, no corpus. No source states a body length, alphabet or checksum, so only a carrier-gated shape could be justified and it needs hands-on issuance first; keyed env and Bearer contexts are already redacted by generic paths, and the documented client_secret.value and WebSocket subprotocol carriers are a generic-carrier question, not a Mistral family. Not the Mistral Studio key (mistral:api-key). |
| `okta:api-token` | provisional | empirical.unresolvedContradictions: 4 > 0 |
| `ory:network-api-key` | provisional | qualificationProfile: tier T3 has no eligible documented, empirical, or bounded policy-qualified route; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `polar:api-credential` | provisional | documented.minimumBenignCases: 6 < 8; documented.minimumTwinPairs: 4 < 5 |
| `polar:organization-access-token` | provisional | documented.minimumTwinPairs: 4 < 5 |
| `pydantic:logfire-token` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `sendgrid:api-key` | provisional | metamorphic.criticalFailures: 206 > 0; mutation.unresolvedCritical: 30 > 0; differential.unresolvedContractDisagreements: 32 > 0 |
| `slack:app-level-token` | provisional | empirical.corroborated.minimumReferences: 0 < 3; empirical.corroborated.minimumOwners: 0 < 3; empirical.corroborated.minimumClasses: 0 < 2; empirical.minimumObservations: 0 < 5; empirical.minimumSubjects: 0 < 2; empirical.minimumIssuanceDates: 0 < 2; empirical.minimumCorroborationClasses: 0 < 2; empirical.uncertainty: missing; empirical.supportedContexts: none; empirical.mode: missing |
| `sourcegraph:access-token` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `square:access-token` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `square:oauth-application-secret` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `together:api-key` | provisional | empirical.corroborated.minimumClasses: 1 < 2; empirical.minimumObservations: 0 < 5; empirical.minimumSubjects: 0 < 2; empirical.minimumIssuanceDates: 0 < 2; empirical.minimumCorroborationClasses: 1 < 2 |
| `twilio:api-key-secret` | provisional | differential.unresolvedContractDisagreements: 4 > 0 |
| `unkey:root-key` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |
| `vercel:access-token` | pending | positiveContractTier T0 |
| `vercel:api-key` | pending | Product #858 records this semantic contract as pending/T0. The class and vck_ marker are provider-backed, but no reviewed source establishes a complete body grammar or boundary. No scored fixture/profile cells exist, and the aggregate vercel-token detector is not attributed to this family. |
| `vercel:app-access-token` | provisional | empirical.minimumTwinPairs: 5 < 8; twinFailures: 1 > 0; mutation.unresolvedCritical: 2 > 0; fixtureProfile stable-empirical: 37 total fixtures < 40 (3 short); fixtureProfile stable-empirical: 5 twin pairs < 8 (3 short) |
| `vercel:app-refresh-token` | provisional | empirical.minimumTwinPairs: 5 < 8; twinFailures: 1 > 0; mutation.unresolvedCritical: 2 > 0; fixtureProfile stable-empirical: 37 total fixtures < 40 (3 short); fixtureProfile stable-empirical: 5 twin pairs < 8 (3 short) |
| `vercel:integration-token` | pending | Product #858 records this semantic contract as pending/T0. Provider evidence establishes the vci stem but not the underscore, body grammar, or boundary; the current detector's vci_ branch is an implementation hypothesis. No scored fixture/profile cells exist, and the aggregate vercel-token detector is not attributed to this family. |
| `vercel:personal-access-token` | provisional | empirical.minimumTwinPairs: 5 < 8; twinFailures: 1 > 0; mutation.unresolvedCritical: 2 > 0; fixtureProfile stable-empirical: 37 total fixtures < 40 (3 short); fixtureProfile stable-empirical: 5 twin pairs < 8 (3 short) |
| `voyage-ai:api-key` | pending | Beta.10 research disposition (redact-secret#785, benchmarks #384): pending, no corpus. The only body evidence is one betterleaks rule and community pages, no issued key confirms it, and pa- and al- are common two-letter prefixes, so a bare rule has low precision. Named-assignment, Bearer, JSON, YAML and tool-call forms are already redacted by the generic paths; revisit after the hands-on issuance the research comment lists. |
| `xata:api-key` | provisional | documented.minimumPositiveCases: 0 < 6; documented.minimumPositiveAxes: 0 < 4; documented.minimumBenignCases: 0 < 8; documented.minimumControlAxes: 0 < 4; documented.minimumTwinPairs: 0 < 5; benign.minimumCases: 0 < 5; benign.minimumAxes: 0 < 3 (axes present: none) |

The four bounded policy families remain provisional under #619: bearer token, connection-string
password, OTP seed, and unclassified assignment literal. Their public cell deficits and any critical
failures above precede a frozen protected holdout; historical local custody is not a new receipt.
Ory/Baseten have only T3 runtime intake, not completed T1 contracts. Mistral realtime, Vercel
API/integration tokens, VoyageAI and the T0 Vercel aggregate retain their recorded research holds.

For PII, all six current-target rows remain pending until the separate public comparison is recorded
and qualification gates are evaluated. #615 still lacks trusted protected activation; #616 records
the missing product validator primitive seam without claiming its full acceptance is complete.
#619 and protected operational readiness remain open. A pending gate is not an owner-approved deferral.
