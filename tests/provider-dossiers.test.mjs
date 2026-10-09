import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildProviderDossiers, defaultInputs, STAGES } from '../benchmarks/generate-provider-dossiers.ts';
import { providerDossiersProblem, stageOf } from '../benchmarks/shared/providers-model.ts';

const criteria = JSON.parse(readFileSync(new URL('../benchmarks/support/status-criteria.json', import.meta.url), 'utf8'));
const floors = criteria.stable.documented;
const metCells = { totalFixtures: 30, positiveCases: floors.minimumPositiveCases.value, twinPairs: floors.minimumTwinPairs.value, benignControls: floors.minimumBenignCases.value, positiveContextAxes: floors.minimumPositiveAxes.value, controlAxes: floors.minimumControlAxes.value };

const taxonomy = {
  schemaVersion: 1,
  providers: [{ id: 'acme', name: 'Acme' }],
  families: [
    { id: 'acme:deploy-token', provider: 'acme', name: 'Deploy token', detectors: ['acme-deploy'] },
    { id: 'acme:admin-key', provider: 'acme', name: 'Admin key', detectors: [] },
    { id: 'acme:legacy-key', provider: 'acme', name: 'Legacy key', detectors: ['acme-legacy'] },
    { id: 'generic:jwt', provider: null, name: 'JSON Web Token', detectors: [] },
  ],
};
const dossier = `---
provider: acme
families:
  - id: acme:deploy-token
    research:
      verdict: ready
      tier: T1
      sources:
        - https://docs.acme.invalid/tokens
      issues:
        - acme/research#7
      evidence: null
      researchedAt: 2026-09-20
    blockedBy: null
  - id: acme:admin-key
    research:
      verdict: issuance-gated
      tier: T1
      sources: []
      issues:
        - acme/research#8
      evidence: null
      researchedAt: 2026-09-21
    blockedBy: Body grammar needs one issued admin key.
  - id: acme:legacy-key
    research:
      verdict: unresearched
      tier: null
      sources: []
      issues: []
      evidence: null
      researchedAt: null
    blockedBy: null
---
# Acme
`;
const generic = `---
provider: generic
families:
  - id: generic:jwt
    research:
      verdict: rejected
      tier: null
      sources: []
      issues:
        - acme/research#9
      evidence: null
      researchedAt: 2026-09-22
    blockedBy: null
---
# Generic
`;

function inputs(matrix = null) {
  const dir = mkdtempSync(join(tmpdir(), 'provider-dossiers-'));
  writeFileSync(join(dir, 'acme.md'), dossier);
  writeFileSync(join(dir, 'generic.md'), generic);
  return {
    taxonomy, dossiersDir: dir, criteria,
    detectorIds: new Set(['acme-deploy']),
    coverage: new Map([['acme-deploy', { target: 'stable-documented', cells: metCells }], ['acme-legacy', { target: 'stable-documented', cells: { ...metCells, twinPairs: 0 } }]]),
    matrix,
  };
}
const matrixOf = status => ({ sourceReport: { runId: 'run-1', generatedAt: '2026-09-29T00:00:00.000Z', revision: 'a'.repeat(40) }, families: [{ family: 'acme:deploy-token', status }] });
const byId = file => Object.fromEntries(file.providers.flatMap(p => p.families).map(f => [f.family, f]));

test('a researched but unbenchmarked, issuance-gated family is listed with its blocker and stops at researched', () => {
  const family = byId(buildProviderDossiers(inputs()))['acme:admin-key'];
  assert.equal(family.stage, 'researched');
  assert.equal(family.verdict, 'issuance-gated');
  assert.equal(family.blockedBy, 'Body grammar needs one issued admin key.');
  assert.equal(family.researchedAt, '2026-09-21');
  assert.deepEqual(family.issues, [{ ref: 'acme/research#8', url: 'https://github.com/acme/research/issues/8' }]);
  assert.deepEqual(family.reached, { researched: true, 'in-taxonomy': true, benchmarked: false, 'core-detector': false, measured: false });
});

