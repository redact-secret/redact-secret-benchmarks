import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, FAMILY, expect, test } from './fixtures';

test('report provenance opens on demand and returns keyboard focus', async ({ page }) => {
  for (const route of ['/report/', `/report/families/${FAMILY}/`, '/report/detectors/', '/comparison/accuracy/', '/evaluation/credential/']) {
    await page.goto(`${BASE}${route}`);
    const trigger = page.getByRole('button', { name: 'Where these numbers come from', exact: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('[lang="ko"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test('theme button cycles between two explicit modes', async ({ page }) => {
  await page.goto(`${BASE}/report/`);
  const toggle = page.getByRole('button', { name: /Color theme:/ });
  const initial = await toggle.getAttribute('data-mode');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-mode', initial === 'light' ? 'dark' : 'light');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-mode', initial!);
});

test('PII comparison exposes readable results with raw evidence in a dialog', async ({ page }) => {
  await page.goto(`${BASE}/evaluation/pii/evidence/`);
  const paired = JSON.parse(readFileSync(path.resolve(__dirname, '../../../benchmarks/pii-evidence-comparison/plan.json'), 'utf8')).candidate !== null;
  const comparison = page.getByRole('region', { name: 'Version comparison' });
  if (!paired) {
    await expect(comparison).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Public outcomes, one imported variant at a time' })).toBeVisible();
    return;
  }
  await expect(comparison.getByLabel('Show variants')).toHaveValue('changed');
  await comparison.getByLabel('Show variants').selectOption('all');
  await comparison.getByRole('button', { name: /View details/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Case ID:');
  await expect(page.getByRole('dialog')).toContainText('Personal-data type');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('performance reading guidance opens from an info icon and restores focus', async ({ page }) => {
  await page.goto(`${BASE}/comparison/performance/`);
  const trigger = page.getByRole('button', { name: 'How to read performance results' }).filter({ visible: true });
  await expect(page.getByRole('note').filter({ hasText: 'Read this first', visible: true })).toHaveCount(0);
  await trigger.click();
  await expect(page.getByRole('dialog')).toContainText('Times are absolute and recorded');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
