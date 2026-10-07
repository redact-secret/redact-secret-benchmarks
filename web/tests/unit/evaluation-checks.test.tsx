/**
 * The checks behind each count of a method table (#623). Every assertion is about binding and recounting over the synthetic report in
 * `evaluation-data.ts`: a cell's link names a list whose file holds exactly the cell's figure, every list is linked from exactly one cell,
 * pages window the file without losing or repeating a check, a file from another run or list is refused, and the notes say which run a
 * row is from. No count is read from the committed ledger or the run, so a repin cannot break these.
 */
import './next-mocks';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ChecksView } from '../../app/evaluation/method/[method]/checks/ChecksView';
import { EvidenceTable, MethodCases } from '../../components/evaluation/methods';
import type { EvidenceCell, MethodCasesProps, MethodRecordedData } from '../../components/evaluation/methods';
import { resetBuildData } from '../../lib/build-data';
import { BUILD_DATA_PATH, methodChecksDataPath } from '../../lib/data-paths';
import { METHOD_IDS, type MethodId } from '../../lib/methods';
import { checksFile, methodCheckLists, methodChecksFileParams, resolveMethodChecksPage, type MethodChecksInput } from '../../resolvers/evaluation-checks';
import {
  CHECK_PAGE_ROWS, REVIEW_LEDGER, checksBody, checksFileFits, checksNotes, checksQueryOf, listKey, methodChecksHref, type ChecksEntry,
} from '../../resolvers/evaluation-checks-view';
import { resolveMethodPage, type MethodInput } from '../../resolvers/evaluation-methods';
import { qualificationCasesHref } from '../../resolvers/qualification';
import { operatorEvidence } from '../../../benchmarks/shared/evaluation-model.ts';
import type { EvaluationReport } from '../../../benchmarks/shared/evaluation-types.ts';
import { evidenceOf, syntheticQualification, syntheticReport } from './evaluation-data';
import { visit } from './next-mocks';

const suites = new Map([['suite-a', 'Suite A']]);
const LISTED: MethodId[] = METHOD_IDS.filter(m => m !== 'holdout');

const recordedOf = (id: MethodId, report: EvaluationReport): MethodRecordedData => {
  const page = resolveMethodPage(id, { ...evidenceOf(report), qualification: { state: 'recorded', source: 'run', report: syntheticQualification() }, suites } as MethodInput);
  if (page.recorded.state !== 'recorded') throw new Error(`${id}: the synthetic report gives no recorded table`);
  return page.recorded;
};

const listsOf = (id: MethodId, report: EvaluationReport) => {
  const { report: summary, casesOf } = evidenceOf(report);
  return methodCheckLists(id, summary, casesOf(id));
};

const pageOf = (id: MethodId, report: EvaluationReport, over: Partial<MethodChecksInput> = {}) => resolveMethodChecksPage({
  method: id, report: evidenceOf(report).report, lists: listsOf(id, report), suites,
  qualification: { state: 'ready', families: new Set(['example-token']) }, ...over,
});

type Linked = { rowKey: string; rowLabel: string; column: { id: string; name: string }; cell: EvidenceCell; href: string };
const linkedCells = (rec: MethodRecordedData): Linked[] => rec.groups.flatMap(g => g.rows.flatMap(r => r.cells.flatMap((c, i) => (
  (c.kind === 'count' || c.kind === 'unscored') && c.href ? [{ rowKey: r.key, rowLabel: r.label, column: rec.columns[i], cell: c, href: c.href }] : []
))));

/** The list a cell's link names, read back from the href the method page wrote. */
const addressOf = (href: string) => {
  const url = new URL(href, 'https://example.invalid');
  const m = /^\/evaluation\/method\/([^/]+)\/checks\/$/.exec(url.pathname);
  const q = checksQueryOf(url.searchParams);
  if (!m || !q) throw new Error(`not a checks address: ${href}`);
  return { method: m[1] as MethodId, ...q };
};

