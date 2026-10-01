/**
 * The resolvers a page calls. This is the only resolver module that imports a
 * service: each function here awaits the services it needs and hands their raw
 * output to the pure resolvers in the sibling files, so a page depends on
 * resolvers alone (pages -> resolvers -> services) and the pure resolvers stay
 * unit-testable without a filesystem.
 *
 * Server-only. Client components import `./filters` and the types, never this.
 */
import { loadCatalog, loadFixtureBytes } from '../services/catalog';
import type { Catalog } from '../services/catalog';
import { loadDetectorContracts } from '../services/contracts';
import { loadAccountingFloors } from '../services/floors';
import { loadDossiers } from '../services/dossiers';
import { loadFeatureClaims } from '../services/features';
import { loadFindings } from '../services/findings';
import { loadPeerProfiles } from '../services/peers';
import { loadOwnPerformance } from '../services/performance';
import { loadPeerRuntime } from '../services/runtime';
import { loadRun, type MeasuredRun } from '../services/run';
import {
  resolveFamily, resolveFamilyList, familyHref, familySlug, type FamilyDetail, type FamilyList, type LevelList,
} from './families';
import type { StatusBarItem } from '../components/feedback';
import type { FamilyBenchmarkData, FamilyNoteItem, FamilyRulesData, FamilySourcesData } from '../components/family/types';
import {
  LEVELS, isLevel, LEVEL_SHORT as SHORT_LABEL, LEVEL_TITLE as TIER_LABEL, answerMeta, levelHref, levelLinks, resolveAnswers, resolveFindings, resolveHubTiles, resolvePeers, runEyebrow, runFacts,
  type FindingsBlock, type LevelAnswers, type Level, type PeersBlock,
} from './report';
import { count, int } from './format';
import { resolveBenchmark, resolveNotes, resolveRules, resolveSources, resolveStatus } from './family-detail';
import { LIST_LEVELS } from './filters';
import { buildSuiteRecords, type SuiteRecordsFile } from './fixtures';
import { resolvePerformancePanels, type PerformancePanel } from './performance';
import { resolveDetector, resolveDetectorList, type DetectorDetail } from './detectors';
import { milestoneLabel, resolveFindingsInventory, resolveSuiteRows, type FindingsInventory } from './inventory';
import { resolveRowsData, rowFacts, rowsHref, rowsSource, type RowScanner, type RowsData, type RowsSource } from './rows';
import { PAGE_SIZE } from './filters';
import { ACCURACY_DIFFERENCES_PATH, ROWS_KINDS, recordsDataPath, rowsDataPath, type RowsKind } from '../lib/data-paths';
import type { DetectorRowData, FindingRowData, SuiteRowData } from '../components/report/types';
import { resolveFeaturePage, resolveHub, resolveRuntimePanels, toolName, type FeaturePage, type RuntimePanel } from './comparison';
import { diffFileOf, resolveAccuracyPage, type AccuracyPage, type DiffFile, type DiffSource } from './accuracy';
import type { ComparisonHubProps } from '../components/comparison/ComparisonHub';
import { resolveRunState, type RunState } from './run';
import type { EvidenceLevelLink, HubTileData } from '../components/report/types';
import type { MetaItem } from '../components/page/MetaList';

export type { FeaturePage, RuntimePanel, ComparisonHubProps, PerformancePanel };
export type { FamilyDetail, FamilyList, FindingsBlock, LevelAnswers, PeersBlock, RunState };

async function context() {
  const [catalog, run] = await Promise.all([loadCatalog(), loadRun()]);
  const measured: MeasuredRun | undefined = run.state === 'measured' ? run : undefined;
  return { catalog, run, measured, rows: measured?.productRows };
}

export interface HeadData { eyebrow: string; title: string; lede: string; meta: MetaItem[] }

// ---- /report -------------------------------------------------------------------

export interface ReportPageData {
  head: HeadData;
  runState: RunState;
  tiles: HubTileData[];
  levels: EvidenceLevelLink[];
  /** One entry per evidence level, or `null` when no usable run was published. */
  byLevel: { level: LevelAnswers; peers: PeersBlock }[] | null;
  answersMeta: MetaItem[];
  findings: FindingsBlock;
}

