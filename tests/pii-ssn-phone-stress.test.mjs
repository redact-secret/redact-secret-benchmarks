import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  C3_BACKLOG, c3Files, c3Independence, c3PlanCommitment, materializeC3Case, summarizeC3Surface, syntheticNanpParts, syntheticUsSsnParts,
  validateC3File,
} from '../benchmarks/evaluation/domains/pii/ssn-phone-stress.ts';
import { PII_ORACLE_REFERENCE_VALIDATORS, piiIdentityOracle, validatePiiIdentityOracle } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';

const ledger = JSON.parse(await readFile(new URL('../evidence/901/pii-gap-ledger-v1.json', import.meta.url), 'utf8'));
const clone = value => structuredClone(value);
const ssn = () => clone(c3Files['pii:us:ssn'].file), phone = () => clone(c3Files['pii:global:phone'].file);
const validate = (file, family = file.family) => validateC3File(file, ledger.axisBacklog, c3Files[family].path);
const refreeze = file => { file.frozen.planCommitment = c3PlanCommitment(file); return file; };

test('both #426 stress plans validate against the frozen #422 backlog, their frozen commitment and the #423 oracle rules', () => {
  for (const family of Object.keys(c3Files)) {
    const { file } = c3Files[family];
    const { plan, independence } = validate(clone(file));
    assert.equal(plan.cases.length, file.cases.length);
    assert.equal(file.frozen.planCommitment, c3PlanCommitment(file));
    assert.deepEqual([...new Set(file.cases.map(row => row.axis))].sort((a, b) => a - b), C3_BACKLOG[family]);
    assert.equal(independence.v1CandidateReuse, 0);
    assert.ok(independence.dominantCandidateShare <= 0.15);
    for (const view of ['diagnostic-balanced', 'benign-heavy-stress']) {
      assert.ok(independence.perView[view].sensitiveCases > 0, `${family} ${view} has sensitive mass`);
      assert.ok(independence.perView[view].languages.ko > 0, `${family} ${view} has Korean cases`);
    }
  }
  assert.doesNotThrow(() => validatePiiIdentityOracle(piiIdentityOracle));
});

test('synthetic constructions stay inside their declared safe namespace', () => {
  const allocation = PII_ORACLE_REFERENCE_VALIDATORS['us-ssn-allocation'].validate;
  for (let index = 0; index < 500; index += 1) {
    const parts = syntheticUsSsnParts(`probe-${index}`);
    assert.ok(allocation(`${parts.area}${parts.group}${parts.serial}`));
    const nanp = syntheticNanpParts(`probe-${index}`);
    assert.match(nanp.npa, /^[2-9]9\d$/, 'N9X area codes are reserved for expansion');
    assert.ok(nanp.nxx !== '555' && nanp.nxx.slice(1) !== '11');
  }
  for (const row of c3Files['pii:global:phone'].file.cases.filter(item => item.candidate.set?.nxx === '555')) {
    const line = Number(row.candidate.set.line);
    assert.equal(row.oracle.sensitivity === 'non-sensitive', line >= 100 && line <= 199, row.id);
  }
});

test('#408/#411: a valid SSN under an unlisted placeholder, sample or test label is sensitive; only a type-invalid placeholder is not', () => {
  const rows = c3Files['pii:us:ssn'].file.cases.filter(row => /placeholder|sample|test|dummy/.test(row.prefix));
  assert.ok(rows.length >= 4);
  for (const row of rows) {
    const valid = row.oracle.identity === 'valid';
    assert.equal(row.expected.publicFinding, valid, row.id);
    assert.equal(row.oracle.sensitivity, valid ? 'sensitive' : 'not-established', row.id);
  }
  const relabelled = ssn();
  const placeholder = relabelled.cases.find(row => row.id === 'bh-placeholder-valid-unlisted-label');
  placeholder.expected.publicFinding = false;
  placeholder.oracle = { identity: 'valid', identityBasis: ['contract-grammar', 'reference-validator'], sensitivity: 'non-sensitive', sensitivityBasis: [] };
  assert.throws(() => validate(refreeze(relabelled)), /basis/);
});

