/**
 * Score-evasion and negative-evidence abuse evaluation (#289).
 *
 * Treats the shadow evidence scorer as attacker-known and reshapes reviewed,
 * synthetic development and regression fixtures with deterministic mutation
 * operators, one family per attack class the #257 promotion contract fixes.
 * The variants run through the product's maintainer-local shadow evaluation
 * path (redact-secret#771) and a plain product scan, and this module turns the
 * two outputs into the one publishable shape,
 * schemas/score-evasion-aggregate-v1.json.
 *
 * Publication boundary (docs/specs/score-evasion.md §5): the operator
 * families below are generic and their parameters are small enumerations.
 * Which variant moved which band, the scores, signals and the recipes that
 * succeeded are written only to the git-ignored results-output/ directory.
 * Holdout is never read: bases come from `loadCategoryInputs`, which opens the
 * development and regression manifests only.
 */
import { createHash } from 'node:crypto';
import { ATTACK_CLASSES_289 } from './scorer-promotion.ts';
import { canonicalJson } from './adversarial-intake.ts';
import type { CategoryInput } from './candidate-features.ts';

export const OPERATOR_SET_VERSION = 'score-evasion-operators/1';
export const EVALUATION_VERSION = 'score-evasion/1';
export const NON_PUBLIC_ROOT = 'results-output';
export const DEFAULT_OUTPUT_DIR = 'results-output/score-evasion';
export const SHADOW_FORMAT = 'redact-secret/shadow-evaluation/1';
/** Specificities the scorer is never consulted for (product ADR §5). */
export const PROTECTED_SPECIFICITIES = ['private-key', 'provider', 'structural'] as const;
/** The shadow band at or above which a statistical finding counts as flagged under the candidate projection (§3 of the spec). */
const BAND_ORDER = ['none', 'low', 'medium', 'high'] as const;
export type Band = typeof BAND_ORDER[number];
export const PROJECTION_CUT: Band = 'medium';
export const bandRank = (band: string) => BAND_ORDER.indexOf(band as Band);

export type AttackClass = typeof ATTACK_CLASSES_289[number];
export type Expectation = 'must-redact' | 'control';
export type BaseAuthority = 'statistical' | 'deterministic';

const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
const bytes = (s: string) => Buffer.byteLength(s);

// ---------------------------------------------------------------------------
// Bases.

/** A reviewed fixture with one value to reshape: a must-redact secret span, or a control's longest token. */
export interface BaseCandidate {
  id: string;
  category: string;
  partition: 'development' | 'regression';
  expectation: Expectation;
  content: string;
  /** UTF-8 byte range of the value inside `content`. */
  range: { start: number; end: number };
}

export interface Base extends BaseCandidate {
  /** How the unmutated base was detected by the product: which specificity covers the value, if any. */
  specificity: string | null;
  authority: BaseAuthority | null;
  /** The base's shadow band on its covering finding (maintainer-local only). */
  band: string | null;
}

/** Longest value the operators reshape; longer values are left out as bases (not as variants). */
const MAX_BASE_VALUE_CHARS = 200;
const MIN_BASE_VALUE_CHARS = 12;
const MAX_BASE_CONTENT_BYTES = 4096;

const TOKEN_DELIMITERS = new Set(['"', "'", '`', '=', ':', ',', ';', '(', ')', '[', ']', '{', '}', '<', '>']);
function longestToken(content: string): { start: number; end: number } | null {
  let best: { start: number; end: number; length: number } | null = null;
  let offset = 0, tokenStart = -1, length = 0;
  const close = (at: number) => {
    if (tokenStart >= 0 && (!best || length > best.length)) best = { start: tokenStart, end: at, length };
    tokenStart = -1; length = 0;
  };
  for (const symbol of content) {
    if (/^\s$/u.test(symbol) || TOKEN_DELIMITERS.has(symbol)) close(offset);
    else { if (tokenStart < 0) tokenStart = offset; length++; }
    offset += bytes(symbol);
  }
  close(offset);
  const found = best as { start: number; end: number } | null;
  return found ? { start: found.start, end: found.end } : null;
}

const byteSlice = (content: string, start: number, end: number) => Buffer.from(content).subarray(start, end).toString();

/**
 * Candidate bases from the development and regression categories. Reviewed
 * fixtures only (tier T0 is pending review), one secret span for a positive,
 * no expected span for a control, bounded sizes. Holdout is never an input.
 */
