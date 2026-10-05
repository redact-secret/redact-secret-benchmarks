import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPOSITIONS, SCOPE_ACCOUNTING_FIRST_ENGINE, alphaOf, profileEffect, profileEffectsOf, scannerTotals, scopeAccountingProblems, scopeByScanner, scopeEntry,
} from '../benchmarks/qualification/scope-accounting.ts';
import { declaredProfiles, peerRegistryProblems } from '../benchmarks/lib/peer-rule-families.ts';
import { readFileSync } from 'node:fs';

// Synthetic only: every artifact is authored here in the shape of the engine's contract v1.8. No count comes from a committed artifact or the
// ledger, so a repin or a new corpus re-keys nothing in this file. The classification is the ENGINE's: the fixtures below carry the accounting the
// engine would write for the findings they retain, and the reader is tested for what it accepts, refuses and reports.

const DIGEST = '0'.repeat(64);
const TABLE = { id: 'openredaction-1.1.5', package: '@openredaction/core', version: '1.1.5', integrity: 'sha512-synthetic' };
const finding = (start, labels, family) => ({ start, end: start + 4, ...(family ? { family } : {}), ...(labels ? { native_labels: labels } : {}) });

/** The accounting the engine's rules produce for `findings`, authored by the test from the same stated rules (family wins; label classes below). */
const CLASS = { GITHUB_TOKEN: 'mapped', DOCKER_AUTH: 'credential', EMAIL: 'out', AWS_ARN: 'out', PAYMENT_TOKEN: 'ambiguous' };
function engineAccounting(findings) {
  const by = Object.fromEntries(DISPOSITIONS.map(d => [d, 0]));
  const labels = new Map();
  let multi = 0, conflicting = 0;
  for (const f of findings) {
    const ls = f.native_labels ?? [];
    if (ls.length > 1) multi++;
    const classes = new Set(ls.filter(l => l !== '~unrecognized').map(l => CLASS[l]));
    const unrecognized = ls.includes('~unrecognized');
    const conflict = classes.size > 1 || (unrecognized && classes.size > 0);
    if (conflict) conflicting++;
    let d;
    if (f.family) d = 'mapped_credential';
    else if (!ls.length) d = 'native_label_unavailable';
    else if (!classes.size) d = 'unrecognized_label';
    else if (conflict || classes.has('ambiguous') || classes.has('mapped')) d = 'ambiguous';
    else if (classes.has('credential')) d = 'credential_related_unmapped';
    else d = 'out_of_scope';
    by[d]++;
    for (const l of ls) { const x = labels.get(l) ?? { findings: 0, with_family: 0 }; x.findings++; if (f.family) x.with_family++; labels.set(l, x); }
  }
  return {
    version: '1', table: TABLE, findings: findings.length, by_disposition: by, multi_label_findings: multi, conflicting_label_findings: conflicting,
    by_label: [...labels.keys()].sort().map(label => ({ label, ...labels.get(label), ...(label === '~unrecognized' ? {} : { scope: 'x', status: 'unresolved', reason: 'reviewed' }) })),
  };
}

const position = (id, outcomes) => ({ case_id: id, path: `${id}.txt`, kind: 'must-redact', tier: 'T1', group: 'g', family: 'f', expected: [], actual: [], measurement: { type: 'positive', span_outcomes: outcomes, leaked_bytes: 0, collateral_bytes: 0 } });
const benign = (id, flagged) => ({ case_id: id, path: `${id}.txt`, kind: 'must-not-flag', tier: 'T1', group: 'g', family: 'f', expected: [], actual: [], measurement: { type: 'control', flagged, findings: flagged ? 1 : 0 } });
const run = (scanner, findings, { withAccounting = true, status = 'complete', cases = [] } = {}) => ({ scanner, status, findings, cases, aggregates: { groups: {} }, ...(withAccounting ? { scope_accounting: engineAccounting(findings) } : {}) });
const artifactOf = (runs, version = SCOPE_ACCOUNTING_FIRST_ENGINE) => ({
  manifest: { engine: { name: 'credential-eval', version }, scanners: runs.map(r => ({ id: r.scanner, version: '1.1.5', mode: 'synthetic', adapter: { id: r.scanner, version: '2' }, configuration_hash: `sha256:${DIGEST}`, build: 'released' })) },
  scanners: runs,
});

