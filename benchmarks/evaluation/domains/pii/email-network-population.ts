import { hash } from '../../substrate/hash.ts';
import { proportion, type MechanicalAccountingConfig, type MechanicalPublished } from '../../../accounting/shared/primitives.ts';
import { PII_ORACLE_UNAVAILABLE_REASON, piiOraclePlanCommitment, validatePiiOracleFamily, type PiiOracleFamily,
  type PiiOracleLabel } from './identity-oracle.ts';
import emailPopulationPlanV1 from './email-population-plan-v1.json';
import emailPopulationPlan from './email-population-plan-v2.json';
import networkAddressPopulationPlan from './network-address-population-plan-v1.json';
import gapLedger from '../../../../evidence/901/pii-gap-ledger-v1.json';
import piiV1Profile from '../../../../qualification/pii-v1.json';

/**
 * Beta.11 PII C1 population evidence for the email and network-address families (benchmarks #424, core #901).
 *
 * Each family has one frozen, versioned population plan. A plan carries:
 *
 * - independently authored cases with one axis from the frozen #422 ledger backlog, a stratum, the views it belongs to,
 *   a context language, a source and tier, and optional one-property twin declarations;
 * - the #423 identity/sensitivity oracle label for every case, bound to the plan commitment and validated by the
 *   #423 oracle rules (the plan's `publicFinding`/`sensitive` expectations must agree with it);
 * - declared diagnostic-balanced and benign-heavy-stress base-rate mass per stratum. The mass is an assumption,
 *   never a prevalence claim, and is never renormalized.
 *
 * Expectations come from the frozen family contracts (core `docs/contracts/pii/email-v1.md` and
 * `docs/audits/evidence/875/README.md`) and the reviewed `pii-context/v1` vocabulary. A contract-derived reference of
 * that association grammar re-derives every identity-valid sensitivity label mechanically, so an authoring slip fails
 * validation instead of being "corrected" by detector output. Detector output is never read here except as an
 * observation to be scored against the frozen labels.
 */

export const C1_FAMILIES = ['pii:global:email', 'pii:global:network-address'] as const;
export type C1Family = typeof C1_FAMILIES[number];
export const C1_VIEWS = ['qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'] as const;
export const C1_POPULATION_VIEWS = ['diagnostic-balanced', 'benign-heavy-stress'] as const;
export type C1PopulationView = typeof C1_POPULATION_VIEWS[number];
export const C1_SOURCES = ['independent-synthetic', 'authority-reserved', 'synthetic-public-role', 'synthetic-operational'] as const;
export const C1_TIERS = ['public-development'] as const;
/** Closed vocabulary of the single property a declared twin changes. */
export const C1_TWIN_PROPERTIES = ['context-label', 'context-negative', 'context-language', 'letter-case', 'reserved-domain',
  'reserved-range', 'address-scope', 'delimiter', 'boundary-character', 'normalization-form', 'length-bound', 'url-wrapping',
  'version-prefix', 'spelling', 'bracket', 'candidate-adjacency', 'domain-script'] as const;
/** Benign axes reported separately. `null` marks a sensitive (positive) stratum. */
export const C1_BENIGN_AXES = ['reserved-documentation', 'context-negative', 'public-identifier', 'operational', 'collision',
  'unsupported-syntax', 'contract-silent'] as const;
export const C1_SEMANTIC_ROLES = ['synthetic-personal', 'public-role', 'operational-endpoint', 'public-infrastructure', 'reserved',
  'collision', 'malformed'] as const;
export const C1_ISSUE = 'redact-secret/redact-secret-benchmarks#424';
export const C1_CONTEXT_VOCABULARY = 'pii-context/v1';
const LEDGER_FILE = 'evidence/901/pii-gap-ledger-v1.json';
const DOMAIN: Record<C1Family, 'email' | 'network-address'> = { 'pii:global:email': 'email', 'pii:global:network-address': 'network-address' };

type Sensitivity = 'sensitive' | 'non-sensitive' | 'not-established';
type Identity = 'valid' | 'invalid' | 'not-established';
export interface C1LineCandidate { start: number; end: number; domain: 'email' | 'network-address'; sensitivity: Sensitivity }
export interface C1Case {
  id: string; axis: string; stratum: string; views: string[]; language: 'en' | 'ko'; source: string; tier: string;
  semanticRole: string; twinOf?: string; twinProperty?: string; lineCandidates?: C1LineCandidate[]; input: string;
  expected: { publicFinding: boolean; sensitive: boolean; start?: number; end?: number; action: 'redact' | 'none' };
}
export interface C1Stratum { id: string; axis: string; identity: Identity; sensitivity: Sensitivity; benignAxis: string | null; views: string[] }
export interface C1MassRow { stratum: string; mass: number; sensitiveMass: number; nonSensitiveMass: number; notEstablishedMass: number }
export interface C1Population { id: C1PopulationView; role: string; denominatorUnit: string; totalMass: number; rationale: string[]; strata: C1MassRow[] }
export interface C1PopulationPlan {
  schemaVersion: 1; reportType: 'pii-family-population-plan'; id: string; supportClaims: false; issue: string; productIssue: string;
  family: C1Family; findingType: string; familyContractVersion: 1; contextVocabulary: string;
  familyContract: { repository: string; commit: string; document: string; sha256: string; contextContractSha256: string };
  ledger: { file: string; contentCommitment: string; axes: string[] };
  fixturePolicy: Record<string, string>;
  strata: C1Stratum[];
  plan: { family: C1Family; findingType: string; familyContractVersion: 1; canonicalOffsetUnit: 'utf8-byte'; cases: C1Case[] };
  oracle: PiiOracleFamily;
  populations: C1Population[];
  supersedes?: { id: string; file: string; fileSha256: string; planCommitment: string; reason: string; contractRule: string; detectedBy: string;
    firstRun: { benchmarkRevision: string; runId: string; reportCommitment: string };
    corrections: Array<{ v1CaseId: string; v1Label: string; v2CaseId: string; v2Label: string; twinAdded?: string; rangeCorrected?: boolean }> };
}

