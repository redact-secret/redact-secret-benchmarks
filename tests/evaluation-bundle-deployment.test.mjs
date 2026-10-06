// Synthetic rehearsal of the evaluation bundle deployment (#791). The bucket is a local directory; the steps are the order publish-site.yml runs them (immutable bundle directory, read-back
// verification, other artifacts, rollback copies, mutable pointer, domain index last). No scanner runs, no retained evidence, no AWS.
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { BUNDLES_DIR, POINTER_FILE, resolveBundle, validateBundle } from '../benchmarks/evaluation/bundle/bundle.ts';
import { assembleSite } from '../scripts/assemble-site.mjs';
import { DOMAIN_INDEX_FILE, bundleProblems, domainIndexProblems, publicationProblems, retentionPlan } from '../scripts/lib/evaluation-bundle-deployment.mjs';
import { publishSyntheticBundle, tempDirectory } from './support/evaluation-bundle-fixture.mjs';

const writeJson = (file, value) => mkdir(path.dirname(file), { recursive: true }).then(() => writeFile(file, `${JSON.stringify(value)}\n`));
const indexFor = pointer => ({ domains: [{ domain: 'credential', evaluation: { href: `/results/${pointer.manifest.path}`, artifactCommitment: pointer.manifest.sha256 } }] });
const exists = file => stat(file).then(() => true, () => false);

/** One site root (what assemble would ship) holding exactly one bundle, its pointer and a matching domain index. */
async function siteRoot(runId) {
  const root = await tempDirectory('bundle-site-');
  const results = path.join(root, 'results');
  const { pointer } = await publishSyntheticBundle(results, { runId });
  await writeJson(path.join(results, DOMAIN_INDEX_FILE), indexFor(pointer));
  await writeJson(path.join(results, 'review-ledger-v2.json'), { runId });
  return { root, results, pointer };
}

/** The deployment steps against a local "bucket" results directory, in the workflow's order. `stopBefore` simulates an interruption (a failed step). */
async function deploy(site, bucket, { stopBefore = null } = {}) {
  const step = async (name, run) => { if (stopBefore === name) throw new Error(`interrupted before ${name}`); await run(); };
  const id = site.pointer.bundleId;
  await step('upload-bundle', () => cp(path.join(site.results, BUNDLES_DIR, id), path.join(bucket, BUNDLES_DIR, id), { recursive: true }));
  await step('verify-readback', async () => {
    const readback = await tempDirectory('bundle-readback-');
    await cp(path.join(bucket, BUNDLES_DIR, id), path.join(readback, BUNDLES_DIR, id), { recursive: true });
    await cp(path.join(site.results, POINTER_FILE), path.join(readback, POINTER_FILE));
    const { problems } = await bundleProblems(readback, { onlyCurrentBundle: false });
    await rm(readback, { recursive: true, force: true });
    if (problems.length) throw new Error(`read-back failed: ${problems.join('; ')}`);
  });
  await step('other-artifacts', () => cp(path.join(site.results, 'review-ledger-v2.json'), path.join(bucket, 'review-ledger-v2.json')));
  await step('rollback-copies', async () => {
    for (const file of [POINTER_FILE, DOMAIN_INDEX_FILE]) if (await exists(path.join(bucket, file))) await cp(path.join(bucket, file), path.join(bucket, 'rollback', file));
  });
  await step('pointer', () => cp(path.join(site.results, POINTER_FILE), path.join(bucket, POINTER_FILE)));
  await step('domain-index', () => cp(path.join(site.results, DOMAIN_INDEX_FILE), path.join(bucket, DOMAIN_INDEX_FILE)));
}

/** What a reader of the bucket sees: the pointer resolves, every part validates, and the index agrees. */
async function readBucket(bucket) {
  const { pointer, directory } = await resolveBundle(bucket);
  const validation = await validateBundle(directory);
  return { pointer, validation, indexProblems: await domainIndexProblems(bucket, pointer) };
}

