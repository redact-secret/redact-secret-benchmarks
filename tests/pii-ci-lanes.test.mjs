import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { callersOf } from '../scripts/legacy-callers.mjs';
import { PII_MIGRATION, planChecks } from '../scripts/ci-plan.mjs';

// #666: repetitive PII measurement does not run in unrelated pull request builds, and no required check is weakened to get there.
// The PII gates read committed files and run on every change; the measurement itself is dispatch-only or runs on a push.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean);
const migrationFiles = tracked.filter(f => PII_MIGRATION.some(r => r.test(f)));
const plan = files => planChecks({ files, event: 'pull_request' });

test('a change to PII migration tooling or data skips the legacy credential measurement and still builds and tests the site', () => {
  for (const file of ['scripts/replay-pii-populations.mjs', 'benchmarks/pii-authority.json', 'benchmarks/pii-eval-migration.json', 'benchmarks/pii-eval-population-dual-run/report.json',
    'scripts/check-pii-authority.mjs', 'benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs', 'scripts/lib/pii-population-conversion.mjs',
    'scripts/run-pii-candidate-comparison.mjs', 'scripts/record-pii-candidate-comparison.mjs',
    'scripts/preflight-pii-evidence.mjs', 'scripts/run-pii-evidence-comparison.mjs', 'scripts/lib/pii-evidence-contract.mjs',
    'scripts/prepare-pii-evidence-adoption.mjs', 'scripts/pii-evidence-publication.mjs', 'scripts/pii-evidence-publication.d.mts', 'benchmarks/pii-evidence/snapshot-pin.json',
    'benchmarks/pii-evidence-comparison/plan.json', 'benchmarks/pii-population-policy.json', 'benchmarks/evaluation/domains/pii/evidence-comparison.mjs',
    'benchmarks/pii-candidate-comparison/receipt.json', 'benchmarks/evaluation/domains/pii/candidate-comparison.mjs']) {
    const p = plan([file]);
    assert.equal(p.legacy, false, `${file} must not select the legacy oracle`);
    assert.equal(p.web, true, `${file} is read by the site build`);
  }
});

test('the PII oracle code, the credential measurement and an unknown path still select the legacy oracle', () => {
  for (const file of ['benchmarks/evaluation/domains/pii/accounting.ts', 'benchmarks/evaluation/domains/pii/methods/benign.ts', 'qualification/pii-v1.json', 'scripts/publish-pii-support.ts',
    'scripts/publish-pii-support-with-evidence.mjs', 'scripts/run-pii-evidence-unknown.mjs',
    'benchmarks/run.ts', 'scanners/candidate.mjs', 'scripts/some-new-script.mjs', 'benchmarks/evaluation/domains/pii/support-v2.ts']) {
    assert.equal(plan([file]).legacy, true, `${file} must select the legacy oracle`);
  }
  // A change that mixes both runs the legacy measurement.
  assert.equal(plan(['scripts/replay-pii-populations.mjs', 'benchmarks/run.ts']).legacy, true);
});

test('no legacy-measurement file depends on a carved-out file: the only non-test, non-web callers are publish-time PII code and workflows', () => {
  assert.ok(migrationFiles.length >= 20, 'the carve-out matches the files it names');
  // Canonical consumers and the publish-only wrapper are not legacy credential oracle callers.
  const allowed = new Set(['package.json', 'scripts/pii-publication-inputs.ts', 'scripts/publish-pii-support-with-evidence.mjs', 'benchmarks/support/pii-current-qualification.ts']);
  const offenders = [];
  for (const file of migrationFiles) {
    for (const caller of callersOf(file)) {
      if (PII_MIGRATION.some(r => r.test(caller.file))) continue;
      if (['test', 'web (Next app)', 'web script', 'workflow'].includes(caller.class) || allowed.has(caller.file)) continue;
      offenders.push(`${caller.file} (${caller.class}) uses ${file}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the legacy oracle workflow and the publish-time PII code are disjoint: the oracle never runs the PII publication or the carved-out scripts', () => {
  const oracle = read('.github/workflows/legacy-oracle.yml');
  for (const name of ['publish-pii-support', 'pii-publication-inputs', 'eval:publish:pii-support', 'pii:']) assert.ok(!oracle.includes(name), `legacy-oracle.yml runs ${name}`);
  for (const file of migrationFiles.filter(f => f.startsWith('scripts/'))) assert.ok(!oracle.includes(file), `legacy-oracle.yml runs ${file}`);
});

test('every PII gate runs in validate-sources on every pull request, with no condition that could skip it', () => {
  const validate = read('.github/workflows/validate.yml');
  const job = validate.split('\n  validate-sources:')[1].split('\n  legacy-oracle:')[0];
  assert.doesNotMatch(job.split('steps:')[0], /\n\s+if:/, 'validate-sources is unconditional');
  for (const command of ['npm run pii:artifact:check', 'npm run pii:artifact-source:check', 'npm run pii:custodian:check', 'npm run pii:migration:check', 'npm run pii:authority:check', 'npm run pii:legacy-inventory:check']) {
    const at = job.indexOf(`run: ${command}`);
    assert.ok(at >= 0, `${command} is a validate-sources step`);
    assert.doesNotMatch(job.slice(Math.max(0, at - 400), at).split('- name:').pop(), /\n\s+if:|continue-on-error/, `${command} is not conditional or advisory`);
  }
  assert.match(validate, /unit-tests:[\s\S]*tests\/\*\.test\.mjs/, 'the root unit tests (which include every PII test) run on every change');
});

test('no pull request workflow runs a PII measurement; the measurement workflows are dispatch-only or push-only', () => {
  const measuring = /pii:observe|pii:beta11|pii:parity:measure|pii:population:(dual-run|replay)|pii:arrival|pii:populations:email-network|peer-pii-runtime-throughput|measure-pii|profile-cost|run-pii-population-dual-run|replay-pii-populations|run-pii-official/;
  for (const file of ['validate.yml', 'legacy-oracle.yml']) assert.doesNotMatch(read(`.github/workflows/${file}`), measuring, `${file} runs a PII measurement`);
  for (const file of ['pii-profile-cost.yml', 'pii-profile-cost-v2.yml', 'peer-pii-runtime-throughput.yml', 'pii-population-replay.yml', 'pii-official-run.yml']) {
    const on = read(`.github/workflows/${file}`).split('\njobs:')[0];
    assert.match(on, /\non:\n\s+workflow_dispatch:/, `${file} is dispatchable`);
    assert.doesNotMatch(on, /pull_request|push:|schedule:/, `${file} is dispatch-only`);
  }
  // The staging publish measures the PII populations on a push to develop or main, never on a pull request.
  const publish = read('.github/workflows/publish-site.yml');
  assert.doesNotMatch(publish.split('\njobs:')[0], /pull_request/);
});
