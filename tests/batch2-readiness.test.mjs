import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const assignment = read('benchmarks/batch2/families.json');
const readiness = read('evidence/739/readiness.json');
const ledger = read('evidence/739/ledger.json');

test('assignment is exactly 58 unique families in groups 23/13/12/4/3/3', () => {
  const names = assignment.families.map((f) => f.family);
  assert.equal(names.length, 58);
  assert.equal(new Set(names).size, 58);
  const sizes = Object.fromEntries(Object.keys(assignment.groups).map((g) => [g, assignment.families.filter((f) => f.group === g).length]));
  assert.deepEqual(sizes, { G1: 23, G2: 13, G3: 12, G4: 4, G5: 3, G6: 3 });
});

test('readiness inventory and ledger cover every assigned family exactly once', () => {
  const names = assignment.families.map((f) => f.family).sort();
  assert.deepEqual(readiness.families.map((f) => f.family).sort(), names);
  assert.deepEqual(ledger.families.map((f) => f.family).sort(), names);
  const c = readiness.counts.total;
  assert.equal(c.ready + c['carrier-unresolved'], 58);
});

test('status is evidence\'s', () => {
  for (const r of readiness.families) assert.ok(['ready', 'carrier-unresolved'].includes(r.status));
});

test('unresolved rows are never measured; measured rows are exactly the ready ones', () => {
  for (const l of ledger.families) {
    const r = readiness.families.find((f) => f.family === l.family);
    if (r.status === 'carrier-unresolved') {
      assert.equal(l.coverage, 'not-measured, carrier-unresolved');
      assert.equal(l.findings, null);
      assert.deepEqual(l.caseIds, []);
    } else {
      assert.ok(l.caseIds.length > 0);
    }
  }
});
