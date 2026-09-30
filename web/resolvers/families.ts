/**
 * Providers, families and their fixture-row counts, resolved to the props of
 * ProviderTree, FamilyTable and FixtureTable. Pure: raw catalog and run in,
 * props out.
 *
 * Counting rules, all "of fixture rows, for redact-secret, in one run":
 *
 *  - fixtures    every fixture with a reviewed relationship to the family, at any
 *                evidence level. A fixture related to two families is in both
 *                rows; at provider level it counts once (a provider's row never
 *                double counts). A fixture with no family is global and appears
 *                in no family or provider row.
 *  - leftReadable  a must-redact or policy row where some secret span was
 *                PARTIAL or MISS.
 *  - tooMuch     a row where some secret span was OVERBROAD.
 *  - falseAlarms a control row the scanner flagged.
 *  - notMeasured a fixture with no recorded row: its suite report was left out,
 *                or the run has none. Never counted as zero.
 *
 * A family or provider with no fixtures resolves to `counts: null`, which the
 * blocks draw as "No fixtures", never as zeros.
 */
import type { Catalog, CatalogFixture } from '../services/catalog';
import type { RowResult } from '../services/run';
import type {
  FamilyAboutData, FamilyEntry, FamilyRowData, FixtureCounts, FixtureRowData, ProviderGroupData, StatusLabel,
} from '../components/report/types';
import { count, int } from './format';

export const NOT_PROVIDER_SPECIFIC = { id: 'not-provider-specific', name: 'Not provider-specific' };

/** `aws:iam-user-access-key` -> `aws--iam-user-access-key`: a path segment with no colon. */
export const familySlug = (id: string): string => id.replace(':', '--');
export const familyHref = (id: string): string => `/report/families/${familySlug(id)}/`;

export type Tally = { fixtures: number; leftReadable: number; tooMuch: number; falseAlarms: number; notMeasured: number };
const empty = (): Tally => ({ fixtures: 0, leftReadable: 0, tooMuch: 0, falseAlarms: 0, notMeasured: 0 });

export const isLeft = (row: RowResult): boolean => !!row.spanOutcomes?.some(o => o === 'PARTIAL' || o === 'MISS');
export const isTooMuch = (row: RowResult): boolean => !!row.spanOutcomes?.includes('OVERBROAD');

/** Tally fixtures. `rows` is `undefined` when no run was published: every fixture is then not measured. */
export function tally(fixtures: CatalogFixture[], rows: Map<string, RowResult> | undefined): Tally {
  const t = empty();
  for (const f of fixtures) {
    t.fixtures++;
    const row = rows?.get(f.slug);
    if (!row) { t.notMeasured++; continue; }
    if (isLeft(row)) t.leftReadable++;
    if (isTooMuch(row)) t.tooMuch++;
    if (row.flagged === true) t.falseAlarms++;
  }
  return t;
}

/** Fixture counts as text. `null` when there are no fixtures at all. */
export function countsOf(t: Tally, measured: boolean): FixtureCounts | null {
  if (t.fixtures === 0) return null;
  if (!measured) return { leftReadable: '—', tooMuch: '—', falseAlarms: '—', notMeasured: int(t.notMeasured) };
  return {
    leftReadable: int(t.leftReadable), tooMuch: int(t.tooMuch), falseAlarms: int(t.falseAlarms),
    ...(t.notMeasured > 0 ? { notMeasured: int(t.notMeasured) } : {}),
  };
}

const needsLook = (t: Tally): boolean => t.leftReadable > 0 || t.tooMuch > 0 || t.falseAlarms > 0;

/** A row the list filters can search and classify without re-deriving anything. */
export interface Filterable { hasFixtures: boolean; needsLook: boolean; search: string }
export interface FamilyItem extends Filterable { row: FamilyRowData; entry: FamilyEntry }
export interface ProviderItem extends Filterable { group: ProviderGroupData; families: FamilyItem[] }

