import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { viewMatrixSchema } from '../scripts/generate-view-matrix-schema.mjs';
import { MATRIX_ARTIFACT_SCHEMA, buildMatrixArtifact, matrixArtifactProblems } from '../benchmarks/qualification/matrix-artifact.ts';

// Synthetic only (#657): the view, the registry and every digest are built here; no committed ledger value or count is read.

const D = n => `sha256:${String(n).padStart(64, '0')}`;
const registry = {
  engine: { version: '9.9.9' },
  runs: [
    { id: 'pop-a@linux-x64', population: 'pop-a', canonical: true, platform: 'linux-x64', runClass: 'public', artifact: { semanticDigest: D(1) } },
    { id: 'pop-a+methods@linux-x64', population: 'pop-a', kind: 'methods', canonical: true, platform: 'linux-x64', runClass: 'public', artifact: { semanticDigest: D(2) } },
    { id: 'pop-b@linux-x64', population: 'pop-b', canonical: true, platform: 'linux-x64', runClass: 'public', artifact: { semanticDigest: D(3) } },
  ],
};
const entry = (family, status, extra = {}) => ({ provider: 'p', family, familyName: family, status, evidenceTier: 'T1', evidenceBasis: 'documented', qualificationProfile: status === 'stable' ? 'documented' : null, detectors: [family], reason: status === 'stable' ? null : 'why', ...extra });
const population = (id, digest, runClass = 'public', build = 'released') => ({ population: id, runClass, artifact: { semanticDigest: digest, artifactDigest: D(9), engine: { name: 'credential-eval', version: '9.9.9' }, scanners: [{ id: 'redact-secret', version: '1', build }] } });
const view = (over = {}) => {
  const families = [entry('a', 'stable'), entry('b', 'provisional'), entry('c', 'pending')];
  return {
    schema: 'qualification-view/v1', publication: 'public', policy: { revision: 'rs-policy-1:x' }, adapter: { id: 'adapter', version: 1 },
    populations: [population('pop-a', D(1)), population('pop-b', D(3))],
    supportMatrix: { distribution: { stable: 1, provisional: 1, pending: 1, unsupported: 0 }, stableDistribution: { documented: 1, empirical: 0, 'policy-qualified': 0 }, families },
    ...over,
  };
};
const published = v => buildMatrixArtifact(v, 'published');

test('a view of public canonical runs yields a published matrix with no problem and the view identity', () => {
  const artifact = published(view());
  assert.equal(artifact.schema, MATRIX_ARTIFACT_SCHEMA);
  assert.equal(artifact.publication, 'public');
  assert.deepEqual(matrixArtifactProblems(artifact, registry), []);
  assert.deepEqual(artifact.source.populations.map(p => p.population), ['pop-a', 'pop-b']);
  assert.deepEqual(artifact.source.publishedPackage, { packageName: '@redact-secret/core', version: '1' });
  assert.equal(artifact.source.populations[0].scannerVersions['redact-secret'], '1');
  assert.equal(artifact.families[0].findingTypes, null, 'an unknown synthetic detector never receives a guessed finding type');
});

test('released package and scanner versions must agree with every population and registry pin', () => {
  const good = published(view());
  assert.ok(matrixArtifactProblems(good, { ...registry, scanners: [{ id: 'redact-secret', version: '2' }] }).some(p => p.includes('differs from the recorded pin')));
  const changed = structuredClone(good);
  changed.source.populations[0].scannerVersions['redact-secret'] = '2';
  assert.ok(matrixArtifactProblems(changed, registry).some(p => p.includes('package identity')));
  delete changed.source.populations[0].scannerVersions;
  assert.ok(matrixArtifactProblems(changed, registry).some(p => p.includes('version roster')));
  const types = structuredClone(good);
  types.families[0].findingTypes = [{ detector: 'a', type: 'invented', basis: 'sole-type-of-detector' }];
  assert.ok(matrixArtifactProblems(types, registry).some(p => p.includes('finding-type keys')));
});