export async function resolveReportPage(): Promise<ReportPageData> {
  const [{ catalog, run, measured, rows }, findings, profiles] = await Promise.all([context(), loadFindings(), loadPeerProfiles()]);
  const peerContext = { fixtures: catalog.fixtures, profiles };
  const list = resolveFamilyList(catalog, rows);
  return {
    head: {
      eyebrow: measured ? runEyebrow(measured) : 'REDACT-SECRET',
      title: 'What the benchmark shows',
      lede: 'Synthetic inputs, the same for every scanner, scored span by span. Start from a provider or a family, or see what changed.',
      meta: [],
    },
    runState: resolveRunState(run),
    tiles: resolveHubTiles(list, findings, {
      count: catalog.detectors.length,
      // Distinct fixtures that exercise at least one detector: assignments overlap, so a fixture counts once.
      fixtures: catalog.fixtures.filter(f => f.detectors.length > 0).length,
    }),
    levels: levelLinks(),
    byLevel: measured ? LEVELS.map(level => ({ level: resolveAnswers(measured, level), peers: resolvePeers(measured, findings, level, peerContext) })) : null,
    answersMeta: measured ? answerMeta(measured, catalog) : [],
    findings: resolveFindings(findings),
  };
}

// ---- /report/providers, /report/families -----------------------------------------

export interface ListPageData {
  head: HeadData;
  runState: RunState;
  /** Every level, `all` first. The island shows the one `?level=` names; the whole set is pre-rendered. */
  levels: LevelList[];
  list: FamilyList;
  footnote: string;
}

const footnoteOf = (totals: FamilyList['totals']): string =>
  `${int(totals.global)} fixtures are global or not tied to one family. They count in no provider or family row.`;

async function listPage(title: 'Providers' | 'Families'): Promise<ListPageData> {
  const { catalog, run, measured, rows } = await context();
  const levels: LevelList[] = LIST_LEVELS.map(({ level, label }) => {
    const list = resolveFamilyList(catalog, rows, level);
    const unit = title === 'Providers' ? count(list.totals.providersWithFixtures, 'provider') : count(list.totals.familiesWithFixtures, 'family', 'families');
    return { level, optionLabel: level === 'all' ? label : `${label} · ${unit}`, list, footnote: footnoteOf(list.totals) };
  });
  const list = levels[0].list;
  const { totals } = list;
  const facts = measured ? runFacts(measured) : [];
  return {
    runState: resolveRunState(run),
    levels,
    list,
    footnote: footnoteOf(totals),
    head: title === 'Providers'
      ? {
          eyebrow: 'redact-secret · Report', title,
          lede: 'Counts are fixture rows for redact-secret on the current run. Open a provider to see its families, then pick a family to see every row behind it. A fixture in two families counts once for its provider. Choose an evidence level to count only the rows at that level.',
          meta: [{ value: `${int(totals.providers)} providers` }, { value: `${int(totals.families)} families` }, { value: `${int(totals.fixtures)} fixtures` }, ...facts],
        }
      : {
          eyebrow: 'redact-secret · Report', title,
          lede: 'One row per credential family, in taxonomy order. Counts are fixture rows for redact-secret on the current run; a fixture in two families appears in both rows. Choose an evidence level to count only the rows at that level.',
          meta: [
            { value: `${int(totals.families)} families` }, { value: `${int(totals.familiesWithFixtures)} with fixtures` },
            ...(measured ? [{ value: `${int(totals.familiesNeedingLook)} need a look` }] : []), ...facts,
          ],
        },
  };
}

export const resolveProvidersPage = () => listPage('Providers');
export const resolveFamiliesPage = () => listPage('Families');

// ---- Rows and records files: what the browser fetches ------------------------------------
//
// A rows table ships its first page with the page and the rest as one build-emitted file
// (`lib/data-paths.ts`), written by the route handlers in `app/data/` from the same resolvers
// that shape the page, so the file and the page can never disagree about a row.

const rowsCache = new Map<string, Promise<RowsData | undefined>>();

async function buildRows(kind: RowsKind, id: string): Promise<RowsData | undefined> {
  const { catalog, measured } = await context();
  const scanners = rowScanners(measured);
  if (kind === 'level') return isLevel(id) ? resolveRowsData(catalog.fixtures.filter(f => f.tier === id), scanners) : undefined;
  if (kind === 'family') {
    const family = catalog.taxonomy.families.find(f => familySlug(f.id) === id);
    return family ? resolveRowsData(catalog.fixturesByFamily.get(family.id) ?? [], scanners) : undefined;
  }
  if (kind === 'suite') return catalog.suites.some(s => s.id === id) ? resolveRowsData(catalog.fixturesBySuite.get(id) ?? [], scanners) : undefined;
  return catalog.detectors.some(d => d.id === id) ? resolveRowsData(catalog.fixturesByDetector.get(id) ?? [], scanners) : undefined;
}