test('each disposition is carried as the engine counted it, with the retained findings as denominator', () => {
  const findings = [
    finding(0, ['GITHUB_TOKEN'], 'github-token'), finding(10, ['DOCKER_AUTH']), finding(20, ['EMAIL']), finding(30, ['AWS_ARN']),
    finding(40, ['PAYMENT_TOKEN']), finding(50, undefined), finding(60, ['~unrecognized']),
  ];
  const [entry] = scopeByScanner(artifactOf([run('openredaction', findings)]));
  assert.equal(entry.state, 'accounted');
  assert.equal(entry.retainedFindings, findings.length);
  assert.deepEqual(entry.dispositions, { mapped_credential: 1, credential_related_unmapped: 1, out_of_scope: 2, ambiguous: 1, native_label_unavailable: 1, unrecognized_label: 1 });
  assert.equal(DISPOSITIONS.reduce((n, d) => n + entry.dispositions[d], 0), entry.retainedFindings, 'summaries reconcile to the retained findings');
  assert.equal(entry.labelled, 6);
  assert.equal(entry.classification.table.id, 'openredaction-1.1.5');
  // The axes stay apart: native type, derived family, reviewed scope and reason are separate fields.
  const token = entry.labels.find(l => l.label === 'GITHUB_TOKEN');
  assert.deepEqual([token.findings, token.withFamily, token.scope, token.status, token.reason], [1, 1, 'x', 'unresolved', 'reviewed']);
  const marker = entry.labels.find(l => l.label === '~unrecognized');
  assert.deepEqual([marker.scope, marker.status, marker.reason], [null, null, null], 'an unknown native label is not an absent family');
  assert.ok(entry.limits.some(l => /neither a false positive nor ignored/.test(l)));
});

test('out-of-scope personal data and resource identifiers are diagnostics, never credential detections', () => {
  const [entry] = scopeByScanner(artifactOf([run('openredaction', [finding(0, ['EMAIL']), finding(5, ['AWS_ARN']), finding(9, ['EMAIL'])])]));
  assert.equal(entry.dispositions.out_of_scope, 3);
  assert.equal(entry.dispositions.mapped_credential, 0);
  assert.equal(entry.dispositions.credential_related_unmapped, 0);
  assert.ok(entry.limits.some(l => /not a credential detection/.test(l)));
});

test('zero findings is a measured zero, distinct from not accounted', () => {
  const [entry] = scopeByScanner(artifactOf([run('openredaction', [])]));
  assert.equal(entry.state, 'accounted');
  assert.equal(entry.retainedFindings, 0);
  assert.deepEqual(Object.values(entry.dispositions), [0, 0, 0, 0, 0, 0]);
  assert.equal(entry.labelled, 0);
});

test('an artifact of an engine before scope accounting is legacy: coverage is unknown, never zero unmapped', () => {
  const findings = [finding(0, undefined), finding(9, undefined, 'github-token')];
  const [entry] = scopeByScanner(artifactOf([run('openredaction', findings, { withAccounting: false })], '0.1.0-alpha.5'));
  assert.equal(entry.state, 'legacy-native-label-unavailable');
  assert.equal(entry.retainedFindings, 2);
  assert.equal(entry.dispositions, null);
  assert.equal(entry.labelled, null);
  assert.equal(entry.multiLabelFindings, null);
  assert.deepEqual(entry.labels, []);
  assert.ok(entry.limits[0].includes('unknown, not zero'));
  assert.equal(alphaOf('0.1.0-alpha.5'), 5);
  assert.equal(alphaOf('9.9.9'), null);
});

test('a scanner without a reviewed table, or one that did not complete, is not accounted', () => {
  const artifact = artifactOf([run('gitleaks', [finding(0, undefined)], { withAccounting: false }), run('broken', [], { withAccounting: false, status: 'timeout' })]);
  const [broken, gitleaks] = scopeByScanner(artifact);
  assert.equal(gitleaks.state, 'not-accounted');
  assert.equal(gitleaks.dispositions, null);
  assert.equal(broken.state, 'not-measured');
  assert.equal(broken.retainedFindings, null);
  // an engine version this reader does not know is not guessed to be legacy
  assert.equal(scopeByScanner(artifactOf([run('gitleaks', [], { withAccounting: false })], '9.9.9'))[0].state, 'not-accounted');
});

test('overlapping and multi-label findings are counted once by disposition and under each label; none is lost', () => {
  const findings = [
    finding(0, ['DOCKER_AUTH', 'EMAIL']), finding(10, ['EMAIL', 'GITHUB_TOKEN'], 'github-token'), finding(20, ['EMAIL', '~unrecognized']), finding(30, ['EMAIL', 'AWS_ARN']),
  ];
  const [entry] = scopeByScanner(artifactOf([run('openredaction', findings)]));
  assert.equal(entry.multiLabelFindings, 4);
  assert.equal(entry.conflictingLabelFindings, 3, 'the label sets that disagree on scope stay visible');
  assert.equal(entry.dispositions.ambiguous, 2);
  assert.equal(entry.dispositions.mapped_credential, 1);
  assert.equal(entry.dispositions.out_of_scope, 1);
  assert.equal(DISPOSITIONS.reduce((n, d) => n + entry.dispositions[d], 0), 4);
  assert.equal(entry.labels.find(l => l.label === 'EMAIL').findings, 4);
  assert.ok(entry.labels.reduce((n, l) => n + l.findings, 0) > entry.retainedFindings, 'label counts can exceed the finding count');
});