/** The figure a cell shows for its list: the `value` of a count, the `of` of an unscored cell. */
const figureOf = (cell: EvidenceCell): number => Number((cell.kind === 'count' ? cell.value : cell.kind === 'unscored' ? cell.of ?? '0' : '0').replace(/,/g, ''));

/** `n` more failing pairs (copies of the first pair under new ids), so one list spans several pages. */
function withFailingPairs(report: EvaluationReport, n: number): EvaluationReport {
  const template = report.cases.find(c => c.id === 'pair-1')!;
  const cases = [...report.cases, ...Array.from({ length: n }, (_, i) => ({ ...template, id: `pair-many-${i}`, sourceSlug: `suite-a--pair-many-${i}` }))];
  return { ...report, cases, byOperator: operatorEvidence(cases) };
}

const entryFor = (entries: ChecksEntry[], href: string): ChecksEntry => {
  const a = addressOf(href);
  const entry = entries.find(e => listKey(e.row, e.scanner, e.status) === listKey(a.row, a.scanner, a.status));
  if (!entry) throw new Error(`no list for ${href}`);
  return entry;
};

describe('a count opens the checks behind it', () => {
  test.each(LISTED)('%s: every link names a list whose file holds exactly the figure it sits on, for that row and scanner', id => {
    const report = syntheticReport();
    const links = linkedCells(recordedOf(id, report));
    expect(links.length, `${id}: the synthetic report should give at least one linked cell`).toBeGreaterThan(0);
    const page = pageOf(id, report);
    const lists = listsOf(id, report);
    for (const { rowKey, rowLabel, column, cell, href } of links) {
      const address = addressOf(href);
      expect(address).toMatchObject({ method: id, row: rowKey, scanner: column.id, page: 1 });
      const entry = entryFor(page.entries, href);
      expect(entry.total, `${id} ${rowKey} ${column.id}`).toBe(figureOf(cell));
      expect(entry.src).toBe(methodChecksDataPath(id, rowKey, column.id, address.status));
      expect(BUILD_DATA_PATH.test(entry.src)).toBe(true);
      const file = checksFile(id, lists.get(listKey(rowKey, column.id, address.status))!, report.runId);
      expect(file.checks).toHaveLength(figureOf(cell));
      expect(checksFileFits(entry, report.runId)(JSON.parse(JSON.stringify(file)))).toBe(true);
      expect(entry.head.filters.map(f => f.term)).toEqual(['Method', 'Check', id === 'differential' ? 'Peer' : 'Scanner', 'Status']);
      expect(entry.head.filters[1].description).toContain(rowLabel);
      expect(entry.head.filters[2].description).toContain(column.name);
    }
  });

  test.each(LISTED)('%s: every list the export writes is linked from exactly one cell and listed once in the index', id => {
    const report = syntheticReport();
    const hrefs = linkedCells(recordedOf(id, report)).map(x => x.href).sort();
    const files = methodChecksFileParams(id, listsOf(id, report)).map(p => methodChecksHref(id, p.row, p.scanner, p.status as 'fail')).sort();
    expect(hrefs).toEqual(files);
    const index = pageOf(id, report).index;
    if (index.body.state !== 'index') throw new Error('expected the index');
    expect(index.body.table.rows.map(r => r.cells[3][0].href).sort()).toEqual(hrefs);
  });

  test('a zero, a scanner that did not run and a check a scanner has none of open nothing', () => {
    const report = syntheticReport();
    for (const id of LISTED) {
      for (const r of recordedOf(id, report).groups.flatMap(g => g.rows)) {
        for (const c of r.cells) {
          if (c.kind === 'not-measured' || c.kind === 'none') expect(c).not.toHaveProperty('href');
          if (c.kind === 'count' && c.value === '0') expect(c).not.toHaveProperty('href');
        }
      }
    }
  });

  test('a row whose counts open no list says why under its label, and every table says what a count opens', () => {
    const benign = recordedOf('benign', syntheticReport()).groups.flatMap(g => g.rows);
    for (const key of ['gating', 'warn']) expect(benign.find(r => r.key === key)?.unlisted).toMatch(/^Not listed/);
    const differential = recordedOf('differential', syntheticReport()).groups.flatMap(g => g.rows);
    for (const key of ['compared', 'not-comparable']) expect(differential.find(r => r.key === key)?.unlisted).toMatch(/^Not listed/);
    for (const id of LISTED) expect(recordedOf(id, syntheticReport()).detail).toMatch(/opens the (checks|comparisons) behind it/);
  });

  test('holdout has no lists: a holdout case cannot be opened', () => {
    expect(listsOf('holdout', syntheticReport()).size).toBe(0);
  });
});

