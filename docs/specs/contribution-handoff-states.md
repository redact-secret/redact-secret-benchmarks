# Contribution handoff states shared with the core repository

Issue [#533](https://github.com/redact-secret/redact-secret-benchmarks/issues/533), part of
[#531](https://github.com/redact-secret/redact-secret-benchmarks/issues/531). Core counterpart:
[redact-secret#1049](https://github.com/redact-secret/redact-secret/issues/1049). Decision:
[`decision-define-benchmark-handoff-states`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-30-define-benchmark-handoff-states.md).

Core's contract for the same five words is
[`implementation-ready-handoff`](https://github.com/redact-secret/redact-secret/blob/main/docs/contracts/contribution/implementation-ready-handoff.md).
Issue [#810](https://github.com/redact-secret/redact-secret-benchmarks/issues/810) aligned this spec with it; the
amendment is
[`decision-apply-implementation-ready-only-on-the-core-issue`](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-07-apply-implementation-ready-only-on-the-core-issue.md).

Public anchor for other issues to link:
`docs/specs/contribution-handoff-states.md#shared-vocabulary`.

This document measures and records. It asserts no product output and moves no support status
([boundary rule](../../AGENTS.md#boundary-rule)).

## Purpose

Contributors and core implementers need one small vocabulary for "where is this family in the funnel"
without learning dossier verdicts, tiers or evidence internals. This spec defines that vocabulary, what
each state requires, and what crosses the repository boundary. It adds no schema field, no verdict and no
gate. It is a reading of records that already exist.

## Shared vocabulary

Five workflow states. They label a **work item** (an issue), never a family's support status.

| State | Meaning | Who moves it |
| --- | --- | --- |
| `intake` | A suggestion or edge case was received and is not yet triaged into research | any contributor opens; a maintainer triages |
| `research-needed` | Triaged; the family's grammar, sources or issuance feasibility are not yet recorded | credential-evidence researcher on the case; the dossier owner for a legacy dossier |
| `implementation-ready` | Core may code now: the contract comes from the reviewed credential-evidence handoff and core's adoption ruling (conditions below) | core maintainer, on the **core** issue only, by the adoption comment |
| `verification-needed` | Core reports an implementation; the benchmark has not yet measured that exact candidate | core maintainer, by the reverse handoff |
| `complete` | The benchmark measured the exact candidate and recorded the result | benchmark maintainer, by the evidence PR |

Core implements detectors; this repository does not. `implementation-ready` is therefore never applied on a
benchmarks issue and never by a benchmarks maintainer. This repository's input to it is condition 5, the
benchmark counterpart. The dossier stays a legacy source of the contract only where its documented consumer
(core's new-detector-family checklist) still needs it. The `evaluation.owner` role in core's handoff is
`benchmarks-maintainer`; it owns `complete`, the evidence PR.

`complete` means "the loop closed and the measurement is recorded". It does not mean the candidate passed,
was promoted, or is supported (see [No inference rule](#no-inference-rule)).

### Relation to dossier verdicts

The dossier verdicts (`unresearched`, `ready`, `issuance-gated`, `date-gated`, `not-found`, `rejected`,
[dossier decision](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-29-keep-provider-research-in-validated-dossiers.md)) are unchanged
and remain the maintainer layer. The public states do not map one to one. Verdict reading:

| Dossier verdict | Public state it can support | Note |
| --- | --- | --- |
| `unresearched` | `intake` or `research-needed` | a stub; no research recorded |
| `ready` | may reach `implementation-ready` | only if every condition below also holds |
| `issuance-gated` | `research-needed` (deferred) | no handoff until the gate clears |
| `date-gated` | `research-needed` (deferred) | no handoff until the date passes |
| `not-found` | flow ends | see [Termination](#termination-and-deferral) |
| `rejected` | flow ends | see [Termination](#termination-and-deferral) |

The verdict is a fact about research. The workflow state is a fact about a work item. Neither is derived
from the other by tooling.

## Conditions for `implementation-ready`

Core applies `implementation-ready` on the core issue only when **all** hold, and each is
checkable from the repository at a named commit:

1. **Verdict.** The contract comes from the reviewed credential-evidence handoff and core's adoption ruling.
   Where a legacy dossier is still the documented consumer, its entry has `research.verdict: ready`, a `tier`, a `researchedAt` date
   and at least one research issue, and `npm run dossiers:check` passes.
2. **Identity.** The family id exists in `benchmarks/support/taxonomy.json` and belongs to the dossier's
   provider. A family that is not in the taxonomy is added through `npm run family:new` first, by a
   maintainer.
3. **Frozen contract.** A supported/excluded contract is recorded in a permalinked artifact (a 40-hex
   commit link, per the dossier permalink rule). The contract states the supported shape, the span, and
   the exclusions. It does not change after the handoff without a new dated verdict.
4. **Benign and twin requirements.** The contract lists the benign controls and near-miss twins the
   candidate must not flag, with the reason each is a control, so core can build its own minimal
   regression fixtures.
5. **Benchmark counterpart.** This is the benchmarks side's real input. A benchmark issue exists that names the
   corpus or fixture slice and the evidence path (for example `evidence/<issue>/README.md`) that will measure
   the candidate, so the reverse handoff has a named target. Benchmarks composes the cases and uploads fixtures
   to the corpus; it does not implement detectors.
6. **Limitations as exclusions.** Every unresolved limitation (an `issuance-gated` body, an undocumented
   length, a provider-undecided property) is written as an exclusion, not as support. Nothing the
   dossier's `blockedBy` line gates is inside the supported contract.
7. **Independence label.** Project-authored evidence is labelled project-authored. It is never described
   as independent, and a scanner's output or a peer majority is never the source of expected results.
8. **No secret-shaped literals.** The handoff carries no real, live or unrevoked credential and no newly
   written secret-shaped value. It describes shapes in words or grammars and quotes provider-documented
   prefixes only.

If any item is missing the family stays in `research-needed`. A maintainer states the missing item in the
issue rather than moving the state.

## Data the core issue receives

The handoff is core's adoption comment on the core issue (and, for a family that already has a research issue here, a
link back). It carries links and identifiers only. It never copies the benchmark corpus, generated
variants, holdout cases, raw result bundles or dossier prose.

| Field | Content | Source of truth |
| --- | --- | --- |
| Family / taxonomy identity | `provider:family` id | `benchmarks/support/taxonomy.json` |
| Dossier verdict | verdict, tier, `researchedAt` | `benchmarks/support/dossiers/<provider>.md` at a commit permalink |
| Frozen contract | supported shape and exclusions, permalinked | research evidence artifact (core `docs/audits/evidence/` or a benchmark report) |
| Benign / twin requirements | control list with reasons | the frozen contract |
| Benchmark counterpart | benchmark issue and evidence path that will measure the candidate | this repository |
| Unresolved limitations | the exclusions from condition 6, each with its `blockedBy` reason | the dossier entry |

The receiving core issue does not need the taxonomy internals, evidence tiers or fixture profiles. It needs
the six fields above and the commit they were read at.

## Reverse handoff: `verification-needed`

After core implements, the core maintainer comments on the benchmark counterpart with:

- the family id and the core issue and PR;
- the exact candidate identity: a commit SHA, or an exact published version with its artifact digest;
- the contract commit the implementation targeted.

The benchmark then moves the item to `verification-needed`. Verification is a measurement of **that exact
candidate** against the frozen contract, its controls and twins, recorded as evidence in this repository
(a candidate run, per the candidate evaluation spec). A different commit, a later published version or a
"latest" reference is a different candidate and needs its own run. Once the evidence is committed, pass or
fail, the item moves to `complete`.

A result that shows a defect is recorded as a finding (a known-gap record if it qualifies) and does not
reopen the contract. A change to the contract is a new dated dossier verdict and a new
`implementation-ready` handoff.

## Product implementation does not imply promotion

A merged core implementation says implementation work exists. It does not:

- promote a benchmark finding (`observed` to `reviewed` to `promoted` in `benchmarks/known-gaps.json`
  follows [its own lifecycle](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-09-18-govern-benchmark-promotion.md) and needs independent
  review evidence);
- change a family's measured status (`stable`, `provisional`, `pending`, `unsupported` stay derived from
  the support criteria and the support matrix);
- close a benchmark research issue (a dossier PR with `Closes #N` does that).

## No inference rule

No support status is inferred from a workflow state, and no workflow state is inferred from a support
status or a dossier verdict. `implementation-ready` does not mean supported. `verification-needed` does not
mean unverified-and-unsupported. `complete` does not mean stable. Support status is derived only from
measured evidence by the existing criteria; a handoff comment, label or issue state never feeds it. Tooling
that reads a workflow label must not write a status, tier or verdict.

## Termination and deferral

| Outcome | Effect on the flow | Record |
| --- | --- | --- |
| `issuance-gated` | The item stays in `research-needed`. No handoff. The `blockedBy` line names the sample that is missing. It resumes when a minted-and-revoked sample exists and a new dated verdict is recorded. | dossier verdict and `blockedBy` |
| `date-gated` | The item stays in `research-needed`. No handoff. It resumes after the provider date and a new dated verdict. | dossier verdict and `blockedBy` |
| `not-found` | The flow ends. No handoff, no core issue. Closed by the dossier PR that records the verdict, with `Closes #N`. | dossier verdict |
| `rejected` | The flow ends. No handoff. Closed the same way. A later material change is a new suggestion, not a reversal. | dossier verdict |

A family with a `ready` part and a gated part (the `convex:deployment-key` split) hands off only the
`ready` part. The gated part is an exclusion under condition 6.

## Traced example: `convex:deployment-key`

Every link below is a record that already exists. The trace uses the vocabulary only as a reading of them.

| Step | State | Record |
| --- | --- | --- |
| Research of the Tier B families | `research-needed` | product [#860](https://github.com/redact-secret/redact-secret/issues/860), benchmark [#436](https://github.com/redact-secret/redact-secret-benchmarks/issues/436) |
| Verdict `ready`, T1, `researchedAt` 2026-09-28; cloud `eyJ2` body left `issuance-gated` | `implementation-ready` for the hex body only | [`benchmarks/support/dossiers/convex.md`](../../benchmarks/support/dossiers/convex.md), frozen contract at the [`convex.md` permalink](https://github.com/redact-secret/redact-secret/blob/8b6a5fde52ecb4dfce13f09c7a947062d21483c7/docs/audits/evidence/860/convex.md) |
| Core implementation | (core side) | core [#912](https://github.com/redact-secret/redact-secret/issues/912) |
| Exact-candidate measurement | `verification-needed`, then `complete` on the committed record | [`evidence/860/436/README.md`](https://github.com/redact-secret/redact-secret-benchmarks/blob/65ffe7dcb3e7124e7f66cff96cab814f0365f69a/evidence/860/436/README.md), described in the [Tier B handoff report](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/reports/2026-09-28/beta-11-tier-b-corpus-handoff.md) |

The measurement record for this family found a benign-control regression introduced after the published
beta.10 (core #919). That is a recorded finding. It moves no status and promotes nothing. It shows why
`complete` is a record of measurement and not a pass.

This trace is documentation of the vocabulary over existing records. It adds no verdict for
`convex:deployment-key` and leaves the dossier unchanged.

## What this spec does not do

- No new dossier verdict, schema field, script, issue form or CI check. Issue forms, guided readiness
  output and the contribution docs are separate issues under #531 (#532, #534, #535).
- No change to `family:new`, `family:status`, dossier checks, arrival gates, protected evidence or the
  support-status rules.
- No change to any existing dossier verdict.
