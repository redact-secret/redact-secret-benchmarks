// The IP port-suffix rule (#451): the span is the address only, and net-p-port-suffix is scored under it from the frozen #428 observation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decisionStatus } from '../scripts/lib/decision-provenance.mjs';
import { buildScoring } from '../scripts/score-pii-port-suffix.mjs';

const root = new URL('../', import.meta.url);
const lane = (selection, findings) => ({ lane: 'synthetic', selection, cases: [{ id: 'net-p-port-suffix', family: findings }] });
const observation = lanes => ({ candidate: { sourceCommit: 'a'.repeat(40), families: [{ family: 'pii:global:network-address', lanes }] },
  baseline: { version: 'synthetic', families: [{ family: 'pii:global:network-address', lanes }] }, freeze: { freezeCommitment: 'b'.repeat(64) } });

test('authored address truth stops before the port and scores exact and off selections independently', () => {
  const record = buildScoring(observation([lane('on', [[4, 13, 'redact']]), lane('off', [])]));
  assert.deepEqual(record.truth.candidate, { start: 4, end: 13 });
  assert.equal(record.truth.candidate.end, record.truth.portBytes.start);
  assert.equal(record.summary.exact, 2);
  assert.equal(record.summary.offSelectionFindings, 0);
});

test('port inclusion, partial span, absent finding, extra finding and disabled finding remain distinct', () => {
  for (const [findings, verdict] of [
    [[[4, 18, 'redact']], 'span-includes-port'], [[[4, 12, 'redact']], 'span-mismatch'],
    [[], 'missed'], [[[4, 13, 'redact'], [14, 18, 'redact']], 'extra-findings'],
  ]) assert.equal(buildScoring(observation([lane('on', findings)])).candidate[0].verdict, verdict);
  assert.equal(buildScoring(observation([lane('off', [[4, 13, 'redact']])])).summary.offSelectionFindings, 2);
});

test('the rule is named in the spec, reviewed decision provenance and parity script', () => {
  const adr = 'docs/decisions/2026-09-28-score-the-ip-port-suffix-outside-the-network-address-span.md';
  assert.match(readFileSync(new URL('docs/specs/pii-populations.md', root), 'utf8'), /## Network-address port suffix/);
  assert.equal(decisionStatus(adr), 'accepted');
  assert.match(readFileSync(new URL('scripts/measure-pii-mixed-parity.mjs', root), 'utf8'), /Address with a port \(#451\)/);
  assert.match(readFileSync(new URL('docs/specs/pii-populations.md', root), 'utf8'), /port/);
});
