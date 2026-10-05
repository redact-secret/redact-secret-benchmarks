import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assembleDerivedInputs, deriveSnapshotInputs, readDerivedInputs, DERIVED_FILES, DERIVED_RECEIPT_FILE } from '../benchmarks/qualification/derived-inputs.ts';
import { AXIS_OVERLAY_FILE, buildAxisOverlay } from '../benchmarks/qualification/axis-overlay.ts';
import { TWIN_SCOPE_FILE, buildTwinScopeMap } from '../benchmarks/qualification/twin-scope.ts';
import { LEDGER_REKEY_FILE, LEDGER_REKEY_ID } from '../benchmarks/qualification/ledger-rekey.ts';
import { loadProductInputs } from '../benchmarks/qualification/inputs.ts';
import { pinnedSnapshotProblems } from '../scripts/fetch-pinned-public-snapshot.mjs';

// Synthetic only (#699): a snapshot of two cases that no legacy fixture joins, and stub artifacts. No test here reads a ledger value, a committed
// corpus digest or a count from the corpus; the committed overlays and the authority file are only hashed to prove they were not touched.

const DIGEST = n => `sha256:${String(n).padStart(64, '0')}`;
const snapshotOf = corpusDigest => ({
  schema: 'credential-eval/corpus-snapshot/v1',
  identity: { source: 'synthetic', revision: 'r', evidence_schema: 's', corpus_digest: corpusDigest },
  cases: [
    { id: 'synthetic-case-one', content: 'zz-synthetic-one', expected: [{ start: 0, end: 2, role: 'secret' }], grouping: {} },
    { id: 'synthetic-case-two', content: 'zz-synthetic-two', expected: [], grouping: {} },
  ],
});
const artifactOf = corpusDigest => ({ manifest: { evidence: { corpus_digest: corpusDigest } }, review_queue: [], variants: [] });
const sha = text => createHash('sha256').update(text).digest('hex');
const hashFile = file => readFile(new URL(`../${file}`, import.meta.url)).then(sha);
const stubRekey = corpusDigest => ({ schemaVersion: 1, id: LEDGER_REKEY_ID, population: 'public-evidence-snapshot', owner: 'redact-secret-benchmarks', note: 'synthetic', snapshot: { corpusDigest, cases: 2 }, methodsRun: { run: 'synthetic', semanticDigest: DIGEST(5) }, derivation: {}, occurrences: {} });

async function assembled(corpusDigest) {
  const snapshot = snapshotOf(corpusDigest);
  return assembleDerivedInputs({
    snapshot, snapshotBytes: Buffer.from(JSON.stringify(snapshot)),
    plain: { artifact: artifactOf(corpusDigest), semanticDigest: DIGEST(4) }, methods: { artifact: artifactOf(corpusDigest), semanticDigest: DIGEST(5), run: 'synthetic' },
    axisOverlay: await buildAxisOverlay(snapshot), twinScope: await buildTwinScopeMap(snapshot), ledgerRekey: stubRekey(corpusDigest),
  });
}
async function written(derived) {
  const dir = await mkdtemp(path.join(tmpdir(), 'derived-inputs-'));
  for (const kind of Object.keys(DERIVED_FILES)) await writeFile(path.join(dir, DERIVED_FILES[kind]), derived.bytes[kind]);
  await writeFile(path.join(dir, DERIVED_RECEIPT_FILE), `${JSON.stringify(derived.receipt)}\n`);
  return dir;
}

