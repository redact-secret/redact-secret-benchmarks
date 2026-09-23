import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRegistry } from '../benchmarks/engine/registry.ts';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { generateCase, hash, bytes, secrets, validateCase } from '../benchmarks/engine/model.ts';
import { mapFixture } from '../benchmarks/operators/context.ts';
import { absolute, observe, relation } from '../benchmarks/engine/assertions.ts';
import { runEvaluation, exitCode } from '../benchmarks/engine/runner.ts';
import { generate, evaluate } from '../benchmarks/methods/common.ts';
import { summaries } from '../benchmarks/engine/reporting.ts';

const methods = createMethods(), operators = createOperators();
const cases = await loadCases(operators);
const sample = method => cases.find(c => c.method === method && c.id.includes('github-token-ghp-plain'));
const findingsFor = v => secrets(v.fixture).map(r => ({ path: v.fixture.path, start: r.start, end: r.end }));
const prepared = method => generateCase(sample(method), methods, operators);

test('registries reject malformed, duplicate and unknown extensions', () => {
  const registry = createRegistry('test', ['generate']);
  assert.throws(() => registry.register({ id: 'x', version: 1 }));
  assert.throws(() => registry.register({ id: '../x', version: 1, generate() {} }));
  registry.register({ id: 'x', version: 1, generate() {} });
  assert.throws(() => registry.register({ id: 'x', version: 1, generate() {} }));
  assert.throws(() => registry.get('unknown'));
});

test('all existing corpora bridge deterministically into five methods and all detector targets', () => {
  assert.deepEqual([...new Set(cases.map(c => c.method))].sort(), ['benign', 'differential', 'metamorphic', 'mutation', 'twin']);
  assert.equal(new Set(cases.flatMap(c => c.targets)).size, 51);
  assert.equal(cases.filter(c => c.method === 'twin').length, 329);
  const before = hash(cases);
  const first = cases.map(c => generateCase(c, methods, operators).variants);
  const second = cases.map(c => generateCase(c, methods, operators).variants);
  assert.equal(hash(first), hash(second));
  assert.equal(hash(cases), before, 'generation cannot mutate source truth');
  assert.equal(new Set(first.flat().map(v => v.fixture.path)).size, first.flat().length);
});

test('case validation rejects holdout, unsafe paths, invalid byte boundaries and unknown methods', () => {
  const c = structuredClone(sample('twin'));
  assert.throws(() => validateCase({ ...c, visibility: 'holdout' }));
  assert.throws(() => validateCase({ ...c, seed: { ...c.seed, path: '../outside' } }));
  assert.throws(() => validateCase({ ...c, seed: { ...c.seed, content: '🔑', expected: [{ start: 1, end: 3, role: 'secret' }] } }));
  assert.throws(() => generateCase({ ...c, method: 'holdout' }, methods, operators));
});

test('mapping preserves UTF-8 ranges, multiple spans and envelopes through CRLF insertion', () => {
  const content = '🔑\nkey="abc"\nxyz\n';
  const start = Buffer.byteLength('🔑\nkey="');
  const seed = { content, expected: [
    { start, end: start + 3, role: 'secret', envelope: { start: 5, end: start + 4, reason: 'quoted' } },
    { start: start + 5, end: start + 8, role: 'secret' },
  ] };
  const transformed = mapFixture(seed, c => c === '\n' ? '\r\n' : c, 'é ');
  assert.deepEqual(transformed.expected.map(r => bytes(transformed, r)), ['abc', 'xyz']);
  assert.equal(bytes(transformed, transformed.expected[0].envelope), 'key="abc"');
  assert.equal(transformed.expected[0].start, start + 4);
  assert.equal(transformed.expected[1].start, start + 10);
});

