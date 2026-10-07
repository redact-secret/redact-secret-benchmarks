import test from 'node:test';
import assert from 'node:assert/strict';
import { controlFor } from '../scripts/candidate-control.mjs';
import { problems as candidateRegistryProblems } from '../scripts/check-product-candidates.mjs';

// The accepted engine and product (#808, #657): a candidate is replayed on the pins the owner accepted, against a control copy measured at exactly those pins.
// Synthetic records only; the acceptance block is never written.

const D = c => `sha256:${c.repeat(64)}`;
const archive = { release: 'official-runs-1', sha256: D('a') };
const accepted = {
  state: 'accepted',
  candidate: { evidenceRelease: 'snapshot-2026.10.06.4', manifestDigest: D('4'), engine: { tag: 'v0.1.0-alpha.15', revision: 'a'.repeat(40) }, product: { version: '0.1.0-beta.13', integrity: 'old' }, replay: { archive, recordedRuns: [{ caseCounts: { old: 1 } }], replayCopy: { release: 'official-runs-9', sha256: D('9') } } },
  engineProductAcceptance: { evidenceRelease: 'snapshot-2026.10.06.4', manifestDigest: D('4'), engine: { tag: 'v0.1.0-alpha.16', revision: 'b'.repeat(40) }, product: { package: '@redact-secret/core', version: '0.1.0-beta.14', integrity: 'new' } },
};
const copy = { release: 'official-runs-10', sha256: D('c'), engineTag: 'v0.1.0-alpha.16', productVersion: '0.1.0-beta.14', recordedRuns: [{ caseCounts: { fresh: 1 } }], semanticDigests: { x: D('d') } };
const withCopy = c => ({ ...accepted, candidate: { ...accepted.candidate, replay: { ...accepted.candidate.replay, acceptedPinsCopy: c } } });

test('after an engine and product acceptance the control is the accepted pins and the copy measured at them', () => {
  const before = JSON.stringify(accepted.engineProductAcceptance);
  const c = controlFor(withCopy(copy));
  assert.equal(c.source, 'engineProductAcceptance');
  assert.equal(c.engine.tag, 'v0.1.0-alpha.16');
  assert.equal(c.product.version, '0.1.0-beta.14');
  assert.equal(c.replay.archive.release, 'official-runs-10', 'not the alpha.15 / beta.13 replay copy');
  assert.deepEqual(c.replay.recordedRuns, copy.recordedRuns, 'the scanner roster comes from the copy');
  assert.equal(JSON.stringify(accepted.engineProductAcceptance), before, 'the acceptance block is read, never written');
});

test('a missing, stale or mismatched control at the accepted pins is refused, and the engine stays readable for planning', () => {
  assert.throws(() => controlFor(accepted), /no control at the accepted pins/);
  assert.equal(controlFor(accepted, { requireArchive: false }).engine.tag, 'v0.1.0-alpha.16', 'the workflow reads the engine tag before the control exists');
  assert.throws(() => controlFor(withCopy({ ...copy, engineTag: 'v0.1.0-alpha.15' })), /stale/);
  assert.throws(() => controlFor(withCopy({ ...copy, productVersion: '0.1.0-beta.13' })), /stale/);
  assert.throws(() => controlFor(withCopy({ ...copy, sha256: 'nope' })), /no archive/);
  assert.throws(() => controlFor({ ...withCopy(copy), engineProductAcceptance: { ...accepted.engineProductAcceptance, manifestDigest: D('5') } }), /another evidence release/);
});

test('a record without an engine and product acceptance keeps the earlier rule: the replay copy of the accepted adoption', () => {
  const { engineProductAcceptance, ...plain } = accepted;
  const c = controlFor(plain);
  assert.equal(c.source, 'candidate');
  assert.equal(c.replay.archive.release, 'official-runs-9');
  assert.equal(c.engine.tag, 'v0.1.0-alpha.15');
});

test('a candidate registered after the acceptance names the accepted product as its control; any other control is refused', () => {
  const entry = control => ({ id: 'core-main-aaaaaaaa', product: { commit: 'a'.repeat(40), published: false }, control: { version: control }, platform: 'linux-x64', runClass: 'exploratory', publication: 'internal', release: { repository: 'r/r', tag: 't' },
    packages: [{ name: '@redact-secret/core', file: 'c.tgz', sha256: D('1'), size: 1, platform: null }, { name: '@redact-secret/wasm', file: 'w.tgz', sha256: D('2'), size: 1, platform: null }, { name: '@redact-secret/node-linux-x64-gnu', file: 'n.tgz', sha256: D('3'), size: 1, platform: 'linux-x64' }] });
  const registry = control => ({ schema: 'redact-secret/product-candidates/v1', candidates: [entry(control)] });
  assert.deepEqual(candidateRegistryProblems(registry('0.1.0-beta.14'), accepted), []);
  assert.deepEqual(candidateRegistryProblems(registry('0.1.0-beta.13'), accepted), [], 'an earlier candidate keeps the adoption product pin');
  assert.ok(candidateRegistryProblems(registry('0.1.0-beta.99'), accepted).some(p => p.includes('product pin')));
});
