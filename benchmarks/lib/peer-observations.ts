import { createHash } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { platform, arch } from 'node:os';
import path from 'node:path';
import type { Finding, Fixture } from '../types.ts';
import type { Observation, Scanner } from '../engine/types.ts';
import { fixtureIndexProblems, fixtureSemanticIdentity, type FixtureIndex } from './fixture-index.ts';

export const PEER_SNAPSHOT_SCHEMA = 1;
export const PEER_SNAPSHOT_DIRECTORY = 'peer-observations';
const PRODUCT = 'redact-secret';
const SHA256 = /^[a-f0-9]{64}$/;
const RUN_ID = /^[a-zA-Z0-9._:-]{1,160}$/;

export type SemanticIndexIdentity = { schemaVersion: number; algorithm: 'sha256'; digest: string; fixtureCount: number } | null;
export interface ObservationInputIdentity {
  surface: string;
  suiteHash: string;
  corpusHash: string;
  fixtureCount: number;
  fixturesDigest: string;
  semanticIndex: SemanticIndexIdentity;
}
export interface PeerExecutionIdentity {
  id: string;
  version: string;
  mode: string;
  configurationHash: string;
  configuration: Record<string, unknown>;
  artifactDigest: string;
  observedArtifact: { platform: string; digest: string };
  adapterDigest: string;
}
export interface PeerObservationProvenance {
  source: 'snapshot';
  observedAt: string;
  sourceRunId: string;
  snapshotDigest: string;
  inputDigest: string;
}
export interface PeerObservationSnapshot {
  schemaVersion: 1;
  reportType: 'normalized-peer-observation';
  observedAt: string;
  sourceRun: { runId: string; benchmarkRevision: string };
  input: ObservationInputIdentity;
  peer: PeerExecutionIdentity;
  replay: { protocol: 'sorted-normalized-ranges-v1'; count: number; agreed: true };
  findings: Finding[];
  digest: string;
}

export const digest = (value: unknown) => createHash('sha256').update(
  typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value),
).digest('hex');

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

const normalizedFindings = (findings: Finding[]) => findings.map(finding => ({
  path: finding.path, start: finding.start, end: finding.end,
  ...(finding.family !== undefined ? { family: finding.family } : {}),
  ...(finding.action !== undefined ? { action: finding.action } : {}),
})).sort((a, b) => a.path.localeCompare(b.path) || a.start - b.start || a.end - b.end ||
  String(a.family ?? '').localeCompare(String(b.family ?? '')) || String(a.action ?? '').localeCompare(String(b.action ?? '')));

