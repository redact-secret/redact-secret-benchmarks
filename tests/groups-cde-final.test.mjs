// Historical final reports replay only from the verified original archive.
// Current role coverage stays an ordinary offline test.
import assert from 'node:assert/strict';
import test from 'node:test';
import { historicalBytes, historicalJson, historicalReplayOptions } from './helpers/historical-evidence-archive.mjs';
import { ROWS as providerRows } from '../benchmarks/corpora/provider-contracts/corpus-group-c.mjs';
import { ROWS as protocolRows } from '../benchmarks/corpora/protocol-credentials/corpus-group-d.mjs';
import { ROWS as sessionRows } from '../benchmarks/corpora/session-material/corpus-e.mjs';

const read = (p) => historicalBytes(p).toString('utf8');
const json = historicalJson;
const ROWS = { 752: 11, 753: 23, 754: 9 };

test('current provider, protocol and session corpus roles account for the 43 authored rows', () => {
  const roles = [providerRows, protocolRows, sessionRows];
  assert.deepEqual(roles.map(rows => Object.keys(rows).length), [11, 23, 9]);
  assert.equal(new Set(roles.flatMap(rows => Object.keys(rows))).size, 43);
});

test('every issue README accounts for all rows and keeps the counts separate', historicalReplayOptions, () => {
  const report = json('evidence/groups-cde/round3/report.json');
  for (const [issue, rows] of Object.entries(ROWS)) {
    const lineage = json(`evidence/${issue}/lineage.json`);
    assert.equal(Object.keys(lineage.rows).length, rows, `#${issue} rows`);
    const readme = read(`evidence/${issue}/README.md`);
    assert.doesNotMatch(readme, /NOT MEASURED|<BENCH_COMMIT>/, `#${issue} stale text or placeholder`);
    for (const row of Object.keys(lineage.rows)) assert.ok(readme.includes(`\`${row}\``), `#${issue} omits ${row}`);
    for (const heading of ['No-code coverage', 'Qualified improvement', 'Historical-only', 'Policy limits', 'Source-unresolved', 'Unassertable variants']) assert.ok(readme.includes(heading), `#${issue} lacks ${heading}`);
    const group = { 752: 'C', 753: 'D', 754: 'E' }[issue];
    assert.equal(Object.values(report.dispositions).filter((d) => d.corpus === group).length, rows);
  }
  assert.equal(Object.values(ROWS).reduce((a, b) => a + b, 0), 43);
});

test('round 4: the published beta.14 reproduces the round-3 candidate on every case', historicalReplayOptions, () => {
  const s = json('evidence/groups-cde/round4-published-beta14/scores.json');
  assert.equal(s.casesCompared, 2281);
  assert.equal(s.differentFindings.length, 0);
  assert.equal(s.regressions.length, 0);
  assert.equal(s.improvements.length, 0);
  for (const g of 'cde') {
    assert.deepEqual(s.corpora[g].r3, s.corpora[g].r4);
    assert.equal(s.parity[g].divergent.length, 0);
    assert.equal(s.parity[g].identical, s.parity[g].cases);
  }
  const id = json('evidence/groups-cde/round4-published-beta14/identity.json');
  assert.equal(id.published.npm['@redact-secret/core'].tarballSha256, id.roundThreeCandidate.tarballSha256['redact-secret-core-0.1.0-beta.14.tgz']);
});

test('round 4 regression controls: no scored Batch 1 or Batch 2 case failed or regressed', historicalReplayOptions, () => {
  const c = json('evidence/groups-cde/round4-published-beta14/controls/controls.json');
  for (const k of ['b1', 'r1', 'r2']) {
    assert.equal(c.corpora[k].positivesFailing, 0, k);
    assert.equal(c.corpora[k].controlsFlagged, 0, k);
    assert.equal(c.corpora[k].regressionsVsAccepted.length, 0, k);
    assert.equal(c.corpora[k].parityDivergent + c.corpora[k].streamNotEqualWhole, 0, k);
  }
});
