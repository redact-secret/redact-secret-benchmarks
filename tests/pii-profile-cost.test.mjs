import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  assertPiiProfileCostPublicEvidenceSafe,
  derivePiiProfileCostMemoryThreshold,
  derivePiiProfileCostTimingThresholds,
  evaluatePiiProfileCostCandidate,
  piiProfileCostPlan,
  piiProfileCostCommitment,
  piiProfileCostSchedule,
  piiProfileCostExpectedThresholdCells,
  piiProfileCostWorkloads,
  validatePiiProfileCostPlan,
  validatePiiProfileCostBrowserBundleManifest,
  validatePiiProfileCostCandidateReport,
  validatePiiProfileCostSample,
  validatePiiProfileCostThresholds,
  validatePiiProfileCostWorkloads,
} from '../benchmarks/evaluation/domains/pii/profile-cost.ts';

const execFile = promisify(execFileCallback);
const fileHash = async file => createHash('sha256').update(await readFile(file)).digest('hex');

test('profile-cost plan binds exact source commits and keeps three baseline semantics separate', () => {
  const plan = validatePiiProfileCostPlan();
  assert.equal(plan.inputs.benchmarkBaseCommit, '1111a8d1341a42707ce9c8a5ca827eb8440e1042');
  assert.equal(plan.inputs.candidateProductCommit, '2e1bdcf0905f7a374c4c54b7caac41303cd7d88b');
  assert.equal(plan.inputs.distributionBaselineProductCommit, 'f26dee26a9c2aa3cfff3543d784c02de5054de09');
  assert.deepEqual(plan.baselineSemantics.map(row => row.id), ['activation', 'distribution', 'regression-budget']);
});

test('profile-cost plan exposes all required profiles without inventing another jurisdiction', () => {
  assert.deepEqual(piiProfileCostPlan.piiProfiles.map(row => row.id),
    ['off', 'global', 'us-ssn-exact', 'us-jurisdiction', 'beta10-full']);
  const jurisdiction = piiProfileCostPlan.piiProfiles.find(row => row.id === 'us-jurisdiction');
  const full = piiProfileCostPlan.piiProfiles.find(row => row.id === 'beta10-full');
  assert.equal(full.equivalentProfileOf, jurisdiction.id);
  assert.deepEqual(full.families, jurisdiction.families);
  assert.notDeepEqual(full.selectors, jurisdiction.selectors);
  assert.deepEqual(piiProfileCostPlan.jurisdictionComparison, {
    status: 'not-applicable',
    reasonCode: 'no-second-registered-jurisdiction',
    registeredJurisdictions: ['us'],
    policyIssue: 'https://github.com/redact-secret/redact-secret/issues/795',
  });
});

test('surface matrix uses typed N/A instead of zero or mixed claims', () => {
  assert.deepEqual(piiProfileCostPlan.surfaces.map(row => row.id),
    ['rust-native', 'node-native', 'node-wasm', 'chromium-wasm', 'python', 'cli']);
  for (const id of ['python', 'cli']) {
    const surface = piiProfileCostPlan.surfaces.find(row => row.id === id);
    assert.deepEqual(surface.credentialProfiles, ['full']);
    assert.equal(surface.unavailableCredentialProfiles[0].status, 'not-applicable');
    assert.notEqual(surface.unavailableCredentialProfiles[0].reasonCode, '');
  }
  assert.equal(piiProfileCostPlan.surfaces.find(row => row.id === 'cli').unavailableMetrics
    .find(row => row.metric === 'incremental').status, 'not-applicable');
});

test('ABBA schedule is counterbalanced and rejects underpowered or odd rounds', () => {
  const schedule = piiProfileCostSchedule(12);
  assert.equal(schedule.length, 24);
  assert.deepEqual(schedule.slice(0, 8).map(row => row.side),
    ['off', 'enabled', 'enabled', 'off', 'off', 'enabled', 'enabled', 'off']);
  assert.equal(schedule.filter(row => row.side === 'off').length, 12);
  assert.equal(schedule.filter(row => row.side === 'enabled').length, 12);
  for (const rounds of [0, 9, 11, 12.5]) assert.throws(() => piiProfileCostSchedule(rounds), /ABBA round count/);
});

