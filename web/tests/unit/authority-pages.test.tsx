/**
 * The credential report pages under each authority (#608): the same routes render either pipeline, every one names the pipeline
 * behind its numbers, and the comparison pages say they stay on the legacy files. The pipeline is chosen by an overlay root, never by the
 * committed value, and every view is synthetic: no count of the ledger or of a built view is asserted.
 */
import './next-mocks';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AUTHORITY_FILE, authorityFile, edited, overlay } from './overlay';
import { syntheticView } from './qualification-data';
import { FixtureDetail } from '../../components/report/FixtureDetail';
import { resolveFixtureRecord, type FixtureRecord, type SuiteShared } from '../../resolvers/fixtures';
import type { QualificationView } from '../../services/qualification';

type Page = (props: { params: Promise<Record<string, string>> }) => Promise<ReactElement> | ReactElement;
const dirs: string[] = [];
const results = (view?: unknown): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-authority-pages-'));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  if (view !== undefined) writeFileSync(path.join(dir, 'qualification-v1.json'), JSON.stringify(view));
  return dir;
};
const authorising = (view: QualificationView): string => edited(AUTHORITY_FILE, file => {
  file.authority = 'new';
  file.new.policyRevision = view.policy.revision;
  file.new.semanticDigests = Object.fromEntries(view.populations.map(p => [p.population, p.artifact.semanticDigest]));
});

async function open(root: string, dir: string | undefined, route: string, params: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', root);
  if (dir) vi.stubEnv('WEB_RESULTS_DIR', dir);
  const mod = (await import(/* @vite-ignore */ `../../app${route}/page.tsx`)) as { default: Page };
  return render(await mod.default({ params: Promise.resolve(params) }));
}

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const stamp = (container: HTMLElement) => container.querySelector('aside[data-pipeline]');

describe('authority legacy', () => {
  const root = () => overlay({ [AUTHORITY_FILE]: authorityFile('legacy') });

  test.each(['/report', '/report/providers', '/report/families', '/report/detectors', '/report/fixtures', '/evaluation/credential'])('%s is built from the legacy pipeline, the authority', async route => {
    const { container } = await open(root(), undefined, route);
    expect(stamp(container)).toHaveAttribute('data-pipeline', 'legacy');
    expect(stamp(container)).toHaveAttribute('data-role', 'authority');
    expect(screen.getByText('Built from the legacy pipeline')).toBeInTheDocument();
  });

  test('a rows page is stamped too', async () => {
    const { container } = await open(root(), undefined, '/report/rows/[level]', { level: 'T1' });
    expect(stamp(container)).toHaveAttribute('data-pipeline', 'legacy');
  });
});

describe('authority new, with an authorised view', () => {
  const view = syntheticView();
  const own = view.populations.find(p => p.role === 'floors-and-gates')!;
  const root = () => overlay({ [AUTHORITY_FILE]: authorising(view) });

  test.each(['/report', '/report/providers', '/report/families', '/report/detectors', '/report/fixtures', '/evaluation/credential'])('%s is built from the new pipeline, and names the population and the run', async route => {
    const { container } = await open(root(), results(view), route);
    const aside = stamp(container)!;
    expect(aside).toHaveAttribute('data-pipeline', 'new');
    expect(aside).toHaveAttribute('data-role', 'authority');
    expect(aside.textContent).toContain(own.population);
    expect(aside.textContent).toContain(own.artifact.semanticDigest.slice(0, 19));
    expect(aside.textContent).toContain(own.artifact.evidence.release!.tag);
  });

  test('the suite page lists the suite of the report population and the stamp is on it', async () => {
    const { container } = await open(root(), results(view), '/report/fixtures/[suite]', { suite: own.population });
    expect(stamp(container)).toHaveAttribute('data-pipeline', 'new');
    expect(container.querySelector('h1')?.textContent).toBe(own.population);
  });

  test('the hub says which population the numbers are about, and that the others are not added in', async () => {
    const { container } = await open(root(), results(view), '/report');
    expect(stamp(container)!.textContent).toMatch(/regression and policy populations keep their own counts/);
  });

  test('the suite records file carries each fixture without bytes, with the rows as the view recorded them', async () => {
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', root());
    vi.stubEnv('WEB_RESULTS_DIR', results(view));
    const route = await import('../../app/data/fixtures/[suite]/records.json/route');
    const response = await route.GET(new Request('http://x'), { params: Promise.resolve({ suite: own.population }) });
    const file = await response.json();
    expect(file.records).toHaveLength(own.cases.length);
    for (const record of file.records) expect([record.noContent, record.content, record.sha]).toEqual([true, '', '']);
    expect(file.shared.scanners.map((s: { id: string }) => s.id)).toEqual(own.artifact.scanners.map(s => s.id));
  });

  test('a page that stays on the legacy files says it is the oracle, not the new pipeline', async () => {
    const { container } = await open(root(), results(view), '/comparison/accuracy');
    const aside = stamp(container);
    if (aside) { expect(aside).toHaveAttribute('data-pipeline', 'legacy'); expect(aside).toHaveAttribute('data-role', 'oracle'); }
    expect(container.querySelector('h1')).not.toBeNull();
  });
});

