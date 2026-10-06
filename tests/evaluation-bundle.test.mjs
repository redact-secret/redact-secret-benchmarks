import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BundleWriter, BundleError, BUNDLES_DIR, CASE_METHODS, POINTER_FILE, bundleCases, bundleReviews, checkManifest, commitBundle, ledgerViewOfBundle, pointerProblem, readSummary, resolveBundle, validateBundle } from '../benchmarks/evaluation/bundle/bundle.ts';
import { canonical, evaluationProblem, operatorEvidence, reviewLedgerPublicationProblem } from '../benchmarks/shared/evaluation-model.ts';
import { sha256Of, documentBytes } from '../benchmarks/evaluation/storage/parts.ts';
import { writeDiscoveryStore, openDiscovery } from '../benchmarks/evaluation/storage/discovery-store.ts';
import { loadCases } from '../benchmarks/evaluation/domains/credential/cases.ts';
import { createMethods } from '../benchmarks/evaluation/domains/credential/methods/index.ts';
import { createOperators } from '../benchmarks/evaluation/domains/credential/operators/index.ts';
import { runEvaluation } from '../benchmarks/evaluation/domains/credential/runner.ts';
import { assertPublicDiscovery, projectPublicCase, projectPublicReview, publicCaseAccepted, publicEvaluation, publicEvaluationSummary } from '../benchmarks/evaluation/domains/credential/public-report.ts';

// Synthetic only: no real credential, no scanner run (#788; contract: docs/specs/evaluation-report-storage.md).
const HASHES = { 'synthetic-corpus': 'c0ffee'.repeat(10) };
const CASES_HASH = 'a1'.repeat(32);
const observation = { source: 'fresh', observedAt: '2026-01-01T00:00:00.000Z', sourceRunId: 'run-synthetic' };
const SCANNERS = [
  { id: 'redact-secret', version: '1.0.0', status: 'complete', mode: 'test', configurationHash: '', observation },
  { id: 'peer', version: '2.0.0', status: 'complete', mode: 'test', configurationHash: '', observation },
  { id: 'offline', version: null, status: 'unavailable', mode: 'test', configurationHash: '', observation },
];
const variant = (id, over = {}) => ({ id, kind: 'must-redact', tier: 'T2', strategy: 'authored', operator: 'identity', property: '', relation: '', expectationEffect: '', contractMatch: null, ...over });
const assertionsFor = (v, status = 'pass') => SCANNERS.map(s => ({ scanner: s.id, type: 'absolute', status: s.status === 'complete' ? status : 'not-measured', variant: v.id, baseline: '', candidate: '' }));
const findingsFor = (v, count = 1) => SCANNERS.map(s => ({ scanner: s.id, variant: v.id, count: s.status === 'complete' ? count : 0, flagged: s.status === 'complete' ? count > 0 : null }));
const gen = [{ operator: 'identity', status: 'generated' }];
const slug = i => `synthetic--fixture-${i}`;
const caseId = (method, i) => `${method}-${String(i).padStart(5, '0')}`;
const sized = (n) => ['t'.repeat(n)]; // a case grown through its free-text `targets`, to steer sizes exactly

/** Valid public cases of every kind: passing, failing, zero-finding, T0 pending, mutation review-required, differential with a comparison. */
function makeCases(per = 6) {
  const cases = [], reviews = [];
  for (let i = 0; i < per; i++) {
    const v = variant('v1', { kind: i % 2 ? 'must-not-flag' : 'must-redact' });
    cases.push({ id: caseId('twin', i), method: 'twin', targets: ['github-token'], taxonomy: '', sourceSlug: slug(i), variants: [v], assertions: assertionsFor(v, i % 3 === 0 ? 'fail' : 'pass'), findings: findingsFor(v, i % 4 === 0 ? 0 : 1), generation: gen, comparisons: [] });
  }
  for (let i = 0; i < per; i++) {
    const v = variant('v1', { kind: 'must-not-flag' });
    cases.push({ id: caseId('benign', i), method: 'benign', targets: [], taxonomy: 'ordinary-prose', sourceSlug: slug(100 + i), variants: [v], assertions: assertionsFor(v), findings: findingsFor(v, 0), generation: gen, comparisons: [] });
  }
  for (let i = 0; i < per; i++) { // metamorphic with a T0 (pending) variant: every measured assertion is review-required, never scored
    const base = variant('base'), t0 = variant('t0', { tier: 'T0', relation: 'same-detection' });
    cases.push({ id: caseId('metamorphic', i), method: 'metamorphic', targets: ['github-token'], taxonomy: 'pending', sourceSlug: slug(200 + i), variants: [base, t0],
      assertions: [...assertionsFor(base), ...SCANNERS.map(s => ({ scanner: s.id, type: 'relational', status: s.status === 'complete' ? 'review-required' : 'not-measured', variant: 't0', baseline: 'base', candidate: 't0' }))],
      findings: [...findingsFor(base), ...findingsFor(t0)], generation: gen, comparisons: [] });
  }
  for (let i = 0; i < per; i++) { // mutation whose derived variant needs review
    const base = variant('base'), mut = variant('m1', { strategy: 'review-required', expectationEffect: 'defer' });
    cases.push({ id: caseId('mutation', i), method: 'mutation', targets: ['github-token'], taxonomy: '', sourceSlug: slug(300 + i), variants: [base, mut],
      assertions: [...assertionsFor(base), ...SCANNERS.map(s => ({ scanner: s.id, type: 'relational', status: s.status === 'complete' ? 'review-required' : 'not-measured', variant: 'm1', baseline: 'base', candidate: 'm1' }))],
      findings: [...findingsFor(base), ...findingsFor(mut)], generation: gen, comparisons: [] });
    reviews.push({ id: sha256Of(`mutation-review-${i}`), caseId: caseId('mutation', i), variant: 'm1', peer: '', disagreement: '' });
  }
  for (let i = 0; i < per; i++) {
    const v = variant('v1');
    cases.push({ id: caseId('differential', i), method: 'differential', targets: ['github-token'], taxonomy: '', sourceSlug: slug(400 + i), variants: [v], assertions: [], findings: findingsFor(v),
      generation: gen, comparisons: [{ peer: 'peer', variant: 'v1', status: 'complete', disagreement: 'redact-secret-only', classification: 'compared' }] });
    reviews.push({ id: sha256Of(`differential-review-${i}`), caseId: caseId('differential', i), variant: 'v1', peer: 'peer', disagreement: 'redact-secret-only' });
  }
  return { cases, reviews };
}
const summaryOf = (cases, reviews, over = {}) => ({ schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false, runId: 'run-synthetic',
  startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:05:00.000Z',
  provenance: { revision: 'r', dirty: false, casesHash: CASES_HASH, lockHash: '', methods: [{ id: 'twin', version: 1 }], operators: [{ id: 'identity', version: 1 }] },
  corpusHashes: HASHES, scanners: SCANNERS, review: { open: reviews.length, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: reviews.length ? 'run-synthetic' : null },
  byOperator: operatorEvidence(cases), qualification: null, ...over });