describe('pages window one file', () => {
  const report = withFailingPairs(syntheticReport(), CHECK_PAGE_ROWS + 20);
  const page = pageOf('twin', report);
  const href = linkedCells(recordedOf('twin', report)).find(x => x.rowKey === 'pair' && x.column.id === 'peer-a')!.href;
  const entry = entryFor(page.entries, href);
  const file = checksFile('twin', listsOf('twin', report).get(listKey(entry.row, entry.scanner, entry.status))!, report.runId);

  test('the pages hold every check of the list once, in run order, with Previous and Next links that keep the filters', () => {
    const first = checksBody(entry, file, 1, page.context!)!;
    expect(first.pager).toMatchObject({ page: 1, pageCount: 2, total: CHECK_PAGE_ROWS + 21, pageSize: CHECK_PAGE_ROWS, nextHref: `${href}&page=2` });
    expect(first.pager.previousHref).toBeUndefined();
    const second = checksBody(entry, file, 2, page.context!)!;
    expect(second.pager).toMatchObject({ page: 2, pageCount: 2, previousHref: href });
    expect(second.pager.nextHref).toBeUndefined();
    const ids = [...first.table.rows, ...second.table.rows].map(r => r.cells[0][0].text);
    expect(ids).toHaveLength(CHECK_PAGE_ROWS + 21);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 2)).toEqual(['pair-1', 'pair-many-0']);
    expect(checksBody(entry, file, 3, page.context!)).toBeNull();
    expect(checksBody(entry, file, 0, page.context!)).toBeNull();
  });

  test('a file from another run, of another length or of another list is refused', () => {
    const fits = checksFileFits(entry, report.runId);
    expect(fits(file)).toBe(true);
    expect(checksFileFits(entry, 'another-run')(file)).toBe(false);
    expect(fits({ ...file, checks: file.checks.slice(1) })).toBe(false);
    expect(fits({ ...file, scanner: 'redact-secret' })).toBe(false);
    expect(fits({ ...file, schema: 'x' })).toBe(false);
    expect(fits(null)).toBe(false);
  });

  test('an address names a list only with its row, scanner and status; a page that is not a positive integer is no page', () => {
    expect(checksQueryOf(new URLSearchParams('row=pair&scanner=peer-a'))).toBeNull();
    expect(checksQueryOf(new URLSearchParams('row=pair&scanner=peer-a&status=fail'))).toEqual({ row: 'pair', scanner: 'peer-a', status: 'fail', page: 1 });
    expect(checksQueryOf(new URLSearchParams('row=pair&scanner=peer-a&status=fail&page=2'))?.page).toBe(2);
    expect(checksQueryOf(new URLSearchParams('row=pair&scanner=peer-a&status=fail&page=x'))?.page).toBe(0);
  });
});

