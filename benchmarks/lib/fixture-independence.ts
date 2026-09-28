import { createHash } from 'node:crypto';
import type { Fixture, FormatContract } from '../types.ts';

/**
 * Fixture identity and independence audit (#377, Beta.11 A).
 *
 * A larger fixture count is only more evidence when the files are independent.
 * This module measures, per credential family, how much of the registered
 * corpus is actually distinct: the same bytes registered twice, one secret
 * value wrapped in several files (and counted as several positives or axes),
 * one generator skeleton reused with values swapped, positives whose only
 * format authority is a peer scanner's rule, twins that change more than one
 * property, and benign controls whose bytes satisfy some frozen positive
 * contract. It reports unique axes beside raw counts; it never changes an
 * expectation, a tier or a status, and it never emits fixture content — only
 * fixture ids, counts and truncated SHA-256 cluster keys.
 *
 * The same functions rerun unchanged after #379 adds fixtures, so the
 * before/after independence delta is mechanical, not a narrative.
 */

export interface AuditFixture {
  /** `<category>--<fixture id>`, the fixture-index slug. */
  key: string;
  category: string;
  fixture: Fixture;
  /** Families (registry detectors + arrival targets) the fixture is evidence for. */
  families: string[];
  /** The benign-method confusion axis (`benign` cases' `taxonomy`) when the fixture is a benign control. */
  benignAxis?: string;
}

export const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const short = (value: string) => sha(value).slice(0, 12);

/** URL hosts/paths that are a peer scanner's rule source, never provider documentation. */
const SCANNER_RULE_SOURCES = [
  /github\.com\/trufflesecurity\/trufflehog/, /github\.com\/gitleaks\/gitleaks/, /github\.com\/praetorian-inc\/noseyparker/,
  /github\.com\/secretlint\/secretlint/, /github\.com\/Yelp\/detect-secrets/, /github\.com\/mongodb\/kingfisher/,
  /github\.com\/GitGuardian\//, /github\.com\/semgrep\//, /github\.com\/returntocorp\//, /github\.com\/sirwart\/ripsecrets/,
  /github\.com\/betterleaks\//, /github\.com\/redact-secret\/redact-secret(?:\/|$)/, /flare/i,
];
export const isScannerRuleSource = (url: string) => SCANNER_RULE_SOURCES.some(pattern => pattern.test(url));

const secretSpans = (f: Fixture) => f.expected.filter(e => (e.role ?? 'secret') === 'secret');
export const isPositive = (f: Fixture) => f.assessment.kind !== 'must-not-flag' && secretSpans(f).length > 0;
export const isTwin = (f: Fixture) => Boolean(f.twinOf);
export const isBenign = (f: Fixture) => f.assessment.kind === 'must-not-flag' && !f.twinOf;

/**
 * Value-agnostic skeleton: secret spans masked, then every long value-like run
 * (16+ base64/hex/identifier characters) collapsed to one marker. Two files
 * with the same skeleton are the same template with values swapped.
 */
export function skeleton(f: Fixture): string {
  let text = '';
  let cursor = 0;
  const bytes = Buffer.from(f.content, 'utf8');
  for (const span of [...secretSpans(f)].sort((a, b) => a.start - b.start)) {
    if (span.start < cursor) continue;
    text += bytes.subarray(cursor, span.start).toString('utf8') + '\u0000S';
    cursor = span.end;
  }
  text += bytes.subarray(cursor).toString('utf8');
  return text.replace(/[A-Za-z0-9+/=_.~-]{16,}/g, '\u0000V').replace(/[ \t]+/g, ' ').trim();
}

/** Secret span bytes, per span (UTF-8 byte offsets, as authored). */
export function secretValues(f: Fixture): string[] {
  const bytes = Buffer.from(f.content, 'utf8');
  return secretSpans(f).map(s => bytes.subarray(s.start, s.end).toString('utf8'));
}

/** The positive-context axis a positive exercises: authored `contextAxis`, else the profile's `<category>/<group>`. */
export const positiveAxis = (a: AuditFixture) => a.fixture.contextAxis ?? `${a.category}/${a.fixture.group}`;

// ---------------------------------------------------------------------------
// Clusters

export interface Cluster { key: string; members: string[]; families: string[] }

