import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { contracts } from '../benchmarks/lib/assessment.ts';
import {
  fixtureProfiles, validateFixtureProfiles, measureFixtureCells, assessProfile, profileClaim, fixtureProfileReport, PROFILE_IDS,
} from '../benchmarks/support/profiles.ts';
import { classifyFamilySupport } from '../benchmarks/support/status.ts';
import { buildFixtureProfileCoverage, renderFixtureProfileCoverage, profileCriteriaTable } from '../benchmarks/support/profile-report.ts';

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

/** A family's cells at exactly a profile's floors. */
const cellsAt = id => {
  const c = fixtureProfiles.profiles[id].cells;
  const axes = n => Array.from({ length: n ?? 0 }, (_, i) => `axis-${i}`);
  return {
    totalFixtures: c.totalFixtures, positiveCases: c.positiveCases, benignControls: c.benignControls, twinPairs: c.twinPairs,
    positiveContextAxes: c.positiveContextAxes ?? 4, controlAxes: c.controlAxes ?? 4, confusionAxes: c.confusionAxes ?? 6,
    positiveContextAxisIds: axes(c.positiveContextAxes), controlAxisIds: axes(c.controlAxes), confusionAxisIds: axes(c.confusionAxes),
  };
};
const evidence = (over = {}) => ({
  family: 'example-token', detectors: ['example-token'], positiveContractTier: 'T1', hasProviderSource: true,
  evidenceBasis: 'provider-documented', observationCount: 0, observationSubjects: 0, observationIssuanceDates: 0, corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [],
  unresolvedContradictions: 0, boundedContradictions: 0, uncertainty: null, supportedContexts: [], empiricalMode: null, supportsBareValues: false,
  positiveCases: 6, positiveAxes: 4, controlAxes: 4, totalFixtures: 24, contextTwinPairs: 0, confusionAxes: 0,
  twinPairs: 5, twinFailures: 0, benignCases: 8, benignAxes: 3, benignAxisIds: ['near-miss', 'placeholder', 'reference'], benignFalseAlarms: 0,
  metamorphicCriticalFailures: 0, mutationUnresolvedCritical: 0, differentialUnresolvedContractDisagreements: 0, ...over,
});
const withProfile = (claim, cells, extra = {}) => ({ fixtureProfile: { claim, cells, ...extra } });
const enforcedDocumented = () => { const p = clone(fixtureProfiles); p.profiles['stable-documented'].enforcement = 'enforced'; return p; };

test('fixture-profiles.json is versioned, satisfies its schema and states the 24/24/40/48 profiles', async () => {
  const validate = new Ajv({ strict: true }).compile(JSON.parse(await read('schemas/fixture-profiles-v1.json')));
  assert.ok(validate(fixtureProfiles), JSON.stringify(validate.errors));
  assert.equal(fixtureProfiles.schemaVersion, 1);
  assert.ok(Number.isInteger(fixtureProfiles.profilesVersion));
  const p = fixtureProfiles.profiles;
  assert.deepEqual(PROFILE_IDS, ['arrival-provisional', 'stable-documented', 'stable-empirical', 'context-constrained-empirical']);
  assert.deepEqual(p['arrival-provisional'].cells, { totalFixtures: 24, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4 });
  assert.deepEqual(p['stable-documented'].cells, p['arrival-provisional'].cells);
  assert.equal(p['stable-documented'].requiresEvidenceTier, 'T1');
  assert.deepEqual(p['stable-empirical'].cells, { totalFixtures: 40, positiveCases: 10, benignControls: 14, twinPairs: 8, positiveContextAxes: 6, controlAxes: 5 });
  assert.equal(p['context-constrained-empirical'].cells.totalFixtures, 48);
  assert.equal(p['context-constrained-empirical'].cells.twinPairs, 10);
  assert.equal(p['context-constrained-empirical'].cells.confusionAxes, 6);
  assert.equal(p['context-constrained-empirical'].bareValueSupport, false);
  assert.equal(p['context-constrained-empirical'].requiresSupportedContext, true);
  for (const id of ['arrival-provisional', 'stable-documented', 'stable-empirical']) {
    const c = p[id].cells;
    assert.equal(c.positiveCases + c.benignControls + 2 * c.twinPairs, c.totalFixtures, `${id}: cells add up to the total`);
  }
});

test('validateFixtureProfiles rejects a profile whose cell could be empty or that hides its empirical gates', () => {
  assert.deepEqual(validateFixtureProfiles(fixtureProfiles), fixtureProfiles);
  const noCell = clone(fixtureProfiles); delete noCell.profiles['stable-empirical'].cells.benignControls;
  assert.throws(() => validateFixtureProfiles(noCell), /benignControls/);
  const noGates = clone(fixtureProfiles); noGates.profiles['stable-empirical'].gates.pending = [];
  assert.throws(() => validateFixtureProfiles(noGates), /pending gates/);
  const noTier = clone(fixtureProfiles); noTier.profiles['context-constrained-empirical'].requiresEvidenceTier = 'T1';
  assert.throws(() => validateFixtureProfiles(noTier), /T2/);
});