export interface FamilyList {
  providers: ProviderItem[];
  families: FamilyItem[];
  totals: { providers: number; providersWithFixtures: number; families: number; familiesWithFixtures: number; familiesNeedingLook: number; fixtures: number; global: number };
}

export function resolveFamilyList(catalog: Catalog, rows: Map<string, RowResult> | undefined): FamilyList {
  const measured = rows !== undefined;
  const { taxonomy, providerById } = catalog;

  const familyItem = (id: string): FamilyItem => {
    const family = catalog.familyById.get(id)!;
    const fixtures = catalog.fixturesByFamily.get(id) ?? [];
    const t = tally(fixtures, rows);
    const providerName = family.provider === null ? NOT_PROVIDER_SPECIFIC.name : providerById.get(family.provider)!.name;
    const counts = countsOf(t, measured);
    const search = `${providerName} ${family.name} ${family.id}`.toLowerCase();
    return {
      hasFixtures: t.fixtures > 0, needsLook: needsLook(t), search,
      row: { id: family.id, name: family.name, href: familyHref(family.id), provider: providerName, fixtures: int(t.fixtures), counts },
      entry: { id: family.id, name: family.name, href: familyHref(family.id), fixturesLabel: count(t.fixtures, 'fixture'), counts },
    };
  };

  // Families in taxonomy order; providers in taxonomy order, then the group for families no provider owns.
  const families = taxonomy.families.map(f => familyItem(f.id));
  const groups: { id: string; name: string; familyIds: string[] }[] = taxonomy.providers.map(p => ({
    id: p.id, name: p.name, familyIds: taxonomy.families.filter(f => f.provider === p.id).map(f => f.id),
  }));
  const generic = taxonomy.families.filter(f => f.provider === null).map(f => f.id);
  if (generic.length) groups.push({ ...NOT_PROVIDER_SPECIFIC, familyIds: generic });

  const byId = new Map(families.map(f => [f.row.id, f]));
  const providers: ProviderItem[] = groups.filter(g => g.familyIds.length > 0).map(g => {
    // A fixture related to two of a provider's families counts once for the provider.
    const unique = new Map<string, CatalogFixture>();
    for (const id of g.familyIds) for (const f of catalog.fixturesByFamily.get(id) ?? []) unique.set(f.slug, f);
    const t = tally([...unique.values()], rows);
    const items = g.familyIds.map(id => byId.get(id)!);
    return {
      hasFixtures: t.fixtures > 0, needsLook: needsLook(t),
      search: `${g.name} ${g.id}`.toLowerCase(),
      group: {
        id: g.id, name: g.name,
        familiesLabel: count(items.length, 'family', 'families'),
        fixturesLabel: count(t.fixtures, 'fixture'),
        counts: countsOf(t, measured),
        families: items.map(i => i.entry),
      },
      families: items,
    };
  });

  return {
    providers, families,
    totals: {
      providers: providers.filter(p => p.group.id !== NOT_PROVIDER_SPECIFIC.id).length,
      providersWithFixtures: providers.filter(p => p.group.id !== NOT_PROVIDER_SPECIFIC.id && p.hasFixtures).length,
      families: families.length,
      familiesWithFixtures: families.filter(f => f.hasFixtures).length,
      familiesNeedingLook: families.filter(f => f.needsLook).length,
      fixtures: catalog.fixtures.filter(f => f.familyIds.length > 0).length,
      global: catalog.fixtures.filter(f => f.familyIds.length === 0).length,
    },
  };
}

// ---- One family --------------------------------------------------------------

const KIND_TITLE: Record<string, string> = { 'must-redact': 'Must redact', 'must-not-flag': 'Must not flag', policy: 'Project policy' };
const TIER_TITLE: Record<string, string> = { T1: 'Provider-documented', T2: 'Tool-corroborated', T3: 'Project policy', T0: 'Pending' };

