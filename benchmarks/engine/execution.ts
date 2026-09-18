import type { EvaluationCase, Registry, Method, Operator, Scanner, Observation, CaseResult } from './types.ts';

export interface EvaluationOptions {
  cases: EvaluationCase[]; methods: Registry<Method>; operators: Registry<Operator>; scanners: Scanner[];
  provenance?: Record<string, unknown>; onProgress?: (message: string) => void; runId?: string; scratchParent?: string;
}
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { score } from '../lib/scoring.ts';
import { contracts } from '../lib/assessment.ts';
import { generateCase, hash } from './model.ts';
import { describeCase, describeVariant, summaries } from './reporting.ts';

export async function executeEvaluation({ cases, methods, operators, scanners, provenance = {}, onProgress = () => {}, runId = randomUUID(), scratchParent = tmpdir() }: EvaluationOptions) {
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
        const rawFindings = await scanner.scan(scratch, fixtures.map(({ id, path, content }) => ({ id, path, content })));
        score(fixtures, rawFindings); // fail closed on unmappable/invalid findings
        const findings = rawFindings.map(({ path, start, end, family }) => ({ path, start, end,
          ...(scanner.capabilities?.classification !== false && family && Object.hasOwn(contracts, family) ? { family } : {}) }));
        observations.push({ ...metadata, version, status: 'complete', findings,
          durationMs: Math.round(performance.now() - start) });
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
  return { schemaVersion: 2, engineVersion: 2, runId, startedAt, finishedAt: new Date().toISOString(),
    mode: 'discovery', scope: 'Internal evaluation infrastructure; no support-status or release qualification claim.',
    provenance: { ...provenance, casesHash: hash(cases),
      methods: methods.values().map(({ id, version }) => ({ id, version })),
      operators: operators.values().map(({ id, version }) => ({ id, version })) },
    scanners: observations.map(({ findings, ...metadata }) => metadata),
    caseCount: cases.length, variantCount: fixtures.length,
    ...summaries(results), results, failures, generationErrors, reviewQueue };
}
