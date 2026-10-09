# PII population ownership and composition proposal (#835)

Status: proposed. [ADR](https://github.com/redact-secret/redact-secret-benchmarks/blob/40809e8ce53eb94509d3b6bb3ae877ca8d4021f4/docs/decisions/2026-10-08-propose-independent-pii-evidence-population-composition.md).
Machine record: [`benchmarks/pii-population-policy.json`](../../benchmarks/pii-population-policy.json).
Closed proposal schema: [`schemas/pii-population-policy-v1.json`](../../schemas/pii-population-policy-v1.json).
Validator: `scripts/lib/pii-population-policy.mjs`; scoped check:
`node --test tests/pii-population-policy.test.mjs`.

## Owners and roles

The record assigns one authored-evidence owner to each public population. pii-evidence
owns released public snapshot truth; benchmarks owns the four existing public
plans. The future protected class names private-custodian as custody/execution
boundary and private-ledger as private-audit owner. Its authored-evidence owner
is unresolved; custody is not ground truth. It cannot become a runnable population
until that owner and its reviewed evidence contract are explicitly recorded.
pii-eval owns public measurement; benchmarks owns qualification.

The logical `pii-evidence` class is not a snapshot pin. #836 binds a released
snapshot, compatible mapping/engine and imported population. The future protected
class is not a registered runnable population. Existing public IDs/digests remain
in `benchmarks/pii-eval-population-pins.json`; this policy does not regenerate them.

Role sources: `beta11-qualification.ts:130–138` derives the oracle-plan from
authored identity labels, and `:336` keeps qualification-plan as a separate view.
`populations-v1.json:48,159` names diagnostic-balanced development-tuning and
benign-heavy-stress evaluation-only; `populations.ts:155–162` permits tuning only
for development-tuning under a validated manifest and full inventories. No broader
tuning permission is inferred for oracle-plan or qualification-plan.
At private-custodian commit `61f2a43e20d57f0f52a81d8eed546b286b649826`,
[`GroundTruthClaim`](https://github.com/redact-secret/private-custodian/blob/61f2a43e20d57f0f52a81d8eed546b286b649826/crates/custodian-contracts/src/common.rs#L335)
only supports not-established, and the
[`verification scope`](https://github.com/redact-secret/private-custodian/blob/61f2a43e20d57f0f52a81d8eed546b286b649826/crates/custodian-verify/src/report.rs#L26)
explicitly disclaims independent protected evaluation and ground truth.

## Accounting and inspectable composition

Every result retains population and scanner identity, its own metric's sufficient
counts and effective N, applicability, unresolved counts and withheld reason.
Imported case splits do not become extra independent authored samples. Replay
agreement is reproducibility evidence, never additional samples. A partial subset
is not renormalised and a withheld metric is not zero or pass. Not-applicable must
come from the protocol's declared scope, never from poor observed performance.

Proposed composition is a vector of population-local conclusions. A review can
cite several explicitly identified results for the same exact product and axis;
it cannot sum their denominators, average their rates or erase a contradiction.
Engine/protocol changes and product changes remain separate comparison identities.
The vector carries missing and unresolved applicability as well as measured cells.
No product verdict is derived by this record. Owner criteria remain proposed;
numeric floors and thresholds remain in existing qualification contracts.

The #835 validator refuses metadata that allows pooling, misassigns owners or
invents an approval. It does not consume measurement results. #839 must enforce
these same boundaries in the actual conclusion consumer and publication path;
this proposal does not claim that a future result consumer already exists.

## Mapping and protected separation

Import binding must expose excluded kinds, per-variant mapping losses and the
authored-to-imported lineage. The initial consumer can lose PHI domain, context,
context-dependent sensitivity and span-less identity/sensitivity expectations.
Claims depending on those axes stay pending. pii-eval #37 is a versioned protocol
follow-up, not a general public snapshot adoption blocker. Unknown input semantics
refuse instead of being mapped from scanner output.

Protected aggregates never enter a public denominator. Their missing/pending state
is independent of a valid public measurement. Custody, independent review, protected
attempt budgets and product qualification remain governed by their own contracts.

## Next steps

#836 pins the release and consumer; #837 verifies compatibility without executing
scanners; #838 selects a concrete accepted/published target and prepares fresh Linux
measurement; #839 publishes the separate population; #840 compares fixed evidence;
#841 separates adoption proposal from maintainer acceptance. No child may infer a
new owner acceptance, official cost allowance or authority change from this policy.
