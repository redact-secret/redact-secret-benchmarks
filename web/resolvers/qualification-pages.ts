/**
 * The resolvers the qualification pages call (#606). Like `pages.ts`, this module awaits the service and hands its raw output to
 * the pure resolvers (`qualification.ts`), so a page depends on resolvers alone. Server-only.
 */
import type { QualificationCasesProps, QualificationFamilyProps, QualificationOverviewProps, QualificationUnavailableProps } from '../components/qualification/types';
import { loadQualificationView } from '../services/qualification';
import { qualificationCaseParams, qualificationUnattributedParams, resolveQualificationCases } from './qualification-cases';
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

/** Every (family, page) the export pre-renders for the case pages, or the one unavailable address when no usable view exists. */
export async function resolveQualificationCaseParams(): Promise<{ family: string; page: string }[]> {
  const load = await loadQualificationView();
  return load.state === 'ready' ? qualificationCaseParams(load.view) : [{ family: QUALIFICATION_UNAVAILABLE_SLUG, page: '1' }];
}

export async function resolveQualificationUnattributedParams(): Promise<{ page: string }[]> {
  const load = await loadQualificationView();
  return load.state === 'ready' ? qualificationUnattributedParams(load.view) : [{ page: '1' }];
}

export type QualificationCasesPage =
  | { state: 'ready'; props: QualificationCasesProps }
  | { state: 'unavailable'; props: QualificationUnavailableProps }
  | { state: 'unknown' };

/** One page of a family's cases (`family` set) or of the cases no family claims (`family` null). */
export async function resolveQualificationCasesPage(family: string | null, page: string): Promise<QualificationCasesPage> {
  const load = await loadQualificationView();
  if (load.state !== 'ready') return { state: 'unavailable', props: resolveQualificationUnavailable(load) };
  const props = resolveQualificationCases(load.view, family === null ? { kind: 'unattributed' } : { kind: 'family', family }, /^[1-9]\d*$/.test(page) ? Number(page) : NaN);
  return props ? { state: 'ready', props } : { state: 'unknown' };
}
