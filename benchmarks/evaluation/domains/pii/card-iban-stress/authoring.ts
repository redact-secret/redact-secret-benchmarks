/**
 * Authored truth for the #425 payment-card and IBAN validator/collision stress plans.
 *
 * Every case states its contract identity and its sensitivity by hand, from the frozen family contract and the
 * `pii-context/v1` vocabulary (redact-secret at v0.1.0-beta.10). Nothing here reads detector output. The contract
 * model re-derives identity mechanically so an authoring slip fails the plan check instead of reaching a scan.
 *
 * Values are deterministic constructions with a visible `425` marker and zero runs, or whole authority-published
 * test values. They have no cardholder, issuer-assignment, bank, account or person provenance.
 */
import { hash } from '../../../substrate/hash.ts';
import { PII_ORACLE_REFERENCE_VALIDATORS } from '../identity-oracle.ts';
import {
  VISA_ACCEPTANCE_SUPPORTED_BRAND_TEST_PANS, VISA_ACCEPTANCE_UNSUPPORTED_BRAND_TEST_PANS, ibanCheckDigits, ibanIdentity,
  luhnCheckDigit, paymentCardIdentity, type ContractIdentity,
} from './contract-model.ts';

export type StressView = 'qualification-plan' | 'diagnostic-balanced' | 'benign-heavy-stress';
export type StressSensitivity = 'sensitive' | 'non-sensitive' | 'not-established';
export type StressEvidenceClass = 'sensitive-synthetic' | 'official-test' | 'ordinary-reference-account' | 'near-miss' |
  'out-of-claim' | 'unsupported-format' | 'context-negative' | 'placeholder' | 'cross-family-collision';
export interface StressAxis { order: number; id: string; views: StressView[]; languages: ('en' | 'ko')[] }
export interface StressSpec {
  id: string; axis: string; evidenceClass: StressEvidenceClass; classes: string[]; language: 'en' | 'ko';
  construction: { id: string; serial?: number };
  prefix: string; display: string; suffix?: string;
  identity: ContractIdentity; sensitivity: StressSensitivity;
  /** Whether another PII family's contract obviously cannot fire here. `not-authored` when another family's own label or shape is present. */
  crossFamily?: 'none-expected' | 'not-authored';
  twinOf?: string; varies?: 'value' | 'layout' | 'context';
}

// Frozen axis backlog items 12–22 of evidence/901/pii-gap-ledger-v1.json (views and languages copied exactly).
export const CARD_AXES: StressAxis[] = [
  { order: 12, id: 'card-independent-sensitive-positives', views: ['qualification-plan', 'diagnostic-balanced'], languages: ['en', 'ko'] },
  { order: 13, id: 'card-official-test-values', views: ['diagnostic-balanced', 'benign-heavy-stress'], languages: ['en'] },
  { order: 14, id: 'card-luhn-valid-benign-collisions', views: ['diagnostic-balanced', 'benign-heavy-stress'], languages: ['en', 'ko'] },
  { order: 15, id: 'card-checksum-invalid-near-miss', views: ['diagnostic-balanced'], languages: ['en'] },
  { order: 16, id: 'card-issuer-range-scope-boundary', views: ['qualification-plan', 'diagnostic-balanced'], languages: ['en'] },
  { order: 17, id: 'card-separator-display-twins', views: ['qualification-plan', 'diagnostic-balanced'], languages: ['en'] },
  { order: 18, id: 'card-korean-field-and-example-context', views: ['qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'], languages: ['ko'] },
];
export const IBAN_AXES: StressAxis[] = [
  { order: 19, id: 'iban-multi-country-positives', views: ['qualification-plan', 'diagnostic-balanced'], languages: ['en', 'ko'] },
  { order: 20, id: 'iban-mod97-valid-lookalikes', views: ['diagnostic-balanced', 'benign-heavy-stress'], languages: ['en'] },
  { order: 21, id: 'iban-reference-documentation-controls', views: ['diagnostic-balanced', 'benign-heavy-stress'], languages: ['en', 'ko'] },
  { order: 22, id: 'iban-print-format-separator-twins', views: ['qualification-plan', 'diagnostic-balanced'], languages: ['en'] },
];

// ---------------------------------------------------------------------------------------------------------------
// Constructions
// ---------------------------------------------------------------------------------------------------------------
export const CONSTRUCTIONS = Object.freeze({
  'card-tail-marker-v1': 'prefix, zero run, marker 425, two-digit serial, Luhn check digit (seed redact-secret-benchmarks-425-card)',
  'card-edge-marker-v1': 'range-edge prefix, zero run, marker 425, three-digit serial from 100, Luhn check digit (seed redact-secret-benchmarks-425-card)',
  'card-head-marker-v1': 'prefix, marker 425, zero run, two-digit serial, Luhn check digit (seed redact-secret-benchmarks-425-card)',
  'card-transposition-v1': 'prefix, marker 425, digits 09 then zero run, serial, Luhn check digit; its twin swaps 09 to 90 (Luhn-blind)',
  'card-derived-near-miss-v1': 'a named construction with one digit changed or two adjacent digits swapped, Luhn failing',
  'visa-acceptance-test-card-suite': 'whole value printed on the Visa Acceptance test-card page (X read as 0), retrieved 2026-09-28',
  'iban-synx-marker-v1': 'country, check digits by the iban-v1 generator, BBAN SYNX + zero run + marker 425 + serial (seed redact-secret-benchmarks-425-iban)',
  'iban-numeric-marker-v1': 'country, check digits by the iban-v1 generator, BBAN 0425 + zero run + serial (seed redact-secret-benchmarks-425-iban)',
  'iban-derived-near-miss-v1': 'a named IBAN construction with a check digit, character or adjacent-pair change, mod-97 failing',
  'rf-creditor-reference-v1': 'ISO 11649-shaped RF reference: RF, mod-97 check digits, marker 425 + zero run (a mod-97 lookalike, not an IBAN)',
  'hand-authored-shape': 'a non-value shape (placeholder, masked or reference syntax) written by hand',
});

const serial = (value: number, width = 2) => {
  const text = String(value).padStart(width, '0');
  if (text.length !== width) throw new Error('construction serial overflows its width');
  return text;
};
const sized = (value: string, length: number) => {
  if (value.length !== length) throw new Error('construction length drift');
  return value;
};
export function cardTail(prefix: string, length: number, n: number, width = 2) {
  const zeros = length - 1 - prefix.length - 3 - width;
  if (zeros < 0) throw new Error('card construction too short');
  const body = `${prefix}${'0'.repeat(zeros)}425${serial(n, width)}`;
  return sized(`${body}${luhnCheckDigit(body)}`, length);
}
export function cardHead(prefix: string, length: number, n: number) {
  const zeros = length - 1 - prefix.length - 5;
  if (zeros < 0) throw new Error('card construction too short');
  const body = `${prefix}425${'0'.repeat(zeros)}${serial(n)}`;
  return sized(`${body}${luhnCheckDigit(body)}`, length);
}
export function ibanSynx(country: string, length: number, n: number) {
  const zeros = length - 4 - 4 - 5;
  if (zeros < 0) throw new Error('iban construction too short');
  const bban = `SYNX${'0'.repeat(zeros)}425${serial(n)}`;
  return sized(`${country}${ibanCheckDigits(country, bban)}${bban}`, length);
}
export function ibanNumeric(country: string, length: number, n: number) {
  const zeros = length - 4 - 4 - 2;
  if (zeros < 0) throw new Error('iban construction too short');
  const bban = `0425${'0'.repeat(zeros)}${serial(n)}`;
  return sized(`${country}${ibanCheckDigits(country, bban)}${bban}`, length);
}
export const groupDisplay = (value: string, sizes: number[], separator: string) => {
  const out: string[] = []; let at = 0;
  for (const size of sizes) { out.push(value.slice(at, at + size)); at += size; }
  if (at !== value.length) throw new Error('grouping does not cover the value');
  return out.join(separator);
};
export const printIban = (value: string) => value.match(/.{1,4}/g)!.join(' ');
const bumpLast = (value: string) => `${value.slice(0, -1)}${(Number(value.at(-1)) + 1) % 10}`;
const swapAt = (value: string, index: number) => `${value.slice(0, index)}${value[index + 1]}${value[index]}${value.slice(index + 2)}`;
const replaceAt = (value: string, index: number, char: string) => `${value.slice(0, index)}${char}${value.slice(index + 1)}`;

