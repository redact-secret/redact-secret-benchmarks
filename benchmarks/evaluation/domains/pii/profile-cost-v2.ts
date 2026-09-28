/**
 * PII profile cost v2 (benchmarks #428): the reviewed re-freeze of the #286 profile-cost protocol for a
 * `pii-context/v2` candidate. v1 (`profile-cost.ts`, `qualification/pii-profile-cost-v1.json`) stays byte-identical
 * and keeps measuring beta.10. Differences from v1, and nothing else:
 * - the plan names its candidate, role and context vocabulary as reviewed inputs (a new candidate is a reviewed
 *   edit of `inputs` plus a new content commitment), instead of v1's hard-coded beta.10 binding;
 * - adapters expect `vocabulary=<inputs.contextVocabulary>` in every activation identity;
 * - the size roster keeps the default `full`/`common` Wasm and browser rows under the #143 budgets and reports any
 *   candidate-only PII artifact (redact-secret#937 splits the PII runtime out of the default Wasm builds) as its own
 *   rows without a pre-existing budget, so default common-Wasm growth is never mixed with PII-artifact size.
 */
import planData from '../../../../qualification/pii-profile-cost-v2.json' with { type: 'json' };
import workloadData from '../../../../qualification/pii-profile-cost-workloads-v1.json' with { type: 'json' };
import { roundOrder, pairedRatios, ceilToFivePercent } from '../../../lib/regression-budgets.ts';
import { hash } from '../../substrate/hash.ts';

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
const commitment = (value: unknown) => hash(JSON.stringify(canonical(value)));
const withoutCommitment = (value: Record<string, unknown>) => {
  const { contentCommitment: _contentCommitment, artifactCommitment: _artifactCommitment, ...projection } = value;
  return projection;
};
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, keys: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const sortedUnique = (values: unknown) => Array.isArray(values) && values.every(value => typeof value === 'string') &&
  new Set(values).size === values.length && JSON.stringify(values) === JSON.stringify([...values].sort());

export const piiProfileCostPlan = Object.freeze(structuredClone(planData));
export const piiProfileCostWorkloads = Object.freeze(structuredClone(workloadData));
export const piiProfileCostCommitment = (value: unknown) => commitment(value);

const PROFILE_IDS = ['off', 'global', 'us-ssn-exact', 'us-jurisdiction', 'beta10-full'];
const SURFACE_IDS = ['rust-native', 'node-native', 'node-wasm', 'chromium-wasm', 'python', 'cli'];
const MEMORY_METRIC_IDS = new Set(['processPeakRss', 'processRetainedRss', 'nodePeakRss', 'nodeRetainedRss',
  'nodePeakHeap', 'nodeRetainedHeap', 'nodePeakExternal', 'nodeRetainedExternal', 'browserPeakJsHeap',
  'browserRetainedJsHeap', 'wasmLinearMemory', 'pythonPeakHeap', 'pythonRetainedHeap']);

