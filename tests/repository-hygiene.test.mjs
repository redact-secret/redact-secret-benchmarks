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
  assert.deepEqual(check([{ path: 'scripts/manual.mjs', size: 10 }], { inventory: { entries: [{ path: 'scripts/manual.mjs', callers: [{ path: 'docs/specs/tool.md', active: false }] }] } }), []);
});
test('removal references must name a retained archive with a digest and review receipt', () => {
  assert.ok(check([], { archive: { sourceCommit: 'bad' } }).length);
  assert.ok(check([], { removals: { sourceCommit: 'bad', entries: [{ path: 'missing' }] } }).length);
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
