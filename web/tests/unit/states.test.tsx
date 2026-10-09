/**
 * What a reader sees when the ledger has nothing to show: no benchmark run for this checkout, a
 * run summary that does not validate, a candidate-mode run, a suite whose report was left out.
 * The page says so, names the command that produces the measurement, and never draws a missing
 * measurement as zero. The states come from an overlay of the real tree (tests/unit/overlay.ts).
 */
import './next-mocks';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REAL_ROOT, edited, overlay } from './overlay';

type PageProps = { params: Promise<Record<string, string>> };
type Page = (props: PageProps) => Promise<ReactElement> | ReactElement;

async function open(root: string, route: string, params: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  const mod = (await import(/* @vite-ignore */ `../../app${route}/page.tsx`)) as { default: Page };
  return render(await mod.default({ params: Promise.resolve(params) }));
}

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllEnvs(); });

const RESULTS = 'public/results';

describe('no benchmark run for this checkout', () => {
  const root = () => overlay({ [`${RESULTS}/run.json`]: null });

  test.each([
    ['/report', {}],
    ['/report/families', {}],
    ['/report/rows/[level]', { level: 'T1' }],
    ['/report/corpus', {}],
    ['/report/detectors', {}],
    ['/comparison/accuracy', {}],
  ])('%s states that nothing is measured and what produces it', async (route, params) => {
    const { container } = await open(root(), route, params);
    const text = container.textContent ?? '';
    if (route === '/comparison/accuracy') {
      // The pair page has no run to read; it still renders its frame and never invents a rate.
      expect(container.querySelector('h1')).not.toBeNull();
      return;
    }
    expect(text).toMatch(/not measured|No benchmark results|no scanner has run/i);
    expect(text).toContain('npm run bench');
    expect(text).not.toMatch(/\bundefined\b|\bNaN\b/);
  });

  test('the report hub offers no stable count it did not measure', async () => {
    await open(root(), '/report');
    expect(screen.getByText('No benchmark results for this checkout')).toBeInTheDocument();
    expect(screen.queryByText(/\bstable\b.*\b\d+ of \d+/i)).toBeNull();
  });
});

describe('a run summary that does not validate', () => {
  test('the report says the summary did not validate and keeps fixture counts', async () => {
    const root = overlay({ [`${RESULTS}/summary.json`]: null });
    const { container } = await open(root, '/report/families');
    expect(container.textContent).toContain('The run summary did not validate');
    expect(container.textContent).toContain('npm run bench');
    expect(screen.getAllByRole('row').length).toBeGreaterThan(10);
  });
});

describe('a candidate run', () => {
  test('is named as candidate wherever a stable count appears', async () => {
    const root = overlay({ [`${RESULTS}/run.json`]: edited(`${RESULTS}/run.json`, v => { v.candidate = { sourceCommit: 'c'.repeat(40), declaredVersion: '0.0.0-synthetic' }; }) });
    const { container } = await open(root, '/report');
    expect(container.textContent).toMatch(/candidate/i);
    expect(container.textContent).not.toMatch(/\bundefined\b|\bNaN\b/);
  });
});

describe('a suite whose report is left out', () => {
  test('the report names it, and the fixtures of that suite are not drawn as passes or zeros', async () => {
    const [victim] = readdirSync(path.join(REAL_ROOT, RESULTS)).filter(f => f.startsWith('beta8-') && f.endsWith('.json'));
    const root = overlay({ [`${RESULTS}/${victim}`]: '{"not":"a report"}' });
    const { container } = await open(root, '/report');
    expect(container.textContent).toMatch(/left out|report did not|did not validate/i);
  });
});
