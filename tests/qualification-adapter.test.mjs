import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildQualificationView, serializeView, detectorsOf, attributeCase } from '../benchmarks/qualification/adapter.ts';
import { policyRevision } from '../benchmarks/qualification/inputs.ts';
import { canonical } from '../benchmarks/qualification/canonical.ts';
import { readRunArtifact, semanticDigestOf, familyCounts } from '../benchmarks/qualification/run-artifact.ts';
import { validateQualificationView } from '../benchmarks/qualification/view-schema.ts';
import { statusCriteria } from '../benchmarks/support/status.ts';
import { fixtureProfiles } from '../benchmarks/support/profiles.ts';

// Synthetic only. No test here reads the ledger, a committed artifact or a count from the corpus: a repin or a new
// corpus re-keys those, so the state under test is built in the test and every expectation is relative to it.

const DIGEST = n => `sha256:${String(n).padStart(64, '0')}`;
const POPULATIONS = { 'pop-a': 'floors-and-gates', 'pop-b': 'gates', 'pop-c': 'policy-route' };
const registry = Object.keys(POPULATIONS).map((id, i) => ({
  id, source: `synthetic/${id}`, runClass: 'public', publishable: true,
  evidence: { source: `synthetic/${id}`, revision: `rev-${id}`, evidenceSchema: 'synthetic/1', corpusDigest: DIGEST(i + 1), release: { tag: `tag-${id}`, manifestDigest: DIGEST(i + 100) } },
}));
const engine = { version: '9.9.9', protocol: 'credential-eval-protocol/1' };
const METHODS = ['metamorphic', 'mutation', 'differential'];

const lowered = () => {
  const c = structuredClone(statusCriteria);
  for (const key of ['minimumPositiveCases', 'minimumPositiveAxes', 'minimumBenignCases', 'minimumControlAxes', 'minimumTwinPairs']) c.stable.documented[key].value = 1;
  c.stable.benign.minimumCases.value = 1; c.stable.benign.minimumAxes.value = 1;
  return c;
};

const unit = (id, family, extra = {}) => ({
  case_id: id, path: `${id}.txt`, kind: 'must-redact', tier: 'T1', group: 'g1', family, expected: [{ start: 0, end: 8, role: 'secret' }], actual: [{ start: 0, end: 8, family }],
  measurement: { type: 'positive', span_outcomes: ['EXACT'], leaked_bytes: 0, collateral_bytes: 0 }, ...extra,
});
const control = (id, family, extra = {}) => ({
  case_id: id, path: `${id}.txt`, kind: 'must-not-flag', tier: 'T1', group: 'g1', family, expected: [], actual: [],
  measurement: { type: 'control', flagged: false, findings: 0, co_detected: false }, ...extra,
});
/** A family with `positives` positives, a twin pair and benign controls on two axes. `twinFlagged` makes the twin fire. */
const familyCases = (prefix, family, { twinFlagged = false, evidenceClass } = {}) => {
  const ec = evidenceClass ? { evidence_class: evidenceClass } : {};
  const flagged = { type: 'control', flagged: true, findings: 1, co_detected: false };
  return [
    unit(`${prefix}-p1`, family, { group: 'axis-1', ...ec }), unit(`${prefix}-p2`, family, { group: 'axis-2', ...ec }),
    control(`${prefix}-t1`, family, { group: 'axis-1', twin_of: `${prefix}-p1`, twin_mutation_kind: 'length', ...(twinFlagged ? { measurement: flagged } : {}), ...ec }),
    control(`${prefix}-b1`, family, { group: 'axis-a', ...ec }), control(`${prefix}-b2`, family, { group: 'axis-b', ...ec }),
  ];
};

function artifact(population, cases, { publication = 'public', runClass = 'official', methods = [], build = 'released', status = 'complete', mutate, scannerIds = ['redact-secret', 'peer-one'] } = {}) {
  const evidence = registry.find(r => r.id === population).evidence;
  const ids = scannerIds;
  const doc = {
    schema: 'credential-eval/run-artifact/v1',
    manifest: {
      engine: { name: 'credential-eval', version: engine.version }, protocol_version: engine.protocol,
      evidence: { source: evidence.source, revision: evidence.revision, evidence_schema: evidence.evidenceSchema, corpus_digest: evidence.corpusDigest, release: { tag: evidence.release.tag, manifest_digest: evidence.release.manifestDigest } },
      config_hash: DIGEST(7), run_class: runClass, publication,
      accounting: { min_denominator: 5, resolved_rate_floor: { default: 0.9 }, measurable_share_floor: 0.7, twin_coverage_floor: 0.5, replays: 2, interval_z: 1.96, interval_precision: 6 },
      methods: methods.map(id => ({ id, version: 1 })),
      scanners: ids.map(id => ({ id, version: '1.0.0', mode: 'synthetic', adapter: { id, version: '1' }, configuration_hash: DIGEST(8), build })),
    },
    scanners: ids.map(id => ({ scanner: id, status, findings: [], aggregates: { groups: {} },
      cases: status === 'complete' ? cases : cases.map(c => ({ ...c, actual: [], measurement: { type: 'not-measured', status } })) })),
    variants: [], comparisons: [], review_queue: [],
    non_semantic: { run_id: 'x', started_at: '2026-01-01T00:00:00Z' },
  };
  mutate?.(doc);
  return Buffer.from(JSON.stringify(doc));
}

const product = (overrides = {}) => ({
  families: ['synthetic-token'],
  contracts: { 'synthetic-token': { tier: 'T1', providerSource: 'https://example.invalid/doc' } },
  taxonomy: { schemaVersion: 1, sourceNote: '', providers: [], families: [{ id: 'prov:fam', provider: 'prov', name: 'Fam', detectors: ['synthetic-token'] }] },
  empirical: () => ({ observationCount: 0, observationSubjects: 0, observationIssuanceDates: 0, corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [], unresolvedContradictions: 0, boundedContradictions: 0, uncertainty: null, supportedContexts: [], empiricalMode: null, supportsBareValues: false }),
  criteria: lowered(), profiles: fixtureProfiles, policyCriteria: {}, policyContracts: {}, ledger: { schemaVersion: 2, entries: {} }, knownGaps: [],
  policy: { schemaVersion: 1, id: 'synthetic-policy', scanner: 'redact-secret', populations: Object.fromEntries(Object.entries(POPULATIONS).map(([id, role]) => [id, { role, rationale: 'synthetic' }])),
    axes: { positiveContext: 'overlay-else-group', benignControl: 'overlay-else-taxonomy-else-group' }, methods: { required: METHODS, whenNotRun: 'block-stable', source: 'methods-run', differential: { peers: ['peer-one'], rationale: 'synthetic' } },
    attribution: { fallback: ['overlay-detectors', 'twin-parent'], rationale: 'synthetic' },
    axisCoverage: { populations: ['pop-a', 'pop-b'], rationale: 'synthetic' }, twinScope: { scopedBy: 'pop-b', rationale: 'synthetic' }, rules: ['synthetic'] },
  policyRevision: policyRevision([{ path: 'a', digest: DIGEST(1) }]), ...overrides,
});

/**
 * The methods run of pop-a: its cases are generated variants (`<case id>--<method>--<variant>`), its assertions and review
 * occurrences are keyed by the evaluation case id `<case id>--<method>`. `failures` and `queue` are seed case ids.
 */
const methodsRun = ({ methods = METHODS, failures = [], queue = [], queueIds = [], queuePeers = [] } = {}) => artifact('pop-a', familyCases('a', 'prov:fam').map(c => ({ ...c, case_id: `${c.case_id}--differential--canonical` })), {
  methods,
  mutate: doc => {
    doc.scanners.find(s => s.scanner === 'redact-secret').assertions = failures.map(([id, method]) => ({ case_id: `${id}--${method}`, method, assertion: 'same-detection', status: 'fail' }));
    doc.review_queue = queue.map((id, i) => ({ id: queueIds[i] ?? DIGEST(500 + i), case_id: `${id}--differential`, method: 'differential', variant: 'canonical', reference: 'redact-secret', peer: queuePeers[i] ?? 'peer-one', disagreement: 'reference-only' }));
  },
});
const inputs = (options = {}) => [
  { population: 'pop-a', bytes: artifact('pop-a', options.a ?? familyCases('a', 'prov:fam'), options.aOptions), ...(options.methods ? { methodsBytes: options.methods === true ? methodsRun() : options.methods } : {}) },
  { population: 'pop-b', bytes: artifact('pop-b', options.b ?? familyCases('b', 'synthetic-token'), options.bOptions) },
  { population: 'pop-c', bytes: artifact('pop-c', options.c ?? [], options.cOptions), caseMetadata: {} },
];
const build = (options = {}, p = product()) => buildQualificationView({ registry, engine, artifacts: inputs(options), product: p });
const family = view => view.families.find(f => f.family === 'synthetic-token');

test('a family that meets its floors is stable only once every required method has run', () => {
  assert.equal(family(build({ methods: true })).status.value, 'stable');
  const held = family(build());
  assert.equal(held.status.value, 'provisional');
  assert.deepEqual(held.status.methodsNotRun, METHODS);
  assert.ok(held.status.reasons.some(r => r.startsWith('methods.notRun')));
});

test('counts stay per population: no row, figure or denominator is pooled', () => {
  const view = build({ methods: true });
  const f = family(view);
  assert.deepEqual(f.populations.map(p => p.population), ['pop-a', 'pop-b', 'pop-c']);
  const a = f.populations.find(p => p.population === 'pop-a').scanners.find(s => s.scanner === 'redact-secret').counts;
  const b = f.populations.find(p => p.population === 'pop-b').scanners.find(s => s.scanner === 'redact-secret').counts;
  assert.equal(a.cases, familyCases('a', 'prov:fam').length);
  assert.equal(b.cases, familyCases('b', 'synthetic-token').length);
  for (const p of view.populations) assert.equal(p.denominator, p.population);
  assert.ok(!('total' in f) && !('combined' in f.evidence));
  // The floors are the floors population's own count; the gate rows are one per gate-bearing population.
  assert.equal(f.evidence.twinPairs, a.twins.pairs);
  assert.deepEqual(f.gates.map(g => g.population), ['pop-a', 'pop-b']);
});

