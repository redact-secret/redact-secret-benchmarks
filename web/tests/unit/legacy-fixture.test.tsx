// Old /fixture/<suite>--<id> links (#594). Synthetic suite and fixture ids only: no corpus value is asserted.
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { legacyFixtureTarget, parseLegacyFixturePath, parseSuiteLandingPath } from '../../lib/legacy-fixture';

describe('parseLegacyFixturePath', () => {
  test('splits at the first double hyphen, so a fixture id may contain one', () => {
    expect(parseLegacyFixturePath('/fixture/example-suite--alpha-1')).toEqual({ suite: 'example-suite', id: 'alpha-1' });
    expect(parseLegacyFixturePath('/fixture/example-suite--alpha--beta')).toEqual({ suite: 'example-suite', id: 'alpha--beta' });
    expect(parseLegacyFixturePath('/fixture/s--a.b_c-1/')).toEqual({ suite: 's', id: 'a.b_c-1' });
  });

  test('decodes one percent-encoded segment and reads the base path', () => {
    expect(parseLegacyFixturePath('/fixture/s%2D%2Dabc')).toEqual({ suite: 's', id: 'abc' });
    expect(parseLegacyFixturePath('/base/fixture/s--abc', '/base')).toEqual({ suite: 's', id: 'abc' });
    expect(parseLegacyFixturePath('/fixture/s--abc', '/base')).toBeUndefined();
  });

  test.each([
    '/fixture/', '/fixture/s', '/fixture/--abc', '/fixture/s--', '/fixture/S--abc', '/fixture/s_t--abc', '/fixture/s-t-', '/fixture/-s--abc',
    '/fixture/s--.abc', '/fixture/s--a%2Fb', '/fixture/s--a/b', '/fixture/s--a%20b', '/fixture/s--%E0%A4%A', '/fixture/s--a%00b',
    `/fixture/s--${'a'.repeat(201)}`, '/fixtures/s--abc', '/report/fixtures/s/', '/fixture/s--abc/extra',
  ])('refuses %j', path => {
    expect(parseLegacyFixturePath(path)).toBeUndefined();
  });

  test('accepts the longest id and nothing longer', () => {
    expect(parseLegacyFixturePath(`/fixture/s--${'a'.repeat(200)}`)?.id).toHaveLength(200);
  });
});

describe('parseSuiteLandingPath', () => {
  test('reads the suite and fixture id the host redirect carries', () => {
    expect(parseSuiteLandingPath('/report/fixtures/example-suite/', '?fixture=alpha-1')).toEqual({ suite: 'example-suite', id: 'alpha-1' });
    expect(parseSuiteLandingPath('/base/report/fixtures/s', '?fixture=a--b&x=1', '/base')).toEqual({ suite: 's', id: 'a--b' });
  });

  test.each([['/report/fixtures/s/', ''], ['/report/fixtures/s/', '?fixture='], ['/report/fixtures/S/', '?fixture=a'], ['/report/fixtures/s/x/', '?fixture=a'], ['/report/families/s/', '?fixture=a'], ['/report/fixtures/s/', '?fixture=a%2Fb']])('refuses %j %j', (path, search) => {
    expect(parseSuiteLandingPath(path, search)).toBeUndefined();
  });
});

describe('legacyFixtureTarget', () => {
  const ref = { suite: 'example-suite', id: 'alpha-1' };

  test('is the suite page with ?fixture=', () => {
    expect(legacyFixtureTarget(ref)).toBe('/report/fixtures/example-suite/?fixture=alpha-1');
    expect(legacyFixtureTarget({ suite: 's', id: 'a.b_c' }, '', '', '/base')).toBe('/base/report/fixtures/s/?fixture=a.b_c');
  });

  test('keeps the original query (not its own fixture) and the hash on purpose', () => {
    expect(legacyFixtureTarget(ref, '?show=leaked&fixture=other&q=a%20b', '#spans')).toBe('/report/fixtures/example-suite/?fixture=alpha-1&show=leaked&q=a+b#spans');
  });

  test('drops an empty or oversized hash and cannot leave the app', () => {
    expect(legacyFixtureTarget(ref, '', '#')).not.toContain('#');
    expect(legacyFixtureTarget(ref, '', `#${'x'.repeat(300)}`)).not.toContain('#');
    for (const hostile of ['?next=https://evil.example', '?a=//evil.example']) {
      expect(legacyFixtureTarget(ref, hostile, '#//evil.example').startsWith('/report/fixtures/example-suite/?fixture=alpha-1')).toBe(true);
    }
  });
});

