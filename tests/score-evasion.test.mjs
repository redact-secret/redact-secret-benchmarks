import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COUNT_FIELDS, INVARIANTS, OPERATORS, PROJECTION_CUT, buildAggregate, buildVariants, countOutcomes, evaluateVariant, exclusionGrammar,
  operatorSetHash, parseShadowOutput, recordViolations, resolveLocalOutput, sameLegacy, valueParts,
} from '../benchmarks/lib/score-evasion.ts';
import { ATTACK_CLASSES_289, evasionAggregateProblems, evaluatePromotion, loadPromotionContract, metricsFromEvasionAggregate } from '../benchmarks/lib/scorer-promotion.ts';
import { exclusionProblems } from '../scripts/check-feature-dataset-exclusion.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// Synthetic values only; none resembles an issued credential.
const RANDOMISH = 'q7Vd2LmZ9xKp4TsW8nRb3YhJ6cFg1AeU';
const base = (id, content, value, overrides = {}) => {
  const start = Buffer.byteLength(content.slice(0, content.indexOf(value)));
  return { id, category: 'synthetic', partition: 'development', expectation: 'must-redact', content, range: { start, end: start + Buffer.byteLength(value) }, specificity: 'contextual', authority: 'statistical', band: 'high', ...overrides };
};
const BASES = [
  base('synthetic--contextual', `api_key=${RANDOMISH}\n`, RANDOMISH),
  base('synthetic--bare', `note\nsk-${RANDOMISH}\n`, `sk-${RANDOMISH}`, { specificity: 'entropy', band: 'medium' }),
  base('synthetic--provider', `token=zzp_${RANDOMISH}\n`, `zzp_${RANDOMISH}`, { specificity: 'provider', authority: 'deterministic' }),
  base('synthetic--control', `build_ref=${RANDOMISH.toLowerCase()}\n`, RANDOMISH.toLowerCase(), { expectation: 'control', specificity: null, authority: null, band: null }),
];

const header = { record: 'shadow-evaluation', format: 'redact-secret/shadow-evaluation/1', productVersion: '0.0.0', model: 'evidence-aggregation/v1', featureSchema: 'evidence-features/v1', artifactRevision: 2, modelFingerprint: 'f'.repeat(64), profile: 'full', path: 'whole-input' };
const comparison = (input, start, end, overrides = {}) => ({
  record: 'shadow-comparison', input, finding: 'finding-1', start, end, byteLength: end - start, detector: 'generic-token', type: 'contextual_secret',
  specificity: 'contextual', legacyConfidence: 'high', legacyAction: 'redact', authority: 'statistical', model: 'evidence-aggregation/v1', featureSchema: 'evidence-features/v1',
  contextClass: 'credential-name', exclusion: null, groups: { randomness: 60, lexical: 0, contextual: 40, validation: 0, negative: 0 },
  signals: [], positive: 100, negative: 0, score: 100, band: 'high', promotion: 'preserve', reasons: ['credential-context', 'randomness-capped'], ...overrides,
});
const runOf = records => parseShadowOutput([header, ...records].map(r => JSON.stringify(r)).join('\n') + '\n');
const plainOf = records => ({ findings: records.map(r => ({ start: r.start, end: r.end, detector: r.detector, type: r.type, confidence: r.legacyConfidence, action: r.legacyAction })) });

test('every #257 attack class has a deterministic operator family', () => {
  assert.deepEqual(Object.keys(OPERATORS).sort(), [...ATTACK_CLASSES_289].sort());
  for (const cls of ATTACK_CLASSES_289) assert.ok(OPERATORS[cls].length >= 5, cls);
  const a = buildVariants(BASES), b = buildVariants(BASES);
  assert.deepEqual(a, b, 'two builds give byte-identical variants');
  assert.equal(new Set(a.map(v => v.id)).size, a.length, 'variant ids are unique');
  for (const cls of ATTACK_CLASSES_289) assert.ok(a.some(v => v.attackClass === cls), `${cls} yields variants`);
});

test('variants keep the secret material inside the expected span and never add material to a control', () => {
  for (const v of buildVariants(BASES)) {
    const text = Buffer.from(v.text);
    assert.ok(v.span.start >= v.envelope.start && v.span.end <= v.envelope.end && v.envelope.end <= text.length, v.id);
    const reshaped = text.subarray(v.envelope.start, v.envelope.end).toString();
    if (v.expectation === 'control') assert.ok(!reshaped.includes(RANDOMISH), `${v.id}: a control carries no positive material`);
    if (v.attackClass === 'context-perturbation' || v.attackClass === 'placeholder-wrapping') {
      const b = BASES.find(x => x.id === v.baseId);
      assert.equal(text.subarray(v.span.start, v.span.end).toString(), Buffer.from(b.content).subarray(b.range.start, b.range.end).toString(), `${v.id}: the original value is the span`);
    }
  }
  const replaced = buildVariants(BASES).filter(v => v.operator.startsWith('benign-sequence') || v.operator.startsWith('full-grammar'));
  assert.ok(replaced.length && replaced.every(v => v.expectation === 'control' && ['synthetic--contextual', 'synthetic--bare'].includes(v.baseId)), 'benign replacements sit only in a statistical positive base');
});

