---
decision_id: decision-build-evaluation-engine-now
status: accepted
scope: benchmarks
title: Build the Evaluation Engine as benchmark infrastructure now
decided_at: 2026-09-17
---

# Build the Evaluation Engine as benchmark infrastructure now

## Context

The Evaluation Engine was initially discussed as part of the beta.6 coverage
and qualification work. That timing couples evaluation infrastructure to the
product release cadence and postpones feedback that is already useful for the
beta.5 detector-quality work. The engine evaluates detector implementations;
it is not itself a detector or a product runtime feature.

This decision records the conclusion of the [project discussion](https://chatgpt.com/share/6aac98ab-1794-83ea-b12d-a9d4cbdc3717),
especially the ownership, extensibility, and sequencing of the Evaluation
Engine.

## Decision

- Build the Evaluation Engine in `redact-secret/redact-secret-benchmarks`,
  starting now. Do not wait for beta.6.
- Treat beta.6 as the first major consumer of an engine that has already been
  exercised and refined during beta.5 work, not as the release in which the
  engine is first created.
- Keep implementation truth in `redact-secret`, evaluation truth and evidence
  in `redact-secret-benchmarks`, and user-facing support claims in the main
  repository's documentation with links back to benchmark evidence.
- Use an internally extensible architecture: evaluation methods implement a
  common contract and register with a method registry. Mutation operators use
  the same registry pattern. Adding a method should normally mean adding and
  registering a module rather than adding method-specific branches to the
  engine core.
- Do not expose or promise a public third-party plugin API yet. The internal
  contract may change while the initial methods reveal the right abstraction.
  Public custom evaluators or plugins may be reconsidered after the contract
  stabilizes, no earlier than a later release such as v0.2.
- Do not create a third repository. Reconsider extraction only if the engine
  becomes a sufficiently general tool used by other scanners or security
  libraries.

## Initial scope and sequence

1. Establish the engine model and extension points: `EvaluationCase`, generated
   variants, method registry, operator registry, assertion layer, reporting,
   and provenance.
2. Implement Twin and Benign methods first so current precision work and known
   twin false alarms receive immediate structured feedback.
3. Add Metamorphic and Mutation methods to reevaluate existing detectors and
   provide feedback while new detectors are added.
4. Add Differential evaluation using the existing Gitleaks and TruffleHog
   adapters, producing a disagreement queue rather than treating either tool
   as ground truth.
5. Add Holdout evaluation after the common engine contract has matured enough
   to support its distinct lifecycle.

The intended repository boundary is:

```text
redact-secret-benchmarks/
├─ benchmarks/
│  ├─ engine/       # model, generation, execution, assertions,
│  │                 # reporting, and provenance
│  ├─ methods/      # twin, benign, metamorphic, mutation,
│  │                 # differential, and holdout
│  ├─ operators/
│  └─ support/      # provider, credential-family, and stable matrix data
├─ corpora/          # development, regression, and benign corpora
├─ holdout/
└─ scanners/
```

This is a directional boundary, not a commitment to create every directory
before the corresponding capability exists.

## Consequences

- Beta.5 detector work becomes the proving ground for the evaluation contract;
  interface changes discovered there are expected and remain internal.
- Beta.6 can focus on coverage strategy, provider gaps, the stable support
  matrix, and qualification policy using accumulated evidence.
- Evaluation failures should produce actionable issues or fixes in
  `redact-secret`; candidate artifacts are then rerun here until qualification
  passes.
- Stable support-matrix source data belongs here because support status is a
  qualification result backed by evaluation evidence. The main repository may
  publish that result, but does not become its source of truth.
- A public plugin surface, compatibility guarantees, plugin discovery and
  loading, version negotiation, third-party security policy, and compatibility
  testing are explicitly out of scope for the initial engine.
