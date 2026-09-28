/**
 * Beta.11 PII E (benchmarks #428): gate recomputation and the six-row `pii-v1` disposition, derived only from the
 * committed freeze, observation, operational evidence and (when present) the #427 parity report for the same core
 * commit. Deterministic: the committed inputs re-score to the committed report and disposition byte for byte.
 *
 * A family is `provisional` only when every applicable gate is `met`, including the protected partition. This run
 * never reads the protected partition, so every family stays `pending`; protected eligibility is computed from the
 * public gates and reported, and an ineligible family's epoch is recorded `not-run` / unspent with its fixed reason.
 * Credential findings are counted apart and never enter a PII numerator or denominator.
 */
import { B11_FAMILIES, B11_POPULATION_OWNER, B11_POPULATION_PLAN_FILES, B11_SELECTIONS, activationProblem, b11CaseTables, b11Commitment,
  b11IdentityOnly, b11ScoreTable, b11ViewGate, b11Revisions, type B11Family, type B11Lane } from './beta11-qualification.ts';
import { C1_POPULATION_PLANS } from './email-network-population.ts';
import { PII_ORACLE_PLANS } from './identity-oracle.ts';
import regressionBudgets from '../../../regression-budgets.json';
import operational879 from '../../../../evidence/879/pii-operational-evidence-v1.json';
import arrivalContract from '../../../../qualification/pii-national-id-arrival-v1.json';

export const B11_BASELINE_879 = Object.freeze({ sourceCommit: '63a834e0a2b44c11f307ece8c539b933dabb68f1' });
export const B11_FREEZE_FILES = Object.freeze({
  productContracts: ['docs/contracts/pii/email-v1.md', 'docs/contracts/pii/iban-v1.md', 'docs/contracts/pii/payment-card-v1.md',
    'docs/contracts/pii/phone-v1.md', 'docs/contracts/pii/us-ssn-v1.md', 'docs/contracts/pii/pii-context-v1.json',
    'docs/contracts/pii/pii-context-v2.json', 'docs/audits/evidence/875/README.md', 'docs/specs/detector-families.md',
    'docs/specs/contextual-detection.md', 'docs/decisions/2026-09-28-version-the-pii-context-vocabulary-as-v2.md',
    'crates/secret-scan-core/examples/pii_identity_evaluation.rs'],
  benchmarkInputs: [
    ...['network-address', 'email', 'payment-card', 'iban', 'us-ssn', 'phone'].map(name => `benchmarks/evaluation/domains/pii/${name}-qualification-v1.json`),
    'benchmarks/evaluation/domains/pii/identity-oracle-v1.json', ...Object.values(B11_POPULATION_PLAN_FILES),
    'benchmarks/evaluation/domains/pii/pii-context-v2-expectation-revisions-v1.json', 'evidence/901/426/pii-c3-reviewed-corrections-v1.json',
    'qualification/pii-v1.json', 'qualification/pii-national-id-arrival-v1.json', 'benchmarks/regression-budgets.json',
    'benchmarks/regression-baselines/0.1.0-beta.8.json', 'evidence/901/pii-gap-ledger-v1.json', 'evidence/879/pii-operational-evidence-v1.json',
    'scripts/measure-pii-arrival-runtime-sample.mjs', 'benchmarks/evaluation/domains/pii/mixed-parity/mixed-parity-v2.json'],
  evaluationSchema: ['benchmarks/evaluation/domains/pii/beta11-qualification.ts', 'benchmarks/evaluation/domains/pii/beta11-disposition.ts',
    'scripts/pii-beta11.mjs', 'benchmarks/evaluation/domains/pii/identity-oracle.ts', 'benchmarks/evaluation/domains/pii/email-network-population.ts',
    'benchmarks/evaluation/domains/pii/card-iban-stress/stress.ts', 'benchmarks/evaluation/domains/pii/ssn-phone-stress.ts', 'scanners/candidate.mjs'],
});

/** Wasm payload roles. A payload that is neither default artifact and names PII is the split-out PII artifact (#937). */
export function b11WasmRole(file: string) {
  if (file === 'redact_secret_wasm_bg.wasm') return 'default-full';
  if (file === 'redact_secret_wasm_common_bg.wasm') return 'default-common';
  return /pii/i.test(file) ? 'pii' : 'other';
}

