import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { spawnSync } from 'node:child_process';
import { inputFiles, keyOf, planChecks, routeOfPage, selectBrowserChecks } from '../scripts/ci-plan.mjs';
import { importersOf } from '../scripts/legacy-callers.mjs';

// Structure of the changed-path dependency map (#655, #656). Synthetic file lists and a synthetic import graph: nothing here reads a ledger, a
// run or a count from the corpus.

const pr = (files, importers) => planChecks({ files, event: 'pull_request', importers });

// Interpret only the boolean/string subset used by job gates, with no executable evaluation.
function conditionOf(expression) {
  const source = expression.replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g, '');
  const tokens = [];
  let rest = source.trim();
  while (rest) {
    const token = /^(?:&&|\|\||==|!=|[()]|'[^']*'|[A-Za-z_][A-Za-z0-9_.-]*)/.exec(rest)?.[0];
    assert.ok(token, `unsupported condition syntax: ${rest}`);
    tokens.push(token);
    rest = rest.slice(token.length).trimStart();
  }
  let index = 0;
  const atom = () => {
    const token = tokens[index++];
    if (token === '(') {
      const result = or();
      assert.equal(tokens[index++], ')');
      return result;
    }
    if (token === 'always') {
      assert.equal(tokens[index++], '(');
      assert.equal(tokens[index++], ')');
      return () => true;
    }
    if (token?.startsWith("'")) return () => token.slice(1, -1);
    if (token === 'true' || token === 'false') return () => token === 'true';
    assert.match(token ?? '', /^(?:needs|inputs)\.[A-Za-z0-9_.-]+$/);
    return context => token.split('.').reduce((value, key) => value?.[key], context);
  };
  const comparison = () => {
    const left = atom();
    const operator = tokens[index];
    if (!['==', '!='].includes(operator)) return left;
    index++;
    const right = atom();
    return context => operator === '==' ? left(context) === right(context) : left(context) !== right(context);
  };
  const and = () => {
    let result = comparison();
    while (tokens[index] === '&&') {
      index++;
      const left = result, right = comparison();
      result = context => left(context) && right(context);
    }
    return result;
  };
  const or = () => {
    let result = and();
    while (tokens[index] === '||') {
      index++;
      const left = result, right = and();
      result = context => left(context) || right(context);
    }
    return result;
  };
  const result = or();
  assert.equal(index, tokens.length, 'the complete condition must be interpreted');
  return result;
}

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
  const plan = pr(['docs/specs/anything.md', 'docs/decisions/x.md', 'README.md', 'tests/some.test.mjs', '.github/workflows/scorecard.yml']);
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
  for (const f of ['benchmarks/qualification/adapter.ts', 'benchmarks/official-runs.json', 'benchmarks/qualification-inputs.json', 'scripts/build-qualification-view.ts', 'scripts/official-run-archive.mjs', 'scripts/research-projection.mjs', 'benchmarks/support/research-projection.mjs', 'benchmarks/support/research-projection.json']) {
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

const fixtureMetadataPaths = ['scripts/evidence-case-metadata.mjs', 'benchmarks/evidence-case-metadata.json', 'benchmarks/fixture-descriptions.json', 'benchmarks/lib/fixture-metadata.ts'];

test('fixture metadata alone keeps the full site validation and changes only the view cache key', () => {
  for (const f of fixtureMetadataPaths) {
    const plan = pr([f]);
    assert.deepEqual([plan.legacy, plan.web, plan.browser, plan.webScope], [false, true, true, 'full'], f);
    const tracked = [...fixtureMetadataPaths, 'benchmarks/run.ts'];
    const read = changed => path => Buffer.from(path === changed ? 'changed' : 'same');
    assert.equal(keyOf('legacy', tracked, read(f)), keyOf('legacy', tracked, read()), `${f} cannot re-key a measurement`);
    assert.notEqual(keyOf('view', tracked, read(f)), keyOf('view', tracked, read()), `${f} rebuilds the display data`);
    assert.equal(pr([f, 'benchmarks/registry.json']).legacy, true, 'a mixed change still measures');
  }
  for (const f of ['scripts/evidence-case-metadata-extra.mjs', 'scripts/evidence-case-metadata.mjs.bak', 'benchmarks/evidence-case-metadata.json.bak', 'benchmarks/fixture-descriptions-extra.json', 'benchmarks/lib/fixture-metadata-measure.ts']) {
    assert.equal(pr([f]).legacy, true, `${f} is not a display-only exemption`);
  }
});

test('fixture metadata importers are confined to display services, the projection script and tests', () => {
  const allowed = new Set(['scripts/evidence-case-metadata.mjs', 'tests/fixture-metadata.test.mjs', 'web/services/catalog.ts', 'web/services/credential-bridge.ts', 'web/services/credential-source.ts']);
  for (const importer of importersOf('benchmarks/lib/fixture-metadata.ts')) assert.ok(allowed.has(importer), `${importer} needs a CI dependency review before consuming fixture metadata`);
  assert.deepEqual(importersOf('scripts/evidence-case-metadata.mjs'), [], 'the display projection is not imported by measurement tooling');
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

test('shared design tokens invalidate legacy and current exports and both cached data input sets', () => {
  for (const file of ['shared/design-tokens/tokens.css', 'shared/design-tokens/tokens.json', 'benchmarks/consumer/credential-metrics.ts', 'benchmarks/shared/statistical-primitives.ts']) {
    const plan = pr([file]);
    assert.equal(plan.legacy, true);
    assert.equal(plan.web, true);
    assert.equal(plan.browser, true);
    assert.equal(plan.webScope, 'full');
    for (const kind of ['legacy', 'view']) {
      assert.deepEqual(inputFiles(kind, [file]), [file]);
      assert.notEqual(keyOf(kind, [file], () => 'old'), keyOf(kind, [file], () => 'new'));
    }
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
  const units = yml.slice(yml.indexOf('  unit-tests:'), yml.indexOf('  validate-sources:'));
  const sources = yml.slice(yml.indexOf('  validate-sources:'), yml.indexOf('  legacy-oracle:'));
  assert.doesNotMatch(units, /^\s+if:/m, 'root unit tests cannot be skipped by the changed-path plan');
  assert.doesNotMatch(sources, /^\s+if:/m, 'source validation cannot be skipped by the changed-path plan');
  for (const command of ['npm run fixture-metadata:check', 'npm run research:check']) assert.ok(sources.includes(command), `${command} always validates display metadata`);
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

test('legacy report reuse is same-run, optional and cannot hide a selected producer failure', async () => {
  const routine = parse(await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8'));
  const oracle = parse(await readFile(new URL('../.github/workflows/legacy-oracle.yml', import.meta.url), 'utf8'));
  const caller = routine.jobs['legacy-oracle'];
  assert.deepEqual(caller.needs, ['changes', 'legacy-results']);
  const selected = conditionOf(caller.if);
  const reuse = conditionOf(caller.with['reuse-legacy-results']);
  for (const producer of ['success', 'skipped', 'failure', 'cancelled', undefined]) {
    for (const web of ['true', 'false', undefined]) {
      const needs = { changes: { result: 'success', outputs: { legacy: 'true', web } }, 'legacy-results': { result: producer } };
      const expected = producer === 'success' || (web === 'false' && producer === 'skipped');
      assert.equal(selected({ needs }), expected, `producer=${producer}, web=${web}`);
      if (expected) assert.equal(reuse({ needs }), producer === 'success');
    }
  }
  for (const changes of ['failure', 'cancelled', 'skipped', undefined])
    assert.equal(selected({ needs: { changes: { result: changes, outputs: { legacy: 'true', web: 'true' } }, 'legacy-results': { result: 'success' } } }), false);
  for (const legacy of ['false', undefined])
    assert.equal(selected({ needs: { changes: { result: 'success', outputs: { legacy, web: 'true' } }, 'legacy-results': { result: 'success' } } }), false);
  assert.deepEqual(oracle.on.workflow_call.inputs['reuse-legacy-results'], {
    description: 'Reuse the legacy-results artifact produced by this same validation run.',
    type: 'boolean', required: false, default: false,
  });
  const steps = oracle.jobs['web-legacy'].steps;
  const download = steps.find(step => step.with?.name === 'legacy-results');
  assert.equal(download.if, 'inputs.reuse-legacy-results == true');
  assert.equal(download.uses, 'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c');
  assert.deepEqual(download.with, { name: 'legacy-results', path: 'public/results' });
  assert.equal(download['continue-on-error'], undefined);
  const generation = steps.find(step => step.run?.includes('npm run eval:discover'));
  assert.equal(generation.if, 'inputs.reuse-legacy-results != true');
  for (const command of ['npm run bench', 'npm run eval:discover -- --scanner=redact-secret', 'npm run eval:publish -- --legacy-v1']) assert.ok(generation.run.includes(command));
  const producer = routine.jobs['legacy-results'];
  const measurement = producer.steps.find(step => step.run?.includes('npm run eval:discover'));
  const commands = run => run.split('\n').map(line => line.trim()).filter(line => line.startsWith('npm run '));
  assert.deepEqual(commands(measurement.run), commands(generation.run), 'reused reports must use the same scanner/profile commands as standalone generation');
  assert.equal(measurement.env, undefined, 'the producer must not introduce a candidate/scanner environment');
  assert.equal(producer['runs-on'], oracle.jobs['web-legacy']['runs-on']);
  assert.deepEqual(producer.steps.find(step => step.uses?.startsWith('actions/upload-artifact@')).with, {
    name: download.with.name, path: download.with.path, 'retention-days': 1,
  });
  const install = steps.findIndex(step => step.name === 'Repository dependencies and generated fixtures');
  assert.equal(steps[install].run, 'npm ci');
  assert.equal(steps[install].if, undefined);
  assert.ok(install < steps.indexOf(download));
  for (const command of ['npm run check:routes', 'npm run check:layout', 'npm run test:e2e']) {
    const check = steps.find(step => step.run?.includes(command));
    assert.ok(check, `${command} is independently checked`);
    assert.ok(!check.if?.includes('reuse-legacy-results'), `${command} cannot be skipped by reuse`);
  }
  assert.ok(routine.jobs['validate-sources'].steps.some(step => step.run === 'node scripts/check-repository-hygiene.mjs' && !step.if));
  const downloaded = conditionOf(download.if), measured = conditionOf(generation.if);
  for (const input of [true, false, undefined]) {
    const context = { inputs: { 'reuse-legacy-results': input } };
    assert.equal(downloaded(context), input === true);
    assert.equal(measured(context), input !== true);
    assert.notEqual(downloaded(context), measured(context), 'exactly one data path is selected');
  }
});

test('the actual validate shell gate refuses failed or missing reuse dependencies', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8'));
  const script = workflow.jobs.validate.steps.find(step => step.run).run;
  const success = Object.fromEntries(['CHANGES', 'SOURCES', 'TESTS', 'ORACLE', 'LEGACY_RESULTS', 'VIEW', 'WEB_BUILD', 'WEB_UNIT', 'WEB_BROWSER'].map(name => [name, 'success']));
  const run = overrides => spawnSync('bash', ['-c', script], { env: { ...process.env, ...success, LEGACY: 'true', WEB: 'true', BROWSER: 'true', ...overrides }, encoding: 'utf8' });
  assert.equal(run({}).status, 0);
  for (const dependency of ['ORACLE', 'LEGACY_RESULTS', 'CHANGES']) {
    for (const result of ['failure', 'cancelled', 'skipped', '']) {
      const output = run({ [dependency]: result });
      assert.equal(output.status, 1, `${dependency}=${result} must fail: ${output.stdout}`);
    }
  }
  assert.equal(run({ WEB: 'false', BROWSER: 'false', LEGACY_RESULTS: 'skipped', VIEW: 'skipped', WEB_BUILD: 'skipped', WEB_UNIT: 'skipped', WEB_BROWSER: 'skipped' }).status, 0, 'legacy-only generation still completes');
  assert.equal(run({ LEGACY: 'false', ORACLE: 'skipped' }).status, 0, 'an explicitly unselected oracle may skip');
  assert.equal(run({ LEGACY: '', ORACLE: 'skipped' }).status, 1, 'a missing plan does not authorise a skip');
});

test('publication workflow changes run the complete retained validation suite', () => {
  const plan = pr(['.github/workflows/publish-site.yml']);
  assert.deepEqual([plan.legacy, plan.web, plan.browser, plan.webScope], [true, true, true, 'full']);
});

test('validate final assembly receives the existing validated credential seam after the rollback build', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8'));
  const steps = workflow.jobs['web-build'].steps;
  const seam = steps.find(step => step.id === 'assembly-authority');
  assert.ok(seam);
  assert.equal(seam.run, 'node --import tsx scripts/credential-publication.ts authority');
  const rollback = steps.findIndex(step => step.run?.includes('with-authority.mjs legacy'));
  const committed = steps.findIndex(step => step.name?.startsWith('The committed authority builds'));
  const assembled = steps.find(step => step.name?.startsWith('The assembled site root'));
  assert.ok(rollback < steps.indexOf(seam) && steps.indexOf(seam) < committed && committed < steps.indexOf(assembled));
  assert.equal(assembled.env.AUTHORITY, '${{ steps.assembly-authority.outputs.authority }}');
  assert.match(assembled.run, /assemble-site\.mjs --credential-authority "\$AUTHORITY"/);
  assert.doesNotMatch(assembled.run, /--credential-authority (?:new|legacy)/);
});

// Role migrations must invalidate the same consumers as their former corpus/authoring locations.
test('role-based corpus, authoring, shared scorer and pack paths remain measurement and publication inputs', () => {
  for (const path of ['fixtures/generators/credential-regressions/207.mjs', 'benchmarks/corpora/provider-contracts/corpus-group-c.mjs', 'benchmarks/harness/credential-carriers/score-multispan.mjs', 'benchmarks/lib/credential-regressions/index.ts', 'adversarial/packs/public-source-regression/intake.json', 'adversarial/run-records/public-source-regression/first-run.json']) {
    const plan = pr([path]);
    assert.equal(plan.legacy, true, path);
    assert.equal(plan.web, true, path);
    assert.ok(inputFiles('legacy', [path]).includes(path), path);
    assert.ok(inputFiles('view', [path]).includes(path), path);
  }
});