test('the matrix carries the entry fields and nothing from the cases', () => {
  const v = view();
  v.supportMatrix.families[0].cases = [{ id: 'x', secret: 'bytes' }];
  const artifact = published(v);
  assert.ok(!JSON.stringify(artifact).includes('bytes'));
  assert.deepEqual(Object.keys(artifact).sort(), ['distribution', 'families', 'familyCount', 'findingTypeSource', 'mode', 'providerCount', 'publication', 'schema', 'source', 'stableDistribution']);
});

test('the wrong artifact fails: an unrecorded digest, an internal run, a candidate build, another engine, a missing population', () => {
  assert.ok(matrixArtifactProblems(published(view({ populations: [population('pop-a', D(7)), population('pop-b', D(3))] })), registry).some(p => p.includes('not a canonical official run')));
  assert.ok(matrixArtifactProblems(published(view({ populations: [population('pop-a', D(1), 'internal'), population('pop-b', D(3))] })), registry).some(p => p.includes('public runs only')));
  assert.ok(matrixArtifactProblems(published(view({ populations: [population('pop-a', D(1), 'public', 'candidate'), population('pop-b', D(3))] })), registry).some(p => p.includes('never carries one')));
  assert.ok(matrixArtifactProblems(published(view()), { ...registry, engine: { version: '1.0.0' } }).some(p => p.includes('the pin is')));
  assert.ok(matrixArtifactProblems(published(view({ populations: [population('pop-a', D(1))] })), registry).some(p => p.includes('absent from the matrix source')));
  assert.ok(matrixArtifactProblems({ schema: 'other' }, registry)[0].includes('not a'));
});

test('a methods run is not a plain population: its digest cannot stand for the population', () => {
  assert.ok(matrixArtifactProblems(published(view({ populations: [population('pop-a', D(2)), population('pop-b', D(3))] })), registry).length > 0);
});

test('counts must recount from the families, and a non-stable family owes a reason', () => {
  const v = view();
  v.supportMatrix.distribution.stable = 5;
  assert.ok(matrixArtifactProblems(published(v), registry).some(p => p.startsWith('distribution.stable')));
  const w = view();
  w.supportMatrix.families[1].reason = null;
  assert.ok(matrixArtifactProblems(published(w), registry).some(p => p.includes('with no reason')));
});

test('a candidate projection names itself internal, is never public, and needs an internal run', () => {
  const v = view({ publication: 'internal', populations: [population('pop-a', D(8), 'internal', 'candidate'), population('pop-b', D(3))] });
  const artifact = buildMatrixArtifact(v, 'candidate-projection');
  assert.equal(artifact.publication, 'internal');
  assert.deepEqual(matrixArtifactProblems(artifact, registry), []);
  assert.ok(matrixArtifactProblems({ ...artifact, publication: 'public' }, registry).some(p => p.includes('cannot be')));
  assert.ok(matrixArtifactProblems(buildMatrixArtifact(view(), 'candidate-projection'), registry).some(p => p.includes('no internal run')));
});

test('the distinct view schema preserves the family contract and refuses invented source fields', () => {
  const v = view({ policy: { revision: 'rs-policy-1:sha256:' + 'a'.repeat(64) } });
  const validate = new Ajv({ strict: false, allErrors: true }).compile(viewMatrixSchema());
  const artifact = published(v);
  artifact.families = [];
  artifact.familyCount = 0;
  artifact.providerCount = 0;
  artifact.distribution = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  artifact.stableDistribution = { documented: 0, empirical: 0, "policy-qualified": 0 };
  assert.equal(validate(artifact), true, JSON.stringify(validate.errors));
  const missing = structuredClone(artifact);
  delete missing.source.publishedPackage;
  assert.equal(validate(missing), false);
  const invented = structuredClone(artifact);
  invented.source.generatedAt = '2026-10-08T00:00:00Z';
  assert.equal(validate(invented), false);
});
