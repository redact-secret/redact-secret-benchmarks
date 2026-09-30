/**
 * The JSON files the build emits for the browser to fetch, and where they live.
 * Decision: docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md.
 *
 * Pure strings, no `fetch`: server code (resolvers, route handlers) names a file with
 * these builders, and the one client helper (`build-data.ts`) refuses any path that does
 * not match `BUILD_DATA_PATH`. A path is relative to `<basePath>/data/`, so the files
 * sit beside the pages in the export and nothing outside the app can be named.
 *
 *   rows/<kind>/<id>/rows.json        every row of a rows table that does not fit one page
 *   fixtures/<suite>/records.json     the records a suite's fixture pages are built from
 */
export type RowsKind = 'level' | 'family' | 'suite' | 'detector';
export const ROWS_KINDS: readonly RowsKind[] = ['level', 'family', 'suite', 'detector'];

/** Where the export serves the files, under the app's base path. */
export const DATA_DIR = 'data';

export const rowsDataPath = (kind: RowsKind, id: string): string => `rows/${kind}/${id}/rows.json`;
export const recordsDataPath = (suite: string): string => `fixtures/${suite}/records.json`;

/** The only paths the browser may request. An id is letters, digits, dot, underscore and hyphen. */
export const BUILD_DATA_PATH = /^(?:rows\/(?:level|family|suite|detector)\/[a-z0-9][a-z0-9._-]*\/rows|fixtures\/[a-z0-9][a-z0-9._-]*\/records)\.json$/i;