/** One fixture row: a word and a status, never a colour alone. A policy row records a difference of opinion, so it is information, not failure. */
export function outcomeOf(f: CatalogFixture, row: RowResult | undefined): StatusLabel {
  if (!row) return { status: 'not-measured', label: 'Not measured' };
  const policy = f.kind === 'policy';
  if (row.spanOutcomes) {
    if (isLeft(row)) return { status: policy ? 'info' : 'fail', label: 'Left readable' };
    if (isTooMuch(row)) return { status: policy ? 'info' : 'review', label: 'Too much' };
    return { status: policy ? 'info' : 'pass', label: 'Redacted' };
  }
  if (row.flagged != null) return row.flagged ? { status: policy ? 'info' : 'fail', label: 'Flagged' } : { status: 'pass', label: 'Quiet' };
  return { status: 'not-measured', label: 'Unscored' };
}

const rowClean = (row: RowResult | undefined): boolean => !row || (row.spanOutcomes ? row.spanOutcomes.every(o => o === 'EXACT' || o === 'COVERED') : !row.flagged);

export interface FamilyDetail {
  id: string;
  slug: string;
  name: string;
  providerName: string;
  providerId: string | null;
  detectors: string[];
  about: FamilyAboutData;
  facts: { term: string; value: string }[] | undefined;
  /** Every row, rows needing a look first, then corpus order. The page paginates. */
  rows: FixtureRowData[];
  needsLookCount: number;
  fixtureCount: number;
}

const hostOf = (url: string): string => {
  try { return new URL(url).host; } catch { return url; }
};

export function resolveFamily(catalog: Catalog, id: string, rows: Map<string, RowResult> | undefined): FamilyDetail | undefined {
  const family = catalog.familyById.get(id);
  if (!family) return undefined;
  const fixtures = catalog.fixturesByFamily.get(id) ?? [];
  const t = tally(fixtures, rows);
  const measured = rows !== undefined;
  const resolved = fixtures.map(f => {
    const row = rows?.get(f.slug);
    const unscored = f.tier === 'T0';
    return {
      attention: !rowClean(row),
      data: {
        slug: f.id,
        group: `${f.category} · ${f.group}`,
        ...(f.familyIds.length > 1 ? { alsoIn: `also in ${count(f.familyIds.length - 1, 'other family', 'other families')}` } : {}),
        kind: unscored ? 'Pending review' : KIND_TITLE[f.kind] ?? f.kind,
        evidence: `${f.tier} · ${TIER_TITLE[f.tier] ?? f.tier}${f.twinOf ? ' · twin' : ''}`,
        outcome: outcomeOf(f, row),
      } satisfies FixtureRowData,
    };
  });
  const ordered = [...resolved.filter(r => r.attention), ...resolved.filter(r => !r.attention)].map(r => r.data);
  const providerName = family.provider === null ? NOT_PROVIDER_SPECIFIC.name : catalog.providerById.get(family.provider)!.name;
  return {
    id: family.id, slug: familySlug(family.id), name: family.name, providerName, providerId: family.provider,
    detectors: family.detectors,
    about: {
      description: family.description,
      ...(family.note ? { note: family.note } : {}),
      ...(family.sources?.length ? { sources: family.sources.map(href => ({ href, host: hostOf(href) })) } : {}),
    },
    facts: t.fixtures === 0 ? undefined : [
      { term: 'Fixtures', value: int(t.fixtures) },
      { term: 'Left readable', value: measured ? int(t.leftReadable) : '—' },
      { term: 'Redacted too much', value: measured ? int(t.tooMuch) : '—' },
      { term: 'False alarms', value: measured ? int(t.falseAlarms) : '—' },
      ...(t.notMeasured > 0 ? [{ term: 'Not measured', value: int(t.notMeasured) }] : []),
    ],
    rows: ordered,
    needsLookCount: resolved.filter(r => r.attention).length,
    fixtureCount: t.fixtures,
  };
}