test('the same case id in two populations stays two rows', () => {
  const same = familyCases('same', 'synthetic-token');
  const view = build({ a: familyCases('same', 'prov:fam'), b: same, methods: true });
  const f = family(view);
  const per = f.populations.filter(p => p.role !== 'policy-route').map(p => p.scanners.find(s => s.scanner === 'redact-secret').counts.cases);
  assert.deepEqual(per, [5, 5]);
});

test('a zero-tolerance gate fails on the worst population, never on a sum', () => {
  const view = build({ b: familyCases('b', 'synthetic-token', { twinFlagged: true }), methods: true });
  const f = family(view);
  assert.equal(f.status.value, 'provisional');
  assert.equal(f.evidence.twinFailures, 1);
  assert.deepEqual(f.gates.map(g => g.twinFailures), [0, 1]);
  assert.ok(f.status.reasons.some(r => r.startsWith('twinFailures')));
});

test('the evidence class a case carries never changes a family route or status', () => {
  const plain = family(build({ methods: true }));
  const labelled = family(build({ a: familyCases('a', 'prov:fam', { evidenceClass: 'project-policy' }), methods: true }));
  assert.equal(labelled.status.value, plain.status.value);
  assert.equal(labelled.status.evidenceTier, 'T1');
  assert.equal(labelled.status.evidenceBasis, 'provider-documented');
});

test('a taxonomy family resolves to its detector, and an unserved family is reported, not dropped', () => {
  const ids = new Set(['synthetic-token']);
  const map = new Map([['prov:fam', ['synthetic-token']]]);
  assert.deepEqual(detectorsOf({ family: 'prov:fam', targets: [] }, ids, map), ['synthetic-token']);
  assert.deepEqual(detectorsOf({ family: 'synthetic-token', targets: ['other-token'] }, ids, map), ['synthetic-token']);
  const view = build({ a: [...familyCases('a', 'prov:fam'), unit('stray', 'nobody:serves-this')], methods: true });
  assert.deepEqual(view.unmappedFamilies, ['pop-a:nobody:serves-this']);
  assert.ok(view.populations.find(p => p.population === 'pop-a').unattributed.every(u => u.counts.cases === 1));
});

test('an artifact that does not validate or bind stops the view', () => {
  const unknownField = artifact('pop-a', familyCases('a', 'prov:fam'), { mutate: d => { d.extra = 1; } });
  assert.throws(() => readRunArtifact(unknownField), /does not match the v1 schema/);
  const wrongTag = artifact('pop-a', familyCases('a', 'prov:fam'), { mutate: d => { d.schema = 'credential-eval/run-artifact/v2'; } });
  assert.throws(() => readRunArtifact(wrongTag), /Unsupported run artifact schema tag/);
  assert.throws(() => build({ aOptions: { runClass: 'exploratory' } }), /official artifacts only/);
  assert.throws(() => build({ aOptions: { status: 'timeout' } }), /not measured/);
  assert.throws(() => build({ bOptions: { mutate: d => { d.manifest.evidence.corpus_digest = DIGEST(999); } } }), /corpus_digest/);
  assert.throws(() => buildQualificationView({ registry, engine, artifacts: inputs().slice(0, 2), product: product() }), /No artifact for population pop-c/);
  assert.throws(() => buildQualificationView({ registry, engine, artifacts: [...inputs(), inputs()[0]], product: product() }), /Two artifacts/);
});

test('one internal artifact makes the whole view internal', () => {
  assert.equal(build().publication, 'public');
  const view = build({ bOptions: { publication: 'internal' } });
  assert.equal(view.publication, 'internal');
  assert.equal(view.populations.find(p => p.population === 'pop-b').runClass, 'internal');
  assert.equal(view.populations.find(p => p.population === 'pop-a').runClass, 'public');
});

test('a holdout receipt only qualifies a candidate build', () => {
  assert.throws(() => build({}, product({ holdoutReceipt: { report: { families: {} } } })), /immutable candidate run/);
});

test('known gaps join to cases by id in every population that carries the id', () => {
  const view = build({ methods: true }, product({ knownGaps: [{ id: 'gap-1', status: 'fixed', fixtures: ['b-p1', 'missing-id'] }] }));
  const [gap] = view.knownGaps;
  assert.equal(gap.fixtures[0].matches.length, 1);
  assert.equal(gap.fixtures[0].matches[0].population, 'pop-b');
  assert.deepEqual(gap.fixtures[1].matches, []);
});

test('the view is deterministic and schema-valid; non_semantic moves only the byte digest and the measurement provenance (#620, #621)', () => {
  const first = serializeView(build({ methods: true }));
  assert.equal(serializeView(build({ methods: true })), first);
  const other = build({ methods: true, aOptions: { mutate: d => { d.non_semantic = { run_id: 'other', host: 'elsewhere' }; } } });
  const a = JSON.parse(first), b = JSON.parse(serializeView(other));
  assert.notEqual(a.populations[0].artifact.artifactDigest, b.populations[0].artifact.artifactDigest);
  assert.equal(a.populations[0].artifact.semanticDigest, b.populations[0].artifact.semanticDigest);
  for (const view of [a, b]) for (const p of view.populations) { p.artifact.artifactDigest = 'masked'; if (p.methodsArtifact) p.methodsArtifact.artifactDigest = 'masked'; delete p.measurement; delete p.methodsMeasurement; }
  assert.deepEqual(a, b);
  assert.deepEqual(validateQualificationView(JSON.parse(first)), []);
  assert.ok(validateQualificationView({ ...JSON.parse(first), extra: true }).length > 0);
});

test('the semantic digest ignores non_semantic, keeps float text, and moves with a measurement', () => {
  const text = JSON.stringify({ a: 1.0, b: [0.0], non_semantic: { run_id: 'one' } }).replace('"a":1', '"a":1.0').replace('[0]', '[0.0]');
  const other = text.replace('one', 'two');
  assert.equal(semanticDigestOf(text), semanticDigestOf(other));
  assert.notEqual(semanticDigestOf(text), semanticDigestOf(text.replace('1.0', '1')));
  assert.notEqual(semanticDigestOf(text), semanticDigestOf(text.replace('0.0', '0.5')));
});

test('the family view counts per-case fields and never re-scores', () => {
  const { artifact: parsed } = readRunArtifact(artifact('pop-a', familyCases('a', 'prov:fam')));
  const counts = familyCounts(parsed.scanners[0]).get('prov:fam');
  assert.equal(counts.positives['must-redact'].cases, 2);
  assert.equal(counts.twins.pairs, 1);
  assert.equal(counts.twins.discriminated, 1);
  assert.equal(counts.benign.cases, 2);
});