test('A/A threshold derivation applies the reviewed #143 floors before candidate output', () => {
  const quiet = Array.from({ length: 12 }, (_, index) => 10 + index / 100);
  const threeRuns = Array.from({ length: 3 }, () => ({ baseline: quiet, candidate: quiet.map(value => value * 1.02) }));
  assert.deepEqual(derivePiiProfileCostTimingThresholds(threeRuns, 'latency'), {
    medianRelative: 0.1, tailRelative: 0.15, absoluteFloorMilliseconds: 1, minimumSamples: 10, aaRuns: 3,
  });
  assert.deepEqual(derivePiiProfileCostTimingThresholds(threeRuns, 'initialization'), {
    medianRelative: 0.25, tailRelative: 0.5, absoluteFloorMilliseconds: 2, minimumSamples: 10, aaRuns: 3,
  });
  assert.throws(() => derivePiiProfileCostTimingThresholds(threeRuns.slice(0, 2), 'latency'), /Insufficient/);
  assert.throws(() => derivePiiProfileCostTimingThresholds([{ baseline: quiet.slice(0, 9), candidate: quiet.slice(0, 9) },
    ...threeRuns.slice(0, 2)], 'latency'), /Insufficient/);
});

test('memory thresholds use at least three complete A/A runs and reject mixed or zero-denominator evidence', () => {
  const runs = [100, 101, 99].map(value => ({ baseline: [value, value, value, value, value],
    candidate: [value * 1.01, value, value, value, value] }));
  const derived = derivePiiProfileCostMemoryThreshold(runs);
  assert.deepEqual({ ...derived, ciCrossRunSpread: undefined, rerunSpread: undefined }, {
    relative: 0.1, absoluteFloorBytes: 1048576, minimumSamples: 5, aaRuns: 3,
    ciCrossRunSpread: undefined, rerunSpread: undefined,
  });
  assert.ok(Math.abs(derived.ciCrossRunSpread - 0.020202) < 0.000001);
  assert.ok(Math.abs(derived.rerunSpread - 0.01) < Number.EPSILON);
  assert.throws(() => derivePiiProfileCostMemoryThreshold(runs.slice(0, 2)), /Insufficient/);
  assert.throws(() => derivePiiProfileCostMemoryThreshold([{ baseline: [0, 0, 0, 0, 0], candidate: [0, 1, 1, 1, 1] },
    ...runs.slice(1)]), /zero-denominator/);
});

test('threshold freeze requires the complete unique surface/profile/workload/metric matrix', () => {
  const cells = piiProfileCostExpectedThresholdCells().map(id => {
    const marker = id.lastIndexOf('/');
    return { key: id.slice(0, marker), metric: id.slice(marker + 1), status: 'not-applicable', reasonCode: 'fixture-unavailable' };
  });
  // memory/<metric> has two path components and therefore needs to remain part of metric.
  for (const row of cells) if (row.key.endsWith('/memory')) {
    row.metric = `memory/${row.metric}`;
    row.key = row.key.slice(0, -'/memory'.length);
  }
  const projection = { schemaVersion: 1, reportType: 'pii-profile-cost-thresholds', supportClaims: false,
    planCommitment: piiProfileCostPlan.contentCommitment, workloadCommitment: piiProfileCostWorkloads.contentCommitment,
    frozenAt: '2026-09-28T00:00:00.000Z', aaRunCommitments: ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)],
    aaProvenance: { benchmarkCommit: 'd'.repeat(40), configCommitment: 'e'.repeat(64), runIds: ['1', '2', '3'] },
    freezeProvenance: { kind: 'local-development' }, cells };
  const valid = { ...projection, artifactCommitment: piiProfileCostCommitment(projection) };
  assert.equal(validatePiiProfileCostThresholds(valid).cells.length, piiProfileCostExpectedThresholdCells().length);
  const missingProjection = { ...projection, cells: cells.slice(1) };
  const missing = { ...missingProjection, artifactCommitment: piiProfileCostCommitment(missingProjection) };
  assert.throws(() => validatePiiProfileCostThresholds(missing), /Incomplete/);
  const duplicateProjection = { ...projection, cells: [...cells, cells[0]] };
  const duplicate = { ...duplicateProjection, artifactCommitment: piiProfileCostCommitment(duplicateProjection) };
  assert.throws(() => validatePiiProfileCostThresholds(duplicate), /Incomplete/);
});

