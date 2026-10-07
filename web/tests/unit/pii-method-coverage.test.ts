// The by-method coverage of /evaluation/pii/ (#617). Synthetic populations only: no recorded count is asserted, so a repin cannot break these.
import { describe, expect, test } from 'vitest';
import { createPiiMethods } from '../../../benchmarks/evaluation/domains/pii/methods/index.ts';
import { PII_REGISTERED_METHODS, methodCoverageOf, resolvePiiMethodCoverage } from '../../resolvers/pii-method-coverage';
import type { PiiEvalMeasurement } from '../../services/domains';

type Coverage = Array<{ method: string; version?: number; cases: number; variants: number }>;
const row = (family: string, view: string, scannerId: string, coverage: Coverage, extra: { occurrences?: number } = {}) => {
  const cases = coverage.reduce((n, m) => n + m.cases, 0);
  const variants = coverage.reduce((n, m) => n + m.variants, 0);
  return {
    family, view, mode: 'official', binding: { scannerId },
    counts: { authoredCases: cases, variants, occurrences: extra.occurrences ?? variants },
    methodCoverage: coverage.map(m => ({ method: { id: m.method, version: m.version ?? 1 }, cases: m.cases, variants: m.variants })),
    metrics: [],
  };
};
const population = (id: string, rows: ReturnType<typeof row>[], views: string[], over: Record<string, unknown> = {}) => ({
  populationId: id, schemaVersion: '1.4', population: { populationId: id, populationVersion: 2, populationDigest: 'a'.repeat(64), visibility: 'public-synthetic' },
  scanners: [{ scannerId: 'scan-a', status: 'complete', metrics: [], identity: { scannerVersion: '9.9.9', product: { kind: 'candidate' } } }],
  productProjection: { requiredViews: views, rosterDigest: 'b'.repeat(64), rows }, ...over,
});
const measurement = (...populations: unknown[]) => ({ populations }) as unknown as PiiEvalMeasurement;
const tableOf = (m: PiiEvalMeasurement, index = 0) => resolvePiiMethodCoverage(m)[index] as { id: string; caption: string; columns: string[]; rows: Array<{ id: string; label: string; detail?: string; cells: Array<{ figure: string | null }> }>; note?: string };

describe('the registered method list', () => {
  test('is the registry the evaluation engine builds, in its order', () => {
    expect([...PII_REGISTERED_METHODS]).toEqual(createPiiMethods().values().map(method => method.id));
  });
});

describe('by-method coverage of a converted population', () => {
  const converted = measurement(population('pop-converted', [
    row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'schema-only', cases: 7, variants: 9 }], { occurrences: 11 }),
    row('pii:global:b', 'oracle-plan', 'scan-a', [{ method: 'schema-only', cases: 5, variants: 5 }]),
  ], ['oracle-plan']));

  test('shows the recorded method, keeps the other registered methods unavailable and never zero', () => {
    const table = tableOf(converted);
    expect(table.id).toBe('by-method:pop-converted:scan-a');
    expect(table.caption).toContain('pop-converted');
    expect(table.caption).toContain('scan-a 9.9.9');
    expect(table.caption).toContain('Official run');
    expect(table.caption).toContain('Candidate');
    const methodRows = table.rows.filter(r => !r.id.endsWith(':authored'));
    expect(methodRows).toHaveLength(PII_REGISTERED_METHODS.length);
    const recorded = methodRows.filter(r => r.cells[0].figure !== null);
    expect(recorded.map(r => r.label)).toEqual(['Oracle plan · schema-only v1']);
    expect(recorded[0].cells.map(c => c.figure)).toEqual(['12', '14']);
    expect(recorded[0].detail).toContain('not a run of the other registered methods');
    const missing = methodRows.filter(r => r.cells[0].figure === null);
    expect(missing).toHaveLength(PII_REGISTERED_METHODS.length - 1);
    expect(missing.every(r => r.cells[1].figure === null && r.detail?.includes('records no cases'))).toBe(true);
    expect(JSON.stringify(table)).not.toMatch(/\bzero\b/i);
  });

  test('keeps authored cases, variants and occurrences apart, and the methods reconcile with the view', () => {
    const table = tableOf(converted);
    const authored = table.rows.find(r => r.id === 'oracle-plan:authored')!;
    expect(authored.cells.map(c => c.figure)).toEqual(['12', '14']);
    expect(authored.detail).toContain('16 occurrences');
    expect(table.columns).toEqual(['Authored cases', 'Variants']);
    const [view] = methodCoverageOf(converted.populations[0].productProjection!, 'scan-a');
    expect(view.reconciles).toBe(true);
    expect(view.methods.reduce((n, m) => n + m.cases, 0)).toBe(view.authoredCases);
    expect(view.methods.reduce((n, m) => n + m.variants, 0)).toBe(view.variants);
    expect(view.occurrences).toBe(16);
  });
});