test('the policy revision moves with any qualification input and with nothing else', () => {
  const base = [{ path: 'b', digest: DIGEST(2) }, { path: 'a', digest: DIGEST(1) }];
  const stamp = policyRevision(base).revision;
  assert.match(stamp, /^rs-policy-\d+:sha256:[0-9a-f]{64}$/);
  assert.equal(policyRevision([...base].reverse()).revision, stamp);
  assert.notEqual(policyRevision([{ path: 'b', digest: DIGEST(3) }, base[1]]).revision, stamp);
  assert.notEqual(policyRevision([...base, { path: 'c', digest: DIGEST(4) }]).revision, stamp);
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

test('the T3 policy route reads only the policy-route population, joins product metadata by case id, and needs its holdout', () => {
  const criteria = { minimumPositiveCases: 1, minimumPositiveAxes: 1, minimumBenignCases: 1, minimumBenignAxes: 1, minimumTwinPairs: 1, exactSpanMisses: 0, leakedSpans: 0, overbroadSpans: 0, collateralBytes: 0,
    redactFalseAlarms: 0, blockFalseAlarms: 0, unexpectedPositiveActions: 0, unresolvedActionCases: 0, unresolvedCriticalFailures: 0, requirePublicConformance: true, requireProtectedHoldout: false };
  const bounded = { trigger: 't', candidate: 'c', exactSpan: 'e', exclusions: ['x'], blindSpots: ['b'] };
  const policyCases = [
    unit('c-p1', 'synthetic-token', { kind: 'policy', tier: 'T3', actual: [{ start: 0, end: 8, family: 'synthetic-token', action: 'redact' }] }),
    control('c-t1', 'synthetic-token', { tier: 'T3', twin_of: 'c-p1', twin_mutation_kind: 'context' }),
    control('c-b1', 'synthetic-token', { tier: 'T3' }),
  ];
  const metadata = { 'c-p1': { group: 'g', expectedAction: 'redact', policyConformance: true }, 'c-b1': { group: 'g', contextAxis: 'ctx' } };
  const p = product({ contracts: { 'synthetic-token': { tier: 'T3' } }, policyCriteria: criteria, policyContracts: { 'synthetic-token': bounded } });
  const run = (extra = {}, prod = p) => buildQualificationView({ registry, engine, product: prod,
    artifacts: inputs({ methods: true, c: policyCases, ...extra }).map(i => (i.population === 'pop-c' ? { ...i, caseMetadata: metadata } : i)) });
  const passing = family(run());
  assert.deepEqual(passing.evidence.policyQualification.failedGates, []);
  assert.equal(passing.status.value, 'stable');
  assert.equal(passing.status.qualificationProfile, 'policy-qualified');
  // A wrong action in the policy-route population fails conformance there and nowhere else.
  const wrong = family(run({ c: [{ ...policyCases[0], actual: [{ start: 0, end: 8, family: 'synthetic-token', action: 'warn' }] }, ...policyCases.slice(1)] }));
  assert.equal(wrong.status.value, 'provisional');
  assert.ok(wrong.evidence.policyQualification.failedGates.some(g => g.code === 'public-conformance'));
  // The protected-holdout gate fails closed without a receipt when the criteria require one.
  const required = family(run({}, { ...p, policyCriteria: { ...criteria, requireProtectedHoldout: true } }));
  assert.ok(required.evidence.policyQualification.failedGates.some(g => g.code === 'protected-holdout'));
  assert.equal(required.status.value, 'provisional');
});

test('the methods run is a second artifact of the floors population, attributed to a family through the seed case', () => {
  const clean = family(build({ methods: true }));
  assert.equal(clean.status.value, 'stable');
  assert.deepEqual(clean.status.methodsNotRun, []);
  // A failed assertion on a variant of one of the family's seeds is a critical failure of that family, in its own method.
  const failing = family(build({ methods: methodsRun({ failures: [['a-p1', 'metamorphic']] }) }));
  assert.equal(failing.evidence.metamorphicCriticalFailures, 1);
  assert.equal(failing.status.value, 'provisional');
  assert.ok(failing.status.reasons.some(r => r.startsWith('metamorphic.criticalFailures')));
  const mutated = family(build({ methods: methodsRun({ failures: [['a-p2', 'mutation']] }) }));
  assert.equal(mutated.evidence.mutationUnresolvedCritical, 1);
  // A seed that is not one of the family's cases is not attributed to it.
  assert.equal(family(build({ methods: methodsRun({ failures: [['other-seed', 'metamorphic']] }) })).evidence.metamorphicCriticalFailures, 0);
  // An unresolved review occurrence blocks stable; a ledger decision on its canonical id settles it.
  const queued = family(build({ methods: methodsRun({ queue: ['a-b1'], queueIds: [DIGEST(900)] }) }));
  assert.equal(queued.evidence.differentialUnresolvedContractDisagreements, 1);
  assert.equal(queued.status.value, 'provisional');
  const settled = family(build({ methods: methodsRun({ queue: ['a-b1'], queueIds: [DIGEST(900)] }) }, product({ ledger: { schemaVersion: 2, entries: { [DIGEST(900)]: { status: 'resolved' } } } })));
  assert.equal(settled.evidence.differentialUnresolvedContractDisagreements, 0);
  assert.equal(settled.status.value, 'stable');
  // The methods artifact is a second identity of the same population, in the view.
  const view = build({ methods: true });
  const a = view.populations.find(p => p.population === 'pop-a');
  assert.deepEqual(a.methodsArtifact.methods, [...METHODS].sort());
  assert.deepEqual(a.artifact.methods, []);
  assert.ok(!('methodsArtifact' in view.populations.find(p => p.population === 'pop-b')));
});

test('a method that the methods run does not list is unmeasured, and a bad methods run stops the view', () => {
  const partial = family(build({ methods: methodsRun({ methods: ['metamorphic', 'mutation'] }) }));
  assert.deepEqual(partial.status.methodsNotRun, ['differential']);
  assert.equal(partial.status.value, 'provisional');
  assert.throws(() => build({ methods: methodsRun({ methods: [] }) }), /lists no method/);
  assert.throws(() => build({ aOptions: { methods: METHODS } }), /lists methods .*the floors come from a plain run/);
  const other = artifact('pop-a', [], { methods: METHODS, mutate: d => { d.manifest.scanners[0].configuration_hash = DIGEST(77); } });
  assert.throws(() => build({ methods: other }), /scanner redact-secret differs from the plain run/);
  assert.throws(() => build({ methods: artifact('pop-a', [], { methods: METHODS, runClass: 'exploratory' }) }), /Methods run .* official artifacts only/);
  assert.throws(() => buildQualificationView({ registry, engine, product: product(), artifacts: inputs().map(i => (i.population === 'pop-b' ? { ...i, methodsBytes: methodsRun() } : i)) }), /not the floors population/);
});

test('the product axis overlay names the axis of a counted case, changes no count, and is bound to its snapshot', () => {
  // Axis coverage is the floors population's alone here (the union over populations has its own tests below), so the overlay's effect is isolated.
  const floorsOnly = (overrides = {}) => { const p = product(overrides); p.policy.axisCoverage = { populations: ['pop-a'], rationale: 'synthetic' }; return p; };
  const base = family(build({ methods: true }, floorsOnly()));
  const overlay = {
    schemaVersion: 1, id: 'credential-public-axis-overlay-v1', population: 'pop-a', owner: 'redact-secret-benchmarks', note: 'synthetic',
    snapshot: { corpusDigest: registry[0].evidence.corpusDigest, cases: 5 }, derivation: { join: 'j', contextAxis: 'c', controlAxis: 'c', detectors: 'd', joinedCases: 5, unjoinedCases: 0 },
    contexts: { 'a-p1': 'cat-x/ctx-one', 'a-p2': 'cat-y/ctx-one' }, detectors: {},
    controls: { 'a-b1': 'placeholder', 'a-b2': null },
  };
  const view = build({ methods: true }, floorsOnly({ axisOverlay: overlay }));
  const f = family(view);
  // Both positives name one fixture group, so the profile cell collapses from two (the snapshot groups) to one, while `positiveAxes` counts the
  // legacy `<category>/<group>` axes (two categories); the null control counts toward no axis.
  assert.deepEqual(f.fixtureProfile.cells.positiveContextAxisIds, ['ctx-one']);
  assert.equal(f.evidence.positiveAxes, 2);
  assert.deepEqual(f.evidence.benignAxisIds, ['placeholder']);
  assert.equal(base.fixtureProfile.cells.positiveContextAxes, 2);
  // It names axes only: every measured count is unchanged.
  for (const key of ['positiveCases', 'totalFixtures', 'benignCases', 'twinPairs', 'twinFailures', 'benignFalseAlarms']) assert.equal(f.evidence[key], base.evidence[key], key);
  assert.deepEqual(view.policy.axisOverlay, { id: overlay.id, population: 'pop-a', corpusDigest: overlay.snapshot.corpusDigest, contexts: 2, controls: 2, detectors: 0 });
  assert.deepEqual(validateQualificationView(view), []);
  // A case the overlay does not name keeps the snapshot's own vocabulary.
  const partial = family(build({ methods: true }, floorsOnly({ axisOverlay: { ...overlay, contexts: { "a-p1": "cat-x/ctx-one" }, controls: {} } })));
  assert.deepEqual(partial.fixtureProfile.cells.positiveContextAxisIds, ['axis-2', 'ctx-one']);
  assert.deepEqual(partial.evidence.benignAxisIds, ['axis-a', 'axis-b']);
  // It is bound to one snapshot, and to the floors population.
  assert.throws(() => build({ methods: true }, product({ axisOverlay: { ...overlay, snapshot: { ...overlay.snapshot, corpusDigest: DIGEST(999) } } })), /axis overlay is derived from corpus/);
  assert.throws(() => build({ methods: true }, product({ axisOverlay: { ...overlay, population: 'pop-b' } })), /axis overlay is for pop-b/);
});

// -- #638: the review-ledger re-key, the differential peer scope and the attribution of a case the snapshot attributes to no detector ----------------

const rekey = occurrences => ({ schemaVersion: 1, id: 'credential-public-review-ledger-rekey-v1', population: 'pop-a', owner: 'redact-secret-benchmarks', note: 'synthetic', snapshot: { corpusDigest: DIGEST(1), cases: 5 }, methodsRun: { run: 'r', semanticDigest: DIGEST(2) }, derivation: {}, occurrences });
const LEGACY = 'a'.repeat(64);

test('a legacy decision settles a canonical occurrence only through the mapping, and an open decision stays open', () => {
  const run = methodsRun({ queue: ['a-b1'], queueIds: [DIGEST(900)] });
  const ledger = status => ({ schemaVersion: 2, entries: { [LEGACY]: { status } } });
  // No mapping: the canonical id is in no ledger row, so it is unresolved.
  assert.equal(family(build({ methods: run }, product({ ledger: ledger('resolved') }))).evidence.differentialUnresolvedContractDisagreements, 1);
  // Mapped to a resolved or not-assertable decision: settled, with the legacy ledger as the only source of the decision.
  for (const settled of ['resolved', 'not-assertable']) assert.equal(family(build({ methods: run }, product({ ledger: ledger(settled), ledgerRekey: rekey({ [DIGEST(900)]: LEGACY }) }))).evidence.differentialUnresolvedContractDisagreements, 0, settled);
  // The mapping carries no decision: an open legacy decision is still unresolved, and a canonical id the mapping does not name is too.
  assert.equal(family(build({ methods: run }, product({ ledger: ledger('open'), ledgerRekey: rekey({ [DIGEST(900)]: LEGACY }) }))).evidence.differentialUnresolvedContractDisagreements, 1);
  assert.equal(family(build({ methods: run }, product({ ledger: ledger('resolved'), ledgerRekey: rekey({ [DIGEST(901)]: LEGACY }) }))).evidence.differentialUnresolvedContractDisagreements, 1);
  const view = build({ methods: run }, product({ ledger: ledger('resolved'), ledgerRekey: rekey({ [DIGEST(900)]: LEGACY }) }));
  assert.deepEqual(view.policy.ledgerRekey, { id: 'credential-public-review-ledger-rekey-v1', population: 'pop-a', corpusDigest: DIGEST(1), occurrences: 1 });
  assert.deepEqual(validateQualificationView(view), []);
});

test('the differential gate reads the policy peers; other peers are measured and reported, never gate-bearing', () => {
  const queue = ['a-b1', 'a-b2'];
  const run = methodsRun({ queue, queueIds: [DIGEST(900), DIGEST(901)], queuePeers: ['peer-one', 'peer-two'] });
  const f = family(build({ methods: run }));
  // peer-two is not a gate peer: its unresolved occurrence is listed and does not count.
  assert.equal(f.evidence.differentialUnresolvedContractDisagreements, 1);
  assert.deepEqual(f.differential.gatePeers, ['peer-one']);
  assert.deepEqual(f.differential.peers, [
    { peer: 'peer-one', gateBearing: true, unmeasuredVariants: 0, occurrences: 1, settled: 0, unresolved: 1 },
    { peer: 'peer-two', gateBearing: false, unmeasuredVariants: 0, occurrences: 1, settled: 0, unresolved: 1 },
  ]);
  // Only the non-gate peer unresolved: the family can be stable.
  const onlyOther = family(build({ methods: methodsRun({ queue: ['a-b1'], queueIds: [DIGEST(900)], queuePeers: ['peer-two'] }) }));
  assert.equal(onlyOther.evidence.differentialUnresolvedContractDisagreements, 0);
  assert.equal(onlyOther.status.value, 'stable');
  assert.equal(onlyOther.differential.peers[0].unresolved, 1);
  // Widening the policy peers makes that occurrence gate-bearing; the policy is the only thing that changed.
  const wide = product(); wide.policy.methods.differential.peers = ['peer-one', 'peer-two'];
  assert.equal(family(build({ methods: methodsRun({ queue: ['a-b1'], queueIds: [DIGEST(900)], queuePeers: ['peer-two'] }) }, wide)).status.value, 'provisional');
  // Without a differential method there is nothing to report.
  assert.equal(family(build({ methods: methodsRun({ methods: ['metamorphic', 'mutation'] }) })).differential, null);
  // The policy must name its peers, never the reference.
  const bad = product(); bad.policy.methods.differential.peers = [];
  assert.throws(() => build({ methods: true }, bad), /methods\.differential\.peers/);
  const self = product(); self.policy.methods.differential.peers = ['redact-secret'];
  assert.throws(() => build({ methods: true }, self), /never the reference scanner/);
});

test('a case the snapshot attributes to no detector is attributed by the policy fallback, in order, and counted by source', () => {
  const ids = new Set(['synthetic-token', 'other-token']);
  const map = new Map([['prov:fam', ['synthetic-token']]]);
  const nameless = (id, extra = {}) => ({ case_id: id, family: undefined, targets: undefined, ...extra });
  const parent = nameless('parent', { family: 'prov:fam' });
  const byId = new Map([['parent', parent]]);
  const ctx = (fallback, overlayDetectors) => ({ detectorIds: ids, taxonomyDetectors: map, overlayDetectors, fallback, byId });
  // The snapshot's own attribution wins, and no fallback runs.
  assert.deepEqual(attributeCase(parent, ctx(['overlay-detectors', 'twin-parent'], { parent: ['other-token'] })), { detectors: ['synthetic-token'], source: 'snapshot' });
  // Nothing named: the overlay's legacy targets, filtered to product detectors, then the twin parent.
  assert.deepEqual(attributeCase(nameless('x'), ctx(['overlay-detectors', 'twin-parent'], { x: ['other-token', 'not-a-detector'] })), { detectors: ['other-token'], source: 'overlay-detectors' });
  assert.deepEqual(attributeCase(nameless('t', { twin_of: 'parent' }), ctx(['overlay-detectors', 'twin-parent'], {})), { detectors: ['synthetic-token'], source: 'twin-parent' });
  assert.deepEqual(attributeCase(nameless('t', { twin_of: 'parent' }), ctx(['overlay-detectors', 'twin-parent'], { t: ['other-token'] })), { detectors: ['other-token'], source: 'overlay-detectors' });
  // The policy decides which steps run; a case no step attributes stays unattributed.
  assert.deepEqual(attributeCase(nameless('t', { twin_of: 'parent' }), ctx([], {})), { detectors: [], source: 'none' });
  assert.deepEqual(attributeCase(nameless('t', { twin_of: 'parent' }), ctx(['overlay-detectors'], {})), { detectors: [], source: 'none' });
  assert.deepEqual(attributeCase(nameless('t', { twin_of: 'missing' }), ctx(['twin-parent'], {})), { detectors: [], source: 'none' });
  // A twin's parent is attributed by the same fallback (a twin of a twin does not chain through twin-parent).
  const chained = new Map([['p2', nameless('p2', { twin_of: 'p1' })], ['p1', nameless('p1', { family: 'prov:fam' })]]);
  assert.deepEqual(attributeCase(nameless('t', { twin_of: 'p2' }), { ...ctx(['twin-parent'], {}), byId: chained }), { detectors: [], source: 'none' });
});

test('a case attributed through the overlay counts in its family, is counted by source, and is not unmapped', () => {
  const overlay = { schemaVersion: 1, id: 'credential-public-axis-overlay-v1', population: 'pop-a', owner: 'redact-secret-benchmarks', note: 'synthetic',
    snapshot: { corpusDigest: registry[0].evidence.corpusDigest, cases: 6 }, derivation: { join: 'j', contextAxis: 'c', controlAxis: 'c', detectors: 'd', joinedCases: 6, unjoinedCases: 0 },
    contexts: {}, controls: {}, detectors: { 'a-nameless': ['synthetic-token'] } };
  const cases = [...familyCases('a', 'prov:fam'), control('a-nameless', undefined, { group: 'axis-c' })];
  const without = build({ a: cases, methods: true });
  const withOverlay = build({ a: cases, methods: true }, product({ axisOverlay: overlay }));
  assert.equal(family(withOverlay).evidence.benignCases, family(without).evidence.benignCases + 1);
  assert.deepEqual(family(withOverlay).attribution, { snapshot: 5, 'overlay-detectors': 1, 'twin-parent': 0 });
  assert.deepEqual(family(without).attribution, { snapshot: 5, 'overlay-detectors': 0, 'twin-parent': 0 });
  // It is attributed to the floors population only: the same id in another population is not.
  assert.equal(family(withOverlay).populations.find(p => p.population === 'pop-b').scanners[0].counts.cases, 5);
  assert.deepEqual(validateQualificationView(withOverlay), []);
});

test('reported finding projection allowlists recorded actions and never exports family as a rule (#595)', () => {
  const actions = ['redact', 'warn', 'block', 'allow', null, 'unknown'];
  const actual = actions.map((action, i) => ({ start: i * 8, end: i * 8 + 8, family: 'prov:fam', action }));
  const view = build({ a: [unit('a-recorded-actions', 'prov:fam', { actual })], methods: true });
  const result = view.populations.find(p => p.population === 'pop-a').cases[0].results.find(r => r.scanner === 'redact-secret');
  assert.deepEqual(result.reported, actual.map(({ start, end, action }) => ({ start, end, ...(['redact', 'warn', 'block', 'allow'].includes(action) ? { action } : {}) })));
  assert.equal(result.reported.some(f => 'family' in f || 'rule' in f || 'value' in f), false);
  assert.deepEqual(validateQualificationView(view), []);
  const historical = structuredClone(view);
  for (const p of historical.populations) for (const c of p.cases) for (const r of c.results) delete r.reported;
  assert.deepEqual(validateQualificationView(historical), [], 'old views remain compatible');
});

test('case rows list every case of each population with each scanner as the artifact recorded it, and move no count, status or revision (#606)', () => {
  const pending = unit('a-pending', 'prov:fam', { tier: 'T0', measurement: { type: 'pending' } });
  const unmeasured = unit('a-unmeasured', 'prov:fam', { measurement: { type: 'not-measured', status: 'timeout' } });
  const nameless = unit('a-nameless', undefined, { family: undefined, evidence_class: 'synthetic-label' });
  const cases = [...familyCases('a', 'prov:fam'), pending, unmeasured, nameless];
  const view = build({ a: cases, methods: true });
  const withoutCases = structuredClone(view);
  for (const p of withoutCases.populations) delete p.cases;
  // Every case of the population, once, in id order, per population.
  for (const p of view.populations) {
    const listed = p.cases.map(c => c.id);
    assert.deepEqual(listed, [...listed].sort());
    assert.equal(p.cases.length, p.artifact.caseCount);
    assert.ok(p.cases.every(c => c.results.map(r => r.scanner).join() === view.scanners.join()));
  }
  const rows = new Map(view.populations.find(p => p.population === 'pop-a').cases.map(c => [c.id, c]));
  const result = (id, scanner = 'redact-secret') => rows.get(id).results.find(r => r.scanner === scanner);
  // A positive carries outcomes and bytes, a control its flags, and neither carries the other's fields.
  assert.deepEqual(result('a-p1'), { scanner: 'redact-secret', measurement: 'positive', observed: 1, reported: [{ start: 0, end: 8 }], outcomes: ['EXACT'], leakedBytes: 0, collateralBytes: 0 });
  assert.deepEqual(result('a-t1'), { scanner: 'redact-secret', measurement: 'control', observed: 0, reported: [], flagged: false, findings: 0, coDetected: false });
  assert.equal(rows.get('a-t1').twinOf, 'a-p1');
  assert.equal(rows.get('a-t1').twinMutationKind, 'length');
  // Pending and not measured are their own measurements with no outcome or flag, never zero; the status is the artifact's.
  assert.deepEqual(result('a-pending'), { scanner: 'redact-secret', measurement: 'pending', observed: 1, reported: [{ start: 0, end: 8 }] });
  assert.deepEqual(result('a-unmeasured'), { scanner: 'redact-secret', measurement: 'not-measured', observed: 1, reported: [{ start: 0, end: 8 }], status: 'timeout' });
  // The evidence class is the artifact's label and the attribution says how a case reached its family; a case no step attributes stays listed, with no detector.
  assert.equal(rows.get('a-nameless').evidenceClass, 'synthetic-label');
  assert.deepEqual(rows.get('a-nameless').detectors, []);
  assert.equal(rows.get('a-nameless').attribution, 'none');
  assert.deepEqual(rows.get('a-p1').detectors, ['synthetic-token']);
  assert.equal(rows.get('a-p1').attribution, 'snapshot');
  // Additive: the view without the rows is what the adapter wrote before them, and the revision is a product input's, not a case's.
  assert.equal(build({ a: cases, methods: true }).policy.revision, view.policy.revision);
  assert.deepEqual(withoutCases.distribution, view.distribution);
  assert.deepEqual(validateQualificationView(view), []);
});

// -- axis coverage (#602): a floor is judged on the union of axis labels, never on summed counts --------------------------------------------------------

const withAxisFloor = (n, policyPatch = {}) => {
  const p = product();
  p.criteria = lowered();
  p.criteria.stable.documented.minimumControlAxes.value = n; p.criteria.stable.benign.minimumAxes.value = n;
  p.policy = { ...p.policy, ...policyPatch };
  return p;
};
/** Two benign axes in pop-a (`axis-a`, `axis-b`) and a third (`axis-c`) only in pop-b. */
const oneAxisMore = () => [...familyCases('b', 'synthetic-token'), control('b-extra', 'synthetic-token', { group: 'axis-c' })];

test('an axis floor is judged on the union of axis labels across the policy populations; counts are never summed', () => {
  const union = family(build({ b: oneAxisMore(), methods: true }, withAxisFloor(3)));
  assert.equal(union.status.value, 'stable');
  assert.deepEqual(union.evidence.benignAxisIds, ['axis-a', 'axis-b', 'axis-c']);
  assert.equal(union.evidence.controlAxes, 3);
  // The case counts are the floors population's own: pop-b's extra control adds an axis and no case.
  const floors = union.populations.find(p => p.population === 'pop-a').scanners.find(s => s.scanner === 'redact-secret').counts;
  assert.equal(union.evidence.benignCases, floors.benign.cases);
  assert.equal(union.evidence.totalFixtures, floors.cases);
  // Which population supplied each axis is recorded, and a label two populations carry names both.
  const supplied = Object.fromEntries(union.axisCoverage.control.map(a => [a.axis, a.populations]));
  assert.deepEqual(supplied, { 'axis-a': ['pop-a', 'pop-b'], 'axis-b': ['pop-a', 'pop-b'], 'axis-c': ['pop-b'] });
  assert.deepEqual(union.fixtureProfile.cells.controlAxisIds, ['axis-a', 'axis-b', 'axis-c']);
});

test('a population the policy does not name supplies no axis', () => {
  const alone = family(build({ b: oneAxisMore(), methods: true }, withAxisFloor(3, { axisCoverage: { populations: ['pop-a'], rationale: 'synthetic' } })));
  assert.equal(alone.status.value, 'provisional');
  assert.equal(alone.evidence.controlAxes, 2);
  assert.ok(alone.axisCoverage.control.every(a => a.populations.join() === 'pop-a'));
  assert.ok(alone.status.reasons.some(r => /minimumControlAxes|minimumAxes/.test(r)));
});

test('a product population names a positive context by its category and fixture group, or by the category it copies', () => {
  const b = [unit('b-p1', 'synthetic-token', { group: 'cat-b' }), unit('b-p2', 'synthetic-token', { group: 'cat-b' })];
  const input = inputs({ b, methods: true });
  input.find(i => i.population === 'pop-b').caseMetadata = { 'b-p1': { group: 'env' }, 'b-p2': { group: 'env', axisCategory: 'orig-cat' } };
  const f = family(buildQualificationView({ registry, engine, artifacts: input, product: product() }));
  // Cell axes are the fixture group, so `env` is one axis for both; the legacy `<category>/<group>` count sees the copy under its original's category.
  assert.ok(f.fixtureProfile.cells.positiveContextAxisIds.includes('env'));
  assert.deepEqual(f.axisCoverage.positiveContext.find(a => a.axis === 'env').populations, ['pop-b']);
  const without = family(build({ b: [unit('b-p1', 'synthetic-token', { group: 'cat-b' })], methods: true }));
  assert.equal(f.evidence.positiveAxes, without.evidence.positiveAxes + 1); // `cat-b/env` and `orig-cat/env` against one `cat-b` label
});

test('the policy must name axis coverage that includes the floors population', () => {
  assert.throws(() => build({ methods: true }, withAxisFloor(1, { axisCoverage: { populations: ['pop-b'], rationale: 'x' } })), /axisCoverage\.populations/);
  assert.throws(() => build({ methods: true }, withAxisFloor(1, { axisCoverage: { populations: ['pop-a', 'pop-zzz'], rationale: 'x' } })), /axisCoverage\.populations/);
});

// -- twin scope (#602): a public twin the snapshot gives no family is gated through the project case that carries it with its parent's family ------------

/** A twin of `a-p1` with no family of its own, which the engine could not scope and read as flagged. */
const unscopedTwin = (id, extra = {}) => control(id, undefined, { twin_of: 'a-p1', twin_mutation_kind: 'prefix', measurement: { type: 'control', flagged: true, findings: 1, co_detected: false }, ...extra });
const scopeMap = (twins, patch = {}) => ({ schemaVersion: 1, id: 'synthetic-map', population: 'pop-a', scopedBy: 'pop-b', owner: 'redact-secret-benchmarks', snapshot: { corpusDigest: DIGEST(1), cases: 0 }, twins, ...patch });
const projectTwin = (id, flagged = false) => control(id, 'synthetic-token', { twin_of: 'b-p1', twin_mutation_kind: 'prefix', measurement: { type: 'control', flagged, findings: 1, co_detected: !flagged } });

test('a family-less public twin the map names is gated through its project case: the public verdict is reported, not gate-bearing', () => {
  const a = [...familyCases('a', 'prov:fam'), unscopedTwin('a-tx')];
  const b = [...familyCases('b', 'synthetic-token'), projectTwin('b-tx')];
  const without = family(build({ a, b, methods: true }));
  assert.equal(without.evidence.twinFailures, 1);
  assert.equal(without.status.value, 'provisional');
  const mapped = family(build({ a, b, methods: true }, product({ twinScope: scopeMap({ 'a-tx': 'b-tx' }) })));
  assert.equal(mapped.evidence.twinFailures, 0);
  assert.equal(mapped.status.value, 'stable');
  const [publicGate, projectGate] = mapped.gates;
  assert.equal(publicGate.twinFailures, 0);
  assert.equal(publicGate.twinPairsScopedElsewhere, 1);
  assert.equal(publicGate.twinFailuresScopedElsewhere, 1);
  assert.equal(projectGate.twinPairs, 2); // its own pairs, counted in its own denominator and never added to the public ones
  assert.equal(mapped.evidence.twinPairs, publicGate.twinPairs); // the floor still counts the public pair as published
});

test('the project case decides: a project twin that fails still blocks the family, and an unmapped family-less twin keeps counting', () => {
  const a = [...familyCases('a', 'prov:fam'), unscopedTwin('a-tx'), unscopedTwin('a-ty')];
  const b = [...familyCases('b', 'synthetic-token'), projectTwin('b-tx', true)];
  const failing = family(build({ a, b, methods: true }, product({ twinScope: scopeMap({ 'a-tx': 'b-tx' }) })));
  assert.deepEqual(failing.gates.map(g => g.twinFailures), [1, 1]); // a-ty still fails in pop-a; b-tx fails in pop-b
  const onlyUnmapped = family(build({ a, b: [...familyCases('b', 'synthetic-token'), projectTwin('b-tx')], methods: true }, product({ twinScope: scopeMap({ 'a-tx': 'b-tx' }) })));
  assert.deepEqual(onlyUnmapped.gates.map(g => g.twinFailures), [1, 0]);
  assert.equal(onlyUnmapped.status.value, 'provisional');
});

test('a stale twin-scope map is refused: another corpus, a public twin that has a family, a project case that has none or is absent', () => {
  const a = [...familyCases('a', 'prov:fam'), unscopedTwin('a-tx')], b = [...familyCases('b', 'synthetic-token'), projectTwin('b-tx')];
  const run = twins => build({ a, b, methods: true }, product({ twinScope: scopeMap(twins) }));
  assert.throws(() => build({ a, b, methods: true }, product({ twinScope: scopeMap({ 'a-tx': 'b-tx' }, { snapshot: { corpusDigest: DIGEST(99), cases: 0 } }) })), /derived from corpus/);
  assert.throws(() => run({ 'a-t1': 'b-tx' }), /not a pop-a twin without a family/);
  assert.throws(() => run({ 'a-tx': 'b-nowhere' }), /not a pop-b twin with a family/);
  assert.throws(() => run({ 'a-tx': 'b-p1' }), /not a pop-b twin with a family/);
});

test('the policy must name a gate-bearing population other than the floors population to scope twins', () => {
  for (const scopedBy of ['pop-a', 'pop-c', 'pop-zzz']) assert.throws(() => build({ methods: true }, withAxisFloor(1, { twinScope: { scopedBy, rationale: 'x' } })), /twinScope\.scopedBy/);
});

test('the support matrix is derived from the view: one entry per taxonomy family, status carried from the deciding detector, undetected families keep their reason', () => {
  const p = product({
    taxonomy: { schemaVersion: 1, sourceNote: '', providers: [], families: [
      { id: 'prov:fam', provider: 'prov', name: 'Fam', detectors: ['synthetic-token'] },
      { id: 'prov:other', provider: 'prov', name: 'Other', detectors: ['synthetic-token'] },
      { id: 'prov:none', provider: 'prov', name: 'None', detectors: [], note: 'no format to detect' },
      { id: 'prov:blocked', provider: null, name: 'Blocked', detectors: [], sources: ['https://example.invalid/doc'], supportStatus: 'pending' },
    ] },
    contracts: { 'synthetic-token': { tier: 'T1', providerSource: { url: 'https://example.invalid/doc' }, corroboration: [{ tool: 'b-tool' }, { tool: 'a-tool' }, { tool: 'a-tool' }] } },
  });
  const view = build({ methods: true }, p);
  assert.deepEqual(validateQualificationView(JSON.parse(serializeView(view))), []);
  const matrix = view.supportMatrix, f = family(view);
  assert.deepEqual(matrix.families.map(e => e.family), ['prov:blocked', 'prov:fam', 'prov:none', 'prov:other']);
  for (const id of ['prov:fam', 'prov:other']) {
    const e = matrix.families.find(x => x.family === id);
    assert.equal(e.status, f.status.value);
    assert.equal(e.qualificationProfile, f.status.qualificationProfile);
    assert.deepEqual(e.detectors, ['synthetic-token']);
    assert.deepEqual(e.corroboratingScanners, ['a-tool', 'b-tool']);
    assert.equal(e.fixtureProfile.totalFixtures, f.evidence.totalFixtures);
    assert.equal(e.twinCoverage.pairs, f.evidence.twinPairs);
    assert.deepEqual(e.profileCoverage, f.fixtureProfile);
  }
  const none = matrix.families.find(e => e.family === 'prov:none'), blocked = matrix.families.find(e => e.family === 'prov:blocked');
  assert.deepEqual([none.status, none.reason, none.detectors, none.fixtureProfile], ['unsupported', 'no format to detect', [], null]);
  assert.deepEqual([blocked.status, blocked.reason], ['pending', 'Provider source: https://example.invalid/doc.']);
  assert.equal(matrix.distribution[f.status.value] + matrix.distribution.unsupported + matrix.distribution.pending, matrix.families.length);
  assert.equal(matrix.stableDistribution[f.status.qualificationProfile], 2);
});

test('the support matrix shows an unmeasured method as null, never as zero, and refuses a family it cannot place', () => {
  const view = build();
  const [entry] = view.supportMatrix.families;
  assert.equal(entry.status, 'provisional');
  assert.deepEqual(entry.unresolvedCriticalItems, { metamorphic: null, mutation: null, differential: null });
  assert.deepEqual(build({ methods: true }).supportMatrix.families[0].unresolvedCriticalItems, { metamorphic: 0, mutation: 0, differential: 0 });
  const orphan = product({ taxonomy: { schemaVersion: 1, sourceNote: '', providers: [], families: [{ id: 'prov:fam', provider: 'prov', name: 'Fam', detectors: ['synthetic-token'] }, { id: 'prov:x', provider: 'prov', name: 'X', detectors: ['missing-detector'] }] } });
  assert.throws(() => build({ methods: true }, orphan), /holds no scored family/);
  const bare = product({ taxonomy: { schemaVersion: 1, sourceNote: '', providers: [], families: [{ id: 'prov:fam', provider: 'prov', name: 'Fam', detectors: ['synthetic-token'] }, { id: 'prov:y', provider: 'prov', name: 'Y', detectors: [] }] } });
  assert.throws(() => build({ methods: true }, bare), /no detector and no note or sources/);
});

test('unmeasured cases are counted per scanner and reason, absent means zero, and never become detections', async () => {
  const { unmeasuredByScanner } = await import('../benchmarks/qualification/run-artifact.ts');
  const rows = unmeasuredByScanner({ scanners: [
    { scanner: 'b', status: 'complete', cases: [] },
    { scanner: 'a', status: 'complete', cases: [], unmeasured_cases: [{ case_id: 'x', reason: 'r1' }, { case_id: 'y', reason: 'r1' }, { case_id: 'z', reason: 'r2' }] },
  ] });
  assert.deepEqual(rows, [{ scanner: 'a', unmeasured: 3, reasons: { r1: 2, r2: 1 } }, { scanner: 'b', unmeasured: 0, reasons: {} }]);
});

test('a changed corpus is refused with the accepted population\'s overlay and twin-scope map, and accepted with the ones regenerated for it (#699)', () => {
  // The candidate corpus: the floors artifact ran another snapshot than the accepted overlays were derived from.
  const candidate = DIGEST(777);
  const candidateRegistry = registry.map(r => (r.id === 'pop-a' ? { ...r, evidence: { ...r.evidence, corpusDigest: candidate } } : r));
  const candidateInputs = () => inputs({ methods: true }).map(i => (i.population === 'pop-a' ? { ...i, bytes: artifact('pop-a', familyCases('a', 'prov:fam'), { mutate: doc => { doc.manifest.evidence.corpus_digest = candidate; } }),
    methodsBytes: artifact('pop-a', familyCases('a', 'prov:fam').map(c => ({ ...c, case_id: `${c.case_id}--differential--canonical` })), { methods: METHODS, mutate: doc => { doc.manifest.evidence.corpus_digest = candidate; } }) } : i));
  const overlayFor = corpusDigest => ({ schemaVersion: 1, id: 'credential-public-axis-overlay-v1', population: 'pop-a', owner: 'redact-secret-benchmarks', note: 'synthetic',
    snapshot: { corpusDigest, cases: 5 }, derivation: { join: 'j', contextAxis: 'c', controlAxis: 'c', detectors: 'd', joinedCases: 5, unjoinedCases: 0 }, contexts: { 'a-p1': 'cat-x/ctx-one' }, detectors: {}, controls: {} });
  const twinsFor = corpusDigest => ({ schemaVersion: 1, id: 'credential-public-twin-scope-map-v1', population: 'pop-a', scopedBy: 'pop-b', owner: 'redact-secret-benchmarks', note: 'synthetic', snapshot: { corpusDigest, cases: 5 }, derivation: {}, twins: {} });
  const view = p => buildQualificationView({ registry: candidateRegistry, engine, artifacts: candidateInputs(), product: p });
  const accepted = registry[0].evidence.corpusDigest;
  // Stale: the accepted population's overlay, then its twin-scope map, each refused with the command that regenerates it, before any view exists.
  assert.throws(() => view(product({ axisOverlay: overlayFor(accepted) })), /axis overlay is derived from corpus .* regenerate it \(npm run qualification:axis-overlay\)/);
  assert.throws(() => view(product({ axisOverlay: overlayFor(candidate), twinScope: twinsFor(accepted) })), /twin-scope map is derived from corpus .* regenerate it \(npm run qualification:twin-scope\)/);
  // Regenerated for the candidate corpus: accepted, and the view names the candidate corpus (never the accepted one) in every input it was built from.
  const built = view(product({ axisOverlay: overlayFor(candidate), twinScope: twinsFor(candidate) }));
  assert.deepEqual(validateQualificationView(built), []);
  assert.equal(built.policy.axisOverlay.corpusDigest, candidate);
  assert.equal(built.policy.twinScope.corpusDigest, candidate);
});

test('the view carries each scanner\'s scope state next to its counts: an artifact without engine accounting is not accounted, never zero (#724)', () => {
  const view = build({ methods: true });
  assert.deepEqual(validateQualificationView(view), []);
  for (const population of view.populations) {
    assert.deepEqual(population.scope.map(s => s.scanner), ['peer-one', 'redact-secret']);
    for (const entry of population.scope) {
      assert.equal(entry.state, 'not-accounted');
      assert.equal(entry.dispositions, null, 'no counts are invented for an artifact that carries none');
      assert.equal(entry.profile.configurationHash, DIGEST(8));
      assert.equal(entry.engineVersion, engine.version);
    }
    assert.deepEqual(population.profileEffects, [], 'no declared profile, no comparison');
  }
  assert.ok(view.populations.find(p => p.population === 'pop-a').methodsScope.every(s => s.state === 'not-accounted'), 'the methods artifact is accounted apart from the plain one');
  // Scope never feeds a count: the product's family counts equal those of a build that ignores scope.
  const before = structuredClone(view.families);
  const stripped = build({ methods: true }); for (const p of stripped.populations) { delete p.scope; delete p.methodsScope; delete p.profileEffects; }
  assert.deepEqual(stripped.families, before);
});

test('a declared profile present in a plain artifact is compared with its default scanner without changing either (#724)', () => {
  const profiles = { 'peer-profile': 'peer-one' };
  const withProfile = ['pop-a', 'pop-b', 'pop-c'].map(population => ({
    population,
    bytes: artifact(population, population === 'pop-c' ? [] : familyCases(population === 'pop-a' ? 'a' : 'b', population === 'pop-a' ? 'prov:fam' : 'synthetic-token'), {
      mutate: doc => {
        const base = doc.scanners.find(s => s.scanner === 'peer-one');
        doc.scanners.push({ ...structuredClone(base), scanner: 'peer-profile' });
        doc.manifest.scanners.push({ ...structuredClone(doc.manifest.scanners.find(s => s.id === 'peer-one')), id: 'peer-profile', configuration_hash: DIGEST(9) });
      },
    }),
    ...(population === 'pop-c' ? { caseMetadata: {} } : {}),
  }));
  const view = buildQualificationView({ registry, engine, artifacts: withProfile, product: product(), profiles });
  assert.deepEqual(validateQualificationView(view), []);
  const a = view.populations.find(p => p.population === 'pop-a');
  assert.equal(a.profileEffects.length, 1);
  assert.equal(a.profileEffects[0].denominatorsEqual, true);
  assert.notEqual(a.profileEffects[0].default.configurationHash, a.profileEffects[0].profile.configurationHash, 'a profile is its own configuration identity');
  assert.ok(view.scanners.includes('peer-profile') && view.scanners.includes('peer-one'), 'both results are kept');
});

// ---- The scanner roster (#763): an optional scanner may be absent; a required one may not. Synthetic roster, synthetic ids. ----

import { assessRoster, lastMeasurementOf, notMeasuredStatement, readScannerRoster, rosterFor, validateRoster } from '../benchmarks/qualification/scanner-roster.ts';

const roster = () => ({
  schemaVersion: 1, id: 'synthetic-roster',
  runClasses: { official: { required: ['redact-secret', 'peer-one'], optional: ['peer-opt'] }, diagnostic: { required: ['redact-secret'], optional: [] } },
  optionalScanners: { 'peer-opt': { label: 'Optional Peer default', profile: 'default', reason: 'synthetic: slow and manual', withoutConfigs: { 'linux-x64': 'without.json' }, engineRelease: 'pending' } },
});
const SCANNERS = ['redact-secret', 'peer-one'];
const WITH_OPT = [...SCANNERS, 'peer-opt'];
const historyRecord = (id, recordedOn, version = '1.0.0') => ({ id, recordedOn, configHash: DIGEST(9), engine: { version: '0.0.1', revision: 'abc' }, scanners: [{ id: 'peer-opt', version, configurationHash: DIGEST(10) }, { id: 'peer-one', version: '1' }] });
const withRoster = (ids, extra = {}) => {
  const opts = { scannerIds: ids };
  return buildQualificationView({ registry, engine, product: product(), roster: roster(), ...extra,
    artifacts: inputs({ aOptions: opts, bOptions: opts, cOptions: opts, ...(extra.methods ? { methods: extra.methods } : {}) }) });
};

test('a run is complete without an optional scanner and says what was not measured, with the pointer to its last measurement (#763)', () => {
  const history = { runs: [historyRecord('pop-a@linux-x64', '2026-10-01'), historyRecord('pop-b@linux-x64', '2026-10-05'), historyRecord('pop-a+methods@linux-x64', '2026-10-05')], historicalRuns: [historyRecord('old@linux-x64', '2026-09-01')] };
  const view = withRoster(SCANNERS, { history });
  assert.deepEqual(validateQualificationView(view), []);
  const note = view.scannerRoster.notMeasured;
  assert.equal(note.length, 1);
  assert.equal(note[0].statement, 'Optional Peer default: not measured in this run (optional)');
  assert.equal(note[0].statement, notMeasuredStatement('Optional Peer default'));
  assert.deepEqual([note[0].scanner, note[0].profile, note[0].optional, note[0].reason], ['peer-opt', 'default', true, 'synthetic: slow and manual']);
  // the pointer: the newest recording among the active runs, every run of that date, with its engine and configuration identity
  assert.equal(note[0].lastMeasurement.recordedOn, '2026-10-05');
  assert.equal(note[0].lastMeasurement.registry, 'runs');
  assert.deepEqual(note[0].lastMeasurement.runs.map(r => r.id), ['pop-a+methods@linux-x64', 'pop-b@linux-x64']);
  assert.deepEqual(note[0].lastMeasurement.engine, { version: '0.0.1', revision: 'abc' });
  assert.deepEqual(view.scannerRoster.measured, [...SCANNERS].sort());
  assert.deepEqual(view.scannerRoster.required, [...SCANNERS].sort());
  assert.deepEqual(view.scannerRoster.optional, ['peer-opt']);
});

test('an absent optional scanner leaves no row, no count and no zero anywhere in the view (#763)', () => {
  const view = withRoster(SCANNERS);
  assert.ok(!view.scanners.includes('peer-opt'));
  assert.ok(!JSON.stringify(view.populations.map(p => [p.artifact.scanners, p.aggregates, p.unattributed, p.scope, p.unmeasured, p.cases.map(c => c.results)])).includes('peer-opt'));
  for (const f of view.families) for (const p of f.populations) assert.ok(!p.scanners.some(s => s.scanner === 'peer-opt'));
  // never silent, never invented: the only mention is the roster's statement, with no pointer when no run recorded the scanner
  assert.equal(view.scannerRoster.notMeasured[0].lastMeasurement, null);
});

test('dropping an optional scanner changes no status, no count and no other scanner (#763)', () => {
  const without = withRoster(SCANNERS), withIt = withRoster(WITH_OPT);
  assert.deepEqual(withIt.scannerRoster.notMeasured, []);
  assert.deepEqual(withIt.scannerRoster.measured, [...WITH_OPT].sort());
  const status = v => v.families.map(f => [f.family, f.status, f.evidence, f.gates, f.differential]);
  assert.deepEqual(status(without), status(withIt));
  assert.deepEqual(without.distribution, withIt.distribution);
  assert.deepEqual(without.stableDistribution, withIt.stableDistribution);
  assert.deepEqual(without.supportMatrix, withIt.supportMatrix);
  assert.equal(without.policy.revision, withIt.policy.revision);
  const counts = v => v.families.map(f => f.populations.map(p => p.scanners.filter(s => s.scanner !== 'peer-opt')));
  assert.deepEqual(counts(without), counts(withIt));
});

test('peers that do not depend on the optional scanner keep their differential and review computable (#763)', () => {
  const view = withRoster(SCANNERS, { methods: true });
  const f = family(view);
  assert.ok(f.differential, 'the differential of the gate peer is still computed');
  assert.deepEqual(view.policy.differentialPeers, ['peer-one']);
});

test('a required scanner that is absent or not complete refuses the view; an optional one is not a substitute (#763)', () => {
  assert.throws(() => withRoster(['redact-secret', 'peer-opt']), /required scanner peer-one is absent/);
  assert.throws(() => withRoster(['peer-one']), /required scanner redact-secret is absent/);
  const problems = assessRoster({ roster: roster(), runClass: 'official', populations: [{ population: 'p', scanners: [{ id: 'redact-secret', status: 'complete' }, { id: 'peer-one', status: 'failed' }] }] }).problems;
  assert.match(problems[0], /required scanner peer-one is failed/);
});

test('an optional scanner measured in some populations only is refused, never spliced (#763)', () => {
  const some = ['redact-secret', 'peer-one', 'peer-opt'];
  assert.throws(() => buildQualificationView({ registry, engine, product: product(), roster: roster(),
    artifacts: inputs({ aOptions: { scannerIds: some }, bOptions: { scannerIds: SCANNERS }, cOptions: { scannerIds: SCANNERS } }) }), /optional scanner peer-opt is measured in pop-a only/);
});

test('a methods run that carries an optional scanner the plain run lacks is refused as a different scanner set (#763)', () => {
  assert.throws(() => buildQualificationView({ registry, engine, product: product(), roster: roster(),
    artifacts: inputs({ aOptions: { scannerIds: SCANNERS }, bOptions: { scannerIds: SCANNERS }, cOptions: { scannerIds: SCANNERS }, methods: artifact('pop-a', familyCases('a', 'prov:fam').map(c => ({ ...c, case_id: `${c.case_id}--differential--canonical` })), { methods: METHODS, scannerIds: WITH_OPT }) }) }), /different scanner set|differs from the plain run/);
});

test('without a roster nothing is optional and the view carries no roster section (#763)', () => {
  const view = build();
  assert.equal(view.scannerRoster, undefined);
  assert.deepEqual(view.scanners, SCANNERS.slice().sort());
});

test('the last measurement points at the active registry first, then at history, and is null when no run recorded the scanner (#763)', () => {
  assert.equal(lastMeasurementOf('peer-opt', {}), null);
  assert.equal(lastMeasurementOf('peer-opt', { runs: [{ ...historyRecord('x', '2026-10-05'), scanners: [{ id: 'other' }] }] }), null);
  assert.equal(lastMeasurementOf('peer-opt', { historicalRuns: [historyRecord('h1', '2026-08-01'), historyRecord('h2', '2026-09-01')] }).runs[0].id, 'h2');
  assert.equal(lastMeasurementOf('peer-opt', { historicalRuns: [historyRecord('h2', '2026-09-01')] }).registry, 'historicalRuns');
  const both = lastMeasurementOf('peer-opt', { runs: [historyRecord('r1', '2026-07-01')], historicalRuns: [historyRecord('h2', '2026-09-01')] });
  assert.deepEqual([both.registry, both.runs[0].id], ['runs', 'r1']);
});

test('the roster is validated: disjoint lists, a spec for every optional scanner, a population override (#763)', () => {
  assert.throws(() => validateRoster({ ...roster(), runClasses: { official: { required: ['a'], optional: ['a'] } } }), /listed twice/);
  assert.throws(() => validateRoster({ ...roster(), runClasses: { official: { required: ['a'], optional: ['ghost'] } } }), /no entry in optionalScanners/);
  assert.throws(() => validateRoster({ ...roster(), runClasses: { official: { required: [], optional: [] } } }), /non-empty required list/);
  const r = roster(); r.runClasses.official.populations = { 'pop-c': { required: ['redact-secret'], optional: ['peer-one', 'peer-opt'] } };
  r.optionalScanners['peer-one'] = { ...r.optionalScanners['peer-opt'], label: 'Peer One' };
  assert.deepEqual(rosterFor(validateRoster(r), 'official', 'pop-c').optional, ['peer-one', 'peer-opt']);
  assert.deepEqual(rosterFor(r, 'official', 'pop-a').required, ['redact-secret', 'peer-one']);
  assert.throws(() => rosterFor(r, 'nonexistent'), /no run class/);
});

test('the committed roster is valid, keeps the product required, and makes only the two OpenRedaction profiles optional (#763, #764)', () => {
  const committed = readScannerRoster();
  const official = rosterFor(committed, 'official');
  assert.ok(official.required.includes('redact-secret'));
  assert.deepEqual(official.optional, ['openredaction', 'openredaction-credential-bearing']);
  assert.equal(committed.optionalScanners.openredaction.profile, 'default');
  assert.ok(!official.required.includes('openredaction'));
  // the other diagnostic profiles are separate scanner ids that no roster slot names
  assert.ok(!['openredaction-credentials', 'openredaction-mapped'].some(id => official.optional.includes(id) || official.required.includes(id)));
  assert.ok(!official.required.includes('openredaction-credential-bearing'), 'optional: a required profile would refuse every official view until its measurement exists');
});

test('the credential profile is its own scanner, labelled separately from the default, with its own identity (#764)', () => {
  const { openredaction: dflt, 'openredaction-credential-bearing': prof } = readScannerRoster().optionalScanners;
  assert.equal(dflt.label, 'OpenRedaction default (all patterns)');
  assert.equal(prof.label, 'OpenRedaction credential profile (33 types)');
  assert.notEqual(prof.profile, dflt.profile);
  assert.equal(prof.profileOf, 'openredaction');
  assert.equal(prof.identity.adapter.id, 'openredaction-credential-bearing');
  assert.equal(prof.identity.patterns, 33);
  assert.match(prof.identity.scannerConfigurationHash, /^sha256:[0-9a-f]{64}$/);
  assert.match(prof.disclosure, /not a more accurate OpenRedaction/);
  assert.match(prof.statement, /not measured in an official run \(local exploratory diagnostics only: see ADR\)/);
  assert.deepEqual(prof.withoutConfigs, {}, 'it is in no official configuration, so there is nothing to leave out');
  assert.ok(existsSync(new URL(`../${prof.decision}`, import.meta.url)));
});

test('a view without the credential profile states that it was not measured in an official run, with no number and no history of the default, and keeps the default labelled (#764)', () => {
  const real = readScannerRoster();
  const history = { runs: [{ id: 'old@linux-x64', recordedOn: '2026-10-05', configHash: DIGEST(9), engine: { version: '0.0.1', revision: 'abc' }, scanners: [{ id: 'openredaction', version: '1.1.5', configurationHash: DIGEST(10) }] }] };
  const populations = [{ population: 'p', scanners: ['redact-secret', 'flare-redact', 'gitleaks', 'trufflehog'].map(id => ({ id, status: 'complete' })) }];
  const { problems, view } = assessRoster({ roster: real, runClass: 'official', populations, history });
  assert.deepEqual(problems, []);
  const byId = Object.fromEntries(view.notMeasured.map(n => [n.scanner, n]));
  assert.equal(byId.openredaction.statement, 'OpenRedaction default (all patterns): not measured in this run (optional)');
  assert.equal(byId.openredaction.lastMeasurement.runs[0].id, 'old@linux-x64');
  assert.equal(byId['openredaction-credential-bearing'].lastMeasurement, null, 'the default\'s history is never lent to the profile');
  assert.match(byId['openredaction-credential-bearing'].statement, /^OpenRedaction credential profile \(33 types\): not measured in an official run/);
  assert.match(byId['openredaction-credential-bearing'].officialMeasurement, /pending: requires owner approval/);
  assert.deepEqual(view.profiles.map(p => [p.scanner, p.measured, p.profileOf ?? null]), [['openredaction', false, null], ['openredaction-credential-bearing', false, 'openredaction']]);
  // measured in the whole view: no longer "not measured", and still its own labelled entry
  const both = assessRoster({ roster: real, runClass: 'official', populations: populations.map(p => ({ ...p, scanners: [...p.scanners, { id: 'openredaction-credential-bearing', status: 'complete' }] })), history }).view;
  assert.deepEqual(both.notMeasured.map(n => n.scanner), ['openredaction']);
  assert.equal(both.profiles.find(p => p.scanner === 'openredaction-credential-bearing').measured, true);
});

test('two profiles may not share a label or be the same profile of the same scanner; a profile names another optional scanner (#764)', () => {
  const r = () => JSON.parse(JSON.stringify(readScannerRoster()));
  const a = r(); a.optionalScanners['openredaction-credential-bearing'].label = a.optionalScanners.openredaction.label;
  assert.throws(() => validateRoster(a), /share a label/);
  const b = r(); b.optionalScanners['openredaction-credential-bearing'].profile = 'default';
  assert.throws(() => validateRoster(b), /same profile of the same scanner/);
  const c = r(); c.optionalScanners['openredaction-credential-bearing'].profileOf = 'ghost';
  assert.throws(() => validateRoster(c), /profileOf ghost is not another optional scanner/);
});

test('the profile run configuration holds exactly the profile scanner, pinned, and none of the default (#764)', () => {
  const prof = readScannerRoster().optionalScanners['openredaction-credential-bearing'];
  const config = JSON.parse(readFileSync(new URL(`../${prof.identity.runConfig}`, import.meta.url), 'utf8'));
  assert.deepEqual(config.scanners.map(x => x.id), ['openredaction-credential-bearing']);
  const [scanner] = config.scanners;
  assert.equal(scanner.configuration.options.patterns.length, prof.identity.patterns);
  assert.equal(scanner.configuration.package_source, 'published');
  assert.match(scanner.pin.integrity, /^sha512-/);
  assert.deepEqual(config.methods, []);
  assert.equal(scanner.adapter.version, prof.identity.adapter.version);
});


// ---- A retained measurement and the origin of each observation (#763, #724). Synthetic roster, synthetic ids, synthetic telemetry. ----

const RETAINED = {
  recordedOn: '2026-01-02', engine: { version: '0.0.5', revision: 'abc' }, archive: { release: 'syn-release', asset: 'syn.tar.gz', ciRun: '77' }, nativeLabels: 'unavailable',
  runs: [{ id: 'syn-b@linux-x64', configHash: DIGEST(1), semanticDigest: DIGEST(2), byteDigest: DIGEST(3), scannerVersion: '1.1.5', scannerConfigurationHash: DIGEST(4) }, { id: 'syn-a@linux-x64', configHash: DIGEST(1), semanticDigest: DIGEST(5), byteDigest: DIGEST(6), scannerVersion: '1.1.5', scannerConfigurationHash: DIGEST(4) }],
};

test('a retained measurement is the last measurement when the registry holds none, and the registry still wins when it holds one (#763)', () => {
  const last = lastMeasurementOf('peer-opt', {}, [RETAINED]);
  assert.deepEqual([last.registry, last.recordedOn, last.nativeLabels], ['retained', '2026-01-02', 'unavailable']);
  assert.deepEqual(last.runs.map(r => r.id), ['syn-a@linux-x64', 'syn-b@linux-x64'], 'sorted by run id');
  assert.deepEqual(last.archive, RETAINED.archive);
  assert.deepEqual(last.engine, RETAINED.engine);
  assert.equal(lastMeasurementOf('peer-opt', { historicalRuns: [historyRecord('h1', '2026-09-01')] }, [RETAINED]).registry, 'historicalRuns');
  assert.equal(lastMeasurementOf('peer-opt', { runs: [historyRecord('r1', '2026-09-01')] }, [RETAINED]).registry, 'runs');
  assert.equal(lastMeasurementOf('peer-opt', {}, []), null);
  assert.equal(lastMeasurementOf('peer-opt', {}, [{ ...RETAINED, recordedOn: '2025-12-01' }, RETAINED]).recordedOn, '2026-01-02', 'the newest retained record');
});

test('the view points at a retained measurement, with its archive, and still carries no row, count or zero for the scanner (#763)', () => {
  const r = roster(); r.optionalScanners['peer-opt'].retainedMeasurements = [RETAINED];
  const opts = { scannerIds: SCANNERS };
  const view = buildQualificationView({ registry, engine, product: product(), roster: r, artifacts: inputs({ aOptions: opts, bOptions: opts, cOptions: opts }) });
  assert.deepEqual(validateQualificationView(view), []);
  const [note] = view.scannerRoster.notMeasured;
  assert.equal(note.lastMeasurement.registry, 'retained');
  assert.deepEqual(note.lastMeasurement.archive, RETAINED.archive);
  assert.ok(!view.scanners.includes('peer-opt'));
  assert.ok(!JSON.stringify(view.populations.map(p => [p.artifact.scanners, p.aggregates, p.scope, p.origins])).includes('peer-opt'));
});

test('the roster refuses a retained measurement that names no archive or has malformed digests (#763)', () => {
  const bad = (patch) => { const r = roster(); r.optionalScanners['peer-opt'].retainedMeasurements = [{ ...RETAINED, ...patch }]; return r; };
  assert.throws(() => validateRoster(bad({ archive: { release: '', asset: 'a', ciRun: '1' } })), /archive release, asset and CI run/);
  assert.throws(() => validateRoster(bad({ archive: { release: 'r', asset: 'a', ciRun: 'x' } })), /archive release, asset and CI run/);
  assert.throws(() => validateRoster(bad({ runs: [] })), /names no run/);
  assert.throws(() => validateRoster(bad({ runs: [{ ...RETAINED.runs[0], byteDigest: 'sha256:short' }] })), /sha256 config, semantic and byte digests/);
  assert.throws(() => validateRoster(bad({ recordedOn: 'yesterday' })), /recordedOn/);
  assert.doesNotThrow(() => validateRoster(bad({})));
});

test('the committed roster keeps the last official OpenRedaction measurement retained, so the pointer never reads "no earlier measurement" (#763)', () => {
  const [kept] = readScannerRoster().optionalScanners.openredaction.retainedMeasurements;
  assert.ok(kept, 'the registry no longer lists the superseded runs; the roster keeps the pointer');
  assert.ok(kept.runs.length >= 1 && kept.runs.every(r => /^sha256:[0-9a-f]{64}$/.test(r.byteDigest) && r.scannerVersion));
  assert.equal(kept.nativeLabels, 'unavailable');
  assert.equal(readScannerRoster().optionalScanners['openredaction-credential-bearing'].retainedMeasurements, undefined, 'the credential profile has no official measurement to point at');
});

/** Schema-valid execution diagnostics: the artifact schema validates the telemetry, so a synthetic one carries every required field. */
const timing = extra => ({ prepare_ms: 0, queue_ms: 0, start_ms: 0, end_ms: 0, process_ms: 0, normalize_ms: 0, tasks: 1, fixtures: 1, received_bytes: 0, findings: 0, completion: 'complete', ...extra });
const executionOf = (scanners, reuse) => ({ jobs: 1, processes: 1, wall_ms: 1, scanner_process_ms: 1, evaluator_ms: 1, scanners: Object.fromEntries(Object.entries(scanners).map(([id, x]) => [id, timing(x)])), ...(reuse ? { reuse } : {}) });

test('the origin of each scanner is provenance read from non_semantic: fresh, reused and not recorded stay three states, and it moves nothing else (#724)', () => {
  const telemetry = (scanners, reuse) => d => { d.non_semantic = { ...d.non_semantic, execution: executionOf(scanners, reuse) }; };
  const view = build({ methods: true, aOptions: { mutate: telemetry({ 'redact-secret': { origin: 'fresh', origin_reason: 'forced' }, 'peer-one': { origin: 'reused', origin_reason: 'changed: version, mode' } }, { source_digest: DIGEST(11), input_digest: DIGEST(12) }) } });
  const a = view.populations.find(p => p.population === 'pop-a');
  assert.deepEqual(a.origins.scanners, [{ scanner: 'peer-one', origin: 'reused', reason: 'changed: version, mode' }, { scanner: 'redact-secret', origin: 'fresh', reason: 'forced' }]);
  assert.deepEqual(a.origins.reuse, { sourceDigest: DIGEST(11), inputDigest: DIGEST(12) });
  assert.deepEqual(validateQualificationView(view), []);
  // an artifact whose run offered no observations for reuse records no origin: not recorded, never fresh
  const other = build({ methods: true }).populations.find(p => p.population === 'pop-b');
  assert.deepEqual(other.origins, { scanners: [{ scanner: 'peer-one', origin: 'not-recorded', reason: null }, { scanner: 'redact-secret', origin: 'not-recorded', reason: null }], reuse: null });
  assert.ok(a.methodsOrigins && a.methodsOrigins.scanners.every(s => s.origin === 'not-recorded'), 'the methods artifact is read apart from the plain one');
  // provenance moves no count, status or digest: the same view with another origin differs in the origin record alone
  const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'origins' || k === 'methodsOrigins' ? undefined : x)));
  const same = strip(build({ methods: true }));
  const moved = strip(view);
  for (const v of [same, moved]) for (const p of v.populations) { p.artifact.artifactDigest = 'masked'; if (p.methodsArtifact) p.methodsArtifact.artifactDigest = 'masked'; }
  assert.deepEqual(moved, same);
});