test('threshold freezer accepts three complete A/A reports and rejects mixed metric availability', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-profile-cost-freeze-'));
  try {
    const unavailable = reasonCode => ({ status: 'not-applicable', reasonCode });
    const observations = piiProfileCostPlan.surfaces.flatMap(surface => surface.credentialProfiles.flatMap(credentialProfile =>
      piiProfileCostPlan.piiProfiles.filter(profile => profile.id !== 'off').flatMap(profile =>
        piiProfileCostWorkloads.workloads.map(workload => {
          const memoryIds = [...surface.memory, ...(surface.unavailableMemory ?? []).map(row => row.metric)];
          const sample = { import: unavailable('fixture-unavailable'), initialize: unavailable('fixture-unavailable'),
            wholeInput: unavailable('fixture-unavailable'), incremental: unavailable('fixture-unavailable'),
            bytesPerSecond: { wholeInput: unavailable('fixture-unavailable'), incremental: unavailable('fixture-unavailable') },
            memory: Object.fromEntries(memoryIds.map(id => [id, unavailable('fixture-unavailable')])) };
          const text = `${Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) =>
            workload.lines[index % workload.lines.length]).join('\n')}\n`;
          return { surface: surface.id, credentialProfile, profile: profile.id, workload: workload.id,
            workloadCommitment: createHash('sha256').update(text).digest('hex'), workloadBytes: Buffer.byteLength(text), samplesPerSide: 12,
            transientRetries: 0,
            sides: { reference: Array.from({ length: 12 }, () => structuredClone(sample)),
              comparison: Array.from({ length: 12 }, () => structuredClone(sample)) } };
        }))));
    const paths = [];
    for (let index = 0; index < 3; index++) {
      const projection = { schemaVersion: 1, reportType: 'pii-profile-cost-aa', supportClaims: false,
        planCommitment: piiProfileCostPlan.contentCommitment, workloadCommitment: piiProfileCostWorkloads.contentCommitment,
        sourceCommit: piiProfileCostPlan.inputs.candidateProductCommit, mode: 'aa', runId: `${100 + index}`,
        selection: { scope: 'full-matrix', filter: null }, runner: { platform: 'linux', arch: 'x64', node: process.version,
          cpuModel: 'fixture-cpu' }, provenance: { kind: 'github-actions', repository: 'redact-secret/redact-secret-benchmarks',
          runId: `${100 + index}`, runAttempt: '1', job: 'runtime', event: 'workflow_dispatch',
          workflowRef: 'redact-secret/redact-secret-benchmarks/.github/workflows/pii-profile-cost.yml@refs/heads/workbench',
          benchmarkCommit: 'e'.repeat(40), configCommitment: 'f'.repeat(64) },
        startedAt: `2026-09-27T0${index}:00:00.000Z`, completedAt: `2026-09-27T0${index}:01:00.000Z`,
        artifactCommitments: [{ id: 'fixture', sha256: 'a'.repeat(64) }],
        adapterCommitments: piiProfileCostPlan.surfaces.map(surface => ({ surface: surface.id, sha256: 'b'.repeat(64) })),
        observations: structuredClone(observations) };
      const report = { ...projection, artifactCommitment: piiProfileCostCommitment(projection) };
      const file = path.join(directory, `aa-${index}.json`); await writeFile(file, JSON.stringify(report)); paths.push(file);
    }
    const output = path.join(directory, 'thresholds.json');
    const command = ['--import', 'tsx', 'scripts/freeze-pii-profile-cost-thresholds.mjs',
      ...paths.flatMap(file => ['--aa', file]), '--development', 'true', '--output', output];
    await execFile(process.execPath, command, { timeout: 30_000 });
    validatePiiProfileCostThresholds(JSON.parse(await readFile(output, 'utf8')));
    const mixed = JSON.parse(await readFile(paths[0], 'utf8'));
    mixed.observations[0].sides.reference[0].import = 1;
    const { artifactCommitment: _old, ...mixedProjection } = mixed;
    mixed.artifactCommitment = piiProfileCostCommitment(mixedProjection);
    const mixedPath = path.join(directory, 'mixed.json'); await writeFile(mixedPath, JSON.stringify(mixed));
    const hostile = ['--import', 'tsx', 'scripts/freeze-pii-profile-cost-thresholds.mjs', '--aa', mixedPath,
      '--aa', paths[1], '--aa', paths[2], '--output', output];
    hostile.splice(-2, 0, '--development', 'true');
    await assert.rejects(execFile(process.execPath, hostile, { timeout: 30_000 }), error => /Mixed/.test(error.stderr));
    const forged = JSON.parse(await readFile(paths[0], 'utf8'));
    forged.provenance.workflowRef = 'redact-secret/redact-secret-benchmarks/.github/workflows/other.yml@refs/heads/main';
    const { artifactCommitment: _forgedOld, ...forgedProjection } = forged;
    forged.artifactCommitment = piiProfileCostCommitment(forgedProjection);
    const forgedPath = path.join(directory, 'forged.json'); await writeFile(forgedPath, JSON.stringify(forged));
    await assert.rejects(execFile(process.execPath, ['--import', 'tsx', 'scripts/freeze-pii-profile-cost-thresholds.mjs',
      '--aa', forgedPath, '--aa', paths[1], '--aa', paths[2], '--development', 'true', '--output', output], { timeout: 30_000 }),
    error => /Invalid or duplicate/.test(error.stderr));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('candidate validator rejects stale and forged within-budget verdicts', () => {
  const unavailable = reasonCode => ({ status: 'not-applicable', reasonCode });
  const observations = piiProfileCostPlan.surfaces.flatMap(surface => surface.credentialProfiles.flatMap(credentialProfile =>
    piiProfileCostPlan.piiProfiles.filter(profile => profile.id !== 'off').flatMap(profile =>
      piiProfileCostWorkloads.workloads.map(workload => {
        const memoryIds = [...surface.memory, ...(surface.unavailableMemory ?? []).map(row => row.metric)];
        const sample = { import: unavailable('fixture-unavailable'), initialize: unavailable('fixture-unavailable'),
          wholeInput: unavailable('fixture-unavailable'), incremental: unavailable('fixture-unavailable'),
          bytesPerSecond: { wholeInput: unavailable('fixture-unavailable'), incremental: unavailable('fixture-unavailable') },
          memory: Object.fromEntries(memoryIds.map(id => [id, unavailable('fixture-unavailable')])) };
        const text = `${Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) =>
          workload.lines[index % workload.lines.length]).join('\n')}\n`;
        return { surface: surface.id, credentialProfile, profile: profile.id, workload: workload.id,
          workloadCommitment: createHash('sha256').update(text).digest('hex'), workloadBytes: Buffer.byteLength(text), samplesPerSide: 12,
          transientRetries: 0,
          sides: { reference: Array.from({ length: 12 }, () => structuredClone(sample)),
            comparison: Array.from({ length: 12 }, () => structuredClone(sample)) } };
      }))));
  const cells = piiProfileCostExpectedThresholdCells().map(id => {
    const memory = id.lastIndexOf('/memory/'), marker = memory >= 0 ? memory : id.lastIndexOf('/');
    return { key: id.slice(0, marker), metric: id.slice(marker + 1), status: 'not-applicable', reasonCode: 'fixture-unavailable' };
  });
  const thresholdProjection = { schemaVersion: 1, reportType: 'pii-profile-cost-thresholds', supportClaims: false,
    planCommitment: piiProfileCostPlan.contentCommitment, workloadCommitment: piiProfileCostWorkloads.contentCommitment,
    frozenAt: '2026-09-27T03:00:00.000Z', aaRunCommitments: ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)],
    aaProvenance: { benchmarkCommit: 'd'.repeat(40), configCommitment: 'e'.repeat(64), runIds: ['1', '2', '3'] },
    freezeProvenance: { kind: 'github-actions', runId: '4', job: 'freeze', event: 'workflow_dispatch',
      workflowRef: 'redact-secret/redact-secret-benchmarks/.github/workflows/pii-profile-cost.yml@refs/heads/workbench',
      benchmarkCommit: 'd'.repeat(40) }, cells };
  const thresholds = { ...thresholdProjection, artifactCommitment: piiProfileCostCommitment(thresholdProjection) };
  const derived = evaluatePiiProfileCostCandidate(observations, thresholds);
  const projection = { schemaVersion: 1, reportType: 'pii-profile-cost-candidate', supportClaims: false,
    planCommitment: piiProfileCostPlan.contentCommitment, workloadCommitment: piiProfileCostWorkloads.contentCommitment,
    sourceCommit: piiProfileCostPlan.inputs.candidateProductCommit, mode: 'candidate', runId: '5',
    selection: { scope: 'full-matrix', filter: null }, runner: { platform: 'linux', arch: 'x64', node: process.version, cpuModel: 'fixture-cpu' },
    provenance: { kind: 'github-actions', repository: 'redact-secret/redact-secret-benchmarks', runId: '5', runAttempt: '1',
      job: 'runtime', event: 'workflow_dispatch',
      workflowRef: 'redact-secret/redact-secret-benchmarks/.github/workflows/pii-profile-cost.yml@refs/heads/workbench',
      benchmarkCommit: 'd'.repeat(40), configCommitment: 'e'.repeat(64) },
    startedAt: '2026-09-27T04:00:00.000Z', completedAt: '2026-09-27T04:01:00.000Z',
    artifactCommitments: ['browser-common-wasm', 'browser-full-wasm', 'candidate-inventory', 'cli-linux-x64', 'node-forced-wasm',
      'node-native', 'python-wheel-install', 'rust-release-helper'].map(id => ({ id, sha256: 'a'.repeat(64) })),
    adapterCommitments: piiProfileCostPlan.surfaces.map(surface => ({ surface: surface.id, sha256: 'b'.repeat(64) })),
    ...derived, observations };
  const valid = { ...projection, artifactCommitment: piiProfileCostCommitment(projection) };
  assert.equal(validatePiiProfileCostCandidateReport(valid, thresholds).verdict, 'accepted');
  const stale = structuredClone(valid);
  stale.evaluation[0] = { key: stale.evaluation[0].key, metric: stale.evaluation[0].metric, baselineMedian: 1,
    comparisonMedian: 1, medianRatio: 1, baselineP95: 1, comparisonP95: 1, tailRatio: 1, verdict: 'within-budget' };
  const { artifactCommitment: _old, ...staleProjection } = stale;
  stale.artifactCommitment = piiProfileCostCommitment(staleProjection);
  assert.throws(() => validatePiiProfileCostCandidateReport(stale, thresholds), /Stale or forged/);
});