test('interrupted publication leaves the previous bundle complete and the new parts unreferenced', async () => {
  const a = await siteRoot('run-a'), b = await siteRoot('run-b'), bucket = await tempDirectory('bundle-bucket-');
  try {
    await deploy(a, bucket);
    for (const stopBefore of ['verify-readback', 'other-artifacts', 'rollback-copies', 'pointer', 'domain-index']) {
      await assert.rejects(deploy(b, bucket, { stopBefore }), /interrupted/);
      const seen = await readBucket(bucket);
      if (stopBefore === 'domain-index') {
        // The pointer moved, the index did not: the two disagree and a reader refuses to combine them (the interruption is recoverable by redeploying or rolling back).
        assert.equal(seen.pointer.bundleId, b.pointer.bundleId);
        assert.ok(seen.indexProblems.length, 'a new pointer with the old index is detected');
      } else {
        assert.equal(seen.pointer.bundleId, a.pointer.bundleId, `before ${stopBefore} the old pointer still rules`);
        assert.deepEqual(seen.indexProblems, []);
      }
      await cp(a.results, bucket, { recursive: true, filter: s => !s.includes(BUNDLES_DIR) || s.includes(a.pointer.bundleId) || s.endsWith(BUNDLES_DIR) }); // restore the old committed state between iterations
      await cp(path.join(a.results, POINTER_FILE), path.join(bucket, POINTER_FILE));
    }
    assert.ok(await exists(path.join(bucket, BUNDLES_DIR, b.pointer.bundleId, 'manifest.json')), 'the uploaded parts of the interrupted run are harmless and retained until pruned');
  } finally { for (const dir of [a.root, b.root, bucket]) await rm(dir, { recursive: true, force: true }); }
});

test('an old reader keeps resolving the old manifest and all its parts throughout a deployment, and the new one after', async () => {
  const a = await siteRoot('run-a'), b = await siteRoot('run-b'), bucket = await tempDirectory('bundle-bucket-');
  try {
    await deploy(a, bucket);
    const before = await readBucket(bucket);
    // Mid-deployment: the new immutable bundle is uploaded and verified, nothing mutable has moved.
    await assert.rejects(deploy(b, bucket, { stopBefore: 'other-artifacts' }), /interrupted/);
    const during = await readBucket(bucket);
    assert.equal(during.pointer.manifest.sha256, before.pointer.manifest.sha256);
    assert.deepEqual(during.indexProblems, []);
    assert.equal(during.validation.manifest.cases.length, before.validation.manifest.cases.length);
    await deploy(b, bucket);
    const after = await readBucket(bucket);
    assert.equal(after.pointer.bundleId, b.pointer.bundleId);
    assert.deepEqual(after.indexProblems, []);
    // The old manifest target is still reachable by anything that cached the old pointer.
    assert.equal((await validateBundle(path.join(bucket, BUNDLES_DIR, a.pointer.bundleId))).manifestSha256, before.pointer.manifest.sha256);
  } finally { for (const dir of [a.root, b.root, bucket]) await rm(dir, { recursive: true, force: true }); }
});

test('rollback re-points to the previous manifest, with every part present', async () => {
  const a = await siteRoot('run-a'), b = await siteRoot('run-b'), bucket = await tempDirectory('bundle-bucket-');
  try {
    await deploy(a, bucket);
    await deploy(b, bucket);
    // The runbook: copy the saved rollback pointer and index back (pointer first is safe, the index last commits).
    await cp(path.join(bucket, 'rollback', POINTER_FILE), path.join(bucket, POINTER_FILE));
    await cp(path.join(bucket, 'rollback', DOMAIN_INDEX_FILE), path.join(bucket, DOMAIN_INDEX_FILE));
    const seen = await readBucket(bucket);
    assert.equal(seen.pointer.bundleId, a.pointer.bundleId);
    assert.deepEqual(seen.indexProblems, []);
    const { problems, inspected, manifest } = await bundleProblems(bucket, { onlyCurrentBundle: false });
    assert.deepEqual(problems, []);
    assert.equal(inspected, manifest.cases.length + manifest.reviews.length + 2);
  } finally { for (const dir of [a.root, b.root, bucket]) await rm(dir, { recursive: true, force: true }); }
});