/** Every row of one table, memoised per build (the page and its file ask for the same rows). */
export function resolveRowsFile(kind: string, id: string): Promise<RowsData | undefined> {
  if (!(ROWS_KINDS as readonly string[]).includes(kind)) return Promise.resolve(undefined);
  const key = `${kind}/${id}`;
  let rows = rowsCache.get(key);
  if (!rows) { rows = buildRows(kind as RowsKind, id); rowsCache.set(key, rows); }
  return rows;
}

/** What a page ships for its table: the first page, and the file's path when the table has more rows than that. */
async function rowsFor(kind: RowsKind, id: string): Promise<RowsSource> {
  return rowsSource((await resolveRowsFile(kind, id))!, rowsDataPath(kind, id));
}

/** Every rows file the export emits: one per table with more rows than a page. */
export async function resolveRowsFileParams(): Promise<{ kind: RowsKind; id: string }[]> {
  const catalog = await loadCatalog();
  const candidates: { kind: RowsKind; id: string }[] = [
    ...LEVELS.map(id => ({ kind: 'level' as const, id })),
    ...catalog.taxonomy.families.map(f => ({ kind: 'family' as const, id: familySlug(f.id) })),
    ...catalog.suites.map(s => ({ kind: 'suite' as const, id: s.id })),
    ...catalog.detectors.map(d => ({ kind: 'detector' as const, id: d.id })),
  ];
  const sized = await Promise.all(candidates.map(async c => ({ c, n: (await resolveRowsFile(c.kind, c.id))?.items.length ?? 0 })));
  return sized.filter(x => x.n > PAGE_SIZE).map(x => x.c);
}

/** A suite's fixture records and shared text: what `?fixture=<id>` builds one fixture's page from. */
export async function resolveSuiteRecordsFile(id: string): Promise<SuiteRecordsFile | undefined> {
  const [{ catalog, run, measured }, bytes, gaps] = await Promise.all([context(), loadFixtureBytes(), loadFindings()]);
  const suite = catalog.suites.find(s => s.id === id);
  if (!suite) return undefined;
  const runProblem = run.state !== 'measured'
    ? 'No benchmark run is published for this checkout.'
    : run.excludedSuites.find(s => s.id === id)?.problem ? `The report for these bytes is left out: ${run.excludedSuites.find(s => s.id === id)!.problem}. The expectation stands on its own; lanes appear once a report re-validates against these bytes.`
    : run.staleSuites.includes(id) ? 'The report for these bytes is from an older run and is left out.' : undefined;
  return buildSuiteRecords({
    suite, fixtures: catalog.fixturesBySuite.get(id) ?? [], bytes,
    scanners: measured ? measured.scanners : [],
    ...(runProblem ? { runProblem } : {}),
    findings: gaps.issues.map(i => ({ number: i.number, url: i.url, milestone: milestoneLabel(gaps.milestone), fixtures: i.fixtures })),
    detectorTitles: new Map(catalog.detectors.map(d => [d.id, d.title])),
    familyNames: new Map(catalog.taxonomy.families.map(f => [f.id, f.name])),
  });
}

// ---- /report/families/[family] ---------------------------------------------------

export interface FamilyPageData {
  family: FamilyDetail;
  runState: RunState;
  meta: MetaItem[];
  description: string;
  /** The family's rows with one outcome per scanner (the first page, and the file with the rest); the page opens on redact-secret's column alone. */
  rows: RowsSource;
  /** The evidence levels the family has rows at, each with its row count, `all` first. */
  levels: { value: string; label: string }[];
  /** What the page says above the rows (#589): research status, dossier notes, benchmark counts, peer rules, sources. */
  status: StatusBarItem[];
  format: FamilyNoteItem[];
  lookAlikes: FamilyNoteItem[];
  open: FamilyNoteItem[];
  benchmark: FamilyBenchmarkData;
  rules: FamilyRulesData;
  sources: FamilySourcesData;
  /** The provider's other families, in taxonomy order. */
  siblings: { name: string; href: string }[];
}

/** The scanners of a run in run order, or redact-secret alone when there is no usable run. */
const rowScanners = (measured: MeasuredRun | undefined): RowScanner[] =>
  measured ? measured.scanners.map(s => ({ id: s.id, name: s.name, rows: s.rows })) : [{ id: 'redact-secret', name: 'redact-secret', rows: undefined }];

