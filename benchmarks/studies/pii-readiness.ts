/**
 * STUDY HARNESS, NOT A DETECTOR (#258).
 *
 * PII-readiness study for the beta.9 shadow evidence model. It computes the
 * `evidence-features/v1` vector, the benchmark's context and negative classes,
 * and a mirror of redact-secret's `evidence-aggregation/v1` band for a fixed
 * list of reserved or documentation-only shapes (fictional 555-01xx phone
 * numbers, RFC 2606/6761 example domains, never-issued SSN areas, card-network
 * test PANs, RFC 5737/3849 documentation addresses, a canonical ISBN checksum
 * example). No value belongs to a real person.
 *
 * It is deliberately outside `fixtures/` and `corpora/`: it registers no
 * category, no fixture, no expected span and no detector assignment, and the
 * study-local checks below (Luhn, mod-97, SSN area rules, reserved ranges) are
 * not product behavior. There is no beta.9 PII support claim.
 *
 *   npm run study:pii-readiness            # markdown tables on stdout
 *   npm run study:pii-readiness -- --json  # the same rows as JSON
 *
 * Nothing is written to disk. See docs/reports/2026-09-25-beta9-258-pii-readiness.md.
 */
import { pathToFileURL } from 'node:url';
import { extractEvidenceFeatures } from '../lib/evidence-features.ts';
import { contextClassOf, negativeClassOf, type ContextClass, type NegativeClass } from '../lib/candidate-features.ts';

export const STUDY_ID = 'pii-readiness-study/1';

/** Core revision whose engine.md "Shadow evidence aggregation" constants the mirror below copies. */
export const AGGREGATION_MIRROR = {
  model: 'evidence-aggregation/v1',
  coreRevision: '275f633e854139c9ba73add6d1e0da4635261699',
  randomnessRamp: { lo: 254345, hi: 313536, cap: 60 },
  contextualPoints: 40,
  negativePoints: 140,
  bands: { low: 7, medium: 43, high: 61 },
} as const;

export type Dimension =
  | 'reserved-negative'
  | 'validation'
  | 'context-sensitivity'
  | 'detectable-not-sensitive'
  | 'mask'
  | 'reference-credential';

export interface StudyShape {
  id: string;
  /** PII kind the shape stands for, or `credential` for the reference row. */
  kind: 'phone' | 'email' | 'ssn' | 'pan' | 'ip' | 'date' | 'isbn' | 'iban' | 'credential';
  dimension: Dimension;
  /** The line the value sits on; the value must occur in it exactly once. */
  line: string;
  value: string;
  /** Why the value is reserved, documentation-only or synthetic. */
  basis: string;
}

