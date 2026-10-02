/**
 * The client islands, each rendered inside the real page it ships in and driven through the
 * browser APIs it reads: the address bar (`?q=`, `?show=`, `?page=`, `?fixture=`), `popstate`,
 * `history`, and `fetch` for the build-emitted data files. The files come from the same route
 * handlers `next build` runs, so a page and its data cannot drift in the test either.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { visit } from './next-mocks';
import { peekBuildData, resetBuildData } from '../../lib/build-data';

interface PageModule { default: (props: { params: Promise<Record<string, string>> }) => Promise<ReactElement> | ReactElement }
const pages = import.meta.glob('../../app/**/page.tsx') as unknown as Record<string, () => Promise<PageModule>>;
const renderPage = async (route: string, params: Record<string, string> = {}) => render(await (await pages[`../../app${route}/page.tsx`]()).default({ params: Promise.resolve(params) }));

type Handler = { GET: (request: Request, ctx: { params: Promise<any> }) => Promise<Response> };
const handlers = {
  rows: () => import('../../app/data/rows/[kind]/[id]/rows.json/route') as unknown as Promise<Handler>,
  records: () => import('../../app/data/fixtures/[suite]/records.json/route') as unknown as Promise<Handler>,
  differences: () => import('../../app/data/comparison/accuracy/differences.json/route') as unknown as Promise<Handler>,
};

/** What the browser would get for a build-emitted data URL, produced by the route handlers. */
async function served(url: string): Promise<Response> {
  const path = url.replace('/data/', '');
  const rows = /^rows\/([^/]+)\/([^/]+)\/rows\.json$/.exec(path);
  if (rows) return (await handlers.rows()).GET(new Request('http://x'), { params: Promise.resolve({ kind: rows[1], id: rows[2] }) });
  const records = /^fixtures\/([^/]+)\/records\.json$/.exec(path);
  if (records) return (await handlers.records()).GET(new Request('http://x'), { params: Promise.resolve({ suite: records[1] }) });
  if (path === 'comparison/accuracy/differences.json') return (await handlers.differences()).GET(new Request('http://x'), { params: Promise.resolve({}) });
  return new Response('Not found', { status: 404 });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetBuildData();
  fetchMock = vi.fn((url: string) => served(url));
  vi.stubGlobal('fetch', fetchMock);
  // No idle callback ever fires on its own: a test that wants the idle load runs it.
  vi.stubGlobal('requestIdleCallback', () => 1);
  vi.stubGlobal('cancelIdleCallback', () => {});
  visit('/');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const search = () => window.location.search;

describe('families and providers lists (?q= ?show= ?level=)', () => {
  test('a shared link reproduces the view: the search box and the count follow the address', async () => {
    visit('/report/families/?q=github');
    await renderPage('/report/families');
    const find = await screen.findByRole('searchbox', { name: 'Find' });
    await waitFor(() => expect(find).toHaveValue('github'));
    const filtered = screen.getByRole('status', { name: '' }).textContent;
    expect(filtered).toMatch(/\d+ famil/);
    expect(screen.getByRole('table', { name: /Families/ }) ?? screen.getByRole('region', { name: /Families/ })).toBeInTheDocument();
  });

  test('typing rewrites the address in place (no new history entry) and narrows the rows; clearing restores them', async () => {
    const user = userEvent.setup();
    await renderPage('/report/families');
    const before = window.history.length;
    const find = await screen.findByRole('searchbox', { name: 'Find' });
    const allText = screen.getByRole('status').textContent;
    await user.type(find, 'zzzzzz-no-such-family');
    expect(search()).toBe('?q=zzzzzz-no-such-family');
    expect(window.history.length).toBe(before);
    expect(screen.getByRole('status').textContent).toMatch(/^0 /);
    await user.clear(find);
    expect(search()).toBe('');
    expect(screen.getByRole('status').textContent).toBe(allText);
  });

  test('the evidence level and the show choice are in the address; Back (popstate) follows them', async () => {
    const user = userEvent.setup();
    await renderPage('/report/families');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Evidence level' }), 'T2');
    expect(search()).toBe('?level=T2');
    await user.click(screen.getByRole('button', { name: 'No fixtures' }));
    expect(search()).toContain('show=empty');
    expect(search()).toContain('level=T2');
    visit('/report/families/?level=T3');
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Evidence level' })).toHaveValue('T3'));
  });

  test('an unknown level in the address falls back to the first list', async () => {
    visit('/report/providers/?level=T9');
    await renderPage('/report/providers');
    const select = await screen.findByRole('combobox', { name: 'Evidence level' });
    expect((select as HTMLSelectElement).selectedIndex).toBe(0);
  });

  test('providers: a search opens every provider so the matches are visible', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage('/report/providers');
    expect(container.querySelectorAll('details[open]')).toHaveLength(0);
    await user.type(await screen.findByRole('searchbox', { name: 'Find' }), 'a');
    await waitFor(() => expect(container.querySelectorAll('details[open]').length).toBeGreaterThan(0));
  });

  test('detectors: find and the "at or below the minimum" choice narrow the list', async () => {
    const user = userEvent.setup();
    await renderPage('/report/detectors');
    const status = () => screen.getByRole('status').textContent ?? '';
    const total = Number(/^(\d+)/.exec(status())![1]);
    expect(total).toBeGreaterThan(5);
    await user.type(await screen.findByRole('searchbox', { name: 'Find' }), 'stripe');
    const narrowed = Number(/^(\d+)/.exec(status())![1]);
    expect(narrowed).toBeLessThan(total);
    await user.clear(screen.getByRole('searchbox', { name: 'Find' }));
    await user.click(screen.getByRole('button', { name: 'At or below the minimum' }));
    expect(search()).toBe('?show=signal');
  });
});

