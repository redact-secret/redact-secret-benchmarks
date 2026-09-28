/**
 * #425 payment-card and IBAN validator/collision stress: plan validation and observation scoring.
 *
 * The plans are frozen authored truth (`authoring.ts` regenerates them byte for byte). Validation re-derives every
 * case's input, range, contract identity (benchmark-side contract model), #423 oracle label (shared validator),
 * declared twin, view denominator and independence requirement. Scoring turns installed-artifact observations into
 * separate accountings: validator correctness, semantic collision, official test values, unsupported shapes,
 * sensitive detection, action, output leakage, collateral and cross-family findings. Identity-only outcomes stay a
 * typed `not-measured` until the core#910 seam exists. Nothing here emits a raw value.
 */
import { hash } from '../../../substrate/hash.ts';
import {
  PII_ORACLE_UNAVAILABLE_REASON, evaluatePiiIdentityOracle, piiIdentityOracleCommitment, piiOraclePlanCommitment,
  validatePiiIdentityOracle, type PiiIdentityOracle, type PiiOraclePlan,
} from '../identity-oracle.ts';
import { CONSTRUCTIONS, STRESS_PLAN_FILES, buildStressPlan, type StressCase, type StressView } from './authoring.ts';
import { ibanIdentity, paymentCardIdentity } from './contract-model.ts';
import cardPlanData from './payment-card-stress-v1.json';
import ibanPlanData from './iban-stress-v1.json';

export type StressFamily = keyof typeof STRESS_PLAN_FILES;
export type StressPlan = ReturnType<typeof buildStressPlan>;
export const STRESS_FAMILIES = Object.keys(STRESS_PLAN_FILES) as StressFamily[];
export const stressPlans: Readonly<Record<StressFamily, StressPlan>> = Object.freeze({
  'pii:global:payment-card': cardPlanData as unknown as StressPlan, 'pii:global:iban': ibanPlanData as unknown as StressPlan,
});

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
export const stressCommitment = (value: unknown) => hash(JSON.stringify(canonical(value)));

/** The #423 oracle view of a stress plan: exactly the fields the shared oracle validator binds. */
export const oraclePlan = (plan: StressPlan): PiiOraclePlan => ({ family: plan.family, findingType: plan.findingType,
  familyContractVersion: plan.familyContractVersion, cases: plan.cases.map(row => ({ id: row.id, input: row.input, expected: row.expected })) });

/** A #423-format oracle over both stress plans, validated by the shared validator (same label rules, same reference validators). */
export function stressOracle(plans: Readonly<Record<StressFamily, StressPlan>> = stressPlans): PiiIdentityOracle {
  const oracle = {
    schemaVersion: 1 as const, reportType: 'pii-identity-oracle' as const, oracleVersion: 1 as const, supportClaims: false as const,
    evidenceKind: 'authored-truth' as const, contextVocabulary: 'pii-context/v1',
    rationale: 'Authored identity and sensitivity truth for the #425 card/IBAN stress plans, from the frozen family contracts and named authorities only.',
    families: STRESS_FAMILIES.map(family => {
      const plan = plans[family];
      return { family, findingType: plan.findingType, familyContractVersion: plan.familyContractVersion, plan: STRESS_PLAN_FILES[family],
        planCommitment: piiOraclePlanCommitment(oraclePlan(plan)),
        referenceValidator: family === 'pii:global:payment-card' ? { id: 'luhn', version: 1 } : { id: 'iban-mod97', version: 1 },
        labels: plan.cases.map(row => ({ caseId: row.id, ...row.oracle })) };
    }),
  };
  return validatePiiIdentityOracle(oracle, Object.fromEntries(STRESS_FAMILIES.map(family => [family, oraclePlan(plans[family])])));
}