/** Every family that gets a pre-rendered page: all of them, including those with no fixtures. */
export async function resolveFamilySlugs(): Promise<string[]> {
  const catalog: Catalog = await loadCatalog();
  const slugs = catalog.taxonomy.families.map(f => familySlug(f.id));
  if (new Set(slugs).size !== slugs.length) throw new Error('Two families share a URL slug');
  return slugs;
}

export async function resolveFamilyPage(slug: string): Promise<FamilyPageData | undefined> {
  const [{ catalog, run, measured, rows }, dossiers, peers] = await Promise.all([context(), loadDossiers(), loadPeerProfiles()]);
  const id = catalog.taxonomy.families.find(f => familySlug(f.id) === slug)?.id;
  const family = id ? resolveFamily(catalog, id, rows) : undefined;
  if (!family) return undefined;
  const fixtures = catalog.fixturesByFamily.get(family.id) ?? [];
  const taxonomyFamily = catalog.familyById.get(family.id)!;
  const dossier = dossiers.get(family.id);
  const notes = resolveNotes(dossier);
  const levels = [
    { value: 'all', label: `All levels (${int(fixtures.length)})` },
    ...LIST_LEVELS.filter(l => l.level !== 'all').flatMap(l => {
      const n = fixtures.filter(f => f.tier === l.level).length;
      return n > 0 ? [{ value: l.level, label: `${l.label} (${int(n)})` }] : [];
    }),
  ];
  return {
    family,
    runState: resolveRunState(run),
    meta: [
      { value: family.providerName },
      { label: 'Detectors:', value: family.detectors.length ? family.detectors.join(', ') : 'none mapped' },
      ...(measured ? runFacts(measured) : []),
    ],
    description: `${int(family.fixtureCount)} rows, redact-secret's outcome on each. Rows that need a look come first (${int(family.needsLookCount)}), then the rest in corpus order. Choose "Every scanner" to see each scanner's outcome for the same rows.`,
    rows: await rowsFor('family', slug),
    levels: levels.length > 2 ? levels : [],
    status: resolveStatus(dossier),
    format: notes.format,
    lookAlikes: notes.lookAlikes,
    open: notes.open,
    benchmark: resolveBenchmark({ family: taxonomyFamily, fixtures, run: measured, peers, facts: family.facts, rowsHref: '#family-rows' }),
    rules: resolveRules(family.id, peers, new Map((measured?.scanners ?? []).map(s => [s.id, s.name]))),
    sources: resolveSources(taxonomyFamily, dossier),
    siblings: taxonomyFamily.provider === null ? [] : catalog.taxonomy.families.filter(f => f.provider === taxonomyFamily.provider && f.id !== family.id).map(f => ({ name: f.name, href: familyHref(f.id) })),
  };
}

// ---- /report/rows/[level] ---------------------------------------------------------

export interface LevelRowsPageData {
  level: Level;
  head: HeadData;
  runState: RunState;
  /** The three levels as links to their rows, and the current one. */
  levels: EvidenceLevelLink[];
  currentHref: string;
  rows: RowsSource;
  facts: { term: string; value: string }[];
  description: string;
  /** The hub page's own level: where the three answers for these rows are. */
  answersHref: string;
}

export const resolveLevelSlugs = (): Level[] => LEVELS;

/** Rows at one evidence level for every scanner in the run: what the three answers at that level are counted from. */
export async function resolveLevelRowsPage(level: Level): Promise<LevelRowsPageData> {
  const { catalog, run, measured, rows } = await context();
  const fixtures = catalog.fixtures.filter(f => f.tier === level);
  const t = TIER_LABEL[level];
  return {
    level,
    head: {
      eyebrow: 'redact-secret · Report',
      title: `Rows at the ${t.toLowerCase()} level`,
      lede: 'Every fixture at this evidence level, with the outcome each scanner recorded for it. The three answers on the report are counted from these rows. Rows that need a look come first.',
      meta: [{ value: count(fixtures.length, 'row') }, ...(measured ? runFacts(measured) : [])],
    },
    runState: resolveRunState(run),
    levels: LEVELS.map(l => ({ label: TIER_LABEL[l], shortLabel: SHORT_LABEL[l], href: rowsHref(l) })),
    currentHref: rowsHref(level),
    rows: await rowsFor('level', level),
    facts: rowFacts(fixtures, rows, 'Rows'),
    description: `${int(fixtures.length)} rows at this level. Counts above are redact-secret's; each scanner's outcome for a row is a column. A scanner with no row for a fixture shows "Not measured", never a pass.`,
    answersHref: levelHref(level),
  };
}

