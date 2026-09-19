import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Scanner, EvaluationCase } from '../benchmarks/engine/types.ts';
import type { Candidate, Counts, HoldoutManifest, HoldoutReport } from './types.ts';
import { hash } from '../benchmarks/engine/model.ts';
import { executeEvaluation } from '../benchmarks/engine/execution.ts';
import { createHoldoutMethods } from '../benchmarks/methods/holdout.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { publicConformanceCorpus } from './conformance.ts';
import { HoldoutError, readManifest, serialize, storeDirectory, privateDirectory, privateRead, atomicPrivateWrite, validateHoldoutCorpus } from './storage.ts';
import { validateEvidence } from '../benchmarks/engine/evidence.ts';

interface State { corpusHash: string; status: 'sealed' | 'contaminated' | 'retired'; runs: string[]; reason?: string }
const counts = (): Counts => ({ pass: 0, fail: 0, 'review-required': 0 });
async function stateOf(directory: string, manifest: HoldoutManifest): Promise<State> {
  const state = JSON.parse(await privateRead(path.join(directory, 'state.json')));
  if (state.corpusHash !== manifest.corpusHash || !['sealed', 'contaminated', 'retired'].includes(state.status) ||
      !Array.isArray(state.runs) || state.runs.some((r: unknown) => typeof r !== 'string')) throw new HoldoutError('invalid-state');
  return state;
}