const fx = (id, over = {}) => ({ id, group: 'g', expected: [{ start: 0, end: 1 }], ...over });
const kase = (category, fixture, over = {}) => ({ id: `${category}--${fixture.id}--differential`, method: 'differential', targets: ['fam'], source: { category }, seed: fixture, ...over });

test('measureFixtureCells counts each evidence cell separately and counts a pair once as two fixtures', () => {
  const cases = [
    kase('c', fx('p1', { group: 'env' })), kase('c', fx('p1-twin', { twinOf: 'p1', mutationKind: 'length', expected: [] })),
    kase('c', fx('p2', { group: 'json' })),
    kase('c', fx('b1', { expected: [] })), kase('c', fx('b2', { expected: [] })),
    { id: 'c--b1--benign', method: 'benign', targets: ['fam'], taxonomy: 'placeholder', source: { category: 'c' }, seed: fx('b1', { expected: [] }) },
    { id: 'c--b2--benign', method: 'benign', targets: ['fam'], taxonomy: 'pending', source: { category: 'c' }, seed: fx('b2', { expected: [] }) },
    kase('c', fx('other', { group: 'other' }), { targets: ['someone-else'] }),
  ];
  const cells = measureFixtureCells('fam', cases);
  assert.equal(cells.totalFixtures, 5);
  assert.equal(cells.twinPairs, 1);
  assert.equal(cells.positiveCases, 1, 'the paired positive belongs to the pair, not to the positive/context cell');
  assert.equal(cells.benignControls, 2);
  assert.deepEqual(cells.controlAxisIds, ['placeholder'], 'the unscored pending axis never counts');
  assert.deepEqual(cells.positiveContextAxisIds, ['env', 'json']);
  assert.deepEqual(cells.confusionAxisIds, ['placeholder', 'twin:length']);
});

test('a large total cannot hide an empty cell', () => {
  const cells = { ...cellsAt('stable-empirical'), totalFixtures: 200, benignControls: 0, controlAxes: 0 };
  const debt = assessProfile(cells, 'stable-empirical').debt.map(d => d.cell);
  assert.deepEqual(debt, ['benignControls', 'controlAxes']);
  assert.equal(assessProfile(cellsAt('stable-empirical'), 'stable-empirical').cellsMet, true);
});

test('the real corpus is measured for every registered family and the debt is reported, not hidden', async () => {
  const report = buildFixtureProfileCoverage(await loadCases(createOperators()));
  assert.equal(report.familyCount, Object.keys(contracts).length);
  for (const family of report.families) {
    const target = family.target;
    assert.equal(family.debt.length === 0, family.cellsMet.includes(target), `${family.family}: debt agrees with the profile it targets`);
  }
});

test('classification: reported profiles leave a status untouched, an explicit claim fails closed', () => {
  const thin = { ...cellsAt('stable-documented'), positiveCases: 0, benignControls: 5 };
  const implicit = evidence(withProfile(profileClaim({ tier: 'T1', providerSource: {} }), thin));
  assert.equal(classifyFamilySupport(implicit).status, 'stable', 'stable-documented is reported, so measured debt changes no existing status');
  const claimed = evidence(withProfile({ profile: 'stable-documented', explicit: true }, thin));
  const result = classifyFamilySupport(claimed);
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => /fixtureProfile stable-documented: 0 positive\/context cases < 6 \(6 short\)/.test(r)), result.reasons.join('\n'));
  assert.ok(result.reasons.some(r => /5 non-twin benign controls < 8/.test(r)));
  assert.equal(classifyFamilySupport(evidence(withProfile({ profile: 'stable-documented', explicit: true }, cellsAt('stable-documented')))).status, 'stable');
});

test('classification: a profile whose enforcement is enforced gates every family that measures against it, and an unmeasured family fails closed', () => {
  const profiles = enforcedDocumented();
  const thin = { ...cellsAt('stable-documented'), twinPairs: 2 };
  assert.equal(classifyFamilySupport(evidence(withProfile({ profile: 'stable-documented', explicit: false }, thin)), undefined, profiles).status, 'provisional');
  assert.equal(classifyFamilySupport(evidence(withProfile({ profile: 'stable-documented', explicit: false }, cellsAt('stable-documented'))), undefined, profiles).status, 'stable');
  const unmeasured = classifyFamilySupport(evidence(), undefined, profiles);
  assert.equal(unmeasured.status, 'provisional');
  assert.match(unmeasured.reasons.join('\n'), /not measured/);
});

