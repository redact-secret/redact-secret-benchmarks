/**
 * The report-level disclosure of an optional scanner that a run did not measure (#763) and of where each observation came from (#724).
 *
 * Every state is authored here from synthetic views: fresh, reused, not recorded, an optional scanner left out of the run (with the pointer to its last
 * measurement, retained or in the registry's history), and a historical measurement whose native labels are unavailable. No test reads or asserts a value of
 * the committed ledger, a recorded run or a built view; the pages are put in each state by an overlay root and a synthetic view.
 */
import './next-mocks';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { QualificationOverview } from '../../components/qualification';
import { resolveObservationOrigins, resolveQualificationOverview } from '../../resolvers/qualification';
import type { QualificationView, RosterNotMeasured } from '../../services/qualification';
import { AUTHORITY_FILE, edited, overlay } from './overlay';
import { syntheticView } from './qualification-data';

type Page = (props: { params: Promise<Record<string, string>> }) => Promise<ReactElement> | ReactElement;
const dirs: string[] = [];
const results = (view: unknown): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-optional-scanner-'));
  dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'qualification-v1.json'), JSON.stringify(view));
  return dir;
};
const authorising = (view: QualificationView): string => edited(AUTHORITY_FILE, file => {
  file.authority = 'new';
  file.new.policyRevision = view.policy.revision;
  file.new.semanticDigests = Object.fromEntries(view.populations.map(p => [p.population, p.artifact.semanticDigest]));
});
async function open(view: QualificationView, route: string) {
  vi.resetModules();
  vi.stubEnv('WEB_REPO_ROOT', overlay({ [AUTHORITY_FILE]: authorising(view) }));
  vi.stubEnv('WEB_RESULTS_DIR', results(view));
  const mod = (await import(/* @vite-ignore */ `../../app${route}/page.tsx`)) as { default: Page };
  return render(await mod.default({ params: Promise.resolve({}) }));
}
beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const STATEMENT = 'Synthetic default: not measured in this run (optional)';
const digest = (c: string) => `sha256:${c.repeat(64)}`;
const run = (id: string) => ({ id, configHash: digest('a'), scannerVersion: '1.1.5', scannerConfigurationHash: digest('b') });
type Last = NonNullable<RosterNotMeasured['lastMeasurement']>;
const retained: Last = {
  recordedOn: '2030-01-02', engine: { version: '0.0.5', revision: 'abc' }, registry: 'retained', runs: [run('syn-run-a@linux-x64'), run('syn-run-b@linux-x64')],
  archive: { release: 'syn-archive-release', asset: 'syn-archive.tar.gz', ciRun: '1234' }, nativeLabels: 'unavailable',
};
const note = (last: Last | null): RosterNotMeasured => ({
  scanner: 'syn-default', profile: 'default', optional: true, label: 'Synthetic default', statement: STATEMENT,
  reason: 'A slow, manual measurement that never blocks other scanners.', lastMeasurement: last,
});
const withRoster = (notMeasured: RosterNotMeasured[]): QualificationView => ({
  ...syntheticView(),
  scannerRoster: { id: 'syn-roster', runClass: 'official', required: ['redact-secret'], optional: ['syn-default'], measured: ['alpha-lib', 'redact-secret'], notMeasured },
});

