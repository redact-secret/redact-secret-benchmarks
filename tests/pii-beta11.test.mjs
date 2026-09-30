// Beta.11 PII E (#428): freeze integrity, pre-registered revisions, deterministic re-score and evidence safety.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { B11_EXPECTED_ACTIVATION, B11_FAMILIES, B11_PLAN_SETS, B11_SELECTIONS, b11CaseTables, b11Commitment, b11EvidenceCommitment, b11NamedNegative,
  b11ObservedRanges, b11PlanSetOf, b11Revisions, b11Selectors, expectedFamilies, validateB11Revision } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { b11FreezeFiles, buildB11Disposition, buildB11Report } from '../benchmarks/evaluation/domains/pii/beta11-disposition.ts';
import { PII_ORACLE_PLANS, piiIdentityOracle } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const root = new URL('../', import.meta.url);
const json = file => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const candidateDirs = existsSync(new URL('evidence/901/428/', root)) ?
  readdirSync(new URL('evidence/901/428/', root)).filter(name => /^core-[0-9a-f]{12}$/.test(name)) : [];

test('the v2 revisions are grounded in the case text and touch no SSN, phone or oracle-plan case', () => {
  assert.equal(b11Revisions.revisions.length, 14);
  assert.equal(b11Revisions.productDefect, false);
  for (const entry of b11Revisions.revisions) {
    assert.ok(!['pii:us:ssn', 'pii:global:phone'].includes(entry.family));
    const row = b11CaseTables(entry.family).frozen.find(item => item.source === 'population-plan' && item.id === entry.caseId);
    assert.ok(row, entry.caseId);
    assert.doesNotThrow(() => validateB11Revision(entry, row));
    // One property off (a different label) must fail the mechanical predicate.
    if (entry.rule !== 'email-reviewed-label-equals-split') assert.throws(() => validateB11Revision({ ...entry, labelForm: 'order number' }, row));
  }
  for (const family of B11_FAMILIES) assert.ok(b11CaseTables(family).reviewed.filter(row => row.source === 'oracle-plan').every(row => row.revision === null));
});

test('named-negative reconciliation names exactly the seven named-negative oracle cases', () => {
  const named = B11_FAMILIES.flatMap(family => {
    const labels = piiIdentityOracle.families.find(row => row.family === family).labels;
    return PII_ORACLE_PLANS[family].cases.filter((row, index) => labels[index].identity === 'valid' && labels[index].sensitivity === 'not-established' &&
      b11NamedNegative(family, row.input)).map(row => `${family}/${row.id}`);
  });
  assert.equal(named.length, 7, named.join(','));
});

test('frozen v2 activation identities follow the documented pii-context/v2 form', () => {
  assert.equal(B11_EXPECTED_ACTIVATION['pii:global'],
    'credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:global:phone;vocabulary=pii-context/v2');
  assert.deepEqual(b11Selectors('pii:us:ssn', 'foreign'), ['pii:global']);
  assert.equal(b11Selectors('pii:global:email', 'foreign'), null);
});

/** A synthetic, perfectly conforming observation: exercises the gate logic without any product artifact. */
function syntheticObservation() {
  const lanesFor = (family, perfect) => ['node-addon', 'node-wasm'].flatMap(lane => B11_SELECTIONS(family).map(selection => {
    const { reviewed } = b11CaseTables(family), ranges = b11ObservedRanges(family);
    const on = selection !== 'off' && selection !== 'foreign';
    return { lane, selection, artifact: lane === 'node-wasm' ? 'wasm' : 'addon', activationIdentity: B11_EXPECTED_ACTIVATION[b11Selectors(family, selection).join(',') || 'off'] ??
        `credentials=full;selectors=pii:global,pii:us;families=${expectedFamilies(family, selection).join(',')};vocabulary=pii-context/v2`,
      cases: reviewed.map((row, index) => ({ id: row.id, family: on && perfect && row.scored && row.sensitivity === 'sensitive' ? [[row.candidate.start, row.candidate.end, 'redact']] : [],
        otherPii: [], otherPiiAtTarget: false, credential: 0, ranges: ranges[index].map(range => [range.start, range.end, false]), outsidePreserved: true, scanRedactAgree: true })) };
  }));
  const evidence = B11_FAMILIES.map(family => {
    const oracle = b11CaseTables(family).reviewed.filter(row => row.source === 'oracle-plan');
    const value = { format: 'redact-secret/pii-identity-evaluation/1', family, contextVocabulary: 'pii-context/v2',
      activationIdentity: `credentials=full;selectors=pii:family:${family.slice(4)};families=${family};vocabulary=pii-context/v2`,
      sourceCommit: 'a'.repeat(40), artifactSetCommitment: 'c'.repeat(64),
      observations: oracle.map(row => ({ id: row.id, family, identity: row.identity === 'valid' ? 'established' : 'unmatched',
        sensitivity: row.identity === 'valid' ? row.sensitivity : 'not-established' })), artifactCommitment: '' };
    value.artifactCommitment = b11EvidenceCommitment(value);
    return value;
  });
  return {
    freeze: { freezeCommitment: 'f'.repeat(64), freezeCommit: 'e'.repeat(40) },
    candidate: { sourceCommit: 'a'.repeat(40), components: { core: 'b'.repeat(64) }, artifactSetCommitment: 'c'.repeat(64),
      families: B11_FAMILIES.map(family => ({ family, lanes: lanesFor(family, true) })) },
    baseline: { version: '0.1.0-beta.10', families: B11_FAMILIES.map(family => ({ family, lanes: lanesFor(family, false) })) },
    identitySeam: { candidateArtifactCommitment: 'b'.repeat(64), evidence }, benchmark: { revision: 'd'.repeat(40), dirty: false }, platform: 'test',
  };
}
const syntheticFreeze = () => ({ freezeCommitment: 'f'.repeat(64), role: 'interim', roleNote: 'test', candidate: { sourceCommit: 'a'.repeat(40), versionString: 'x' },
  protectedEpochs: B11_FAMILIES.map(family => ({ family, epochCommitment: '0'.repeat(64), protectedCorpus: { status: 'none-registered' } })) });
