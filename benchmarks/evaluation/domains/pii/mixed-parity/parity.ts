/**
 * Mechanical derivations and scoring for the #427 mixed-document parity plan.
 *
 * Everything here is a pure function of the frozen plan and the regenerated credential fixtures: document inputs,
 * LF/CRLF variants, offsets in the three range units the surfaces report (UTF-8 bytes, UTF-16 code units, Unicode
 * code points), the expected findings and sanitized bytes for every selection and optional-target choice, and the
 * chunk partitions. Partitions, variants, selections, operations and surfaces are checks on the same documents; only
 * documents and their targets are independent units.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CREDENTIAL_SOURCE, MIXED_PARITY_PLAN_FILE, REPLACING_ACTIONS, type MixedParityPlan } from './authoring.ts';

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const byteLength = (value: string) => Buffer.byteLength(value, 'utf8');
export const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export type Selection = 'pii-on' | 'pii-off';
export type Variant = 'lf' | 'crlf';
export type RangeUnit = 'utf8-bytes' | 'utf16-code-units' | 'unicode-code-points';
export const SELECTIONS: Selection[] = ['pii-on', 'pii-off'];
export const VARIANTS: Variant[] = ['lf', 'crlf'];

export interface Target {
  id: string; domain: 'pii' | 'credential'; start: number; end: number; type?: string; family?: string;
  action?: 'redact' | 'warn'; actions?: string[]; optional: boolean; knownDefect?: string; envelope?: string;
}
export interface MaterializedDocument { id: string; input: string; targets: Target[]; lineCount: number }

export function loadPlan(file = MIXED_PARITY_PLAN_FILE): MixedParityPlan { return JSON.parse(readFileSync(file, 'utf8')); }
export const planCommitment = (plan: MixedParityPlan) => sha256(canonical(plan));

export function loadCredentialFixtures(file: string = CREDENTIAL_SOURCE.path) {
  const corpus = JSON.parse(readFileSync(file, 'utf8'));
  return new Map<string, { content: string; expected: Array<{ start: number; end: number }> }>(
    corpus.fixtures.map((row: { id: string; content: string; expected: Array<{ start: number; end: number }> }) => [row.id, { content: row.content, expected: row.expected }]));
}

/** Materialize every document (LF, as authored). Credential lines are regenerated and bound to their frozen digest. */
export function materialize(plan: MixedParityPlan, credentials = loadCredentialFixtures()): MaterializedDocument[] {
  return plan.documents.map(document => {
    let offset = 0; const texts: string[] = []; const targets: Target[] = [];
    for (const line of document.lines as Array<Record<string, any>>) {
      let text: string;
      if (line.credentialFixture) {
        const fixture = credentials.get(line.credentialFixture);
        if (!fixture) throw new Error(`credential fixture ${line.credentialFixture} is not generated`);
        text = fixture.content.replace(/\n+$/, '');
        if (sha256(text) !== line.contentSha256) throw new Error(`credential fixture ${line.credentialFixture} drifted from the frozen digest`);
      } else text = line.text;
      for (const target of line.targets) targets.push({ ...target, start: offset + target.start, end: offset + target.end, optional: false });
      for (const target of line.optional) targets.push({ ...target, start: offset + target.start, end: offset + target.end, optional: true });
      texts.push(text); offset += byteLength(text) + 1;
    }
    targets.sort((a, b) => a.start - b.start || a.end - b.end);
    return { id: document.id, input: `${texts.join('\n')}\n`, targets, lineCount: texts.length };
  });
}

/** The CRLF variant: every LF becomes CRLF; every UTF-8 offset shifts by the LFs before it. */
export function variantOf(document: MaterializedDocument, variant: Variant): MaterializedDocument {
  if (variant === 'lf') return document;
  const bytes = Buffer.from(document.input, 'utf8');
  const shift = (offset: number) => { let count = 0; for (let index = 0; index < offset; index += 1) if (bytes[index] === 0x0a) count += 1; return offset + count; };
  return { ...document, input: document.input.replace(/\n/g, '\r\n'), targets: document.targets.map(target => ({ ...target, start: shift(target.start), end: shift(target.end) })) };
}

