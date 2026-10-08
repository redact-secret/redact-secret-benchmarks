import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

const out = path.resolve(__dirname, '../../out');
export const BASE = '';

export interface Watch {
  /** Anything a reader's browser would report as broken: console errors and warnings, uncaught errors, failed or 4xx/5xx same-origin requests. */
  problems: string[];
  /** Every request that left the origin. The site may ask for web fonts and nothing else. */
  external: string[];
}

/**
 * Chrome's own advice, not a fault of the page: a stylesheet preloaded "but not used within a few seconds from the
 * window's load event". Next's viewport link prefetch preloads the CSS chunks of the route a link leads to (the header
 * links to /report, whose fixture chunks no comparison page applies), and Chrome warns about any preload still unapplied
 * about three seconds after load. Whether it appears depends only on how long a test keeps the page open (a slow CI runner,
 * a long test), so it failed matrix routes the PR never touched (reproduced: an 8 s wait on /comparison/runtime/ prints it).
 * The preload is the prefetch working, so there is nothing to fix in the app; only this message, for a built stylesheet of
 * this origin, is dropped. Any other warning, including an app's own console.warn, still fails.
 */
export function isUnusedPreloadAdvice(text: string, origin: string): boolean {
  const match = /^The resource (\S+) was preloaded using link preload but not used within a few seconds from the window's load event\. Please make sure it has an appropriate `as` value and it is preloaded intentionally\.$/.exec(text);
  return !!match && match[1].startsWith(`${origin}${BASE}/_next/static/`) && match[1].endsWith('.css');
}

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

/**
 * True once React has hydrated what a reader can operate: every control, link and field inside main (and
 * the header) has a React fiber attached. Until then a click or a typed character reaches server-rendered
 * HTML that no handler is listening to, and a controlled input is reset by hydration, so a test that
 * interacts first is racing the page, not testing it. Runs in the page.
 */
const hydrated = (): boolean => {
  const operable = [...document.querySelectorAll('header a, header button, main a, main button, main input, main select, main summary')];
  return operable.length > 0 && operable.every(el => Object.keys(el).some(key => key.startsWith('__reactFiber$')));
};

