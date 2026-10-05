import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as compatibility from '../benchmarks/accounting/index.ts';
import * as credential from '../benchmarks/evaluation/domains/credential/accounting.ts';
import * as shared from '../benchmarks/accounting/shared/primitives.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = file => readFile(path.join(root, file), 'utf8');

test('shared accounting owns mechanics only and compatibility exports the exact implementations', async () => {
  const files = (await readdir(path.join(root, 'benchmarks/accounting/shared'))).sort();
  assert.deepEqual(files, ['primitives.ts']);
  const source = await text('benchmarks/accounting/shared/primitives.ts');
  assert.doesNotMatch(source, /credential|\bpii\b|leaked|false.?alarm|collateral|twin|jurisdiction/i);
  for (const name of ['wilson', 'proportion', 'ratio', 'floorFor', 'accountCounts']) {
    assert.equal(compatibility[name], shared[name]);
    assert.equal(credential[name], shared[name]);
  }
  for (const name of ['accountGroups', 'accountingDelta', 'unresolvedGroups', 'validateAccounting'])
    assert.equal(compatibility[name], credential[name]);
});

test('credential identity resolves historical artifacts explicitly and rejects partial or foreign envelopes', () => {
  const expected = { domain: 'credential', evaluationProfile: 'measurement-v4', domainAccountingVersion: 'credential-v4' };
  assert.deepEqual(credential.readCredentialAccountingIdentity({}, 'measurement-v4'), expected);
  assert.deepEqual(credential.readCredentialAccountingIdentity(expected, 'measurement-v4'), expected);
  assert.throws(() => credential.readCredentialAccountingIdentity({ domain: 'credential' }, 'measurement-v4'), /Incomplete/);
  assert.throws(() => credential.readCredentialAccountingIdentity({ ...expected, domain: 'pii', domainAccountingVersion: 'pii-v1' }, 'measurement-v4'), /Unsupported/);
  assert.throws(() => shared.assertCompatibleIdentities([expected, { ...expected, domain: 'pii' }]), /Cross-domain/);
});

test('fresh internal producers are stamped while evaluation-v1 remains the legacy public contract', async () => {
  const execution = await text('benchmarks/evaluation/domains/credential/execution.ts');
  const measurement = await text('benchmarks/run.ts');
  const candidate = await text('benchmarks/candidate.ts');
  const publicProjection = await text('benchmarks/evaluation/domains/credential/public-report.ts');
  assert.match(execution, /credentialAccountingIdentity\('evaluation-v1'\)/);
  assert.match(measurement, /credentialAccountingIdentity\('measurement-v4'\)/);
  assert.match(candidate, /protocol: 'measurement-v4'/);
  assert.match(publicProjection, /schemaVersion: 2, accountingVersion: '1\.1'/);
  assert.doesNotMatch(publicProjection, /\.\.\.credentialAccountingIdentity/);
});

test('generic execution and holdout mechanics have no credential dependency', async () => {
  for (const file of ['benchmarks/evaluation/substrate/orchestration.ts', 'benchmarks/evaluation/substrate/runtime.ts', 'holdout/lifecycle.ts']) {
    const source = await text(file);
    assert.doesNotMatch(source, /domains\/credential|credentialDomain|qualification\/suite-v1/, file);
  }
  const lifecycle = await text('holdout/lifecycle.ts');
  assert.doesNotMatch(lifecycle, /HoldoutReport|\bCounts\b|byStratum/);
  assert.match(await text('benchmarks/evaluation/domains/credential/holdout.ts'), /buildReport/);
});
