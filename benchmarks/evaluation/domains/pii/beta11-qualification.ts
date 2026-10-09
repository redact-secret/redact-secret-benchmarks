/**
 * Beta.11 PII E (benchmarks #428, core #901): protected-qualification eligibility and the six-family `pii-v1`
 * support disposition on the exact repaired core candidate.
 *
 * This module is the frozen evaluation schema of the #428 run. Its SHA-256 is recorded in
 * `evidence/901/428/pii-beta11-freeze-v1.json` together with the contracts, plans, revisions, activation identities,
 * candidate artifacts and protected-epoch commitments, all committed before any observation of the candidate.
 *
 * - Case tables. Every family is read from its #423 oracle qualification plan and from its #424/#425/#426
 *   population plan. The `frozen` table is the plans exactly as committed. The `reviewed` table applies two reviewed,
 *   pre-registered expectation sets: the #426 parenthesized-label corrections and the pii-context/v2 contract revisions
 *   (`pii-context-v2-expectation-revisions-v1.json`). Both tables are scored and reported; gates read `reviewed`.
 * - Outcomes are public-stream only: a finding of the family type, its UTF-8 range and action. Identity-only outcomes
 *   come from the maintainer-local core seam (redact-secret#910) and are admitted only through the shared #423
 *   validator, which also enforces source/artifact equivalence and fails closed.
 * - Credential findings are counted apart (`credentialFindingCases`) and never enter a PII numerator or denominator.
 * - Nothing here stores or emits an input, candidate value or sanitized text.
 */
import { hash } from '../../substrate/hash.ts';
import { proportion, type MechanicalAccountingConfig, type MechanicalPublished } from '../../../accounting/shared/primitives.ts';
import { PII_ORACLE_PLANS, evaluatePiiIdentityOracle, piiIdentityOracle, piiOraclePlanCommitment } from './identity-oracle.ts';
import { C1_POPULATION_PLANS, C1_POPULATION_PLANS_V2, type C1PopulationPlan } from './email-network-population.ts';
import { stressPlans, stressPlansV2 } from './card-iban-stress/stress.ts';
import { c3FilesV3, materializeC3Case, type C3File } from './ssn-phone-stress.ts';
import { B11_V2_PLAN_FILES } from './beta11-population-v2.ts';
import usSsnStress from './us-ssn-stress-v2.json';
import phoneStress from './phone-stress-v2.json';
import revisionData from './pii-context-v2-expectation-revisions-v1.json';
import { piiFixtureCorrections as c3CorrectionData } from './current-inputs.ts';
import piiV1Profile from '../../../../qualification/pii-v1.json';

export const B11_ISSUE = 'redact-secret/redact-secret-benchmarks#428';
export const B11_CANDIDATE = Object.freeze({
  repository: 'redact-secret/redact-secret', sourceCommit: '79c0a66119fb72931fda9adddbe2973a52bb4833',
  versionString: '0.1.0-beta.10', released: false, contextVocabulary: 'pii-context/v2',
});
export const B11_FAMILIES = ['pii:global:network-address', 'pii:global:email', 'pii:global:payment-card', 'pii:global:iban',
  'pii:us:ssn', 'pii:global:phone'] as const;
export type B11Family = typeof B11_FAMILIES[number];
export const B11_GLOBAL_FAMILIES = ['pii:global:email', 'pii:global:iban', 'pii:global:network-address', 'pii:global:payment-card',
  'pii:global:phone'] as const;
export const B11_POPULATION_PLAN_FILES: Readonly<Record<B11Family, string>> = Object.freeze({
  'pii:global:network-address': 'benchmarks/evaluation/domains/pii/network-address-population-plan-v1.json',
  'pii:global:email': 'benchmarks/evaluation/domains/pii/email-population-plan-v2.json',
  'pii:global:payment-card': 'benchmarks/evaluation/domains/pii/card-iban-stress/payment-card-stress-v1.json',
  'pii:global:iban': 'benchmarks/evaluation/domains/pii/card-iban-stress/iban-stress-v1.json',
  'pii:us:ssn': 'benchmarks/evaluation/domains/pii/us-ssn-stress-v2.json',
  'pii:global:phone': 'benchmarks/evaluation/domains/pii/phone-stress-v2.json',
});
/**
 * Population plan sets. `b11-population-v1` is the frozen #424/#425/#426 plans plus the two reviewed overlays (the
 * #426 corrections and the pii-context/v2 revisions); every record written before plan set v2 (a freeze without a
 * `populationPlanSet` field) re-scores under it. `b11-population-v2` is the #428 successor plans
 * (`beta11-population-v2.ts`): the overlays are native authored truth there, so no overlay is applied.
 */
