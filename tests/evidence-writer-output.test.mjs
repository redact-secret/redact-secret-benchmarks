import { createHash } from 'node:crypto';
import { verifyHistoricalScorerSources } from '../scripts/lib/historical-scorer-source.mjs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stagedAsyncMeasurementDirectory } from '../scripts/lib/staged-async-measurement.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = (script, args) => spawnSync(process.execPath, ['--import', 'tsx', script, ...args], { cwd: root, encoding: 'utf8' });
const credential = out => ['--core-commit=' + 'a'.repeat(40), '--core-repo=' + join(tmpdir(), 'nonexistent-core-must-not-build'), '--out-dir=' + out];

test('credential parity refuses a tracked evidence destination before product build or mutation', () => {
  const result = run('scripts/measure-credential-mixed-parity.mjs', credential(join(root, 'evidence/860/381/rejected')));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ignored results-output/);
  assert.doesNotMatch(result.stderr, /the #381 plan|core checkout|not a git repository/);
});

test('card/IBAN observation refuses accepted evidence outputs before artifact packing', () => {
  const result = run('scripts/observe-pii-card-iban-stress.mjs', ['--observation=evidence/901/425/rejected-observation.json', '--report=evidence/901/425/rejected-report.json']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ignored results-output/);
  assert.doesNotMatch(result.stderr, /stress plans are not committed|npm ERR|tarball/);
});

test('actual measurement CLIs reject existing run directories and symlink escapes without changing accepted bytes', () => {
  const work = mkdtempSync(join(root, 'results-output/evidence-writer-test-'));
  const external = mkdtempSync(join(tmpdir(), 'evidence-writer-outside-'));
  try {
    const accepted = join(work, 'accepted'); mkdirSync(accepted);
    const original = 'accepted synthetic record'; writeFileSync(join(accepted, 'record.json'), original);
    const linked = join(work, 'linked'); symlinkSync(external, linked, 'dir');
    for (const output of [accepted, join(linked, 'fresh')]) for (const [script, args] of [
      ['scripts/measure-credential-mixed-parity.mjs', credential(output)],
      ['scripts/observe-pii-card-iban-stress.mjs', ['--out-dir=' + output]],
    ]) {
      const result = run(script, args); assert.notEqual(result.status, 0);
      assert.match(result.stderr, /already exists|ignored results-output/);
    }
    assert.equal(readFileSync(join(accepted, 'record.json'), 'utf8'), original);
  } finally { rmSync(work, { recursive: true, force: true }); rmSync(external, { recursive: true, force: true }); }
});

for (const [script, args] of [
  ['measure-pii-mixed-parity.mjs', ['--out-dir=evidence/901/427/rejected']],
  ['measure-pii-email-network-populations.mjs', ['--artifacts-dir=/nonexistent', '--product-repo=/nonexistent', '--output=evidence/901/424/rejected.json']],
  ['measure-pii-ssn-phone-stress.mjs', ['--core=/nonexistent', '--node=/nonexistent', '--wasm=/nonexistent', '--output-dir=evidence/901/426/rejected']],
  ['measure-runtime-comparison.mjs', ['--setting=default', '--out=evidence/562/rejected.json']],
]) test(`${script} refuses tracked output before artifact or environment loading`, () => {
  const result = run('scripts/' + script, args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ignored results-output/);
  assert.doesNotMatch(result.stderr, /REDACT_SECRET_REF is not set|ENOENT|not committed|tarball/);
});

