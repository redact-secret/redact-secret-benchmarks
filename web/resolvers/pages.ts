/**
 * The resolvers a page calls. This is the only resolver module that imports a
 * service: each function here awaits the services it needs and hands their raw
 * output to the pure resolvers in the sibling files, so a page depends on
 * resolvers alone (pages -> resolvers -> services) and the pure resolvers stay
 * unit-testable without a filesystem.
 *
 * Server-only. Client components import `./filters` and the types, never this.
 */
import { loadCatalog } from '../services/catalog';
import type { Catalog } from '../services/catalog';
import { loadFindings } from '../services/findings';
import { loadRun, type MeasuredRun } from '../services/run';
import {
  resolveFamily, resolveFamilyList, familySlug, type FamilyDetail, type FamilyList,
} from './families';
import {
  LEVELS, answerMeta, levelLinks, resolveAnswers, resolveFindings, resolveHubTiles, resolvePeers, runEyebrow, runFacts,
  type FindingsBlock, type LevelAnswers, type PeersBlock,
} from './report';
import { int } from './format';
import { resolveRunState, type RunState } from './run';
import type { EvidenceLevelLink, HubTileData } from '../components/report/types';
import type { MetaItem } from '../components/page/MetaList';

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
  const [{ catalog, run, measured, rows }, findings] = await Promise.all([context(), loadFindings()]);
  const list = resolveFamilyList(catalog, rows);
  return {
    head: {
      eyebrow: measured ? runEyebrow(measured) : 'REDACT-SECRET',
      title: 'What the benchmark shows',
      lede: 'Synthetic inputs, the same for every scanner, scored span by span. Start from a provider or a family, or see what changed.',
      meta: [],
    },
    runState: resolveRunState(run),
    tiles: resolveHubTiles(list, findings),
    levels: levelLinks(),
    byLevel: measured ? LEVELS.map(level => ({ level: resolveAnswers(measured, level), peers: resolvePeers(measured, findings, level) })) : null,
    answersMeta: measured ? answerMeta(measured, catalog) : [],
    findings: resolveFindings(findings),
  };
}

// ---- /report/providers, /report/families -----------------------------------------

export interface ListPageData {
  head: HeadData;
  runState: RunState;
  list: FamilyList;
  footnote: string;
}

async function listPage(title: 'Providers' | 'Families'): Promise<ListPageData> {
  const { catalog, run, measured, rows } = await context();
  const list = resolveFamilyList(catalog, rows);
  const { totals } = list;
  const facts = measured ? runFacts(measured) : [];
  return {
    runState: resolveRunState(run),
    list,
    footnote: `${int(totals.global)} fixtures are global or not tied to one family. They count in no provider or family row.`,
    head: title === 'Providers'
      ? {
          eyebrow: 'redact-secret · Report', title,
          lede: 'Counts are fixture rows for redact-secret on the current run. Open a provider to see its families, then pick a family to see every row behind it. A fixture in two families counts once for its provider.',
          meta: [{ value: `${int(totals.providers)} providers` }, { value: `${int(totals.families)} families` }, { value: `${int(totals.fixtures)} fixtures` }, ...facts],
        }
      : {
          eyebrow: 'redact-secret · Report', title,
          lede: 'One row per credential family, in taxonomy order. Counts are fixture rows for redact-secret on the current run; a fixture in two families appears in both rows.',
          meta: [
            { value: `${int(totals.families)} families` }, { value: `${int(totals.familiesWithFixtures)} with fixtures` },
            ...(measured ? [{ value: `${int(totals.familiesNeedingLook)} need a look` }] : []), ...facts,
          ],
        },
  };
}

export const resolveProvidersPage = () => listPage('Providers');
export const resolveFamiliesPage = () => listPage('Families');

// ---- /report/families/[family] ---------------------------------------------------

export interface FamilyPageData {
  family: FamilyDetail;
  runState: RunState;
  meta: MetaItem[];
  description: string;
}

/** Every family that gets a pre-rendered page: all of them, including those with no fixtures. */
export async function resolveFamilySlugs(): Promise<string[]> {
  const catalog: Catalog = await loadCatalog();
  const slugs = catalog.taxonomy.families.map(f => familySlug(f.id));
  if (new Set(slugs).size !== slugs.length) throw new Error('Two families share a URL slug');
  return slugs;
}

export async function resolveFamilyPage(slug: string): Promise<FamilyPageData | undefined> {
  const { catalog, run, measured, rows } = await context();
  const id = catalog.taxonomy.families.find(f => familySlug(f.id) === slug)?.id;
  const family = id ? resolveFamily(catalog, id, rows) : undefined;
  if (!family) return undefined;
  return {
    family,
    runState: resolveRunState(run),
    meta: [
      { value: family.providerName },
      { label: 'Detectors:', value: family.detectors.length ? family.detectors.join(', ') : 'none mapped' },
      ...(measured ? runFacts(measured) : []),
    ],
    description: `${int(family.fixtureCount)} rows for redact-secret only. Rows that need a look come first (${int(family.needsLookCount)}), then the rest in corpus order.`,
  };
}
