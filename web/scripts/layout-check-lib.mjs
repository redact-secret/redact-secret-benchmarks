/**
 * The measuring half of the layout check (#554), shared by `check-layout.mjs` and the self-test in
 * `tests/e2e/layout-check.spec.ts`: what runs in the page (`inspect`, `inspectHeader`), how a target is
 * loaded and measured (`checkTarget`) and how many pages run at once (`pickWorkers`).
 *
 * A plain target is loaded ONCE and measured at every width by resizing the viewport, waiting for a real
 * condition (fonts ready, then the document's size unchanged for a few animation frames) instead of a
 * timer. A state target (a held or failed request for build-emitted data) needs its own navigation per
 * width, because the loading and error states exist only while the page loads.
 */
import os from 'node:os';

export const WIDTHS = [320, 375, 768];
export const MAX_WORD = 24;
const HEIGHT = 900;

/** Runs in the page. Returns the problems found in the rendered document. */
export function inspect({ maxWord }) {
  const problems = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    // Name the outermost boxes that stick out of the viewport and are not inside a scroll region.
    const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
    const culprits = [...document.body.querySelectorAll('*')]
      .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && !inScroller(el))
      .filter(el => ![...el.children].some(c => c.getBoundingClientRect().right > doc.clientWidth + 1))
      .slice(0, 3)
      .map(el => `<${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : ''}>`);
    problems.push(`page is ${doc.scrollWidth}px wide in a ${doc.clientWidth}px viewport${culprits.length ? ` (${culprits.join(', ')})` : ''}`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    // A text node drawn on one line cannot hold a broken word; one range per node spares one per word.
    const whole = document.createRange();
    whole.selectNodeContents(node);
    if ([...whole.getClientRects()].filter(r => r.width > 0 && r.height > 0).length < 2) continue;
    const text = node.textContent ?? '';
    // A run of non-space characters is one token. A token longer than maxWord (a
    // hash, a path, a hyphenated id) is allowed to break wherever it must; inside
    // a shorter one, every word must stay on one line.
    for (const token of text.matchAll(/\S+/g)) {
      if (token[0].length > maxWord) continue;
      for (const m of token[0].matchAll(/[\p{L}\p{N}']+/gu)) {
        if (m[0].length < 3) continue;
        const start = token.index + m.index;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + m[0].length);
        const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        if (rects.length < 2) continue;
        const tops = new Set(rects.map(r => Math.round(r.top / 2)));
        if (tops.size > 1 && !seen.has(m[0])) {
          seen.add(m[0]);
          const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
          problems.push(`word "${m[0]}" is broken across lines in <${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}>`);
        }
      }
    }
  }
  return problems;
}

/** Runs in the page, on exported pages only. */
export function inspectHeader() {
  const problems = [];
  const header = document.querySelector('header');
  if (!header) return ['no <header>'];
  const imgs = [...header.querySelectorAll('img')];
  const light = imgs.find(i => /\/logo-light\.svg$/.test(i.getAttribute('src') ?? '') || /logo-light\.svg/.test(i.currentSrc));
  const dark = imgs.find(i => /logo-dark\.svg/.test(i.getAttribute('src') ?? '') || /logo-dark\.svg/.test(i.currentSrc));
  if (!light || !dark) problems.push('header must carry both canonical logo images (logo-light.svg, logo-dark.svg)');
  const visible = imgs.filter(i => getComputedStyle(i).display !== 'none');
  if (visible.length !== 1) problems.push(`exactly one logo image must be visible, found ${visible.length}`);
  for (const img of visible) {
    if (!img.complete || img.naturalWidth === 0) problems.push('the logo image did not load');
    const probe = document.createElement('div');
    probe.style.width = 'var(--logo-w)';
    document.body.append(probe);
    const want = probe.getBoundingClientRect().width;
    probe.remove();
    const got = img.getBoundingClientRect().width;
    if (Math.abs(got - want) > 0.5) problems.push(`the logo is ${got}px wide, the --logo-w token is ${want}px`);
    const ratio = img.getBoundingClientRect().width / img.getBoundingClientRect().height;
    if (Math.abs(ratio - 944 / 817) > 0.02) problems.push(`the logo is stretched (ratio ${ratio.toFixed(3)}, asset 944:817)`);
  }
  if (header.querySelector('svg path')) problems.push('header draws its own mark inline instead of using the canonical asset');
  return problems;
}

/**
 * Runs in the page. Resolves once layout has settled: fonts ready, then the document's size unchanged
 * for `frames` animation frames in a row (at most `maxFrames`, so a page that never stops moving is
 * still measured, and the shift it causes is what the checks then report).
 */