const syntheticOperational = pass => {
  const payload = (role, gzip) => ({ file: role, role, raw: gzip * 3, gzip, brotli: gzip - 10 });
  return { freezeCommitment: 'f'.repeat(64), artifactCommitment: '9'.repeat(64),
    runtimeComparisons: [{ surface: 'node-addon', profile: 'pii-global', metrics: { initialize: { pass: true } } }],
    sizes: { baseline: { packed: { core: 1, node: 1, wasm: 1 }, wasmPayloads: [payload('default-full', 1000), payload('default-common', 1000)] },
      candidate: { packed: { core: 1, node: 1, wasm: 1 }, wasmPayloads: [payload('default-full', 1000), payload('default-common', pass ? 1000 : 2000), payload('pii', 5000)] } },
    sizeBudgetRows: [{ id: 'size/wasm/common/gzip', status: pass ? 'within' : 'regression', candidateValue: 1, baselineValue: 1, delta: 0, allowedIncrease: 0 }] };
};

test('a perfect synthetic observation still stays pending: protected is never run, cost gates are reported', () => {
  const observation = syntheticObservation();
  const report = buildB11Report({ freeze: syntheticFreeze(), observation, operational: syntheticOperational(false), parity: null });
  const disposition = buildB11Disposition(report);
  assert.equal(disposition.distribution.pending, 6);
  for (const row of disposition.families) {
    assert.equal(row.status, 'pending');
    assert.ok(row.failedOrWithheldGates.some(gate => gate.gate === 'protected-partition' && gate.status === 'not-run'));
    for (const id of ['identity-only-classification', 'oracle-plan-public-stream', 'activation-v2', 'pii-off-invariance', 'cross-surface-determinism',
      'population-no-regression', 'authored-truth-agreement', 'contract-fixture-discrepancy']) assert.ok(row.metGates.includes(id), `${row.family} ${id}`);
    assert.ok(row.failedOrWithheldGates.some(gate => gate.gate === 'runtime-and-package-cost'));
  }
  // The common-Wasm budget reads only the default common payload; a separate PII payload never counts against it.
  assert.ok(report.cost.byteBudgets.piiPayloads.length === 1 && report.cost.byteBudgets.pairedLocalBuild.find(row => row.id === 'wasmCommonGzip').delta === 1000);
  const passing = buildB11Report({ freeze: syntheticFreeze(), observation, operational: syntheticOperational(true), parity: null });
  assert.equal(passing.cost.byteBudgets.pairedLocalBuild.find(row => row.id === 'wasmCommonGzip').pass, true);
});

test('the evidence/879 Node and Wasm package overruns are waived only by the #143 ledger rows for this exact commit and platform', () => {
  const observation = syntheticObservation();
  const operational = syntheticOperational(true);
  operational.sizes.baseline.packed = { core: 40554, node: 589697, wasm: 559573 };
  operational.sizes.candidate.packed = { core: 41650, node: 629737, wasm: 871030 };
  const freeze = commit => ({ ...syntheticFreeze(), candidate: { sourceCommit: commit, versionString: 'x', platform: 'darwin-arm64' } });
  const accepted = buildB11Report({ freeze: freeze('1db8ff38b16e50c51229eb27025452952bf621e1'), observation, operational, parity: null });
  const gateOf = report => report.families[0].gates.find(row => row.id === 'runtime-and-package-cost');
  assert.equal(gateOf(accepted).status, 'met');
  assert.match(gateOf(accepted).reason, /nodePacked \+40040 B over 32768 B accepted: beta11-npm-node-darwin-arm64-packed-detectors/);
  assert.match(gateOf(accepted).reason, /wasmPacked \+311457 B over 32768 B accepted: beta11-npm-wasm-packed-pii-split-and-detectors/);
  const other = buildB11Report({ freeze: freeze('2'.repeat(40)), observation, operational, parity: null });
  assert.equal(gateOf(other).status, 'not-met');
  assert.match(gateOf(other).reason, /nodePacked \+40040 B/);
});

