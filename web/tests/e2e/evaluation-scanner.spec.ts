import { BASE, expect, test } from './fixtures';

/** Structure only: the page's routes, landmarks and controls. No version, digest, host or count is asserted (a repin re-keys them). */
test.describe('/evaluation/scanner', () => {
  test('one h1, a roster whose every scanner has a section to jump to, and a section per scanner with the same groups', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/scanner/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const roster = page.getByRole('table').first();
    const links = roster.getByRole('link');
    expect(await links.count(), 'the roster lists at least one scanner').toBeGreaterThan(0);
    const targets = await links.evaluateAll(a => a.map(x => (x as HTMLAnchorElement).getAttribute('href')));
    for (const target of targets) {
      const section = page.locator(target!);
      await expect(section, `the roster link ${target} has a section`).toHaveCount(1);
      for (const group of ['Install and pin', 'How it ran', 'Where it ran', 'Rules', 'Out of scope']) {
        await expect(section.getByRole('heading', { level: 3, name: group, exact: true })).toHaveCount(1);
      }
    }
  });

  test('a roster link moves to the scanner without leaving the page', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/scanner/`);
    const first = page.getByRole('table').first().getByRole('link').first();
    const target = await first.getAttribute('href');
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
  });

  test('the arguments disclosure opens, and every link stays inside the app', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/scanner/`);
    const summary = page.getByText('Exact arguments').first();
    expect(await summary.count(), 'a scanner shows its exact arguments').toBeGreaterThan(0);
    await summary.click();
    await expect(page.locator('details[open] pre').first()).toBeVisible();
    const hrefs = await page.locator('main a[href]').evaluateAll(a => a.map(x => (x as HTMLAnchorElement).getAttribute('href') ?? ''));
    for (const href of hrefs) expect(href, `link ${href}`).toMatch(/^(#|\/next\/)/);
  });

  test('the page names no scanner as better, faster or recommended', async ({ page }) => {
    await page.goto(`${BASE}/evaluation/scanner/`);
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\b(better|worse|best|worst|winner|fastest|slowest|recommended)\b/i);
  });
});
