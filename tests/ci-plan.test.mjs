import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inputFiles, keyOf, planChecks, routeOfPage, selectBrowserChecks } from '../scripts/ci-plan.mjs';

// Structure of the changed-path dependency map (#655, #656). Synthetic file lists and a synthetic import graph: nothing here reads a ledger, a
// run or a count from the corpus.

const pr = (files, importers) => planChecks({ files, event: 'pull_request', importers });

// A tiny import graph: a primitive used by two blocks, one block per page, and the shell used by the layout.
const graph = {
  'web/components/data/Tile.tsx': ['web/components/data/Tile.stories.tsx', 'web/components/report/Table.tsx', 'web/components/qualification/Card.tsx', 'web/components/shell/Chrome.tsx'],
  'web/components/data/Tile.module.css': ['web/components/data/Tile.tsx'],
  'web/components/report/Table.tsx': ['web/components/report/Table.stories.tsx', 'web/app/report/page.tsx'],
  'web/components/qualification/Card.tsx': ['web/components/qualification/Card.stories.tsx', 'web/app/evaluation/qualification/[family]/page.tsx'],
  'web/components/shell/Chrome.tsx': ['web/app/layout.tsx'],
  'web/components/leaf/Leaf.tsx': ['web/components/leaf/Leaf.stories.tsx'],
  'web/app/report/RowsView.tsx': ['web/app/report/page.tsx', 'web/app/report/families/page.tsx'],
};
const importers = f => graph[f] ?? [];

test('a push, a schedule and a dispatch run everything', () => {
  for (const event of ['push', 'schedule', 'workflow_dispatch']) {
    const plan = planChecks({ files: ['docs/x.md'], event });
    assert.deepEqual([plan.legacy, plan.web, plan.browser, plan.webScope], [true, true, true, 'full'], event);
  }
});

test('an empty or unlistable change runs everything (the plan fails closed)', () => {
  const plan = pr([]);
  assert.deepEqual([plan.legacy, plan.web, plan.webScope], [true, true, 'full']);
});

test('prose and root unit tests alone select no legacy measurement and no site build', () => {
  const plan = pr(['docs/specs/anything.md', 'docs/decisions/x.md', 'README.md', 'tests/some.test.mjs', '.github/workflows/publish-site.yml']);
  assert.deepEqual([plan.legacy, plan.web, plan.browser, plan.webScope], [false, false, false, 'none']);
});

test('a UI-only change runs no legacy measurement', () => {
  const plan = pr(['web/components/leaf/Leaf.tsx'], importers);
  assert.equal(plan.legacy, false);
  assert.equal(plan.web, true);
});

test('docs the site reads are not prose-only', () => {
  assert.equal(pr(['docs/specs/qualification/engine-v1.json']).web, true);
  assert.equal(pr(['docs/generated/evidence-adoption/x.json']).web, true);
  assert.equal(pr(['docs/generated/evidence-adoption/x.json']).legacy, false);
});

test('every input of the legacy measurement selects it, and the new path alone does not', () => {
  for (const f of ['benchmarks/evaluation/domains/credential/runner.ts', 'benchmarks/scoring/lattice.ts', 'benchmarks/support/status.ts', 'benchmarks/known-gaps.json', 'benchmarks/review-ledger.json', 'benchmarks/run.ts',
    'scanners/candidate.mjs', 'corpora/regression/manifest.json', 'fixtures/x.mjs', 'peer-observations/comparison/x.json', 'qualification/suite-v1.json', 'scripts/generate-fixtures.mjs', 'src/model.mjs']) {
    assert.equal(pr([f]).legacy, true, f);
  }
  for (const f of ['benchmarks/qualification/adapter.ts', 'benchmarks/official-runs.json', 'benchmarks/qualification-inputs.json', 'scripts/build-qualification-view.ts', 'scripts/official-run-archive.mjs']) {
    const plan = pr([f]);
    assert.equal(plan.legacy, false, f);
    assert.equal(plan.web, true, `${f} changes the view the site is built from`);
    assert.equal(plan.webScope, 'full', f);
  }
});

test('workflows, lockfiles, schemas and the plan itself select everything', () => {
  for (const f of ['.github/workflows/validate.yml', '.github/workflows/legacy-oracle.yml', '.github/actions/view/action.yml', 'package.json', 'package-lock.json', 'web/package-lock.json', 'tsconfig.json', 'schemas/x.json', 'scripts/ci-plan.mjs']) {
    const plan = pr([f], importers);
    assert.deepEqual([plan.legacy, plan.web, plan.webScope], [true, true, 'full'], f);
  }
});

