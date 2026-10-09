import { BASE, FAMILY, FIXTURE, FIXTURE_TITLE, SUITE, expect, fixtureReady, test } from './fixtures';

/** Set a marker on the window; if it is still there after a navigation, the page was not reloaded. */
const markWindow = (page: import('@playwright/test').Page) => page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
const windowKept = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true);

test.describe('desktop navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the header names the two sections and marks the current one; the section navigation lists its pages', async ({ page }) => {
    await page.goto(`${BASE}/report/families/`);
    const primary = page.getByRole('navigation', { name: 'Primary', exact: true });
    await expect(primary.getByRole('link', { name: 'Report' })).toHaveAttribute('aria-current', 'page');
    await expect(primary.getByRole('link', { name: 'Comparison' })).not.toHaveAttribute('aria-current');
    const section = page.getByRole('navigation', { name: 'Report pages' });
    await expect(section.getByRole('link')).toHaveText(['Overview', 'Providers', 'Families', 'Detectors', 'Findings']);
    await expect(section.getByRole('link', { name: 'Families' })).toHaveAttribute('aria-current', 'page');
  });

  test('every page of both sections is reachable by following links, inside the app (no reload)', async ({ page }) => {
    await page.goto(`${BASE}/report/`);
    await markWindow(page);
    for (const [name, path, heading] of [
      ['Providers', '/report/providers/', /provider/i],
      ['Families', '/report/families/', /famil/i],
      ['Detectors', '/report/detectors/', /detector/i],
      ['Findings', '/report/findings/', /finding|changed/i],
      ['Overview', '/report/', /benchmark shows/i],
    ] as const) {
      await page.getByRole('navigation', { name: 'Report pages' }).getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(`${BASE}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    }
    await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Comparison' }).click();
    await expect(page).toHaveURL(`${BASE}/comparison/`);
    for (const [name, path] of [['Features', '/comparison/feature/'], ['Runtime', '/comparison/runtime/'], ['Performance', '/comparison/performance/'], ['Accuracy', '/comparison/accuracy/']] as const) {
      await page.getByRole('navigation', { name: 'Comparison pages' }).getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(`${BASE}${path}`);
      await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
    }
    expect(await windowKept(page)).toBe(true);
  });

  test('a family page has a breadcrumb back to its provider list; the logo goes home', async ({ page }) => {
    await page.goto(`${BASE}/report/families/${FAMILY}/`);
    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await crumbs.getByRole('link', { name: 'Providers' }).click();
    await expect(page).toHaveURL(`${BASE}/report/providers/`);
    await page.getByRole('link', { name: 'Redact Secret benchmarks, home' }).click();
    await expect(page).toHaveURL(`${BASE}/`);
  });

  test('the bottom tab bar is not shown on a wide screen', async ({ page }) => {
    await page.goto(`${BASE}/report/`);
    await expect(page.getByRole('navigation', { name: 'Primary, bottom bar' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeVisible();
  });
});

test.describe('phone navigation', () => {
  test.use({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });

  test('the entrances move to a bar fixed at the bottom of the screen; the top row keeps the logo and the theme', async ({ page }) => {
    await page.goto(`${BASE}/report/families/`);
    const bar = page.getByRole('navigation', { name: 'Primary, bottom bar' });
    await expect(bar).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: /Color theme:/ })).toBeVisible();
    const box = (await bar.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    // It stays put while the page scrolls.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const after = (await bar.boundingBox())!;
    expect(Math.round(after.y + after.height)).toBe(viewport.height);
    await expect(bar.getByRole('link', { name: 'Report' })).toHaveAttribute('aria-current', 'page');
  });

  test('the bar navigates, and at the end of a long page the footer is not hidden behind it', async ({ page }) => {
    await page.goto(`${BASE}/report/families/`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.getByRole('contentinfo').locator('p').last();
    const bar = (await page.getByRole('navigation', { name: 'Primary, bottom bar' }).boundingBox())!;
    const foot = (await footer.boundingBox())!;
    expect(foot.y + foot.height).toBeLessThanOrEqual(bar.y + 2);
    await page.getByRole('navigation', { name: 'Primary, bottom bar' }).getByRole('link', { name: 'Comparison' }).tap();
    await expect(page).toHaveURL(`${BASE}/comparison/`);
    await expect(page.getByRole('navigation', { name: 'Primary, bottom bar' }).getByRole('link', { name: 'Comparison' })).toHaveAttribute('aria-current', 'page');
  });

  test('touch targets in the bar are at least 44 CSS pixels tall', async ({ page }) => {
    await page.goto(`${BASE}/report/`);
    for (const link of await page.getByRole('navigation', { name: 'Primary, bottom bar' }).getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('addresses the export does not contain', () => {
  test('are a 404 with a page that says so and offers the way on', async ({ page }) => {
    const response = await page.goto(`${BASE}/report/families/no-such--family/`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'All families' })).toBeVisible();
    await page.getByRole('link', { name: 'All providers' }).click();
    await expect(page).toHaveURL(`${BASE}/report/providers/`);
  });

  // Old /fixture/<suite>--<id> links (#594). The suite and fixture are read from the export, so a repin cannot break these.
  test('an old fixture link opens that fixture on its suite page, keeping the query and the hash', async ({ page }) => {
    await page.goto(`${BASE}/fixture/${SUITE}--${FIXTURE}?show=all#legacy`);
    await expect(page).toHaveURL(`${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}&show=all#legacy`);
    await fixtureReady(page);
    await expect(page.getByRole('heading', { level: 1, name: FIXTURE_TITLE })).toBeVisible();
  });

  test('an old fixture link to a fixture the suite does not hold is a 404 that names the suite and links to it', async ({ page }) => {
    const response = await page.goto(`${BASE}/fixture/${SUITE}--no-such-fixture-id`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText('No fixture “no-such-fixture-id” in the suite', { exact: false })).toBeVisible();
    await page.getByRole('link', { name: `Fixtures in ${SUITE}` }).click();
    await expect(page).toHaveURL(`${BASE}/report/fixtures/${SUITE}/`);
  });

  test('an old fixture link to a suite the export does not have is a 404 that says so, as is the same suite reached through the host redirect', async ({ page }) => {
    for (const address of ['/fixture/no-such-suite--abc', '/report/fixtures/no-such-suite/?fixture=abc']) {
      const response = await page.goto(`${BASE}${address}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText('No suite “no-such-suite”')).toBeVisible();
      await expect(page.getByRole('link', { name: 'All suites' })).toBeVisible();
    }
  });

  test('an old fixture address that is not well formed stays the ordinary 404', async ({ page }) => {
    for (const address of ['/fixture/', '/fixture/nodoublehyphen', `/fixture/${SUITE}--bad%2Fid`]) {
      const response = await page.goto(`${BASE}${address}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText('Nothing is recorded at this address')).toBeVisible();
    }
  });

  test('the retired /next/ prefix is not in the export (the host redirects it)', async ({ page }) => {
    const response = await page.goto('/next/report/');
    expect(response?.status()).toBe(404);
  });

  test('robots.txt allows crawling and the favicon is served', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/^User-agent: \*\s+Allow: \/\s*$/);
    expect((await request.get('/favicon.svg')).status()).toBe(200);
  });
});

test.describe('skip link', () => {
  test('is the first stop, appears on focus and moves to the content', async ({ page }) => {
    await page.goto(`${BASE}/report/`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#content$/);
    // The next stop is inside the page, not the header again.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true);
  });
});