const wholeReport = (cases, reviews, over) => ({ ...summaryOf(cases, reviews, over), cases, reviews });
const root = async () => mkdtemp(path.join(tmpdir(), 'evaluation-bundle-'));

/** Writes a bundle to a staging directory (with a manifest) and returns what a test needs. `mutate` may edit the data the writer is given. */
async function stage(dir, cases, reviews, { maxPartBytes = 8192, summary = summaryOf(cases, reviews), run = { runId: summary.runId, casesHash: CASES_HASH }, name = 'staging' } = {}) {
  const staging = path.join(dir, name);
  const writer = new BundleWriter(staging, run, maxPartBytes);
  await writer.open();
  for (const c of cases) await writer.addCase(c);
  for (const r of reviews) await writer.addReview(r);
  const manifest = await writer.finish(summary);
  return { staging, manifest, writer };
}
const idOf = m => sha256Of(canonical({ summary: m.summary.sha256, cases: m.cases.map(p => [p.path, p.sha256]), reviews: m.reviews.map(p => [p.path, p.sha256]) })).slice(0, 32);
/** Forge a self-consistent bundle with an edited part: the digests and the id are recomputed, so only the semantic validation can refuse it. */
async function forge(directory, relative, edit) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const doc = JSON.parse(await readFile(path.join(directory, relative), 'utf8'));
  const edited = edit(doc) ?? doc;
  const bytes = documentBytes(edited);
  await writeFile(path.join(directory, relative), bytes);
  for (const ref of [manifest.summary, ...manifest.cases, ...manifest.reviews]) if (ref.path === relative) { ref.sha256 = sha256Of(bytes); ref.bytes = Buffer.byteLength(bytes); }
  manifest.bundleId = idOf(manifest);
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
async function forgeManifest(directory, edit, { reid = false } = {}) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  edit(manifest);
  if (reid) manifest.bundleId = idOf(manifest);
  await writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
const refused = (promise, pattern) => assert.rejects(promise, error => { assert.ok(error instanceof BundleError, `expected a BundleError, got ${error?.stack}`); if (pattern) assert.match(error.message, pattern); return true; });
const collect = async iterable => { const out = []; for await (const x of iterable) out.push(x); return out; };

test('the synthetic fixture is itself a valid whole public report', () => {
  const { cases, reviews } = makeCases();
  assert.equal(evaluationProblem(wholeReport(cases, reviews), HASHES), null);
});

test('write, commit and resolve: parts are bounded, ordered by method, and the totals are re-derived', async () => {
  const dir = await root();
  const { cases, reviews } = makeCases(40);
  const { staging, manifest, writer } = await stage(dir, cases, reviews, { maxPartBytes: 8192 });
  assert.ok(manifest.cases.length > 5 && manifest.reviews.length >= 1);
  assert.ok(writer.maxPartWritten <= 8192, `largest part ${writer.maxPartWritten}`);
  for (const p of [...manifest.cases, ...manifest.reviews]) { assert.ok(p.bytes <= 8192); assert.equal(p.oversized, undefined); }
  assert.deepEqual([...new Set(manifest.cases.map(p => p.method))], CASE_METHODS, 'method order is the canonical one');
  const results = path.join(dir, 'results');
  const { pointer, directory, validation } = await commitBundle(results, staging, manifest, { corpusHashes: HASHES });
  assert.equal(pointer.bundleId, manifest.bundleId);
  assert.equal(pointer.manifest.path, `${BUNDLES_DIR}/${manifest.bundleId}/manifest.json`);
  assert.equal(pointer.manifest.sha256, sha256Of(await readFile(path.join(directory, 'manifest.json'))));
  assert.equal(validation.manifest.totals.cases, 200);
  assert.equal(validation.manifest.totals.reviews, 80);
  assert.equal(validation.index.cases.size, 200);
  assert.equal(await stat(staging).then(() => true, () => false), false, 'the staging directory was moved, not copied');
  const resolved = await resolveBundle(results);
  assert.equal(resolved.manifest.bundleId, manifest.bundleId);
  assert.deepEqual(await readdir(results), [BUNDLES_DIR, POINTER_FILE].sort());
  // a summary read needs no detail part
  const summary = await readSummary(directory, resolved.manifest, HASHES);
  assert.equal(summary.runId, 'run-synthetic');
  assert.equal('cases' in summary, false);
  // streaming reads give the cases back, whole and in order
  assert.deepEqual(await collect(bundleCases(directory, manifest)), cases);
  assert.deepEqual(await collect(bundleCases(directory, manifest, 'mutation')), cases.filter(c => c.method === 'mutation'));
  assert.deepEqual(await collect(bundleReviews(directory, manifest)), reviews);
});

