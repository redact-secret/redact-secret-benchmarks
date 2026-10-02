// @vitest-environment node
/**
 * The qualification view in the shapes the credential report pages read (#608). Pure: a synthetic view and a synthetic taxonomy go in,
 * a catalog and a run come out. Nothing is read from the repository, so no figure of the committed ledger or a built view is asserted;
 * every expectation is recounted here from the synthetic cases.
 */
import { describe, expect, test } from 'vitest';
import { REPORT_ROLE, bridgeQualificationView, reportPopulation, rowOf, type Bridged } from '../../services/credential-bridge';
import { resolveRunState, resolvePipelineStamp } from '../../resolvers/run';
import { syntheticView } from './qualification-data';
import type { CaseRow } from '../../services/qualification';

const taxonomy: any = {
  providers: [{ id: 'p', name: 'Provider P' }],
  families: [{ id: 'a:key', provider: 'p', name: 'Key A', description: 'x', detectors: ['family-a'], sources: [] }, { id: 'free:key', provider: null, name: 'Free', description: 'x', detectors: [], sources: [] }],
};
const accounting: any = { version: '1.1', minDenominator: 1, resolvedRateFloor: { default: 0.9 }, measurableShareFloor: { default: 0.5 }, twinCoverageFloor: { default: 0.5 }, replays: 2, intervalZ: 1.96, intervalPrecision: 6 };
const input = { taxonomy, detectorTitles: new Map([['family-a', 'Family A']]), accounting, recordedOn: '2030-01-02' };

function bridged(view = syntheticView(), over = {}): Bridged {
  const result = bridgeQualificationView(view, { ...input, ...over });
  if ('problem' in result) throw new Error(result.problem);
  return result;
}

describe('the report population', () => {
  test('is the one the population policy gives the floors and gates; a view without it is refused with the reason', () => {
    const view = syntheticView();
    expect(reportPopulation(view)?.role).toBe(REPORT_ROLE);
    view.populations.forEach(p => { p.role = 'gates'; });
    expect(bridgeQualificationView(view, input)).toMatchObject({ problem: expect.stringContaining(REPORT_ROLE) });
  });
});

describe('the catalog', () => {
  const view = syntheticView();
  const { catalog, population, fixtureBytes } = bridged(view);

  test('holds the cases of that population only, keyed by the case id, split into suites by its first segment', () => {
    expect(catalog.fixtures.map(f => f.slug).sort()).toEqual(population.cases.map(c => c.id).sort());
    for (const f of catalog.fixtures) { expect(f.slug).toBe(`${f.category}--${f.id}`); expect(catalog.suites.some(s => s.id === f.category)).toBe(true); }
  });

  test('keeps kind, level and group as the case row says, and the family only when the taxonomy knows it', () => {
    for (const c of population.cases) {
      const f = catalog.bySlug.get(c.id)!;
      expect([f.kind, f.tier, f.group]).toEqual([c.kind, c.tier, c.group]);
      const known = c.family !== null && taxonomy.families.some((x: any) => x.id === c.family);
      expect(f.familyIds).toEqual(known ? [c.family] : []);
      if (!known) expect(f.unscopedReason).toBeTruthy();
    }
  });

  test('lists the detectors the cases name, titled from the registry where it has them and by id otherwise', () => {
    const ids = [...new Set(population.cases.flatMap(c => c.detectors))].sort();
    expect(catalog.detectors.map(d => d.id)).toEqual(ids);
    expect(catalog.detectors.find(d => d.id === 'family-a')?.title).toBe('Family A');
    expect(catalog.detectors.find(d => d.id === 'family-b')?.title).toBe('family-b');
    for (const d of catalog.detectors) expect(catalog.fixturesByDetector.get(d.id)!.length).toBe(population.cases.filter(c => c.detectors.includes(d.id)).length);
  });

  test('carries no bytes: every fixture says so, with its expected spans and path', () => {
    for (const c of population.cases) {
      const b = fixtureBytes.get(c.id)!;
      expect([b.content, b.contentRecorded, b.path, b.expected]).toEqual(['', false, c.path, c.expected]);
    }
  });

  test('names a twin by its parent inside the same suite, and keeps the full slug on the catalog entry', () => {
    const twins = population.cases.filter(c => c.twinOf);
    expect(twins.length).toBeGreaterThan(0);
    for (const t of twins) {
      expect(catalog.bySlug.get(t.id)!.twinOf).toBe(t.twinOf);
      expect(fixtureBytes.get(t.id)!.twinOf).toBe(t.twinOf!.slice(t.twinOf!.indexOf('--') + 2));
    }
  });
});

