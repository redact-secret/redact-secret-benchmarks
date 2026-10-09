import { historicalReplayOptions, historicalJson, historicalBytes } from './helpers/historical-evidence-archive.mjs';
import { loadPiiProtectedSupportEvidence } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
import { piiReviewedProtectedRoute } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';
import { fileURLToPath } from 'node:url';
// benchmarks #428: maintainer-accepted PII profile-cost tradeoffs (benchmarks/accepted-pii-profile-cost.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { b11ProfileCostAcceptance, piiProfileCostAcceptanceProblems, piiProfileCostAcceptances } from '../benchmarks/evaluation/domains/pii/profile-cost-acceptance.ts';
import { B11P_BETA11_CORE_COMMIT, b11ProtectedFamilySlug, b11ProtectedPublicGates, buildB11ProtectedDisposition, deriveB11ProtectedDisposition, validateB11ProtectedSeal } from '../benchmarks/evaluation/domains/pii/beta11-protected.ts';
import { B11_FAMILIES } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';

const json = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const receipt = json('benchmarks/inputs/pii/protected-route.json');
const current = await loadPiiProtectedSupportEvidence(fileURLToPath(new URL('../', import.meta.url)), piiReviewedProtectedRoute(receipt.bindingId));
const historicalBound = directory => {
  const dir = `evidence/901/428/${directory}/`;
  return { report: historicalJson(`${dir}pii-beta11-report-v2.json`), disposition: historicalJson(`${dir}pii-beta11-disposition-v2.json`),
    profileCost: { runs: historicalJson(`${dir}pii-profile-cost-v2-runs.json`), candidate: historicalJson(`${dir}pii-profile-cost-v2-candidate.json`), size: historicalJson(`${dir}pii-profile-cost-v2-size.json`) } };
};
const entry = piiProfileCostAcceptances.find(row => row.candidate.sourceCommit === B11P_BETA11_CORE_COMMIT);
const withEntry = patch => [{ ...structuredClone(entry), ...patch }];

test('the ledger is valid and has one entry per candidate commit, bound to the official runs of the record', () => {
  assert.deepEqual(piiProfileCostAcceptanceProblems(), []);
  assert.ok(entry);
  assert.equal(entry.runs.candidate.runId, '36584501052');
  assert.deepEqual(entry.runs.notUsed, ['36585713241']);
  assert.equal(entry.plan.contentCommitment, current.profileCost.candidate.planCommitment);
  assert.deepEqual(entry.excluded, []);
});

test('the 8b6a5fde acceptance covers every failing cell and open size row of the bound runs', () => {
  const acceptance = b11ProfileCostAcceptance(current);
  assert.equal(acceptance.status, 'accepted', acceptance.uncovered?.join('; '));
  const failing = current.profileCost.candidate.evaluation.filter(row => ['regression', 'invalid-measurement'].includes(row.verdict));
  assert.equal(acceptance.accepted.cells, failing.length);
  const gate = current.report.families[0].gates.find(row => row.id === 'profile-cost');
  assert.equal(gate.status, 'not-met', 'the frozen report keeps the measured verdict');
  assert.equal(acceptance.accepted.sizeRows, gate.evidence.sizeRows.filter(row => !row.acceptedBy).length);
});

test('an acceptance never stretches: a missing, excluded or changed cell, another run, or another commit is not covered', () => {
  const [first, ...rest] = entry.cells;
  const missing = b11ProfileCostAcceptance({ ...current, ledger: withEntry({ cells: rest }) });
  assert.equal(missing.status, 'not-covered');
  assert.ok(missing.uncovered.some(line => line.includes(`${first.key}/${first.metric}`)));
  const excluded = b11ProfileCostAcceptance({ ...current, ledger: withEntry({ cells: rest, excluded: [{ key: first.key, metric: first.metric,
    reason: 'a real PII-on absolute-time regression, reported for a product fix' }] }) });
  assert.equal(excluded.status, 'not-covered');
  assert.equal(excluded.excluded.length, 1);
  const changed = b11ProfileCostAcceptance({ ...current, ledger: withEntry({ cells: [{ ...first, measured: { ...first.measured, medianRatio: 1 } }, ...rest] }) });
  assert.equal(changed.status, 'not-covered');
  const otherRun = b11ProfileCostAcceptance({ ...current, ledger: withEntry({ runs: { ...entry.runs, candidate: { ...entry.runs.candidate, runId: '36585713241' } } }) });
  assert.equal(otherRun.status, 'not-covered');
  const noSize = b11ProfileCostAcceptance({ ...current, ledger: withEntry({ sizeRows: entry.sizeRows.slice(1) }) });
  assert.equal(noSize.status, 'not-covered');
  // The ec9224d9 record has no entry and stays not-met.
  assert.equal(b11ProfileCostAcceptance({ ...current, report: { ...current.report, candidate: { ...current.report.candidate, sourceCommit: '0'.repeat(40) } } }).status, 'none');
});