test('retention never prunes a referenced bundle, and the previous one stays through a prune', async () => {
  const id = n => String(n).repeat(32);
  const present = [id(1), id(2), id(3), 'next-static', id(4)];
  const plan = retentionPlan({ present, current: id(4), previous: id(3), live: id(3) });
  assert.deepEqual(plan.keep.sort(), [id(3), id(4)]);
  assert.deepEqual(plan.prune, [id(1), id(2)]);
  assert.deepEqual(plan.ignored, ['next-static'], 'anything that is not a bundle id is never touched');
  // A live pointer that names an older bundle than the previous one (a concurrent rollback) keeps that one too.
  assert.deepEqual(retentionPlan({ present, current: id(4), previous: id(3), live: id(2) }).prune, [id(1)]);
  assert.throws(() => retentionPlan({ present: [id(1)], current: id(4), previous: id(1) }), /not among the stored bundles/);
  assert.throws(() => retentionPlan({ present: [id(4)], current: id(4), live: id(1) }), /live bundle/);
  assert.deepEqual(retentionPlan({ present: [id(4)], current: id(4), previous: id(1) }).prune, [], 'an already pruned previous bundle is not an error');
  // Applied to real bundles: after the prune both kept bundles still validate.
  const a = await siteRoot('run-a'), b = await siteRoot('run-b'), c = await siteRoot('run-c'), bucket = await tempDirectory('bundle-bucket-');
  try {
    await deploy(a, bucket); await deploy(b, bucket); await deploy(c, bucket);
    const present2 = await readdir(path.join(bucket, BUNDLES_DIR));
    const { keep, prune } = retentionPlan({ present: present2, current: c.pointer.bundleId, previous: b.pointer.bundleId, live: (await resolveBundle(bucket)).pointer.bundleId });
    assert.deepEqual(prune, [a.pointer.bundleId]);
    for (const old of prune) await rm(path.join(bucket, BUNDLES_DIR, old), { recursive: true });
    for (const kept of keep) assert.ok((await validateBundle(path.join(bucket, BUNDLES_DIR, kept))).manifest);
    assert.deepEqual((await readBucket(bucket)).indexProblems, []);
  } finally { for (const dir of [a.root, b.root, c.root, bucket]) await rm(dir, { recursive: true, force: true }); }
});

test('a mismatched pointer, manifest or domain index is refused rather than combined', async () => {
  const a = await siteRoot('run-a'), b = await siteRoot('run-b');
  try {
    // Pointer digest of another manifest.
    await writeJson(path.join(a.results, POINTER_FILE), { ...a.pointer, manifest: { ...a.pointer.manifest, sha256: b.pointer.manifest.sha256 } });
    assert.match((await bundleProblems(a.results)).problems.join('\n'), /not the one the pointer commits to/);
    await writeJson(path.join(a.results, POINTER_FILE), a.pointer);
    // Pointer naming a bundle id whose directory holds another bundle's manifest.
    await rm(path.join(a.results, BUNDLES_DIR, a.pointer.bundleId), { recursive: true });
    await cp(path.join(b.results, BUNDLES_DIR, b.pointer.bundleId), path.join(a.results, BUNDLES_DIR, a.pointer.bundleId), { recursive: true });
    assert.ok((await bundleProblems(a.results)).problems.length, 'a manifest of another bundle under the pointer\'s id is refused');
    // Index commitment of the other run, and an index href of the other bundle.
    assert.match((await domainIndexProblems(a.results, b.pointer)).join('\n'), /disagree|href/);
    const wrongCommitment = { domains: [{ domain: 'credential', evaluation: { href: `/results/${b.pointer.manifest.path}`, artifactCommitment: a.pointer.manifest.sha256 } }] };
    await writeJson(path.join(b.results, DOMAIN_INDEX_FILE), wrongCommitment);
    assert.match((await publicationProblems(b.root)).problems.join('\n'), /artifact commitment/);
    const legacyHref = { domains: [{ domain: 'credential', evaluation: { href: '/results/evaluation-v1.json', artifactCommitment: b.pointer.manifest.sha256 } }] };
    await writeJson(path.join(b.results, DOMAIN_INDEX_FILE), legacyHref);
    assert.match((await publicationProblems(b.root)).problems.join('\n'), /href/);
    await rm(path.join(b.results, DOMAIN_INDEX_FILE));
    assert.match((await publicationProblems(b.root)).problems.join('\n'), /absent/);
  } finally { for (const dir of [a.root, b.root]) await rm(dir, { recursive: true, force: true }); }
});

