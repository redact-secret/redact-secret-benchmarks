import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retainedPiiPopulationReportProblems } from '../scripts/lib/retained-pii-population-report.mjs';
const root = new URL('../', import.meta.url);
const receipt = JSON.parse(readFileSync(new URL('benchmarks/inputs/pii-population-report-receipt.json', root), 'utf8'));
const bytes = readFileSync(new URL(receipt.record, root), 'utf8');
test('accepted report is bound to exact machine bytes and freshly rendered historical output', () => {
  assert.deepEqual(retainedPiiPopulationReportProblems(receipt, bytes), []);
});
test('rewriting old machine evidence or silently changing the historical report is refused', () => {
  assert.ok(retainedPiiPopulationReportProblems(receipt, bytes + ' ').some(p => p.includes('different machine-record')));
  assert.ok(retainedPiiPopulationReportProblems({ ...receipt, markdownSha256: 'f'.repeat(64) }, bytes).some(p => p.includes('renderer differs')));
  assert.ok(retainedPiiPopulationReportProblems({ ...receipt, schema: 'invented' }, bytes).length);
});