function clusterBy(fixtures: AuditFixture[], keyOf: (a: AuditFixture) => string[] | string | null): Cluster[] {
  const groups = new Map<string, Set<string>>();
  const fams = new Map<string, Set<string>>();
  for (const a of fixtures) {
    const raw = keyOf(a);
    for (const k of raw == null ? [] : Array.isArray(raw) ? raw : [raw]) {
      if (!groups.has(k)) { groups.set(k, new Set()); fams.set(k, new Set()); }
      groups.get(k)!.add(a.key);
      for (const family of a.families) fams.get(k)!.add(family);
    }
  }
  return [...groups.entries()].filter(([, m]) => m.size > 1)
    .map(([k, m]) => ({ key: short(k), members: [...m].sort(), families: [...fams.get(k)!].sort() }))
    .sort((x, y) => y.members.length - x.members.length || x.key.localeCompare(y.key));
}

/** Byte-identical fixture content registered under more than one id. */
export const duplicateContentClusters = (fixtures: AuditFixture[]) => clusterBy(fixtures, a => `content:${a.fixture.content}`);
/** One secret value used by more than one positive (any family). */
export const sharedValueClusters = (fixtures: AuditFixture[]) =>
  clusterBy(fixtures.filter(a => isPositive(a.fixture)), a => [...new Set(secretValues(a.fixture))].map(v => `value:${v}`));
/** One skeleton reused by more than one fixture of the same role (positive / benign / twin). */
export const templateClusters = (fixtures: AuditFixture[]) =>
  clusterBy(fixtures, a => `${isPositive(a.fixture) ? 'positive' : isTwin(a.fixture) ? 'twin' : 'benign'}:${skeleton(a.fixture)}`);

// ---------------------------------------------------------------------------
// Twin property audit

export interface Hunk { start: number; end: number; inserted: number; location: 'value' | 'context' }
export type TwinFlag = 'value-and-context' | 'context-twin-edits-value' | 'multiple-value-edits' | 'multiple-context-edits' | 'length-and-content' | 'identical' | 'missing-positive' | 'diff-too-large';
export interface TwinAudit { twin: string; positive: string | null; mutationKind: string | null; hunks: number; valueHunks: number; contextHunks: number; flags: TwinFlag[] }

const MAX_DIFF = 4000;
export const MERGE_GAP = 3;

/** Character-level edit hunks between two strings (LCS over the region left after trimming a common prefix/suffix). */
export function editHunks(a: string, b: string): { aStart: number; aEnd: number; bStart: number; bEnd: number }[] | null {
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  const x = a.slice(prefix, a.length - suffix), y = b.slice(prefix, b.length - suffix);
  if (!x.length && !y.length) return [];
  if (x.length * y.length > MAX_DIFF * MAX_DIFF / 4) return null;
  const n = x.length, m = y.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const hunks: { aStart: number; aEnd: number; bStart: number; bEnd: number }[] = [];
  let i = 0, j = 0, open: { aStart: number; aEnd: number; bStart: number; bEnd: number } | null = null;
  const close = () => { if (open) { hunks.push(open); open = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) { close(); i++; j++; continue; }
    open ??= { aStart: prefix + i, aEnd: prefix + i, bStart: prefix + j, bEnd: prefix + j };
    if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) { j++; open.bEnd = prefix + j; }
    else { i++; open.aEnd = prefix + i; }
  }
  close();
  // Character LCS fragments one word replacement into several hunks by matching stray letters
  // (`Authorization` -> `X-Build-Id`); edits separated by at most MERGE_GAP characters on one
  // line are one edit.
  const merged: typeof hunks = [];
  for (const h of hunks) {
    const last = merged.at(-1);
    if (last && h.aStart - last.aEnd <= MERGE_GAP && !a.slice(last.aEnd, h.aStart).includes('\n')) { last.aEnd = h.aEnd; last.bEnd = h.bEnd; }
    else merged.push({ ...h });
  }
  return merged;
}

/**
 * Does a twin change exactly one property of its positive? A value twin's
 * edits must stay inside (or adjacent to) the positive's secret span; a context
 * twin (`mutationKind: 'context'`) must keep the value and edit only around it.
 * Offsets here are UTF-16 over decoded content, spans are converted from bytes.
 */
