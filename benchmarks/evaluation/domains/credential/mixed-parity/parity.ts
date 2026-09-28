/**
 * Mechanical derivations and scoring for the #381 credential mixed-document parity plan.
 *
 * Everything here is a pure function of the frozen plan and the regenerated corpora: document inputs, LF/CRLF
 * variants, offsets in the three range units the surfaces report (via the #427 offset tables), chunk partitions and
 * the scoring of one observed operation. Variants, partitions, operations and surfaces are checks on the same
 * documents; only documents and their targets are independent units.
 */
import { createHash } from 'node:crypto';
import { offsetTables, canonical } from '../../pii/mixed-parity/parity.ts';
import { oversizedFiller, sha256, wrapFixture, type CorpusMap, type CredentialMixedParityPlan, type PlanTarget } from './authoring.ts';

export { offsetTables, canonical, sha256 };
export type Variant = 'lf' | 'crlf';
export const VARIANTS: Variant[] = ['lf', 'crlf'];
export const REPLACING_ACTIONS = ['redact', 'block'];
const replacing = (action: string) => REPLACING_ACTIONS.includes(action);
const byteLength = (value: string) => Buffer.byteLength(value, 'utf8');

export interface Span { start: number; end: number }
export interface Target extends Span { id: string; family: string; kind: 'must-redact' | 'policy'; envelope?: Span; line: number }
export interface LineRange extends Span { index: number; role: string; family?: string; fixture?: string }
export interface MaterializedDocument { id: string; input: string; targets: Target[]; companions: Span[]; lines: LineRange[] }

export function loadPlan(file: string, read: (file: string) => string): CredentialMixedParityPlan { return JSON.parse(read(file)); }
export const planCommitment = (plan: CredentialMixedParityPlan) => sha256(canonical(plan));

/** Materialize every document (LF). Fixture lines are regenerated, re-wrapped and bound to their frozen digests. */
export function materialize(plan: CredentialMixedParityPlan, corpora: CorpusMap): MaterializedDocument[] {
  const byKey = new Map<string, ReturnType<CorpusMap['get']> extends Array<infer F> | undefined ? F : never>();
  for (const [category, fixtures] of corpora) for (const f of fixtures) byKey.set(`${category}--${f.id}`, f);
  return plan.documents.map(document => {
    let offset = 0; const texts: string[] = []; const targets: Target[] = []; const companions: Span[] = []; const lines: LineRange[] = [];
    document.lines.forEach((line, index) => {
      let text: string;
      if ('fixture' in line) {
        const fixture = byKey.get(line.fixture);
        if (!fixture) throw new Error(`${line.fixture} is not generated`);
        if (sha256(fixture.content) !== line.contentSha256) throw new Error(`${line.fixture} drifted from its frozen digest`);
        text = wrapFixture(fixture, line.wrap).text;
        if (sha256(text) !== line.lineSha256) throw new Error(`${line.fixture} (${line.wrap}) drifted from its frozen line digest`);
        for (const t of line.targets as PlanTarget[]) targets.push({ id: t.id, family: t.family, kind: t.kind, start: offset + t.start, end: offset + t.end, line: index,
          ...(t.envelope ? { envelope: { start: offset + t.envelope.start, end: offset + t.envelope.end } } : {}) });
        for (const c of line.companions) companions.push({ start: offset + c.start, end: offset + c.end });
        lines.push({ index, role: line.role, family: line.family, fixture: line.fixture, start: offset, end: offset + byteLength(text) });
      } else if ('filler' in line) {
        text = oversizedFiller(line.from + line.count).slice(line.from).join('\n');
        lines.push({ index, role: line.role, start: offset, end: offset + byteLength(text) });
      } else {
        text = line.text;
        lines.push({ index, role: line.role, start: offset, end: offset + byteLength(text) });
      }
      texts.push(text); offset += byteLength(text) + 1;
    });
    return { id: document.id, input: `${texts.join('\n')}\n`, targets, companions, lines };
  });
}

