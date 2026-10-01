/**
 * Two ways a reader may have less than the full experience: asking the system for reduced motion,
 * and having no script at all (a blocker, a failed bundle, a crawler, the first paint before hydration).
 */
import type { Page } from '@playwright/test';
import { BASE, FIXTURE, SUITE, expect, test } from './fixtures';

const running = (page: Page) => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);

test.describe('reduced motion', () => {
  test('the loading skeleton pulses for a reader who has not asked for less motion', async ({ page }) => {
    await page.route(`**/data/fixtures/${SUITE}/records.json`, () => new Promise(() => {}));
    await page.goto(`${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}`);
    await expect(page.getByRole('status').filter({ visible: true })).toContainText('Loading fixture');
    await expect.poll(() => running(page)).toBeGreaterThan(0);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('nothing animates while the skeleton stands in for a fixture', async ({ page }) => {
      await page.route(`**/data/fixtures/${SUITE}/records.json`, () => new Promise(() => {}));
      await page.goto(`${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}`);
      await expect(page.getByRole('status').filter({ visible: true })).toContainText('Loading fixture');
      expect(await running(page)).toBe(0);
    });

    for (const route of ['/report/', '/report/rows/T1/', '/comparison/runtime/', '/comparison/performance/']) {
      test(`${route}: no running animation, and no transition longer than a blink`, async ({ page }) => {
        await page.goto(`${BASE}${route}`);
        await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
        expect(await running(page)).toBe(0);
        const longest = await page.evaluate(() => {
          const seconds = (value: string) => Math.max(0, ...value.split(',').map(part => (part.trim().endsWith('ms') ? parseFloat(part) / 1000 : parseFloat(part))));
          return Math.max(0, ...[...document.querySelectorAll('body *')].map(el => seconds(getComputedStyle(el).transitionDuration)));
        });
        expect(longest).toBeLessThanOrEqual(0.01);
      });
    }

    test('smooth scrolling is off', async ({ page }) => {
      await page.goto(`${BASE}/report/`);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe('smooth');
    });
  });
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });

  for (const [route, h1] of [
    ['/report/', /benchmark shows/i],
    ['/report/families/', /famil/i],
    ['/comparison/feature/', /feature/i],
    ['/comparison/runtime/', /runtime/i],
    ['/comparison/performance/', /long does it take/i],
    ['/comparison/accuracy/', /./],
  ] as const) {
    test(`${route} paints its frame, its heading and its content from the HTML alone`, async ({ page }) => {
      await page.goto(`${BASE}${route}`);
      await expect(page.getByRole('banner').getByRole('link', { name: 'Report' }).first()).toBeAttached();
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveText(h1);
      expect(await page.locator('main').innerText()).toMatch(/\S{3}/);
      await expect(page.locator('main table, main [role="region"], main ul').first()).toBeAttached();
    });
  }

  test('the rows page draws the first page of rows and says that find, filters and paging need script', async ({ page }) => {
    await page.goto(`${BASE}/report/rows/T1/`);
    expect(await page.locator('main table tbody tr').count()).toBeGreaterThanOrEqual(10);
    await expect(page.getByText(/Find, filters and paging need JavaScript/)).toBeVisible();
  });

  test('a suite page with ?fixture= still shows the suite (the fixture needs script), never a blank page', async ({ page }) => {
    await page.goto(`${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}`);
    await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
    expect(await page.locator('main table tbody tr').count()).toBeGreaterThan(0);
  });

  test('with the operating system in dark mode the page stays one consistent, readable theme (light) rather than half of each', async ({ browser }) => {
    const readable = async (colorScheme: 'light' | 'dark') => {
      const context = await browser.newContext({ javaScriptEnabled: false, colorScheme });
      const page = await context.newPage();
      await page.route(url => !url.href.startsWith('http://127.0.0.1'), route => route.fulfill({ status: 200, body: '' }));
      await page.goto(`${BASE}/report/`);
      const colors = await page.evaluate(() => ({ ink: getComputedStyle(document.querySelector('main h1')!).color, surface: getComputedStyle(document.body).backgroundColor }));
      await context.close();
      return colors;
    };
    // Without script nothing sets data-theme, so the light theme applies in full. Ink and surface must agree.
    const dark = await readable('dark');
    const light = await readable('light');
    expect(dark).toEqual(light);
    expect(dark.surface).toBe('rgb(255, 255, 255)');
  });
});