export function validatePiiProfileCostPlan(value: unknown = piiProfileCostPlan) {
  const plan = structuredClone(value) as any;
  if (!exact(plan, ['schemaVersion', 'id', 'issue', 'supportClaims', 'inputs', 'baselineSemantics', 'credentialProfiles', 'piiProfiles',
      'jurisdictionComparison', 'workloads', 'surfaces', 'runtimeMetrics', 'sampleProtocol', 'thresholdPolicy', 'artifactRoster',
      'officialLinuxExecution', 'implementationFreeze', 'evidenceSafety', 'contentCommitment']) || plan.schemaVersion !== 1 || plan.id !== 'pii-profile-cost-v2' || plan.issue !== 428 ||
      plan.supportClaims !== false || !digest(plan.contentCommitment) || plan.contentCommitment !== commitment(withoutCommitment(plan)))
    throw new Error('Invalid PII profile-cost plan identity or commitment');
  if (!exact(plan.inputs, ['benchmarkBaseCommit', 'candidateProductCommit', 'candidateRole', 'contextVocabulary', 'distributionBaselineProductCommit',
      'candidateQualificationRun', 'distributionBaselineQualificationRun', 'candidateInventorySha256',
      'distributionBaselineInventorySha256', 'regressionBudgetId', 'regressionBudgetBaseline']) ||
      !['benchmarkBaseCommit', 'candidateProductCommit', 'distributionBaselineProductCommit'].every(key => /^[a-f0-9]{40}$/.test(plan.inputs[key])) ||
      !['interim', 'final'].includes(plan.inputs.candidateRole) || plan.inputs.contextVocabulary !== 'pii-context/v2' ||
      plan.inputs.distributionBaselineProductCommit !== 'f26dee26a9c2aa3cfff3543d784c02de5054de09' ||
      !Number.isInteger(plan.inputs.candidateQualificationRun) || plan.inputs.distributionBaselineQualificationRun !== 36317349914 ||
      !digest(plan.inputs.candidateInventorySha256) ||
      plan.inputs.distributionBaselineInventorySha256 !== 'c41b05aeaca64d6f877d6bfd3c5caf07b358905aad51c8f182f9e4f9ed121683' ||
      plan.inputs.regressionBudgetId !== 'regression-budgets-v1' || plan.inputs.regressionBudgetBaseline !== '0.1.0-beta.8')
    throw new Error('Invalid PII profile-cost input binding');
  if (JSON.stringify(plan.baselineSemantics.map((row: any) => row.id)) !== JSON.stringify(['activation', 'distribution', 'regression-budget']) ||
      JSON.stringify(plan.credentialProfiles) !== JSON.stringify(['full', 'common']) ||
      JSON.stringify(plan.piiProfiles.map((row: any) => row.id)) !== JSON.stringify(PROFILE_IDS))
    throw new Error('Invalid PII profile-cost comparison roster');
  for (const profile of plan.piiProfiles) {
    const keys = profile.id === 'beta10-full' ? ['id', 'selectors', 'families', 'equivalentProfileOf'] : ['id', 'selectors', 'families'];
    if (!exact(profile, keys) || !sortedUnique(profile.selectors) || !sortedUnique(profile.families))
      throw new Error('Invalid PII profile-cost selector closure');
  }
  const global = plan.piiProfiles.find((row: any) => row.id === 'global');
  const exactUs = plan.piiProfiles.find((row: any) => row.id === 'us-ssn-exact');
  const jurisdiction = plan.piiProfiles.find((row: any) => row.id === 'us-jurisdiction');
  const full = plan.piiProfiles.find((row: any) => row.id === 'beta10-full');
  if (JSON.stringify(global.selectors) !== JSON.stringify(['pii:global']) || global.families.length !== 5 ||
      JSON.stringify(exactUs) !== JSON.stringify({ id: 'us-ssn-exact', selectors: ['pii:family:us:ssn'], families: ['pii:us:ssn'] }) ||
      full.equivalentProfileOf !== 'us-jurisdiction' || JSON.stringify(full.families) !== JSON.stringify(jurisdiction.families) ||
      JSON.stringify(full.selectors) === JSON.stringify(jurisdiction.selectors))
    throw new Error('Invalid PII profile-cost equivalent profile declaration');
  if (JSON.stringify(plan.jurisdictionComparison) !== JSON.stringify({ status: 'not-applicable',
      reasonCode: 'no-second-registered-jurisdiction', registeredJurisdictions: ['us'],
      policyIssue: 'https://github.com/redact-secret/redact-secret/issues/795' }))
    throw new Error('Invalid PII profile-cost jurisdiction applicability');
  if (JSON.stringify(plan.surfaces.map((row: any) => row.id)) !== JSON.stringify(SURFACE_IDS) ||
      plan.surfaces.some((row: any) => !Array.isArray(row.credentialProfiles) || !row.credentialProfiles.length ||
        row.credentialProfiles.some((profile: unknown) => !plan.credentialProfiles.includes(profile)) || !Array.isArray(row.memory) ||
        row.memory.some((metric: unknown) => !MEMORY_METRIC_IDS.has(metric as string)) ||
        (row.unavailableMemory ?? []).some((metric: any) => !MEMORY_METRIC_IDS.has(metric.metric) ||
          metric.status !== 'not-applicable' || typeof metric.reasonCode !== 'string' || !metric.reasonCode)))
    throw new Error('Invalid PII profile-cost surface roster');
  const python = plan.surfaces.find((row: any) => row.id === 'python'), cli = plan.surfaces.find((row: any) => row.id === 'cli');
  for (const row of [python, cli]) if (JSON.stringify(row.credentialProfiles) !== JSON.stringify(['full']) ||
      JSON.stringify(row.unavailableCredentialProfiles) !== JSON.stringify([{ profile: 'common', status: 'not-applicable',
        reasonCode: row.id === 'python' ? 'binding-has-no-common-entrypoint' : 'surface-has-no-common-profile-option' }]))
    throw new Error('Invalid PII profile-cost typed profile N/A');
  if (JSON.stringify(plan.sampleProtocol) !== JSON.stringify({ environment: 'github-hosted-ubuntu-24.04-x86_64-release', minimumSamplesPerSide: 12,
      warmupSamples: 2, processIsolation: 'fresh-process-per-sample', pairing: 'same-job', roundOrder: 'ABBA',
      aaRunsRequiredBeforeCandidate: 3, cpuModelRequired: true, candidateBlockedUntilThresholdFreeze: true, transientRetryLimit: 2 }))
    throw new Error('Invalid PII profile-cost sample protocol');
  if (plan.officialLinuxExecution?.runner !== 'github-hosted-ubuntu-24.04-x86_64' ||
      plan.officialLinuxExecution?.playwrightVersion !== '1.55.0' || plan.officialLinuxExecution?.chromiumRevision !== 1187 ||
      plan.officialLinuxExecution?.phaseIsolation !== 'candidate-phase-cannot-write-thresholds' ||
      JSON.stringify(plan.officialLinuxExecution?.phases) !== JSON.stringify(['reviewed-freeze-commit',
        'three-distinct-full-matrix-aa-runs', 'threshold-freeze-from-aa-only', 'candidate-full-matrix-with-frozen-thresholds',
        'distribution-size-collection', 'sanitized-evidence-validation'])) throw new Error('Invalid official Linux execution plan');
  const implementationPaths = ['.github/workflows/pii-profile-cost-v2.yml', 'benchmarks/evaluation/domains/pii/profile-cost-v2.ts',
    'scripts/build-pii-profile-cost-browser-bundle-v2.mjs', 'scripts/collect-pii-profile-cost-sizes-v2.mjs',
    'scripts/freeze-pii-profile-cost-thresholds-v2.mjs', 'scripts/measure-pii-profile-cost-v2.mjs',
    'scripts/prepare-pii-profile-cost-linux-v2.mjs', 'scripts/prepare-pii-profile-cost-size-config-v2.mjs',
    'scripts/pii-profile-cost/adapter-protocol.mjs', 'scripts/pii-profile-cost/chromium-sample.mjs',
    'scripts/pii-profile-cost/cli-sample.mjs', 'scripts/pii-profile-cost/node-sample.mjs',
    'scripts/pii-profile-cost/python-sample.py', 'scripts/pii-profile-cost/rust-sample.rs', 'tests/pii-profile-cost-v2.test.mjs'];
  if (plan.implementationFreeze?.algorithm !== 'sha256-file-bytes' ||
      JSON.stringify(plan.implementationFreeze?.files?.map((row: any) => row.path)) !== JSON.stringify(implementationPaths) ||
      plan.implementationFreeze.files.some((row: any) => !exact(row, ['path', 'sha256']) || !digest(row.sha256)))
    throw new Error('Invalid PII profile-cost implementation freeze');
  if (plan.thresholdPolicy.source !== 'benchmarks/lib/regression-budgets.ts#RULES' || plan.thresholdPolicy.latency.minimumSamples !== 10 ||
      plan.thresholdPolicy.initialization.minimumSamples !== 10 || plan.thresholdPolicy.memory.minimumSamples !== 5 ||
      plan.thresholdPolicy.size.relative !== 0.05 || plan.thresholdPolicy.throughput.verdict !== 'informational')
    throw new Error('Invalid PII profile-cost threshold policy');
  return plan;
}