export function auditTwin(twin: Fixture, positive: Fixture | undefined, keys: { twin?: string; positive?: string } = {}): TwinAudit {
  const base = { twin: keys.twin ?? twin.id, positive: positive ? keys.positive ?? positive.id : null, mutationKind: twin.mutationKind ?? null };
  if (!positive) return { ...base, hunks: 0, valueHunks: 0, contextHunks: 0, flags: ['missing-positive'] };
  const hunks = editHunks(positive.content, twin.content);
  if (hunks === null) return { ...base, hunks: 0, valueHunks: 0, contextHunks: 0, flags: ['diff-too-large'] };
  if (!hunks.length) return { ...base, hunks: 0, valueHunks: 0, contextHunks: 0, flags: ['identical'] };
  const bytes = Buffer.from(positive.content, 'utf8');
  const toChar = (byte: number) => bytes.subarray(0, byte).toString('utf8').length;
  const spans = secretSpans(positive).map(s => ({ start: toChar(s.start), end: toChar(s.end) }));
  // Adjacent edits (one character either side) are boundary edits of the value itself.
  const inValue = (h: { aStart: number; aEnd: number }) => spans.some(s => h.aStart >= s.start - 1 && h.aEnd <= s.end + 1);
  const value = hunks.filter(inValue), context = hunks.filter(h => !inValue(h));
  const flags: TwinFlag[] = [];
  const contextKind = twin.mutationKind === 'context';
  if (contextKind) {
    if (value.length) flags.push('context-twin-edits-value');
    if (context.length > 1) flags.push('multiple-context-edits');
  } else {
    if (value.length && context.length) flags.push('value-and-context');
    if (!value.length && context.length) flags.push('value-and-context');
    if (value.length > 1) flags.push('multiple-value-edits');
    const lengthChanged = value.some(h => h.aEnd - h.aStart !== h.bEnd - h.bStart);
    const substituted = value.some(h => h.aEnd > h.aStart && h.bEnd > h.bStart);
    if (lengthChanged && substituted && twin.mutationKind === 'length') flags.push('length-and-content');
  }
  return { ...base, hunks: hunks.length, valueHunks: value.length, contextHunks: context.length, flags };
}

/** Every twin in the corpus against its `twinOf` positive in the same category, keyed by fixture-index slug. */
export function auditTwins(fixtures: AuditFixture[]): TwinAudit[] {
  const byKey = new Map(fixtures.map(a => [a.key, a]));
  return fixtures.filter(a => isTwin(a.fixture)).map(a => {
    const positiveKey = `${a.category}--${a.fixture.twinOf}`;
    return auditTwin(a.fixture, byKey.get(positiveKey)?.fixture, { twin: a.key, positive: positiveKey });
  }).sort((x, y) => x.twin.localeCompare(y.twin));
}

// ---------------------------------------------------------------------------
// Benign controls overlapping a frozen positive format

const IDENT = '[A-Za-z0-9_-]';
const unanchored = (pattern: string) => new RegExp(`(?<!${IDENT})(?:${pattern.replace(/^\^/, '').replace(/\$$/, '')})(?!${IDENT})`, 'g');

export interface FormatOverlap { fixture: string; families: string[]; overlappingContracts: string[]; ownContract: boolean; exempt: boolean }

/**
 * A `must-not-flag` fixture whose bytes contain an isolated match of any
 * frozen, non-structural contract pattern (validator applied). Same-contract
 * overlaps on scored tiers are already build failures (lexical separability);
 * this reports the rest — T0/exempt own-contract overlaps and cross-family
 * overlaps, where a benign assertion sits on bytes another family would issue.
 */
export function formatOverlaps(fixtures: AuditFixture[], contracts: Record<string, FormatContract>): FormatOverlap[] {
  const compiled = Object.entries(contracts).filter(([, c]) => c.pattern && !c.structural).map(([id, c]) => ({ id, c, re: unanchored(c.pattern!) }));
  const out: FormatOverlap[] = [];
  for (const a of fixtures) {
    if (a.fixture.assessment.kind !== 'must-not-flag') continue;
    const hits = compiled.filter(({ c, re }) => [...a.fixture.content.matchAll(re)].some(m => c.validate?.(m[0]) ?? true)).map(h => h.id);
    if (!hits.length) continue;
    const own = a.fixture.assessment.contract;
    out.push({ fixture: a.key, families: a.families, overlappingContracts: hits.sort(), ownContract: Boolean(own && hits.includes(own)), exempt: Boolean(a.fixture.assessment.lexicalExemption) });
  }
  return out.sort((x, y) => x.fixture.localeCompare(y.fixture));
}

// ---------------------------------------------------------------------------
// Per-family independence summary