const SSN_PRIOR_EPOCH = Object.freeze({ record: 'evidence/879/pii-protected-unspent-attestation-v1.json',
  productSourceCommit: 'a0709d2a41b70217874da9afeffb40fb2a1a2596',
  epochCommitment: 'fad54ed105ece78452a402239b35c51dee4d5a670ca04125b4dfa8b3d7395d55', runs: 0, maxRuns: 1 });
/** Protected-epoch commitments for this candidate, frozen before any observation. One run per epoch; a new candidate is a new epoch. */
export function b11ProtectedEpochs(freeze: any) {
  return B11_FAMILIES.map(family => {
    const epoch = { family, sourceCommit: freeze.candidate.sourceCommit, artifacts: freeze.candidate.artifacts, contracts: freeze.contracts,
      frozenInputs: freeze.frozenInputs, maxRuns: 1 };
    return { family, epochCommitment: b11Commitment(epoch), maxRuns: 1, runs: 0, state: 'committed-unspent',
      protectedCorpus: family === 'pii:us:ssn' ?
        { status: 'no-custodian-manifest-for-this-candidate', priorEpoch: SSN_PRIOR_EPOCH,
          note: 'The sealed US SSN epoch of evidence/879 binds candidate a0709d2a and is not transferable; this candidate needs a new custodian-held epoch.' } :
        { status: 'none-registered', note: 'No custodian-held protected corpus is registered for this family.' } };
  });
}

type SizeRow = { id: string; source: string; baselineValue: number | null; candidateValue: number; allowedIncrease: number | null; delta: number | null;
  status: 'within' | 'regression' | 'no-frozen-budget' };
/** #143 size budget rows (regression-budgets-v1, beta.8 baseline) for the artifacts this host can attribute. */
export function b11SizeBudgetRows(freeze: any): SizeRow[] {
  const trigger = (id: string) => (regressionBudgets as any).triggers.find((row: any) => row.id === id);
  const ci = freeze.ciQualification?.status === 'available' ? freeze.ciQualification.wasm as any[] : null;
  const payload = (role: string) => {
    const fromCi = ci?.find(row => row.role === role);
    return fromCi ? { value: fromCi.gzip, source: `ci-qualification run ${freeze.ciQualification.runId} ${fromCi.artifact}/${fromCi.file} gzip-9` } :
      { value: freeze.candidate.wasmPayloads.find((row: any) => row.role === role)?.gzip, source: 'local build gzip-9' };
  };
  const rows: Array<[string, number | undefined, string]> = [
    ['size/wasm/full/gzip', payload('default-full').value, payload('default-full').source],
    ['size/wasm/common/gzip', payload('default-common').value, payload('default-common').source],
    ['size/npm/core/packed', freeze.candidate.artifacts.core.bytes, 'local npm pack'],
    ['size/npm/wasm/packed', freeze.candidate.artifacts.wasm.bytes, 'local npm pack'],
    [`size/npm/node-${freeze.candidate.platform}/packed`, freeze.candidate.artifacts.node.bytes, 'local npm pack'],
  ];
  const budgeted = rows.filter(([, value]) => typeof value === 'number').map(([id, value, source]): SizeRow => {
    const row = trigger(id);
    if (!row) return { id, source, baselineValue: null, candidateValue: value!, allowedIncrease: null, delta: null, status: 'no-frozen-budget' };
    const allowed = Math.max(row.threshold.relative * row.baselineValue, row.threshold.absoluteFloor), delta = value! - row.baselineValue;
    return { id, source, baselineValue: row.baselineValue, candidateValue: value!, allowedIncrease: Math.round(allowed), delta,
      status: delta > allowed ? 'regression' : 'within' };
  });
  const pii = (ci ?? freeze.candidate.wasmPayloads).filter((row: any) => row.role === 'pii').map((row: any): SizeRow => ({
    id: `size/wasm/pii/${row.file}/gzip`, source: ci ? `ci-qualification ${row.artifact}` : 'local build gzip-9', baselineValue: null,
    candidateValue: row.gzip, allowedIncrease: null, delta: null, status: 'no-frozen-budget' }));
  return [...budgeted, ...pii];
}