describe('identity: which run a row is from', () => {
  const report = syntheticReport();
  const page = pageOf('twin', report);
  const href = linkedCells(recordedOf('twin', report)).find(x => x.rowKey === 'pair' && x.column.id === 'peer-a')!.href;
  const entry = entryFor(page.entries, href);
  const file = checksFile('twin', listsOf('twin', report).get(listKey(entry.row, entry.scanner, entry.status))!, report.runId);

  test('the page names the discovery run, and a family links to its qualification case page only when the view has it', () => {
    expect(page.context!.meta).toContainEqual({ label: 'Run', value: expect.stringContaining(report.runId.slice(0, 8)) });
    expect(checksBody(entry, file, 1, page.context!)!.table.rows[0].cells[4]).toEqual([{ text: 'example-token', href: qualificationCasesHref('example-token', 1) }]);
    expect(checksNotes(entry, page.context!).map(n => n.title)).toContain('Families lead to another report');
    const other = pageOf('twin', report, { qualification: { state: 'ready', families: new Set(['another-family']) } });
    expect(checksBody(entry, file, 1, other.context!)!.table.rows[0].cells[4][0]).toEqual({ text: 'example-token', note: 'No case page in the qualification view' });
  });

  test('without a usable qualification view no family is linked and the page says why', () => {
    const none = pageOf('twin', report, { qualification: { state: 'unavailable', reason: 'The qualification view is not-built in this build.' } });
    expect(none.context!.families).toBeNull();
    expect(checksBody(entry, file, 1, none.context!)!.table.rows.flatMap(r => r.cells[4]).every(i => !i.href)).toBe(true);
    expect(checksNotes(entry, none.context!).find(n => n.title === 'No qualification view to link to')?.text).toMatch(/not-built/);
  });

  test('a source fixture links to its page only when the build has one, in a suite it publishes', () => {
    expect(checksBody(entry, file, 1, page.context!)!.table.rows[0].cells[1]).toEqual([{ text: 'suite-a--pair-1', note: 'No fixture page in this build' }]);
    const list = listsOf('twin', report).get(listKey(entry.row, entry.scanner, entry.status))!;
    const withPages = checksFile('twin', list, report.runId, slug => (slug === 'suite-a--pair-1' ? 'pair-1' : undefined));
    expect(checksFileFits(entry, report.runId)(withPages)).toBe(true);
    expect(checksBody(entry, withPages, 1, page.context!)!.table.rows[0].cells[1]).toEqual([{ text: 'pair-1', href: '/report/fixtures/suite-a/?fixture=pair-1', note: 'Suite A' }]);
    const unpublished = pageOf('twin', report, { suites: new Map() });
    expect(checksBody(entry, withPages, 1, unpublished.context!)!.table.rows[0].cells[1]).toEqual([{ text: 'suite-a--pair-1', note: 'No fixture page in this build' }]);
  });

  test('review decisions stay in the ledger: a list of checks that wait for review, or of comparisons, says so and decides nothing', () => {
    expect(checksNotes(entry, page.context!).some(n => n.text.includes(REVIEW_LEDGER))).toBe(false);
    const mutation = pageOf('mutation', report);
    const review = linkedCells(recordedOf('mutation', report)).find(x => x.cell.kind === 'unscored')!;
    const reviewEntry = entryFor(mutation.entries, review.href);
    expect(reviewEntry.head.filters.find(f => f.term === 'Status')?.description).toBe('Needs review');
    expect(checksNotes(reviewEntry, mutation.context!).some(n => n.text.includes(REVIEW_LEDGER))).toBe(true);
    const differential = pageOf('differential', report);
    const comparison = entryFor(differential.entries, linkedCells(recordedOf('differential', report))[0].href);
    expect(checksNotes(comparison, differential.context!).some(n => n.text.includes(REVIEW_LEDGER))).toBe(true);
    const diffFile = checksFile('differential', listsOf('differential', report).get(listKey(comparison.row, comparison.scanner, comparison.status))!, report.runId);
    expect(checksBody(comparison, diffFile, 1, differential.context!)!.table.columns.map(c => c.header)).toContain('Family classification');
  });

  test('with no evaluation the page says so, lists nothing and opens nothing', () => {
    const none = resolveMethodChecksPage({ method: 'twin', suites, qualification: { state: 'unavailable', reason: 'x' }, reason: 'Nothing was published.' });
    expect(none.entries).toEqual([]);
    expect(none.context).toBeNull();
    expect(none.index.body).toMatchObject({ state: 'not-measured' });
    expect(none.index.body.state === 'not-measured' && none.index.body.body).toMatch(/^Nothing was published\./);
  });
});