test('the dist guard rejects staging and internal files, extra parts and other bundles', async () => {
  const a = await siteRoot('run-a'), b = await siteRoot('run-b');
  try {
    assert.deepEqual((await publicationProblems(a.root)).problems, [], 'the clean site passes');
    const cases = [
      ['results/.evaluation-bundle-run-x.staging/cases/benign-0000.json', '{}', /staging or internal/],
      ['results-output/evaluation/header.json', '{}', /staging or internal/],
      ['results/evaluation.json', '{}', /raw discovery/],
      ['results/results-0000.jsonl', '{}', /raw discovery|staging/],
      [`results/${BUNDLES_DIR}/${a.pointer.bundleId}/cases/stray-0000.json`, '{}', /not referenced by the manifest/],
      [`results/${BUNDLES_DIR}/${a.pointer.bundleId}/notes.txt`, 'x', /not referenced by the manifest/],
      ['results/evaluation-bundle-v1.json.tmp', '{}', /staging or internal/],
    ];
    for (const [file, text, expected] of cases) {
      await mkdir(path.dirname(path.join(a.root, file)), { recursive: true });
      await writeFile(path.join(a.root, file), text);
      assert.match((await publicationProblems(a.root)).problems.join('\n'), expected, file);
      await rm(path.join(a.root, file), { recursive: true, force: true });
      await rm(path.join(a.root, file.split('/')[0] === 'results-output' ? 'results-output' : '.none'), { recursive: true, force: true });
    }
    await cp(path.join(b.results, BUNDLES_DIR, b.pointer.bundleId), path.join(a.results, BUNDLES_DIR, b.pointer.bundleId), { recursive: true });
    assert.match((await publicationProblems(a.root)).problems.join('\n'), /only the current bundle ships/);
    await rm(path.join(a.results, BUNDLES_DIR, b.pointer.bundleId), { recursive: true });
    // Every referenced file is inspected by the existing exclusion rules, including a detail part.
    const manifest = JSON.parse(await readFile(path.join(a.results, BUNDLES_DIR, a.pointer.bundleId, 'manifest.json'), 'utf8'));
    const part = path.join(a.results, BUNDLES_DIR, a.pointer.bundleId, manifest.cases.at(-1).path);
    const original = await readFile(part, 'utf8');
    await writeFile(part, `${original.trimEnd()}\n"candidate-features-v1.json"\n`);
    assert.match((await publicationProblems(a.root)).problems.join('\n'), /candidate-feature/);
    await writeFile(part, original);
    assert.deepEqual((await publicationProblems(a.root)).problems, []);
  } finally { for (const dir of [a.root, b.root]) await rm(dir, { recursive: true, force: true }); }
});

test('assembling filters staging files and unreferenced bundles, validates the bundle and refuses a missing one', async () => {
  const a = await siteRoot('run-a'), b = await siteRoot('run-b'), work = await tempDirectory('bundle-assemble-');
  try {
    const webOut = path.join(work, 'out');
    for (const f of ['index.html', 'robots.txt', 'favicon.svg', '404.html', 'report/index.html', 'evaluation/qualification/index.html']) { await mkdir(path.dirname(path.join(webOut, f)), { recursive: true }); await writeFile(path.join(webOut, f), 'x'); }
    await writeFile(path.join(a.results, 'run.json'), '{}');
    await cp(path.join(b.results, BUNDLES_DIR, b.pointer.bundleId), path.join(a.results, BUNDLES_DIR, b.pointer.bundleId), { recursive: true });
    await mkdir(path.join(a.results, '.evaluation-bundle-run-z.staging'), { recursive: true });
    await writeFile(path.join(a.results, '.evaluation-bundle-run-z.staging', 'manifest.json'), '{}');
    await writeFile(path.join(a.results, `${POINTER_FILE}.tmp`), '{}');
    const out = path.join(work, 'dist');
    await assembleSite({ webOut, results: a.results, out, requireBundle: true });
    assert.deepEqual(await readdir(path.join(out, 'results', BUNDLES_DIR)), [a.pointer.bundleId]);
    assert.ok(!(await exists(path.join(out, 'results', '.evaluation-bundle-run-z.staging'))));
    assert.ok(!(await exists(path.join(out, 'results', `${POINTER_FILE}.tmp`))));
    assert.deepEqual((await publicationProblems(out)).problems, []);
    // A corrupted part fails the assembly.
    const manifest = JSON.parse(await readFile(path.join(a.results, BUNDLES_DIR, a.pointer.bundleId, 'manifest.json'), 'utf8'));
    await writeFile(path.join(a.results, BUNDLES_DIR, a.pointer.bundleId, manifest.cases[0].path), '{}\n');
    await assert.rejects(assembleSite({ webOut, results: a.results, out: path.join(work, 'dist2'), requireBundle: true }));
    // No bundle at all, when one is required.
    await rm(path.join(a.results, POINTER_FILE)); await rm(path.join(a.results, BUNDLES_DIR), { recursive: true });
    await assert.rejects(assembleSite({ webOut, results: a.results, out: path.join(work, 'dist3'), requireBundle: true }), /no evaluation-bundle-v1\.json/);
  } finally { for (const dir of [a.root, b.root, work]) await rm(dir, { recursive: true, force: true }); }
});

