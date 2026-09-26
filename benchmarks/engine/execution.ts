import type { EvaluationCase, Registry, Method, Operator, Scanner, Observation, CaseResult, ReviewLedger, Summary } from './types.ts';
import type { AccountingConfig, DeltaCause, Finding, Fixture } from '../types.ts';

export interface EvaluationOptions {
  cases: EvaluationCase[]; methods: Registry<Method>; operators: Registry<Operator>; scanners: Scanner[];
  provenance?: Record<string, unknown>; onProgress?: (message: string) => void; runId?: string; scratchParent?: string;
  /** Defaults to the `accounting` block of qualification/suite-v1.json. */
  accounting?: AccountingConfig;
  /** Defaults to an empty ledger: every queue entry is then `unknown`. The engine never writes it. */
  ledger?: ReviewLedger;
  /** Validated normalized observations to compose with freshly executed scanners. IDs must be disjoint. */
  reusedObservations?: Observation[];
  /** Refresh-only hook. Receives normalized observations after required stability replays. */
  captureObservations?: (fixtures: Fixture[], observations: Observation[]) => Promise<void>;
  /** Domain-owned classification normalization. Existing callers default to the current credential behavior. */
  normalizeFinding?: (finding: Finding, scanner: Scanner) => Finding;
}
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { score } from '../lib/scoring.ts';
import { contracts } from '../lib/assessment.ts';
import { generateCase, hash } from './model.ts';
import { describeCase, describeVariant, summaries } from './reporting.ts';
import { ACCOUNTING_VERSION, accountCounts, unresolvedGroups, validateAccounting, floorFor } from '../lib/accounting.ts';
import suite from '../../qualification/suite-v1.json';
import { evaluationInputs as collectEvaluationInputs } from '../evaluation/substrate/case-lifecycle.ts';
import { executeRuntime } from '../evaluation/substrate/runtime.ts';
import { reviewState } from '../evaluation/substrate/review-state.ts';
import { reviewEntryId } from '../evaluation/domains/credential/review.ts';

export { reviewEntryId };

export const ENGINE_VERSION = '1.1.0';

export { reviewState };

/**
 * Engine-side dual scorer (v1.1 §9): v1.0 published counts per summary row and
 * nothing else, so a stratum is a no-op exactly when every assertion resolved.
 */
function assertionDelta(byMethod: Summary, unstable: Set<string>, config: AccountingConfig) {
  const groups: Record<string, { v10: Record<string, number>; v11: ReturnType<typeof accountCounts>; cause: DeltaCause[] }> = {};
  const causes: Record<string, Set<DeltaCause>> = {}, totals: Record<string, Record<string, number>> = {};
  for (const [key, counts] of Object.entries(byMethod)) {
    const [method, scanner, stratum] = key.split('/');
    const group = stratum.split('->')[0].replace(':', '/');
    const t = (totals[group] ??= { pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 }), c = (causes[group] ??= new Set());
    for (const status of Object.keys(t)) t[status] += counts[status as keyof typeof counts] ?? 0;
    if (counts['review-required'] && floorFor(config.resolvedRateFloor, method) > 0) c.add('unresolved');
    if (counts['not-measured']) c.add(unstable.has(scanner) ? 'unstable' : 'not-measured');
  }
  for (const [group, t] of Object.entries(totals).sort(([a], [b]) => a.localeCompare(b))) {
    const { 'not-measured': _, ...v10 } = t;
    groups[group] = { v10, v11: accountCounts(t, config), cause: [...causes[group]].sort() };
  }
  return { version: '1.0 -> 1.1' as const, groups };
}

