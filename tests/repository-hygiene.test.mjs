import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hygieneProblems, workflowScriptReferences } from '../scripts/check-repository-hygiene.mjs';

const policy = { schemaVersion: 1, baselineCommit: 'a'.repeat(40), maxNewPayloadBytes: 100, existingPaths: ['docs/generated/canonical.json'], existingLargePayloads: [{ path: 'benchmarks/ledger.json', maxBytes: 1000 }], exceptions: [] };
const check = (files, extra = {}) => hygieneProblems({ files, policy, inventory: { entries: [] }, today: '2026-10-08', ...extra });
test('existing authoritative inputs are allowed while new outputs and oversized payloads fail actionably', () => {
  assert.deepEqual(check([{ path: 'docs/generated/canonical.json', size: 90 }, { path: 'benchmarks/ledger.json', size: 900 }]), []);
  const problems = check([{ path: 'evidence/1/scratch.json', size: 101 }, { path: 'results-output/leak.json', size: 1 }]);
  assert.equal(problems.length, 3);
  assert.ok(problems.some(p => p.includes('owner/issue/expiry')));
});
test('exceptions expire and cannot be broad or unowned; manual scripts need discoverable entrypoints', () => {
  const exception = { path: 'evidence/1/run.json', owner: 'benchmarks', rationale: 'pinned reproduction input', issue: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/854', expires: '2026-10-09', maxBytes: 200 };
  const files = [{ path: exception.path, size: 150 }];
  assert.deepEqual(check(files, { policy: { ...policy, exceptions: [exception] } }), []);
  assert.ok(check(files, { policy: { ...policy, exceptions: [{ ...exception, expires: '2026-10-07' }] } }).some(p => p.includes('expired')));
  assert.ok(check(files, { policy: { ...policy, exceptions: [{ ...exception, path: '../escape' }] } }).length);
  assert.ok(check(files, { policy: { ...policy, exceptions: [{ ...exception, expires: '2026-02-31' }] } }).length);
  assert.ok(check([{ path: 'scripts/unused.mjs', size: 10 }]).some(p => p.includes('orphan')));
  assert.ok(check([{ path: 'scripts/manual.mjs', size: 10 }], { inventory: { entries: [{ path: 'scripts/manual.mjs', callers: [{ path: 'docs/specs/tool.md', active: false }] }] } }).some(p => p.includes('orphan')));
});
test('removal references must name a retained archive with a digest and review receipt', () => {
  assert.ok(check([], { archive: { sourceCommit: 'bad' } }).length);
  assert.ok(check([], { removals: { sourceCommit: 'bad', entries: [{ path: 'missing' }] } }).length);
});
test('historical Markdown reader migrations stay checksum-bound and cannot mask source readers', () => {
  const archive = { schema: 'redact-secret/retention-archive/v1', sourceCommit: 'a'.repeat(40), retainedTag: 'hygiene-retained', tagObject: 'b'.repeat(40) };
  const row = { path: 'docs/reports/history.md', sourceSha256: 'c'.repeat(64), afterSha256: 'd'.repeat(64), owner: 'maintainers', issue: 847, reason: 'Archived source link' };
  const inventory = { entries: [{ path: row.path, sha256: row.afterSha256, callers: [] }] };
  const removals = { sourceCommit: archive.sourceCommit, preservationTag: archive.retainedTag, entries: [], readerMigrations: [row] };
  assert.deepEqual(check([{ path: row.path, size: 20 }], { archive, inventory, removals, policy: { ...policy, existingPaths: [...policy.existingPaths, row.path] } }), []);
  assert.ok(check([], { archive, inventory, removals: { ...removals, readerMigrations: [row, row] } }).some(p => p.includes('reader migration')));
  assert.ok(check([], { archive, inventory: { entries: [] }, removals }).some(p => p.includes('reader migration')));
  assert.ok(check([], { archive, inventory, removals: { ...removals, readerMigrations: [{ ...row, path: 'scripts/read.mjs' }] } }).some(p => p.includes('reader migration')));
});
test('unreachable script cycles cannot count each other as entrypoints', () => {
  const paths = ['scripts/a.mjs', 'scripts/b.mjs'];
  const inventory = { entries: paths.map((path, i) => ({ path, callers: [{ path: paths[1 - i], active: true, via: ['import'] }] })) };
  assert.equal(check(paths.map(path => ({ path, size: 10 })), { inventory }).filter(p => p.includes('orphan')).length, 2);
});
test('workflow invocation cannot refer to deleted script and workflow must have trigger', () => {
  assert.equal(check([{ path: '.github/workflows/bad.yml', size: 90, text: 'jobs:\n  check:\n    steps:\n      - run: node scripts/missing.mjs' }]).length, 2);
});
test('workflow readers respect package working directories and explicitly checked-out other repositories', () => {
  const text = `on: workflow_dispatch\njobs:\n  check:\n    steps:\n      - uses: actions/checkout@pin\n        with:\n          repository: redact-secret/redact-secret\n          path: .product\n      - run: node scripts/with-authority.mjs\n        working-directory: web\n      - run: node scripts/pack.mjs\n        working-directory: .product\n      - run: node scripts/missing.mjs\n`;
  assert.deepEqual(workflowScriptReferences(text), ['web/scripts/with-authority.mjs', 'scripts/missing.mjs']);
  assert.deepEqual(workflowScriptReferences(`jobs:\n  check:\n    steps:\n      - uses: actions/checkout@pin\n        with: {path: benchmarks}\n      - run: node scripts/tool.mjs\n        working-directory: benchmarks\n`), ['scripts/tool.mjs']);
  assert.deepEqual(workflowScriptReferences('jobs:\n  check:\n    steps:\n      - run: node "./scripts/missing.mjs"\n'), ['scripts/missing.mjs']);
  assert.ok(check([{ path: '.github/workflows/no-trigger.yml', size: 90, text: 'jobs:\n  check:\n    steps:\n      - run: |\n          on: shell-text\n' }]).some(p => p.includes('no trigger')));
});

const reviewed = (path, classification) => ({ path, classification, owner: 'benchmarks maintainers', issue: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/877', rationale: 'Reviewed current role and exact invocation boundary' });
test('new ADRs, reports and session commands cannot accumulate through historical or test references', () => {
  for (const caller of ['tests/tool.test.mjs', 'docs/specs/history.md', 'README.md', 'evidence/1/README.md']) {
    const file = { path: 'scripts/report-batch99.mjs', size: 10 };
    const problems = check([file], { inventory: { entries: [{ path: file.path, callers: [{ path: caller, active: true, via: ['literal-path'] }] }] } });
    assert.ok(problems.some(p => p.includes('session-named')));
    assert.ok(problems.some(p => p.includes('orphan')));
  }
  assert.ok(check([{ path: 'docs/decisions/2026-10-08-one-off.md', size: 10 }]).some(p => p.includes('linked issue/archive')));
  assert.ok(check([{ path: 'docs/reports/round99/report.json', size: 10 }]).some(p => p.includes('new retained output')));
});
test('explicit current policy, structured authorisation and required manual corpus tools pass without new approvals', () => {
  const files = [{ path: 'docs/specs/scanner-policy.md', size: 10 }, { path: 'benchmarks/governance/authorisations/public-pii.json', size: 10, text: JSON.stringify({ schema: 'redact-secret/owner-authorisation/v1', decisionId: 'decision-public-pii', status: 'proposed', scope: 'benchmarks', title: 'Proposed public PII', owner: {acceptedBy: 'pending', acceptedOn: ''}, ruling: 'Await review', context: {}, uses: [] }) }, { path: 'scripts/measure-corpus.mjs', size: 10 }];
  const pathReviews = [reviewed(files[1].path, 'structured-owner-authorisation'), reviewed(files[2].path, 'required-manual-tool')];
  assert.deepEqual(check(files, { policy: { ...policy, pathReviews } }), []);
  assert.ok(check(files).some(p => p.includes('structured owner authorisation')));
  assert.ok(check([], { policy: { ...policy, pathReviews } }).some(p => p.includes('missing tracked')));
});
test('scoped reviews permit a justified canonical name but historical reproduction is not a current execution root', () => {
  const file = { path: 'scripts/beta11-oracle.mjs', size: 10 };
  assert.deepEqual(check([file], { policy: { ...policy, pathReviews: [reviewed(file.path, 'required-manual-tool')] } }), []);
  assert.ok(check([file], { policy: { ...policy, pathReviews: [reviewed(file.path, 'historical-reproduction')] } }).some(p => p.includes('orphan')));
});

test('stable historical IDs in role-named corpus filenames are allowed while new session folders require review', () => {
  assert.deepEqual(check([{path: 'benchmarks/corpora/provider-shapes/FROZEN-group-c.json', size: 10}]), []);
  assert.ok(check([{path: 'benchmarks/batch99/FROZEN.json', size: 10}]).some(p => p.includes('session-named')));
});

test('removed grandfathered paths and unowned retained scopes fail instead of silently declaring cleanup done', () => {
  const retained = { ...policy, enforcePrunedBaseline: true, retainedScopes: [{owner: 'benchmarks maintainers', issue: reviewed('x', 'current-contract').issue, rationale: 'Exact current input', paths: [...policy.existingPaths]}] };
  assert.ok(check([], {policy: retained}).some(p => p.includes('prune removed/moved')));
  assert.ok(check([{path: policy.existingPaths[0], size: 10}], {policy: {...retained, retainedScopes: []}}).some(p => p.includes('scoped owner/issue')));
  assert.deepEqual(check([{path: policy.existingPaths[0], size: 10}], {policy: retained}), []);
});

test('an exact owner/issue baseline review permits canonical population IDs but does not permit a new session record', () => {
  const canonical = 'peer-observations/comparison/beta8-207/gitleaks.json';
  const scoped = {...policy, existingPaths: [canonical], enforcePrunedBaseline: true, retainedScopes: [{owner: 'peer maintainers', issue: reviewed('x', 'current-contract').issue, rationale: 'Frozen canonical population ID', paths: [canonical]}]};
  assert.deepEqual(check([{path: canonical, size: 10}], {policy: scoped}), []);
  assert.ok(check([{path: canonical, size: 10}, {path: 'peer-observations/comparison/beta99-scratch/gitleaks.json', size: 10}], {policy: scoped}).some(p => p.includes('session-named')));
});

test('credential and PII coverage source modules are allowed while coverage outputs remain scratch', () => {
  const source = ['web/app/coverage/credential/page.tsx', 'web/app/coverage/pii/page.tsx',
    'web/components/coverage/pii/PiiCatalog.module.css', 'web/components/coverage/credential/index.ts'];
  assert.deepEqual(check(source.map(path => ({ path, size: 10 }))), []);
  for (const path of ['coverage/lcov.info', 'web/coverage/index.html', 'web/app/coverage/pii/report.json',
    'web/components/coverage/pii/node_modules/module.ts', 'other/coverage/page.tsx']) {
    assert.ok(check([{ path, size: 10 }]).some(problem => problem.includes('regenerable scratch')), path);
  }
  assert.ok(check([{ path: source[0], size: 101 }]).some(problem => problem.includes('exceeds')), 'source exemption keeps size limits');
});