test('a path the map does not know runs everything', () => {
  const plan = pr(['somewhere-new/file.txt']);
  assert.deepEqual([plan.legacy, plan.web, plan.webScope], [true, true, 'full']);
  assert.ok(plan.reasons.web[0].includes('not in the dependency map'));
});

test('shared web inputs are the full browser suite', () => {
  for (const f of ['web/theme/measures.css', 'web/lib/routes.ts', 'web/resolvers/pages.ts', 'web/services/catalog.ts', 'web/app/layout.tsx', 'web/app/globals.css', 'web/app/data/x/route.ts', 'web/playwright.config.ts',
    'web/tests/e2e/fixtures.ts', 'web/.storybook/preview.tsx', 'web/next.config.mjs', 'web/scripts/check-layout.mjs']) {
    const plan = pr([f], importers);
    assert.equal(plan.webScope, 'full', f);
    assert.equal(plan.layout, null, f);
  }
});

test('data the pages are built from is the full browser suite, not a selection', () => {
  const plan = pr(['web/components/leaf/Leaf.tsx', 'benchmarks/support/taxonomy.json'], importers);
  assert.equal(plan.webScope, 'full');
});

test('a component selects its own stories and the routes of every page that reaches it', () => {
  const plan = pr(['web/components/report/Table.tsx'], importers);
  assert.equal(plan.webScope, 'selected');
  assert.deepEqual(plan.layout.routes, ['report']);
  assert.deepEqual(plan.layout.stories, ['./components/report/Table.stories.tsx']);
});

test('a primitive reaches the blocks that use it, their pages and their stories, through a stylesheet too', () => {
  const plan = pr(['web/components/data/Tile.module.css'], importers);
  assert.equal(plan.webScope, 'full', 'the shell uses it and the layout renders the shell');
  const leaf = selectBrowserChecks(['web/components/leaf/Leaf.tsx'], importers);
  assert.deepEqual(leaf, { full: false, routes: [], stories: ['./components/leaf/Leaf.stories.tsx'], reasons: leaf.reasons });
});

test('a route file selects the pages that import it, and a dynamic segment selects the pages below it', () => {
  const sel = selectBrowserChecks(['web/app/report/RowsView.tsx'], importers);
  assert.deepEqual(sel.routes, ['report', 'report/families']);
  assert.equal(routeOfPage('web/app/evaluation/qualification/[family]/page.tsx'), 'evaluation/qualification/*');
  assert.equal(routeOfPage('web/app/[slug]/page.tsx'), '*');
  assert.equal(routeOfPage('web/app/(group)/a/b/page.tsx'), 'a/b');
  assert.equal(routeOfPage('web/app/page.tsx'), '');
});

test('a unit test alone needs no browser, and a selection with nothing to render skips the browser jobs', () => {
  const plan = pr(['web/tests/unit/x.test.tsx'], importers);
  assert.deepEqual([plan.web, plan.browser, plan.webScope], [true, false, 'selected']);
});

test('the full suite is requested for any change a selection cannot bound', () => {
  const plan = pr(['web/components/leaf/Leaf.tsx', 'web/lib/routes.ts'], importers);
  assert.equal(plan.webScope, 'full');
});

test('the cache keys follow their inputs: equal bytes, equal key, and only the inputs of that result change it', () => {
  const tracked = ['package.json', 'package-lock.json', '.github/workflows/validate.yml', 'benchmarks/evaluation/domains/credential/runner.ts', 'benchmarks/qualification/adapter.ts', 'web/components/x/X.tsx', 'docs/specs/a.md', 'scanners/x.mjs'];
  const bytes = { 'benchmarks/evaluation/domains/credential/runner.ts': 'a', 'benchmarks/qualification/adapter.ts': 'b', 'web/components/x/X.tsx': 'c', 'docs/specs/a.md': 'd', 'scanners/x.mjs': 'e' };
  const keys = (change = {}) => { const read = f => Buffer.from({ ...bytes, ...change }[f] ?? 'same'); return { legacy: keyOf('legacy', tracked, read), view: keyOf('view', tracked, read) }; };
  const base = keys();
  assert.deepEqual(keys(), base);
  assert.deepEqual(keys({ 'web/components/x/X.tsx': 'changed' }), base, 'a UI change re-measures nothing');
  assert.deepEqual(keys({ 'docs/specs/a.md': 'changed' }), base, 'prose re-measures nothing');
  assert.notEqual(keys({ 'benchmarks/evaluation/domains/credential/runner.ts': 'changed' }).legacy, base.legacy);
  assert.notEqual(keys({ 'benchmarks/evaluation/domains/credential/runner.ts': 'changed' }).view, base.view, 'the view is built from the benchmark inputs too');
  assert.equal(keys({ 'benchmarks/qualification/adapter.ts': 'changed' }).legacy, base.legacy, 'the new path alone does not re-measure the legacy results');
  assert.notEqual(keys({ 'benchmarks/qualification/adapter.ts': 'changed' }).view, base.view);
  assert.notEqual(keys({ 'package-lock.json': 'changed' }).legacy, base.legacy);
  assert.notEqual(keys({ '.github/workflows/validate.yml': 'changed' }).view, base.view, 'a changed producer step rebuilds');
  assert.deepEqual(inputFiles('view', tracked), ['.github/workflows/validate.yml', 'benchmarks/qualification/adapter.ts', 'benchmarks/evaluation/domains/credential/runner.ts', 'package-lock.json', 'package.json', 'scanners/x.mjs'].sort());
});

