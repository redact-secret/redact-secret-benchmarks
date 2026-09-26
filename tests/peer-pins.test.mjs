import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { assertPinnedPeers, peerVersionProblems } from '../scanners/pins.mjs';

const suite = { scanners: { 'redact-secret': '0.1.0-beta.4', gitleaks: '8.30.1', trufflehog: '3.97.4' } };
const peer = (id, version) => ({ id, version: typeof version === 'function' ? version : async () => version });
const matching = () => [peer('redact-secret', '9.9.9'), peer('gitleaks', '8.30.1'), peer('trufflehog', '3.97.4')];

test('matching peer versions pass, and the product scanner is not a peer', async () => {
  assert.deepEqual(await peerVersionProblems(matching(), suite, '.'), []);
  await assert.doesNotReject(assertPinnedPeers(matching(), suite, '.'));
});

test('a mismatched peer fails naming scanner, expected, observed, suite file and remediation', async () => {
  const scanners = [peer('gitleaks', '8.30.1'), peer('trufflehog', '3.97.6')];
  const [problem, ...rest] = await peerVersionProblems(scanners, suite, '.');
  assert.equal(rest.length, 0);
  for (const part of ['trufflehog', '3.97.4', '3.97.6', 'qualification/suite-v1.json', 'read-only directory', 'PATH']) assert.match(problem, new RegExp(part.replace('.', '\\.')));
  await assert.rejects(assertPinnedPeers(scanners, suite, '.'), /trufflehog.*3\.97\.4.*3\.97\.6/s);
});

test('every mismatched peer is reported, not only the first', async () => {
  const problems = await peerVersionProblems([peer('gitleaks', '8.31.0'), peer('trufflehog', '3.97.6')], suite, '.');
  assert.equal(problems.length, 2);
});

test('an unavailable peer fails closed', async () => {
  const gone = peer('trufflehog', async () => { throw new Error('unavailable'); });
  const [problem] = await peerVersionProblems([gone], suite, '.');
  assert.match(problem, /trufflehog is not installed or not on PATH; .*pins 3\.97\.4/);
});

test('a peer that fails to run fails closed', async () => {
  const broken = peer('gitleaks', async () => { throw new Error('Scanner process failed or timed out; raw output suppressed.'); });
  const [problem] = await peerVersionProblems([broken], suite, '.');
  assert.match(problem, /gitleaks failed to report a version/);
});

test('malformed version output fails closed', async () => {
  const [problem] = await peerVersionProblems([peer('trufflehog', 'unknown')], suite, '.');
  assert.match(problem, /trufflehog reported a version that could not be parsed/);
});

test('peers outside the suite are ignored', async () => {
  assert.deepEqual(await peerVersionProblems([peer('other', '0.0.1')], suite, '.'), []);
});

test('ordinary queue:check consumes validated snapshots and never executes a peer found on PATH', async () => {
  const bin = await mkdtemp(path.join(tmpdir(), 'peer-pins-'));
  try {
    const fake = path.join(bin, 'trufflehog');
    await writeFile(fake, '#!/bin/sh\necho "trufflehog 3.97.9"\n', { mode: 0o755 });
    const result = await promisify(execFile)('node', ['--import', 'tsx', 'scripts/check-review-queue-coverage.mjs'],
      { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
    assert.match(result.stdout, /coverage gate passed/);
    assert.doesNotMatch(result.stderr, /3\.97\.9|qualification\/suite-v1\.json/);
  } finally { await rm(bin, { recursive: true, force: true }); }
});
