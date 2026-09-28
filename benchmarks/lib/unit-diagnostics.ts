import { createHash } from 'node:crypto';
import type { Range } from '../types.ts';
import { spanOutcome, bytesOutside, union, OUTCOMES } from './lattice.ts';

// Unit-safe diagnostics (#380). Measurement protocol v4 deliberately removed the
// mixed precision / recall / F1 export (docs/specs/measurement-v4.md §2.4). This
// module does not bring it back. It reports two separately-unitted diagnostics
// beside the authoritative v4 headline — never instead of it:
//
//   • must-redact and policy rows, in SECRET-SPAN units: the v4 detection lattice
//     outcome, and — separately — how many of the span's bytes survive in the
//     product's ACTUAL sanitized output (`scanAndRedact`, cross-checked against
//     `redact(input, scan(input))`). A `warn` finding is a detection, never a
//     sanitization success.
//   • must-not-flag rows, in FILE units: clean versus flagged, the flag split by
//     the strongest action it carried (`warn`/`allow` versus `redact`/`block`).
//
// The two unit families are never combined into a 2×2, and no ratio across them
// is ever computed. See docs/specs/unit-diagnostics.md.

export const UNIT_DIAGNOSTICS_SCHEMA_VERSION = 1;
export const DESTRUCTIVE = new Set(['redact', 'block']);
export const ACTIONS = ['redact', 'block', 'warn', 'allow'] as const;
/** The product's documented built-in placeholder: `<SECRET_1>`, `<SECRET_2>`, … in replacement order. */
export const PLACEHOLDER_FORMAT = 'default:<SECRET_n>';
const placeholder = (index: number) => `<SECRET_${index}>`;
export const SANITIZATION_STATES = ['removed', 'partial-leak', 'leaked'] as const;
export const ACTION_CLASSES = ['none', 'non-destructive', 'destructive', 'mixed'] as const;
export const CONTROL_STATES = ['clean', 'flagged-non-destructive', 'flagged-destructive'] as const;
/**
 * For a flagged control with a declared contract: did any finding belong to that
 * contract's family (or carry no family), or did only other, known families fire
 * (co-detection)? v4 scopes a twin's false alarm this way; the any-flag file unit
 * does not, so both readings are visible and reconcilable.
 */
export const ATTRIBUTIONS = ['own-or-unattributed', 'other-family-only'] as const;
export const FAILURE_STATES = ['scan-error', 'unstable', 'output-unverified'] as const;
/** Keys a unit-diagnostics report may never carry, anywhere (v4 §2.4; #380 contract). */
export const FORBIDDEN_KEYS = ['precision', 'recall', 'f1', 'accuracy', 'confusionMatrix', 'rank', 'ranking'];

export type ProductAction = (typeof ACTIONS)[number] | string;
/** One product finding, already converted to UTF-8 byte offsets. */
export interface ProductFinding extends Range { action: ProductAction; family?: string }
/** What one fixture produced when the product ran over it. */
export type ProductObservation =
  | { status: 'complete'; findings: ProductFinding[]; outputVerified: true; outputBytes: number; plaintextInOutput: boolean[] }
  | { status: (typeof FAILURE_STATES)[number]; code: string };

export interface DiagnosticFixture {
  category: string;
  id: string;
  kind: 'must-redact' | 'must-not-flag' | 'policy';
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  contract?: string;
  twinOf?: string;
  expected: (Range & { role?: string; envelope?: Range })[];
}

const utf16ToByte = (text: string, offset: number) => Buffer.byteLength(text.slice(0, offset));

/**
 * Run the product over one input and verify its actual sanitized output.
 * `api` is the loaded `@redact-secret/core` module (published or candidate).
 * The output is accepted only when it equals, byte for byte, the input with
 * exactly the `redact`/`block` findings replaced by the documented default
 * placeholder in order, and when `redact(input, scan(input))` agrees with
 * `scanAndRedact(input)`. Anything else fails closed as `output-unverified`,
 * which is never counted as sanitization success.
 */
