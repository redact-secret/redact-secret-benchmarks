import test from 'node:test';
import assert from 'node:assert/strict';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { generateCase, hash, secrets, bytes } from '../benchmarks/engine/model.ts';
import { runEvaluation, exitCode } from '../benchmarks/engine/runner.ts';
import { findingFamily, arrivalFindingTypes } from '../scanners/families.mjs';
import { arrivalFamilies } from '../benchmarks/lib/beta8/index.ts';

const methods = createMethods(), operators = createOperators();
const cases = await loadCases(operators);
const sample = (method, match = 'github-token-ghp-plain') => structuredClone(cases.find(c => c.method === method && c.id.includes(match)));
const findingsFor = v => secrets(v.fixture).map(({ start, end }) => ({ path: v.fixture.path, start, end }));
const scanner = (id, findings = [], extra = {}) => ({ id, mode: 'test', version: async () => '1.2.3', scan: async () => findings, ...extra });

test('unsupported transformations are reported; generation errors cannot become relation failures', async () => {
  const c = sample('metamorphic');
  const registry = createOperators();
  registry.register({ id: 'test.broken', version: 1, supports: () => true, generate() { throw new Error('PRIVATE-RAW-ERROR'); } });
  c.operators = [{ id: 'context.json' }, { id: 'context.unicode-prefix' }, { id: 'test.broken' }];
  const report = await runEvaluation({ cases: [c], methods, operators: registry, scanners: [scanner('redact-secret')] });
  assert.deepEqual(report.results[0].generation.map(g => g.status), ['unsupported', 'generated', 'error']);
  assert.equal(report.generationErrors.length, 1);
  assert.equal(report.byOperator['context.json'].unsupported, 1);
  assert.equal(report.byOperator['test.broken'].error, 1);
  assert.equal(report.results[0].variants.length, 2);
  assert.equal(report.failures.some(f => f.assertion.candidate === 'test.broken'), false);
  assert.equal(exitCode(report), 1);
  assert.equal(JSON.stringify(report).includes('PRIVATE-RAW-ERROR'), false);
});

test('malformed generated ranges are generation errors and never sent to adapters', async () => {
  const c = sample('metamorphic'), registry = createOperators();
  registry.register({ id: 'test.bad-range', version: 1, supports: () => true,
    generate(c) { return { fixture: { ...c.seed, expected: [{ role: 'secret', start: 0, end: 999999 }] }, strategy: 'derived' }; } });
  c.operators = [{ id: 'test.bad-range' }];
  const report = await runEvaluation({ cases: [c], methods, operators: registry, scanners: [scanner('redact-secret', [], {
    async scan(root, fixtures) { assert.equal(fixtures.length, 1); return []; },
  })] });
  assert.equal(report.generationErrors.length, 1);
  assert.equal(report.variantCount, 1);
});

test('single quote and YAML preserve multibyte source ranges and reject unsafe escaping', () => {
  const c = sample('metamorphic', 'context-edges--bare');
  for (const id of ['context.single-quote', 'context.yaml']) {
    const op = operators.get(id);
    assert.equal(op.supports(c), true);
    const output = op.generate(c);
    assert.equal(output.relation, 'same-detection');
    assert.equal(bytes(output.fixture, output.fixture.expected[0]), bytes(c.seed, c.seed.expected[0]));
    assert.equal(op.supports({ ...c, seed: { ...c.seed, content: "a'b" } }), false);
    assert.equal(op.supports(c, { ignored: true }), false);
  }
  assert.equal(operators.get('context.quote').supports({ ...c, seed: { ...c.seed, content: 'a\\b' } }), false);
});

test('metamorphic outputs retain relation, actual parameters, method version and source provenance', () => {
  const c = sample('metamorphic');
  const { variants, attempts } = generateCase(c, methods, operators);
  assert.ok(attempts.some(a => a.status === 'unsupported'));
  for (const v of variants.slice(1)) {
    assert.equal(v.transformation.relation, 'same-detection');
    assert.equal(v.transformation.expectationEffect, 'preserve');
    assert.equal(v.provenance.sourceHash, hash(c.seed));
    assert.equal(v.provenance.seed, c.provenance.seed);
    assert.deepEqual(v.transformation.parameters, {});
  }
  const differential = generateCase(sample('differential'), methods, operators);
  assert.equal(differential.variants[0].transformation.methodVersion, methods.get('differential').version);
});