/** evidence/879 arrival-contract byte budgets: paired local baseline build vs candidate build, plus the frozen 879 baseline. */
function byteBudgets(operational: any) {
  const policy = (arrivalContract as any).operational, limits = policy.packageBytes, members = policy.wasmPayloadPolicy.members;
  const base = operational.sizes.baseline, cand = operational.sizes.candidate;
  const payload = (set: any[], role: string) => set.find(row => row.role === role);
  const rows: any[] = [];
  const compare = (id: string, before: number, after: number, maximumIncrease: number) =>
    rows.push({ id, baseline: before, candidate: after, delta: after - before, maximumIncrease, pass: after - before <= maximumIncrease });
  compare('corePacked', base.packed.core, cand.packed.core, limits.corePackedMaximumIncrease);
  compare('nodePacked', base.packed.node, cand.packed.node, limits.nodePackedMaximumIncrease);
  compare('wasmPacked', base.packed.wasm, cand.packed.wasm, limits.wasmPackedMaximumIncrease);
  for (const [member, role] of [['full', 'default-full'], ['common', 'default-common']] as const) for (const metric of ['raw', 'gzip', 'brotli'] as const)
    compare(`wasm${member[0].toUpperCase()}${member.slice(1)}${metric[0].toUpperCase()}${metric.slice(1)}`, payload(base.wasmPayloads, role)[metric],
      payload(cand.wasmPayloads, role)[metric], members[member].maximumIncrease[metric]);
  for (const metric of ['raw', 'gzip', 'brotli'] as const) {
    const sum = (set: any[]) => set.filter(row => row.role.startsWith('default-')).reduce((total, row) => total + row[metric], 0);
    compare(`wasmAggregate${metric[0].toUpperCase()}${metric.slice(1)}`, sum(base.wasmPayloads), sum(cand.wasmPayloads), policy.wasmPayloadPolicy.aggregateMaximumIncrease[metric]);
  }
  const frozen879 = ['Raw', 'Gzip', 'Brotli'].map(metric => {
    const row = (operational879 as any).byteComparisons[`wasmCommon${metric}`], value = payload(cand.wasmPayloads, 'default-common')[metric.toLowerCase()];
    return { id: `wasmCommon${metric}`, frozenBaseline: row.baseline, candidate: value, delta: value - row.baseline, maximumIncrease: row.maximumIncrease,
      pass: value - row.baseline <= row.maximumIncrease };
  });
  const piiPayloads = cand.wasmPayloads.filter((row: any) => row.role === 'pii').map(({ file, raw, gzip, brotli }: any) => ({ file, raw, gzip, brotli, budget: 'none-frozen' }));
  return { pairedLocalBuild: rows, frozen879CommonBaseline: frozen879, piiPayloads };
}

const gate = (id: string, status: 'met' | 'not-met' | 'unresolved' | 'not-run', reason: string, evidence?: unknown) => ({ id, status, reason, ...(evidence ? { evidence } : {}) });
export const B11_COST_GATES = ['runtime-and-package-cost', 'size-regression-budget', 'profile-cost'] as const;

