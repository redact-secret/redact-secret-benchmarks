import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from '../engine/model.ts';
import { assertNoPrivateDetail, summarize, validateAggregate, type Observation } from './aggregate.ts';
import { BlindError, CORPUS_FILE, FREEZE_FILE, LEDGER_FILE, privateRead, privateRoot, privateWrite, readCorpus, readLedger, serialize, validateFreeze } from './storage.ts';
import type { BenchmarkIdentity, BlindAggregate, CandidateArtifacts, Environment, PrivateCorpus, PrivateFixture, PrivateFreeze, PrivateLedger } from './types.ts';

/** A loaded candidate. `scan` reads `<root>/<fixture.path>` and returns UTF-8 byte ranges. */
export interface LoadedCandidate {
  packageName: string; declaredVersion: string;
  scan(root: string, fixtures: { path: string }[]): Promise<{ path: string; start: number; end: number }[]>;
  dispose(): Promise<void>;
}
export interface BlindContext {
  benchmark(): Promise<BenchmarkIdentity>;
  environment(): Environment;
  load(candidate: CandidateArtifacts): Promise<LoadedCandidate>;
  configuration: Record<string, unknown>;
  replays: number;
}

const SHA = /^[a-f0-9]{40}$/, SHA256 = /^[a-f0-9]{64}$/;
const ROLES = ['package', 'node', 'wasm'];
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const artifactSet = (c: { artifacts: { role: string; sha256: string }[] }) =>
  c.artifacts.map(a => ({ role: a.role, sha256: a.sha256 })).sort((a, b) => a.role.localeCompare(b.role));

/**
 * The candidate is the output directory of the product's `benchmark:candidate`
 * build: `candidate-evidence-v1.json` plus `artifacts/*.tgz`. Each tarball is
 * matched to its role by SHA-256, never by file name.
 */
export async function resolveCandidate(directory: string): Promise<CandidateArtifacts> {
  if (!path.isAbsolute(directory)) throw new BlindError('candidate-directory-must-be-absolute');
  let evidence;
  try { evidence = JSON.parse(await readFile(path.join(directory, 'candidate-evidence-v1.json'), 'utf8')); }
  catch { throw new BlindError('candidate-evidence-missing'); }
  const c = evidence?.candidate;
  if (!c || !SHA.test(c.sourceCommit ?? '') || c.sourceState !== 'clean') throw new BlindError('candidate-not-from-clean-commit');
  if (!Array.isArray(c.artifacts) || c.artifacts.length !== 3 || !ROLES.every(r => c.artifacts.some((a: any) => a.role === r && SHA256.test(a.sha256))))
    throw new BlindError('candidate-artifact-set-invalid');
  let names: string[];
  try { names = (await readdir(path.join(directory, 'artifacts'))).filter(n => n.endsWith('.tgz')); }
  catch { throw new BlindError('candidate-artifacts-missing'); }
  const byHash = new Map<string, string>();
  for (const name of names) byHash.set(sha256(await readFile(path.join(directory, 'artifacts', name))), path.join(directory, 'artifacts', name));
  const artifacts = c.artifacts.map((a: any) => {
    const file = byHash.get(a.sha256);
    if (!file) throw new BlindError('candidate-artifact-hash-mismatch');
    return { role: a.role, sha256: a.sha256, file };
  });
  return { sourceCommit: c.sourceCommit, artifacts };
}

const artifactSha = (c: { artifacts: { role: string; sha256: string }[] }) => c.artifacts.find(a => a.role === 'package')!.sha256;
const configurationHash = (ctx: BlindContext) => hash({ ...ctx.configuration, replays: ctx.replays });

/**
 * The published commitment covers the fixtures and the private nonce, so it
 * cannot be confirmed by guessing a small corpus. The fixtures digest stays in
 * the private ledger and catches the same fixtures relabelled as a new epoch.
 */
