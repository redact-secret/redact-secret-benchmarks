import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { buildPiiCurrentQualification, projectPiiCurrentQualification } from '../benchmarks/support/pii-current-qualification.ts';
import { viewMatrixProblems } from '../benchmarks/qualification/matrix-publication.ts';
import { buildMatrixArtifact } from '../benchmarks/qualification/matrix-artifact.ts';
import { piiCurrentQualificationProblem } from '../benchmarks/shared/support-model.ts';
import { buildPiiMatrixSection } from '../benchmarks/support/pii-families.ts';
const schema = JSON.parse(await readFile(new URL('../schemas/support-matrix-v1.json', import.meta.url), 'utf8'));
const valid = new Ajv({ strict: true }).compile({ ...schema.properties.piiCurrentQualification, definitions: schema.definitions });

test('absent public receipt leaves current target prepared with no measured identity', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pii-current-preparation-'));
  try {
    const current = await buildPiiCurrentQualification(directory);
    assert.equal(valid(current), true, JSON.stringify(valid.errors));
    assert.equal(current.state, 'prepared');
    assert.equal(current.publicMeasurement.state, 'not-recorded');
    assert.equal(current.publicMeasurement.receiptDigest, null);
    assert.equal(current.qualified, false);
    assert.ok(current.families.every(row => row.status === 'pending' && row.reasonCodes.includes('current-public-comparison-not-recorded')));
  } finally { await rm(directory, { recursive: true }); }
});

test('malformed public package fails closed without retaining claimed identity', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pii-current-invalid-'));
  try {
    const input = path.join(directory, 'benchmarks/pii-candidate-comparison');
    await mkdir(input, { recursive: true });
    await writeFile(path.join(input, 'plan.json'), '{invalid');
    const current = await buildPiiCurrentQualification(directory);
    assert.equal(valid(current), true, JSON.stringify(valid.errors));
    assert.equal(current.state, 'invalid');
    assert.equal(current.publicMeasurement.productArtifactDigest, null);
    assert.ok(current.families.every(row => row.reasonCodes.includes('current-public-comparison-invalid')));
  } finally { await rm(directory, { recursive: true }); }
});

test('strict additive schema cannot claim qualification, cost acceptance or invented fields', () => {
  const current = projectPiiCurrentQualification({ state: 'absent', reason: 'current-comparison-not-recorded' });
  for (const mutate of [q => q.qualified = true, q => q.gates.profileCost = 'met', q => q.families[0].status = 'provisional',
    q => q.publicMeasurement.receiptDigest = 'a'.repeat(64), q => q.ownerAcceptance = {}]) {
    const invalid = structuredClone(current); mutate(invalid); assert.equal(valid(invalid), false);
  }
});

test('historical protected status is preserved beside separately derived current qualification', async () => {
  const section = await buildPiiMatrixSection(path.resolve('.'));
  assert.equal(section.piiQualification.requalification.state, 'not-requalified');
  assert.equal(section.piiQualification.requalification.requalifiedOnCoreCommit, null);
  assert.notEqual(section.piiQualification.qualifiedAt.coreCommit, section.piiCurrentQualification.sourceCommit);
  assert.ok(section.piiCurrentQualification.families.every(row => row.status === 'pending'));
  assert.equal(section.piiCurrentQualification.distribution.pending, section.piiFamilies.length);
});

test('schema extension is optional for historical matrices', () => {
  assert.equal(schema.required.includes('piiCurrentQualification'), false);
  assert.equal(schema.additionalProperties, false);
});

test('recorded public measurement preserves exact evidence identities while qualification stays pending', () => {
  const prepared = projectPiiCurrentQualification({ state: 'absent', reason: 'current-comparison-not-recorded' });
  // A synthetic loader-result double exercises projection only; the loader owns eight-artifact verification.
  const comparison = { state: 'recorded', publicOnly: true, supportClaims: false, qualified: false, mode: 'official',
    candidate: { sourceCommit: prepared.sourceCommit, packageTreeSha256: 'a'.repeat(64) },
    baseline: { sourceCommit: 'b'.repeat(40) }, engine: { binarySha256: 'c'.repeat(64) } };
  const current = projectPiiCurrentQualification(comparison, { syntheticReceiptDouble: true });
  assert.equal(valid(current), true, JSON.stringify(valid.errors));
  assert.equal(current.publicMeasurement.productArtifactDigest, comparison.candidate.packageTreeSha256);
  assert.equal(current.publicMeasurement.baselineSourceCommit, comparison.baseline.sourceCommit);
  assert.equal(current.qualified, false);
  assert.ok(current.families.every(row => row.status === 'pending' && row.reasonCodes.includes('public-qualification-gates-not-evaluated')));
  assert.throws(() => projectPiiCurrentQualification({ ...comparison, qualified: true }, {}), /measurement boundary/);
  assert.throws(() => projectPiiCurrentQualification({ ...comparison, candidate: { ...comparison.candidate, sourceCommit: 'd'.repeat(40) } }, {}), /prepared target/);
});

test('current-target validator is shared by legacy and view matrix publications', () => {
  const current = projectPiiCurrentQualification({ state: 'absent', reason: 'current-comparison-not-recorded' });
  assert.equal(piiCurrentQualificationProblem(undefined), null);
  assert.equal(piiCurrentQualificationProblem(current), null);
  const higherClaim = structuredClone(current); higherClaim.qualified = true;
  assert.match(piiCurrentQualificationProblem(higherClaim), /Invalid/);
  const fabricatedReasons = structuredClone(current); fabricatedReasons.families[0].reasonCodes = ['approved-deferral'];
  assert.match(piiCurrentQualificationProblem(fabricatedReasons), /gate reasons/);
});

test('view publication permits a strict optional current section without changing credential counts', () => {
  const current = projectPiiCurrentQualification({ state: 'absent', reason: 'current-comparison-not-recorded' });
  const view = { schema: 'synthetic-view', publication: 'public', policy: { revision: 'synthetic-policy' }, adapter: { id: 'synthetic', version: 1 },
    populations: [{ population: 'synthetic-population', runClass: 'public', artifact: { semanticDigest: 'synthetic-digest', artifactDigest: 'synthetic-bytes',
      engine: { name: 'synthetic', version: 'synthetic-version' }, scanners: [{ id: 'redact-secret', version: '0.0.1', build: 'released' }] } }],
    supportMatrix: { families: [], distribution: { stable: 0, provisional: 0, pending: 0, unsupported: 0 },
      stableDistribution: { documented: 0, empirical: 0, 'policy-qualified': 0 } } };
  const context = { registry: { engine: { version: 'synthetic-version' }, runs: [{ id: 'synthetic-run', population: 'synthetic-population',
    canonical: true, platform: 'linux-x64', runClass: 'public', artifact: { semanticDigest: 'synthetic-digest' } }] },
    taxonomy: [], policyRevision: 'synthetic-policy', roster: { required: ["redact-secret"], optional: [] } };
  const matrix = buildMatrixArtifact(view, 'published');
  assert.deepEqual(viewMatrixProblems(matrix, context), []);
  matrix.piiCurrentQualification = current;
  assert.deepEqual(viewMatrixProblems(matrix, context), []);
  assert.deepEqual(matrix.distribution, view.supportMatrix.distribution);
  matrix.piiCurrentQualification = { ...current, qualified: true };
  assert.ok(viewMatrixProblems(matrix, context).some(reason => reason.includes('Invalid current PII')));
});