export const C1_POPULATION_PLANS: Readonly<Record<C1Family, { file: string; plan: C1PopulationPlan }>> = Object.freeze({
  'pii:global:email': { file: 'benchmarks/evaluation/domains/pii/email-population-plan-v2.json', plan: emailPopulationPlan as unknown as C1PopulationPlan },
  'pii:global:network-address': { file: 'benchmarks/evaluation/domains/pii/network-address-population-plan-v1.json',
    plan: networkAddressPopulationPlan as unknown as C1PopulationPlan },
});

/**
 * Frozen plans superseded by a contract-cited correction. They stay committed and are never edited: the successor
 * records their file digest and plan commitment, and they fail the corrected validator for the recorded reason.
 */
export const C1_SUPERSEDED_PLANS: ReadonlyArray<{ file: string; plan: C1PopulationPlan; supersededBy: string }> = Object.freeze([
  { file: 'benchmarks/evaluation/domains/pii/email-population-plan-v1.json', plan: emailPopulationPlanV1 as unknown as C1PopulationPlan,
    supersededBy: 'benchmarks/evaluation/domains/pii/email-population-plan-v2.json' },
]);

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
export const c1Commitment = (value: unknown) => hash(JSON.stringify(canonical(value)));
export const c1PlanFileCommitment = (plan: C1PopulationPlan) => c1Commitment(plan);
const bytes = (value: string) => Buffer.from(value, 'utf8');
const slice = (input: string, start: number, end: number) => bytes(input).subarray(start, end).toString('utf8');
const tally = (values: string[]) => values.reduce<Record<string, number>>((acc, key) => { acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/u;

// -------------------------------------------------------------------------------------------------------------------
// Authority-reserved values (named authority only; never inferred from detector output)
// -------------------------------------------------------------------------------------------------------------------

/** RFC 2606 §2–3 documentation domains and RFC 6761 §6.2–6.5 special-use names, whole parsed domain, ASCII case-insensitive. */
export function emailReservedDomain(candidate: string) {
  const at = candidate.lastIndexOf('@');
  if (at < 1) return false;
  const domain = candidate.slice(at + 1).toLowerCase();
  const under = (name: string) => domain === name || domain.endsWith(`.${name}`);
  return ['example.com', 'example.net', 'example.org', 'example', 'invalid', 'localhost', 'test'].some(under);
}

const ipv4Value = (text: string): number | null => {
  const parts = text.split('.');
  if (parts.length !== 4 || !parts.every(part => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return null;
  return parts.reduce((acc, part) => acc * 256 + Number(part), 0);
};
const ipv6Value = (text: string): bigint | null => {
  let body = text, tail: number[] = [];
  if (body.includes('.')) {
    const last = body.lastIndexOf(':'); const v4 = ipv4Value(body.slice(last + 1));
    if (last < 0 || v4 === null) return null;
    tail = [Math.floor(v4 / 65536), v4 % 65536];
    body = body.slice(0, last + 1);
    if (!body.endsWith('::')) body = body.slice(0, -1);
  }
  if (body.split('::').length > 2) return null;
  const parse = (part: string) => part === '' ? [] : part.split(':');
  const [head, rest] = body.includes('::') ? body.split('::') : [body, null];
  const left = parse(head), right = rest === null ? [] : parse(rest);
  if ([...left, ...right].some(group => !/^[0-9A-Fa-f]{1,4}$/.test(group))) return null;
  const count = left.length + right.length + tail.length;
  if (rest === null ? count !== 8 : count > 7) return null;
  const groups = [...left.map(g => parseInt(g, 16)), ...Array(8 - count).fill(0), ...right.map(g => parseInt(g, 16)), ...tail];
  return groups.reduce((acc, group) => (acc << 16n) + BigInt(group), 0n);
};
const inV4 = (value: number, base: string, prefix: number) => {
  const start = ipv4Value(base)!; const size = 2 ** (32 - prefix);
  return value >= start && value < start + size;
};
const inV6 = (value: bigint, base: string, prefix: number) => (value >> BigInt(128 - prefix)) === (ipv6Value(base)! >> BigInt(128 - prefix));
const reservedV4 = (value: number) => value === 0 || value === 0xffffffff || inV4(value, '127.0.0.0', 8) || inV4(value, '224.0.0.0', 4) ||
  inV4(value, '192.0.2.0', 24) || inV4(value, '198.51.100.0', 24) || inV4(value, '203.0.113.0', 24) || inV4(value, '198.18.0.0', 15);

/** Network-address contract v1 non-sensitive classes (RFC 5737, RFC 3849, RFC 2544, BMWG, RFC 9637, constants, multicast). */
export function networkReservedAddress(candidate: string) {
  const v4 = ipv4Value(candidate);
  if (v4 !== null) return reservedV4(v4);
  const v6 = ipv6Value(candidate);
  if (v6 === null) return false;
  if (inV6(v6, '::ffff:0:0', 96)) return reservedV4(Number(v6 & 0xffffffffn));
  return v6 === 0n || v6 === 1n || inV6(v6, 'ff00::', 8) || inV6(v6, '2001:db8::', 32) || inV6(v6, '2001:2::', 48) || inV6(v6, '3fff::', 20);
}

/**
 * Email contract v1 whole-candidate rule: the authored range must be bounded on the left by something other than
 * local-part atom syntax (RFC 5322 `atext`, or a Unicode alphabetic/numeric SMTPUTF8 scalar), `.` or `@`, and on the
 * right by something other than a domain-label character, `.` or `@`. Note that `=`, `/`, `'` and `+` are `atext`, so a
 * `key=addr` spelling is one candidate that starts at the key.
 */
export function emailWholeCandidate(input: string, range: { start: number; end: number }) {
  const before = Array.from(slice(input, 0, range.start)).at(-1), after = Array.from(slice(input, range.end, bytes(input).length))[0];
  const atom = (char: string) => /[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]/.test(char) || /[\p{L}\p{N}]/u.test(char);
  const leftOk = before === undefined || !(atom(before) || before === '.' || before === '@');
  const rightOk = after === undefined || !(/[A-Za-z0-9-]/.test(after) || /[\p{L}\p{N}]/u.test(after) || after === '.' || after === '@');
  return leftOk && rightOk;
}

// -------------------------------------------------------------------------------------------------------------------
// Contract-derived reference of the pii-context/v1 association grammar (email and network-address domains only)
// -------------------------------------------------------------------------------------------------------------------

type Entry = { id: string; language: 'en' | 'ko'; kind: 'field-label' | 'natural-language-label'; class: 'positive' | 'negative' | 'neutral';
  strength: 'high-signal' | 'ambiguous'; domains: string[]; forms: string[] };
/** The reviewed entries of core `docs/contracts/pii/pii-context-v1.json` at af7f863f that name the email or network-address domain. */
export const C1_CONTEXT_ENTRIES: readonly Entry[] = Object.freeze([
  { id: 'en-email-field', language: 'en', kind: 'field-label', class: 'positive', strength: 'high-signal', domains: ['email'], forms: ['email', 'e-mail'] },
  { id: 'en-network-address-field', language: 'en', kind: 'field-label', class: 'positive', strength: 'high-signal', domains: ['network-address'],
    forms: ['ip', 'ip address', 'client ip', 'source ip', 'remote address'] },
  { id: 'en-contact-label', language: 'en', kind: 'natural-language-label', class: 'positive', strength: 'ambiguous', domains: ['email'], forms: ['contact'] },
  { id: 'en-contact-details-label', language: 'en', kind: 'natural-language-label', class: 'positive', strength: 'high-signal', domains: ['email'],
    forms: ['contact details'] },
  { id: 'en-example-label', language: 'en', kind: 'natural-language-label', class: 'negative', strength: 'high-signal', domains: ['email', 'network-address'],
    forms: ['example', 'documentation'] },
  { id: 'en-value-neutral', language: 'en', kind: 'field-label', class: 'neutral', strength: 'ambiguous', domains: ['email', 'network-address'], forms: ['value'] },
  { id: 'ko-email-field', language: 'ko', kind: 'field-label', class: 'positive', strength: 'high-signal', domains: ['email'], forms: ['이메일', '고객 이메일'] },
  { id: 'ko-network-address-field', language: 'ko', kind: 'field-label', class: 'positive', strength: 'high-signal', domains: ['network-address'],
    forms: ['ip', 'ip 주소', '클라이언트 ip', '원격 주소'] },
  { id: 'ko-contact-label', language: 'ko', kind: 'natural-language-label', class: 'positive', strength: 'ambiguous', domains: ['email'], forms: ['연락처'] },
  { id: 'ko-example-label', language: 'ko', kind: 'natural-language-label', class: 'negative', strength: 'high-signal', domains: ['email', 'network-address'],
    forms: ['예시'] },
  { id: 'ko-value-neutral', language: 'ko', kind: 'field-label', class: 'neutral', strength: 'ambiguous', domains: ['email', 'network-address'], forms: ['값'] },
] as Entry[]);

const LINE_BREAK = /[\n\r\u000b\u000c\u001c-\u001e\u0085\u2028\u2029]/u;
const GOVERNED_INVISIBLE = /[\u00ad\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/u;
const isSeparator = (char: string) => /\s/u.test(char) || char === '_' || char === '-' || char === ':' || char === '=';

/** Context-only view: governed invisibles removed, ASCII case folded for English, separator runs collapsed to one space. */
function contextView(chars: Array<{ char: string; byte: number }>, language: 'en' | 'ko') {
  const out: Array<{ char: string; byte: number }> = [];
  for (const item of chars) {
    if (GOVERNED_INVISIBLE.test(item.char)) continue;
    const char = language === 'en' && /[A-Z]/.test(item.char) ? item.char.toLowerCase() : item.char;
    if (isSeparator(char)) { if (out.at(-1)?.char !== ' ') out.push({ char: ' ', byte: item.byte }); }
    else out.push({ char, byte: item.byte });
  }
  return out;
}

/**
 * Re-derive the contract sensitivity of an identity-valid authored candidate: authority-reserved value first, then the
 * association rules of pii-context/v1 (same logical line, never across another candidate, field labels before the candidate
 * within 16 scalars with only separators/quotes between, natural-language labels on either side within 64, equidistant
 * matches unassociated, longest/high-signal/negative-first precedence), then the family's named negative evidence.
 */
export function c1ReferenceSensitivity(family: C1Family, input: string, target: { start: number; end: number },
  others: readonly C1LineCandidate[] = []): { sensitivity: Sensitivity; matches: string[] } {
  const candidateText = slice(input, target.start, target.end);
  if (family === 'pii:global:email' ? emailReservedDomain(candidateText) : networkReservedAddress(candidateText))
    return { sensitivity: 'non-sensitive', matches: [] };
  const domain = DOMAIN[family];
  const source = bytes(input);
  const chars: Array<{ char: string; byte: number }> = [];
  for (let offset = 0; offset < source.length;) {
    const char = String.fromCodePoint(source.subarray(offset).toString('utf8').codePointAt(0)!);
    chars.push({ char, byte: offset }); offset += Buffer.byteLength(char);
  }
  let lineStart = 0, lineEnd = source.length;
  for (const item of chars) {
    if (!LINE_BREAK.test(item.char)) continue;
    if (item.byte < target.start) lineStart = item.byte + Buffer.byteLength(item.char);
    else if (item.byte >= target.end && lineEnd === source.length) lineEnd = item.byte;
  }
  const lineCandidates = [target, ...others.filter(row => row.start >= lineStart && row.end <= lineEnd)];
  const beforeBarrier = Math.max(lineStart, ...others.filter(row => row.end <= target.start && row.end >= lineStart).map(row => row.end));
  const afterBarrier = Math.min(lineEnd, ...others.filter(row => row.start >= target.end && row.start <= lineEnd).map(row => row.start));
  const found: Array<{ entry: Entry; side: 0 | 1; start: number; end: number }> = [];
  for (const entry of C1_CONTEXT_ENTRIES.filter(row => row.domains.includes(domain))) {
    const view = contextView(chars.filter(item => item.byte >= lineStart && item.byte < lineEnd), entry.language);
    const at = (byte: number) => { const index = view.findIndex(item => item.byte >= byte); return index < 0 ? view.length : index; };
    const [candStart, candEnd] = [at(target.start), at(target.end)];
    const windows: Array<[0 | 1, number, number]> = [[0, at(beforeBarrier), candStart], [1, candEnd, at(afterBarrier)]];
    const positions = lineCandidates.map(row => [at(row.start), at(row.end)] as const);
    for (const form of entry.forms) {
      const needle = Array.from(contextView(Array.from(form).map((char, byte) => ({ char, byte })), entry.language).map(item => item.char).join(''));
      for (const [side, from, to] of windows) {
        if (entry.kind === 'field-label' && side === 1) continue;
        const text = view.slice(from, to).map(item => item.char);
        for (let index = 0; index + needle.length <= text.length; index += 1) {
          if (needle.some((char, offset) => text[index + offset] !== char)) continue;
          const boundary = (char: string | undefined) => char === undefined || /\s/u.test(char) ||
            (entry.kind === 'field-label' && (char === '"' || char === "'"));
          if (!boundary(text[index - 1]) || !boundary(text[index + needle.length])) continue;
          const distance = side === 0 ? text.length - index - needle.length : index;
          if (distance > (entry.kind === 'field-label' ? 16 : 64)) continue;
          if (entry.kind === 'field-label' && !text.slice(index + needle.length).every(char => /\s/u.test(char) || char === '"' || char === "'")) continue;
          const start = from + index, end = start + needle.length;
          const distances = positions.map(([s, e]) => e <= start ? start - e : Math.max(0, s - end));
          const nearest = Math.min(...distances);
          if (distances.filter(value => value === nearest).length > 1) continue;
          found.push({ entry, side, start, end });
        }
      }
    }
  }
  const rank = { 'high-signal': 1, ambiguous: 0 } as const, klass = { negative: 2, positive: 1, neutral: 0 } as const;
  found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || rank[b.entry.strength] - rank[a.entry.strength] ||
    klass[b.entry.class] - klass[a.entry.class] || (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0) || a.start - b.start);
  const accepted: typeof found = [];
  for (const occurrence of found)
    if (!accepted.some(row => row.side === occurrence.side && row.start < occurrence.end && occurrence.start < row.end)) accepted.push(occurrence);
  const matches = [...new Set(accepted.map(row => row.entry.id))].sort();
  const positive = accepted.some(row => row.entry.class === 'positive' && row.entry.strength === 'high-signal');
  const negative = accepted.some(row => row.entry.class === 'negative' && row.entry.strength === 'high-signal');
  return { sensitivity: positive && !negative ? 'sensitive' : 'not-established', matches };
}

// -------------------------------------------------------------------------------------------------------------------
// Plan validation: contract labels, backlog coverage, twins, base-rate mass, duplication and independence
// -------------------------------------------------------------------------------------------------------------------

type LedgerAxis = { order: number; id: string; family: string; owner: string; views: string[]; languages: string[]; resolves: string[] };
export const c1LedgerAxes = (family: C1Family) =>
  (gapLedger as unknown as { axisBacklog: LedgerAxis[] }).axisBacklog.filter(row => row.owner === '#424' && row.family === family);

export interface C1Independence {
  cases: number; sensitiveCases: number; distinctSensitiveCandidates: number; maxCasesSharingASensitiveCandidate: number;
  distinctCandidates: number; maxCasesSharingACandidate: number; duplicateInputs: number; declaredTwins: number;
  casesSharedAcrossPopulationViews: number; priorPlanCandidateOverlap: number; languages: Record<string, number>;
  koreanSensitive: number; sources: Record<string, number>; strata: number; benignAxes: string[];
  emailDistinctLocalParts?: number; emailDistinctDomains?: number;
}

const MAX_SHARED_CANDIDATE = 4;

export function validateC1PopulationPlan(value: unknown, priorPlanCandidates: readonly string[] = []): { plan: C1PopulationPlan; independence: C1Independence } {
  const plan = value as C1PopulationPlan;
  if (!plan || plan.schemaVersion !== 1 || plan.reportType !== 'pii-family-population-plan' || plan.supportClaims !== false ||
      !C1_FAMILIES.includes(plan.family) || plan.issue !== C1_ISSUE || plan.contextVocabulary !== C1_CONTEXT_VOCABULARY ||
      plan.familyContractVersion !== 1 || plan.plan?.family !== plan.family || plan.plan.findingType !== plan.findingType ||
      plan.plan.familyContractVersion !== 1 || plan.plan.canonicalOffsetUnit !== 'utf8-byte' || !Array.isArray(plan.plan.cases) ||
      !Array.isArray(plan.strata) || !Array.isArray(plan.populations))
    throw new Error('Invalid C1 PII population plan');
  if (plan.supersedes !== undefined) {
    const prior = C1_SUPERSEDED_PLANS.find(row => row.file === plan.supersedes!.file);
    if (!prior || prior.plan.family !== plan.family || prior.plan.oracle.planCommitment !== plan.supersedes.planCommitment ||
        !/^[a-f0-9]{64}$/.test(plan.supersedes.fileSha256) || !plan.supersedes.corrections?.length ||
        plan.supersedes.corrections.some(row => !plan.plan.cases.some(item => item.id === row.v2CaseId) ||
          !prior.plan.plan.cases.some(item => item.id === row.v1CaseId)))
      throw new Error('C1 supersession record does not match the frozen predecessor');
  }
  const ledger = gapLedger as unknown as { contentCommitment: string };
  if (plan.ledger?.file !== LEDGER_FILE || plan.ledger.contentCommitment !== ledger.contentCommitment)
    throw new Error('C1 population plan is not bound to the frozen #422 ledger');
  const axes = c1LedgerAxes(plan.family);
  if (JSON.stringify(plan.ledger.axes) !== JSON.stringify(axes.map(row => row.id))) throw new Error('C1 population plan axes differ from the ledger backlog');
  // #423 oracle: one label per case in plan order, bound to this exact plan object.
  if (plan.oracle.planCommitment !== piiOraclePlanCommitment(plan.plan)) throw new Error('C1 oracle is not bound to this plan');
  validatePiiOracleFamily(plan.oracle, plan.plan);
  const labels = new Map(plan.oracle.labels.map(label => [label.caseId, label] as const));

  const strata = new Map(plan.strata.map(row => [row.id, row] as const));
  if (strata.size !== plan.strata.length) throw new Error('Duplicate C1 stratum');
  for (const row of plan.strata) {
    if (!axes.some(axis => axis.id === row.axis) || !row.views.length || row.views.some(view => !(C1_VIEWS as readonly string[]).includes(view)) ||
        (row.benignAxis !== null && !(C1_BENIGN_AXES as readonly string[]).includes(row.benignAxis)) ||
        (row.sensitivity === 'sensitive') !== (row.benignAxis === null))
      throw new Error(`Invalid C1 stratum: ${row.id}`);
  }
  const ids = new Set<string>();
  for (const row of plan.plan.cases) {
    const stratum = strata.get(row.stratum), label = labels.get(row.id) as PiiOracleLabel;
    if (ids.has(row.id) || !stratum || stratum.axis !== row.axis || !row.views.length || row.views.some(view => !stratum.views.includes(view)) ||
        !['en', 'ko'].includes(row.language) || !(C1_SOURCES as readonly string[]).includes(row.source) ||
        !(C1_TIERS as readonly string[]).includes(row.tier) || !(C1_SEMANTIC_ROLES as readonly string[]).includes(row.semanticRole))
      throw new Error(`Invalid C1 case: ${row.id}`);
    ids.add(row.id);
    if (label.identity !== stratum.identity || label.sensitivity !== stratum.sensitivity) throw new Error(`C1 case disagrees with its stratum: ${row.id}`);
    if (row.expected.action !== (label.sensitivity === 'sensitive' ? 'redact' : 'none') || row.expected.sensitive !== (label.sensitivity === 'sensitive'))
      throw new Error(`C1 expected action disagrees with the oracle: ${row.id}`);
    const context = label.candidate ? `${slice(row.input, 0, label.candidate.start)}${slice(row.input, label.candidate.end, bytes(row.input).length)}` : row.input;
    if ((row.language === 'ko') !== HANGUL.test(context)) throw new Error(`C1 case language disagrees with its context: ${row.id}`);
    if (row.source === 'authority-reserved' && label.sensitivity !== 'non-sensitive') throw new Error(`C1 reserved source is not non-sensitive: ${row.id}`);
    for (const other of row.lineCandidates ?? [])
      if (!Number.isInteger(other.start) || other.end <= other.start || other.end > bytes(row.input).length ||
          (label.candidate && other.start < label.candidate.end && label.candidate.start < other.end))
        throw new Error(`Invalid C1 line candidate: ${row.id}`);
    if (label.identity !== 'not-established' && plan.family === 'pii:global:email' && !emailWholeCandidate(row.input, label.candidate!))
      throw new Error(`C1 email candidate is not a whole contract candidate: ${row.id}`);
    if (label.identity === 'valid') {
      const reference = c1ReferenceSensitivity(plan.family, row.input, label.candidate!, row.lineCandidates);
      if (reference.sensitivity !== label.sensitivity)
        throw new Error(`C1 label disagrees with the contract reference: ${row.id} (${label.sensitivity} vs ${reference.sensitivity})`);
    }
  }
  // Twins: a declared twin names one base case of the same plan, one closed property, and differs from it.
  const byId = new Map(plan.plan.cases.map(row => [row.id, row] as const));
  for (const row of plan.plan.cases) {
    if (row.twinOf === undefined && row.twinProperty === undefined) continue;
    const base = byId.get(row.twinOf ?? '');
    if (!base || base.id === row.id || !(C1_TWIN_PROPERTIES as readonly string[]).includes(row.twinProperty ?? '') || base.input === row.input ||
        base.twinOf !== undefined)
      throw new Error(`Invalid C1 twin: ${row.id}`);
  }
  // Ledger backlog coverage: every axis reaches each view and language it names.
  for (const axis of axes) {
    const rows = plan.plan.cases.filter(row => row.axis === axis.id);
    for (const view of axis.views) if (!rows.some(row => row.views.includes(view))) throw new Error(`C1 axis ${axis.id} misses view ${view}`);
    for (const language of axis.languages) if (!rows.some(row => row.language === language)) throw new Error(`C1 axis ${axis.id} misses language ${language}`);
    if (!plan.plan.cases.some(row => row.axis === axis.id && row.twinOf)) throw new Error(`C1 axis ${axis.id} declares no twin`);
  }
  // Declared base-rate mass: integer, exhaustive, no renormalization; diagnostic equal per stratum, stress benign-dominant.
  if (JSON.stringify(plan.populations.map(row => row.id)) !== JSON.stringify(C1_POPULATION_VIEWS)) throw new Error('C1 populations must be the two canonical views');
  for (const population of plan.populations) {
    const members = plan.plan.cases.filter(row => row.views.includes(population.id));
    const present = [...new Set(members.map(row => row.stratum))].sort();
    if (JSON.stringify(population.strata.map(row => row.stratum)) !== JSON.stringify(present) || !Number.isInteger(population.totalMass) ||
        population.totalMass <= 0 || population.denominatorUnit !== 'declared-assumption-unit' || !population.rationale.length)
      throw new Error(`C1 population ${population.id} does not cover exactly its strata`);
    let total = 0, sensitive = 0;
    for (const row of population.strata) {
      const stratum = strata.get(row.stratum)!;
      const split = { sensitive: row.sensitiveMass, 'non-sensitive': row.nonSensitiveMass, 'not-established': row.notEstablishedMass };
      if (![row.mass, row.sensitiveMass, row.nonSensitiveMass, row.notEstablishedMass].every(n => Number.isInteger(n) && n >= 0) || row.mass <= 0 ||
          row.sensitiveMass + row.nonSensitiveMass + row.notEstablishedMass !== row.mass || split[stratum.sensitivity] !== row.mass)
        throw new Error(`C1 mass row is inconsistent: ${population.id}/${row.stratum}`);
      total += row.mass; sensitive += row.sensitiveMass;
    }
    if (total !== population.totalMass) throw new Error(`C1 population ${population.id} mass does not add up`);
    if (population.id === 'diagnostic-balanced' && Math.max(...population.strata.map(r => r.mass)) - Math.min(...population.strata.map(r => r.mass)) > 1)
      throw new Error('Diagnostic mass is not balanced');
    if (population.id === 'benign-heavy-stress' && sensitive * 20 > total) throw new Error('Benign-heavy view is not benign-dominant');
  }
  // Duplication and independence.
  const candidateOf = (row: C1Case) => { const label = labels.get(row.id)!; return label.candidate ? slice(row.input, label.candidate.start, label.candidate.end) : null; };
  const normalizeCandidate = (value: string) => value.normalize('NFC').toLowerCase();
  const candidates = plan.plan.cases.map(candidateOf).filter((v): v is string => v !== null).map(normalizeCandidate);
  const sensitive = plan.plan.cases.filter(row => labels.get(row.id)!.sensitivity === 'sensitive').map(row => normalizeCandidate(candidateOf(row)!));
  const counts = tally(candidates), sensitiveCounts = tally(sensitive);
  const inputs = tally(plan.plan.cases.map(row => row.input));
  const prior = new Set(priorPlanCandidates.map(normalizeCandidate));
  const independence: C1Independence = {
    cases: plan.plan.cases.length, sensitiveCases: sensitive.length, distinctSensitiveCandidates: Object.keys(sensitiveCounts).length,
    maxCasesSharingASensitiveCandidate: Math.max(0, ...Object.values(sensitiveCounts)), distinctCandidates: Object.keys(counts).length,
    maxCasesSharingACandidate: Math.max(0, ...Object.values(counts)), duplicateInputs: Object.values(inputs).filter(n => n > 1).length,
    declaredTwins: plan.plan.cases.filter(row => row.twinOf).length,
    casesSharedAcrossPopulationViews: plan.plan.cases.filter(row => C1_POPULATION_VIEWS.every(view => row.views.includes(view))).length,
    priorPlanCandidateOverlap: [...new Set(sensitive)].filter(value => prior.has(value)).length,
    languages: tally(plan.plan.cases.map(row => row.language)),
    koreanSensitive: plan.plan.cases.filter(row => row.language === 'ko' && labels.get(row.id)!.sensitivity === 'sensitive').length,
    sources: tally(plan.plan.cases.map(row => row.source)), strata: plan.strata.length,
    benignAxes: [...new Set(plan.strata.map(row => row.benignAxis).filter((v): v is string => v !== null))].sort(),
  };
  if (plan.family === 'pii:global:email') {
    independence.emailDistinctLocalParts = new Set(sensitive.map(value => value.slice(0, value.lastIndexOf('@')))).size;
    independence.emailDistinctDomains = new Set(sensitive.map(value => value.slice(value.lastIndexOf('@') + 1))).size;
  }
  if (independence.duplicateInputs || independence.priorPlanCandidateOverlap || independence.maxCasesSharingASensitiveCandidate > MAX_SHARED_CANDIDATE ||
      independence.maxCasesSharingACandidate > MAX_SHARED_CANDIDATE)
    throw new Error('C1 population plan fails its duplication/independence check');
  return { plan, independence };
}

/** Authored candidates of the frozen v1 qualification plans (the before state); new C1 cases must not reuse them. */
export function c1PriorPlanCandidates(plan: { canonicalOffsetUnit: string; cases: Array<{ input: string; expected: { publicFinding: boolean; start?: number; end?: number } }> },
  oracle?: PiiOracleFamily) {
  const out: string[] = [];
  plan.cases.forEach((row, index) => {
    const range = oracle?.labels[index]?.candidate ?? (row.expected.publicFinding ? { start: row.expected.start!, end: row.expected.end! } : null);
    if (range) out.push(slice(row.input, range.start, range.end));
  });
  return out;
}

// -------------------------------------------------------------------------------------------------------------------
// Scoring observations against the frozen labels
// -------------------------------------------------------------------------------------------------------------------

/** One installed-surface observation of one case. Ranges are canonical UTF-8 byte offsets. No text is carried. */
export interface C1Observation {
  caseId: string;
  familyFindings: Array<{ start: number; end: number; action: string }>;
  otherPiiFindings: Array<{ type: string; start: number; end: number; action: string }>;
  credentialFindings: number;
  /** Authored sensitive spans (target and line candidates) whose exact bytes survive in the sanitized output. */
  leakedSensitiveSpans: number;
  /** UTF-8 bytes removed or rewritten by PII findings outside every authored sensitive span and outside credential findings. */
  collateralBytes: number;
}
export type C1PublicOutcome = 'detected' | 'range-mismatch' | 'missed' | 'absent' | 'false-alarm';

export function c1CaseOutcome(plan: C1PopulationPlan, observation: C1Observation) {
  const label = plan.oracle.labels.find(row => row.caseId === observation.caseId);
  if (!label) throw new Error('C1 observation names an unknown case');
  const findings = observation.familyFindings;
  let outcome: C1PublicOutcome;
  if (label.sensitivity === 'sensitive') {
    const exact = findings.filter(row => row.start === label.candidate!.start && row.end === label.candidate!.end && row.action === 'redact');
    const overlapping = findings.filter(row => row.start < label.candidate!.end && label.candidate!.start < row.end);
    outcome = exact.length === 1 && overlapping.length === 1 ? 'detected' : overlapping.length ? 'range-mismatch' : 'missed';
  } else {
    const onTarget = label.candidate ? findings.filter(row => row.start < label.candidate!.end && label.candidate!.start < row.end) : findings;
    outcome = onTarget.length ? 'false-alarm' : 'absent';
  }
  const wrongFamily = label.sensitivity === 'sensitive' && outcome === 'missed' &&
    observation.otherPiiFindings.some(row => row.start < label.candidate!.end && label.candidate!.start < row.end);
  const falseAlarmActions = outcome === 'false-alarm' ? findings.map(row => row.action) : [];
  return { outcome, wrongFamily, falseAlarmActions, leaked: observation.leakedSensitiveSpans > 0, collateral: observation.collateralBytes > 0 };
}

const CONTRACT_SILENT = 'contract-silent';
const emptyCounts = () => ({ cases: 0, detected: 0, rangeMismatch: 0, missed: 0, wrongFamily: 0, absent: 0, falseAlarm: 0,
  falseAlarmByAction: {} as Record<string, number>, leakedCases: 0, collateralCases: 0, collateralBytes: 0, credentialOverlapCases: 0 });
type Counts = ReturnType<typeof emptyCounts>;
const add = (counts: Counts, result: ReturnType<typeof c1CaseOutcome>, observation: C1Observation) => {
  counts.cases += 1;
  if (result.outcome === 'detected') counts.detected += 1; else if (result.outcome === 'range-mismatch') counts.rangeMismatch += 1;
  else if (result.outcome === 'missed') counts.missed += 1; else if (result.outcome === 'absent') counts.absent += 1; else counts.falseAlarm += 1;
  if (result.wrongFamily) counts.wrongFamily += 1;
  for (const action of result.falseAlarmActions) counts.falseAlarmByAction[action] = (counts.falseAlarmByAction[action] ?? 0) + 1;
  if (result.leaked) counts.leakedCases += 1;
  if (result.collateral) { counts.collateralCases += 1; counts.collateralBytes += observation.collateralBytes; }
  if (observation.credentialFindings > 0) counts.credentialOverlapCases += 1;
};

export const C1_PII_V1_MECHANICS: MechanicalAccountingConfig = Object.freeze({
  minDenominator: piiV1Profile.mechanics.minDenominator, replays: piiV1Profile.mechanics.replays,
  intervalZ: piiV1Profile.mechanics.intervalZ, intervalPrecision: piiV1Profile.mechanics.intervalPrecision,
});
const metric = (id: keyof typeof piiV1Profile.metrics, numerator: number, denominator: number) => {
  const definition = piiV1Profile.metrics[id]; const direction = definition.direction as 'upper' | 'lower';
  const value: MechanicalPublished = proportion(numerator, denominator, direction, C1_PII_V1_MECHANICS);
  const status = value === null ? 'not-applicable' : typeof value === 'string' ? 'insufficient-denominator' :
    (direction === 'upper' ? value.bound! <= definition.threshold : value.bound! >= definition.threshold) ? 'met' : 'not-met';
  return { id, numerator, denominator, value, threshold: definition.threshold, direction, status };
};

/**
 * Score one surface's observations of one plan: per view and stratum outcome counts plus the mass-weighted split, the
 * pii-v1 metrics per view, and the typed identity-only state. Identity/type outcomes, sensitivity outcomes, action-split
 * false alarms, sanitized-output leakage/collateral and unsupported syntax are kept in separate blocks.
 */
export function scoreC1Surface(plan: C1PopulationPlan, observations: readonly C1Observation[]) {
  const byCase = new Map(observations.map(row => [row.caseId, row] as const));
  if (byCase.size !== plan.plan.cases.length || plan.plan.cases.some(row => !byCase.has(row.id))) throw new Error('C1 observations are incomplete');
  const labels = new Map(plan.oracle.labels.map(row => [row.caseId, row] as const));
  const strata = new Map(plan.strata.map(row => [row.id, row] as const));
  const results = new Map(plan.plan.cases.map(row => [row.id, c1CaseOutcome(plan, byCase.get(row.id)!)] as const));
  const byId = new Map(plan.plan.cases.map(row => [row.id, row] as const));
  const views = C1_VIEWS.map(view => {
    const members = plan.plan.cases.filter(row => row.views.includes(view));
    const perStratum = new Map<string, Counts>();
    for (const row of members) {
      const counts = perStratum.get(row.stratum) ?? emptyCounts(); add(counts, results.get(row.id)!, byCase.get(row.id)!); perStratum.set(row.stratum, counts);
    }
    const population = plan.populations.find(row => row.id === view);
    const stratumRows = [...perStratum.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, counts]) => {
      const stratum = strata.get(id)!, mass = population?.strata.find(row => row.stratum === id)?.mass ?? null;
      const bad = stratum.benignAxis === CONTRACT_SILENT ? 0 : stratum.sensitivity === 'sensitive' ? counts.cases - counts.detected : counts.falseAlarm;
      return { stratum: id, scored: stratum.benignAxis !== CONTRACT_SILENT, axis: stratum.axis, identity: stratum.identity, sensitivity: stratum.sensitivity, benignAxis: stratum.benignAxis,
        declaredMass: mass, adverseMass: mass === null ? null : Math.round((mass * bad) / counts.cases * 1000) / 1000, ...counts };
    });
    // A contract-silent stratum has no authored truth to score against: its findings are observed behavior only.
    const silent = (row: C1Case) => strata.get(row.stratum)!.benignAxis === CONTRACT_SILENT;
    const pick = (predicate: (row: C1Case) => boolean) => members.filter(row => !silent(row) && predicate(row));
    const sens = pick(row => labels.get(row.id)!.sensitivity === 'sensitive');
    const nonSens = pick(row => labels.get(row.id)!.sensitivity === 'non-sensitive');
    const benign = pick(row => labels.get(row.id)!.sensitivity !== 'sensitive');
    const outcome = (row: C1Case) => results.get(row.id)!.outcome;
    const twins = members.filter(row => row.twinOf && members.some(base => base.id === row.twinOf) &&
      (labels.get(row.id)!.sensitivity === 'sensitive') !== (labels.get(row.twinOf)!.sensitivity === 'sensitive'));
    const pairCorrect = (row: C1Case) => [row, byId.get(row.twinOf!)!].every(item => ['detected', 'absent'].includes(outcome(item)));
    const piiFindings = members.filter(row => !silent(row)).flatMap(row => byCase.get(row.id)!.familyFindings.map(finding => ({ row, finding })));
    const collateralFindings = piiFindings.filter(({ row, finding }) => {
      const label = labels.get(row.id)!;
      const sensitiveSpans = [...(label.sensitivity === 'sensitive' ? [label.candidate!] : []),
        ...(row.lineCandidates ?? []).filter(other => other.sensitivity === 'sensitive')];
      return !sensitiveSpans.some(span => span.start === finding.start && span.end === finding.end);
    });
    const unsupported = members.filter(row => strata.get(row.stratum)!.benignAxis === 'unsupported-syntax');
    const contractSilent = members.filter(silent);
    const massTotals = population ? {
      sensitiveMass: population.strata.reduce((n, row) => n + row.sensitiveMass, 0),
      benignMass: population.strata.filter(row => strata.get(row.stratum)!.benignAxis !== CONTRACT_SILENT)
        .reduce((n, row) => n + row.nonSensitiveMass + row.notEstablishedMass, 0),
      contractSilentMass: population.strata.filter(row => strata.get(row.stratum)!.benignAxis === CONTRACT_SILENT).reduce((n, row) => n + row.mass, 0),
      sensitiveMassMissed: stratumRows.filter(row => row.sensitivity === 'sensitive').reduce((n, row) => n + (row.adverseMass ?? 0), 0),
      benignMassFlagged: stratumRows.filter(row => row.sensitivity !== 'sensitive').reduce((n, row) => n + (row.adverseMass ?? 0), 0),
    } : null;
    return {
      view, cases: members.length, population: population ? { totalMass: population.totalMass, denominatorUnit: population.denominatorUnit } : null,
      massTotals, strata: stratumRows,
      identity: { status: 'not-measured', reason: PII_ORACLE_UNAVAILABLE_REASON,
        authoredCells: tally(members.map(row => `${labels.get(row.id)!.identity}/${labels.get(row.id)!.sensitivity}`)) },
      sensitivity: {
        sensitive: { cases: sens.length, detected: sens.filter(r => outcome(r) === 'detected').length,
          rangeMismatch: sens.filter(r => outcome(r) === 'range-mismatch').length, missed: sens.filter(r => outcome(r) === 'missed').length },
        nonSensitive: { cases: nonSens.length, falseAlarm: nonSens.filter(r => outcome(r) === 'false-alarm').length },
        notEstablished: { cases: benign.length - nonSens.length, falseAlarm: benign.filter(r => labels.get(r.id)!.sensitivity === 'not-established' && outcome(r) === 'false-alarm').length },
      },
      falseAlarmsByAction: tally(benign.flatMap(row => results.get(row.id)!.falseAlarmActions)),
      output: { sensitiveCases: sens.length, leakedCases: sens.filter(r => results.get(r.id)!.leaked).length,
        benignCases: benign.length, collateralCases: pick(() => true).filter(r => results.get(r.id)!.collateral).length,
        collateralBytes: pick(() => true).reduce((n, r) => n + byCase.get(r.id)!.collateralBytes, 0),
        credentialOverlapCases: members.filter(r => byCase.get(r.id)!.credentialFindings > 0).length },
      unsupportedSyntax: { cases: unsupported.length, absent: unsupported.filter(r => outcome(r) === 'absent').length,
        findingOnUnsupported: unsupported.filter(r => outcome(r) === 'false-alarm').length },
      contractSilent: { cases: contractSilent.length, observedFinding: contractSilent.filter(r => outcome(r) === 'false-alarm').length,
        observedAbsent: contractSilent.filter(r => outcome(r) === 'absent').length,
        observedRedactedBytes: contractSilent.reduce((n, r) => n + byCase.get(r.id)!.collateralBytes, 0) },
      piiV1Metrics: [
        metric('type-miss-rate', sens.filter(r => outcome(r) === 'missed' && !results.get(r.id)!.wrongFamily).length, sens.length),
        metric('wrong-family-rate', sens.filter(r => results.get(r.id)!.wrongFamily).length, sens.length),
        metric('sensitive-miss-rate', sens.filter(r => outcome(r) !== 'detected').length, sens.length),
        metric('non-sensitive-flag-rate', nonSens.filter(r => outcome(r) === 'false-alarm').length, nonSens.length),
        metric('context-discrimination-rate', twins.filter(pairCorrect).length, twins.length),
        metric('benign-suppression-rate', benign.filter(r => outcome(r) === 'absent').length, benign.length),
        metric('range-collateral-rate', collateralFindings.length, piiFindings.length),
        metric('measurable-share', members.length, members.length),
      ],
      benignAxesPresent: [...new Set(benign.map(row => strata.get(row.stratum)!.benignAxis!))].sort(),
    };
  });
  return { family: plan.family, planCommitment: plan.oracle.planCommitment, views };
}

/** Per-stratum baseline → candidate deltas. A benign stratum regresses on more false alarms; a sensitive one on fewer detections. */
export function compareC1(baseline: ReturnType<typeof scoreC1Surface>, candidate: ReturnType<typeof scoreC1Surface>) {
  if (baseline.planCommitment !== candidate.planCommitment || baseline.family !== candidate.family) throw new Error('C1 comparison needs one plan');
  return C1_POPULATION_VIEWS.map(view => {
    const before = baseline.views.find(row => row.view === view)!, after = candidate.views.find(row => row.view === view)!;
    const strata = after.strata.map(row => {
      const prior = before.strata.find(item => item.stratum === row.stratum)!;
      const detectedDelta = row.detected - prior.detected, falseAlarmDelta = row.falseAlarm - prior.falseAlarm;
      const leakDelta = row.leakedCases - prior.leakedCases, collateralDelta = row.collateralCases - prior.collateralCases;
      const regression = !row.scored ? false : row.sensitivity === 'sensitive' ? detectedDelta < 0 || leakDelta > 0 : falseAlarmDelta > 0 || collateralDelta > 0;
      return { stratum: row.stratum, scored: row.scored, sensitivity: row.sensitivity, benignAxis: row.benignAxis, detectedDelta, falseAlarmDelta, leakDelta, collateralDelta, regression };
    });
    return { view, verdict: strata.some(row => row.regression) ? 'regression' : 'no-regression', regressedStrata: strata.filter(row => row.regression).length, strata };
  });
}
