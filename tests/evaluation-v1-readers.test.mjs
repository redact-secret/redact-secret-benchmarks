import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

// Inventory guard (#790): every tracked file outside web/, docs, evidence and tests that names the full-report paths (`evaluation-v1.json`, `results-output/evaluation.json`) is a
// known, classified reader or writer. A new direct consumer fails here until it is classified: a bundle reader (pointer, manifest, summary, bundleCases/bundleReviews) or an
// explicit legacy/oracle path. No ledger value and no count is asserted.
const classification = {
  'src/main.ts': 'legacy-oracle reader (opt-in --legacy-v1 export)',
  'src/pages/workbench/index.ts': 'legacy-oracle copy',
  'src/pages/workbench/method.ts': 'legacy-oracle copy',
  'scripts/publish-evaluation.ts': 'writer: the opt-in --legacy-v1 export',
  'scripts/publish-evaluation-domains.ts': 'legacy v1 domain index (--legacy-v1 only); normal path reads the bundle',
  'scripts/publish-pii-support.ts': 'refuses --evaluation with an explicit message',
  'scripts/accounting-dry-run.ts': 'reads the discovery store; names the legacy single file as the explicit fallback',
  'benchmarks/shared/evaluation-domains.ts': 'the v1 domain index: the supported legacy contract',
  'benchmarks/shared/evaluation-domains-v2.ts': 'rejects evaluation-v1.json as the credential evaluation',
  'benchmarks/shared/credential-evidence.ts': 'explains that evaluation-v1.json is not a credential evidence input',
  'benchmarks/evaluation/bundle/bundle.ts': 'bundle storage contract',
  'benchmarks/evaluation/storage/discovery-store.ts': 'discovery storage contract',
  'scripts/measure-report-growth.ts': 'size baseline',
  'scripts/verify-evaluation-bundle.ts': 'bundle verifier',
  '.github/workflows/publish-site.yml': 'deployment (owned by the deployment workstream)',
  '.github/workflows/validate.yml': 'legacy-results job: the opt-in --legacy-v1 export beside the bundle, for the legacy oracle',
  '.github/workflows/legacy-oracle.yml': 'legacy oracle: the opt-in --legacy-v1 export for the src/ UI',
};
const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(file => statSync(file, { throwIfNoEntry: false })?.isFile()).filter(file => !/^(web|docs|graft|evidence|public|tests)\//.test(file) && !/\.md$|package-lock\.json$/.test(file));

test('every direct reference to the full-report paths outside web/ is a classified legacy or bundle-aware file', () => {
  const direct = tracked.filter(file => /evaluation-v1\.json|results-output\/evaluation\.json/.test(readFileSync(file, 'utf8')));
  const unclassified = direct.filter(file => !Object.hasOwn(classification, file));
  assert.deepEqual(unclassified, [], 'classify a new full-report reader as legacy/oracle or move it to the bundle readers');
});

test('the review-ledger, qualification and release tooling never parse the full report', () => {
  const never = tracked.filter(file => /^scripts\/(check-review-.*|rekey-review-ledger|build-ledger-rekey|apply-ledger-settlements|summarize-review-state-effect|produce-.*release-record.*)\.(mjs|ts)$|^benchmarks\/(qualify|classify-support)\.ts$|^benchmarks\/support\/evidence\.ts$|^benchmarks\/qualification\/ledger-rekey\.ts$/.test(file));
  assert.ok(never.length >= 8, 'the inventory found the tooling');
  for (const file of never) assert.doesNotMatch(readFileSync(file, 'utf8'), /evaluation-v1\.json|results-output\/evaluation\.json|public\/results\/evaluation/, file);
});
