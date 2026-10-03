import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import record from '../benchmarks/pii-eval-migration.json' with { type: 'json' };

test('PII migration pins the four product populations separately and changes no authority', async () => {
  assert.equal(record.authorityChanged, false);
  assert.deepEqual(record.benchmarkPopulations.views.map(row => row.id),
    ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress']);
  assert.equal(new Set(record.benchmarkPopulations.plans.map(row => row.family)).size, 6);
  assert.equal(record.upstreamParity.compatibilityDifferences, 0);
  assert.equal(record.upstreamParity.canonicalClassifications.unexplained, 0);
  assert.equal(record.acceptance.benchmarkPopulationDualRun, 'blocked-schema-1.2');
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/check-pii-eval-migration.mjs']);
  assert.match(stdout, /consistent/);
});