export function validatePiiProfileCostWorkloads(value: unknown = piiProfileCostWorkloads) {
  const workloads = structuredClone(value) as any;
  if (!exact(workloads, ['schemaVersion', 'id', 'safety', 'generator', 'workloads', 'contentCommitment']) || workloads.schemaVersion !== 1 ||
      workloads.id !== 'pii-profile-cost-workloads-v1' || workloads.contentCommitment !== commitment(withoutCommitment(workloads)) ||
      workloads.safety?.realPersonOrAccountProvenance !== false || workloads.safety?.rawInputPublication !== 'plan-only' ||
      workloads.safety?.evidenceProjection !== 'commitment-only' || workloads.generator?.lineCount !== 4096 ||
      workloads.generator?.chunkCodeUnits !== 127 || JSON.stringify(workloads.workloads.map((row: any) => row.id)) !==
      JSON.stringify(['validator-heavy', 'multilingual-context']) || workloads.workloads.some((row: any) => !Array.isArray(row.lines) ||
        row.lines.length < 6 || row.lines.some((line: unknown) => typeof line !== 'string' || !line)))
    throw new Error('Invalid PII profile-cost workload contract');
  return workloads;
}

export function piiProfileCostSchedule(rounds = piiProfileCostPlan.sampleProtocol.minimumSamplesPerSide, filteredDevelopment = false) {
  if (!Number.isInteger(rounds) || rounds < (filteredDevelopment ? 2 : 10) || rounds % 2 !== 0)
    throw new Error('Invalid PII profile-cost ABBA round count');
  return roundOrder(rounds).map(({ side, round }) => ({ side: side === 'baseline' ? 'off' as const : 'enabled' as const, round }));
}

export interface ProfileCostSample {
  readonly import: number | { readonly status: 'not-applicable'; readonly reasonCode: string };
  readonly initialize: number | { readonly status: 'not-applicable'; readonly reasonCode: string };
  readonly wholeInput: number | { readonly status: 'not-applicable'; readonly reasonCode: string };
  readonly incremental: number | { readonly status: 'not-applicable'; readonly reasonCode: string };
  readonly bytesPerSecond: {
    readonly wholeInput: number | { readonly status: 'not-applicable'; readonly reasonCode: string };
    readonly incremental: number | { readonly status: 'not-applicable'; readonly reasonCode: string };
  };
  readonly memory: Readonly<Record<string, number | { readonly status: 'not-applicable'; readonly reasonCode: string }>>;
}