test('mutation library covers five properties without using scanner agreement as validity', () => {
  const c = sample('mutation', 'sendgrid-token-segmented-plain');
  const { variants } = generateCase(c, methods, operators);
  const properties = new Set(variants.slice(1).map(v => v.transformation.property));
  for (const property of ['prefix', 'alphabet', 'length', 'boundary', 'structural']) assert.ok(properties.has(property));
  const github = generateCase(sample('mutation'), methods, operators).variants;
  assert.equal(github.find(v => v.id === 'lexical.replace-last').transformation.expectationEffect, 'preserve');
  assert.equal(github.find(v => v.id === 'authored.twin').transformation.expectationEffect, 'invalidate');
  assert.equal(github.find(v => v.id === 'lexical.prefix-change').transformation.expectationEffect, 'defer');
  const invalid = variants.find(v => v.id === 'structural.remove-segment');
  assert.equal(invalid.strategy, 'review-required');
  assert.equal(invalid.fixture.assessment.tier, 'T0');
  assert.equal(operators.get('structural.remove-segment').supports(sample('mutation', 'private-key-ed25519')), false);
});

test('seeded operators reproduce bytes and expose resolved choices for replay', () => {
  const c = sample('mutation', 'sendgrid-token-segmented-plain');
  const before = hash(c);
  for (const id of ['lexical.prefix-change', 'boundary.remove-delimiter', 'structural.remove-segment']) {
    const op = operators.get(id), a = op.generate(c), b = op.generate(c);
    assert.equal(hash(a), hash(b));
    assert.equal(op.supports(c, a.parameters), true);
    assert.equal(hash(op.generate(c, a.parameters)), hash(a));
    assert.equal(op.supports(c, { unexpected: 42 }), false);
  }
  const outputs = new Set(Array.from({ length: 12 }, (_, i) => operators.get('lexical.prefix-change').generate({
    ...c, provenance: { ...c.provenance, seed: `experiment-${i}` },
  }).fixture.content));
  assert.ok(outputs.size > 1, 'seed influences generated bytes');
  assert.equal(hash(c), before);
});

test('operator summaries and failure pointers retain mutation attribution', async () => {
  const c = sample('mutation');
  const report = await runEvaluation({ cases: [c], methods, operators, scanners: [scanner('redact-secret')] });
  assert.equal(report.byOperator['lexical.prefix-change'].generated, 1);
  assert.equal(report.byOperator['structural.remove-segment'].unsupported, 1);
  assert.ok(Object.keys(report.byOperator['lexical.replace-last'].assertions).length > 0);
  assert.ok(report.failures.some(f => f.transformation.operator === 'lexical.replace-last'));
  const variants = report.results[0].variants;
  assert.equal(typeof variants.find(v => v.id === 'lexical.prefix-change').transformation.parameters.choice, 'number');
  assert.equal(JSON.stringify(report).includes(bytes(c.seed, secrets(c.seed)[0])), false);
});

test('differential compares mapped families and never infers unknown families from case targets', () => {
  const c = sample('differential'), { variants } = generateCase(c, methods, operators), v = variants[0];
  const finding = findingsFor(v)[0];
  const compare = (a, b) => methods.get('differential').evaluate({ case: c, variants, observations: [
    { id: 'redact-secret', status: 'complete', findings: a },
    { id: 'gitleaks', status: 'complete', findings: b },
  ] });
  const result = compare([{ ...finding, family: 'github-token' }], [{ ...finding, family: 'generic-token' }]);
  assert.equal(result.queue[0].disagreement, 'classification-disagreement');
  assert.equal(result.comparisons[0].classification, 'compared');
  assert.deepEqual(result.scanners, []);
  const unknown = compare([{ ...finding, family: 'github-token' }], [finding]);
  assert.equal(unknown.queue.length, 0);
  assert.equal(unknown.comparisons[0].classification, 'unsupported');
  assert.deepEqual(unknown.observations[1].variants[0].classifications[0].families, []);
});

