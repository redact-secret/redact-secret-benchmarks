import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { loadPins } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { checkFiles, validateSource, verifyArchiveMembers, verifyArtifactMetadata, verifyRunMetadata } from '../scripts/fetch-pii-eval-public-synthetic.mjs';

const sourceFile = new URL('../benchmarks/pii-eval-public-synthetic-source.json', import.meta.url);
const pinsFile = new URL('../benchmarks/pii-eval-public-synthetic-pins.json', import.meta.url);
const source = JSON.parse(readFileSync(sourceFile, 'utf8'));
const pins = loadPins(readFileSync(pinsFile, 'utf8'));
const clone = value => structuredClone(value);

test('committed transport and semantic pins bind one exact successful public-synthetic run', () => {
  const checked = checkFiles(sourceFile.pathname, pinsFile.pathname);
  assert.equal(checked.source.workflow.headSha, checked.pins.build.commit);
  assert.equal(checked.source.artifacts.engine.members['pii-eval'], checked.pins.build.binarySha256);
  assert.equal(checked.source.supportClaims, false);
  assert.equal(checked.source.environment, 'staging');
});

test('transport source rejects a different app, run, engine, or semantic pin file', () => {
  for (const mutate of [
    value => { value.app.id = '1'; },
    value => { value.workflow.headSha = '0'.repeat(40); },
    value => { value.artifacts.engine.members['pii-eval'] = '0'.repeat(64); },
  ]) {
    const candidate = clone(source); mutate(candidate);
    assert.throws(() => validateSource(candidate, pins), /Invalid|do not bind/);
  }
  const directory = mkdtempSync(path.join(tmpdir(), 'pii-eval-source-'));
  const other = path.join(directory, 'pins.json');
  writeFileSync(other, readFileSync(pinsFile));
  assert.throws(() => checkFiles(sourceFile.pathname, other), /names another consumer pin file/);
});

test('run metadata requires the exact repository, workflow, head and completed result', () => {
  const run = {
    id: source.workflow.runId, run_attempt: source.workflow.runAttempt, workflow_id: source.workflow.id,
    path: source.workflow.path, event: source.workflow.event, head_branch: source.workflow.branch,
    head_sha: source.workflow.headSha, status: 'completed', conclusion: 'success',
    repository: { id: source.repository.id, full_name: source.repository.fullName },
    head_repository: { id: source.repository.id, full_name: source.repository.fullName },
  };
  assert.doesNotThrow(() => verifyRunMetadata(run, source));
  for (const [field, value] of [['head_sha', '0'.repeat(40)], ['conclusion', 'failure'], ['event', 'pull_request']]) {
    assert.throws(() => verifyRunMetadata({ ...run, [field]: value }, source), /immutable source pin/);
  }
});

test('artifact inventory requires exact id, name, archive digest, size and unexpired lifetime', () => {
  const expected = source.artifacts.measurement;
  const actual = { id: expected.id, name: expected.name, size_in_bytes: expected.sizeInBytes,
    digest: `sha256:${expected.archiveSha256}`, expired: false, expires_at: expected.expiresAt };
  assert.doesNotThrow(() => verifyArtifactMetadata(actual, expected, Date.parse('2026-10-03T00:00:00Z')));
  assert.throws(() => verifyArtifactMetadata({ ...actual, digest: `sha256:${'0'.repeat(64)}` }, expected, 0), /immutable pin/);
  assert.throws(() => verifyArtifactMetadata(actual, expected, Date.parse(expected.expiresAt)), /immutable pin/);
});

test('archive verifier refuses extra members and altered bytes without extracting paths', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pii-eval-zip-'));
  const bytes = Buffer.from('public synthetic\n');
  writeFileSync(path.join(directory, 'public.json'), bytes);
  const archive = path.join(directory, 'artifact.zip');
  execFileSync('zip', ['-q', archive, 'public.json'], { cwd: directory });
  const expected = { name: 'synthetic', members: { 'public.json': createHash('sha256').update(bytes).digest('hex') } };
  assert.deepEqual(verifyArchiveMembers(archive, expected)['public.json'], bytes);
  assert.throws(() => verifyArchiveMembers(archive, { ...expected, members: { 'public.json': '0'.repeat(64) } }), /member digest/);
  writeFileSync(path.join(directory, 'extra.json'), '{}');
  execFileSync('zip', ['-q', archive, 'extra.json'], { cwd: directory });
  assert.throws(() => verifyArchiveMembers(archive, expected), /member set/);
});

test('public workflow isolates App credentials and publisher consumes only staging public evidence', () => {
  const dedicated = YAML.parse(readFileSync(new URL('../.github/workflows/pii-public-synthetic.yml', import.meta.url), 'utf8'));
  const publish = YAML.parse(readFileSync(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8'));
  assert.deepEqual(dedicated.permissions, {});
  assert.deepEqual(dedicated.jobs['public-synthetic'].permissions, { contents: 'read' });
  const token = dedicated.jobs['public-synthetic'].steps.find(step => step.id === 'token');
  assert.equal(token.with['app-id'], source.app.id);
  assert.equal(token.with.repositories, source.app.repository);
  assert.equal(token.with['permission-actions'], 'read');
  // #689: a failed mint is reported as missing App installation access, apart from artifact/pin validation, without broadening the token.
  const job = dedicated.jobs['public-synthetic'];
  assert.equal(token['continue-on-error'], true);
  assert.deepEqual(job.env, { PII_EVAL_APP_ID: source.app.id, PII_EVAL_OWNER: source.app.owner, PII_EVAL_REPO: source.app.repository });
  const preflight = job.steps.find(step => step.if === "steps.token.outcome != 'success'");
  assert.match(preflight.run, /contents: read.*actions: read/);
  assert.match(preflight.run, /PII_EVAL_APP_ID.*PII_EVAL_OWNER.*PII_EVAL_REPO/s);
  assert.match(preflight.run, /not an artifact or pin validation failure/);
  assert.doesNotMatch(preflight.run, /secrets\.|PRIVATE_KEY\}|\$\{PII_EVAL_APP_PRIVATE_KEY/);
  assert.equal(job.steps.indexOf(preflight), job.steps.indexOf(token) + 1);
  const fetch = dedicated.jobs['public-synthetic'].steps.find(step => step.env?.GH_TOKEN);
  assert.match(fetch.run, /fetch-pii-eval-public-synthetic.mjs fetch/);
  assert.equal(dedicated.jobs['public-synthetic'].steps.filter(step => step.env?.GH_TOKEN).length, 1);
  const caller = publish.jobs['pii-public-synthetic'];
  assert.match(caller.if, /== 'staging'/);
  assert.equal(caller.uses, './.github/workflows/pii-public-synthetic.yml');
  assert.equal(publish.jobs.publish.needs, 'pii-public-synthetic');
  assert.equal(publish.jobs.publish.steps.some(step => step.env?.GH_TOKEN?.includes('pii-eval')), false);
  const classify = publish.jobs.publish.steps.find(step => step.name === 'Classify support').run;
  assert.match(classify, /pii_eval_args=\(\)/);
  assert.match(classify, /--pii-eval-pins=benchmarks\/pii-eval-public-synthetic-pins.json/);
  assert.match(classify, /--pii-eval-artifact="\$RUNNER_TEMP\/pii-eval-public\/public-synthetic-artifact.json"/);
});
