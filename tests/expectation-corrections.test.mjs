import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = 'docs/generated/evidence-adoption';
const triage = `${dir}/product-core-main-1e45cecf/triage.json`;
const committed = JSON.parse(readFileSync(`${dir}/snapshot-2026.10.04.3.expectation-corrections.json`, 'utf8'));

test('the expectation-correction queue lists the eight cases the product proposes to the evidence owners, and edits nothing', () => {
  assert.equal(committed.corrections.length, 8);
  assert.deepEqual(committed.corrections.map(c => c.case), [...committed.corrections.map(c => c.case)].sort());
  for (const c of committed.corrections) assert.ok(c.proposedChange && c.productDisposition && c.evidence.length, c.case);
  assert.equal(committed.postReleaseReplays.length, 4);
  assert.ok(committed.postReleaseReplays.every(id => !committed.corrections.some(c => c.case === id)), 'a product fix is not an evidence correction');
  assert.match(committed.note, /not an edit/);
  assert.equal(committed.disclosure.independentlyReviewed, 0);
});

test('the committed queue is what the exporter derives from the committed triage (not stale)', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'expectation-corrections-'));
  try {
    const out = path.join(scratch, 'q.json');
    execFileSync('node', ['--import', 'tsx', 'scripts/export-expectation-corrections.ts', '--triage', triage, '--out-json', out], { stdio: 'ignore' });
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), committed);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