test('a public-finding disagreement between the seam and the artifact fails closed', () => {
  const observation = syntheticObservation();
  const lane = observation.candidate.families[0].lanes.find(row => row.lane === 'node-addon' && row.selection === 'exact');
  const index = lane.cases.findIndex((row, i) => b11CaseTables(B11_FAMILIES[0]).reviewed[i].sensitivity === 'sensitive');
  lane.cases[index] = { ...lane.cases[index], family: [] };
  assert.throws(() => buildB11Report({ freeze: syntheticFreeze(), observation, operational: syntheticOperational(true), parity: null }));
});

// sha256 of the size triggers of benchmarks/regression-budgets.json exactly as every committed freeze froze them: the
// whole-file sha256 of that budgets file at the freezes was 3f4c777c15d7c273ad29f22680ca86e47485a8184b407052429e294e0ab58c79.
const SIZE_TRIGGERS_SHA256 = 'bc6ef025a4327c78f0391254619aad0e3d786463200fcd65f02262c09da19906';

// Every committed record, for every population plan set: `pii-beta11-*-<file version>.json` next to its freeze.
const records = candidateDirs.flatMap(directory => Object.values(B11_PLAN_SETS).map(row => row.fileVersion)
  .filter(version => existsSync(new URL(`evidence/901/428/${directory}/pii-beta11-freeze-${version}.json`, root))).map(version => ({ directory, version })));
for (const { directory, version } of records) {
  const base = `evidence/901/428/${directory}/`;
  test(`${directory} (${version}): the freeze still binds its frozen files`, () => {
    const freeze = json(`${base}pii-beta11-freeze-${version}.json`);
    assert.equal(freeze.freezeCommitment, b11Commitment({ ...freeze, freezeCommitment: undefined }));
    assert.equal(B11_PLAN_SETS[b11PlanSetOf(freeze)].fileVersion, version);
    assert.deepEqual(freeze.frozenInputs.map(row => row.path), b11FreezeFiles(b11PlanSetOf(freeze)).benchmarkInputs);
    for (const row of freeze.frozenInputs) {
      // The budgets file is re-derived when the adapter-overhead baseline is re-taken (#472). The freezes read only its
      // size triggers (b11SizeBudgetRows), so those are bound by their own digest; the rest of the file may evolve.
      if (row.path === 'benchmarks/regression-budgets.json') {
        assert.equal(sha256(Buffer.from(JSON.stringify(json(row.path).triggers.filter(trigger => trigger.dimension === 'size')))), SIZE_TRIGGERS_SHA256, row.path);
      } else assert.equal(sha256(readFileSync(new URL(row.path, root))), row.sha256, row.path);
    }
  });
  if (!existsSync(new URL(`${base}pii-beta11-observation-${version}.json`, root))) continue;
  test(`${directory} (${version}): report and disposition re-score byte for byte and carry no case text`, () => {
    const freeze = json(`${base}pii-beta11-freeze-${version}.json`), observation = json(`${base}pii-beta11-observation-${version}.json`),
      operational = json(`${base}pii-beta11-operational-${version}.json`);
    const planSet = b11PlanSetOf(freeze);
    const parityFile = `evidence/901/427/mixed-parity-core-${directory.slice(5)}-plan-v2-report-v1.json`;
    const parity = existsSync(new URL(parityFile, root)) ? { file: parityFile, report: json(parityFile) } : null;
    // Scoring code may be fixed after an observation only through a new freeze; the committed report must re-derive exactly.
    const cost = name => `${base}pii-profile-cost-v2-${name}.json`;
    const profileCost = ['runs', 'candidate', 'size'].every(name => existsSync(new URL(cost(name), root))) ?
      { runs: json(cost('runs')).runs.map(row => `${row.phase}:${row.runId}`), candidate: json(cost('candidate')), size: json(cost('size')) } : null;
    const report = buildB11Report({ freeze, observation, operational, parity, profileCost });
    assert.equal(`${JSON.stringify(report, null, 2)}\n`, readFileSync(new URL(`${base}pii-beta11-report-${version}.json`, root), 'utf8'));
    assert.equal(`${JSON.stringify(buildB11Disposition(report), null, 2)}\n`, readFileSync(new URL(`${base}pii-beta11-disposition-${version}.json`, root), 'utf8'));
    const texts = B11_FAMILIES.flatMap(family => b11CaseTables(family, planSet).frozen.flatMap(row => {
      const bytes = Buffer.from(row.input, 'utf8');
      return [row.input, ...(row.target ? [bytes.subarray(row.target.start, row.target.end).toString('utf8')] : [])];
    })).filter(text => text.length >= 8);
    for (const file of ['observation', 'report', 'disposition', 'operational'].map(kind => `pii-beta11-${kind}-${version}.json`)) {
      const content = readFileSync(new URL(`${base}${file}`, root), 'utf8');
      for (const text of texts) assert.ok(!content.includes(JSON.stringify(text).slice(1, -1)), `${file} carries case text`);
    }
    assert.ok(report.families.every(row => row.status === 'pending' || row.gates.every(gate => gate.status === 'met')));
  });
}
