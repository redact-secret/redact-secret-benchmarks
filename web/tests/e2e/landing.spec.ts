/**
 * The landing page (`/`): structure, the specimen's controls and motion, and the same page without script. It asserts no
 * count, version or date: those come from the data the build had, and a build without them leaves them out.
 */
import { BASE, expect, test } from './fixtures';

test('the root is the landing page: one h1, the four questions and the rules', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const questions = page.getByRole('navigation', { name: 'What the benchmark answers' });
  await expect(questions.getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('list', { name: 'The rules of the benchmark' }).getByRole('listitem')).not.toHaveCount(0);
  await expect(page.getByRole('contentinfo').getByRole('navigation', { name: 'Footer' }).getByRole('link')).not.toHaveCount(0);
});

test('each question leads to its page', async ({ page }) => {
  for (const [name, path] of [[/Does it hide every secret/, '/report/'], [/How long does it take/, '/comparison/performance/'], [/How do we know/, '/evaluation/'], [/Which credentials and personal data/, '/coverage/credential/']] as const) {
    await page.goto(`${BASE}/`);
    await page.getByRole('navigation', { name: 'What the benchmark answers' }).getByRole('link', { name }).click();
    await expect(page).toHaveURL(`${BASE}${path}`);
  }
});

test('the example choice and Replay work from the keyboard and do not move the page', async ({ page }) => {
  await page.goto(`${BASE}/`);
  const file = page.locator('figure pre').locator('xpath=..');
  const group = page.getByRole('group', { name: 'Example' });
  const pressed = group.getByRole('button', { pressed: true });
  await expect(pressed).toHaveText('Credential');
  const personal = group.getByRole('button', { name: 'Personal data' });
  await personal.focus();
  await page.keyboard.press('Enter');
  await expect(personal).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('figure pre')).toContainText('Subject');
  // A different example is different text (a long token wraps, an address does not), so its card may differ in height; the motion itself must not move anything.
  expect((await file.boundingBox())?.height).toBeGreaterThan(0);
  const settled = await file.boundingBox();
  await page.getByRole('button', { name: 'Replay' }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('figure pre')).toContainText('Subject');
  expect((await file.boundingBox())?.height).toBe(settled?.height);
  await page.waitForTimeout(1800);
  expect((await file.boundingBox())?.height).toBe(settled?.height);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the redaction is shown at once: the verdict is settled and the bar is drawn', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await expect(page.getByText('Exact', { exact: true })).toBeVisible();
    const bar = await page.locator('[title="Expected secret"]').first().evaluate(el => getComputedStyle(el, '::after').opacity);
    expect(bar).toBe('1');
  });
});

test.describe('without script', () => {
  test.use({ javaScriptEnabled: false });

  test('the page is the same: the question, the example, the four questions and the footer', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('figure pre')).toContainText('provider');
    await expect(page.getByRole('navigation', { name: 'What the benchmark answers' }).getByRole('link')).toHaveCount(4);
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });
});
