import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { piiContextEvidence, validatePiiContextEvidence } from '../benchmarks/evaluation/domains/pii/context-evidence.ts';
import { accountPiiRows, piiAccountingRowsFromEvaluation } from '../benchmarks/evaluation/domains/pii/accounting.ts';

test('canonical context evidence is strict, versioned, and frozen to English and Korean', () => {
  assert.deepEqual(piiContextEvidence.languages, ['en', 'ko']);
  assert.equal(piiContextEvidence.upstream.revision, '230439ec8f208afadba6afba82d1b183e7800a15');
  assert.equal(piiContextEvidence.evidenceGroup, 'contextual');
  assert.deepEqual(piiContextEvidence.normalization.tokenSeparators, ['whitespace', 'underscore', 'hyphen', 'colon', 'equals']);
  assert.throws(() => validatePiiContextEvidence({ ...structuredClone(piiContextEvidence), extra: true }), /schema/);
  const third = structuredClone(piiContextEvidence); third.languages.push('ja');
  assert.throws(() => validatePiiContextEvidence(third), /English and Korean/);
  const duplicate = structuredClone(piiContextEvidence); duplicate.entries.push(structuredClone(duplicate.entries[0]));
  assert.throws(() => validatePiiContextEvidence(duplicate), /Duplicate/);
});

test('Korean evidence covers normalization, mixed keys, separators, ambiguity, and benign prose', () => {
  const korean = piiContextEvidence.groups.find(group => group.language === 'ko');
  const features = new Set(korean.frames.flatMap(frame => frame.features));
  for (const feature of ['hangul', 'mixed-ascii-hangul', 'whitespace', 'underscore', 'hyphen', 'colon', 'equals', 'nfc', 'nfd',
    'governed-invisible', 'ambiguous', 'benign-prose']) assert.ok(features.has(feature), feature);
  const nfd = korean.frames.find(frame => frame.features.includes('nfd')).template;
  assert.notEqual(nfd, nfd.normalize('NFC'));
  assert.match(korean.frames.find(frame => frame.features.includes('governed-invisible')).template, /[\u200b\ufe0f]/u);
  assert.ok(korean.frames.filter(frame => frame.features.includes('ambiguous')).every(frame => frame.sensitivity === 'not-established'));
  assert.ok(korean.frames.some(frame => frame.contextClass === 'non-sensitive'));
});

test('one data-driven method preserves candidate bytes and never infers jurisdiction from language', () => {
  const methods = piiDomain.createMethods();
  for (const source of piiDomain.contextEvidence.loadPiiContextCases()) {
    const variants = methods.get('context-discrimination').generate(source);
    assert.equal(source.contract.scope, 'global');
    assert.equal(source.contract.family, 'pii:global:email');
    assert.equal(new Set(variants.map(variant => Buffer.from(variant.fixture.content).subarray(variant.candidate.start, variant.candidate.end).toString())).size, 1);
    assert.ok(variants.every(variant => variant.contract.context.language === source.contract.context.language));
    assert.ok(variants.every(variant => variant.contract.scope === 'global'));
    assert.ok(variants.every(variant => !Object.hasOwn(variant.evidence, 'jurisdiction')));
  }
});

test('English and Korean context outcomes produce aggregate-only language strata', async () => {
  const cases = piiDomain.contextEvidence.loadPiiContextCases();
  const scanner = { id: 'pii-context-scanner', mode: 'candidate', configuration: { fixture: true }, capabilities: { ranges: true, classification: true },
    async version() { return '1.0.0'; }, async scan(_directory, inputs) {
      return inputs.map(input => {
        const candidate = 'subject@example.invalid', start = Buffer.byteLength(input.content.slice(0, input.content.indexOf(candidate)));
        return { path: input.path, start, end: start + Buffer.byteLength(candidate), family: 'pii:global:email',
          sensitive: !/negative|neutral|ambiguous|benign-prose/.test(input.path), rawValue: 'RAW-PII-MUST-DROP', diagnostic: candidate };
      });
    } };
  const artifact = await piiDomain.execute({ cases, methods: piiDomain.createMethods(), scanners: [scanner] });
  const rows = piiAccountingRowsFromEvaluation(artifact), report = accountPiiRows(rows);
  assert.deepEqual(Object.keys(report.contextByLanguage), ['en', 'ko']);
  assert.ok(report.contextByLanguage.en.sensitive.pass > 0);
  assert.ok(report.contextByLanguage.ko.sensitive.pass > 0);
  assert.ok(report.contextByLanguage.en.neutral['review-required'] > 0);
  assert.ok(report.contextByLanguage.ko['non-sensitive'].pass > 0);
  const serialized = JSON.stringify({ artifact, report });
  assert.doesNotMatch(serialized, /subject@example\.invalid|RAW-PII-MUST-DROP|customer_이메일|연락처|documentation example|"content"|fixtureHash|contentHash/);
  assert.doesNotMatch(serialized, /jurisdiction:KR|pii:kr:/);
});