export function validatePiiProfileCostSample(value: unknown): ProfileCostSample {
  const sample = structuredClone(value) as any;
  const metric = (candidate: unknown) => Number.isFinite(candidate) && (candidate as number) >= 0 ||
    exact(candidate, ['status', 'reasonCode']) && (candidate as any).status === 'not-applicable' &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((candidate as any).reasonCode);
  if (!exact(sample, ['import', 'initialize', 'wholeInput', 'incremental', 'bytesPerSecond', 'memory']) ||
      !exact(sample.bytesPerSecond, ['wholeInput', 'incremental']) || !sample.memory || typeof sample.memory !== 'object' || Array.isArray(sample.memory) ||
      [sample.import, sample.initialize, sample.wholeInput, sample.incremental, sample.bytesPerSecond.wholeInput,
        sample.bytesPerSecond.incremental].some(candidate => !metric(candidate)))
    throw new Error('Invalid PII profile-cost sample');
  for (const [id, metric] of Object.entries(sample.memory)) if (!MEMORY_METRIC_IDS.has(id) ||
      (!(Number.isFinite(metric) && (metric as number) >= 0) &&
      !(exact(metric, ['status', 'reasonCode']) && (metric as any).status === 'not-applicable' &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((metric as any).reasonCode)))) throw new Error('Invalid PII profile-cost memory metric');
  return sample as ProfileCostSample;
}

export function derivePiiProfileCostTimingThresholds(aaRuns: readonly { baseline: readonly number[]; candidate: readonly number[] }[],
  dimension: 'latency' | 'initialization') {
  if (aaRuns.length < piiProfileCostPlan.sampleProtocol.aaRunsRequiredBeforeCandidate ||
      aaRuns.some(run => run.baseline.length < 10 || run.candidate.length < 10)) throw new Error('Insufficient PII profile-cost A/A evidence');
  const ratios = aaRuns.map(run => pairedRatios(run.baseline, run.candidate));
  const medianNoise = Math.max(...ratios.map(row => Math.max(row.median, 1 / row.median) - 1));
  const p95Noise = Math.max(...ratios.map(row => Math.max(row.p95, 1 / row.p95) - 1));
  const latency = dimension === 'latency';
  return {
    medianRelative: ceilToFivePercent(Math.max(latency ? 0.10 : 0.25, 2 * medianNoise)),
    tailRelative: ceilToFivePercent(Math.max(latency ? 0.15 : 0.50, 2 * p95Noise)),
    absoluteFloorMilliseconds: latency ? 1 : 2,
    minimumSamples: 10,
    aaRuns: aaRuns.length,
  };
}

export function derivePiiProfileCostMemoryThreshold(aaRuns: readonly { baseline: readonly number[]; candidate: readonly number[] }[]) {
  const minimum = piiProfileCostPlan.thresholdPolicy.memory.minimumSamples;
  if (aaRuns.length < piiProfileCostPlan.sampleProtocol.aaRunsRequiredBeforeCandidate || aaRuns.some(run =>
      run.baseline.length < minimum || run.candidate.length < minimum || [...run.baseline, ...run.candidate]
        .some(value => !Number.isFinite(value) || value < 0))) throw new Error('Insufficient PII profile-cost memory A/A evidence');
  const maxima = aaRuns.map(run => ({ baseline: Math.max(...run.baseline), candidate: Math.max(...run.candidate) }));
  const spread = (values: readonly number[]) => {
    const smallest = Math.min(...values), largest = Math.max(...values);
    return smallest === 0 ? (largest === 0 ? 0 : Number.POSITIVE_INFINITY) : largest / smallest - 1;
  };
  // #143 judges the largest sample. Cross-run noise is the spread of each
  // official run's largest A/A sample; rerun noise is the largest paired-side
  // deviation inside a run. Keep both inputs in the freeze for auditability.
  const ciCrossRunSpread = spread(maxima.map(row => Math.max(row.baseline, row.candidate)));
  const rerunSpread = Math.max(...maxima.map(row => {
    const smallest = Math.min(row.baseline, row.candidate), largest = Math.max(row.baseline, row.candidate);
    return smallest === 0 ? (largest === 0 ? 0 : Number.POSITIVE_INFINITY) : largest / smallest - 1;
  }));
  const noise = Math.max(ciCrossRunSpread, rerunSpread);
  if (!Number.isFinite(noise)) throw new Error('Invalid zero-denominator PII profile-cost memory A/A evidence');
  return { relative: ceilToFivePercent(Math.max(0.10, 2 * noise)), absoluteFloorBytes: 1048576,
    minimumSamples: 5, aaRuns: aaRuns.length, ciCrossRunSpread, rerunSpread };
}

export function piiProfileCostExpectedThresholdCells() {
  const runtime = ['import', 'initialize', 'wholeInput', 'incremental'];
  return piiProfileCostPlan.surfaces.flatMap(surface => surface.credentialProfiles.flatMap(credentialProfile =>
    piiProfileCostPlan.piiProfiles.filter(profile => profile.id !== 'off').flatMap(profile =>
      piiProfileCostWorkloads.workloads.flatMap(workload => {
        const key = `${surface.id}/${credentialProfile}/${profile.id}/${workload.id}`;
        const memory = [...surface.memory, ...(surface.unavailableMemory ?? []).map(row => row.metric)];
        return [...runtime.map(metric => `${key}/${metric}`), ...memory.map(metric => `${key}/memory/${metric}`)];
      }))));
}

