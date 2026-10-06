import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { JOURNAL, RECORD, REGISTRY, commitFiles, finishCommit, freshnessProblems, frozenProblems, pendingCommit, reportIdentityProblems, reportPaths, sha, stageReport } from '../scripts/adoption-report-sync.mjs';
import { planRecord } from '../scripts/record-deployment-receipt.mjs';

const TAG = 'snapshot-2026.01.01';
const G = 'docs/generated/evidence-adoption';
const replay = { ciRun: 'https://example.test/run/1', archive: { release: 'r1', sha256: 'sha256:aa' }, benchmarkRevision: 'abc' };
const receipt = (runId, env = 'staging') => ({ environment: env, runId: String(runId), commit: 'c', conclusion: 'success', verifiedOn: '2026-01-02' });
const candidate = (deployment = { staging: null, production: null }, extra = {}) => ({
  evidenceRelease: TAG, adoptionKey: 'sha256:key', engine: { tag: 'v1' }, replay, changeReport: `${G}/${TAG}.json`, ownerAcceptance: { acceptedBy: 'o' }, deployment, ...extra });
const recordText = (c = candidate(), state = 'accepted') => `${JSON.stringify({ schema: 'x', state, candidate: c }, null, 2)}\n`;
const comparisonOf = (c, measurement = 'm') => ({
  schema: 'redact-secret/evidence-adoption-view-comparison/v1', evidenceRelease: c.evidenceRelease, scope: 's', measurement,
  adoptionState: { state: 'accepted', evidenceRelease: c.evidenceRelease, engine: c.engine.tag, replay: c.replay, ownerAcceptance: c.ownerAcceptance, deployment: { staging: c.deployment.staging, production: c.deployment.production } } });
// A stand-in for compare-adoption-views.ts --from-comparison: keeps the recorded measurements, recomputes the state from the record.
const fakeRender = ({ record, paths, root }) => {
  const c = JSON.parse(record).candidate, old = JSON.parse(readFileSync(path.join(root, paths.comparison), 'utf8'));
  const next = { ...comparisonOf(c, old.measurement) };
  return { comparison: `${JSON.stringify(next, null, 2)}\n`, markdown: `# report ${TAG}\nstaging ${c.deployment.staging?.runId ?? 'none'}; production ${c.deployment.production?.runId ?? 'none'}\n` };
};
const fixture = (c = candidate()) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'adoption-sync-test-'));
  for (const d of ['benchmarks', G]) mkdirSync(path.join(root, d), { recursive: true });
  writeFileSync(path.join(root, RECORD), recordText(c));
  writeFileSync(path.join(root, REGISTRY), '{}');
  writeFileSync(path.join(root, `${G}/${TAG}.json`), JSON.stringify({ evidenceRelease: TAG, adoptionKey: 'sha256:key' }));
  const initial = fakeRender({ record: recordText(c), paths: { comparison: `${G}/${TAG}.comparison.json` }, root: (() => { writeFileSync(path.join(root, `${G}/${TAG}.comparison.json`), JSON.stringify(comparisonOf(c))); return root; })() });
  writeFileSync(path.join(root, `${G}/${TAG}.comparison.json`), initial.comparison);
  writeFileSync(path.join(root, `${G}/${TAG}.md`), initial.markdown);
  return root;
};
const read = (root, p) => readFileSync(path.join(root, p), 'utf8');

test('report paths: explicit acceptance paths win, the legacy names derive from the change report, the parity input only where the report carries it', () => {
  const none = () => null;
  assert.deepEqual(reportPaths(candidate(), none), { changeReport: `${G}/${TAG}.json`, comparison: `${G}/${TAG}.comparison.json`, report: `${G}/${TAG}.md`, parity: null, source: 'legacy', problems: [] });
  assert.equal(reportPaths(candidate(undefined, { acceptance: { comparison: 'a.json', report: 'a.md' } }), none).source, 'acceptance');
  assert.equal(reportPaths(candidate(), () => '## 4. Legacy-oracle parity').parity, 'docs/generated/qualification-parity.json');
  assert.match(reportPaths({}, none).problems[0], /change report/);
});

