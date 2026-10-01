import type { Page } from '@playwright/test';
import { BASE, expect, test } from './fixtures';

const KEY = 'redact-secret-benchmarks:theme';
const theme = (page: Page) => page.locator('html').getAttribute('data-theme');
const toggle = (page: Page) => page.getByRole('group', { name: 'Color theme' });
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('theme', () => {
  test('with no saved choice the theme follows the operating system, and "System" is the pressed choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${BASE}/report/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle(page).getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('choosing a theme applies it at once, saves it, and it is still chosen after a reload and after navigating inside the app', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${BASE}/report/`);
    const light = await background(page);
    await toggle(page).getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle(page).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(await background(page)).not.toBe(light);
    expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle(page).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Comparison' }).click();
    await expect(page).toHaveURL(`${BASE}/comparison/`);
    expect(await theme(page)).toBe('dark');
  });

  test('a saved choice beats the operating system, and choosing System removes the override', async ({ page }) => {
    await page.addInitScript(k => localStorage.setItem(k, 'dark'), KEY);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${BASE}/report/`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await toggle(page).getByRole('button', { name: 'System' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('the theme is on the page before it is first drawn, so there is no flash of the other one', async ({ page }) => {
    await page.addInitScript(k => localStorage.setItem(k, 'dark'), KEY);
    // Record the attribute at the first moment a script can run after parsing started and at DOMContentLoaded.
    await page.addInitScript(() => {
      const seen: (string | null)[] = [];
      // The root element does not exist yet when an init script runs, so watch the whole document.
      new MutationObserver(() => seen.push(document.documentElement.getAttribute('data-theme'))).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
      document.addEventListener('DOMContentLoaded', () => { (window as unknown as { __atDcl: string | null }).__atDcl = document.documentElement.getAttribute('data-theme'); (window as unknown as { __seen: unknown }).__seen = seen; });
    });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${BASE}/report/`);
    const { atDcl, seen } = await page.evaluate(() => ({ atDcl: (window as unknown as { __atDcl: string }).__atDcl, seen: (window as unknown as { __seen: (string | null)[] }).__seen }));
    expect(atDcl).toBe('dark');
    // The attribute only ever held the chosen theme: it never flipped through the OS's.
    expect(seen.every(value => value === 'dark')).toBe(true);
  });

  test('both themes draw different surfaces and keep the text readable (ink against surface is at least 4.5:1)', async ({ page }) => {
    const contrast = async (scheme: 'light' | 'dark') => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${BASE}/report/`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      return page.evaluate(() => {
        const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const lum = (css: string) => { const [r, g, b] = channels(css); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
        const style = getComputedStyle(document.querySelector('main h1')!);
        const l1 = lum(style.color); const l2 = lum(getComputedStyle(document.body).backgroundColor);
        return { ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), background: getComputedStyle(document.body).backgroundColor };
      });
    };
    const light = await contrast('light');
    const dark = await contrast('dark');
    expect(light.background).not.toBe(dark.background);
    expect(light.ratio).toBeGreaterThanOrEqual(4.5);
    expect(dark.ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('the logo shown is the one for the theme', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${BASE}/report/`);
      const visible = page.locator('header a[aria-label$="home"] img').filter({ visible: true });
      await expect(visible).toHaveCount(1);
      await expect(visible).toHaveAttribute('src', new RegExp(`logo-${scheme}\\.svg`));
    }
  });
});