export function observeProduct(
  api: { scan: (s: string) => readonly any[]; redact: (s: string, f: readonly any[]) => string; scanAndRedact: (s: string) => { text: string; findings: readonly any[] } },
  content: string,
  secretSpans: Range[],
  familyOf: (finding: any) => { family?: string } = () => ({}),
): ProductObservation {
  let first: { text: string; findings: readonly any[] }, second: { text: string; findings: readonly any[] }, scanned: readonly any[], redacted: string;
  try {
    first = api.scanAndRedact(content);
    second = api.scanAndRedact(content);
    scanned = api.scan(content);
    redacted = api.redact(content, scanned);
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    // Only a fixed error code survives: never the message, which a product must not but might echo input into.
    return { status: 'scan-error', code: typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'UNCLASSIFIED' };
  }
  const shape = (findings: readonly any[]) => JSON.stringify(findings.map(f => [f.start, f.end, f.action, f.type, f.detector]));
  if (first.text !== second.text || shape(first.findings) !== shape(second.findings)) return { status: 'unstable', code: 'REPLAY_DISAGREED' };
  if (shape(scanned) !== shape(first.findings)) return { status: 'output-unverified', code: 'SCAN_FINDINGS_DISAGREE' };
  if (redacted !== first.text) return { status: 'output-unverified', code: 'REDACT_OUTPUT_DISAGREES' };
  const replaced = first.findings.filter(f => DESTRUCTIVE.has(f.action)).map(f => ({ start: f.start as number, end: f.end as number })).sort((a, b) => a.start - b.start);
  let reconstruction = '', cursor = 0;
  for (const [index, r] of replaced.entries()) {
    if (r.start < cursor) return { status: 'output-unverified', code: 'OVERLAPPING_REPLACEMENTS' };
    reconstruction += content.slice(cursor, r.start) + placeholder(index + 1);
    cursor = r.end;
  }
  reconstruction += content.slice(cursor);
  if (reconstruction !== first.text) return { status: 'output-unverified', code: 'OUTPUT_RECONSTRUCTION_MISMATCH' };
  const bytes = Buffer.from(content);
  // Finding-free cross-check: does the whole plaintext of each secret span still occur anywhere in the output?
  const plaintextInOutput = secretSpans.map(s => first.text.includes(bytes.subarray(s.start, s.end).toString()));
  return {
    status: 'complete',
    findings: first.findings.map(f => ({
      start: utf16ToByte(content, f.start), end: utf16ToByte(content, f.end), action: String(f.action), ...familyOf(f),
    })),
    outputVerified: true,
    outputBytes: Buffer.byteLength(first.text),
    plaintextInOutput,
  };
}

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;
const actionClassOf = (actions: string[]) => {
  if (!actions.length) return 'none';
  const destructive = actions.filter(a => DESTRUCTIVE.has(a)).length;
  return destructive === 0 ? 'non-destructive' : destructive === actions.length ? 'destructive' : 'mixed';
};
const strongest = (actions: string[]) => (actions.includes('block') ? 'block' : actions.includes('redact') ? 'redact' : actions.includes('warn') ? 'warn' : actions.includes('allow') ? 'allow' : 'other');

export interface SpanUnit {
  /** v4 detection lattice outcome over every finding, any action. */
  detection: string;
  /** Actions of the findings overlapping the span. */
  actionClass: (typeof ACTION_CLASSES)[number];
  /** Secret bytes that survive in the verified sanitized output. */
  outputLeakedBytes: number;
  sanitization: (typeof SANITIZATION_STATES)[number];
  plaintextInOutput: boolean;
  bytes: number;
}

