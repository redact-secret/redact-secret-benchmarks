/**
 * The resolvers the qualification pages call (#606). Like `pages.ts`, this module awaits the service and hands its raw output to
 * the pure resolvers (`qualification.ts`), so a page depends on resolvers alone. Server-only.
 */
import type { QualificationFamilyProps, QualificationOverviewProps, QualificationUnavailableProps } from '../components/qualification/types';
import { loadQualificationView } from '../services/qualification';
import { qualificationSlugs, resolveQualificationFamily, resolveQualificationOverview, resolveQualificationUnavailable } from './qualification';

export type QualificationPage =
  | { state: 'ready'; props: QualificationOverviewProps }
  | { state: 'unavailable'; props: QualificationUnavailableProps };

export async function resolveQualificationPage(): Promise<QualificationPage> {
  const load = await loadQualificationView();
  return load.state === 'ready' ? { state: 'ready', props: resolveQualificationOverview(load.view) } : { state: 'unavailable', props: resolveQualificationUnavailable(load) };
}

/**
 * The slug the export pre-renders when no usable view exists: `output: export` refuses a dynamic route with no params, so
 * the route keeps one page, and that page shows why there is no view (never a number). It cannot name a family.
 */
export const QUALIFICATION_UNAVAILABLE_SLUG = 'view-unavailable';

/** Every family the view scores, or the one unavailable page when no usable view exists. */
export async function resolveQualificationFamilySlugs(): Promise<string[]> {
  const load = await loadQualificationView();
  return load.state === 'ready' ? qualificationSlugs(load.view) : [QUALIFICATION_UNAVAILABLE_SLUG];
}

export type QualificationFamilyPage =
  | { state: 'ready'; props: QualificationFamilyProps }
  | { state: 'unavailable'; props: QualificationUnavailableProps }
  | { state: 'unknown' };

export async function resolveQualificationFamilyPage(slug: string): Promise<QualificationFamilyPage> {
  const load = await loadQualificationView();
  if (load.state !== 'ready') return { state: 'unavailable', props: resolveQualificationUnavailable(load) };
  const props = resolveQualificationFamily(load.view, slug);
  return props ? { state: 'ready', props } : { state: 'unknown' };
}