describe('rows table (RowsView)', () => {
  const LEVEL = '/report/rows/[level]';

  test('the first paint is the first page of rows with no request while idle', async () => {
    await renderPage(LEVEL, { level: 'T1' });
    await screen.findByRole('searchbox', { name: 'Find' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/of [\d,]+ rows/);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  test('an address that asks for another view loads the rest at once: busy and "Loading rows" while it is out, then the filtered count', async () => {
    visit('/report/rows/T1/?show=leaked');
    let release!: () => void;
    fetchMock.mockImplementationOnce(url => new Promise<Response>(resolve => { release = () => resolve(served(url)); }));
    await renderPage(LEVEL, { level: 'T1' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Loading rows…'));
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    // The controls keep the reader's choice while the data is out.
    expect(screen.getByRole('button', { name: 'Left readable' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByRole('status').textContent).not.toBe('Loading rows…'));
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/data/rows/level/T1/rows.json');
  });

  test('a failed load says why, keeps the first page readable and retries on request', async () => {
    const user = userEvent.setup();
    visit('/report/rows/T1/?q=a');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await renderPage(LEVEL, { level: 'T1' });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Could not load the rest of the rows')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('Rows not loaded');
    expect(screen.getAllByRole('row').length).toBeGreaterThan(5);
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('offline: the note says so, and the load comes back by itself when the connection does', async () => {
    visit('/report/rows/T1/?q=a');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await renderPage(LEVEL, { level: 'T1' });
    expect(await screen.findByText('You are offline')).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  test('a rows file from another build is refused with an offer to reload, not retry', async () => {
    visit('/report/rows/T1/?q=a');
    fetchMock.mockImplementationOnce(async url => {
      const real = (await (await served(url)).json()) as { items: unknown[] };
      return Response.json({ ...real, items: real.items.slice(1) });
    });
    await renderPage(LEVEL, { level: 'T1' });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Could not use the rest of the rows/)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
  });

  test('Next moves to page 2 as a history entry (Back returns), scrolls the table into view and keeps the filter', async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    visit('/report/rows/T1/?q=a');
    await renderPage(LEVEL, { level: 'T1' });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/of/));
    const nav = await screen.findByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText(/Page 1 of/)).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: 'Next' }));
    expect(search()).toContain('page=2');
    expect(search()).toContain('q=a');
    expect(scroll).toHaveBeenCalled();
    await waitFor(() => expect(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText(/Page 2 of/)).toBeInTheDocument());
    act(() => { window.history.back(); });
    await waitFor(() => expect(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText(/Page 1 of/)).toBeInTheDocument());
  });

  test('a search that matches nothing says so and offers no pager', async () => {
    const user = userEvent.setup();
    await renderPage(LEVEL, { level: 'T1' });
    await user.type(await screen.findByRole('searchbox', { name: 'Find' }), 'zzzz-matches-no-fixture');
    expect(await screen.findByText('No rows match')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/^0 /);
  });

  test('choosing "Every scanner" widens the table to one column per scanner and is kept in the address', async () => {
    const user = userEvent.setup();
    visit('/report/rows/T1/?scanners=all');
    await renderPage(LEVEL, { level: 'T1' });
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Scanners' })).toHaveValue('all'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Scanners' }), 'product');
    expect(search()).toContain('scanners=product');
  });

  test('pointing at a row link warms the suite records file named by the page', async () => {
    const user = userEvent.setup();
    await renderPage('/report/fixtures/[suite]', { suite: 'common-formats' });
    const link = await screen.findAllByRole('link', { name: /./ });
    const rowLink = link.find(a => a.getAttribute('href')?.includes('?fixture='));
    expect(rowLink).toBeTruthy();
    await user.hover(rowLink!);
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('/records.json'))).toBe(true));
    // Let the warmed load land before the next test resets the cache.
    await waitFor(() => expect(peekBuildData('fixtures/common-formats/records.json')).toBeDefined());
  });
});

