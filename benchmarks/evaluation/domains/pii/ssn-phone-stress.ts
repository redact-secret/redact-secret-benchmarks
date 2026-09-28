import { createHash } from 'node:crypto';
import { hash } from '../../substrate/hash.ts';
import { PII_ORACLE_CONTEXT_VOCABULARY, piiOraclePlanCommitment, validatePiiOracleFamily, type PiiOracleFamily,
  type PiiOracleIdentity, type PiiOracleSensitivity } from './identity-oracle.ts';
import usSsnStress from './us-ssn-stress-v2.json';
import phoneStress from './phone-stress-v2.json';
import usSsnPlanV1 from './us-ssn-qualification-v1.json';
import phonePlanV1 from './phone-qualification-v1.json';

/**
 * Beta.11 PII C3 (benchmarks #426, core #901): independently authored US SSN and phone stress plans.
 *
 * Each family file is a frozen plan: cases are authored as `prefix + candidate + suffix`, where the candidate is
 * either a deterministic synthetic construction (seeded SHA-256, no person, registry or assignment provenance) or
 * an authority-published control. Every case carries its #423 oracle label and belongs to exactly one view:
 * `qualification-plan`, `diagnostic-balanced` or `benign-heavy-stress`. The two population views declare their
 * denominators and base-rate masses (with non-zero sensitive mass). `frozen.planCommitment` is the SHA-256 of the
 * materialized plan: it is fixed before any scan, so a changed case is a changed plan, never a re-labelled result.
 */

export const C3_VIEWS = ['qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'] as const;
export const C3_POPULATION_VIEWS = ['diagnostic-balanced', 'benign-heavy-stress'] as const;
export const C3_LANGUAGES = ['en', 'ko'] as const;
export const C3_TWIN_PROPERTIES = ['context', 'candidate', 'display', 'boundary', 'extension'] as const;
/** Upper bound on the share of identity-bearing cases that may reuse one normalized candidate. */
export const C3_MAX_DOMINANT_SHARE = 0.15;
export const C3_BACKLOG = Object.freeze({ 'pii:us:ssn': [23, 24, 25, 26, 27, 28], 'pii:global:phone': [29, 30, 31, 32, 33] } as Record<string, number[]>);

type View = typeof C3_VIEWS[number];
type Sensitivity = PiiOracleSensitivity;
type CandidateSpec =
  | { generator: 'us-ssn-sha256-v1'; seed: string; display: 'compact' | 'display' | 'unicode-dash' | 'spaced'; set?: Partial<Record<'area' | 'group' | 'serial', string>> }
  | { generator: 'nanp-n9x-sha256-v1'; seed: string; display: 'dash' | 'space' | 'compact' | 'paren' | 'plus-compact' | 'plus-space' | 'plus-dash' | 'dot';
      set?: Partial<Record<'npa' | 'nxx' | 'line', string>>; extension?: string }
  | { literal: string; authority: string };
export interface C3Case {
  id: string; axis: number; view: View; language: 'en' | 'ko'; construction: string;
  prefix: string; candidate: CandidateSpec; suffix: string;
  twinOf: { case: string; property: typeof C3_TWIN_PROPERTIES[number] } | null;
  expected: { publicFinding: boolean };
  oracle: { identity: PiiOracleIdentity; identityBasis: string[]; sensitivity: Sensitivity; sensitivityBasis: string[] };
}
export interface C3Population {
  id: typeof C3_POPULATION_VIEWS[number]; caseCount: number;
  baseRate: { kind: 'declared-assumption'; totalMass: number; sensitiveMass: number; nonSensitiveMass: number; notEstablishedMass: number; rationale: string };
}
export interface C3File {
  schemaVersion: 1; id: string; issue: 426; family: string; findingType: string; familyContractVersion: number;
  contextVocabulary: string; contract: { repository: string; commit: string; file: string };
  referenceValidator: { id: string; version: number } | null;
  constructionPolicy: Record<string, string>; nonGoals: string[];
  populations: C3Population[]; cases: C3Case[]; frozen: { planCommitment: string };
}