/** The CRLF variant: every LF becomes CRLF; every UTF-8 offset shifts by the LFs before it. */
export function variantOf(document: MaterializedDocument, variant: Variant): MaterializedDocument {
  if (variant === 'lf') return document;
  const bytes = Buffer.from(document.input, 'utf8');
  const before: number[] = new Array(bytes.length + 1); let count = 0;
  for (let index = 0; index <= bytes.length; index += 1) { before[index] = count; if (bytes[index] === 0x0a) count += 1; }
  const shift = (offset: number) => offset + before[offset];
  const move = <T extends Span>(span: T): T => ({ ...span, start: shift(span.start), end: shift(span.end) });
  return { ...document, input: document.input.replace(/\n/g, '\r\n'),
    targets: document.targets.map(t => ({ ...move(t), ...(t.envelope ? { envelope: move(t.envelope) } : {}) })),
    companions: document.companions.map(move), lines: document.lines.map(move) };
}

/** Code points above which the one-code-point-per-chunk partition is skipped (it would dominate run time, not coverage). */
export const EVERY_CODE_POINT_LIMIT = 20_000;
/** Cuts at every position of the first `PREFIX_SWEEP` code points of a target: the prefix, its delimiters and the body start. */
export const PREFIX_SWEEP = 16;

/** Deterministic partitions, as cut positions in Unicode code points (never inside a code point). */
export function partitions(document: MaterializedDocument, variant: Variant) {
  const tables = offsetTables(document.input), n = tables.codePoints;
  const cp = (byte: number) => tables.toUnit(byte, 'unicode-code-points');
  const clean = (cuts: number[]) => [...new Set(cuts)].filter(cut => cut > 0 && cut < n).sort((a, b) => a - b);
  const rows: Array<{ id: string; kind: string; cuts: number[] }> = [
    { id: 'single', kind: 'single', cuts: [] },
    ...(n <= EVERY_CODE_POINT_LIMIT ? [{ id: 'every-code-point', kind: 'every-code-point', cuts: clean(Array.from({ length: n }, (_, index) => index)) }] : []),
    { id: 'inside-every-target', kind: 'inside-every-target', cuts: clean(document.targets.map(t => Math.floor((cp(t.start) + cp(t.end)) / 2))) },
  ];
  for (const target of document.targets) {
    const start = cp(target.start), end = cp(target.end);
    // The prefix sweep: one partition per cut position inside the prefix, delimiter and body start.
    for (let k = 0; k <= Math.min(PREFIX_SWEEP, end - start); k += 1) rows.push({ id: `${target.id}@start+${k}`, kind: 'target-prefix', cuts: clean([start + k]) });
    for (const [label, cut] of [['mid', Math.floor((start + end) / 2)], ['end-1', end - 1], ['end', end]] as const)
      rows.push({ id: `${target.id}@${label}`, kind: 'target-boundary', cuts: clean([cut]) });
  }
  if (variant === 'crlf') {
    const cuts: number[] = []; let index = 0;
    for (const char of document.input) { if (char === '\n') cuts.push(index); index += 1; }
    rows.push({ id: 'between-cr-and-lf', kind: 'crlf-split', cuts: clean(cuts) });
  }
  for (let k = 1; k <= 3; k += 1) {
    let state = createHash('sha256').update(`${document.id}/${variant}/${k}`).digest(); const cuts: number[] = [];
    for (let draw = 0; draw < Math.max(4, Math.min(512, Math.floor(n / 24))); draw += 1) {
      state = createHash('sha256').update(state).digest(); cuts.push(state.readUInt32BE(0) % n);
    }
    rows.push({ id: `seeded-${k}`, kind: 'seeded', cuts: clean(cuts) });
  }
  const seen = new Set<string>();
  return rows.filter(row => { const key = row.cuts.join(','); if (seen.has(key)) return false; seen.add(key); return true; });
}

/**
 * Byte-level partitions for the byte-input stream adapters (Node `Transform`, Web `TransformStream`): the same cut
 * positions in UTF-8 bytes, plus one partition that cuts inside every multi-byte character.
 */