test('validate.yml takes its flags from the plan and accepts a skipped job only when the plan did not select it', async () => {
  const yml = await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  assert.match(yml, /node scripts\/ci-plan\.mjs --event "\$GITHUB_EVENT_NAME"/);
  assert.doesNotMatch(yml, /pull_request_target/);
  assert.match(yml, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(yml, /push:\s*\n\s*branches: \[develop, main\]/);
  assert.match(yml, /schedule:/);
  assert.match(yml, /workflow_dispatch:/);
  const gate = yml.slice(yml.indexOf('  validate:'), yml.indexOf('  changes:'));
  for (const job of ['changes', 'validate-sources', 'unit-tests', 'legacy-oracle', 'legacy-results', 'view', 'web-build', 'web-unit', 'web-browser']) assert.match(gate, new RegExp(`needs\\.${job}\\.result`), `${job} is judged by the gate`);
  // Only success passes, or a skip of a job the plan did not select; a failure, a cancellation or a missing plan never does.
  assert.match(gate, /\[ "\$2" = success \]/);
  assert.match(gate, /\[ "\$2" = skipped \] && \[ "\$3" = false \]/);
  assert.doesNotMatch(gate, /cancelled|failure\)/);
});

test('the browser checks run on the export built from the view, and the view is fetched from the registry-checked archive', async () => {
  const yml = await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const view = yml.slice(yml.indexOf('  view:'), yml.indexOf('  web-build:'));
  assert.match(view, /npm run official-runs:check -- --bindings/);
  assert.match(view, /node scripts\/official-run-archive\.mjs fetch/);
  assert.match(view, /npm run qualification:view/);
  assert.doesNotMatch(view, /secrets\./);
  const browser = yml.slice(yml.indexOf('  web-browser:'), yml.indexOf('  pin-drift:'));
  assert.match(browser, /WEB_REQUIRE_QUALIFICATION: '1'/);
  assert.match(browser, /name: qualification-view/);
  assert.doesNotMatch(browser, /with-authority/, 'the committed authority is what the browser checks');
  const build = yml.slice(yml.indexOf('  web-build:'), yml.indexOf('  web-unit:'));
  assert.match(build, /with-authority\.mjs legacy -- sh -c 'npm run build && npm run check:routes'/, 'the rollback state is still built and recounted');
  assert.match(build, /WEB_REQUIRE_QUALIFICATION: '1'/);
});

test('the legacy oracle is an explicit workflow with no secret and nothing but contents: read', async () => {
  const yml = await readFile(new URL('../.github/workflows/legacy-oracle.yml', import.meta.url), 'utf8');
  assert.match(yml, /workflow_call:/);
  assert.match(yml, /workflow_dispatch:/);
  assert.doesNotMatch(yml, /pull_request_target|secrets\.|id-token|contents: write/);
  for (const step of ['npm run eval -- --scanner=redact-secret', 'npm run eval:classify', 'npm run queue:check', 'npm run bench -- --strict', 'with-authority.mjs legacy']) assert.ok(yml.includes(step), `${step} stays in the oracle`);
  const routine = await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  for (const step of ['npm run eval:classify', 'npm run queue:check', 'npm run bench -- --strict', 'npm run eval -- --scanner=redact-secret']) assert.ok(!routine.includes(step), `${step} is not on the routine path`);
});
