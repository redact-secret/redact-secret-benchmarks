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
| `stable` | Every floor in either the T1 `documented` profile or the T2 `empirical` profile is met. Tier and evidence basis do not change when qualification changes. |
| `provisional` | At least one detector exists for the family, but it does not clear every `stable` floor (typically T2/tool-corroborated, or T1 with evidence still incomplete). |
| `pending` | The family's positive contract is tier T0, or no detector exists for it and no `unsupportedReason` was recorded. |
| `unsupported` | No detector exists for the family, and a reason was recorded for why. Never assigned without one — a detectorless family with no reason reports `pending` instead, per fail-closed convention (`benchmarks/lib/assessment.ts`: "Unknown fixtures fail closed into T0"). |

Tier alone never grants `stable`. T1 must clear the documented fixture and
behavioral gates. T2 must additionally clear the safe-observation,
corroboration, uncertainty, supported-context, and empirical fixture gates.
T3 is ineligible for empirical qualification regardless of fixture volume.

Evidence tier, evidence basis, and qualification profile are separate output
fields. In particular, empirical stable is represented as tier `T2`, basis
`empirically-observed`, profile `empirical` and is never rewritten as T1.

## Shape

`status-criteria.json` is the reviewable threshold data; changing a number
here is the entire mechanism by which a status can move for every family that
sits near that floor — no code change required:

```jsonc
{
  "schemaVersion": 1,
  "stable": {
    "documented": { "tier": "T1", "minimumPositiveCases": { "value": 6, "rationale": "..." }, "minimumTwinPairs": { "value": 5, "rationale": "..." } },
    "empirical": { "tier": "T2", "minimumObservations": { "value": 5, "rationale": "..." }, "minimumTwinPairs": { "value": 8, "rationale": "..." }, "contextConstrained": { "minimumFixtures": { "value": 48, "rationale": "..." } } },
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
`qualificationProfile` is `documented` or `empirical` only for stable results;
otherwise it is null. `reasons` names every `stable` criterion the evidence missed — the family's
actual number, the floor, and the floor's rationale — so a failing family
never reports a bare status with no explanation.

## Fixture profiles

Issue [#206](https://github.com/redact-secret/redact-secret-benchmarks/issues/206),
part of #114 and #177. `status-criteria.json` counts pass rates; it cannot say
that a family's 24 fixtures are all twins with no non-twin benign control.
`benchmarks/support/fixture-profiles.json` (schema `schemas/fixture-profiles-v1.json`,
`profilesVersion` 1) states how much fixture evidence each qualification path
needs, cell by cell, so a total never hides an empty cell.

The table below is generated from that file by `npm run profiles:generate`; CI
(`npm run profiles:check`) fails when it or `docs/generated/fixture-profile-coverage.md`
differs from a fresh generation.

<!-- fixture-profiles:begin -->
| Cell | Arrival / provisional | Stable / documented | Stable / empirical | Context-constrained empirical |
| --- | ---: | ---: | ---: | ---: |
| Total fixtures | 24 | 24 | 40 | 48 |
| Positive/context cases | 6 | 6 | 10 | 1 |
| Non-twin benign controls | 8 | 8 | 14 | 1 |
| Twin pairs | 5 | 5 | 8 | 10 |
| Positive-context axes | 4 | 4 | 6 | — |
| Control axes | 4 | 4 | 5 | — |
| Confusion axes | — | — | — | 6 |
| Evidence tier required | — | T1 | T2 | T2 |
| Enforcement | reported | reported | enforced | enforced |
<!-- fixture-profiles:end -->

Cells are counted from the corpus alone (`measureFixtureCells`): a twin pair is
an authored positive plus its negative twin, a positive/context case is a
secret-bearing fixture with no twin, an non-twin benign control is a
non-secret non-twin fixture. Positive-context axes are the distinct authored
context groups of the family's positives; control axes are the reviewed benign
taxonomy axes (never the unscored `pending`); confusion axes add the distinct
twin mutation kinds.

**Claims and fail-closed classification.** A family claims a profile with
`contracts[id].fixtureProfile`; a T1 provider-documented family implicitly
claims `stable-documented`. `classifyFamilySupport` refuses `stable` to a family
that misses a claimed profile and names each short cell (`fixtureProfile <id>:
<n> <cell> < <floor>`). An explicit claim, and any profile whose `enforcement`
is `enforced`, is binding; an unmeasured family fails closed. The two empirical
profiles require T2 evidence, so a T2 family can never be relabelled T1 to fit,
and they stay unreachable for `stable` until the observation and corroboration
gates of #177 and #205 are enforced.

**Measured before any status changed.** The arrival and documented profiles
ship as `reported`: the debt is published per family in the support matrix, the
coverage UI and `docs/generated/fixture-profile-coverage.md`, but does not yet
gate, because most families that read `stable` today miss arrival cells
(#207 and #209 raise them). Flipping `enforcement` to `enforced` is the whole
ratchet, in the same manner as `benign.minimumAxes`. See
[the decision record](../decisions/2026-09-24-enforce-fixture-profiles-and-publish-coverage-debt.md).

**Wilson bounds are corpus-relative.** A published Wilson bound describes the
fixtures in this corpus, treated as the sample it is. It is not a probability of
error on real-world text, and it does not bound how a detector behaves on
values this corpus does not contain. A bound tightens when more fixtures are
authored; it never measures the population.

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

## Peer scanner pins

A support classification or review-queue coverage claim is valid only when every
peer scanner (`gitleaks`, `trufflehog`) resolves to exactly the version pinned in
`qualification/suite-v1.json` ([ADR](../decisions/2026-09-23-require-pinned-peer-scanners-for-classification.md)).
`eval:classify` and `queue:check` resolve each peer's version before evaluating
and exit non-zero, writing no classification and reporting no coverage, when a
peer is unavailable, reports unparseable output, or differs from its pin. The
error names the scanner, the expected and observed versions, the suite file, and
the remediation. Peer version is part of a review-ledger id, so a patch bump
re-keys the ledger (#180: 27 `stable` families on TruffleHog 3.97.4, 5 on 3.97.6).

Remediation: put the pinned binary in a read-only directory first on `PATH`
(peers self-update) and rerun. Exploratory `eval` runs are not gated and may use
other versions; their output is not a classification or coverage claim.

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
[ADR](../decisions/2026-09-21-measure-benign-axis-diversity.md)), and its
`reviewQueue` resolved against `benchmarks/review-ledger.json`
(mutation/differential; a queued entry counts as unresolved unless the ledger
marks it `resolved` or `not-assertable` — the latter a per-operator-class
decision that no ground truth is inferable by construction, distinct from a
per-fixture review (issue #63,
[ADR](../decisions/2026-09-21-settle-mechanical-mutation-review-classes.md)); a
hard mutation failure counts as unresolved too — no ledger entry ever
un-reviews an assertion that failed outright). Each
family's contract `unprobeable` record (#33) is carried into the output
alongside its status, so a zero twin-pair reading is never silently
indistinguishable from "nobody got to it yet". `results-output/support-status.json`
(schema `schemas/support-status-report-v1.json`) is that per-family result,
unmodified — never a status re-derived or hand-adjusted downstream of this
function — for A8's `support-matrix.json` (#509) to consume.