// ---------------------------------------------------------------------------------------------------------------
// Plan validation
// ---------------------------------------------------------------------------------------------------------------
const POSITIVE_FORMS: Record<StressFamily, { en: string[]; ko: string[] }> = {
  'pii:global:payment-card': { en: ['payment card', 'card number', 'credit card number', 'debit card number', 'pan'],
    ko: ['결제 카드', '카드 번호', '신용 카드 번호', '직불 카드 번호'] },
  'pii:global:iban': { en: ['iban', 'international bank account number'], ko: ['iban', '국제 계좌번호'] },
};
/** pii-context/v1 comparison view: ASCII case fold and tokenization on whitespace, `_`, `-`, `:`, `=`. */
const contextView = (value: string) => value.toLowerCase().replace(/[\s_:=-]+/g, ' ');
const skeleton = (display: string) => display.replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xff10))
  .replace(/[^0-9A-Za-z*]/g, '').toUpperCase();

export interface StressIndependence {
  cases: number; positiveCases: number; distinctPositiveValues: number; dominantPositiveCases: number; dominantPositiveShare: number;
  positiveConstructions: number; koreanPositives: number; koreanCases: number; declaredTwins: number;
  twinsByProperty: Record<string, number>; languages: Record<string, number>;
}

export function stressIndependence(plan: StressPlan): StressIndependence {
  const identity = plan.family === 'pii:global:payment-card' ? paymentCardIdentity : ibanIdentity;
  const positives = plan.cases.filter(row => row.expected.publicFinding);
  const values = new Map<string, number>();
  for (const row of positives) { const key = identity(row.display).normalized!; values.set(key, (values.get(key) ?? 0) + 1); }
  // A value shared by any case (positive or not) counts toward its dominance: twins deliberately reuse values.
  const containing = new Map<string, number>();
  for (const row of plan.cases) { const key = identity(row.display).normalized; if (key && values.has(key)) containing.set(key, (containing.get(key) ?? 0) + 1); }
  const dominant = Math.max(0, ...containing.values());
  const twins = plan.cases.filter(row => row.twinOf);
  const count = (list: string[]) => list.reduce<Record<string, number>>((acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }), {});
  return {
    cases: plan.cases.length, positiveCases: positives.length, distinctPositiveValues: values.size, dominantPositiveCases: dominant,
    dominantPositiveShare: Number((dominant / plan.cases.length).toFixed(4)),
    positiveConstructions: new Set(positives.map(row => row.construction.id)).size,
    koreanPositives: positives.filter(row => row.language === 'ko').length, koreanCases: plan.cases.filter(row => row.language === 'ko').length,
    declaredTwins: twins.length, twinsByProperty: count(twins.map(row => row.varies!)), languages: count(plan.cases.map(row => row.language)),
  };
}