export function validatePiiProfileCostBrowserBundleManifest(value: unknown, expectedProfile: 'full' | 'common') {
  const manifest = structuredClone(value) as any;
  const expectedEntry = expectedProfile === 'full' ? '@redact-secret/core' : '@redact-secret/core/common';
  if (!exact(manifest, ['profile', 'tool', 'entry', 'files', 'bundleManifestCommitment']) || manifest.profile !== expectedProfile ||
      manifest.tool !== 'vite-8.3.0' || manifest.entry !== expectedEntry || !Array.isArray(manifest.files) || !manifest.files.length ||
      manifest.files.some((row: any) => !exact(row, ['relativePath', 'sha256']) || typeof row.relativePath !== 'string' ||
        row.relativePath.startsWith('/') || row.relativePath.split('/').includes('..') || !digest(row.sha256)) ||
      new Set(manifest.files.map((row: any) => row.relativePath)).size !== manifest.files.length ||
      !manifest.files.some((row: any) => row.relativePath.endsWith('.js')) ||
      !manifest.files.some((row: any) => row.relativePath.endsWith('.wasm')) ||
      manifest.bundleManifestCommitment !== commitment({ profile: manifest.profile, tool: manifest.tool,
        entry: manifest.entry, files: manifest.files }))
    throw new Error('Invalid PII profile-cost browser bundle manifest');
  return manifest;
}

export function validatePiiProfileCostThresholds(value: unknown) {
  const thresholds = structuredClone(value) as any;
  const freezeProvenanceValid = thresholds.freezeProvenance?.kind === 'local-development'
    ? exact(thresholds.freezeProvenance, ['kind'])
    : thresholds.freezeProvenance?.kind === 'github-actions' &&
      exact(thresholds.freezeProvenance, ['kind', 'runId', 'job', 'event', 'workflowRef', 'benchmarkCommit']) &&
      /^\d+$/.test(thresholds.freezeProvenance.runId) && thresholds.freezeProvenance.job === 'freeze' &&
      thresholds.freezeProvenance.event === 'workflow_dispatch' &&
      /^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost-v2\.yml@/.test(thresholds.freezeProvenance.workflowRef) &&
      /^[a-f0-9]{40}$/.test(thresholds.freezeProvenance.benchmarkCommit);
  if (!exact(thresholds, ['schemaVersion', 'reportType', 'supportClaims', 'planCommitment', 'workloadCommitment', 'frozenAt',
      'aaRunCommitments', 'aaProvenance', 'freezeProvenance', 'cells', 'artifactCommitment']) || thresholds.schemaVersion !== 1 ||
      thresholds.reportType !== 'pii-profile-cost-thresholds' || thresholds.supportClaims !== false ||
      thresholds.planCommitment !== piiProfileCostPlan.contentCommitment ||
      thresholds.workloadCommitment !== piiProfileCostWorkloads.contentCommitment || !Number.isFinite(Date.parse(thresholds.frozenAt)) ||
      !Array.isArray(thresholds.aaRunCommitments) || thresholds.aaRunCommitments.length < piiProfileCostPlan.sampleProtocol.aaRunsRequiredBeforeCandidate ||
      !thresholds.aaRunCommitments.every(digest) || new Set(thresholds.aaRunCommitments).size !== thresholds.aaRunCommitments.length ||
      !exact(thresholds.aaProvenance, ['benchmarkCommit', 'configCommitment', 'runIds']) ||
      !/^[a-f0-9]{40}$/.test(thresholds.aaProvenance.benchmarkCommit) || !digest(thresholds.aaProvenance.configCommitment) ||
      !Array.isArray(thresholds.aaProvenance.runIds) || !thresholds.aaProvenance.runIds.every((id: unknown) => typeof id === 'string' && /^\d+$/.test(id)) ||
      new Set(thresholds.aaProvenance.runIds).size !== thresholds.aaProvenance.runIds.length ||
      JSON.stringify(thresholds.aaProvenance.runIds) !== JSON.stringify([...thresholds.aaProvenance.runIds].sort()) ||
      thresholds.aaProvenance.runIds.length !== thresholds.aaRunCommitments.length ||
      !freezeProvenanceValid ||
      (thresholds.freezeProvenance?.kind === 'github-actions' &&
        thresholds.freezeProvenance.benchmarkCommit !== thresholds.aaProvenance.benchmarkCommit) ||
      !Array.isArray(thresholds.cells) || !digest(thresholds.artifactCommitment) ||
      thresholds.artifactCommitment !== commitment(withoutCommitment(thresholds))) throw new Error('Invalid PII profile-cost threshold freeze');
  const ids = thresholds.cells.map((row: any) => `${row.key}/${row.metric}`).sort();
  if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(piiProfileCostExpectedThresholdCells().sort()))
    throw new Error('Incomplete PII profile-cost threshold matrix');
  for (const row of thresholds.cells) {
    if (row.status === 'not-applicable') {
      if (!exact(row, ['key', 'metric', 'status', 'reasonCode']) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.reasonCode))
        throw new Error('Invalid PII profile-cost unavailable threshold');
    } else if (row.status !== 'frozen' || typeof row.key !== 'string' || typeof row.metric !== 'string' ||
      !Number.isFinite(row.relative ?? row.medianRelative) || (row.tailRelative !== undefined && !Number.isFinite(row.tailRelative)) ||
      !Number.isFinite(row.absoluteFloorBytes ?? row.absoluteFloorMilliseconds) || !Number.isInteger(row.minimumSamples) ||
      row.minimumSamples < 5 || !Number.isInteger(row.aaRuns) || row.aaRuns < piiProfileCostPlan.sampleProtocol.aaRunsRequiredBeforeCandidate)
      throw new Error('Invalid PII profile-cost frozen threshold');
  }
  return thresholds;
}

