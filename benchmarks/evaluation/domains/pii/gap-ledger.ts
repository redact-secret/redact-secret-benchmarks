import Ajv from 'ajv';
import { createHash } from 'node:crypto';
import schema from '../../../../schemas/pii-gap-ledger-v1.json';
import networkAddressPlan from './network-address-qualification-v1.json';
import emailPlan from './email-qualification-v1.json';
import paymentCardPlan from './payment-card-qualification-v1.json';
import ibanPlan from './iban-qualification-v1.json';
import usSsnPlan from './us-ssn-qualification-v1.json';
import phonePlan from './phone-qualification-v1.json';
import benignCollisionData from './benign-collision-evidence-v1.json';
import populationData from './populations-v1.json';
import { hash } from '../../substrate/hash.ts';

/**
 * Frozen before-state ledger for the six beta.10 PII families (benchmarks #422).
 * It records why each family is `pending`, which evidence is independent, and who owns each blocker.
 * It is an audit artifact: it never changes a status, an expectation or a prior evidence record.
 */
export const PII_GAP_LEDGER_FAMILIES = ['pii:global:network-address', 'pii:global:email', 'pii:global:payment-card', 'pii:global:iban',
  'pii:us:ssn', 'pii:global:phone'] as const;
export const PII_GAP_LEDGER_CATEGORIES = ['identity-only-observability', 'sensitive-positive-false-negative', 'benign-false-positive',
  'context-validator-collision', 'diagnostic-balanced-population', 'benign-heavy-population', 'protected-partition', 'cross-surface-output',
  'activation', 'performance-size', 'contract-fixture-discrepancy', 'exact-candidate-binding'] as const;
export const PII_GAP_LEDGER_FAMILY_GROUP_OWNER: Record<PiiGapLedgerFamily, '#424' | '#425' | '#426'> = {
  'pii:global:network-address': '#424', 'pii:global:email': '#424', 'pii:global:payment-card': '#425', 'pii:global:iban': '#425',
  'pii:us:ssn': '#426', 'pii:global:phone': '#426',
};
/** Family → frozen qualification plan. Each plan's commitment is bound by an immutable `evidence/875`–`880` record. */
export const PII_GAP_LEDGER_PLANS: Record<PiiGapLedgerFamily, { file: string; plan: unknown }> = {
  'pii:global:network-address': { file: 'benchmarks/evaluation/domains/pii/network-address-qualification-v1.json', plan: networkAddressPlan },
  'pii:global:email': { file: 'benchmarks/evaluation/domains/pii/email-qualification-v1.json', plan: emailPlan },
  'pii:global:payment-card': { file: 'benchmarks/evaluation/domains/pii/payment-card-qualification-v1.json', plan: paymentCardPlan },
  'pii:global:iban': { file: 'benchmarks/evaluation/domains/pii/iban-qualification-v1.json', plan: ibanPlan },
  'pii:us:ssn': { file: 'benchmarks/evaluation/domains/pii/us-ssn-qualification-v1.json', plan: usSsnPlan },
  'pii:global:phone': { file: 'benchmarks/evaluation/domains/pii/phone-qualification-v1.json', plan: phonePlan },
};