// ---------------------------------------------------------------------------------------------------------------
// Payment card cases
// ---------------------------------------------------------------------------------------------------------------
const TAIL = 'card-tail-marker-v1', HEAD = 'card-head-marker-v1', VISA_SUITE = 'visa-acceptance-test-card-suite';
const DERIVED = 'card-derived-near-miss-v1', SHAPE = 'hand-authored-shape';
const pos = (spec: Omit<StressSpec, 'identity' | 'sensitivity' | 'evidenceClass' | 'classes'> & { classes?: string[]; evidenceClass?: StressEvidenceClass }): StressSpec =>
  ({ evidenceClass: 'sensitive-synthetic', classes: ['validator-valid-sensitive'], identity: 'valid', sensitivity: 'sensitive', crossFamily: 'none-expected', ...spec });

function cardCases(): StressSpec[] {
  const cases: StressSpec[] = [];
  const add = (...rows: StressSpec[]) => cases.push(...rows);
  const A12 = 'card-independent-sensitive-positives', A13 = 'card-official-test-values', A14 = 'card-luhn-valid-benign-collisions';
  const A15 = 'card-checksum-invalid-near-miss', A16 = 'card-issuer-range-scope-boundary', A17 = 'card-separator-display-twins';
  const A18 = 'card-korean-field-and-example-context';

  // Axis 12 — independent sensitive positives across every frozen brand and length, English field labels.
  const visa16 = cardTail('4', 16, 1), amex34 = cardTail('34', 15, 2), visa19 = cardHead('4', 19, 3), jcb19 = cardHead('3580', 19, 4);
  add(
    pos({ id: 'card-pos-visa10-pan', axis: A12, language: 'en', construction: { id: TAIL, serial: 5 }, prefix: 'pan=', display: cardTail('4', 10, 5) }),
    pos({ id: 'card-pos-visa13-card-number', axis: A12, language: 'en', construction: { id: HEAD, serial: 6 }, prefix: 'card number: ', display: cardHead('4', 13, 6) }),
    pos({ id: 'card-pos-visa16-card-number-kv', axis: A12, language: 'en', construction: { id: TAIL, serial: 1 }, prefix: 'card_number=', display: visa16 }),
    pos({ id: 'card-pos-visa19-credit-card-number', axis: A12, language: 'en', construction: { id: HEAD, serial: 3 }, prefix: 'credit card number: ', display: visa19 }),
    pos({ id: 'card-pos-amex34-payment-card', axis: A12, language: 'en', construction: { id: TAIL, serial: 2 }, prefix: 'payment card = ', display: amex34 }),
    pos({ id: 'card-pos-amex37-debit-card-number', axis: A12, language: 'en', construction: { id: HEAD, serial: 7 }, prefix: 'debit card number: ', display: cardHead('37', 15, 7) }),
    pos({ id: 'card-pos-discover6011-json', axis: A12, language: 'en', construction: { id: TAIL, serial: 8 }, prefix: '{"card_number": "', display: cardTail('601104', 16, 8), suffix: '"}' }),
    pos({ id: 'card-pos-discover65-payment-card-field', axis: A12, language: 'en', construction: { id: HEAD, serial: 9 }, prefix: 'payment_card: ', display: cardHead('6504', 16, 9) }),
    pos({ id: 'card-pos-mastercard53-card-number', axis: A12, language: 'en', construction: { id: TAIL, serial: 10 }, prefix: 'card number = ', display: cardTail('5304', 16, 10) }),
    pos({ id: 'card-pos-mastercard23-upper-pan', axis: A12, language: 'en', construction: { id: HEAD, serial: 11 }, prefix: 'PAN: ', display: cardHead('2304', 16, 11) }),
    pos({ id: 'card-pos-jcb16-credit-card-number-kv', axis: A12, language: 'en', construction: { id: TAIL, serial: 12 }, prefix: 'credit_card_number=', display: cardTail('3530', 16, 12) }),
    pos({ id: 'card-pos-jcb19-debit-card-number-kebab', axis: A12, language: 'en', construction: { id: HEAD, serial: 4 }, prefix: 'debit-card-number: ', display: jcb19 }),
    pos({ id: 'card-pos-visa16-log-line', axis: A12, language: 'en', construction: { id: HEAD, serial: 13 }, prefix: 'payment ok card_number=', display: cardHead('4', 16, 13), suffix: ' status=approved' }),
    pos({ id: 'card-pos-mastercard55-customer-card-number', axis: A12, language: 'en', construction: { id: TAIL, serial: 14 }, prefix: 'customer card number: ', display: cardTail('5599', 16, 14) }),
    pos({ id: 'card-ko-pos-jcb18-credit-card-number-kv', axis: A12, language: 'ko', construction: { id: HEAD, serial: 60 }, prefix: '신용_카드_번호: ', display: cardHead('3555', 18, 60) }),
    pos({ id: 'card-ko-pos-visa13-payment-card', axis: A12, language: 'ko', construction: { id: TAIL, serial: 61 }, prefix: '결제 카드 = ', display: cardTail('4', 13, 61) }),
    pos({ id: 'card-ko-pos-mastercard22-debit-card-number-hyphen', axis: A12, language: 'ko', construction: { id: HEAD, serial: 62 }, prefix: '직불 카드 번호: ',
      display: groupDisplay(cardHead('2221', 16, 62), [4, 4, 4, 4], '-') }),
  );

  // Axis 18 — Korean field labels (every ko form), Korean example label, and the out-of-vocabulary spacing.
  const koVisa = cardTail('4', 16, 15), koMc = cardHead('5104', 16, 16);
  add(
    pos({ id: 'card-ko-pos-visa16-card-number', axis: A18, language: 'ko', construction: { id: TAIL, serial: 15 }, prefix: '카드 번호: ', display: koVisa }),
    pos({ id: 'card-ko-pos-mastercard-credit-card-number', axis: A18, language: 'ko', construction: { id: HEAD, serial: 16 }, prefix: '신용 카드 번호: ', display: koMc }),
    pos({ id: 'card-ko-pos-amex-debit-card-number-spaced', axis: A18, language: 'ko', construction: { id: TAIL, serial: 17 }, prefix: '직불_카드_번호=', display: groupDisplay(cardTail('37', 15, 17), [4, 6, 5], ' ') }),
    pos({ id: 'card-ko-pos-discover-payment-card', axis: A18, language: 'ko', construction: { id: HEAD, serial: 18 }, prefix: '결제 카드: ', display: cardHead('6011', 16, 18) }),
    pos({ id: 'card-ko-pos-jcb-customer-card-number', axis: A18, language: 'ko', construction: { id: TAIL, serial: 19 }, prefix: '고객 카드 번호 = ', display: cardTail('3589', 17, 19) }),
    pos({ id: 'card-ko-pos-visa-astral-spaced', axis: A18, language: 'ko', construction: { id: HEAD, serial: 20 }, prefix: '🔒 카드 번호: ', display: groupDisplay(cardHead('4', 16, 20), [4, 4, 4, 4], ' ') }),
    { id: 'card-ko-example-label-before', axis: A18, evidenceClass: 'context-negative', classes: ['named-negative-context'], language: 'ko', construction: { id: TAIL, serial: 15 },
      prefix: '예시 카드 번호: ', display: koVisa, identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: 'card-ko-pos-visa16-card-number', varies: 'context' },
    { id: 'card-ko-example-label-after', axis: A18, evidenceClass: 'context-negative', classes: ['named-negative-context'], language: 'ko', construction: { id: HEAD, serial: 16 },
      prefix: '신용 카드 번호: ', display: koMc, suffix: ' 예시', identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: 'card-ko-pos-mastercard-credit-card-number', varies: 'context' },
    // `(예시)` is one token under the pii-context/v1 tokenizer (whitespace, _, -, :, =), not the whole `예시` label.
    { ...pos({ id: 'card-ko-parenthesized-example-not-whole-label', axis: A18, language: 'ko', construction: { id: TAIL, serial: 15 }, prefix: '카드 번호: ', display: koVisa, suffix: ' (예시)' }),
      classes: ['annotation-not-whole-token'], twinOf: 'card-ko-pos-visa16-card-number', varies: 'context' },
    // `카드번호` (no space) is not a pii-context/v1 form; the contract gives it no sensitivity authority.
    { id: 'card-ko-unspaced-label-out-of-vocabulary', axis: A18, evidenceClass: 'context-negative', classes: ['out-of-vocabulary-label'], language: 'ko', construction: { id: TAIL, serial: 15 },
      prefix: '카드번호: ', display: koVisa, identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: 'card-ko-pos-visa16-card-number', varies: 'context' },
    { id: 'card-ko-official-test-value', axis: A18, evidenceClass: 'official-test', classes: ['authoritative-test-value'], language: 'ko', construction: { id: VISA_SUITE },
      prefix: '카드 번호: ', display: '5555555555554444', identity: 'valid', sensitivity: 'non-sensitive', crossFamily: 'none-expected' },
    { id: 'card-ko-order-number-collision', axis: A18, evidenceClass: 'ordinary-reference-account', classes: ['luhn-valid-order-reference-collision'], language: 'ko', construction: { id: TAIL, serial: 15 },
      prefix: '주문 번호: ', display: koVisa, identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: 'card-ko-pos-visa16-card-number', varies: 'context' },
  );

  // Axis 13 — the full frozen supported-brand test subset under positive field context, layouts, and non-inheritance.
  const testIds: Record<string, string> = { '378282246310005': 'amex', '6011111111111117': 'discover', '3566111111111113': 'jcb',
    '2222420000001113': 'mastercard-222242', '2222630000001125': 'mastercard-222263', '5555555555554444': 'mastercard-5555', '4111111111111111': 'visa' };
  for (const value of VISA_ACCEPTANCE_SUPPORTED_BRAND_TEST_PANS) add({ id: `card-test-${testIds[value]}`, axis: A13, evidenceClass: 'official-test',
    classes: ['authoritative-test-value'], language: 'en', construction: { id: VISA_SUITE }, prefix: 'card_number=', display: value,
    identity: 'valid', sensitivity: 'non-sensitive', crossFamily: 'none-expected' });
  add(
    { id: 'card-test-visa-spaced-layout', axis: A13, evidenceClass: 'official-test', classes: ['authoritative-test-value'], language: 'en', construction: { id: VISA_SUITE },
      prefix: 'card_number=', display: groupDisplay('4111111111111111', [4, 4, 4, 4], ' '), identity: 'valid', sensitivity: 'non-sensitive', crossFamily: 'none-expected',
      twinOf: 'card-test-visa', varies: 'layout' },
    { id: 'card-test-amex-hyphen-layout', axis: A13, evidenceClass: 'official-test', classes: ['authoritative-test-value'], language: 'en', construction: { id: VISA_SUITE },
      prefix: 'card_number=', display: groupDisplay('378282246310005', [4, 6, 5], '-'), identity: 'valid', sensitivity: 'non-sensitive', crossFamily: 'none-expected',
      twinOf: 'card-test-amex', varies: 'layout' },
    pos({ id: 'card-test-shared-bin-does-not-inherit', axis: A13, language: 'en', construction: { id: TAIL, serial: 21 }, prefix: 'card_number=', display: cardTail('411111', 16, 21),
      classes: ['test-value-shared-prefix'], twinOf: 'card-test-visa', varies: 'value' }),
    pos({ id: 'card-test-word-does-not-inherit', axis: A13, language: 'en', construction: { id: TAIL, serial: 1 }, prefix: 'test card_number=', display: visa16,
      classes: ['test-word-context'], twinOf: 'card-pos-visa16-card-number-kv', varies: 'context' }),
    { id: 'card-test-discover-neighbor-out-of-range', axis: A13, evidenceClass: 'out-of-claim', classes: ['issuer-range-invalid'], language: 'en', construction: { id: TAIL, serial: 22 },
      prefix: 'card_number=', display: cardTail('601111', 16, 22), identity: 'invalid', sensitivity: 'not-established', crossFamily: 'none-expected',
      twinOf: 'card-test-discover', varies: 'value' },
  );
  for (const [index, value] of VISA_ACCEPTANCE_UNSUPPORTED_BRAND_TEST_PANS.entries()) add({ id: `card-test-maestro-out-of-claim-${index + 1}`, axis: A13,
    evidenceClass: 'out-of-claim', classes: ['unsupported-brand-test-value'], language: 'en', construction: { id: VISA_SUITE }, prefix: 'card_number=', display: value,
    identity: 'invalid', sensitivity: 'not-established', crossFamily: 'none-expected' });

  // Axis 14 — in-range Luhn-valid values under ordinary non-card contexts (identity valid, sensitivity not established).
  const collision = (id: string, prefix: string, display: string, klass: string, language: 'en' | 'ko', construction: StressSpec['construction'],
    extra: Partial<StressSpec> = {}): StressSpec => ({ id, axis: A14, evidenceClass: 'ordinary-reference-account', classes: [klass], language, construction,
    prefix, display, identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected', ...extra });
  add(
    collision('card-collision-order-id-twin', 'order_id=', visa16, 'luhn-valid-order-reference-collision', 'en', { id: TAIL, serial: 1 },
      { twinOf: 'card-pos-visa16-card-number-kv', varies: 'context' }),
    collision('card-collision-order-number', 'order number: ', cardHead('4', 16, 23), 'luhn-valid-order-reference-collision', 'en', { id: HEAD, serial: 23 }),
    collision('card-collision-invoice', 'invoice_no=', cardTail('5412', 16, 24), 'luhn-valid-order-reference-collision', 'en', { id: TAIL, serial: 24 }),
    collision('card-collision-account-number', 'account_number=', cardHead('6011', 16, 25), 'luhn-valid-account-collision', 'en', { id: HEAD, serial: 25 }),
    collision('card-collision-bank-account-twin', 'bank account: ', amex34, 'luhn-valid-account-collision', 'en', { id: TAIL, serial: 2 },
      { twinOf: 'card-pos-amex34-payment-card', varies: 'context' }),
    collision('card-collision-tracking-number', 'tracking_number: ', cardTail('4', 18, 26), 'luhn-valid-order-reference-collision', 'en', { id: TAIL, serial: 26 }),
    collision('card-collision-transaction-id', 'transaction_id=', cardHead('3560', 16, 27), 'luhn-valid-order-reference-collision', 'en', { id: HEAD, serial: 27 }),
    collision('card-collision-loyalty-number', 'loyalty_number: ', cardTail('2720', 16, 28), 'luhn-valid-account-collision', 'en', { id: TAIL, serial: 28 }),
    collision('card-collision-membership-card', 'membership card: ', cardHead('4', 16, 29), 'generic-card-word', 'en', { id: HEAD, serial: 29 }),
    collision('card-collision-generic-card-word', 'card: ', cardTail('4', 16, 30), 'generic-card-word', 'en', { id: TAIL, serial: 30 }),
    collision('card-collision-number-word', 'number: ', cardHead('5200', 16, 31), 'luhn-valid-random-collision', 'en', { id: HEAD, serial: 31 }),
    collision('card-collision-neutral-value', 'value=', cardTail('4', 16, 32), 'neutral-context', 'en', { id: TAIL, serial: 32 }),
    collision('card-collision-nonce', 'nonce=', jcb19, 'luhn-valid-random-collision', 'en', { id: HEAD, serial: 4 },
      { twinOf: 'card-pos-jcb19-debit-card-number-kebab', varies: 'context' }),
    collision('card-collision-bare-prose', 'Shipment ', cardHead('4', 16, 33), 'luhn-valid-random-collision', 'en', { id: HEAD, serial: 33 },
      { suffix: ' was scanned at the dock.' }),
    collision('card-collision-phone-label-visa10', 'phone: ', cardHead('4', 10, 34), 'luhn-valid-phone-collision', 'en', { id: HEAD, serial: 34 },
      { crossFamily: 'not-authored' }),
    collision('card-ko-collision-account-number', '계좌 번호: ', cardHead('5500', 16, 35), 'luhn-valid-account-collision', 'ko', { id: HEAD, serial: 35 }),
    collision('card-ko-collision-invoice-number', '송장 번호: ', cardTail('4', 16, 36), 'luhn-valid-order-reference-collision', 'ko', { id: TAIL, serial: 36 }),
    collision('card-ko-collision-member-number', '회원 번호 = ', cardHead('3540', 16, 37), 'luhn-valid-account-collision', 'ko', { id: HEAD, serial: 37 }),
    collision('card-ko-collision-generic-card-word', '카드: ', cardTail('4', 16, 38), 'generic-card-word', 'ko', { id: TAIL, serial: 38 }),
    collision('card-ko-collision-neutral-value', '값: ', cardHead('4', 16, 39), 'neutral-context', 'ko', { id: HEAD, serial: 39 }),
  );

  // Axis 15 — checksum failures derived from named positives (validator correctness only), and the Luhn blind spot.
  const nearMiss = (id: string, display: string, twinOf: string, klass = 'validator-checksum-invalid'): StressSpec => ({ id, axis: A15, evidenceClass: 'near-miss',
    classes: [klass], language: 'en', construction: { id: DERIVED }, prefix: 'card_number=', display, identity: 'invalid', sensitivity: 'not-established',
    crossFamily: 'none-expected', twinOf, varies: 'value' });
  add(
    nearMiss('card-near-miss-visa16-last-digit', bumpLast(visa16), 'card-pos-visa16-card-number-kv'),
    nearMiss('card-near-miss-visa16-adjacent-swap', swapAt(visa16, 12), 'card-pos-visa16-card-number-kv', 'adjacent-transposition'),
    nearMiss('card-near-miss-visa16-middle-digit', replaceAt(visa16, 7, '1'), 'card-pos-visa16-card-number-kv'),
  );
  // Twins must differ only in the value, so the context is identical to each named positive.
  const nearMissFor = (id: string, twin: StressSpec, display: string, klass = 'validator-checksum-invalid'): StressSpec => ({ ...nearMiss(id, display, twin.id, klass),
    prefix: twin.prefix, suffix: twin.suffix });
  const find = (id: string) => cases.find(row => row.id === id)!;
  add(
    nearMissFor('card-near-miss-amex-middle-digit', find('card-pos-amex34-payment-card'), replaceAt(amex34, 6, '5')),
    nearMissFor('card-near-miss-visa19-last-digit', find('card-pos-visa19-credit-card-number'), bumpLast(visa19)),
    nearMissFor('card-near-miss-jcb19-adjacent-swap', find('card-pos-jcb19-debit-card-number-kebab'), swapAt(jcb19, 4), 'adjacent-transposition'),
  );
  const transposed = (() => { const body = `4425090000000${serial(40)}`; return `${body}${luhnCheckDigit(body)}`; })();
  add(
    pos({ id: 'card-transposition-base', axis: A15, language: 'en', construction: { id: 'card-transposition-v1', serial: 40 }, prefix: 'card_number=', display: transposed }),
    pos({ id: 'card-transposition-09-90-luhn-blind', axis: A15, language: 'en', construction: { id: 'card-transposition-v1', serial: 40 }, prefix: 'card_number=',
      display: transposed.replace('4425090', '4425900'), classes: ['luhn-blind-transposition'], twinOf: 'card-transposition-base', varies: 'value' }),
  );

  // Axis 16 — in-range and out-of-range IIN/length twins at every frozen range edge. Both twins are Luhn-valid.
  let edgeSerial = 100;
  const edge = (id: string, prefix: string, length: number, inRange: boolean, twinOf?: string): StressSpec => {
    const n = edgeSerial++;
    const row: StressSpec = { id, axis: A16, evidenceClass: inRange ? 'sensitive-synthetic' : 'out-of-claim',
      classes: [inRange ? 'issuer-range-edge-valid' : 'issuer-range-invalid'], language: 'en', construction: { id: 'card-edge-marker-v1', serial: n },
      prefix: 'card_number=', display: cardTail(prefix, length, n, 3), identity: inRange ? 'valid' : 'invalid',
      sensitivity: inRange ? 'sensitive' : 'not-established', crossFamily: 'none-expected' };
    if (twinOf) Object.assign(row, { twinOf, varies: 'value' });
    return row;
  };
  const pair = (name: string, inPrefix: string, inLength: number, outPrefix: string, outLength: number) => {
    add(edge(`card-edge-${name}-in`, inPrefix, inLength, true), edge(`card-edge-${name}-out`, outPrefix, outLength, false, `card-edge-${name}-in`));
  };
  pair('amex-34-vs-33', '34', 15, '33', 15);
  pair('amex-37-vs-38', '37', 15, '38', 15);
  pair('amex-37-vs-36', '37', 15, '36', 15);
  pair('amex-34-vs-35', '34', 15, '35', 15);
  pair('amex-length-15-vs-16', '34', 15, '34', 16);
  pair('amex-length-15-vs-14', '37', 15, '37', 14);
  pair('discover-601100-vs-601099', '601100', 16, '601099', 16);
  pair('discover-601109-vs-601110', '601109', 16, '601110', 16);
  pair('discover-601120-vs-601119', '601120', 16, '601119', 16);
  pair('discover-601149-vs-601150', '601149', 16, '601150', 16);
  pair('discover-601174-vs-601173', '601174', 16, '601173', 16);
  pair('discover-601174-vs-601175', '601174', 16, '601175', 16);
  pair('discover-601177-vs-601176', '601177', 16, '601176', 16);
  pair('discover-601179-vs-601180', '601179', 16, '601180', 16);
  pair('discover-601186-vs-601185', '601186', 16, '601185', 16);
  pair('discover-601199-vs-601200', '601199', 16, '601200', 16);
  pair('discover-644000-vs-643999', '644000', 16, '643999', 16);
  pair('discover-659999-vs-660000', '659999', 16, '660000', 16);
  pair('discover-length-16-vs-17', '601100', 16, '601100', 17);
  pair('mastercard-510000-vs-509999', '510000', 16, '509999', 16);
  pair('mastercard-559999-vs-560000', '559999', 16, '560000', 16);
  pair('mastercard-222100-vs-222099', '222100', 16, '222099', 16);
  pair('mastercard-272099-vs-272100', '272099', 16, '272100', 16);
  pair('mastercard-length-16-vs-15', '510000', 16, '510000', 15);
  pair('jcb-3528-vs-3527', '3528', 16, '3527', 16);
  pair('jcb-3589-vs-3590', '3589', 16, '3590', 16);
  pair('jcb-length-16-vs-15', '3528', 16, '3528', 15);
  pair('jcb-length-19-vs-20', '3528', 19, '3528', 20);
  pair('visa-length-10-vs-9', '4', 10, '4', 9);
  pair('visa-length-19-vs-20', '4', 19, '4', 20);
  add(edge('card-edge-jcb-length-18-in', '3528', 18, true), edge('card-edge-visa-length-17-in', '4', 17, true));

  // Axis 17 — supported and unsupported display layouts as declared twins of named positives.
  const layout = (id: string, twin: StressSpec, display: string, supported: boolean, klass: string): StressSpec => supported ?
    { ...twin, id, axis: A17, classes: [klass], display, twinOf: twin.id, varies: 'layout' } :
    { id, axis: A17, evidenceClass: 'unsupported-format', classes: [klass], language: 'en', construction: { id: SHAPE }, prefix: twin.prefix,
      display, suffix: twin.suffix, identity: 'not-established', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: twin.id, varies: 'layout' };
  const base16 = find('card-pos-visa16-card-number-kv'), baseAmex = find('card-pos-amex34-payment-card'), base19 = find('card-pos-visa19-credit-card-number');
  add(
    layout('card-layout-visa16-space-4444', base16, groupDisplay(visa16, [4, 4, 4, 4], ' '), true, 'supported-layout'),
    layout('card-layout-visa16-hyphen-4444', base16, groupDisplay(visa16, [4, 4, 4, 4], '-'), true, 'supported-layout'),
    layout('card-layout-amex-space-465', baseAmex, groupDisplay(amex34, [4, 6, 5], ' '), true, 'supported-layout'),
    layout('card-layout-amex-hyphen-465', baseAmex, groupDisplay(amex34, [4, 6, 5], '-'), true, 'supported-layout'),
    layout('card-layout-visa16-mixed-separators', base16, `${visa16.slice(0, 4)} ${visa16.slice(4, 8)}-${visa16.slice(8, 12)} ${visa16.slice(12)}`, false, 'unsupported-format'),
    layout('card-layout-visa16-double-space', base16, groupDisplay(visa16, [4, 4, 4, 4], '  '), false, 'unsupported-format'),
    layout('card-layout-visa16-tab', base16, groupDisplay(visa16, [4, 4, 4, 4], '\t'), false, 'unsupported-format'),
    layout('card-layout-visa16-nbsp', base16, groupDisplay(visa16, [4, 4, 4, 4], ' '), false, 'unsupported-format'),
    layout('card-layout-visa16-dot', base16, groupDisplay(visa16, [4, 4, 4, 4], '.'), false, 'unsupported-format'),
    layout('card-layout-visa16-unicode-hyphen', base16, groupDisplay(visa16, [4, 4, 4, 4], '‐'), false, 'unsupported-format'),
    layout('card-layout-visa16-grouping-466', base16, groupDisplay(visa16, [4, 6, 6], ' '), false, 'unsupported-format'),
    layout('card-layout-visa19-grouping-44443', base19, groupDisplay(visa19, [4, 4, 4, 4, 3], ' '), false, 'unsupported-format'),
    layout('card-layout-amex-grouping-4443', baseAmex, groupDisplay(amex34, [4, 4, 4, 3], ' '), false, 'unsupported-format'),
    layout('card-layout-visa16-fullwidth-digits', base16, [...visa16].map(digit => String.fromCharCode(0xff10 + Number(digit))).join(''), false, 'unsupported-format'),
    { ...layout('card-layout-visa16-masked', base16, `${visa16.slice(0, 4)} **** **** ${visa16.slice(12)}`, false, 'masked-value'), evidenceClass: 'placeholder', varies: 'value' },
  );

  // English example-label twins and the parenthesized annotation.
  add(
    { id: 'card-en-example-label-before', axis: A14, evidenceClass: 'context-negative', classes: ['named-negative-context'], language: 'en', construction: { id: TAIL, serial: 1 },
      prefix: 'example card_number=', display: visa16, identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected',
      twinOf: 'card-pos-visa16-card-number-kv', varies: 'context' },
    { id: 'card-en-documentation-label-after', axis: A14, evidenceClass: 'context-negative', classes: ['named-negative-context'], language: 'en', construction: { id: HEAD, serial: 3 },
      prefix: 'credit card number: ', display: visa19, suffix: ' documentation', identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected',
      twinOf: 'card-pos-visa19-credit-card-number', varies: 'context' },
  );

  // Cross-family collisions on the card side (card vs IBAN / phone / SSN / network-address), and the contract's
  // equidistance rule for a field label that sits one scalar from a preceding candidate.
  add(
    pos({ id: 'card-xfam-visa10-nanp-shaped-under-card-label', axis: A12, language: 'en', construction: { id: HEAD, serial: 80 }, prefix: 'card_number=',
      display: cardHead('4', 10, 80), evidenceClass: 'cross-family-collision', classes: ['cross-family-phone-shape'] }),
    { id: 'card-xfam-card-under-iban-label', axis: A14, evidenceClass: 'cross-family-collision', classes: ['cross-family-iban-label'], language: 'en',
      construction: { id: TAIL, serial: 1 }, prefix: 'iban: ', display: visa16, identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected',
      twinOf: 'card-pos-visa16-card-number-kv', varies: 'context' },
    { id: 'card-xfam-card-under-ssn-label', axis: A14, evidenceClass: 'cross-family-collision', classes: ['cross-family-ssn-label'], language: 'en',
      construction: { id: TAIL, serial: 1 }, prefix: 'ssn: ', display: visa16, identity: 'valid', sensitivity: 'not-established', crossFamily: 'not-authored',
      twinOf: 'card-pos-visa16-card-number-kv', varies: 'context' },
    { id: 'card-xfam-ssn-shape-under-card-label', axis: A16, evidenceClass: 'cross-family-collision', classes: ['cross-family-ssn-shape'], language: 'en',
      construction: { id: TAIL, serial: 81 }, prefix: 'card_number=', display: cardTail('4', 9, 81), identity: 'invalid', sensitivity: 'not-established', crossFamily: 'not-authored' },
    { id: 'card-xfam-equidistant-after-ip', axis: A12, evidenceClass: 'cross-family-collision', classes: ['context-equidistance'], language: 'en',
      construction: { id: TAIL, serial: 1 }, prefix: 'ip=203.0.113.9 card_number=', display: visa16, identity: 'valid', sensitivity: 'not-established',
      crossFamily: 'not-authored', twinOf: 'card-xfam-nearest-after-ip', varies: 'context' },
    pos({ id: 'card-xfam-nearest-after-ip', axis: A12, language: 'en', construction: { id: TAIL, serial: 1 }, prefix: 'ip=203.0.113.9; card_number=', display: visa16,
      evidenceClass: 'cross-family-collision', classes: ['context-equidistance-control'], crossFamily: 'not-authored' }),
  );
  return cases;
}

// ---------------------------------------------------------------------------------------------------------------
// IBAN cases
// ---------------------------------------------------------------------------------------------------------------
const SYNX = 'iban-synx-marker-v1', NUM = 'iban-numeric-marker-v1', IDERIVED = 'iban-derived-near-miss-v1';

function ibanCases(): StressSpec[] {
  const cases: StressSpec[] = [];
  const add = (...rows: StressSpec[]) => cases.push(...rows);
  const find = (id: string) => cases.find(row => row.id === id)!;
  const A19 = 'iban-multi-country-positives', A20 = 'iban-mod97-valid-lookalikes', A21 = 'iban-reference-documentation-controls';
  const A22 = 'iban-print-format-separator-twins';
  let n = 1;
  const make = (kind: 'synx' | 'numeric', country: string, length: number) => {
    const s = n++; return { value: kind === 'synx' ? ibanSynx(country, length, s) : ibanNumeric(country, length, s), construction: { id: kind === 'synx' ? SYNX : NUM, serial: s } };
  };
  const ipos = (id: string, prefix: string, kind: 'synx' | 'numeric', country: string, print = false, language: 'en' | 'ko' = 'en', suffix?: string) => {
    const made = make(kind, country, ({ ...IBAN_LENGTHS })[country]);
    return pos({ id, axis: A19, language, construction: made.construction, prefix, display: print ? printIban(made.value) : made.value, ...(suffix ? { suffix } : {}) });
  };

  // Axis 19 — independent positives across Release 103 countries and every length from 15 to 33.
  add(
    ipos('iban-pos-no15-compact', 'iban: ', 'synx', 'NO'),
    ipos('iban-pos-be16-upper-label', 'IBAN=', 'numeric', 'BE'),
    ipos('iban-pos-dk18-long-label', 'international bank account number: ', 'synx', 'DK'),
    ipos('iban-pos-nl18-json', '{"iban": "', 'numeric', 'NL', false, 'en', '"}'),
    ipos('iban-pos-fi18-print', 'iban: ', 'synx', 'FI', true),
    ipos('iban-pos-mk19-compact', 'iban = ', 'numeric', 'MK'),
    ipos('iban-pos-at20-compact', 'iban: ', 'synx', 'AT'),
    ipos('iban-pos-ch21-kv', 'iban=', 'numeric', 'CH'),
    ipos('iban-pos-de22-compact', 'iban: ', 'numeric', 'DE'),
    ipos('iban-pos-gb22-beneficiary', 'beneficiary iban: ', 'synx', 'GB'),
    ipos('iban-pos-ie22-print', 'IBAN: ', 'numeric', 'IE', true),
    ipos('iban-pos-gi23-compact', 'iban: ', 'synx', 'GI'),
    ipos('iban-pos-es24-kebab', 'payee-iban: ', 'numeric', 'ES'),
    ipos('iban-pos-pt25-compact', 'iban: ', 'synx', 'PT'),
    ipos('iban-pos-tr26-compact', 'iban: ', 'numeric', 'TR'),
    ipos('iban-pos-it27-print', 'iban: ', 'synx', 'IT', true),
    ipos('iban-pos-fr27-log-line', 'transfer queued iban=', 'numeric', 'FR', false, 'en', ' amount=10'),
    ipos('iban-pos-pl28-compact', 'iban: ', 'synx', 'PL'),
    ipos('iban-pos-br29-compact', 'iban: ', 'numeric', 'BR'),
    ipos('iban-pos-mu30-compact', 'iban: ', 'synx', 'MU'),
    ipos('iban-pos-mt31-print', 'iban: ', 'numeric', 'MT', true),
    ipos('iban-pos-lc32-print', 'iban: ', 'synx', 'LC', true),
    ipos('iban-pos-ru33-print', 'iban: ', 'numeric', 'RU', true),
    ipos('iban-ko-pos-de22-korean-label', '국제 계좌번호: ', 'synx', 'DE', false, 'ko'),
    ipos('iban-ko-pos-fr27-print-underscore', '국제_계좌번호=', 'synx', 'FR', true, 'ko'),
    ipos('iban-ko-pos-nl18-payee', '수취인 국제 계좌번호: ', 'synx', 'NL', false, 'ko'),
    ipos('iban-ko-pos-es24-iban-form', '송금 iban: ', 'numeric', 'ES', false, 'ko'),
    ipos('iban-ko-pos-se24-astral-print', '🔒 국제 계좌번호 = ', 'numeric', 'SE', true, 'ko'),
  );

  // Axis 20 — mod-97-valid lookalikes: wrong country lengths, unknown countries, RF references, checksum failures,
  // and exact-length checksum-valid values under ordinary non-IBAN labels.
  const lookalike = (id: string, prefix: string, display: string, identity: ContractIdentity, klass: string, construction: StressSpec['construction'],
    evidenceClass: StressEvidenceClass, extra: Partial<StressSpec> = {}): StressSpec => ({ id, axis: A20, evidenceClass, classes: [klass], language: 'en',
    construction, prefix, display, identity, sensitivity: 'not-established', crossFamily: 'none-expected', ...extra });
  const wrong = (id: string, kind: 'synx' | 'numeric', country: string, length: number) => {
    const made = make(kind, country, length);
    return lookalike(id, 'iban: ', made.value, 'invalid', 'country-length-invalid', made.construction, 'out-of-claim');
  };
  add(
    wrong('iban-lookalike-de21-short', 'numeric', 'DE', 21), wrong('iban-lookalike-de23-long', 'numeric', 'DE', 23),
    wrong('iban-lookalike-gb21-short', 'synx', 'GB', 21), wrong('iban-lookalike-gb23-long', 'synx', 'GB', 23),
    wrong('iban-lookalike-no16-long', 'synx', 'NO', 16), wrong('iban-lookalike-fr28-long', 'numeric', 'FR', 28),
    wrong('iban-lookalike-ru34-long', 'numeric', 'RU', 34), wrong('iban-lookalike-lc31-short', 'synx', 'LC', 31),
  );
  const unknown = (id: string, kind: 'synx' | 'numeric', country: string, length: number, prefix = 'iban: ') => {
    const made = make(kind, country, length);
    return lookalike(id, prefix, made.value, 'invalid', 'unknown-country', made.construction, 'out-of-claim');
  };
  add(
    unknown('iban-lookalike-unknown-us22', 'numeric', 'US', 22), unknown('iban-lookalike-unknown-kr22', 'synx', 'KR', 22),
    unknown('iban-lookalike-unknown-zz24', 'synx', 'ZZ', 24), unknown('iban-lookalike-unknown-ca20', 'numeric', 'CA', 20),
  );
  const rf = (() => { const reference = `4250000000${serial(90)}`; const check = ibanCheckDigits('RF', reference); return `RF${check}${reference}`; })();
  add(
    lookalike('iban-lookalike-rf-reference-payment-label', 'payment reference: ', rf, 'invalid', 'rf-creditor-reference', { id: 'rf-creditor-reference-v1', serial: 90 }, 'out-of-claim'),
    lookalike('iban-lookalike-rf-reference-iban-label', 'iban: ', rf, 'invalid', 'rf-creditor-reference', { id: 'rf-creditor-reference-v1', serial: 90 }, 'out-of-claim',
      { twinOf: 'iban-lookalike-rf-reference-payment-label', varies: 'context' }),
  );
  const de = find('iban-pos-de22-compact'), gb = find('iban-pos-gb22-beneficiary'), it = find('iban-pos-it27-print');
  const nm = (id: string, twin: StressSpec, display: string, klass = 'validator-checksum-invalid'): StressSpec => ({ id, axis: A20, evidenceClass: 'near-miss', classes: [klass],
    language: 'en', construction: { id: IDERIVED }, prefix: twin.prefix, display, suffix: twin.suffix, identity: 'invalid', sensitivity: 'not-established',
    crossFamily: 'none-expected', twinOf: twin.id, varies: 'value' });
  const bumpCheck = (value: string) => `${value.slice(0, 2)}${String((Number(value.slice(2, 4)) + 1) % 100).padStart(2, '0')}${value.slice(4)}`;
  add(
    nm('iban-near-miss-de22-check-digits', de, bumpCheck(de.display)),
    nm('iban-near-miss-de22-bban-digit', de, replaceAt(de.display, 15, '7')),
    nm('iban-near-miss-gb22-adjacent-swap', gb, swapAt(gb.display, 18), 'adjacent-transposition'),
    nm('iban-near-miss-it27-print-letter', it, replaceAt(it.display, 7, 'Y')),
  );
  const exact = (id: string, prefix: string, twin: StressSpec | null, kind: 'synx' | 'numeric', country: string, klass: string, suffix?: string) => {
    if (twin) return lookalike(id, prefix, twin.display, 'valid', klass, twin.construction, 'ordinary-reference-account',
      { twinOf: twin.id, varies: 'context', ...(suffix ? { suffix } : {}) });
    const made = make(kind, country, IBAN_LENGTHS[country]);
    return lookalike(id, prefix, made.value, 'valid', klass, made.construction, 'ordinary-reference-account', suffix ? { suffix } : {});
  };
  add(
    exact('iban-collision-sku-twin', 'sku: ', de, 'numeric', 'DE', 'checksum-valid-semantic-collision'),
    exact('iban-collision-order-ref', 'order_ref=', null, 'synx', 'GB', 'checksum-valid-semantic-collision'),
    exact('iban-collision-account-number', 'account_number: ', null, 'numeric', 'CH', 'checksum-valid-account-label'),
    exact('iban-collision-bank-account', 'bank account: ', null, 'synx', 'BE', 'checksum-valid-account-label'),
    exact('iban-collision-tracking', 'tracking=', null, 'synx', 'FR', 'checksum-valid-semantic-collision'),
    exact('iban-collision-neutral-value', 'value: ', null, 'numeric', 'ES', 'neutral-context'),
    exact('iban-collision-bare-prose', 'Batch ', null, 'synx', 'IT', 'checksum-valid-semantic-collision', ' closed without errors.'),
    exact('iban-collision-neutral-context-twin', 'reference ', gb, 'synx', 'GB', 'checksum-valid-semantic-collision'),
  );

  // Axis 21 — documentation/example labels (en and ko), template references, placeholders and masked values.
  const ctxNeg = (id: string, prefix: string, twin: StressSpec, language: 'en' | 'ko', suffix?: string): StressSpec => ({ id, axis: A21, evidenceClass: 'context-negative',
    classes: ['documentation-example-public-absence'], language, construction: twin.construction, prefix, display: twin.display, ...(suffix ? { suffix } : {}),
    identity: 'valid', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: twin.id, varies: 'context' });
  const ko = find('iban-ko-pos-de22-korean-label'), no = find('iban-pos-no15-compact'), pt = find('iban-pos-pt25-compact');
  add(
    ctxNeg('iban-doc-example-before', 'example iban: ', de, 'en'),
    ctxNeg('iban-doc-documentation-before', 'documentation iban: ', no, 'en'),
    ctxNeg('iban-doc-example-after', 'iban: ', pt, 'en', ' example'),
    ctxNeg('iban-ko-doc-example-before-iban-form', '예시 iban: ', de, 'ko'),
    ctxNeg('iban-ko-doc-example-before-korean-label', '예시 국제 계좌번호: ', ko, 'ko'),
    ctxNeg('iban-ko-doc-example-after', '국제 계좌번호: ', ko, 'ko', ' 예시'),
    { ...pos({ id: 'iban-en-parenthesized-example-not-whole-label', axis: A21, language: 'en', construction: pt.construction, prefix: 'iban: ', display: pt.display, suffix: ' (example)' }),
      classes: ['annotation-not-whole-token'], twinOf: pt.id, varies: 'context' },
  );
  const ref = (id: string, prefix: string, display: string, suffix: string, klass: string, language: 'en' | 'ko' = 'en'): StressSpec => ({ id, axis: A21,
    evidenceClass: 'placeholder', classes: [klass], language, construction: { id: SHAPE }, prefix, display, suffix, identity: 'not-established',
    sensitivity: 'not-established', crossFamily: 'none-expected' });
  const at = find('iban-pos-at20-compact');
  add(
    // A whole reference is one unsupported shape: the braces belong to the authored display, not to its context.
    ref('iban-ref-mustache-at20', 'iban: ', `{{${at.display}}}`, '', 'reference-syntax'),
    ref('iban-ref-env-at20', 'iban: ', `\${${at.display}}`, '', 'reference-syntax'),
    ref('iban-ref-angle-at20', 'iban: ', `<${at.display}>`, '', 'reference-syntax'),
    ref('iban-ref-env-name', 'iban: ', '${IBAN}', '', 'reference-syntax'),
    ref('iban-ref-placeholder-x', 'iban: ', 'XXXX XXXX XXXX XXXX XX', '', 'placeholder'),
    ref('iban-ref-masked', 'iban: ', 'DE** **** **** **** **** 00', '', 'masked-value'),
    ref('iban-ko-ref-masked', '국제 계좌번호: ', 'GB** **** **** **** **** **', '', 'masked-value', 'ko'),
  );

  // Axis 22 — print-form and separator twins of named positives.
  const iprint = (id: string, twin: StressSpec, display: string, supported: boolean, klass: string, suffix?: string): StressSpec => supported ?
    { ...twin, id, axis: A22, classes: [klass], display, ...(suffix !== undefined ? { suffix } : {}), twinOf: twin.id, varies: suffix !== undefined ? 'context' : 'layout' } :
    { id, axis: A22, evidenceClass: 'unsupported-format', classes: [klass], language: 'en', construction: { id: SHAPE }, prefix: twin.prefix, display,
      suffix: twin.suffix, identity: 'not-established', sensitivity: 'not-established', crossFamily: 'none-expected', twinOf: twin.id, varies: 'layout' };
  const dePrint = printIban(de.display);
  add(
    iprint('iban-print-de22-final-group-2', de, dePrint, true, 'print-form'),
    iprint('iban-print-no15-final-group-3', no, printIban(no.display), true, 'print-form'),
    iprint('iban-print-de22-trailing-space-outside-range', { ...de, id: 'iban-print-de22-final-group-2' }, dePrint, true, 'print-form-surrounding-space', ' '),
    iprint('iban-print-de22-hyphen', de, dePrint.replaceAll(' ', '-'), false, 'unsupported-format'),
    iprint('iban-print-de22-double-space', de, dePrint.replaceAll(' ', '  '), false, 'unsupported-format'),
    iprint('iban-print-de22-tab', de, dePrint.replaceAll(' ', '\t'), false, 'unsupported-format'),
    iprint('iban-print-de22-nbsp', de, dePrint.replaceAll(' ', ' '), false, 'unsupported-format'),
    iprint('iban-print-de22-lowercase', de, de.display.toLowerCase(), false, 'unsupported-format'),
    iprint('iban-print-de22-mixed-case', de, `${de.display.slice(0, 1)}${de.display.slice(1, 2).toLowerCase()}${de.display.slice(2)}`, false, 'unsupported-format'),
    iprint('iban-print-de22-mixed-compact-and-print', de, `${de.display.slice(0, 4)} ${de.display.slice(4, 8)} ${de.display.slice(8)}`, false, 'unsupported-format'),
    iprint('iban-print-de22-groups-of-five', de, de.display.match(/.{1,5}/g)!.join(' '), false, 'unsupported-format'),
    iprint('iban-print-de22-dot', de, dePrint.replaceAll(' ', '.'), false, 'unsupported-format'),
  );

  // Cross-family: an AT print IBAN whose four BBAN groups are a Luhn-valid 16-digit Visa-range card shape; the
  // IBAN is found under its own label, and the card has no card context. Equidistance after a card candidate.
  const atCardBody = (() => { const body = `4425${'0'.repeat(9)}${serial(91)}`; return `${body}${luhnCheckDigit(body)}`; })();
  const atCard = `AT${ibanCheckDigits('AT', atCardBody)}${atCardBody}`;
  add(
    pos({ id: 'iban-xfam-at20-print-card-shaped-bban', axis: A19, language: 'en', construction: { id: 'iban-numeric-marker-v1', serial: 91 }, prefix: 'iban: ',
      display: printIban(atCard), evidenceClass: 'cross-family-collision', classes: ['cross-family-card-shape'] }),
    { id: 'iban-xfam-at20-print-under-card-label', axis: A20, evidenceClass: 'cross-family-collision', classes: ['cross-family-card-label'], language: 'en',
      construction: { id: 'iban-numeric-marker-v1', serial: 91 }, prefix: 'card number: ', display: printIban(atCard), identity: 'valid', sensitivity: 'not-established',
      crossFamily: 'none-expected', twinOf: 'iban-xfam-at20-print-card-shaped-bban', varies: 'context' },
    { id: 'iban-xfam-iban-under-phone-label', axis: A20, evidenceClass: 'cross-family-collision', classes: ['cross-family-phone-label'], language: 'en',
      construction: de.construction, prefix: 'phone: ', display: de.display, identity: 'valid', sensitivity: 'not-established', crossFamily: 'not-authored',
      twinOf: de.id, varies: 'context' },
    { id: 'iban-xfam-equidistant-after-card', axis: A19, evidenceClass: 'cross-family-collision', classes: ['context-equidistance'], language: 'en',
      construction: de.construction, prefix: `card_number=${cardTail('4', 16, 92)} iban=`, display: de.display, identity: 'valid', sensitivity: 'not-established',
      crossFamily: 'not-authored', twinOf: 'iban-xfam-nearest-after-card', varies: 'context' },
    pos({ id: 'iban-xfam-nearest-after-card', axis: A19, language: 'en', construction: de.construction, prefix: `card_number=${cardTail('4', 16, 92)}; iban=`,
      display: de.display, evidenceClass: 'cross-family-collision', classes: ['context-equidistance-control'], crossFamily: 'not-authored' }),
  );
  return cases;
}
const IBAN_LENGTHS: Record<string, number> = { NO: 15, BE: 16, DK: 18, NL: 18, FI: 18, MK: 19, AT: 20, CH: 21, DE: 22, GB: 22, IE: 22, GI: 23, ES: 24,
  SE: 24, PT: 25, TR: 26, IT: 27, FR: 27, PL: 28, BR: 29, MU: 30, MT: 31, LC: 32, RU: 33, CA: 20, US: 22, KR: 22, ZZ: 24 };

// ---------------------------------------------------------------------------------------------------------------
// Plan materialization
// ---------------------------------------------------------------------------------------------------------------
export interface StressCase extends StressSpec {
  views: StressView[]; input: string;
  expected: { publicFinding: boolean; start?: number; end?: number; sensitive: boolean };
  oracle: { candidate: { start: number; end: number } | null; identity: ContractIdentity; identityBasis: string[];
    sensitivity: StressSensitivity; sensitivityBasis: string[] };
}

const bytes = (value: string) => Buffer.byteLength(value);
function materialize(spec: StressSpec, axes: StressAxis[], family: 'card' | 'iban'): StressCase {
  const axis = axes.find(row => row.id === spec.axis);
  if (!axis) throw new Error(`unknown axis ${spec.axis}`);
  const suffix = spec.suffix ?? '';
  const input = `${spec.prefix}${spec.display}${suffix}`;
  const start = bytes(spec.prefix), end = start + bytes(spec.display);
  const model = family === 'card' ? paymentCardIdentity(spec.display) : ibanIdentity(spec.display);
  // The basis cites the shared #423 reference validator's verdict on the authored candidate, never detector output.
  const reference = PII_ORACLE_REFERENCE_VALIDATORS[family === 'card' ? 'luhn' : 'iban-mod97'].validate(spec.display);
  const identityBasis = spec.identity === 'not-established' ? [] :
    spec.identity === 'valid' ? [...(model.authorityTestValue ? ['authority-published-value'] : []), 'contract-grammar', 'reference-validator'] :
      reference ? ['contract-grammar'] : model.reason === 'checksum' ? ['reference-validator'] : ['contract-grammar', 'reference-validator'];
  const sensitivityBasis = spec.sensitivity === 'sensitive' ? ['contract-context-rule'] : spec.sensitivity === 'non-sensitive' ? ['authority-reserved-value'] : [];
  const publicFinding = spec.identity === 'valid' && spec.sensitivity === 'sensitive';
  const { suffix: _suffix, ...rest } = spec;
  return {
    ...rest, ...(spec.suffix !== undefined ? { suffix: spec.suffix } : {}), views: [...axis.views], input,
    expected: publicFinding ? { publicFinding: true, start, end, sensitive: true } : { publicFinding: false, sensitive: false },
    oracle: { candidate: spec.identity === 'not-established' ? null : { start, end }, identity: spec.identity, identityBasis,
      sensitivity: spec.sensitivity, sensitivityBasis },
  };
}

export const STRESS_PLAN_FILES = Object.freeze({
  'pii:global:payment-card': 'benchmarks/evaluation/domains/pii/card-iban-stress/payment-card-stress-v1.json',
  'pii:global:iban': 'benchmarks/evaluation/domains/pii/card-iban-stress/iban-stress-v1.json',
});

const LEDGER = { file: 'evidence/901/pii-gap-ledger-v1.json', contentCommitment: '7fcbba702d93849ce1452ee5a9adf3d20e493179107ec0c6bbda36cb9e5fd116' };

/** Declared base-rate masses per view: diagnostic-balanced weighs present classes equally; benign-heavy puts 1% on sensitive. */
function populations(cases: StressCase[]) {
  const views: StressView[] = ['qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];
  return views.map(view => {
    const members = cases.filter(row => row.views.includes(view));
    const classes = [...new Set(members.map(row => row.evidenceClass))].sort();
    let strata: { evidenceClass: string; mass: number }[];
    if (view === 'benign-heavy-stress') {
      const benign = classes.filter(klass => klass !== 'sensitive-synthetic');
      const sensitive = classes.includes('sensitive-synthetic') ? 100 : 0;
      const each = Math.floor((10000 - sensitive) / benign.length);
      strata = [...benign.map((evidenceClass, index) => ({ evidenceClass, mass: each + (index === 0 ? 10000 - sensitive - each * benign.length : 0) })),
        ...(sensitive ? [{ evidenceClass: 'sensitive-synthetic', mass: sensitive }] : [])].sort((a, b) => a.evidenceClass.localeCompare(b.evidenceClass));
    } else {
      const each = Math.floor(10000 / classes.length);
      strata = classes.map((evidenceClass, index) => ({ evidenceClass, mass: each + (index === 0 ? 10000 - each * classes.length : 0) }));
    }
    return { id: view, denominator: { unit: 'authored-case', selection: 'explicit-members', caseIds: members.map(row => row.id) },
      baseRate: { kind: 'declared-assumption', totalMass: 10000, rationaleCode: view === 'benign-heavy-stress' ? 'benign-heavy-one-percent-sensitive' :
        view === 'diagnostic-balanced' ? 'diagnostic-equal-class-mass' : 'qualification-equal-class-mass', strata } };
  });
}

export function buildStressPlan(family: 'pii:global:payment-card' | 'pii:global:iban') {
  const card = family === 'pii:global:payment-card';
  const axes = card ? CARD_AXES : IBAN_AXES;
  const cases = (card ? cardCases() : ibanCases()).map(spec => materialize(spec, axes, card ? 'card' : 'iban'));
  const authority = card ? {
    structure: { sourceKind: 'standard', sourceId: 'iso-iec-7812-1', locator: 'https://www.iso.org/standard/70484.html', revision: '2017-edition-5-confirmed-2022' },
    issuerRanges: { sourceKind: 'payment-processor-documentation', sourceId: 'visa-acceptance-card-type-identification',
      locator: 'https://developer.cybersource.com/docs/cybs/en-us/test-data/developer/all/so/test-data/best_practices_intro/card_type_id.html', revision: 'accessed-2026-09-27' },
    testValues: { sourceKind: 'payment-processor-documentation', sourceId: 'visa-acceptance-test-card-numbers',
      locator: 'https://developer.visaacceptance.com/docs/vas/en-us/payments/developer/fiservrc/rest/payments/payments-intro/payments-testing-services/payments-testing-cards.html',
      revision: 'retrieved-2026-09-28', subset: 'supported-brand subset of 7 whole values; 3 Maestro values kept as out-of-claim controls' },
    validator: { id: 'luhn', version: 1, normativeSource: 'PCI-SSC-FAQ-1137' },
  } : {
    countryRegistry: { sourceKind: 'registration-authority', sourceId: 'swift-iso-13616-iban-registry', locator: 'https://www.swift.com/swift-resource/9606/download',
      revision: 'Release 103 (2026-09-17)', derivedCountryLengthRows: 89 },
    validator: { id: 'iban-mod97', version: 1, normativeSource: 'ISO 13616-1:2020' },
  };
  const authorityGaps = card ? [] : [{
    id: 'no-authority-reserved-iban-value',
    detail: 'pii-v1 and iban-v1 name no authority-reserved or test IBAN: Release 103 is frozen for country/length rows only, and its per-country example values carry no negative authority in the contract. The valid/non-sensitive cell therefore stays empty by contract; no control was invented. The registry download returned HTTP 403 on 2026-09-28, so no example value could be verified either.',
  }];
  const nonGoals = card ? [
    { id: 'unsupported-brands-and-ranges', basis: 'Brands and ranges outside the frozen subset (Maestro test values included) are payment-card-v1 false negatives by contract; measured as out-of-claim absence.' },
    { id: 'mixed-separator-layouts', basis: 'Mixed, repeated, tab, NBSP, dot, Unicode-hyphen and non-4-4-4-4/4-6-5 layouts are contracted unsupported formats.' },
    { id: 'korean-unspaced-label', basis: 'pii-context/v1 lists 카드 번호 with a space; the unspaced 카드번호 has no sensitivity authority (contract false negative).' },
  ] : [
    { id: 'noncanonical-iban-formats', basis: 'Lowercase, mixed case, hyphen, repeated space, tab, NBSP, dot, groups of five and mixed compact/print are iban-v1 unsupported formats.' },
    { id: 'countries-outside-registry-103', basis: 'Only the 89 Release 103 country/length rows are in claim; US, KR, CA, ZZ and RF are out of claim.' },
  ];
  const contractNotes = [
    { id: 'context-equidistance', basis: 'pii-context/v1: a context match equidistant from two candidates associates with neither. A field label separated by one scalar from a preceding candidate on the same line is therefore unassociated, so the value after it is not established as sensitive (a contract false negative, measured as absence).' },
    { id: 'annotation-not-whole-token', basis: 'pii-context/v1 tokenizes on whitespace, underscore, hyphen, colon and equals only; a parenthesized (example)/(예시) is not the whole example label and does not suppress.' },
  ];
  const plan = {
    schemaVersion: 1, reportType: 'pii-validator-collision-stress-plan', planVersion: 1, supportClaims: false,
    issue: 'redact-secret/redact-secret-benchmarks#425', parentLedger: LEDGER, family,
    findingType: card ? 'pii_global_payment_card' : 'pii_global_iban', familyContractVersion: 1,
    contract: { repository: 'redact-secret/redact-secret', sourceCommit: 'af7f863f29f9fe482dd233c8b7bc5b77dc427314',
      file: card ? 'docs/contracts/pii/payment-card-v1.md' : 'docs/contracts/pii/iban-v1.md', contextVocabulary: 'pii-context/v1' },
    profile: { id: 'pii-v1', version: 1 }, canonicalOffsetUnit: 'utf8-byte', authority, authorityGaps,
    constructions: Object.entries(CONSTRUCTIONS).filter(([id]) => cases.some(row => row.construction.id === id)).map(([id, method]) => ({ id, method })),
    axes, nonGoals, contractNotes,
    independenceRequirements: card ?
      { minDistinctPositiveValues: 40, maxDominantPositiveCaseShare: 0.15, minPositiveConstructions: 2, minKoreanPositives: 6, minDeclaredTwins: 60 } :
      { minDistinctPositiveValues: 25, maxDominantPositiveCaseShare: 0.2, minPositiveConstructions: 2, minKoreanPositives: 5, minDeclaredTwins: 25 },
    populations: populations(cases),
    cases,
  };
  return { ...plan, planSeed: hash(`redact-secret-benchmarks-425-${card ? 'card' : 'iban'}`) };
}