export function bytePartitions(document: MaterializedDocument, variant: Variant) {
  const tables = offsetTables(document.input);
  const toByte = (cut: number) => tables.toUtf8(cut, 'unicode-code-points')!;
  const rows = partitions(document, variant).map(row => ({ id: row.id, kind: row.kind, cuts: row.cuts.map(toByte) }));
  const bytes = Buffer.from(document.input, 'utf8'), inside: number[] = [];
  for (let index = 1; index < bytes.length; index += 1) if ((bytes[index] & 0xc0) === 0x80 && (bytes[index - 1] & 0xc0) !== 0x80) inside.push(index);
  if (inside.length) rows.push({ id: 'inside-every-multibyte-char', kind: 'utf8-split', cuts: inside });
  return rows;
}

export interface ObservedFinding { type: string; detector: string; action: string; confidence: string | null; start: number; end: number }

/** Render sanitized text for a set of replacing spans (default `<SECRET_n>` formatter). */
export function render(input: string, spans: Array<Span & { action: string }>) {
  const bytes = Buffer.from(input, 'utf8'); let cursor = 0, index = 0; const parts: Buffer[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (!replacing(span.action) || span.start < cursor) continue;
    parts.push(bytes.subarray(cursor, span.start), Buffer.from(`<SECRET_${++index}>`)); cursor = span.end;
  }
  parts.push(bytes.subarray(cursor));
  return Buffer.concat(parts).toString('utf8');
}

/** The reference sanitized text: every target (and nothing else) replaced exactly. */
export const referenceOutput = (document: MaterializedDocument) => render(document.input, document.targets.map(t => ({ start: t.start, end: t.end, action: 'redact' })));

export type TargetOutcome = 'exact' | 'envelope' | 'warn-only' | 'partial' | 'miss';

/** Classify findings (UTF-8 ranges) against the document's targets, envelopes and companions. */
export function scoreFindings(document: MaterializedDocument, findings: ObservedFinding[]) {
  const outcome: Record<string, TargetOutcome> = {};
  const unexpected: Array<{ role: string; family: string | null; replacing: boolean; bytes: number; detector: string }> = [];
  for (const t of document.targets) outcome[t.id] = 'miss';
  const rank: Record<TargetOutcome, number> = { miss: 0, partial: 1, 'warn-only': 2, envelope: 3, exact: 4 };
  const set = (id: string, value: TargetOutcome) => { if (rank[value] > rank[outcome[id]]) outcome[id] = value; };
  for (const f of findings) {
    let claimed = false;
    for (const t of document.targets) {
      const covers = f.start <= t.start && f.end >= t.end;
      const exact = f.start === t.start && f.end === t.end;
      const inEnvelope = t.envelope ? covers && f.start >= t.envelope.start && f.end <= t.envelope.end : false;
      if (exact || inEnvelope) { set(t.id, !replacing(f.action) ? 'warn-only' : exact ? 'exact' : 'envelope'); claimed = true; }
      else if (f.start < t.end && f.end > t.start) { set(t.id, 'partial'); claimed = true; }
    }
    if (claimed) continue;
    if (document.companions.some(c => f.start >= c.start && f.end <= c.end)) continue;
    const line = document.lines.find(l => f.start >= l.start && f.start < l.end);
    unexpected.push({ role: line?.role ?? 'unknown', family: line?.family ?? null, replacing: replacing(f.action), bytes: f.end - f.start, detector: f.detector });
  }
  return { outcome, unexpected };
}

/** A target value is left behind when the output holds more copies of it than the reference output does. */
export function leakedTargets(document: MaterializedDocument, output: string) {
  const reference = referenceOutput(document);
  const occurrences = (text: string, value: string) => text.split(value).length - 1;
  return document.targets.filter(t => {
    const value = Buffer.from(document.input, 'utf8').subarray(t.start, t.end).toString('utf8');
    return occurrences(output, value) > occurrences(reference, value);
  }).map(t => t.id);
}

/** A surface-independent signature of visible behaviour (findings in UTF-8, output digest, error). */
export function signature(op: { status: string; errorCode?: string | null; findings?: ObservedFinding[] | null; outputSha256?: string | null }, include = { findings: true, output: true }) {
  if (op.status !== 'ok') return `${op.status}:${op.errorCode ?? ''}`;
  const findings = include.findings && op.findings ? op.findings.map(f => [f.type, f.detector, f.action, f.start, f.end]) : null;
  return sha256(canonical({ findings, output: include.output ? op.outputSha256 ?? null : null }));
}