export const test = base.extend<{ watch: Watch }>({
  // The suite never touches the network. A font request is answered with an empty body so the page
  // loads as it would with a font blocker; every other host is recorded and answered the same way.
  // ERR_ABORTED is the page cancelling its own request (Next cancels a link prefetch it no longer needs), not a failure.
  watch: [async ({ page, baseURL, javaScriptEnabled }, use) => {
    const origin = new URL(baseURL!).origin;
    const watch: Watch = { problems: [], external: [] };
    if (javaScriptEnabled !== false) {
      // Every navigation the test starts returns when the page is hydrated, so the next line may interact.
      for (const method of ['goto', 'reload'] as const) {
        const original = page[method].bind(page) as (...args: unknown[]) => Promise<unknown>;
        (page as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
          const result = await original(...args);
          await page.waitForFunction(hydrated);
          return result;
        };
      }
    }
    await page.route(url => new URL(url).origin !== origin, route => {
      const url = new URL(route.request().url());
      watch.external.push(url.hostname);
      return route.fulfill({ status: 200, contentType: url.hostname === 'fonts.googleapis.com' ? 'text/css' : 'font/woff2', body: '' });
    });
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type()) || isUnusedPreloadAdvice(message.text(), origin)) return;
      watch.problems.push(`console.${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => watch.problems.push(`pageerror: ${error.message}`));
    page.on('requestfailed', request => request.failure()?.errorText === 'net::ERR_ABORTED' ? undefined : watch.problems.push(`requestfailed: ${request.url()} (${request.failure()?.errorText})`));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) watch.problems.push(`HTTP ${response.status()}: ${response.url()}`); });
    await use(watch);
  }, { auto: true }],
});

/** A fixture's page is drawn: states what the view is in when it is not (loading, error, missing), so a failure names it. */
export async function fixtureReady(page: Page): Promise<void> {
  const view = page.locator('[data-fixture-state]');
  await expect(view).toHaveAttribute('data-fixture-state', 'ready');
  await expect(view).toBeVisible();
}

export const onlyFontHosts =(watch: Watch): string[] => [...new Set(watch.external)].filter(host => !FONT_HOSTS.has(host));

// ---- What the export contains ------------------------------------------------------------------

const dirs = (relative: string): string[] => readdirSync(path.join(out, relative), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

/** A suite with a fixture page: its id, and the id of its first fixture. */
function aSuite(): { suite: string; fixture: string } {
  const suite = dirs('report/fixtures').includes('common-formats') ? 'common-formats' : dirs('report/fixtures')[0];
  const file = JSON.parse(readFileSync(path.join(out, 'data/fixtures', suite, 'records.json'), 'utf8')) as { records: { id: string }[] };
  return { suite, fixture: file.records[0].id };
}

const { suite, fixture } = aSuite();
export const SUITE = suite;
export const FIXTURE = fixture;
export const FAMILY = dirs('report/families')[0];

/** The first list behind a method count (#623) the export holds a file for, as its address; none when no evaluation was published. */
function aChecksList(): string | undefined {
  for (const method of ['twin', 'benign', 'metamorphic', 'mutation', 'differential']) {
    const base = `data/evaluation/${method}`;
    let row: string | undefined, scanner: string | undefined, status: string | undefined;
    try { row = dirs(base).sort()[0]; scanner = row && dirs(`${base}/${row}`).sort()[0]; status = scanner && dirs(`${base}/${row}/${scanner}`).sort()[0]; } catch { continue; }
    if (row && scanner && status) return `/evaluation/method/${method}/checks/?row=${encodeURIComponent(row)}&scanner=${encodeURIComponent(scanner)}&status=${status}`;
  }
  return undefined;
}
export const CHECKS_LIST = aChecksList();
export const DETECTOR = dirs('report/detectors')[0];

// WEB_BROWSER_SELECT (#656): the JSON `{ routes: [...] }` of scripts/ci-plan.mjs restricts the page matrix to the routes a change can reach. `a/b` is that page,
// `a/b/*` the pages below it; `{ "all": true }`, nothing or an unreadable value is every route. The other specs name their own pages and always run.
const select: { routes: string[] } | null = (() => { try { const v = JSON.parse(process.env.WEB_BROWSER_SELECT || 'null'); return v && !v.all && Array.isArray(v.routes) ? v : null; } catch { return null; } })();
const selected = (route: string) => !select || select.routes.some(entry => { const r = route.split('?')[0].replace(/^\/+|\/+$/g, ''); return entry.endsWith('*') ? r.startsWith(entry.slice(0, -1)) : r === entry; });

/** Every kind of page the site has, with the address variants that change what is drawn. */
export const ROUTES: string[] = [
  '/', '/report/', '/report/?level=T2', '/report/?level=T3&peers=1',
  '/report/providers/', '/report/providers/?q=github&show=signal',
  '/report/families/', '/report/families/?level=T2&show=empty', `/report/families/${FAMILY}/`,
  '/report/detectors/', `/report/detectors/${DETECTOR}/`,
  '/report/findings/',
  '/report/fixtures/', `/report/fixtures/${SUITE}/`, `/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}`,
  '/report/rows/T1/', '/report/rows/T2/', '/report/rows/T3/?show=leaked',
  '/comparison/', '/comparison/feature/', '/comparison/feature/?rows=differences',
  '/comparison/runtime/', '/comparison/runtime/?view=speed', '/comparison/runtime/?analysis=external&domain=credentials',
  '/comparison/performance/', '/comparison/accuracy/', '/comparison/accuracy/?data=pii',
  '/evaluation/credential/', '/evaluation/pii/',
  '/evaluation/rc/', '/evaluation/scanner/', '/evaluation/qualification/', '/evaluation/qualification/unattributed/1/',
  '/evaluation/', ...['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'].map(m => `/evaluation/method/${m}/`),
  ...['twin', 'benign', 'metamorphic', 'mutation', 'differential'].map(m => `/evaluation/method/${m}/checks/`),
  ...(CHECKS_LIST ? [CHECKS_LIST] : []),
].filter(selected).map(route => `${BASE}${route}`);

/** Resolves with the page's own links, so a test can follow the real hrefs rather than guess them. */
export const hrefs = (page: import('@playwright/test').Page, selector: string) => page.locator(selector).evaluateAll(links => links.map(a => (a as HTMLAnchorElement).getAttribute('href')));