test('schema problems are reported in the #143 ledger style', () => {
  assert.equal(piiProfileCostAcceptanceProblems([entry, entry]).length >= 2, true);
  assert.equal(piiProfileCostAcceptanceProblems(withEntry({ benefit: { ...entry.benefit, links: ['https://example.com/x'] } })).length, 1);
  assert.equal(piiProfileCostAcceptanceProblems(withEntry({ rationale: 'cheap' })).length, 1);
  assert.equal(piiProfileCostAcceptanceProblems(withEntry({ excluded: [{ key: entry.cells[0].key, metric: entry.cells[0].metric,
    reason: 'listed on both sides of the decision' }] })).length, 1);
  assert.equal(piiProfileCostAcceptanceProblems(withEntry({ cells: [{ ...entry.cells[0], measured: {} }, ...entry.cells.slice(1)] })).length, 1);
});

test('the protected route treats an accepted profile-cost gate as met, and all six families become eligible (still pending)', () => {
  const acceptance = b11ProfileCostAcceptance(current);
  for (const row of current.report.families) {
    const gates = b11ProtectedPublicGates(current.report, row.family, acceptance);
    assert.deepEqual(gates.notMet, []);
    assert.deepEqual(gates.unresolved, []);
    assert.deepEqual(gates.acceptedTradeoffs, [`profile-cost:${entry.id}`]);
  }
  const record = deriveB11ProtectedDisposition({ report: current.report, disposition: current.disposition, seal: null, runs: [], costAcceptance: acceptance });
  assert.deepEqual(record.distribution, { pending: 6, provisional: 0, stable: 0 });
  for (const row of record.families) {
    assert.equal(row.protected.state, 'unspent');
    assert.equal(row.protected.reason, 'no-sealed-corpus');
    assert.deepEqual(row.publicGates.notMet, []);
  }
  // Without the acceptance the same record refuses every family on profile-cost.
  assert.ok(deriveB11ProtectedDisposition({ report: current.report, disposition: current.disposition, seal: null, runs: [] })
    .families.every(row => row.protected.reason === 'public-gates-failed:profile-cost'));
  // A not-covered acceptance, or one bound to another report, never lifts the gate.
  const partial = b11ProfileCostAcceptance({ ...current, ledger: withEntry({ cells: entry.cells.slice(1) }) });
  assert.deepEqual(b11ProtectedPublicGates(current.report, 'pii:global:email', partial).notMet, ['profile-cost']);
  assert.throws(() => b11ProtectedPublicGates(current.report, 'pii:global:email', { ...acceptance, reportCommitment: '0'.repeat(64) }),
    /cost-acceptance-not-bound-to-report|Holdout operation rejected/);
});

test('historical 8b6a5fde protected disposition re-derives byte for byte from verified archived originals', historicalReplayOptions, () => {
  const current = historicalBound(`core-${B11P_BETA11_CORE_COMMIT.slice(0, 12)}`);
  // The sealed protected corpus (holdout/pii-b11-17dae942ee4b-seal.json) and one aggregate plus trust resolution per family.
  const dir = `evidence/901/428/core-${B11P_BETA11_CORE_COMMIT.slice(0, 12)}/protected/`;
  const runs = B11_FAMILIES.map(family => ({ aggregate: historicalJson(`${dir}${b11ProtectedFamilySlug(family)}-aggregate-v1.json`),
    trust: historicalJson(`${dir}${b11ProtectedFamilySlug(family)}-trust-resolution-v1.json`) }));
  const record = deriveB11ProtectedDisposition({ report: current.report, disposition: current.disposition,
    seal: validateB11ProtectedSeal(json('holdout/pii-b11-17dae942ee4b-seal.json')), runs, costAcceptance: b11ProfileCostAcceptance(current) });
  assert.equal(`${JSON.stringify(record, null, 2)}\n`,
    historicalBytes(`evidence/901/428/core-${B11P_BETA11_CORE_COMMIT.slice(0, 12)}/pii-beta11-protected-disposition-v2.json`).toString('utf8'));
});