test('stages are derived from fixtures, the inventory and the support matrix, never written', () => {
  const unmeasured = byId(buildProviderDossiers(inputs()));
  assert.equal(unmeasured['acme:deploy-token'].stage, 'core-detector');
  assert.equal(unmeasured['acme:deploy-token'].reached.benchmarked, true);
  assert.equal(unmeasured['acme:deploy-token'].supportStatus, null);
  assert.equal(unmeasured['acme:legacy-key'].stage, 'in-taxonomy');
  assert.equal(unmeasured['acme:legacy-key'].reached.benchmarked, false);
  assert.deepEqual(unmeasured['acme:legacy-key'].fixtureGaps, [{ detector: 'acme-legacy', cell: 'twinPairs', actual: 0, required: floors.minimumTwinPairs.value }]);
  assert.equal(unmeasured['generic:jwt'].stage, 'researched');

  const measured = buildProviderDossiers(inputs(matrixOf('provisional')));
  assert.equal(byId(measured)['acme:deploy-token'].stage, 'measured');
  assert.equal(measured.supportMatrix.runId, 'run-1');
  // pending / unsupported record a status but are not a measurement.
  const pending = byId(buildProviderDossiers(inputs(matrixOf('pending'))))['acme:deploy-token'];
  assert.equal(pending.stage, 'core-detector');
  assert.equal(pending.supportStatus, 'pending');
  assert.deepEqual(Object.keys(measured.stageDistribution), [...STAGES]);
  assert.equal(Object.values(measured.stageDistribution).reduce((a, b) => a + b, 0), taxonomy.families.length);
});

test('output is deterministic, holds no date forecast, and no fixture value', () => {
  const a = JSON.stringify(buildProviderDossiers(inputs(matrixOf('stable'))));
  assert.equal(a, JSON.stringify(buildProviderDossiers(inputs(matrixOf('stable')))));
  const keys = new Set([...a.matchAll(/"([A-Za-z-]+)":/g)].map(m => m[1]));
  for (const key of keys) assert.doesNotMatch(key, /^(eta|expected|forecast|deadline|targetDate|dueDate|estimate)/i);
  assert.doesNotMatch(a, /"(value|content|fixture|secret|sample)"/i);
});

test('an invalid dossier stops generation instead of publishing a partial roadmap', () => {
  const bad = inputs();
  writeFileSync(join(bad.dossiersDir, 'acme.md'), dossier.replace('verdict: ready', 'verdict: shipped'));
  assert.throws(() => buildProviderDossiers(bad), /Dossiers are invalid/);
});

test('the checked-in tree lists every taxonomy family once, and the UI validator accepts it', () => {
  const file = buildProviderDossiers(defaultInputs(null));
  assert.equal(providerDossiersProblem(file), null);
  const ids = file.providers.flatMap(p => p.families.map(f => f.family));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, JSON.parse(readFileSync(new URL('../benchmarks/support/taxonomy.json', import.meta.url), 'utf8')).families.length);
});

test('the UI validator rejects a stage the flags do not reach and a stale taxonomy', () => {
  const file = buildProviderDossiers(defaultInputs(null));
  const forged = structuredClone(file);
  const family = forged.providers.find(p => p.families.some(f => f.stage !== 'measured')).families.find(f => f.stage !== 'measured');
  family.stage = 'measured';
  assert.match(providerDossiersProblem(forged), /claims a stage/);
  const stale = structuredClone(file);
  stale.providers[0].families.pop();
  assert.match(providerDossiersProblem(stale), /count|Stale/);
  assert.equal(providerDossiersProblem({ schemaVersion: 2 }), 'Unsupported provider-dossiers version');
  assert.equal(stageOf({ researched: true, 'in-taxonomy': true, benchmarked: false, 'core-detector': false, measured: false }), 'researched');
  assert.equal(stageOf({ researched: false, 'in-taxonomy': true, benchmarked: false, 'core-detector': false, measured: false }), 'in-taxonomy');
});
