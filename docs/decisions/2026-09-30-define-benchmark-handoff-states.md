---
decision_id: decision-define-benchmark-handoff-states
status: accepted
scope: benchmarks
title: Define benchmark handoff states as a work-item vocabulary that never implies support status
decided_at: 2026-09-30
---

# Define benchmark handoff states as a work-item vocabulary that never implies support status

## Context

[#533](https://github.com/redact-secret/redact-secret-benchmarks/issues/533), under
[#531](https://github.com/redact-secret/redact-secret-benchmarks/issues/531), needs the benchmark side of
the shared handoff with [redact-secret#1049](https://github.com/redact-secret/redact-secret/issues/1049).
Outside contributors and core implementers should not need dossier verdicts, tiers or evidence tiers to know
what happens next. The dossier verdicts and the derived support status already carry the governed meaning
([dossiers](2026-09-29-keep-provider-research-in-validated-dossiers.md),
[promotion](2026-09-18-govern-benchmark-promotion.md)).

## Options

1. **Map the dossier verdicts one to one to public labels.** Rejected: two gated verdicts and two negative
   verdicts do not correspond to distinct next actions, and it would make a label read as a research claim.
2. **Add a stage field to the dossier or to `taxonomy.json`.** Rejected: it would be hand-written state that
   drifts from the derived stage, and a `taxonomy.json` edit changes the digest recorded in the fixture index.
3. **A five-state work-item vocabulary defined in a spec, with no new field.** Chosen.

## Decision

- The public vocabulary is `intake`, `research-needed`, `implementation-ready`, `verification-needed`,
  `complete`. It labels work items, not families.
- `implementation-ready` requires a `ready` dossier verdict plus a frozen, permalinked contract, benign and
  twin requirements, a benchmark counterpart, and unresolved limitations written as exclusions. The full list
  is in the [spec](../specs/contribution-handoff-states.md#conditions-for-implementation-ready).
- `issuance-gated` and `date-gated` defer the flow in `research-needed`. `not-found` and `rejected` end it,
  closed by the dossier PR.
- The reverse handoff names an exact candidate. A different commit or version is a different candidate.
- A product implementation does not promote a finding, change a support status or close research.
- No support status is inferred from a workflow state, and tooling that reads a workflow label must not write
  a status, tier or verdict.
- Dossier verdicts and every existing gate are unchanged.

## Consequences

- Other issues under #531 link to
  [`docs/specs/contribution-handoff-states.md#shared-vocabulary`](../specs/contribution-handoff-states.md#shared-vocabulary).
- The core repository can adopt the same five words without importing benchmark internals.
- A change to the vocabulary or to the `implementation-ready` conditions is a new decision that amends this one.