export function validateStressPlan(plan: StressPlan) {
  const family = plan.family as StressFamily;
  if (!STRESS_FAMILIES.includes(family) || plan.schemaVersion !== 1 || plan.reportType !== 'pii-validator-collision-stress-plan' ||
      plan.supportClaims !== false || plan.canonicalOffsetUnit !== 'utf8-byte' || plan.contract.contextVocabulary !== 'pii-context/v1')
    throw new Error('Invalid #425 stress plan header');
  const identity = family === 'pii:global:payment-card' ? paymentCardIdentity : ibanIdentity;
  const ids = new Set<string>();
  const byId = new Map(plan.cases.map(row => [row.id, row] as const));
  for (const row of plan.cases as StressCase[]) {
    if (ids.has(row.id)) throw new Error(`duplicate stress case ${row.id}`);
    ids.add(row.id);
    const axis = plan.axes.find(entry => entry.id === row.axis);
    if (!axis || JSON.stringify(row.views) !== JSON.stringify(axis.views)) throw new Error(`stress case views do not follow its axis: ${row.id}`);
    if (!Object.hasOwn(CONSTRUCTIONS, row.construction.id)) throw new Error(`unknown construction: ${row.id}`);
    if (row.input !== `${row.prefix}${row.display}${row.suffix ?? ''}`) throw new Error(`stress case input is not its parts: ${row.id}`);
    const start = Buffer.byteLength(row.prefix), end = start + Buffer.byteLength(row.display);
    const model = identity(row.display);
    if (model.identity !== row.identity || row.oracle.identity !== row.identity)
      throw new Error(`authored identity disagrees with the frozen contract model: ${row.id}`);
    if (row.identity !== 'not-established' && (row.oracle.candidate?.start !== start || row.oracle.candidate?.end !== end))
      throw new Error(`oracle candidate is not the authored display: ${row.id}`);
    if (row.oracle.sensitivity !== row.sensitivity) throw new Error(`oracle sensitivity is not the authored sensitivity: ${row.id}`);
    const finding = row.identity === 'valid' && row.sensitivity === 'sensitive';
    if (row.expected.publicFinding !== finding || row.expected.sensitive !== finding ||
        (finding && (row.expected.start !== start || row.expected.end !== end)))
      throw new Error(`public-finding expectation does not follow identity and sensitivity: ${row.id}`);
    if (row.sensitivity === 'sensitive') {
      const view = contextView(row.prefix);
      if (!POSITIVE_FORMS[family][row.language].some(form => view.includes(form))) throw new Error(`sensitive case has no reviewed ${row.language} field form: ${row.id}`);
    }
    if (row.sensitivity === 'non-sensitive' && !model.authorityTestValue) throw new Error(`non-sensitive case is not an authority-reserved value: ${row.id}`);
    if (row.language === 'ko' && !/[가-힣]/.test(row.input)) throw new Error(`Korean case has no Korean text: ${row.id}`);
    if (row.twinOf) {
      const twin = byId.get(row.twinOf);
      if (!twin || twin.id === row.id) throw new Error(`twin target missing: ${row.id}`);
      const sameContext = twin.prefix === row.prefix && (twin.suffix ?? '') === (row.suffix ?? '');
      const ok = row.varies === 'context' ? !sameContext && twin.display === row.display :
        row.varies === 'layout' ? sameContext && twin.display !== row.display && skeleton(twin.display) === skeleton(row.display) :
          row.varies === 'value' ? sameContext && skeleton(twin.display) !== skeleton(row.display) : false;
      if (!ok) throw new Error(`declared twin differs in more or other than its one property: ${row.id}`);
    } else if (row.varies) throw new Error(`varies without twinOf: ${row.id}`);
  }
  for (const axis of plan.axes) {
    const members = plan.cases.filter(row => row.axis === axis.id);
    if (!members.length) throw new Error(`axis without cases: ${axis.id}`);
    for (const language of axis.languages) if (!members.some(row => row.language === language)) throw new Error(`axis ${axis.id} lacks ${language}`);
  }
  for (const population of plan.populations) {
    const members = plan.cases.filter(row => row.views.includes(population.id as StressView));
    if (JSON.stringify(population.denominator.caseIds) !== JSON.stringify(members.map(row => row.id))) throw new Error(`population denominator drift: ${population.id}`);
    const classes = [...new Set(members.map(row => row.evidenceClass))].sort();
    if (JSON.stringify(population.baseRate.strata.map(row => row.evidenceClass).sort()) !== JSON.stringify(classes) ||
        population.baseRate.strata.reduce((sum, row) => sum + row.mass, 0) !== population.baseRate.totalMass ||
        population.baseRate.strata.some(row => !Number.isInteger(row.mass) || row.mass <= 0))
      throw new Error(`population base rate does not cover its members: ${population.id}`);
  }
  const independence = stressIndependence(plan), need = plan.independenceRequirements;
  if (independence.distinctPositiveValues < need.minDistinctPositiveValues || independence.dominantPositiveShare > need.maxDominantPositiveCaseShare ||
      independence.positiveConstructions < need.minPositiveConstructions || independence.koreanPositives < need.minKoreanPositives ||
      independence.declaredTwins < need.minDeclaredTwins)
    throw new Error(`independence requirement not met for ${family}: ${JSON.stringify(independence)}`);
  return { plan, independence, commitment: stressCommitment(plan) };
}

export function validateStressPlans(plans: Readonly<Record<StressFamily, StressPlan>> = stressPlans) {
  const results = STRESS_FAMILIES.map(family => validateStressPlan(plans[family]));
  const oracle = stressOracle(plans);
  return { results, oracle, oracleCommitment: piiIdentityOracleCommitment(oracle) };
}

// ---------------------------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------------------------
export interface ObservedFinding { type: string; detector: string; action: string; start: number; end: number }
export interface ObservedCase { id: string; findings: ObservedFinding[]; redaction: { targetValueRemoved: boolean | null; outsidePreserved: boolean; findingsAgree: boolean } }
export interface ObservedLane { lane: 'node-addon' | 'node-wasm'; selection: 'pii-global-and-us' | 'exact-family'; activationIdentity: string | null; cases: ObservedCase[] }