test('expectations are frozen: a changed case, label or twin is rejected', () => {
  const edited = ssn(); edited.cases[0].expected.publicFinding = false;
  assert.throws(() => validate(edited), /changed after it was frozen/);
  const disagree = ssn(); disagree.cases[0].expected.publicFinding = false;
  assert.throws(() => validate(refreeze(disagree)), /oracle/);
  const twin = phone(); const row = twin.cases.find(item => item.id === 'qp-ext-one-digit'); row.prefix = 'telephone: ';
  assert.throws(() => validate(refreeze(twin)), /Twin differs/);
  const invalid = ssn(); invalid.cases.find(item => item.id === 'qp-twin-area-666').oracle =
    { identity: 'valid', identityBasis: ['contract-grammar', 'reference-validator'], sensitivity: 'not-established', sensitivityBasis: [] };
  assert.throws(() => validate(refreeze(invalid)), /reference validator/);
});

test('populations declare denominators, masses and non-zero sensitive mass; backlog coverage is mechanical', () => {
  const zero = ssn(); const rate = zero.populations[1].baseRate; rate.notEstablishedMass += rate.sensitiveMass; rate.sensitiveMass = 0;
  assert.throws(() => validate(zero), /denominator/);
  const count = phone(); count.populations[0].caseCount += 1;
  assert.throws(() => validate(count), /denominator/);
  const uncovered = ssn(); uncovered.cases = uncovered.cases.filter(row => !(row.axis === 25 && row.view === 'benign-heavy-stress'));
  uncovered.populations[1].caseCount = uncovered.cases.filter(row => row.view === 'benign-heavy-stress').length;
  assert.throws(() => validate(refreeze(uncovered)), /Backlog item 25/);
});

test('the independence audit rejects a dominant construction', () => {
  const dominant = phone();
  const base = dominant.cases.find(row => row.id === 'qp-ext-base');
  for (const row of dominant.cases.filter(item => item.view === 'qualification-plan' && item.id !== base.id && 'seed' in item.candidate)) {
    row.candidate = { ...clone(base.candidate), ...(row.candidate.extension ? { extension: row.candidate.extension } : {}) };
  }
  assert.ok(c3Independence(dominant).dominantCandidateShare > 0.15);
});

test('the phone reference validator covers every phone-v1 display without changing an N11 verdict', () => {
  const nanp = PII_ORACLE_REFERENCE_VALIDATORS['nanp-structure'].validate;
  for (const value of ['(293) 456-7890', '+1-293-456-7890', '293-456-7890 extension 12', '+1-293-456-7890 ext. 5', '(293) 456-7890 ext 123456'])
    assert.ok(nanp(value), value);
  for (const value of ['(211) 456-7890', '+1-293-411-7890', '(293) 456-7890 ext 1234567', '293.456.7890', '+1 (293) 456-7890'])
    assert.ok(!nanp(value), value);
});

test('the surface summary is counts only and separates misses, range errors and false alarms', () => {
  const { file } = c3Files['pii:global:phone'];
  const exact = file.cases.map(row => {
    const built = materializeC3Case(row);
    return { id: row.id, familyFindings: row.expected.publicFinding ? [{ start: 0, end: 1, action: 'redact' }] : [], exactRange: row.expected.publicFinding,
      outputContainsCandidate: !row.expected.publicFinding, findingCarriesPlaintext: false, overlapTypes: [], scanNanoseconds: built.input.length };
  });
  const clean = summarizeC3Surface(file, exact);
  for (const view of Object.values(clean.views)) { assert.equal(view.publicStream.missed + view.publicStream.falseAlarm + view.publicStream.rangeMismatch, 0); }
  assert.equal(clean.views['benign-heavy-stress'].weighted.falseAlarmRate, 0);
  assert.equal(clean.outputLeakage.sensitiveOutputsContainingCandidate, 0);
  const noisy = clone(exact);
  noisy[file.cases.findIndex(row => row.id === 'bh-555-dash')].familyFindings = [{ start: 0, end: 1, action: 'redact' }];
  noisy[file.cases.findIndex(row => row.id === 'bh-en-telephone-field')].familyFindings = [];
  const summary = summarizeC3Surface(file, noisy);
  assert.equal(summary.views['benign-heavy-stress'].publicStream.falseAlarm, 1);
  assert.equal(summary.views['benign-heavy-stress'].publicStream.missed, 1);
  assert.equal(summary.views['benign-heavy-stress'].weighted.sensitiveMissRate, 0.5);
  const text = JSON.stringify(summary);
  for (const row of file.cases) { assert.ok(!text.includes(row.id)); assert.ok(!text.includes(materializeC3Case(row).candidate)); }
});
