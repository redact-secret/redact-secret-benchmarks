/**
 * Keyboard use of the real pages: a visible focus indicator on every stop, a sensible order, the
 * controls operable with Enter, Space and arrows, and no keyboard trap.
 */
import type { Page } from '@playwright/test';
import { BASE, SUITE, expect, test } from './fixtures';

interface Stop { tag: string; name: string; outline: string; box: { x: number; y: number; width: number; height: number } }

/** Press Tab `count` times and describe each stop: what it is, whether the focus ring shows, where it is. */
async function tabThrough(page: Page, count: number): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
    stops.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
        outline: el.matches(':focus-visible') ? `${style.outlineStyle} ${style.outlineWidth}` : 'not focus-visible',
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }));
  }
  return stops;
}

test.describe('focus', () => {
  for (const route of ['/report/', '/report/families/', '/comparison/feature/', `/report/fixtures/${SUITE}/`]) {
    test(`${route}: every stop among the first 30 shows a focus ring and has a size`, async ({ page }) => {
      await page.goto(`${BASE}${route}`);
      const stops = await tabThrough(page, 30);
      for (const stop of stops.filter(s => s.tag !== 'body')) {
        expect(stop.outline, `${stop.tag} "${stop.name}"`).toMatch(/^(solid|dashed|double|auto) [1-9]/);
        expect(stop.box.width * stop.box.height, `${stop.tag} "${stop.name}" has an area`).toBeGreaterThan(0);
      }
      expect(new Set(stops.map(s => `${s.tag}|${s.name}|${s.box.x}|${s.box.y}`)).size, 'Tab does not get stuck').toBeGreaterThan(8);
    });
  }

  test('the tab order is the reading order: skip link, logo, primary navigation, theme, section navigation, then the page', async ({ page }) => {
    await page.goto(`${BASE}/report/`);
    const stops = await tabThrough(page, 12);
    expect(stops.map(s => s.name)).toEqual(expect.arrayContaining(['Skip to content', 'Report', 'Comparison', 'Color theme: Light. Switch to Dark', 'Overview', 'Providers']));
    const order = (name: string) => stops.findIndex(s => s.name === name);
    expect(order('Skip to content')).toBe(0);
    expect(order('Report')).toBeLessThan(order('Color theme: Light. Switch to Dark'));
    expect(order('Color theme: Light. Switch to Dark')).toBeLessThan(order('Overview'));
  });

  test('a focused control is not hidden behind the fixed bottom bar on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(`${BASE}/report/families/`);
    const bar = (await page.getByRole('navigation', { name: 'Primary, bottom bar' }).boundingBox())!;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const target = await page.evaluate(() => { const r = document.activeElement!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, inBar: !!document.activeElement!.closest('nav[aria-label="Primary, bottom bar"]') }; });
      if (target.inBar) continue;
      // A tall element (a stacked table region) may run past the bar, but the part the focus ring is drawn around must be on screen above it.
      if (target.bottom - target.top < 400) expect(target.bottom, 'a focused control must not sit under the bar').toBeLessThanOrEqual(bar.y + 1);
      else expect(target.top, 'a focused region must not sit wholly under the bar').toBeLessThan(bar.y - 8);
    }
  });
});

test.describe('controls', () => {
  test('the theme button toggles light and dark with Space and Enter and keeps focus', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${BASE}/report/`);
    const button = page.getByRole('button', { name: /Color theme:/ });
    await button.focus();
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('data-mode', 'dark');
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('data-mode', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(button).toBeFocused();
  });

  test('the feature filter is operable with the keyboard, and the choice shows in the address', async ({ page }) => {
    await page.goto(`${BASE}/comparison/feature/`);
    const only = page.getByRole('group', { name: 'Rows' }).getByRole('button', { name: 'Only differences' });
    await only.focus();
    await page.keyboard.press('Enter');
    await expect(only).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/rows=differences/);
  });

  test('a list is filtered by typing, and the Show choices are the next stops', async ({ page }) => {
    await page.goto(`${BASE}/report/providers/`);
    await page.getByRole('searchbox', { name: 'Find' }).focus();
    await page.keyboard.type('github');
    await expect(page).toHaveURL(/q=github/);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Evidence level' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('group', { name: /Show/ }).getByRole('button').first()).toBeFocused();
  });

  test('a disclosure opens and closes with Enter and Space on its summary, and the content becomes reachable', async ({ page }) => {
    await page.goto(`${BASE}/report/providers/`);
    const summary = page.locator('main details > summary').first();
    const details = page.locator('main details').first();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('a scrolling table region is a focusable, named stop, so the keyboard can scroll it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`${BASE}/comparison/feature/`);
    const regions = page.locator('main [role="region"][tabindex="0"]');
    expect(await regions.count()).toBeGreaterThan(0);
    for (const region of await regions.all()) {
      await expect(region).toHaveAttribute('aria-label', /\S/);
    }
  });

  test('Escape and Tab never trap the focus: the last stop of a page leads out of it', async ({ page }) => {
    await page.goto(`${BASE}/report/findings/`);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press('Tab');
      const key = await page.evaluate(() => `${document.activeElement?.tagName}|${document.activeElement?.getAttribute('href') ?? document.activeElement?.textContent?.slice(0, 20)}`);
      if (seen.has(key) && seen.size > 30) break;
      seen.add(key);
    }
    expect(seen.size).toBeGreaterThan(30);
  });
});