test('chunk boundary: parts that would overflow only through their envelope are split, never refused', async () => {
  const dir = await root();
  const limit = 2050;
  const v = variant('v1');
  const base = { method: 'twin', taxonomy: '', sourceSlug: slug(1), variants: [v], assertions: assertionsFor(v), findings: findingsFor(v), generation: gen, comparisons: [] };
  const probe = JSON.stringify({ ...base, id: caseId('twin', 0), targets: sized(0) }).length;
  // each case is limit/2 bytes with its separator: two of them fill the limit exactly before the envelope, so only the envelope can push a part over
  const pad = limit / 2 - 1 - probe;
  const cases = [0, 1, 2, 3].map(i => ({ ...base, id: caseId('twin', i), targets: sized(pad) }));
  assert.equal(Buffer.byteLength(JSON.stringify(cases[0])) + 1, limit / 2);
  const { staging, manifest } = await stage(dir, cases, [], { maxPartBytes: limit });
  for (const p of manifest.cases) assert.ok(p.bytes <= limit, `${p.path} is ${p.bytes} bytes, limit ${limit}`);
  assert.doesNotThrow(() => checkManifest(manifest));
  const { validation } = await commitBundle(path.join(dir, 'r'), staging, manifest);
  assert.equal(validation.manifest.totals.cases, 4);
});

test('an oversized single case is stored alone and whole, marked oversized, never cut', async () => {
  const dir = await root();
  const { cases, reviews } = makeCases(3);
  const big = { ...cases[0], id: caseId('twin', 99), targets: sized(6000) };
  const all = [cases[0], big, ...cases.slice(1)].sort((a, b) => CASE_METHODS.indexOf(a.method) - CASE_METHODS.indexOf(b.method));
  const { staging, manifest } = await stage(dir, all, reviews, { maxPartBytes: 2048 });
  const oversized = manifest.cases.filter(p => p.oversized);
  assert.equal(oversized.length, 1);
  assert.equal(oversized[0].records, 1);
  assert.ok(oversized[0].bytes > 2048);
  const { directory } = await commitBundle(path.join(dir, 'r'), staging, manifest, { corpusHashes: HASHES });
  const back = await collect(bundleCases(directory, manifest));
  assert.deepEqual(back.find(c => c.id === big.id), big, 'the whole case, byte for byte');
  assert.equal(back.length, all.length);
  // an unmarked over-limit part, or an oversized part with several records, is refused
  const unmarked = structuredClone(manifest); delete unmarked.cases.find(p => p.oversized).oversized;
  assert.throws(() => checkManifest(unmarked), /over the part limit/);
  const many = structuredClone(manifest); many.cases.find(p => p.oversized).records = 2;
  assert.throws(() => checkManifest(many), /over the part limit/);
});

test('Unicode in free text survives the bundle byte for byte', async () => {
  const dir = await root();
  const { cases, reviews } = makeCases(2);
  const unicode = cases.map((c, i) => ({ ...c, targets: [['🔑 key', 'a\u2028b\u2029c', 'e\u0301', '한국어 日本語', 'tab\tnewline\ncr\r'][i % 5]] }));
  const { staging, manifest } = await stage(dir, unicode, reviews);
  const { directory } = await commitBundle(path.join(dir, 'r'), staging, manifest, { corpusHashes: HASHES });
  assert.deepEqual(await collect(bundleCases(directory, manifest)), unicode);
});

test('old-vs-new equivalence on synthetic data: evaluationProblem accepts the whole report and the bundle holds the same cases, reviews and summary', async () => {
  const dir = await root();
  const { cases, reviews } = makeCases(25);
  const old = wholeReport(cases, reviews);
  assert.equal(evaluationProblem(old, HASHES), null);
  const { staging, manifest } = await stage(dir, cases, reviews, { maxPartBytes: 6144, summary: summaryOf(cases, reviews) });
  const { directory, validation } = await commitBundle(path.join(dir, 'r'), staging, manifest, { corpusHashes: HASHES });
  assert.equal(canonical(validation.summary), canonical(summaryOf(cases, reviews)));
  assert.equal(canonical(await collect(bundleCases(directory, manifest))), canonical(cases));
  assert.equal(canonical(await collect(bundleReviews(directory, manifest))), canonical(reviews));
  // the rebuilt whole report is accepted by the old validator: nothing was dropped or added by sharding
  const rebuilt = { ...validation.summary, cases: await collect(bundleCases(directory, manifest)), reviews: await collect(bundleReviews(directory, manifest)) };
  assert.equal(evaluationProblem(rebuilt, HASHES), null);
  assert.equal(canonical(rebuilt), canonical(old));
  // the same ledger view, derived from the index or from the whole report, says the same thing
  const view = ledgerViewOfBundle(validation.index);
  assert.equal(view.runId, old.runId);
  assert.equal(view.reviews.size, reviews.length);
  assert.equal(view.sourceSlugOf(cases[0].id), cases[0].sourceSlug);
  const entries = Object.fromEntries(reviews.map(r => [r.id, { decision: 'open', note: 'synthetic' }]));
  const ledger = { schemaVersion: 1, observationRun: { runId: old.runId, observedAt: old.finishedAt }, entries };
  assert.equal(typeof reviewLedgerPublicationProblem, 'function');
  assert.deepEqual([reviewLedgerPublicationProblem(ledger, ledger, view) === reviewLedgerPublicationProblem(ledger, ledger, old)], [true]);
});

