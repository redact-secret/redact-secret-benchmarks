import test from 'node:test';
import assert from 'node:assert/strict';
import { invocationGraph } from '../scripts/ci-invocations.mjs';

const file = (path, text) => ({ path, text, bytes: Buffer.from(text) });
const packageFile = (scripts, path = 'package.json') => file(path, JSON.stringify({ scripts }));
const has = (graph, from, to, kind) => graph.edges.some(edge => edge.from === from && edge.to === to && edge.kind === kind);

test('graph follows nested npm aliases, lifecycle hooks and literal subprocess argv', () => {
  const graph = invocationGraph([
    packageFile({ check: 'npm run lint && npm run -s child && npm run --silent quiet && npm run --if-present -s optional && npm run --unknown child && node scripts/check.mjs', precheck: 'node scripts/prepare.mjs', lint: 'node scripts/lint.mjs', child: 'node scripts/lint.mjs', quiet: 'node scripts/lint.mjs', optional: 'node scripts/lint.mjs', prepare: 'node scripts/prepare.mjs' }),
    file('scripts/check.mjs', "import './helper.mjs';\nspawnSync('npm', ['run', 'lint']);\nrun('npm', ['run', '-s', 'child']);\nrun('npm', ['run', '--silent', 'quiet']);\nrun('npm', ['run', '--if-present', '-s', 'optional']);\nrun('npm', ['run', '-s', dynamicName]);"), file('scripts/helper.mjs', 'export const x=1;'),
    file('scripts/lint.mjs', ''), file('scripts/prepare.mjs', ''),
    file('.github/workflows/check.yml', 'on: push\njobs:\n  check:\n    steps:\n      - run: npm ci\n      - run: npm run check\n'),
  ]);
  assert.ok(has(graph, 'npm:.:check', 'npm:.:lint', 'npm-run'));
  assert.ok(has(graph, 'npm:.:check', 'npm:.:precheck', 'npm-lifecycle'));
  assert.ok(has(graph, '.github/workflows/check.yml#check', 'npm:.:prepare', 'npm-install-lifecycle'));
  assert.ok(has(graph, 'scripts/check.mjs', 'scripts/helper.mjs', 'import'));
  assert.ok(has(graph, 'scripts/check.mjs', 'npm:.:lint', 'literal-subprocess-npm-argv'));
  for (const name of ['child', 'quiet', 'optional'])
    assert.ok(has(graph, 'scripts/check.mjs', `npm:.:${name}`, 'literal-subprocess-npm-argv'));
  for (const name of ['child', 'quiet', 'optional'])
    assert.ok(has(graph, 'npm:.:check', `npm:.:${name}`, 'npm-run'));
  assert.ok(!graph.edges.some(edge => edge.to === 'npm:.:-s' || edge.to === 'npm:.:--unknown'));
  assert.ok(graph.unresolved.some(item => item.source === 'npm:.:check' && item.kind === 'unresolved-npm-run-option'));
  assert.ok(graph.unresolved.some(item => item.source === 'scripts/check.mjs' && item.kind === 'computed-subprocess'));
});

test('workflow scope distinguishes web, self checkout prefixes, external repositories and computed commands', () => {
  const graph = invocationGraph([
    packageFile({ check: 'node scripts/check.mjs' }), packageFile({ build: 'next build' }, 'web/package.json'), file('scripts/check.mjs', ''),
    file('.github/workflows/manual.yml', `on:\n  workflow_dispatch:\njobs:\n  measure:\n    steps:\n      - uses: actions/checkout@pin\n        with: {path: benchmarks}\n      - uses: actions/checkout@pin\n        with: {repository: example/product, path: .product}\n      - run: npm run build\n        working-directory: benchmarks/web\n      - run: node benchmarks/scripts/check.mjs\n      - run: node scripts/foreign.mjs\n        working-directory: .product/subdir\n      - run: npm --prefix .product run build\n      - run: node .product/scripts/check.mjs\n      - run: npm run "$CHECK"\n`),
  ]);
  assert.ok(has(graph, '.github/workflows/manual.yml#measure', 'npm:web:build', 'npm-run'));
  assert.ok(has(graph, '.github/workflows/manual.yml#measure', 'scripts/check.mjs', 'script-execution'));
  assert.ok(!graph.edges.some(edge => edge.to.includes('foreign')));
  assert.ok(!graph.unresolved.some(row => row.kind.startsWith('missing-')));
  assert.ok(graph.unresolved.some(row => row.kind === 'computed-shell-command'));
  assert.equal(graph.workflows[0].manualOnly, true);
});

test('review flags distinguish duplicate aliases, one-off paths, test-only files and dead hooks', () => {
  const graph = invocationGraph([
    packageFile({ eval: 'node scripts/evaluate.mjs', discover: 'node scripts/evaluate.mjs', old: 'node scripts/old.mjs --input product-core-main-1234567/run.json', predeleted: 'node scripts/pre.mjs' }),
    file('scripts/evaluate.mjs', ''), file('scripts/old.mjs', ''), file('scripts/pre.mjs', ''), file('scripts/tested.mjs', ''), file('scripts/orphan.mjs', ''),
    file('tests/manual.test.mjs', "import '../scripts/tested.mjs';"), file('README.md', 'Manual tool: npm run eval'),
  ]);
  assert.deepEqual(graph.duplicateCommands, [['npm:.:eval', 'npm:.:discover']]);
  assert.ok(graph.findings.some(row => row.id === 'npm:.:old' && row.kind === 'versioned-one-off-command'));
  assert.ok(graph.findings.some(row => row.id === 'scripts/tested.mjs' && row.kind === 'test-only-script-caller'));
  assert.ok(graph.findings.some(row => row.id === 'scripts/orphan.mjs' && row.kind === 'no-resolved-script-caller'));
  assert.ok(graph.findings.some(row => row.id === 'npm:.:predeleted' && row.kind === 'manual-or-unreferenced-alias'));
  assert.ok(graph.findings.every(row => row.removalApproved === false));
});
