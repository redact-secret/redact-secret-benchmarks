/**
 * `/evaluation/rc`: structure only. Whether the build holds candidate evidence depends on how it was built
 * (CI has none; a staging build has one), so the test accepts either state and asserts what both share: one h1,
 * the last release with its mode, a performance section, and, per state, the blocks that state must carry. It
 * asserts no count, hash or version.
 */
import { BASE, expect, test } from './fixtures';

test('the release candidate page shows the last release and one of its two states', async ({ page }) => {
  await page.goto(`${BASE}/evaluation/rc/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: 'Performance cost' })).toBeVisible();
  await expect(page.locator('[data-build="published"]')).toHaveCount(1);

  const none = page.getByRole('heading', { level: 2, name: /No release candidate is recorded|did not validate/ });
  if (await none.count()) {
    await expect(page.locator('[data-build="candidate"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'What differs' })).toHaveCount(0);
    await expect(page.getByLabel(/Command:/)).toBeVisible();
  } else {
    await expect(page.locator('[data-build="candidate"]')).toHaveCount(1);
    for (const name of ['What differs', 'By evidence level', 'Fixtures that moved']) await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
});

test('on a phone the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${BASE}/evaluation/rc/`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
