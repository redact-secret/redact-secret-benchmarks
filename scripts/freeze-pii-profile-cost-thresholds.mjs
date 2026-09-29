import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertPiiProfileCostPublicEvidenceSafe, derivePiiProfileCostTimingThresholds, piiProfileCostCommitment,
  derivePiiProfileCostMemoryThreshold, piiProfileCostExpectedThresholdCells, piiProfileCostPlan, piiProfileCostWorkloads,
  validatePiiProfileCostSample, validatePiiProfileCostThresholds } from '../benchmarks/evaluation/domains/pii/profile-cost.ts';
import { digest, exact, sha256, verifyImplementationFreeze } from './pii-profile-cost/adapter-protocol.mjs';

await verifyImplementationFreeze(piiProfileCostPlan);

const args = { aa: [] };
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]?.replace(/^--/, ''), value = process.argv[index + 1];
  if (!key || !value || !['aa', 'output', 'development'].includes(key)) throw new Error('Invalid threshold-freeze arguments');
  if (key === 'aa') args.aa.push(value); else if (args[key]) throw new Error(`Duplicate --${key}`); else args[key] = value;
}
if (args.aa.length < piiProfileCostPlan.sampleProtocol.aaRunsRequiredBeforeCandidate || !args.output)
  throw new Error('Required: at least three --aa <report>, --output <json>');
const development = args.development === 'true';
if (!development && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== 'redact-secret/redact-secret-benchmarks' ||
    process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || process.env.GITHUB_JOB !== 'freeze' ||
    !/^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost\.yml@/.test(process.env.GITHUB_WORKFLOW_REF ?? '')))
  throw new Error('Threshold freeze requires the official PII profile-cost workflow');

const reports = await Promise.all(args.aa.map(async file => JSON.parse(await readFile(path.resolve(file), 'utf8'))));
const runIds = new Set(), commitments = new Set();
for (const report of reports) {
  if (!exact(report, ['schemaVersion', 'reportType', 'supportClaims', 'planCommitment', 'workloadCommitment', 'sourceCommit', 'mode',
      'runId', 'selection', 'runner', 'provenance', 'startedAt', 'completedAt', 'artifactCommitments', 'adapterCommitments', 'observations',
      'artifactCommitment']) || report.schemaVersion !== 1 || report.reportType !== 'pii-profile-cost-aa' || report.supportClaims !== false ||
      report.mode !== 'aa' || report.selection?.scope !== 'full-matrix' || report.planCommitment !== piiProfileCostPlan.contentCommitment ||
      report.workloadCommitment !== piiProfileCostWorkloads.contentCommitment || report.sourceCommit !== piiProfileCostPlan.inputs.candidateProductCommit ||
      report.runner?.platform !== 'linux' || report.runner?.arch !== 'x64' || !report.runner?.cpuModel ||
      !exact(report.provenance, ['kind', 'repository', 'runId', 'runAttempt', 'job', 'event', 'workflowRef', 'benchmarkCommit', 'configCommitment']) ||
      report.provenance.kind !== 'github-actions' || report.provenance.repository !== 'redact-secret/redact-secret-benchmarks' ||
      report.provenance.job !== 'runtime' || report.provenance.event !== 'workflow_dispatch' ||
      !/^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost\.yml@/.test(report.provenance.workflowRef ?? '') ||
      !/^[a-f0-9]{40}$/.test(report.provenance.benchmarkCommit ?? '') || !/^\d+$/.test(report.provenance.runId ?? '') ||
      !digest(report.provenance.configCommitment) || !Array.isArray(report.artifactCommitments) || !report.artifactCommitments.length ||
      report.artifactCommitments.some(row => !exact(row, ['id', 'sha256']) || !digest(row.sha256)) ||
      JSON.stringify(report.adapterCommitments.map(row => row.surface).sort()) !== JSON.stringify([...piiProfileCostPlan.surfaces.map(row => row.id)].sort()) ||
      report.adapterCommitments.some(row => !exact(row, ['surface', 'sha256']) || !digest(row.sha256)) ||
      !Number.isFinite(Date.parse(report.startedAt)) || !Number.isFinite(Date.parse(report.completedAt)) ||
      Date.parse(report.completedAt) < Date.parse(report.startedAt) || !digest(report.artifactCommitment) || report.artifactCommitment !==
      piiProfileCostCommitment(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'artifactCommitment'))) ||
      runIds.has(report.runId) || commitments.has(report.artifactCommitment)) throw new Error('Invalid or duplicate PII profile-cost A/A report');
  runIds.add(report.runId); commitments.add(report.artifactCommitment);
}
const first = reports[0];
if (reports.some(report => JSON.stringify(report.artifactCommitments) !== JSON.stringify(first.artifactCommitments) ||
    JSON.stringify(report.adapterCommitments) !== JSON.stringify(first.adapterCommitments) ||
    report.provenance.configCommitment !== first.provenance.configCommitment ||
    report.provenance.benchmarkCommit !== first.provenance.benchmarkCommit || report.provenance.runId !== report.runId))
  throw new Error('PII profile-cost A/A provenance mismatch');