/** Every row names its segment (and family stratum, when it has one), so segments are recomputable from rows alone. */
type RowIdentity = { category: string; id: string; segment: string; family?: string };
export type DiagnosticRow = RowIdentity & (
  | { unit: 'secret-span'; status: 'complete'; spans: SpanUnit[]; outOfEnvelopeFindings: Record<string, number>; outputCollateralBytes: number; v4: { leakedBytes: number; collateralBytes: number } }
  | { unit: 'file'; status: 'complete'; state: (typeof CONTROL_STATES)[number]; findings: number; actionCounts: Record<string, number>; strongestAction: string | null; attribution?: (typeof ATTRIBUTIONS)[number]; twin?: true }
  | { unit: 'secret-span'; status: (typeof FAILURE_STATES)[number]; code: string; spans: number; secretBytes: number }
  | { unit: 'file'; status: (typeof FAILURE_STATES)[number]; code: string }
  | { unit: 'pending'; status: 'unscored' });

/** Diagnose one fixture from its observation. Pure; every field is recomputable from the row's inputs. */
export function diagnoseRow(fixture: DiagnosticFixture, observation: ProductObservation, domain: string): DiagnosticRow {
  const stratum = stratumOf(fixture, domain);
  const identity: RowIdentity = { category: fixture.category, id: fixture.id, segment: segmentKey(stratum), ...(stratum.scope === 'family' ? { family: fixture.contract } : {}) };
  if (fixture.tier === 'T0') return { ...identity, unit: 'pending', status: 'unscored' };
  const secrets = fixture.expected.filter(e => (e.role ?? 'secret') === 'secret');
  if (observation.status !== 'complete') return secrets.length
    ? { ...identity, unit: 'secret-span', status: observation.status, code: observation.code, spans: secrets.length, secretBytes: secrets.reduce((n, e) => n + e.end - e.start, 0) }
    : { ...identity, unit: 'file', status: observation.status, code: observation.code };
  const unit = secrets.length ? 'secret-span' : 'file';
  const findings = observation.findings;
  if (unit === 'file') {
    const actions = findings.map(f => f.action);
    const actionCounts = Object.fromEntries([...new Set(actions)].sort().map(a => [a, actions.filter(x => x === a).length]));
    const state = !findings.length ? 'clean' : actions.some(a => DESTRUCTIVE.has(a)) ? 'flagged-destructive' : 'flagged-non-destructive';
    const attribution = fixture.contract && findings.length
      ? (findings.every(f => f.family !== undefined && f.family !== fixture.contract) ? 'other-family-only' : 'own-or-unattributed') : undefined;
    return {
      ...identity, unit, status: 'complete', state, findings: findings.length, actionCounts, strongestAction: findings.length ? strongest(actions) : null,
      ...(attribution ? { attribution } : {}), ...(fixture.twinOf ? { twin: true as const } : {}),
    };
  }
  const replaced = union(findings.filter(f => DESTRUCTIVE.has(f.action)));
  const spans = secrets.map((span, index): SpanUnit => {
    const overlapping = findings.filter(f => overlaps(f, span)).map(f => f.action);
    const leaked = bytesOutside([span], replaced);
    const bytes = span.end - span.start;
    return {
      detection: spanOutcome({ ...span, role: 'secret' } as never, findings),
      actionClass: actionClassOf(overlapping),
      outputLeakedBytes: leaked,
      sanitization: leaked === 0 ? 'removed' : leaked === bytes ? 'leaked' : 'partial-leak',
      plaintextInOutput: observation.plaintextInOutput[index],
      bytes,
    };
  });
  const acceptable = fixture.expected.map(e => e.envelope ?? e);
  const outside = findings.filter(f => !acceptable.some(a => overlaps(a, f))).map(f => f.action);
  const outOfEnvelopeFindings = Object.fromEntries([...new Set(outside)].sort().map(a => [a, outside.filter(x => x === a).length]));
  const leakedBytes = secrets.reduce((n, e, i) => n + (['PARTIAL', 'MISS'].includes(spans[i].detection) ? bytesOutside([e], findings) : 0), 0);
  return {
    ...identity, unit, status: 'complete', spans, outOfEnvelopeFindings,
    outputCollateralBytes: bytesOutside(replaced, acceptable),
    v4: { leakedBytes, collateralBytes: bytesOutside(findings, acceptable) },
  };
}

