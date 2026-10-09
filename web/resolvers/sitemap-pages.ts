import { ROUTES } from '../lib/routes';
import { FOOTER_GROUPS, SITE_ORIGIN } from '../lib/site';
import { METHOD_IDS } from '../lib/methods';
import { resolveDetectorSlugs, resolveFamilySlugs, resolveLevelSlugs, resolveSuiteSlugs } from './pages';
import { resolveQualificationCaseParams, resolveQualificationFamilySlugs, resolveQualificationUnattributedParams } from './qualification-pages';

/** Only canonical pages, from the same validated lists that generate their static routes. */
export async function resolveSitemapPage() {
  const [families, detectors, suites, qualificationFamilies, qualificationCases, unattributed] = await Promise.all([
    resolveFamilySlugs(), resolveDetectorSlugs(), resolveSuiteSlugs(),
    resolveQualificationFamilySlugs(), resolveQualificationCaseParams(), resolveQualificationUnattributedParams(),
  ]);
  const paths = new Set([
    '/', ...ROUTES.map(route => route.href), ...FOOTER_GROUPS.flatMap(group => group.links.map(link => link.href)),
    ...families.map(id => `/report/families/${id}/`),
    ...detectors.map(id => `/report/detectors/${id}/`),
    ...suites.map(id => `/report/corpus/${id}/`),
    ...resolveLevelSlugs().map(level => `/report/rows/${level}/`),
    ...METHOD_IDS.map(id => `/evaluation/method/${id}/`),
    ...METHOD_IDS.filter(id => id !== 'holdout').map(id => `/evaluation/method/${id}/checks/`),
    ...qualificationFamilies.map(id => `/evaluation/qualification/families/${id}/`),
    ...qualificationCases.map(({ family, page }) => `/evaluation/qualification/families/${family}/cases/${page}/`),
    ...unattributed.map(({ page }) => `/evaluation/qualification/unattributed/${page}/`),
  ]);
  return [...paths].sort().map(path => ({ url: new URL(path, SITE_ORIGIN).href }));
}
