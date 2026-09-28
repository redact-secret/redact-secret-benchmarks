import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditTwin, auditTwins, duplicateContentClusters, editHunks, failureCell, familyIndependence, formatOverlaps, positiveSourceClass,
  renderFamilyTable, rowFailures, sharedValueClusters, skeleton, summarizeFailures, templateClusters,
} from '../benchmarks/lib/fixture-independence.ts';

// Synthetic, obviously fake values; the module never needs a real format.
const VALUE_A = 'tf_' + 'a1b2c3d4'.repeat(3);
const VALUE_B = 'tf_' + 'z9y8x7w6'.repeat(3);
const contracts = { 'test-family': { tier: 'T1', pattern: '^tf_[a-z0-9]{24}$', providerSource: { url: 'https://provider.example/docs', observedAt: '2026-09-28', formatVersion: 'v1', covers: 'prefix' } },
  'other-family': { tier: 'T2', pattern: '^of_[A-Z]{12}$' } };

const positive = (id, content, value, extra = {}) => {
  const start = Buffer.from(content.slice(0, content.indexOf(value)), 'utf8').length;
  return { id, path: `${id}.txt`, content, group: `g · ${extra.contextAxis ?? 'env'}`, expected: [{ start, end: start + Buffer.byteLength(value), role: 'secret' }],
    assessment: { kind: 'must-redact', tier: 'T1', reason: 'r', sources: extra.sources ?? ['https://provider.example/docs'], contract: 'test-family' }, ...extra };
};
const negative = (id, content, extra = {}) => ({ id, path: `${id}.txt`, content, group: 'g', expected: [],
  assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family' }, ...extra });
const wrap = (fixture, category = 'cat', families = ['test-family'], benignAxis) => ({ key: `${category}--${fixture.id}`, category, fixture, families, benignAxis });

test('byte-identical fixtures cluster; distinct bytes do not', () => {
  const a = wrap(negative('ref-1', 'TOKEN=${TOKEN}\n'));
  const b = wrap(negative('ref-2', 'TOKEN=${TOKEN}\n'), 'other');
  const c = wrap(negative('ref-3', 'TOKEN=${OTHER}\n'));
  const clusters = duplicateContentClusters([a, b, c]);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].members, ['cat--ref-1', 'other--ref-2']);
});

test('one value wrapped on two axes is one independent axis, and the value never appears in output', () => {
  const env = wrap(positive('env', `API_KEY=${VALUE_A}\n`, VALUE_A, { contextAxis: 'env' }));
  const header = wrap(positive('header', `Authorization: Bearer ${VALUE_A}\n`, VALUE_A, { contextAxis: 'header' }));
  const other = wrap(positive('log', `[info] loaded ${VALUE_B}\n`, VALUE_B, { contextAxis: 'log' }));
  const summary = familyIndependence('test-family', [env, header, other], contracts, [], [], []);
  assert.equal(summary.positives.raw, 3);
  assert.equal(summary.positives.distinctValues, 2);
  assert.equal(summary.positives.axes, 3);
  assert.equal(summary.positives.independentAxes, 2);
  assert.equal(summary.positives.sameValueAcrossAxes, 1);
  assert.equal(summary.positives.sourceClasses['provider-documented'], 3);
  const shared = sharedValueClusters([env, header, other]);
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].members, ['cat--env', 'cat--header']);
  const serialized = JSON.stringify({ summary, shared });
  assert.ok(!serialized.includes(VALUE_A) && !serialized.includes(VALUE_B));
});

test('a template with its value swapped shares one skeleton', () => {
  const a = wrap(positive('a', `export API_KEY="${VALUE_A}"\n`, VALUE_A));
  const b = wrap(positive('b', `export API_KEY="${VALUE_B}"\n`, VALUE_B));
  assert.equal(skeleton(a.fixture), skeleton(b.fixture));
  assert.equal(templateClusters([a, b]).length, 1);
  const summary = familyIndependence('test-family', [a, b], contracts, [], [], []);
  assert.equal(summary.positives.distinctValues, 2);
  assert.equal(summary.positives.independentUpperBound, 1);
});

