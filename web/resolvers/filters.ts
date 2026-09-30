/**
 * The list filters and the query-string contract, shared by the server render
 * (default state) and the client islands that read the URL. Pure and free of
 * `node:` imports, so a client component may import it; it imports no service.
 *
 * Query state lives in the URL so a shared link reproduces the view on a static
 * export (see docs/decisions/2026-09-30-...): `?q=` is the search text and
 * `?show=` is `signal` (needs a look) or `empty` (no fixtures); `all` is the
 * default and is left out of the URL.
 */
import type { ReportShow } from '../components/report/types';
import type { FamilyItem, ProviderItem } from './families';
import { count } from './format';

export const SHOW_VALUES: ReportShow[] = ['all', 'signal', 'empty'];

export interface ListQuery { q: string; show: ReportShow }

export function listQueryOf(params: { get(name: string): string | null }): ListQuery {
  const show = params.get('show');
  return { q: (params.get('q') ?? '').trim(), show: SHOW_VALUES.includes(show as ReportShow) ? (show as ReportShow) : 'all' };
}

/** The search string for a query, `''` for the default view. */
export function listQueryString({ q, show }: ListQuery): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (show !== 'all') params.set('show', show);
  const text = params.toString();
  return text ? `?${text}` : '';
}

const passes = (item: { hasFixtures: boolean; needsLook: boolean }, show: ReportShow): boolean =>
  show === 'all' || (show === 'signal' ? item.needsLook : !item.hasFixtures);
const matches = (search: string, q: string): boolean => !q || search.includes(q.toLowerCase());

export function filterFamilies(items: FamilyItem[], { q, show }: ListQuery): { items: FamilyItem[]; resultText: string } {
  const shown = items.filter(i => passes(i, show) && matches(i.search, q));
  return { items: shown, resultText: count(shown.length, 'family', 'families') };
}

/** Providers keep the families that match, and a provider whose name matches keeps all of its families that pass `show`. */
export function filterProviders(items: ProviderItem[], { q, show }: ListQuery): { items: ProviderItem[]; resultText: string } {
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
