import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';

export { expect };

const out = path.resolve(__dirname, '../../out');
export const BASE = '/next';

export interface Watch {
  /** Anything a reader's browser would report as broken: console errors and warnings, uncaught errors, failed or 4xx/5xx same-origin requests. */
  problems: string[];
  /** Every request that left the origin. The site may ask for web fonts and nothing else. */
  external: string[];
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
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) watch.problems.push(`console.${message.type()}: ${message.text()}`); });
    page.on('pageerror', error => watch.problems.push(`pageerror: ${error.message}`));
    page.on('requestfailed', request => request.failure()?.errorText === 'net::ERR_ABORTED' ? undefined : watch.problems.push(`requestfailed: ${request.url()} (${request.failure()?.errorText})`));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) watch.problems.push(`HTTP ${response.status()}: ${response.url()}`); });
    await use(watch);
  }, { auto: true }],
});

export const onlyFontHosts = (watch: Watch): string[] => [...new Set(watch.external)].filter(host => !FONT_HOSTS.has(host));

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
export const DETECTOR = dirs('report/detectors')[0];

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
].map(route => `${BASE}${route}`);

/** Resolves with the page's own links, so a test can follow the real hrefs rather than guess them. */
export const hrefs = (page: import('@playwright/test').Page, selector: string) => page.locator(selector).evaluateAll(links => links.map(a => (a as HTMLAnchorElement).getAttribute('href')));