test('a comparison or change report of another release, key, engine or measurement provenance is refused', () => {
  const c = candidate(), comparison = comparisonOf(c), changeReport = { evidenceRelease: TAG, adoptionKey: 'sha256:key' };
  assert.deepEqual(reportIdentityProblems({ comparison, changeReport, candidate: c }), []);
  const bad = (x, y = changeReport) => reportIdentityProblems({ comparison: x, changeReport: y, candidate: c }).join('; ');
  assert.match(bad({ ...comparison, evidenceRelease: 'snapshot-2000.01.01' }), /comparison is of snapshot-2000/);
  assert.match(bad(comparison, { ...changeReport, adoptionKey: 'sha256:other' }), /adoption key/);
  assert.match(bad({ ...comparison, adoptionState: { ...comparison.adoptionState, engine: 'v9' } }), /another evidence release or engine/);
  assert.match(bad({ ...comparison, adoptionState: { ...comparison.adoptionState, replay: { ...replay, ciRun: 'x' } } }), /measurement provenance/);
  assert.match(bad({ ...comparison, schema: 'other' }), /not a redact-secret/);
});

test('a re-render may change the scope line and the deployment receipts only', () => {
  const a = comparisonOf(candidate()), b = comparisonOf(candidate({ staging: receipt(1), production: null }));
  assert.deepEqual(frozenProblems(a, b).problems, []);
  assert.match(frozenProblems(a, { ...b, measurement: 'changed' }).problems.join(), /measurements/);
  assert.match(frozenProblems(a, { ...b, adoptionState: { ...b.adoptionState, ownerAcceptance: null } }).problems.join(), /beyond the deployment/);
});

test('planRecord keeps a same-run receipt, needs --replace for another run and preserves the other environment', () => {
  const adoption = JSON.parse(recordText(candidate({ staging: receipt(1), production: receipt(9, 'production') })));
  const same = planRecord({ adoption, environment: 'staging', receipt: { ...receipt(1), verifiedOn: '2026-02-02' }, replace: false });
  assert.equal(same.repair, true);
  assert.equal(same.receipt.verifiedOn, '2026-01-02');
  assert.throws(() => planRecord({ adoption, environment: 'staging', receipt: receipt(2), replace: false }), /--replace/);
  const replaced = JSON.parse(planRecord({ adoption, environment: 'staging', receipt: receipt(2), replace: true }).text);
  assert.equal(replaced.candidate.deployment.staging.runId, '2');
  assert.equal(replaced.candidate.deployment.production.runId, '9');
});

test('staging renders and validates the report; a wrong snapshot, missing inputs and a render failure change nothing', async () => {
  const root = fixture();
  const next = recordText(candidate({ staging: receipt(5), production: null }));
  const staged = await stageReport({ root, recordText: next, render: fakeRender });
  assert.match(staged.files[`${G}/${TAG}.md`], /staging 5/);
  assert.equal(Object.keys(staged.sources).length, 2);
  // wrong snapshot comparison
  writeFileSync(path.join(root, `${G}/${TAG}.comparison.json`), JSON.stringify(comparisonOf(candidate(undefined, { evidenceRelease: 'snapshot-2000.01.01' }))));
  await assert.rejects(stageReport({ root, recordText: next, render: fakeRender }), /comparison is of snapshot-2000/);
  const before = read(root, RECORD);
  // missing render input
  const empty = fixture();
  writeFileSync(path.join(empty, `${G}/${TAG}.md`), '');
  await assert.rejects(stageReport({ root: empty, recordText: next, render: () => { throw new Error('render exploded'); } }), /render exploded/);
  const lone = mkdtempSync(path.join(os.tmpdir(), 'adoption-sync-test-'));
  mkdirSync(path.join(lone, 'benchmarks'), { recursive: true });
  await assert.rejects(stageReport({ root: lone, recordText: next, render: fakeRender }), /original render inputs/);
  // a render that states another receipt than the record is refused
  await assert.rejects(stageReport({ root: fixture(), recordText: next, render: args => ({ ...fakeRender(args), markdown: 'nothing' }) }), /does not show the staging receipt/);
  assert.equal(read(root, RECORD), before);
});

