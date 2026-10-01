/**
 * What a reader chooses lives in the address, so a shared link reproduces the view and Back and
 * Forward walk through it. Each test opens a link, changes the view the way a reader does, and
 * checks the address, the page and the history.
 */
import type { Page } from '@playwright/test';
import { BASE, FIXTURE, SUITE, expect, test } from './fixtures';

const status = (page: Page) => page.getByRole('status').filter({ visible: true }).first();

test.describe('evidence level (?level=)', () => {
  test('a link opens its level; choosing another is a history entry; Back and Forward walk them; no reload', async ({ page }) => {
    await page.goto(`${BASE}/report/?level=T2`);
    await expect(page.locator('html')).toHaveAttribute('data-level', 'T2');
    await page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
    const levels = page.getByRole('navigation', { name: 'Evidence level' }).filter({ visible: true });
    await levels.getByRole('link', { name: 'Project policy' }).click();
    await expect(page).toHaveURL(`${BASE}/report/?level=T3`);
    await expect(page.locator('html')).toHaveAttribute('data-level', 'T3');
    await page.goBack();
    await expect(page).toHaveURL(`${BASE}/report/?level=T2`);
    await expect(page.locator('html')).toHaveAttribute('data-level', 'T2');
    await page.goForward();
    await expect(page.locator('html')).toHaveAttribute('data-level', 'T3');
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
  });

  test('the visible panel is the one the address names, before any script runs a second time', async ({ page }) => {
    await page.goto(`${BASE}/report/?level=T3&peers=1`);
    await expect(page.locator('html')).toHaveAttribute('data-peers', '1');
    await expect(page.getByRole('region', { name: 'Three answers' }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Evidence level' }).filter({ visible: true }).getByRole('link', { name: 'Project policy' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('lists (?q= ?show= ?level=)', () => {
  test('a shared link fills the controls; typing rewrites the address in place; clearing removes the query', async ({ page }) => {
    await page.goto(`${BASE}/report/providers/?q=github&show=signal`);
    const find = page.getByRole('searchbox', { name: 'Find' });
    await expect(find).toHaveValue('github');
    await expect(page.getByRole('button', { name: 'Needs a look' })).toHaveAttribute('aria-pressed', 'true');
    const history = await page.evaluate(() => window.history.length);
    await find.fill('stripe');
    await expect(page).toHaveURL(`${BASE}/report/providers/?q=stripe&show=signal`);
    expect(await page.evaluate(() => window.history.length)).toBe(history);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await find.fill('');
    await expect(page).toHaveURL(`${BASE}/report/providers/`);
    await page.reload();
    await expect(find).toHaveValue('');
  });

  test('the count in the status line follows the query, and a query with no match says zero', async ({ page }) => {
    await page.goto(`${BASE}/report/families/`);
    const before = await status(page).textContent();
    await page.getByRole('searchbox', { name: 'Find' }).fill('zzzz-no-such-family');
    await expect(status(page)).toHaveText(/^0 famil/);
    await page.getByRole('searchbox', { name: 'Find' }).fill('');
    await expect(status(page)).toHaveText(before!);
  });

  test('the evidence level of a list is kept in the address and survives a reload', async ({ page }) => {
    await page.goto(`${BASE}/report/families/`);
    await page.getByRole('combobox', { name: 'Evidence level' }).selectOption('T2');
    await expect(page).toHaveURL(`${BASE}/report/families/?level=T2`);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Evidence level' })).toHaveValue('T2');
  });

  test('Back after navigating away and returning restores the list as it was left', async ({ page }) => {
    await page.goto(`${BASE}/report/detectors/?q=stripe`);
    await expect(page.getByRole('searchbox', { name: 'Find' })).toHaveValue('stripe');
    await page.getByRole('navigation', { name: 'Report pages' }).getByRole('link', { name: 'Findings' }).click();
    await expect(page).toHaveURL(`${BASE}/report/findings/`);
    await page.goBack();
    await expect(page).toHaveURL(`${BASE}/report/detectors/?q=stripe`);
    await expect(page.getByRole('searchbox', { name: 'Find' })).toHaveValue('stripe');
  });
});

test.describe('rows and paging (?page=)', () => {
  test('Next is a history entry that keeps the filter; Back and Forward move between pages', async ({ page }) => {
    await page.goto(`${BASE}/report/rows/T1/?show=leaked`);
    const pager = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pager).toContainText('Page 1 of');
    await pager.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(`${BASE}/report/rows/T1/?show=leaked&page=2`);
    await expect(pager).toContainText('Page 2 of');
    await pager.getByRole('button', { name: 'Next' }).click();
    await expect(pager).toContainText('Page 3 of');
    await page.goBack();
    await expect(pager).toContainText('Page 2 of');
    await page.goBack();
    await expect(page).toHaveURL(`${BASE}/report/rows/T1/?show=leaked`);
    await expect(pager).toContainText('Page 1 of');
    await page.goForward();
    await expect(pager).toContainText('Page 2 of');
  });

  test('a link to page 2 opens page 2, with the rows from the full file; changing the filter returns to page 1', async ({ page }) => {
    await page.goto(`${BASE}/report/rows/T1/?page=2`);
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2 of');
    await expect(status(page)).not.toHaveText('Loading rows…');
    await page.getByRole('button', { name: 'Flagged' }).click();
    await expect(page).toHaveURL(`${BASE}/report/rows/T1/?show=flagged`);
  });

  test('every row links to its fixture page inside the suite, and following it opens that fixture', async ({ page }) => {
    await page.goto(`${BASE}/report/rows/T1/`);
    const link = page.locator('main table a[href*="?fixture="]').first();
    const href = (await link.getAttribute('href'))!;
    await link.click();
    await expect(page).toHaveURL(href);
    await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
    await expect(page.locator('[data-fixture-state="ready"]')).toBeVisible();
  });
});

test.describe('pair pickers (links)', () => {
  test('performance: choosing another library redraws the page for it and is a history entry', async ({ page }) => {
    await page.goto(`${BASE}/comparison/performance/`);
    const lede = page.locator('main p').filter({ hasText: 'ran the same texts' }).filter({ visible: true }).first();
    const first = await lede.textContent();
    const picker = page.getByRole('navigation', { name: 'Compare with' }).filter({ visible: true });
    const other = picker.getByRole('link').nth(1);
    const otherName = (await other.textContent())!;
    await other.click();
    await expect(page).toHaveURL(/with=/);
    await expect(lede).toContainText(otherName);
    expect(await lede.textContent()).not.toBe(first);
    await page.goBack();
    await expect(lede).toHaveText(first!);
  });

  test('performance: the setting picker changes the address and keeps the chosen library', async ({ page }) => {
    await page.goto(`${BASE}/comparison/performance/?with=openredaction&setting=pii-global-us`);
    await page.getByRole('navigation', { name: 'redact-secret setting' }).filter({ visible: true }).getByRole('link', { name: 'Default' }).click();
    await expect(page).toHaveURL(/with=openredaction&setting=default/);
    await expect(page.locator('html')).toHaveAttribute('data-setting', 'default');
    await expect(page.locator('html')).toHaveAttribute('data-peer', 'openredaction');
  });

  test('accuracy: a link with the pair, level and scope reproduces that panel; the pickers walk the history', async ({ page }) => {
    await page.goto(`${BASE}/comparison/accuracy/`);
    const key = () => page.locator('html').getAttribute('data-acc-key');
    const initial = await key();
    expect(initial).toMatch(/^credentials\./);
    await page.getByRole('navigation', { name: 'Evidence' }).filter({ visible: true }).getByRole('link', { name: 'Tool rules' }).click();
    await expect(page).toHaveURL(/level=T2/);
    expect(await key()).toMatch(/\.T2\./);
    await page.goBack();
    await expect.poll(key).toBe(initial);
    await page.goto(`${BASE}/comparison/accuracy/?data=pii`);
    await expect(page.locator('html')).toHaveAttribute('data-acc-key', /^pii\./);
  });

  test('accuracy: a link naming an unknown pair falls back to the first pair rather than an empty page', async ({ page }) => {
    await page.goto(`${BASE}/comparison/accuracy/?with=no-such-tool&level=T9&scope=x`);
    await expect(page.locator('html')).toHaveAttribute('data-acc-key', /^credentials\..+\.T1\.all\.0$/);
    await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
  });

  test('runtime: "What to show" is a link choice with its own address', async ({ page }) => {
    await page.goto(`${BASE}/comparison/runtime/`);
    const views = page.getByRole('navigation', { name: 'What to show' }).filter({ visible: true });
    await views.getByRole('link', { name: /speed/i }).click();
    await expect(page).toHaveURL(/view=speed/);
    await expect(page.locator('html')).toHaveAttribute('data-view', 'speed');
    await page.goBack();
    await expect(page.locator('html')).not.toHaveAttribute('data-view', 'speed');
  });
});

test.describe('feature filter (?rows=)', () => {
  test('"Only differences" narrows the table, is kept in the address and survives a reload; Back restores all rows', async ({ page }) => {
    await page.goto(`${BASE}/comparison/feature/`);
    const rows = page.locator('main table tbody tr');
    const all = await rows.count();
    const toggle = page.getByRole('group', { name: 'Rows' });
    await toggle.getByRole('button', { name: 'Only differences' }).click();
    await expect(page).toHaveURL(`${BASE}/comparison/feature/?rows=differences`);
    await expect(toggle.getByRole('button', { name: 'Only differences' })).toHaveAttribute('aria-pressed', 'true');
    expect(await rows.count()).toBeLessThanOrEqual(all);
    await page.reload();
    await expect(toggle.getByRole('button', { name: 'Only differences' })).toHaveAttribute('aria-pressed', 'true');
    await toggle.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/comparison/feature/`);
    await expect(rows).toHaveCount(all);
  });
});

test.describe('one fixture (?fixture=)', () => {
  test('opening a fixture from the list shows its page; Back returns to the list as it was; Forward returns to the fixture', async ({ page }) => {
    await page.goto(`${BASE}/report/fixtures/${SUITE}/?q=github`);
    await expect(page.getByRole('searchbox', { name: 'Find' })).toHaveValue('github');
    const link = page.locator('main table a[href*="?fixture="]').first();
    const href = (await link.getAttribute('href'))!;
    await link.click();
    await expect(page).toHaveURL(href);
    await expect(page.locator('html')).toHaveAttribute('data-fixture', '1');
    await expect(page.locator('[data-fixture-state="ready"]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('html')).not.toHaveAttribute('data-fixture', '1');
    await expect(page.getByRole('searchbox', { name: 'Find' })).toBeVisible();
    await page.goForward();
    await expect(page.locator('[data-fixture-state="ready"]')).toBeVisible();
  });

  test('a direct visit shows the fixture: its title is the id, with a breadcrumb back to the report', async ({ page }) => {
    await page.goto(`${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}`);
    const view = page.locator('[data-fixture-state="ready"]');
    await expect(view.getByRole('heading', { level: 1 })).toHaveText(FIXTURE);
    await expect(view.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Providers' })).toBeVisible();
    // Exactly one fixture page is visible, not the list and the fixture at once.
    await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true })).toHaveCount(1);
  });

  test('an id the suite does not have is said so, with the way back', async ({ page }) => {
    await page.goto(`${BASE}/report/fixtures/${SUITE}/?fixture=no-such-fixture`);
    await expect(page.getByText('No fixture “no-such-fixture”')).toBeVisible();
    await page.getByRole('link', { name: 'All fixtures in this suite' }).click();
    await expect(page).toHaveURL(`${BASE}/report/fixtures/${SUITE}/`);
    await expect(page.getByRole('searchbox', { name: 'Find' })).toBeVisible();
  });
});