// ---- the 404 page's island -------------------------------------------------------------------------

const records = (ids: string[]) => ({ records: ids.map(id => ({ id })), shared: {} });

describe('lookupLegacyFixture', () => {
  type Mod = typeof import('../../app/LegacyFixtureLookup');
  let mod: Mod;
  let build: typeof import('../../lib/build-data');
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../resolvers/fixtures', () => ({ isSuiteRecordsFile: (value: unknown) => typeof value === 'object' && value !== null && Array.isArray((value as { records?: unknown }).records) }));
    build = await import('../../lib/build-data');
    mod = await import('../../app/LegacyFixtureLookup');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.doUnmock('../../resolvers/fixtures');
    vi.unstubAllGlobals();
  });

  test('a fixture in the suite records is found, one request for the suite file', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(records(['alpha-1', 'beta'])), { status: 200 }));
    await expect(mod.lookupLegacyFixture({ suite: 'example-suite', id: 'alpha-1' })).resolves.toBe('found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/data/fixtures/example-suite/records.json');
    await expect(mod.lookupLegacyFixture({ suite: 'example-suite', id: 'gamma' })).resolves.toBe('unknown-fixture');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('a suite the host does not have is unknown; a failure to check is not a verdict', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(mod.lookupLegacyFixture({ suite: 'no-such-suite', id: 'x' })).resolves.toBe('unknown-suite');
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(mod.lookupLegacyFixture({ suite: 'other-suite', id: 'x' })).resolves.toBe('unchecked');
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(mod.lookupLegacyFixture({ suite: 'third-suite', id: 'x' })).resolves.toBe('unchecked');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(mod.lookupLegacyFixture({ suite: 'fourth-suite', id: 'x' })).resolves.toBe('unchecked');
    expect(build.BuildDataError).toBeDefined();
  });

  test('a path that is not a legacy fixture link renders the ordinary 404 and requests nothing', async () => {
    window.history.replaceState(null, '', '/report/families/no-such--thing/');
    render(<mod.LegacyFixtureLookup><p>ordinary not found</p></mod.LegacyFixtureLookup>);
    expect(screen.getByText('ordinary not found')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a legacy link to an unknown fixture says what it looked for and links to the suite', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(records(['alpha-1'])), { status: 200 }));
    window.history.replaceState(null, '', '/fixture/example-suite--missing-id');
    render(<mod.LegacyFixtureLookup><p>ordinary not found</p></mod.LegacyFixtureLookup>);
    await waitFor(() => expect(screen.getByText('No fixture “missing-id” in the suite example-suite')).toBeTruthy());
    expect(screen.queryByText('ordinary not found')).toBeNull();
    expect(screen.getByRole('link', { name: 'Fixtures in example-suite' }).getAttribute('href')).toMatch(/^\/report\/fixtures\/example-suite\/?$/);
  });

  test('a legacy link to an unknown suite points to the suite list', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    window.history.replaceState(null, '', '/fixture/no-such-suite--abc');
    render(<mod.LegacyFixtureLookup />);
    await waitFor(() => expect(screen.getByText('No suite “no-such-suite”')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'All suites' }).getAttribute('href')).toMatch(/^\/report\/fixtures\/?$/);
  });

  test('the host redirect landing on a suite this export does not have is explained without a request', async () => {
    window.history.replaceState(null, '', '/report/fixtures/old-corpus/?fixture=abc');
    render(<mod.LegacyFixtureLookup><p>ordinary not found</p></mod.LegacyFixtureLookup>);
    await waitFor(() => expect(screen.getByText('No suite “old-corpus”')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a known fixture is replaced by its suite page with the query and hash kept', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(records(['alpha-1'])), { status: 200 }));
    const replace = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/fixture/example-suite--alpha-1', search: '?show=leaked', hash: '#spans', replace } });
    try {
      render(<mod.LegacyFixtureLookup />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/report/fixtures/example-suite/?fixture=alpha-1&show=leaked#spans'));
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
