import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { validateEvidence } from '../benchmarks/engine/evidence.ts';
import { candidateConfiguration, installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';

const exec = promisify(execFile);
const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);
const hashFile = async file => createHash('sha256').update(await readFile(file)).digest('hex');

async function pack(directory) {
  const { stdout } = await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--json'], { cwd: directory });
  return path.join(directory, JSON.parse(stdout)[0].filename);
}

async function packages(mode = 'ok') {
  const root = await mkdtemp(path.join(tmpdir(), 'candidate packages with spaces '));
  const nodeName = '@redact-secret/node-test';
  const core = path.join(root, 'core'), node = path.join(root, 'node'), wasm = path.join(root, 'wasm');
  await Promise.all([mkdir(path.join(core, 'dist'), { recursive: true }), mkdir(node), mkdir(wasm)]);
  await writeFile(path.join(core, 'package.json'), JSON.stringify({ name: '@redact-secret/core', version: '9.8.7-candidate.1', type: 'module',
    exports: './dist/index.js', dependencies: { '@redact-secret/wasm': '9.8.7-candidate.1' }, optionalDependencies: { [nodeName]: '9.8.7-candidate.1' } }));
  const source = mode === 'init-failure'
    ? `export const VERSION='9.8.7-candidate.1'; export async function initialize(){throw Error('unsafe detail')} export function scan(){return []}`
    : mode === 'scan-failure'
      ? `export const VERSION='9.8.7-candidate.1'; export async function initialize(){} export function scan(){throw Error('unsafe fixture detail')}`
      : mode === 'ruleset-echo'
        ? `export const VERSION='9.8.7-candidate.1'; export async function initialize(){} export function scan(text, options){ return options && options.ruleset ? [{id:'finding-1', type:'ruleset-echo', detector:'ruleset-echo', confidence:'medium', obfuscation:'none', start:0, end:text.length}] : []; }`
        : `export const VERSION='9.8.7-candidate.1'; export async function initialize(){} export function scan(){return []}`;
  await writeFile(path.join(core, 'dist/index.js'), source);
  await writeFile(path.join(node, 'package.json'), JSON.stringify({ name: nodeName, version: '9.8.7-candidate.1' }));
  await writeFile(path.join(wasm, 'package.json'), JSON.stringify({ name: '@redact-secret/wasm', version: '9.8.7-candidate.1' }));
  return { root, core: await pack(core), node: await pack(node), wasm: await pack(wasm) };
}

function report() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, reportType: 'candidate', runId: randomUUID(), startedAt: now, finishedAt: now, status: 'complete', supportClaims: false,
    candidate: { sourceCommit: 'a'.repeat(40), sourceState: 'clean', packageName: '@redact-secret/core', declaredVersion: '1.0.0', artifactSha256: 'b'.repeat(64), expectedArtifactSha256: 'b'.repeat(64),
      artifacts: ['package', 'node', 'wasm'].map(role => ({ role, sha256: 'c'.repeat(64) })) },
    benchmark: { sourceCommit: 'd'.repeat(40), dirty: false, lockfileSha256: 'e'.repeat(64) },
    corpus: { protocol: 'measurement-v4', hash: 'f'.repeat(64), categories: [{ id: 'common-formats', sha256: '0'.repeat(64) }] },
    scanner: { id: 'redact-secret-candidate', configuration: candidateConfiguration, configurationHash: '1'.repeat(64) },
    runtime: { node: process.version, os: process.platform, arch: process.arch }, command: ['node', 'candidate'],
    selection: { scope: 'filtered-development', filter: 'openai-token' }, completeness: { selectedFixtures: 1, scannedFixtures: 1 }, failures: [],
    results: [{ fixtureId: 'common-formats--openai-token-legacy-plain', corpusSection: 'fixed-corpus', kind: 'must-redact', tier: 'T2', expectedSpans: 1, actualFindings: 1, outcome: 'EXACT', baseline: { version: '0.1.0-beta.4', outcome: 'EXACT' } }],
  };
}

test('candidate evidence rejects false completeness and artifact identity drift', () => {
  assert.doesNotThrow(() => validateEvidence(report(), 'candidate'));
  for (const mutate of [
    value => value.completeness.scannedFixtures = 0,
    value => value.failures.push({ phase: 'scan', code: 'scan-failed' }),
    value => value.candidate.expectedArtifactSha256 = '2'.repeat(64),
    value => value.selection.scope = 'full-suite',
    value => value.results[0].plaintext = 'forbidden',
  ]) {
    const value = report(); mutate(value);
    assert.throws(() => validateEvidence(value, 'candidate'));
  }
});

test('candidate packages install in isolation from paths with spaces and are cleaned', async () => {
  const artifacts = await packages();
  let installation;
  try {
    installation = await installCandidate(artifacts);
    assert.equal(installation.packageName, '@redact-secret/core');
    assert.equal(installation.declaredVersion, '9.8.7-candidate.1');
    assert.equal((await loadCandidate(installation)).version, installation.declaredVersion);
    const installedRoot = installation.root;
    await removeCandidate(installation); installation = undefined;
    await assert.rejects(access(installedRoot));
  } finally { await removeCandidate(installation); await rm(artifacts.root, { recursive: true, force: true }); }
});