/** Offset tables from UTF-8 bytes to each unit (and back). Only offsets on a code-point boundary are defined. */
export function offsetTables(input: string) {
  const utf8ToOther = new Map<number, { utf16: number; codePoint: number }>();
  let utf8 = 0, utf16 = 0, codePoint = 0;
  for (const char of input) { utf8ToOther.set(utf8, { utf16, codePoint }); utf8 += byteLength(char); utf16 += char.length; codePoint += 1; }
  utf8ToOther.set(utf8, { utf16, codePoint });
  const fromUnit = new Map<RangeUnit, Map<number, number>>([['utf8-bytes', new Map()], ['utf16-code-units', new Map()], ['unicode-code-points', new Map()]]);
  for (const [byte, other] of utf8ToOther) {
    fromUnit.get('utf8-bytes')!.set(byte, byte); fromUnit.get('utf16-code-units')!.set(other.utf16, byte); fromUnit.get('unicode-code-points')!.set(other.codePoint, byte);
  }
  return {
    toUnit(offset: number, unit: RangeUnit) {
      const other = utf8ToOther.get(offset); if (!other) throw new Error('offset is not on a code-point boundary');
      return unit === 'utf8-bytes' ? offset : unit === 'utf16-code-units' ? other.utf16 : other.codePoint;
    },
    toUtf8(offset: number, unit: RangeUnit) { return fromUnit.get(unit)!.get(offset) ?? null; },
    codePoints: codePoint,
  };
}

const replacing = (action: string) => (REPLACING_ACTIONS as readonly string[]).includes(action);

/** Required targets for a selection, plus the optional targets that are eligible for it. */
export function targetsFor(document: MaterializedDocument, selection: Selection) {
  const active = document.targets.filter(target => target.domain === 'credential' || selection === 'pii-on');
  return { required: active.filter(target => !target.optional), optional: active.filter(target => target.optional) };
}

/** Render the expected sanitized text for a set of targets (default `<SECRET_n>` formatter). */
export function renderExpected(input: string, targets: Array<{ start: number; end: number; action: string }>) {
  const bytes = Buffer.from(input, 'utf8'); let cursor = 0, index = 0; const parts: Buffer[] = [];
  for (const target of [...targets].sort((a, b) => a.start - b.start)) {
    if (!replacing(target.action)) continue;
    parts.push(bytes.subarray(cursor, target.start), Buffer.from(`<SECRET_${++index}>`)); cursor = target.end;
  }
  parts.push(bytes.subarray(cursor));
  return Buffer.concat(parts).toString('utf8');
}

/** Expected output for a selection and a chosen subset of optional targets. Credentials render with `redact`. */
export function expectedOutput(document: MaterializedDocument, selection: Selection, chosenOptional: string[] = []) {
  const { required, optional } = targetsFor(document, selection);
  const chosen = optional.filter(target => chosenOptional.includes(target.id));
  return renderExpected(document.input, [...required, ...chosen].map(target => ({ start: target.start, end: target.end, action: target.action ?? 'redact' })));
}