export function corpusIdentity(corpus: PrivateCorpus) {
  return { commitment: sha256(serialize({ nonce: corpus.nonce, fixtures: corpus.fixtures })), fixturesDigest: sha256(serialize(corpus.fixtures)) };
}

/** An epoch label carries exactly one corpus, and a set of fixtures exactly one epoch label. */
function checkEpoch(ledger: PrivateLedger, epoch: string, id: ReturnType<typeof corpusIdentity>) {
  for (const e of ledger.epochs) {
    if (e.epoch === epoch && e.corpusCommitment !== id.commitment) throw new BlindError('corpus-changed-without-new-epoch');
    if (e.epoch !== epoch && e.fixturesDigest === id.fixturesDigest) throw new BlindError('corpus-reused-under-new-epoch');
  }
}
function checkNotYetEvaluated(ledger: PrivateLedger, epoch: string, candidate: string) {
  // A candidate identity gets one attempt per epoch, crashed attempts included.
  // Any product change after a result needs a new identity, and a new freeze.
  if (ledger.runs.some(r => r.epoch === epoch && r.candidateArtifactSha256 === candidate)) throw new BlindError('candidate-already-evaluated-on-epoch');
}

/** Step 1: freeze candidate, configuration, benchmark revision and environment before any fixture is scanned. */
export async function freezeBlind({ fixtures, candidate, context }: { fixtures: string; candidate: string; context: BlindContext }) {
  const root = await privateRoot(fixtures);
  const { corpus } = await readCorpus(root);
  const id = corpusIdentity(corpus), commitment = id.commitment, ledger = await readLedger(root);
  checkEpoch(ledger, corpus.epoch, id);
  const artifacts = await resolveCandidate(candidate);
  checkNotYetEvaluated(ledger, corpus.epoch, artifactSha(artifacts));
  const benchmark = await context.benchmark();
  if (benchmark.dirty) throw new BlindError('benchmark-checkout-dirty');
  if (context.replays < 2) throw new BlindError('replays-below-two');
  const freeze: PrivateFreeze = {
    schemaVersion: 1, freezeType: 'blind-freeze', freezeId: randomUUID(), frozenAt: new Date().toISOString(),
    epoch: corpus.epoch, corpusCommitment: commitment,
    candidate: { sourceCommit: artifacts.sourceCommit, artifactSha256: artifactSha(artifacts), artifacts: artifactSet(artifacts) },
    configuration: context.configuration, configurationHash: configurationHash(context), replays: context.replays,
    benchmark, environment: context.environment(),
  };
  try { await privateWrite(path.join(root, FREEZE_FILE), freeze); }
  catch (error) { throw (error as NodeJS.ErrnoException).code === 'EEXIST' ? new BlindError('freeze-already-pending') : error; }
  return freeze;
}

const tuples = (list: { start: number; end: number }[]) => [...new Set(list.map(f => `${f.start}:${f.end}`))].sort().join(' ');
const ranges = (list: { start: number; end: number }[]) => [...new Set(list.map(f => `${f.start}:${f.end}`))]
  .map(t => { const [start, end] = t.split(':').map(Number); return { start, end }; });

/** Scan one fixture `replays` times. A fixture whose findings differ between replays is withheld, never re-rolled. */
async function observe(scanner: LoadedCandidate, scratch: string, fixture: PrivateFixture, replays: number): Promise<Observation> {
  try {
    const runs: { start: number; end: number }[][] = [];
    for (let i = 0; i < replays; i++) runs.push((await scanner.scan(scratch, [{ path: fixture.path }])).filter(f => f.path === fixture.path));
    if (runs.some(r => tuples(r) !== tuples(runs[0]))) return { fixture, status: 'withheld', reason: 'unstable-across-replays' };
    return { fixture, status: 'measured', findings: ranges(runs[0]) };
  } catch { return { fixture, status: 'withheld', reason: 'scan-error' }; }
}

