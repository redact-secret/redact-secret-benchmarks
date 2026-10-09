import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evidenceRetirementProblems } from '../scripts/check-repository-hygiene.mjs';

const retirement = JSON.parse(readFileSync(new URL('../docs/retention/evidence-retirement-879.json', import.meta.url)));
const files = retirement.canonicalInputs.map(row => ({ path: row.path, size: row.bytes, sha256: row.sha256 }));
test('reviewed current inputs pass with the exact original archive scope', () => {
  assert.deepEqual(evidenceRetirementProblems({ files, retirement }), []);
});
test('history cannot accumulate again under evidence or canonical input directories', () => {
  for (const path of ['evidence/123/report.json', 'benchmarks/inputs/pii/old-report.json', 'benchmarks/inputs/runtime/round2.json'])
    assert.ok(evidenceRetirementProblems({ files: [...files, { path, size: 2, sha256: 'a'.repeat(64) }], retirement }).length, path);
});
test('changed measurements, missing current inputs and narrowed original scope fail', () => {
  const altered = structuredClone(files); altered[0].sha256 = 'a'.repeat(64);
  assert.match(evidenceRetirementProblems({ files: altered, retirement }).join(' '), /drifted canonical input/);
  assert.match(evidenceRetirementProblems({ files: files.slice(1), retirement }).join(' '), /current input missing/);
  const alteredScope = structuredClone(retirement); alteredScope.files.pop();
  assert.match(evidenceRetirementProblems({ files, retirement: alteredScope }).join(' '), /original source\/archive scope/);
});