export type CaseOutcome = 'detected' | 'missed' | 'range-mismatch' | 'action-mismatch' | 'absent' | 'false-alarm';
export function caseOutcome(row: StressCase, observed: ObservedCase, findingType: string): CaseOutcome {
  const target = observed.findings.filter(finding => finding.type === findingType);
  if (!row.expected.publicFinding) return target.length ? 'false-alarm' : 'absent';
  if (!target.length) return 'missed';
  if (target.length !== 1 || target[0].start !== row.expected.start || target[0].end !== row.expected.end) return 'range-mismatch';
  return target[0].action === 'redact' ? 'detected' : 'action-mismatch';
}

const group = (row: StressCase) => row.sensitivity === 'sensitive' ? 'sensitive' : row.identity === 'invalid' ? 'validator-correctness' :
  row.identity === 'not-established' ? 'unsupported-shape' : row.sensitivity === 'non-sensitive' ? 'official-test' : 'semantic-collision';
export const STRESS_GROUPS = ['sensitive', 'validator-correctness', 'semantic-collision', 'official-test', 'unsupported-shape'] as const;

export function scoreLane(plan: StressPlan, lane: ObservedLane) {
  if (JSON.stringify(lane.cases.map(row => row.id)) !== JSON.stringify(plan.cases.map(row => row.id))) throw new Error('observations are not one-to-one with the plan');
  const rows = (plan.cases as StressCase[]).map((row, index) => {
    const observed = lane.cases[index];
    const outcome = caseOutcome(row, observed, plan.findingType);
    const otherPii = observed.findings.filter(finding => finding.detector === 'pii-domain' && finding.type !== plan.findingType).map(finding => finding.type);
    const credential = observed.findings.filter(finding => finding.detector !== 'pii-domain').map(finding => finding.detector);
    return { id: row.id, group: group(row), evidenceClass: row.evidenceClass, views: row.views, language: row.language, outcome,
      crossFamily: row.crossFamily ?? 'none-expected', otherPii, credential,
      leaked: row.expected.publicFinding && outcome === 'detected' ? observed.redaction.targetValueRemoved === false : false,
      outsideModified: !observed.redaction.outsidePreserved, redactDisagrees: !observed.redaction.findingsAgree,
      nonRedactAction: observed.findings.some(finding => finding.type === plan.findingType && finding.action !== 'redact') };
  });
  const tally = (list: typeof rows) => {
    const outcomes = Object.fromEntries((['detected', 'missed', 'range-mismatch', 'action-mismatch', 'absent', 'false-alarm'] as CaseOutcome[])
      .map(outcome => [outcome, list.filter(row => row.outcome === outcome).length]).filter(([, value]) => value));
    return { cases: list.length, ...outcomes };
  };
  const groups = Object.fromEntries(STRESS_GROUPS.map(name => [name, tally(rows.filter(row => row.group === name))]));
  const byLanguage = Object.fromEntries(['en', 'ko'].map(language => [language, Object.fromEntries(STRESS_GROUPS.map(name =>
    [name, tally(rows.filter(row => row.group === name && row.language === language))]).filter(([, value]) => (value as { cases: number }).cases))]));
  const crossFamilyTypes = rows.flatMap(row => row.otherPii).reduce<Record<string, number>>((acc, type) => ({ ...acc, [type]: (acc[type] ?? 0) + 1 }), {});
  const views = plan.populations.map(population => {
    const members = rows.filter(row => row.views.includes(population.id as StressView));
    const strata = population.baseRate.strata.map(stratum => {
      const list = members.filter(row => row.evidenceClass === stratum.evidenceClass);
      const errors = list.filter(row => !['detected', 'absent'].includes(row.outcome)).length;
      return { evidenceClass: stratum.evidenceClass, mass: stratum.mass, cases: list.length, errors };
    });
    const benign = strata.filter(row => row.evidenceClass !== 'sensitive-synthetic');
    const benignMass = benign.reduce((sum, row) => sum + row.mass, 0);
    const sensitiveMembers = members.filter(row => row.group === 'sensitive');
    const nonSensitiveMembers = members.filter(row => row.group !== 'sensitive');
    return {
      id: population.id, denominator: members.length, strata,
      weightedErrorRate: Number((strata.reduce((sum, row) => sum + row.mass * (row.errors / row.cases), 0) / population.baseRate.totalMass).toFixed(6)),
      weightedBenignStratumErrorRate: benignMass ? Number((benign.reduce((sum, row) => sum + row.mass * (row.errors / row.cases), 0) / benignMass).toFixed(6)) : null,
      sensitive: { cases: sensitiveMembers.length, detected: sensitiveMembers.filter(row => row.outcome === 'detected').length },
      nonSensitive: { cases: nonSensitiveMembers.length, falseAlarms: nonSensitiveMembers.filter(row => row.outcome === 'false-alarm').length },
    };
  });
  return {
    lane: lane.lane, selection: lane.selection, activationIdentity: lane.activationIdentity, groups, byLanguage, views,
    action: { targetFindings: rows.filter(row => ['detected', 'range-mismatch', 'action-mismatch', 'false-alarm'].includes(row.outcome)).length,
      nonRedact: rows.filter(row => row.nonRedactAction).length },
    outputLeakage: { detectedSensitive: rows.filter(row => row.outcome === 'detected').length, valueLeakedAfterRedaction: rows.filter(row => row.leaked).length,
      sensitiveLeftInOutput: rows.filter(row => row.group === 'sensitive' && row.outcome !== 'detected').length },
    collateral: { casesWithOutsideModification: rows.filter(row => row.outsideModified).length,
      credentialFindings: rows.reduce((sum, row) => sum + row.credential.length, 0), casesWithCredentialFindings: rows.filter(row => row.credential.length).length,
      scanAndRedactFindingDisagreements: rows.filter(row => row.redactDisagrees).length },
    crossFamily: { findingsByType: crossFamilyTypes, noneExpectedViolations: rows.filter(row => row.crossFamily === 'none-expected' && row.otherPii.length).length,
      notAuthoredCasesWithFindings: rows.filter(row => row.crossFamily === 'not-authored' && row.otherPii.length).length },
    caseOutcomes: rows.map(row => ({ id: row.id, outcome: row.outcome, ...(row.otherPii.length ? { otherPii: row.otherPii } : {}),
      ...(row.credential.length ? { credential: row.credential } : {}), ...(row.leaked ? { leaked: true } : {}),
      ...(row.outsideModified ? { outsideModified: true } : {}) })),
  };
}