// Every value below is reserved, documented as a test/example value, or a
// synthetic string with no issuer. None identifies a person.
export const SHAPES: readonly StudyShape[] = [
  { id: 'phone-bare', kind: 'phone', dimension: 'reserved-negative', line: 'call 555-0100 for help', value: '555-0100', basis: 'NANP 555-0100..0199 reserved for fictional use' },
  { id: 'phone-e164ish', kind: 'phone', dimension: 'reserved-negative', line: 'phone: +1-202-555-0142', value: '+1-202-555-0142', basis: 'NANP 555-0100..0199 reserved for fictional use' },
  { id: 'phone-support-ctx', kind: 'phone', dimension: 'context-sensitivity', line: 'support_phone=202-555-0199', value: '202-555-0199', basis: 'NANP fictional range; business context' },
  { id: 'phone-patient-ctx', kind: 'phone', dimension: 'context-sensitivity', line: 'patient_phone=202-555-0199', value: '202-555-0199', basis: 'NANP fictional range; personal context' },
  { id: 'phone-password-ctx', kind: 'phone', dimension: 'context-sensitivity', line: 'password=202-555-0199', value: '202-555-0199', basis: 'NANP fictional range; credential-name context' },
  { id: 'email-example', kind: 'email', dimension: 'reserved-negative', line: 'email: jane.roe@example.com', value: 'jane.roe@example.com', basis: 'RFC 2606 example.com' },
  { id: 'email-invalid-tld', kind: 'email', dimension: 'reserved-negative', line: 'reply_to=billing+q3@example.invalid', value: 'billing+q3@example.invalid', basis: 'RFC 6761 .invalid' },
  { id: 'email-long', kind: 'email', dimension: 'reserved-negative', line: 'to: firstname.lastname+newsletter2026@mail.example.org', value: 'firstname.lastname+newsletter2026@mail.example.org', basis: 'RFC 2606 example.org' },
  { id: 'ssn-area-000', kind: 'ssn', dimension: 'reserved-negative', line: 'ssn = 000-12-3456', value: '000-12-3456', basis: 'SSN area 000 never assigned' },
  { id: 'ssn-area-666', kind: 'ssn', dimension: 'reserved-negative', line: 'ssn = 666-12-3456', value: '666-12-3456', basis: 'SSN area 666 never assigned' },
  { id: 'ssn-area-9xx', kind: 'ssn', dimension: 'reserved-negative', line: 'tax_id: 987-65-4321', value: '987-65-4321', basis: 'SSN area 900-999 never assigned' },
  { id: 'ssn-all-zero', kind: 'ssn', dimension: 'mask', line: 'ssn=000000000', value: '000000000', basis: 'all-zero placeholder' },
  { id: 'ssn-x-mask', kind: 'ssn', dimension: 'mask', line: 'ssn=XXX-XX-XXXX', value: 'XXX-XX-XXXX', basis: 'segmented redaction mask' },
  { id: 'ssn-star-mask', kind: 'ssn', dimension: 'mask', line: 'ssn=***-**-****', value: '***-**-****', basis: 'segmented redaction mask' },
  { id: 'pan-visa-test', kind: 'pan', dimension: 'validation', line: 'card_number=4111111111111111', value: '4111111111111111', basis: 'card-network documented test PAN' },
  { id: 'pan-visa-test-spaced', kind: 'pan', dimension: 'validation', line: 'card: 4111 1111 1111 1111', value: '4111 1111 1111 1111', basis: 'card-network documented test PAN' },
  { id: 'pan-mc-test', kind: 'pan', dimension: 'validation', line: 'card_number=5555555555554444', value: '5555555555554444', basis: 'processor-documented test PAN' },
  { id: 'pan-amex-test', kind: 'pan', dimension: 'validation', line: 'card_number=378282246310005', value: '378282246310005', basis: 'processor-documented test PAN' },
  { id: 'pan-luhn-twin', kind: 'pan', dimension: 'validation', line: 'card_number=4111111111111112', value: '4111111111111112', basis: 'one-digit Luhn-invalid twin of a test PAN' },
  { id: 'ip-v4-doc', kind: 'ip', dimension: 'reserved-negative', line: 'client_ip=192.0.2.44', value: '192.0.2.44', basis: 'RFC 5737 TEST-NET-1' },
  { id: 'ip-v6-doc', kind: 'ip', dimension: 'reserved-negative', line: 'client_ip=2001:db8::1', value: '2001:db8::1', basis: 'RFC 3849 documentation prefix' },
  { id: 'date-dob-ctx', kind: 'date', dimension: 'context-sensitivity', line: 'dob=1970-01-01', value: '1970-01-01', basis: 'Unix epoch date; personal context' },
  { id: 'date-release-ctx', kind: 'date', dimension: 'context-sensitivity', line: 'release_date=1970-01-01', value: '1970-01-01', basis: 'Unix epoch date; non-personal context' },
  { id: 'isbn-13', kind: 'isbn', dimension: 'detectable-not-sensitive', line: 'isbn: 978-0-306-40615-7', value: '978-0-306-40615-7', basis: 'canonical ISBN-13 checksum example' },
  { id: 'iban-example', kind: 'iban', dimension: 'detectable-not-sensitive', line: 'iban=GB82WEST12345698765432', value: 'GB82WEST12345698765432', basis: 'published IBAN format example' },
  { id: 'credential-reference', kind: 'credential', dimension: 'reference-credential', line: 'API_KEY=Q7vK2mZp9LxR4tWb8NcY3hJd6FsG1eUa', value: 'Q7vK2mZp9LxR4tWb8NcY3hJd6FsG1eUa', basis: 'core golden-vector synthetic string' },
];

// ---------------------------------------------------------------------------
// Study-local validation and reserved-range checks. None is product behavior.

const digitsOf = (value: string) => value.replace(/\D/g, '');