test('discovery store to bundle equals publicEvaluation on a real engine run with an unavailable scanner', async () => {
  const dir = await root();
  const operators = createOperators(), sources = await loadCases(operators);
  const selected = ['twin', 'benign', 'mutation', 'differential'].map(m => sources.find(c => c.method === m));
  const scanners = [{ id: 'redact-secret', mode: 'test', async version() { return '1.0.0'; }, async scan() { return []; } },
    { id: 'peer', mode: 'test', async version() { throw Error('unavailable'); }, async scan() { return []; } }];
  const raw = await runEvaluation({ cases: selected, methods: createMethods(), operators, scanners });
  const hashes = { test: 'hash' };
  const expected = publicEvaluation(structuredClone(raw), sources, hashes);
  // discovery store round trip first, then the exact projection the publisher uses
  await writeDiscoveryStore(path.join(dir, 'discovery'), structuredClone(raw), { maxPartBytes: 4096 });
  const reader = await openDiscovery(path.join(dir, 'discovery'));
  const header = await reader.header();
  assertPublicDiscovery(header);
  const bySource = new Map(sources.map(s => [s.id, s]));
  const staging = path.join(dir, 'staging');
  const writer = new BundleWriter(staging, { runId: header.runId, casesHash: String(header.provenance.casesHash) }, 4096);
  await writer.open();
  for await (const result of reader.results()) {
    const source = bySource.get(result.id);
    assert.ok(source && publicCaseAccepted(source, result));
    await writer.addCase(projectPublicCase(source, result));
  }
  for await (const review of reader.reviewQueue()) await writer.addReview(projectPublicReview(review));
  const manifest = await writer.finish(publicEvaluationSummary(header, writer.operatorTotals(), hashes, null));
  const { directory, validation } = await commitBundle(path.join(dir, 'r'), staging, manifest, { corpusHashes: hashes });
  const { cases, reviews, ...summary } = expected;
  assert.equal(canonical(validation.summary), canonical(summary), 'same summary');
  assert.equal(canonical(await collect(bundleCases(directory, manifest))), canonical(cases), 'same cases, same order');
  assert.equal(canonical(await collect(bundleReviews(directory, manifest))), canonical(reviews), 'same reviews');
  assert.equal(validation.summary.scanners[1].status, 'unavailable');
  const peerAssertions = cases.flatMap(c => c.assertions).filter(a => a.scanner === 'peer');
  assert.ok(peerAssertions.length > 0 && peerAssertions.every(a => a.status === 'not-measured'), 'an unavailable scanner is not-measured, never pass');
});

test('zero-finding, pending (T0 review-required) and unavailable-scanner cases stay distinguishable', async () => {
  const dir = await root();
  const { cases, reviews } = makeCases(4);
  const { staging, manifest } = await stage(dir, cases, reviews);
  const { directory } = await commitBundle(path.join(dir, 'r'), staging, manifest, { corpusHashes: HASHES });
  const all = await collect(bundleCases(directory, manifest));
  const zero = all.find(c => c.method === 'twin' && c.findings.find(f => f.scanner === 'redact-secret').count === 0);
  assert.ok(zero, 'a zero-finding case exists');
  assert.equal(zero.findings.find(f => f.scanner === 'redact-secret').flagged, false);
  assert.equal(zero.findings.find(f => f.scanner === 'offline').flagged, null, 'unavailable is null, not false');
  const pending = all.find(c => c.method === 'metamorphic');
  const t0 = pending.assertions.filter(a => a.variant === 't0' && a.scanner === 'redact-secret');
  assert.ok(t0.length && t0.every(a => a.status === 'review-required'));
  assert.ok(pending.assertions.filter(a => a.scanner === 'offline').every(a => a.status === 'not-measured'));
  // the three states are three different statuses, none collapsed into another
  const statuses = new Set(all.flatMap(c => c.assertions.map(a => a.status)));
  assert.deepEqual([...statuses].sort(), ['fail', 'not-measured', 'pass', 'review-required']);
  // totals keep them apart
  const t = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')).totals.assertions;
  assert.ok(t.pass > 0 && t.fail > 0 && t['review-required'] > 0 && t['not-measured'] > 0);
  // a scanner that did not complete cannot report a measured status, and a T0 variant cannot be scored
  const scoredUnavailable = structuredClone(cases); scoredUnavailable.find(c => c.method === 'twin').assertions.find(a => a.scanner === 'offline').status = 'pass';
  const s1 = await stage(await root(), scoredUnavailable, reviews);
  await refused(validateBundle(s1.staging), /violates the public evaluation contract/);
  const scoredT0 = structuredClone(cases); scoredT0.find(c => c.method === 'metamorphic').assertions.find(a => a.variant === 't0' && a.scanner === 'redact-secret').status = 'fail';
  const s2 = await stage(await root(), scoredT0, reviews);
  await refused(validateBundle(s2.staging), /violates the public evaluation contract/);
});