test('empirical profiles: T2 meeting every cell stays provisional without corroboration, qualifies with it, and never masquerades as T1', () => {
  const t2 = evidence({ positiveContractTier: 'T2', hasProviderSource: false, twinPairs: 8, benignCases: 14 });
  const meets = withProfile({ profile: 'stable-empirical', explicit: true }, cellsAt('stable-empirical'));
  const result = classifyFamilySupport({ ...t2, ...meets });
  assert.equal(result.status, 'provisional');
  assert.ok(result.reasons.some(r => /empirical.corroborated.minimumReferences: 0 < 3/.test(r)), 'no corroboration, no qualifying route');
  assert.ok(!result.reasons.some(r => /not enforced yet/.test(r)), 'the #177/#205 gates are enforced by the classifier now');
  const corroborated = { corroborationReferences: 3, corroborationOwners: 3, corroborationClasses: ['peer-scanner-rule', 'provider-example'], evidenceBasis: 'independently-corroborated', uncertainty: 'Corroborated only.', supportedContexts: ['assignment'], empiricalMode: 'shape', positiveCases: 10, positiveAxes: 6, controlAxes: 5, benignAxes: 5, totalFixtures: 40 };
  assert.equal(classifyFamilySupport({ ...t2, ...corroborated, ...meets }).status, 'stable', 'the claimed profile, corroboration and zero failures qualify it');
  assert.ok(!result.reasons.some(r => /requires T2 evidence/.test(r)), 'T2 satisfies the empirical tier requirement');
  const t1 = classifyFamilySupport({ ...evidence(), ...meets });
  assert.match(t1.reasons.join('\n'), /requires T2 evidence, the contract is T1; evidence tier is provenance and is never relabelled/);
  const t3 = classifyFamilySupport({ ...evidence({ positiveContractTier: 'T3', hasProviderSource: false }), ...meets });
  assert.notEqual(t3.status, 'stable');
  assert.match(t3.reasons.join('\n'), /requires T2 evidence, the contract is T3/);
});

test('context-constrained profile: no supported context is a failure and the value stays unsupported bare', () => {
  const t2 = evidence({ positiveContractTier: 'T2', hasProviderSource: false });
  const cells = cellsAt('context-constrained-empirical');
  const bare = classifyFamilySupport({ ...t2, ...withProfile({ profile: 'context-constrained-empirical', explicit: true }, cells) });
  assert.match(bare.reasons.join('\n'), /no supported context/);
  const named = classifyFamilySupport({ ...t2, ...withProfile({ profile: 'context-constrained-empirical', explicit: true }, cells, { supportedContext: ['env-assignment'] }) });
  assert.doesNotMatch(named.reasons.join('\n'), /no supported context/);
  assert.match(named.reasons.join('\n'), /empirical.corroborated.minimumReferences/, 'still gated on #177 corroboration');
  assert.doesNotMatch(named.reasons.join('\n'), /not enforced yet/);
  const thin = classifyFamilySupport({ ...t2, ...withProfile({ profile: 'context-constrained-empirical', explicit: true }, { ...cells, twinPairs: 4, confusionAxes: 2 }, { supportedContext: ['x'] }) });
  assert.match(thin.reasons.join('\n'), /4 twin pairs < 10 \(6 short\)/);
  assert.match(thin.reasons.join('\n'), /2 confusion axes < 6/);
});

test('profileClaim: explicit wins, T1 provider-documented and T2 with an empirical record are implicit, everything else claims nothing', () => {
  assert.deepEqual(profileClaim({ tier: 'T2', fixtureProfile: 'stable-empirical' }), { profile: 'stable-empirical', explicit: true });
  assert.deepEqual(profileClaim({ tier: 'T1', providerSource: {} }), { profile: 'stable-documented', explicit: false });
  assert.deepEqual(profileClaim({ tier: 'T2' }), { profile: null, explicit: false });
  assert.deepEqual(profileClaim({ tier: 'T2' }, 'shape'), { profile: 'stable-empirical', explicit: false }, 'an empirical record binds the 40-fixture profile');
  assert.deepEqual(profileClaim({ tier: 'T2' }, 'context-constrained'), { profile: 'context-constrained-empirical', explicit: false });
  assert.deepEqual(profileClaim({ tier: 'T3' }, 'shape'), { profile: null, explicit: false }, 'a T3 family never claims an empirical profile');
  assert.deepEqual(fixtureProfileReport({ profile: null, explicit: false }, cellsAt('arrival-provisional')).cellsMet, ['arrival-provisional', 'stable-documented']);
});

test('published profile coverage carries target requirements and required empty axis identifiers', () => {
  const cells = { ...cellsAt('arrival-provisional'), controlAxes: 0, controlAxisIds: [] };
  const report = fixtureProfileReport({ profile: null, explicit: false }, cells);
  assert.deepEqual(report.requiredCells, fixtureProfiles.profiles['arrival-provisional'].cells);
  assert.ok(report.requiredButEmptyAxisIds.includes('controlAxes'));
  assert.deepEqual(report.cells.positiveContextAxisIds, cells.positiveContextAxisIds, 'tested axis ids remain in the published report');
  assert.ok(report.debt.some(item => item.cell === 'controlAxes'));
});

test('generated coverage report and the spec criteria table are current (CI drift gate)', async () => {
  const report = buildFixtureProfileCoverage(await loadCases(createOperators()));
  assert.equal(await read('docs/generated/fixture-profile-coverage.json'), JSON.stringify(report, null, 2) + '\n');
  assert.equal(await read('docs/generated/fixture-profile-coverage.md'), renderFixtureProfileCoverage(report));
  assert.ok((await read('docs/specs/support-status.md')).includes(`<!-- fixture-profiles:begin -->\n${profileCriteriaTable()}\n<!-- fixture-profiles:end -->`));
});