export const B11_PLAN_SETS = Object.freeze({
  'b11-population-v1': { populationPlanFiles: B11_POPULATION_PLAN_FILES, reviewedOverlays: true, fileVersion: 'v1' },
  'b11-population-v2': { populationPlanFiles: B11_V2_PLAN_FILES as Readonly<Record<B11Family, string>>, reviewedOverlays: false, fileVersion: 'v2' },
});
export type B11PlanSet = keyof typeof B11_PLAN_SETS;
/** The plan set a new freeze binds. */
export const B11_CURRENT_PLAN_SET: B11PlanSet = 'b11-population-v2';
export const b11PlanSetOf = (freeze: { populationPlanSet?: string } | null | undefined): B11PlanSet => {
  const planSet = (freeze?.populationPlanSet ?? 'b11-population-v1') as B11PlanSet;
  if (!Object.hasOwn(B11_PLAN_SETS, planSet)) throw new Error(`unknown population plan set ${planSet}`);
  return planSet;
};
export const B11_POPULATION_OWNER: Readonly<Record<B11Family, string>> = Object.freeze({
  'pii:global:network-address': '#424', 'pii:global:email': '#424', 'pii:global:payment-card': '#425', 'pii:global:iban': '#425',
  'pii:us:ssn': '#426', 'pii:global:phone': '#426',
});
export const B11_POPULATION_VIEWS = ['diagnostic-balanced', 'benign-heavy-stress'] as const;

// ---------------------------------------------------------------------------------------------------------------
// Selections and the v2 activation identities frozen from the core documentation at the candidate
// (docs/guides/{javascript,python,cli}.md and the v1 plans' per-selector pattern with vocabulary=pii-context/v2).
// ---------------------------------------------------------------------------------------------------------------
export type B11Selection = 'union' | 'exact' | 'closure' | 'foreign' | 'off';
export const exactSelector = (family: string) => `pii:family:${family.slice('pii:'.length)}`;
export const closureSelector = (family: string) => family === 'pii:us:ssn' ? 'pii:us' : 'pii:global';
export function b11Selectors(family: string, selection: B11Selection): string[] | null {
  if (selection === 'union') return ['pii:global', 'pii:us'];
  if (selection === 'exact') return [exactSelector(family)];
  if (selection === 'closure') return [closureSelector(family)];
  if (selection === 'foreign') return family === 'pii:us:ssn' ? ['pii:global'] : null;
  return [];
}
export const B11_SELECTIONS = (family: string): B11Selection[] => family === 'pii:us:ssn' ?
  ['union', 'exact', 'closure', 'foreign', 'off'] : ['union', 'exact', 'closure', 'off'];
const identityString = (selectors: string, families: readonly string[]) =>
  `credentials=full;selectors=${selectors};families=${families.join(',')};vocabulary=pii-context/v2`;
