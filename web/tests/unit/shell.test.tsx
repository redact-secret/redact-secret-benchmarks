/**
 * The app shell and the pieces around the pages: the root layout (document language, the theme
 * script that runs before first paint, the viewport and robots decisions), the chrome that connects
 * the pure header to the router, the 404 page, the route handlers that write the data files, and the
 * theme tokens. The pages themselves are in pages.test.tsx.
 */
import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import './next-mocks';
import { NOT_FOUND, visit } from './next-mocks';
import { AppChrome } from '../../app/AppChrome';
import RootLayout, { metadata, viewport } from '../../app/layout';
import NotFound from '../../app/not-found';
import Home from '../../app/page';
import { colorsFor } from '../../theme/tokens';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, theme } from '../../theme/theme';
import { failureText as dataFailure } from '../../app/report/dataFailure';
import { ROUTES } from '../../lib/routes';

const html = renderToStaticMarkup(await RootLayout({ children: <p>page body</p> }));

describe('root layout', () => {

  test('is an English document whose body holds the page and the theme script runs before it', () => {
    expect(html).toMatch(/^<html lang="en"/);
    expect(html).toContain('<p>page body</p>');
    // The saved or OS theme is applied by an inline script that comes before the content.
    expect(html.indexOf(THEME_STORAGE_KEY)).toBeGreaterThan(-1);
    expect(html.indexOf(THEME_STORAGE_KEY)).toBeLessThan(html.indexOf('page body'));
    expect(html).toContain(THEME_ATTRIBUTE);
  });

  test('is indexable (staging noindex is the host header, not the build) and asks for both colour schemes', () => {
    expect(metadata.robots).toBeUndefined();
    expect(metadata.icons).toEqual({ icon: '/favicon.svg' });
    expect(viewport).toMatchObject({ width: 'device-width', colorScheme: 'light dark' });
    expect(metadata.title).toMatchObject({ default: expect.stringContaining('Benchmarks'), template: expect.stringContaining('%s') });
  });
});

describe('AppChrome', () => {
  test('wraps the page in a header, the section navigation of the current section, a main landmark and a footer that disclaims', () => {
    visit('/report/families/');
    render(<AppChrome><p>content</p></AppChrome>);
    expect(screen.getByRole('main')).toHaveTextContent('content');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('does not assert product output');
    expect(within(screen.getByRole('navigation', { name: 'Footer' })).getAllByRole('link').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByRole('navigation').length).toBeGreaterThanOrEqual(1);
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current.length).toBeGreaterThan(0);
  });

  test('outside a section (the home page) there is no section navigation', () => {
    visit('/');
    render(<AppChrome><p>home</p></AppChrome>);
    expect(screen.queryByRole('navigation', { name: /section/i })).toBeNull();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  test('every route is reachable from the header', () => {
    visit('/comparison/');
    render(<AppChrome><p>x</p></AppChrome>);
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    for (const route of ROUTES.filter(r => r.href.startsWith('/comparison/'))) expect(links.some(h => h?.replace(/\/$/, '') === route.href.replace(/\/$/, '')), route.href).toBe(true);
  });
});

describe('pages around the routes', () => {
  test('the 404 page says nothing is recorded here and offers the three ways on', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    const links = screen.getAllByRole('link').map(a => a.textContent);
    expect(links).toEqual(expect.arrayContaining(['All families', 'All providers', 'Report']));
  });

  test('the root is the landing page: one h1, the three questions, the rules, and no redirect', async () => {
    render(await Home());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const questions = screen.getByRole('navigation', { name: 'What the benchmark answers' });
    expect(within(questions).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['/report', '/comparison/performance', '/evaluation'].map(h => expect.stringMatching(new RegExp(`^${h}/?$`))));
    expect(screen.getByRole('list', { name: 'The rules of the benchmark' })).toBeInTheDocument();
    expect(document.head.querySelector('meta[http-equiv="refresh"]')).toBeNull();
  });
});