test('differential ignores ordering and duplicate findings, including multiple family labels', () => {
  const c = sample('differential', 'context-edges--two-secrets');
  const { variants } = generateCase(c, methods, operators), a = findingsFor(variants[0]);
  assert.equal(a.length, 2);
  const findings = a.flatMap(f => [{ ...f, family: 'github-token' }, { ...f, family: 'generic-token' }]);
  const result = methods.get('differential').evaluate({ case: c, variants, observations: [
    { id: 'redact-secret', status: 'complete', findings },
    { id: 'gitleaks', status: 'complete', findings: [...findings].reverse().concat(findings) },
  ] });
  assert.equal(result.queue.length, 0);
  assert.equal(result.comparisons[0].disagreement, 'none');
});

test('unsupported, unavailable and execution errors remain distinct from actual disagreements', async () => {
  const c = sample('differential');
  const report = await runEvaluation({ cases: [c], methods, operators, scanners: [
    scanner('redact-secret'),
    scanner('unsupported', [], { capabilities: { ranges: false, classification: false }, async version() { assert.fail('unsupported adapter executed'); } }),
    scanner('unavailable', [], { async version() { throw new Error('unavailable'); } }),
    scanner('broken', [], { async scan() { throw new Error('process failed'); } }),
  ] });
  assert.deepEqual(report.scanners.map(s => s.status), ['complete', 'unsupported', 'unavailable', 'error']);
  assert.deepEqual(report.results[0].comparisons.map(c => c.status), ['unsupported', 'incomplete', 'incomplete']);
  assert.equal(report.reviewQueue.length, 0);
  assert.equal(report.results[0].complete, false);
});

test('disagreement IDs are stable and evidence identifies exact input and scanner configuration', async () => {
  const c = sample('differential'), { variants } = generateCase(c, methods, operators);
  const before = hash(c);
  const run = (version = '1.2.3', configuration = { verification: false }) => runEvaluation({ cases: [c], methods, operators,
    scanners: [scanner('redact-secret', findingsFor(variants[0])), scanner('gitleaks', [], { version: async () => version, configuration })] });
  const a = await run(), b = await run(), updated = await run('1.2.4'), reconfigured = await run('1.2.3', { verification: false, ruleSetVersion: 2 });
  assert.equal(a.reviewQueue[0].id, b.reviewQueue[0].id);
  assert.notEqual(a.reviewQueue[0].id, updated.reviewQueue[0].id);
  assert.notEqual(a.reviewQueue[0].id, reconfigured.reviewQueue[0].id);
  const evidence = a.reviewQueue[0].evidence;
  assert.equal(evidence.input.contentHash, hash(variants[0].fixture.content));
  assert.equal(evidence.tools[1].version, '1.2.3');
  assert.deepEqual(evidence.tools[1].configuration, { verification: false });
  assert.equal(evidence.tools[1].configurationHash, hash({ verification: false }));
  assert.equal(hash(c), before, 'agreement/disagreement never changes authored truth');
});

test('native family labels have explicit mappings; unknown labels remain unsupported', () => {
  assert.deepEqual(findingFamily('redact-secret', 'github-token'), { family: 'github-token' });
  assert.deepEqual(findingFamily('gitleaks', 'github-pat'), { family: 'github-token' });
  assert.deepEqual(findingFamily('trufflehog', 'Github'), { family: 'github-token' });
  assert.deepEqual(findingFamily('gitleaks', 'future-provider-rule'), {});
  assert.deepEqual(findingFamily('trufflehog', 'toString'), {});
  assert.deepEqual(findingFamily('unknown-scanner', 'Github'), {});
});