export type PiiGapLedgerFamily = typeof PII_GAP_LEDGER_FAMILIES[number];
export type PiiGapLedgerCategory = typeof PII_GAP_LEDGER_CATEGORIES[number];
export type PiiGapLedgerStatus = 'not-run' | 'not-measured' | 'failed' | 'not-applicable' | 'passed';
export interface PiiGapLedgerBlocker {
  category: PiiGapLedgerCategory; status: PiiGapLedgerStatus; classification: string; owner: string; reason: string; detail: string;
  evidence?: string[]; resolution?: string; coreIssue?: number;
}
export interface PiiPlanIndependence {
  planFile: string; planCommitment: string; cases: number; publicFindingCases: number; publicAbsenceCases: number;
  distinctPositiveSpans: number; dominantPositiveCases: number; casesContainingDominantPositive: number; languages: Record<string, number>;
  koreanPublicFinding: number; koreanPublicAbsence: number; classesMeasured: number; classesUnresolved: number;
}
export interface PiiPopulationAudit {
  entries: number; families: Record<string, number>; languages: Record<string, number>; candidateKinds: Record<string, number>;
  generators: Record<string, number>; evidenceClasses: Record<string, number>; emptyEvidenceClasses: string[];
  candidateCommitmentsReused: number; entriesSharingACandidate: number; fieldLabelsReusedAcrossViews: number; declaredTwins: number;
  declaredCollisions: number;
}
export interface PiiGapLedger {
  schemaVersion: 1; reportType: 'pii-gap-ledger'; id: 'pii-gap-ledger-v1'; supportClaims: false; auditOnly: true; frozenAt: string;
  issues: { benchmarks: 422; benchmarksParent: 421; core: 901 };
  profile: { id: 'pii-v1'; version: 1; file: string; sha256: string };
  finalCandidate: {
    status: 'identified' | 'not-identifiable'; repository: string; version: string; tag: string; sourceCommit: string;
    releaseManifest: { file: string; sha256: string }; artifactInventorySha256: string; conformanceIdentity: string;
    artifacts: Array<{ artifact: string; file: string; algorithm: 'sha256' | 'sha1'; digest: string }>;
    piiEvidenceBound: boolean; piiEvidenceReason: string;
    detectionSourceEquivalence: { comparedTo: string; coreSourceChanged: boolean; changedScope: string };
  };
  benchmarkRevision: { repository: string; commit: string; lockfileSha256: string };
  populationBeforeState: {
    contractId: string; contractCommitment: string; corpusId: string; corpusCommitment: string;
    views: Array<{ id: string; role: string; members: number; sensitiveMass: number; nonSensitiveMass: number; notEstablishedMass: number }>;
    audit: PiiPopulationAudit;
  };
  priorEvidence: Array<{
    id: string; coreIssue: number | null; benchmarkIssue: number; kind: 'family-qualification' | 'profile-cost'; families: PiiGapLedgerFamily[];
    productSourceCommit: string; benchmarkInputCommit: string; boundToFinalCandidate: boolean; summary: string;
    qualificationStatus?: string; supportState?: string; planCommitment?: string; candidateEvidenceCommitment?: string;
    supportMatrixCommitment?: string; reasonCodes?: string[]; files: Array<{ file: string; sha256: string }>;
  }>;
  corrections: Array<{ id: string; family: PiiGapLedgerFamily; kind: 'fixture-correction'; references: string[]; affects: string[];
    rewritesPriorEvidence: false; summary: string; remeasureOwner: string }>;
  evaluatorFindings: Array<{ id: string; families: PiiGapLedgerFamily[]; location: string; summary: string; owner: string; productDefect: false }>;
  families: Array<{
    family: PiiGapLedgerFamily; scope: string; contract: string; evidence: string; supportState: 'pending'; blockers: PiiGapLedgerBlocker[];
    independence: { plan: PiiPlanIndependence; populationEntries: number; contractLanguages: Array<'en' | 'ko'>; languageGaps: string[];
      jurisdiction: string; authorityControls: string; twins: string; generatorFindings: string[] };
    fixtureCorrections: string[]; productDefects: number[]; nonGoals: Array<{ id: string; basis: string }>;
  }>;
  axisBacklog: Array<{ order: number; id: string; family: PiiGapLedgerFamily; owner: '#424' | '#425' | '#426'; views: string[];
    languages: Array<'en' | 'ko'>; resolves: PiiGapLedgerCategory[]; detail: string }>;
  contentCommitment: string;
}

const validateSchema = new Ajv({ strict: true, allErrors: true }).compile(schema);
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
export const piiGapLedgerProjection = (ledger: PiiGapLedger) => {
  const { contentCommitment: _contentCommitment, ...projection } = ledger; return projection;
};
export const piiGapLedgerCommitment = (ledger: PiiGapLedger) => hash(JSON.stringify(canonicalize(piiGapLedgerProjection(ledger))));

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const SEPARATORS = /[\s\-. ‐​-‍]/g;
const normalizeSpan = (value: string) => value.replace(SEPARATORS, '').toLowerCase();
const tally = (values: string[]) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1),
  new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b)));

type PlanCase = { id: string; input: string; expected: { publicFinding: boolean; start?: number; end?: number } };
type Plan = { canonicalOffsetUnit?: string; cases: PlanCase[]; classAccounting: Array<{ status: string }> };