/** Expected activation identity per selector (frozen). The two-selector union is checked structurally only. */
export const B11_EXPECTED_ACTIVATION: Readonly<Record<string, string>> = Object.freeze({
  'pii:global': identityString('pii:global', B11_GLOBAL_FAMILIES),
  'pii:us': identityString('pii:us', [...B11_GLOBAL_FAMILIES, 'pii:us:ssn']),
  off: identityString('off', []),
  ...Object.fromEntries(B11_FAMILIES.map(family => [exactSelector(family), identityString(exactSelector(family), [family])])),
});
/** Structural check for any selection: v2 vocabulary and exactly the families the selection closes over. */
export function expectedFamilies(family: string, selection: B11Selection): string[] {
  if (selection === 'union') return [...B11_GLOBAL_FAMILIES, 'pii:us:ssn'];
  if (selection === 'exact') return [family];
  if (selection === 'closure') return family === 'pii:us:ssn' ? [...B11_GLOBAL_FAMILIES, 'pii:us:ssn'] : [...B11_GLOBAL_FAMILIES];
  if (selection === 'foreign') return [...B11_GLOBAL_FAMILIES];
  return [];
}
export function activationProblem(family: string, selection: B11Selection, identity: string | null): string | null {
  if (typeof identity !== 'string') return 'no activation identity';
  if (!identity.startsWith('credentials=full;') || !identity.endsWith(';vocabulary=pii-context/v2')) return 'not a full-profile pii-context/v2 identity';
  const families = (/;families=([^;]*)/.exec(identity)?.[1] ?? '').split(',').filter(Boolean);
  if (JSON.stringify(families) !== JSON.stringify(expectedFamilies(family, selection))) return 'unexpected family closure';
  const selectors = b11Selectors(family, selection)!;
  const key = selectors.length === 0 ? 'off' : selectors.length === 1 ? selectors[0] : null;
  if (key && identity !== B11_EXPECTED_ACTIVATION[key]) return 'identity differs from the frozen v2 identity';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Case tables
// ---------------------------------------------------------------------------------------------------------------
export interface B11Range { start: number; end: number }
export interface B11Case {
  id: string; source: 'oracle-plan' | 'population-plan'; views: string[]; language: string; input: string;
  identity: string; sensitivity: string; candidate: B11Range | null; target: B11Range | null; expectedFinding: boolean;
  axis: string; twinOf: string | null; scored: boolean; lineSensitive: B11Range[]; revision: string | null;
}
const bytes = (value: string) => Buffer.byteLength(value, 'utf8');
const language = (input: string) => /[ᄀ-ᇿ㄰-㆏가-힯]/u.test(input) ? 'ko' : 'en';

function oracleCases(family: B11Family): B11Case[] {
  const plan = PII_ORACLE_PLANS[family] as unknown as { cases: Array<{ id: string; input: string; classes?: string[];
    expected: { publicFinding: boolean } }> };
  const labels = piiIdentityOracle.families.find(row => row.family === family)!.labels;
  return plan.cases.map((row, index) => ({ id: row.id, source: 'oracle-plan', views: ['oracle-plan'], language: language(row.input),
    input: row.input, identity: labels[index].identity, sensitivity: labels[index].sensitivity, candidate: labels[index].candidate,
    target: labels[index].candidate, expectedFinding: row.expected.publicFinding, axis: row.classes?.[0] ?? 'unclassified',
    twinOf: null, scored: true, lineSensitive: [], revision: null }));
}

function populationCases(family: B11Family, planSet: B11PlanSet): B11Case[] {
  const v2 = planSet === 'b11-population-v2';
  if (family === 'pii:global:email' || family === 'pii:global:network-address') {
    const plan: C1PopulationPlan = (v2 ? C1_POPULATION_PLANS_V2 : C1_POPULATION_PLANS)[family].plan;
    const labels = new Map(plan.oracle.labels.map(row => [row.caseId, row] as const));
    const strata = new Map(plan.strata.map(row => [row.id, row] as const));
    return plan.plan.cases.map(row => {
      const label = labels.get(row.id)!, stratum = strata.get(row.stratum)!;
      return { id: row.id, source: 'population-plan' as const, views: [...row.views], language: row.language, input: row.input,
        identity: label.identity, sensitivity: label.sensitivity, candidate: label.candidate, target: label.candidate,
        expectedFinding: row.expected.publicFinding, axis: stratum.benignAxis ?? stratum.id, twinOf: row.twinOf ?? null,
        scored: stratum.benignAxis !== 'contract-silent',
        lineSensitive: (row.lineCandidates ?? []).filter(other => other.sensitivity === 'sensitive').map(({ start, end }) => ({ start, end })),
        revision: null };
    });
  }
  if (family === 'pii:global:payment-card' || family === 'pii:global:iban') {
    return ((v2 ? stressPlansV2 : stressPlans)[family].cases as any[]).map(row => ({ id: row.id, source: 'population-plan' as const, views: [...row.views],
      language: row.language, input: row.input, identity: row.oracle.identity, sensitivity: row.oracle.sensitivity,
      candidate: row.oracle.candidate, target: row.oracle.candidate, expectedFinding: row.expected.publicFinding,
      axis: row.evidenceClass, twinOf: row.twinOf ?? null, scored: true, lineSensitive: [], revision: null }));
  }
  const file = (v2 ? c3FilesV3[family].file : family === 'pii:us:ssn' ? usSsnStress : phoneStress) as unknown as C3File;
  return file.cases.map(row => {
    const built = materializeC3Case(row);
    return { id: row.id, source: 'population-plan' as const, views: [row.view], language: row.language, input: built.input,
      identity: row.oracle.identity, sensitivity: row.oracle.sensitivity,
      candidate: row.oracle.identity === 'not-established' ? null : built.range, target: built.range,
      expectedFinding: row.expected.publicFinding, axis: (row as any).construction, twinOf: row.twinOf?.case ?? null, scored: true,
      lineSensitive: [], revision: null };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Reviewed expectation sets (pre-registered; validated mechanically against the input text, never detector output)
// ---------------------------------------------------------------------------------------------------------------
export interface B11Revision {
  family: string; planFile: string; caseId: string; issue: string; rule: string; sources: Array<{ file: string; sha256: string }>;
  contractText: string; labelForm: string;
  v1: { identity: string; sensitivity: string; candidate: B11Range | null; publicFinding: boolean };
  v2: { identity: string; sensitivity: string; candidate: B11Range; publicFinding: boolean; action: string };
}
export const b11Revisions = revisionData as unknown as { revisions: B11Revision[]; candidate: { sourceCommit: string } } & Record<string, unknown>;

const slice = (input: string, start: number, end: number) => Buffer.from(input, 'utf8').subarray(start, end).toString('utf8');
/** pii-context comparison view: NFC, ASCII case folded (v2 folds Korean-form ASCII too), separators → one space. */
const contextView = (text: string) => text.normalize('NFC').replace(/[A-Z]/g, char => char.toLowerCase()).replace(/[\s_\-:=]+/gu, ' ').trim();
/** The label form sits directly before the candidate, with only separators/quotes between (field-label grammar). */
function labelDirectlyBefore(input: string, range: B11Range, form: string) {
  const before = slice(input, 0, range.start).replace(/["'\s:=]+$/u, '');
  const view = contextView(before);
  return view === form || view.endsWith(` ${form}`) || (form.includes('_') && contextView(before).endsWith(contextView(form)));
}
const EMAIL_LABEL_KEYS = ['email', 'e-mail', 'customer_email', '이메일', '고객_이메일'];

/** Mechanical predicate per rule. Throws if an entry is not grounded in the case text as its rule states. */
export function validateB11Revision(entry: B11Revision, row: B11Case) {
  const { v1, v2 } = entry;
  if (row.identity !== v1.identity || row.sensitivity !== v1.sensitivity || JSON.stringify(row.candidate) !== JSON.stringify(v1.candidate) ||
      row.expectedFinding !== v1.publicFinding) throw new Error(`revision ${entry.caseId} does not start from the frozen label`);
  if (v2.identity !== 'valid' || v2.sensitivity !== 'sensitive' || !v2.publicFinding || v2.action !== 'redact')
    throw new Error(`revision ${entry.caseId} is not a valid/sensitive redact expectation`);
  const input = row.input, end = bytes(input);
  if (v2.candidate.start < 0 || v2.candidate.end > end || v2.candidate.start >= v2.candidate.end) throw new Error(`revision ${entry.caseId} range`);
  const after = slice(input, v2.candidate.end, end);
  if (entry.rule === 'email-reviewed-label-equals-split') {
    const key = slice(input, v1.candidate!.start, v2.candidate.start);
    const tokens = key.replace(/=$/, '').split(/[_\-]/);
    if (!key.endsWith('=') || v1.candidate!.end !== v2.candidate.end ||
        !EMAIL_LABEL_KEYS.some(label => key.slice(0, -1) === label || tokens.slice(-label.split(/[_\-]/).length).join('_') === label.replace(/-/g, '_')))
      throw new Error(`revision ${entry.caseId}: key is not a reviewed email label glued by =`);
    return;
  }
  if (!labelDirectlyBefore(input, v2.candidate, contextView(entry.labelForm)) &&
      !labelDirectlyBefore(input, v2.candidate, entry.labelForm))
    throw new Error(`revision ${entry.caseId}: ${entry.labelForm} is not directly before the candidate`);
  if (entry.rule === 'v2-added-field-label-form') {
    if (!['email address', 'e-mail address', '이메일 주소', '카드번호', '신용카드번호', '직불카드번호'].includes(entry.labelForm))
      throw new Error(`revision ${entry.caseId}: not a v2-added form`);
  } else if (entry.rule === 'v2-ascii-case-folding-in-korean') {
    const raw = slice(input, 0, v2.candidate.start);
    if (row.language !== 'ko' || !/[A-Z]/.test(raw) || raw.normalize('NFC').replace(/[\s_\-:=]+/gu, ' ').trim() === entry.labelForm)
      throw new Error(`revision ${entry.caseId}: no uppercase ASCII in the Korean label`);
  } else if (entry.rule === 'v2-forward-only-field-label-equidistance') {
    const line = slice(input, 0, v2.candidate.start).split('\n').pop()!;
    const earlier = line.split(/[\s,;]+/).slice(0, -1).filter(token => /@|\d{3,}|\d+\.\d+\.\d+/.test(token));
    if (!earlier.length) throw new Error(`revision ${entry.caseId}: no earlier same-line value`);
  } else if (entry.rule === 'network-trailing-period-right-boundary') {
    if (!/^\.(?:$|[\s"')\]}>])/u.test(after)) throw new Error(`revision ${entry.caseId}: no right-boundary period`);
  } else throw new Error(`revision ${entry.caseId}: unknown rule`);
}

interface C3CorrectionRow { family: string; caseId: string; reasonCode: string;
  frozen: { publicFinding: boolean; identity: string; sensitivity: string };
  corrected: { publicFinding: boolean; oracle: { identity: string; sensitivity: string } } }
export const b11C3Corrections = (c3CorrectionData as unknown as { corrections: C3CorrectionRow[] }).corrections;

/** Relabelled predecessor cases a plan-set-v2 plan records in its `derivedFrom` (native truth, not an overlay). */
function v2Relabels(family: B11Family): Map<string, string> {
  const file = B11_V2_PLAN_FILES[family];
  const plan = family === 'pii:global:email' || family === 'pii:global:network-address' ? C1_POPULATION_PLANS_V2[family].plan :
    family === 'pii:global:payment-card' || family === 'pii:global:iban' ? stressPlansV2[family] : c3FilesV3[family].file;
  const derived = (plan as { derivedFrom?: { relabeled: Array<{ caseId: string; basis: string }> } }).derivedFrom;
  if (!derived) throw new Error(`${file} has no derivation record`);
  return new Map(derived.relabeled.map(row => [row.caseId, row.basis] as const));
}

/**
 * The two case tables for one family. Plan set v1: `reviewed` = frozen + #426 corrections + v2 contract revisions.
 * Plan set v2: the plans already carry that truth, so `reviewed` equals `frozen`; a relabelled predecessor case
 * names its basis in `revision` on both tables.
 */
export function b11CaseTables(family: B11Family, planSet: B11PlanSet = 'b11-population-v1') {
  if (!B11_PLAN_SETS[planSet].reviewedOverlays) {
    const relabels = v2Relabels(family);
    const frozen = [...oracleCases(family), ...populationCases(family, planSet).map(row => ({ ...row, revision: relabels.get(row.id) ?? null }))];
    const reviewed = frozen.map(row => ({ ...row, views: [...row.views], lineSensitive: [...row.lineSensitive] }));
    return { frozen, reviewed };
  }
  const frozen = [...oracleCases(family), ...populationCases(family, planSet)];
  const reviewed = frozen.map(row => ({ ...row, views: [...row.views], lineSensitive: [...row.lineSensitive] }));
  for (const correction of b11C3Corrections.filter(row => row.family === family)) {
    const row = reviewed.find(item => item.source === 'population-plan' && item.id === correction.caseId);
    if (!row || row.expectedFinding !== correction.frozen.publicFinding || row.sensitivity !== correction.frozen.sensitivity)
      throw new Error(`#426 correction does not match its frozen case: ${correction.caseId}`);
    row.expectedFinding = correction.corrected.publicFinding; row.sensitivity = correction.corrected.oracle.sensitivity;
    row.identity = correction.corrected.oracle.identity; row.revision = `redact-secret/redact-secret-benchmarks#426:${correction.reasonCode}`;
  }
  for (const entry of b11Revisions.revisions.filter(row => row.family === family)) {
    const row = reviewed.find(item => item.source === 'population-plan' && item.id === entry.caseId);
    if (!row) throw new Error(`revision names an unknown case: ${entry.caseId}`);
    validateB11Revision(entry, frozen.find(item => item.source === 'population-plan' && item.id === entry.caseId)!);
    Object.assign(row, { identity: entry.v2.identity, sensitivity: entry.v2.sensitivity, candidate: entry.v2.candidate,
      target: entry.v2.candidate, expectedFinding: true, scored: true, revision: `${entry.issue}:${entry.rule}` });
  }
  return { frozen, reviewed };
}

/** Every distinct range the observation must report `inOutput` for: frozen and reviewed targets plus line spans. */
export function b11ObservedRanges(family: B11Family, planSet: B11PlanSet = 'b11-population-v1') {
  const { frozen, reviewed } = b11CaseTables(family, planSet);
  return frozen.map((row, index) => {
    const ranges = [row.target, reviewed[index].target, ...row.lineSensitive].filter((range): range is B11Range => range !== null);
    return [...new Map(ranges.map(range => [`${range.start}-${range.end}`, range])).values()].sort((a, b) => a.start - b.start || a.end - b.end);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Observation (written by scripts/measure-pii-beta11-candidate.mjs; ids, ranges, booleans and counts only)
// ---------------------------------------------------------------------------------------------------------------
export interface B11CaseObservation {
  id: string; family: Array<[number, number, string]>; otherPii: string[]; otherPiiAtTarget: boolean; credential: number;
  ranges: Array<[number, number, boolean]>; outsidePreserved: boolean; scanRedactAgree: boolean;
}
export interface B11Lane { lane: 'node-addon' | 'node-wasm'; selection: B11Selection; activationIdentity: string | null; artifact: string | null;
  cases: B11CaseObservation[] }

// ---------------------------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------------------------
export type B11Outcome = 'detected' | 'range-mismatch' | 'action-mismatch' | 'missed' | 'absent' | 'false-alarm' | 'unscored';
const overlaps = (a: B11Range, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
export function b11CaseOutcome(row: B11Case, seen: B11CaseObservation): { outcome: B11Outcome; wrongFamily: boolean; collateral: number } {
  const findings = seen.family.map(([start, end, action]) => ({ start, end, action }))
    .filter(finding => !row.lineSensitive.some(span => span.start === finding.start && span.end === finding.end));
  if (!row.scored) return { outcome: 'unscored', wrongFamily: false, collateral: 0 };
  if (row.sensitivity === 'sensitive') {
    const target = row.candidate!;
    const on = findings.filter(finding => overlaps(target, finding));
    const exactHit = on.filter(finding => finding.start === target.start && finding.end === target.end);
    const outcome: B11Outcome = on.length === 1 && exactHit.length === 1 ? exactHit[0].action === 'redact' ? 'detected' : 'action-mismatch' :
      on.length ? 'range-mismatch' : 'missed';
    return { outcome, wrongFamily: outcome === 'missed' && seen.otherPiiAtTarget, collateral: findings.length - on.length };
  }
  return { outcome: findings.length ? 'false-alarm' : 'absent', wrongFamily: false, collateral: findings.length };
}
const correct = (outcome: B11Outcome) => outcome === 'detected' || outcome === 'absent' || outcome === 'unscored';

export const B11_MECHANICS: MechanicalAccountingConfig = Object.freeze({
  minDenominator: piiV1Profile.mechanics.minDenominator, replays: piiV1Profile.mechanics.replays,
  intervalZ: piiV1Profile.mechanics.intervalZ, intervalPrecision: piiV1Profile.mechanics.intervalPrecision,
});
type MetricId = keyof typeof piiV1Profile.metrics;
function metric(id: MetricId, numerator: number, denominator: number) {
  const definition = piiV1Profile.metrics[id], direction = definition.direction as 'upper' | 'lower';
  const value: MechanicalPublished = proportion(numerator, denominator, direction, B11_MECHANICS);
  const status = value === null ? 'not-applicable' : typeof value === 'string' ? 'insufficient-denominator' :
    (direction === 'upper' ? value.bound! <= definition.threshold : value.bound! >= definition.threshold) ? 'met' : 'not-met';
  return { id, numerator, denominator, value, threshold: definition.threshold, direction, status };
}

/** Score one table on one lane. `foreign` is the SSN lane under a selection that does not activate SSN. */
export function b11ScoreTable(family: B11Family, table: B11Case[], lane: B11Lane, foreign: B11Lane | null) {
  if (JSON.stringify(lane.cases.map(row => row.id)) !== JSON.stringify(table.map(row => row.id))) throw new Error('lane is not one-to-one with the table');
  const results = table.map((row, index) => ({ row, seen: lane.cases[index], ...b11CaseOutcome(row, lane.cases[index]) }));
  const byId = new Map(results.filter(item => item.row.source === 'population-plan').map(item => [item.row.id, item] as const));
  const views = ['oracle-plan', 'qualification-plan', ...B11_POPULATION_VIEWS].map(view => {
    const members = results.filter(item => item.row.views.includes(view));
    const scored = members.filter(item => item.row.scored);
    const sens = scored.filter(item => item.row.sensitivity === 'sensitive');
    const nonSens = scored.filter(item => item.row.sensitivity === 'non-sensitive');
    const benign = scored.filter(item => item.row.sensitivity !== 'sensitive');
    const twins = scored.filter(item => item.row.source === 'population-plan' && item.row.twinOf && byId.has(item.row.twinOf) &&
      byId.get(item.row.twinOf)!.row.views.includes(view) &&
      (item.row.sensitivity === 'sensitive') !== (byId.get(item.row.twinOf)!.row.sensitivity === 'sensitive'));
    const familyFindings = scored.reduce((sum, item) => sum + item.seen.family.length, 0);
    const collateral = scored.reduce((sum, item) => sum + item.collateral, 0);
    const leaked = sens.filter(item => item.seen.ranges.some(([start, end, inOutput]) => start === item.row.candidate!.start &&
      end === item.row.candidate!.end && inOutput));
    const metrics = [
      metric('type-miss-rate', sens.filter(item => item.outcome === 'missed' && !item.wrongFamily).length, sens.length),
      metric('wrong-family-rate', sens.filter(item => item.wrongFamily).length, sens.length),
      metric('sensitive-miss-rate', sens.filter(item => item.outcome !== 'detected').length, sens.length),
      metric('non-sensitive-flag-rate', nonSens.filter(item => item.outcome === 'false-alarm').length, nonSens.length),
      metric('context-discrimination-rate', twins.filter(item => correct(item.outcome) && correct(byId.get(item.row.twinOf!)!.outcome)).length, twins.length),
      metric('benign-suppression-rate', benign.filter(item => item.outcome === 'absent').length, benign.length),
      metric('range-collateral-rate', collateral, familyFindings),
      metric('measurable-share', scored.length, members.length),
      ...(family === 'pii:us:ssn' && foreign ? (() => {
        const foreignById = new Map(foreign.cases.map(row => [row.id, row] as const));
        const flaggedForeign = (item: typeof members[number]) => (foreignById.get(item.row.id)?.family.length ?? 0) > 0;
        return [metric('wrong-jurisdiction-rate', sens.filter(flaggedForeign).length, sens.length),
          metric('jurisdiction-collision-rate', scored.filter(item => !flaggedForeign(item)).length, scored.length)];
      })() : []),
    ];
    const count = (list: typeof members, outcome: B11Outcome) => list.filter(item => item.outcome === outcome).length;
    return {
      view, cases: members.length, scoredCases: scored.length, unscoredCases: members.length - scored.length,
      authoredCells: Object.fromEntries([...new Set(scored.map(item => `${item.row.identity}/${item.row.sensitivity}`))].sort()
        .map(cell => [cell, scored.filter(item => `${item.row.identity}/${item.row.sensitivity}` === cell).length])),
      sensitive: { cases: sens.length, detected: count(sens, 'detected'), rangeMismatch: count(sens, 'range-mismatch'),
        actionMismatch: count(sens, 'action-mismatch'), missed: count(sens, 'missed'), leakedAfterRedaction: leaked.length },
      nonSensitive: { cases: nonSens.length, falseAlarm: count(nonSens, 'false-alarm') },
      notEstablished: { cases: benign.length - nonSens.length,
        falseAlarm: benign.filter(item => item.row.sensitivity === 'not-established' && item.outcome === 'false-alarm').length },
      benignAxes: [...new Set(benign.map(item => item.row.axis))].sort(),
      twinPairs: twins.length, collateralFindings: collateral,
      outsideModifiedCases: scored.filter(item => !item.seen.outsidePreserved).length,
      scanRedactDisagreements: members.filter(item => !item.seen.scanRedactAgree).length,
      credentialFindingCases: members.filter(item => item.seen.credential > 0).length,
      metrics,
    };
  });
  const deviations = results.filter(item => !correct(item.outcome)).map(item => ({ id: item.row.id, source: item.row.source,
    authored: `${item.row.identity}/${item.row.sensitivity}`, outcome: item.outcome, revision: item.row.revision }));
  return { views, deviations, outcomes: results.map(item => item.outcome) };
}

export const B11_MIN_BENIGN_CASES = piiV1Profile.gates.minBenignCases;
export const B11_MIN_BENIGN_AXES = piiV1Profile.gates.minBenignAxes;
export function b11ViewGate(view: ReturnType<typeof b11ScoreTable>['views'][number]) {
  const failing = view.metrics.filter(row => !['met', 'not-applicable'].includes(row.status)).map(row => `${row.id}:${row.status}`);
  if (view.nonSensitive.cases + view.notEstablished.cases < B11_MIN_BENIGN_CASES) failing.push(`benign-cases:${view.nonSensitive.cases + view.notEstablished.cases}<${B11_MIN_BENIGN_CASES}`);
  if (view.benignAxes.length < B11_MIN_BENIGN_AXES) failing.push(`benign-axes:${view.benignAxes.length}<${B11_MIN_BENIGN_AXES}`);
  if (view.sensitive.leakedAfterRedaction) failing.push(`leaked:${view.sensitive.leakedAfterRedaction}`);
  return { status: failing.length ? 'not-met' as const : 'met' as const, reasons: failing };
}

// ---------------------------------------------------------------------------------------------------------------
// Identity-only (core seam, redact-secret#910) with the named-negative reconciliation
// ---------------------------------------------------------------------------------------------------------------
/** Named occurrence exclusions per family contract (example/documentation labels; SSN negations). Pre-registered. */
export const B11_NAMED_NEGATIVE_FORMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'pii:global:email': ['example', 'documentation', '예시'], 'pii:global:payment-card': ['example', 'documentation', '예시'],
  'pii:global:iban': ['example', 'documentation', '예시'], 'pii:global:network-address': ['example', 'documentation', '예시'],
  'pii:global:phone': ['example', 'documentation', '예시'], 'pii:us:ssn': ['example', 'documentation', '예시', 'not ssn', '사회보장번호 아님'],
});
export function b11NamedNegative(family: string, input: string) {
  const view = ` ${contextView(input)} `;
  return B11_NAMED_NEGATIVE_FORMS[family].some(form => view.includes(` ${form} `));
}

export interface B11SeamRow { id: string; family: string; identity: 'established' | 'unmatched'; sensitivity: string }
export const b11EvidenceCommitment = (value: Record<string, unknown>) => {
  const { artifactCommitment: _ignored, ...rest } = value; return hash(JSON.stringify(canonical(rest)));
};
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
export const b11Commitment = (value: unknown) => hash(JSON.stringify(canonical(value)));

/**
 * Evaluate the seam for one family. The shared #423 validator binds the evidence to the candidate and enforces
 * source/artifact equivalence against the exact-family lanes (throws on any disagreement: fail closed). The
 * reconciled gate then compares a named-negative case identity-only: the oracle cannot label context-derived
 * non-sensitivity (`non-sensitive` requires an authority-reserved value), so a product `non-sensitive` there is read
 * as the family's named occurrence exclusion, and only its identity is compared. No label is changed.
 */
export function b11IdentityOnly(family: B11Family, input: { evidence: Record<string, unknown>; sourceCommit: string;
  candidateArtifactCommitment: string; artifactSetCommitment: string; exactLanes: B11Lane[] }) {
  const plan = PII_ORACLE_PLANS[family];
  const oracleRows = oracleCases(family);
  const publicObservations = input.exactLanes.map(lane => lane.cases.slice(0, oracleRows.length).map(row => ({ id: row.id, publicFinding: row.family.length > 0 })));
  const raw = evaluatePiiIdentityOracle({ plan, productSourceCommit: input.sourceCommit, candidateArtifactCommitment: input.candidateArtifactCommitment,
    artifactSetCommitment: input.artifactSetCommitment, publicObservations, productIdentity: input.evidence });
  const seam = (input.evidence as { observations: B11SeamRow[] }).observations;
  const found = publicObservations[0].map(row => row.publicFinding);
  const outcomes = oracleRows.flatMap((row, index) => {
    if (row.sensitivity === 'sensitive' || found[index]) return [];
    const seen = seam[index];
    if (row.identity === 'valid' && seen.identity !== 'established') return [{ id: row.id, outcome: 'identity-missed' }];
    if (row.identity !== 'valid' && seen.identity === 'established') return [{ id: row.id, outcome: 'identity-over-accepted' }];
    if (row.identity === 'valid' && seen.sensitivity !== row.sensitivity) {
      if (row.sensitivity === 'not-established' && seen.sensitivity === 'non-sensitive' && b11NamedNegative(family, row.input))
        return [{ id: row.id, outcome: 'identity-only-compared' }];
      return [{ id: row.id, outcome: 'sensitivity-mismatch' }];
    }
    return [{ id: row.id, outcome: 'correct' }];
  });
  const tally = Object.fromEntries(['correct', 'identity-only-compared', 'identity-missed', 'identity-over-accepted', 'sensitivity-mismatch']
    .map(outcome => [outcome, outcomes.filter(row => row.outcome === outcome).length]));
  const gate = outcomes.every(row => row.outcome === 'correct' || row.outcome === 'identity-only-compared') ? 'met' : 'not-met';
  return { rawProjection: raw, eligibleCases: outcomes.length, outcomes: tally,
    identityOnlyComparedCases: outcomes.filter(row => row.outcome === 'identity-only-compared').map(row => row.id),
    failingCases: outcomes.filter(row => !['correct', 'identity-only-compared'].includes(row.outcome)), gateStatus: gate as 'met' | 'not-met' };
}

export const b11PlanCommitments = (planSet: B11PlanSet = 'b11-population-v1') => Object.fromEntries(B11_FAMILIES.map(family => [family, {
  oraclePlan: piiOraclePlanCommitment(PII_ORACLE_PLANS[family]), populationPlanFile: B11_PLAN_SETS[planSet].populationPlanFiles[family] }]));
