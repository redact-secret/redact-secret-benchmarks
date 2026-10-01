import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFile = promisify(execFileCallback);
const root = path.resolve(import.meta.dirname, '..');
const FROZEN = 'docs/specs/qualification/engine-v1.json';
const SNAPSHOT = 'evidence/449/suite-v1.json';
const run = (...args) => execFile(process.execPath, ['--import', 'tsx', 'benchmarks/validate-evidence.ts', ...args], { cwd: root, timeout: 60_000 })
  .then(({ stdout }) => ({ code: 0, stdout }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));

test('the frozen qualification report validates against the suite snapshot it was produced with', async () => {
  const result = await run(FROZEN, `--suite=${SNAPSHOT}`);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /checks passed/);
});

test('without --suite the live suite decides, and the frozen report no longer matches it', async () => {
  const live = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const snapshot = JSON.parse(await readFile(path.join(root, SNAPSHOT), 'utf8'));
  assert.notDeepEqual(live, snapshot, 'the live suite has moved past the Beta.11 snapshot');
  const result = await run(FROZEN);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Invalid or incomplete evidence/);
});

test('a stale suite passed via --suite is rejected for a report with another suiteHash', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'validate-evidence-'));
  try {
    const snapshot = JSON.parse(await readFile(path.join(root, SNAPSHOT), 'utf8'));
    const stale = path.join(directory, 'stale-suite.json');
    await writeFile(stale, JSON.stringify({ ...snapshot, scanners: { ...snapshot.scanners, 'redact-secret': '0.0.0-stale' } }));
    assert.equal((await run(FROZEN, `--suite=${stale}`)).code, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('argument handling stays strict: the report path plus at most one --suite flag', async () => {
  assert.equal((await run()).code, 1);
  assert.equal((await run(FROZEN, SNAPSHOT)).code, 1);
  assert.equal((await run(FROZEN, '--suite=')).code, 1);
  assert.equal((await run(FROZEN, '--other=x')).code, 1);
  assert.equal((await run(FROZEN, `--suite=${SNAPSHOT}`, `--suite=${SNAPSHOT}`)).code, 1);
});