test('CRLF operator avoids double carriage returns and maps inside multiline secrets', () => {
  const seed = { content: 'a\r\nb\nc', expected: [{ start: 0, end: 7, role: 'secret' }] };
  // The fixture is six bytes; use the actual boundary as source truth.
  seed.expected[0].end = Buffer.byteLength(seed.content);
  const output = operators.get('encoding.crlf').generate({ seed }).fixture;
  assert.equal(output.content, 'a\r\nb\r\nc');
  assert.equal(output.expected[0].end, 7);
});

test('single-line context wrappers map secret ranges without escaping token bytes', () => {
  const c = cases.find(c => c.method === 'metamorphic' && c.id === 'context-edges--bare--metamorphic');
  const { variants } = generateCase(c, methods, operators);
  for (const operator of ['context.json', 'context.quote', 'context.markdown']) {
    const v = variants.find(v => v.id === operator);
    assert.ok(v);
    assert.equal(bytes(v.fixture, v.fixture.expected[0]), bytes(c.seed, c.seed.expected[0]));
  }
});

test('mutations preserve valid lexical expectations and send uncertain mutations to T0', () => {
  const { variants } = prepared('mutation');
  assert.equal(variants.find(v => v.id === 'lexical.replace-last').strategy, 'derived');
  for (const id of ['lexical.length-minus-one', 'lexical.length-plus-one', 'lexical.invalid-alphabet']) {
    const v = variants.find(v => v.id === id);
    assert.equal(v.strategy, 'review-required');
    assert.equal(v.fixture.assessment.tier, 'T0');
    const row = observe(v, []);
    assert.equal(row.spanOutcomes, undefined);
    assert.equal(absolute(v, row).status, 'review-required');
  }
});

test('twin integrity rejects missing relation, unchanged input and mismatched families', () => {
  const c = structuredClone(sample('twin'));
  const op = operators.get('authored.twin');
  assert.throws(() => op.generate({ ...c, twin: { ...c.twin, twinOf: 'unknown' } }));
  assert.throws(() => op.generate({ ...c, twin: { ...c.twin, content: c.seed.content } }));
  assert.throws(() => op.generate({ ...c, twin: { ...c.twin, assessment: { ...c.twin.assessment, contract: 'gitlab-token' } } }));
});

test('a context twin keeps the value and edits one place outside it; anything else fails integrity', () => {
  const op = operators.get('authored.twin');
  const context = cases.filter(c => c.method === 'twin' && c.twin.mutationKind === 'context');
  assert.equal(context.length, 24);
  for (const c of context) assert.equal(op.generate(c).integrity.property, 'context', c.id);
  const c = structuredClone(context.find(c => c.id.includes('connection-string-postgres-bare')));
  const value = Buffer.from(c.seed.content).subarray(c.seed.expected[0].start, c.seed.expected[0].end).toString();
  assert.throws(() => op.generate({ ...c, twin: { ...c.twin, content: c.twin.content.replace(value, value.slice(0, -1)) } }), /Context twin changes the value/);
  assert.throws(() => op.generate({ ...c, twin: { ...c.twin, content: c.seed.content.replace(value, `${value.slice(0, 4)}-${value.slice(4)} ${value}`) } }), /Context twin edits the secret/);
});

test('twin must-flip detects either missed positive or flagged negative', () => {
  const { variants: [a, b] } = prepared('twin');
  const detected = observe(a, findingsFor(a)), clean = observe(b, []);
  assert.equal(relation(a, b, detected, clean, 'must-flip').status, 'pass');
  assert.equal(relation(a, b, observe(a, []), clean, 'must-flip').status, 'fail');
  assert.equal(relation(a, b, detected, observe(b, [{ path: b.fixture.path, start: 0, end: 1 }]), 'must-flip').status, 'fail');
});

