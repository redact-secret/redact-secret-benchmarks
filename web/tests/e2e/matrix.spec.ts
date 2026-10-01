/**
 * Every kind of page, in both themes, at a phone width and a desktop width. One navigation per
 * page and width carries every page-level check (both themes are checked on it), so each page loads twice:
 *
 *  - it loads (200), without a console error or warning, an uncaught error or a failed request;
 *  - it asks only for web fonts outside its own origin;
 *  - it has a document language, a title, one main landmark and exactly one visible h1;
 *  - the page never scrolls sideways;
 *  - axe-core (WCAG 2.0 to 2.2 A and AA, and best practice) finds no serious or critical violation.
 *
 * Moderate and minor findings are attached to the test as annotations, not hidden.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { ROUTES, expect, onlyFontHosts, test } from './fixtures';

const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

interface AxeViolation { id: string; impact: string | null; help: string; nodes: { target: unknown[]; html: string; failureSummary?: string }[] }

export async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await axe.run(document, { preload: false, runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return result.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => ({ target: n.target, html: n.html.slice(0, 160), failureSummary: n.failureSummary })) }));
  });
}

export const describeViolations = (violations: AxeViolation[]): string[] =>
  violations.map(v => `${v.impact} ${v.id}: ${v.help}\n${v.nodes.map(n => `    ${n.target.join(' ')}  ${n.html}`).join('\n')}`);

const THEMES = ['light', 'dark'] as const;
const WIDTHS = [320, 1280] as const;

// One navigation per page and width: the page is loaded once in the light theme, checked, then the
// operating-system preference is switched to dark (the theme is on "System", so the page follows it)
// and the same page is checked again. A theme change is not a new page, so it is not a new load.
for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ colorScheme: 'light', viewport: { width, height: 900 } });

    for (const route of ROUTES) {
      test(route, async ({ page, watch }, testInfo) => {
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        await page.waitForLoadState('load');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page).toHaveTitle(/\S/);
        await expect(page.getByRole('main')).toHaveCount(1);

        for (const theme of THEMES) {
          await page.emulateMedia({ colorScheme: theme });
          // Hydrated and settled: the theme is applied and nothing visible is loading.
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('[aria-busy="true"]').filter({ visible: true })).toHaveCount(0);
          await expect(page.getByRole('heading', { level: 1 }).filter({ visible: true }), `${theme}: one visible h1`).toHaveCount(1);

          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${theme}: the page scrolls sideways`).toBeLessThanOrEqual(0);

          const violations = await runAxe(page);
          for (const v of violations.filter(x => x.impact !== 'serious' && x.impact !== 'critical')) testInfo.annotations.push({ type: `axe ${v.impact} (${theme})`, description: `${v.id}: ${v.help}` });
          expect(describeViolations(violations.filter(v => v.impact === 'serious' || v.impact === 'critical')), `${theme}: serious or critical accessibility violations`).toEqual([]);
        }

        expect(watch.problems).toEqual([]);
        expect(onlyFontHosts(watch), 'requests that left the origin').toEqual([]);
      });
    }
  });
}
