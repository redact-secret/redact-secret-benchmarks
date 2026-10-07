/**
 * The by-method coverage tables of `/evaluation/pii/` (#617): the cases and variants each validated pii-eval population recorded
 * per method, in `productProjection.rows[].methodCoverage` (validated by `validatePiiEvalProjection`). Pure: the measurement in, block props out.
 *
 * Rules: one table per population and scanner, with the run mode and the measured product beside the figures; rows are summed only within
 * one view (the same authored case can belong to another population or view, so nothing is added across them); every registered method is
 * listed, and one the artifact does not record is "Not recorded", never zero and never a run it did not make (a converted population records
 * only `schema-only`); authored cases, variants and occurrences are three different counts and stay in their own places. No number is derived
 * beyond the sum of the recorded ones, and a table whose methods do not add up to its own view counts is refused rather than shown.
 */
import type { CoverageNotRecorded, CoverageRow, CoverageTable } from '../components/evaluation/domain';
import type { PiiEvalMeasurement } from '../services/domains';
import { int } from './format';

/** The seven methods `createPiiMethods` registers, in the registry's order (a test keeps this list equal to the registry). */
export const PII_REGISTERED_METHODS = ['schema-only', 'type-validation', 'context-discrimination', 'pii-benign', 'jurisdiction-collision', 'mutation', 'reference-differential'] as const;

const VIEW_LABEL: Record<string, string> = {
  'oracle-plan': 'Oracle plan', 'qualification-plan': 'Qualification plan', 'diagnostic-balanced': 'Diagnostic-balanced', 'benign-heavy-stress': 'Benign-heavy',
};
const issue = (number: number) => ({ number, href: `https://github.com/redact-secret/redact-secret-benchmarks/issues/${number}` });

type Population = PiiEvalMeasurement['populations'][number];
type Projection = NonNullable<Population['productProjection']>;

export interface MethodFigures { id: string; version: number; cases: number; variants: number }

/** What one view of one scanner recorded: the figures of its rows added over families, each method apart. */
export interface ViewMethodCoverage {
  view: string;
  methods: MethodFigures[];
  authoredCases: number; variants: number; occurrences: number;
  /** The methods' cases and variants add up to the view's own counts. */
  reconciles: boolean;
}

/** Sum a scanner's rows per view and method, in one run mode when `mode` is given. Rows of another scanner, view or mode are never merged in. */
export function methodCoverageOf(projection: Projection, scannerId: string, mode?: string): ViewMethodCoverage[] {
  const views: ViewMethodCoverage[] = [];
  for (const view of projection.requiredViews) {
    const rows = projection.rows.filter(row => row.binding.scannerId === scannerId && row.view === view && (mode === undefined || row.mode === mode));
    if (!rows.length) continue;
    const methods = new Map<string, MethodFigures>();
    for (const row of rows) {
      for (const item of row.methodCoverage) {
        const key = `${item.method.id}\0${item.method.version}`;
        const held = methods.get(key) ?? { id: item.method.id, version: item.method.version, cases: 0, variants: 0 };
        held.cases += item.cases; held.variants += item.variants;
        methods.set(key, held);
      }
    }
    const total = (field: 'authoredCases' | 'variants' | 'occurrences') => rows.reduce((n, row) => n + row.counts[field], 0);
    const list = [...methods.values()];
    views.push({
      view, methods: list, authoredCases: total('authoredCases'), variants: total('variants'), occurrences: total('occurrences'),
      reconciles: list.reduce((n, m) => n + m.cases, 0) === total('authoredCases') && list.reduce((n, m) => n + m.variants, 0) === total('variants'),
    });
  }
  return views;
}

/** The run modes a scanner's rows record, in a fixed order; a scanner with rows in both modes gets a table per mode. */
const modesOf = (projection: Projection, scannerId: string): string[] =>
  ['official', 'exploratory'].filter(mode => projection.rows.some(row => row.binding.scannerId === scannerId && row.mode === mode));

