import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveProblems, identityDifferences, inputDigest, planAccuracyReuse, renderReusePlan } from '../benchmarks/qualification/accuracy-reuse.ts';

// Structure only, on synthetic observation sets: no ledger value, count or digest is read from a committed run.

const D = c => `sha256:${c.repeat(64)}`;
const observation = (id, over = {}) => ({
  scanner: { id, version: '1.0.0', build: 'released', mode: 'm', adapter: { id, version: '1' }, configuration_hash: D('c'),
    provenance: { components: [id === 'gitleaks' ? { kind: 'executable', sha256: 'e1' } : { kind: 'npm-package', integrity: `sha512-${id}` }] } },
  result: { status: 'complete', findings: [], replays: { count: 2, agreed: true } }, duration_ms: 60000, ...over,
});
const archive = (over = {}) => ({
  byteDigest: D('1'), sourceRelease: 'snapshot-old',
  set: { schema: 'credential-eval/observation-set/v1', corpus_digest: D('a'), measurement: { input_digest: D('b'), protocol_version: 'p/1', restriction: null },
    observations: [observation('redact-secret'), observation('gitleaks'), observation('flare')], ...over },
});
const identity = id => ({ version: '1.0.0', build: 'released', mode: 'm', adapter: { id, version: '1' }, configurationHash: D('c'),
  executableSha256: id === 'gitleaks' ? 'e1' : null, packageIntegrity: id === 'gitleaks' ? null : `sha512-${id}` });
const target = (over = {}) => ({ population: 'regression-corpus', inputDigest: D('b'), corpusDigest: D('a'), protocol: 'p/1', restriction: null,
  scanners: { 'redact-secret': identity('redact-secret'), gitleaks: identity('gitleaks'), flare: identity('flare') }, ...over });
const origins = plan => Object.fromEntries(plan.scanners.map(s => [s.scanner, `${s.origin}:${s.reason}`]));

test('product-only replay reuses every peer, runs the product fresh and launches no performance measurement', () => {
  const plan = planAccuracyReuse({ archive: archive(), target: target({ scanners: { ...target().scanners, 'redact-secret': { ...identity('redact-secret'), version: '2.0.0' } } }) });
  assert.equal(plan.verdict, 'plan');
  assert.deepEqual(origins(plan), { flare: 'reused:compatible', gitleaks: 'reused:compatible', 'redact-secret': 'fresh:product-under-test' });
  assert.equal(plan.performanceMeasurements, 0);
  assert.equal(plan.runClass, 'exploratory');
  assert.deepEqual(plan.engineArguments.slice(0, 1), ['--reuse-observations']);
  assert.equal(plan.engineArguments.includes('--fresh'), false);
  assert.deepEqual(plan.savings, { scansSaved: 4, scannersReused: 2, scannersFresh: 1, runnerMinutesSaved: 2 });
});

test('changed fixture bytes never use stale observations: whole-population fresh fallback is shown before execution', () => {
  const plan = planAccuracyReuse({ archive: archive(), target: target({ inputDigest: D('9') }) });
  assert.equal(plan.change, 'fixture-changed');
  assert.ok(plan.scanners.every(s => s.origin === 'fresh'));
  assert.match(plan.fallback.reason, /new bound artifact/);
  assert.deepEqual(plan.engineArguments, []);
  assert.equal(plan.runClass, 'official-eligible');
  assert.equal(plan.performanceMeasurements, 0);
  assert.match(renderReusePlan(plan), /Fallback \(shown before execution\)/);
});

test('an expectation-only change rescored the compatible observations without a scan', () => {
  const plan = planAccuracyReuse({ archive: archive(), target: target({ corpusDigest: D('7') }) });
  assert.equal(plan.change, 'expectations-only');
  assert.equal(plan.rescore, true);
  assert.equal(plan.savings.scannersReused, 2);
});

test('a new evidence release tag with identical inputs forces no scan: provenance is not compatibility', () => {
  const plan = planAccuracyReuse({ archive: archive(), pin: { path: 'a.json', byteDigest: D('1'), sourceRelease: 'snapshot-old' }, target: target() });
  assert.equal(plan.savings.scannersReused, 2);
  assert.equal(plan.provenance.sourceRelease, 'snapshot-old');
});

test('a changed scanner identity invalidates that scanner only and names the field', () => {
  const t = target(); t.scanners.gitleaks = { ...identity('gitleaks'), configurationHash: D('d'), version: '9.9.9' };
  const plan = planAccuracyReuse({ archive: archive(), target: t });
  assert.equal(origins(plan).gitleaks, 'fresh:identity-changed');
  assert.deepEqual(plan.scanners.find(s => s.scanner === 'gitleaks').changed, ['version', 'configurationHash']);
  assert.equal(origins(plan).flare, 'reused:compatible');
  assert.deepEqual(plan.engineArguments, ['--reuse-observations', '<archive>', '--fresh', 'gitleaks']);
});

