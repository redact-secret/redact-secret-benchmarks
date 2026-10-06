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

// The inventory is a checked document (#660): its callers equal the tree, every row carries the four things a removal PR needs, and a stale or incomplete
// row is refused. Structure only: no count and no measured value is asserted.
import { DISPOSITIONS, inventoryProblems, parseInventory, trackedFiles } from '../scripts/legacy-inventory.mjs';

const inventoryDoc = () => readFileSync(new URL('../docs/specs/qualification-cutover.md', import.meta.url), 'utf8');

test('the committed inventory equals the tree: current callers, no empty cell, every legacy file has a row', () => {
  assert.deepEqual(inventoryProblems(inventoryDoc(), trackedFiles()), []);
});

test('every inventory row names an owner, a defined disposition, callers and a removal prerequisite', () => {
  const { rows } = parseInventory(inventoryDoc());
  assert.ok(rows.length > 50);
  for (const row of rows) {
    assert.equal(row.cells.length, 6, row.line.slice(0, 80));
    const [, owner, disposition, callers, , prerequisite] = row.cells;
    assert.ok(owner && callers && prerequisite, row.cells[0]);
    if (row.path) assert.ok(DISPOSITIONS.has(disposition), `${row.path}: ${disposition}`);
  }
});

test('a stale callers cell, an empty prerequisite, an unknown disposition and a missing row are each refused', () => {
  const doc = inventoryDoc();
  const row = parseInventory(doc).rows.find(r => r.path === 'benchmarks/evaluation/domains/credential/runner.ts');
  assert.ok(row);
  const tamper = (mutate) => doc.replace(row.line, mutate(row.cells));
  const stale = tamper(c => `| ${[c[0], c[1], c[2], '`scripts/not-a-caller.mjs`', c[4], c[5]].join(' | ')} |`);
  assert.ok(inventoryProblems(stale, []).some(p => p.startsWith('benchmarks/evaluation/domains/credential/runner.ts: callers are stale')));
  const empty = tamper(c => `| ${[c[0], c[1], c[2], c[3], c[4], ''].join(' | ')} |`);
  assert.ok(inventoryProblems(empty, []).some(p => p.includes('the removal prerequisite cell is empty')));
  const unknown = tamper(c => `| ${[c[0], c[1], 'delete-it', c[3], c[4], c[5]].join(' | ')} |`);
  assert.ok(inventoryProblems(unknown, []).some(p => p.includes('"delete-it" is not one of')));
  assert.ok(inventoryProblems(doc, [...trackedFiles(), 'benchmarks/evaluation/domains/credential/not-in-the-inventory.ts']).some(p => p === 'benchmarks/evaluation/domains/credential/not-in-the-inventory.ts: has no row in the inventory'));
});

test('the re-key derivation reads the frozen legacy review queue and reaches no part of the legacy engine (#660)', () => {
  for (const file of ['benchmarks/qualification/derived-inputs.ts', 'benchmarks/qualification/legacy-review.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /engine\/|credential\/contract|peer-observations|runEvaluation/, file);
  }
  assert.equal(callersOf('benchmarks/evaluation/domains/credential/runner.ts').some(c => c.file === 'benchmarks/qualification/legacy-review.ts'), false);
});

test('the protected holdouts import neither the credential methods nor the operators', () => {
  for (const file of ['benchmarks/evaluation/domains/credential/holdout.ts', 'benchmarks/evaluation/domains/credential-policy/holdout.ts', 'benchmarks/evaluation/domains/credential/holdout-corpus.ts', 'benchmarks/evaluation/domains/credential-policy/holdout-corpus.ts']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:\/methods\/|\/operators\/|engine\/runner)/, file);
  }
});
