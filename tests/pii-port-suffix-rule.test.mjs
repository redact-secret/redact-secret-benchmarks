// The IP port-suffix rule (#451): the span is the address only, and net-p-port-suffix is scored under it from the frozen #428 observation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { render } from '../scripts/score-pii-port-suffix.mjs';

const root = new URL('../', import.meta.url);
const recordPath = 'evidence/901/451/pii-network-port-suffix-scoring-v1.json';
const record = JSON.parse(readFileSync(new URL(recordPath, root), 'utf8'));

test('the committed scoring record regenerates byte for byte from the frozen observation', () => {
  assert.equal(readFileSync(new URL(recordPath, root), 'utf8'), render());
});

test('net-p-port-suffix is scored: the span is the address and stops before the port', () => {
  assert.equal(record.truth.candidate.end, record.truth.portBytes.start);
  assert.deepEqual(record.truth.candidate, { start: 4, end: 13 });
  assert.equal(record.summary.scoredCells, 12);
  assert.equal(record.summary.exact, 12);
  assert.equal(record.summary.offSelectionFindings, 0);
});

test('the rule is named in the spec, the ADR index and the parity script', () => {
  const adr = 'docs/decisions/2026-09-28-score-the-ip-port-suffix-outside-the-network-address-span.md';
  assert.match(readFileSync(new URL('docs/specs/pii-populations.md', root), 'utf8'), /## Network-address port suffix/);
  assert.match(readFileSync(new URL('docs/decisions/DECISIONS.md', root), 'utf8'), /2026-09-28-score-the-ip-port-suffix/);
  assert.match(readFileSync(new URL('scripts/measure-pii-mixed-parity.mjs', root), 'utf8'), /Address with a port \(#451\)/);
  assert.ok(readFileSync(new URL(adr, root), 'utf8').includes('span-includes-port'));
});