describe('data route handlers', () => {
  test('rows: a known file is JSON; an unknown kind or id is a 404, not an empty 200', async () => {
    const { GET, generateStaticParams } = await import('../../app/data/rows/[kind]/[id]/rows.json/route');
    const params = await generateStaticParams();
    expect(params.length).toBeGreaterThan(5);
    const ok = await GET(new Request('http://x'), { params: Promise.resolve(params[0]) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('application/json');
    expect(Array.isArray(((await ok.json()) as { items: unknown[] }).items)).toBe(true);
    for (const bad of [{ kind: 'nothing', id: 'T1' }, { kind: 'level', id: 'T9' }]) {
      expect((await GET(new Request('http://x'), { params: Promise.resolve(bad) })).status).toBe(404);
    }
  });

  test('records: a suite file carries its records; an unknown suite is a 404', async () => {
    const { GET, generateStaticParams } = await import('../../app/data/fixtures/[suite]/records.json/route');
    const [first] = await generateStaticParams();
    const ok = await GET(new Request('http://x'), { params: Promise.resolve(first) });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { records: unknown[] }).records.length).toBeGreaterThan(0);
    expect((await GET(new Request('http://x'), { params: Promise.resolve({ suite: 'nope' }) })).status).toBe(404);
  });

  test('accuracy differences: one file for every pair', async () => {
    const { GET } = await import('../../app/data/comparison/accuracy/differences.json/route');
    const ok = await GET();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty('runId');
  });
});

describe('failure text', () => {
  test('says offline, invalid and unavailable differently, and only an invalid file asks for a reload', () => {
    const offline = dataFailure('offline', 'the rest of the rows', 'Still readable.');
    const invalid = dataFailure('invalid', 'this fixture', 'Still readable.');
    const other = dataFailure(undefined, 'the list', 'Still readable.');
    expect(offline).toMatchObject({ title: 'You are offline', retryLabel: 'Try again', reload: false });
    expect(offline.detail).toMatch(/^The rest of the rows will load when the connection is back/);
    expect(invalid).toMatchObject({ title: 'Could not use this fixture', retryLabel: 'Reload the page', reload: true });
    expect(other).toMatchObject({ title: 'Could not load the list', reload: false });
    for (const t of [offline, invalid, other]) expect(t.detail).toContain('Still readable.');
  });
});

describe('theme', () => {
  test('both colour schemes resolve every token reference to a colour', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const colors = colorsFor(scheme);
      expect(Object.keys(colors).length).toBeGreaterThan(10);
      for (const [name, value] of Object.entries(colors)) expect(value, `${scheme} ${name}`).not.toMatch(/^\{/);
    }
    expect(colorsFor('light')['ink']).not.toBe(colorsFor('dark')['ink']);
  });

  test('the MUI theme is limited to tokens and defaults: the theme attribute, no ripple, flat paper', () => {
    expect(THEME_ATTRIBUTE).toBe('data-theme');
    expect(THEME_STORAGE_KEY).toBe('redact-secret-benchmarks:theme');
    expect(theme.components?.MuiButtonBase?.defaultProps).toMatchObject({ disableRipple: true });
    expect(theme.components?.MuiPaper?.defaultProps).toMatchObject({ elevation: 0, square: true });
  });

  test('NOT_FOUND is the digest Next uses to render the 404 page', () => {
    expect(NOT_FOUND).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});

describe('token references', () => {
  test('a reference to a token that does not exist, or a chain that never ends, fails loudly instead of drawing a wrong colour', async () => {
    for (const tokens of [
      [{ name: 'a', value: { light: '{missing}', dark: '#000000' } }],
      [{ name: 'a', value: { light: '{b}', dark: '#000000' } }, { name: 'b', value: { light: '{a}', dark: '#000000' } }],
    ]) {
      vi.resetModules();
      vi.doMock('../../../src/tokens.json', () => ({ default: { color: { tokens } } }));
      const fresh = await import('../../theme/tokens');
      expect(() => fresh.colorsFor('light')).toThrow(/Unresolvable token reference/);
      expect(fresh.colorsFor('dark')).toBeTruthy();
      vi.doUnmock('../../../src/tokens.json');
    }
  });
});