// -----------------------------------------------------------------------------------------------------------
// Deterministic synthetic constructions. They are derived from a seed only; nothing is looked up.
// -----------------------------------------------------------------------------------------------------------
const words = (seed: string) => { const digest = createHash('sha256').update(seed).digest(); return [0, 4, 8, 12, 16].map(offset => digest.readUInt32BE(offset)); };
const pad = (value: number, width: number) => String(value).padStart(width, '0');

/** SSA-structurally-valid components: area 001–899 without 666, group 01–99, serial 0001–9999. */
export function syntheticUsSsnParts(seed: string) {
  const [a, g, s] = words(seed);
  let area = 1 + (a % 899); if (area === 666) area = 667;
  return { area: pad(area, 3), group: pad(1 + (g % 99), 2), serial: pad(1 + (s % 9999), 4) };
}
/**
 * NANP components under an `N9X` area code. NANPA reserves every N9X NPA for future numbering-plan expansion,
 * so no subscriber holds a number there. The central-office code is `NXX` without N11 and without 555.
 */
export function syntheticNanpParts(seed: string) {
  const [a, b, c, d] = words(seed);
  const npa = `${2 + (a % 8)}9${(a >>> 8) % 10}`;
  let nxx = `${2 + (b % 8)}${pad((b >>> 8) % 100, 2)}`;
  if (nxx.slice(1) === '11') nxx = `${nxx[0]}12`;
  if (nxx === '555') nxx = '556';
  return { npa, nxx, line: pad(c % 10000, 4), spare: d };
}

export function materializeCandidate(spec: CandidateSpec) {
  if ('literal' in spec) return spec.literal;
  if (spec.generator === 'us-ssn-sha256-v1') {
    const parts = { ...syntheticUsSsnParts(spec.seed), ...(spec.set ?? {}) };
    const joiner = { compact: '', display: '-', 'unicode-dash': '‐', spaced: ' ' }[spec.display];
    if (joiner === undefined) throw new Error('Unknown SSN display');
    return [parts.area, parts.group, parts.serial].join(joiner);
  }
  if (spec.generator === 'nanp-n9x-sha256-v1') {
    const { npa, nxx, line } = { ...syntheticNanpParts(spec.seed), ...(spec.set ?? {}) };
    const display = { dash: `${npa}-${nxx}-${line}`, space: `${npa} ${nxx} ${line}`, compact: `${npa}${nxx}${line}`,
      paren: `(${npa}) ${nxx}-${line}`, 'plus-compact': `+1${npa}${nxx}${line}`, 'plus-space': `+1 ${npa} ${nxx} ${line}`,
      'plus-dash': `+1-${npa}-${nxx}-${line}`, dot: `${npa}.${nxx}.${line}` }[spec.display];
    if (display === undefined) throw new Error('Unknown NANP display');
    return spec.extension ? `${display} ${spec.extension}` : display;
  }
  throw new Error('Unknown candidate construction');
}

const byteLength = (value: string) => Buffer.byteLength(value, 'utf8');
/** Materialize one case: its input, the authored candidate's UTF-8 byte range and its text. */
export function materializeC3Case(row: C3Case) {
  const candidate = materializeCandidate(row.candidate);
  const start = byteLength(row.prefix), end = start + byteLength(candidate);
  return { id: row.id, input: `${row.prefix}${candidate}${row.suffix}`, candidate, range: { start, end } };
}

/** The plan the oracle binds to: the same shape as a `pii-v1` qualification plan's cases. */
export function materializeC3Plan(file: C3File) {
  const cases = file.cases.map(row => {
    const built = materializeC3Case(row);
    return { id: row.id, input: built.input, expected: row.expected.publicFinding ?
      { publicFinding: true, start: built.range.start, end: built.range.end, sensitive: true } :
      { publicFinding: false, sensitive: false } };
  });
  return { schemaVersion: 1, id: file.id, family: file.family, findingType: file.findingType, familyContractVersion: file.familyContractVersion, cases };
}
export const c3PlanCommitment = (file: C3File) => piiOraclePlanCommitment(materializeC3Plan(file));

