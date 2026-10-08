import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { utf8Range, normalizeFindings, peerApi, observePopulation, PEER_CAPABILITIES } from '../scripts/pii-peer-observations.mjs';

test('exclusive UTF16 ranges become exact UTF8 character boundaries', () => {
  const text = '😀한\r\na@example.org';
  assert.deepEqual(utf8Range(text, 5, text.length), { start: 9, end: 22 });
  assert.throws(() => utf8Range(text, 1, 2), /unicode/);
  assert.throws(() => utf8Range('a\uD800b', 0, 1), /unicode/);
  assert.throws(() => utf8Range(text, 2, 2), /invalid/);
});

test('pinned engine retains undeclared missing families as misses; unsupported is withheld', { skip: !process.env.PII_PEER_CAPABILITY_FIXTURE }, () => {
  const fixture = process.env.PII_PEER_CAPABILITY_FIXTURE, temp = mkdtempSync(join(tmpdir(), 'pii-peer-capability-'));
  try {
    const snapshot = JSON.parse(readFileSync(join(fixture, 'snapshot.json'))), manifest = JSON.parse(readFileSync(join(fixture, 'manifest.json'))), base = JSON.parse(readFileSync(join(fixture, 'observation.json')));
    for (const doc of [snapshot, manifest]) writeFileSync(join(temp, `${doc === snapshot ? 'snapshot' : 'manifest'}.json`), JSON.stringify(doc));
    for (const state of ['undeclared', 'unsupported']) {
      const observation = structuredClone(base);
      observation.semantic.inputs.forEach(row => { row.findings = []; });
      observation.semantic.capabilities.familyClassification = state === 'unsupported' ? 'unsupported' : 'supported';
      observation.semantic.capabilities.families = [];
      observation.semanticDigest = semanticDigest(observation);
      const file = join(temp, `${state}.json`); writeFileSync(file, JSON.stringify(observation));
      const result = spawnSync(process.env.PII_PEER_ENGINE, ['replay', '--snapshot', join(temp, 'snapshot.json'), '--manifest', join(temp, 'manifest.json'), '--observation', file, '--out', join(temp, state)], { encoding: 'utf8', timeout: 30000 });
      assert.equal(result.status, 0, 'pinned engine must accept synthetic empty observations');
      const run = JSON.parse(readFileSync(join(temp, state, 'run-artifact.json'))), expected = new Set(snapshot.semantic.cases.filter(c => c.variants[0].expectations[0].typeExpectation === 'valid').map(c => c.caseId));
      const rows = run.semantic.outcomes.filter(row => expected.has(row.caseId));
      assert.ok(rows.length > 0);
      assert.ok(rows.every(row => row.typeIdentity === (state === 'unsupported' ? 'not-measured' : 'miss')));
      assert.ok(run.semantic.outcomes.every(row => row.sensitivityContext === 'not-measured' && row.action.state === 'not-measured'));
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
test('mapped findings retain actual spans and omit sensitivity/action/value', () => {
  assert.deepEqual(normalizeFindings('flare-redact', 'a [at] b.org', [{ detector: 'obfuscated_email', start: 0, end: 12, value: 'raw', risk: 'high' }]).findings, [{ family: 'pii:global:email', range: { start: 0, end: 12 } }]);
  const row = normalizeFindings('openredaction', 'SSN: 123-45-6789', [{ type: 'SSN', position: [5, 16], value: 'raw', severity: 'critical' }, { type: 'PHONE_LINE_NUMBER', position: [0, 3] }]);
  assert.deepEqual(row.findings, [{ family: 'pii:us:ssn', jurisdiction: 'US', range: { start: 5, end: 16 } }]);
  assert.deepEqual({ ...row.unmapped }, { PHONE_LINE_NUMBER: 1 });
  assert.deepEqual(PEER_CAPABILITIES.families, []);
  assert.equal(PEER_CAPABILITIES.sensitivityClassification, 'unsupported');
  assert.throws(() => normalizeFindings('constructor', 'x', []), /invalid/);
  const rejectedLabels = normalizeFindings('openredaction', 'x', [{ type: '__proto__' }, { type: 'constructor' }, { type: 'raw text not a public type' }]);
  assert.equal(rejectedLabels.findings.length, 0);
  assert.deepEqual({ ...rejectedLabels.unmapped }, { 'unscoped-label': 2, constructor: 1 });
});
test('two actual executions must agree without changing missing expectations', async () => {
  const bucket = { cases: [{ id: 'email-test', text: 'a@example.org' }, { id: 'ssn-test', text: '123-45-6789' }] };
  const observed = await observePopulation('flare-redact', bucket, () => []);
  assert.equal(observed.inputs.length, 2);
  assert.ok(observed.inputs.every(row => row.findings.length === 0));
  let n = 0;
  await assert.rejects(() => observePopulation('flare-redact', bucket, () => ++n < 3 ? [] : [{ detector: 'email', start: 0, end: 1 }]), /disagree/);
});
test('installed pinned peer APIs report end-exclusive offsets after astral/CRLF prefix', async () => {
  const text = '😀한\r\nContact: somebody@acme-corporation.net for assistance';
  for (const peer of ['flare-redact', 'openredaction']) {
    const findings = normalizeFindings(peer, text, await peerApi(peer)(text)).findings;
    const email = findings.find(row => row.family === 'pii:global:email');
    assert.ok(email, peer);
    assert.equal(Buffer.from(text).subarray(email.range.start, email.range.end).toString(), 'somebody@acme-corporation.net');
  }
});
