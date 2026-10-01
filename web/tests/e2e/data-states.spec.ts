/**
 * The pages that fetch a build-emitted file after load (rows, a suite's fixture records, the lists of
 * differing files): loading, loaded, error, offline and stale-build states, produced by holding,
 * failing or replacing the one request with route interception. The page frame stays readable in
 * every state, and a failure says why and offers the right next step.
 */
import type { Page, Route } from '@playwright/test';
import { BASE, FIXTURE, SUITE, expect, test } from './fixtures';

const ROWS = '**/data/rows/level/T1/rows.json';
const RECORDS = `**/data/fixtures/${SUITE}/records.json`;
const DIFFERENCES = '**/data/comparison/accuracy/differences.json';

/** Hold the matching request until `release()`; every other request is untouched. */
async function hold(page: Page, pattern: string) {
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  const seen: string[] = [];
  await page.route(pattern, async (route: Route) => { seen.push(route.request().url()); await released; await route.continue(); });
  return { release, seen };
}

/**
 * A dropped connection: the browser reports itself offline and the matching request fails. `restore()`
 * brings the connection back and fires the `online` event, as the browser does.
 */
async function goOffline(page: Page, pattern: string) {
  let online = false;
  await page.addInitScript(() => { Object.defineProperty(navigator, 'onLine', { get: () => !!(window as unknown as { __online?: boolean }).__online, configurable: true }); });
  await page.route(pattern, route => (online ? route.continue() : route.abort('internetdisconnected')));
  return {
    restore: async () => {
      online = true;
      await page.evaluate(() => { (window as unknown as { __online: boolean }).__online = true; window.dispatchEvent(new Event('online')); });
    },
  };
}

const status = (page: Page) => page.getByRole('status').filter({ visible: true }).filter({ hasText: /rows/i }).first();

