// @vitest-environment jsdom
/**
 * Every route renders from the real committed corpora and the benchmark run, the same data
 * `next build` reads (the `web` CI job runs `npm run bench` first). Each page is called as Next
 * calls it (params from `generateStaticParams`), rendered into a DOM and read the way a reader or
 * a screen reader would: one h1, a main landmark's worth of content, no leaked `undefined` or `NaN`.
 */
import './next-mocks';
import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, test } from 'vitest';
import { NOT_FOUND } from './next-mocks';

interface PageModule {
  default: (props: { params: Promise<Record<string, string>> }) => Promise<ReactElement> | ReactElement;
  generateStaticParams?: () => Promise<Record<string, string>[]> | Record<string, string>[];
  generateMetadata?: (props: { params: Promise<Record<string, string>> }) => Promise<{ title?: unknown }>;
  metadata?: { title?: unknown };
}

const modules = import.meta.glob('../../app/**/page.tsx') as unknown as Record<string, () => Promise<PageModule>>;

const routeOf = (file: string) => file.replace('../../app', '').replace('/page.tsx', '') || '/';

/** The leaf routes: `[segment]` routes are rendered once per `generateStaticParams` entry (the first, the middle and the last). */
async function cases() {
  const out: { route: string; label: string; params: Record<string, string>; load: () => Promise<PageModule> }[] = [];
  for (const [file, load] of Object.entries(modules)) {
    const route = routeOf(file);
    if (!route.includes('[')) { out.push({ route, label: route, params: {}, load }); continue; }
    const mod = await load();
    const all = (await mod.generateStaticParams?.()) ?? [];
    const picks = [...new Set([0, Math.floor(all.length / 2), all.length - 1])].filter(i => all[i]);
    for (const i of picks) out.push({ route, label: `${route} ${JSON.stringify(all[i])}`, params: all[i], load });
  }
  return out;
}

const all = await cases();

describe('routes', () => {
  test('every page of the app is covered', () => {
    expect(all.map(c => c.route).filter((r, i, a) => a.indexOf(r) === i).sort()).toEqual([
      '/', '/comparison', '/comparison/accuracy', '/comparison/feature', '/comparison/performance', '/comparison/runtime',
      '/evaluation', '/evaluation/credential', '/evaluation/method/[method]', '/evaluation/pii', '/evaluation/rc',
      '/report', '/report/detectors', '/report/detectors/[detector]', '/report/families', '/report/families/[family]', '/report/findings',
      '/report/fixtures', '/report/fixtures/[suite]', '/report/providers', '/report/rows/[level]',
    ]);
  });

  test.each(all.map(c => [c.label, c] as const))('%s renders its content', async (_label, c) => {
    const mod = await c.load();
    const { container } = render(await mod.default({ params: Promise.resolve(c.params) }));
    if (c.route === '/') return;
    const headings = container.querySelectorAll('h1');
    // Pre-rendered panels (levels, pairs, a fixture placeholder) each carry their own h1; CSS shows one, so the e2e suite counts the visible ones.
    expect(headings.length, 'a page has an h1').toBeGreaterThanOrEqual(1);
    expect(headings[0].textContent?.trim().length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/);
    for (const link of container.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href') ?? '';
      expect(href, `link "${link.textContent}"`).not.toMatch(/undefined|NaN|\[object/);
    }
    // Every table has a caption or a label, and every image has alternative text.
    for (const table of container.querySelectorAll('table')) expect(table.querySelector('caption') ?? table.getAttribute('aria-label')).toBeTruthy();
    for (const img of container.querySelectorAll('img')) expect(img).toHaveAttribute('alt');
  });

  test.each(all.map(c => [c.label, c] as const))('%s has a title', async (_label, c) => {
    const mod = await c.load();
    const meta = mod.generateMetadata ? await mod.generateMetadata({ params: Promise.resolve(c.params) }) : mod.metadata;
    if (c.route === '/') return;
    expect(typeof meta?.title).toBe('string');
    expect((meta!.title as string).length).toBeGreaterThan(0);
  });
});

describe('dynamic routes refuse what the export does not contain', () => {
  const bad = { level: 'T9', family: 'no-such-family', detector: 'no-such-detector', suite: 'no-such-suite' };
  test.each([
    ['/report/rows/[level]', { level: bad.level }],
    ['/report/families/[family]', { family: bad.family }],
    ['/report/detectors/[detector]', { detector: bad.detector }],
    ['/report/fixtures/[suite]', { suite: bad.suite }],
    ['/evaluation/method/[method]', { method: 'no-such-method' }],
  ])('%s with an unknown id is a 404', async (route, params) => {
    const mod = await modules[`../../app${route}/page.tsx`]();
    await expect(Promise.resolve().then(() => mod.default({ params: Promise.resolve(params) }))).rejects.toMatchObject({ digest: NOT_FOUND });
  });
});

describe('report hub', () => {
  test('says which mode the stable count came from and links to each section', async () => {
    const mod = await modules['../../app/report/page.tsx']();
    render(await mod.default({ params: Promise.resolve({}) }));
    const nav = screen.getByRole('navigation', { name: 'Report sections' });
    expect(within(nav).getAllByRole('link').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText(/published|candidate/i).length).toBeGreaterThan(0);
  });
});
