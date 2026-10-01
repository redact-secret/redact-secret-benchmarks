import { describe, expect, test } from 'vitest';
import { cx } from '../../lib/cx';
import { ACCURACY_DIFFERENCES_PATH, BUILD_DATA_PATH, DATA_DIR, ROWS_KINDS, recordsDataPath, rowsDataPath } from '../../lib/data-paths';
import { ROUTES, SECTIONS, normalizePath, sectionFor } from '../../lib/routes';

describe('cx', () => {
  test('joins class names and skips everything falsy', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
    expect(cx()).toBe('');
  });
});

describe('routes', () => {
  test('Report and Comparison come first, Evaluation is an entrance too, and every entry is under its section href', () => {
    const labels = SECTIONS.map(s => s.label);
    expect(labels.slice(0, 2)).toEqual(['Report', 'Comparison']);
    expect(labels).toContain('Evaluation');
    expect(ROUTES.length).toBeGreaterThanOrEqual(10);
    for (const section of SECTIONS) for (const entry of section.entries) expect(entry.href.startsWith(section.href)).toBe(true);
    expect(new Set(ROUTES.map(r => r.href)).size).toBe(ROUTES.length);
  });

  test.each([
    ['/report', '/report/'],
    ['/report/', '/report/'],
    ['/report/?level=T2', '/report/'],
    ['/report/families#x', '/report/families/'],
    ['', '/'],
  ])('normalizePath(%j) = %j', (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  test('sectionFor finds the section of a page, and none for the home page', () => {
    expect(sectionFor('/report/families/github-pat')?.label).toBe('Report');
    expect(sectionFor('/comparison/runtime/?view=speed')?.label).toBe('Comparison');
    expect(sectionFor('/evaluation/method/twin/')?.label).toBe('Evaluation');
    expect(sectionFor('/')).toBeUndefined();
    expect(sectionFor('/other/')).toBeUndefined();
  });
});

describe('data paths', () => {
  test('the builders produce paths the browser may request', () => {
    expect(DATA_DIR).toBe('data');
    for (const kind of ROWS_KINDS) expect(BUILD_DATA_PATH.test(rowsDataPath(kind, 'a-b.c_d'))).toBe(true);
    expect(BUILD_DATA_PATH.test(recordsDataPath('example-suite'))).toBe(true);
    expect(BUILD_DATA_PATH.test(ACCURACY_DIFFERENCES_PATH)).toBe(true);
  });

  test.each(['rows/level/../x/rows.json', 'rows/level//rows.json', 'rows/level/-a/rows.json', 'rows/level/a/rows.json/extra', 'http://x/rows/level/a/rows.json', 'fixtures/a b/records.json'])('rejects %j', path => {
    expect(BUILD_DATA_PATH.test(path)).toBe(false);
  });
});
