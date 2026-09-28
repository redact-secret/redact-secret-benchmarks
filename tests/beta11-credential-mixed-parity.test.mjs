import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { CREDENTIAL_MIXED_PARITY_PLAN_FILE, NEW_FAMILIES, ledgerFamilies, loadCorpora } from '../benchmarks/evaluation/domains/credential/mixed-parity/authoring.ts';
import { VARIANTS, bytePartitions, leakedTargets, materialize, offsetTables, partitions, referenceOutput, render, scoreFindings, variantOf } from '../benchmarks/evaluation/domains/credential/mixed-parity/parity.ts';
import { buildCredentialParityReport } from '../benchmarks/evaluation/domains/credential/mixed-parity/report.ts';
import { renderCredentialMixedParityPlan } from '../scripts/generate-credential-mixed-parity.mjs';

// #381: credential mixed-document, streaming and binding parity. The plan is frozen before any scan; these tests pin
// its derivation, its spans and the scoring rules, never a product outcome.

const planText = readFileSync(CREDENTIAL_MIXED_PARITY_PLAN_FILE, 'utf8');
const plan = JSON.parse(planText);
const corpora = loadCorpora();
const documents = materialize(plan, corpora);
const value = (document, t) => Buffer.from(document.input, 'utf8').subarray(t.start, t.end).toString('utf8');

test('the committed plan is exactly what the authored rule generates', () => {
  assert.equal(renderCredentialMixedParityPlan(), planText);
});

test('the plan covers every #377 ledger family and every #860 family with two positives, and counts documents and targets as the units', () => {
  const families = [...ledgerFamilies(), ...NEW_FAMILIES.map(([family]) => family)];
  assert.deepEqual(plan.families, families);
  assert.equal(families.length, 39);
  for (const family of families) {
    const targets = documents.flatMap(d => d.targets).filter(t => t.family === family);
    assert.ok(targets.length >= 2, `${family}: two positives`);
    assert.ok(plan.documents.some(d => d.lines.some(l => l.family === family && l.role === 'control')), `${family}: a benign control`);
  }
  assert.equal(documents.length, 10);
  assert.equal(documents.flatMap(d => d.targets).length, 83);
});

test('no credential value is written into the plan; fixture lines are bound by digest only', () => {
  for (const document of documents)
    for (const t of document.targets) assert.equal(planText.includes(value(document, t)), false, `${t.id} leaks into the plan`);
  for (const d of plan.documents) for (const l of d.lines) if (l.fixture) { assert.match(l.contentSha256, /^[0-9a-f]{64}$/); assert.equal('text' in l, false); }
});

test('every target is its fixture\'s authored secret span after wrapping, in both line-ending variants and all three range units', () => {
  const byKey = new Map([...corpora].flatMap(([category, fixtures]) => fixtures.map(f => [`${category}--${f.id}`, f])));
  for (const document of documents) {
    for (const t of document.targets) {
      const fixture = byKey.get(document.lines[t.line].fixture);
      const authored = fixture.expected.filter(r => (r.role ?? 'secret') === 'secret').map(r => Buffer.from(fixture.content, 'utf8').subarray(r.start, r.end).toString('utf8'));
      assert.ok(authored.includes(value(document, t)), t.id);
      assert.ok(new RegExp(contracts[t.family].pattern ?? '.').test(value(document, t)) || !contracts[t.family].pattern || t.kind === 'policy' || t.envelope,
        `${t.id}: a positive satisfies its contract`);
    }
    for (const variant of VARIANTS) {
      const shaped = variantOf(document, variant), tables = offsetTables(shaped.input);
      for (const t of shaped.targets) {
        assert.equal(value(shaped, t), value(document, document.targets.find(x => x.id === t.id)), `${t.id}/${variant}`);
        for (const unit of ['utf16-code-units', 'unicode-code-points']) assert.equal(tables.toUtf8(tables.toUnit(t.start, unit), unit), t.start);
      }
    }
  }
});

test('the plan exercises CRLF, Unicode neighbours, JSON escaping, an over-long token and an input over the incremental buffer', () => {
  const wraps = new Set(plan.documents.flatMap(d => d.lines.filter(l => l.fixture).map(l => l.wrap)));
  for (const wrap of ['plain', 'line-unicode', 'json-escaped', 'adjacent-unicode', 'long-line']) assert.ok(wraps.has(wrap), wrap);
  const oversized = documents.find(d => d.id === 'bounded-oversized-log');
  assert.ok(Buffer.byteLength(oversized.input) > 1 << 16 && Buffer.byteLength(oversized.input) < 1 << 20);
  const long = documents.find(d => d.id === 'long-minified-line');
  assert.ok(long.input.split('\n').some(line => line.length > 8192));
});