test('browser consumer bundle manifest binds tool, entry, emitted roster, and every digest', () => {
  const projection = { profile: 'full', tool: 'vite-8.3.0', entry: '@redact-secret/core',
    files: [{ relativePath: 'assets/index.js', sha256: 'a'.repeat(64) },
      { relativePath: 'assets/index.wasm', sha256: 'b'.repeat(64) },
      { relativePath: 'index.html', sha256: 'c'.repeat(64) }] };
  const manifest = { ...projection, bundleManifestCommitment: piiProfileCostCommitment(projection) };
  assert.deepEqual(validatePiiProfileCostBrowserBundleManifest(manifest, 'full'), manifest);
  for (const mutate of [
    value => { value.tool = 'vite-9.0.0'; },
    value => { value.files[0].sha256 = 'd'.repeat(64); },
    value => { value.files = value.files.filter(row => !row.relativePath.endsWith('.wasm')); },
    value => { value.files.push(structuredClone(value.files[0])); },
  ]) {
    const hostile = structuredClone(manifest); mutate(hostile);
    assert.throws(() => validatePiiProfileCostBrowserBundleManifest(hostile, 'full'), /browser bundle manifest/);
  }
});

test('runtime samples require explicit typed N/A memory and never coerce unsupported metrics to zero', () => {
  const sample = {
    import: 1,
    initialize: 2,
    wholeInput: 3,
    incremental: { status: 'not-applicable', reasonCode: 'surface-has-no-incremental-api' },
    bytesPerSecond: { wholeInput: 100,
      incremental: { status: 'not-applicable', reasonCode: 'surface-has-no-incremental-api' } },
    memory: { processPeakRss: 1024, processRetainedRss: { status: 'not-applicable', reasonCode: 'one-shot-process' } },
  };
  assert.deepEqual(validatePiiProfileCostSample(sample), sample);
  for (const hostile of [
    { ...sample, import: -1 },
    { ...sample, incremental: Number.NaN },
    { ...sample, memory: { unsupported: 0 } },
    { ...sample, memory: { unsupported: { status: 'not-applicable', reasonCode: '' } } },
    { ...sample, extra: true },
  ]) assert.throws(() => validatePiiProfileCostSample(hostile), /sample|memory metric/);
});

