import test from 'node:test';
import assert from 'node:assert/strict';
import { controlFor } from '../scripts/candidate-control.mjs';

const D = c => `sha256:${c.repeat(64)}`;
const archive = { release: 'official-runs-1', sha256: D('a') };
const adoption = {
  candidate: { evidenceRelease: 'snapshot-2026.10.04.3', manifestDigest: D('1') },
  engineCandidate: { evidenceRelease: 'snapshot-2026.10.04.3', manifestDigest: D('1'), engine: { tag: 'v0.1.0-alpha.5', revision: 'c'.repeat(40) }, product: { version: '0.1.0-beta.13' }, replay: { archive } },
};

test('without an evidence tag the control is the accepted evidence\'s engine candidate', () => {
  assert.equal(controlFor(adoption).replay.archive.release, 'official-runs-1');
  assert.throws(() => controlFor({}), /no engineCandidate/);
});

test('a new snapshot needs its adoption record, its manifest digest and the recorded control archive', () => {
  const next = { ...adoption, candidate: { evidenceRelease: 'snapshot-2026.10.04.4', manifestDigest: D('2'), engine: adoption.engineCandidate.engine, replay: { archive: { release: 'official-runs-2', sha256: D('b') } } } };
  const c = controlFor(next, { evidenceTag: 'snapshot-2026.10.04.4', manifestDigest: D('2') });
  assert.equal(c.replay.archive.release, 'official-runs-2');
  assert.equal(c.product.version, '0.1.0-beta.13', 'the product control falls back to the engine candidate\'s published build');
  assert.throws(() => controlFor(next, { evidenceTag: 'snapshot-2026.10.04.4', manifestDigest: D('3') }), /records manifest/);
  assert.throws(() => controlFor(next, { evidenceTag: 'snapshot-2026.10.09', manifestDigest: D('2') }), /records no adoption/);
  assert.throws(() => controlFor(next, { evidenceTag: 'snapshot-2026.10.04.4' }), /--manifest-digest/);
  const noArchive = { ...next, candidate: { ...next.candidate, replay: undefined } };
  assert.throws(() => controlFor(noArchive, { evidenceTag: 'snapshot-2026.10.04.4', manifestDigest: D('2') }), /no replay archive/);
  assert.equal(controlFor(noArchive, { evidenceTag: 'snapshot-2026.10.04.4', manifestDigest: D('2'), requireArchive: false }).engine.tag, 'v0.1.0-alpha.5');
});

test('the CLI fields the workflow reads resolve on the real record (archive.release and archive.sha256 are the recorded replay archive)', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = f => execFileSync('node', ['scripts/candidate-control.mjs', '--field', f], { encoding: 'utf8' }).trim();
  assert.match(out('archive.release'), /^official-runs-\d+$/);
  assert.match(out('archive.sha256'), /^sha256:[0-9a-f]{64}$/);
  assert.match(out('engine.tag'), /^v\d+\.\d+\.\d+/);
});