test('async measurement failure never publishes a partial bundle and releases its staging lock', async () => {
  const work = mkdtempSync(join(root, 'results-output/evidence-partial-test-'));
  const target = join(work, 'complete');
  try {
    await assert.rejects(stagedAsyncMeasurementDirectory(target, async stage => {
      writeFileSync(join(stage, 'observation.json'), '{}');
      throw new Error('synthetic report validation failure');
    }), /report validation failure/);
    assert.equal(existsSync(target), false);
    assert.deepEqual(readdirSync(work), []);
    await stagedAsyncMeasurementDirectory(target, async stage => writeFileSync(join(stage, 'report.json'), '{}'));
    assert.equal(readFileSync(join(target, 'report.json'), 'utf8'), '{}');
    await assert.rejects(stagedAsyncMeasurementDirectory(target, async () => {}), /already exists/);
    assert.equal(readFileSync(join(target, 'report.json'), 'utf8'), '{}');
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('both Docker wrappers reject tracked output before Docker invocation', () => {
  for (const [script, flag] of [['run-runtime-comparison-docker.sh', '--out-dir=evidence/562/rejected'],
    ['run-peer-pii-runtime-throughput-docker.sh', '--out=evidence/429/rejected.json']]) {
    const result = spawnSync('bash', ['scripts/' + script, flag], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ignored results-output/);
    assert.doesNotMatch(result.stderr, /docker:|Docker daemon/);
  }
});

test('manual dispatch writer and uploaded artifact paths agree on ignored destinations', () => {
  const workflow = readFileSync(join(root, '.github/workflows/peer-pii-runtime-throughput.yml'), 'utf8');
  assert.match(workflow, /--out=results-output\/peer-pii-runtime-throughput\/report.json/);
  assert.match(workflow, /path: results-output\/peer-pii-runtime-throughput\/report.json/);
  assert.match(workflow, /--out-dir=results-output\/runtime-comparison/);
  assert.match(workflow, /path: results-output\/runtime-comparison\/runtime-comparison-\*.json/);
  assert.equal((workflow.match(/runs-on:/g) ?? []).length, 1);
  const validation = readFileSync(join(root, '.github/workflows/validate.yml'), 'utf8');
  assert.match(validation, /eval:validate -- docs\/specs\/qualification\/engine-v1.json --suite=benchmarks\/inputs\/credential\/qualification-suite.json/);
  assert.doesNotMatch(validation, /--suite=evidence\//);
});

const source = 'a'.repeat(40);
const populationInputs = ['--candidate-core=/missing', '--candidate-node=/missing', '--candidate-wasm=/missing'];
for (const [script, args] of [
  ['observe-pii-populations.mjs', [...populationInputs, '--output=evidence/rejected.json']],
  ['observe-us-ssn-populations.mjs', [...['baseline', 'candidate'].flatMap(side => ['core', 'node', 'wasm', 'evidence'].map(role => `--${side}-${role}=/missing`)), '--candidate-source=/missing', '--output=evidence/rejected.json']],
  ['measure-pii-arrival-operational.mjs', [...['baseline', 'candidate'].flatMap(side => ['core', 'node', 'wasm'].map(role => `--${side}-${role}=/missing`)), `--baseline-source-commit=${source}`, `--candidate-source-commit=${source}`, '--contract=/missing', '--output=evidence/rejected.json']],
  ['qualify-pii-family-candidate.mjs', ['--candidate-evidence=/missing', '--core=/missing', '--node=/missing', '--wasm=/missing', '--plan=/missing', '--activation-output=evidence/rejected-activation.json', '--qualification-output=evidence/rejected-qualification.json']],
  ['run-us-ssn-protected-holdout.mjs', ['--manifest=/missing', '--candidate-evidence=/missing', '--population-evidence=/missing', '--core=/missing', '--node=/missing', '--wasm=/missing', '--output=evidence/rejected.json']],
  ['measure-regression-noise.mjs', ['--core-repo', '/missing', '--out', 'evidence/rejected.json']],
  ['pii-beta11.mjs', [`--core-commit=${source}`, '--core-repo=/missing', '--role=interim', '--out-dir=evidence/rejected']],
  ['pii-beta11-protected.mjs', ['run', `--core-commit=${source}`, '--family=pii:global:email', '--public-dir=/missing', '--seal=/missing', '--output=evidence/rejected.json']],
]) test(`${script} refuses a tracked measurement destination before private or product inputs`, () => {
  const result = run('scripts/' + script, args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, script === 'pii-beta11-protected.mjs' ? /measurement-output-rejected/ : /ignored results-output/);
  assert.doesNotMatch(result.stderr, /ENOENT|tarball|benchmark-tree-dirty/);
});

test('archive input revision cannot authorise a changed historical scorer implementation', async () => {
  const work = mkdtempSync(join(root, 'results-output/scorer-source-test-'));
  try {
    const source = 'export const syntheticScorer = 1;';
    writeFileSync(join(work, 'scorer.mjs'), source);
    const frozen = { evaluationSchema: [{ path: 'scorer.mjs', sha256: createHash('sha256').update(source).digest('hex') }] };
    await verifyHistoricalScorerSources(frozen, work);
    writeFileSync(join(work, 'scorer.mjs'), source + '\n// changed implementation');
    await assert.rejects(verifyHistoricalScorerSources(frozen, work), /Historical scorer source drift/);
    await assert.rejects(verifyHistoricalScorerSources({ evaluationSchema: [] }, work), /lacks the original/);
    await assert.rejects(verifyHistoricalScorerSources({ evaluationSchema: [{ path: '../outside', sha256: '0'.repeat(64) }] }, work), /scope is invalid/);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('historical source loading reads the exact Git object instead of a dirty file at matching HEAD', () => {
  const work = mkdtempSync(join(root, 'results-output/source-checkout-test-'));
  try {
    const original = 'export const originalScorer = 1;', changed = 'export const originalScorer = 2;';
    writeFileSync(join(work, 'scorer.mjs'), changed);
    const fakeGit = `#!${process.execPath}\nconst args=process.argv.slice(2);
if(args[0]==='rev-parse') process.stdout.write('65ffe7dcb3e7124e7f66cff96cab814f0365f69a\\n');
else if(args[0]==='show'&&args[1]==='65ffe7dcb3e7124e7f66cff96cab814f0365f69a:scorer.mjs') process.stdout.write(${JSON.stringify(original)});
else process.exit(1);
`;
    writeFileSync(join(work, 'git'), fakeGit, { mode: 0o755 });
    const script = `import { originalSourceBytes } from ${JSON.stringify(new URL('./helpers/historical-evidence-archive.mjs', import.meta.url).href)}; process.stdout.write(originalSourceBytes('scorer.mjs'));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8',
      env: { ...process.env, HYGIENE_EVIDENCE_ARCHIVE_ROOT: '', HYGIENE_ORIGINAL_SOURCE_ROOT: work, PATH: work + ':' + process.env.PATH } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, original);
    assert.equal(readFileSync(join(work, 'scorer.mjs'), 'utf8'), changed);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
