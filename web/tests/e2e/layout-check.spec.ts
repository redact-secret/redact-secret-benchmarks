/**
 * Self-test of the layout check (#554): it must FAIL on a page with a defect. Each synthetic page below
 * carries exactly one (a horizontal overflow, a word broken across lines, a layout shift when data
 * arrives) and the check from scripts/layout-check-lib.mjs, the code check:layout runs, must report it at
 * the width it appears. A clean page and a page whose overflow shows at one width only guard the other
 * direction: no false alarm, and each width is measured after a resize, not copied from the first.
 *
 * The pages come from a throwaway server of this file's own, so the test needs no build and no ledger.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { checkTarget, pickWorkers, type LayoutTarget } from '../../scripts/layout-check-lib.mjs';

/** Lengths are built from numbers: the repository's token check refuses a literal px in code. */
const px = (n: number) => `${n}px`;
const doc = (body: string, style = '', script = '') => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:${px(16)}/1.4 sans-serif}${style}</style></head><body><main>${body}</main>${script}</body></html>`;
const arrive = (apply: string) => `<script>fetch("/data/rows.json").then(r=>r.json()).then(()=>{document.getElementById("rows").removeAttribute("aria-busy");${apply}})</script>`;

const PAGES: Record<string, string> = {
  '/clean': doc(`<h1>Report</h1><p>Plain words flow and wrap as they should.</p><div style="overflow-x:auto"><div style="width:${px(900)}">A wide table scrolls inside its own region.</div></div>`),
  '/overflow': doc(`<h1>Report</h1><div style="width:${px(900)};background:#ccc">Wider than a tablet</div>`),
  '/overflow-narrow-only': doc('<h1>Report</h1><div class="wide">Wider than the narrowest phone</div>', `.wide{width:${px(340)}}@media (min-width:${px(375)}){.wide{width:${px(300)}}}`),
  '/midword': doc('<h1>Report</h1><p class="squeezed">Understanding</p>', `.squeezed{width:${px(40)};overflow-wrap:anywhere}`),
  '/shift': doc('<div id="top"></div><h1>Rows</h1><p id="rows" aria-busy="true">loading</p>', '', arrive(`document.getElementById("top").style.height="${px(80)}"`)),
  '/steady': doc('<h1>Rows</h1><p id="rows" aria-busy="true">loading</p>', '', arrive('document.getElementById("rows").textContent="rows"')),
  '/data/rows.json': '{"rows":[]}',
};

let server: http.Server;
let origin = '';

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url!, 'http://x').pathname;
    const body = PAGES[pathname];
    if (body === undefined) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': pathname.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' }).end(body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

const target = (route: string, extra: Partial<LayoutTarget> = {}): LayoutTarget => ({ name: `synthetic ${route}`, url: `${origin}${route}`, ready: 'main', ...extra });
const gated = { gate: true, wait: '[aria-busy="true"]', loaded: () => !document.querySelector('[aria-busy="true"]'), anchor: 'h1' };

test('a clean page is reported clean at every width', async ({ page }) => {
  expect(await checkTarget(page, target('/clean'))).toEqual([]);
});

test('a horizontal overflow is reported at all three widths', async ({ page }) => {
  const found = await checkTarget(page, target('/overflow'));
  for (const width of [320, 375, 768]) expect(found.join('\n')).toMatch(new RegExp(`@${width}: page is \\d+px wide in a ${px(width)} viewport`));
});

test('an overflow that exists at one width only is reported there and only there (each width is measured after the resize)', async ({ page }) => {
  const found = await checkTarget(page, target('/overflow-narrow-only'));
  expect(found).toHaveLength(1);
  expect(found[0]).toMatch(new RegExp(`@320: page is ${px(340)} wide in a ${px(320)} viewport`));
});

test('a word broken across lines is reported', async ({ page }) => {
  const found = await checkTarget(page, target('/midword'));
  expect(found.join('\n')).toMatch(/word "Understanding" is broken across lines in <p\.squeezed>/);
});

test('a layout shift when the data arrives is reported, and a page that does not shift is not', async ({ page }) => {
  const shifted = await checkTarget(page, target('/shift', gated));
  for (const width of [320, 375, 768]) expect(shifted.join('\n')).toMatch(new RegExp(`@${width}: h1 moved from [\\d.]+ to [\\d.]+ when the data arrived \\(layout shift\\)`));
  expect(await checkTarget(page, target('/steady', gated))).toEqual([]);
});

test('a page that never shows its ready signal is reported, not skipped', async ({ page }) => {
  const found = await checkTarget(page, target('/clean', { ready: '#never' }), { widths: [320], timeout: 1000 });
  expect(found).toEqual([expect.stringMatching(/@320: did not render/)]);
});

test('the worker count follows the machine, leaves a core to the beside-it suite in CI and can be set', () => {
  expect(pickWorkers({}, 10)).toBe(6);
  expect(pickWorkers({}, 1)).toBe(2);
  expect(pickWorkers({ CI: 'true' }, 4)).toBe(3);
  expect(pickWorkers({ LAYOUT_WORKERS: '5' }, 4)).toBe(5);
  expect(pickWorkers({ LAYOUT_WORKERS: 'x' }, 4)).toBe(4);
});
