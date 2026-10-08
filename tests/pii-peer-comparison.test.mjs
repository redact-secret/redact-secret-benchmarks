import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPiiPeerComparison } from '../benchmarks/evaluation/domains/pii/peer-comparison.mjs';
const read = relative => readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
const dir = 'benchmarks/pii-peer-comparison';
function fixture() {
  const record = JSON.parse(read(`${dir}/record.json`));
  return { record, populationPins: JSON.parse(read('benchmarks/pii-eval-population-pins.json')), populationPlan: JSON.parse(read('benchmarks/pii-candidate-comparison/plan.json')), pins: record.peers.map(p => ({ peer: p.peer, text: read(`${dir}/${p.peer}.pins.json`) })), artifacts: record.peers.flatMap(p => p.results.map(r => ({ peer: p.peer, view: r.view, text: read(`${dir}/${p.peer}.${r.view}.public-synthetic-artifact.json`) }))) };
}
test('committed local observations retain bounded exploratory scope', () => {
  const result = loadPiiPeerComparison(fixture());
  assert.equal(result.state, 'recorded');
  assert.equal(result.mode, 'exploratory');
  assert.equal(result.qualified, false);
  assert.ok(result.peers.every(p => p.measurement.complete));
  assert.ok(result.withheld.includes('sensitivity'));
});
test('missing receipt is unavailable', () => { assert.equal(loadPiiPeerComparison().state, 'absent'); });
for (const [name, mutate] of [
  ['official claim', f => { f.record.mode = 'official'; }],
  ['qualification claim', f => { f.record.qualified = true; }],
  ['extra receipt field', f => { f.record.ownerAcceptance = true; }],
  ['disabled-family suppression', f => { f.record.peers[0].capabilities.families = [{ family: 'pii:global:phone', state: 'unsupported' }]; }],
  ['sensitivity imputation', f => { f.record.peers[0].capabilities.sensitivityClassification = 'supported'; }],
  ['changed default configuration', f => { f.record.peers[0].configuration.constructor = 'enabled-all'; }],
  ['missing peer artifact', f => { f.artifacts.pop(); }],
  ['duplicate peer artifact', f => { f.artifacts[1] = f.artifacts[0]; }],
  ['artifact bytes changed', f => { f.artifacts[0].text += ' '; }],
  ['pin bytes changed', f => { f.pins[0].text += ' '; }],
  ['population drift', f => { f.populationPins.populations[0].population.populationDigest = '0'.repeat(64); }],
  ['roster drift', f => { f.populationPins.populations[0].projection.rosterDigest = '0'.repeat(64); }],
  ['false unresolved count', f => { f.record.peers[0].results[0].unresolved += 1; }],
  ['fake native engine', f => { f.record.engine.binarySha256 = '0'.repeat(64); }],
  ['fake npm integrity', f => { f.record.peers[0].npmIntegrity = 'sha512-AA=='; }],
  ['array unmapped labels', f => { f.record.peers[0].results[0].unmappedTypes = []; }],
  ['false authored count', f => { f.record.peers[0].results[0].memberships += 1; }],
]) test(`refuses ${name}`, () => { const f = fixture(); mutate(f); assert.equal(loadPiiPeerComparison(f).state, 'invalid'); });