export function baseCandidates(inputs: CategoryInput[]): BaseCandidate[] {
  const out: BaseCandidate[] = [];
  for (const input of inputs) {
    for (const f of input.fixtures) {
      const a = f.assessment;
      if (!a || a.tier === 'T0' || bytes(f.content) > MAX_BASE_CONTENT_BYTES) continue;
      let expectation: Expectation, range: { start: number; end: number } | null;
      if (a.kind === 'must-not-flag' && f.expected.length === 0) { expectation = 'control'; range = longestToken(f.content); }
      else if ((a.kind === 'must-redact' || a.kind === 'policy') && f.expected.length === 1 && (f.expected[0].role ?? 'secret') === 'secret') {
        expectation = 'must-redact'; range = { start: f.expected[0].start, end: f.expected[0].end };
      } else continue;
      if (!range) continue;
      const value = byteSlice(f.content, range.start, range.end);
      const chars = [...value].length;
      if (chars < MIN_BASE_VALUE_CHARS || chars > MAX_BASE_VALUE_CHARS) continue;
      out.push({ id: `${input.id}--${f.id}`, category: input.id, partition: input.partition, expectation, content: f.content, range });
    }
  }
  return out.sort((x, y) => x.id.localeCompare(y.id));
}

/** Per-kind quotas for the deterministic base draw (hash-ordered, no randomness). */
export const BASE_QUOTAS = {
  'must-redact:statistical:contextual': 10,
  'must-redact:statistical:entropy': 6,
  'must-redact:deterministic:provider': 6,
  'must-redact:deterministic:structural': 3,
  'must-redact:deterministic:private-key': 2,
  'control:flagged': 6,
  'control:unflagged': 4,
} as const;

/**
 * Classifies each candidate by the product's result on the unmutated base and
 * draws the bases. The product's output only selects which reviewed fixtures
 * are used; it never changes a fixture's authored expectation.
 */
export function selectBases(candidates: BaseCandidate[], baseRecords: Map<string, ShadowComparison[]>): Base[] {
  const buckets = new Map<string, Base[]>();
  for (const c of candidates) {
    const records = baseRecords.get(c.id) ?? [];
    const covering = records.filter(r => r.start <= c.range.start && r.end >= c.range.end);
    let key: string | null = null;
    let base: Base = { ...c, specificity: null, authority: null, band: null };
    if (c.expectation === 'must-redact') {
      if (covering.length !== 1) continue;
      const r = covering[0];
      // A base whose value already matches a whole-value exclusion grammar is not credential material to reshape.
      if (r.exclusion !== null || exclusionGrammar(byteSlice(c.content, c.range.start, c.range.end)) !== null) continue;
      base = { ...base, specificity: r.specificity, authority: r.authority, band: r.band };
      key = `must-redact:${r.authority}:${r.specificity}`;
    } else {
      key = records.length ? 'control:flagged' : 'control:unflagged';
      if (records.length) base = { ...base, specificity: records[0].specificity, authority: records[0].authority, band: records[0].band };
    }
    if (!(key in BASE_QUOTAS)) continue;
    const list = buckets.get(key) ?? [];
    list.push(base);
    buckets.set(key, list);
  }
  const bases: Base[] = [];
  for (const [key, quota] of Object.entries(BASE_QUOTAS)) {
    const list = (buckets.get(key) ?? []).sort((x, y) => sha256(`${OPERATOR_SET_VERSION}:${x.id}`).localeCompare(sha256(`${OPERATOR_SET_VERSION}:${y.id}`)));
    bases.push(...list.slice(0, quota));
  }
  return bases.sort((x, y) => x.id.localeCompare(y.id));
}

// ---------------------------------------------------------------------------
// Operators. Each attack class is a family of generic, enumerated reshapings.
// A value operator rewrites the value; a context operator rewrites the text
// around it. None adds credential material to a control, and none removes the
// original material from a positive (it stays in the value, reshaped).

export interface Reshaped { value: string; /** Character range of the secret material inside `value`; whole value when absent. */ secret?: [number, number] }
interface ValueOperator { kind: 'value'; id: string; apply: (value: string, parts: ValueParts) => Reshaped | null; expectation?: Expectation }
interface ContextOperator { kind: 'context'; id: string; apply: (line: LineParts) => { before: string; after: string } | null }
interface ReplaceOperator { kind: 'replace'; id: string; expectation: 'control'; value: (length: number) => string; context: 'base' }
type Operator = ValueOperator | ContextOperator | ReplaceOperator;

/** A value split into a fixed head (a vendor prefix or PEM header), a mutable body and a fixed tail. */
export interface ValueParts { head: string; body: string; tail: string }
export interface LineParts { lineBefore: string; name: string | null; separator: string; value: string; lineAfter: string }

export function valueParts(value: string): ValueParts {
  const pem = /^(-----BEGIN [A-Z0-9 ]+-----\r?\n)([\s\S]*?)(\r?\n-----END [A-Z0-9 ]+-----)$/.exec(value);
  if (pem) return { head: pem[1], body: pem[2], tail: pem[3] };
  const prefix = /^[A-Za-z0-9]{1,10}[_-](?:[A-Za-z0-9]{1,8}[_-])?/.exec(value);
  const head = prefix && prefix[0].length < value.length - 8 ? prefix[0] : '';
  return { head, body: value.slice(head.length), tail: '' };
}