/** Which stratum a fixture belongs to. Family strata and global untargeted controls never share a denominator. */
export function stratumOf(fixture: DiagnosticFixture, domain: string) {
  const positive = fixture.expected.some(e => (e.role ?? 'secret') === 'secret');
  const scope = fixture.contract ? 'family' : positive ? 'uncontracted' : 'global-untargeted';
  return { domain, kind: fixture.kind, tier: fixture.tier, scope };
}
export const segmentKey = (s: { domain: string; kind: string; tier: string; scope: string }) => `${s.domain}|${s.kind}/${s.tier}|${s.scope}`;

const zero = <T extends string>(keys: readonly T[]) => Object.fromEntries(keys.map(k => [k, 0])) as Record<T, number>;
function spanSegment() {
  return {
    unit: 'secret-span' as const, files: 0, eligibleSpans: 0, secretBytes: 0,
    detection: zero(OUTCOMES), sanitization: zero(SANITIZATION_STATES),
    sanitizationByActionClass: Object.fromEntries(ACTION_CLASSES.map(c => [c, zero(SANITIZATION_STATES)])) as Record<string, Record<string, number>>,
    detectionBySanitization: Object.fromEntries(OUTCOMES.map(o => [o, zero(SANITIZATION_STATES)])) as Record<string, Record<string, number>>,
    outputLeakedBytes: 0, plaintextInOutput: 0,
    failedSpans: zero(FAILURE_STATES),
    collateral: { filesWithOutOfEnvelopeFindings: 0, outOfEnvelopeFindings: {} as Record<string, number>, outputCollateralBytes: 0 },
    v4: { spans: 0, leakedSpans: 0, leakedBytes: 0, secretBytes: 0, collateralBytes: 0 },
  };
}
function fileSegment() {
  return {
    unit: 'file' as const, eligibleFiles: 0, states: zero(CONTROL_STATES), strongestAction: {} as Record<string, number>,
    flaggedAttribution: zero(ATTRIBUTIONS),
    /** v4's own control reading: a twin flagged only by other known families is co-detection, not a false alarm. */
    v4: { files: 0, flaggedFiles: 0 },
    findings: 0, failedFiles: zero(FAILURE_STATES),
  };
}
type SpanSegment = ReturnType<typeof spanSegment>;
type FileSegment = ReturnType<typeof fileSegment>;
export type Segment = { stratum: ReturnType<typeof stratumOf>; families?: Record<string, SpanSegment | FileSegment> } & (SpanSegment | FileSegment);

function addRow(target: SpanSegment | FileSegment, row: DiagnosticRow) {
  if (row.unit !== target.unit) throw new Error('unit-mismatch');
  if (target.unit === 'file') {
    target.eligibleFiles++;
    if (row.status !== 'complete') { target.failedFiles[row.status as (typeof FAILURE_STATES)[number]]++; return; }
    if (row.unit !== 'file') throw new Error('unit-mismatch');
    target.states[row.state]++;
    if (row.attribution) target.flaggedAttribution[row.attribution]++;
    target.v4.files++;
    if (row.findings && !(row.twin && row.attribution === 'other-family-only')) target.v4.flaggedFiles++;
    target.findings += row.findings;
    if (row.strongestAction) target.strongestAction[row.strongestAction] = (target.strongestAction[row.strongestAction] ?? 0) + 1;
    return;
  }
  if (row.unit !== 'secret-span') throw new Error('unit-mismatch');
  target.files++;
  if (row.status !== 'complete') {
    target.eligibleSpans += row.spans;
    target.secretBytes += row.secretBytes;
    target.failedSpans[row.status] += row.spans;
    return;
  }
  target.eligibleSpans += row.spans.length;
  target.secretBytes += row.spans.reduce((n, s) => n + s.bytes, 0);
  for (const s of row.spans) {
    target.detection[s.detection as keyof typeof target.detection]++;
    target.sanitization[s.sanitization]++;
    target.sanitizationByActionClass[s.actionClass][s.sanitization]++;
    target.detectionBySanitization[s.detection][s.sanitization]++;
    target.outputLeakedBytes += s.outputLeakedBytes;
    if (s.plaintextInOutput) target.plaintextInOutput++;
    target.v4.spans++;
    if (['PARTIAL', 'MISS'].includes(s.detection)) target.v4.leakedSpans++;
    target.v4.secretBytes += s.bytes;
  }
  target.v4.leakedBytes += row.v4.leakedBytes;
  target.v4.collateralBytes += row.v4.collateralBytes;
  const extra = Object.values(row.outOfEnvelopeFindings).reduce((n, c) => n + c, 0);
  if (extra) target.collateral.filesWithOutOfEnvelopeFindings++;
  for (const [a, c] of Object.entries(row.outOfEnvelopeFindings)) target.collateral.outOfEnvelopeFindings[a] = (target.collateral.outOfEnvelopeFindings[a] ?? 0) + c;
  target.collateral.outputCollateralBytes += row.outputCollateralBytes;
}

