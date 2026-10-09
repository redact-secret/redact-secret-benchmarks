import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { accountGroups as oracleAccount } from '../benchmarks/evaluation/domains/credential/accounting.ts';
import { selectionGroups as oracleSelection } from '../benchmarks/evaluation/domains/credential/run-summary.ts';
import { accountRecordedGroups, selectionGroups, validateAccounting } from '../benchmarks/consumer/credential-metrics.ts';

const config = { version: '1.1', minDenominator: 1, resolvedRateFloor: 0.8, measurableShareFloor: 0.5, twinCoverageFloor: 0.5, replays: 2, intervalZ: 1.96, intervalPrecision: 6 };
const positive = (id, category, outcome = 'EXACT') => ({ id, category, path: id, group: 'synthetic', kind: 'must-redact', tier: 'T1', expected: [{ start: 3, end: 8, envelope: { start: 1, end: 10 } }, { start: 15, end: 17, role: 'companion' }], actual: [], spanOutcomes: [outcome], leakedBytes: outcome === 'PARTIAL' ? 2 : 0, collateralBytes: outcome === 'OVERBROAD' ? 4 : 0 });
const control = (id, category, extra = {}) => ({ id, category, path: id, group: 'synthetic', kind: 'must-not-flag', tier: 'T1', expected: [], actual: [], findings: 0, flagged: false, ...extra });
const rows = [positive('a--one', 'a'), positive('a--two', 'a', 'OVERBROAD'), positive('b--three', 'b', 'PARTIAL'), control('a--one-twin', 'a', { twinOf: 'a--one', coDetected: true }), control('b--three-twin', 'b', { twinOf: 'b--three' }), control('a--alarm', 'a', { flagged: true, findings: 2 }), { ...positive('a--pending', 'a'), tier: 'T0', spanOutcomes: undefined }, { ...positive('b--pending', 'b'), tier: 'T0', spanOutcomes: undefined }];
const noDiagnostics = groups => Object.fromEntries(Object.entries(groups).map(([key, group]) => { const { diagnostics, ...rest } = group; return [key, rest]; }));
const recorded = all => all.map(({ actual, path, group, ...row }) => row);

test('recorded statistics preserve oracle counts, bounds, withholding and selected twins/pending suites', () => {
  const selections = [new Set(rows.map(row => row.id)), new Set(['a--one', 'a--pending', 'b--pending']), new Set(['a--two']), new Set(['b--three']), new Set(['a--alarm']), new Set()];
  const mixedSpans = [{ ...rows[0], spanOutcomes: ['EXACT', 'MISS'], leakedBytes: 2 }];
  assert.deepEqual(accountRecordedGroups(recorded(mixedSpans), config), noDiagnostics(oracleAccount(mixedSpans, config)), 'recorded outcome cardinality is preserved, not inferred from secret metadata');
  for (const options of [config, { ...config, minDenominator: 3 }, { ...config, measurableShareFloor: 0.9, twinCoverageFloor: 1 }]) {
    assert.deepEqual(accountRecordedGroups(recorded(rows), options), noDiagnostics(oracleAccount(rows, options)));
    for (const selected of selections) assert.deepEqual(selectionGroups(recorded(rows), selected, options), noDiagnostics(oracleSelection(rows, selected, options)));
  }
  const own = selectionGroups(recorded(rows), selections[1], config)['must-redact/T1'];
  assert.equal(own.pendingFiles, 1, 'pending in an unrelated suite does not enter the positive group');
  assert.equal(own.twins.pairs, 1, 'the unselected twin follows its selected positive');
  assert.equal(own.twins.discriminated, 1);
  assert.equal(own.twins.coDetected, 1);
  assert.equal(own.leakedSpanRate.n, 1);
  assert.equal(own.leakedSpanRate.direction, 'upper');
  assert.equal(own.twins.coverage.direction, 'lower');
  assert.equal(own.envelopeWidth.bytes, 4);
});