test('workload plan is the only raw synthetic input location and public evidence rejects leaks', () => {
  validatePiiProfileCostWorkloads();
  assert.equal(piiProfileCostWorkloads.safety.realPersonOrAccountProvenance, false);
  assert.equal(piiProfileCostWorkloads.generator.lineCount, 4096);
  assert.equal(assertPiiProfileCostPublicEvidenceSafe({ schemaVersion: 1, workloadCommitment: 'a'.repeat(64), metrics: [] }), true);
  for (const hostile of [
    { raw: 'x' },
    { metrics: [{ value: 1 }] },
    { note: 'SYNTHETIC-PERSON-ID' },
    { note: '890-62-6879' },
  ]) assert.throws(() => assertPiiProfileCostPublicEvidenceSafe(hostile), /Unsafe/);
});

test('plan and workload commitments fail closed on mutation', () => {
  for (const [source, validate] of [[piiProfileCostPlan, validatePiiProfileCostPlan],
    [piiProfileCostWorkloads, validatePiiProfileCostWorkloads]]) {
    const mutated = structuredClone(source);
    mutated.contentCommitment = '0'.repeat(64);
    assert.throws(() => validate(mutated), /commitment|contract/);
  }
  const invented = structuredClone(piiProfileCostPlan);
  invented.jurisdictionComparison.registeredJurisdictions.push('ca');
  assert.throws(() => validatePiiProfileCostPlan(invented), /commitment|jurisdiction/);
  assert.throws(() => validatePiiProfileCostCandidateReport({}, {}), /threshold freeze|candidate report/);
});

