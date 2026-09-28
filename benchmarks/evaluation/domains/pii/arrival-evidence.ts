import contractData from '../../../../qualification/pii-national-id-arrival-v1.json';
import { hash } from '../../substrate/hash.ts';
import { validatePiiHoldoutReport, type PiiHoldoutReport } from './holdout.ts';
import { piiBenignCollisionEvidence } from './benign-collision-evidence.ts';
import { comparePiiPopulationReports, piiPopulationContract, validatePiiPopulationReport,
  type PiiPopulationReport } from './populations.ts';
import type { PiiAccountingRow } from './accounting.ts';
import { parsePiiActivationIdentity } from './product-binding.ts';
import type { PiiContextVocabulary } from './context-vocabulary.ts';

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
export const piiArrivalCommitment = (value: unknown) => hash(JSON.stringify(canonical(value)));
export const piiArrivalContract = Object.freeze(structuredClone(contractData));
export const piiArrivalContractCommitment = piiArrivalCommitment(piiArrivalContract);
export const piiArrivalFamilyContractCommitment = '48f542ca67a15e398f22003b499f9be9c762b1666b9035030125562ed64b825a';
export const piiArrivalPopulationScannerConfiguration = Object.freeze({ adapter: 'product-public-plus-source-bound-identity-v1',
  selectionComparison: piiArrivalContract.population.selectionComparison });
const digest = (value: unknown, size = 64) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const projection = (value: Record<string, unknown>) => { const { artifactCommitment: _commitment, ...rest } = value; return rest; };

/**
 * The frozen arrival contract was measured against `pii-context/v1` (beta.10). A later candidate that reports
 * another vocabulary must name it explicitly, so a silent vocabulary change still fails closed.
 */
export function piiArrivalSelectionEvidence(side: 'baseline' | 'candidate', activationIdentity: string, familyAvailability: string,
  vocabulary: PiiContextVocabulary = 'pii-context/v1') {
  const policy = piiArrivalContract.population.selectionComparison, expected = policy[side];
  const parsed = parsePiiActivationIdentity(activationIdentity);
  if (parsed.credentials !== 'full' || parsed.vocabulary !== vocabulary ||
      JSON.stringify(parsed.selectors) !== JSON.stringify(expected.effectiveSelectors) ||
      JSON.stringify(parsed.families) !== JSON.stringify(expected.expectedAvailableFamilies) ||
      familyAvailability !== expected.familyAvailability)
    throw new Error(`${side} PII selector closure mismatch`);
  return { logicalRequestedAddition: policy.logicalRequestedAddition, effectiveSelectors: parsed.selectors,
    selectionState: expected.selectionState, familyAvailability, availableFamilies: parsed.families, activationIdentity };
}