test.describe('rows table', () => {
  test('first paint is the first page with no request; the rest loads when a reader reaches for a control', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', r => { if (r.url().includes('/data/')) requests.push(r.url()); });
    await page.goto(`${BASE}/report/rows/T1/`);
    await expect(page.locator('main table tbody tr').first()).toBeVisible();
    await expect(status(page)).toHaveText(/^[\d,]+ of [\d,]+ rows$/);
    await page.getByRole('searchbox', { name: 'Find' }).focus();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toContain('/data/rows/level/T1/rows.json');
  });

  test('loading: the frame, the rows already drawn and the reader’s choice stay; the count says Loading rows; then it settles', async ({ page }) => {
    const gate = await hold(page, ROWS);
    await page.goto(`${BASE}/report/rows/T1/?show=leaked`);
    await expect(status(page)).toHaveText('Loading rows…');
    await expect(page.locator('[aria-busy="true"]').filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Left readable' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('main table tbody tr').first()).toBeVisible();
    gate.release();
    await expect(status(page)).not.toHaveText('Loading rows…');
    await expect(page.locator('[aria-busy="true"]').filter({ visible: true })).toHaveCount(0);
    expect(gate.seen).toHaveLength(1);
  });

  test('error: says why, keeps the first page readable, and Try again loads it', async ({ page }) => {
    let failures = 1;
    await page.route(ROWS, route => (failures-- > 0 ? route.fulfill({ status: 503, body: 'down' }) : route.continue()));
    await page.goto(`${BASE}/report/rows/T1/?show=leaked`);
    const alert = page.getByRole('alert').filter({ hasText: 'Could not load the rest of the rows' });
    await expect(alert).toBeVisible();
    await expect(status(page)).toHaveText('Rows not loaded');
    await expect(page.locator('main table tbody tr').first()).toBeVisible();
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(alert).toBeHidden();
    await expect(status(page)).not.toHaveText('Rows not loaded');
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
  });

  test('a file that is not JSON, or not the expected shape, is a stale build: reload, not retry', async ({ page }) => {
    await page.route(ROWS, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"scanners":[]}' }));
    await page.goto(`${BASE}/report/rows/T1/?show=leaked`);
    const alert = page.getByRole('alert').filter({ hasText: 'Could not use the rest of the rows' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('not from the same build');
    await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await page.unroute(ROWS);
    await Promise.all([page.waitForEvent('load'), alert.getByRole('button', { name: 'Reload the page' }).click()]);
    await expect(page.getByRole('alert').filter({ hasText: 'Could not use' })).toHaveCount(0);
    await expect(status(page)).not.toHaveText('Loading rows…');
  });

  test('offline: says so, and loads by itself when the connection returns', async ({ page }) => {
    const connection = await goOffline(page, ROWS);
    await page.goto(`${BASE}/report/rows/T1/?show=leaked`);
    const alert = page.getByRole('alert').filter({ hasText: 'You are offline' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('will load when the connection is back');
    await expect(status(page)).toHaveText('Rows not loaded');
    await connection.restore();
    await expect(alert).toBeHidden();
    await expect(status(page)).not.toHaveText('Rows not loaded');
    await expect(status(page)).not.toHaveText('Loading rows…');
  });

  test('a second visit to a table in the same session needs no request (the file is kept)', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', r => { if (r.url().includes('/rows.json')) requests.push(r.url()); });
    await page.goto(`${BASE}/report/rows/T1/`);
    await page.getByRole('searchbox', { name: 'Find' }).fill('a');
    await expect.poll(() => requests.length).toBe(1);
    await expect(status(page)).not.toHaveText('Loading rows…');
    await page.getByRole('searchbox', { name: 'Find' }).fill('ab');
    await page.getByRole('searchbox', { name: 'Find' }).fill('');
    expect(requests).toHaveLength(1);
  });
});

test.describe('one fixture of a suite', () => {
  const url = `${BASE}/report/fixtures/${SUITE}/?fixture=${encodeURIComponent(FIXTURE)}`;

  test('loading: the page frame and a skeleton the size of the regions to come; then the fixture', async ({ page }) => {
    const gate = await hold(page, RECORDS);
    await page.goto(url);
    const view = page.locator('[data-fixture-state]');
    await expect(view).toHaveAttribute('data-fixture-state', 'loading');
    await expect(view.getByRole('status')).toContainText(`Loading fixture ${FIXTURE}`);
    await expect(view.getByRole('heading', { level: 1 })).toHaveText(FIXTURE);
    gate.release();
    await expect(view).toHaveAttribute('data-fixture-state', 'ready');
    await expect(view.getByRole('status')).toHaveCount(0);
  });

  test('error: names the fixture, says why, offers the way back to the suite, and Try again loads it', async ({ page }) => {
    let failures = 1;
    await page.route(RECORDS, route => (failures-- > 0 ? route.fulfill({ status: 500, body: 'x' }) : route.continue()));
    await page.goto(url);
    const view = page.locator('[data-fixture-state="error"]');
    await expect(view.getByRole('alert')).toContainText('Could not load this fixture');
    await expect(view.getByRole('heading', { level: 1 })).toHaveText(FIXTURE);
    await expect(view.getByRole('link', { name: 'All fixtures in this suite' })).toBeVisible();
    await view.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('[data-fixture-state="ready"]')).toBeVisible();
  });

  test('a records file of another build (another number of fixtures) is refused with a reload offer', async ({ page }) => {
    await page.route(RECORDS, async route => {
      const real = await (await route.fetch()).json();
      await route.fulfill({ json: { ...real, records: real.records.slice(1) } });
    });
    await page.goto(url);
    const view = page.locator('[data-fixture-state="error"]');
    await expect(view.getByRole('alert')).toContainText('Could not use this fixture');
    await expect(view.getByRole('button', { name: 'Reload the page' })).toBeVisible();
  });

  test('offline: the note says so and the fixture appears by itself when the connection returns', async ({ page }) => {
    const connection = await goOffline(page, RECORDS);
    await page.goto(url);
    const alert = page.getByRole('alert').filter({ hasText: 'You are offline' });
    await expect(alert).toBeVisible();
    await expect(page.locator('[data-fixture-state="error"]').getByRole('heading', { level: 1 })).toHaveText(FIXTURE);
    await connection.restore();
    await expect(page.locator('[data-fixture-state="ready"]')).toBeVisible();
  });

  test('pointing at a row link warms the records file, so opening the fixture needs no second wait', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', r => { if (r.url().includes('/records.json')) requests.push(r.url()); });
    await page.goto(`${BASE}/report/fixtures/${SUITE}/`);
    const link = page.locator('main table a[href*="?fixture="]').first();
    await link.hover();
    await expect.poll(() => requests.length).toBe(1);
    await link.click();
    await expect(page.locator('[data-fixture-state="ready"]')).toBeVisible();
    expect(requests).toHaveLength(1);
  });
});

test.describe('accuracy: lists of differing files', () => {
  const open = async (page: Page) => {
    await page.goto(`${BASE}/comparison/accuracy/`);
    const disclosure = page.locator('details').filter({ hasText: /with different results/i }).filter({ visible: true }).first();
    await disclosure.locator('summary').click();
    return disclosure;
  };

  test('nothing is fetched until a list is opened; loading shows a skeleton; then the lists', async ({ page }) => {
    const gate = await hold(page, DIFFERENCES);
    await page.goto(`${BASE}/comparison/accuracy/`);
    expect(gate.seen).toHaveLength(0);
    const disclosure = page.locator('details').filter({ hasText: /with different results/i }).filter({ visible: true }).first();
    await disclosure.locator('summary').click();
    await expect(disclosure.getByRole('status')).toContainText('Loading the list of files');
    gate.release();
    await expect(disclosure.getByRole('status')).toHaveCount(0);
    await expect(disclosure.getByText(/Hidden by/).first()).toBeVisible();
    expect(gate.seen).toHaveLength(1);
  });

  test('error: says why, leaves the counts alone, and Try again loads the lists', async ({ page }) => {
    let failures = 1;
    await page.route(DIFFERENCES, route => (failures-- > 0 ? route.fulfill({ status: 404, body: 'x' }) : route.continue()));
    const disclosure = await open(page);
    const alert = disclosure.getByRole('alert');
    await expect(alert).toContainText('Could not load the list of files');
    await expect(alert).toContainText('The counts above are unaffected');
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(alert).toBeHidden();
    await expect(disclosure.getByText(/Hidden by/).first()).toBeVisible();
  });

  test('a file from another run is refused with a reload offer', async ({ page }) => {
    await page.route(DIFFERENCES, route => route.fulfill({ json: { runId: 'another-run', fixtures: 1, files: [] } }));
    const disclosure = await open(page);
    await expect(disclosure.getByRole('alert')).toContainText('Could not use the list of files');
    await expect(disclosure.getByRole('button', { name: 'Reload the page' })).toBeVisible();
  });
});
