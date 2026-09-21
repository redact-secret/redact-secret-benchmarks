import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { buildSupportMatrix } from '../benchmarks/support/matrix.ts';
import { familyEvidence } from '../benchmarks/support/evidence.ts';
import { classifyFamilySupport } from '../benchmarks/support/status.ts';
import { taxonomy, familiesForDetector } from '../benchmarks/support/taxonomy.ts';
import { contracts } from '../benchmarks/lib/assessment.ts';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const schema = await read('schemas/support-matrix-v1.json');
const ajv = new Ajv({ strict: true });
const validate = ajv.compile(schema);

const emptyLedger = { schemaVersion: 1, entries: {} };

/** A full, schema-shaped `support-status.json` built from real evidence, exactly as `eval:classify` would — every registered detector, all-zero evidence. */
function fullStatusReport() {
  const families = Object.keys(contracts).sort().map(family => {
    const evidence = familyEvidence(family, {}, {}, [], emptyLedger);
    const assessment = classifyFamilySupport(evidence);
    return { ...assessment, taxonomyFamilies: familiesForDetector(family).map(f => f.id), evidence, unprobeable: contracts[family].unprobeable ?? null };
  });
  return {
    schemaVersion: 1, generatedAt: '2026-09-20T00:00:00.000Z', runId: 'test-run', revision: 'abc123', dirty: false,
    criteriaSchemaVersion: 1, families,
  };
}

test('every taxonomy family gets exactly one matrix entry', () => {
  const { families } = buildSupportMatrix(fullStatusReport());
  assert.equal(families.length, taxonomy.families.length);
  assert.equal(new Set(families.map(f => f.family)).size, families.length);
});

test('distribution sums to the taxonomy family count', () => {
  const { distribution, families } = buildSupportMatrix(fullStatusReport());
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  assert.equal(total, families.length);
});

test('a zero-detector taxonomy family is unsupported with a non-null reason and no evidence fields', () => {
  const { families } = buildSupportMatrix(fullStatusReport());
  const undetected = families.filter(f => f.detectors.length === 0);
  assert.ok(undetected.length > 0);
  for (const entry of undetected) {
    assert.equal(entry.status, 'unsupported');
    assert.ok(entry.reason && entry.reason.trim().length > 0, `${entry.family} has no reason`);
    assert.equal(entry.evidenceTier, null);
    assert.equal(entry.providerSource, null);
    assert.equal(entry.twinCoverage, null);
    assert.equal(entry.unresolvedCriticalItems, null);
    assert.deepEqual(entry.corroboratingScanners, []);
  }
});

test('a T1 detector-backed family carries its contract providerSource and corroborating scanners', () => {
  const { families } = buildSupportMatrix(fullStatusReport());
  const entry = families.find(f => f.family === 'github:classic-personal-access-token');
  assert.ok(entry);
  assert.deepEqual(entry.detectors, ['github-token']);
  assert.equal(entry.evidenceTier, 'T1');
  assert.deepEqual(entry.providerSource, contracts['github-token'].providerSource);
  assert.ok(entry.corroboratingScanners.includes('gitleaks 8.30.1'));
});

test('every entry with pending or unsupported status carries a non-null reason', () => {
  const { families } = buildSupportMatrix(fullStatusReport());
  for (const entry of families) {
    if (entry.status === 'pending' || entry.status === 'unsupported') assert.ok(entry.reason, `${entry.family} (${entry.status}) has no reason`);
  }
});

test('a family with no provider is representable (generic: formats)', () => {
  const { families } = buildSupportMatrix(fullStatusReport());
  const generic = families.find(f => f.provider === null);
  assert.ok(generic, 'no non-provider-specific family found');
});

test('regenerating from unchanged input is byte-identical', () => {
  const report = fullStatusReport();
  const first = JSON.stringify(buildSupportMatrix(report));
  const second = JSON.stringify(buildSupportMatrix(fullStatusReport()));
  assert.equal(first, second);
});

test('throws rather than defaulting when support-status.json is stale relative to the taxonomy', () => {
  const report = fullStatusReport();
  report.families = report.families.filter(f => f.family !== 'github-token');
  assert.throws(() => buildSupportMatrix(report), /github:classic-personal-access-token/);
});

test('throws when two detector results claim the same taxonomy family', () => {
  const report = fullStatusReport();
  const [a, b] = report.families;
  b.taxonomyFamilies = [...b.taxonomyFamilies, a.taxonomyFamilies[0]];
  assert.throws(() => buildSupportMatrix(report), /claimed by more than one detector result/);
});

test('a synthetic full matrix satisfies its schema', () => {
  const { distribution, families } = buildSupportMatrix(fullStatusReport());
  const matrix = {
    schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-09-20T00:00:00.000Z', runId: 'test-run', revision: 'abc123', dirty: false, criteriaSchemaVersion: 1 },
    providerCount: taxonomy.providers.length, familyCount: families.length, distribution, families,
  };
  assert.ok(validate(matrix), JSON.stringify(validate.errors));
});

test('a real support-matrix.json, if present from a prior eval:matrix run, satisfies its schema', async () => {
  let report;
  try { report = await read('results-output/support-matrix.json'); } catch { return; }
  assert.ok(validate(report), JSON.stringify(validate.errors));
  assert.equal(report.familyCount, taxonomy.families.length);
  assert.equal(new Set(report.families.map(f => f.family)).size, report.familyCount);
  const total = Object.values(report.distribution).reduce((a, b) => a + b, 0);
  assert.equal(total, report.familyCount);
});