describe('the run', () => {
  const view = syntheticView();
  const { run, population } = bridged(view);

  test('is measured, published, named by the run it came from, dated by the recorded run', () => {
    expect(run).toMatchObject({ state: 'measured', mode: 'published', runId: population.artifact.semanticDigest, suiteCount: expect.any(Number) });
    expect(run.generatedAt.slice(0, 10)).toBe('2030-01-02');
    expect(run.productVersion).toBe(population.artifact.scanners.find(s => s.id === 'redact-secret')!.version);
    expect([run.excludedSuites, run.staleSuites]).toEqual([[], []]);
  });

  test('has one row per measured case and scanner: a pending case says how many ranges it reported, an unmeasured one has no row', () => {
    for (const scanner of run.scanners) {
      for (const c of population.cases) {
        const result = c.results.find(r => r.scanner === scanner.id)!;
        const row = scanner.rows.get(c.id);
        if (result.measurement === 'not-measured') expect(row).toBeUndefined();
        else if (result.measurement === 'pending') expect(row).toEqual({ observed: result.observed });
        else if (result.measurement === 'control') expect(row).toMatchObject({ flagged: result.flagged, findings: result.findings });
        else expect(row).toMatchObject({ spanOutcomes: result.outcomes, leakedBytes: result.leakedBytes });
      }
    }
    expect(run.productRows).toBe(run.scanners.find(s => s.id === 'redact-secret')!.rows);
  });

  test('does not say where a reported range is: the row has a count and no offsets', () => {
    for (const scanner of run.scanners) for (const row of scanner.rows.values()) expect(row.actual).toBeUndefined();
  });

  test('accounts the groups of each scanner over its own rows, with the legacy accounting', () => {
    const own = (id: string, kind: string, tier: string) => population.cases.filter(c => c.kind === kind && c.tier === tier && c.results.find(r => r.scanner === id)!.measurement !== 'not-measured');
    for (const scanner of run.summary.scanners) {
      const groups = run.summary.overall[scanner.id] as Record<string, any>;
      const positives = own(scanner.id, 'must-redact', 'T1');
      expect(groups['must-redact/T1'].files).toBe(positives.length);
      const spans = positives.reduce((n, c) => n + c.results.find(r => r.scanner === scanner.id)!.outcomes!.length, 0);
      expect(groups['must-redact/T1'].spans).toBe(spans);
      const controls = own(scanner.id, 'must-not-flag', 'T1');
      expect(groups['must-not-flag/T1'].files).toBe(controls.length);
      expect(groups['must-not-flag/T1'].flaggedFiles).toBe(controls.filter(c => c.results.find(r => r.scanner === scanner.id)!.flagged).length);
    }
    expect(run.summary.accounting).toBe(accounting);
    expect(run.accountingVersion).toBe(run.summary.accountingVersion);
  });

  test('counts a twin pair once, from the control that names a positive that was measured', () => {
    const twins = population.cases.filter(c => c.twinOf && c.tier !== 'T0' && c.kind === 'must-not-flag');
    const groups = run.summary.overall['alpha-lib'] as Record<string, any>;
    expect(groups['must-redact/T1'].twins.pairs).toBe(twins.length);
  });

  test('accounts each detector over the cases that name it, and drops the diagnostics the view cannot support', () => {
    const detectors = Object.keys(run.summary.byDetector);
    expect(detectors).toEqual([...new Set(population.cases.flatMap(c => c.detectors))].sort());
    const groupsOfA = (run.summary.byDetector['family-a']['alpha-lib'] as Record<string, any>);
    expect(Object.keys(groupsOfA).length).toBeGreaterThan(0);
    const everyGroup = [...Object.values(run.summary.overall), ...Object.values(run.summary.byDetector).flatMap(d => Object.values(d))].flatMap(g => Object.values(g as Record<string, any>));
    expect(everyGroup.length).toBeGreaterThan(0);
    for (const g of everyGroup) expect(g.diagnostics).toBeUndefined();
  });

  test('a scanner that did not complete has no rows and no groups, and the run says so', () => {
    const view2 = syntheticView();
    const own = view2.populations.find(p => p.role === REPORT_ROLE)!;
    own.artifact.scanners[0].status = 'timeout';
    const { run: r } = bridged(view2);
    const s = r.scanners[0];
    expect([s.status, s.rows.size, r.summary.overall[s.id]]).toEqual(['timeout', 0, {}]);
    expect(resolveRunState(r, resolvePipelineStamp({ authority: 'new', from: 'committed', view: { state: 'ready', commands: [], population: 'x', semanticDigest: 'sha256:' + '0'.repeat(64) } }))).toMatchObject({ kind: 'measured', notes: [expect.objectContaining({ title: '1 scanner did not complete' })] });
  });
});

describe('rowOf', () => {
  test.each([
    [{ scanner: 's', measurement: 'positive', observed: 2, outcomes: ['EXACT'], leakedBytes: 0, collateralBytes: 1 }, { spanOutcomes: ['EXACT'], leakedBytes: 0, collateralBytes: 1, observed: 2 }],
    [{ scanner: 's', measurement: 'control', observed: 1, flagged: true, findings: 1 }, { flagged: true, findings: 1, observed: 1 }],
    [{ scanner: 's', measurement: 'pending', observed: 3 }, { observed: 3 }],
    [{ scanner: 's', measurement: 'not-measured', observed: 0 }, undefined],
    [undefined, undefined],
  ] as const)('maps %j', (result, row) => {
    expect(rowOf(result as any)).toEqual(row);
  });
});

test('a cross-suite twin keeps its slug on the catalog and has no twin inside its own suite', () => {
  const view = syntheticView();
  const own = view.populations.find(p => p.role === REPORT_ROLE)!;
  const twin = own.cases.find((c: CaseRow) => c.twinOf)!;
  twin.twinOf = 'another-suite--parent';
  const { catalog, fixtureBytes } = bridged(view);
  expect(catalog.bySlug.get(twin.id)!.twinOf).toBe('another-suite--parent');
  expect(fixtureBytes.get(twin.id)!.twinOf).toBeUndefined();
});
