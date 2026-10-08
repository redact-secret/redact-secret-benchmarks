import test from 'node:test';
import assert from 'node:assert/strict';
import { committedViewMatrixProblems } from '../scripts/check-support-matrix-from-view.mjs';
import { viewMatrixSchema } from '../scripts/generate-view-matrix-schema.mjs';
import { buildMatrixArtifact } from '../benchmarks/qualification/matrix-artifact.ts';
import { projectPiiCurrentQualification } from '../benchmarks/support/pii-current-qualification.ts';

const digest = n => `sha256:${String(n).padStart(64, '0')}`;
const policy = `rs-policy-1:${digest(3)}`;
function fixture() {
  const family = { provider: 'synthetic', family: 'synthetic-family', familyName: 'Synthetic family', status: 'pending',
    evidenceTier: null, evidenceBasis: 'none', qualificationProfile: null, providerSource: null, corroboratingScanners: [],
    twinCoverage: null, unresolvedCriticalItems: null, empiricalEvidence: null, fixtureProfile: null, profileCoverage: null,
    detectors: [], reason: 'Not measured' };
  const matrix = buildMatrixArtifact({ schema: 'qualification-view/v1', adapter: { id: 'synthetic', version: 1 }, policy: { revision: policy },
    populations: [{ population: 'synthetic-population', runClass: 'public', artifact: { semanticDigest: digest(1), artifactDigest: digest(2),
      engine: { version: 'synthetic-engine' }, scanners: [{ id: 'redact-secret', version: 'synthetic-release', build: 'released' }] } }],
    supportMatrix: { families: [family], distribution: { stable: 0, provisional: 0, pending: 1, unsupported: 0 },
      stableDistribution: { documented: 0, empirical: 0, 'policy-qualified': 0 } } }, 'published');
  const currentQualification = projectPiiCurrentQualification({ state: 'absent', reason: 'synthetic-not-recorded' });
  matrix.piiCurrentQualification = currentQualification;
  const context = { registry: { engine: { version: 'synthetic-engine' }, scanners: [{ id: 'redact-secret', version: 'synthetic-release' }],
    runs: [{ population: 'synthetic-population', canonical: true, platform: 'linux-x64', runClass: 'public', artifact: { semanticDigest: digest(1) } }] },
    policyRevision: policy, taxonomy: [{ id: family.family, provider: family.provider, name: family.familyName }],
    roster: { required: ['redact-secret'], optional: [] } };
  return { matrix, options: { schema: viewMatrixSchema(), context, currentQualification } };
}

test('the committed matrix gate accepts a matching synthetic source and current projection without a generated view', () => {
  const { matrix, options } = fixture();
  assert.deepEqual(committedViewMatrixProblems(matrix, options), []);
});

test('a recorded public receipt with null owner acceptance stays recorded and reconciles exactly', () => {
  const { matrix, options } = fixture();
  const current = projectPiiCurrentQualification({ state: 'recorded', mode: 'official', qualified: false, publicOnly: true, supportClaims: false,
    candidate: { sourceCommit: options.currentQualification.sourceCommit, packageTreeSha256: 'a'.repeat(64) },
    baseline: { sourceCommit: 'b'.repeat(40) }, engine: { binarySha256: 'c'.repeat(64) } }, { ownerAcceptance: null });
  assert.equal(current.state, 'recorded');
  assert.match(current.publicMeasurement.receiptDigest, /^[a-f0-9]{64}$/);
  matrix.piiCurrentQualification = current;
  assert.deepEqual(committedViewMatrixProblems(matrix, { ...options, currentQualification: current }), []);
});

test('version, finding key, source and current qualification mutations never pass', () => {
  for (const mutate of [
    matrix => { matrix.source.populations[0].scannerVersions['redact-secret'] = 'other-release'; },
    matrix => { matrix.families[0].findingTypes = [{ detector: 'invented', type: 'invented', basis: 'sole-type-of-detector' }]; },
    matrix => { matrix.source.populations[0].semanticDigest = digest(9); },
    matrix => { matrix.source.view.policyRevision = `rs-policy-1:${digest(9)}`; },
    matrix => { matrix.piiCurrentQualification.publicMeasurement.reason = 'invented-state'; },
    matrix => { matrix.piiCurrentQualification.qualified = true; },
    matrix => { matrix.source.raw = 'RAW-CANARY'; },
  ]) {
    const { matrix, options } = fixture();
    const changed = structuredClone(matrix);
    mutate(changed);
    assert.ok(committedViewMatrixProblems(changed, options).length > 0);
  }
});