/** Lanes of one side must agree case by case on the target family (cross-surface and global/exact-selection parity). */
export function laneParity(plan: StressPlan, lanes: ObservedLane[]) {
  const key = (lane: ObservedLane) => lane.cases.map(row => JSON.stringify(row.findings.filter(finding => finding.type === plan.findingType)
    .map(finding => [finding.start, finding.end, finding.action])));
  const reference = key(lanes[0]);
  const disagreements = lanes.slice(1).flatMap(lane => key(lane).flatMap((value, index) => value === reference[index] ? [] : [`${lane.lane}/${lane.selection}:${plan.cases[index].id}`]));
  return { lanes: lanes.map(lane => `${lane.lane}/${lane.selection}`), disagreements };
}

export function scoreSide(plan: StressPlan, lanes: ObservedLane[], binding: { sourceCommit: string; artifactSetCommitment: string }, oracle: PiiIdentityOracle) {
  const primary = lanes.filter(lane => lane.selection === 'pii-global-and-us');
  const identityOracle = evaluatePiiIdentityOracle({ plan: oraclePlan(plan), oracle, productSourceCommit: binding.sourceCommit,
    candidateArtifactCommitment: binding.artifactSetCommitment, artifactSetCommitment: binding.artifactSetCommitment,
    publicObservations: primary.map(lane => lane.cases.map(row => ({ id: row.id, publicFinding: row.findings.some(finding => finding.type === plan.findingType) }))) });
  return { family: plan.family, lanes: lanes.map(lane => scoreLane(plan, lane)), parity: laneParity(plan, lanes), identityOracle,
    identityOnly: { status: 'not-measured', reason: { ...PII_ORACLE_UNAVAILABLE_REASON } } };
}
