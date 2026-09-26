import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { siteEnvOf, commitOf, envBanner, buildLine } from '../src/provenance.ts';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sha = '0123456789abcdef0123456789abcdef01234567';
const productSha = 'fedcba9876543210fedcba9876543210fedcba98';

test('only an explicit production or staging value names an environment; anything else is a local build', () => {
  assert.equal(siteEnvOf('production'), 'production');
  assert.equal(siteEnvOf('staging'), 'staging');
  for (const value of [undefined, '', 'Production', 'prod', 'develop']) assert.equal(siteEnvOf(value), 'local', String(value));
});

test('a build commit must be hex; anything else reads as unrecorded', () => {
  assert.equal(commitOf(sha.toUpperCase()), sha);
  assert.equal(commitOf(' abc1234 '), 'abc1234');
  for (const value of [undefined, '', 'abc12', 'main', '<script>', 42]) assert.equal(commitOf(value), null, String(value));
});

test('staging and local builds carry a banner on every route; production carries none', () => {
  assert.equal(envBanner('production'), '');
  assert.match(text(envBanner('staging')), /Staging\. Provisional numbers, not public evidence\./);
  assert.match(envBanner('staging'), /href="https:\/\/benchmarks\.redactsecret\.dev"/);
  assert.match(text(envBanner('local')), /Local build\. .*not public evidence/);
});

test('production states the build commit and the released version it measured, never a candidate', () => {
  const line = buildLine({ env: 'production', commit: sha, productVersion: '0.1.0-beta.6', candidateCommit: productSha });
  assert.equal(text(line), 'Production · benchmarks 0123456 · measured released redact-secret 0.1.0-beta.6');
  assert.match(line, new RegExp(`href="https://github.com/redact-secret/redact-secret-benchmarks/commit/${sha}"`));
});

test('staging names the redact-secret commit only when candidate evidence is published', () => {
  const withCandidate = buildLine({ env: 'staging', commit: sha, productVersion: '0.1.0-beta.6', candidateCommit: productSha, candidateVersion: '0.1.0-beta.7' });
  assert.equal(text(withCandidate), 'Staging · benchmarks 0123456 · measured released redact-secret 0.1.0-beta.6 · candidate evidence for redact-secret 0.1.0-beta.7 in development, main fedcba9');
  assert.equal(text(buildLine({ env: 'staging', commit: sha, candidateCommit: productSha })), 'Staging · benchmarks 0123456 · candidate evidence for redact-secret main fedcba9');
  assert.match(withCandidate, new RegExp(`href="https://github.com/redact-secret/redact-secret/commit/${productSha}"`));
  assert.equal(text(buildLine({ env: 'staging', commit: sha, productVersion: null, candidateCommit: null })), 'Staging · benchmarks 0123456');
  assert.equal(text(buildLine({ env: 'local', commit: null })), 'Local build · benchmarks commit unrecorded');
});

test('a staging run that measured the candidate says so and never calls its version released (#201)', () => {
  const line = buildLine({ env: 'staging', commit: sha, productVersion: null, candidateCommit: productSha, candidateVersion: '0.1.0-beta.7', measuredCandidate: true });
  assert.equal(text(line), 'Staging · benchmarks 0123456 · measured unreleased redact-secret 0.1.0-beta.7 in development, main fedcba9');
  assert.ok(!text(line).includes('measured released'));
});

test('staging measures the corpus against the qualified candidate; production against the released package (#201)', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const step = workflow.slice(workflow.indexOf('- name: Measure the corpus'), workflow.indexOf('- name: Produce the evaluation and qualification reports the site reads'));
  const staging = step.slice(step.indexOf('if [ "$TARGET" = staging ]'), step.indexOf('else'));
  for (const flag of ['--candidate-package="$CORE_PACKAGE"', '--candidate-node-package="$NODE_PACKAGE"', '--candidate-wasm-package="$WASM_PACKAGE"', '--candidate-source-commit="$PRODUCT_COMMIT"']) assert.ok(staging.includes(flag), flag);
  assert.match(step.slice(step.indexOf('else')), /else\n\s+npm run bench -- --strict\n\s+fi/, 'production runs bench with no candidate flag');
  const evaluation = workflow.slice(workflow.indexOf('- name: Produce the evaluation and qualification reports the site reads'), workflow.indexOf('- name: Measure the qualified redact-secret commit as candidate evidence'));
  assert.ok(!evaluation.includes('if:'), 'both environments publish evaluation and qualification evidence (#213)');
  assert.match(evaluation, /\n\s+npm run eval\n/, 'evaluation-v1.json keeps measuring the released package');
  assert.match(evaluation, /\n\s+if ! npm run eval:qualify; then\n/, 'eval:qualify runs with the suite pins, no candidate flag');
  assert.match(evaluation, /npm run eval:publish -- --qualification="\$qualification"\n/, 'the qualification run is published with the evaluation report');
  assert.ok(!evaluation.includes('--candidate'), 'evaluation and qualification take no candidate flag');
});

test('both environments publish a support matrix: staging the candidate, production the released package (#213)', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const step = workflow.slice(workflow.indexOf('- name: Classify support'), workflow.indexOf('- name: Build the site'));
  assert.ok(!/\n\s+if: /.test(step), 'the step runs for every environment');
  const staging = step.slice(step.indexOf('if [ "$TARGET" = staging ]'), step.indexOf('else'));
  for (const flag of ['--candidate-package="$CORE_PACKAGE"', '--candidate-source-commit="$PRODUCT_COMMIT"']) assert.ok(staging.includes(flag), flag);
  assert.match(step.slice(step.indexOf('else')), /else\n\s+npm run eval:classify\n\s+fi\n\s+npm run eval:matrix\n\s+npm run eval:publish:matrix\n/, 'production classifies the released package in published mode');
});

test('the publish workflow hands the environment and commit to the site build', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const step = workflow.slice(workflow.indexOf('- name: Build the site'), workflow.indexOf('- uses: aws-actions/configure-aws-credentials'));
  assert.match(step, /VITE_SITE_ENV: \$\{\{ env\.TARGET \}\}/);
  assert.match(step, /VITE_BUILD_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(step, /run: npm run build/);
});

test('the production deployment summary records all immutable release handoff identities', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const step = workflow.slice(workflow.indexOf('- name: Record what was published'));
  for (const identity of ['published product version', 'product release source SHA', 'benchmark snapshot SHA', 'corpus manifest hash'])
    assert.ok(step.includes(`- ${identity}:`), identity);
  assert.match(step, /\.pins\.packageVersion benchmarks\/pin-manifest\.json/);
  assert.match(step, /\.pins\.sourceRevision benchmarks\/pin-manifest\.json/);
  assert.match(step, /\.revision benchmarks\/pin-manifest\.json/);
});