const chars = (s: string) => [...s];
const withBody = (p: ValueParts, body: string): Reshaped => ({ value: p.head + body + p.tail });
const around = (prefix: string, value: string, suffix: string): Reshaped =>
  ({ value: prefix + value + suffix, secret: [prefix.length, prefix.length + value.length] });

/** Runs of `k` equal symbols: each block of the body repeats its first symbol. */
const blockRepeat = (k: number) => (s: string) => chars(s).map((c, i, a) => a[i - (i % k)]).join('');
/** The body tiled from its own first `p` symbols, same length. */
const tile = (p: number) => (s: string) => { const a = chars(s); return a.map((_, i) => a[i % Math.min(p, a.length)]).join(''); };
const insertRun = (r: number) => (s: string) => { const a = chars(s); const mid = a.length >> 1; return [...a.slice(0, mid), ...Array(r).fill(a[mid] ?? 'a'), ...a.slice(mid)].join(''); };
const segment = (every: number, sep: string) => (s: string) => chars(s).map((c, i) => (i > 0 && i % every === 0 ? sep + c : c)).join('');
const mapChars = (f: (c: string, i: number) => string) => (s: string) => chars(s).map(f).join('');
const codeOf = (c: string) => c.codePointAt(0) ?? 0;
/** Keeps the first `n` symbols and repeats the last kept symbol for the rest: a step of the boundary sweep. */
const flattenTail = (n: number) => (s: string) => { const a = chars(s); if (n >= a.length) return s; const keep = a.slice(0, Math.max(1, n)); return [...keep, ...Array(a.length - keep.length).fill(keep[keep.length - 1])].join(''); };

/** Benign sequence alphabets for periodic-body controls: dummies, not credential material. */
const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789abcdef',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
];
const sequenceOf = (alphabet: string) => (length: number) => Array.from({ length }, (_, i) => alphabet[i % alphabet.length]).join('');

/** Whole values that satisfy one reviewed exclusion grammar each (product ADR §6): negative-evidence controls. */
const FULL_GRAMMAR_VALUES = [
  '{{ secrets.API_KEY }}', '${API_KEY}', '${API_KEY:-changeme}', '$API_KEY', '%API_KEY%', '$(vault read -field=value kv/app)',
  '<your-api-key>', '********', 'xxxxxxxxxxxxxxxx', 'your-api-key-here', 'REPLACE_ME', 'REDACTED-EXAMPLE-VALUE',
];

