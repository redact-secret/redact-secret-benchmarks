import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { replayPopulations } from '../scripts/replay-pii-populations.mjs';

const root = new URL('..', import.meta.url).pathname;
const dir = path.join(root, 'benchmarks/pii-eval-population-dual-run');

// A stand-in engine: it writes the committed artifact of the view named in the snapshot it is given, optionally altered. It proves the
// comparison and its failure mode without the Rust engine; the real engine runs in the dispatch workflow and locally with --engine.
function fakeEngine(alter) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'fake-pii-eval-')), 'pii-eval');
  writeFileSync(file, `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const a = process.argv; const get = n => a[a.indexOf(n) + 1];
const id = JSON.parse(fs.readFileSync(get('--snapshot'), 'utf8')).semantic.population.populationId.replace('b11-population-v2-', '');
const doc = JSON.parse(fs.readFileSync(${JSON.stringify(dir)} + '/' + id + '.public-synthetic-artifact.json', 'utf8'));
${alter}
fs.mkdirSync(get('--out'), { recursive: true });
fs.writeFileSync(path.join(get('--out'), 'public-synthetic-artifact.json'), JSON.stringify(doc, null, 1) + '\\n');
console.log(JSON.stringify({ state: 'replayed', semantic: { scannersLaunched: 0 } }));
`);
  chmodSync(file, 0o755);
  return file;
}

test('a replay whose artifacts equal the committed ones is reported equal, and is not canonical off the pinned linux binary', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'pii-replay-test-'));
  const receipt = replayPopulations({ engine: fakeEngine(''), work });
  // The committed bytes are re-serialised by the stand-in, so only the digest comparison is asserted to be strict here.
  assert.equal(receipt.populations.length, 4);
  assert.deepEqual(receipt.populations.map(p => p.view), ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress']);
  assert.ok(receipt.populations.every(p => p.equalSemanticDigest && p.semanticDigestRecomputed && p.replaysByteIdentical));
  assert.equal(receipt.verdict.allEqualSemanticDigest, true);
  assert.equal(receipt.engine.matchesPin, false);
  assert.equal(receipt.canonical, false);
  assert.equal(receipt.supportClaims, false);
  assert.equal(receipt.authorityChanged, false);
  assert.equal(receipt.scannersLaunched, 0);
});

test('a differing semantic digest is reported, never normalised', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'pii-replay-test-'));
  const receipt = replayPopulations({ engine: fakeEngine("if (id === 'oracle-plan') doc.semantic.populationCounts.authoredCases += 1;"), work });
  const changed = receipt.populations.find(p => p.view === 'oracle-plan');
  assert.equal(changed.equalSemanticDigest, false);
  assert.equal(changed.semanticDigestRecomputed, false);
  assert.equal(receipt.verdict.allEqualSemanticDigest, false);
  assert.ok(receipt.populations.filter(p => p.view !== 'oracle-plan').every(p => p.equalSemanticDigest));
});

test('the replay workflow is dispatch-only, mints a read-only token and runs the engine without it', () => {
  const text = readFileSync(path.join(root, '.github/workflows/pii-population-replay.yml'), 'utf8');
  assert.match(text, /^on:\n {2}workflow_dispatch:\n\npermissions: \{\}/m);
  assert.doesNotMatch(text, /pull_request|push:|schedule:/);
  assert.match(text, /permission-actions: read/);
  assert.match(text, /permission-contents: read/);
  const replay = text.split('- name: Replay the frozen observations')[1].split('- name: Summary')[0];
  assert.doesNotMatch(replay, /GH_TOKEN|steps\.token|secrets\./);
  assert.match(text, /fetch-engine/);
});