export function settleInPage({ frames, maxFrames }) {
  return new Promise(resolve => {
    const signature = () => { const d = document.documentElement; return `${d.scrollWidth}x${d.scrollHeight}x${document.body?.scrollHeight}`; };
    let last = signature();
    let stable = 0;
    let seen = 0;
    const tick = () => {
      const now = signature();
      seen++;
      stable = now === last ? stable + 1 : 0;
      last = now;
      if (stable >= frames || seen >= maxFrames) resolve(); else requestAnimationFrame(tick);
    };
    Promise.resolve(document.fonts?.ready).catch(() => {}).then(() => requestAnimationFrame(tick));
  });
}

/** Waits for the page to settle after a load, a resize or the arrival of data. */
export const settle = (page, frames = 3) => page.evaluate(settleInPage, { frames, maxFrames: 120 });

/**
 * How many pages run at once: LAYOUT_WORKERS if set, else the cores available, leaving one to the
 * Playwright suite that runs beside this in CI (validate.yml starts it with 2 workers), within 2 to 6.
 */
export function pickWorkers(env = process.env, cpus = os.availableParallelism()) {
  const forced = Number(env.LAYOUT_WORKERS);
  if (Number.isInteger(forced) && forced > 0) return forced;
  return Math.max(2, Math.min(6, cpus - (env.CI ? 1 : 0)));
}

async function measure(page, target, width, maxWord, failures) {
  const found = await page.evaluate(inspect, { maxWord });
  if (target.header) found.push(...(await page.evaluate(inspectHeader)));
  for (const problem of found) failures.push(`${target.name} @${width}: ${problem}`);
}

/** Loads a plain target once and measures it at each width. Throws if it never renders. */
async function checkPlain(page, target, widths, maxWord, timeout) {
  const failures = [];
  await page.setViewportSize({ width: widths[0], height: HEIGHT });
  await page.goto(target.url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(target.ready ?? target.wait, { timeout });
  for (const [i, width] of widths.entries()) {
    if (i > 0) await page.setViewportSize({ width, height: HEIGHT });
    await settle(page);
    await measure(page, target, width, maxWord, failures);
  }
  return failures;
}

/** A state target holds (gate) or fails (abort) every request for build-emitted data while the page is inspected, at one width. */
async function checkState(page, target, width, maxWord, timeout) {
  const failures = [];
  let release = () => {};
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/data/**', async route => { if (target.abort) return route.abort('failed'); await gate; return route.continue().catch(() => {}); });
  try {
    await page.setViewportSize({ width, height: HEIGHT });
    await page.goto(target.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(target.ready ?? target.wait, { timeout });
    await settle(page);
    await measure(page, target, width, maxWord, failures);
    if (target.gate) {
      // Let the file arrive: the loaded state must fit too, and what sits above the rows must not have moved.
      const top = anchor => page.evaluate(a => document.querySelector(a)?.getBoundingClientRect().top + window.scrollY, anchor);
      const before = await top(target.anchor);
      release();
      await page.waitForFunction(target.loaded, null, { timeout });
      await settle(page, 5);
      const after = await top(target.anchor);
      if (process.env.LAYOUT_DEBUG) console.log(`${target.name} @${width}: ${target.anchor} top ${before} -> ${after}`);
      if (before === undefined || after === undefined || Math.abs(before - after) > 1) failures.push(`${target.name} @${width}: ${target.anchor} moved from ${before} to ${after} when the data arrived (layout shift)`);
      for (const problem of await page.evaluate(inspect, { maxWord })) failures.push(`${target.name.replace(/loading/, 'loaded')} @${width}: ${problem}`);
    }
  } finally {
    release();
    await page.unroute('**/data/**').catch(() => {});
  }
  return failures;
}

/**
 * Returns the problems of one target at every width. One retry: a cold browser under load occasionally
 * misses the render signal; a target that still does not render is reported at each width.
 */
export async function checkTarget(page, target, { widths = WIDTHS, maxWord = MAX_WORD, timeout = 20000 } = {}) {
  if (target.gate || target.abort) {
    const failures = [];
    for (const width of widths) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try { failures.push(...(await checkState(page, target, width, maxWord, timeout))); break; }
        catch (error) { if (attempt === 2) failures.push(`${target.name} @${width}: did not render (${String(error.message).split('\n')[0]})`); }
      }
    }
    return failures;
  }
  for (let attempt = 1; ; attempt++) {
    try { return await checkPlain(page, target, widths, maxWord, timeout); }
    catch (error) {
      if (attempt === 2) return widths.map(width => `${target.name} @${width}: did not render (${String(error.message).split('\n')[0]})`);
    }
  }
}