test('refuses corrupt, truncated, missing and swapped parts', async () => {
  const build = async () => { const dir = await root(); const { cases, reviews } = makeCases(20); const { staging, manifest } = await stage(dir, cases, reviews, { maxPartBytes: 4096 }); return { dir, staging, manifest }; };
  { // a flipped byte of the same size
    const { staging, manifest } = await build(); const file = path.join(staging, manifest.cases[1].path);
    const text = await readFile(file, 'utf8'); await writeFile(file, text.replace('synthetic', 'syntheXic'));
    await refused(validateBundle(staging), /digest/);
  }
  { // truncated
    const { staging, manifest } = await build(); const file = path.join(staging, manifest.cases[0].path);
    await writeFile(file, (await readFile(file)).subarray(0, 100));
    await refused(validateBundle(staging), /bytes, the manifest records/);
  }
  { // missing detail part
    const { staging, manifest } = await build(); await rm(path.join(staging, manifest.reviews[0].path));
    await assert.rejects(validateBundle(staging));
  }
  { // missing summary
    const { staging } = await build(); await rm(path.join(staging, 'summary.json'));
    await assert.rejects(validateBundle(staging));
  }
  { // two parts swapped on disk
    const { staging, manifest } = await build();
    const a = path.join(staging, manifest.cases[0].path), b = path.join(staging, manifest.cases[1].path), tmp = `${a}.swap`;
    await rename(a, tmp); await rename(b, a); await rename(tmp, b);
    await assert.rejects(validateBundle(staging));
  }
  { // a part that is not JSON, with its digest made to match
    const { staging, manifest } = await build();
    const file = path.join(staging, manifest.cases[0].path), junk = 'not json\n';
    await writeFile(file, junk);
    await forgeManifest(staging, m => { m.cases[0].sha256 = sha256Of(junk); m.cases[0].bytes = junk.length; }, { reid: true });
    await assert.rejects(validateBundle(staging));
  }
});

test('refuses duplicate case and review ids, within a part, across parts and across methods', async () => {
  const { cases, reviews } = makeCases(8);
  const writerRefuses = await root();
  const w = new BundleWriter(path.join(writerRefuses, 's'), { runId: 'run-synthetic', casesHash: CASES_HASH }, 4096);
  await w.open(); await w.addCase(cases[0]);
  await assert.rejects(w.addCase(cases[0]), /Duplicate case id/);
  // a forged bundle: a case id repeated in a later part of the same method
  const dir = await root();
  const { staging, manifest } = await stage(dir, cases, reviews, { maxPartBytes: 1500 });
  const twins = manifest.cases.filter(p => p.method === 'twin');
  assert.ok(twins.length >= 2);
  await forge(staging, twins[1].path, doc => { doc.cases[0] = { ...structuredClone(cases[0]) }; });
  await refused(validateBundle(staging), /Duplicate case id|does not start and end/);
  // a repeated review id
  const dir2 = await root();
  const s2 = await stage(dir2, cases, reviews, { maxPartBytes: 1200 });
  assert.ok(s2.manifest.reviews.length >= 2);
  await forge(s2.staging, s2.manifest.reviews[1].path, doc => { doc.reviews[0] = { ...structuredClone(reviews[0]) }; });
  await refused(validateBundle(s2.staging), /Duplicate review id|does not start and end/);
  // the same part listed twice in the manifest
  const dir3 = await root();
  const s3 = await stage(dir3, cases, reviews, { maxPartBytes: 1500 });
  await forgeManifest(s3.staging, m => { m.cases.push(structuredClone(m.cases[0])); }, { reid: true });
  await refused(validateBundle(s3.staging), /listed twice|contiguous/);
});

test('refuses mixed-run shards and a summary of another run', async () => {
  const { cases, reviews } = makeCases(10);
  const dir = await root();
  const { staging, manifest } = await stage(dir, cases, reviews, { maxPartBytes: 4096 });
  await forge(staging, manifest.cases[2].path, doc => { doc.runId = 'another-run'; });
  await refused(validateBundle(staging), /belongs to another run/);
  const d2 = await root(); const s2 = await stage(d2, cases, reviews, { maxPartBytes: 4096 });
  await forge(s2.staging, s2.manifest.reviews[0].path, doc => { doc.casesHash = 'f'.repeat(64); });
  await refused(validateBundle(s2.staging), /belongs to another run/);
  const d3 = await root(); const s3 = await stage(d3, cases, reviews);
  await forge(s3.staging, 'summary.json', doc => { doc.report.runId = 'someone-elses-run'; });
  await refused(validateBundle(s3.staging), /another run than the manifest/);
  const d4 = await root(); const s4 = await stage(d4, cases, reviews);
  await forge(s4.staging, 'summary.json', doc => { doc.report.provenance.casesHash = 'e'.repeat(64); });
  await refused(validateBundle(s4.staging), /another run than the manifest/);
  // a part of one bundle dropped into another bundle of a different run is refused even when the manifest is re-digested to agree
  const d5 = await root();
  const other = await stage(d5, cases, reviews, { maxPartBytes: 4096, name: 'other', summary: summaryOf(cases, reviews, { runId: 'run-other' }), run: { runId: 'run-other', casesHash: CASES_HASH } });
  const mine = await stage(d5, cases, reviews, { maxPartBytes: 4096, name: 'mine' });
  const foreign = await readFile(path.join(other.staging, other.manifest.cases[0].path));
  await writeFile(path.join(mine.staging, mine.manifest.cases[0].path), foreign);
  await forgeManifest(mine.staging, m => { m.cases[0].sha256 = sha256Of(foreign); m.cases[0].bytes = foreign.length; }, { reid: true });
  await refused(validateBundle(mine.staging), /belongs to another run/);
});

