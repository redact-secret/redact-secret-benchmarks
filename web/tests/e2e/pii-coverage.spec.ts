/** Recount the default coverage UI against this build's sidecar, including applied CSS. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PiiCoveragePublication } from '../../../scripts/pii-coverage-publication.mjs';
import { BASE, expect, onlyFontHosts, test } from './fixtures';

// The site assembly copies results separately; Next reads this same prebuild sidecar.
const publication = JSON.parse(readFileSync(path.resolve(__dirname, '../../../public/results/pii-coverage-view-v1.json'), 'utf8')) as PiiCoveragePublication;
const roles = ['active', 'proposed'] as const;
const sides = ['baseline', 'candidate'] as const;
const format = (count: number) => count.toLocaleString('en-US');

for (const width of [320, 1280]) {
  test(`full source coverage remains visible with applied CSS at ${width}px`, async ({ page, watch }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    expect((await page.goto(`${BASE}/evaluation/pii/evidence/`))?.status()).toBe(200);
    await page.waitForLoadState('load');
    const panels = page.locator('[data-coverage-panel]');
    const expectedPanels = roles.flatMap(role => sides.map(side => `coverage-${role}-${side}`));
    expect(await panels.evaluateAll(elements => elements.map(element => element.getAttribute('data-coverage-panel')))).toEqual(expectedPanels);

    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const role of roles) for (const side of sides) {
        const inventory = publication.coverage.inventories[role], joined = publication.coverage.matrices[role][side];
        const panel = page.locator(`[data-coverage-panel="coverage-${role}-${side}"]`);
        await expect(panel, `${theme}: source panel`).toBeVisible();
        await expect(panel).toHaveAttribute('data-coverage-snapshot', inventory.source.snapshot.id);
        const rows = panel.locator('[data-coverage-kind]');
        const sourceKinds = inventory.rows.map(row => row.kindKey);
        expect(await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-coverage-kind')))).toEqual(sourceKinds);
        await expect(rows.filter({ visible: true }), `${theme}: every source kind is visible without filtering`).toHaveCount(sourceKinds.length);
        for (const row of joined.matrix.rows) {
          const element = panel.locator(`[data-coverage-kind=${JSON.stringify(row.kindKey)}]`);
          await expect(element).toHaveCount(1);
          await expect(element).toBeVisible();
          await expect(element).toHaveAttribute('data-coverage-state', row.state);
          await expect(element.locator(':scope > p > strong')).toHaveText(row.state);
          await expect(element.locator(':scope > p > strong')).toBeVisible();
          for (const [label, state] of [['Product capability', row.capability.state], ['Evaluator', row.mapping.state], ['Observation', row.observation.status]]) {
            const axis = element.locator(':scope > p').filter({ hasText: `${label}: ${state};` });
            await expect(axis).toHaveCount(1); await expect(axis).toBeVisible();
          }
        }
        const counts = (field: 'state' | 'capability' | 'mapping', key: string) => joined.matrix.rows.filter(row => field === 'state' ? row.state === key : row[field].state === key).length;
        const summaries = [
          ['discovered', sourceKinds.length],
          ...Object.keys(joined.summary.states).map(key => [`state-${key}`, counts('state', key)]),
          ...Object.keys(joined.summary.capability).map(key => [`capability-${key}`, counts('capability', key)]),
          ...Object.keys(joined.summary.mapping).map(key => [`mapping-${key}`, counts('mapping', key)]),
          ['accepted-measurable', joined.matrix.rows.filter(row => row.evidence.acceptedCases > 0 && ['faithful', 'partial'].includes(row.mapping.state) && row.mapping.representableAxes.length > 0).length],
        ] as [string, number][];
        await expect(panel.locator('[data-coverage-summary]')).toHaveCount(summaries.length);
        for (const [key, count] of summaries) {
          const summary = panel.locator(`[data-coverage-summary="${key}"]`);
          await expect(summary).toBeVisible(); await expect(summary.locator('dt')).toBeVisible();
          await expect(summary.locator('dd').first()).toBeVisible();
          await expect(summary.locator('dd').first()).toHaveText(format(count));
          await expect(summary).toHaveAttribute('data-coverage-value', format(count));
        }
      }
    }
    expect(watch.problems).toEqual([]);
    expect(onlyFontHosts(watch)).toEqual([]);
  });
}