export function parseSegmentKey(key: string) {
  const m = /^([a-z]+)\|(must-redact|must-not-flag|policy)\/(T[0-3])\|(family|uncontracted|global-untargeted)$/.exec(key);
  if (!m) throw new Error(`invalid-segment-key:${key}`);
  return { domain: m[1], kind: m[2], tier: m[3], scope: m[4] };
}

/**
 * Aggregate rows into strata, from the rows alone. No cross-stratum, cross-kind,
 * cross-tier or cross-unit total is produced. Family strata partition a
 * `family`-scope segment; they are never merged with global untargeted controls.
 */
export function aggregateRows(rows: DiagnosticRow[]) {
  const segments: Record<string, Segment> = {};
  const pending: Record<string, number> = {};
  for (const row of rows) {
    const stratum = parseSegmentKey(row.segment);
    if (row.unit === 'pending') {
      if (stratum.tier !== 'T0') throw new Error(`pending-row-outside-T0:${row.id}`);
      pending[row.segment] = (pending[row.segment] ?? 0) + 1;
      continue;
    }
    if (stratum.tier === 'T0') throw new Error(`scored-T0-row:${row.id}`);
    if ((stratum.scope === 'family') !== (row.family !== undefined)) throw new Error(`family-stratum-mismatch:${row.id}`);
    const make = () => (row.unit === 'file' ? fileSegment() : spanSegment());
    const segment = (segments[row.segment] ??= { stratum, ...make() } as Segment);
    addRow(segment, row);
    if (row.family !== undefined) {
      segment.families ??= {};
      addRow((segment.families[row.family] ??= make()), row);
    }
  }
  // A family stratum carries the unit counts and the action split, not the segment-level cross-tabs.
  const slim = (f: any) => {
    const { detectionBySanitization: _d, plaintextInOutput: _p, collateral: _c, findings: _f, ...kept } = f;
    return kept;
  };
  const sorted = Object.fromEntries(Object.entries(segments).sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => [k, s.families
    ? { ...s, families: Object.fromEntries(Object.entries(s.families).sort(([a], [b]) => a.localeCompare(b)).map(([f, v]) => [f, slim(v)])) } : s]));
  return { segments: sorted, pending: Object.fromEntries(Object.entries(pending).sort()) };
}

const sum = (record: Record<string, number>) => Object.values(record).reduce((n, v) => n + v, 0);