const errorCode = (error: unknown, fallback: string) => error instanceof BlindError ? error.code.split(':')[0]
  : error instanceof Error && /^[a-z][a-z0-9-]{1,79}$/.test(error.message) ? error.message : fallback;

/**
 * Step 2: evaluate the frozen candidate once. Returns only the aggregate. Raw
 * rows exist only in this function's memory; fixture bytes are materialised in
 * a 0700 scratch directory inside the private root and removed in `finally`.
 */
export async function runBlind({ fixtures, candidate, output, outputDirectory, context }: {
  fixtures: string; candidate: string; output?: string; outputDirectory?: string; context: BlindContext;
}) {
  const root = await privateRoot(fixtures);
  let freeze: PrivateFreeze;
  try { freeze = validateFreeze(JSON.parse(await privateRead(path.join(root, FREEZE_FILE)))); }
  catch (error) { throw error instanceof BlindError ? error : new BlindError('invalid-freeze'); }
  const { corpus } = await readCorpus(root);
  const id = corpusIdentity(corpus), commitment = id.commitment;
  if (commitment !== freeze.corpusCommitment || corpus.epoch !== freeze.epoch) throw new BlindError('corpus-changed-after-freeze');
  if (hash(context.environment()) !== hash(freeze.environment)) throw new BlindError('environment-changed-after-freeze');
  const benchmark = await context.benchmark();
  if (benchmark.dirty || hash(benchmark) !== hash(freeze.benchmark)) throw new BlindError('benchmark-changed-after-freeze');
  if (configurationHash(context) !== freeze.configurationHash || context.replays !== freeze.replays) throw new BlindError('configuration-changed-after-freeze');
  const artifacts = await resolveCandidate(candidate);
  if (artifacts.sourceCommit !== freeze.candidate.sourceCommit || hash(artifactSet(artifacts)) !== hash(freeze.candidate.artifacts))
    throw new BlindError('candidate-changed-after-freeze');
  if (output !== undefined && (!path.isAbsolute(output) || existsSync(output))) throw new BlindError('output-must-be-a-new-absolute-path');
  if (outputDirectory !== undefined && !path.isAbsolute(outputDirectory)) throw new BlindError('output-must-be-a-new-absolute-path');
  for (const target of [output, outputDirectory]) for (const base of [root, path.resolve(fixtures)])
    if (target && (path.resolve(target) + path.sep).startsWith(base + path.sep)) throw new BlindError('output-inside-private-root');
  const ledger = await readLedger(root);
  checkEpoch(ledger, corpus.epoch, id);
  checkNotYetEvaluated(ledger, corpus.epoch, freeze.candidate.artifactSha256);

  const lock = path.join(root, '.lock');
  try { await writeFile(lock, '', { mode: 0o600, flag: 'wx' }); }
  catch { throw new BlindError('run-in-progress'); }
  const runId = randomUUID(), startedAt = new Date().toISOString(), runDirectory = path.join(root, 'runs', runId);
  const release = output ?? (outputDirectory ? path.join(outputDirectory, `blind-aggregate-${runId}.json`) : undefined);
  let scratch: string | undefined, loaded: LoadedCandidate | undefined;
  const failures: BlindAggregate['failures'] = [];
  try {
    // Reserve before reading fixtures into a scan: a crash still spends the attempt, and the freeze is consumed.
    if (!ledger.epochs.some(e => e.epoch === corpus.epoch)) ledger.epochs.push({ epoch: corpus.epoch, corpusCommitment: commitment, fixturesDigest: id.fixturesDigest });
    ledger.runs.push({ runId, freezeId: freeze.freezeId, epoch: corpus.epoch, candidateArtifactSha256: freeze.candidate.artifactSha256, status: 'reserved', startedAt });
    await privateWrite(path.join(root, LEDGER_FILE), ledger, { replace: true });
    await mkdir(runDirectory, { recursive: true, mode: 0o700 });
    await rename(path.join(root, FREEZE_FILE), path.join(runDirectory, FREEZE_FILE));

    scratch = await mkdtemp(path.join(root, 'scratch-'));
    for (const fixture of corpus.fixtures) {
      const file = path.join(scratch, fixture.path);
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, fixture.content, { mode: 0o600, flag: 'wx' });
    }
    let observations: Observation[];
    try {
      loaded = await context.load(artifacts);
      observations = [];
      for (const fixture of corpus.fixtures) observations.push(await observe(loaded, scratch, fixture, freeze.replays));
    } catch (error) {
      failures.push({ phase: 'installation', code: errorCode(error, 'candidate-installation-failed') });
      observations = corpus.fixtures.map(fixture => ({ fixture, status: 'withheld', reason: 'scan-error' }));
    }
    // The candidate must still be the frozen one after the scan.
    try {
      const after = await resolveCandidate(candidate);
      if (hash(artifactSet(after)) !== hash(freeze.candidate.artifacts)) throw new Error();
    } catch { failures.push({ phase: 'identity', code: 'candidate-changed-during-run' }); }

    const summary = summarize(observations);
    const report: BlindAggregate = {
      schemaVersion: 1, reportType: 'blind-aggregate', evidenceClass: 'custodian-blind',
      independence: {
        level: 'custodian-held-blind', achieved: 'procedural-separation', organisationalIndependence: false,
        statement: 'Custodian-held blind fixtures, authored and held by an isolated custodian agent session that product-implementing agents and the orchestrator never saw. The same human operates the custodian and the maintainer roles, so this run achieves procedural separation, not organisational independence.',
      },
      runId, startedAt, finishedAt: new Date().toISOString(),
      status: failures.length || summary.measurability.withheldReasons['scan-error'] ? 'incomplete' : 'complete',
      candidate: { sourceCommit: freeze.candidate.sourceCommit, packageName: loaded?.packageName ?? 'unknown', declaredVersion: loaded?.declaredVersion ?? 'unknown',
        artifactSha256: freeze.candidate.artifactSha256, artifacts: freeze.candidate.artifacts, configurationHash: freeze.configurationHash },
      benchmark: { sourceCommit: freeze.benchmark.sourceCommit, lockfileSha256: freeze.benchmark.lockfileSha256 },
      environment: freeze.environment,
      freeze: { freezeId: freeze.freezeId, frozenAt: freeze.frozenAt, freezeHash: sha256(serialize(freeze)) },
      corpus: { epoch: corpus.epoch, commitment, fixtures: corpus.fixtures.length },
      replays: freeze.replays,
      ...summary,
      uncertainty: { method: 'wilson-score', confidence: 0.95,
        scope: 'Intervals treat the custodian corpus as a sample of authored cases. The fixtures are authored, not drawn from real traffic, so no interval estimates a real-world rate.' },
      failures,
    };
    validateAggregate(report);
    assertNoPrivateDetail(report, corpus.fixtures);
    await privateWrite(path.join(runDirectory, 'aggregate.json'), report);
    if (release) {
      await mkdir(path.dirname(release), { recursive: true });
      await writeFile(release, serialize(report), { mode: 0o644, flag: 'wx' });
    }
    const entry = ledger.runs.find(r => r.runId === runId)!;
    entry.status = report.status;
    await privateWrite(path.join(root, LEDGER_FILE), ledger, { replace: true });
    return { report, release };
  } catch (error) {
    // Anything unexpected suppresses detail: only a code, never a message that could quote a fixture.
    const entry = ledger.runs.find(r => r.runId === runId);
    if (entry) { entry.status = 'incomplete'; await privateWrite(path.join(root, LEDGER_FILE), ledger, { replace: true }).catch(() => {}); }
    throw new BlindError(errorCode(error, 'blind-run-failed'));
  } finally {
    await loaded?.dispose().catch(() => {});
    if (scratch) await rm(scratch, { recursive: true, force: true });
    await rm(lock, { force: true });
  }
}

export { CORPUS_FILE };
