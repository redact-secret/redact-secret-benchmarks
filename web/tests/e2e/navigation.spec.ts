import { BASE, FAMILY, FIXTURE, FIXTURE_TITLE, SUITE, expect, fixtureReady, test } from './fixtures';

/** Set a marker on the window; if it is still there after a navigation, the page was not reloaded. */
const markWindow = (page: import('@playwright/test').Page) => page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
const windowKept = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept === true);

test.describe('desktop navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the header names the site sections and marks the current one; the section navigation lists its pages', async ({ page }) => {
    await page.goto(`${BASE}/report/families/`);
    const primary = page.getByRole('navigation', { name: 'Primary', exact: true });
    await expect(primary.getByRole('link', { name: 'Report' })).toHaveAttribute('aria-current', 'page');
    await expect(primary.getByRole('link', { name: 'Comparison' })).not.toHaveAttribute('aria-current');
    const section = page.getByRole('navigation', { name: 'Report pages' });
    await expect(section.getByRole('link')).toHaveText(['Overview', 'Providers', 'Detectors']);
    await expect(page.getByRole('navigation', { name: 'Site directory' }).getByRole('link', { name: 'Credential families', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('every page of both sections is reachable by following links, inside the app (no reload)', async ({ page }) => {
    await page.goto(`${BASE}/report/`);
    await markWindow(page);
    for (const [name, path, heading] of [
      ['Providers', '/report/providers/', /provider/i],
      ['Credential families', '/report/families/', /famil/i],
      ['Detectors', '/report/detectors/', /detector/i],
      ['Overview', '/report/', /benchmark shows/i],
    ] as const) {
      await page.getByRole('navigation', { name: name === 'Credential families' ? 'Site directory' : 'Report pages' }).getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(`${BASE}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    }
    await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Comparison' }).click();
    await expect(page).toHaveURL(`${BASE}/comparison/`);
    for (const [name, path] of [['Performance', '/comparison/performance/'], ['Accuracy', '/comparison/accuracy/']] as const) {
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

test.describe('Coverage and Evaluation split', () => {
  test('phone Coverage entrance and native detail disclosures work with the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(`${BASE}/evaluation/`);
    const bar = page.getByRole('navigation', { name: 'Primary, bottom bar' });
    await bar.getByRole('link', { name: 'Coverage', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${BASE}/coverage/credential/`);
    for (const route of ['/coverage/credential/', '/coverage/pii/']) {
      await page.goto(`${BASE}${route}`);
      const disclosure = page.locator('main details').first();
      const summary = disclosure.locator(':scope > summary');
      await summary.focus();
      await expect(summary).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(disclosure).toHaveAttribute('open', '');
      await page.keyboard.press('Enter');
      await expect(disclosure).not.toHaveAttribute('open');
    }
  });

  test('both domains are reachable from the header, keep their section current and link to their methodology', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/report/`);
    await markWindow(page);
    await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Coverage', exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/coverage/credential/`);
    for (const [label, path, evaluation] of [
      ['Credentials', '/coverage/credential/', '/evaluation/credential/'],
      ['PII + PHI', '/coverage/pii/', '/evaluation/pii/'],
    ]) {
      await page.getByRole('navigation', { name: 'Coverage pages' }).getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(`${BASE}${path}`);
      await expect(page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Coverage', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.locator(`main a[href="${BASE}${evaluation}"]`).first()).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://benchmarks.redactsecret.dev${path}`);
    }
    expect(await windowKept(page)).toBe(true);
  });

  test('a recorded PII result bookmark retains its query and selects the same result', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/pii/results/`);
    const explorer = page.getByRole('region', { name: 'PII measurement results', exact: true });
    const groups = explorer.getByLabel('Population or report');
    let anchor: string | null = null;
    const groupCount = await groups.locator('option').count();
    for (let g = 0; g < groupCount && !anchor; g++) {
      await groups.selectOption(String(g));
      const rows = explorer.getByLabel('Metric or category');
      for (let r = 0; r < await rows.locator('option').count() && !anchor; r++) {
        await rows.selectOption(String(r));
        const anchored = explorer.locator('li[id]').first();
        if (await anchored.count()) anchor = await anchored.getAttribute('id');
      }
    }
    expect(anchor, 'the export has a recorded family result bookmark').toBeTruthy();
    const fragment = `#${encodeURIComponent(anchor!)}`;
    await page.goto(`${BASE}/evaluation/pii/?view=kept&show=all${fragment}`);
    await expect(page).toHaveURL(`${BASE}/evaluation/pii/results/?view=kept&show=all${fragment}`);
    await expect(page.getByRole('region', { name: 'PII measurement results', exact: true }).locator('li[id]').first()).toHaveAttribute('id', anchor!);
  });

  test('ordinary methodology fragments remain there, and malformed fragments do not break either page', async ({ page, watch }) => {
    await page.goto(`${BASE}/evaluation/pii/?view=kept#methods`);
    await expect(page).toHaveURL(`${BASE}/evaluation/pii/?view=kept#methods`);
    for (const route of ['/evaluation/pii/', '/evaluation/pii/results/']) {
      await page.goto(`${BASE}${route}#%E0%A4%A`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(watch.problems).toEqual([]);
  });
});

test.describe('addresses the export does not contain', () => {
  test('compatibility pages provide a canonical link without JavaScript', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    try {
      for (const [old, target, label] of [
        ['/report/fixtures/', '/report/corpus/', 'Credential Corpus'],
        [`/report/fixtures/${SUITE}/`, `/report/corpus/${SUITE}/`, 'Credential Corpus'],
        ['/evaluation/scanner/', '/comparison/scanner/', 'Scanner comparison'],
      ]) {
        await page.goto(`${BASE}${old}`);
        await expect(page.getByRole('link', { name: `Open ${label}` })).toHaveAttribute('href', `${BASE}${target}`);
      }
    } finally { await context.close(); }
  });

  test('the Credential Corpus footer link opens the corpus directory', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/credential/`);
    await page.getByRole('navigation', { name: 'Site directory' }).getByRole('link', { name: 'Credential Corpus', exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/report/corpus/`);
    await expect(page.getByRole('heading', { level: 1, name: 'Credential Corpus' })).toBeVisible();
  });

  test('corpus and suite provenance opens in a dialog, closes with Escape and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 874, height: 1356 });
    for (const route of ['/report/corpus/', `/report/corpus/${SUITE}/`]) {
      await page.goto(`${BASE}${route}`);
      const trigger = page.getByRole('button', { name: 'Where these numbers come from' });
      const dialog = page.getByRole('dialog', { name: 'Where these numbers come from' });
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Where these numbers come from' })).not.toBeVisible();
      await trigger.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('complementary', { name: 'Where these numbers come from' })).toBeVisible();
      await expect(dialog.getByText('Authority', { exact: true }).first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test('Scanners belongs to Comparison and its old evaluation address preserves the query and fragment', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/scanner/?mode=published#roster`);
    await expect(page).toHaveURL(`${BASE}/comparison/scanner/?mode=published#roster`);
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Comparison' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Comparison pages' }).getByRole('link', { name: 'Scanners' })).toHaveAttribute('href', `${BASE}/comparison/scanner/`);
  });

  test('former fixture addresses open the corpus, preserving selections and fragments', async ({ page }) => {
    await page.goto(`${BASE}/report/fixtures/?q=example#corpus`);
    await expect(page).toHaveURL(`${BASE}/report/corpus/?q=example#corpus`);
    await page.goto(`${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}&show=all#spans`);
    await expect(page).toHaveURL(`${BASE}/report/corpus/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}&show=all#spans`);
    await fixtureReady(page);
    await expect(page.getByRole('heading', { level: 1, name: FIXTURE_TITLE })).toBeVisible();
  });

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
    await expect(page).toHaveURL(`${BASE}/report/corpus/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}&show=all#legacy`);
    await fixtureReady(page);
    await expect(page.getByRole('heading', { level: 1, name: FIXTURE_TITLE })).toBeVisible();
  });

  test('an old fixture link to a fixture the suite does not hold is a 404 that names the suite and links to it', async ({ page }) => {
    const response = await page.goto(`${BASE}/fixture/${SUITE}--no-such-fixture-id`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText('No fixture “no-such-fixture-id” in the suite', { exact: false })).toBeVisible();
    await page.getByRole('link', { name: `Fixtures in ${SUITE}` }).click();
    await expect(page).toHaveURL(`${BASE}/report/corpus/${SUITE}/`);
  });

  test('an old fixture link to a suite the export does not have is a 404 that says so, as is the same suite reached through the host redirect', async ({ page }) => {
    for (const address of ['/fixture/no-such-suite--abc', '/report/corpus/no-such-suite/?fixture=abc', '/report/fixtures/no-such-suite/?fixture=abc']) {
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
    expect(await robots.text()).toMatch(/^User-agent: \*\s+Allow: \/\s+Sitemap: https:\/\/benchmarks\.redactsecret\.dev\/sitemap\.xml\s*$/);
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
