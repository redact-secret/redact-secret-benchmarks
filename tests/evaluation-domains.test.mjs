import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluationDomains, evaluationDomainsProblem, domainDescriptor } from '../src/evaluation-domains.ts';

const clone = value => structuredClone(value);
const execute = promisify(execFile);

test('public domain index is schema-valid, exact, and keeps credential v1 paths', async () => {
  const schema = JSON.parse(await readFile(new URL('../schemas/evaluation-domains-v1.json', import.meta.url), 'utf8'));
  assert.equal(new Ajv({ strict: true }).compile(schema)(evaluationDomains), true);
  assert.equal(evaluationDomainsProblem(evaluationDomains), null);
  const credential = domainDescriptor(evaluationDomains, 'credential');
  assert.deepEqual(credential.evaluation, { state: 'published', href: '/results/evaluation-v1.json' });
  assert.deepEqual(credential.support, { state: 'published', href: '/results/support-matrix-v1.json' });
  assert.equal(credential.evaluationProfile, 'evaluation-v1');
  assert.equal(credential.domainAccountingVersion, 'credential-v4');
});

test('PII is an explicit schema-only profile, never an empty measurement', () => {
  const pii = domainDescriptor(evaluationDomains, 'pii');
  assert.deepEqual(pii.evaluation, { state: 'schema-only', href: null });
  assert.deepEqual(pii.support, { state: 'schema-only', href: null });
  assert.deepEqual(pii.qualificationProfiles, [{ id: 'pii-v1', version: 1 }]);
  assert.equal(pii.evaluationProfile, 'pii-v1');
  assert.equal(pii.domainAccountingVersion, 'pii-v1');
  assert.doesNotMatch(JSON.stringify(pii), /accuracy|precision|recall|f1|rate|stable|provisional|unsupported/i);
});

test('domain index rejects missing, duplicate, unknown, mismatched and hostile records', () => {
  const edits = [
    value => value.domains.pop(),
    value => value.domains[1] = clone(value.domains[0]),
    value => value.domains[1].domain = 'customer',
    value => value.domains[1].domainAccountingVersion = 'credential-v4',
    value => value.domains[1].qualificationProfiles[0].id = 'documented',
    value => value.domains[1].evaluation.href = '/results/pii.json',
    value => value.domains[1].support.raw = { content: 'unsafe', score: 1 },
  ];
  for (const edit of edits) {
    const value = clone(evaluationDomains); edit(value);
    assert.ok(evaluationDomainsProblem(value));
    assert.equal(domainDescriptor(value, 'pii'), null);
  }
});

test('publisher validates referenced credential artifacts before its atomic write', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'evaluation-domains-'));
  const evaluation = path.join(directory, 'evaluation.json'), support = path.join(directory, 'support.json'), output = path.join(directory, 'domains.json');
  await writeFile(evaluation, '{}'); await writeFile(support, '{}');
  await assert.rejects(execute(process.execPath, ['--import', 'tsx', 'scripts/publish-evaluation-domains.ts',
    `--evaluation=${evaluation}`, `--support=${support}`, `--output=${output}`], { cwd: path.resolve('.') }), /Credential evaluation artifact is incompatible/);
  await assert.rejects(access(output));
});