function tableFor(population: Population, projection: Projection, scanner: Population['scanners'][number], mode: string | undefined, split: boolean): CoverageTable | CoverageNotRecorded {
  const identity = scanner.identity as { product?: { kind?: string }; scannerVersion?: string };
  const kind = identity.product?.kind === 'candidate' ? 'Candidate' : identity.product?.kind === 'released' ? 'Released' : 'Product not recorded';
  const modeText = mode === 'official' ? 'Official run' : mode === 'exploratory' ? 'Exploratory run' : 'Run mode not recorded';
  const caption = `Cases and variants by method · ${population.populationId} · ${scanner.scannerId} ${String(identity.scannerVersion ?? '')} · ${modeText} · ${kind}`.replace(/\s+/g, ' ');
  const id = `by-method:${population.populationId}:${scanner.scannerId}${split && mode ? `:${mode}` : ''}`;
  const views = methodCoverageOf(projection, scanner.scannerId, mode);
  if (!views.length || views.some(view => !view.reconciles)) {
    return { id, caption, text: 'The recorded method coverage is missing or does not add up to the counts of its own view, so none of it is shown.', issue: issue(665) };
  }
  const rows: CoverageRow[] = [];
  for (const view of views) {
    const label = VIEW_LABEL[view.view] ?? view.view;
    const registered = (PII_REGISTERED_METHODS as readonly string[]);
    const recordedRows = (m: MethodFigures): CoverageRow => ({
      id: `${view.view}:${m.id}:${m.version}`, label: `${label} · ${m.id} v${m.version}`,
      detail: m.id === 'schema-only' ? 'Recorded as converted cases read against the schema. This is not a run of the other registered methods.' : 'Recorded by the artifact.',
      cells: [{ figure: int(m.cases) }, { figure: int(m.variants) }],
    });
    for (const name of PII_REGISTERED_METHODS) {
      const held = view.methods.filter(m => m.id === name);
      if (held.length) rows.push(...held.map(recordedRows));
      else rows.push({ id: `${view.view}:${name}`, label: `${label} · ${name}`, detail: 'Registered. This population records no cases for it.', cells: [{ figure: null }, { figure: null }] });
    }
    rows.push(...view.methods.filter(m => !registered.includes(m.id)).map(recordedRows));
    rows.push({
      id: `${view.view}:authored`, label: `${label} · authored`,
      detail: `${int(view.occurrences)} ${view.occurrences === 1 ? 'occurrence' : 'occurrences'} in this view. Occurrences are recorded for the view, not per method. The methods above add up to these two figures.`,
      cells: [{ figure: int(view.authoredCases) }, { figure: int(view.variants) }],
    });
  }
  return {
    id, caption, rowHeader: 'View · method', columns: ['Authored cases', 'Variants'], rows,
    note: `Population ${population.population.populationDigest.slice(0, 12)}, version ${population.population.populationVersion}, public synthetic. Rows are added over families within one view only; the same case can belong to another population or view, so no figure is added across them.`,
  };
}

/** One table per projected population and scanner, and a stated "not recorded" for a population read under a schema that carries no method coverage. */
export function resolvePiiMethodCoverage(measurement: PiiEvalMeasurement | null): Array<CoverageTable | CoverageNotRecorded> {
  const caption = 'Cases and variants by method';
  if (!measurement) return [{ id: 'by-method', caption, text: 'No validated pii-eval artifact is bound to this publication, so no per-method coverage is shown.', issue: issue(665) }];
  const out: Array<CoverageTable | CoverageNotRecorded> = [];
  for (const population of measurement.populations) {
    const projection = population.productProjection;
    if (!projection) {
      out.push({ id: `by-method:${population.populationId}`, caption: `${caption} · ${population.populationId}`, text: `This population was read under schema ${population.schemaVersion}, which carries no method coverage.`, issue: issue(665) });
      continue;
    }
    const scanners = population.scanners ?? [];
    if (!scanners.length) out.push({ id: `by-method:${population.populationId}`, caption: `${caption} · ${population.populationId}`, text: 'The population records no scanner, so no method coverage is shown.', issue: issue(665) });
    for (const scanner of scanners) {
      const modes = modesOf(projection, scanner.scannerId);
      if (!modes.length) out.push(tableFor(population, projection, scanner, undefined, false));
      for (const mode of modes) out.push(tableFor(population, projection, scanner, mode, modes.length > 1));
    }
  }
  return out.length ? out : [{ id: 'by-method', caption, text: 'The pii-eval artifact holds no population.', issue: issue(665) }];
}
