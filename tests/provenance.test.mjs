import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { siteEnvOf, commitOf, releaseOf, envBanner, buildLine } from '../src/provenance.ts';

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

test('a release must be a v-prefixed semver tag; anything else reads as unknown', () => {
  assert.equal(releaseOf('v1.2.0'), 'v1.2.0');
  assert.equal(releaseOf(' v0.1.0-rc.1 '), 'v0.1.0-rc.1');
  for (const value of [undefined, '', '1.2.0', 'v1.2', 'main', 'v1.2.0<script>', 42]) assert.equal(releaseOf(value), null, String(value));
});

test('staging and local builds carry a banner on every route; production carries none', () => {
  assert.equal(envBanner('production'), '');
  assert.match(text(envBanner('staging')), /Staging\. Provisional numbers, not public evidence\./);
  assert.match(envBanner('staging'), /href="https:\/\/benchmarks\.redactsecret\.dev"/);
  assert.match(text(envBanner('local')), /Local build\. .*not public evidence/);
});

test('production states the benchmarks release and the released version it measured, never a candidate', () => {
  const line = buildLine({ env: 'production', commit: sha, release: 'v1.2.0', productVersion: '0.1.0-beta.6', candidateCommit: productSha });
  assert.equal(text(line), 'Production · v1.2.0 · measured released redact-secret 0.1.0-beta.6');
  assert.match(line, /href="https:\/\/github\.com\/redact-secret\/redact-secret-benchmarks\/releases\/tag\/v1\.2\.0"/);
  // A production build without a recorded release still says which commit built it.
  assert.equal(text(buildLine({ env: 'production', commit: sha, release: null })), 'Production · benchmarks 0123456');
});

test('staging names the redact-secret commit only when candidate evidence is published', () => {
  const withCandidate = buildLine({ env: 'staging', commit: sha, productVersion: '0.1.0-beta.6', candidateCommit: productSha });
  assert.equal(text(withCandidate), 'Staging · develop 0123456 · measured released redact-secret 0.1.0-beta.6 · candidate evidence for redact-secret fedcba9');
  assert.match(withCandidate, new RegExp(`href="https://github.com/redact-secret/redact-secret/commit/${productSha}"`));
  assert.equal(text(buildLine({ env: 'staging', commit: sha, productVersion: null, candidateCommit: null })), 'Staging · develop 0123456');
  assert.equal(text(buildLine({ env: 'staging', commit: sha, release: 'v1.2.0' })), 'Staging · develop 0123456');
  assert.equal(text(buildLine({ env: 'local', commit: null })), 'Local build · benchmarks commit unrecorded');
});

test('the publish workflow hands the environment, commit and release to the site build', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const step = workflow.slice(workflow.indexOf('- name: Build the site'), workflow.indexOf('- uses: aws-actions/configure-aws-credentials'));
  assert.match(step, /VITE_SITE_ENV: \$\{\{ env\.TARGET \}\}/);
  assert.match(step, /VITE_BUILD_COMMIT: \$\{\{ steps\.source\.outputs\.commit \}\}/);
  assert.match(step, /VITE_BUILD_RELEASE: \$\{\{ steps\.source\.outputs\.release \}\}/);
  assert.match(step, /run: npm run build/);
});