describe('blocks', () => {
  test('a linked count is a link named by its figure; an unlinked one is not a link', () => {
    render(<EvidenceTable
      columns={[{ id: 'a', name: 'scanner-a' }, { id: 'b', name: 'scanner-b' }]}
      groups={[{ label: '', rows: [{ key: 'r', label: 'Row', cells: [{ kind: 'count', value: '3', of: '9', href: '/evaluation/method/twin/checks/?row=r&scanner=a&status=fail' }, { kind: 'count', value: '0', of: '9' }] }] }]}
      rowHeader="Check" caption="Synthetic"
    />);
    const links = within(screen.getByRole('table', { name: 'Synthetic' })).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('row=r&scanner=a&status=fail');
    expect(links[0]).toHaveAccessibleName('3 of 9');
  });

  test('the index has one h1 and a link per list', () => {
    const { index, entries } = pageOf('twin', syntheticReport());
    render(<MethodCases {...index} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(screen.getByRole('table')).getAllByRole('link')).toHaveLength(entries.length);
    expect(screen.getByRole('link', { name: 'Back to the twin method' }).getAttribute('href')).toMatch(/^\/evaluation\/method\/twin\/?$/);
  });

  test('loading, failed and missing states say what is drawn', () => {
    const base: Omit<MethodCasesProps, 'body'> = { crumbs: [{ label: 'Evaluation' }], eyebrow: 'X', title: 'T', lede: 'L', meta: [], filters: [], notes: [], back: { label: 'Back', href: '/evaluation/' } };
    const onRetry = vi.fn();
    const { rerender } = render(<MethodCases {...base} body={{ state: 'loading', label: 'Loading the checks' }} />);
    expect(screen.getByText('Loading the checks')).toBeInTheDocument();
    rerender(<MethodCases {...base} body={{ state: 'error', title: 'Could not load this list', detail: 'The file did not arrive.', retryLabel: 'Try again', onRetry }} />);
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(<MethodCases {...base} body={{ state: 'missing', title: 'No such list', text: 'Open a count.' }} />);
    expect(screen.getByText('No such list')).toBeInTheDocument();
  });
});

describe('the island opens one list from its address', () => {
  const report = syntheticReport();
  const page = pageOf('twin', report);
  const href = linkedCells(recordedOf('twin', report)).find(x => x.rowKey === 'pair' && x.column.id === 'peer-a')!.href;
  const entry = entryFor(page.entries, href);
  const file = checksFile('twin', listsOf('twin', report).get(listKey(entry.row, entry.scanner, entry.status))!, report.runId);
  const fallback = { crumbs: page.index.crumbs, eyebrow: page.index.eyebrow, title: page.index.title, meta: page.index.meta, back: page.index.back };
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    resetBuildData();
    fetchMock = vi.fn(async () => new Response(JSON.stringify(file), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); visit('/'); });

  test('fetches the one file of the named list and shows its checks', async () => {
    visit(href);
    render(<ChecksView entries={page.entries} context={page.context} fallback={fallback} />);
    expect(screen.getByText(/^Loading the \d+ checks of this list$/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`/data/${entry.src}`);
    expect(within(screen.getByRole('table')).getAllByRole('row').length - 1).toBe(entry.total);
  });

  test('a file of another run is refused and the page says it is not from this build', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ ...file, runId: 'another-run' }), { status: 200 }));
    visit(href);
    render(<ChecksView entries={page.entries} context={page.context} fallback={fallback} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not from the same build/));
  });

  test('an address that names no list, or a page the list does not have, says so and fetches nothing', async () => {
    visit('/evaluation/method/twin/checks/?row=nothing&scanner=peer-a&status=fail');
    const { unmount } = render(<ChecksView entries={page.entries} context={page.context} fallback={fallback} />);
    expect(screen.getByText('No such list')).toBeInTheDocument();
    unmount();
    visit(`${href}&page=9`);
    await act(async () => { render(<ChecksView entries={page.entries} context={page.context} fallback={fallback} />); });
    expect(screen.getByText('No such list')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