const cellKey = row => `${row.surface}/${row.credentialProfile}/${row.profile}/${row.workload}`;
const workloadIdentity = Object.fromEntries(piiProfileCostWorkloads.workloads.map(definition => {
  const lines = Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) => definition.lines[index % definition.lines.length]);
  const text = `${lines.join('\n')}\n`;
  return [definition.id, { commitment: sha256(text), bytes: Buffer.byteLength(text) }];
}));
const expectedKeys = first.observations.map(cellKey).sort();
if (new Set(expectedKeys).size !== expectedKeys.length || reports.some(report =>
  JSON.stringify(report.observations.map(cellKey).sort()) !== JSON.stringify(expectedKeys))) throw new Error('PII profile-cost A/A matrix mismatch');
for (const report of reports) for (const row of report.observations) {
  if (!exact(row, ['surface', 'credentialProfile', 'profile', 'workload', 'workloadCommitment', 'workloadBytes', 'samplesPerSide', 'transientRetries', 'sides']) ||
      !exact(row.sides, ['reference', 'comparison']) || row.samplesPerSide < piiProfileCostPlan.sampleProtocol.minimumSamplesPerSide ||
      !Number.isInteger(row.transientRetries) || row.transientRetries < 0 ||
      row.workloadCommitment !== workloadIdentity[row.workload]?.commitment || row.workloadBytes !== workloadIdentity[row.workload]?.bytes ||
      row.sides.reference.length !== row.samplesPerSide || row.sides.comparison.length !== row.samplesPerSide)
    throw new Error('Invalid PII profile-cost A/A observation');
  for (const sample of [...row.sides.reference, ...row.sides.comparison]) validatePiiProfileCostSample(sample);
}

const metrics = [
  ['import', 'initialization'], ['initialize', 'initialization'], ['wholeInput', 'latency'], ['incremental', 'latency'],
];
const cells = [];
for (const key of expectedKeys) {
  const rows = reports.map(report => report.observations.find(row => cellKey(row) === key));
  for (const [metric, dimension] of metrics) {
    const values = rows.flatMap(row => [...row.sides.reference, ...row.sides.comparison].map(sample => sample[metric]));
    const unavailable = values.every(value => value?.status === 'not-applicable');
    if (unavailable) {
      cells.push({ key, metric, status: 'not-applicable', reasonCode: 'surface-metric-unavailable' });
      continue;
    }
    if (values.some(value => typeof value !== 'number')) throw new Error(`Mixed PII profile-cost metric availability: ${key}/${metric}`);
    const aa = rows.map(row => ({ baseline: row.sides.reference.map(sample => sample[metric]),
      candidate: row.sides.comparison.map(sample => sample[metric]) }));
    cells.push({ key, metric, status: 'frozen', ...derivePiiProfileCostTimingThresholds(aa, dimension) });
  }
  const memoryIds = [...new Set(rows.flatMap(row => [...row.sides.reference, ...row.sides.comparison]
    .flatMap(sample => Object.keys(sample.memory))))].sort();
  for (const metric of memoryIds) {
    const valuesByRun = rows.map(row => ({ baseline: row.sides.reference.map(sample => sample.memory[metric]),
      candidate: row.sides.comparison.map(sample => sample.memory[metric]) }));
    if (valuesByRun.every(run => [...run.baseline, ...run.candidate].every(value => value?.status === 'not-applicable'))) {
      cells.push({ key, metric: `memory/${metric}`, status: 'not-applicable', reasonCode: 'surface-memory-unavailable' });
      continue;
    }
    if (valuesByRun.some(run => [...run.baseline, ...run.candidate].some(value => typeof value !== 'number')))
      throw new Error(`Mixed PII profile-cost memory availability: ${key}/${metric}`);
    cells.push({ key, metric: `memory/${metric}`, status: 'frozen', ...derivePiiProfileCostMemoryThreshold(valuesByRun) });
  }
}
const actualThresholdCells = cells.map(row => `${row.key}/${row.metric}`).sort();
const expectedThresholdCells = piiProfileCostExpectedThresholdCells().sort();
if (JSON.stringify(actualThresholdCells) !== JSON.stringify(expectedThresholdCells))
  throw new Error('Incomplete PII profile-cost threshold matrix');
const projection = { schemaVersion: 1, reportType: 'pii-profile-cost-thresholds', supportClaims: false,
  planCommitment: piiProfileCostPlan.contentCommitment, workloadCommitment: piiProfileCostWorkloads.contentCommitment,
  frozenAt: new Date().toISOString(), aaRunCommitments: [...commitments].sort(),
  aaProvenance: { benchmarkCommit: first.provenance.benchmarkCommit, configCommitment: first.provenance.configCommitment,
    runIds: reports.map(report => report.runId).sort() },
  freezeProvenance: development ? { kind: 'local-development' } : { kind: 'github-actions', runId: process.env.GITHUB_RUN_ID,
    job: process.env.GITHUB_JOB, event: process.env.GITHUB_EVENT_NAME, workflowRef: process.env.GITHUB_WORKFLOW_REF,
    benchmarkCommit: process.env.GITHUB_SHA }, cells };
if (reports.some(report => Date.parse(report.completedAt) >= Date.parse(projection.frozenAt)))
  throw new Error('PII profile-cost threshold freeze must occur after every A/A run');
assertPiiProfileCostPublicEvidenceSafe(projection);
const output = { ...projection, artifactCommitment: piiProfileCostCommitment(projection) };
validatePiiProfileCostThresholds(output);
await writeFile(path.resolve(args.output), `${JSON.stringify(output, null, 2)}\n`);
console.log(`${output.artifactCommitment} ${cells.length} frozen cells`);
