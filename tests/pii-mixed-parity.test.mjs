import { historicalArchive, historicalReplayOptions, historicalBytes } from './helpers/historical-evidence-archive.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MIXED_PARITY_PLAN_FILE, MIXED_PARITY_PLAN_V2_FILE, V2_PROMOTIONS } from '../benchmarks/evaluation/domains/pii/mixed-parity/authoring.ts';
import {
  SELECTIONS, VARIANTS, expectedOutput, loadPlan, planCommitment, materialize, offsetTables, partitions, scoreOperation, sha256, targetsFor, variantOf,
} from '../benchmarks/evaluation/domains/pii/mixed-parity/parity.ts';
import { renderMixedParityPlan } from '../scripts/generate-pii-mixed-parity.mjs';

const plan = loadPlan();
const documents = materialize(plan);
const slice = (input, start, end) => Buffer.from(input, 'utf8').subarray(start, end).toString('utf8');

test('#427 plan regenerates byte for byte from its authored truth and the regenerated credential fixtures', async () => {
  assert.equal(await readFile(MIXED_PARITY_PLAN_FILE, 'utf8'), renderMixedParityPlan());
});

test('#427 plan stores no credential value and keeps domains apart', async () => {
  const text = await readFile(MIXED_PARITY_PLAN_FILE, 'utf8');
  for (const document of documents)
    for (const target of document.targets.filter(row => row.domain === 'credential'))
      assert.ok(!text.includes(slice(document.input, target.start, target.end)), `${target.id} value is stored in the plan`);
  assert.equal(plan.accounting.combinedScore, false);
  for (const document of documents) for (const target of document.targets) {
    if (target.domain === 'credential') { assert.deepEqual(target.actions, ['redact', 'block']); assert.equal(target.optional, false); }
    else { assert.match(target.type, /^pii_/); assert.ok(['redact', 'warn'].includes(target.action)); }
  }
});

test('#427 every target is a non-empty span on a code-point boundary in every variant and unit', () => {
  for (const document of documents) for (const variant of VARIANTS) {
    const shaped = variantOf(document, variant), tables = offsetTables(shaped.input), frozen = plan.expected[document.id][variant];
    assert.equal(sha256(shaped.input), frozen.inputSha256);
    for (const target of shaped.targets) {
      const text = slice(shaped.input, target.start, target.end);
      assert.ok(text.length > 0);
      const lf = document.targets.find(row => row.id === target.id);
      assert.equal(text, variant === 'crlf' ? slice(document.input, lf.start, lf.end).replace(/\n/g, '\r\n') : text);
      const row = frozen.targets.find(entry => entry.id === target.id);
      assert.equal(shaped.input.slice(row.utf16[0], row.utf16[1]), text);
      assert.equal([...shaped.input].slice(row.codePoints[0], row.codePoints[1]).join(''), text);
      assert.equal(tables.toUtf8(row.utf16[0], 'utf16-code-units'), target.start);
    }
  }
  // The Unicode document really separates the three units.
  const unicode = plan.expected['unicode-ko-record'].lf;
  assert.ok(unicode.utf8Bytes > unicode.utf16CodeUnits && unicode.utf16CodeUnits > unicode.codePoints);
});

test('#427 expected bytes: credential-only control is PII-invariant, PII-off keeps every PII value, warn keeps its text', () => {
  const control = documents.find(row => row.id === 'ci-log-credentials-only');
  for (const variant of VARIANTS) assert.equal(expectedOutput(variantOf(control, variant), 'pii-on'), expectedOutput(variantOf(control, variant), 'pii-off'));
  for (const document of documents) {
    const off = expectedOutput(document, 'pii-off');
    for (const target of document.targets.filter(row => row.domain === 'pii')) assert.ok(off.includes(slice(document.input, target.start, target.end)));
    for (const target of document.targets.filter(row => row.domain === 'credential')) assert.ok(!off.includes(slice(document.input, target.start, target.end)));
  }
  const ticket = documents.find(row => row.id === 'support-ticket-en');
  const warn = ticket.targets.find(row => row.action === 'warn');
  assert.ok(expectedOutput(ticket, 'pii-on').includes(slice(ticket.input, warn.start, warn.end)));
});

test('#427 partitions cut inside every target, never inside a code point, and include a CR|LF split', () => {
  for (const document of documents) for (const variant of VARIANTS) {
    const shaped = variantOf(document, variant), rows = partitions(shaped, variant), n = [...shaped.input].length;
    assert.equal(new Set(rows.map(row => row.cuts.join(','))).size, rows.length);
    for (const row of rows) for (const cut of row.cuts) assert.ok(cut > 0 && cut < n);
    assert.equal(rows.find(row => row.id === 'every-code-point').cuts.length, n - 1);
    assert.equal(rows.some(row => row.kind === 'crlf-split'), variant === 'crlf');
  }
});

/** A perfect observation derived from the plan itself, in UTF-8 bytes. */
function perfect(document, selection, chosen = []) {
  const { required, optional } = targetsFor(document, selection);
  const findings = [...required, ...optional.filter(row => chosen.includes(row.id))].map(target => ({
    type: target.type ?? 'synthetic_credential', detector: 'd', action: target.action ?? 'redact', confidence: 'high', start: target.start, end: target.end }));
  return { status: 'ok', findings, outputSha256: sha256(expectedOutput(document, selection, chosen)), valueLeft: [] };
}