test('implementation freeze binds the exact reviewed runner, adapters, collector, validator, and hostile tests', async () => {
  for (const row of piiProfileCostPlan.implementationFreeze.files)
    assert.equal(await fileHash(row.path), row.sha256, row.path);
});

test('generic runner validates all adapter identities and emits one filtered ABBA development cell', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-profile-cost-runner-'));
  try {
    const helper = path.join(directory, 'adapter.mjs'), count = path.join(directory, 'count.txt');
    const configPath = path.join(directory, 'config.json'), output = path.join(directory, 'aa.json');
    await writeFile(helper, `import{appendFileSync}from'node:fs';let input='';for await(const chunk of process.stdin)input+=chunk;JSON.parse(input);appendFileSync(process.argv[2],'1\\n');process.stdout.write(JSON.stringify({import:1,initialize:2,wholeInput:3,incremental:4,bytesPerSecond:{wholeInput:5,incremental:6},memory:{processPeakRss:1024,processRetainedRss:512}})+'\\n');\n`);
    const executableSha256 = await fileHash(process.execPath), helperSha256 = await fileHash(helper);
    const rows = piiProfileCostPlan.surfaces.map(surface => {
      const args = [helper, count], files = [{ role: 'adapter', path: helper, sha256: helperSha256 }];
      return { id: surface.id, cwd: directory, executable: { path: process.execPath, sha256: executableSha256 }, args, definitionFiles: files,
        definitionCommitment: piiProfileCostCommitment({ cwd: path.resolve(directory), executableSha256, args,
          files: files.map(({ role, sha256 }) => ({ role, sha256 })) }),
        artifactIds: ['fixture'], credentialProfiles: surface.credentialProfiles };
    });
    const configProjection = { schemaVersion: 1, sourceCommit: piiProfileCostPlan.inputs.candidateProductCommit,
      producer: { id: 'prepare-pii-profile-cost-linux-v1', sha256: piiProfileCostPlan.implementationFreeze.files
        .find(row => row.path === 'scripts/prepare-pii-profile-cost-linux.mjs').sha256 },
      qualification: { candidateRun: piiProfileCostPlan.inputs.candidateQualificationRun,
        candidateInventorySha256: piiProfileCostPlan.inputs.candidateInventorySha256 },
      productCheckout: { path: directory, commit: piiProfileCostPlan.inputs.candidateProductCommit },
      artifacts: [{ id: 'fixture', sha256: 'a'.repeat(64) }], surfaces: rows };
    await writeFile(configPath, `${JSON.stringify({ ...configProjection, configCommitment: piiProfileCostCommitment(configProjection) })}\n`);
    const result = await execFile(process.execPath, ['--import', 'tsx', 'scripts/measure-pii-profile-cost.mjs', '--mode=aa',
      `--config=${configPath}`, `--output=${output}`, '--run-id=fixture-aa-1',
      '--filter=rust-native/full/global/validator-heavy', '--development-samples=2'], { timeout: 30_000 });
    assert.match(result.stdout, /pii-profile-cost-aa 1 cells/);
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(report.selection.scope, 'filtered-development');
    assert.equal(report.observations.length, 1);
    assert.equal(report.observations[0].sides.reference.length, 2);
    assert.equal(report.observations[0].sides.comparison.length, 2);
    assert.equal(report.observations[0].transientRetries, 0);
    assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 8, 'two warmups and two recorded samples per side');
    assert.equal(report.artifactCommitment,
      piiProfileCostCommitment(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'artifactCommitment'))));
    await assert.rejects(execFile(process.execPath, ['--import', 'tsx', 'scripts/measure-pii-profile-cost.mjs', '--mode=aa',
      `--config=${configPath}`, `--output=${output}`, '--run-id=forged-official'], { timeout: 10_000 }),
    error => /official GitHub Actions checkouts/.test(error.stderr));
    await assert.rejects(execFile(process.execPath, ['--import', 'tsx', 'scripts/measure-pii-profile-cost.mjs', '--mode=candidate',
      `--config=${configPath}`, `--output=${output}`, '--run-id=fixture-candidate'], { timeout: 10_000 }),
    error => /pre-frozen thresholds/.test(error.stderr));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function runFlakyMatrix(directory, helperSource) {
  const helper = path.join(directory, 'adapter.mjs'), count = path.join(directory, 'count.txt');
  const configPath = path.join(directory, 'config.json'), output = path.join(directory, 'aa.json');
  await writeFile(helper, helperSource);
  const executableSha256 = await fileHash(process.execPath), helperSha256 = await fileHash(helper);
  const rows = piiProfileCostPlan.surfaces.map(surface => {
    const args = [helper, count], files = [{ role: 'adapter', path: helper, sha256: helperSha256 }];
    return { id: surface.id, cwd: directory, executable: { path: process.execPath, sha256: executableSha256 }, args, definitionFiles: files,
      definitionCommitment: piiProfileCostCommitment({ cwd: path.resolve(directory), executableSha256, args,
        files: files.map(({ role, sha256 }) => ({ role, sha256 })) }),
      artifactIds: ['fixture'], credentialProfiles: surface.credentialProfiles };
  });
  const configProjection = { schemaVersion: 1, sourceCommit: piiProfileCostPlan.inputs.candidateProductCommit,
    producer: { id: 'prepare-pii-profile-cost-linux-v1', sha256: piiProfileCostPlan.implementationFreeze.files
      .find(row => row.path === 'scripts/prepare-pii-profile-cost-linux.mjs').sha256 },
    qualification: { candidateRun: piiProfileCostPlan.inputs.candidateQualificationRun,
      candidateInventorySha256: piiProfileCostPlan.inputs.candidateInventorySha256 },
    productCheckout: { path: directory, commit: piiProfileCostPlan.inputs.candidateProductCommit },
    artifacts: [{ id: 'fixture', sha256: 'a'.repeat(64) }], surfaces: rows };
  await writeFile(configPath, `${JSON.stringify({ ...configProjection, configCommitment: piiProfileCostCommitment(configProjection) })}\n`);
  return { configPath, output, count,
    run: runId => execFile(process.execPath, ['--import', 'tsx', 'scripts/measure-pii-profile-cost.mjs', '--mode=aa',
      `--config=${configPath}`, `--output=${output}`, `--run-id=${runId}`,
      '--filter=rust-native/full/global/validator-heavy', '--development-samples=2'], { timeout: 30_000 }) };
}