// ---- /report/fixtures, /report/fixtures/[suite] -------------------------------------

export interface SuiteListPageData { head: HeadData; runState: RunState; suites: SuiteRowData[] }

export async function resolveSuitesPage(): Promise<SuiteListPageData> {
  const { catalog, run, measured, rows } = await context();
  return {
    head: {
      eyebrow: 'redact-secret · Report',
      title: 'Suites',
      lede: 'The corpus is a set of suites, each a folder of fixtures authored for one purpose. Open a suite for its rows, then a row for the fixture: its bytes, what was expected and what each scanner reported.',
      meta: [{ value: count(catalog.suites.length, 'suite') }, { value: count(catalog.fixtures.length, 'fixture') }, ...(measured ? runFacts(measured) : [])],
    },
    runState: resolveRunState(run),
    suites: resolveSuiteRows(catalog, rows),
  };
}

export interface SuitePageData {
  id: string;
  title: string;
  head: HeadData;
  runState: RunState;
  rows: RowsSource;
  facts: { term: string; value: string }[];
  description: string;
  /** The fixture records (`SuiteRecordsFile`) the browser fetches for `?fixture=<id>`, by path, and how many there are. */
  recordsSrc: string;
  fixtureCount: number;
}

export async function resolveSuiteSlugs(): Promise<string[]> {
  return (await loadCatalog()).suites.map(s => s.id);
}

export async function resolveSuitePage(id: string): Promise<SuitePageData | undefined> {
  const { catalog, run, measured, rows } = await context();
  const suite = catalog.suites.find(s => s.id === id);
  if (!suite) return undefined;
  const fixtures = catalog.fixturesBySuite.get(id) ?? [];
  return {
    id, title: suite.title,
    head: {
      eyebrow: 'redact-secret · Report',
      title: suite.title,
      lede: suite.description,
      meta: [{ value: count(fixtures.length, 'fixture') }, ...(measured ? runFacts(measured) : [])],
    },
    runState: resolveRunState(run),
    rows: await rowsFor('suite', id),
    facts: rowFacts(fixtures, rows, 'Fixtures'),
    description: `${int(fixtures.length)} fixtures in this suite. Open a fixture for its bytes, expected spans and what each scanner reported.`,
    recordsSrc: recordsDataPath(id),
    fixtureCount: fixtures.length,
  };
}

// ---- /report/detectors, /report/detectors/[detector] ----------------------------------

export interface DetectorListPageData { head: HeadData; runState: RunState; detectors: DetectorRowData[]; note: string }

export async function resolveDetectorsPage(): Promise<DetectorListPageData> {
  const [{ catalog, run, measured }, floors] = await Promise.all([context(), loadAccountingFloors()]);
  const detectors = resolveDetectorList(catalog, floors.minDenominator);
  const thin = detectors.filter(d => d.value <= d.minimum).length;
  return {
    head: {
      eyebrow: 'redact-secret · Report',
      title: 'Detectors',
      lede: 'One row per detector family the product registers, by the fixtures that exercise it. The line on each bar is the minimum sample size below which the run withholds a bound.',
      meta: [{ value: count(detectors.length, 'detector') }, { value: `${int(thin)} at or below the minimum` }, ...(measured ? runFacts(measured) : [])],
    },
    runState: resolveRunState(run),
    detectors,
    note: `Detector assignments overlap: a fixture can exercise several detectors, so these counts are never summed. The minimum sample size is ${int(floors.minDenominator)} fixtures.`,
  };
}

export interface DetectorPageData {
  detector: DetectorDetail;
  head: HeadData;
  runState: RunState;
  rows: RowsSource;
  facts: { term: string; value: string }[];
  findings: FindingRowData[];
  note: string;
}

export async function resolveDetectorSlugs(): Promise<string[]> {
  return (await loadCatalog()).detectors.map(d => d.id);
}