test('#427 scoring: optional envelopes, warn is never sanitized success, and domains are counted apart', () => {
  const log = documents.find(row => row.id === 'app-log-logfmt');
  const optional = log.targets.filter(row => row.optional).map(row => row.id);
  for (const chosen of [[], optional, optional.slice(0, 1)]) {
    const score = scoreOperation(log, 'pii-on', perfect(log, 'pii-on', chosen));
    assert.equal(score.findingsCorrect, true); assert.equal(score.outputCorrect, true); assert.deepEqual(score.chosenOptional, [...chosen].sort());
  }
  const off = scoreOperation(log, 'pii-off', perfect(log, 'pii-on', optional));
  assert.equal(off.findingsCorrect, false); assert.ok(off.pii.piiFindingsWhileOff > 0); assert.equal(off.credential.unexpected, 0);
  const ticket = documents.find(row => row.id === 'support-ticket-en');
  const score = scoreOperation(ticket, 'pii-on', perfect(ticket, 'pii-on'));
  assert.equal(score.findingsCorrect, true); assert.equal(score.outputCorrect, true); assert.equal(score.sanitized, false); assert.equal(score.warnRetained.length, 1);
  const redactedWarn = perfect(ticket, 'pii-on');
  redactedWarn.findings = redactedWarn.findings.map(row => row.action === 'warn' ? { ...row, action: 'redact' } : row);
  assert.equal(scoreOperation(ticket, 'pii-on', redactedWarn).findingsCorrect, false);
  const control = documents.find(row => row.id === 'ci-log-credentials-only');
  for (const selection of SELECTIONS) assert.equal(scoreOperation(control, selection, perfect(control, selection)).sanitized, true);
});

test('#427 output-only operations accept exactly one admissible optional subset', () => {
  const log = documents.find(row => row.id === 'app-log-logfmt');
  const optional = log.targets.filter(row => row.optional).map(row => row.id);
  const outputOnly = chosen => ({ status: 'ok', findings: null, outputSha256: sha256(expectedOutput(log, 'pii-on', chosen)), valueLeft: [] });
  const score = scoreOperation(log, 'pii-on', outputOnly(optional.slice(1, 3)));
  assert.equal(score.outputCorrect, true); assert.equal(score.findingsCorrect, null); assert.deepEqual(score.chosenOptional, optional.slice(1, 3).sort());
  assert.equal(scoreOperation(log, 'pii-on', { ...outputOnly([]), outputSha256: sha256(log.input) }).outputCorrect, false);
});

test('#427 committed observations re-score to their committed reports byte for byte', historicalReplayOptions, async () => {
  const { buildMixedParityReport } = await import('../benchmarks/evaluation/domains/pii/mixed-parity/report.ts');
  const { readdir } = await import('node:fs/promises');
  const files = [...historicalArchive.files.keys()].filter(file => file.startsWith('evidence/901/427/') && file.endsWith('-observation-v1.json')).map(file => file.slice('evidence/901/427/'.length));
  assert.ok(files.length > 0);
  for (const file of files) {
    const observation = JSON.parse(historicalBytes(`evidence/901/427/${file}`).toString('utf8'));
    const report = historicalBytes(`evidence/901/427/${file.replace('-observation-v1.json', '-report-v1.json')}`).toString('utf8');
    assert.equal(`${JSON.stringify(buildMixedParityReport(observation), null, 2)}\n`, report, file);
    // Evidence stays input-free: no finding carries text and every output is a digest.
    const text = historicalBytes(`evidence/901/427/${file}`).toString('utf8');
    for (const document of documents) for (const target of document.targets) assert.ok(!text.includes(slice(document.input, target.start, target.end)));
  }
});

test('#427 plan v2 regenerates, leaves the frozen v1 plan untouched, and promotes exactly the v1 envelopes', async () => {
  assert.equal(await readFile(MIXED_PARITY_PLAN_V2_FILE, 'utf8'), renderMixedParityPlan(2));
  const v2 = loadPlan(MIXED_PARITY_PLAN_V2_FILE), v2Documents = materialize(v2);
  assert.equal(v2.planVersion, 2); assert.equal(v2.contextVocabulary, 'pii-context/v2');
  assert.equal(v2.supersedes.commitment, planCommitment(plan));
  assert.equal(planCommitment(plan), 'b4092b2533f787df08168cc826879cf4b5c08fdcf5881e892ba58f5f4e9b6789');
  const v1Optional = documents.flatMap(row => row.targets.filter(target => target.optional).map(target => target.id)).sort();
  assert.deepEqual(Object.keys(V2_PROMOTIONS).sort(), v1Optional);
  assert.equal(v2Documents.flatMap(row => row.targets).filter(target => target.optional).length, 0);
  for (const document of v2Documents) {
    const before = documents.find(row => row.id === document.id);
    assert.equal(document.input, before.input);
    for (const target of document.targets) {
      const old = before.targets.find(row => row.id === target.id);
      assert.deepEqual([old.start, old.end, old.type ?? null, old.action ?? null], [target.start, target.end, target.type ?? null, target.action ?? null]);
      assert.equal(target.optional, false);
    }
  }
});