test('positives backed only by peer-scanner rules are classified apart from provider documentation', () => {
  const ruleOnly = positive('r', `K=${VALUE_A}\n`, VALUE_A, { sources: ['https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml'] });
  assert.equal(positiveSourceClass(ruleOnly, { tier: 'T2', pattern: '^x$' }), 'scanner-rule-only');
  assert.equal(positiveSourceClass(ruleOnly, contracts['test-family']), 'provider-documented');
  const mixed = positive('m', `K=${VALUE_A}\n`, VALUE_A, { sources: ['https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'https://community.example/thread'] });
  assert.equal(positiveSourceClass(mixed, { tier: 'T2' }), 'mixed');
});

test('edit hunks merge a fragmented word replacement into one edit', () => {
  assert.equal(editHunks('Authorization: Bearer x', 'X-Build-Id: x').length, 1);
  assert.equal(editHunks('same', 'same').length, 0);
  assert.equal(editHunks('aa\nbb value cc\ndd', 'aa\nbX value cY\ndd').length, 2);
});

test('twin audit accepts one-property twins and flags extra or misplaced edits', () => {
  const pos = positive('p', `# api key for service\nAPI_KEY=${VALUE_A}\n`, VALUE_A);
  const oneLength = negative('t1', `# api key for service\nAPI_KEY=${VALUE_A.slice(0, -1)}\n`, { twinOf: 'p', mutationKind: 'length' });
  assert.deepEqual(auditTwin(oneLength, pos).flags, []);
  const alsoComment = negative('t2', `# key for a different thing\nAPI_KEY=${VALUE_A.slice(0, -1)}\n`, { twinOf: 'p', mutationKind: 'length' });
  assert.deepEqual(auditTwin(alsoComment, pos).flags, ['value-and-context']);
  const contextOnly = negative('t3', `# api key for service\nBUILD_ID=${VALUE_A}\n`, { twinOf: 'p', mutationKind: 'context' });
  assert.deepEqual(auditTwin(contextOnly, pos).flags, []);
  const contextAndValue = negative('t4', `# api key for service\nBUILD_ID=${VALUE_B}\n`, { twinOf: 'p', mutationKind: 'context' });
  assert.ok(auditTwin(contextAndValue, pos).flags.includes('context-twin-edits-value'));
  const twoContextEdits = negative('t5', `# unrelated build note\nBUILD_ID=${VALUE_A}\n`, { twinOf: 'p', mutationKind: 'context' });
  assert.deepEqual(auditTwin(twoContextEdits, pos).flags, ['multiple-context-edits']);
  assert.deepEqual(auditTwin(oneLength, undefined).flags, ['missing-positive']);
  const [audit] = auditTwins([wrap(pos), wrap(oneLength)]);
  assert.equal(audit.twin, 'cat--t1');
  assert.equal(audit.positive, 'cat--p');
});

test('format overlaps report benign bytes that satisfy a frozen contract, isolated matches only', () => {
  const own = wrap(negative('own', `example: ${VALUE_A}\n`, { assessment: { kind: 'must-not-flag', tier: 'T2', reason: 'r', sources: [], contract: 'test-family', lexicalExemption: { reason: 'x', citation: 'y' } } }));
  const other = wrap(negative('other', 'note: of_ABCDEFGHIJKL is not ours\n'));
  const glued = wrap(negative('glued', `id=x${VALUE_A}y\n`));
  const clean = wrap(negative('clean', 'nothing here\n'));
  const overlaps = formatOverlaps([own, other, glued, clean], contracts);
  assert.deepEqual(overlaps.map(o => o.fixture), ['cat--other', 'cat--own']);
  assert.equal(overlaps.find(o => o.fixture === 'cat--own').ownContract, true);
  assert.equal(overlaps.find(o => o.fixture === 'cat--own').exempt, true);
  assert.deepEqual(overlaps.find(o => o.fixture === 'cat--other').overlappingContracts, ['other-family']);
});

test('row failures split leaks, warn-only, false alarms and co-detection, and count unique axes apart from raw rows', () => {
  const env = wrap(positive('env', `API_KEY=${VALUE_A}\n`, VALUE_A, { contextAxis: 'env' }));
  const env2 = wrap(positive('env2', `API_KEY=${VALUE_B}\n`, VALUE_B, { contextAxis: 'env' }));
  const warned = wrap(positive('warned', `log ${VALUE_A}\n`, VALUE_A, { contextAxis: 'log' }));
  const authoredWarn = wrap(positive('authored', `log ${VALUE_B}\n`, VALUE_B, { contextAxis: 'log', expectedAction: 'warn' }));
  const benign = wrap(negative('ph', 'API_KEY=<your key>\n'), 'cat', ['test-family'], 'placeholder');
  const e = f => f.fixture.expected;
  const rows = [
    ...rowFailures('cat', { id: 'env', kind: 'must-redact', tier: 'T1', spanOutcomes: ['MISS'], expected: e(env), actual: [] }, env),
    ...rowFailures('cat', { id: 'env2', kind: 'must-redact', tier: 'T1', spanOutcomes: ['PARTIAL'], expected: e(env2), actual: [{ start: 8, end: 12 }] }, env2),
    ...rowFailures('cat', { id: 'warned', kind: 'policy', tier: 'T3', spanOutcomes: ['EXACT'], expected: e(warned), actual: [{ ...e(warned)[0], action: 'warn' }] }, warned),
    ...rowFailures('cat', { id: 'authored', kind: 'policy', tier: 'T3', spanOutcomes: ['EXACT'], expected: e(authoredWarn), actual: [{ ...e(authoredWarn)[0], action: 'warn' }] }, authoredWarn),
    ...rowFailures('cat', { id: 'ph', kind: 'must-not-flag', tier: 'T2', flagged: true, findings: 1, actual: [{ start: 0, end: 3, action: 'redact' }] }, benign),
    ...rowFailures('cat', { id: 'ph', kind: 'must-not-flag', tier: 'T2', flagged: false, coDetected: true, findings: 1, actual: [{ start: 0, end: 3, action: 'warn', family: 'x' }] }, benign),
    ...rowFailures('cat', { id: 'pending', kind: 'must-redact', tier: 'T0', spanOutcomes: ['MISS'] }, undefined),
  ];
  assert.deepEqual(rows.map(r => r.type), ['leak', 'leak', 'warn-only', 'false-alarm', 'co-detection']);
  const summary = summarizeFailures(rows);
  const leak = summary.find(s => s.type === 'leak');
  assert.equal(leak.rawRows, 2);
  assert.equal(leak.uniqueAxes, 1);
  assert.equal(summary.find(s => s.type === 'false-alarm').action, 'redact');
  assert.equal(summary.find(s => s.type === 'co-detection').action, 'warn');
  assert.equal(summary.find(s => s.type === 'warn-only').kind, 'policy');
});

test('the family table renders one row per family, keeps modes apart and has no overall score column', () => {
  const env = wrap(positive('env', `API_KEY=${VALUE_A}\n`, VALUE_A, { contextAxis: 'env' }));
  const fam = familyIndependence('test-family', [env], contracts, [], [], []);
  const measured = status => ({ families: { 'test-family': { status, tier: 'T1', target: 'stable-documented', debt: [{ cell: 'positiveCases', actual: 1, required: 6 }],
    twinPairs: 0, twinFailures: 0, benignFalseAlarms: 0, metamorphicCriticalFailures: 0, mutationUnresolvedCritical: 0, differentialUnresolvedContractDisagreements: 2,
    supportedContexts: [], empiricalMode: null, benchSpans: { spans: 1, leaked: 0, collateralBytes: 0 } } },
    failures: status === 'provisional' ? [{ family: 'test-family', type: 'leak', kind: 'must-redact', action: 'none', rawRows: 1, uniqueAxes: 1, uniqueTemplates: 1, axes: ['env'] }] : [] });
  const table = renderFamilyTable({ families: [fam], knownGaps: { 'test-family': [{ id: 'g-1', status: 'verified' }, { id: 'g-0', status: 'fixed' }] },
    published: measured('provisional'), candidate: measured('stable') });
  const rows = table.trim().split('\n');
  assert.equal(rows.length, 3);
  assert.match(rows[2], /provisional → stable/);
  assert.match(rows[2], /leak MR 1f\/1ax \| — \|/);
  assert.match(rows[2], /positiveCases 1\/6/);
  assert.match(rows[2], /g-1 \(verified\)/);
  assert.ok(!rows[2].includes('g-0'));
  assert.ok(!/score|precision|recall|f1/i.test(rows[0]));
  assert.ok(!table.includes(VALUE_A));
  assert.equal(failureCell([], 'x'), '—');
});
