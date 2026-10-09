import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cases, corpusDigest } from '../benchmarks/corpora/provider-shapes/corpus.mjs';
import { measurementOutput, stagedMeasurementDirectory } from '../scripts/lib/measurement-output.mjs';

const root = resolve(import.meta.dirname, '..');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const scratch = () => { mkdirSync(resolve(root, 'results-output'), { recursive: true }); return mkdtempSync(resolve(root, 'results-output/focused-command-test-')); };
const finding = expected => ({ start: expected.start, end: expected.end, action: expected.action, type: expected.type, detector: 'synthetic' });
function observation(kases, digest, commit) {
  return { schema: 'batch1-observations-v1', sourceCommit: commit, corpus: { sha256: digest, cases: kases.length }, platform: 'test-only', node: process.version,
    surfaces: { node: { version: 'synthetic-test', rangeUnit: 'utf8-bytes', cases: Object.fromEntries(kases.map(k => { const findings = k.kind === 'positive' ? [k.expected, ...(k.expectedExtra ?? [])].map(expected => finding({ ...expected, type: k.expectedType ?? expected.type, action: k.expectedAction ?? expected.action })) : []; return [k.id, { whole: {findings}, stream: {findings} }]; })) } } };
}
function run(dir, published, candidate, extra = []) {
  const a = resolve(dir, 'published.json'), b = resolve(dir, 'candidate.json');
  writeFileSync(a, JSON.stringify(published)); writeFileSync(b, JSON.stringify(candidate));
  return execFileSync(process.execPath, ['scripts/report-focused-corpus.mjs', '--published', a, '--candidate', b, '--run-id', 'synthetic-contract-test', '--out-dir', resolve(dir, 'report'), ...extra], { cwd: root, stdio: 'pipe' });
}
test('focused report binds recorded products, corpus, scorer and byte-identical input observations without touching accepted evidence', () => {
  const dir = scratch(), ledger = resolve(root, 'benchmarks/accepted-pii-profile-cost.json'), before = sha(ledger);
  try {
    const a = observation(cases, corpusDigest(), 'a'.repeat(40)), b = observation(cases, corpusDigest(), 'b'.repeat(40));
    b.surfaces.node.cases[cases.find(k => k.kind === 'positive').id].stream.findings = [];
    run(dir, a, b);
    const r = JSON.parse(readFileSync(resolve(dir, 'report/report.json')));
    assert.equal(r.runId, 'synthetic-contract-test'); assert.equal(r.engines.candidate.sourceCommit, b.sourceCommit);
    assert.equal(r.identities.scorerModuleSha256, sha(resolve(root, r.identities.scorerModule)));
    assert.equal(r.identities.observations.published, sha(resolve(dir, 'report/observations-published.json')));
    assert.ok(Object.values(r.perCase).some(k => !k.candidate.node.streamAgrees));
    assert.equal(sha(ledger), before);
    assert.throws(() => run(dir, a, b), /already exists/);
    assert.equal(sha(ledger), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('parameterised multi-span scorer detects a leaked second occurrence and records a regression', async () => {
  const { cases: carrierCases, corpusDigest: carrierDigest } = await import('../benchmarks/corpora/credential-carriers/corpus-r2.mjs');
  const dir = scratch();
  try {
    const a = observation(carrierCases, carrierDigest(), 'a'.repeat(40)), b = observation(carrierCases, carrierDigest(), 'b'.repeat(40));
    const multi = carrierCases.find(k => k.kind === 'positive' && k.expectedExtra?.length);
    assert.ok(multi); b.surfaces.node.cases[multi.id].whole.findings = [finding({...multi.expected, type: multi.expectedType, action: multi.expectedAction})];
    run(dir, a, b, ['--corpus', 'benchmarks/corpora/credential-carriers/corpus-r2.mjs', '--scorer', 'benchmarks/harness/credential-carriers/score-multispan.mjs']);
    const r = JSON.parse(readFileSync(resolve(dir, 'report/report.json')));
    assert.equal(r.perCase[multi.id].candidate.node.whole.pass, false);
    assert.ok(r.publishedToCandidate.worse.some(k => k.id === multi.id));
    assert.equal(r.families[multi.family].candidate.node.missed, 1);
    assert.equal(r.families[multi.family].candidate.node.genericType, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('ordinary measurement refuses accepted paths and symlink escapes; failed report staging leaves no partial output', () => {
  const dir = scratch();
  try {
    assert.throws(() => measurementOutput(resolve(root, 'evidence/739/ledger.json'), root), /ignored results-output/);
    symlinkSync(resolve(root, 'evidence'), resolve(dir, 'escape'));
    assert.throws(() => measurementOutput(resolve(dir, 'escape/739/new.json'), root), /ignored results-output/);
    const target = resolve(dir, 'report');
    assert.throws(() => stagedMeasurementDirectory(target, stage => { writeFileSync(resolve(stage, 'partial'), 'partial'); throw new Error('validation failed'); }), /validation failed/);
    assert.equal(existsSync(target), false); assert.equal(existsSync(`${target}.lock`), false);
    stagedMeasurementDirectory(target, stage => writeFileSync(resolve(stage, 'validated.json'), '{}'));
    assert.equal(readFileSync(resolve(target, 'validated.json'), 'utf8'), '{}');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('missing product identity fails before report publication', () => {
  const dir = scratch();
  try { const a = observation(cases, corpusDigest(), 'a'.repeat(40)); const b = observation(cases, corpusDigest(), null); assert.throws(() => run(dir, a, b), /exact product source commit/); assert.equal(existsSync(resolve(dir, 'report')), false); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bounded PII command rejects ambiguous products, implicit historical rescoring and current-receipt promotion before measuring', () => {
  const dir = scratch();
  const accepted = resolve(root, 'benchmarks/accepted-pii-profile-cost.json');
  const current = resolve(root, 'benchmarks/inputs/pii/protected-route.json');
  const before = { accepted: sha(accepted), current: sha(current) };
  const common = ['--import', 'tsx', 'scripts/pii-beta11.mjs', `--core-repo=${root}`, '--role=final'];
  const execute = extra => execFileSync(process.execPath, [...common, ...extra], { cwd: root, stdio: 'pipe', timeout: 30000 });
  try {
    assert.throws(() => execute([`--core-commit=${'a'.repeat(39)}`, '--rescore=true', `--out-dir=${resolve(dir, 'ambiguous')}`]), /40-hex/);
    assert.throws(() => execute([`--core-commit=${'a'.repeat(40)}`, '--rescore=true', `--out-dir=${resolve(dir, 'implicit-history')}`]), /Rescoring requires --replay-dir/);
    assert.throws(() => execute([`--core-commit=${'a'.repeat(40)}`, `--promote-freeze=${current}`, `--out-dir=${resolve(dir, 'promote')}`]), /Prepared freeze must come from ignored results-output/);
    for (const name of ['ambiguous', 'implicit-history', 'promote']) assert.equal(existsSync(resolve(dir, name)), false);
    assert.equal(sha(accepted), before.accepted); assert.equal(sha(current), before.current);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