/** Per-row consistency: the row's state follows from its own recorded fields. */
export function rowProblem(r: any): string | null {
  if (r.status !== 'complete') return null;
  if (r.unit === 'file') {
    const destructive = (r.actionCounts.redact ?? 0) + (r.actionCounts.block ?? 0) > 0;
    const expected = r.findings === 0 ? 'clean' : destructive ? 'flagged-destructive' : 'flagged-non-destructive';
    if (r.state !== expected || sum(r.actionCounts) !== r.findings) return `${r.category}/${r.id}: file state disagrees with its findings' actions`;
    return null;
  }
  for (const sp of r.spans ?? []) {
    // Warn cannot count as redaction success: `removed` requires a destructive finding on the span.
    if (sp.sanitization === 'removed' && sp.actionClass !== 'destructive' && sp.actionClass !== 'mixed') return `${r.category}/${r.id}: sanitized without a destructive finding`;
    const expected = sp.outputLeakedBytes === 0 ? 'removed' : sp.outputLeakedBytes === sp.bytes ? 'leaked' : 'partial-leak';
    if (sp.sanitization !== expected || sp.outputLeakedBytes < 0 || sp.outputLeakedBytes > sp.bytes) return `${r.category}/${r.id}: sanitization state disagrees with leaked bytes`;
    if (sp.detection === 'MISS' && sp.sanitization !== 'leaked') return `${r.category}/${r.id}: a missed span counted as sanitized`;
  }
  return null;
}

export const rowsDigestOf = (rows: unknown[]) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
/** Rows worth reading by name: anything not a clean control or a fully-removed, destructively-covered span. */
export function isNotable(r: any) {
  if (r.unit === 'pending') return false;
  if (r.status !== 'complete') return true;
  if (r.unit === 'file') return r.state !== 'clean';
  return r.spans.some((sp: SpanUnit) => sp.sanitization !== 'removed' || sp.detection === 'OVERBROAD') || r.outputCollateralBytes > 0 || sum(r.outOfEnvelopeFindings) > 0;
}

/**
 * Every invariant a unit-diagnostics report must satisfy; returns the first
 * problem or null. With `rows` (the `.rows.json` sidecar), segments are also
 * recomputed from the rows and must match exactly.
 */
