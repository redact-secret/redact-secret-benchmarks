// @vitest-environment node
import { expect, test, vi } from 'vitest';
vi.mock('../../resolvers/pages', () => ({
  resolveFamilySlugs: async () => ['synthetic--family'],
  resolveDetectorSlugs: async () => ['synthetic-detector'],
  resolveSuiteSlugs: async () => ['synthetic-suite'],
  resolveLevelSlugs: () => ['T1', 'T2', 'T3'],
}));
vi.mock('../../resolvers/qualification-pages', () => ({
  resolveQualificationFamilySlugs: async () => ['synthetic--family'],
  resolveQualificationCaseParams: async () => [{ family: 'synthetic--family', page: '2' }],
  resolveQualificationUnattributedParams: async () => [{ page: '1' }],
}));
import { resolveSitemapPage } from '../../resolvers/sitemap-pages';

test('canonical sitemap retains generated detail pages and four entrances, without compatibility aliases or nonexistent checks', async () => {
  const urls = (await resolveSitemapPage()).map(entry => entry.url);
  const paths = urls.map(url => new URL(url).pathname);
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls.every(url => new URL(url).origin === 'https://benchmarks.redactsecret.dev')).toBe(true);
  expect(paths).toEqual(expect.arrayContaining([
    '/coverage/credential/', '/coverage/pii/', '/evaluation/credential/', '/evaluation/pii/',
    '/evaluation/pii/results/', '/evaluation/pii/evidence/', '/report/corpus/synthetic-suite/',
    '/report/families/synthetic--family/', '/report/detectors/synthetic-detector/',
    '/evaluation/qualification/families/synthetic--family/cases/2/',
    '/evaluation/qualification/unattributed/1/', '/evaluation/method/holdout/',
  ]));
  expect(paths).not.toEqual(expect.arrayContaining(['/coverage/', '/evaluation/scanner/', '/report/fixtures/', '/evaluation/method/holdout/checks/']));
});