export const OPERATORS: Record<AttackClass, Operator[]> = {
  'controlled-repetition': [
    ...[2, 3, 4].map(k => ({ kind: 'value' as const, id: `block-repeat-${k}`, apply: (_v: string, p: ValueParts) => withBody(p, blockRepeat(k)(p.body)) })),
    { kind: 'value', id: 'double-each', apply: (_v, p) => withBody(p, mapChars(c => c + c)(p.body)) },
    ...[8, 16, 32].map(r => ({ kind: 'value' as const, id: `insert-run-${r}`, apply: (_v: string, p: ValueParts) => withBody(p, insertRun(r)(p.body)) })),
  ],
  'periodic-body': [
    ...[2, 4, 8, 16].map(n => ({ kind: 'value' as const, id: `tile-${n}`, apply: (_v: string, p: ValueParts) => withBody(p, tile(n)(p.body)) })),
    { kind: 'value', id: 'mirror', apply: (_v, p) => { const a = chars(p.body); const h = a.slice(0, Math.ceil(a.length / 2)); return withBody(p, [...h, ...[...h].reverse()].slice(0, a.length).join('')); } },
    ...SEQUENCES.map((alphabet, i) => ({ kind: 'replace' as const, id: `benign-sequence-${i + 1}`, expectation: 'control' as const, value: sequenceOf(alphabet), context: 'base' as const })),
  ],
  'class-distribution': [
    { kind: 'value', id: 'lower', apply: (_v, p) => withBody(p, p.body.toLowerCase()) },
    { kind: 'value', id: 'upper', apply: (_v, p) => withBody(p, p.body.toUpperCase()) },
    { kind: 'value', id: 'digits', apply: (_v, p) => withBody(p, mapChars(c => (/\s/.test(c) ? c : String(codeOf(c) % 10)))(p.body)) },
    { kind: 'value', id: 'hex', apply: (_v, p) => withBody(p, mapChars(c => (/\s/.test(c) ? c : (codeOf(c) % 16).toString(16)))(p.body)) },
    { kind: 'value', id: 'alnum-only', apply: (_v, p) => withBody(p, mapChars(c => (/[A-Za-z0-9\s]/.test(c) ? c : 'A'))(p.body)) },
    { kind: 'value', id: 'binary-alphabet', apply: (_v, p) => withBody(p, mapChars(c => (/\s/.test(c) ? c : codeOf(c) % 2 ? 'b' : 'a'))(p.body)) },
  ],
  'length-segmentation': [
    ...[16, 24].map(n => ({ kind: 'value' as const, id: `truncate-${n}`, apply: (_v: string, p: ValueParts) => (chars(p.body).length > n ? withBody(p, chars(p.body).slice(0, n).join('')) : null) })),
    ...([[4, '-'], [8, '-'], [8, '.'], [6, '_']] as [number, string][]).map(([n, sep]) => ({ kind: 'value' as const, id: `segment-${n}-${sep === '-' ? 'dash' : sep === '.' ? 'dot' : 'underscore'}`, apply: (_v: string, p: ValueParts) => withBody(p, segment(n, sep)(p.body)) })),
    { kind: 'value', id: 'pad-before-bound', apply: (v) => around('a'.repeat(Math.max(0, 257 - chars(v).length)), v, '') },
    { kind: 'value', id: 'pad-after', apply: (v) => around('', v, 'a'.repeat(64)) },
  ],
  'placeholder-wrapping': [
    ...([['EXAMPLE', ''], ['', 'EXAMPLE'], ['your_', '_here'], ['REPLACE_ME_', ''], ['xxxx', 'xxxx'], ['TODO-', ''], ['sample.', ''], ['<', '>']] as [string, string][])
      .map(([pre, post], i) => ({ kind: 'value' as const, id: `wrap-${i + 1}`, apply: (v: string) => around(pre, v, post) })),
  ],
  'embedded-reference': [
    { kind: 'value', id: 'env-in-middle', apply: (v) => { const a = chars(v); const m = a.length >> 1; return { value: a.slice(0, m).join('') + '${HOME}' + a.slice(m).join('') }; } },
    { kind: 'value', id: 'command-in-middle', apply: (v) => { const a = chars(v); const m = a.length >> 1; return { value: a.slice(0, m).join('') + '$(date)' + a.slice(m).join('') }; } },
    { kind: 'value', id: 'template-prefix', apply: (v) => around('{{x}}', v, '') },
    { kind: 'value', id: 'windows-env-suffix', apply: (v) => around('', v, '%PATH%') },
    { kind: 'value', id: 'dotted-env-prefix', apply: (v) => around('process.env.', v, '') },
    { kind: 'value', id: 'env-braces-whole', apply: (v) => around('${', v, '}') },
    { kind: 'value', id: 'env-dollar-whole', apply: (v) => around('$', v, '') },
    { kind: 'value', id: 'backtick-whole', apply: (v) => around('`', v, '`') },
  ],
  'context-perturbation': [
    { kind: 'context', id: 'spaced-separator', apply: l => (l.name ? { before: `${l.lineBefore}${l.name} = `, after: l.lineAfter } : null) },
    { kind: 'context', id: 'colon-separator', apply: l => (l.name ? { before: `${l.lineBefore}${l.name}: `, after: l.lineAfter } : null) },
    { kind: 'context', id: 'double-quoted', apply: l => ({ before: `${l.lineBefore}${l.name ? `${l.name}=` : ''}"`, after: `"${l.lineAfter}` }) },
    { kind: 'context', id: 'single-quoted', apply: l => ({ before: `${l.lineBefore}${l.name ? `${l.name}=` : ''}'`, after: `'${l.lineAfter}` }) },
    { kind: 'context', id: 'export-prefix', apply: l => (l.name ? { before: `${l.lineBefore}export ${l.name}=`, after: l.lineAfter } : null) },
    { kind: 'context', id: 'name-lower', apply: l => (l.name ? { before: `${l.lineBefore}${l.name.toLowerCase()}${l.separator}`, after: l.lineAfter } : null) },
    { kind: 'context', id: 'name-upper', apply: l => (l.name ? { before: `${l.lineBefore}${l.name.toUpperCase()}${l.separator}`, after: l.lineAfter } : null) },
    { kind: 'context', id: 'trailing-semicolon', apply: l => ({ before: `${l.lineBefore}${l.name ? `${l.name}${l.separator}` : ''}`, after: `;${l.lineAfter}` }) },
    { kind: 'context', id: 'comment-prefix', apply: l => ({ before: `# ${l.lineBefore}${l.name ? `${l.name}${l.separator}` : ''}`, after: l.lineAfter }) },
    { kind: 'context', id: 'json-member', apply: l => ({ before: `{"${l.name ?? 'value'}": "`, after: `"}${l.lineAfter}` }) },
    { kind: 'context', id: 'tab-indent', apply: l => ({ before: `\t${l.lineBefore}${l.name ? `${l.name}${l.separator}` : ''}`, after: l.lineAfter }) },
    { kind: 'context', id: 'non-credential-name', apply: l => ({ before: `${l.lineBefore}build_ref=`, after: l.lineAfter }) },
  ],
  'negative-evidence-mixture': [
    ...([['', '-EXAMPLE-VALUE'], ['REDACTED-', ''], ['****', ''], ['', 'xxxx'], ['changeme-', ''], ['{{ secrets.API_KEY }}', ''], ['your-api-key-', '-here']] as [string, string][])
      .map(([pre, post], i) => ({ kind: 'value' as const, id: `mixture-${i + 1}`, apply: (v: string) => around(pre, v, post) })),
    ...FULL_GRAMMAR_VALUES.map((value, i) => ({ kind: 'replace' as const, id: `full-grammar-${i + 1}`, expectation: 'control' as const, value: () => value, context: 'base' as const })),
  ],
  'boundary-discontinuity': [
    ...[4, 8, 12, 16, 20, 24, 32].map(n => ({ kind: 'value' as const, id: `flatten-after-${n}`, apply: (_v: string, p: ValueParts) => (chars(p.body).length > n ? withBody(p, flattenTail(n)(p.body)) : null) })),
    ...[255, 256, 257].map(n => ({ kind: 'value' as const, id: `length-${n}`, apply: (v: string) => { const a = chars(v); if (a.length >= n) return null; const pad = Array.from({ length: n - a.length }, (_, i) => a[i % a.length]).join(''); return { value: v + pad }; } })),
  ],
};