export function inputIdentity({ surface, suite, corpus, fixtures, semanticIndex = null }: {
  surface: string; suite: unknown; corpus: unknown;
  fixtures: Pick<Fixture, 'id' | 'path' | 'content'>[];
  semanticIndex?: SemanticIndexIdentity;
}): ObservationInputIdentity {
  if (!/^[a-z0-9][a-z0-9._/-]{0,159}$/.test(surface)) throw new Error('Invalid peer observation surface');
  if (semanticIndex && (!Number.isInteger(semanticIndex.schemaVersion) || semanticIndex.schemaVersion < 1 || semanticIndex.algorithm !== 'sha256' ||
    !SHA256.test(semanticIndex.digest) || !Number.isInteger(semanticIndex.fixtureCount) || semanticIndex.fixtureCount < 1))
    throw new Error('Invalid semantic index identity');
  const entries = fixtures.map(f => ({ id: f.id, path: f.path, bytes: Buffer.byteLength(f.content), contentHash: digest(f.content) }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
  if (new Set(entries.map(f => f.path)).size !== entries.length || entries.some(f => !f.id || !f.path || path.isAbsolute(f.path) || f.path.split(/[\\/]/).includes('..')))
    throw new Error('Invalid or duplicate fixture identity');
  return { surface, suiteHash: digest(suite), corpusHash: digest(corpus), fixtureCount: entries.length,
    fixturesDigest: digest(entries), semanticIndex };
}

/** Only inputs that can change normalized observations belong here. Scoring floors
 * deliberately do not: accounting-only edits must rescore an unchanged snapshot. */
export function observationSuiteIdentity(suite: any) {
  return { schemaVersion: suite?.schemaVersion, replayCount: suite?.accounting?.replays };
}

export function executionIdentity(scanner: Scanner, version: string, artifactDigest: string, adapterDigest = 'a'.repeat(64),
  observedArtifact = { platform: 'test', digest: artifactDigest }): PeerExecutionIdentity {
  if (scanner.id === PRODUCT || !scanner.id || !version || !SHA256.test(artifactDigest) || !SHA256.test(adapterDigest) ||
    !observedArtifact.platform || !SHA256.test(observedArtifact.digest))
    throw new Error('Invalid peer execution identity');
  const configuration = scanner.configuration ?? { mode: scanner.mode ?? 'unspecified' };
  // Match engine/model.ts exactly: this value participates in review-entry IDs.
  return { id: scanner.id, version, mode: scanner.mode, configurationHash: digest(JSON.stringify(configuration)), configuration,
    artifactDigest, observedArtifact, adapterDigest };
}

export async function semanticIndexIdentity(root: string): Promise<SemanticIndexIdentity> {
  try {
    const index = JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-index.json'), 'utf8')) as FixtureIndex;
    const problems = fixtureIndexProblems(index);
    if (problems.length) throw new Error(`Invalid fixture semantic index identity: ${problems.join('; ')}`);
    return fixtureSemanticIdentity(index);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function repositoryPeerIdentity(scanner: Scanner, root: string): Promise<PeerExecutionIdentity> {
  if (scanner.id === PRODUCT) throw new Error('Product observations are never snapshots');
  const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  let version: string, artifactDigest: string, observedArtifact: PeerExecutionIdentity['observedArtifact'];
  if (scanner.id === 'gitleaks' || scanner.id === 'trufflehog') {
    const checksums = JSON.parse(await readFile(path.join(root, 'scanners/peer-checksums.json'), 'utf8'));
    const entry = checksums[scanner.id];
    version = suite.scanners[scanner.id];
    if (entry?.version !== version) throw new Error(`Peer checksum version mismatch: ${scanner.id}`);
    // Platform-neutral identity binds the complete reviewed archive checksum
    // table. A snapshot captured on macOS remains consumable on Linux without
    // weakening any archive digest.
    artifactDigest = digest({ version: entry.version, repo: entry.repo, binary: entry.binary, assets: entry.assets });
    const platformKey = `${platform()}-${arch() === 'x64' ? 'x64' : arch() === 'arm64' ? 'arm64' : arch()}`;
    observedArtifact = { platform: platformKey, digest: entry.assets?.[platformKey]?.sha256 };
  } else {
    const entry = lock.packages?.[`node_modules/${scanner.id}`];
    version = entry?.version; artifactDigest = digest({ version, resolved: entry?.resolved, integrity: entry?.integrity });
    observedArtifact = { platform: 'npm-lock', digest: artifactDigest };
  }
  const adapterDigest = digest({
    adapter: await readFile(path.join(root, 'scanners/index.mjs')),
    familyMapping: await readFile(path.join(root, 'scanners/families.mjs')),
  });
  return executionIdentity(scanner, version, artifactDigest, adapterDigest, observedArtifact);
}

function snapshotPayload(snapshot: Omit<PeerObservationSnapshot, 'digest'> | PeerObservationSnapshot) {
  const { digest: _ignored, ...payload } = snapshot as PeerObservationSnapshot;
  return payload;
}

export function makeSnapshot({ observedAt, sourceRun, input, peer, replayCount, findings }: {
  observedAt: string; sourceRun: PeerObservationSnapshot['sourceRun']; input: ObservationInputIdentity;
  peer: PeerExecutionIdentity; replayCount: number; findings: Finding[];
}): PeerObservationSnapshot {
  const payload: Omit<PeerObservationSnapshot, 'digest'> = {
    schemaVersion: PEER_SNAPSHOT_SCHEMA, reportType: 'normalized-peer-observation', observedAt, sourceRun, input, peer,
    replay: { protocol: 'sorted-normalized-ranges-v1', count: replayCount, agreed: true }, findings: normalizedFindings(findings),
  };
  const snapshot = { ...payload, digest: digest(payload) };
  validateSnapshot(snapshot);
  return snapshot;
}

export function validateSnapshot(value: unknown, expected?: { input: ObservationInputIdentity; peer: PeerExecutionIdentity }): PeerObservationSnapshot {
  const s = value as PeerObservationSnapshot;
  if (!s || s.schemaVersion !== PEER_SNAPSHOT_SCHEMA || s.reportType !== 'normalized-peer-observation' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s.observedAt) || !RUN_ID.test(s.sourceRun?.runId ?? '') ||
    !/^[a-f0-9]{40}$/.test(s.sourceRun?.benchmarkRevision ?? '') || !SHA256.test(s.digest ?? '') ||
    s.digest !== digest(snapshotPayload(s)) || s.replay?.protocol !== 'sorted-normalized-ranges-v1' ||
    !Number.isInteger(s.replay?.count) || s.replay.count < 2 || s.replay.agreed !== true)
    throw new Error('Invalid, corrupt, or incomplete peer observation snapshot');
  const checkedInput = inputIdentity({ surface: s.input.surface, suite: s.input.suiteHash, corpus: s.input.corpusHash,
    fixtures: [], semanticIndex: s.input.semanticIndex });
  if (!SHA256.test(s.input.suiteHash) || !SHA256.test(s.input.corpusHash) || !SHA256.test(s.input.fixturesDigest) ||
    !Number.isInteger(s.input.fixtureCount) || s.input.fixtureCount < 0 || checkedInput.surface !== s.input.surface)
    throw new Error('Invalid peer snapshot input identity');
  if (!s.peer || s.peer.id === PRODUCT || !s.peer.id || !s.peer.version || !s.peer.mode ||
    !SHA256.test(s.peer.configurationHash) || s.peer.configurationHash !== digest(JSON.stringify(s.peer.configuration)) ||
    !SHA256.test(s.peer.artifactDigest) || !s.peer.observedArtifact?.platform || !SHA256.test(s.peer.observedArtifact?.digest ?? '') ||
    !SHA256.test(s.peer.adapterDigest)) throw new Error('Invalid peer identity');
  if (!Array.isArray(s.findings) || JSON.stringify(s.findings) !== JSON.stringify(normalizedFindings(s.findings)) ||
    s.findings.some(f => !f.path || path.isAbsolute(f.path) || f.path.split(/[\\/]/).includes('..') ||
      !Number.isInteger(f.start) || !Number.isInteger(f.end) || f.start < 0 || f.end <= f.start ||
      Object.keys(f).some(key => !['path', 'start', 'end', 'family', 'action'].includes(key))))
    throw new Error('Peer snapshot contains invalid or non-normalized findings');
  if (expected && canonical(s.input) !== canonical(expected.input))
    throw new Error(`Peer observation snapshot input identity mismatch (${s.peer.id}); explicit refresh required`);
  const portablePeer = (peer: PeerExecutionIdentity) => {
    const { observedArtifact: _runtimeSpecific, ...identity } = peer;
    return identity;
  };
  if (expected && canonical(portablePeer(s.peer)) !== canonical(portablePeer(expected.peer)))
    throw new Error(`Peer observation snapshot execution identity mismatch (${s.peer.id}); explicit refresh required`);
  return s;
}

export async function readSnapshot(file: string, expected: { input: ObservationInputIdentity; peer: PeerExecutionIdentity }) {
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(file, 'utf8')); }
  catch { throw new Error(`Missing or corrupt peer observation snapshot: ${file}`); }
  return validateSnapshot(parsed, expected);
}

export async function writeSnapshot(file: string, snapshot: PeerObservationSnapshot) {
  validateSnapshot(snapshot);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, file);
}

export function snapshotObservation(snapshot: PeerObservationSnapshot): Observation {
  return {
    id: snapshot.peer.id, version: snapshot.peer.version, mode: snapshot.peer.mode,
    configuration: structuredClone(snapshot.peer.configuration), configurationHash: snapshot.peer.configurationHash,
    status: 'complete', findings: structuredClone(snapshot.findings), durationMs: 0,
    replays: { count: snapshot.replay.count, agreed: true },
    observation: { source: 'snapshot', observedAt: snapshot.observedAt, sourceRunId: snapshot.sourceRun.runId,
      snapshotDigest: snapshot.digest, inputDigest: digest(snapshot.input) },
  };
}

export function freshObservation(runId: string, observedAt: string) {
  return { source: 'fresh' as const, observedAt, sourceRunId: runId };
}

export function snapshotPath(root: string, surface: string, peer: string) {
  if (![surface, peer].every(v => /^[a-z0-9][a-z0-9._/-]{0,159}$/.test(v))) throw new Error('Invalid snapshot path');
  return path.join(root, PEER_SNAPSHOT_DIRECTORY, surface, `${peer}.json`);
}
