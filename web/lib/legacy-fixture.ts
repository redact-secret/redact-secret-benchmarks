/**
 * The address of a fixture on the legacy site, `/fixture/<suite>--<id>`, and the page that replaced it, `/report/corpus/<suite>/?fixture=<id>` (#594).
 * Pure strings, no `window`, no `fetch`: `LegacyFixtureLookup` (the client island on the 404 page) reads the location and calls these, and the
 * unit test calls them with synthetic addresses. Decision: `docs/decisions/2026-10-07-resolve-legacy-fixture-links-on-the-not-found-page.md`.
 *
 * - The slug splits at the FIRST `--`: a suite id never contains `--`, a fixture id may.
 * - A suite id is lowercase words joined by single hyphens; a fixture id is letters, digits, dot, underscore and hyphen, at most 200 characters, and starts with a
 *   letter or digit. Both are the characters `lib/data-paths.ts` already allows in a build-emitted file name, so a mapped address can name nothing else.
 * - The query is carried over except `fixture` (the target owns it) and the hash is kept as written: a reader who followed `/fixture/x--y?show=leaked#spans`
 *   lands on the suite page with the same `show` and `#spans`. Nothing else of the original address is trusted: the target is always root-relative and begins
 *   `/report/corpus/`, so no address can send a reader to another origin.
 */
export interface LegacyFixtureRef { suite: string; id: string }

const SUITE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIXTURE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const LEGACY_PREFIX = '/fixture/';
const MAX_HASH = 256;

/** `/fixture/<suite>--<id>` (with or without a trailing slash, under the base path) as a suite and a fixture id, or `undefined` when it is not a well-formed legacy address. */
export function parseLegacyFixturePath(pathname: string, basePath = ''): LegacyFixtureRef | undefined {
  if (basePath && !pathname.startsWith(`${basePath}/`)) return undefined;
  const rest = basePath ? pathname.slice(basePath.length) : pathname;
  if (!rest.startsWith(LEGACY_PREFIX)) return undefined;
  let slug = rest.slice(LEGACY_PREFIX.length);
  if (slug.endsWith('/')) slug = slug.slice(0, -1);
  let decoded: string;
  try { decoded = decodeURIComponent(slug); } catch { return undefined; }
  const cut = decoded.indexOf('--');
  if (cut < 1) return undefined;
  const suite = decoded.slice(0, cut);
  const id = decoded.slice(cut + 2);
  if (!SUITE.test(suite) || !FIXTURE_ID.test(id)) return undefined;
  return { suite, id };
}

/**
 * The address the host's own redirect (`benchmarks/legacy-url-redirects.json`, rule `fixture`) sends an old link to: `/report/corpus/<suite>/?fixture=<id>`.
 * It reaches the 404 page when that suite is not a page of this export, and then carries the same suite and fixture id the old slug did.
 */
export function parseSuiteLandingPath(pathname: string, search: string, basePath = ''): LegacyFixtureRef | undefined {
  const prefix = [`${basePath}/report/corpus/`, `${basePath}/report/fixtures/`].find(p => pathname.startsWith(p));
  if (!prefix) return undefined;
  const suite = pathname.slice(prefix.length).replace(/\/$/, '');
  const id = new URLSearchParams(search).get('fixture') ?? '';
  return SUITE.test(suite) && FIXTURE_ID.test(id) ? { suite, id } : undefined;
}

/** The suite page that opens the fixture, with the original query (minus `fixture`) and hash carried over. */
export function legacyFixtureTarget(ref: LegacyFixtureRef, search = '', hash = '', basePath = ''): string {
  const carried = new URLSearchParams(search);
  carried.delete('fixture');
  const query = new URLSearchParams({ fixture: ref.id });
  carried.forEach((value, key) => query.append(key, value));
  const fragment = hash.startsWith('#') && hash.length > 1 && hash.length <= MAX_HASH ? hash : '';
  return `${basePath}/report/corpus/${ref.suite}/?${query.toString()}${fragment}`;
}
