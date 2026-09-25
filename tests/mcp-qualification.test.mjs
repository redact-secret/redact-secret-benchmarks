import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  adapterPinProblems, assertNoPlaintext, contentDigest, fragments, installedDigest, needles, scanRecordDir, scanText,
  summarizeCell, tarballDigest, tarballName, verdict,
} from '../benchmarks/lib/mcp-qualification.ts';
import { metricsFromAdapterOverhead } from '../benchmarks/lib/regression-budgets.ts';
import * as W from '../benchmarks/mcp-qualification/consumer/workloads.mjs';

const FILES = { 'package/package.json': '{"name":"x"}\n', 'package/dist/index.js': 'export const a = 1;\n', 'package/README.md': '# x\n' };
// Computed by redact-secret's scripts/adapter-pins.py digest_entries over FILES (core 5213be1).
const PYTHON_REFERENCE_DIGEST = 'sha256:9bf154e730cec687714838578410049704078970de33bb67c0fae97f28147edb';

function withTarball(action) {
  const dir = mkdtempSync(path.join(tmpdir(), '281-test-'));
  try {
    for (const [name, text] of Object.entries(FILES)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), text);
    }
    const tarball = path.join(dir, 'x-1.0.0.tgz');
    execFileSync('tar', ['-czf', tarball, '-C', dir, 'package'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
    return action(dir, tarball);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the content digest is the one core adapter-pins pins, over a tarball and over its installed directory', () => {
  assert.equal(contentDigest(Object.entries(FILES).map(([name, text]) => ({ name, data: Buffer.from(text) }))), PYTHON_REFERENCE_DIGEST);
  withTarball((dir, tarball) => {
    assert.equal(tarballDigest(tarball), PYTHON_REFERENCE_DIGEST);
    assert.equal(installedDigest(path.join(dir, 'package')), PYTHON_REFERENCE_DIGEST);
  });
});

test('a tarball that does not match its pin is refused', () => {
  withTarball((dir, tarball) => {
    const pin = (digest) => ({ schemaVersion: 1, repository: 'redact-secret/redact-secret-adapters', commit: 'a'.repeat(40), packages: [{ name: '@x/x', version: '1.0.0', contentDigest: digest }] });
    execFileSync('cp', [tarball, path.join(dir, tarballName('@x/x', '1.0.0'))]);
    assert.deepEqual(adapterPinProblems(pin(PYTHON_REFERENCE_DIGEST), dir), []);
    assert.equal(adapterPinProblems(pin(`sha256:${'0'.repeat(64)}`), dir).length, 1);
    assert.match(adapterPinProblems({ ...pin(PYTHON_REFERENCE_DIGEST), commit: 'main' }, dir)[0], /40-hex/);
  });
});

test('fragments identify a value without matching low-variety runs', () => {
  const secret = W.SECRETS.github;
  const list = fragments(secret);
  assert.ok(list.length > 0);
  assert.ok(list.every(f => f.length === 12 && new Set(f).size >= 4));
  assert.ok(!list.includes('0'.repeat(12)));
  const n = needles([secret]);
  assert.deepEqual(scanText(`x ${secret} y`, n), { full: true, fragment: true });
  assert.deepEqual(scanText(`x ${secret.slice(0, 16)} y`, n), { full: false, fragment: true });
  assert.deepEqual(scanText(`id ${'0'.repeat(40)} <SECRET_1>`, n), { full: false, fragment: false });
});

test('the workload corpus is synthetic, uniquely named, and carries no credential-shaped literal', () => {
  const source = readFileSync('benchmarks/mcp-qualification/consumer/workloads.mjs', 'utf8');
  for (const secret of W.allSecrets()) assert.ok(!source.includes(secret), 'a synthetic value is built at run time, never written literally');
  assert.equal(new Set(W.ALL_CASE_IDS).size, W.ALL_CASE_IDS.length);
  for (const c of [...W.RESULT_CASES, ...W.TOOL_CASES, ...W.STREAM_CASES, ...W.POLICY_CASES]) {
    assert.ok(typeof c.expect?.outcome === 'string', c.id);
    assert.ok(/^[a-z0-9-]+$/.test(c.id), c.id);
  }
  const exclusions = new Set([...W.RESULT_CASES, ...W.TOOL_CASES].filter(c => c.exclusion).map(c => c.exclusion));
  assert.deepEqual([...exclusions].sort(), ['split-across-blocks', 'split-across-calls', 'split-across-fields']);
  // The benign look-alikes never carry a fragment of a synthetic value.
  const benign = JSON.stringify(W.benignStructured(900)) + W.benignLogText(60000);
  assert.equal(scanText(benign, needles(W.allSecrets())).fragment, false);
  // The fixed results are the contract's exact text.
  assert.match(W.FIXED.blocked, /^This MCP tool call was blocked by secret-redaction policy\./);
});