export type SourceClass = 'provider-documented' | 'scanner-rule-only' | 'mixed' | 'none';
export function positiveSourceClass(f: Fixture, contract: FormatContract | undefined): SourceClass {
  if (contract?.providerSource) return 'provider-documented';
  const sources = f.assessment.sources ?? [];
  if (!sources.length) return 'none';
  return sources.every(isScannerRuleSource) ? 'scanner-rule-only' : 'mixed';
}

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string { if (!this.parent.has(x)) this.parent.set(x, x); const p = this.parent.get(x)!; if (p === x) return x; const r = this.find(p); this.parent.set(x, r); return r; }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
  count(keys: string[]) { return new Set(keys.map(k => this.find(k))).size; }
}

export interface FamilyIndependence {
  family: string;
  positives: { raw: number; distinctValues: number; distinctSkeletons: number; independentUpperBound: number; axes: number; independentAxes: number;
    sameValueAcrossAxes: number; sourceClasses: Record<SourceClass, number>; registryShapeGenerated: number };
  benign: { raw: number; distinctSkeletons: number; axes: string[]; formatOverlapsOwn: number; formatOverlapsOther: number; twinFormatOverlapsOwn: number };
  twins: { raw: number; mutationKinds: string[]; flagged: number; flags: Partial<Record<TwinFlag, number>> };
  duplicateContent: number;
}

/**
 * `independentUpperBound` = min(distinct secret values, distinct skeletons): at
 * most that many positives can differ from every other positive in both value
 * and template. `independentAxes` = distinct positive axes after merging axes
 * joined by a shared secret value (one value wrapped per axis is one sample).
 */
export function familyIndependence(family: string, fixtures: AuditFixture[], contracts: Record<string, FormatContract>,
  twinAudits: TwinAudit[], overlaps: FormatOverlap[], duplicates: Cluster[]): FamilyIndependence {
  const own = fixtures.filter(a => a.families.includes(family));
  const positives = own.filter(a => isPositive(a.fixture));
  // Axes that collapse because every positive on them shares a value with another axis.
  const axisUf = new UnionFind();
  const axisByValue = new Map<string, string>();
  let sameValueAcrossAxes = 0;
  for (const a of positives) {
    const axis = positiveAxis(a); axisUf.find(axis);
    for (const v of secretValues(a.fixture)) {
      const prior = axisByValue.get(v);
      if (prior && prior !== axis) { sameValueAcrossAxes++; axisUf.union(axis, prior); } else if (!prior) axisByValue.set(v, axis);
    }
  }
  const axes = [...new Set(positives.map(positiveAxis))];
  const sourceClasses: Record<SourceClass, number> = { 'provider-documented': 0, 'scanner-rule-only': 0, mixed: 0, none: 0 };
  for (const a of positives) sourceClasses[positiveSourceClass(a.fixture, contracts[a.fixture.assessment.contract ?? family] ?? contracts[family])]++;
  const benign = own.filter(a => isBenign(a.fixture));
  const twins = own.filter(a => isTwin(a.fixture));
  const twinKeys = new Set(twins.map(a => a.key));
  const audits = twinAudits.filter(t => twinKeys.has(t.twin));
  const flags: Partial<Record<TwinFlag, number>> = {};
  for (const t of audits) for (const f of t.flags) flags[f] = (flags[f] ?? 0) + 1;
  const ownKeys = new Set(own.map(a => a.key));
  const benignKeys = new Set(benign.map(a => a.key));
  const familyOverlaps = overlaps.filter(o => benignKeys.has(o.fixture));
  return {
    family,
    positives: {
      raw: positives.length,
      distinctValues: new Set(positives.flatMap(a => secretValues(a.fixture))).size,
      distinctSkeletons: new Set(positives.map(a => skeleton(a.fixture))).size,
      independentUpperBound: Math.min(new Set(positives.flatMap(a => secretValues(a.fixture))).size, new Set(positives.map(a => skeleton(a.fixture))).size),
      axes: axes.length,
      independentAxes: axisUf.count(axes),
      sameValueAcrossAxes,
      sourceClasses,
      registryShapeGenerated: positives.filter(a => a.category === 'detector-coverage' && /-shape-\d+-/.test(a.fixture.id)).length,
    },
    benign: {
      raw: benign.length,
      distinctSkeletons: new Set(benign.map(a => skeleton(a.fixture))).size,
      axes: [...new Set(benign.map(a => a.benignAxis).filter((x): x is string => Boolean(x)))].sort(),
      formatOverlapsOwn: familyOverlaps.filter(o => o.ownContract).length,
      formatOverlapsOther: familyOverlaps.filter(o => !o.ownContract).length,
      twinFormatOverlapsOwn: overlaps.filter(o => twinKeys.has(o.fixture) && o.ownContract).length,
    },
    twins: { raw: twins.length, mutationKinds: [...new Set(twins.map(a => a.fixture.mutationKind ?? 'unspecified'))].sort(), flagged: audits.filter(t => t.flags.length).length, flags },
    duplicateContent: duplicates.filter(c => c.members.some(m => ownKeys.has(m))).reduce((n, c) => n + c.members.filter(m => ownKeys.has(m)).length, 0),
  };
}