test('refuses stale corpus hashes and an inconsistent summary', async () => {
  const { cases, reviews } = makeCases(6);
  const dir = await root();
  const { staging } = await stage(dir, cases, reviews);
  await validateBundle(staging, { corpusHashes: HASHES });
  await refused(validateBundle(staging, { corpusHashes: { 'synthetic-corpus': 'stale' } }), /Stale evaluation: fixture corpus changed/);
  await refused(validateBundle(staging, { corpusHashes: { other: 'x' } }), /Stale evaluation/);
  // operator totals that do not match the case evidence
  const d2 = await root();
  const s2 = await stage(d2, cases, reviews, { summary: summaryOf(cases, reviews, { byOperator: { identity: { generated: 1, unsupported: 0, error: 0, assertions: {} } } }) });
  await refused(validateBundle(s2.staging), /Operator totals do not match/);
  // review state that does not account for every review
  const d3 = await root();
  const s3 = await stage(d3, cases, reviews, { summary: summaryOf(cases, reviews, { review: { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null } }) });
  await refused(validateBundle(s3.staging), /Review state does not account/);
  // a scanner without an observation, and a snapshot observation without its digests
  for (const edit of [s => { delete s.scanners[0].observation.sourceRunId; }, s => { s.scanners[0].observation.source = 'snapshot'; }, s => { s.scanners = []; }, s => { s.corpusHashes = {}; }, s => { s.finishedAt = '2025-01-01T00:00:00.000Z'; }]) {
    const summary = structuredClone(summaryOf(cases, reviews)); edit(summary);
    const dx = await root(); const sx = await stage(dx, cases, reviews, { summary });
    await assert.rejects(validateBundle(sx.staging), BundleError);
  }
  // a qualification aggregate that claims support is refused
  const d4 = await root();
  const s4 = await stage(d4, cases, reviews, { summary: summaryOf(cases, reviews, { qualification: { supportClaims: true, reportType: 'qualification' } }) });
  await assert.rejects(validateBundle(s4.staging), BundleError);
});

test('refuses protected and extra fields: the public allowlist is closed', async () => {
  const { cases, reviews } = makeCases(4);
  const SENTINEL = 'PROTECTED_SENTINEL_DO_NOT_PUBLISH';
  const edits = {
    'extra case field': cs => { cs[0].content = SENTINEL; },
    'extra variant field': cs => { cs[0].variants[0].fixture = SENTINEL; },
    'extra assertion field': cs => { cs[0].assertions[0].expected = SENTINEL; },
    'extra finding field': cs => { cs[0].findings[0].excerpt = SENTINEL; },
    'extra comparison field': cs => { cs.find(c => c.method === 'differential').comparisons[0].raw = SENTINEL; },
    'holdout method': cs => { cs[0].method = 'holdout'; },
    'taxonomy outside the enum': cs => { cs[0].taxonomy = SENTINEL; },
  };
  for (const [name, edit] of Object.entries(edits)) {
    const copy = structuredClone(cases); edit(copy);
    const dir = await root();
    // the writer may refuse first (a method that is not public); otherwise the validator must
    const attempt = async () => { const { staging } = await stage(dir, copy, reviews); return validateBundle(staging); };
    await assert.rejects(attempt(), error => { assert.ok(error instanceof BundleError, `${name}: ${error.message}`); assert.ok(!error.message.includes(SENTINEL), 'the refusal never echoes protected text'); return true; }, name);
  }
  const copy = structuredClone(reviews); copy[0].content = SENTINEL;
  const dir = await root(); const { staging } = await stage(dir, cases, copy);
  await refused(validateBundle(staging), /violates the public review contract/);
  // extra fields in the summary, and in the part envelope
  const d2 = await root(); const s2 = await stage(d2, cases, reviews, { summary: summaryOf(cases, reviews, { hidden: SENTINEL }) });
  await refused(validateBundle(s2.staging), /Invalid public evaluation summary contract/);
  const d3 = await root(); const s3 = await stage(d3, cases, reviews, { maxPartBytes: 4096 });
  await forge(s3.staging, s3.manifest.cases[0].path, doc => { doc.leak = SENTINEL; });
  await refused(validateBundle(s3.staging), /violates the public case contract/);
});

test('refuses invalid review references and a case in a part of the wrong method', async () => {
  const { cases, reviews } = makeCases(5);
  const attempts = {
    'unknown case': rs => { rs[0].caseId = 'no-such-case'; },
    'unknown variant': rs => { rs[0].variant = 'no-such-variant'; },
    'mutation review on a variant that is not review-required': rs => { rs[0].variant = 'base'; },
    'mutation review with a peer': rs => { rs[0].peer = 'peer'; },
    'differential review without its comparison': rs => { rs.find(r => r.peer).disagreement = 'peer-only'; },
    'review of a twin case': rs => { rs[0].caseId = caseId('twin', 0); rs[0].variant = 'v1'; },
  };
  for (const [name, edit] of Object.entries(attempts)) {
    const copy = structuredClone(reviews); edit(copy);
    const dir = await root(); const { staging } = await stage(dir, cases, copy);
    await refused(validateBundle(staging), /Review [a-f0-9]+ violates the public evaluation contract/);
    void name;
  }
  // a mutation case filed in a twin part
  const dir = await root();
  const { staging, manifest } = await stage(dir, cases, reviews, { maxPartBytes: 4096 });
  const twin = manifest.cases.find(p => p.method === 'twin');
  const mutation = cases.find(c => c.method === 'mutation');
  await forge(staging, twin.path, doc => { doc.cases[0] = mutation; });
  await refused(validateBundle(staging), /does not start and end|is stored in a twin part|over the part limit/);
});