test('every partition of the streamed text reassembles it', () => {
  const text = W.STREAM_TEXT();
  const parts = W.partitions(text);
  assert.ok(parts.length > text.length);
  for (const chunks of parts) assert.equal(chunks.join(''), text);
});

function recordDir(files) {
  const dir = mkdtempSync(path.join(tmpdir(), '281-records-'));
  for (const [name, lines] of Object.entries(files)) writeFileSync(path.join(dir, name), lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  return dir;
}

test('the sink scan attributes plaintext per case and sink, and verdicts separate leaks, exclusions, policy and controls', () => {
  const secret = W.SECRETS.aws;
  const dir = recordDir({
    'model-context.jsonl': [{ case: 'leaky', value: [{ content: `k=${secret}` }] }, { case: 'clean', value: [{ content: 'k=<SECRET_1>' }] }, { case: 'excluded', value: secret.slice(0, 13) }],
    'host-log.jsonl': [{ case: 'policy', value: `k=${secret}` }],
    'store.jsonl': [], 'audit.jsonl': [], 'error-text.jsonl': [],
    'wire.jsonl': [{ tool: 'wrapped-result', message: { result: { content: [{ type: 'text', text: '<SECRET_1>' }] } } }, { tool: 'result:x', message: { result: secret } }],
    'received.jsonl': [{ tool: 'wrapped-args', args: { q: '<SECRET_1>' } }],
  });
  try {
    const scan = scanRecordDir(dir, [secret]);
    assert.equal(scan.byCase.leaky['model-context'].full, true);
    assert.equal(scan.byCase.clean['model-context'].fragment, false);
    assert.equal(scan.wire['wrapped-result'].fragment, false);
    assert.equal(scan.wire['result:x'].full, true);
    const row = (id, extra = {}) => ({ id, area: 'text', expect: { outcome: 'ok' }, observed: { outcome: 'ok' }, delivered: true, deliveredFixed: null, ...extra });
    assert.equal(verdict(row('leaky'), undefined, scan).containment, 'leak');
    assert.equal(verdict(row('leaky'), undefined, scan).conforms, false);
    assert.equal(verdict(row('clean'), undefined, scan).containment, 'contained');
    assert.equal(verdict(row('excluded', { exclusion: 'split-across-blocks' }), undefined, scan).containment, 'known-false-negative');
    assert.equal(verdict(row('policy', { policyDelivers: true }), undefined, scan).containment, 'delivered-by-policy');
    // A raw wire message from an unwrapped tool is not scored; a wrapped tool's is.
    assert.deepEqual(verdict(row('wrapped'), { id: 'wrapped', wire: true, tool: 'wrapped-result' }, scan).sinks, []);
    assert.deepEqual(verdict(row('raw'), { id: 'raw', wire: true, tool: 'result:x' }, scan).sinks, ['server-wire']);
    // Outcome mismatches and lifecycle failures are deviations, not leaks.
    const blockedAsOk = verdict({ ...row('clean'), expect: { outcome: 'blocked', reason: 'policy' } }, undefined, scan);
    assert.equal(blockedAsOk.containment, 'contained');
    assert.equal(blockedAsOk.checks.find(c => c.name === 'outcome').passed, false);
    const stream = verdict({ ...row('clean'), expect: { outcome: 'blocked' }, observed: { outcome: 'blocked', reason: 'policy' }, deliveredFixed: 'blocked', producer: { chunks: 10, pulled: 10, closed: 0 } }, undefined, scan);
    assert.deepEqual(stream.checks.filter(c => !c.passed).map(c => c.name), ['stopped-pulling-early', 'producer-closed']);
    const aborted = verdict({ ...row('clean'), expect: { outcome: 'aborted' }, observed: { outcome: 'aborted' }, delivered: true }, undefined, scan);
    assert.equal(aborted.checks.find(c => c.name === 'nothing-delivered').passed, false);
    // The negative control must be flagged in all five host sinks.
    const control = verdict({ id: 'leaky', area: 'control', control: true, expect: { outcome: 'unprotected' }, observed: { outcome: 'unprotected' } }, undefined, scan);
    assert.equal(control.containment, 'control-missed');
    const summary = summarizeCell([verdict(row('leaky'), undefined, scan), verdict(row('excluded', { exclusion: 'split-across-blocks' }), undefined, scan), control]);
    assert.deepEqual(summary, { cases: 3, controlsDetected: 0, leaks: 1, knownFalseNegatives: 1, deliveredByPolicy: 0, deviations: 1 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a report carrying a synthetic value or fragment is refused', () => {
  assert.throws(() => assertNoPlaintext(JSON.stringify({ x: W.SECRETS.github.slice(2, 20) }), W.allSecrets()), /refusing/);
  assert.doesNotThrow(() => assertNoPlaintext(JSON.stringify({ x: '<SECRET_1>', fixed: W.FIXED.toolError }), W.allSecrets()));
});

test('the MCP overhead rows feed the #143 adapter-overhead dimension under their own language', () => {
  const output = (host, traversal) => ({
    schema: 'redact-secret-benchmarks/mcp-overhead-v1', language: 'mcp-javascript', workloads: { digest: 'd' },
    environment: { platform: 'darwin', arch: 'arm64', cpuModel: 'M', runtime: 'node-22.16.0' }, method: { quick: false, repetitions: 15 },
    results: [
      { host, profileId: 'mcp-text-small', scannerCallsPerEvent: 7, scannedCodeUnitsPerEvent: 120, derived: { traversal, coreScan: 100, adapterOverhead: 110 } },
      { host: 'mcp-in-process', profileId: 'mcp-text-small', scannerCallsPerEvent: 7, scannedCodeUnitsPerEvent: 120, derived: { traversal: 4, coreScan: 100, adapterOverhead: 104 } },
    ],
  });
  const { metrics, profiles } = metricsFromAdapterOverhead([output('mcp-sdk-1.13.0-stdio', 8), output('mcp-sdk-1.30.1-stdio', 6)]);
  assert.equal(profiles['mcp-javascript'], 'darwin-arm64|M|node-22');
  const ids = metrics.map(m => m.id);
  // A row only one process measured is kept, with that process's samples only.
  assert.ok(ids.includes('adapter/mcp-sdk-1.13.0-stdio/mcp-text-small/traversal'));
  assert.ok(ids.includes('adapter/mcp-sdk-1.30.1-stdio/mcp-text-small/traversal'));
  assert.equal(metrics.find(m => m.id === 'adapter/mcp-sdk-1.30.1-stdio/mcp-text-small/traversal').samples, 15);
  assert.equal(metrics.find(m => m.id === 'adapter/mcp-in-process/mcp-text-small/traversal').samples, 30);
  assert.throws(() => metricsFromAdapterOverhead([{ ...output('h', 1), schema: 'other' }]), /adapter-overhead-schema/);
});

test('the committed #281 evidence is a complete, clean, schema-valid run with no plaintext and a flagged control in every cell', async () => {
  const { default: Ajv } = await import('ajv');
  const schema = JSON.parse(readFileSync('schemas/mcp-qualification-v1.json', 'utf8'));
  const text = readFileSync('evidence/612/mcp-qualification.json', 'utf8');
  const report = JSON.parse(text);
  const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
  assert.ok(validate(report), JSON.stringify(validate.errors?.slice(0, 3)));
  assert.equal(report.status, 'complete');
  assert.equal(report.quick, false);
  assert.equal(report.benchmark.dirty, false);
  assert.equal(report.matrix.length, 24);
  for (const cell of report.matrix) {
    assert.equal(cell.status, 'complete');
    assert.equal(cell.summary.controlsDetected, 1, `${cell.node} ${cell.transport}`);
  }
  for (const file of ['mcp-qualification.json', 'mcp-qualification.md', 'mcp-overhead-series.json', 'README.md']) {
    assert.doesNotThrow(() => assertNoPlaintext(readFileSync(path.join('evidence/612', file), 'utf8'), W.allSecrets()), file);
  }
  const series = JSON.parse(readFileSync('evidence/612/mcp-overhead-series.json', 'utf8'));
  assert.deepEqual(series, report.operational.overhead.series);
  const { metrics, profiles } = metricsFromAdapterOverhead(series.outputs);
  assert.ok(profiles['mcp-javascript']);
  assert.ok(metrics.some(m => m.id === 'adapter/mcp-in-process/mcp-large-benign/traversal'));
});