describe('a fixture of a suite (?fixture=)', () => {
  const SUITE = '/report/fixtures/[suite]';
  const suite = 'common-formats';

  async function aFixtureId() {
    const file = (await (await served(`/data/fixtures/${suite}/records.json`)).json()) as { records: { id: string }[] };
    return file.records[0].id;
  }

  test('without ?fixture= the suite list is the page and nothing is requested', async () => {
    await renderPage(SUITE, { suite });
    expect(await screen.findByRole('searchbox', { name: 'Find' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.fixture).toBeUndefined();
  });

  test('a direct visit shows the loading frame, then the fixture with its bytes and per-scanner lanes', async () => {
    const id = await aFixtureId();
    visit(`/report/fixtures/${suite}/?fixture=${encodeURIComponent(id)}`);
    let release!: () => void;
    fetchMock.mockImplementationOnce(url => new Promise<Response>(resolve => { release = () => resolve(served(url)); }));
    await renderPage(SUITE, { suite });
    await waitFor(() => expect(document.documentElement.dataset.fixture).toBe('1'));
    const frame = document.querySelector('[data-fixture-state]')!;
    await waitFor(() => expect(frame).toHaveAttribute('data-fixture-state', 'loading'));
    expect(within(frame as HTMLElement).getByRole('status')).toHaveTextContent(`Loading fixture ${id}`);
    await act(async () => { release(); });
    await waitFor(() => expect(frame).toHaveAttribute('data-fixture-state', 'ready'));
    expect(frame).toHaveAttribute('data-fixture-ready');
    expect(within(frame as HTMLElement).getByRole('heading', { level: 1 })).toHaveTextContent(id);
  });

  test('an id the suite does not have says so and links back to the suite', async () => {
    visit(`/report/fixtures/${suite}/?fixture=no-such-fixture`);
    await renderPage(SUITE, { suite });
    expect(await screen.findByText(/No fixture “no-such-fixture”/)).toBeInTheDocument();
    const frame = document.querySelector('[data-fixture-state]')!;
    expect(frame).toHaveAttribute('data-fixture-state', 'missing');
    expect(within(frame as HTMLElement).getByRole('link', { name: 'All fixtures in this suite' })).toHaveAttribute('href', expect.stringMatching(new RegExp(`^/report/fixtures/${suite}/?$`)));
  });

  test('a failed load keeps the title, offers a retry and the way back; the retry loads the fixture', async () => {
    const user = userEvent.setup();
    const id = await aFixtureId();
    visit(`/report/fixtures/${suite}/?fixture=${encodeURIComponent(id)}`);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await renderPage(SUITE, { suite });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Could not load this fixture')).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(document.querySelector('[data-fixture-state]')).toHaveAttribute('data-fixture-state', 'ready'));
  });

  test('the flag on the root element follows the address when it changes inside the app', async () => {
    await renderPage(SUITE, { suite });
    expect(document.documentElement.dataset.fixture).toBeUndefined();
  });
});

describe('accuracy: the lists of differing files load when one is opened', () => {
  test('opening a list fetches the one file (a skeleton stands in), shows the lists, and a second list is instant', async () => {
    const user = userEvent.setup();
    const { container } = await renderPage('/comparison/accuracy');
    const closed = [...container.querySelectorAll('details')].filter(d => /different results|files/i.test(d.textContent ?? ''));
    expect(closed.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    const first = closed[0];
    await user.click(first.querySelector('summary')!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/data/comparison/accuracy/differences.json');
    await waitFor(() => expect(within(first).queryByRole('status')).toBeNull());
  });
});

describe('Sync islands mirror the address onto the root element', () => {
  test('report level and peers', async () => {
    visit('/report/?level=T3&peers=1');
    const { unmount } = await renderPage('/report');
    await waitFor(() => expect(document.documentElement.dataset.level).toBe('T3'));
    expect(document.documentElement.dataset.peers).toBe('1');
    unmount();
    expect(document.documentElement.dataset.level).toBeUndefined();
    expect(document.documentElement.dataset.peers).toBeUndefined();
  });

  test('report: an unknown level or peers value clears the attributes', async () => {
    visit('/report/?level=T9&peers=0');
    await renderPage('/report');
    await waitFor(() => expect(document.documentElement.dataset.level).toBeUndefined());
    expect(document.documentElement.dataset.peers).toBeUndefined();
  });

  test('runtime analysis, domain and view; unknown values fall back to the defaults', async () => {
    visit('/comparison/runtime/?analysis=external&domain=credentials&view=speed');
    const { unmount } = await renderPage('/comparison/runtime');
    await waitFor(() => expect(document.documentElement.dataset.view).toBe('speed'));
    expect(document.documentElement.dataset.analysis).toBe('external');
    expect(document.documentElement.dataset.domain).toBe('credentials');
    unmount();
    visit('/comparison/runtime/?analysis=x&domain=y&view=z');
    await renderPage('/comparison/runtime');
    await waitFor(() => expect(document.documentElement.dataset.view).toBeTruthy());
  });

  test('performance pair key and accuracy pair key', async () => {
    await renderPage('/comparison/performance');
    await waitFor(() => expect(document.documentElement.dataset.peer).toBeTruthy());
    expect(document.documentElement.dataset.setting).toBeTruthy();
    await renderPage('/comparison/accuracy');
    await waitFor(() => expect(document.documentElement.dataset.accKey).toBeTruthy());
  });
});

describe('feature comparison filter (?rows=)', () => {
  test('"Only differences" is kept in the address and narrows the table; Back restores all rows', async () => {
    const user = userEvent.setup();
    await renderPage('/comparison/feature');
    const rowCount = () => screen.getAllByRole('row').length;
    const all = rowCount();
    await user.click(await screen.findByRole('button', { name: 'Only differences' }));
    expect(search()).toBe('?rows=differences');
    expect(rowCount()).toBeLessThanOrEqual(all);
    visit('/comparison/feature/');
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true'));
    expect(rowCount()).toBe(all);
  });
});
