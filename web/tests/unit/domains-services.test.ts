// @vitest-environment node
/**
 * The evaluation-domain services (#611) decide what `/evaluation/pii/` and `/evaluation/credential/` may say. The happy path
 * runs against the committed tree, and asserts structure only (a count is never compared with a number): a repin re-keys every
 * ledger value. Every other state is produced by an overlay of that tree with one file changed, using synthetic content.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PII_METRIC_IDS } from '../../../benchmarks/evaluation/domains/pii/profile';
import { piiCurrentProtectedRoute } from '../../../benchmarks/evaluation/domains/pii/support-semantics';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../../../benchmarks/evaluation/domains/pii/support-v2';
import { custodianConformanceFrom, piiEvalMeasurementFrom } from '../../../scripts/pii-publication-inputs';
import { buildEvaluationDomainsV2, domainDescriptorV2 } from '../../../benchmarks/shared/evaluation-domains-v2.ts';
import { PII_AUTHORITY_FILE, REAL_ROOT as REAL, overlay, piiAuthorityFile } from './overlay';

// The default root is the committed tree pinned to the legacy authorities (an overlay), so these tests mean the same whichever value is committed.
async function domains(root: string = overlay({})) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  return import('../../services/domains');
}

beforeEach(() => { vi.unstubAllEnvs(); });

const STATUSES = ['pending', 'provisional', 'stable', 'unsupported'];

describe('PII evaluation', () => {
  test('is rebuilt from the reviewed binding: families, a distribution that recounts, views bound to the report', async () => {
    const pii = await (await domains()).loadPiiEvaluation();
    if (pii.state !== 'recorded') throw new Error(`the committed PII binding did not validate: ${pii.state}`);
    expect(pii.families.length).toBeGreaterThan(0);
    for (const family of pii.families) {
      expect(family.id.startsWith('pii:')).toBe(true);
      expect(STATUSES).toContain(family.status);
      expect(family.views, `${family.id} has no views: the report is not bound to the matrix`).not.toBeNull();
      for (const view of Object.values(family.views ?? {})) for (const metric of view.metrics ?? []) {
        if (typeof metric.value === 'object' && metric.value !== null) {
          expect(Number.isFinite(metric.value.point)).toBe(true);
          expect(Number.isFinite(metric.value.bound)).toBe(true);
        } else expect([null, 'insufficient-evidence']).toContain(metric.value);
      }
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

  test('a reordered ledger retains its values but cannot replace the frozen entry serialization', async () => {
    const ledger = JSON.parse(readFileSync(`${REAL}/benchmarks/accepted-pii-profile-cost.json`, 'utf8'));
    const reordered = ledger.map((entry: Record<string, unknown>) => Object.fromEntries(Object.entries(entry).reverse()));
    expect(reordered).toEqual(ledger);
    const rejected = await (await domains(overlay({ 'benchmarks/accepted-pii-profile-cost.json': JSON.stringify(reordered) }))).loadPiiEvaluation();
    expect(rejected).toMatchObject({ state: 'not-recorded', reason: expect.stringContaining('cost-acceptance-ledger-mismatch') });
    const exact = await (await domains()).loadPiiEvaluation();
    expect(exact.state).toBe('recorded');
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
    const custodianConformance = await custodianConformanceFrom(`${REAL}/tests/fixtures/custodian/synthetic-pii-bundle.json`);
    const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: measurement, custodianConformance });
    const index = buildEvaluationDomainsV2(matrix.artifactCommitment, { bundleId: 'a'.repeat(32), manifestSha256: 'b'.repeat(64) });
    const descriptor = domainDescriptorV2(index, 'pii');
    if (!descriptor?.support.href) throw new Error('PII descriptor did not bind its support artifact');
    const href = descriptor.support.href;
    const pii = await (await domains(overlay({
      'public/results/evaluation-domains-v2.json': JSON.stringify(index),
      [`public${href}`]: JSON.stringify(matrix),
    }))).loadPiiEvaluation();
    if (pii.state !== 'recorded') throw new Error(pii.state);
    expect(pii.piiEvalMeasurement?.complete).toBe(true);
    expect(pii.piiEvalMeasurement?.populations.every(population => population.scanners[0].metrics.length === 10)).toBe(true);
    expect(pii.custodianConformance).toMatchObject({ syntheticConformance: true, supportClaims: false, qualification: 'not-live-support-evidence' });

    const dir = piiCurrentProtectedRoute()!.evidenceDirectory;
    const publicOnly = await (await domains(overlay({
      'public/results/evaluation-domains-v2.json': JSON.stringify(index),
      [`public${href}`]: JSON.stringify(matrix),
      [`${dir}/pii-beta11-protected-disposition-v2.json`]: null,
    }))).loadPiiEvaluation();
    expect(publicOnly.state).toBe('public-recorded');
    if (publicOnly.state !== 'public-recorded') throw new Error(publicOnly.state);
    expect(publicOnly.piiEvalMeasurement).toEqual(pii.piiEvalMeasurement);
    expect(publicOnly.protectedReason).toContain('did not validate');
    expect(publicOnly).not.toHaveProperty('families');
    expect(publicOnly).not.toHaveProperty('distribution');
  });

  test('a published support artifact carries the schema 1.4 projection of the four populations and binds a candidate only to its own commit', async () => {
    const files = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress']
      .map(view => `${REAL}/benchmarks/pii-eval-official-run/${view}.public-synthetic-artifact.json`);
    const pins = [`${REAL}/benchmarks/pii-eval-public-synthetic-pins.json`, `${REAL}/benchmarks/pii-eval-population-pins.json`];
    const copy = `${REAL}/${(JSON.parse(await readFile(`${REAL}/benchmarks/pii-eval-public-synthetic-source.json`, 'utf8')) as { durableCopy: { path: string } }).durableCopy.path}`;
    const candidate = JSON.parse(await readFile(pins[1], 'utf8')).populations[0].scanners[0].candidateSourceCommit as string;
    const measurement = await piiEvalMeasurementFrom(pins, [copy, ...files], { sourceCommit: candidate, coreSha256: 'e'.repeat(64) });
    expect(measurement.populations).toHaveLength(files.length + 1);
    expect(measurement.populations.every(row => (row.schemaVersion === '1.2' || row.schemaVersion === '1.4') && row.productProjection && !row.unavailable)).toBe(true);
    const states = Object.fromEntries(measurement.populations.map(row => [row.populationId, row.productBinding.state]));
    expect(states['synthetic-demo-population']).toBe('other-product');
    expect(Object.values(states).filter(state => state === 'measures-publication-product')).toHaveLength(files.length);
    const released = await piiEvalMeasurementFrom(pins, [copy, ...files], null);
    expect(released.populations.every(row => row.productBinding.state === 'publication-product-not-measured')).toBe(true);
    const another = await piiEvalMeasurementFrom(pins, [copy, ...files], { sourceCommit: '1'.repeat(40), coreSha256: 'e'.repeat(64) });
    expect(another.populations.every(row => row.productBinding.state === 'other-product')).toBe(true);
    const baseline = buildPiiSupportMatrixV2();
    const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: measurement });
    expect(matrix.distribution).toEqual(baseline.distribution);
    expect(matrix.families).toEqual(baseline.families);
    const index = buildEvaluationDomainsV2(matrix.artifactCommitment, { bundleId: 'a'.repeat(32), manifestSha256: 'b'.repeat(64) });
    const href = domainDescriptorV2(index, 'pii')!.support.href!;
    const pii = await (await domains(overlay({ 'public/results/evaluation-domains-v2.json': JSON.stringify(index), [`public${href}`]: JSON.stringify(matrix) }))).loadPiiEvaluation();
    const shown = pii.state === 'recorded' || pii.state === 'public-recorded' ? pii.piiEvalMeasurement : null;
    expect(shown?.populations.map(row => row.productProjection?.rows.length)).toEqual(measurement.populations.map(row => row.productProjection?.rows.length));
    // The same matrix, edited, is refused when it is read back.
    const edited = structuredClone(matrix);
    edited.piiEvalMeasurement!.populations[1].productProjection!.rows.push(structuredClone(edited.piiEvalMeasurement!.populations[1].productProjection!.rows[0]));
    expect(() => validatePiiSupportMatrixV2(edited)).toThrow();
  });

  test('the authority changes only the stamp: the evaluation (families, verdicts, measurement) is byte-equal under legacy and under an authorised new, and rollback restores it', async () => {
    const files = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress']
      .map(view => `${REAL}/benchmarks/pii-eval-official-run/${view}.public-synthetic-artifact.json`);
    const measurement = await piiEvalMeasurementFrom([`${REAL}/benchmarks/pii-eval-population-pins.json`], files, null);
    const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: measurement });
    const index = buildEvaluationDomainsV2(matrix.artifactCommitment, { bundleId: 'a'.repeat(32), manifestSha256: 'b'.repeat(64) });
    const href = domainDescriptorV2(index, 'pii')!.support.href!;
    const under = async (authority: 'legacy' | 'new') => (await (await domains(overlay({
      'public/results/evaluation-domains-v2.json': JSON.stringify(index), [`public${href}`]: JSON.stringify(matrix), [PII_AUTHORITY_FILE]: piiAuthorityFile(authority),
    }))).loadPiiEvaluation());
    const legacy = await under('legacy');
    const authorised = await under('new');
    expect(authorised.authority.authority).toBe('new');
    expect(authorised.state).not.toBe('not-recorded');
    const withoutStamp = (value: { authority: unknown }) => JSON.stringify({ ...value, authority: undefined });
    expect(withoutStamp(authorised)).toBe(withoutStamp(legacy));
    expect(JSON.stringify(await under('legacy'))).toBe(JSON.stringify(legacy));
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


test('current public comparison has independent explicit absent and malformed states', async () => {
  const absent = await (await domains(overlay({
    'benchmarks/pii-candidate-comparison/plan.json': null,
    'benchmarks/pii-candidate-comparison/receipt.json': null,
  }))).loadPiiEvaluation();
  expect(absent.candidateComparison).toMatchObject({ state: 'absent', publicOnly: true, qualified: false, supportClaims: false });
  const invalid = await (await domains(overlay({
    'benchmarks/pii-candidate-comparison/plan.json': '{bad-json',
  }))).loadPiiEvaluation();
  expect(invalid.candidateComparison).toMatchObject({ state: 'invalid', reason: 'comparison-inputs-unreadable', qualified: false });
});

test('peer readiness is independently fail-closed for absent and invented measured data', async () => {
  const absent = await (await domains(overlay({ 'benchmarks/pii-peer-readiness-v1.json': null }))).loadPiiEvaluation();
  expect(absent.peerReadiness).toMatchObject({ state: 'absent' });
  const invalid = await (await domains(overlay({ 'benchmarks/pii-peer-readiness-v1.json': JSON.stringify({ measurementState: 'measured' }) }))).loadPiiEvaluation();
  expect(invalid.peerReadiness).toMatchObject({ state: 'invalid' });
});
