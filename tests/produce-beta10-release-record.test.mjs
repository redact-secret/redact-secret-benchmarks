import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { hash } from '../benchmarks/evaluation/model/model.ts';
import { candidateConfiguration } from '../scanners/candidate.mjs';
import { accountPiiRows } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { qualifyPii } from '../benchmarks/evaluation/domains/pii/qualification.ts';

const execFile = promisify(execFileCallback);
const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url)));

function credentialCandidateEvidence() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, reportType: 'candidate', runId: randomUUID(), startedAt: now, finishedAt: now, status: 'complete', supportClaims: false,
    candidate: { sourceCommit: 'a'.repeat(40), sourceState: 'clean', packageName: '@redact-secret/core', declaredVersion: '1.0.0',
      artifactSha256: 'b'.repeat(64), expectedArtifactSha256: 'b'.repeat(64), artifacts: ['package', 'node', 'wasm'].map(role => ({ role, sha256: 'c'.repeat(64) })) },
    benchmark: { sourceCommit: 'd'.repeat(40), dirty: false, lockfileSha256: 'e'.repeat(64) },
    corpus: { protocol: 'measurement-v4', hash: 'f'.repeat(64), categories: [{ id: 'common-formats', sha256: '0'.repeat(64) }] },
    scanner: { id: 'redact-secret-candidate', configuration: candidateConfiguration, configurationHash: '1'.repeat(64) },
    runtime: { node: process.version, os: process.platform, arch: process.arch }, command: ['node', 'candidate'],
    selection: { scope: 'filtered-development', filter: 'openai-token' }, completeness: { selectedFixtures: 1, scannedFixtures: 1, writtenFixtures: 1 }, failures: [],
    results: [{ fixtureId: 'common-formats--openai-token-legacy-plain', corpusSection: 'fixed-corpus', kind: 'must-redact', tier: 'T2', expectedSpans: 1, actualFindings: 1, outcome: 'EXACT', baseline: { version: '0.1.0-beta.4', outcome: 'EXACT' } }],
  };
}

function credentialQualification() {
  const runId = randomUUID(), time = new Date().toISOString();
  const candidate = { sourceHash: 'a'.repeat(64), lockHash: 'b'.repeat(64), candidateArtifactHash: 'c'.repeat(64) };
  const scanners = Object.entries(suite.scanners).map(([id, version]) => ({ id, version, configuration: {}, configurationHash: hash({}),
    status: 'complete', assertions: { pass: 2, fail: 0, 'review-required': 0 }, byStratum: { 'must-redact:T1': { pass: 2, fail: 0, 'review-required': 0 } } }));
  return {
    schemaVersion: 2, reportType: 'qualification', engineVersion: '1.1.0', accountingVersion: '1.1', suiteId: 'engine-v1', suiteHash: hash(suite), runId,
    startedAt: time, finishedAt: time, scope: 'engine-conformance', status: 'execution-qualified', supportClaims: false,
    provenance: { ...candidate, revision: 'test', dirty: false, runtime: { node: 'test', platform: 'test', arch: 'test' } },
    development: { seed: 'engine-v1', casesHash: 'd'.repeat(64), corpusHashes: { control: 'e'.repeat(64) }, failures: 0, reviewEntries: 0, byDetector: {} },
    methods: suite.methods.map(method => ({ method, cases: 2, variants: 2, generationErrors: 0,
      scanners: scanners.map(({ id, status, assertions }) => ({ id, status, assertions: method === 'differential' ? { pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 } : method === 'holdout' ? structuredClone(assertions) : { ...assertions, 'not-measured': 0 } })) })),
    accounting: { reasons: [], unresolvedGroups: [], review: { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null } },
    holdout: { schemaVersion: 1, reportType: 'holdout', runId, planHash: 'f'.repeat(64), startedAt: time, finishedAt: time,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence: 'public-control', status: 'complete',
      corpus: { id: 'public-controls', revision: 1, purpose: 'public-conformance', corpusHash: 'd'.repeat(64), seedHash: 'e'.repeat(64), lifecycle: 'sealed-at-execution' },
      candidate, caseCount: 2, variantCount: 2, generationErrors: 0, scanners },
    milestone: { checkedAt: time, repository: 'redact-secret/redact-secret-benchmarks', number: 1, status: 'open', openPrerequisites: [8], outOfScope: [] },
  };
}

function performanceBudget(sourceCommit = 'a'.repeat(40)) {
  return { schemaVersion: '1', budgetsId: 'budgets-v1-test', baselineId: 'baseline-1', candidate: { sourceCommit, sources: [] },
    status: 'accepted', dimensions: {}, triggers: [], detection: { baseline: null, candidate: null } };
}

function piiQualification() {
  return qualifyPii(accountPiiRows([]), { protected: null, independent: null });
}

async function writeFixtures(directory) {
  const files = {
    'credential-candidate.json': credentialCandidateEvidence(),
    'credential-qualification.json': credentialQualification(),
    'pii-qualification.json': piiQualification(),
    'performance-budget.json': performanceBudget(),
    'pii-binding.json': { candidateEvidence: {}, activationArtifact: {}, qualificationArtifacts: [] },
  };
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(directory, name), JSON.stringify(content));
  return Object.fromEntries(Object.keys(files).map(name => [name, path.join(directory, name)]));
}

const baseArgs = paths => ['--import', 'tsx', 'scripts/produce-beta10-release-record.mjs',
  `--benchmark-revision=${'2'.repeat(40)}`, '--credential-profile=evaluation-v1',
  `--performance-budget=${paths['performance-budget.json']}`, `--credential-candidate=${paths['credential-candidate.json']}`,
  `--credential-qualification=${paths['credential-qualification.json']}`, `--pii-qualification=${paths['pii-qualification.json']}`,
  `--pii-binding=${paths['pii-binding.json']}`];

test('rejects missing required arguments', async () => {
  await assert.rejects(execFile(process.execPath, ['--import', 'tsx', 'scripts/produce-beta10-release-record.mjs',
    '--benchmark-revision=' + '2'.repeat(40)], { timeout: 10_000 }), error => /Missing required/.test(error.stderr));
});

test('rejects an invalid benchmark revision or credential profile', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'release-record-cli-'));
  try {
    const paths = await writeFixtures(directory);
    const output = path.join(directory, 'record.json');
    const args = paths2 => [...baseArgs(paths2), `--output=${output}`];
    await assert.rejects(execFile(process.execPath, args(paths).map(a => a.startsWith('--benchmark-revision') ? '--benchmark-revision=not-hex' : a),
      { timeout: 10_000 }), error => /40 hex characters/.test(error.stderr));
    await assert.rejects(execFile(process.execPath, args(paths).map(a => a.startsWith('--credential-profile') ? '--credential-profile=bogus' : a),
      { timeout: 10_000 }), error => /measurement-v4.*evaluation-v1/.test(error.stderr));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('wires every evidence file through to assembleReleaseRecord (rejects an unsanctioned PII binding, proving it never skips validation)', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'release-record-cli-'));
  try {
    const paths = await writeFixtures(directory);
    const output = path.join(directory, 'record.json');
    await assert.rejects(execFile(process.execPath, [...baseArgs(paths), `--output=${output}`], { timeout: 10_000 }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
