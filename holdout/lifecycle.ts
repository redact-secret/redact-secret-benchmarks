import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Candidate, HoldoutManifest } from './types.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import type { AccountingArtifactIdentity } from '../benchmarks/accounting/shared/primitives.ts';
import { HoldoutError, readManifest, serialize, storeDirectory, privateDirectory, privateRead, atomicPrivateWrite } from './storage.ts';

interface LifecycleScanner {
  id: string; mode: string; configuration?: Record<string, unknown>; capabilities?: { ranges: boolean; classification: boolean };
  version(directory: string): Promise<string>;
}
export interface HoldoutLifecycleCommon {
  identity: AccountingArtifactIdentity; runId: string; planHash: string;
  independence: 'public-control' | 'custodian-declared'; manifest: HoldoutManifest; candidate: Candidate;
}
export interface HoldoutDomainAdapter<TScanner extends LifecycleScanner, TCorpus extends { seed: unknown }, TEvaluated, TReport> {
  identity: AccountingArtifactIdentity;
  publicConformanceCorpus(seed: string): unknown;
  validateCorpus(value: unknown): TCorpus;
  evaluate(options: {
    corpus: TCorpus; manifest: HoldoutManifest; scanners: TScanner[]; runId: string; directory: string; planHash: string;
    toolPlan: { id: string; version: string; configuration: Record<string, unknown>; configurationHash: string }[];
    candidate: Candidate; verifyCandidate: () => Promise<Candidate>;
  }): Promise<TEvaluated>;
  buildReport(common: HoldoutLifecycleCommon, evaluated: TEvaluated): TReport;
  validateReport(report: TReport): void;
}

interface State { corpusHash: string; status: 'sealed' | 'contaminated' | 'retired'; runs: string[]; reason?: string }
async function stateOf(directory: string, manifest: HoldoutManifest): Promise<State> {
  const state = JSON.parse(await privateRead(path.join(directory, 'state.json')));
  if (state.corpusHash !== manifest.corpusHash || !['sealed', 'contaminated', 'retired'].includes(state.status) ||
      !Array.isArray(state.runs) || state.runs.some((r: unknown) => typeof r !== 'string')) throw new HoldoutError('invalid-state');
  return state;
}

async function publicStore(file: string, m: HoldoutManifest, publicConformanceCorpus: (seed: string) => unknown) {
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
export async function runHoldout<TScanner extends LifecycleScanner, TCorpus extends { seed: unknown }, TEvaluated, TReport>({ manifestFile, scanners, candidate, verifyCandidate, domain, runId = randomUUID() }: {
  manifestFile: string; scanners: TScanner[]; candidate: Candidate; verifyCandidate: () => Promise<Candidate>;
  domain: HoldoutDomainAdapter<TScanner, TCorpus, TEvaluated, TReport>; runId?: string;
}): Promise<TReport> {
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
    const identity = structuredClone(domain.identity);
    if (![identity.domain, identity.evaluationProfile, identity.domainAccountingVersion].every(value => typeof value === 'string' && value.length))
      throw new HoldoutError('invalid-plan');
    const plan = { runId, candidate, tools: toolPlan, corpusHash: manifest.corpusHash, revision: manifest.revision, methodVersion: 1, evaluation: identity };
    ephemeral = manifest.purpose === 'public-conformance';
    directory = ephemeral ? await publicStore(manifestFile, manifest, domain.publicConformanceCorpus) : await storeDirectory(manifestFile, manifest);
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
    const corpus = domain.validateCorpus(JSON.parse(text));
    if (hash(corpus.seed) !== manifest.seedHash) throw new HoldoutError('seed-integrity-mismatch');
    const planHash = hash(plan);
    const evaluated = await domain.evaluate({ corpus, manifest, scanners, runId, directory, planHash, toolPlan, candidate, verifyCandidate });
    const report = domain.buildReport({ identity, runId, planHash, independence: ephemeral ? 'public-control' : 'custodian-declared', manifest, candidate }, evaluated);
    domain.validateReport(report);
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