export async function resolveDetectorPage(id: string): Promise<DetectorPageData | undefined> {
  const [{ catalog, run, measured, rows }, floors, contracts, gaps] = await Promise.all([context(), loadAccountingFloors(), loadDetectorContracts(), loadFindings()]);
  const detector = resolveDetector(catalog, id, measured, contracts.get(id), floors.minDenominator);
  if (!detector) return undefined;
  const slugs = new Set(detector.fixtures.map(f => f.slug));
  const inventory = resolveFindingsInventory({ ...gaps, issues: gaps.issues.filter(i => i.fixtures.some(s => slugs.has(s))) }, catalog);
  return {
    detector,
    head: {
      eyebrow: 'redact-secret · Report · Detector',
      title: detector.title,
      lede: '',
      meta: [
        { value: count(detector.fixtureCount, 'fixture') },
        ...(detector.tier ? [{ label: 'Format evidence:', value: `${detector.tier} · ${detector.tierTitle ?? ''}`.trim() }] : []),
        ...(measured ? runFacts(measured) : []),
      ],
    },
    runState: resolveRunState(run),
    rows: await rowsFor('detector', id),
    facts: rowFacts(detector.fixtures, rows, 'Fixtures'),
    findings: inventory.rows,
    note: 'Detector views overlap, so their groups are never summed across detectors. Other scanners are reference values on the same inputs, in run order.',
  };
}

// ---- /report/findings -----------------------------------------------------------------

export interface FindingsPageData { head: HeadData; inventory: FindingsInventory }

export async function resolveFindingsPage(): Promise<FindingsPageData> {
  const [catalog, gaps] = await Promise.all([loadCatalog(), loadFindings()]);
  const inventory = resolveFindingsInventory(gaps, catalog);
  return {
    head: {
      eyebrow: 'redact-secret · Report',
      title: inventory.title,
      lede: inventory.description,
      meta: [{ value: count(inventory.count, 'finding') }, { label: 'Snapshot', value: gaps.reviewedAt }],
    },
    inventory,
  };
}

// ---- /comparison, /comparison/feature, /comparison/runtime -------------------------

export async function resolveComparisonHubPage(): Promise<ComparisonHubProps> {
  const [runtime, features, run] = await Promise.all([loadPeerRuntime(), loadFeatureClaims(), loadRun()]);
  return resolveHub({ runtime, features, run });
}

export async function resolveFeatureComparisonPage(): Promise<FeaturePage> {
  return resolveFeaturePage(await loadFeatureClaims());
}

export async function resolveRuntimeComparisonPage(): Promise<RuntimePanel[]> {
  const [runtime, features] = await Promise.all([loadPeerRuntime(), loadFeatureClaims()]);
  return resolveRuntimePanels(runtime, features);
}

// ---- /comparison/performance ---------------------------------------------------------

export async function resolvePerformancePairPage(): Promise<PerformancePanel[]> {
  const [runtime, own] = await Promise.all([loadPeerRuntime(), loadOwnPerformance()]);
  return resolvePerformancePanels(runtime, own);
}

// ---- /comparison/accuracy ---------------------------------------------------------------

export interface AccuracyPairPageData extends Omit<AccuracyPage, 'diff'> {
  runState: RunState;
  /** Where the lists of differing files are fetched from, and what the page expects the file to be. Absent without a run. */
  source?: DiffSource;
}

async function accuracyPage() {
  const [{ catalog, run, measured }, profiles, runtime] = await Promise.all([context(), loadPeerProfiles(), loadPeerRuntime()]);
  return { run, measured, page: resolveAccuracyPage({ catalog, run: measured, profiles, runtime: runtime.comparison, toolNames: { 'flare-redact': toolName('flare-redact'), openredaction: toolName('openredaction') } }) };
}

/** The accuracy pair page: every reachable pair, level and scope as a panel. The lists of differing files are a build-emitted file. */
export async function resolveAccuracyPairPage(): Promise<AccuracyPairPageData> {
  const { run, measured, page } = await accuracyPage();
  const { diff, ...rest } = page;
  return { ...rest, runState: resolveRunState(run), ...(diff && measured ? { source: { src: ACCURACY_DIFFERENCES_PATH, runId: measured.runId, fixtures: diff.fixtures.length } } : {}) };
}

/** The file behind `data/comparison/accuracy/differences.json`: what the lists of differing files are built from. */
export async function resolveAccuracyDifferencesFile(): Promise<DiffFile> {
  const { measured, page } = await accuracyPage();
  // Without a run there is nothing to list (the page asks for no file); the export still gets a valid, empty one.
  return page.diff && measured ? diffFileOf(page.diff, measured.runId) : diffFileOf({ providers: [], fixtures: [], peers: {} }, '');
}
