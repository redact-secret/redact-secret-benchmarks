import test from 'node:test';
import assert from 'node:assert/strict';
import { supportMatrixProblem, orderedFamilies, providerName, SUPPORT_STATUSES } from '../benchmarks/shared/support-model.ts';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';
import fixtureIndex from '../benchmarks/fixture-index.json' with { type: 'json' };
import { withMatrixExtras } from './support-matrix-extras.mjs';

const profileCoverage = {
  profilesVersion: 1, claimed: 'stable-documented', explicit: false, target: 'stable-documented', cellsMet: ['arrival-provisional', 'stable-documented'],
  cells: { totalFixtures: 24, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4, confusionAxes: 4, positiveContextAxisIds: ['env'], controlAxisIds: ['ordinary-prose'], confusionAxisIds: ['near-miss'] },
  requiredCells: { totalFixtures: 24, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4 }, requiredButEmptyAxisIds: [], debt: [],
};

/** A published matrix shaped exactly like `generate-support-matrix.ts` writes one, with statuses the caller chooses. */
function matrixOf(statusFor) {
  const families = taxonomy.families.map(family => {
    const status = statusFor(family);
    const hasDetector = family.detectors.length > 0;
    return {
      provider: family.provider, family: family.id, familyName: family.name, status,
      evidenceTier: hasDetector ? 'T1' : null,
      evidenceBasis: hasDetector ? 'provider-documented' : 'none',
      qualificationProfile: hasDetector && status === 'stable' ? 'documented' : null,
      providerSource: hasDetector ? { url: 'https://docs.example.invalid/tokens', observedAt: '2026-09-17', formatVersion: '2026-09', covers: 'prefix and body' } : null,
      corroboratingScanners: hasDetector ? ['gitleaks 8.30.1'] : [],
      twinCoverage: hasDetector ? { pairs: 3, failures: 1, unprobeable: null } : null,
      unresolvedCriticalItems: hasDetector ? { metamorphic: 0, mutation: 2, differential: 0 } : null,
      empiricalEvidence: hasDetector ? { observations: 0, subjects: 0, issuanceDates: 0, corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [], contradictions: 0, boundedContradictions: 0, uncertainty: null, supportedContexts: [], mode: null, supportsBareValues: true } : null,
      fixtureProfile: hasDetector ? { positiveCases: 6, positiveAxes: 4, benignCases: 8, controlAxes: 4, twinPairs: 5, totalFixtures: 24, contextTwinPairs: 0, confusionAxes: 4 } : null,
      profileCoverage: hasDetector ? structuredClone(profileCoverage) : null,
      detectors: hasDetector ? [family.detectors[0]] : [],
      reason: status === 'stable' ? null : `${status} because the evidence says so`,
    };
  });
  const distribution = Object.fromEntries(SUPPORT_STATUSES.map(status => [status, families.filter(f => f.status === status).length]));
  const stableDistribution = { documented: families.filter(f => f.status === 'stable').length, empirical: 0 };
  return withMatrixExtras({
    schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-09-20T09:00:00.000Z', runId: 'abcdef1234', revision: 'f'.repeat(40), dirty: false, criteriaSchemaVersion: 1,
      fixtureIndex: fixtureIndex.identity, taxonomyDigest: fixtureIndex.sources.taxonomy.digest,
      scannerObservations: { 'redact-secret': { source: 'fresh', observedAt: '2026-09-20T09:00:00.000Z', sourceRunId: 'abcdef1234' } } },
    providerCount: taxonomy.providers.length, familyCount: families.length, distribution, stableDistribution, families,
  });
}
/** The default view: detector-bearing families provisional, detectorless families unsupported. */
const mixed = () => matrixOf(family => (family.detectors.length ? 'provisional' : 'unsupported'));

test('empirical stable retains T2 and is counted separately in the validated matrix', () => {
  const matrix = mixed();
  const entry = matrix.families.find(family => family.detectors.length);
  entry.status = 'stable';
  entry.reason = null;
  entry.evidenceTier = 'T2';
  entry.evidenceBasis = 'empirically-observed';
  entry.qualificationProfile = 'empirical';
  entry.providerSource = null;
  entry.empiricalEvidence = { observations: 5, subjects: 2, issuanceDates: 2, corroborationReferences: 2, corroborationOwners: 2, corroborationClasses: ['independent-implementation', 'peer-scanner-rule'], contradictions: 0, boundedContradictions: 0, uncertainty: 'Observed formats may change.', supportedContexts: ['assignment'], mode: 'shape', supportsBareValues: true };
  matrix.distribution.provisional--;
  matrix.distribution.stable++;
  matrix.stableDistribution.empirical = 1;
  assert.equal(supportMatrixProblem(matrix), null);
  assert.equal(entry.evidenceTier, 'T2');
  assert.equal(matrix.stableDistribution.empirical, 1);
  const mislabeled = structuredClone(matrix);
  mislabeled.stableDistribution.empirical = 0;
  assert.notEqual(supportMatrixProblem(mislabeled), null);
});

