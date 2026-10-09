// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { BUDGET_NOTE, encodeFixtureDisplay, displayDigest, type FixtureDisplay } from '../../../benchmarks/lib/fixture-display';
import { bridgeQualificationView, withFixtureDisplay } from '../../services/credential-bridge';
import { buildSuiteRecords, resolveFixtureRecord } from '../../resolvers/fixtures';
import { syntheticView } from './qualification-data';

function setup() {
  const view = syntheticView();
  const population = view.populations.find(p => p.role === 'floors-and-gates')!;
  const c = population.cases.find(c => c.id.endsWith('--a-positive'))!;
  c.results.find(r => r.scanner === 'redact-secret')!.reported = [{ start: 3, end: 9, action: 'redact' }];
  const bridged = bridgeQualificationView(view, { taxonomy: { schemaVersion: 1, providers: [], families: [] } as any, detectorTitles: new Map(), accounting: { version: '1.1', minDenominator: 1, resolvedRateFloor: { default: 0.9 }, measurableShareFloor: { default: 0.5 }, twinCoverageFloor: { default: 0.5 }, replays: 2, intervalZ: 1.96, intervalPrecision: 6 } as any, recordedOn: null });
  if ('problem' in bridged) throw new Error(bridged.problem);
  const e = population.artifact.evidence;
  const content = 'xx=secret text\n';
  const description = 'records/scenarios/synthetic-scenario.json';
  const assessment = 'records/fixtures/synthetic.json#evidence';
  const file: FixtureDisplay = {
    schema: 'redact-secret/fixture-display/v1',
    source: { repository: 'redact-secret/credential-evidence', tag: e.release!.tag, manifestDigest: e.release!.manifest_digest, corpusDigest: e.corpus_digest, sourceCommit: '0'.repeat(40), recordsBundle: { asset: 'records-bundle.json', sha256: '0'.repeat(64) }, materializedManifest: { asset: 'fixtures-materialized-manifest.json', sha256: '0'.repeat(64), digest: '0'.repeat(64) }, snapshot: { asset: 'credential-eval-corpus-snapshot.json', sha256: '0'.repeat(64) } },
    descriptions: { [description]: { kind: 'scenario', title: 'A synthetic scenario', description: 'Checks a synthetic assignment.', lifecycle: 'draft', record: description, sha256: '0'.repeat(64) } },
    assessments: { [assessment]: { reason: 'The value was constructed for this fixture.', sources: ['https://example.invalid/docs'], record: 'records/fixtures/synthetic.json', sha256: '0'.repeat(64) } },
    fixtures: { [c.id]: { path: c.path, kind: c.kind, tier: c.tier, group: c.group, expected: c.expected, content, sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content), description, assessment } },
    digest: '',
  };
  file.digest = displayDigest(file);
  const detail = (value: unknown = file) => {
    const display = withFixtureDisplay(bridged.fixtureBytes, value, population);
    const suite = bridged.catalog.suites.find(s => s.id === c.id.split('--')[0])!;
    const records = buildSuiteRecords({ suite, fixtures: bridged.catalog.fixturesBySuite.get(suite.id)!, bytes: display.fixtureBytes, hashes: new Map([[c.id, file.fixtures[c.id].sha256]]), scanners: bridged.run.scanners, findings: [], detectorTitles: new Map(), familyNames: new Map(), providerNames: new Map(), scenarioTitles: new Map() });
    const record = records.records.find(r => r.id === 'a-positive')!;
    return { display, record, fixture: resolveFixtureRecord(record, records.shared, records.records) };
  };
  return { file, population, bridged, c, detail, content };
}

test('verified synthetic inputs, reported ranges, scenario description and fixture rationale reach the detail', () => {
  const { detail, content, bridged } = setup();
  const before = JSON.stringify(bridged.run.summary);
  const { display, record, fixture } = detail();
  expect(record.content).toBe(content);
  expect(record.noContent).toBeUndefined();
  expect(fixture.input).toBeDefined();
  expect(fixture.output).toBeDefined();
  expect(fixture.escaped).toBe(JSON.stringify(content));
  expect(fixture.actions.download).toBeDefined();
  expect(fixture.twins?.items.every(t => t.file === undefined)).toBe(true);
  expect(fixture.head.title).toBe('a-positive');
  expect(fixture.facts.find(f => f.term === 'What it tests (scenario)')).toMatchObject({ value: 'Checks a synthetic assignment.' });
  expect(fixture.facts.find(f => f.value === 'The value was constructed for this fixture.')?.note).toContain('records/fixtures/synthetic.json');
  expect(fixture.sources).toEqual([{ href: 'https://example.invalid/docs', label: 'example.invalid/docs' }]);
  expect(display.fixtureBytes.get(record.id)).toBeUndefined();
  expect(JSON.stringify(bridged.run.summary)).toBe(before);
});