/** Mechanical independence metrics over one frozen qualification plan. Output carries counts only, never a case value. */
export function piiPlanIndependence(family: PiiGapLedgerFamily): PiiPlanIndependence {
  const { file, plan: raw } = PII_GAP_LEDGER_PLANS[family];
  const plan = raw as Plan;
  const span = (row: PlanCase) => plan.canonicalOffsetUnit === 'utf8-byte'
    ? Buffer.from(row.input, 'utf8').subarray(row.expected.start, row.expected.end).toString('utf8')
    : row.input.slice(row.expected.start, row.expected.end);
  const positives = plan.cases.filter(row => row.expected.publicFinding);
  const spans = positives.map(row => normalizeSpan(span(row)));
  const counts = tally(spans);
  const [dominant, dominantCount] = Object.entries(counts).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0] ?? ['', 0];
  const korean = (row: PlanCase) => HANGUL.test(row.input);
  return {
    planFile: file, planCommitment: createHash('sha256').update(JSON.stringify(raw)).digest('hex'), cases: plan.cases.length,
    publicFindingCases: positives.length, publicAbsenceCases: plan.cases.length - positives.length,
    distinctPositiveSpans: Object.keys(counts).length, dominantPositiveCases: dominantCount,
    casesContainingDominantPositive: dominant ? plan.cases.filter(row => normalizeSpan(row.input).includes(dominant)).length : 0,
    languages: tally(plan.cases.map(row => korean(row) ? 'ko' : 'en')),
    koreanPublicFinding: positives.filter(korean).length, koreanPublicAbsence: plan.cases.filter(row => !row.expected.publicFinding && korean(row)).length,
    classesMeasured: plan.classAccounting.filter(row => row.status === 'measured').length,
    classesUnresolved: plan.classAccounting.filter(row => row.status === 'unresolved').length,
  };
}

type CorpusEntry = { id: string; family: string; language: string; evidenceClass: string; candidateCommitment: string;
  fixture: { prefix: string; candidate: { kind: string; generator?: string } }; collision: unknown; twinOf?: unknown };
type PopulationView = { id: string; denominator: { evidenceIds: string[] } };

/** Mechanical independence metrics over the population corpus. Only valid while the corpus is the recorded before-state. */
export function piiPopulationAudit(corpus: { entries: CorpusEntry[]; classes: Array<{ id: string }> } = benignCollisionData as never,
  contract: { populations: PopulationView[] } = populationData as never): PiiPopulationAudit {
  const entries = corpus.entries;
  const byCommitment = tally(entries.map(entry => entry.candidateCommitment));
  const reused = Object.values(byCommitment).filter(count => count > 1);
  const viewOf = new Map<string, string>();
  for (const view of contract.populations) for (const id of view.denominator.evidenceIds) viewOf.set(id, view.id);
  const labelViews = new Map<string, Set<string>>();
  for (const entry of entries) {
    const label = entry.fixture.prefix;
    labelViews.set(label, (labelViews.get(label) ?? new Set()).add(viewOf.get(entry.id) ?? 'unassigned'));
  }
  const evidenceClasses = tally(entries.map(entry => entry.evidenceClass));
  return {
    entries: entries.length, families: tally(entries.map(entry => entry.family)), languages: tally(entries.map(entry => entry.language)),
    candidateKinds: tally(entries.map(entry => entry.fixture.candidate.kind)),
    generators: tally(entries.flatMap(entry => entry.fixture.candidate.generator ? [entry.fixture.candidate.generator] : [])),
    evidenceClasses, emptyEvidenceClasses: corpus.classes.map(row => row.id).filter(id => !evidenceClasses[id]).sort(),
    candidateCommitmentsReused: reused.length, entriesSharingACandidate: reused.reduce((sum, count) => sum + count, 0),
    fieldLabelsReusedAcrossViews: [...labelViews.values()].filter(views => views.size > 1).length,
    declaredTwins: entries.filter(entry => entry.twinOf !== undefined && entry.twinOf !== null).length,
    declaredCollisions: entries.filter(entry => entry.collision !== null && entry.collision !== undefined).length,
  };
}

/** Collect every synthetic value a frozen plan or the population corpus could leak into the ledger. */
function syntheticValues(): string[] {
  const values = new Set<string>();
  for (const { plan } of Object.values(PII_GAP_LEDGER_PLANS)) {
    const typed = plan as Plan;
    for (const row of typed.cases) {
      if (row.expected.publicFinding) {
        const span = typed.canonicalOffsetUnit === 'utf8-byte'
          ? Buffer.from(row.input, 'utf8').subarray(row.expected.start, row.expected.end).toString('utf8')
          : row.input.slice(row.expected.start, row.expected.end);
        if (span.length >= 6) values.add(span);
      }
      if (row.input.length >= 10) values.add(row.input);
    }
  }
  for (const entry of (benignCollisionData as unknown as { entries: Array<{ fixture: { candidate: { value?: string } } }> }).entries) {
    const value = entry.fixture.candidate.value;
    if (value && value.length >= 6) values.add(value);
  }
  return [...values];
}

