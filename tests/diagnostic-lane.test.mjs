import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  diagnosticBindingProblems, diagnosticRecordProblem, diagnosticSummary, outcomesOf, parseSelectedScanners, renderDiagnosticSummary, selectedScannerConfig,
} from '../benchmarks/qualification/diagnostic-lane.ts';
import { bindingProblems } from '../benchmarks/qualification/run-artifact.ts';

// Structure only, on synthetic artifacts: no ledger value, count or digest is read from a committed run.

const pin = { source: 'redact-secret-benchmarks/regression', revision: 'corpus-x', evidenceSchema: 'schema/v2', corpusDigest: 'sha256:aa', release: { tag: 'regression-aa', manifestDigest: 'sha256:bb' } };
const product = { id: 'redact-secret', version: '1.0.0', integrity: 'sha512-product' };
const options = { engineVersion: '1.0.0', protocol: 'p/1', selected: ['redact-secret'], product };
const artifact = (change = {}) => structuredClone({
  manifest: {
    engine: { name: 'credential-eval', version: '1.0.0' }, protocol_version: 'p/1',
    evidence: { source: pin.source, revision: pin.revision, evidence_schema: pin.evidenceSchema, corpus_digest: pin.corpusDigest, release: { tag: pin.release.tag, manifest_digest: pin.release.manifestDigest } },
    config_hash: 'h', run_class: 'exploratory', publication: 'internal', methods: [],
    scanners: [{ id: 'redact-secret', version: '1.0.0', mode: 'm', adapter: { id: 'a', version: '1' }, configuration_hash: 'c', provenance: { components: [{ kind: 'npm-package', name: 'core', integrity: 'sha512-product' }] } }],
  },
  scanners: [{ scanner: 'redact-secret', status: 'complete', cases: [
    { case_id: 'a', measurement: { type: 'positive', span_outcomes: ['EXACT', 'MISS'] } },
    { case_id: 'b', measurement: { type: 'positive', span_outcomes: ['COVERED'] } },
    { case_id: 'c', measurement: { type: 'control', flagged: true, findings: 1 } },
    { case_id: 'd', measurement: { type: 'control', flagged: false, findings: 0 } },
    { case_id: 'e', measurement: { type: 'pending' } },
  ], aggregates: { groups: {} } }],
  non_semantic: {},
  ...change,
});

test('a diagnostic artifact bound to the pinned evidence, engine and candidate build is accepted', () => {
  assert.deepEqual(diagnosticBindingProblems(artifact(), pin, options), []);
});

test('a diagnostic artifact never passes the official binding', () => {
  assert.ok(bindingProblems(artifact(), pin, { engineVersion: '1.0.0', protocol: 'p/1' }).some(p => /run_class is exploratory/.test(p)));
});

test('a wrong evidence, engine, protocol or candidate build still fails', () => {
  const mutate = (change, opts = options) => { const a = artifact(); change(a); return diagnosticBindingProblems(a, pin, opts); };
  assert.ok(mutate(a => { a.manifest.evidence.corpus_digest = 'sha256:zz'; }).some(p => /corpus_digest/.test(p)));
  assert.ok(mutate(a => { a.manifest.evidence.release.manifest_digest = 'sha256:zz'; }).some(p => /release/.test(p)));
  assert.ok(mutate(a => { a.manifest.engine.version = '9.9.9'; }).some(p => /engine/.test(p)));
  assert.ok(mutate(a => { a.manifest.protocol_version = 'p/2'; }).some(p => /protocol/.test(p)));
  assert.ok(mutate(a => { a.manifest.scanners[0].version = '0.0.1'; }).some(p => /registry pins 1\.0\.0/.test(p)));
  assert.ok(mutate(a => { a.manifest.scanners[0].provenance.components[0].integrity = 'sha512-other'; }).some(p => /integrity/.test(p)));
  assert.ok(mutate(a => { a.scanners[0].status = 'failed'; }).some(p => /not measured/.test(p)));
});

test('a diagnostic artifact must be exploratory and internal, with exactly the selected scanners and no methods', () => {
  const mutate = change => { const a = artifact(); change(a); return diagnosticBindingProblems(a, pin, options); };
  assert.ok(mutate(a => { a.manifest.run_class = 'official'; }).some(p => /exploratory/.test(p)));
  assert.ok(mutate(a => { a.manifest.publication = 'public'; }).some(p => /internal/.test(p)));
  assert.ok(mutate(a => { a.manifest.scanners.push({ ...a.manifest.scanners[0], id: 'gitleaks' }); }).some(p => /selection is/.test(p)));
  assert.ok(mutate(a => { a.manifest.methods.push({ id: 'differential', version: '1' }); }).some(p => /ran methods/.test(p)));
});