// ---------------------------------------------------------------------------
// Failure axes from scored rows (bench reports): raw rows vs unique axes

export interface ScoredRowLike {
  id: string; kind: string; tier: string; contract?: string | null; twinOf?: string | null;
  spanOutcomes?: string[] | null; leakedBytes?: number | null; collateralBytes?: number | null;
  flagged?: boolean | null; coDetected?: boolean | null; findings?: number | null;
  actual?: { start: number; end: number; family?: string; action?: string }[];
  expected?: { start: number; end: number; role?: string }[];
}
export type FailureType = 'leak' | 'warn-only' | 'collateral' | 'false-alarm' | 'twin-failure' | 'co-detection';
export interface FailureRow { key: string; families: string[]; type: FailureType; kind: string; action: string; axis: string; cluster: string }

/**
 * Classify one scored row into zero or more failure rows. `warn-only`: every finding covering the
 * secret is `warn` — detected, not sanitized (#376) — unless the fixture itself authors `expectedAction: 'warn'`.
 */
export function rowFailures(category: string, row: ScoredRowLike, audit: AuditFixture | undefined): FailureRow[] {
  if (row.tier === 'T0') return [];
  const key = `${category}--${row.id}`;
  const families = audit?.families.length ? audit.families : row.contract ? [row.contract] : [];
  const f = audit?.fixture;
  const cluster = f ? short(skeleton(f)) : 'unknown';
  const actions = [...new Set((row.actual ?? []).map(a => a.action ?? 'none'))].sort().join('+') || 'none';
  const out: FailureRow[] = [];
  if (row.kind === 'must-not-flag') {
    const axis = row.twinOf ? `twin:${f?.mutationKind ?? 'unspecified'}` : audit?.benignAxis ?? f?.group ?? 'unknown';
    if (row.flagged) out.push({ key, families, type: row.twinOf ? 'twin-failure' : 'false-alarm', kind: row.kind, action: actions, axis, cluster });
    else if (row.coDetected) out.push({ key, families, type: 'co-detection', kind: row.kind, action: actions, axis, cluster });
    return out;
  }
  const axis = audit ? positiveAxis(audit) : 'unknown';
  if ((row.spanOutcomes ?? []).some(o => o === 'PARTIAL' || o === 'MISS')) out.push({ key, families, type: 'leak', kind: row.kind, action: actions, axis, cluster: f ? short(secretValues(f).join('\u0000')) : 'unknown' });
  else {
    const secrets = (row.expected ?? []).filter(e => (e.role ?? 'secret') === 'secret');
    const covering = (row.actual ?? []).filter(a => secrets.some(e => a.start <= e.start && a.end >= e.end));
    if (covering.length && covering.every(a => a.action === 'warn') && f?.expectedAction !== 'warn') out.push({ key, families, type: 'warn-only', kind: row.kind, action: 'warn', axis, cluster });
  }
  if ((row.collateralBytes ?? 0) > 0) out.push({ key, families, type: 'collateral', kind: row.kind, action: actions, axis, cluster });
  return out;
}

export interface FailureSummary { family: string; type: FailureType; kind: string; action: string; rawRows: number; uniqueAxes: number; uniqueTemplates: number; axes: string[] }