test('initialization and scan failures remain explicit and sanitized', async () => {
  for (const mode of ['init-failure', 'scan-failure']) {
    const artifacts = await packages(mode); let installation;
    try {
      installation = await installCandidate(artifacts);
      if (mode === 'init-failure') await assert.rejects(loadCandidate(installation), /candidate-initialization-failed/);
      else {
        const scanner = await loadCandidate(installation);
        await assert.rejects(scanner.scan(installation.root, [{ path: 'missing', content: '' }]), /ENOENT/);
      }
    } finally { await removeCandidate(installation); await rm(artifacts.root, { recursive: true, force: true }); }
  }
});

test('loadCandidate forwards a supplied ruleset to every scan call', async () => {
  const artifacts = await packages('ruleset-echo');
  let installation;
  try {
    installation = await installCandidate(artifacts);
    const withoutRuleset = await loadCandidate(installation);
    assert.deepEqual(await withoutRuleset.scan(installation.root, []), []);
    const withRuleset = await loadCandidate(installation, Buffer.from('ruleset-revision: 1\nnames: ambiguous\nname: corp_token\n'));
    const scratch = await mkdtemp(path.join(tmpdir(), 'ruleset-echo-fixture-'));
    try {
      await writeFile(path.join(scratch, 'sample.txt'), 'hello');
      const findings = await withRuleset.scan(scratch, [{ path: 'sample.txt' }]);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].start, 0);
      assert.equal(findings[0].end, 5);
    } finally { await rm(scratch, { recursive: true, force: true }); }
  } finally { await removeCandidate(installation); await rm(artifacts.root, { recursive: true, force: true }); }
});

test('candidate CLI records filter provenance without mutating the lockfile', async () => {
  const artifacts = await packages();
  const output = path.join(artifacts.root, 'evidence output');
  const before = await hashFile(path.join(repositoryRoot, 'package-lock.json'));
  try {
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/candidate.ts',
      '--candidate-package', artifacts.core, '--candidate-node-package', artifacts.node, '--candidate-wasm-package', artifacts.wasm,
      '--candidate-source-commit', 'a'.repeat(40), '--product-state', 'clean', '--output-dir', output, '--filter', 'openai-token',
      '--expected-artifact-sha256', await hashFile(artifacts.core)], { cwd: repositoryRoot, timeout: 120_000 });
    const evidence = JSON.parse(await readFile(path.join(output, 'candidate-evidence-v1.json'), 'utf8'));
    assert.equal(evidence.status, 'complete');
    assert.equal(evidence.selection.filter, 'openai-token');
    assert.ok(evidence.results.length > 0);
    assert.ok(evidence.results.every(row => !('content' in row) && !('plaintext' in row)));
    assert.doesNotThrow(() => validateEvidence(evidence, 'candidate'));
    assert.equal(await hashFile(path.join(repositoryRoot, 'package-lock.json')), before);
  } finally { await rm(artifacts.root, { recursive: true, force: true }); }
});

test('candidate CLI evidence records ruleset identity and the run changes when one is loaded', async () => {
  const artifacts = await packages('ruleset-echo');
  const rulesetFile = path.join(artifacts.root, 'reference.ruleset');
  await writeFile(rulesetFile, 'ruleset-revision: 1\nnames: ambiguous\nname: corp_token\n');
  const withoutOutput = path.join(artifacts.root, 'evidence-without');
  const withOutput = path.join(artifacts.root, 'evidence-with');
  const cliArgs = ['--candidate-package', artifacts.core, '--candidate-node-package', artifacts.node, '--candidate-wasm-package', artifacts.wasm,
    '--candidate-source-commit', 'a'.repeat(40), '--product-state', 'clean', '--filter', 'openai-token',
    '--expected-artifact-sha256', await hashFile(artifacts.core)];
  try {
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/candidate.ts', ...cliArgs, '--output-dir', withoutOutput],
      { cwd: repositoryRoot, timeout: 120_000 });
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/candidate.ts', ...cliArgs, '--output-dir', withOutput, '--ruleset', rulesetFile],
      { cwd: repositoryRoot, timeout: 120_000 });
    const without = JSON.parse(await readFile(path.join(withoutOutput, 'candidate-evidence-v1.json'), 'utf8'));
    const withRuleset = JSON.parse(await readFile(path.join(withOutput, 'candidate-evidence-v1.json'), 'utf8'));
    assert.equal(without.scanner.configuration.ruleset, null);
    assert.deepEqual(withRuleset.scanner.configuration.ruleset, { sha256: await hashFile(rulesetFile), byteLength: (await readFile(rulesetFile)).byteLength });
    assert.ok(without.results.some(row => row.actualFindings === 0));
    assert.ok(withRuleset.results.every(row => row.actualFindings > 0));
    assert.doesNotThrow(() => validateEvidence(without, 'candidate'));
    assert.doesNotThrow(() => validateEvidence(withRuleset, 'candidate'));
  } finally { await rm(artifacts.root, { recursive: true, force: true }); }
});

test('published scanner and qualification pins remain unchanged', async () => {
  const scanner = await readFile(path.join(repositoryRoot, 'scanners/index.mjs'), 'utf8');
  const suite = JSON.parse(await readFile(path.join(repositoryRoot, 'qualification/suite-v1.json'), 'utf8'));
  assert.match(scanner, /import\("@redact-secret\/core"\)/);
  assert.equal(suite.scanners['redact-secret'], '0.1.0-beta.4');
});