test('refuses inconsistent manifest totals and a tampered manifest', async () => {
  const { cases, reviews } = makeCases(8);
  const edits = {
    cases: m => { m.totals.cases += 1; }, variants: m => { m.totals.variants -= 1; }, reviews: m => { m.totals.reviews += 1; },
    assertions: m => { m.totals.assertions.pass += 1; }, byMethod: m => { m.totals.byMethod.twin.cases += 1; },
  };
  for (const [name, edit] of Object.entries(edits)) {
    const dir = await root(); const { staging } = await stage(dir, cases, reviews, { maxPartBytes: 4096 });
    await forgeManifest(staging, edit, { reid: true });
    await refused(validateBundle(staging), /Manifest totals do not match the detail evidence/, name);
  }
  const structural = {
    'record count of a part': m => { m.cases[0].records += 1; },
    'first id of a part': m => { m.cases[0].firstId = 'nope'; },
    'method of a part': m => { m.cases[0].method = 'benign'; },
    'unsupported schema': m => { m.schema = 'redact-secret/evaluation-bundle/v2'; },
    'another scoring identity': m => { m.report.accountingVersion = '1.2'; },
    'bundle id': m => { m.bundleId = 'f'.repeat(32); },
    'summary path': m => { m.summary.path = 'cases/x.json'; },
    'a gap in the part sequence': m => { m.cases[0].index = 5; },
    'parts out of method order': m => { m.cases.reverse(); },
    'run id': m => { m.runId = 'other'; },
  };
  for (const [name, edit] of Object.entries(structural)) {
    const dir = await root(); const { staging } = await stage(dir, cases, reviews, { maxPartBytes: 4096 });
    await forgeManifest(staging, edit);
    await assert.rejects(validateBundle(staging), BundleError, name);
  }
  // a manifest changed byte-wise after the pointer committed to it is not the committed one
  const dir = await root(); const results = path.join(dir, 'r');
  const { staging, manifest } = await stage(dir, cases, reviews);
  const { directory } = await commitBundle(results, staging, manifest, { corpusHashes: HASHES });
  await resolveBundle(results);
  const file = path.join(directory, 'manifest.json');
  await writeFile(file, (await readFile(file, 'utf8')).replace('"runId"', '"runId" '));
  await refused(resolveBundle(results), /not the one the pointer commits to/);
});

test('refuses path traversal and unsafe part paths in a manifest', async () => {
  const { cases, reviews } = makeCases(4);
  for (const bad of ['../evil.json', '/etc/passwd', 'cases/../../x.json', 'cases//x.json', './cases/x.json', 'cases/x\\y.json', 'cases/..', '', 'C:/x.json', 'cases/x.json\0']) {
    const dir = await root(); const { staging } = await stage(dir, cases, reviews, { maxPartBytes: 4096 });
    await writeFile(path.join(dir, 'evil.json'), '{}\n');
    await forgeManifest(staging, m => { m.cases[0].path = bad; }, { reid: true });
    await refused(validateBundle(staging), /plain relative path|out of canonical method order|invalid digest/, JSON.stringify(bad));
  }
  for (const bad of ['../x', 'a/../b', '/abs']) assert.ok(pointerProblem({ schema: 'redact-secret/evaluation-bundle-pointer/v1', bundleId: 'a'.repeat(32), runId: 'r', manifest: { path: bad, sha256: 'a'.repeat(64), bytes: 1 } }));
});

test('a pointer that does not match its manifest is refused', async () => {
  const { cases, reviews } = makeCases(6);
  const dir = await root(); const results = path.join(dir, 'r');
  const { staging, manifest } = await stage(dir, cases, reviews);
  const { pointer } = await commitBundle(results, staging, manifest, { corpusHashes: HASHES });
  const file = path.join(results, POINTER_FILE);
  const set = async edit => { const p = structuredClone(pointer); edit(p); await writeFile(file, JSON.stringify(p)); };
  await set(() => {}); await resolveBundle(results);
  await set(p => { p.manifest.sha256 = 'b'.repeat(64); }); await refused(resolveBundle(results), /not the one the pointer commits to/);
  await set(p => { p.manifest.bytes += 1; }); await refused(resolveBundle(results), /not the one the pointer commits to/);
  await set(p => { p.runId = 'other-run'; }); await refused(resolveBundle(results), /not the one the pointer commits to/);
  await set(p => { p.finishedAt = '2030-01-01T00:00:00.000Z'; }); await refused(resolveBundle(results), /not the one the pointer commits to/);
  await set(p => { p.bundleId = 'c'.repeat(32); p.manifest.path = `${BUNDLES_DIR}/${'c'.repeat(32)}/manifest.json`; }); await refused(resolveBundle(results), /no manifest\.json/);
  await set(p => { p.manifest.path = '../outside/manifest.json'; }); await refused(resolveBundle(results), /does not name its own manifest/);
  await set(p => { p.bundleId = '../../x'; }); await refused(resolveBundle(results), /Unsupported evaluation bundle pointer/);
  await set(p => { p.schema = 'redact-secret/evaluation-bundle-pointer/v2'; }); await refused(resolveBundle(results), /Unsupported/);
  await writeFile(file, '{not json'); await assert.rejects(resolveBundle(results));
  await rm(file); await refused(resolveBundle(results), /absent/);
});