test('a transient adapter-launch failure is retried and recorded, not silently absorbed or fatal', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-profile-cost-retry-'));
  try {
    // Fails only the very first invocation across the whole matrix (simulating one flaky launch); every
    // invocation -- including the failed one -- still appends, so the count file's line count before this
    // invocation is a persistent, cross-process invocation counter.
    const helperSource = `import{appendFileSync,existsSync,readFileSync}from'node:fs';let input='';for await(const chunk of process.stdin)input+=chunk;JSON.parse(input);const countFile=process.argv[2];const n=(existsSync(countFile)?readFileSync(countFile,'utf8').split('\\n').filter(Boolean).length:0)+1;appendFileSync(countFile,'1\\n');if(n===1){process.exit(1);}process.stdout.write(JSON.stringify({import:1,initialize:2,wholeInput:3,incremental:4,bytesPerSecond:{wholeInput:5,incremental:6},memory:{processPeakRss:1024,processRetainedRss:512}})+'\\n');\n`;
    const { output, count, run } = await runFlakyMatrix(directory, helperSource);
    await run('fixture-retry-1');
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(report.observations.length, 1);
    assert.equal(report.observations[0].transientRetries, 1);
    assert.equal((await readFile(count, 'utf8')).trim().split('\n').length, 9, 'eight recorded samples plus the one retried launch');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a transient adapter that never recovers still fails the run once the retry limit is exhausted', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-profile-cost-retry-exhausted-'));
  try {
    const helperSource = `let input='';for await(const chunk of process.stdin)input+=chunk;JSON.parse(input);process.exit(1);\n`;
    const { run } = await runFlakyMatrix(directory, helperSource);
    await assert.rejects(run('fixture-retry-exhausted'), error => /adapter failed: rust-native \(after 3 attempts\)/.test(error.stderr));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
