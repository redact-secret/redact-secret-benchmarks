import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expectedFiles, tarMembersProblems, verifyDirectory } from '../scripts/official-run-archive.mjs';

// Structure only, on synthetic registries and bytes: no digest, run id or count read from the committed registry is asserted
// (a repin or a new official run re-keys them).

const digest = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const registryOf = files => ({
  runs: [
    ...Object.entries(files).map(([id, [population, kind, text]]) => ({ id, population, kind, platform: 'linux-x64', canonical: true, artifact: { byteDigest: digest(text) } })),
    { id: 'local', population: 'p-one', platform: 'darwin-arm64', canonical: false, artifact: { byteDigest: digest('local') } },
  ],
});
const files = { 'p-one@linux-x64': ['p-one', null, 'one'], 'p-two@linux-x64': ['p-two', null, 'two'], 'p-one+methods@linux-x64': ['p-one', 'methods', 'methods'] };
const registry = registryOf(files);

async function layout(overrides = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'archive-test-'));
  const content = { 'p-one/artifact.json': 'one', 'p-two/artifact.json': 'two', 'p-one/methods/artifact.json': 'methods', ...overrides };
  for (const [rel, text] of Object.entries(content)) {
    if (text === null) continue;
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text);
  }
  return dir;
}

test('the archive holds one file per canonical run of the platform, the methods run beside its plain run', () => {
  assert.deepEqual(expectedFiles(registry, 'linux-x64').map(f => f.rel).sort(), ['p-one/artifact.json', 'p-one/methods/artifact.json', 'p-two/artifact.json']);
  assert.throws(() => expectedFiles(registry, 'win-x64'), /no canonical/);
  const unrecorded = structuredClone(registry);
  delete unrecorded.runs[0].artifact.byteDigest;
  assert.throws(() => expectedFiles(unrecorded, 'linux-x64'), /no byte digest/);
});

test('a directory of exactly the recorded bytes verifies', async () => {
  const dir = await layout();
  try { assert.deepEqual(await verifyDirectory(dir, registry, 'linux-x64'), []); } finally { await rm(dir, { recursive: true, force: true }); }
});

test('an altered, missing, extra or linked file fails closed', async () => {
  const altered = await layout({ 'p-two/artifact.json': 'tampered' });
  const missing = await layout({ 'p-one/methods/artifact.json': null });
  const extra = await layout({ 'p-three/artifact.json': 'extra' });
  const linked = await layout({ 'p-two/artifact.json': null });
  await mkdir(path.join(linked, 'p-two'));
  await symlink(path.join(linked, 'p-one/artifact.json'), path.join(linked, 'p-two/artifact.json'));
  try {
    assert.ok((await verifyDirectory(altered, registry, 'linux-x64')).some(p => /p-two\/artifact\.json hashes to/.test(p)));
    assert.ok((await verifyDirectory(missing, registry, 'linux-x64')).some(p => /missing/.test(p)));
    assert.ok((await verifyDirectory(extra, registry, 'linux-x64')).some(p => /not a recorded artifact/.test(p)));
    assert.ok((await verifyDirectory(linked, registry, 'linux-x64')).some(p => /not a regular file/.test(p)));
    assert.ok((await verifyDirectory(path.join(altered, 'nowhere'), registry, 'linux-x64')).length > 0);
  } finally {
    for (const dir of [altered, missing, extra, linked]) await rm(dir, { recursive: true, force: true });
  }
});

test('a tarball is refused unless its members are exactly the recorded files', () => {
  const expected = expectedFiles(registry, 'linux-x64');
  const names = expected.map(f => f.rel);
  assert.deepEqual(tarMembersProblems(names.join('\n'), expected), []);
  assert.deepEqual(tarMembersProblems(names.map(n => `./${n}`).join('\n'), expected), []);
  assert.ok(tarMembersProblems([...names, '../escape.json'].join('\n'), expected).some(p => /not a recorded artifact/.test(p)));
  assert.ok(tarMembersProblems([...names, '/abs/artifact.json'].join('\n'), expected).some(p => /not a recorded artifact/.test(p)));
  assert.ok(tarMembersProblems(names.slice(1).join('\n'), expected).some(p => /missing/.test(p)));
  assert.ok(tarMembersProblems([...names, names[0]].join('\n'), expected).some(p => /twice/.test(p)));
});

test('the real registry names a durable archive and every canonical file of it', async () => {
  const read = async rel => JSON.parse(await readFile(new URL(`../${rel}`, import.meta.url), 'utf8'));
  const archive = await read('benchmarks/official-run-archive.json');
  assert.equal(archive.schema, 'redact-secret/official-run-archive/v1');
  assert.match(archive.release.tag, /^official-runs-\d+$/);
  assert.ok(expectedFiles(await read('benchmarks/official-runs.json'), archive.platform).length >= 1);
});

test('publish-site.yml fetches the artifacts first, builds the view and the export, and publishes the export at the site root (#602)', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const at = text => { const i = workflow.indexOf(text); assert.ok(i >= 0, text); return i; };
  assert.ok(at('official-run-archive.mjs fetch') < at('- name: Measure the corpus'), 'a missing artifact fails before anything slow runs');
  assert.ok(at('- name: Build the qualification view') < at('- name: Build the Next export') && at('- name: Build the Next export') < at('- name: Assemble the site root') && at('- name: Assemble the site root') < at('aws-actions/configure-aws-credentials'), 'nothing is signed in until the export is built, checked, assembled and guarded');
  assert.doesNotMatch(workflow, /- name: Build the site\b/, 'the legacy site UI is not built');
  assert.doesNotMatch(workflow, /VITE_/, 'no legacy build variable');
  const build = workflow.slice(at('- name: Build the Next export'), at('- name: Assemble the site root'));
  assert.match(build, /WEB_REQUIRE_QUALIFICATION: '1'/);
  assert.match(build, /npm run check:routes/);
  assert.match(build, /BASE_PATH: ''/, 'the export is built for the root');
  const assemble = workflow.slice(at('- name: Assemble the site root'), at('aws-actions/configure-aws-credentials'));
  assert.match(assemble, /node scripts\/assemble-site\.mjs/);
  assert.match(assemble, /npm run features:check-public/);
  assert.match(assemble, /npm run blind:check-public/);
  assert.doesNotMatch(workflow, /dist\/next|dist\/assets|next\/_next/, 'nothing is placed under /next/ or synced from the legacy assets');
  assert.match(workflow, /aws s3 sync dist\/_next\/static "s3:\/\/\$bucket\/_next\/static"/);
  const jobPermissions = workflow.slice(workflow.indexOf('    permissions:\n      contents: read'), workflow.indexOf('    env:\n      AWS_REGION'));
  assert.equal(jobPermissions.trim().split('\n').length, 3, 'the job still has only contents: read and id-token: write');
  assert.match(workflow, /--exclude '_next\/static\/\*'/);
  assert.match(workflow, /aws s3 sync dist "s3:\/\/\$bucket" --only-show-errors --delete/, 'the final sync clears the legacy index.html');
});