/** Raw failing rows next to the distinct axes and distinct templates they reduce to, per family × type × kind × action. */
export function summarizeFailures(rows: FailureRow[]): FailureSummary[] {
  const groups = new Map<string, FailureRow[]>();
  for (const r of rows) for (const family of r.families.length ? r.families : ['(unattributed)']) {
    const k = `${family}\u0000${r.type}\u0000${r.kind}\u0000${r.action}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()].map(([k, rs]) => {
    const [family, type, kind, action] = k.split('\u0000');
    return { family, type: type as FailureType, kind, action, rawRows: new Set(rs.map(r => r.key)).size, uniqueAxes: new Set(rs.map(r => r.axis)).size,
      uniqueTemplates: new Set(rs.map(r => r.cluster)).size, axes: [...new Set(rs.map(r => r.axis))].sort() };
  }).sort((a, b) => a.family.localeCompare(b.family) || a.type.localeCompare(b.type) || a.kind.localeCompare(b.kind) || a.action.localeCompare(b.action));
}

// ---------------------------------------------------------------------------
// Markdown rendering of the per-family before-state (one row per family, no score)

interface MeasuredFamily {
  status: string; tier: string | null; target: string | null; debt: { cell: string; actual: number; required: number }[];
  twinPairs: number; twinFailures: number; benignFalseAlarms: number; metamorphicCriticalFailures: number; mutationUnresolvedCritical: number;
  differentialUnresolvedContractDisagreements: number; supportedContexts: string[]; empiricalMode: string | null;
  benchSpans: { spans: number; leaked: number; collateralBytes: number };
}
interface MeasuredMode { families: Record<string, MeasuredFamily>; failures: FailureSummary[] }
export interface AuditReportLike {
  families: FamilyIndependence[]; knownGaps: Record<string, { id: string; status: string }[]>;
  published: MeasuredMode | null; candidate: MeasuredMode | null;
}

const KIND = { 'must-redact': 'MR', policy: 'pol', 'must-not-flag': 'MNF' } as Record<string, string>;
/** `leak MR 7f/7ax` style cells: distinct fixtures / distinct axes per failure type, kind and action. */
export function failureCell(failures: FailureSummary[], family: string): string {
  const rows = failures.filter(f => f.family === family);
  if (!rows.length) return '—';
  return rows.map(f => `${f.type} ${KIND[f.kind] ?? f.kind}${f.action === 'none' ? '' : `·${f.action}`} ${f.rawRows}f/${f.uniqueAxes}ax`).join('; ');
}

export function renderFamilyTable(report: AuditReportLike): string {
  const header = '| Family | Tier | Status pub → cand | Profile target · candidate debt | Positives raw / ≤indep. / axes → indep. axes | Benign raw / axes | Twins raw (audit-flagged) | Failures, published | Failures, candidate | Twin fail. pub → cand | Metamorphic / mutation / differential, pub → cand | Supported contexts | Open known gaps |';
  const sep = '|' + ' --- |'.repeat(13);
  const lines = [header, sep];
  for (const f of report.families) {
    const p = report.published?.families[f.family], c = report.candidate?.families[f.family];
    const debt = c?.debt.length ? c.debt.map(d => `${d.cell} ${d.actual}/${d.required}`).join(', ') : 'none';
    const blockers = (m?: MeasuredFamily) => (m ? `${m.metamorphicCriticalFailures}/${m.mutationUnresolvedCritical}/${m.differentialUnresolvedContractDisagreements}` : '—');
    const contexts = c?.empiricalMode === 'context-constrained' ? `context-constrained (${c.supportedContexts.length})` : c?.empiricalMode ?? (c?.supportedContexts.length ? `${c.supportedContexts.length} listed` : 'bare-value contract');
    const gaps = (report.knownGaps[f.family] ?? []).filter(g => !['fixed'].includes(g.status)).map(g => `${g.id} (${g.status})`).join(', ') || '—';
    lines.push(`| \`${f.family}\` | ${c?.tier ?? p?.tier ?? '—'} | ${p?.status ?? '—'} → ${c?.status ?? '—'} | ${c?.target ?? '—'} · ${debt} | ${f.positives.raw} / ${f.positives.independentUpperBound} / ${f.positives.axes} → ${f.positives.independentAxes} | ${f.benign.raw} / ${f.benign.axes.length} | ${f.twins.raw} (${f.twins.flagged}) | ${report.published ? failureCell(report.published.failures, f.family) : '—'} | ${report.candidate ? failureCell(report.candidate.failures, f.family) : '—'} | ${p?.twinFailures ?? '—'} → ${c?.twinFailures ?? '—'} | ${blockers(p)} → ${blockers(c)} | ${contexts} | ${gaps} |`);
  }
  return lines.join('\n') + '\n';
}
