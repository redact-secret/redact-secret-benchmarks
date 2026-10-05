import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { callersOf, classify } from '../scripts/legacy-callers.mjs';

// Structure only: the caller lister classifies files, finds a static importer and a path mention, and every path the
// file-level inventory (#653) names still exists, so a rename or a removal cannot leave the inventory stale. No count and no
// measured value is asserted.

test('classify names the caller classes the inventory uses', () => {
  assert.equal(classify('package.json'), 'package hook');
  assert.equal(classify('.github/workflows/validate.yml'), 'workflow');
  assert.equal(classify('tests/accounting.test.mjs'), 'test');
  assert.equal(classify('web/scripts/check-export.mjs'), 'web script');
  assert.equal(classify('web/services/catalog.ts'), 'web (Next app)');
  assert.equal(classify('scripts/baseline.mjs'), 'script');
  assert.equal(classify('src/model.mjs'), 'src (legacy site)');
  assert.equal(classify('benchmarks/run.ts'), 'benchmarks');
});

test('callersOf finds a static importer and a package hook by path', () => {
  const importers = callersOf('benchmarks/qualification/authority.ts').map(c => c.file);
  assert.ok(importers.includes('web/services/authority.ts'), 'a static importer is found');
  const hooks = callersOf('scripts/check-qualification-authority.mjs').filter(c => c.class === 'package hook');
  assert.equal(hooks.length, 1);
  assert.deepEqual(callersOf('benchmarks/qualification/authority.ts').filter(c => c.file === 'scripts/legacy-callers.mjs'), []);
});

test('a directory target reports callers outside it only', () => {
  const callers = callersOf('benchmarks/qualification/');
  assert.ok(callers.length > 0);
  assert.ok(callers.every(c => !c.file.startsWith('benchmarks/qualification/')));
});

test('every repository path in the file-level inventory exists', () => {
  const doc = readFileSync(new URL('../docs/specs/qualification-cutover.md', import.meta.url), 'utf8');
  const start = doc.indexOf('## File-level inventory and cleanup order (#653)');
  assert.ok(start > 0, 'the inventory section exists');
  const rows = doc.slice(start).split('\n').filter(l => l.startsWith('| `'));
  assert.ok(rows.length > 0, 'the inventory has rows');
  for (const row of rows) {
    const first = row.split('|')[1];
    let dir = '';
    const grouped = !first.includes('(');
    for (const m of first.matchAll(/`([^`]+)`/g)) {
      let path = m[1].trim();
      if (!/\//.test(path) && !/\.[a-z]+$/.test(path)) continue;
      if (/[\s*,]/.test(path)) continue;
      // A grouped cell names the later files by name, next to the first one's directory.
      if (!path.includes('/') && (!dir || !grouped)) continue;
      if (!path.includes('/')) path = dir + path;
      else dir = path.slice(0, path.lastIndexOf('/') + 1);
      assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is named in the inventory and must exist (or the row must change)`);
    }
  }
});