test('a value keeps its vendor prefix or PEM armour fixed while the body is reshaped', () => {
  assert.deepEqual(valueParts(`zzp_${RANDOMISH}`), { head: 'zzp_', body: RANDOMISH, tail: '' });
  assert.equal(valueParts(RANDOMISH).head, '');
  const pem = `-----BEGIN SYNTHETIC KEY-----\n${RANDOMISH}\n-----END SYNTHETIC KEY-----`;
  assert.deepEqual(valueParts(pem), { head: '-----BEGIN SYNTHETIC KEY-----\n', body: RANDOMISH, tail: '\n-----END SYNTHETIC KEY-----' });
});

test('the independent exclusion grammar accepts whole values only', () => {
  const whole = {
    '{{ secrets.API_KEY }}': 'template-reference', '${API_KEY}': 'environment-reference', '${API_KEY:-x}': 'environment-reference', '$API_KEY': 'environment-reference',
    '%API_KEY%': 'environment-reference', '$(vault read x)': 'command-substitution', '`date`': 'command-substitution', '<your-api-key>': 'angle-placeholder',
    '********': 'mask', 'xxxx': 'mask', 'your-api-key-here': 'placeholder-vocabulary', 'REDACTED-EXAMPLE-VALUE': 'placeholder-vocabulary',
  };
  for (const [value, grammar] of Object.entries(whole)) assert.equal(exclusionGrammar(value), grammar, value);
  for (const value of [`EXAMPLE${RANDOMISH}`, `${RANDOMISH.slice(0, 8)}\${HOME}${RANDOMISH.slice(8)}`, `****${RANDOMISH}`, `{{x}}${RANDOMISH}`, `your-api-key-${RANDOMISH}-here`, 'api-key', 'xx', RANDOMISH]) {
    assert.equal(exclusionGrammar(value), null, value);
  }
});

test('record checks catch a weakened protected finding, fuzzy negative evidence and a dropped finding', () => {
  const text = `token=zzp_${RANDOMISH}\n`;
  const provider = comparison('x', 6, text.length - 1, { specificity: 'provider', authority: 'deterministic', groups: null, score: null, band: 'high', reasons: ['deterministic-authority'] });
  assert.deepEqual(recordViolations(provider, text), []);
  assert.deepEqual(recordViolations({ ...provider, band: 'low', promotion: 'demote' }, text), ['protectedSpecificityNeverWeakened']);
  const mixed = `api_key=EXAMPLE${RANDOMISH}\n`;
  assert.deepEqual(recordViolations(comparison('x', 8, mixed.length - 1, { negative: 140, exclusion: 'placeholder-vocabulary', band: 'none', score: 0 }), mixed), ['negativeEvidenceFullGrammarOnly']);
  const full = 'api_key=REDACTED-EXAMPLE-VALUE\n';
  assert.deepEqual(recordViolations(comparison('x', 8, full.length - 1, { negative: 140, exclusion: 'placeholder-vocabulary', band: 'none', score: 0 }), full), []);
  assert.deepEqual(recordViolations(comparison('x', 8, 20, { legacyAction: 'allow' }), full), ['noStatisticalPositiveToNonFinding']);
});

test('variant outcomes project the shadow band at the documented cut and detect instability and enforcement drift', () => {
  const [v] = buildVariants([BASES[0]]).filter(x => x.expectation === 'must-redact');
  const high = comparison(v.id, v.span.start, v.span.end);
  const low = { ...high, band: 'low', score: 40, promotion: 'demote' };
  assert.equal(PROJECTION_CUT, 'medium');
  const kept = evaluateVariant(v, [runOf([high]), runOf([high])], plainOf([high]));
  assert.equal(kept.status, 'resolved'); assert.ok(kept.legacyFlagged && kept.candidateFlagged); assert.deepEqual(kept.invariantViolations, []);
  const dropped = evaluateVariant(v, [runOf([low]), runOf([low])], plainOf([low]));
  assert.ok(dropped.legacyFlagged && !dropped.candidateFlagged, 'a low band leaks under the medium projection');
  assert.ok(evaluateVariant(v, [runOf([low]), runOf([low])], plainOf([low]), 'low').candidateFlagged, 'and not under the band-none projection');
  assert.equal(evaluateVariant(v, [runOf([high]), runOf([low])], plainOf([high])).status, 'unstable');
  assert.equal(evaluateVariant(v, [runOf([high]), runOf([high])], { failure: 'INPUT_LIMIT_EXCEEDED' }).status, 'unresolved');
  assert.deepEqual(evaluateVariant(v, [runOf([high]), runOf([high])], plainOf([{ ...high, legacyAction: 'warn' }])).invariantViolations, ['shadowNonEnforcing']);
  assert.ok(sameLegacy([high], plainOf([high]).findings));
  assert.ok(!sameLegacy([high], []));
});

