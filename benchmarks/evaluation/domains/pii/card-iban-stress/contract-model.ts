/**
 * Benchmark-side identity model of the frozen `payment-card-v1` and `iban-v1` family contracts (benchmarks #425).
 *
 * It is written from the contract text in redact-secret `docs/contracts/pii/payment-card-v1.md` and
 * `docs/contracts/pii/iban-v1.md` at the released beta.10 commit, not from detector source or output. It decides
 * only contract identity (`valid` / `invalid` / `not-established`) for an authored display string. Sensitivity is
 * authored separately; nothing here reads context.
 */

export type ContractIdentity = 'valid' | 'invalid' | 'not-established';
export interface ContractIdentityResult {
  identity: ContractIdentity;
  /** Why an established candidate is valid or invalid; `unsupported-shape` for not-established. */
  reason: 'valid' | 'checksum' | 'range' | 'length' | 'country' | 'country-length' | 'unsupported-shape';
  normalized: string | null;
  /** The reference validator's verdict on the authored candidate (Luhn / ISO 13616 mod-97), or null when no shape. */
  checksum: boolean | null;
  authorityTestValue: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// payment-card-v1
// ---------------------------------------------------------------------------------------------------------------

/**
 * The frozen supported-brand subset of the Visa Acceptance Solutions test-card suite ("Testing the Payment
 * Services — Test Card Numbers"). The page prints some digits as `X` with the instruction "replace each X with a 0";
 * these are those whole values with the substitution applied. Maestro entries are deliberately excluded by the
 * contract (unsupported brand).
 */
export const VISA_ACCEPTANCE_SUPPORTED_BRAND_TEST_PANS = Object.freeze([
  '378282246310005', // American Express 3782 8224 631X XX5
  '6011111111111117', // Discover 6X11 1111 1111 1117
  '3566111111111113', // JCB
  '2222420000001113', // Mastercard 2222 42XX XXXX 1113
  '2222630000001125', // Mastercard 2222 63XX XXXX 1125
  '5555555555554444', // Mastercard
  '4111111111111111', // Visa
]);
/** Maestro test values printed on the same page. Out of claim: the brand is outside the frozen positive grammar. */
export const VISA_ACCEPTANCE_UNSUPPORTED_BRAND_TEST_PANS = Object.freeze([
  '586824160825533338', // Maestro (International) 5868 2416 0825 5333 38
  '5641821111166669', // Maestro (International) 5641 8211 1116 6669
  '6759411100000008', // Maestro (UK Domestic) 6759 4111 XXXX XXX8
]);

export function luhnValid(digits: string) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Check digit that makes `body + digit` Luhn-valid. */
export function luhnCheckDigit(body: string) {
  for (let digit = 0; digit < 10; digit += 1) if (luhnValid(`${body}${digit}`)) return String(digit);
  throw new Error('unreachable');
}

/** Frozen Visa Acceptance card-type table (retrieved 2026-09-27) as the contract states it. */
export function paymentBrand(digits: string): 'amex' | 'discover' | 'jcb' | 'mastercard' | 'visa' | null {
  const length = digits.length, p2 = Number(digits.slice(0, 2)), p4 = Number(digits.slice(0, 4)), p6 = Number(digits.slice(0, 6));
  if (length === 15 && (p2 === 34 || p2 === 37)) return 'amex';
  if (length === 16 && ((p6 >= 601100 && p6 <= 601109) || (p6 >= 601120 && p6 <= 601149) || p6 === 601174 ||
    (p6 >= 601177 && p6 <= 601179) || (p6 >= 601186 && p6 <= 601199) || (p6 >= 644000 && p6 <= 659999))) return 'discover';
  if (length >= 16 && length <= 19 && p4 >= 3528 && p4 <= 3589) return 'jcb';
  if (length === 16 && ((p6 >= 510000 && p6 <= 559999) || (p6 >= 222100 && p6 <= 272099))) return 'mastercard';
  if (length >= 10 && length <= 19 && digits[0] === '4') return 'visa';
  return null;
}

/**
 * Display grammar: ASCII digits, optionally separated by one kind of ASCII space or `-` in exactly the `4-4-4-4` or
 * American Express `4-6-5` layout. Any other character or layout is an unsupported shape (identity not established).
 * A compact or supported-layout digit run outside 10–19 digits is a lookalike the contract rejects (invalid).
 */
export function paymentCardIdentity(display: string): ContractIdentityResult {
  const none: ContractIdentityResult = { identity: 'not-established', reason: 'unsupported-shape', normalized: null, checksum: null, authorityTestValue: false };
  if (!/^[0-9][0-9 -]*[0-9]$/.test(display)) return none;
  const separators = new Set(display.replace(/[0-9]/g, ''));
  if (separators.size > 1) return none;
  if (separators.size === 1) {
    const separator = [...separators][0];
    const groups = display.split(separator).map(group => group.length).join('-');
    if (groups !== '4-4-4-4' && groups !== '4-6-5') return none;
  }
  const digits = display.replace(/[ -]/g, '');
  const checksum = luhnValid(digits);
  const authorityTestValue = VISA_ACCEPTANCE_SUPPORTED_BRAND_TEST_PANS.includes(digits);
  const base = { normalized: digits, checksum, authorityTestValue };
  if (digits.length < 10 || digits.length > 19) return { identity: 'invalid', reason: 'length', ...base };
  // An exact published test PAN is admitted as identity even when its prefix is outside the positive table.
  if (!authorityTestValue && paymentBrand(digits) === null) return { identity: 'invalid', reason: 'range', ...base };
  if (!checksum) return { identity: 'invalid', reason: 'checksum', ...base };
  return { identity: 'valid', reason: 'valid', ...base };
}

// ---------------------------------------------------------------------------------------------------------------
// iban-v1
// ---------------------------------------------------------------------------------------------------------------

/** SWIFT ISO 13616 IBAN Registry Release 103 country-code/exact-length rows, copied from the frozen contract. */
export const IBAN_REGISTRY_103_LENGTHS: Readonly<Record<string, number>> = Object.freeze(Object.fromEntries(`
AD24 AE23 AL28 AT20 AZ28 BA20 BE16 BG22 BH22 BI27 BR29 BY28
CH21 CR22 CY28 CZ24 DE22 DJ27 DK18 DO28 EE20 EG29 ES24 FI18
FK18 FO18 FR27 GB22 GE22 GI23 GL18 GR27 GT28 HN28 HR21
HU28 IE22 IL23 IQ23 IS26 IT27 JO30 KW30 KZ20 LB28 LC32 LI21
LT20 LU20 LV21 LY25 MC27 MD24 ME22 MK19 MN20 MR27 MT31 MU30
NI28 NL18 NO15 OM23 PK24 PL28 PS29 PT25 QA29 RO24 RS22 RU33
SA24 SC31 SD18 SE24 SI19 SK24 SM27 SO23 ST25 SV28 TL23 TN24
TR26 UA29 VA22 VG24 XK20 YE30`.trim().split(/\s+/).map(row => [row.slice(0, 2), Number(row.slice(2))])));

export function ibanMod97Remainder(electronic: string) {
  const rearranged = `${electronic.slice(4)}${electronic.slice(0, 4)}`;
  let remainder = 0;
  for (const char of rearranged) {
    const chunk = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of chunk) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

/** The contract's check-digit generator: append country + `00`, compute the remainder, check = 98 − remainder. */
export function ibanCheckDigits(country: string, bban: string) {
  return String(98 - ibanMod97Remainder(`${country}00${bban}`)).padStart(2, '0');
}

/**
 * Electronic form: 15–34 uppercase ASCII letters/digits, two letters then two check digits. Print form: the same
 * characters grouped from the left in fours separated by exactly one ASCII space, final group of one to four.
 * Anything else is an unsupported shape. A supported shape with an unknown country, a wrong country length or a
 * failing mod-97 is a lookalike the contract rejects (invalid).
 */
export function ibanIdentity(display: string): ContractIdentityResult {
  const none: ContractIdentityResult = { identity: 'not-established', reason: 'unsupported-shape', normalized: null, checksum: null, authorityTestValue: false };
  let electronic: string;
  if (display.includes(' ')) {
    const groups = display.split(' ');
    if (groups.some((group, index) => index < groups.length - 1 ? group.length !== 4 : group.length < 1 || group.length > 4)) return none;
    electronic = groups.join('');
  } else electronic = display;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(electronic) || electronic.length < 15 || electronic.length > 34) return none;
  const checksum = ibanMod97Remainder(electronic) === 1;
  const base = { normalized: electronic, checksum, authorityTestValue: false };
  const length = IBAN_REGISTRY_103_LENGTHS[electronic.slice(0, 2)];
  if (length === undefined) return { identity: 'invalid', reason: 'country', ...base };
  if (electronic.length !== length) return { identity: 'invalid', reason: 'country-length', ...base };
  if (!checksum) return { identity: 'invalid', reason: 'checksum', ...base };
  return { identity: 'valid', reason: 'valid', ...base };
}