export function assertPiiProfileCostPublicEvidenceSafe(value: unknown) {
  const plan = validatePiiProfileCostPlan();
  const serialized = JSON.stringify(value);
  for (const key of plan.evidenceSafety.forbiddenKeys) if (new RegExp(`"${key}"\\s*:`, 'i').test(serialized))
    throw new Error(`Unsafe PII profile-cost evidence key: ${key}`);
  for (const text of plan.evidenceSafety.forbiddenText) if (serialized.includes(text))
    throw new Error('Unsafe PII profile-cost evidence text');
  return true;
}

const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)];

export function evaluatePiiProfileCostCandidate(observations: any[], thresholdArtifact: unknown) {
  const thresholds = validatePiiProfileCostThresholds(thresholdArtifact);
  const evaluation = observations.flatMap(row => {
    const key = `${row.surface}/${row.credentialProfile}/${row.profile}/${row.workload}`, results = [];
    for (const metric of ['import', 'initialize', 'wholeInput', 'incremental']) {
      const threshold = thresholds.cells.find((cell: any) => cell.key === key && cell.metric === metric);
      const reference = row.sides.reference.map((sample: any) => sample[metric]);
      const comparison = row.sides.comparison.map((sample: any) => sample[metric]);
      if (threshold.status === 'not-applicable') { results.push({ key, metric, verdict: 'not-applicable', reasonCode: threshold.reasonCode }); continue; }
      const baselineMedian = quantile(reference, 0.5), comparisonMedian = quantile(comparison, 0.5);
      const baselineP95 = quantile(reference, 0.95), comparisonP95 = quantile(comparison, 0.95);
      if (![baselineMedian, comparisonMedian, baselineP95, comparisonP95].every(Number.isFinite) || baselineMedian <= 0 || baselineP95 <= 0)
        throw new Error(`Invalid PII profile-cost timing evidence: ${key}/${metric}`);
      const medianRatio = comparisonMedian / baselineMedian, tailRatio = comparisonP95 / baselineP95;
      const medianAllowed = Math.max(threshold.medianRelative, threshold.absoluteFloorMilliseconds / baselineMedian);
      const tailAllowed = Math.max(threshold.tailRelative, threshold.absoluteFloorMilliseconds / baselineP95);
      const medianBreach = medianRatio - 1 > medianAllowed, tailBreach = tailRatio - 1 > tailAllowed;
      results.push({ key, metric, baselineMedian, comparisonMedian, medianRatio, baselineP95, comparisonP95, tailRatio,
        verdict: medianBreach ? 'regression' : tailBreach ? 'invalid-measurement' : 'within-budget',
        ...(tailBreach && !medianBreach ? { reasonCode: 'tail-only-rerun-required' } : {}) });
    }
    for (const metric of Object.keys(row.sides.reference[0].memory).sort()) {
      const threshold = thresholds.cells.find((cell: any) => cell.key === key && cell.metric === `memory/${metric}`);
      const reference = row.sides.reference.map((sample: any) => sample.memory[metric]);
      const comparison = row.sides.comparison.map((sample: any) => sample.memory[metric]);
      if (threshold.status === 'not-applicable') {
        results.push({ key, metric: `memory/${metric}`, verdict: 'not-applicable', reasonCode: threshold.reasonCode }); continue;
      }
      const baselineMaximum = Math.max(...reference), comparisonMaximum = Math.max(...comparison);
      if (![baselineMaximum, comparisonMaximum].every(Number.isFinite) || baselineMaximum <= 0)
        throw new Error(`Invalid PII profile-cost memory evidence: ${key}/${metric}`);
      const deltaBytes = comparisonMaximum - baselineMaximum, relative = deltaBytes / baselineMaximum;
      results.push({ key, metric: `memory/${metric}`, baselineMaximum, comparisonMaximum, deltaBytes, relative,
        verdict: deltaBytes > threshold.absoluteFloorBytes && relative > threshold.relative ? 'regression' : 'within-budget' });
    }
    return results;
  });
  const informational = observations.flatMap(row => {
    const key = `${row.surface}/${row.credentialProfile}/${row.profile}/${row.workload}`;
    return ['wholeInput', 'incremental'].map(metric => {
      const reference = row.sides.reference.map((sample: any) => sample.bytesPerSecond[metric]);
      const comparison = row.sides.comparison.map((sample: any) => sample.bytesPerSecond[metric]);
      if ([...reference, ...comparison].every(value => value?.status === 'not-applicable'))
        return { key, metric: `throughput/${metric}`, status: 'not-applicable', reasonCode: 'surface-metric-unavailable' };
      if ([...reference, ...comparison].some(value => typeof value !== 'number'))
        throw new Error(`Mixed PII profile-cost throughput availability: ${key}/${metric}`);
      return { key, metric: `throughput/${metric}`, status: 'informational', referenceMedian: quantile(reference, 0.5),
        referenceP95: quantile(reference, 0.95), comparisonMedian: quantile(comparison, 0.5), comparisonP95: quantile(comparison, 0.95) };
    });
  });
  const verdict = evaluation.some((row: any) => row.verdict === 'regression') ? 'regression' :
    evaluation.some((row: any) => row.verdict === 'invalid-measurement') ? 'invalid-measurement' : 'accepted';
  return { thresholdCommitment: thresholds.artifactCommitment, verdict, evaluation, informational };
}