test('#251: a product finding type maps to the arrival family it types; a coarser type keeps the detector id', () => {
  assert.deepEqual(findingFamily('redact-secret', 'stripe-token', 'stripe_webhook_signing_secret'), { family: 'stripe-webhook-signing-secret' });
  assert.deepEqual(findingFamily('redact-secret', 'slack-token', 'slack_user_token'), { family: 'slack-user-token' });
  assert.deepEqual(findingFamily('redact-secret', 'slack-token', 'slack_app_level_token'), { family: 'slack-app-level-token' });
  assert.deepEqual(findingFamily('redact-secret', 'github-token', 'github_fine_grained_personal_access_token'), { family: 'github-fine-grained-pat' });
  // Published 0.1.0-beta.7 types whsec_ as stripe_credential and xoxp-/xapp- as slack_token.
  assert.deepEqual(findingFamily('redact-secret', 'stripe-token', 'stripe_credential'), { family: 'stripe-token' });
  assert.deepEqual(findingFamily('redact-secret', 'slack-token', 'slack_token'), { family: 'slack-token' });
  assert.deepEqual(findingFamily('redact-secret', 'slack-token'), { family: 'slack-token' });
  // A type is read only under the detector that documents it, and only for redact-secret.
  assert.deepEqual(findingFamily('redact-secret', 'generic-token', 'stripe_webhook_signing_secret'), { family: 'generic-token' });
  assert.deepEqual(findingFamily('redact-secret', 'slack-token', 'toString'), { family: 'slack-token' });
  assert.deepEqual(findingFamily('gitleaks', 'stripe-access-token', 'stripe_webhook_signing_secret'), { family: 'stripe-token' });
});

test('#251: every finding-type target is an arrival family whose recorded reason names the shared detector and the type', () => {
  const byId = new Map(arrivalFamilies.map(f => [f.id, f]));
  for (const [detector, types] of Object.entries(arrivalFindingTypes))
    for (const [type, family] of Object.entries(types)) {
      const arrival = byId.get(family);
      assert.ok(arrival, `${detector}/${type} targets ${family}, which is not a declared arrival family`);
      assert.ok(arrival.reason.includes(detector), `${family}'s reason does not name the shared ${detector} detector`);
      assert.ok(arrival.reason.includes(type), `${family}'s reason does not name the ${type} finding type`);
    }
});

test('flare-redact family labels map only explicitly recognized ids and fail closed on the rest', () => {
  assert.deepEqual(findingFamily('flare-redact', 'github_token'), { family: 'github-token' });
  assert.deepEqual(findingFamily('flare-redact', 'aws_access_key'), { family: 'aws-access-key' });
  assert.deepEqual(findingFamily('flare-redact', 'aws_secret_key'), { family: 'aws-access-key' });
  assert.deepEqual(findingFamily('flare-redact', 'url_credentials'), { family: 'connection-string' });
  // No dedicated family exists yet for these real flare-redact detector ids;
  // an unmapped result is not agreement and not a failure (scanners/README.md).
  assert.deepEqual(findingFamily('flare-redact', 'basic_auth'), {});
  assert.deepEqual(findingFamily('flare-redact', 'figma_token'), {});
  assert.deepEqual(findingFamily('flare-redact', 'toString'), {});
  // Post-beta.6 families (redact-secret#308, #310, #311, #314): these flare-redact
  // ids match the same credential the new families score, so they map now.
  assert.deepEqual(findingFamily('flare-redact', 'netlify_token'), { family: 'netlify-token' });
  assert.deepEqual(findingFamily('flare-redact', 'mailgun_key'), { family: 'mailgun-api-key' });
  assert.deepEqual(findingFamily('flare-redact', 'databricks_token'), { family: 'databricks-personal-access-token' });
  assert.deepEqual(findingFamily('flare-redact', 'postman_key'), { family: 'postman-api-key' });
});

test('runner drops unmapped family text and respects an adapter classification capability', async () => {
  const c = sample('differential'), { variants } = generateCase(c, methods, operators);
  const found = findingsFor(variants[0]);
  const report = await runEvaluation({ cases: [c], methods, operators, scanners: [
    scanner('redact-secret', found.map(f => ({ ...f, family: 'github-token' }))),
    scanner('unknown-label', found.map(f => ({ ...f, family: 'RAW-SECRET-MUST-NOT-LEAK', raw: c.seed.content }))),
    scanner('range-only', found.map(f => ({ ...f, family: 'generic-token' })), { capabilities: { ranges: true, classification: false } }),
  ] });
  assert.equal(JSON.stringify(report).includes('RAW-SECRET-MUST-NOT-LEAK'), false);
  assert.equal(JSON.stringify(report).includes(bytes(c.seed, secrets(c.seed)[0])), false);
  assert.deepEqual(report.results[0].comparisons.map(c => c.classification), ['unsupported', 'unsupported']);
  assert.equal(report.reviewQueue.length, 0);
});