/** Deterministic partitions, as cut positions in Unicode code points (never inside a code point). */
export function partitions(document: MaterializedDocument, variant: Variant) {
  const tables = offsetTables(document.input), n = tables.codePoints;
  const cp = (byte: number) => tables.toUnit(byte, 'unicode-code-points');
  const clean = (cuts: number[]) => [...new Set(cuts)].filter(cut => cut > 0 && cut < n).sort((a, b) => a - b);
  const rows: Array<{ id: string; kind: string; cuts: number[] }> = [
    { id: 'single', kind: 'single', cuts: [] },
    { id: 'every-code-point', kind: 'every-code-point', cuts: clean(Array.from({ length: n }, (_, index) => index)) },
    { id: 'inside-every-target', kind: 'inside-every-target', cuts: clean(document.targets.map(target => Math.floor((cp(target.start) + cp(target.end)) / 2))) },
  ];
  for (const target of document.targets) {
    const start = cp(target.start), end = cp(target.end);
    for (const [label, cut] of [['start', start], ['start+1', start + 1], ['mid', Math.floor((start + end) / 2)], ['end-1', end - 1], ['end', end]] as const)
      rows.push({ id: `${target.id}@${label}`, kind: 'target-boundary', cuts: clean([cut]) });
  }
  if (variant === 'crlf') {
    const cuts: number[] = []; let index = 0;
    for (const char of document.input) { if (char === '\n') cuts.push(index); index += 1; }
    rows.push({ id: 'between-cr-and-lf', kind: 'crlf-split', cuts: clean(cuts) });
  }
  for (let k = 1; k <= 3; k += 1) {
    let state = createHash('sha256').update(`${document.id}/${variant}/${k}`).digest(); const cuts: number[] = [];
    for (let draw = 0; draw < Math.max(4, Math.floor(n / 24)); draw += 1) {
      state = createHash('sha256').update(state).digest(); cuts.push(state.readUInt32BE(0) % n);
    }
    rows.push({ id: `seeded-${k}`, kind: 'seeded', cuts: clean(cuts) });
  }
  // Duplicate cut sets (a boundary partition equal to another) are kept once, under the first id.
  const seen = new Set<string>();
  return rows.filter(row => { const key = row.cuts.join(','); if (seen.has(key)) return false; seen.add(key); return true; });
}

// ---------------------------------------------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------------------------------------------

export interface ObservedFinding { type: string; detector: string; action: string; confidence: string | null; start: number; end: number; native?: [number, number] }
export interface ObservedOperation {
  status: 'ok' | 'error' | 'not-applicable'; errorCode?: string; reason?: string;
  findings?: ObservedFinding[] | null; outputSha256?: string | null; valueLeft?: string[]; rangeUnitErrors?: number;
}

const isPii = (type: string) => type.startsWith('pii_');

/** Score one observed operation against the plan expectation for its document variant and selection. */
export function scoreOperation(document: MaterializedDocument, selection: Selection, observed: ObservedOperation) {
  if (observed.status !== 'ok') return { status: observed.status, errorCode: observed.errorCode ?? null, reason: observed.reason ?? null };
  const { required, optional } = targetsFor(document, selection);
  const matched = new Set<string>(), chosen: string[] = [];
  const wrong: string[] = [], unexpected = { pii: 0, credential: 0 }, unexpectedTypes: Record<string, number> = {};
  for (const finding of observed.findings ?? []) {
    const domain = isPii(finding.type) ? 'pii' : 'credential';
    const same = (target: Target) => target.domain === domain && target.start === finding.start && target.end === finding.end;
    const hit = required.find(same) ?? optional.find(same);
    if (!hit) { unexpected[domain] += 1; unexpectedTypes[finding.type] = (unexpectedTypes[finding.type] ?? 0) + 1; continue; }
    const correct = domain === 'credential' ? replacing(finding.action) : finding.type === hit.type && finding.action === hit.action;
    if (!correct) { wrong.push(hit.id); continue; }
    if (hit.optional) chosen.push(hit.id); else matched.add(hit.id);
  }
  const missing = required.filter(target => !matched.has(target.id) && !wrong.includes(target.id)).map(target => target.id);
  const findingsCorrect = observed.findings === null || observed.findings === undefined ? null
    : !missing.length && !wrong.length && !unexpected.pii && !unexpected.credential;
  const expectedSha = sha256(expectedOutput(document, selection, chosen));
  const outputCorrect = observed.outputSha256 === undefined || observed.outputSha256 === null ? null : observed.outputSha256 === expectedSha;
  const domainRows = (domain: 'pii' | 'credential') => ({
    required: required.filter(target => target.domain === domain).length,
    matched: required.filter(target => target.domain === domain && matched.has(target.id)).length,
    missing: missing.filter(id => required.find(target => target.id === id)!.domain === domain),
    wrong: wrong.filter(id => [...required, ...optional].find(target => target.id === id)!.domain === domain),
    unexpected: unexpected[domain],
  });
  const warnRetained = required.filter(target => target.action === 'warn').map(target => target.id);
  const replacingRequired = required.filter(target => target.action !== 'warn');
  const leaked = (observed.valueLeft ?? []).filter(id => replacingRequired.some(target => target.id === id));
  return {
    status: 'ok' as const, findingsCorrect, outputCorrect, chosenOptional: chosen.sort(),
    pii: selection === 'pii-on' ? domainRows('pii') : { ...domainRows('pii'), piiFindingsWhileOff: unexpected.pii },
    credential: domainRows('credential'), unexpectedTypes,
    valueLeftAfterReplacement: leaked, warnRetained,
    // Sanitized success needs the expected bytes and no sensitive value left behind: a `warn` target is never sanitized.
    sanitized: outputCorrect === true && !leaked.length && !warnRetained.length,
    rangeUnitErrors: observed.rangeUnitErrors ?? 0,
  };
}