export function validatePiiProfileCostCandidateReport(value: unknown, thresholdArtifact: unknown) {
  const report = structuredClone(value) as any;
  const derived = evaluatePiiProfileCostCandidate(report.observations ?? [], thresholdArtifact);
  if (!exact(report, ['schemaVersion', 'reportType', 'supportClaims', 'planCommitment', 'workloadCommitment', 'sourceCommit', 'mode',
      'runId', 'selection', 'runner', 'provenance', 'startedAt', 'completedAt', 'artifactCommitments', 'adapterCommitments',
      'thresholdCommitment', 'verdict', 'evaluation', 'informational', 'observations', 'artifactCommitment']) || report.schemaVersion !== 1 ||
      report.reportType !== 'pii-profile-cost-candidate' || report.supportClaims !== false || report.mode !== 'candidate' ||
      report.planCommitment !== piiProfileCostPlan.contentCommitment || report.workloadCommitment !== piiProfileCostWorkloads.contentCommitment ||
      report.sourceCommit !== piiProfileCostPlan.inputs.candidateProductCommit || !exact(report.selection, ['scope', 'filter']) ||
      report.selection.scope !== 'full-matrix' || report.selection.filter !== null ||
      !exact(report.runner, ['platform', 'arch', 'node', 'cpuModel']) || report.runner.platform !== 'linux' ||
      report.runner.arch !== 'x64' || typeof report.runner.node !== 'string' || !report.runner.cpuModel ||
      !exact(report.provenance, ['kind', 'repository', 'runId', 'runAttempt', 'job', 'event', 'workflowRef', 'benchmarkCommit', 'configCommitment']) ||
      report.provenance.kind !== 'github-actions' || report.provenance.repository !== 'redact-secret/redact-secret-benchmarks' ||
      report.provenance?.job !== 'runtime' || report.provenance?.event !== 'workflow_dispatch' ||
      !/^redact-secret\/redact-secret-benchmarks\/.github\/workflows\/pii-profile-cost-v2\.yml@/.test(report.provenance?.workflowRef ?? '') ||
      !/^\d+$/.test(report.runId) || report.provenance.runId !== report.runId || !/^\d+$/.test(report.provenance.runAttempt) ||
      !/^[a-f0-9]{40}$/.test(report.provenance?.benchmarkCommit ?? '') || !digest(report.provenance?.configCommitment) ||
      !Number.isFinite(Date.parse(report.startedAt)) || !Number.isFinite(Date.parse(report.completedAt)) ||
      Date.parse(report.completedAt) < Date.parse(report.startedAt) ||
      !Array.isArray(report.artifactCommitments) || JSON.stringify(report.artifactCommitments.map((row: any) => row.id).sort()) !== JSON.stringify(['browser-common-wasm',
        'browser-full-wasm', 'candidate-inventory', 'cli-linux-x64', 'node-forced-wasm', 'node-native', 'python-wheel-install',
        'rust-release-helper']) || report.artifactCommitments.some((row: any) => !exact(row, ['id', 'sha256']) || !digest(row.sha256)) ||
      !Array.isArray(report.adapterCommitments) || JSON.stringify(report.adapterCommitments.map((row: any) => row.surface).sort()) !== JSON.stringify([...SURFACE_IDS].sort()) ||
      report.adapterCommitments.some((row: any) => !exact(row, ['surface', 'sha256']) || !digest(row.sha256)) ||
      report.thresholdCommitment !== derived.thresholdCommitment || !Array.isArray(report.observations) || !Array.isArray(report.evaluation) ||
      !Array.isArray(report.informational) ||
      report.artifactCommitment !== commitment(withoutCommitment(report))) throw new Error('Invalid PII profile-cost candidate report');
  const expectedObservationKeys = piiProfileCostPlan.surfaces.flatMap(surface => surface.credentialProfiles.flatMap(credentialProfile =>
    piiProfileCostPlan.piiProfiles.filter(profile => profile.id !== 'off').flatMap(profile =>
      piiProfileCostWorkloads.workloads.map(workload => `${surface.id}/${credentialProfile}/${profile.id}/${workload.id}`)))).sort();
  const actualObservationKeys = report.observations.map((row: any) => `${row.surface}/${row.credentialProfile}/${row.profile}/${row.workload}`).sort();
  if (new Set(actualObservationKeys).size !== actualObservationKeys.length ||
      JSON.stringify(actualObservationKeys) !== JSON.stringify(expectedObservationKeys)) throw new Error('Incomplete PII profile-cost candidate matrix');
  for (const row of report.observations) {
    const definition = piiProfileCostWorkloads.workloads.find((workload: any) => workload.id === row.workload);
    if (!definition) throw new Error('Unknown PII profile-cost workload');
    const text = `${Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) =>
      definition.lines[index % definition.lines.length]).join('\n')}\n`;
    if (!exact(row, ['surface', 'credentialProfile', 'profile', 'workload', 'workloadCommitment', 'workloadBytes', 'samplesPerSide', 'transientRetries', 'sides']) ||
        !exact(row.sides, ['reference', 'comparison']) ||
        row.workloadCommitment !== hash(text) || row.workloadBytes !== new TextEncoder().encode(text).length ||
        row.samplesPerSide < piiProfileCostPlan.sampleProtocol.minimumSamplesPerSide ||
        !Number.isInteger(row.transientRetries) || row.transientRetries < 0 ||
        row.sides.reference.length !== row.samplesPerSide || row.sides.comparison.length !== row.samplesPerSide)
      throw new Error('Invalid PII profile-cost candidate observation');
    for (const sample of [...row.sides.reference, ...row.sides.comparison]) validatePiiProfileCostSample(sample);
  }
  const evaluationKeys = report.evaluation.map((row: any) => `${row.key}/${row.metric}`).sort();
  if (new Set(evaluationKeys).size !== evaluationKeys.length ||
      JSON.stringify(evaluationKeys) !== JSON.stringify(piiProfileCostExpectedThresholdCells().sort()) ||
      report.evaluation.some((row: any) => {
        if (row.verdict === 'not-applicable')
          return !exact(row, ['key', 'metric', 'verdict', 'reasonCode']) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.reasonCode);
        if (String(row.metric).startsWith('memory/'))
          return !exact(row, ['key', 'metric', 'baselineMaximum', 'comparisonMaximum', 'deltaBytes', 'relative', 'verdict']) ||
            ![row.baselineMaximum, row.comparisonMaximum, row.deltaBytes].every(Number.isFinite) ||
            !(row.relative === null || Number.isFinite(row.relative)) || !['within-budget', 'regression'].includes(row.verdict);
        const keys = row.verdict === 'invalid-measurement'
          ? ['key', 'metric', 'baselineMedian', 'comparisonMedian', 'medianRatio', 'baselineP95', 'comparisonP95', 'tailRatio', 'verdict', 'reasonCode']
          : ['key', 'metric', 'baselineMedian', 'comparisonMedian', 'medianRatio', 'baselineP95', 'comparisonP95', 'tailRatio', 'verdict'];
        return !exact(row, keys) || ![row.baselineMedian, row.comparisonMedian, row.medianRatio, row.baselineP95,
          row.comparisonP95, row.tailRatio].every(Number.isFinite) || !['within-budget', 'regression', 'invalid-measurement'].includes(row.verdict) ||
          (row.verdict === 'invalid-measurement' && row.reasonCode !== 'tail-only-rerun-required');
      }))
    throw new Error('Invalid PII profile-cost candidate evaluation');
  const expectedVerdict = report.evaluation.some((row: any) => row.verdict === 'regression') ? 'regression' :
    report.evaluation.some((row: any) => row.verdict === 'invalid-measurement') ? 'invalid-measurement' : 'accepted';
  if (report.verdict !== expectedVerdict) throw new Error('Invalid PII profile-cost candidate verdict');
  if (JSON.stringify({ verdict: report.verdict, evaluation: report.evaluation, informational: report.informational }) !==
      JSON.stringify({ verdict: derived.verdict, evaluation: derived.evaluation, informational: derived.informational }))
    throw new Error('Stale or forged PII profile-cost candidate evaluation');
  const expectedInformational = expectedObservationKeys.flatMap(key => [`${key}/throughput/wholeInput`, `${key}/throughput/incremental`]).sort();
  const actualInformational = report.informational.map((row: any) => `${row.key}/${row.metric}`).sort();
  if (new Set(actualInformational).size !== actualInformational.length || JSON.stringify(actualInformational) !== JSON.stringify(expectedInformational) ||
      report.informational.some((row: any) => row.status === 'not-applicable'
        ? !exact(row, ['key', 'metric', 'status', 'reasonCode']) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.reasonCode)
        : !exact(row, ['key', 'metric', 'status', 'referenceMedian', 'referenceP95', 'comparisonMedian', 'comparisonP95']) ||
          row.status !== 'informational' || ![row.referenceMedian, row.referenceP95, row.comparisonMedian, row.comparisonP95].every(Number.isFinite)))
    throw new Error('Invalid PII profile-cost candidate informational metrics');
  assertPiiProfileCostPublicEvidenceSafe(report);
  return report;
}

validatePiiProfileCostPlan();
validatePiiProfileCostWorkloads();