export function c3OracleFamily(file: C3File, planPath: string): PiiOracleFamily {
  return { family: file.family, findingType: file.findingType, familyContractVersion: file.familyContractVersion, plan: planPath,
    planCommitment: file.frozen.planCommitment, referenceValidator: file.referenceValidator,
    labels: file.cases.map(row => ({ caseId: row.id, candidate: row.oracle.identity === 'not-established' ? null : materializeC3Case(row).range,
      identity: row.oracle.identity, identityBasis: row.oracle.identityBasis, sensitivity: row.oracle.sensitivity, sensitivityBasis: row.oracle.sensitivityBasis })) };
}

// -----------------------------------------------------------------------------------------------------------
// Validation: structure, frozen plan, oracle labels, populations, twins, axis coverage and independence.
// -----------------------------------------------------------------------------------------------------------
const normalized = (value: string) => value.replace(/\D/g, '');
const V1_PLANS = { 'pii:us:ssn': usSsnPlanV1, 'pii:global:phone': phonePlanV1 } as Record<string, { cases: Array<{ input: string }> }>;
/** The candidate's number without an extension or `+1`, as its last nine digits (the v1 reuse key). */
const coreDigits = (candidate: string) => normalized(candidate.split(/ (?:ext|extension|x)\b/)[0]).slice(-9);
const digitRuns = (text: string) => (text.match(/\d[\d\- ().]*\d/g) ?? []).map(normalized).filter(value => value.length >= 7);

