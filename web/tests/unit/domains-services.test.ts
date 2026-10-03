// @vitest-environment node
/**
 * The evaluation-domain services (#611) decide what `/evaluation/pii/` and `/evaluation/credential/` may say. The happy path
 * runs against the committed tree, and asserts structure only (a count is never compared with a number): a repin re-keys every
 * ledger value. Every other state is produced by an overlay of that tree with one file changed, using synthetic content.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PII_METRIC_IDS } from '../../../benchmarks/evaluation/domains/pii/profile';
import { piiCurrentProtectedRoute } from '../../../benchmarks/evaluation/domains/pii/support-semantics';
import { buildPiiSupportMatrixV2 } from '../../../benchmarks/evaluation/domains/pii/support-v2';
import { piiEvalMeasurementFrom } from '../../../scripts/pii-publication-inputs';
import { buildEvaluationDomainsV2, domainDescriptorV2 } from '../../../src/evaluation-domains-v2';
import { REAL_ROOT as REAL, overlay } from './overlay';

async function domains(root: string = REAL) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  return import('../../services/domains');
}

beforeEach(() => { vi.unstubAllEnvs(); });

const STATUSES = ['pending', 'provisional', 'stable', 'unsupported'];

describe('PII evaluation', () => {
  test('is rebuilt from the reviewed binding: families, a distribution that recounts, views bound to the report', async () => {
    const pii = await (await domains()).loadPiiEvaluation();
    if (pii.state !== 'recorded') throw new Error(`the committed PII binding did not validate: ${pii.reason}`);
    expect(pii.families.length).toBeGreaterThan(0);
    for (const family of pii.families) {
      expect(family.id.startsWith('pii:')).toBe(true);
      expect(STATUSES).toContain(family.status);
      expect(family.views, `${family.id} has no views: the report is not bound to the matrix`).not.toBeNull();
    }
    expect(Object.values(pii.distribution).reduce((a, b) => a + b, 0)).toBe(pii.families.length);
    expect(pii.metrics.map(m => m.id)).toEqual([...PII_METRIC_IDS]);
    expect(['candidate', 'published']).toContain(pii.mode);
  });

  test('a frozen report that is not the one the binding commits to refuses the whole page', async () => {
    const binding = piiCurrentProtectedRoute()!;
    const dir = `${binding.evidenceDirectory}`;
    const real = JSON.parse(readFileSync(`${REAL}/${dir}/pii-beta11-report-v2.json`, 'utf8'));
    // The binding validator re-derives the report, so a changed report is refused whole, never read in part.
    real.artifactCommitment = '0'.repeat(64);
    const pii = await (await domains(overlay({ [`${dir}/pii-beta11-report-v2.json`]: JSON.stringify(real) }))).loadPiiEvaluation();
    expect(pii.state).toBe('not-recorded');
    if (pii.state === 'not-recorded') expect(pii.reason).toMatch(/did not validate/);
  });

  test('a missing evidence file is not recorded, with the reason', async () => {
    const dir = piiCurrentProtectedRoute()!.evidenceDirectory;
    const pii = await (await domains(overlay({ [`${dir}/pii-beta11-protected-disposition-v2.json`]: null }))).loadPiiEvaluation();
    expect(pii).toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('did not validate') });
  });

  test('a published support artifact exposes validated pii-eval evidence without changing family policy', async () => {
    const measurement = await piiEvalMeasurementFrom(`${REAL}/tests/fixtures/pii-eval/pins.json`, [
      `${REAL}/tests/fixtures/pii-eval/population-a-v2.public-synthetic-artifact.json`,
      `${REAL}/tests/fixtures/pii-eval/population-b-v1.public-synthetic-artifact.json`,
    ]);
    const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: measurement });
    const index = buildEvaluationDomainsV2(matrix.artifactCommitment);
    const descriptor = domainDescriptorV2(index, 'pii');
    if (!descriptor?.support.href) throw new Error('PII descriptor did not bind its support artifact');
    const href = descriptor.support.href;
    const pii = await (await domains(overlay({
      'public/results/evaluation-domains-v2.json': JSON.stringify(index),
      [`public${href}`]: JSON.stringify(matrix),
    }))).loadPiiEvaluation();
    if (pii.state !== 'recorded') throw new Error(pii.reason);
    expect(pii.piiEvalMeasurement?.complete).toBe(true);
    expect(pii.piiEvalMeasurement?.populations.every(population => population.scanners[0].metrics.length === 10)).toBe(true);
  });
});

const record = (over: Record<string, unknown> = {}) => JSON.stringify({
  schemaVersion: 1, generatedAt: '2030-01-02T00:00:00.000Z', familyCount: 3,
  distribution: { stable: 2, provisional: 1, pending: 0, unsupported: 0 }, stableDistribution: { documented: 1, empirical: 1, policyQualified: 0 },
  families: [{ status: 'stable' }, { status: 'stable' }, { status: 'provisional' }],
  publishedPackage: { version: '9.9.9' }, product: null, ...over,
});

describe('support record', () => {
  const published = { state: 'measured', mode: 'published', productVersion: '9.9.9' } as never;

  test('is the newest record of the run’s own version, recounted from its families', async () => {
    const root = overlay({
      'evidence/990/aaa/support-status-published.json': record({ generatedAt: '2030-01-01T00:00:00.000Z' }),
      'evidence/991/bbb/support-status-published.json': record(),
      'evidence/992/ccc/support-status-published.json': record({ publishedPackage: { version: '1.0.0' } }),
    });
    const found = await (await domains(root)).loadSupportRecord(published);
    expect(found).toMatchObject({ mode: 'published', version: '9.9.9', path: 'evidence/991/bbb/support-status-published.json', familyCount: 3 });
    expect(found?.distribution.stable).toBe(2);
  });

  test('a record whose distribution does not recount from its families is never shown', async () => {
    const root = overlay({ 'evidence/990/aaa/support-status-published.json': record({ distribution: { stable: 3, provisional: 0, pending: 0, unsupported: 0 } }) });
    await expect((await domains(root)).loadSupportRecord(published)).resolves.toBeUndefined();
  });

  test('a candidate run reads the candidate record of its commit, and a published record does not stand in for it', async () => {
    const root = overlay({
      'evidence/990/aaa/support-status-candidate.json': record({ publishedPackage: null, product: { sourceCommit: 'c'.repeat(40), declaredVersion: '9.9.9-rc' } }),
      'evidence/991/bbb/support-status-published.json': record(),
    });
    const d = await domains(root);
    const candidate = { state: 'measured', mode: 'candidate', productVersion: null, candidate: { sourceCommit: 'c'.repeat(40), declaredVersion: '9.9.9-rc' } } as never;
    await expect(d.loadSupportRecord(candidate)).resolves.toMatchObject({ mode: 'candidate', version: '9.9.9-rc', sourceCommit: 'c'.repeat(40) });
    const other = { state: 'measured', mode: 'candidate', productVersion: null, candidate: { sourceCommit: 'd'.repeat(40), declaredVersion: 'x' } } as never;
    await expect(d.loadSupportRecord(other)).resolves.toBeUndefined();
  });

  test('without a measured run there is no count', async () => {
    await expect((await domains()).loadSupportRecord({ state: 'not-published', reason: 'x' })).resolves.toBeUndefined();
  });
});

describe('engine qualification', () => {
  const FILE = 'docs/specs/qualification/engine-v1.json';

  test('the committed record has methods with cases and variants', async () => {
    const q = await (await domains()).loadEngineQualification();
    expect(q?.methods.length).toBeGreaterThan(0);
    for (const m of q!.methods) expect(Number.isInteger(m.cases) && Number.isInteger(m.variants)).toBe(true);
    expect(q?.supportClaims).toBe(false);
  });

  test('absent, or claiming support, is not read', async () => {
    await expect((await domains(overlay({ [FILE]: null }))).loadEngineQualification()).resolves.toBeUndefined();
    const claims = JSON.stringify({ reportType: 'qualification', status: 'x', supportClaims: true, finishedAt: '2030-01-01', methods: [] });
    await expect((await domains(overlay({ [FILE]: claims }))).loadEngineQualification()).resolves.toBeUndefined();
  });
});

describe('credential evaluation', () => {
  test('joins the run, the catalog, the findings, and names the profiles the run recorded', async () => {
    // The legacy join is what this test describes; the committed authority is `new`, which reads a qualification view that CI does not build.
    const authority = { ...JSON.parse(readFileSync(`${REAL}/benchmarks/qualification-authority.json`, 'utf8')), authority: 'legacy' };
    const credential = await (await domains(overlay({ 'benchmarks/qualification-authority.json': JSON.stringify(authority) }))).loadCredentialEvaluation();
    expect(credential.catalog.fixtures.length).toBeGreaterThan(0);
    expect(credential.findings.issues.length).toBeGreaterThan(0);
    if (credential.run.state === 'measured') expect(credential.profiles?.evaluationProfile).toBeTruthy();
  });

  test('without a run there are no profiles and no support record, and the catalog still loads', async () => {
    const credential = await (await domains(overlay({ 'public/results/run.json': null }))).loadCredentialEvaluation();
    expect(credential.run.state).toBe('not-published');
    expect(credential.profiles).toBeUndefined();
    expect(credential.support).toBeUndefined();
    expect(credential.catalog.fixtures.length).toBeGreaterThan(0);
  });
});
