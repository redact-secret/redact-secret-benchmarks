---
decision_id: decision-propose-independent-pii-evidence-population-composition
status: proposed
scope: benchmarks
title: Keep pii-evidence and benchmark-owned PII populations independently identified
decided_at: 2026-10-08
---

# Keep pii-evidence and benchmark-owned PII populations independently identified

## Context

[#835](https://github.com/redact-secret/redact-secret-benchmarks/issues/835),
the first child of [#834](https://github.com/redact-secret/redact-secret-benchmarks/issues/834),
adds released pii-evidence as a separate public population. The owner's execution
instruction expressly preserves the existing four populations and their separate
provenance and denominators. This proposal makes that boundary inspectable; it
records no owner acceptance of new qualification criteria.

The [existing public authority decision](2026-10-07-switch-the-public-synthetic-pii-measurement-authority-to-pii-eval.md)
already separates pii-eval measurement, benchmark product qualification and pending
protected execution. Its frozen authorisation does not automatically cover a new
population, target, policy or run.

## Proposal

1. Register pii-evidence as an additional canonical public-evidence population.
   Its authors own its cases, fixture bytes, expectations, provenance and releases.
   pii-eval owns verification, import mapping, execution, replay and accounting.
   Benchmarks owns qualification and publication. Never copy authored evidence into
   the benchmark taxonomy or rewrite it to match a scanner.
2. Keep oracle-plan, qualification-plan, diagnostic-balanced and benign-heavy-stress
   at their existing identities and roles. The first two retain their identity-oracle
   and product-contract evidence; the latter two retain development-tuning and
   evaluation-only stress roles. This policy grants no additional tuning permission.
3. A conclusion carries its population identity, snapshot/import binding, artifact
   digest, scanner/package identity, engine/protocol and execution provenance.
   Each metric keeps its own applicability, sufficient counts and effective N.
   Authored cases, imported cases, variants and occurrences are distinct units.
   Replay adds no samples. Never pool counts across populations or scanners.
4. Propose composition as an inspectable vector of population-local conclusions,
   with family/axis applicability and mapping losses attached. Contradictions,
   missing observations and withheld values remain visible. No weighted overall
   score, majority vote or automatic support verdict is introduced. Existing numeric
   qualification criteria stay in their existing contracts. Selecting additional
   required populations or accepting a composed support verdict remains an explicit
   owner criterion, currently proposed and unaccepted.
5. Future protected evidence remains its own custody, provenance and denominator
   class. A public conclusion does not satisfy a protected gate. A missing protected
   run does not prevent public evidence measurement or publication. No protected
   execution or private audit is authorised by this proposal. Its authored-evidence
   owner is unresolved; naming private-custodian as executor does not appoint it as
   an authored oracle. Registration requires that future owner and contract first.
6. Preserve every import mapping loss. pii-eval #37 can improve the versioned
   PHI/context representation; current public snapshots can be measured while that
   work remains open. Any claim requiring a lost domain, context, sensitivity or
   span-less negative axis stays pending until faithfully represented and measured.
   Unknown kinds, jurisdictions and contracts refuse rather than acquire guessed
   meanings. A source label `phi` does not itself qualify PHI support.

The machine-readable proposal is
[`benchmarks/pii-population-policy.json`](../../benchmarks/pii-population-policy.json).
The [population policy specification](../specs/pii-population-policy.md) defines
the record boundary. Snapshot pinning, compatibility preflight, fresh measurement,
validated consumption, comparison and adoption are subsequent children #836–#841.

## Acceptance boundary

This ADR and composition criteria are proposed. The record has no accepted owner,
date or source. It selects neither a released scanner nor a qualified unpublished
candidate, creates no active evidence pin and spends no CI allowance. A concrete
official plan needs fresh cost authorisation; an authority repin needs its existing
fresh rehearsal and owner authorisation. No measurement or support threshold changes.

## Alternatives

- Replacing or pooling the four benchmark-owned populations loses provenance and
  changes denominators; the epic explicitly excludes it.
- Treating a replay or a version string as fresh same-artifact execution loses run
  identity. Historical Darwin engine official-mode evidence remains historical
  Darwin evidence; canonical benchmark runs require their Linux execution receipts.
- Waiting for protected infrastructure or pii-eval #37 before any public adoption
  incorrectly makes separate pending work a prerequisite for usable public input.
