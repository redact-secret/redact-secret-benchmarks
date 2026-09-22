# Family support status: stable / provisional / pending / unsupported

Issue: [#503](https://github.com/redact-secret/redact-secret/issues/503), part of
[Epic A](https://github.com/redact-secret/redact-secret/issues/500). Data:
`benchmarks/support/status-criteria.json`, schema
`schemas/support-status-criteria-v1.json`, typed access and the decision
function `benchmarks/support/status.ts`. Families are the unit these statuses
attach to; see [taxonomy.md](taxonomy.md) for why detector name is the wrong
unit.

## Why this exists

Before this issue, "supported" was a claim a human typed into a README table.
This project has detectors ranging from provider-documented (T1, e.g.
`github-token`) to tool-corroborated only (T2, e.g. `openai-token`) to no
stable positive at all (T0, e.g. `supabase-token`), and no rule said which of
those a reader could trust. `classifyFamilySupport` replaces the table with a
pure function: same evidence in, same status and reasons out, every time.

## The four statuses

| status | meaning |
| --- | --- |
| `stable` | Every floor in `status-criteria.json`'s `stable` block is met: a T1, provider-documented positive contract, plus twin, benign, metamorphic, mutation and differential evidence with no unresolved critical disagreement. |
| `provisional` | At least one detector exists for the family, but it does not clear every `stable` floor (typically T2/tool-corroborated, or T1 with evidence still incomplete). |
| `pending` | The family's positive contract is tier T0, or no detector exists for it and no `unsupportedReason` was recorded. |
| `unsupported` | No detector exists for the family, and a reason was recorded for why. Never assigned without one — a detectorless family with no reason reports `pending` instead, per fail-closed convention (`benchmarks/lib/assessment.ts`: "Unknown fixtures fail closed into T0"). |

Tier alone never grants `stable`: a T1 contract with zero twin pairs still
fails `minimumTwinPairs` and lands on `provisional`.

## Shape

`status-criteria.json` is the reviewable threshold data; changing a number
here is the entire mechanism by which a status can move for every family that
sits near that floor — no code change required:

```jsonc
{
  "schemaVersion": 1,
  "stable": {
    "positiveContract": { "requireProviderSource": true, "rationale": "..." },
    "minimumTwinPairs": { "value": 5, "rationale": "..." },
    "twinFailures": { "value": 0, "rationale": "..." },
    "benign": { "minimumCases": { "value": 5, "rationale": "..." }, "minimumAxes": { "value": 3, "rationale": "..." }, "falseAlarms": { "value": 0, "rationale": "..." } },
    "metamorphic": { "criticalFailures": { "value": 0, "rationale": "..." } },
    "mutation": { "unresolvedCritical": { "value": 0, "rationale": "..." } },
    "differential": { "unresolvedContractDisagreements": { "value": 0, "rationale": "..." } }
  },
  "provisional": { "requiresDetector": true, "rationale": "..." },
  "pending": { "tier": "T0", "rationale": "..." },
  "unsupported": { "requiresReason": true, "rationale": "..." }
}
```

Every threshold carries its own one-line rationale, enforced by
`schemas/support-status-criteria-v1.json` and a test
(`tests/support-status.test.mjs`) that every threshold's rationale is
non-empty.

`classifyFamilySupport(evidence, criteria)` takes a `FamilySupportEvidence`
record (positive-contract tier and provider-source flag, twin pairs/failures,
benign cases/false alarms, benign axis count and the axis ids themselves
(`benignAxes`/`benignAxisIds` — issue #92, distinct `must-not-flag` taxonomy
axes such as `near-miss`/`placeholder`/`reference`, not merely a case count),
metamorphic critical failures, mutation unresolved critical, differential
unresolved contract disagreements, detector list, and an optional
`unsupportedReason`) and returns `{ family, status, reasons }`.
`reasons` names every `stable` criterion the evidence missed — the family's
actual number, the floor, and the floor's rationale — so a failing family
never reports a bare status with no explanation.

## What this issue does not do

Producing real `FamilySupportEvidence` per family — aggregating
`benchmarks/engine/reporting.ts`'s `byDetector` summaries, the review ledger,
and `taxonomy.familiesForDetector` across every registered family (42 when #504 was filed; 46 as of
2026-09-21, `benchmarks/detectors.json` being the source of truth) — is
[#504](https://github.com/redact-secret/redact-secret/issues/504) (A3). This
issue ships the criteria and the decision function only, proven against
synthetic evidence in `tests/support-status.test.mjs`; it does not classify
any real family. The starting numbers in `status-criteria.json` (5 twin
pairs, 5 benign cases, zero tolerance elsewhere) are a first proposal and may
be tuned once A3 runs them against real data, per #503.

## Consuming this from A3/A8

```ts
import { classifyFamilySupport, statusCriteria } from '../support/status.ts';
import { familyEvidence } from '../support/evidence.ts';
import { contracts } from '../lib/assessment.ts';
```

A3 (`benchmarks/classify-support.ts`, `npm run eval:classify`) builds one
`FamilySupportEvidence` per **registered detector** — `Object.keys(contracts)`,
exactly `benchmarks/detectors.json`'s ids (42 when #504 was filed, 46 as of
2026-09-21) — not per
`taxonomy.families[]` entry: the taxonomy's provider:credential-name units are
finer-grained (79 as of 2026-09-21, several per detector) and are the unit A8's support matrix
displays, via `familiesForDetector`, not the unit this evidence attaches to.
`familyEvidence` reads a full `runEvaluation` report's `byDetector` summaries
(twin/benign/metamorphic assertions, scoped to the `redact-secret` scanner),
its `axesByDetector` (distinct benign taxonomy axes per family, case-level,
`reporting.ts`'s `summaries()` — see
[ADR](decisions/2026-09-21-measure-benign-axis-diversity.md)), and its
`reviewQueue` resolved against `benchmarks/review-ledger.json`
(mutation/differential; a queued entry counts as unresolved unless the ledger
marks it `resolved` or `not-assertable` — the latter a per-operator-class
decision that no ground truth is inferable by construction, distinct from a
per-fixture review (issue #63,
[ADR](decisions/2026-09-21-settle-mechanical-mutation-review-classes.md)); a
hard mutation failure counts as unresolved too — no ledger entry ever
un-reviews an assertion that failed outright). Each
family's contract `unprobeable` record (#33) is carried into the output
alongside its status, so a zero twin-pair reading is never silently
indistinguishable from "nobody got to it yet". `results-output/support-status.json`
(schema `schemas/support-status-report-v1.json`) is that per-family result,
unmodified — never a status re-derived or hand-adjusted downstream of this
function — for A8's `support-matrix.json` (#509) to consume.