test('the product scanner is always selected and the configuration is restricted to the selection', () => {
  const ids = ['gitleaks', 'redact-secret', 'trufflehog'];
  assert.deepEqual(parseSelectedScanners(undefined, ids), ['redact-secret']);
  assert.deepEqual(parseSelectedScanners('redact-secret,gitleaks', ids), ['gitleaks', 'redact-secret']);
  assert.throws(() => parseSelectedScanners('gitleaks', ids), /must include redact-secret/);
  assert.throws(() => parseSelectedScanners('redact-secret,nope', ids), /unknown scanner nope/);
  const config = { schema: 's', scanners: ids.map(id => ({ id, pin: { version: id } })) };
  const restricted = selectedScannerConfig(config, ['redact-secret']);
  assert.deepEqual(restricted.scanners, [{ id: 'redact-secret', pin: { version: 'redact-secret' } }]);
  assert.equal(restricted.schema, 's');
  assert.equal(config.scanners.length, 3, 'the pinned configuration is not changed');
  assert.throws(() => selectedScannerConfig(config, ['gitleaks']), /product scanner/);
});

test('outcomes are counted for the product scanner and name cases to look at, never values', () => {
  const o = outcomesOf(artifact(), 'regression-corpus');
  assert.equal(o.cases, 5);
  assert.deepEqual([o.outcomes.EXACT, o.outcomes.COVERED, o.outcomes.MISS], [1, 1, 1]);
  assert.equal(o.controlsFlagged, 1);
  assert.equal(o.pending, 1);
  assert.deepEqual(o.nonExactCases, ['a', 'c']);
});

test('the summary states scope, missing scanners and unavailable peer-dependent results', () => {
  const scope = { populations: ['regression-corpus'], selected: ['redact-secret'], registryScanners: ['flare-redact', 'gitleaks', 'openredaction', 'redact-secret', 'trufflehog'], engine: 'credential-eval 1.0.0', evidence: {} };
  const s = diagnosticSummary(scope, [outcomesOf(artifact(), 'regression-corpus')], ['differential', 'metamorphic', 'mutation']);
  assert.deepEqual(s.scope.missingScanners, ['flare-redact', 'gitleaks', 'openredaction', 'trufflehog']);
  assert.equal(s.comparison.state, 'unavailable');
  assert.equal(s.classification.promotion, 'disallowed');
  assert.ok(s.methods.every(m => m.state === 'unavailable'));
  assert.match(s.methods.find(m => m.method === 'differential').reason, /missing: flare-redact/);
  const text = renderDiagnosticSummary(s);
  assert.match(text, /Not an official run; promotion is disallowed/);
  assert.match(text, /Scanners not run: flare-redact, gitleaks, openredaction, trufflehog/);
  const all = diagnosticSummary({ ...scope, selected: scope.registryScanners }, [], []);
  assert.equal(all.comparison.state, 'available');
});

test('a diagnostic record is refused by the official record path', async () => {
  assert.match(diagnosticRecordProblem({ mode: 'diagnostic' }), /never recorded/);
  assert.match(diagnosticRecordProblem({ schema: 'redact-secret-benchmarks/diagnostic-record/v1' }), /never recorded/);
  assert.equal(diagnosticRecordProblem({ schema: 'redact-secret-benchmarks/official-run-record/v1' }), null);
  const record = await readFile(new URL('../scripts/record-official-run.mjs', import.meta.url), 'utf8');
  assert.match(record, /diagnosticRecordProblem/);
});

test('the workflow keeps the full run as the default and keeps a diagnostic run out of the official paths', async () => {
  const yml = await readFile(new URL('../.github/workflows/official-runs.yml', import.meta.url), 'utf8');
  assert.match(yml, /mode:\s*\n(?:.*\n){1,4}\s+default: full/);
  assert.match(yml, /populations=\["public-evidence-snapshot","regression-corpus","policy-corpus"\]/);
  assert.match(yml, /diagnostic-/);
  assert.match(yml, /inputs\.mode != 'diagnostic' && inputs\.attribution == ''/, 'the qualification view is full mode only');
  assert.match(yml, /if: \$\{\{ inputs\.mode != 'diagnostic' \}\} # the diagnostic lane runs the product only/);
  assert.match(yml, /--mode diagnostic/);
});