const files = (root, c) => {
  const text = recordText(c), staged = fakeRender({ record: text, paths: { comparison: `${G}/${TAG}.comparison.json` }, root });
  return { [RECORD]: text, [`${G}/${TAG}.comparison.json`]: staged.comparison, [`${G}/${TAG}.md`]: staged.markdown };
};
const digests = (root, f) => Object.fromEntries(Object.keys(f).map(p => [p, sha(readFileSync(path.join(root, p)))]));
const strays = root => [...readdirSync(path.join(root, G)), ...readdirSync(path.join(root, 'benchmarks'))].filter(n => /\.next$|\.tmp$/.test(n));

test('a failure at every write and rename boundary is recoverable and an idempotent retry ends in the same state', async () => {
  const target = candidate({ staging: receipt(5), production: null });
  for (const failAt of ['write', 'rename']) {
    for (let n = 0; n < 5; n += 1) {
      const root = fixture(), f = files(root, target), expected = digests(root, f);
      let writes = 0, renames = 0;
      const ops = {
        writeFile: async (p, t) => { if (failAt === 'write' && writes++ === n) throw new Error('boom'); return writeFile(p, t); },
        rename: async (a, b) => { if (failAt === 'rename' && renames++ === n) throw new Error('boom'); return rename(a, b); },
      };
      let failed = false;
      try { await commitFiles({ root, files: f, expected, ops }); } catch (error) { failed = error.message === 'boom'; }
      if (!failed) { assert.equal(existsSync(path.join(root, JOURNAL)), false); continue; }
      if (pendingCommit(root)) await finishCommit({ root }); // after the commit point: roll forward
      else {
        // before the commit point nothing canonical changed and the strays are gone
        assert.deepEqual(digests(root, f), expected);
        assert.deepEqual(strays(root), []);
        await commitFiles({ root, files: f, expected }); // an idempotent retry
      }
      for (const [p, text] of Object.entries(f)) assert.equal(read(root, p), text);
      assert.equal(pendingCommit(root), null);
      assert.deepEqual(strays(root), []);
    }
  }
});

test('a pending commit blocks a new one, and a concurrent edit is refused rather than overwritten', async () => {
  const root = fixture(), f = files(root, candidate({ staging: receipt(5), production: null })), expected = digests(root, f);
  writeFileSync(path.join(root, `${G}/${TAG}.md`), 'edited by someone else');
  await assert.rejects(commitFiles({ root, files: f, expected }), /changed since this update was staged/);
  assert.equal(read(root, `${G}/${TAG}.md`), 'edited by someone else');
  assert.deepEqual(strays(root), []);
  // an edit during an interrupted commit is reported, not applied over
  const root2 = fixture(), f2 = files(root2, candidate({ staging: receipt(5), production: null })), e2 = digests(root2, f2);
  await assert.rejects(commitFiles({ root: root2, files: f2, expected: e2, ops: { writeFile, rename: async (a, b) => { if (a.endsWith('.tmp')) return rename(a, b); throw new Error('boom'); } } }), /boom/); // the journal is in place, the target renames fail
  assert.equal(pendingCommit(root2) !== null, true);
  await assert.rejects(commitFiles({ root: root2, files: f2, expected: e2 }), /interrupted adoption commit is pending/);
  writeFileSync(path.join(root2, RECORD), 'edited');
  await assert.rejects(finishCommit({ root: root2 }), /was edited during an interrupted commit/);
});

test('the freshness check catches a stale report, passes a current one, reports a pending commit, and leaves candidates and history alone', async () => {
  const root = fixture();
  assert.deepEqual(await freshnessProblems({ root, render: fakeRender }), []);
  writeFileSync(path.join(root, RECORD), recordText(candidate({ staging: receipt(5), production: null })));
  const stale = await freshnessProblems({ root, render: fakeRender });
  assert.equal(stale.length, 2);
  assert.match(stale[0], /stale against benchmarks\/evidence-adoption\.json; run: node scripts\/adoption-report-sync\.mjs render/);
  writeFileSync(path.join(root, RECORD), recordText(candidate(), 'candidate'));
  assert.deepEqual(await freshnessProblems({ root, render: fakeRender }), []);
  writeFileSync(path.join(root, JOURNAL), '{}');
  assert.match((await freshnessProblems({ root, render: fakeRender }))[0], /interrupted adoption commit is pending/);
});