// ---------------------------------------------------------------------------
// Variants.

export interface Variant {
  id: string;
  attackClass: AttackClass;
  operator: string;
  baseId: string;
  baseAuthority: BaseAuthority | null;
  baseSpecificity: string | null;
  expectation: Expectation;
  text: string;
  /** Byte range of the secret material a positive must have covered; for a control, the reshaped value. */
  span: { start: number; end: number };
  /** Byte range of the whole reshaped value: flagged bytes inside it are never collateral. */
  envelope: { start: number; end: number };
}

const NAME_BEFORE = /([A-Za-z_][A-Za-z0-9_.-]*)(\s*[:=]\s*["']?|["']?\s*:\s*["']?)$/;

export function lineParts(before: string, value: string, after: string): { head: string; line: LineParts; tail: string } {
  const lineStart = before.lastIndexOf('\n') + 1;
  const newline = after.indexOf('\n');
  const lineEnd = newline < 0 ? after.length : newline;
  const prefix = before.slice(lineStart);
  const m = NAME_BEFORE.exec(prefix);
  const line: LineParts = m
    ? { lineBefore: prefix.slice(0, m.index), name: m[1], separator: '=', value, lineAfter: after.slice(0, lineEnd).replace(/^["']/, '') }
    : { lineBefore: prefix, name: null, separator: '=', value, lineAfter: after.slice(0, lineEnd) };
  return { head: before.slice(0, lineStart), line, tail: after.slice(lineEnd) };
}

function assemble(v: Omit<Variant, 'span' | 'envelope' | 'text'>, before: string, reshaped: Reshaped, after: string): Variant {
  const text = before + reshaped.value + after;
  const start = bytes(before);
  const [s, e] = reshaped.secret ?? [0, reshaped.value.length];
  return {
    ...v, text,
    span: { start: start + bytes(reshaped.value.slice(0, s)), end: start + bytes(reshaped.value.slice(0, e)) },
    envelope: { start, end: start + bytes(reshaped.value) },
  };
}

/** Every variant of every class for the drawn bases, in a fixed order. No randomness. */
export function buildVariants(bases: Base[]): Variant[] {
  const out: Variant[] = [];
  for (const cls of ATTACK_CLASSES_289) {
    for (const op of OPERATORS[cls]) {
      for (const base of bases) {
        const before = byteSlice(base.content, 0, base.range.start);
        const value = byteSlice(base.content, base.range.start, base.range.end);
        const after = byteSlice(base.content, base.range.end, bytes(base.content));
        const common = { id: `${cls}/${op.id}/${base.id}`, attackClass: cls, operator: op.id, baseId: base.id, baseAuthority: base.authority, baseSpecificity: base.specificity };
        if (op.kind === 'replace') {
          // Benign replacement values sit in a positive base's own context, so the control differs from a positive only by its value.
          if (base.expectation !== 'must-redact' || base.authority !== 'statistical') continue;
          out.push(assemble({ ...common, expectation: 'control' }, before, { value: op.value(chars(value).length) }, after));
        } else if (op.kind === 'value') {
          const reshaped = op.apply(value, valueParts(value));
          if (!reshaped || reshaped.value === value) continue;
          out.push(assemble({ ...common, expectation: base.expectation }, before, reshaped, after));
        } else {
          const { head, line, tail } = lineParts(before, value, after);
          const ctx = op.apply(line);
          if (!ctx) continue;
          const text = head + ctx.before + value + ctx.after + tail;
          if (text === base.content) continue;
          out.push(assemble({ ...common, expectation: base.expectation }, head + ctx.before, { value }, ctx.after + tail));
        }
      }
    }
  }
  return out;
}

/** SHA-256 of the operator set, its parameters, the base draw and the seed ("enumerated": there is none). Published instead of the operators' output. */
export function operatorSetHash(bases: Base[], sourceHash: string): string {
  const operators = Object.fromEntries(ATTACK_CLASSES_289.map(cls => [cls, OPERATORS[cls].map(o => `${o.kind}:${o.id}`)]));
  return sha256(canonicalJson({ version: OPERATOR_SET_VERSION, seed: 'enumerated', operators, quotas: BASE_QUOTAS, bases: bases.map(b => b.id), sourceHash }));
}

// ---------------------------------------------------------------------------
// Strict exclusion grammar, re-implemented from the product contract
// (redact-secret docs/specs/engine.md "Strict exclusion grammar") so the
// benchmark checks the product's negative evidence independently.

export const PLACEHOLDER_WORDS = new Set(['a', 'access', 'an', 'api', 'auth', 'change', 'changeme', 'client', 'dummy', 'example', 'fake', 'goes', 'here', 'id', 'insert', 'key', 'me', 'my', 'nil', 'none', 'null', 'password', 'placeholder', 'redacted', 'replace', 'replaceme', 'sample', 'secret', 'tbd', 'the', 'todo', 'token', 'undefined', 'value', 'your']);
export const PLACEHOLDER_MARKERS = new Set(['changeme', 'dummy', 'example', 'fake', 'here', 'insert', 'nil', 'none', 'null', 'placeholder', 'redacted', 'replace', 'replaceme', 'sample', 'tbd', 'todo', 'undefined', 'your']);
const MASK_SYMBOLS = ['*', 'x', 'X', '•', '#', '.', '-', '0'];
const NAME = '[A-Za-z_][A-Za-z0-9_]*';

/** The reviewed exclusion grammar the whole value matches, or null. A partial resemblance never matches. */
export function exclusionGrammar(value: string): string | null {
  if (/^\{\{[^{}]*\}\}$/.test(value)) return 'template-reference';
  if (new RegExp(`^(?:\\$\\{${NAME}(?::?-[^}]*)?\\}|\\$${NAME}|%${NAME}%)$`).test(value)) return 'environment-reference';
  if (/^\$\([^()]*\)$/.test(value) || /^`[^`]*`$/.test(value)) return 'command-substitution';
  if (/^<[A-Za-z0-9_ .-]+>$/.test(value)) return 'angle-placeholder';
  const symbols = chars(value);
  if (symbols.length >= 3 && MASK_SYMBOLS.includes(symbols[0]) && symbols.every(s => s === symbols[0])) return 'mask';
  const words = value.toLowerCase().split(/[_\-.\s]+/u).filter(Boolean);
  if (words.length && words.every(w => PLACEHOLDER_WORDS.has(w)) && words.some(w => PLACEHOLDER_MARKERS.has(w))) return 'placeholder-vocabulary';
  return null;
}

// ---------------------------------------------------------------------------
// Product output.

export interface ShadowComparison {
  record: 'shadow-comparison';
  input: string; finding: string; start: number; end: number; byteLength: number;
  detector: string; type: string; specificity: string; legacyConfidence: string; legacyAction: string;
  authority: BaseAuthority; model: string; featureSchema: string; contextClass: string | null; exclusion: string | null;
  groups: Record<string, number> | null; signals: { group: string; signal: string; points: number }[];
  positive?: number; negative?: number; score: number | null; band: string; promotion: string; reasons: string[];
}
export interface ShadowHeader {
  record: 'shadow-evaluation'; format: string; productVersion: string; model: string; featureSchema: string;
  artifactRevision: number; modelFingerprint: string; profile: string; path: string;
}
export interface ShadowRun { header: ShadowHeader; byInput: Map<string, ShadowComparison[]>; errors: Map<string, string>; lines: Map<string, string[]> }

export function parseShadowOutput(stdout: string): ShadowRun {
  const lines = stdout.split('\n').filter(Boolean);
  const header = JSON.parse(lines[0] ?? 'null');
  if (!header || header.record !== 'shadow-evaluation' || header.format !== SHADOW_FORMAT) throw new Error('shadow evaluation output has no redact-secret/shadow-evaluation/1 header');
  const byInput = new Map<string, ShadowComparison[]>(), errors = new Map<string, string>(), raw = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const r = JSON.parse(line);
    if (r.record === 'shadow-comparison') { (byInput.get(r.input) ?? byInput.set(r.input, []).get(r.input)!).push(r); }
    else if (r.record === 'shadow-error') errors.set(r.input, r.code);
    else throw new Error(`unexpected shadow evaluation record ${JSON.stringify(r.record)}`);
    (raw.get(r.input) ?? raw.set(r.input, []).get(r.input)!).push(line);
  }
  return { header, byInput, errors, lines: raw };
}

/** One finding of a plain product scan (the CLI's safe JSON report). */
export interface PlainFinding { start: number; end: number; detector: string; type: string; confidence: string; action: string }

// ---------------------------------------------------------------------------
// Evaluation.

export interface VariantOutcome {
  id: string;
  attackClass: AttackClass;
  expectation: Expectation;
  status: 'resolved' | 'unresolved' | 'unstable';
  legacyFlagged: boolean;
  candidateFlagged: boolean;
  mustRedactBytes: number;
  legacyCollateralBytes: number;
  collateralBytes: number;
  negativeEvidenceApplied: boolean;
  negativeEvidenceOnPartialMatch: boolean;
  /** Maintainer-local diagnostics below; never projected. */
  covering: { specificity: string; authority: string; band: string; score: number | null; legacyConfidence: string; exclusion: string | null } | null;
  invariantViolations: string[];
}

const covers = (f: { start: number; end: number }, span: { start: number; end: number }) => f.start <= span.start && f.end >= span.end;
const isProtected = (s: string) => (PROTECTED_SPECIFICITIES as readonly string[]).includes(s);
/** Candidate projection: deterministic findings stand; a statistical finding stands when its band reaches the cut. */
export const keptByCandidate = (r: ShadowComparison, cut: Band = PROJECTION_CUT) => r.authority === 'deterministic' || bandRank(r.band) >= bandRank(cut);

function outsideBytes(findings: { start: number; end: number }[], envelope: { start: number; end: number } | null): number {
  let total = 0;
  for (const f of findings) {
    const inside = envelope ? Math.max(0, Math.min(f.end, envelope.end) - Math.max(f.start, envelope.start)) : 0;
    total += (f.end - f.start) - inside;
  }
  return total;
}

/** Record-level invariant checks (product ADR §5 and §6) for one comparison record. */
export function recordViolations(r: ShadowComparison, text: string): string[] {
  const problems: string[] = [];
  if (isProtected(r.specificity)) {
    if (r.authority !== 'deterministic' || r.band !== r.legacyConfidence || r.promotion !== 'preserve' || r.score !== null || r.groups !== null || (r.signals ?? []).length)
      problems.push('protectedSpecificityNeverWeakened');
  }
  const negative = r.negative ?? 0;
  if (negative > 0 || r.exclusion !== null) {
    const whole = exclusionGrammar(byteSlice(text, r.start, r.end));
    if (whole === null || (r.exclusion !== null && r.exclusion !== whole) || (negative > 0 && r.exclusion === null)) problems.push('negativeEvidenceFullGrammarOnly');
  }
  if (!['redact', 'block', 'warn'].includes(r.legacyAction)) problems.push('noStatisticalPositiveToNonFinding');
  return problems;
}

/** Legacy fields of the shadow path and a plain scan must be identical: the scorer enforced nothing. */
export function sameLegacy(records: ShadowComparison[], plain: PlainFinding[]): boolean {
  if (records.length !== plain.length) return false;
  const key = (f: PlainFinding) => `${f.start}:${f.end}:${f.detector}:${f.type}:${f.confidence}:${f.action}`;
  const a = records.map(r => key({ start: r.start, end: r.end, detector: r.detector, type: r.type, confidence: r.legacyConfidence, action: r.legacyAction })).sort();
  const b = plain.map(key).sort();
  return a.every((k, i) => k === b[i]);
}

export function evaluateVariant(v: Variant, runs: ShadowRun[], plain: { findings: PlainFinding[] } | { failure: string } | undefined, cut: Band = PROJECTION_CUT): VariantOutcome {
  const base: VariantOutcome = {
    id: v.id, attackClass: v.attackClass, expectation: v.expectation, status: 'resolved',
    legacyFlagged: false, candidateFlagged: false, mustRedactBytes: 0, legacyCollateralBytes: 0, collateralBytes: 0,
    negativeEvidenceApplied: false, negativeEvidenceOnPartialMatch: false, covering: null, invariantViolations: [],
  };
  const lineSets = runs.map(run => (run.lines.get(v.id) ?? []).join('\n'));
  if (lineSets.some(l => l !== lineSets[0])) return { ...base, status: 'unstable' };
  if (runs.some(run => run.errors.has(v.id)) || !plain || 'failure' in plain) return { ...base, status: 'unresolved' };
  const records = runs[0].byInput.get(v.id) ?? [];
  const violations = new Set<string>();
  for (const r of records) for (const p of recordViolations(r, v.text)) violations.add(p);
  if (!sameLegacy(records, plain.findings)) violations.add('shadowNonEnforcing');
  const kept = records.filter(r => keptByCandidate(r, cut));
  const envelope = v.expectation === 'must-redact' ? v.envelope : null;
  const negative = records.filter(r => (r.negative ?? 0) > 0);
  const cover = records.filter(r => covers(r, v.span)).sort((x, y) => (x.end - x.start) - (y.end - y.start))[0];
  return {
    ...base,
    legacyFlagged: v.expectation === 'must-redact' ? records.some(r => covers(r, v.span)) : records.length > 0,
    candidateFlagged: v.expectation === 'must-redact' ? kept.some(r => covers(r, v.span)) : kept.length > 0,
    mustRedactBytes: v.expectation === 'must-redact' ? v.span.end - v.span.start : 0,
    legacyCollateralBytes: outsideBytes(records, envelope),
    collateralBytes: outsideBytes(kept, envelope),
    negativeEvidenceApplied: negative.length > 0,
    negativeEvidenceOnPartialMatch: negative.some(r => exclusionGrammar(byteSlice(v.text, r.start, r.end)) === null),
    covering: cover ? { specificity: cover.specificity, authority: cover.authority, band: cover.band, score: cover.score, legacyConfidence: cover.legacyConfidence, exclusion: cover.exclusion } : null,
    invariantViolations: [...violations].sort(),
  };
}

// ---------------------------------------------------------------------------
// Aggregate (schemas/score-evasion-aggregate-v1.json).

export const COUNT_FIELDS = [
  'variants', 'unresolved', 'unstable', 'controls', 'detectionPreserved', 'legacyDetectionPreserved', 'leakedSpans', 'legacyLeakedSpans',
  'leakedOnlyUnderCandidate', 'falseAlarms', 'legacyFalseAlarms', 'mustRedactBytes', 'collateralBytes', 'legacyCollateralBytes',
  'negativeEvidenceApplied', 'negativeEvidenceOnPartialMatch',
] as const;
export type Counts = Record<typeof COUNT_FIELDS[number], number>;
const zero = (): Counts => Object.fromEntries(COUNT_FIELDS.map(f => [f, 0])) as Counts;

export function countOutcomes(outcomes: VariantOutcome[]): Counts {
  const c = zero();
  for (const o of outcomes) {
    c.variants++;
    if (o.status === 'unstable') { c.unstable++; continue; }
    if (o.status === 'unresolved') { c.unresolved++; continue; }
    if (o.negativeEvidenceApplied) c.negativeEvidenceApplied++;
    if (o.negativeEvidenceOnPartialMatch) c.negativeEvidenceOnPartialMatch++;
    c.collateralBytes += o.collateralBytes;
    c.legacyCollateralBytes += o.legacyCollateralBytes;
    if (o.expectation === 'control') {
      c.controls++;
      if (o.candidateFlagged) c.falseAlarms++;
      if (o.legacyFlagged) c.legacyFalseAlarms++;
      continue;
    }
    c.mustRedactBytes += o.mustRedactBytes;
    if (o.candidateFlagged) c.detectionPreserved++; else c.leakedSpans++;
    if (o.legacyFlagged) c.legacyDetectionPreserved++; else c.legacyLeakedSpans++;
    if (!o.candidateFlagged && o.legacyFlagged) c.leakedOnlyUnderCandidate++;
  }
  return c;
}

export const INVARIANTS = ['protectedSpecificityNeverWeakened', 'negativeEvidenceFullGrammarOnly', 'noStatisticalPositiveToNonFinding', 'shadowNonEnforcing'] as const;

export interface AggregateIdentity {
  sourceRevision: string; candidateArtifactHash: string; scoringArtifactRevision: number; modelFingerprint: string;
  scoringArtifactSha256: string; tuningManifestHash: string | null; scoringIdentity: string | null;
}

export function buildAggregate(outcomes: VariantOutcome[], identity: AggregateIdentity, benchmarkCommit: string, opHash: string) {
  const attackClasses = Object.fromEntries(ATTACK_CLASSES_289.map(cls => [cls, countOutcomes(outcomes.filter(o => o.attackClass === cls))]));
  const violated = new Set(outcomes.flatMap(o => o.invariantViolations));
  return {
    schemaVersion: 1 as const,
    reportType: 'score-evasion-aggregate' as const,
    visibility: 'public-aggregate' as const,
    mode: 'shadow' as const,
    holdoutAccess: 'none' as const,
    identity,
    benchmark: { commit: benchmarkCommit, dirty: false as const },
    operatorSetHash: opHash,
    totals: countOutcomes(outcomes),
    attackClasses,
    invariants: Object.fromEntries(INVARIANTS.map(i => [i, !violated.has(i)])) as Record<typeof INVARIANTS[number], boolean>,
  };
}

/** Resolves an output path and accepts it only under results-output/ (git-ignored, never projected to the site). */
export function resolveLocalOutput(root: string, requested: string, resolve: (...p: string[]) => string, sep: string): string {
  const resolved = resolve(root, requested);
  const allowed = resolve(root, NON_PUBLIC_ROOT) + sep;
  if (!resolved.startsWith(allowed)) throw new Error(`Score-evasion detail is maintainer-local: write under ${NON_PUBLIC_ROOT}/, never public/, dist/ or a tracked path.`);
  return resolved;
}
