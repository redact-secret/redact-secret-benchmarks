/**
 * The qualification view in the shapes the credential report pages already read (#606, #608).
 *
 * The report, provider, family, detector and fixture pages are written against a `Catalog` (the fixtures, suites, detectors and the
 * taxonomy) and a `MeasuredRun` (each scanner's row for each fixture, and the run's accounted groups). When the committed authority is
 * `new`, those two values are built here from the qualification view instead of from the legacy corpora and run files, so the same
 * pages, resolvers and blocks render either pipeline and nothing downstream knows which one it is.
 *
 * What is carried over, and what is not:
 *  - the report's population is the one the population policy gives the floors and gates (the public evidence snapshot). The regression
 *    and policy populations keep their own denominators on `/evaluation/qualification/` and are never pooled into these pages;
 *  - each case's own row is the view's `results` entry for the scanner: outcomes per span, leaked and collateral bytes, flagged and
 *    findings, or "pending" and "not measured". Nothing is re-scored;
 *  - the accounted groups (`summary.overall`, `summary.byDetector`: the rates and their bounds) are accounted over those rows with the
 *    same `selectionGroups` and `accountGroups` the legacy bench uses, so a rate means the same on both pipelines. The diagnostics
 *    field is dropped: the view records how many ranges a scanner reported, not their offsets, and a diagnostic needs the offsets;
 *  - the view carries no bytes. A fixture's `content` is empty and `contentRecorded` is false, so the fixture page shows what the view
 *    holds (expected spans, each scanner's outcome) and says the bytes are not recorded, never a stand-in.
 *
 * Pure: no file is read here. `credential-source.ts` hands it the parsed view and the product-owned inputs.
 */
import { selectionGroups } from '../../benchmarks/lib/run-summary';
import { ACCOUNTING_VERSION } from '../../benchmarks/lib/accounting';
import type { AccountingConfig, ScoredRow } from '../../benchmarks/types';
import type { RunSummary } from '../../src/pages/data';
import type { Taxonomy } from '../../benchmarks/support/taxonomy';
import { assembleCatalog, type BuiltFixture, type Catalog, type CatalogFixture, type CatalogSuite, type Tier } from './catalog';
import type { CaseRow, CaseScannerResult, PopulationView, QualificationView } from './qualification';
import type { MeasuredRun, Outcome, RowResult, RunScanner } from './run';

/** The role the population policy gives the population the report pages are about. */
export const REPORT_ROLE = 'floors-and-gates';

export interface BridgeInput {
  taxonomy: Taxonomy;
  /** Detector titles by id (`benchmarks/detectors.json`); a detector the registry does not know is shown by its id. */
  detectorTitles: Map<string, string>;
  accounting: AccountingConfig;
  /** The date the canonical run of the report population was recorded (`benchmarks/official-runs.json`), or `null`. */
  recordedOn: string | null;
}

export interface Bridged {
  population: PopulationView;
  catalog: Catalog;
  run: MeasuredRun;
  fixtureBytes: Map<string, BuiltFixture>;
}

/** The population the report pages are built over, or `undefined` when the view has none. */
export const reportPopulation = (view: QualificationView): PopulationView | undefined => view.populations.find(p => p.role === REPORT_ROLE);

const segment = (id: string): { category: string; rest: string } => {
  const at = id.indexOf('--');
  return at < 0 ? { category: id, rest: id } : { category: id.slice(0, at), rest: id.slice(at + 2) };
};

const TIERS = new Set(['T0', 'T1', 'T2', 'T3']);

/** One scanner's measurement of one case as the pages read it; `undefined` when the scanner did not measure it. */
export function rowOf(result: CaseScannerResult | undefined): RowResult | undefined {
  if (!result) return undefined;
  switch (result.measurement) {
    case 'positive': return { spanOutcomes: (result.outcomes ?? []) as Outcome[], leakedBytes: result.leakedBytes ?? 0, collateralBytes: result.collateralBytes ?? 0, observed: result.observed };
    case 'control': return { flagged: result.flagged ?? false, findings: result.findings ?? 0, observed: result.observed };
    case 'pending': return { observed: result.observed };
    default: return undefined;
  }
}

function scoredRow(c: CaseRow, result: CaseScannerResult): ScoredRow & { category: string } {
  const row = rowOf(result)!;
  return {
    id: c.id, path: c.path, group: c.group, kind: c.kind, tier: c.tier as Tier, ...(c.twinOf ? { twinOf: c.twinOf } : {}),
    category: segment(c.id).category,
    expected: c.expected.map(e => ({ start: e.start, end: e.end, role: e.role as 'secret' | 'companion', ...(e.envelope ? { envelope: e.envelope } : {}) })),
    actual: [],
    ...(row.spanOutcomes ? { spanOutcomes: row.spanOutcomes } : {}),
    ...(row.leakedBytes !== undefined ? { leakedBytes: row.leakedBytes } : {}),
    ...(row.collateralBytes !== undefined ? { collateralBytes: row.collateralBytes } : {}),
    ...(row.flagged !== undefined ? { flagged: row.flagged } : {}),
    ...(row.findings !== undefined ? { findings: row.findings } : {}),
    ...(result.coDetected !== undefined ? { coDetected: result.coDetected } : {}),
  };
}

