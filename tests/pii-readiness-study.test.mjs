// PII-readiness study harness (#258). It is a study, not a detector: these
// tests pin the study's observations and keep its reserved shapes out of the
// fixture and corpus trees, so nothing here reads as shipped PII support.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHAPES, checksumStrength, ibanMod97Valid, isbn13Valid, luhnValid, mirrorBand, reservedRange, runStudy, ssnStructurallyValid,
} from '../benchmarks/studies/pii-readiness.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const { rows } = runStudy();
const row = id => rows.find(r => r.id === id);

// Shapes that are documentation-only without falling in a reserved range.
const DOCUMENTED_WITHOUT_RANGE = new Set([
  'ssn-x-mask', 'ssn-star-mask', 'pan-luhn-twin', 'date-dob-ctx', 'date-release-ctx', 'isbn-13', 'iban-example', 'credential-reference',
]);

test('every study shape is reserved, a documented example, or a mask', () => {
  for (const shape of SHAPES) {
    assert.ok(reservedRange(shape) !== null || DOCUMENTED_WITHOUT_RANGE.has(shape.id), `${shape.id} has no reserved or documented basis`);
    assert.ok(shape.basis.length > 0, shape.id);
  }
});

test('no study value is a fixture, corpus entry or category', () => {
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full); else files.push(full);
    }
  };
  walk(path.join(root, 'fixtures'));
  walk(path.join(root, 'corpora'));
  // Masks are generic digit/symbol runs that legitimately occur inside other values.
  const values = SHAPES.filter(s => s.kind !== 'credential' && s.dimension !== 'mask' && s.value.length >= 8).map(s => s.value);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const value of values) assert.ok(!text.includes(value), `${path.relative(root, file)} contains study value ${value}`);
  }
  const categories = readFileSync(path.join(root, 'benchmarks/categories.json'), 'utf8');
  assert.ok(!categories.includes('studies/'), 'the study must not be registered as a benchmark category');
});

test('study-local checks agree with their documented examples', () => {
  assert.ok(luhnValid('4111111111111111'));
  assert.ok(!luhnValid('4111111111111112'));
  assert.ok(isbn13Valid('978-0-306-40615-7'));
  assert.ok(ibanMod97Valid('GB82WEST12345698765432'));
  assert.ok(!ssnStructurallyValid('000-12-3456') && !ssnStructurallyValid('666-12-3456') && !ssnStructurallyValid('987-65-4321'));
  assert.ok(ssnStructurallyValid('123-45-6789'));
});

test('checksum strength: Luhn and ISBN-13 carry log2(10) bits, SSN structure almost none', () => {
  const byCheck = Object.fromEntries(checksumStrength().map(c => [c.check, c]));
  assert.equal(byCheck['luhn (PAN)'].passes * 10, byCheck['luhn (PAN)'].trials);
  assert.equal(byCheck['isbn-13'].passes * 10, byCheck['isbn-13'].trials);
  assert.ok(byCheck['iban mod-97'].bits > 6.5 && byCheck['iban mod-97'].bits < 6.7);
  assert.ok(byCheck['ssn structure'].bits < 0.2);
});

test('under the v1 mirror, no PII shape reaches medium; the credential reference reaches high', () => {
  for (const r of rows.filter(x => x.kind !== 'credential')) assert.ok(r.band === 'none' || r.band === 'low', `${r.id}: ${r.band}`);
  assert.equal(row('credential-reference').band, 'high');
  // Context vocabulary, not the value, moves a phone shape: only `password=` scores.
  assert.equal(row('phone-support-ctx').band, 'none');
  assert.equal(row('phone-patient-ctx').band, 'none');
  assert.equal(row('phone-password-ctx').band, 'low');
  assert.equal(row('phone-patient-ctx').contextClass, row('phone-support-ctx').contextClass);
  // Entropy rises with length: a long reserved email crosses the randomness ramp.
  assert.equal(row('email-long').band, 'low');
  // Checksum pass and fail twins are indistinguishable to v1.
  assert.equal(row('pan-visa-test').band, row('pan-luhn-twin').band);
});

test('only an unsegmented mask is negative evidence today', () => {
  assert.equal(row('ssn-all-zero').negativeClass, 'mask');
  assert.equal(row('ssn-x-mask').negativeClass, 'none');
  assert.equal(row('ssn-star-mask').negativeClass, 'none');
  assert.equal(mirrorBand(400000, 'credential-name', 'mask'), 'none');
});