export function buildB11Report(input: { freeze: any; observation: any; operational: any; parity: { file: string; report: any } | null }) {
  const { freeze, observation, operational, parity } = input;
  if (observation.freeze.freezeCommitment !== freeze.freezeCommitment || operational.freezeCommitment !== freeze.freezeCommitment)
    throw new Error('observation and operational evidence are not bound to this freeze');
  const bytes = byteBudgets(operational);
  const runtimePass = operational.runtimeComparisons.every((row: any) => Object.values(row.metrics).every((metric: any) => metric.pass));
  const bytesPass = bytes.pairedLocalBuild.every(row => row.pass) && bytes.frozen879CommonBaseline.every(row => row.pass);
  const sizeRows = operational.sizeBudgetRows as SizeRow[];
  const costGates = [
    gate('runtime-and-package-cost', runtimePass && bytesPass ? 'met' : 'not-met',
      [runtimePass ? null : 'runtime: a paired median exceeds both +50% and +5 ms',
        ...bytes.pairedLocalBuild.filter(row => !row.pass).map(row => `${row.id} +${row.delta} B over a maximum increase of ${row.maximumIncrease} B (paired local build)`),
        ...bytes.frozen879CommonBaseline.filter(row => !row.pass).map(row => `${row.id} +${row.delta} B over the frozen evidence/879 zero-growth baseline`)]
        .filter(Boolean).join('; ') || 'every evidence/879 runtime and byte budget passes'),
    gate('size-regression-budget', sizeRows.some(row => row.status === 'regression') ? 'not-met' : 'met',
      sizeRows.filter(row => row.status === 'regression').map(row => `${row.id} ${row.candidateValue} B vs beta.8 ${row.baselineValue} B (+${row.delta}, allowed +${row.allowedIncrease})`).join('; ') ||
      'every #143 size row within budget'),
    gate('profile-cost', 'unresolved', 'The #286 profile-cost protocol runs only as the official Linux GitHub Actions workflow (A/A, threshold freeze, candidate, size) on a reviewed plan for this candidate; qualification/pii-profile-cost-v2.json re-freezes it for pii-context/v2 and a split PII Wasm artifact, and it has not been dispatched for this candidate.'),
  ];
  const parityGate = (() => {
    if (!parity) return gate('cross-surface-output', 'unresolved', `No #427 mixed-parity report for core ${freeze.candidate.sourceCommit.slice(0, 12)}; rerun npm run pii:parity:measure -- --target=core-commit for this commit.`);
    const report = parity.report, acceptance = report.acceptance ?? {};
    if (report.target?.sourceCommit !== freeze.candidate.sourceCommit)
      return gate('cross-surface-output', 'unresolved', `${parity.file} does not bind this source commit`, { file: parity.file });
    const passed = acceptance.declaredSurfacesAgree === true && acceptance.surfacesMeetExpectation === true &&
      acceptance.credentialOnlyUnchangedWhenPiiOff === true && Array.isArray(report.expectationFailures) && report.expectationFailures.length === 0 &&
      report.parity?.casesWithDisagreement === 0;
    const sameBuild = ['core', 'node', 'wasm'].filter(role => report.target.components?.[role] === (observation.candidate.components as any)[role]);
    return gate('cross-surface-output', passed ? 'met' : 'not-met', passed ?
      `${parity.file}: every surface agrees and meets every plan-v2 expectation in both selections on this source commit (re-scored by tests/pii-mixed-parity.test.mjs); byte-identical to this run's build: ${sameBuild.join(', ') || 'none'}` :
      `${parity.file}: surfaces disagree or miss an expectation`, { file: parity.file, sameBuildComponents: sameBuild });
  })();
  const families = B11_FAMILIES.map(family => {
    const { frozen, reviewed } = b11CaseTables(family);
    const lanes: B11Lane[] = observation.candidate.families.find((row: any) => row.family === family).lanes;
    const lane = (surface: string, selection: string) => lanes.find(row => row.lane === surface && row.selection === selection)!;
    const foreign = family === 'pii:us:ssn' ? lane('node-addon', 'foreign') : null;
    const primary = lane('node-addon', 'union');
    const frozenScore = b11ScoreTable(family, frozen, primary, foreign), reviewedScore = b11ScoreTable(family, reviewed, primary, foreign);
    const exactScore = b11ScoreTable(family, reviewed, lane('node-addon', 'exact'), foreign);
    const baselineLane = observation.baseline.families.find((row: any) => row.family === family).lanes.find((row: any) => row.lane === 'node-addon' && row.selection === 'union');
    const baselineScore = b11ScoreTable(family, reviewed, baselineLane, null);
    const ok = (outcome: string) => ['detected', 'absent', 'unscored'].includes(outcome);
    const regressions = reviewed.filter((row, index) => row.source === 'population-plan' && ok(baselineScore.outcomes[index]) && !ok(reviewedScore.outcomes[index])).map(row => row.id);
    const signature = (row: any) => JSON.stringify(row.family);
    const surfaceDisagreements = Object.fromEntries(B11_SELECTIONS(family).map(selection => [selection,
      lane('node-addon', selection).cases.filter((row: any, index: number) => signature(row) !== signature(lane('node-wasm', selection).cases[index])).length]));
    const selectionDependent = reviewed.filter((row, index) => row.source === 'population-plan' && reviewedScore.outcomes[index] !== exactScore.outcomes[index]).map(row => row.id);
    const activation = Object.fromEntries(B11_SELECTIONS(family).map(selection => [selection, {
      identity: lane('node-addon', selection).activationIdentity, agreesAcrossSurfaces: lane('node-addon', selection).activationIdentity === lane('node-wasm', selection).activationIdentity,
      problem: activationProblem(family, selection, lane('node-addon', selection).activationIdentity) }]));
    const offFindings = ['node-addon', 'node-wasm'].reduce((sum, surface) => sum + lane(surface, 'off').cases.filter((row: any) => row.family.length || row.otherPii.length).length, 0);
    const seamEvidence = observation.identitySeam.evidence.find((row: any) => row.family === family);
    const identity = b11IdentityOnly(family, { evidence: seamEvidence, sourceCommit: observation.candidate.sourceCommit,
      candidateArtifactCommitment: observation.identitySeam.candidateArtifactCommitment, artifactSetCommitment: observation.candidate.artifactSetCommitment,
      exactLanes: [lane('node-addon', 'exact'), lane('node-wasm', 'exact')] });
    const view = (score: typeof reviewedScore, id: string) => score.views.find(row => row.view === id)!;
    const diagnostic = b11ViewGate(view(reviewedScore, 'diagnostic-balanced')), stress = b11ViewGate(view(reviewedScore, 'benign-heavy-stress'));
    const oracleView = view(reviewedScore, 'oracle-plan');
    // Declared population mass whose authored truth the v2 revisions moved out of its stratum (C1 plans declare mass per stratum).
    const emptiedMass = (() => {
      if (family !== 'pii:global:email' && family !== 'pii:global:network-address') return [];
      const plan = C1_POPULATION_PLANS[family].plan, revised = new Set(b11Revisions.revisions.filter(row => row.family === family).map(row => row.caseId));
      return plan.populations.flatMap(population => population.strata.filter(row => row.mass > 0 &&
        plan.plan.cases.filter(item => item.stratum === row.stratum && item.views.includes(population.id)).every(item => revised.has(item.id)))
        .map(row => `${population.id}/${row.stratum}`));
    })();
    const unscored = ['diagnostic-balanced', 'benign-heavy-stress'].reduce((sum, id) => sum + view(reviewedScore, id).unscoredCases, 0);
    const frozenDeviationIds = new Set(frozenScore.deviations.map(row => row.id));
    const unexplained = frozenScore.deviations.filter(row => !reviewed.find(item => item.id === row.id && item.source === row.source)?.revision);
    const revisedWrong = reviewedScore.deviations.filter(row => row.revision);
    const gates = [
      gate('exact-candidate-binding', 'met', `${freeze.role} candidate ${freeze.candidate.sourceCommit}; every artifact hash equals the freeze (${freeze.freezeCommitment.slice(0, 12)})`),
      gate('activation-v2', Object.values(activation).every((row: any) => !row.problem && row.agreesAcrossSurfaces) ? 'met' : 'not-met',
        'every selection reports the frozen pii-context/v2 identity and family closure on both surfaces'),
      gate('pii-off-invariance', offFindings === 0 ? 'met' : 'not-met', `${offFindings} case(s) with a PII finding while PII is off`),
      gate('oracle-plan-public-stream', oracleView.sensitive.detected === oracleView.sensitive.cases && oracleView.nonSensitive.falseAlarm + oracleView.notEstablished.falseAlarm === 0 ? 'met' : 'not-met',
        `sensitive ${oracleView.sensitive.detected}/${oracleView.sensitive.cases}; benign false alarms ${oracleView.nonSensitive.falseAlarm + oracleView.notEstablished.falseAlarm}`),
      gate('identity-only-classification', identity.gateStatus, `${identity.outcomes.correct} correct and ${identity.outcomes['identity-only-compared']} named-negative identity-only of ${identity.eligibleCases} eligible; failing ${identity.failingCases.length}`),
      gate('source-artifact-equivalence', 'met', 'seam sensitive iff the built artifact emits the public finding, on the Node addon and Wasm exact-family lanes (fail closed)'),
      gate('cross-surface-determinism', Object.values(surfaceDisagreements).every(count => count === 0) ? 'met' : 'not-met', `addon vs Wasm disagreements per selection ${JSON.stringify(surfaceDisagreements)}`),
      gate('diagnostic-population', diagnostic.status, diagnostic.reasons.join('; ') || 'every pii-v1 metric met with minimum benign cases and axes'),
      gate('benign-heavy-population', stress.status, stress.reasons.join('; ') || 'every pii-v1 metric met with minimum benign cases and axes'),
      gate('population-no-regression', regressions.length ? 'not-met' : 'met', `${regressions.length} population case(s) correct on lockfile ${observation.baseline.version} and wrong on the candidate`),
      gate('population-mass-resolved', emptiedMass.length || unscored ? 'not-met' : 'met',
        [unscored ? `${unscored} population case(s) in contract-silent strata carry declared mass without authored truth` : null,
          emptiedMass.length ? `declared mass with no v2 authored member: ${emptiedMass.join(', ')}` : null].filter(Boolean).join('; ') || 'all declared population mass has authored truth'),
      gate('authored-truth-agreement', reviewedScore.deviations.length ? 'not-met' : 'met',
        `${reviewedScore.deviations.length} reviewed-view deviation(s); frozen-plan view ${frozenScore.deviations.length}, of which ${frozenDeviationIds.size - unexplained.length} are pre-registered revisions`),
      gate('contract-fixture-discrepancy', unexplained.length || revisedWrong.length ? 'not-met' : 'met',
        `${unexplained.length} frozen-plan deviation(s) without a pre-registered revision; ${revisedWrong.length} revised case(s) observed wrong`),
      parityGate,
      ...costGates,
      gate('trusted-accounting-source', 'met', `observations bound to the committed freeze ${observation.freeze.commit} on a clean benchmark tree ${observation.benchmark.revision}`),
      gate('independent-evidence', 'met', `population plan independence recorded by ${B11_POPULATION_OWNER[family]} (no reuse of v1 plan positives, no duplicate inputs); plans unchanged since`),
    ];
    const publicFailing = gates.filter(row => row.status !== 'met');
    const eligible = publicFailing.length === 0;
    const exceptCost = !eligible && publicFailing.every(row => (B11_COST_GATES as readonly string[]).includes(row.id));
    const epoch = freeze.protectedEpochs.find((row: any) => row.family === family);
    gates.push(gate('protected-partition', 'not-run', eligible ?
      'Eligible, but not run: the orchestrator decides whether to spend this epoch.' :
      `public-gates-failed: ${publicFailing.map(row => row.id).join(', ')}. Epoch ${epoch.epochCommitment.slice(0, 12)} stays unspent (0/1).`));
    return {
      family, findingType: PII_ORACLE_PLANS[family].findingType,
      plans: { oraclePlanCases: frozen.filter(row => row.source === 'oracle-plan').length, populationPlanFile: B11_POPULATION_PLAN_FILES[family],
        populationCases: frozen.filter(row => row.source === 'population-plan').length,
        revisedCases: reviewed.filter(row => row.revision).map(row => ({ id: row.id, revision: row.revision })) },
      activation, identityOnly: { ...identity, rawProjection: { gateStatus: identity.rawProjection.gateStatus, artifactCommitment: identity.rawProjection.artifactCommitment,
        identityOnly: identity.rawProjection.identityOnly } },
      views: { reviewed: reviewedScore.views, frozen: frozenScore.views.map(row => ({ view: row.view, cases: row.cases, sensitive: row.sensitive,
        nonSensitive: row.nonSensitive, notEstablished: row.notEstablished })), exactFamilyReviewed: exactScore.views.map(row => ({ view: row.view,
        sensitive: row.sensitive, nonSensitive: row.nonSensitive, notEstablished: row.notEstablished })) },
      deviations: { reviewed: reviewedScore.deviations, frozen: frozenScore.deviations },
      parity: { surfaceDisagreements, selectionDependentPopulationCases: selectionDependent },
      baselineComparison: { baseline: `lockfile ${observation.baseline.version}`, regressions, baselineDeviations: baselineScore.deviations.length },
      gates, protected: { eligible, eligibleExceptCostOnly: exceptCost, state: 'not-run', runs: 0, maxRuns: 1, epochCommitment: epoch.epochCommitment,
        protectedCorpus: epoch.protectedCorpus },
      status: 'pending' as const,
    };
  });
  const report = { schemaVersion: 1, reportType: 'pii-beta11-report', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#428',
    role: freeze.role, roleNote: freeze.roleNote, candidate: { sourceCommit: freeze.candidate.sourceCommit, versionString: freeze.candidate.versionString,
      released: false, artifactSetCommitment: observation.candidate.artifactSetCommitment, components: observation.candidate.components },
    freeze: observation.freeze, benchmark: observation.benchmark, platform: observation.platform,
    profile: 'pii-v1', cost: { runtimeComparisons: operational.runtimeComparisons, byteBudgets: bytes, sizeBudgetRows: sizeRows,
      operationalCommitment: operational.artifactCommitment },
    families, domainAccounting: 'PII only; credential findings are counted as credentialFindingCases and never enter a PII numerator or denominator',
    artifactCommitment: '' };
  report.artifactCommitment = b11Commitment({ ...report, artifactCommitment: undefined });
  return report;
}