test('a twin\'s must-flip assertion is scoped to its own contract family: co-detection by another family passes (#82)', () => {
  const { variants: [a, b] } = prepared('twin');
  const detected = observe(a, findingsFor(a));
  assert.equal(b.fixture.assessment.contract, 'github-token');
  const own = observe(b, [{ path: b.fixture.path, start: 0, end: 1, family: 'github-token' }]);
  assert.equal(relation(a, b, detected, own, 'must-flip').status, 'fail', 'a finding from the twin\'s own contract family still fails it');
  const coDetected = observe(b, [{ path: b.fixture.path, start: 0, end: 1, family: 'bearer-token' }]);
  assert.equal(coDetected.coDetected, true);
  assert.equal(relation(a, b, detected, coDetected, 'must-flip').status, 'pass', 'a finding from a different, known family is legitimate co-detection, not a twin failure');
});

test('metamorphic invariants do not pass two misses or overbroad redaction', () => {
  const { variants: [a, b] } = prepared('metamorphic');
  assert.equal(relation(a, b, observe(a, []), observe(b, []), 'same-detection').status, 'fail');
  assert.equal(relation(a, b, observe(a, findingsFor(a)), observe(b, findingsFor(b)), 'same-detection').status, 'pass');
  const overbroad = [{ path: b.fixture.path, start: 0, end: Buffer.byteLength(b.fixture.content) }];
  assert.equal(absolute(b, observe(b, overbroad)).status, 'fail');
});

test('differential classifies observations without scoring consensus as truth', () => {
  const { variants } = prepared('differential'), v = variants[0];
  const compare = (a, b) => methods.get('differential').evaluate({ variants, observations: [
    { id: 'redact-secret', status: 'complete', findings: a },
    { id: 'gitleaks', status: 'complete', findings: b },
  ] });
  assert.equal(compare([], []).comparisons[0].disagreement, 'none');
  assert.equal(compare(findingsFor(v), []).queue[0].disagreement, 'redact-secret-only');
  assert.equal(compare([], findingsFor(v)).queue[0].disagreement, 'peer-only');
  const broad = [{ path: v.fixture.path, start: 0, end: Buffer.byteLength(v.fixture.content) }];
  assert.equal(compare(findingsFor(v), broad).queue[0].disagreement, 'range-disagreement');
  assert.equal(compare(findingsFor(v), [...findingsFor(v), ...findingsFor(v)]).queue.length, 0);
  assert.deepEqual(compare([], []).scanners, []);
  assert.equal(compare([], []).capabilities.classification, false);
});

test('unavailable peers and primary are incomplete, never agreement or peer-only', () => {
  const { variants } = prepared('differential');
  for (const observations of [
    [{ id: 'redact-secret', status: 'complete', findings: [] }],
    [{ id: 'gitleaks', status: 'complete', findings: [] }],
    [{ id: 'redact-secret', status: 'error' }, { id: 'gitleaks', status: 'complete', findings: [] }],
  ]) {
    const result = methods.get('differential').evaluate({ variants, observations });
    assert.equal(result.complete, false);
    assert.equal(result.queue.length, 0);
  }
});

test('runner strips truth from adapters, sanitizes reports and cleans scratch data', async () => {
  const c = sample('twin'), { variants } = prepared('twin');
  let scratch;
  const report = await runEvaluation({ cases: [c], methods, operators, scanners: [{
    id: 'redact-secret', version: async () => 'test-1',
    async scan(root, fixtures) {
      scratch = root;
      assert.deepEqual(Object.keys(fixtures[0]).sort(), ['content', 'id', 'path']);
      assert.equal(await readFile(path.join(root, fixtures[0].path), 'utf8'), fixtures[0].content);
      return findingsFor(variants[0]);
    },
  }] });
  assert.equal(report.failures.length, 0);
  assert.equal(report.results[0].scanners[0].assertions.length, 3);
  const text = JSON.stringify(report);
  assert.equal(text.includes(bytes(c.seed, secrets(c.seed)[0])), false);
  assert.equal(text.includes('"content"'), false);
  assert.equal(text.includes('"must-flip"'), true);
  await assert.rejects(access(scratch));
  assert.ok(Object.keys(report.byMethod).some(k => k.includes('must-redact:T1->must-not-flag:T2')));
});