describe('by-method coverage across methods, views, populations and scanners', () => {
  test('adds rows within one view only and never across views or populations', () => {
    const multi = measurement(
      population('pop-one', [
        row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'type-validation', cases: 3, variants: 4 }, { method: 'mutation', cases: 2, variants: 6 }]),
        row('pii:global:b', 'oracle-plan', 'scan-a', [{ method: 'type-validation', cases: 4, variants: 4 }]),
        row('pii:global:a', 'qualification-plan', 'scan-a', [{ method: 'type-validation', cases: 3, variants: 4 }]),
      ], ['oracle-plan', 'qualification-plan']),
      population('pop-two', [row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'type-validation', cases: 3, variants: 4 }])], ['oracle-plan']),
    );
    const tables = resolvePiiMethodCoverage(multi);
    expect(tables).toHaveLength(2);
    const one = tables[0] as ReturnType<typeof tableOf>;
    const figure = (id: string) => one.rows.find(r => r.id === id)!.cells.map(c => c.figure);
    expect(figure('oracle-plan:type-validation:1')).toEqual(['7', '8']);
    expect(figure('qualification-plan:type-validation:1')).toEqual(['3', '4']);
    expect(figure('oracle-plan:mutation:1')).toEqual(['2', '6']);
    expect(figure('oracle-plan:authored')).toEqual(['9', '14']);
    expect(figure('qualification-plan:authored')).toEqual(['3', '4']);
    const two = tables[1] as ReturnType<typeof tableOf>;
    expect(two.rows.find(r => r.id === 'oracle-plan:type-validation:1')!.cells.map(c => c.figure)).toEqual(['3', '4']);
    expect(one.note).toContain('no figure is added across them');
  });

  test('a scanner gets its own table and its rows are never merged with another scanner', () => {
    const two = population('pop', [
      row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'schema-only', cases: 3, variants: 3 }]),
      row('pii:global:a', 'oracle-plan', 'scan-b', [{ method: 'schema-only', cases: 3, variants: 3 }]),
    ], ['oracle-plan'], { scanners: [
      { scannerId: 'scan-a', identity: { scannerVersion: '1', product: { kind: 'released' } } },
      { scannerId: 'scan-b', identity: { scannerVersion: '2', product: { kind: 'candidate' } } },
    ] });
    const tables = resolvePiiMethodCoverage(measurement(two)) as Array<ReturnType<typeof tableOf>>;
    expect(tables.map(t => t.id)).toEqual(['by-method:pop:scan-a', 'by-method:pop:scan-b']);
    expect(tables[0].caption).toContain('Released');
    expect(tables[1].caption).toContain('Candidate');
    expect(tables.every(t => t.rows.find(r => r.id === 'oracle-plan:authored')!.cells[0].figure === '3')).toBe(true);
  });

  test('rows of one scanner in two run modes get a table per mode and are never added together', () => {
    const exploratory = { ...row('pii:global:b', 'oracle-plan', 'scan-a', [{ method: 'schema-only', cases: 2, variants: 2 }]), mode: 'exploratory' };
    const mixed = population('pop', [row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'schema-only', cases: 3, variants: 3 }]), exploratory], ['oracle-plan']);
    const tables = resolvePiiMethodCoverage(measurement(mixed)) as Array<ReturnType<typeof tableOf>>;
    expect(tables.map(t => t.id)).toEqual(['by-method:pop:scan-a:official', 'by-method:pop:scan-a:exploratory']);
    expect(tables[0].caption).toContain('Official run');
    expect(tables[1].caption).toContain('Exploratory run');
    expect(tables.map(t => t.rows.find(r => r.id === 'oracle-plan:authored')!.cells[0].figure)).toEqual(['3', '2']);
  });

  test('a method the registry does not know is shown as recorded, after the registered ones, with its own version', () => {
    const table = tableOf(measurement(population('pop', [row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'future-method', version: 3, cases: 2, variants: 2 }])], ['oracle-plan'])));
    const labels = table.rows.map(r => r.label);
    expect(labels.indexOf('Oracle plan · future-method v3')).toBe(PII_REGISTERED_METHODS.length);
    expect(table.rows.find(r => r.id === 'oracle-plan:future-method:3')!.cells[0].figure).toBe('2');
  });
});

describe('by-method coverage that cannot be shown', () => {
  test('methods that do not add up to the view are refused, not shown', () => {
    const broken = row('pii:global:a', 'oracle-plan', 'scan-a', [{ method: 'schema-only', cases: 3, variants: 3 }]);
    broken.counts.authoredCases = 4;
    const result = tableOf(measurement(population('pop', [broken], ['oracle-plan']))) as unknown as { text: string; rows?: unknown };
    expect(result.rows).toBeUndefined();
    expect(result.text).toContain('does not add up');
  });

  test('a population read under a schema with no projection says so, and no artifact says so', () => {
    const [older] = resolvePiiMethodCoverage(measurement({ populationId: 'old', schemaVersion: '1.1', scanners: [], population: {} })) as Array<{ text: string; id: string }>;
    expect(older.id).toBe('by-method:old');
    expect(older.text).toContain('schema 1.1');
    const [none] = resolvePiiMethodCoverage(null) as Array<{ text: string }>;
    expect(none.text).toContain('No validated pii-eval artifact');
    expect(none.text).not.toMatch(/holds no per-method counts/);
  });
});
