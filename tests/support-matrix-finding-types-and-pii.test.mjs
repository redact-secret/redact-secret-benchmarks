import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';
import { findingTypeSource, findingTypesFor } from '../benchmarks/support/finding-types.ts';
import { PII_RECORD_REVISION, PII_REQUALIFICATION_STATEMENT } from '../benchmarks/support/pii-families.ts';
import { supportMatrixProblem } from '../src/support-model.ts';
import { arrivalFindingTypes } from '../scanners/families.mjs';
import { piiSection, withMatrixExtras } from './support-matrix-extras.mjs';
import detectors from '../benchmarks/detectors.json' with { type: 'json' };
import snapshot from '../benchmarks/detector-finding-types.json' with { type: 'json' };
import fixtureIndex from '../benchmarks/fixture-index.json' with { type: 'json' };

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const detectedFamily = taxonomy.families.find(family => family.detectors.length);
/** A minimal row the model accepts: only what the finding-type and PII checks read matters here. */
function matrixWith(mutate = () => {}) {
  const families = taxonomy.families.map(family => ({
    provider: family.provider, family: family.id, familyName: family.name, status: 'unsupported', evidenceTier: null, evidenceBasis: 'none', qualificationProfile: null,
    providerSource: null, corroboratingScanners: [], twinCoverage: null, unresolvedCriticalItems: null, empiricalEvidence: null, policyQualification: null,
    fixtureProfile: null, profileCoverage: null, detectors: [], reason: 'unsupported for this test',
  }));
  const matrix = withMatrixExtras({
    schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-10-02T00:00:00.000Z', runId: 'run', revision: 'f'.repeat(40), dirty: false, criteriaSchemaVersion: 1,
      fixtureIndex: fixtureIndex.identity, taxonomyDigest: fixtureIndex.sources.taxonomy.digest,
      scannerObservations: { 'redact-secret': { source: 'fresh', observedAt: '2026-10-02T00:00:00.000Z', sourceRunId: 'run' } } },
    providerCount: taxonomy.providers.length, familyCount: families.length,
    distribution: { stable: 0, provisional: 0, pending: 0, unsupported: families.length }, stableDistribution: { documented: 0, empirical: 0 }, families,
  });
  mutate(matrix);
  return matrix;
}

test('the finding-type snapshot is the registered detectors at one product revision, and its source bytes are pinned', () => {
  assert.equal(findingTypeSource.revision, detectors.sourceRevision);
  assert.deepEqual(Object.keys(snapshot.detectors).sort(), detectors.detectors.map(d => d.id).sort());
  for (const types of Object.values(snapshot.detectors)) assert.ok(types.length > 0 && new Set(types).size === types.length);
  assert.equal(Object.values(snapshot.detectors).flat().length, 141);
  assert.equal(Object.values(snapshot.detectors).filter(types => types.length > 1).length, 16, 'the 16 shared detectors');
});

test('every arrival finding-type pair names a type the snapshot holds', () => {
  for (const [detector, types] of Object.entries(arrivalFindingTypes)) for (const type of Object.keys(types)) assert.ok(snapshot.detectors[detector]?.includes(type), `${detector} ${type}`);
});

test('the rule: no detector is empty, an arrival id keys its one pair, a detector id keys the types the table does not take away', () => {
  assert.deepEqual(findingTypesFor([]), []);
  assert.deepEqual(findingTypesFor(['slack-app-level-token']), [{ detector: 'slack-token', type: 'slack_app_level_token', basis: 'arrival-finding-type-table' }]);
  assert.deepEqual(findingTypesFor(['slack-token']), [{ detector: 'slack-token', type: 'slack_token', basis: 'remaining-types-of-detector' }]);
  assert.deepEqual(findingTypesFor(['generic-token']).map(key => key.type), ['authorization_credential', 'contextual_secret', 'vendor_prefixed_credential']);
  assert.deepEqual(findingTypesFor(['ai21-api-key']), [{ detector: 'ai21-api-key', type: 'ai21_api_key', basis: 'sole-type-of-detector' }]);
  assert.equal(findingTypesFor(['no-such-detector']), null, 'an ungrounded key is unset, never guessed');
  assert.equal(findingTypesFor(['a', 'b']), null);
});

test('every detector-bearing taxonomy family has a grounded key, and together the keys own every one of the 141 finding types', () => {
  const owned = new Set();
  for (const family of taxonomy.families) {
    if (!family.detectors.length) continue;
    const key = findingTypesFor([family.detectors[0]]);
    assert.ok(key && key.length, `${family.id} (${family.detectors[0]})`);
    for (const k of key) owned.add(`${k.detector} ${k.type}`);
  }
  const all = Object.entries(snapshot.detectors).flatMap(([detector, types]) => types.map(type => `${detector} ${type}`));
  assert.deepEqual(all.filter(pair => !owned.has(pair)), [], 'no finding type is left without a matrix row');
});