describe('every credential report page built from a view that left an optional scanner out says so', () => {
  const view = withRoster([note(retained)]);
  test.each(['/report', '/report/families', '/report/detectors', '/report/corpus', '/report/providers', '/evaluation/credential', '/comparison/accuracy'])('%s', async route => {
    const { container } = await open(view, route);
    const sourceButton = screen.queryByRole('button', { name: 'Where these numbers come from' });
    if (sourceButton) {
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(sourceButton);
      expect(screen.getByRole('dialog')).toBeTruthy();
    }
    const text = document.body.textContent ?? '';
    expect(text).toContain(STATEMENT);
    expect(text).toContain('A slow, manual measurement');
    // The pointer names the earlier measurement by run, configuration, engine and date, and says it is history that is never combined with another run.
    for (const part of ['Last measurement: syn-run-a@linux-x64', 'syn-run-b@linux-x64', 'configuration sha256:aaaaaaaaaaaa', 'engine 0.0.5', 'recorded 2030-01-02', 'never combined with another profile or another run']) expect(text).toContain(part);
    // Never an invented zero, a row of the current run or a splice: the scanner has no cell and no count anywhere on the page.
    expect(screen.queryAllByRole('cell', { name: /syn-default/ })).toHaveLength(0);
    expect(screen.queryAllByRole('link', { name: 'Open the qualification page for this pointer' }).length).toBe(1);
  });

  test('the scanner page omits optional-scanner explanations and opens the mode explanation on demand', async () => {
    const { container } = await open(view, '/comparison/scanner');
    expect(container.querySelector('[data-optional-scanners]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Published and candidate' }));
    expect(screen.getByRole('dialog').textContent).toContain('Published measures the released npm package.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  });

  test('the report pages carry the compact note: the archive detail stays on the qualification page', async () => {
    const { container } = await open(view, '/report');
    expect(container.textContent).not.toContain('syn-archive-release');
  });

  test('the qualification page carries the full pointer: the archive that keeps the artifacts and the legacy scope statement', async () => {
    const { container } = await open(view, '/evaluation/qualification');
    const text = document.body.textContent ?? '';
    expect(text).toContain(STATEMENT);
    expect(text).toContain('retained record, no longer listed by the run registry');
    expect(text).toContain('syn-archive-release');
    expect(text).toContain('syn-archive.tar.gz');
    expect(text).toContain('every scope count for it is Unknown, never zero');
  });
});

describe('a run that measured every optional scanner, or a view built before the roster, says nothing', () => {
  test.each([['no roster', syntheticView()], ['nothing left out', withRoster([])]])('%s', async (_name, view) => {
    for (const route of ['/report', '/comparison/scanner', '/comparison/accuracy']) {
      const { container, unmount } = await open(view, route);
      expect(container.textContent).not.toContain('not measured in this run (optional)');
      unmount();
    }
  });
});

describe('no earlier measurement is recorded', () => {
  test('the pages say so and point at nothing', async () => {
    const { container } = await open(withRoster([note(null)]), '/report');
    expect(container.textContent).toContain(STATEMENT);
    expect(container.textContent).toContain('No earlier measurement of it is recorded. Nothing is shown in its place.');
    expect(container.textContent).not.toContain('Last measurement:');
  });
});

describe('a measurement the registry still lists as history', () => {
  test('is labelled superseded and kept as history, not as a current run', async () => {
    const history: Last = { ...retained, registry: 'historicalRuns', archive: undefined, nativeLabels: undefined };
    const { container } = await open(withRoster([note(history)]), '/report');
    expect(container.textContent).toContain('superseded, kept as history');
  });
});

describe('origin of the observation, apart from the scope evidence', () => {
  const origin = (scanner: string, state: 'fresh' | 'reused' | 'not-recorded', reason: string | null = null) => ({ scanner, origin: state, reason });
  const view = (): QualificationView => {
    const v = withRoster([note(retained)]);
    v.populations[0].origins = {
      scanners: [origin('alpha-lib', 'fresh', 'forced'), origin('beta-lib', 'reused', 'compatible'), origin('redact-secret', 'not-recorded')],
      reuse: { sourceDigest: digest('c'), inputDigest: digest('d') },
    };
    return v;
  };

  test('fresh, reused and not recorded are three states, each in words, with its reason and receipt', () => {
    const props = resolveObservationOrigins(view())!;
    const row = (s: string) => props.rows.find(r => r.scanner === s)!;
    expect([row('alpha-lib').origin, row('alpha-lib').reason, row('alpha-lib').receipt]).toEqual(['Scanned in this run', 'forced', 'None: scanned in this run']);
    expect([row('beta-lib').origin, row('beta-lib').reason]).toEqual(['Reused from an earlier verified run', 'compatible']);
    expect(row('beta-lib').receipt).toBe('source sha256:cccccccccccc · input sha256:dddddddddddd');
    // A scanner with no recorded origin is not read as fresh.
    expect([row('redact-secret').origin, row('redact-secret').reason, row('redact-secret').state]).toEqual(['Not recorded', 'None recorded', 'not-recorded']);
  });

  test('the optional scanner left out has no origin row and is stated as not measured', () => {
    const props = resolveObservationOrigins(view())!;
    expect(props.rows.some(r => r.scanner === 'syn-default')).toBe(false);
    expect(props.omitted).toEqual([{ key: 'syn-default', statement: STATEMENT }]);
  });

  test('a reused origin with no recorded receipt says the receipt is not recorded', () => {
    const v = view();
    v.populations[0].origins!.reuse = null;
    expect(resolveObservationOrigins(v)!.rows.find(r => r.scanner === 'beta-lib')!.receipt).toBe('Reuse receipt not recorded');
  });

  test('a view built before the origin record shows no origin section instead of guessing', () => {
    expect(resolveObservationOrigins(withRoster([]))).toBeUndefined();
  });

  test('the overview shows the origin table apart from the scope table, and a historical legacy scope entry reads Unknown, never zero', () => {
    const v = view();
    const legacy = {
      scanner: 'syn-default', engineVersion: '0.0.5', state: 'legacy-native-label-unavailable', retainedFindings: 10,
      profile: { scanner: 'syn-default', version: '1', mode: 'm', build: 'released', configurationHash: digest('e'), adapterVersion: '1' },
      classification: null, labelled: null, dispositions: null, multiLabelFindings: null, conflictingLabelFindings: null, labels: [], limits: ['Legacy: nothing is classified retrospectively.'],
    };
    v.populations[0].scope = [legacy as never];
    render(<QualificationOverview {...resolveQualificationOverview(v)} />);
    const origins = screen.getByRole('table', { name: 'Where each observation came from' });
    expect(within(origins).getByText('Scanned in this run')).toBeTruthy();
    expect(within(origins).getByText('Reused from an earlier verified run')).toBeTruthy();
    expect(within(origins).getByText('Not recorded')).toBeTruthy();
    expect(within(origins).queryByText('Legacy: native labels unavailable')).toBeNull();
    const scope = screen.getByRole('table', { name: 'Findings by scope' });
    expect(within(scope).getByText('Legacy: native labels unavailable')).toBeTruthy();
    expect(within(scope).queryAllByText('0')).toHaveLength(0);
    expect(within(scope).getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.getByText(`${STATEMENT}. It has no observation in this view, so no origin.`)).toBeTruthy();
  });
});