test('missing, stale and corrupt display evidence supplies no input, output or invented explanation', () => {
  const { detail, file, population, c } = setup();
  const stale = structuredClone(file);
  stale.source.tag = 'snapshot-other'; stale.digest = displayDigest(stale);
  const corrupt = structuredClone(file); corrupt.fixtures[Object.keys(corrupt.fixtures)[0]].content = 'wrong';
  for (const value of [undefined, stale, corrupt]) {
    const { fixture } = detail(value === undefined ? null : value);
    expect(fixture.input).toBeUndefined();
    expect(fixture.output).toBeUndefined();
    expect(fixture.actions.download).toBeUndefined();
    expect(fixture.bytesNote).toContain('unavailable');
    expect(fixture.facts.find(f => f.term === 'What it tests')).toMatchObject({ notRecorded: true });
  }
  const restored = detail().display.fixtureBytes;
  const refused = withFixtureDisplay(restored, stale, population).fixtureBytes.get(c.id)!;
  expect(refused.content).toBe('');
  expect(refused.assessment.reason).toBeUndefined();
  expect(refused.scenarioDescription).toBeUndefined();
});

test('the per-fixture join refuses a different path or expected spans without discarding other measured results', () => {
  const { file, c, detail } = setup();
  for (const over of [{ path: 'other.txt' }, { expected: [] }, { group: 'other-group' }]) {
    const other = structuredClone(file); Object.assign(other.fixtures[c.id], over); other.digest = displayDigest(other);
    const { fixture } = detail(other);
    expect(fixture.input).toBeUndefined();
    expect(fixture.bytesNote).toContain('No display evidence matches');
    expect(fixture.spans.length).toBeGreaterThan(0);
  }
});

test('a large suite states the display limit and retains its recorded rationale', () => {
  const { file, c, detail } = setup();
  delete file.fixtures[c.id].content; file.digest = displayDigest(file);
  const { fixture } = detail();
  expect(fixture.input).toBeUndefined();
  expect(fixture.bytesNote).toBe(BUDGET_NOTE);
  expect(fixture.facts.some(f => f.value === 'The value was constructed for this fixture.')).toBe(true);
});

test('restored input does not invent scanner offsets in a historical run', () => {
  const { file, population, c, bridged } = setup();
  delete c.results.find(r => r.scanner === 'redact-secret')!.reported;
  const original = bridged.fixtureBytes;
  const display = withFixtureDisplay(original, file, population);
  const built = display.fixtureBytes.get(c.id)!;
  const row = bridged.run.scanners.find(s => s.id === 'redact-secret')!.rows!.get(c.id)!;
  delete row.actual;
  const suite = bridged.catalog.suites[0];
  const records = buildSuiteRecords({ suite, fixtures: bridged.catalog.fixturesBySuite.get(suite.id)!, bytes: display.fixtureBytes, hashes: new Map(), scanners: bridged.run.scanners, findings: [], detectorTitles: new Map(), familyNames: new Map(), providerNames: new Map(), scenarioTitles: new Map() });
  const fixture = resolveFixtureRecord(records.records.find(r => r.id === built.id)!, records.shared);
  expect(fixture.input).toBeDefined();
  expect(fixture.output).toBeUndefined();
  expect(fixture.outputNote).toContain('not its reported offsets');
});


test('encoded display transport reaches the same detail and corrupt transport exposes no stale input', () => {
  const { file, detail } = setup();
  const encoded = encodeFixtureDisplay(file);
  expect(detail(encoded).record).toEqual(detail(file).record);
  expect(detail(encoded).fixture).toEqual(detail(file).fixture);
  const refused = detail({ ...encoded, payload: encoded.payload + '\n' });
  expect(refused.record.noContent).toBe(true);
  expect(refused.fixture.input).toBeUndefined();
  expect(refused.fixture.bytesNote).toContain('unavailable');
});