export function validatePiiArrivalWasmPayloadRoster(fileNames: string[]) {
  const members = piiArrivalContract.operational.wasmPayloadPolicy.members;
  const expected = Object.values(members).map(member => member.fileName).sort(), actual = [...fileNames].sort();
  if (piiArrivalContract.operational.wasmPayloadPolicy.accounting !== 'aggregate-named-payloads' ||
      JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Invalid PII arrival Wasm payload roster');
  return structuredClone(members);
}

export function validatePiiArrivalRuntimeSample(value: unknown) {
  const sample = structuredClone(value) as any, keys = piiArrivalContract.operational.sampleProtocol.stdout.keys;
  if (!exact(sample, keys) || Object.values(sample).some(metric => !Number.isFinite(metric) || (metric as number) < 0))
    throw new Error('Invalid PII arrival runtime sample');
  return sample as Record<(typeof keys)[number], number>;
}

export function parsePiiArrivalRuntimeSampleProcess(stdout: string, stderr: string) {
  if (stderr !== '' || stdout.split('\n').filter(Boolean).length !== 1) throw new Error('Invalid PII arrival runtime sample process output');
  try { return validatePiiArrivalRuntimeSample(JSON.parse(stdout)); }
  catch (error) { throw new Error('Invalid PII arrival runtime sample process output', { cause: error }); }
}

export function piiArrivalOperationalSampleProtocol(workloadCommitment: string) {
  const protocol = piiArrivalContract.operational.sampleProtocol;
  const order = piiArrivalContract.operational.surfaces.flatMap(surface => piiArrivalContract.operational.profiles.flatMap(profile =>
    Array.from({ length: piiArrivalContract.operational.minimumPairedSamples + protocol.warmupSamples }, (_, index) =>
      ['baseline', 'candidate'].map(side => `${surface}/${profile}/${index}/${side}`)).flat()));
  return { helperSha256: protocol.helperSha256, argvCommitment: piiArrivalCommitment(protocol.argv),
    environmentCommitment: piiArrivalCommitment(protocol.environment), workloadCommitment,
    executionOrderCommitment: piiArrivalCommitment(order), successfulSamplesPerPair: piiArrivalContract.operational.minimumPairedSamples };
}

export interface PiiPopulationArrivalBundle {
  schemaVersion: 1; reportType: 'pii-population-arrival-bundle'; supportClaims: false; family: 'pii:us:ssn';
  contractCommitment: string; corpusCommitment: string;
  baseline: { sourceCommit: string; candidateEvidenceSha256: string; artifactSetCommitment: string; components: Record<string, string>; selection: Record<string, unknown>; rows: PiiAccountingRow[]; reports: PiiPopulationReport[] };
  candidate: { sourceCommit: string; candidateEvidenceSha256: string; artifactSetCommitment: string; components: Record<string, string>; selection: Record<string, unknown>; rows: PiiAccountingRow[]; reports: PiiPopulationReport[] };
  comparisons: unknown[]; identitySourceEvidence: Record<string, unknown>; status: 'complete' | 'incomplete'; artifactCommitment: string;
}

export function validatePiiArrivalQualificationReadiness(population: Pick<PiiPopulationArrivalBundle, 'status' | 'candidate'>,
  operational: { status?: unknown; sizes?: unknown }, productSourceCommit: string, actualComponents: Record<string, string>,
  actualPackedSizes: Record<string, number>, actualCandidateEvidenceSha256: string) {
  validatePiiArrivalCandidateBinding(population, operational, productSourceCommit, actualComponents, actualPackedSizes,
    actualCandidateEvidenceSha256);
  if (population.status !== 'complete' || operational.status !== 'complete')
    throw new Error('PII arrival evidence is incomplete or does not bind the exact candidate artifacts');
  return true;
}

export function validatePiiArrivalCandidateBinding(population: Pick<PiiPopulationArrivalBundle, 'status' | 'candidate'>,
  operational: { status?: unknown; sizes?: unknown }, productSourceCommit: string, actualComponents: Record<string, string>,
  actualPackedSizes: Record<string, number>, actualCandidateEvidenceSha256: string) {
  const candidateSizes = Array.isArray(operational.sizes) ? operational.sizes.find((row: any) => row.side === 'candidate') as any : null;
  if (!exact(actualComponents, ['core', 'node', 'wasm']) || Object.values(actualComponents).some(component => !digest(component)) ||
      !['complete', 'incomplete'].includes(population.status) || !['complete', 'regression'].includes(operational.status as string) ||
      population.candidate.sourceCommit !== productSourceCommit ||
      population.candidate.candidateEvidenceSha256 !== actualCandidateEvidenceSha256 ||
      JSON.stringify(population.candidate.components) !== JSON.stringify(actualComponents) ||
      population.candidate.artifactSetCommitment !== piiArrivalCommitment(actualComponents) ||
      !exact(actualPackedSizes, ['core', 'node', 'wasm']) || !candidateSizes ||
      JSON.stringify(candidateSizes.packed) !== JSON.stringify(actualPackedSizes))
    throw new Error('PII arrival evidence is incomplete or does not bind the exact candidate artifacts');
  return true;
}

export function piiArrivalGateStatuses(population: Pick<PiiPopulationArrivalBundle, 'status' | 'candidate'>,
  operational: { status?: unknown }, protectedState: 'completed' | 'unspent') {
  const populationMeasured = Array.isArray(population.candidate.reports) &&
    population.candidate.reports.every(report => report.status === 'measured');
  return {
    identity: populationMeasured ? 'met' as const : 'unresolved' as const,
    population: population.status === 'complete' ? 'met' as const : 'not-met' as const,
    protected: protectedState === 'completed' ? 'met' as const : 'unresolved' as const,
    operational: operational.status === 'complete' ? 'met' as const : 'not-met' as const,
  };
}

/**
 * Independent population gates (benchmarks #423). `piiArrivalGateStatuses` above is kept for the frozen
 * schemaVersion 1 qualification records, where identity-only, diagnostic and benign-heavy all read one
 * population-report state. Here each view gate reads its own candidate report and its own baseline comparison,
 * and identity-only is not derived from populations at all (it comes from the identity oracle).
 */
export function piiArrivalViewGateStatuses(population: Pick<PiiPopulationArrivalBundle, 'status' | 'candidate' | 'comparisons'>,
  operational: { status?: unknown }, protectedState: 'completed' | 'unspent') {
  const view = (id: 'diagnostic-balanced' | 'benign-heavy-stress') => {
    const reports = Array.isArray(population.candidate.reports) ? population.candidate.reports.filter(report => report.population === id) : [];
    const comparisons = Array.isArray(population.comparisons) ?
      population.comparisons.filter((row: any) => row?.population === id) as Array<{ verdict?: unknown }> : [];
    if (reports.length !== 1 || comparisons.length !== 1 || reports[0].status !== 'measured') return 'unresolved' as const;
    return comparisons[0].verdict === 'no-regression' ? 'met' as const :
      comparisons[0].verdict === 'regression' ? 'not-met' as const : 'unresolved' as const;
  };
  return {
    diagnostic: view('diagnostic-balanced'),
    benignHeavy: view('benign-heavy-stress'),
    population: population.status === 'complete' ? 'met' as const : 'not-met' as const,
    protected: protectedState === 'completed' ? 'met' as const : 'unresolved' as const,
    operational: operational.status === 'complete' ? 'met' as const : 'not-met' as const,
  };
}

export function validatePiiArrivalPopulationRoster(baselineReports: Array<{ population?: unknown }>,
  candidateReports: Array<{ population?: unknown }>, comparisons: Array<{ population?: unknown }>) {
  const required = JSON.stringify([...piiArrivalContract.population.requiredViews].sort());
  if ([baselineReports, candidateReports, comparisons].some(rows =>
    JSON.stringify(rows.map(row => row.population).sort()) !== required)) throw new Error('PII population arrival roster mismatch');
  return true;
}

export function validatePiiPopulationArrivalBundle(value: unknown): PiiPopulationArrivalBundle {
  const bundle = structuredClone(value) as PiiPopulationArrivalBundle;
  if (!exact(bundle, ['schemaVersion', 'reportType', 'supportClaims', 'family', 'contractCommitment', 'corpusCommitment', 'baseline', 'candidate',
      'comparisons', 'identitySourceEvidence', 'status', 'artifactCommitment']) || bundle.schemaVersion !== 1 ||
      bundle.reportType !== 'pii-population-arrival-bundle' || bundle.supportClaims !== false || bundle.family !== 'pii:us:ssn' ||
      bundle.contractCommitment !== piiPopulationContract.contentCommitment || bundle.corpusCommitment !== piiBenignCollisionEvidence.contentCommitment ||
      bundle.artifactCommitment !== piiArrivalCommitment(projection(bundle as unknown as Record<string, unknown>)))
    throw new Error('Invalid PII population arrival bundle identity');
  for (const [sideId, side] of [['baseline', bundle.baseline], ['candidate', bundle.candidate]] as const) {
    const expectedSelectionEvidence = piiArrivalSelectionEvidence(sideId, (side.selection as any)?.activationIdentity,
      (side.selection as any)?.familyAvailability);
    if (!exact(side, ['sourceCommit', 'candidateEvidenceSha256', 'artifactSetCommitment', 'components', 'selection', 'rows', 'reports']) || !digest(side.sourceCommit, 40) ||
        !digest(side.candidateEvidenceSha256) || !digest(side.artifactSetCommitment) || !exact(side.components, ['core', 'node', 'wasm']) ||
        Object.values(side.components).some(component => !digest(component)) ||
        side.artifactSetCommitment !== piiArrivalCommitment(side.components) || !Array.isArray(side.rows) ||
        !Array.isArray(side.reports) ||
        !exact(side.selection, ['logicalRequestedAddition', 'effectiveSelectors', 'selectionState', 'familyAvailability', 'availableFamilies', 'activationIdentity']) ||
        JSON.stringify(side.selection) !== JSON.stringify(expectedSelectionEvidence))
      throw new Error('Invalid PII population arrival source');
    side.reports.forEach(report => validatePiiPopulationReport(report, piiPopulationContract, piiBenignCollisionEvidence, {}, side.rows));
    if (side.reports.some(report => report.observation.scanner?.configurationHash !== hash(piiArrivalPopulationScannerConfiguration)))
      throw new Error('Invalid PII population arrival scanner comparison policy');
  }
  if (bundle.baseline.sourceCommit !== '63a834e0a2b44c11f307ece8c539b933dabb68f1' ||
      bundle.candidate.sourceCommit !== 'a0709d2a41b70217874da9afeffb40fb2a1a2596' ||
      bundle.baseline.candidateEvidenceSha256 !== piiArrivalContract.baselineEvidence.candidateEvidenceSha256 ||
      JSON.stringify(bundle.baseline.components) !== JSON.stringify(piiArrivalContract.baselineEvidence.components) ||
      bundle.baseline.artifactSetCommitment !== piiArrivalContract.baselineEvidence.artifactSetCommitment ||
      bundle.baseline.artifactSetCommitment === bundle.candidate.artifactSetCommitment)
    throw new Error('PII population arrival baseline/candidate identity mismatch');
  const expectedComparisons = bundle.candidate.reports.map(candidate => {
    const baseline = bundle.baseline.reports.find(report => report.population === candidate.population);
    if (!baseline) throw new Error('Missing PII baseline population');
    return comparePiiPopulationReports(baseline, candidate, { contract: piiPopulationContract, evidence: piiBenignCollisionEvidence,
      baselineRows: bundle.baseline.rows, candidateRows: bundle.candidate.rows });
  });
  validatePiiArrivalPopulationRoster(bundle.baseline.reports, bundle.candidate.reports, bundle.comparisons as any[]);
  if (JSON.stringify(bundle.comparisons) !== JSON.stringify(expectedComparisons)) throw new Error('PII population comparisons are not derived');
  const identity = bundle.identitySourceEvidence as any;
  const requiredLanes = [...piiArrivalContract.identity.requiredLanes].sort();
  if (!identity || identity.reportType !== 'pii-identity-source' || identity.family !== bundle.family || identity.status !== 'complete' ||
      identity.productSourceCommit !== bundle.candidate.sourceCommit || identity.artifactSetCommitment !== bundle.candidate.artifactSetCommitment ||
      identity.validator?.id !== 'us-ssn-allocation' || identity.validator.version !== 1 || !digest(identity.fixtureCommitment) ||
      !digest(identity.commandDefinitionCommitment) || !Array.isArray(identity.checks) ||
      JSON.stringify(identity.checks.map((check: any) => check.id).sort()) !== JSON.stringify(requiredLanes) ||
      identity.checks.some((check: any) => check.status !== 'pass') || identity.artifactCommitment !== piiArrivalCommitment(projection(identity)))
    throw new Error('Invalid PII identity source evidence');
  const complete = bundle.candidate.reports.every(report => report.status === 'measured') &&
    expectedComparisons.every(comparison => comparison.verdict === 'no-regression');
  if (bundle.status !== (complete ? 'complete' : 'incomplete')) throw new Error('Invalid PII population arrival status');
  return bundle;
}

export function validatePiiArrivalOperational(value: unknown, expected: Pick<PiiPopulationArrivalBundle, 'baseline' | 'candidate'>) {
  const report = structuredClone(value) as any;
  const sides = ['baseline', 'candidate'], surfaces = piiArrivalContract.operational.surfaces,
    profiles = piiArrivalContract.operational.profiles, metricNames = ['incrementalLineCalls', 'initialize', 'wholeInput'];
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
  const expectedObservationKeys = sides.flatMap(side => surfaces.flatMap(surface => profiles.map(profile => `${side}/${surface}/${profile}`))).sort();
  const observationKeys = Array.isArray(report?.observations) ? report.observations.map((row: any) => `${row.side}/${row.surface}/${row.profile}`).sort() : [];
  const comparisonKeys = Array.isArray(report?.runtimeComparisons) ? report.runtimeComparisons.map((row: any) => `${row.surface}/${row.profile}`).sort() : [];
  const expectedComparisonKeys = surfaces.flatMap(surface => profiles.map(profile => `${surface}/${profile}`)).sort();
  if (!report || !exact(report, ['schemaVersion', 'reportType', 'supportClaims', 'contractCommitment', 'runtime', 'workloadCommitment',
      'sampleProtocol', 'baseline', 'candidate', 'observations', 'sizes', 'runtimeComparisons', 'byteComparisons', 'status', 'artifactCommitment']) ||
      report.schemaVersion !== 1 || report.reportType !== 'pii-arrival-operational' || report.supportClaims !== false ||
      !digest(report.workloadCommitment) || !exact(report.runtime, ['node', 'platform', 'arch']) ||
      Object.values(report.runtime).some(value => typeof value !== 'string' || !value) ||
      !exact(report.baseline, ['sourceCommit', 'artifactSetCommitment', 'components']) ||
      !exact(report.candidate, ['sourceCommit', 'artifactSetCommitment', 'components']) ||
      !exact(report.baseline?.components, ['core', 'node', 'wasm']) || !exact(report.candidate?.components, ['core', 'node', 'wasm']) ||
      [...Object.values(report.baseline?.components ?? {}), ...Object.values(report.candidate?.components ?? {})].some(component => !digest(component)) ||
      report.contractCommitment !== piiArrivalContractCommitment ||
      JSON.stringify(report.sampleProtocol) !== JSON.stringify(piiArrivalOperationalSampleProtocol(report.workloadCommitment)) ||
      report.candidate?.artifactSetCommitment !== expected.candidate.artifactSetCommitment ||
      report.baseline?.artifactSetCommitment !== expected.baseline.artifactSetCommitment ||
      JSON.stringify(report.candidate?.components) !== JSON.stringify(expected.candidate.components) ||
      JSON.stringify(report.baseline?.components) !== JSON.stringify(expected.baseline.components) ||
      report.baseline?.sourceCommit !== '63a834e0a2b44c11f307ece8c539b933dabb68f1' ||
      report.candidate?.sourceCommit !== 'a0709d2a41b70217874da9afeffb40fb2a1a2596' ||
      report.baseline?.artifactSetCommitment !== piiArrivalCommitment(report.baseline?.components) ||
      report.candidate?.artifactSetCommitment !== piiArrivalCommitment(report.candidate?.components) ||
      report.artifactCommitment !== piiArrivalCommitment(projection(report)) ||
      JSON.stringify(observationKeys) !== JSON.stringify(expectedObservationKeys) ||
      report.observations.some((row: any) => {
        const expectedSelection = piiArrivalContract.operational.profileSelections[row.profile as keyof typeof piiArrivalContract.operational.profileSelections]?.[
          row.side as 'baseline' | 'candidate'];
        return !exact(row, ['side', 'surface', 'profile', 'effectiveSelectors', 'selectionState', 'samples', 'workloadCommitment', 'milliseconds']) ||
        !expectedSelection || JSON.stringify(row.effectiveSelectors) !== JSON.stringify(expectedSelection.effectiveSelectors) ||
        row.selectionState !== expectedSelection.selectionState || row.workloadCommitment !== report.workloadCommitment || !exact(row.milliseconds, metricNames) ||
        row.samples !== piiArrivalContract.operational.minimumPairedSamples || Object.values(row.milliseconds ?? {}).some((samples: any) =>
        !Array.isArray(samples) || samples.length !== row.samples || samples.some(sample => !Number.isFinite(sample) || sample < 0));
      }) ||
      JSON.stringify(comparisonKeys) !== JSON.stringify(expectedComparisonKeys) || report.runtimeComparisons.some((row: any) => {
        if (!exact(row, ['surface', 'profile', 'metrics']) || !exact(row.metrics, metricNames)) return true;
        const before = report.observations.find((candidate: any) => candidate.side === 'baseline' && candidate.surface === row.surface && candidate.profile === row.profile);
        const after = report.observations.find((candidate: any) => candidate.side === 'candidate' && candidate.surface === row.surface && candidate.profile === row.profile);
        return !before || !after || metricNames.some(metricName => {
          const baselineMedian = median(before.milliseconds[metricName]), candidateMedian = median(after.milliseconds[metricName]);
          const delta = candidateMedian - baselineMedian, relative = baselineMedian === 0 ? null : delta / baselineMedian;
          const pass = delta <= piiArrivalContract.operational.runtime.maximumAbsoluteIncreaseMilliseconds ||
            (relative !== null && relative <= piiArrivalContract.operational.runtime.maximumRelativeIncrease);
          return JSON.stringify(row.metrics[metricName]) !== JSON.stringify({ baselineMedian, candidateMedian, delta, relative, pass });
        });
      }) ||
      !Array.isArray(report.sizes) || JSON.stringify(report.sizes.map((row: any) => row.side).sort()) !== JSON.stringify(sides) ||
      report.sizes.some((row: any) => !exact(row, ['side', 'packed', 'unpacked', 'wasmPayloads', 'wasmPayloadTotals']) ||
        !exact(row.packed, ['core', 'node', 'wasm']) || !exact(row.unpacked, ['core', 'node', 'wasm']) ||
        !exact(row.wasmPayloads, ['full', 'common']) || !exact(row.wasmPayloadTotals, ['raw', 'gzip', 'brotli']) ||
        (() => {
          const members = validatePiiArrivalWasmPayloadRoster(Object.values(row.wasmPayloads ?? {}).map((payload: any) => payload?.fileName));
          const payloads = Object.keys(members).map(role => row.wasmPayloads?.[role]).filter(Boolean);
          return payloads.length !== 2 || new Set(payloads.map((payload: any) => payload.sha256)).size !== payloads.length ||
            Object.entries(members).some(([role, member]) => {
            const payload = row.wasmPayloads?.[role];
            return !exact(payload, ['fileName', 'raw', 'gzip', 'brotli', 'sha256']) || payload.fileName !== member.fileName || !digest(payload.sha256) ||
              [payload.raw, payload.gzip, payload.brotli].some(value => !Number.isInteger(value) || value < 0);
          }) || ['raw', 'gzip', 'brotli'].some(metric => row.wasmPayloadTotals[metric] !==
            payloads.reduce((sum: number, payload: any) => sum + payload[metric], 0));
        })() || [...Object.values(row.packed), ...Object.values(row.unpacked)].some(value => !Number.isInteger(value as number) || (value as number) < 0)) ||
      (() => {
        const baseline = report.sizes?.find((row: any) => row.side === 'baseline'), candidate = report.sizes?.find((row: any) => row.side === 'candidate');
        if (!baseline || !candidate) return true;
        const limits = piiArrivalContract.operational.packageBytes, payloadPolicy = piiArrivalContract.operational.wasmPayloadPolicy;
        const expected: Record<string, [number, number, number]> = {
          corePacked: [baseline.packed.core, candidate.packed.core, limits.corePackedMaximumIncrease],
          nodePacked: [baseline.packed.node, candidate.packed.node, limits.nodePackedMaximumIncrease],
          wasmPacked: [baseline.packed.wasm, candidate.packed.wasm, limits.wasmPackedMaximumIncrease],
        };
        for (const [role, member] of Object.entries(payloadPolicy.members)) for (const metric of ['raw', 'gzip', 'brotli'] as const)
          expected[`wasm${role[0].toUpperCase()}${role.slice(1)}${metric[0].toUpperCase()}${metric.slice(1)}`] =
            [baseline.wasmPayloads[role][metric], candidate.wasmPayloads[role][metric], member.maximumIncrease[metric]];
        for (const metric of ['raw', 'gzip', 'brotli'] as const)
          expected[`wasmAggregate${metric[0].toUpperCase()}${metric.slice(1)}`] =
            [baseline.wasmPayloadTotals[metric], candidate.wasmPayloadTotals[metric], payloadPolicy.aggregateMaximumIncrease[metric]];
        if (JSON.stringify(Object.keys(report.byteComparisons ?? {}).sort()) !== JSON.stringify(Object.keys(expected).sort())) return true;
        return Object.entries(expected).some(([key, [before, after, maximumIncrease]]) => {
          const delta = after - before, pass = delta <= maximumIncrease;
          return JSON.stringify(report.byteComparisons[key]) !== JSON.stringify({ baseline: before, candidate: after, delta, maximumIncrease, pass });
        });
      })())
    throw new Error('Invalid PII arrival operational evidence');
  const complete = report.runtimeComparisons.every((row: any) => Object.values(row.metrics).every((metric: any) => metric.pass)) &&
    Object.values(report.byteComparisons).every((row: any) => (row as any).pass);
  if (report.status !== (complete ? 'complete' : 'regression')) throw new Error('Invalid PII arrival operational status');
  return report;
}

export function validatePiiArrivalHoldout(reportValue: unknown, trustValue: unknown, candidateArtifactSetCommitment: string,
  identitySourceCommitment: string) {
  const report = validatePiiHoldoutReport(structuredClone(reportValue) as PiiHoldoutReport), trust = structuredClone(trustValue) as any;
  const reportCommitment = piiArrivalCommitment(report);
  if (report.status !== 'complete' || report.corpus.purpose !== 'protected' || report.independence !== 'custodian-declared' ||
      report.candidate.candidateArtifactHash !== candidateArtifactSetCommitment ||
      report.scanners.length !== 1 || report.scanners[0].id !== 'redact-secret-pii-arrival' ||
      JSON.stringify(report.scanners[0].configuration) !== JSON.stringify({ adapter: 'candidate-v2', selectors: ['pii:us'],
        artifactSetCommitment: candidateArtifactSetCommitment, identitySourceCommitment }) ||
      report.scanners.some(scanner => scanner.status !== 'complete' || Object.values(scanner.axes).some(axis =>
        axis.fail || axis['review-required'] || axis['not-measured'])) ||
      !trust || trust.schemaVersion !== 1 || trust.reportType !== 'pii-holdout-trust-resolution' || trust.family !== 'pii:us:ssn' ||
      trust.holdoutReportCommitment !== reportCommitment || trust.decision !== 'accepted' || trust.attempts !== 1 ||
      typeof trust.custodian !== 'string' || !trust.custodian || typeof trust.reviewer !== 'string' || !trust.reviewer ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(trust.reviewedAt) ||
      trust.artifactCommitment !== piiArrivalCommitment(projection(trust)))
    throw new Error('Invalid or unresolved PII protected holdout evidence');
  return { report, trust, reportCommitment };
}

export interface PiiArrivalProtectedEvidenceExpected {
  familyContractCommitment: string; productSourceCommit: string; candidateEvidenceCommitment: string;
  candidateArtifactSetCommitment: string; identitySourceCommitment: string; populationBundleCommitment: string;
  operationalCommitment: string; populationStatus: 'complete' | 'incomplete'; operationalStatus: 'complete' | 'regression';
}

export type PiiArrivalProtectedEvidence =
  { state: 'completed'; report: unknown; trust: unknown } |
  { schemaVersion: 1; reportType: 'pii-protected-unspent-attestation'; state: 'unspent'; supportClaims: false;
    family: 'pii:us:ssn'; familyContractCommitment: string; arrivalContractCommitment: string; productSourceCommit: string;
    candidateEvidenceCommitment: string; candidateArtifactSetCommitment: string; identitySourceCommitment: string;
    populationBundleCommitment: string; operationalCommitment: string; epochCommitment: string; manifestCommitment: string;
    sealed: true; maxRuns: 1; runs: 0; decision: 'not-run'; reason: 'public-gates-failed'; implementationAuthor: string;
    custodian: string; reviewer: string; reviewedAt: string; artifactCommitment: string };

export function validatePiiArrivalProtectedEvidence(value: unknown, expected: PiiArrivalProtectedEvidenceExpected) {
  const evidence = structuredClone(value) as any;
  if (evidence?.state === 'completed') {
    if (!exact(evidence, ['state', 'report', 'trust'])) throw new Error('Invalid PII completed protected evidence');
    const completed = validatePiiArrivalHoldout(evidence.report, evidence.trust, expected.candidateArtifactSetCommitment,
      expected.identitySourceCommitment);
    return { state: 'completed' as const, report: completed.report, trust: completed.trust,
      reportCommitment: completed.reportCommitment, artifactCommitment: piiArrivalCommitment({ state: 'completed',
        holdoutCommitment: completed.reportCommitment, trustCommitment: completed.trust.artifactCommitment }) };
  }
  const keys = ['schemaVersion', 'reportType', 'state', 'supportClaims', 'family', 'familyContractCommitment',
    'arrivalContractCommitment', 'productSourceCommit', 'candidateEvidenceCommitment', 'candidateArtifactSetCommitment',
    'identitySourceCommitment', 'populationBundleCommitment', 'operationalCommitment', 'epochCommitment', 'manifestCommitment',
    'sealed', 'maxRuns', 'runs', 'decision', 'reason', 'implementationAuthor', 'custodian', 'reviewer', 'reviewedAt', 'artifactCommitment'];
  if (!exact(evidence, keys) || evidence.schemaVersion !== 1 || evidence.reportType !== 'pii-protected-unspent-attestation' ||
      evidence.state !== 'unspent' || evidence.supportClaims !== false || evidence.family !== 'pii:us:ssn' ||
      evidence.familyContractCommitment !== expected.familyContractCommitment ||
      expected.familyContractCommitment !== piiArrivalFamilyContractCommitment ||
      evidence.arrivalContractCommitment !== piiArrivalContractCommitment || evidence.productSourceCommit !== expected.productSourceCommit ||
      evidence.candidateEvidenceCommitment !== expected.candidateEvidenceCommitment ||
      evidence.candidateArtifactSetCommitment !== expected.candidateArtifactSetCommitment ||
      evidence.identitySourceCommitment !== expected.identitySourceCommitment ||
      evidence.populationBundleCommitment !== expected.populationBundleCommitment || evidence.operationalCommitment !== expected.operationalCommitment ||
      !digest(evidence.epochCommitment) || !digest(evidence.manifestCommitment) || evidence.sealed !== true || evidence.maxRuns !== 1 ||
      evidence.runs !== 0 || evidence.decision !== 'not-run' || evidence.reason !== 'public-gates-failed' ||
      typeof evidence.implementationAuthor !== 'string' || !evidence.implementationAuthor || typeof evidence.custodian !== 'string' ||
      !evidence.custodian || evidence.custodian === evidence.implementationAuthor || typeof evidence.reviewer !== 'string' || !evidence.reviewer ||
      typeof evidence.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(evidence.reviewedAt) ||
      !Number.isFinite(Date.parse(evidence.reviewedAt)) ||
      (expected.populationStatus === 'complete' && expected.operationalStatus === 'complete') ||
      evidence.artifactCommitment !== piiArrivalCommitment(projection(evidence)))
    throw new Error('Invalid PII unspent protected evidence');
  return evidence as Extract<PiiArrivalProtectedEvidence, { state: 'unspent' }>;
}
