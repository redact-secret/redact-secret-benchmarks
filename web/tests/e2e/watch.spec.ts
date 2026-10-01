/**
 * The no-console-output rule must fail on a real problem and ignore only Chrome's advice about an unused stylesheet
 * preload (see isUnusedPreloadAdvice in fixtures.ts). These tests keep that filter from swallowing anything else.
 */
import { test, expect, isUnusedPreloadAdvice, BASE } from './fixtures';

const origin = 'http://127.0.0.1:4173';
const advice = (url: string): string => `The resource ${url} was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate \`as\` value and it is preloaded intentionally.`;

test.describe('console watch', () => {
  test("drops only the unused-preload advice for this origin's built stylesheet", () => {
    expect(isUnusedPreloadAdvice(advice(`${origin}${BASE}/_next/static/chunks/abc.css`), origin)).toBe(true);
    // another origin, a script, a path outside the build output, extra text or a different message are all problems
    expect(isUnusedPreloadAdvice(advice(`http://example.test${BASE}/_next/static/chunks/abc.css`), origin)).toBe(false);
    expect(isUnusedPreloadAdvice(advice(`${origin}${BASE}/_next/static/chunks/abc.js`), origin)).toBe(false);
    expect(isUnusedPreloadAdvice(advice(`${origin}${BASE}/other/abc.css`), origin)).toBe(false);
    expect(isUnusedPreloadAdvice(`app says: ${advice(`${origin}${BASE}/_next/static/chunks/abc.css`)}`, origin)).toBe(false);
    expect(isUnusedPreloadAdvice('Failed to load resource', origin)).toBe(false);
  });

  test('a console.error, a console.warn and an uncaught error from the page are recorded as problems', async ({ page, watch }) => {
    await page.goto(`${BASE}/report/`);
    expect(watch.problems).toEqual([]);
    await page.evaluate(() => {
      console.error('synthetic error');
      console.warn('synthetic warning');
      setTimeout(() => { throw new Error('synthetic uncaught'); });
    });
    await expect.poll(() => watch.problems.length).toBe(3);
    expect(watch.problems.map(problem => problem.split(':')[0]).sort()).toEqual(['console.error', 'console.warning', 'pageerror']);
  });

  test('the unused-preload advice is not recorded, the same text for a script is', async ({ page, watch }) => {
    await page.goto(`${BASE}/report/`);
    await page.evaluate(() => {
      const text = (file: string) => `The resource ${location.origin}/next/_next/static/chunks/${file} was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate \`as\` value and it is preloaded intentionally.`;
      console.warn(text('x.css'));
      console.warn(text('x.js'));
    });
    await expect.poll(() => watch.problems.length).toBe(1);
    expect(watch.problems[0]).toContain('x.js');
  });
});
