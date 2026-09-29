---
decision_id: decision-bind-the-beta10-cross-domain-release-record
status: accepted
scope: benchmarks
title: Bind one beta.10 release record across credential and PII without merging their metrics
decided_at: 2026-09-27
---

# Bind one beta.10 release record across credential and PII without merging their metrics

## Context

Issue [#287](https://github.com/redact-secret/redact-secret-benchmarks/issues/287)
asks for one durable record a maintainer can read to decide beta.10 release
readiness, binding the credential and PII evaluation domains to one release
candidate without recomputing or combining their denominators. Its
architecture dependencies, [#288](https://github.com/redact-secret/redact-secret-benchmarks/issues/288)
(shared accounting primitives split from credential/PII contracts) and
[#284](https://github.com/redact-secret/redact-secret-benchmarks/issues/284)
(PII accounting/qualification gates), are both closed and already produce the
two report shapes this record binds.

Both domains already produce a mature, independently-validated "is this
candidate qualified" artifact:

- Credential: `validateEvidence(report, 'qualification')`
  (`benchmarks/evaluation/domains/credential/evidence.ts`) — embeds the
  `holdout` report, per-method scanner assertions, `accounting` reasons, and
  `milestone` status, bound to one candidate via `provenance.{sourceHash,
  lockHash, candidateArtifactHash}` matching `holdout.candidate`.
- PII: `PiiQualificationReport` (`benchmarks/evaluation/domains/pii/qualification.ts`)
  — `{ domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion:
  'pii-v1', status: 'stable'|'provisional'|'not-applicable', evidence, gates,
  accounting }`, bound to a candidate via `trusted-product-bindings-v1.json`
  and `evidence.{protected,independent}.candidateArtifactHash`.

Neither report shape overlaps with the other, and `assertCompatibleIdentities`
(`benchmarks/accounting/shared/primitives.ts`) already throws
`Cross-domain accounting aggregation is forbidden` the moment two artifacts
with different `domain` fields are passed to any aggregation helper. #287
does not need a new aggregation primitive; it needs an **index** that carries
both artifacts, side by side, plus the release-candidate identity that is
implicit in each one separately today but never asserted to be the *same*
candidate across domains.

## Decision

Add `benchmarks/evaluation/release-record.ts`, a domain-neutral module (it
lives beside `release-record` peers, not inside either domain directory)
exporting:

- `ReleaseRecordIdentity` — the shared binding: `productSourceCommit` (the
  one `redact-secret/redact-secret` commit both domain artifacts must name),
  `benchmarkRevision` (this repo's commit), `performanceBudgetVersion` (a
  `Budgets.budgetsId` from `benchmarks/lib/regression-budgets.ts`),
  `corpusCommitments: { credential, pii }`, `profileVersions: { credential,
  pii }`, and `holdoutState: { credential, pii }` mirrored from each embedded
  report's own holdout section.
- `ReleaseRecord` — `{ schemaVersion: 1, reportType: 'beta10-release-record',
  supportClaims: false, identity, credential: { qualification, support,
  reportCommitment }, pii: { qualification, binding, reportCommitment },
  artifactCommitment }`. Every level uses the repo-wide `exact(value, keys)`
  key-list check, so an added field — merged or not — fails validation until
  the key list is updated by hand; there is no open-ended object anywhere in
  this shape.
- `assembleReleaseRecord(input)` — takes the two domains' own artifacts
  unmodified (each still passes its own domain validator: `validateEvidence`
  for credential, `validatePiiQualificationReport` /
  `validatePiiProductBinding` for PII) plus the identity, and asserts they
  name the same `productSourceCommit`. It computes nothing about detection
  quality; it only reconciles identity fields that already exist inside each
  artifact.
- `validateReleaseRecord(value)` — re-validates both embedded artifacts
  through their own domain validators, recomputes `assembleReleaseRecord`
  from the embedded artifacts, and deep-compares the result against the
  stored value (the same assemble-then-compare idiom used by
  `validatePiiQualificationReport` and `validatePiiAccountingReport`).
- `assertNoCrossDomainAggregate(value)` — a recursive guard, run inside
  `validateReleaseRecord`, that throws if any key in the object graph matches
  a small denylist (`overallScore`, `combinedAccuracy`, `overallAccuracy`,
  `combinedFalsePositiveRate`, `f1`, `precision`, `recall`, `combinedRate`).
  The `exact()` key lists already make an unlisted field a hard validation
  failure; this is the explicit, greppable statement of the guardrail from
  the issue text, kept as a second, independent check rather than relying on
  the key lists alone.

`supportClaims: false` on the record mirrors the convention already used on
`PiiActivationEvidence` / `PiiFamilyQualificationEvidence`: the record itself
never becomes the thing a promotion cites as the assertion — per this repo's
boundary rule, it measures and records, and does not by itself declare beta.10
ready.

## Scope not covered by this decision

This decision defines the record's shape and its binding/guardrail behavior.
It does not yet build a schema file under `schemas/` for `ajv` (the module
validates with plain `exact()`/type checks today, matching how
`benchmarks/accounting/shared/primitives.ts` and several PII accounting
helpers ship without an Ajv schema and add one only when a report crosses a
process boundary as JSON). That remains follow-up work under #287.

`scripts/produce-beta10-release-record.mjs` (added 2026-09-28; schema 2 and
`scripts/produce-release-record.mjs` added by the amendment below) is the
gathering script: it reads already-produced evidence files (credential
`candidate`/`qualification` evidence, a PII `PiiQualificationReport`, a
`PiiTrustedProductBinding`, a performance-`BudgetReport`) named as CLI
arguments and calls `assembleReleaseRecord`. It does not decide which commit
is the release candidate, measure anything itself, or fetch evidence from
CI — every identity and evidence path is a required argument, supplied by
whoever runs it for a specific candidate, mirroring
`scripts/qualify-pii-family-candidate.mjs` and `scripts/observe-pii-populations.mjs`'s
own CLI-argument conventions.

`validatePiiProductBinding` also checks its input against the committed
`trusted-product-bindings-v1.json` ledger, and the raw evidence that hashed
into that ledger's six existing rows is not itself stored in the repository.
A unit test therefore cannot exercise `assembleReleaseRecord`'s full happy
path today; `tests/release-record.test.mjs` covers the guardrail, delegation,
and shape-rejection behavior that is reachable without a real sanctioned
candidate, and the happy path is exercised for the first time by whichever
script (the follow-up above) assembles a record for an actual accepted
release candidate.

## Amendment (2026-09-29, #449): schema 2, a PII route, and a reviewed source equivalence

Beta.11 PII evidence is qualified at one commit (`8b6a5fd`, benchmarks #428),
so the single-commit binding #287 lacked is available. It is not reachable
through the v1 trusted product binding, though: `trusted-product-bindings-v1.json`
accepts only `pii:qualify:candidate` output, whose frozen per-family plans pin
`vocabulary=pii-context/v1`, and Beta.11 reports `pii-context/v2`. Rewriting
those plans after the fact would re-author frozen truth. The Beta.11 disposition
already reaches publication through the reviewed v2 protected-support route
(`protected-support-bindings-v1.json`, checked by `bindPiiProtectedSupport`).
The published source `94fc18a` differs from `8b6a5fd` only in version strings,
READMEs, docs and product scripts.

Decision:

- Schema 1 (`beta10-release-record`, `assembleReleaseRecord`) is unchanged and
  stays the beta.10 path, produced by `scripts/produce-beta10-release-record.mjs`.
- Schema 2 (`reportType: 'release-record'`, `assembleReleaseRecordV2` /
  `validateReleaseRecordV2`) adds `release: { version, sourceCommit }`. The
  credential candidate run must be a clean full-suite run of that commit that
  declares that version, and the performance report must name the same commit.
- Its `pii` section carries a `route`: `trusted-product-binding` (the v1 binding,
  as in schema 1) or `pii-b11-protected-v1` (a reviewed protected-support entry
  plus the committed protected disposition it names). Either way the section
  names its `evidenceSourceCommit`. The route never projects `stable`, and its
  counts stay PII-only.
- When `evidenceSourceCommit` differs from the release commit, the record must
  carry a `sourceEquivalence` that is, byte for byte, an entry of the reviewed
  ledger `benchmarks/evaluation/release-source-equivalences-v1.json`. An entry
  lists the changed product build inputs and names two full-suite credential
  candidate runs, one of each commit at one benchmark revision.
  `verifyReleaseRecordEvidence` (`release-record-evidence.ts`) re-derives the
  protected route from committed evidence and re-derives the parity (same
  fixtures, same outcome and finding count on every fixture) from the two runs.
  An entry is added by review, like the protected-support bindings. It is never
  inferred from output.
- `scripts/produce-release-record.mjs --release-version --source-commit
  --pii-route ...` produces schema 2 for any release.

The first schema 2 record is Beta.11, frozen at
[`evidence/449/`](../../evidence/449/README.md). It supersedes #287's beta.10
record, which was never produced: beta.10 PII evidence is per-family at six
commits, and the per-family evidence under `evidence/875`–`880` stays as it is.

## Consequences

A maintainer reads one file to see both domains' qualification status side by
side, each still traceable to its own accounting version and candidate
binding. No code path can produce a single credential+PII score: the
denylist guard and the exact key lists both fail closed if one is attempted,
and `assertCompatibleIdentities` continues to fail closed for any lower-level
aggregation attempt. A domain failure remains visible in its own section
regardless of the other domain's status, because each domain's `status`
field is copied through unmodified rather than reduced to a boolean.