export function c3Independence(file: C3File) {
  const rows = file.cases.map(row => ({ row, built: materializeC3Case(row) }));
  const bearing = rows.filter(({ row }) => row.oracle.identity !== 'not-established' || !('literal' in row.candidate));
  // A construction is its seed plus any authored component override (or the literal control itself).
  const construction = (spec: CandidateSpec) => 'literal' in spec ? spec.literal : JSON.stringify([spec.seed, spec.set ?? {}]);
  const counts = new Map<string, number>();
  for (const { row } of bearing) { const key = construction(row.candidate); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const sensitive = rows.filter(({ row }) => row.oracle.sensitivity === 'sensitive');
  const v1Values = new Set((V1_PLANS[file.family]?.cases ?? []).flatMap(row => digitRuns(row.input)).map(value => value.slice(-9)));
  const labels = new Set(rows.map(({ row }) => row.prefix.replace(/[\s:="'_-]+/g, ' ').trim().toLowerCase()).filter(Boolean));
  const perView = Object.fromEntries(C3_VIEWS.map(view => {
    const members = rows.filter(({ row }) => row.view === view);
    const sensitiveMembers = members.filter(({ row }) => row.oracle.sensitivity === 'sensitive');
    return [view, { cases: members.length, sensitiveCases: sensitiveMembers.length,
      distinctSensitiveCandidates: new Set(sensitiveMembers.map(({ built }) => normalized(built.candidate))).size,
      languages: Object.fromEntries(C3_LANGUAGES.map(language => [language, members.filter(({ row }) => row.language === language).length])),
      twins: members.filter(({ row }) => row.twinOf).length }];
  }));
  return {
    cases: rows.length, identityBearingCases: bearing.length, sensitiveCases: sensitive.length,
    distinctCandidates: counts.size, distinctSensitiveCandidates: new Set(sensitive.map(({ built }) => normalized(built.candidate))).size,
    dominantCandidateShare: Math.max(...counts.values()) / bearing.length,
    distinctContextLabels: labels.size,
    constructions: new Set(file.cases.map(row => row.construction)).size,
    declaredTwins: file.cases.filter(row => row.twinOf).length,
    v1CandidateReuse: rows.filter(({ row, built }) => !('literal' in row.candidate) && v1Values.has(coreDigits(built.candidate))).length,
    perView,
  };
}

const exactKeys = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export function validateC3File(file: C3File, backlog: Array<{ order: number; family: string; owner: string; views: string[]; languages: string[] }>, planPath: string) {
  if (!exactKeys(file, ['schemaVersion', 'id', 'issue', 'family', 'findingType', 'familyContractVersion', 'contextVocabulary', 'contract',
    'referenceValidator', 'constructionPolicy', 'nonGoals', 'populations', 'cases', 'frozen']) || file.schemaVersion !== 1 || file.issue !== 426 ||
      !C3_BACKLOG[file.family] || file.contextVocabulary !== PII_ORACLE_CONTEXT_VOCABULARY || !/^[a-f0-9]{40}$/.test(file.contract?.commit ?? ''))
    throw new Error('Invalid #426 stress plan');
  const ids = new Set<string>();
  for (const row of file.cases) {
    if (!exactKeys(row, ['id', 'axis', 'view', 'language', 'construction', 'prefix', 'candidate', 'suffix', 'twinOf', 'expected', 'oracle']) ||
        !/^[a-z0-9][a-z0-9-]{1,79}$/.test(row.id) || ids.has(row.id) || !C3_BACKLOG[file.family].includes(row.axis) ||
        !(C3_VIEWS as readonly string[]).includes(row.view) || !(C3_LANGUAGES as readonly string[]).includes(row.language) ||
        typeof row.prefix !== 'string' || typeof row.suffix !== 'string' || !/^[a-z0-9-]+$/.test(row.construction) ||
        !exactKeys(row.expected, ['publicFinding']) || typeof row.expected.publicFinding !== 'boolean')
      throw new Error(`Invalid #426 stress case: ${row.id}`);
    if ('literal' in row.candidate && (typeof row.candidate.authority !== 'string' || !row.candidate.authority))
      throw new Error(`A literal candidate names its authority: ${row.id}`);
    ids.add(row.id);
  }
  // Frozen expectations: the materialized plan must be the one committed before scanning.
  if (c3PlanCommitment(file) !== file.frozen.planCommitment) throw new Error('The #426 stress plan changed after it was frozen');
  const plan = materializeC3Plan(file);
  validatePiiOracleFamily(c3OracleFamily(file, planPath), plan);
  // One-property twins: the base exists in the same view and only the declared property changes.
  for (const row of file.cases.filter(item => item.twinOf)) {
    const base = file.cases.find(item => item.id === row.twinOf!.case);
    if (!base || base.id === row.id || base.view !== row.view || !(C3_TWIN_PROPERTIES as readonly string[]).includes(row.twinOf!.property))
      throw new Error(`Invalid twin: ${row.id}`);
    const sameContext = base.prefix === row.prefix && base.suffix === row.suffix;
    const same = JSON.stringify(base.candidate) === JSON.stringify(row.candidate);
    const property = row.twinOf!.property;
    const ok = property === 'context' ? same && !sameContext : property === 'boundary' ? same && !sameContext :
      property === 'candidate' ? sameContext && !same && 'seed' in base.candidate && 'seed' in row.candidate && base.candidate.seed === row.candidate.seed &&
        (base.candidate as any).display === (row.candidate as any).display && (base.candidate as any).extension === (row.candidate as any).extension :
      property === 'display' ? sameContext && 'seed' in base.candidate && 'seed' in row.candidate && base.candidate.seed === row.candidate.seed &&
        (base.candidate as any).display !== (row.candidate as any).display && JSON.stringify((base.candidate as any).set ?? {}) === JSON.stringify((row.candidate as any).set ?? {}) :
      property === 'extension' ? sameContext && 'seed' in base.candidate && 'seed' in row.candidate && base.candidate.seed === row.candidate.seed &&
        (base.candidate as any).display === (row.candidate as any).display && (base.candidate as any).extension !== (row.candidate as any).extension : false;
    if (!ok) throw new Error(`Twin differs in more than its declared property: ${row.id}`);
  }
  // Populations: explicit denominators, declared masses that add up, non-zero sensitive mass, no empty stratum.
  if (JSON.stringify(file.populations.map(row => row.id)) !== JSON.stringify(C3_POPULATION_VIEWS)) throw new Error('Invalid #426 populations');
  for (const population of file.populations) {
    const members = file.cases.filter(row => row.view === population.id);
    const rate = population.baseRate;
    if (population.caseCount !== members.length || rate.kind !== 'declared-assumption' || rate.sensitiveMass <= 0 ||
        rate.totalMass !== rate.sensitiveMass + rate.nonSensitiveMass + rate.notEstablishedMass || typeof rate.rationale !== 'string')
      throw new Error(`Invalid #426 population denominator: ${population.id}`);
    for (const [sensitivity, mass] of [['sensitive', rate.sensitiveMass], ['non-sensitive', rate.nonSensitiveMass], ['not-established', rate.notEstablishedMass]] as const) {
      const count = members.filter(row => row.oracle.sensitivity === sensitivity).length;
      if ((mass > 0) !== (count > 0)) throw new Error(`Population stratum and members disagree: ${population.id}/${sensitivity}`);
    }
  }
  // Frozen axis backlog: every view x language each #426 item names has at least one case.
  const items = backlog.filter(item => item.owner === '#426' && item.family === file.family);
  if (JSON.stringify(items.map(item => item.order)) !== JSON.stringify(C3_BACKLOG[file.family])) throw new Error('Backlog items do not match');
  for (const item of items) for (const view of item.views) for (const language of item.languages)
    if (!file.cases.some(row => row.axis === item.order && row.view === view && row.language === language))
      throw new Error(`Backlog item ${item.order} lacks ${view}/${language}`);
  const independence = c3Independence(file);
  if (independence.dominantCandidateShare > C3_MAX_DOMINANT_SHARE || independence.v1CandidateReuse !== 0)
    throw new Error('The #426 stress plan is not independent of one dominant or reused candidate');
  return { plan, independence };
}

export const c3Files = Object.freeze({
  'pii:us:ssn': { file: usSsnStress as unknown as C3File, path: 'benchmarks/evaluation/domains/pii/us-ssn-stress-v2.json' },
  'pii:global:phone': { file: phoneStress as unknown as C3File, path: 'benchmarks/evaluation/domains/pii/phone-stress-v2.json' },
});

// -----------------------------------------------------------------------------------------------------------
// Accounting over installed observations. Counts only: no case value, range or finding text leaves this function.
// -----------------------------------------------------------------------------------------------------------
export interface C3Observation {
  id: string; familyFindings: Array<{ start: number; end: number; action: string }>; exactRange: boolean;
  outputContainsCandidate: boolean; findingCarriesPlaintext: boolean;
  overlapTypes: string[]; scanNanoseconds: number;
}
export function summarizeC3Surface(file: C3File, observations: C3Observation[]) {
  if (JSON.stringify(observations.map(row => row.id)) !== JSON.stringify(file.cases.map(row => row.id))) throw new Error('Observations are not 1:1 with cases');
  const views = Object.fromEntries(C3_VIEWS.map(view => {
    const members = file.cases.map((row, index) => ({ row, seen: observations[index] })).filter(({ row }) => row.view === view);
    const tally = { detected: 0, missed: 0, rangeMismatch: 0, absent: 0, falseAlarm: 0 };
    const cells: Record<string, number> = {};
    const bySensitivity: Record<string, { cases: number; flagged: number }> = {};
    for (const { row, seen } of members) {
      const flagged = seen.familyFindings.length > 0;
      const cell = `${row.oracle.identity}/${row.oracle.sensitivity}`; cells[cell] = (cells[cell] ?? 0) + 1;
      const stratum = bySensitivity[row.oracle.sensitivity] ??= { cases: 0, flagged: 0 };
      stratum.cases += 1;
      if (row.oracle.sensitivity === 'sensitive') {
        if (flagged && seen.exactRange && seen.familyFindings.length === 1) { tally.detected += 1; stratum.flagged += 1; }
        else if (flagged) { tally.rangeMismatch += 1; stratum.flagged += 1; }
        else tally.missed += 1;
      } else if (flagged) { tally.falseAlarm += 1; stratum.flagged += 1; } else tally.absent += 1;
    }
    const population = file.populations.find(row => row.id === view);
    let weighted = null;
    if (population) {
      const rate = population.baseRate, mass = { sensitive: rate.sensitiveMass, 'non-sensitive': rate.nonSensitiveMass, 'not-established': rate.notEstablishedMass };
      const benignMass = mass['non-sensitive'] + mass['not-established'];
      const falseAlarm = (['non-sensitive', 'not-established'] as const).reduce((sum, key) =>
        sum + (bySensitivity[key] ? mass[key] * bySensitivity[key].flagged / bySensitivity[key].cases : 0), 0);
      const sensitive = bySensitivity.sensitive;
      weighted = { declaredMass: mass, falseAlarmRate: benignMass ? falseAlarm / benignMass : null,
        sensitiveMissRate: sensitive ? (sensitive.cases - members.filter(({ row, seen }) => row.oracle.sensitivity === 'sensitive' &&
          seen.familyFindings.length === 1 && seen.exactRange).length) / sensitive.cases : null };
    }
    return [view, { cases: members.length, authoredCells: cells, publicStream: tally, weighted }];
  }));
  const actions: Record<string, number> = {};
  for (const seen of observations) for (const finding of seen.familyFindings) actions[finding.action] = (actions[finding.action] ?? 0) + 1;
  const overlap: Record<string, number> = {};
  for (const seen of observations) for (const type of seen.overlapTypes) overlap[type] = (overlap[type] ?? 0) + 1;
  const sensitiveIndexes = file.cases.map((row, index) => row.oracle.sensitivity === 'sensitive' ? index : -1).filter(index => index >= 0);
  const times = observations.map(row => row.scanNanoseconds).sort((a, b) => a - b);
  const quantile = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  return {
    views, actionSplit: actions,
    outputLeakage: { sensitiveCases: sensitiveIndexes.length,
      sensitiveOutputsContainingCandidate: sensitiveIndexes.filter(index => observations[index].outputContainsCandidate).length,
      flaggedOutputsContainingCandidate: observations.filter(row => row.familyFindings.length && row.outputContainsCandidate).length,
      findingsCarryingPlaintext: observations.filter(row => row.findingCarriesPlaintext).length },
    crossFamilyOverlap: overlap,
    scanCost: { unit: 'nanoseconds-per-case-scan', cases: times.length, median: quantile(0.5), p95: quantile(0.95), max: times[times.length - 1] },
  };
}

export const c3Commitment = (value: unknown) => hash(JSON.stringify(value));

// -----------------------------------------------------------------------------------------------------------
// Reviewed expectation corrections. A frozen plan is never edited after a scan; a reviewed contract reading that
// contradicts an authored expectation is recorded separately, and accounting is reported both as measured
// against the frozen plan and after the correction. A correction is a corpus fix, never a product defect.
// -----------------------------------------------------------------------------------------------------------
export interface C3Correction {
  family: string; caseId: string; reasonCode: string; contractBasis: string;
  frozen: { publicFinding: boolean; identity: PiiOracleIdentity; sensitivity: Sensitivity };
  corrected: { publicFinding: boolean; oracle: C3Case['oracle'] };
}
export function applyC3Corrections(file: C3File, corrections: C3Correction[], deviatingCaseIds: readonly string[]) {
  const corrected = structuredClone(file);
  for (const correction of corrections.filter(row => row.family === file.family)) {
    const row = corrected.cases.find(item => item.id === correction.caseId);
    if (!row || !exactKeys(correction, ['family', 'caseId', 'reasonCode', 'contractBasis', 'frozen', 'corrected']) ||
        !/^[a-z][a-z0-9-]+$/.test(correction.reasonCode) || typeof correction.contractBasis !== 'string' || !correction.contractBasis)
      throw new Error(`Invalid #426 correction: ${correction.caseId}`);
    if (row.expected.publicFinding !== correction.frozen.publicFinding || row.oracle.identity !== correction.frozen.identity ||
        row.oracle.sensitivity !== correction.frozen.sensitivity) throw new Error(`Correction does not start from the frozen label: ${row.id}`);
    // Only a case the scan contradicted is corrected; a correction may not pre-empt an unobserved disagreement.
    if (!deviatingCaseIds.includes(row.id)) throw new Error(`Correction targets a case the scan did not contradict: ${row.id}`);
    row.expected = { publicFinding: correction.corrected.publicFinding };
    row.oracle = correction.corrected.oracle;
  }
  const plan = materializeC3Plan(corrected);
  validatePiiOracleFamily({ ...c3OracleFamily(corrected, 'corrected'), planCommitment: piiOraclePlanCommitment(plan) }, plan);
  return corrected;
}