export function luhnValid(value: string): boolean {
  const d = digitsOf(value);
  if (d.length < 2) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = d.charCodeAt(d.length - 1 - i) - 48;
    if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  }
  return sum % 10 === 0;
}

export function isbn13Valid(value: string): boolean {
  const d = digitsOf(value);
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += (d.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

export function ibanMod97Valid(value: string): boolean {
  const v = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(v)) return false;
  const rearranged = v.slice(4) + v.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const n = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of n) rem = (rem * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/** Structural SSN validity: area not 000/666/900-999, group not 00, serial not 0000. */
export function ssnStructurallyValid(value: string): boolean {
  const m = /^(\d{3})-?(\d{2})-?(\d{4})$/.exec(value);
  if (!m) return false;
  const area = Number(m[1]);
  return area !== 0 && area !== 666 && area < 900 && m[2] !== '00' && m[3] !== '0000';
}

const TEST_PANS = new Set(['4111111111111111', '5555555555554444', '378282246310005']);

/** The reserved or documentation range a value falls in, if any (study-local list, not a product grammar). */
export function reservedRange(shape: Pick<StudyShape, 'kind' | 'value'>): string | null {
  const { kind, value } = shape;
  if (kind === 'phone' && /(?:^|\D)555-?01\d\d$/.test(value)) return 'nanp-fictional-555-01xx';
  if (kind === 'email' && /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|[a-z0-9-]+\.(?:example|invalid|test|localhost))$/i.test(value)) return 'rfc2606-6761-domain';
  if (kind === 'ssn' && /^\d{3}-?\d{2}-?\d{4}$/.test(value) && !ssnStructurallyValid(value)) return 'ssn-never-assigned';
  if (kind === 'pan' && TEST_PANS.has(digitsOf(value))) return 'documented-test-pan';
  if (kind === 'ip' && (/^192\.0\.2\.\d{1,3}$/.test(value) || /^198\.51\.100\.\d{1,3}$/.test(value) || /^203\.0\.113\.\d{1,3}$/.test(value))) return 'rfc5737-test-net';
  if (kind === 'ip' && /^2001:db8:/i.test(value)) return 'rfc3849-documentation';
  return null;
}

export function validationOf(shape: Pick<StudyShape, 'kind' | 'value'>): string {
  switch (shape.kind) {
    case 'pan': return luhnValid(shape.value) ? 'luhn-pass' : 'luhn-fail';
    case 'isbn': return isbn13Valid(shape.value) ? 'isbn13-pass' : 'isbn13-fail';
    case 'iban': return ibanMod97Valid(shape.value) ? 'mod97-pass' : 'mod97-fail';
    case 'ssn': return ssnStructurallyValid(shape.value) ? 'ssn-structure-pass' : 'ssn-structure-fail';
    default: return 'none';
  }
}

// ---------------------------------------------------------------------------
// Checksum strength: how rare a pass is among uniformly random inputs of the
// same shape. A pass rate r carries at most log2(1/r) bits of evidence.

/** Exact count by enumerating the last `free` digits of a fixed-length digit string. */
function passRate(free: number, build: (tail: string) => string, valid: (v: string) => boolean): { passes: number; trials: number } {
  const trials = 10 ** free;
  let passes = 0;
  for (let i = 0; i < trials; i++) if (valid(build(String(i).padStart(free, '0')))) passes++;
  return { passes, trials };
}

export function checksumStrength() {
  const luhn = passRate(5, t => `41111111111${t}`, luhnValid);
  const isbn = passRate(5, t => `97803064${t}`, isbn13Valid);
  const iban = passRate(5, t => `GB82WEST12345698${t}0`, ibanMod97Valid);
  // SSN structure: exact product of the per-segment counts over 10^9 inputs.
  let areas = 0;
  for (let a = 0; a < 1000; a++) if (a !== 0 && a !== 666 && a < 900) areas++;
  const ssn = { passes: areas * 99 * 9999, trials: 1000 * 100 * 10000 };
  const bits = (r: { passes: number; trials: number }) => Math.log2(r.trials / r.passes);
  return [
    { check: 'luhn (PAN)', ...luhn, bits: bits(luhn) },
    { check: 'isbn-13', ...isbn, bits: bits(isbn) },
    { check: 'iban mod-97', ...iban, bits: bits(iban) },
    { check: 'ssn structure', ...ssn, bits: bits(ssn) },
  ];
}

// ---------------------------------------------------------------------------
// Mirror of the product's evidence-aggregation/v1 band, for study rows only.

const STRICT_NEGATIVE: ReadonlySet<NegativeClass> = new Set([
  'template-reference', 'environment-reference', 'command-substitution', 'angle-placeholder', 'mask', 'placeholder-vocabulary',
] as NegativeClass[]);
const CREDENTIAL_CONTEXT: ReadonlySet<ContextClass> = new Set(['credential-name', 'authorization-header', 'url-userinfo'] as ContextClass[]);

export type Band = 'none' | 'low' | 'medium' | 'high';

export function mirrorBand(entropyQ16: number, context: ContextClass, negative: NegativeClass): Band {
  const { lo, hi, cap } = AGGREGATION_MIRROR.randomnessRamp;
  const randomness = entropyQ16 <= lo ? 0 : entropyQ16 >= hi ? cap : Math.floor((cap * (entropyQ16 - lo)) / (hi - lo));
  const contextual = CREDENTIAL_CONTEXT.has(context) ? AGGREGATION_MIRROR.contextualPoints : 0;
  const neg = STRICT_NEGATIVE.has(negative) ? AGGREGATION_MIRROR.negativePoints : 0;
  const score = Math.max(0, randomness + contextual - neg);
  const { low, medium, high } = AGGREGATION_MIRROR.bands;
  return score >= high ? 'high' : score >= medium ? 'medium' : score >= low ? 'low' : 'none';
}

export interface StudyRow {
  id: string;
  kind: StudyShape['kind'];
  dimension: Dimension;
  entropyBits: number;
  classes: string;
  contextClass: ContextClass;
  negativeClass: NegativeClass;
  validation: string;
  reservedRange: string | null;
  band: Band;
}

const CLASS_LABELS = ['lower', 'upper', 'digit', 'punct', 'space', 'non-ascii'];

export function studyRow(shape: StudyShape): StudyRow {
  const start = shape.line.indexOf(shape.value);
  if (start < 0 || shape.line.indexOf(shape.value, start + 1) >= 0) throw new Error(`${shape.id}: value must occur exactly once in its line`);
  const end = start + shape.value.length;
  const f = extractEvidenceFeatures(shape.value);
  const contextClass = contextClassOf(shape.line, start, end);
  const negativeClass = negativeClassOf(shape.line, start, end, shape.value);
  return {
    id: shape.id,
    kind: shape.kind,
    dimension: shape.dimension,
    entropyBits: Math.round((f[5] / 65536) * 100) / 100,
    classes: CLASS_LABELS.filter((_, i) => f[8 + i] > 0).join('+'),
    contextClass,
    negativeClass,
    validation: validationOf(shape),
    reservedRange: reservedRange(shape),
    band: mirrorBand(f[5], contextClass, negativeClass),
  };
}

export function runStudy() {
  return { study: STUDY_ID, mirror: AGGREGATION_MIRROR, rows: SHAPES.map(studyRow), checksums: checksumStrength() };
}

function toMarkdown(result: ReturnType<typeof runStudy>): string {
  const lines = [
    `Study ${result.study}; band mirror of ${result.mirror.model} at core ${result.mirror.coreRevision.slice(0, 12)}. No beta.9 PII support claim.`,
    '',
    '| id | kind | dimension | H bits | classes | contextClass | negativeClass | validation | reserved range | v1 band |',
    '| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |',
    ...result.rows.map(r => `| ${r.id} | ${r.kind} | ${r.dimension} | ${r.entropyBits.toFixed(2)} | ${r.classes} | ${r.contextClass} | ${r.negativeClass} | ${r.validation} | ${r.reservedRange ?? '-'} | ${r.band} |`),
    '',
    '| check | passes | trials | bits of evidence |',
    '| --- | ---: | ---: | ---: |',
    ...result.checksums.map(c => `| ${c.check} | ${c.passes} | ${c.trials} | ${c.bits.toFixed(2)} |`),
  ];
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runStudy();
  process.stdout.write(process.argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : toMarkdown(result));
}