export function bridgeQualificationView(view: QualificationView, input: BridgeInput): Bridged | { problem: string } {
  const population = reportPopulation(view);
  if (!population) return { problem: `the view has no population with the role ${REPORT_ROLE}, so there is no benchmark population to build the report pages over` };
  const familyIds = new Set(input.taxonomy.families.map(f => f.id));

  const fixtures: CatalogFixture[] = [];
  const fixtureBytes = new Map<string, BuiltFixture>();
  for (const c of population.cases) {
    const { category, rest } = segment(c.id);
    const tier: Tier = TIERS.has(c.tier) ? (c.tier as Tier) : 'T0';
    const familyScoped = c.family !== null && familyIds.has(c.family);
    fixtures.push({
      slug: c.id, category, id: rest, group: c.group, kind: c.kind, tier,
      ...(c.twinOf ? { twinOf: c.twinOf } : {}),
      familyIds: familyScoped ? [c.family!] : [],
      ...(familyScoped ? {} : { unscopedReason: 'The evidence record names no family for this case.' }),
      detectors: c.detectors,
    });
    const twinHere = c.twinOf && segment(c.twinOf).category === category ? segment(c.twinOf).rest : undefined;
    fixtureBytes.set(c.id, {
      id: rest, slug: c.id, category, group: c.group, path: c.path, content: '', contentRecorded: false,
      expected: c.expected, detectors: c.detectors,
      ...(twinHere ? { twinOf: twinHere } : {}), ...(c.twinMutationKind ? { mutationKind: c.twinMutationKind } : {}),
      assessment: { kind: c.kind, tier, sources: [] },
    });
  }

  const categories = [...new Set(fixtures.map(f => f.category))].sort();
  const suites: CatalogSuite[] = categories.map(id => ({ id, title: id, description: `Cases of the public evidence snapshot whose id starts with ${id}--.`, reviewStatus: '' }));
  const detectorIds = [...new Set(fixtures.flatMap(f => f.detectors))].sort();
  const catalog = assembleCatalog({
    fixtures, taxonomy: input.taxonomy, suites,
    detectors: detectorIds.map(id => ({ id, title: input.detectorTitles.get(id) ?? id })),
    scenarioTitles: new Map(),
  });

  const scannerIds = population.artifact.scanners.map(s => s.id);
  const scanners: RunScanner[] = population.artifact.scanners.map(s => ({
    id: s.id, name: s.id, version: s.version, mode: s.mode, status: s.status, observations: [],
    rows: new Map<string, RowResult>(s.status === 'complete' ? population.cases.flatMap(c => {
      const row = rowOf(c.results.find(r => r.scanner === s.id));
      return row ? [[c.id, row] as const] : [];
    }) : []),
  }));

  const assignments = new Map(fixtures.map(f => [f.slug, f.detectors]));
  const everything = new Set(assignments.keys());
  const detectors = [...new Set([...assignments.values()].flat())].sort();
  const overall: RunSummary['overall'] = {};
  const byDetector: RunSummary['byDetector'] = Object.fromEntries(detectors.map(d => [d, {}]));
  for (const id of scannerIds) {
    const scanner = population.artifact.scanners.find(s => s.id === id)!;
    if (scanner.status !== 'complete') { overall[id] = {}; continue; }
    const rows = population.cases.flatMap(c => { const r = c.results.find(x => x.scanner === id); return r && r.measurement !== 'not-measured' ? [scoredRow(c, r)] : []; });
    overall[id] = selectionGroups(rows, everything, input.accounting);
    for (const detector of detectors) {
      const picked = new Set([...assignments].filter(([, ids]) => ids.includes(detector)).map(([slug]) => slug));
      const groups = selectionGroups(rows, picked, input.accounting);
      if (Object.keys(groups).length) byDetector[detector][id] = groups;
    }
  }
  // A group's diagnostics are counts of reported ranges that match no expected span; the view holds how many ranges, not where.
  for (const groups of [...Object.values(overall), ...Object.values(byDetector).flatMap(d => Object.values(d))]) for (const g of Object.values(groups)) delete (g as { diagnostics?: unknown }).diagnostics;

  const product = population.artifact.scanners.find(s => s.id === 'redact-secret');
  const summary: RunSummary = {
    schemaVersion: 1, accountingVersion: ACCOUNTING_VERSION, runId: population.artifact.semanticDigest, generatedAt: input.recordedOn ? `${input.recordedOn}T00:00:00.000Z` : '',
    domain: 'credential', evaluationProfile: 'qualification-view', domainAccountingVersion: ACCOUNTING_VERSION,
    categories, accounting: input.accounting,
    scanners: population.artifact.scanners.map(s => ({ id: s.id, name: s.id, version: s.version, mode: s.mode, status: s.status, completeSuites: s.status === 'complete' ? categories.length : 0 })),
    overall, byDetector,
  } as RunSummary;
  const run: MeasuredRun = {
    state: 'measured', runId: population.artifact.semanticDigest, generatedAt: summary.generatedAt, accountingVersion: ACCOUNTING_VERSION,
    mode: 'published', productVersion: product?.version ?? null, summary, scanners, productRows: scanners.find(s => s.id === 'redact-secret')?.rows ?? new Map(),
    hosts: [], revision: null, dirty: null, excludedSuites: [], staleSuites: [], suiteCount: categories.length,
  };
  return { population, catalog, run, fixtureBytes };
}