test('the engine host and times are provenance read from non_semantic: carried per population and moving nothing else (#620, #621)', () => {
  const stamp = d => { d.non_semantic = { ...d.non_semantic, host: 'linux-x86_64', started_at: '2026-01-05T10:21:00Z', finished_at: '2026-01-05T10:22:00Z' }; };
  const view = build({ methods: true, aOptions: { mutate: stamp } });
  const a = view.populations.find(p => p.population === 'pop-a');
  assert.deepEqual(a.measurement, { host: 'linux-x86_64', startedAt: '2026-01-05T10:21:00Z', finishedAt: '2026-01-05T10:22:00Z' });
  assert.deepEqual(validateQualificationView(view), []);
  const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'measurement' || k === 'methodsMeasurement' ? undefined : x)));
  const same = strip(build({ methods: true }));
  const moved = strip(view);
  for (const v of [same, moved]) for (const p of v.populations) { p.artifact.artifactDigest = 'masked'; if (p.methodsArtifact) p.methodsArtifact.artifactDigest = 'masked'; }
  assert.deepEqual(moved, same);
});

test('a reason outside the engine vocabulary is dropped, never shown, and a scanner with no telemetry entry is not recorded (#724)', () => {
  const view = build({ aOptions: { mutate: d => { d.non_semantic = { execution: executionOf({ 'redact-secret': { origin: 'fresh', origin_reason: 'scanner said: SECRET-LOOKING-TEXT' } }) }; } } });
  const a = view.populations.find(p => p.population === 'pop-a').origins;
  assert.deepEqual(a.scanners, [{ scanner: 'peer-one', origin: 'not-recorded', reason: null }, { scanner: 'redact-secret', origin: 'fresh', reason: null }]);
  assert.equal(a.reuse, null);
  assert.ok(!JSON.stringify(view).includes('SECRET-LOOKING-TEXT'));
});