/** The compact, release-facing six-row matrix. Counts, statuses, reasons and identifiers only. */
export function buildB11Disposition(report: ReturnType<typeof buildB11Report>) {
  const families = report.families.map(row => {
    const view = (id: string) => row.views.reviewed.find(item => item.view === id)!;
    const population = Object.fromEntries(['oracle-plan', 'diagnostic-balanced', 'benign-heavy-stress'].map(id => [id, {
      cases: view(id).cases, sensitive: `${view(id).sensitive.detected}/${view(id).sensitive.cases}`,
      nonSensitiveFalseAlarms: `${view(id).nonSensitive.falseAlarm}/${view(id).nonSensitive.cases}`,
      notEstablishedFalseAlarms: `${view(id).notEstablished.falseAlarm}/${view(id).notEstablished.cases}` }]));
    return {
      family: row.family,
      scope: { jurisdiction: row.family === 'pii:us:ssn' ? 'us' : 'global', selectors: row.family === 'pii:us:ssn' ? ['pii:family:us:ssn', 'pii:us'] :
        [`pii:family:${row.family.slice(4)}`, 'pii:global'], contextLanguages: ['en', 'ko'], contextVocabulary: 'pii-context/v2',
        publicFindingType: row.findingType },
      supportedContract: { familyContractVersion: 1, file: { 'pii:global:network-address': 'docs/audits/evidence/875/README.md',
        'pii:global:email': 'docs/contracts/pii/email-v1.md', 'pii:global:payment-card': 'docs/contracts/pii/payment-card-v1.md',
        'pii:global:iban': 'docs/contracts/pii/iban-v1.md', 'pii:us:ssn': 'docs/contracts/pii/us-ssn-v1.md', 'pii:global:phone': 'docs/contracts/pii/phone-v1.md' }[row.family] },
      status: row.status, profile: 'pii-v1',
      failedOrWithheldGates: row.gates.filter(item => item.status !== 'met').map(item => ({ gate: item.id, status: item.status, reason: item.reason })),
      metGates: row.gates.filter(item => item.status === 'met').map(item => item.id),
      population,
      protected: { eligible: row.protected.eligible, eligibleExceptCostOnly: row.protected.eligibleExceptCostOnly, state: row.protected.state,
        runs: `${row.protected.runs}/${row.protected.maxRuns}`, epochCommitment: row.protected.epochCommitment },
    };
  });
  const disposition = { schemaVersion: 1, reportType: 'pii-beta11-disposition', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#428',
    productIssue: 'redact-secret/redact-secret#901', role: report.role, roleNote: report.roleNote,
    candidate: report.candidate, freeze: report.freeze, benchmark: report.benchmark, reportCommitment: report.artifactCommitment,
    domainSeparation: 'PII numerators and denominators only; no credential count is merged, and no combined credential+PII score exists.',
    protectedPartition: { run: false, eligibleFamilies: families.filter(row => row.protected.eligible).map(row => row.family),
      eligibleExceptCostOnly: families.filter(row => row.protected.eligibleExceptCostOnly).map(row => row.family) },
    distribution: Object.fromEntries(['pending', 'provisional', 'stable'].map(status => [status, families.filter(row => row.status === status).length])),
    families, artifactCommitment: '' };
  disposition.artifactCommitment = b11Commitment({ ...disposition, artifactCommitment: undefined });
  return disposition;
}
