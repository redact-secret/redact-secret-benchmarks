/**
 * The list filters and the query-string contract, shared by the server render
 * (default state) and the client islands that read the URL. Pure and free of
 * `node:` imports, so a client component may import it; it imports no service.
 *
 * Query state lives in the URL so a shared link reproduces the view on a static
 * export (see docs/decisions/2026-09-30-...): `?q=` is the search text,
 * `?show=` is `signal` (needs a look) or `empty` (no fixtures) and `?level=` is
 * one evidence level (`T1`, `T2`, `T3`, `T0`); `all` is the default for both and
 * is left out of the URL.
 */
import type { ReportShow } from '../components/report/types';
import type { FamilyItem, ProviderItem } from './families';
import { count } from './format';

export const SHOW_VALUES: ReportShow[] = ['all', 'signal', 'empty'];

/**
 * The evidence levels a list can be narrowed to. `all` is every fixture; `T0` is
 * the pending-review rows, which are never scored but are fixtures in the family.
 * A fixture has exactly one level, so the four levels add up to `all` for a family.
 */
export type ListLevel = 'all' | 'T0' | 'T1' | 'T2' | 'T3';
export const LIST_LEVELS: { level: ListLevel; label: string }[] = [
  { level: 'all', label: 'All levels' },
  { level: 'T1', label: 'Provider-documented' },
  { level: 'T2', label: 'Tool-corroborated' },
  { level: 'T3', label: 'Project policy' },
  { level: 'T0', label: 'Pending review' },
];
export const isListLevel = (value: string | null): value is ListLevel => LIST_LEVELS.some(l => l.level === value);

/** `?level=T2` on a link to a list or a family; nothing for all levels. */
export const levelQuery = (level: ListLevel): string => (level === 'all' ? '' : `?level=${level}`);

export interface ListQuery { q: string; show: ReportShow; level: ListLevel }

export function listQueryOf(params: { get(name: string): string | null }): ListQuery {
  const show = params.get('show');
  const level = params.get('level');
  return {
    q: (params.get('q') ?? '').trim(),
    show: SHOW_VALUES.includes(show as ReportShow) ? (show as ReportShow) : 'all',
    level: isListLevel(level) ? level : 'all',
  };
}

/** The search string for a query, `''` for the default view. */
export function listQueryString({ q, show, level }: ListQuery): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (show !== 'all') params.set('show', show);
  if (level && level !== 'all') params.set('level', level);
  const text = params.toString();
  return text ? `?${text}` : '';
}

const passes = (item: { hasFixtures: boolean; needsLook: boolean }, show: ReportShow): boolean =>
  show === 'all' || (show === 'signal' ? item.needsLook : !item.hasFixtures);
const matches = (search: string, q: string): boolean => !q || search.includes(q.toLowerCase());

export function filterFamilies(items: FamilyItem[], { q, show }: Pick<ListQuery, 'q' | 'show'>): { items: FamilyItem[]; resultText: string } {
  const shown = items.filter(i => passes(i, show) && matches(i.search, q));
  return { items: shown, resultText: count(shown.length, 'family', 'families') };
}

/** Providers keep the families that match, and a provider whose name matches keeps all of its families that pass `show`. */
export function filterProviders(items: ProviderItem[], { q, show }: Pick<ListQuery, 'q' | 'show'>): { items: ProviderItem[]; resultText: string } {
  const shown = items
    .map(p => {
      const providerHit = matches(p.search, q);
      return { ...p, families: p.families.filter(f => passes(f, show) && (providerHit || matches(f.search, q))) };
    })
    .filter(p => p.families.length > 0)
    .map(p => ({ ...p, group: { ...p.group, families: p.families.map(f => f.entry) } }));
  const families = shown.reduce((n, p) => n + p.families.length, 0);
  return { items: shown, resultText: `${count(shown.length, 'provider')} · ${count(families, 'family', 'families')}` };
}

/** 1-based page from `?page=`, clamped to the pages that exist. */
export function pageOf(raw: string | null, pageCount: number): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) ? Math.min(Math.max(1, n), Math.max(1, pageCount)) : 1;
}

export const PAGE_SIZE = 50;