test('force-fresh runs the named scanner, or the whole population, fresh', () => {
  assert.equal(origins(planAccuracyReuse({ archive: archive(), target: target(), forceFresh: ['flare'] })).flare, 'fresh:force-fresh');
  const all = planAccuracyReuse({ archive: archive(), target: target(), forceFresh: 'all' });
  assert.ok(all.scanners.every(s => s.origin === 'fresh'));
  assert.equal(all.forceFresh, true);
  assert.deepEqual(all.engineArguments, []);
});

test('missing archive, new scanner and unresolvable scanner are listed as missing evidence', () => {
  const none = planAccuracyReuse({ target: target() });
  assert.equal(none.change, 'no-archive');
  assert.ok(none.missingEvidence.length);
  const t = target(); t.scanners.extra = identity('extra'); t.scanners.flare = null;
  const plan = planAccuracyReuse({ archive: archive(), target: t });
  assert.equal(origins(plan).extra, 'fresh:new-scanner');
  assert.equal(origins(plan).flare, 'fresh:unavailable');
  assert.equal(plan.missingEvidence.length, 2);
});

test('unbound, other-protocol and wrongly restricted archives fall back to fresh', () => {
  assert.equal(planAccuracyReuse({ archive: archive({ measurement: null }), target: target() }).scanners.find(s => s.scanner === 'flare').reason, 'unbound-archive');
  assert.equal(planAccuracyReuse({ archive: archive(), target: target({ protocol: 'p/2' }) }).scanners.find(s => s.scanner === 'flare').reason, 'protocol-changed');
  const restricted = archive(); restricted.set.measurement.restriction = D('f');
  assert.equal(planAccuracyReuse({ archive: restricted, target: target() }).scanners.find(s => s.scanner === 'flare').reason, 'restriction-changed');
  assert.equal(planAccuracyReuse({ archive: restricted, target: target({ restriction: D('f') }) }).savings.scannersReused, 2);
});

test('corrupt or non-deterministic evidence is refused, never worked around', () => {
  const pin = { path: 'a.json', byteDigest: D('2') };
  const corrupt = planAccuracyReuse({ archive: archive(), pin, target: target() });
  assert.equal(corrupt.verdict, 'refused');
  assert.match(corrupt.refusals[0], /digest/);
  assert.equal(corrupt.savings.scannersReused, 0);
  assert.deepEqual(corrupt.engineArguments, []);
  for (const result of [{ status: 'timeout', timeout_ms: 1 }, { status: 'complete', replays: { count: 2, agreed: false } }, { status: 'complete', replays: { count: 1, agreed: true } }]) {
    const a = archive(); a.set.observations[2] = observation('flare', { result });
    const plan = planAccuracyReuse({ archive: a, target: target() });
    assert.equal(plan.verdict, 'refused');
    assert.ok(plan.scanners.every(s => s.origin === 'fresh'));
  }
  assert.ok(archiveProblems({ byteDigest: D('1'), set: { schema: 'other', observations: [] } }).length);
  const dup = archive(); dup.set.observations.push(observation('flare'));
  assert.match(archiveProblems(dup)[0], /more than once/);
});

test('an unchanged identity projection ignores fields the target does not state', () => {
  assert.deepEqual(identityDifferences(identity('flare'), { version: '1.0.0' }), []);
  assert.deepEqual(identityDifferences(identity('flare'), { version: '2' }), ['version']);
});

test('input digest follows the engine: sorted path and content hash, independent of order and expectations', () => {
  const a = [{ path: 'b', content: 'x' }, { path: 'a', content: 'y' }];
  assert.equal(inputDigest(a), inputDigest([...a].reverse()));
  assert.notEqual(inputDigest(a), inputDigest([{ path: 'b', content: 'x2' }, a[1]]));
  assert.match(inputDigest(a), /^sha256:[0-9a-f]{64}$/);
});

test('the plan states origins and the saved scans and runner-minutes', () => {
  const text = renderReusePlan(planAccuracyReuse({ archive: archive(), target: target() }));
  assert.match(text, /\| flare \| reused \| compatible/);
  assert.match(text, /scans not launched: 4/);
  assert.match(text, /runner-minutes not spent: 2/);
});

import { spawnSync } from 'node:child_process';
const driver = args => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-official-credential-eval.ts', ...args], { encoding: 'utf8' });

test('an official run refuses observation reuse before touching anything', () => {
  const result = driver(['--reuse-observations', 'x.json', '--population', 'policy-corpus']);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /official run measures every scanner fresh/);
});

test('--fresh without a reuse set is refused', () => {
  const result = driver(['--mode', 'diagnostic', '--fresh', 'gitleaks']);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /--fresh needs --reuse-observations/);
});