test('the aggregate is closed, arithmetically consistent and read by the Q4 gates', () => {
  const variants = buildVariants(BASES);
  const outcomes = variants.map(v => {
    const records = v.expectation === 'must-redact' ? [comparison(v.id, v.envelope.start, v.envelope.end, v.baseAuthority === 'deterministic' ? { specificity: 'provider', authority: 'deterministic', groups: null, score: null } : {})] : [];
    return evaluateVariant(v, [runOf(records), runOf(records)], plainOf(records));
  });
  const identity = { sourceRevision: 'a'.repeat(40), candidateArtifactHash: 'b'.repeat(64), scoringArtifactRevision: 2, modelFingerprint: 'c'.repeat(64), scoringArtifactSha256: 'd'.repeat(64), tuningManifestHash: null, scoringIdentity: 'e'.repeat(64) };
  const aggregate = buildAggregate(outcomes, identity, 'f'.repeat(40), operatorSetHash(BASES, '0'.repeat(64)));
  assert.deepEqual(evasionAggregateProblems(aggregate), []);
  assert.deepEqual(Object.keys(aggregate.totals), [...COUNT_FIELDS]);
  assert.deepEqual(Object.keys(aggregate.invariants), [...INVARIANTS]);
  assert.equal(aggregate.mode, 'shadow'); assert.equal(aggregate.holdoutAccess, 'none');
  assert.deepEqual(countOutcomes(outcomes), aggregate.totals);
  const contract = loadPromotionContract(root);
  const q4 = evaluatePromotion(contract, { metrics: metricsFromEvasionAggregate(aggregate, contract) }).questions.find(q => q.id === 'Q4');
  assert.equal(q4.gates.find(g => g.id === 'q4-evaluated-against-candidate').verdict, 'fail', 'a shadow aggregate never answers Q4 for a promotion');
  assert.equal(q4.gates.find(g => g.id === 'q4-invariants').verdict, 'pass');
  const serialized = JSON.stringify(aggregate);
  for (const b of BASES) assert.ok(!serialized.includes(b.id) && !serialized.includes(RANDOMISH), 'no base, value or variant reaches the aggregate');
  for (const v of variants) assert.ok(!serialized.includes(v.operator), 'no operator id reaches the aggregate');
});

test('local detail is written under results-output only', () => {
  assert.ok(resolveLocalOutput(root, 'results-output/score-evasion', path.resolve, path.sep).endsWith(path.join('results-output', 'score-evasion')));
  for (const bad of ['public/score-evasion', 'evidence/771', 'results-output/../public']) assert.throws(() => resolveLocalOutput(root, bad, path.resolve, path.sep));
});

test('every committed score-evasion aggregate is the closed shadow-mode shape bound to an exact product and benchmark commit', () => {
  const files = execFileSync('git', ['ls-files', '*score-evasion-aggregate.json'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const file of files) {
    const aggregate = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    assert.deepEqual(evasionAggregateProblems(aggregate), [], file);
    assert.equal(aggregate.holdoutAccess, 'none', file);
    assert.ok(!file.startsWith('public/'), 'the aggregate is evidence, not a site asset');
  }
});

test('the publication check rejects score-evasion detail on a public surface and in tracked files', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'score-evasion-public-'));
  try {
    mkdirSync(path.join(dir, 'public'), { recursive: true });
    writeFileSync(path.join(dir, 'public', 'data.json'), JSON.stringify([{ record: 'shadow-comparison', input: 'x' }]));
    writeFileSync(path.join(dir, 'public', 'score-evasion-detail.json'), '{}');
    const problems = exclusionProblems(dir, { checkIgnore: false, checkTracked: false });
    assert.ok(problems.some(p => p.startsWith(path.join('public', 'data.json'))), problems.join('\n'));
    assert.ok(problems.some(p => p.startsWith(path.join('public', 'score-evasion-detail.json'))), problems.join('\n'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(path.join(dir, 'tracked.json'), JSON.stringify({ movedVariants: [] }));
    execFileSync('git', ['add', 'tracked.json'], { cwd: dir });
    assert.ok(exclusionProblems(dir, { checkIgnore: false }).some(p => p.startsWith('tracked.json')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.deepEqual(exclusionProblems(root), []);
});