test('corroborated empirical stable rejects a basis its records cannot carry', () => {
  const matrix = mixed();
  const entry = matrix.families.find(family => family.detectors.length);
  Object.assign(entry, { status: 'stable', reason: null, evidenceTier: 'T2', evidenceBasis: 'corroborated', qualificationProfile: 'empirical', providerSource: null });
  entry.empiricalEvidence = { observations: 0, subjects: 0, issuanceDates: 0, corroborationReferences: 4, corroborationOwners: 3, corroborationClasses: ['peer-scanner-rule', 'provider-owned-code'], contradictions: 0, boundedContradictions: 1, uncertainty: 'Corroborated, never provider-issued.', supportedContexts: ['assignment'], mode: 'shape', supportsBareValues: true };
  matrix.distribution.provisional--;
  matrix.distribution.stable++;
  matrix.stableDistribution.empirical = 1;
  assert.equal(supportMatrixProblem(matrix), null);
  const thin = structuredClone(matrix);
  thin.families.find(family => family.family === entry.family).empiricalEvidence.corroborationOwners = 2;
  assert.match(supportMatrixProblem(thin), /masquerades as empirically qualified/);
  const observedLabel = structuredClone(matrix);
  observedLabel.families.find(family => family.family === entry.family).evidenceBasis = 'empirically-observed';
  assert.match(supportMatrixProblem(observedLabel), /masquerades as empirically qualified/, 'no observations cannot read as observed');
  const t1 = structuredClone(matrix);
  t1.families.find(family => family.family === entry.family).evidenceTier = 'T1';
  assert.match(supportMatrixProblem(t1), /masquerades as empirically qualified/);
});

test('a malformed, miscounted or stale matrix is refused by the shared validator', () => {
  const invalid = value => assert.notEqual(supportMatrixProblem(value), null);
  invalid(null);
  invalid({ ...mixed(), schemaVersion: 2 });
  invalid({ ...mixed(), families: mixed().families.map(f => ({ ...f, status: 'excellent' })) });
  const miscounted = mixed();
  miscounted.distribution = { ...miscounted.distribution, stable: miscounted.distribution.stable + 1 };
  invalid(miscounted);
  const stale = mixed();
  stale.families = stale.families.map((f, i) => (i === 0 ? { ...f, family: 'nowhere:invented-family' } : f));
  invalid(stale);
  const unexplained = mixed();
  unexplained.families = unexplained.families.map((f, i) => (i === 0 ? { ...f, status: 'pending', reason: null } : f));
  invalid(unexplained);
  const renamed = mixed();
  renamed.families = renamed.families.map((f, i) => (i === 0 ? { ...f, familyName: 'Renamed in the UI' } : f));
  invalid(renamed);
  const wrongIndex = mixed();
  wrongIndex.sourceReport.fixtureIndex = { ...wrongIndex.sourceReport.fixtureIndex, digest: '0'.repeat(64) };
  assert.match(supportMatrixProblem(wrongIndex), /different fixture semantic index/);
  const wrongTaxonomy = mixed();
  wrongTaxonomy.sourceReport.taxonomyDigest = '0'.repeat(64);
  assert.match(supportMatrixProblem(wrongTaxonomy), /different taxonomy identity/);
  assert.equal(supportMatrixProblem(mixed()), null);
});

test('families read in provider order, with the non-provider-specific formats last', () => {
  const matrix = mixed(), ordered = orderedFamilies(matrix);
  assert.equal(ordered.length, matrix.families.length);
  const firstNull = ordered.findIndex(entry => entry.provider === null);
  if (firstNull !== -1) assert.ok(ordered.slice(firstNull).every(entry => entry.provider === null), 'nothing provider-specific sorts after them');
  const names = ordered.filter(entry => entry.provider !== null).map(entry => providerName(entry.provider));
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  assert.equal(providerName(null), 'Not provider-specific');
  assert.equal(providerName('github'), taxonomy.providers.find(p => p.id === 'github').name);
});

test('matrix provenance distinguishes a released package from an exact candidate commit', () => {
  const released = mixed();
  released.sourceReport.publishedPackage = { packageName: '@redact-secret/core', version: '0.1.0-beta.7' };
  assert.equal(supportMatrixProblem(released), null);
  const candidate = mixed();
  candidate.sourceReport.product = { sourceCommit: 'a'.repeat(40), packageName: '@redact-secret/core', declaredVersion: '0.1.0-beta.7', artifacts: [{ role: 'package', sha256: 'b'.repeat(64) }] };
  assert.equal(supportMatrixProblem(candidate), null);
  candidate.sourceReport.product.sourceCommit = 'main';
  assert.match(supportMatrixProblem(candidate), /Invalid support-matrix contract/);
});