/** Keeps `not-run`, `not-measured`, `failed`, `not-applicable` and `passed` from standing in for each other. */
const STATUS_CLASSIFICATIONS: Record<PiiGapLedgerStatus, readonly string[]> = {
  passed: ['none'],
  failed: ['fixture-correction', 'product-defect', 'product-cost-decision'],
  'not-measured': ['measurement-gap', 'evaluator-observability'],
  'not-run': ['measurement-gap'],
  'not-applicable': ['non-goal'],
};
const UNSAFE_KEYS = /"(?:content|candidate|seed|fixture|path|raw|caseId|variant|input|value)"\s*:/i;

export function validatePiiGapLedger(value: unknown): PiiGapLedger {
  if (!validateSchema(value)) throw new Error(`Invalid PII gap ledger schema: ${JSON.stringify(validateSchema.errors)}`);
  const ledger = structuredClone(value) as unknown as PiiGapLedger;
  if (piiGapLedgerCommitment(ledger) !== ledger.contentCommitment) throw new Error('PII gap ledger commitment mismatch');
  const serialized = JSON.stringify(ledger);
  if (UNSAFE_KEYS.test(serialized)) throw new Error('PII gap ledger carries an unsafe key');
  if (syntheticValues().some(sample => serialized.includes(sample))) throw new Error('PII gap ledger carries a raw case value');

  const candidate = ledger.finalCandidate;
  if (candidate.status === 'not-identifiable' && candidate.piiEvidenceBound) throw new Error('Unidentified final candidate cannot bind PII evidence');
  if (JSON.stringify(ledger.families.map(row => row.family)) !== JSON.stringify(PII_GAP_LEDGER_FAMILIES))
    throw new Error('PII gap ledger must carry exactly the six families in canonical order');

  const priorIds = new Set<string>();
  for (const prior of ledger.priorEvidence) {
    if (priorIds.has(prior.id)) throw new Error(`Duplicate prior evidence ${prior.id}`);
    priorIds.add(prior.id);
    if (prior.boundToFinalCandidate !== (prior.productSourceCommit === candidate.sourceCommit))
      throw new Error(`Prior evidence ${prior.id} misstates its binding to the final candidate`);
    if (prior.boundToFinalCandidate && !candidate.piiEvidenceBound) throw new Error('Final candidate PII binding contradicts prior evidence');
    if (prior.files.some(entry => !entry.file.startsWith(`${prior.id}/`))) throw new Error(`Prior evidence ${prior.id} lists a foreign file`);
  }
  if (!candidate.piiEvidenceBound && ledger.priorEvidence.some(prior => prior.boundToFinalCandidate))
    throw new Error('Final candidate is marked unbound while prior evidence binds it');

  const correctionIds = new Set(ledger.corrections.map(row => row.id));
  for (const correction of ledger.corrections) {
    if (correction.affects.some(id => !priorIds.has(id))) throw new Error(`Correction ${correction.id} affects unknown evidence`);
    if (correction.remeasureOwner !== PII_GAP_LEDGER_FAMILY_GROUP_OWNER[correction.family])
      throw new Error(`Correction ${correction.id} must be remeasured by its family-group child`);
  }
  for (const finding of ledger.evaluatorFindings) if (finding.owner === 'none' || finding.owner === 'non-goal')
    throw new Error(`Evaluator finding ${finding.id} needs an owning issue`);

  for (const row of ledger.families) {
    if (!priorIds.has(row.evidence)) throw new Error(`${row.family} names unknown evidence ${row.evidence}`);
    const prior = ledger.priorEvidence.find(entry => entry.id === row.evidence)!;
    if (prior.kind !== 'family-qualification' || !prior.families.includes(row.family)) throw new Error(`${row.family} evidence does not qualify it`);
    if (JSON.stringify(row.blockers.map(blocker => blocker.category)) !== JSON.stringify(PII_GAP_LEDGER_CATEGORIES))
      throw new Error(`${row.family} must list every blocker category once in canonical order`);
    for (const blocker of row.blockers) {
      const where = `${row.family}/${blocker.category}`;
      if (blocker.status !== 'passed' && blocker.owner === 'none') throw new Error(`${where} is ${blocker.status} but has no owner`);
      if (!STATUS_CLASSIFICATIONS[blocker.status].includes(blocker.classification))
        throw new Error(`${where} cannot be ${blocker.status} with classification ${blocker.classification}`);
      if (blocker.status === 'not-applicable' && blocker.owner !== 'non-goal') throw new Error(`${where} is not-applicable without a non-goal decision`);
      if (blocker.classification === 'non-goal' && blocker.owner !== 'non-goal') throw new Error(`${where} non-goal must be owned as a non-goal`);
      if ((blocker.classification === 'product-defect') !== (blocker.coreIssue !== undefined))
        throw new Error(`${where} product defect and core issue must appear together`);
      if (blocker.classification === 'product-defect' && !row.productDefects.includes(blocker.coreIssue!))
        throw new Error(`${where} product defect is not listed on its family row`);
      if (blocker.classification === 'fixture-correction' && !row.fixtureCorrections.some(id => correctionIds.has(id)))
        throw new Error(`${where} fixture correction has no recorded correction`);
      if (blocker.status === 'passed' && (blocker.evidence ?? []).length === 0) throw new Error(`${where} passed without evidence`);
      if (blocker.category === 'exact-candidate-binding' && blocker.status === 'passed' && !candidate.piiEvidenceBound)
        throw new Error(`${where} cannot pass while the final candidate carries no PII evidence`);
      for (const reference of blocker.evidence ?? []) if (reference.startsWith('evidence/') && !priorIds.has(reference))
        throw new Error(`${where} cites unrecorded evidence ${reference}`);
    }
    if (row.fixtureCorrections.some(id => !correctionIds.has(id) || ledger.corrections.find(entry => entry.id === id)!.family !== row.family))
      throw new Error(`${row.family} lists a foreign or unknown fixture correction`);
    if (JSON.stringify(row.independence.plan) !== JSON.stringify(piiPlanIndependence(row.family)))
      throw new Error(`${row.family} plan independence metrics do not reproduce from the frozen plan`);
    if (prior.planCommitment !== row.independence.plan.planCommitment)
      throw new Error(`${row.family} plan is not the plan its immutable evidence bound`);
    const populationEntries = ledger.populationBeforeState.audit.families[row.family] ?? 0;
    if (row.independence.populationEntries !== populationEntries) throw new Error(`${row.family} population entry count mismatch`);
  }

  const population = ledger.populationBeforeState;
  if (JSON.stringify(population.views.map(view => view.id)) !== JSON.stringify(['diagnostic-balanced', 'benign-heavy-stress']))
    throw new Error('PII gap ledger must record both population views in canonical order');
  if (population.corpusCommitment === (benignCollisionData as { contentCommitment: string }).contentCommitment &&
      JSON.stringify(population.audit) !== JSON.stringify(piiPopulationAudit()))
    throw new Error('Population audit does not reproduce from the recorded before-state corpus');

  const orders = ledger.axisBacklog.map(axis => axis.order);
  if (orders.some((order, index) => order !== index + 1)) throw new Error('Axis backlog order must be contiguous from 1');
  if (new Set(ledger.axisBacklog.map(axis => axis.id)).size !== ledger.axisBacklog.length) throw new Error('Axis backlog repeats an axis');
  for (const axis of ledger.axisBacklog) if (axis.owner !== PII_GAP_LEDGER_FAMILY_GROUP_OWNER[axis.family])
    throw new Error(`Axis ${axis.id} is owned outside its family group`);
  for (const family of PII_GAP_LEDGER_FAMILIES) if (!ledger.axisBacklog.some(axis => axis.family === family))
    throw new Error(`${family} has no backlog axis`);
  return ledger;
}

/** Recompute the SHA-256 of every file the ledger freezes, relative to `root`. Returns mismatching paths. */
export async function piiGapLedgerFileDrift(ledger: PiiGapLedger, root: string): Promise<string[]> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const files = [{ file: ledger.profile.file, sha256: ledger.profile.sha256 }, ...ledger.priorEvidence.flatMap(prior => prior.files)];
  const drift: string[] = [];
  for (const entry of files) {
    const actual = createHash('sha256').update(await readFile(join(root, entry.file))).digest('hex');
    if (actual !== entry.sha256) drift.push(entry.file);
  }
  return drift;
}
