import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts, controlAxis, arrivalIds } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalFamilies, validateBeta8 } from '../benchmarks/lib/beta8/index.ts';
import { POSITIVE_AXES, countProfile } from '../benchmarks/lib/beta8/profiles.ts';
import { CONTROL_SUFFIXES } from '../fixtures/generated/beta8/helpers.mjs';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const registry = await read('benchmarks/detectors.json');
const taxonomy = await read('benchmarks/support/taxonomy.json');
const categories = await read('benchmarks/categories.json');
const manifest = await read('corpora/development/manifest.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const generated = buildCorpora();
const beta8 = Object.entries(generated).filter(([id]) => id.startsWith('beta8-'));

test('Beta.8 modules: arrival families are declared once, carry a taxonomy family and a contract, and never shadow a registry detector', () => {
  assert.deepEqual(validateBeta8(registry.detectors.map(d => d.id), taxonomy.families.map(f => f.id)), []);
  assert.deepEqual(BETA8_MODULES.map(m => m.issue), [207, 208, 209, 210, 211, 212, '213d']);
  for (const f of arrivalFamilies) {
    const family = taxonomy.families.find(t => t.id === f.taxonomy);
    assert.ok(family, f.id);
    assert.ok(!family.detectors.length, `${f.id}: ${f.taxonomy} already maps to a registry detector; target it instead`);
  }
});

test('Beta.8 arrival contracts record per-field provenance, and a T1 arrival contract cites a provider source', () => {
  for (const id of arrivalIds) {
    const c = contracts[id];
    assert.ok(c.fields?.length, `${id}: an arrival contract lists its field claims`);
    if (c.tier === 'T1') assert.ok(c.fields.some(f => f.basis === 'provider-documentation' && f.status === 'frozen'), `${id}: T1 needs a frozen provider-documented field`);
  }
});

test('every beta8-<issue> corpus is registered, and its fixtures follow the target/axis conventions', () => {
  for (const [category, corpus] of beta8) {
    assert.ok(categories.some(c => c.id === category && c.corpus === `fixtures/generated/${category}.json`), category);
    assert.ok(manifest.categories.includes(category), category);
    for (const f of corpus.fixtures) {
      const targets = [...(f.detectors ?? []), ...(f.arrivalTargets ?? [])];
      assert.equal(targets.length, 1, f.id);
      assert.ok(f.id.startsWith(`${targets[0]}-`), f.id);
      assert.deepEqual(assignments[`${category}--${f.id}`], f.detectors ?? [], f.id);
      const secret = f.expected.some(r => r.role === 'secret');
      if (secret) assert.ok(POSITIVE_AXES.includes(f.contextAxis), `${f.id}: positive names its context axis`);
      else if (!f.twinOf) assert.ok(CONTROL_SUFFIXES.some(s => f.id.endsWith(`-${s}`)) && controlAxis(category, f), `${f.id}: control carries an axis`);
      assert.notEqual(f.assessment.tier, 'T0', `${f.id}: ${f.assessment.reason}`);
    }
  }
});

test('an arrival family with a value grammar has at least one structural (non-context) twin', () => {
  const twins = beta8.flatMap(([, c]) => c.fixtures.filter(f => f.twinOf && f.arrivalTargets));
  for (const id of arrivalIds)
    if (contracts[id].pattern && !contracts[id].unprobeable)
      assert.ok(twins.some(t => t.arrivalTargets[0] === id && t.mutationKind !== 'context'), id);
});

test('profile counts: twins, controls and positives are separate cells, and a missing cell is debt', () => {
  const f = (id, extra) => ({ category: 'x', targets: ['t'], controlAxis: null, fixture: { id, expected: [], ...extra } });
  const secret = [{ start: 0, end: 1, role: 'secret' }];
  const all = [f('p1', { expected: secret, contextAxis: 'env' }), f('p2', { expected: secret, contextAxis: 'env' }),
    f('t1', { twinOf: 'p1', mutationKind: 'length' }), { ...f('c1', {}), controlAxis: 'placeholder' }];
  const count = countProfile('t', 208, 'arrival-24', all, false);
  assert.deepEqual([count.total, count.positives, count.controls, count.twinPairs, count.positiveAxes, count.controlAxes], [4, 2, 1, 1, ['env'], ['placeholder']]);
  assert.ok(count.debt.includes('total 4/24') && count.debt.includes('positive axes 1/4'));
  assert.ok(countProfile('t', 207, 'context-48', all, false).debt.some(d => d.includes('context-gated')));
});