test('an accounting that does not reconcile to the retained findings is refused', () => {
  const findings = [finding(0, ['EMAIL']), finding(9, ['GITHUB_TOKEN'], 'github-token')];
  const tamper = change => { const r = run('openredaction', findings); change(r.scope_accounting); return artifactOf([r]); };
  assert.throws(() => scopeByScanner(tamper(a => { a.by_disposition.out_of_scope = 0; })), /dispositions sum/);
  assert.throws(() => scopeByScanner(tamper(a => { a.findings = 3; a.by_disposition.out_of_scope = 2; })), /retains 2/);
  assert.throws(() => scopeByScanner(tamper(a => { a.by_disposition.mapped_credential = 0; a.by_disposition.out_of_scope = 2; })), /carry a family/);
  assert.throws(() => scopeByScanner(tamper(a => { a.by_label[0].findings = 2; })), /by_label/);
  assert.throws(() => scopeByScanner(tamper(a => { a.by_label.pop(); })), /exactly the labels/);
  assert.throws(() => scopeByScanner(tamper(a => { a.by_disposition.surprise = 1; })), /unknown disposition/);
  assert.throws(() => scopeByScanner(tamper(a => { a.version = '2'; })), /this reader knows 1/);
  const noFindings = run('openredaction', findings); delete noFindings.findings;
  assert.ok(scopeAccountingProblems(noFindings).some(p => /retains no findings/.test(p)));
  assert.deepEqual(scopeAccountingProblems(run('openredaction', findings)), []);
});

test('the accounting never changes the retained findings or the case outcomes', () => {
  const findings = [finding(0, ['EMAIL']), finding(9, ['DOCKER_AUTH'])];
  const cases = [position('p1', ['EXACT', 'MISS']), benign('b1', true)];
  const artifact = artifactOf([run('openredaction', findings, { cases })]);
  const before = structuredClone(artifact);
  scopeByScanner(artifact);
  assert.deepEqual(artifact, before);
  assert.deepEqual(scannerTotals(artifact.scanners[0]).outcomes, { EXACT: 1, COVERED: 0, OVERBROAD: 0, PARTIAL: 0, MISS: 1 });
});

test('a declared profile is compared with the default as separate observations: score effects are deltas, denominators are carried', () => {
  const defaultCases = [position('p1', ['EXACT', 'EXACT', 'PARTIAL']), benign('b1', true), benign('b2', true), benign('b3', false)];
  const profileCases = [position('p1', ['EXACT', 'EXACT', 'MISS']), benign('b1', false), benign('b2', false), benign('b3', false)];
  const defaultFindings = Array.from({ length: 6 }, (_, i) => finding(i * 10, ['EMAIL']));
  const profileFindings = [finding(0, ['DOCKER_AUTH'])];
  const artifact = artifactOf([run('openredaction', defaultFindings, { cases: defaultCases }), run('openredaction-credentials', profileFindings, { cases: profileCases })]);
  const [effect] = profileEffectsOf(artifact, { 'openredaction-credentials': 'openredaction' }, 'pop');
  assert.equal(effect.default.scanner, 'openredaction');
  assert.equal(effect.profile.scanner, 'openredaction-credentials');
  assert.deepEqual(effect.delta, { outcomes: { EXACT: 0, COVERED: 0, OVERBROAD: 0, PARTIAL: -1, MISS: 1 }, benignFlagged: -2, benignFindings: -2, retainedFindings: -5 });
  assert.equal(effect.denominatorsEqual, true, 'the profile did not shrink the evidence denominators');
  assert.match(effect.note, /not a speed-up/);
  // A profile that is not in the artifact, or did not complete, yields no comparison; nothing is invented.
  assert.deepEqual(profileEffectsOf(artifactOf([run('openredaction', [], {})]), { 'openredaction-credentials': 'openredaction' }, 'pop'), []);
  // A shrunk denominator is reported, not hidden.
  const shrunk = artifactOf([run('openredaction', [], { cases: defaultCases }), run('openredaction-credentials', [], { cases: profileCases.slice(0, 3) })]);
  assert.equal(profileEffectsOf(shrunk, { 'openredaction-credentials': 'openredaction' }, 'pop')[0].denominatorsEqual, false);
  assert.equal(typeof profileEffect, 'function');
});

test('the peer registry declares the credential profiles of OpenRedaction as separate scanners, with no ranking words', () => {
  const registry = JSON.parse(readFileSync(new URL('../scanners/peer-registry.json', import.meta.url), 'utf8'));
  const registered = ['redact-secret', 'gitleaks', 'trufflehog', 'flare-redact', 'openredaction'];
  assert.deepEqual(peerRegistryProblems(registry, registered), []);
  const profiles = declaredProfiles(registry);
  assert.equal(profiles['openredaction-credential-bearing'], 'openredaction');
  assert.equal(profiles.openredaction, undefined, 'the default scanner is not a profile');
  const bad = structuredClone(registry);
  bad.scanners.openredaction.diagnosticProfiles['openredaction-credentials'].declaredScope = 'best';
  bad.scanners.openredaction.diagnosticProfiles.gitleaks = { declaredScope: 'mapped-types', description: 'collides' };
  const problems = peerRegistryProblems(bad, registered);
  assert.ok(problems.some(p => /unknown declaredScope/.test(p)));
  assert.ok(problems.some(p => /must be a new scanner id/.test(p)));
});