export function reportProblem(report: any, rows?: any[]): string | null {
  if (!report || report.schemaVersion !== UNIT_DIAGNOSTICS_SCHEMA_VERSION) return `Unsupported unit-diagnostics schemaVersion ${report?.schemaVersion}`;
  if (!['published', 'candidate'].includes(report.mode)) return 'mode must be published or candidate';
  if ((report.mode === 'candidate') !== Boolean(report.product?.candidate)) return 'candidate identity must be present exactly in candidate mode';
  if (report.corpus?.pinned !== true) return 'corpus must be pinned and frozen';
  const forbidden = (value: unknown, path: string): string | null => {
    if (!value || typeof value !== 'object') return null;
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(k)) return `forbidden key ${path}.${k}`;
      // Category and family maps are keyed by corpus identifiers (e.g. the `accuracy` category), not by metric names.
      if (path === '$.corpus' && k === 'categories') continue;
      const nested = forbidden(v, `${path}.${k}`);
      if (nested) return nested;
    }
    return null;
  };
  const f = forbidden(report, '$');
  if (f) return f;
  for (const [key, s] of Object.entries<any>(report.segments ?? {})) {
    if (key !== segmentKey(s.stratum)) return `segment key ${key} disagrees with its stratum`;
    if (s.stratum.tier === 'T0') return `T0 segment ${key} must not be scored`;
    const parts = [s, ...Object.values<any>(s.families ?? {})];
    for (const p of parts) {
      if (p.unit !== s.unit) return `mixed units in ${key}`;
      if (s.unit === 'file') {
        if ('detection' in p || 'sanitization' in p) return `file-unit segment ${key} carries span-unit counts`;
        if (sum(p.states) + sum(p.failedFiles) !== p.eligibleFiles) return `${key}: file states do not sum to eligible files`;
        if (sum(p.strongestAction) !== p.states['flagged-destructive'] + p.states['flagged-non-destructive']) return `${key}: strongest-action split does not sum to flagged files`;
        const flaggedFiles = p.states['flagged-destructive'] + p.states['flagged-non-destructive'];
        if (sum(p.flaggedAttribution) !== (s.stratum.scope === 'family' ? flaggedFiles : 0)) return `${key}: family attribution does not sum to flagged files`;
        if (p.v4.files !== p.eligibleFiles - sum(p.failedFiles) || p.v4.flaggedFiles > flaggedFiles) return `${key}: v4 control reading disagrees with file units`;
        if ((p.strongestAction.redact ?? 0) + (p.strongestAction.block ?? 0) !== p.states['flagged-destructive']) return `${key}: destructive flags disagree with redact/block`;
      } else {
        if ('states' in p) return `span-unit segment ${key} carries file-unit counts`;
        const done = p.eligibleSpans - sum(p.failedSpans);
        if (sum(p.detection) !== done || sum(p.sanitization) !== done) return `${key}: span outcomes do not sum to eligible spans`;
        for (const cls of ACTION_CLASSES) if (!(cls in p.sanitizationByActionClass)) return `${key}: missing action class ${cls}`;
        if (sum(Object.values<any>(p.sanitizationByActionClass).map(sum) as never) !== done) return `${key}: action-class split does not sum`;
        // A warn/allow-only or unflagged span is a detection at most; it can never be a sanitization success.
        for (const cls of ['none', 'non-destructive']) if (p.sanitizationByActionClass[cls].removed || p.sanitizationByActionClass[cls]['partial-leak']) return `${key}: a ${cls} span counted as (partially) sanitized`;
        if (p === s || p.detectionBySanitization) {
          if (p.detectionBySanitization.MISS.removed || p.detectionBySanitization.MISS['partial-leak']) return `${key}: a missed span counted as sanitized`;
          for (const o of OUTCOMES) if (sum(p.detectionBySanitization[o]) !== p.detection[o]) return `${key}: detection × sanitization does not sum`;
        }
        if (p.v4.spans !== done || p.v4.leakedSpans !== p.detection.PARTIAL + p.detection.MISS) return `${key}: v4 leaked-span count disagrees with the detection lattice`;
        if (p.outputLeakedBytes < 0 || p.outputLeakedBytes > p.secretBytes) return `${key}: output leaked bytes out of range`;
      }
    }
    if (s.families) {
      const total = s.unit === 'file' ? 'eligibleFiles' : 'eligibleSpans';
      if (Object.values<any>(s.families).reduce((n, p) => n + p[total], 0) !== s[total]) return `${key}: family strata do not sum to the segment`;
    }
  }
  for (const r of report.notableRows ?? []) {
    if (!report.segments[r.segment]) return `notable row ${r.category}/${r.id} names an unknown segment`;
    const p = rowProblem(r);
    if (p) return p;
  }
  if (rows) {
    if (rowsDigestOf(rows) !== report.rowsDigest || rows.length !== report.rowCount) return 'rows do not match the report\'s rowsDigest';
    for (const r of rows) { const p = rowProblem(r); if (p) return p; }
    let recomputed;
    try { recomputed = aggregateRows(rows); } catch (error) { return `rows do not aggregate: ${(error as Error).message}`; }
    if (JSON.stringify(recomputed.segments) !== JSON.stringify(report.segments) || JSON.stringify(recomputed.pending) !== JSON.stringify(report.pending)) return 'segments are not the sum of their rows';
    const all = new Set(rows.map(r => JSON.stringify(r)));
    if ((report.notableRows ?? []).some((r: unknown) => !all.has(JSON.stringify(r)))) return 'a notable row is not among the rows';
    if (rows.filter(isNotable).length !== report.notableRows.length) return 'notable rows are incomplete';
  }
  if (report.digest !== digestOf(report)) return 'digest does not match report content';
  return null;
}

/**
 * Content digest over everything but wall-clock, host and benchmark-checkout fields, so two runs of
 * the same product over the same pinned corpus agree even from different benchmark commits.
 */
export function digestOf(report: any) {
  const { digest: _digest, generatedAt: _generatedAt, runtime: _runtime, provenance: _provenance, ...stable } = report;
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}