test('invalid findings, process errors and missing tools cannot masquerade as clean results', async () => {
  const sentinel = 'RAW-OUTPUT-MUST-NOT-LEAK';
  const report = await runEvaluation({ cases: [sample('twin')], methods, operators, scanners: [
    { id: 'invalid', version: async () => '1', scan: async () => [{ path: 'unknown', start: 0, end: 1 }] },
    { id: 'broken', version: async () => { throw new Error(sentinel); } },
    { id: 'missing', version: async () => { throw new Error('unavailable'); } },
  ] });
  assert.deepEqual(report.scanners.map(s => s.status), ['error', 'error', 'unavailable']);
  assert.equal(JSON.stringify(report).includes(sentinel), false);
  // v1.1 §4: a scanner that never observed the input is a measured gap, one row per variant, never a pass.
  assert.equal(report.results[0].scanners.every(s => s.assertions.length === report.results[0].variants.length && s.assertions.every(a => a.status === 'not-measured' && a.reason === s.status)), true);
  assert.equal(exitCode(report), 1);
  const missing = { scanners: [{ status: 'unavailable' }], failures: [] };
  assert.equal(exitCode(missing), 0);
  assert.equal(exitCode(missing, { strict: true }), 1);
  const failed = { scanners: [{ status: 'complete' }], failures: [{}] };
  assert.equal(exitCode(failed), 0);
  assert.equal(exitCode(failed, { failOnAssertions: true }), 1);
});

test('summaries() computes axesByDetector from benign cases only, distinct per target, deduped and sorted (#92)', () => {
  const variant = (id, kind, tier) => ({ id, path: `${id}.txt`, strategy: 'authored', kind, tier,
    transformation: { method: 'none', methodVersion: 1, operator: 'none', operatorVersion: 1 }, provenance: {} });
  const pass = (variantId) => ({ scanner: 'redact-secret', status: 'complete', variants: [],
    assertions: [{ type: 'absolute', status: 'pass', variant: variantId }] });
  const results = [
    { id: 'c1', method: 'benign', taxonomy: 'near-miss', targets: ['fam-a'], generation: [], variants: [variant('c1-v1', 'must-not-flag', 'T2')], scanners: [pass('c1-v1')] },
    { id: 'c2', method: 'benign', taxonomy: 'placeholder', targets: ['fam-a'], generation: [], variants: [variant('c2-v1', 'must-not-flag', 'T3')], scanners: [pass('c2-v1')] },
    // A repeated axis on the same target must not be double-counted.
    { id: 'c3', method: 'benign', taxonomy: 'near-miss', targets: ['fam-a'], generation: [], variants: [variant('c3-v1', 'must-not-flag', 'T2')], scanners: [pass('c3-v1')] },
    { id: 'c4', method: 'benign', taxonomy: 'reference', targets: ['fam-b'], generation: [], variants: [variant('c4-v1', 'must-not-flag', 'T3')], scanners: [pass('c4-v1')] },
    // Non-benign methods (twin, here) must never contribute to axis diversity.
    { id: 'c5', method: 'twin', targets: ['fam-a'], generation: [], variants: [variant('c5-v1', 'must-redact', 'T1')], scanners: [pass('c5-v1')] },
  ];
  const { axesByDetector } = summaries(results);
  assert.deepEqual(axesByDetector, { 'fam-a': ['near-miss', 'placeholder'], 'fam-b': ['reference'] });
});

test('a sixth method registers and runs without changing engine dispatch', async () => {
  const registry = createMethods();
  registry.register({ id: 'custom', version: 1, validateCase() {}, generate, evaluate });
  const c = { ...sample('differential'), id: 'custom-case', method: 'custom' };
  const report = await runEvaluation({ cases: [c], methods: registry, operators,
    scanners: [{ id: 'test', version: async () => '1', scan: async () => [] }] });
  assert.equal(report.results[0].method, 'custom');
  assert.equal(report.failures.length, 1);
});
