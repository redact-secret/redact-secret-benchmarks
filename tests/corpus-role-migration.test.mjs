import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { scoreCase } from '../benchmarks/harness/credential-carriers/score-multispan.mjs';
const receipt = JSON.parse(readFileSync(new URL('../benchmarks/corpora/semantic-migration.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
for (const row of receipt.corpora) test(`${row.path} preserves original inputs, IDs, expectations and scorer semantics`, async () => {
  const { cases } = await import(new URL('../' + row.path, import.meta.url));
  assert.equal(cases.length, row.count);
  assert.equal(digest(cases), row.digest);
  const scores = cases.flatMap(c => [[], [{ start: 0, end: 1, type: 'other', action: 'warn' }], [c.expected, ...(c.expectedExtra ?? [])].filter(Boolean).map(x => ({ ...x, type: c.expectedType, action: c.expectedAction })), [c.expected].filter(Boolean).map(x => ({ ...x, start: x.start - 1, type: 'other', action: 'warn' }))].map(findings => scoreCase(c, { findings })));
  assert.equal(digest(scores), row.scorerDigest);
});