test('partitions never split a code point, sweep every prefix position, and byte partitions split every multi-byte character', () => {
  for (const document of documents.filter(d => d.id.startsWith('mixed-0'))) {
    for (const variant of VARIANTS) {
      const shaped = variantOf(document, variant), n = offsetTables(shaped.input).codePoints;
      const rows = partitions(shaped, variant);
      for (const row of rows) assert.ok(row.cuts.every(cut => cut > 0 && cut < n), row.id);
      for (const t of shaped.targets) assert.ok(rows.some(row => row.id === `${t.id}@start+3`), `${t.id} prefix sweep`);
      if (variant === 'crlf') assert.ok(rows.some(row => row.kind === 'crlf-split'));
      const bytes = bytePartitions(shaped, variant);
      if (/[^\x00-\x7f]/.test(shaped.input)) {
        const split = bytes.find(row => row.kind === 'utf8-split');
        const buffer = Buffer.from(shaped.input, 'utf8');
        assert.ok(split.cuts.every(cut => (buffer[cut] & 0xc0) === 0x80), 'every cut lands inside a character');
      }
    }
  }
});

test('scoring separates exact, envelope, warn-only, partial and missing targets, and attributes collateral to its line', () => {
  const document = documents.find(d => d.id === 'mixed-01-log');
  const [a, b, c, d] = document.targets;
  const control = document.lines.find(l => l.role === 'control');
  const findings = [
    { type: 't', detector: 'x', action: 'redact', confidence: 'high', start: a.start, end: a.end },
    { type: 't', detector: 'x', action: 'warn', confidence: 'medium', start: b.start, end: b.end },
    { type: 't', detector: 'x', action: 'redact', confidence: 'high', start: c.start + 1, end: c.end },
    { type: 't', detector: 'generic-token', action: 'redact', confidence: 'high', start: control.start, end: control.start + 4 },
  ];
  const scored = scoreFindings(document, findings);
  assert.equal(scored.outcome[a.id], 'exact');
  assert.equal(scored.outcome[b.id], 'warn-only');
  assert.equal(scored.outcome[c.id], 'partial');
  assert.equal(scored.outcome[d.id], 'miss');
  assert.deepEqual(scored.unexpected.map(u => [u.role, u.replacing]), [['control', true]]);
  const output = render(document.input, findings);
  // A partial redaction leaves a fragment, not the whole value: it is scored `partial`, not counted as a whole-value leak.
  assert.deepEqual(leakedTargets(document, output).sort(), document.targets.filter(t => t !== a && t !== c).map(t => t.id).sort());
  assert.deepEqual(leakedTargets(document, referenceOutput(document)), []);
});

test('the report counts checks, not samples, and flags a surface that diverges from the reference', () => {
  const document = documents.find(d => d.id === 'mixed-08-yaml');
  const shaped = VARIANTS.map(v => [`${document.id}/${v}`, variantOf(document, v)]);
  const exact = s => s.targets.map(t => ({ type: 't', detector: t.family, action: 'redact', confidence: 'high', start: t.start, end: t.end }));
  const op = s => { const out = referenceOutput(s); return { status: 'ok', findings: exact(s), outputSha256: sha(out), valueLeft: [] }; };
  const sha = text => createHashHex(text);
  const caseFor = s => ({ scan: op(s), redact: op(s), scanAndRedact: op(s), partitions: { single: 'k' }, streams: null, signatures: { k: op(s) }, wholeLimits: null, incrementalFailures: null });
  const surface = (name, mutate) => ({ surface: name, status: 'observed', unit: 'utf8-bytes', cases: Object.fromEntries(shaped.map(([key, s]) => [key, mutate(caseFor(s), s)])) });
  const report = buildCredentialParityReport({ target: {}, plan: {}, benchmark: {}, surfaces: [
    surface('node-addon', c => c),
    surface('python', (c, s) => ({ ...c, scanAndRedact: { ...c.scanAndRedact, outputSha256: sha(s.input) } })),
  ] }, [document]);
  assert.equal(report.units.documents, 1);
  assert.equal(report.acceptance.exactSpansAgreeAcrossSurfaces, false);
  assert.ok(report.discrepancies.some(d => d.kind === 'cross-surface' && d.surface === 'python'));
  assert.equal(report.surfaceSummary.find(s => s.surface === 'node-addon').crossSurfaceDivergences, 0);
});

import { createHash } from 'node:crypto';
function createHashHex(text) { return createHash('sha256').update(text).digest('hex'); }