test('the receipt carries the snapshot digest and the digest of every generated input, and the three inputs are bound to that snapshot', async () => {
  const derived = await assembled(DIGEST(11));
  assert.equal(derived.receipt.snapshot.corpusDigest, DIGEST(11));
  assert.match(derived.receipt.snapshot.bytesDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(derived.receipt.artifacts.plain.corpusDigest, DIGEST(11));
  assert.deepEqual(derived.receipt.artifacts.methods, { semanticDigest: DIGEST(5), corpusDigest: DIGEST(11), run: 'synthetic' });
  for (const kind of Object.keys(DERIVED_FILES)) {
    assert.equal(derived.receipt.files[kind].file, DERIVED_FILES[kind]);
    assert.equal(derived.receipt.files[kind].digest, `sha256:${sha(derived.bytes[kind])}`);
    assert.equal(derived.receipt.files[kind].corpusDigest, DIGEST(11));
  }
  // Deterministic: the same snapshot gives the same bytes.
  assert.deepEqual((await assembled(DIGEST(11))).bytes, derived.bytes);
});

test('a derived directory is read back only when it is exactly what the derivation wrote', async () => {
  const dir = await written(await assembled(DIGEST(12)));
  try {
    const read = await readDerivedInputs(dir);
    assert.equal(read.axisOverlay.snapshot.corpusDigest, DIGEST(12));
    assert.equal(read.twinScope.snapshot.corpusDigest, DIGEST(12));
    assert.equal(read.ledgerRekey.snapshot.corpusDigest, DIGEST(12));
    // A file changed after it was derived is refused (it no longer matches the receipt).
    const overlayFile = path.join(dir, DERIVED_FILES.axisOverlay);
    const original = await readFile(overlayFile, 'utf8');
    await writeFile(overlayFile, original.replace(DIGEST(12), DIGEST(13)));
    await assert.rejects(readDerivedInputs(dir), /receipt records/);
    await writeFile(overlayFile, original);
    // A missing file or receipt is refused, never replaced by the committed copy.
    await rm(path.join(dir, DERIVED_FILES.twinScope));
    await assert.rejects(readDerivedInputs(dir), /has no public-twin-scope-map\.json/);
    await rm(path.join(dir, DERIVED_RECEIPT_FILE));
    await assert.rejects(readDerivedInputs(dir), /has no derived-inputs\.json/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a stale overlay in a derived directory is refused: its receipt entry and its own binding must name the snapshot', async () => {
  const stale = await assembled(DIGEST(14));
  // The overlay of an earlier corpus, receipted as if it were current (a replay that reused the accepted population's overlay).
  const old = await assembled(DIGEST(15));
  const mixed = { ...stale, bytes: { ...stale.bytes, axisOverlay: old.bytes.axisOverlay } };
  mixed.receipt = { ...stale.receipt, files: { ...stale.receipt.files, axisOverlay: { ...old.receipt.files.axisOverlay } } };
  const dir = await written(mixed);
  try { await assert.rejects(readDerivedInputs(dir), new RegExp(`bound to corpus ${DIGEST(15)}, the receipt's snapshot is ${DIGEST(14)}`)); } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the view stage refuses a derived input whose corpus is not the artifact\'s: the derivation reads artifacts of the snapshot only', async () => {
  await assert.rejects(deriveSnapshotInputs({ snapshot: snapshotOf(DIGEST(16)), plain: { artifact: artifactOf(DIGEST(17)), semanticDigest: DIGEST(1) }, methods: { artifact: artifactOf(DIGEST(16)), semanticDigest: DIGEST(2) } }), /plain artifact ran corpus .*17.*snapshot is corpus .*16/);
  await assert.rejects(deriveSnapshotInputs({ snapshot: snapshotOf(DIGEST(16)), methods: { artifact: artifactOf(DIGEST(18)), semanticDigest: DIGEST(2) } }), /methods artifact ran corpus/);
});

test('loading a candidate\'s inputs from a derived directory never reads or replaces the accepted population\'s committed inputs or authority', async () => {
  const committed = [AXIS_OVERLAY_FILE, TWIN_SCOPE_FILE, LEDGER_REKEY_FILE, 'benchmarks/official-runs.json', 'benchmarks/evidence-adoption.json'];
  const before = await Promise.all(committed.map(hashFile));
  // Nothing under benchmarks/ (the authority file included, which this test does not read) is created, changed or removed by loading derived inputs.
  const tree = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'benchmarks'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  const treeBefore = tree();
  const dir = await written(await assembled(DIGEST(19)));
  try {
    // The stub re-key is not the legacy ledger's one-to-one mapping, so the product loader refuses it: fail closed, no fallback to the committed re-key.
    await assert.rejects(loadProductInputs({ derivedInputsDir: dir }), /derived inputs .* are invalid|re-key|ledger/i);
    // A directory with no receipt is refused, with no fallback to the committed copies.
    const empty = await mkdtemp(path.join(tmpdir(), 'derived-empty-'));
    try { await assert.rejects(loadProductInputs({ derivedInputsDir: empty }), /derived input directory holds the receipt and all three derived files/); } finally { await rm(empty, { recursive: true, force: true }); }
  } finally { await rm(dir, { recursive: true, force: true }); }
  assert.deepEqual(await Promise.all(committed.map(hashFile)), before, 'the committed inputs, the registry and the adoption record are unchanged');
  assert.equal(tree(), treeBefore, 'nothing under benchmarks/ changed');
});

test('the derive command writes only into its --out and refuses a directory under benchmarks/', async () => {
  const { spawnSync } = await import('node:child_process');
  const root = path.resolve(import.meta.dirname, '..');
  const run = out => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/derive-snapshot-inputs.ts', '--snapshot', 'missing.json', '--methods-run', 'missing.json', '--out', out], { cwd: root, encoding: 'utf8' });
  const refused = run(path.join(root, 'benchmarks/support'));
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /must not be inside benchmarks\//);
});

test('the official-runs workflow derives the inputs from the pinned snapshot before the view, builds the view from them, and can retry the view alone', async () => {
  const workflow = (await readFile(new URL('../.github/workflows/official-runs.yml', import.meta.url), 'utf8')).replace(/^\s*#.*$/gm, '');
  const view = workflow.slice(workflow.indexOf('  qualification-view:'));
  const at = text => { const i = view.indexOf(text); assert.ok(i >= 0, `${text} is a step of the view job`); return i; };
  assert.ok(at('fetch-pinned-public-snapshot.mjs') < at('qualification:derive-inputs') && at('qualification:derive-inputs') < at('qualification:view'));
  assert.match(view, /qualification:view -- --artifacts official-in --inputs derived-inputs/);
  assert.match(view, /derived-inputs\.json/, 'the receipt travels with the view artifact');
  // View-only retry: the scanner jobs are skipped by an input and the view job accepts a skipped scanner job, never a failed one.
  assert.match(workflow, /reuse_run_id:/);
  assert.match(workflow, /official-run:\n[\s\S]*?if: \$\{\{ inputs\.reuse_run_id == '' && inputs\.reuse_candidate_run_id == '' \}\}/);
  assert.match(view, /needs\.official-run\.result == 'success' \|\| needs\.official-run\.result == 'skipped'/);
  assert.match(view, /run-id: \$\{\{ inputs\.reuse_run_id \}\}/);
  assert.match(view, /official-runs\.yml/);
  assert.ok(!/permissions:[^\n]*write/.test(workflow) && !/^\s+\S+: write$/m.test(workflow));
});

test('the pinned snapshot a view stage derives from must be the registry pin', () => {
  const snapshot = { schema: 'credential-eval/corpus-snapshot/v1', identity: { source: 'credential-evidence', revision: 'records-tree-sha256:abc', evidence_schema: 'credential-evidence/schema/1', corpus_digest: DIGEST(21) }, cases: [{ id: 'c' }] };
  const snapshotBytes = Buffer.from(JSON.stringify(snapshot));
  const manifest = { format: 'credential-evidence/release-manifest', tag: 'snapshot-x', sourceRevision: { recordsTree: { digest: 'abc' } }, schemaRevision: '1', fixtures: { count: 1 },
    files: [{ asset: 'credential-eval-corpus-snapshot.json', sha256: sha(snapshotBytes), bytes: snapshotBytes.length }] };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const pin = { release: { tag: 'snapshot-x', manifestDigest: `sha256:${sha(manifestBytes)}` }, corpusDigest: DIGEST(21) };
  assert.deepEqual(pinnedSnapshotProblems({ pin, manifestBytes, snapshotBytes }), []);
  assert.ok(pinnedSnapshotProblems({ pin: { ...pin, corpusDigest: DIGEST(22) }, manifestBytes, snapshotBytes }).some(p => /registry pins/.test(p)));
  assert.ok(pinnedSnapshotProblems({ pin: { ...pin, release: { ...pin.release, manifestDigest: DIGEST(23) } }, manifestBytes, snapshotBytes }).some(p => /manifest digest/.test(p)));
});

test('the candidate effect report can be retried alone from an earlier candidate run, never from a failed scanner job (#698)', async () => {
  const workflow = (await readFile(new URL('../.github/workflows/official-runs.yml', import.meta.url), 'utf8')).replace(/^\s*#.*$/gm, '');
  const report = workflow.slice(workflow.indexOf('  report:'));
  assert.match(workflow, /reuse_candidate_run_id:/);
  assert.match(report, /needs\.official-run\.result == 'success' \|\| \(needs\.official-run\.result == 'skipped' && inputs\.reuse_candidate_run_id != ''\)/);
  assert.match(report, /run-id: \$\{\{ inputs\.reuse_candidate_run_id \}\}/);
  assert.match(report, /official-runs\.yml/);
  assert.match(report, /exclusive with reuse_run_id and attribution/);
  assert.ok(!/^\s+\S+: write$/m.test(workflow));
});