test('a finding-type key the product inventory does not hold, or a key on a row with no detector, is refused', () => {
  assert.equal(supportMatrixProblem(matrixWith()), null);
  const unknown = matrixWith(matrix => { matrix.families.find(f => f.family === detectedFamily.id).findingTypes = [{ detector: 'slack-token', type: 'not_a_type', basis: 'sole-type-of-detector' }]; });
  assert.match(supportMatrixProblem(unknown), /finding type the product inventory does not hold|has no detector/);
  const nodet = matrixWith(matrix => { matrix.families[0].findingTypes = [{ detector: 'slack-token', type: 'slack_token', basis: 'sole-type-of-detector' }]; });
  assert.match(supportMatrixProblem(nodet), /no detector but a finding-type key/);
  const unset = matrixWith(matrix => { matrix.families[0].findingTypes = null; });
  assert.equal(supportMatrixProblem(unset), null, 'an unset key is allowed and visible');
});

test('the six PII families carry exactly the Beta.11 disposition: 5 provisional, us-ssn pending, none stable', () => {
  const rows = Object.fromEntries(piiSection.piiFamilies.map(row => [row.family, row]));
  assert.deepEqual(Object.keys(rows).sort(), ['pii:global:email', 'pii:global:iban', 'pii:global:network-address', 'pii:global:payment-card', 'pii:global:phone', 'pii:us:ssn']);
  for (const id of ['pii:global:email', 'pii:global:iban', 'pii:global:network-address', 'pii:global:payment-card', 'pii:global:phone']) {
    assert.equal(rows[id].status, 'provisional', id);
    assert.deepEqual(rows[id].failedGates, [], id);
    assert.equal(rows[id].gates.protected.state, 'met');
  }
  assert.equal(rows['pii:us:ssn'].status, 'pending');
  assert.deepEqual(rows['pii:us:ssn'].failedGates, ['protected-partition']);
  assert.equal(rows['pii:us:ssn'].reason, 'protected-gates-not-met:identity-only-classification');
  assert.equal(rows['pii:us:ssn'].coverage.jurisdiction, 'US');
  assert.equal(rows['pii:global:phone'].coverage.restriction, 'nanp-country-code-1');
  assert.deepEqual(piiSection.piiDistribution, { stable: 0, provisional: 5, pending: 1, unsupported: 0 });
  assert.deepEqual(rows['pii:global:email'].findingTypes, ['pii_global_email']);
  assert.deepEqual(rows['pii:us:ssn'].findingTypes, ['pii_jurisdiction_us_ssn']);
  for (const row of piiSection.piiFamilies) assert.deepEqual(row.gates.public.acceptedTradeoffs, ['profile-cost:beta11-8b6a5fd-pii-profile-cost']);
});

test('the PII identity is the Beta.11 qualification and says it has not been re-qualified', () => {
  const q = piiSection.piiQualification;
  assert.equal(q.qualifiedAt.coreCommit, '8b6a5fde52ecb4dfce13f09c7a947062d21483c7');
  assert.equal(q.qualifiedAt.epoch, '17dae942ee4b');
  assert.equal(q.benchmarks.recordRevision, PII_RECORD_REVISION);
  assert.equal(q.maximumStatus, 'provisional');
  assert.equal(q.requalification.state, 'not-requalified');
  assert.equal(q.requalification.requalifiedOnCoreCommit, null);
  assert.equal(q.requalification.statement, PII_REQUALIFICATION_STATEMENT);
  assert.match(q.requalification.statement, /not been re-qualified/);
});

test('the PII record revision names a benchmarks commit that holds the same aggregate disposition (skipped without that history)', async t => {
  let blob;
  try { blob = execFileSync('git', ['show', `${PII_RECORD_REVISION}:${piiSection.piiQualification.disposition}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch { t.skip('history not available'); return; }
  assert.equal(createHash('sha256').update(blob).digest('hex'), createHash('sha256').update(await read(piiSection.piiQualification.disposition)).digest('hex'));
});

test('PII rows stay out of the credential counts, and a PII claim above the record is refused', () => {
  const matrix = matrixWith();
  assert.equal(supportMatrixProblem(matrix), null);
  assert.equal(matrix.familyCount, taxonomy.families.length);
  assert.ok(matrix.families.every(row => !row.family.startsWith('pii:')));
  const stable = matrixWith(m => { m.piiFamilies[0].status = 'stable'; });
  assert.equal(supportMatrixProblem(stable), 'Invalid support-matrix contract');
  const promoted = matrixWith(m => { const ssn = m.piiFamilies.find(r => r.family === 'pii:us:ssn'); ssn.status = 'provisional'; m.piiDistribution = { stable: 0, provisional: 6, pending: 0, unsupported: 0 }; });
  assert.match(supportMatrixProblem(promoted), /provisional with a gate not met/);
  const miscount = matrixWith(m => { m.piiDistribution.provisional = 4; });
  assert.match(supportMatrixProblem(miscount), /PII distribution does not recount/);
  const requalified = matrixWith(m => { m.piiQualification.requalification.state = 'not-requalified'; m.piiQualification.requalification.requalifiedOnCoreCommit = 'a'.repeat(40); });
  assert.equal(supportMatrixProblem(requalified), 'Invalid support-matrix contract');
});
