import type { EvaluationCase, Registry, Method, Operator, Scanner, Observation, CaseResult, ReviewLedger, Summary } from './types.ts';
import type { AccountingConfig, DeltaCause, Finding } from '../types.ts';

export interface EvaluationOptions {
  cases: EvaluationCase[]; methods: Registry<Method>; operators: Registry<Operator>; scanners: Scanner[];
  provenance?: Record<string, unknown>; onProgress?: (message: string) => void; runId?: string; scratchParent?: string;
  /** Defaults to the `accounting` block of qualification/suite-v1.json. */
  accounting?: AccountingConfig;
  /** Defaults to an empty ledger: every queue entry is then `unknown`. The engine never writes it. */
  ledger?: ReviewLedger;
}
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { score } from '../lib/scoring.ts';
import { contracts } from '../lib/assessment.ts';
import { generateCase, hash } from './model.ts';
import { describeCase, describeVariant, summaries } from './reporting.ts';
import { ACCOUNTING_VERSION, accountCounts, unresolvedGroups, validateAccounting, floorFor } from '../lib/accounting.ts';
import suite from '../../qualification/suite-v1.json';

export const ENGINE_VERSION = '1.1.0';

// Replays are compared as sorted `path:start:end[:family]` tuples (v1.1 §8).
const tuples = (findings: Finding[]) => findings.map(f => `${f.path}:${f.start}:${f.end}${f.family ? `:${f.family}` : ''}`).sort();

/** Review state of the queue against the checked-in ledger (v1.1 §6). `unknown` is a disagreement nobody has looked at. */
export function reviewState(queue: { id: string }[], ledger: ReviewLedger) {
  const state = { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null as string | null };
  const FIELD = { open: 'open', resolved: 'resolved', 'not-assertable': 'notAssertable' } as const;
  for (const { id } of queue) {
    const row = Object.hasOwn(ledger.entries, id) ? ledger.entries[id] : undefined;
    state[row ? FIELD[row.status] : 'unknown']++;
    if (row?.status === 'open' && (state.oldestOpenRun === null || row.firstSeenRun < state.oldestOpenRun)) state.oldestOpenRun = row.firstSeenRun;
  }
  return state;
}

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

export async function executeEvaluation({ cases, methods, operators, scanners, provenance = {}, onProgress = () => {}, runId = randomUUID(), scratchParent = tmpdir(),
  accounting = suite.accounting as AccountingConfig, ledger = { schemaVersion: 1, entries: {} } }: EvaluationOptions) {
  validateAccounting(accounting);
  if (!cases.length || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error('Empty or duplicate evaluation cases');
  if (!scanners.length || new Set(scanners.map(s => s.id)).size !== scanners.length) throw new Error('Empty or duplicate scanner selection');
  // Validate and generate everything before any scanner sees an input.
  const generated = cases.map(c => generateCase(c, methods, operators));
  const fixtures = generated.flatMap(g => g.variants.map(v => v.fixture));
  if (new Set(fixtures.map(f => f.path)).size !== fixtures.length) throw new Error('Duplicate generated path');
  const startedAt = new Date().toISOString(), observations: Observation[] = [];
  const scratch = await mkdtemp(path.join(scratchParent, 'secret-evaluation-'));
  try {
    for (const f of fixtures) {
      const target = path.join(scratch, f.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, f.content, { mode: 0o600 });
    }
    for (const scanner of scanners) {
      let version = null;
      const configuration = scanner.configuration ?? { mode: scanner.mode ?? 'unspecified' };
      const metadata = { id: scanner.id, mode: scanner.mode, configuration, configurationHash: hash(configuration) };
      const start = performance.now();
      if (scanner.capabilities?.ranges === false) {
        observations.push({ ...metadata, version, status: 'unsupported', message: 'Adapter does not support source byte ranges.' });
        onProgress(`${scanner.id}: unsupported`);
        continue;
      }
      try {
        version = await scanner.version(scratch);
        // Adapters receive bytes/identity only, never expectations or tiers.
        // Every replay sees the same scratch tree; the observation is only truth if it repeats (v1.1 §8).
        const replays: Finding[][] = [];
        for (let replay = 0; replay < accounting.replays; replay++) {
          const rawFindings = await scanner.scan(scratch, fixtures.map(({ id, path, content }) => ({ id, path, content })));
          score(fixtures, rawFindings); // fail closed on unmappable/invalid findings
          replays.push(rawFindings.map(({ path, start, end, family }) => ({ path, start, end,
            ...(scanner.capabilities?.classification !== false && family && Object.hasOwn(contracts, family) ? { family } : {}) })));
        }
        const [first, ...rest] = replays.map(tuples);
        const divergent = new Set<string>();
        for (const other of rest) for (const t of [...first.filter(x => !other.includes(x)), ...other.filter(x => !first.includes(x))]) divergent.add(t.split(':')[0]);
        if (divergent.size) observations.push({ ...metadata, version, status: 'unstable', findings: [],
          message: 'Replays over identical input disagreed; findings discarded and raw output suppressed.',
          replays: { count: replays.length, agreed: false, divergentPaths: [...divergent].sort() } });
        else observations.push({ ...metadata, version, status: 'complete', findings: replays[0],
          durationMs: Math.round(performance.now() - start), replays: { count: replays.length, agreed: true } });
      } catch (error) {
        observations.push({ ...metadata, version,
          status: error instanceof Error && error.message === 'unavailable' ? 'unavailable' : 'error',
          message: 'Scanner unavailable or execution/normalization failed; raw output suppressed.' });
      }
      onProgress(`${scanner.id}: ${observations.at(-1)!.status}`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  const results: CaseResult[] = [], reviewQueue = [];
  for (const g of generated) {
    const result = g.method.evaluate({ case: g.case, variants: g.variants, observations });
    const description = describeCase(g.case);
    for (const entry of result.queue) reviewQueue.push({
      id: hash({ case: g.case.id, source: g.case.provenance.sourceHash, ...entry }),
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