export function evaluationInputs(cases: EvaluationCase[], methods: Registry<Method>, operators: Registry<Operator>) {
  if (!cases.length || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Empty or duplicate evaluation cases');
  return collectEvaluationInputs<EvaluationCase, Fixture, ReturnType<typeof generateCase>>(
    cases, c => generateCase(c, methods, operators),
  );
}

export async function executeEvaluation({ cases, methods, operators, scanners, provenance = {}, onProgress = () => {}, runId = randomUUID(), scratchParent = tmpdir(),
  accounting = suite.accounting as AccountingConfig, ledger = { schemaVersion: 2, entries: {} }, reusedObservations = [], captureObservations,
  normalizeFinding = ({ path, start, end, family, action }, scanner) => ({ path, start, end,
    ...(scanner.capabilities?.classification !== false && family && Object.hasOwn(contracts, family) ? { family } : {}),
    ...(action !== undefined ? { action } : {}) }) }: EvaluationOptions) {
  validateAccounting(accounting);
  // Validate and generate everything before any scanner sees an input.
  const { generated, fixtures } = evaluationInputs(cases, methods, operators);
  const runtime = await executeRuntime<Fixture, Finding, Finding>({
    inputs: fixtures, scanners, reusedObservations, runId, replays: accounting.replays, scratchParent, onProgress, identity: hash,
    validateFindings: findings => { score(fixtures, findings as Finding[]); },
    normalizeFinding,
    captureObservations,
  });
  const { startedAt } = runtime;
  const observations = runtime.observations as Observation[];
  const results: CaseResult[] = [], reviewQueue = [];
  for (const g of generated) {
    const result = g.method.evaluate({ case: g.case, variants: g.variants, observations });
    const description = describeCase(g.case);
    for (const entry of result.queue) reviewQueue.push({
      id: reviewEntryId(g.case.id, g.case.provenance.sourceHash, entry),
      caseId: g.case.id, method: g.case.method, targets: g.case.targets, ...entry,
    });
    for (const v of g.variants.filter(v => v.strategy === 'review-required')) reviewQueue.push({
      id: hash({ case: g.case.id, variant: v.id, hash: v.provenance.fixtureHash }),
      caseId: g.case.id, method: g.case.method, targets: g.case.targets, variant: v.id,
      status: 'review-required', reason: 'Mutation expectation requires an authored decision.',
    });
    results.push({ ...description, variants: g.variants.map(describeVariant), generation: g.attempts, ...result });
  }
  const failures = results.flatMap(r => r.scanners.flatMap(s => s.assertions.filter(a => a.status === 'fail')
    .map(a => ({ caseId: r.id, method: r.method, targets: r.targets, scanner: s.scanner, assertion: a,
      transformation: r.variants.find(v => v.id === (a.variant ?? a.candidate))?.transformation }))));
  const generationErrors = results.flatMap(r => r.generation.filter(g => g.status === 'error').map(g => ({ caseId: r.id, ...g })));
  const summary = summaries(results);
  const unstable = new Set(observations.filter(o => o.status === 'unstable').map(o => o.id));
  const account = (rows: Summary) => Object.fromEntries(Object.entries(rows).map(([key, counts]) => [key, accountCounts(counts, accounting)]));
  return { schemaVersion: 3, engineVersion: ENGINE_VERSION, accountingVersion: ACCOUNTING_VERSION, accounting,
    runId, startedAt, finishedAt: new Date().toISOString(),
    mode: 'discovery', scope: 'Internal evaluation infrastructure; no support-status or release qualification claim.',
    provenance: { ...provenance, casesHash: hash(cases),
      methods: methods.values().map(({ id, version }) => ({ id, version })),
      operators: operators.values().map(({ id, version }) => ({ id, version })) },
    scanners: observations.map(({ findings, ...metadata }) => metadata),
    caseCount: cases.length, variantCount: fixtures.length,
    ...summary, resolution: account(summary.byMethod), unresolvedGroups: unresolvedGroups(summary.byMethod, accounting),
    accountingDelta: assertionDelta(summary.byMethod, unstable, accounting),
    review: reviewState(reviewQueue, ledger), results, failures, generationErrors, reviewQueue };
}