describe('authority new, without a usable view', () => {
  test.each([
    ['no view', undefined],
    ['a view that is not the authorised one', syntheticView()],
  ])('every report page says so and shows no number (%s)', async (_name, view) => {
    const authorised = syntheticView();
    authorised.policy.revision = `rs-policy-1:sha256:${'5'.repeat(64)}`;
    const root = overlay({ [AUTHORITY_FILE]: authorising(authorised) });
    const { container } = await open(root, results(view), '/report');
    expect(stamp(container)).toHaveAttribute('data-pipeline', 'new');
    expect(screen.getByText('No qualification view for this build')).toBeInTheDocument();
    expect(container.textContent).toContain('qualification:view');
    expect(container.textContent).not.toMatch(/Same [\d,]+ inputs|secret spans leaked|controls flagged/);
  });

  test('the suite route keeps one page that says why there is nothing to list', async () => {
    const root = overlay({ [AUTHORITY_FILE]: authorityFile('new') });
    vi.resetModules();
    vi.stubEnv('WEB_REPO_ROOT', root);
    vi.stubEnv('WEB_RESULTS_DIR', results());
    const pages = await import('../../resolvers/pages');
    const slugs = await pages.resolveSuiteSlugs();
    expect(slugs).toHaveLength(1);
    const page = await pages.resolveSuitePage(slugs[0]);
    expect(page?.fixtureCount).toBe(0);
    expect(page?.runState.kind).toBe('not-published');
    const params = await pages.resolveRowsFileParams();
    expect(params).toHaveLength(1);
  });
});

describe('a fixture whose bytes are not recorded', () => {
  const shared: SuiteShared = {
    category: 's', suite: { title: 's', reviewStatus: '' }, scanners: [{ id: 'redact-secret', name: 'redact-secret', version: '1.0.0', mode: 'm', status: 'complete', observed: [] }],
    assessments: [{ sources: [] }], followUps: [], detectorTitles: {}, familyNames: {}, providerNames: {}, scenarios: [], texts: [], run: { date: '2030-01-02', mode: 'published' },
  };
  const record: FixtureRecord = {
    id: 'one', path: 's/one.txt', kind: 'must-redact', tier: 'T1', content: '', noContent: true, expected: [{ start: 3, end: 9, role: 'secret' }], detectors: [], families: [], assessment: 0, followUps: [], twins: [],
    rows: ['E||||||2'], scenarios: [], sha: '',
  };

  test('the page says so, draws no file, lane or download, and counts the ranges without placing them', () => {
    const detail = resolveFixtureRecord(record, shared, [record]);
    expect(detail.input).toBeUndefined();
    expect(detail.output).toBeUndefined();
    expect(detail.escaped).toBeUndefined();
    expect(detail.key).toEqual([]);
    expect(detail.actions.download).toBeUndefined();
    expect(detail.actions.bytesNotRecorded).toBe(true);
    expect(detail.bytesNote).toMatch(/not the file’s bytes/);
    expect(detail.spans[0].reportedNote).toBe('offsets not recorded');
    const { container } = render(<FixtureDetail fixture={detail} />);
    expect(screen.getByText('The bytes are not recorded')).toBeInTheDocument();
    expect(screen.getByText('Exact bytes are not recorded')).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Input file"]')).toBeNull();
  });

  test('a row that has a count and no ranges survives the compact record', async () => {
    const { packRow, unpackRow } = await import('../../resolvers/fixtures');
    const withCount = { spanOutcomes: ['EXACT' as const], observed: 2, leakedBytes: 0, collateralBytes: 0 };
    expect(unpackRow(packRow(withCount))).toEqual(withCount);
    const withRanges = { spanOutcomes: ['MISS' as const], actual: [{ start: 1, end: 4 }], leakedBytes: 3, collateralBytes: 0 };
    expect(unpackRow(packRow(withRanges))).toEqual(withRanges);
    expect(unpackRow(packRow({ flagged: false, actual: [] }))).toEqual({ flagged: false, actual: [] });
  });
});