test('a partial bundle (no manifest) is never resolved, and a refused commit never moves the pointer', async () => {
  const { cases, reviews } = makeCases(6);
  const dir = await root(); const results = path.join(dir, 'r');
  // a writer that stopped before finish(): parts but no manifest
  const staging = path.join(dir, 'staging');
  const writer = new BundleWriter(staging, { runId: 'run-synthetic', casesHash: CASES_HASH }, 2048);
  await writer.open();
  for (const c of cases) await writer.addCase(c);
  await refused(validateBundle(staging), /no manifest\.json: the bundle is incomplete/);
  await refused(resolveBundle(results), /absent/);
  // a published directory that lost its manifest, with a pointer to it
  const first = await stage(dir, cases, reviews, { name: 'first' });
  const { pointer, directory } = await commitBundle(results, first.staging, first.manifest, { corpusHashes: HASHES });
  await rm(path.join(directory, 'manifest.json'));
  await refused(resolveBundle(results), /incomplete/);
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(first.manifest, null, 2) + '\n');
  // the next bundle fails its ledger/readback gate: the old pointer stays
  const next = makeCases(7);
  const second = await stage(dir, next.cases, next.reviews, { name: 'second', summary: summaryOf(next.cases, next.reviews, { runId: 'run-2' }), run: { runId: 'run-2', casesHash: CASES_HASH } });
  const pointerBefore = await readFile(path.join(results, POINTER_FILE), 'utf8');
  await assert.rejects(commitBundle(results, second.staging, second.manifest, { corpusHashes: HASHES, beforePointer: async () => { throw new Error('ledger does not describe this run'); } }), /ledger does not describe/);
  assert.equal(await readFile(path.join(results, POINTER_FILE), 'utf8'), pointerBefore);
  assert.equal((await resolveBundle(results)).pointer.bundleId, pointer.bundleId);
  // stale corpus on commit: refused before the pointer moves
  const third = await stage(dir, next.cases, next.reviews, { name: 'third', summary: summaryOf(next.cases, next.reviews, { runId: 'run-3' }), run: { runId: 'run-3', casesHash: CASES_HASH } });
  await refused(commitBundle(results, third.staging, third.manifest, { corpusHashes: { 'synthetic-corpus': 'stale' } }), /Stale/);
  assert.equal(await readFile(path.join(results, POINTER_FILE), 'utf8'), pointerBefore);
  // a good commit moves the pointer to the new bundle; the old immutable bundle stays for rollback
  const ok = await stage(dir, next.cases, next.reviews, { name: 'ok', summary: summaryOf(next.cases, next.reviews, { runId: 'run-4' }), run: { runId: 'run-4', casesHash: CASES_HASH } });
  const committed = await commitBundle(results, ok.staging, ok.manifest, { corpusHashes: HASHES });
  assert.notEqual(committed.pointer.bundleId, pointer.bundleId);
  assert.equal((await resolveBundle(results)).manifest.runId, 'run-4');
  assert.ok((await readdir(path.join(results, BUNDLES_DIR))).includes(pointer.bundleId), 'the previous bundle is retained until retention removes it');
  // rollback is moving the pointer back to a retained bundle whose manifest still matches
  await writeFile(path.join(results, POINTER_FILE), pointerBefore);
  assert.equal((await resolveBundle(results)).manifest.runId, 'run-synthetic');
});

test('re-publishing the same parts is idempotent: the same content gives the same bundle id', async () => {
  const { cases, reviews } = makeCases(6);
  const dir = await root(); const results = path.join(dir, 'r');
  const a = await stage(dir, cases, reviews, { name: 'a' });
  const b = await stage(dir, cases, reviews, { name: 'b' });
  assert.equal(a.manifest.bundleId, b.manifest.bundleId);
  assert.equal(canonical(a.manifest), canonical(b.manifest));
  await commitBundle(results, a.staging, a.manifest, { corpusHashes: HASHES });
  const again = await commitBundle(results, b.staging, b.manifest, { corpusHashes: HASHES });
  assert.equal(again.pointer.bundleId, a.manifest.bundleId);
  assert.equal(await stat(b.staging).then(() => true, () => false), false, 'the redundant staging directory is removed');
  // a different run id is a different bundle (the summary part differs)
  const c = await stage(dir, cases, reviews, { name: 'c', summary: summaryOf(cases, reviews, { runId: 'run-x' }), run: { runId: 'run-x', casesHash: CASES_HASH } });
  assert.notEqual(c.manifest.bundleId, a.manifest.bundleId);
});

test('growth: a report whose whole JSON exceeds a lowered limit is stored in bounded parts and validated part by part', async () => {
  const dir = await root();
  const LOWERED_STRING_LIMIT = 512 * 1024, PART = 16 * 1024;
  const { cases, reviews } = makeCases(220);
  const whole = JSON.stringify(wholeReport(cases, reviews));
  assert.ok(whole.length > LOWERED_STRING_LIMIT, `the whole report is ${whole.length} characters`);
  const { staging, manifest, writer } = await stage(dir, cases, reviews, { maxPartBytes: PART });
  assert.ok(writer.maxPartWritten <= PART);
  assert.ok(manifest.cases.length >= 5);
  const { validation } = await commitBundle(path.join(dir, 'r'), staging, manifest, { corpusHashes: HASHES });
  assert.ok(validation.maxPartBytes <= PART);
  assert.equal(validation.index.cases.size, 1100);
  assert.equal(validation.index.reviews.size, 440);
  for (const p of [...manifest.cases, ...manifest.reviews, manifest.summary]) assert.ok(p.bytes < LOWERED_STRING_LIMIT / 8);
  assert.ok(Buffer.byteLength(JSON.stringify(manifest, null, 2)) < LOWERED_STRING_LIMIT / 4, 'the manifest stays small relative to the report');
});

test('the writer refuses a method that is not a public evaluation method', async () => {
  const dir = await root();
  const { cases } = makeCases(1);
  const w = new BundleWriter(path.join(dir, 's'), { runId: 'r', casesHash: CASES_HASH }, 4096);
  await w.open();
  await assert.rejects(w.addCase({ ...cases[0], method: 'holdout' }), /not a public evaluation method/);
});