/** A surface-independent signature of an operation's visible behaviour (findings in UTF-8, output digest, error). */
export function signature(observed: ObservedOperation, include: { findings: boolean; output: boolean }) {
  if (observed.status !== 'ok') return `${observed.status}:${observed.errorCode ?? observed.reason ?? ''}`;
  const findings = include.findings && observed.findings ? observed.findings.map(row => [row.type, row.detector, row.action, row.confidence, row.start, row.end]) : null;
  return sha256(canonical({ findings, output: include.output ? observed.outputSha256 ?? null : null }));
}

/**
 * Attach the frozen expectations to a built plan: for every document, variant and selection the expected targets in
 * all three range units and the SHA-256 of the expected sanitized bytes (with no optional target and with all of
 * them). The LF `pii-on` bytes without optional targets are stored literally; they contain placeholders, never a
 * credential value.
 */
export function freezeExpectations(plan: MixedParityPlan, credentials = loadCredentialFixtures()) {
  const { expected: _drop, ...base } = plan as MixedParityPlan & { expected?: unknown };
  const documents = materialize(base as MixedParityPlan, credentials);
  const expected = Object.fromEntries(documents.map(document => [document.id, Object.fromEntries(VARIANTS.map(variant => {
    const shaped = variantOf(document, variant), tables = offsetTables(shaped.input);
    const targets = shaped.targets.map(target => ({ id: target.id, domain: target.domain, optional: target.optional, start: target.start, end: target.end,
      utf16: [tables.toUnit(target.start, 'utf16-code-units'), tables.toUnit(target.end, 'utf16-code-units')],
      codePoints: [tables.toUnit(target.start, 'unicode-code-points'), tables.toUnit(target.end, 'unicode-code-points')] }));
    const bySelection = Object.fromEntries(SELECTIONS.map(selection => {
      const { required, optional } = targetsFor(shaped, selection);
      const none = expectedOutput(shaped, selection, []), all = expectedOutput(shaped, selection, optional.map(target => target.id));
      return [selection, { requiredTargets: required.map(target => target.id), optionalTargets: optional.map(target => target.id),
        outputSha256: sha256(none), outputSha256AllOptional: sha256(all),
        ...(variant === 'lf' && selection === 'pii-on' ? { output: none } : {}) }];
    }));
    return [variant, { inputSha256: sha256(shaped.input), utf8Bytes: byteLength(shaped.input), utf16CodeUnits: shaped.input.length, codePoints: tables.codePoints,
      targets, selections: bySelection }];
  }))]));
  return { ...base, expected };
}