test('publish-site.yml uploads the bundle, verifies it, and moves the pointer and the index last, outside the --delete sync', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const at = text => { const i = workflow.indexOf(text); assert.ok(i >= 0, `publish-site.yml has no ${text}`); return i; };
  const order = ['evaluation-bundles/$bundle_id" --only-show-errors', 'check-evaluation-bundle-publication.mjs --listing', 'aws s3 sync dist "s3://$bucket"', 'results/rollback/evaluation-bundle-v1.json', 'aws s3 cp dist/results/evaluation-bundle-v1.json "s3://$bucket', 'aws s3 cp dist/results/evaluation-domains-v2.json "s3://$bucket', 'evaluation-bundle-retention.mjs'].map(at);
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'bundle directory, read-back, sync, rollback copies, pointer, index, then the separate prune');
  const sync = workflow.slice(at('aws s3 sync dist "s3://$bucket"'), at('aws s3 sync dist "s3://$bucket"') + 600);
  for (const excluded of ["'results/evaluation-bundles/*'", "'results/evaluation-bundle-v1.json'", "'results/rollback/*'"]) assert.ok(sync.includes(excluded), `the --delete sync excludes ${excluded}`);
  assert.ok(workflow.includes('public, max-age=31536000, immutable') && workflow.includes("'no-cache'"));
});

test('the upload is verified from the bucket listing (the publisher role cannot read objects): missing, resized and altered objects are refused', async () => {
  const { createHash } = await import('node:crypto');
  const { listingProblems } = await import('../scripts/lib/evaluation-bundle-deployment.mjs');
  const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dist = await mkdtemp(path.join(tmpdir(), 'listing-'));
  const id = 'a'.repeat(32), dir = path.join(dist, 'results', 'evaluation-bundles', id);
  try {
    await mkdir(path.join(dir, 'cases'), { recursive: true });
    const files = { 'manifest.json': '{"a":1}\n', 'cases/twin-0000.json': '{"b":2}\n' };
    for (const [name, text] of Object.entries(files)) await writeFile(path.join(dir, name), text);
    const rows = Object.entries(files).map(([name, text]) => ({ Key: `results/evaluation-bundles/${id}/${name}`, Size: Buffer.byteLength(text), ETag: `"${createHash('md5').update(text).digest('hex')}"` }));
    assert.deepEqual(await listingProblems({ rows, dist, bundleId: id }), []);
    assert.match((await listingProblems({ rows: rows.slice(1), dist, bundleId: id })).join(), /is not in the bucket/);
    assert.match((await listingProblems({ rows: [{ ...rows[0], Size: 1 }, rows[1]], dist, bundleId: id })).join(), /bytes in the bucket/);
    assert.match((await listingProblems({ rows: [{ ...rows[0], ETag: '"' + '0'.repeat(32) + '"' }, rows[1]], dist, bundleId: id })).join(), /another MD5/);
    assert.deepEqual(await listingProblems({ rows: [{ ...rows[0], ETag: '"abc-3"' }, rows[1]], dist, bundleId: id }), [], 'a multipart ETag is not an MD5, the size still binds');
    assert.match((await listingProblems({ rows: null, dist, bundleId: id })).join(), /not in the bucket/);
  } finally { await rm(dist, { recursive: true, force: true }); }
});