test('current aggregation uses recorded observations and never rescans ranges or pools populations', () => {
  const a = recorded(rows.filter(row => row.category === 'a'));
  const b = recorded(rows.filter(row => row.category === 'b'));
  const baseline = accountRecordedGroups(a, config);
  const poisonedRanges = a.map(row => ({ ...row, actual: [{ start: -999, end: 999999 }] }));
  assert.deepEqual(accountRecordedGroups(poisonedRanges, config), baseline);
  assert.equal(baseline['must-redact/T1'].files, 2);
  assert.equal(accountRecordedGroups(b, config)['must-redact/T1'].files, 1);
  assert.equal(baseline['must-redact/T1'].twins.discriminated, 1, 'OVERBROAD positive does not demonstrate discrimination');
});

test('malformed recorded observations fail closed instead of yielding plausible rates', () => {
  for (const patch of [{ spanOutcomes: ['UNKNOWN'] }, { spanOutcomes: null }, { leakedBytes: -1 }, { collateralBytes: NaN }, { tier: 'T9' }])
    assert.throws(() => accountRecordedGroups(recorded([{ ...rows[0], ...patch }]), config), /Invalid/);
  assert.throws(() => accountRecordedGroups(recorded([rows[0], rows[0]]), config), /Duplicate/);
  assert.throws(() => accountRecordedGroups(recorded([control('bad', 'a', { findings: -1 })]), config), /Invalid recorded control/);
  assert.throws(() => validateAccounting({ ...config, minDenominator: 0 }), /Invalid/);
});

function staticImports(text) {
  const named = [...text.matchAll(/^\s*(?:import|export)\s+((?:type\s+)?(?:\*[^;]*?|\{[^}]*\}|[\w$]+(?:\s*,\s*\{[^}]*\})?))\s+from\s+['"]([^'"]+)['"]/gm)].map(([, clause, specifier]) => ({
    specifier,
    typeOnly: clause.trim().startsWith('type ') || (clause.trim().startsWith('{') && clause.slice(clause.indexOf('{') + 1, clause.lastIndexOf('}')).split(',').filter(part => part.trim()).every(part => part.trim().startsWith('type '))),
  }));
  const sideEffects = [...text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)].map(([, specifier]) => ({ specifier, typeOnly: false }));
  const dynamic = [...text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map(([, specifier]) => ({ specifier, typeOnly: false, dynamic: true }));
  return [...named, ...sideEffects, ...dynamic];
}
function staticRuntimeDependencies(entry) {
  const seen = new Set();
  const visit = file => {
    file = path.resolve(file); if (seen.has(file)) return; seen.add(file);
    for (const { specifier, typeOnly } of staticImports(readFileSync(file, 'utf8'))) {
      if (typeOnly || !specifier.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), specifier);
      const target = [base, `${base}.ts`, `${base}.mjs`, `${base}.js`].find(candidate => existsSync(candidate));
      if (target) visit(target);
    }
  }; visit(entry); return [...seen].map(file => path.relative(process.cwd(), file));
}

test('the current bridge runtime graph excludes evaluator, scoring, legacy accounting and oracle loaders', () => {
  const graph = staticRuntimeDependencies('web/services/credential-bridge.ts');
  assert.ok(graph.includes('benchmarks/consumer/credential-metrics.ts'));
  assert.ok(graph.includes('benchmarks/shared/statistical-primitives.ts'));
  assert.deepEqual(graph.filter(file => /benchmarks\/(evaluation\/domains\/credential|scoring|accounting)\/|benchmarks\/types\.ts$|web\/services\/(catalog|run)\.ts$/.test(file)), []);
  for (const entry of staticImports(readFileSync('web/services/credential-source.ts', 'utf8'))) {
    if (!entry.dynamic && ['./catalog', './run'].includes(entry.specifier)) assert.equal(entry.typeOnly, true);
  }
  assert.deepEqual(staticImports("import type { Row } from './types';\nimport { type Shape, value } from './runtime';\nimport './effect';\nexport type { DTO } from './types';\nimport('./lazy')").filter(entry => !entry.typeOnly).map(entry => entry.specifier).sort(), ['./effect', './lazy', './runtime']);
  assert.match(readFileSync('web/services/credential-source.ts', 'utf8'), /async function legacySource\(\)[\s\S]*?import\('\.\/catalog'\)[\s\S]*?import\('\.\/run'\)/);
});