test('a hostile Korean-jurisdiction finding cannot turn Korean language evidence into jurisdiction support', async () => {
  const source = piiDomain.contextEvidence.loadPiiContextCases().find(candidate => candidate.contract.context.language === 'ko');
  const scanner = { id: 'hostile-jurisdiction-scanner', mode: 'candidate', configuration: {}, capabilities: { ranges: true, classification: true },
    async version() { return '1.0.0'; }, async scan(_directory, inputs) { return inputs.map(input => {
      const candidate = 'subject@example.invalid', start = Buffer.byteLength(input.content.slice(0, input.content.indexOf(candidate)));
      return { path: input.path, start, end: start + Buffer.byteLength(candidate), family: 'pii:kr:national-id', jurisdiction: 'KR', sensitive: true };
    }); } };
  const artifact = await piiDomain.execute({ cases: [source], methods: piiDomain.createMethods(), scanners: [scanner] });
  assert.ok(artifact.results[0].outcomes.every(outcome => outcome.typeIdentity.state === 'wrong-family'));
  assert.equal(artifact.results[0].assessment.scope, 'global');
  assert.equal(artifact.results[0].assessment.family, 'pii:global:email');
  assert.doesNotMatch(JSON.stringify(artifact.results[0].assessment), /jurisdiction:KR|pii:kr:/);
});

test('community language additions use the same evidence schema without a new accounting model', () => {
  const extension = structuredClone(piiContextEvidence);
  extension.languages.push('xx');
  extension.entries.push(
    { id: 'xx-positive', language: 'xx', kind: 'field-label', class: 'positive', strength: 'high-signal', identityDomains: ['email'], forms: ['alpha'], provenance: 'benchmark-authored-control' },
    { id: 'xx-neutral', language: 'xx', kind: 'field-label', class: 'neutral', strength: 'ambiguous', identityDomains: ['email'], forms: ['beta'], provenance: 'benchmark-authored-control' },
    { id: 'xx-negative', language: 'xx', kind: 'field-label', class: 'negative', strength: 'high-signal', identityDomains: ['email'], forms: ['gamma'], provenance: 'benchmark-authored-control' },
  );
  extension.groups.push({ id: 'xx-email-core', language: 'xx', identityDomain: 'email', frames: [
    { id: 'xx-sensitive', entry: 'xx-positive', template: 'alpha = {{candidate}}', contextClass: 'sensitive', sensitivity: 'sensitive', effect: 'positive-evidence', features: ['equals'] },
    { id: 'xx-neutral-frame', entry: 'xx-neutral', template: 'beta = {{candidate}}', contextClass: 'neutral', sensitivity: 'not-established', effect: 'neutral-evidence', features: ['equals'] },
    { id: 'xx-negative-frame', entry: 'xx-negative', template: 'gamma = {{candidate}}', contextClass: 'non-sensitive', sensitivity: 'non-sensitive', effect: 'negative-evidence', features: ['equals'] },
  ] });
  const validated = validatePiiContextEvidence(extension, { canonical: false });
  assert.equal(validated.groups.at(-1).language, 'xx');
});

test('ambiguous context and raw-looking templates fail closed', () => {
  const ambiguous = structuredClone(piiContextEvidence);
  const frame = ambiguous.groups[0].frames.find(candidate => candidate.entry === 'en-contact-label');
  frame.contextClass = 'sensitive'; frame.sensitivity = 'sensitive'; frame.effect = 'positive-evidence';
  assert.throws(() => validatePiiContextEvidence(ambiguous), /Ambiguous context/);
  const raw = structuredClone(piiContextEvidence); raw.groups[0].frames[0].template = 'email subject@example.invalid {{candidate}}';
  assert.throws(() => validatePiiContextEvidence(raw), /unsafe/);
});
