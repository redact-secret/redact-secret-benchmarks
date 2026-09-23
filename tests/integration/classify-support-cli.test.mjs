import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import Ajv from 'ajv';

// These run the real eval:classify CLI, which fails closed unless the pinned
// peer scanners are on PATH (qualification/suite-v1.json). They live under
// tests/integration so they run after the workflow provisions those peers,
// not in `npm test`, which has none.
const exec = promisify(execFile);
const repositoryRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const hashFile = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const schema = JSON.parse(await readFile(new URL('../../schemas/support-status-report-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true }).compile(schema);

async function pack(directory) {
  const { stdout } = await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--json'], { cwd: directory });
  return path.join(directory, JSON.parse(stdout)[0].filename);
}

// A minimal candidate build: enough for installCandidate/loadCandidate to
// accept it, never a real product build. Mirrors tests/candidate.test.mjs.
async function candidatePackages() {
  const root = await mkdtemp(path.join(tmpdir(), 'classify-candidate packages with spaces '));
  const nodeName = '@redact-secret/node-test';
  const core = path.join(root, 'core'), node = path.join(root, 'node'), wasm = path.join(root, 'wasm');
  await Promise.all([mkdir(path.join(core, 'dist'), { recursive: true }), mkdir(node), mkdir(wasm)]);
  await writeFile(path.join(core, 'package.json'), JSON.stringify({ name: '@redact-secret/core', version: '9.9.9-candidate.1', type: 'module',
    exports: './dist/index.js', dependencies: { '@redact-secret/wasm': '9.9.9-candidate.1' }, optionalDependencies: { [nodeName]: '9.9.9-candidate.1' } }));
  await writeFile(path.join(core, 'dist/index.js'), `export const VERSION='9.9.9-candidate.1'; export async function initialize(){} export function scan(){return []}`);
  await writeFile(path.join(node, 'package.json'), JSON.stringify({ name: nodeName, version: '9.9.9-candidate.1' }));
  await writeFile(path.join(wasm, 'package.json'), JSON.stringify({ name: '@redact-secret/wasm', version: '9.9.9-candidate.1' }));
  return { root, core: await pack(core), node: await pack(node), wasm: await pack(wasm) };
}

test('eval:classify CLI substitutes a candidate build for redact-secret only, and names the measured product', async () => {
  const artifacts = await candidatePackages();
  const output = path.join(artifacts.root, 'support-status.json');
  const sourceCommit = 'a'.repeat(40);
  try {
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/classify-support.ts',
      `--output=${output}`, `--candidate-package=${artifacts.core}`, `--candidate-node-package=${artifacts.node}`,
      `--candidate-wasm-package=${artifacts.wasm}`, `--candidate-source-commit=${sourceCommit}`],
      { cwd: repositoryRoot, timeout: 120_000 });
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.ok(validate(report), JSON.stringify(validate.errors));
    // Peer scanners stay exactly the pinned set; only the redact-secret entry was substituted.
    assert.deepEqual(report.scanners, ['redact-secret', 'gitleaks', 'trufflehog']);
    assert.deepEqual(report.product, {
      sourceCommit, packageName: '@redact-secret/core', declaredVersion: '9.9.9-candidate.1',
      artifacts: [
        { role: 'package', sha256: await hashFile(artifacts.core) },
        { role: 'node', sha256: await hashFile(artifacts.node) },
        { role: 'wasm', sha256: await hashFile(artifacts.wasm) },
      ],
    });
  } finally { await rm(artifacts.root, { recursive: true, force: true }); }
});

test('eval:classify CLI with no arguments still measures the published package, product null', async () => {
  const output = path.join(await mkdtemp(path.join(tmpdir(), 'classify-default-')), 'support-status.json');
  try {
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/classify-support.ts', `--output=${output}`],
      { cwd: repositoryRoot, timeout: 120_000 });
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.ok(validate(report), JSON.stringify(validate.errors));
    assert.equal(report.product, null);
    assert.deepEqual(report.scanners, ['redact-secret', 'gitleaks', 'trufflehog']);
  } finally { await rm(path.dirname(output), { recursive: true, force: true }); }
});