async function publicStore(file: string, m: HoldoutManifest) {
  const generated = path.join(path.dirname(path.resolve(file)), 'generated');
  await mkdir(generated, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  await privateDirectory(generated);
  const base = path.join(path.dirname(path.resolve(file)), m.dataDirectory);
  await mkdir(base, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  await privateDirectory(base);
  const store = await mkdtemp(path.join(base, 'run-'));
  const corpus = publicConformanceCorpus(m.publicSeed!);
  if (hash(serialize(corpus)) !== m.corpusHash) throw new HoldoutError('public-control-drift');
  await writeFile(path.join(store, 'corpus.json'), serialize(corpus), { mode: 0o600 });
  await writeFile(path.join(store, 'state.json'), serialize({ corpusHash: m.corpusHash, status: 'sealed', runs: [] }), { mode: 0o600 });
  return store;
}

/** Only this lifecycle opts into the holdout method. It never returns rows. */
export async function runHoldout({ manifestFile, scanners, candidate, verifyCandidate, runId = randomUUID() }: {
  manifestFile: string; scanners: Scanner[]; candidate: Candidate; verifyCandidate: () => Promise<Candidate>; runId?: string;
}): Promise<HoldoutReport> {
  let directory: string | undefined, locked = false, ephemeral = false;
  try {
    const manifest = await readManifest(manifestFile);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(runId) ||
        ![candidate.sourceHash, candidate.lockHash, candidate.candidateArtifactHash].every(v => /^[a-f0-9]{64}$/.test(v)) ||
        !scanners.length || new Set(scanners.map(s => s.id)).size !== scanners.length) throw new HoldoutError('invalid-plan');
    // Freeze tool/configuration identity before opening protected corpus bytes.
    const toolPlan: { id: string; version: string; configuration: Record<string, unknown>; configurationHash: string }[] = [];
    for (const s of scanners) {
      if (s.capabilities?.ranges === false) throw new HoldoutError('unsupported-scanner');
      const version = await s.version(path.dirname(path.resolve(manifestFile)));
      if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)) throw new HoldoutError('invalid-scanner-version');
      toolPlan.push({ id: s.id, version, configuration: s.configuration ?? { mode: s.mode ?? 'unspecified' },
        configurationHash: hash(s.configuration ?? { mode: s.mode ?? 'unspecified' }) });
    }
    if (hash(await verifyCandidate()) !== hash(candidate)) throw new HoldoutError('candidate-changed');
    const plan = { runId, candidate, tools: toolPlan, corpusHash: manifest.corpusHash, revision: manifest.revision, methodVersion: 1 };
    ephemeral = manifest.purpose === 'public-conformance';
    directory = ephemeral ? await publicStore(manifestFile, manifest) : await storeDirectory(manifestFile, manifest);
    await writeFile(path.join(directory, '.lock'), runId, { mode: 0o600, flag: 'wx' });
    locked = true;
    const state = await stateOf(directory, manifest);
    if (state.status !== 'sealed') throw new HoldoutError('corpus-not-sealed');
    if (state.runs.length >= manifest.maxRuns) throw new HoldoutError('run-budget-exhausted');
    // A reserved attempt is consumed even on a crash or failed scan. Retrying
    // cannot become an adaptive development loop over the protected corpus.
    state.runs.push(runId);
    await atomicPrivateWrite(path.join(directory, 'state.json'), state);
    await writeFile(path.join(directory, `plan-${runId}.json`), serialize(plan), { mode: 0o600, flag: 'wx' });
    const text = await privateRead(path.join(directory, 'corpus.json'));
    if (hash(text) !== manifest.corpusHash) throw new HoldoutError('corpus-integrity-mismatch');
    const corpus = validateHoldoutCorpus(JSON.parse(text));
    if (hash(corpus.seed) !== manifest.seedHash) throw new HoldoutError('seed-integrity-mismatch');
    const cases: EvaluationCase[] = corpus.fixtures.map((f, i) => ({
      id: `holdout-${i}`, method: 'holdout', visibility: 'holdout', seed: f, targets: [], operators: [],
      source: { category: 'holdout', fixtureId: f.id, path: 'protected' },
      provenance: { source: 'holdout', sourceHash: manifest.corpusHash, rationale: f.assessment.reason,
        seed: corpus.seed, reviewStatus: manifest.review, sources: f.assessment.sources },
    }));
    const raw = await executeEvaluation({ cases, methods: createHoldoutMethods(), operators: createOperators(), scanners,
      runId, scratchParent: directory, provenance: { planHash: hash(plan) } });
    const candidateStable = hash(await verifyCandidate()) === hash(candidate);
    const scannerResults = raw.scanners.map(s => {
      const expected = toolPlan.find(t => t.id === s.id)!;
      const status = s.status === 'complete' && (!candidateStable || s.version !== expected.version || s.configurationHash !== expected.configurationHash)
        ? 'error' as const : s.status;
      const assertions = counts(), byStratum: Record<string, Counts> = {};
      if (status === 'complete') for (const result of raw.results) {
        const scored = result.scanners.find(o => o.scanner === s.id)!;
        for (const a of scored.assertions) {
          const v = result.variants.find(v => v.id === a.variant)!;
          const bucket = byStratum[`${v.kind}:${v.tier}`] ??= counts();
          // Complete scanners never carry `not-measured` rows; holdout stays counts-only (no intervals, by decision).
          if (a.status === 'not-measured') throw new HoldoutError('access-execution-or-validation-failed');
          bucket[a.status]++; assertions[a.status]++;
        }
      }
      return { id: s.id, version: s.version, configuration: expected.configuration, configurationHash: expected.configurationHash,
        status, assertions, byStratum };
    });
    const report: HoldoutReport = {
      schemaVersion: 1, reportType: 'holdout', runId, planHash: hash(plan), startedAt: raw.startedAt, finishedAt: raw.finishedAt,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only',
      independence: ephemeral ? 'public-control' : 'custodian-declared',
      status: scannerResults.every(s => s.status === 'complete') && !raw.generationErrors.length ? 'complete' : 'incomplete',
      corpus: { id: manifest.id, revision: manifest.revision, purpose: manifest.purpose, corpusHash: manifest.corpusHash,
        seedHash: manifest.seedHash, lifecycle: 'sealed-at-execution' },
      candidate, caseCount: raw.caseCount, variantCount: raw.variantCount, generationErrors: raw.generationErrors.length, scanners: scannerResults,
    };
    validateEvidence(report, 'holdout');
    await writeFile(path.join(directory, `aggregate-${runId}.json`), serialize(report), { mode: 0o600, flag: 'wx' });
    return report;
  } catch (error) {
    if (error instanceof HoldoutError) throw error;
    throw new HoldoutError('access-execution-or-validation-failed');
  } finally {
    if (directory && locked) await rm(path.join(directory, '.lock'), { force: true });
    if (directory && ephemeral) await rm(directory, { recursive: true, force: true });
  }
}

export async function contaminateHoldout(manifestFile: string, reason: string) {
  if (!['exposed', 'used-for-tuning', 'unreviewed-change'].includes(reason)) throw new HoldoutError('invalid-contamination-reason');
  const manifest = await readManifest(manifestFile);
  if (manifest.purpose !== 'protected') throw new HoldoutError('not-protected');
  const directory = await storeDirectory(manifestFile, manifest);
  await writeFile(path.join(directory, '.lock'), 'contamination', { mode: 0o600, flag: 'wx' });
  try {
    const state = await stateOf(directory, manifest);
    await atomicPrivateWrite(path.join(directory, 'state.json'), { ...state, status: 'contaminated', reason });
  } finally { await rm(path.join(directory, '.lock'), { force: true }); }
}
