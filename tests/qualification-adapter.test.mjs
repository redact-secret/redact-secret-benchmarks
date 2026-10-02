import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQualificationView, serializeView, detectorsOf } from '../benchmarks/qualification/adapter.ts';
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

function artifact(population, cases, { publication = 'public', runClass = 'official', methods = [], build = 'released', status = 'complete', mutate } = {}) {
  const evidence = registry.find(r => r.id === population).evidence;
  const ids = ['redact-secret', 'peer-one'];
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
    axes: { positiveContext: 'overlay-else-group', benignControl: 'overlay-else-taxonomy-else-group' }, methods: { required: METHODS, whenNotRun: 'block-stable', source: 'methods-run' }, rules: ['synthetic'] },
  policyRevision: policyRevision([{ path: 'a', digest: DIGEST(1) }]), ...overrides,
});

/**
 * The methods run of pop-a: its cases are generated variants (`<case id>--<method>--<variant>`), its assertions and review
 * occurrences are keyed by the evaluation case id `<case id>--<method>`. `failures` and `queue` are seed case ids.
 */
const methodsRun = ({ methods = METHODS, failures = [], queue = [], queueIds = [] } = {}) => artifact('pop-a', familyCases('a', 'prov:fam').map(c => ({ ...c, case_id: `${c.case_id}--differential--canonical` })), {
  methods,
  mutate: doc => {
    doc.scanners.find(s => s.scanner === 'redact-secret').assertions = failures.map(([id, method]) => ({ case_id: `${id}--${method}`, method, assertion: 'same-detection', status: 'fail' }));
    doc.review_queue = queue.map((id, i) => ({ id: queueIds[i] ?? DIGEST(500 + i), case_id: `${id}--differential`, method: 'differential', variant: 'canonical', reference: 'redact-secret', peer: 'peer-one', disagreement: 'reference-only' }));
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

test('the view is deterministic and schema-valid; non_semantic moves only the byte digest', () => {
  const first = serializeView(build({ methods: true }));
  assert.equal(serializeView(build({ methods: true })), first);
  const other = build({ methods: true, aOptions: { mutate: d => { d.non_semantic = { run_id: 'other', host: 'elsewhere' }; } } });
  const a = JSON.parse(first), b = JSON.parse(serializeView(other));
  assert.notEqual(a.populations[0].artifact.artifactDigest, b.populations[0].artifact.artifactDigest);
  assert.equal(a.populations[0].artifact.semanticDigest, b.populations[0].artifact.semanticDigest);
  for (const view of [a, b]) for (const p of view.populations) { p.artifact.artifactDigest = 'masked'; if (p.methodsArtifact) p.methodsArtifact.artifactDigest = 'masked'; }
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
  const base = family(build({ methods: true }));
  const overlay = {
    schemaVersion: 1, id: 'credential-public-axis-overlay-v1', population: 'pop-a', owner: 'redact-secret-benchmarks', note: 'synthetic',
    snapshot: { corpusDigest: registry[0].evidence.corpusDigest, cases: 5 }, derivation: { join: 'j', contextAxis: 'c', controlAxis: 'c', joinedCases: 5, unjoinedCases: 0 },
    contexts: { 'a-p1': 'cat-x/ctx-one', 'a-p2': 'cat-y/ctx-one' },
    controls: { 'a-b1': 'placeholder', 'a-b2': null },
  };
  const view = build({ methods: true }, product({ axisOverlay: overlay }));
  const f = family(view);
  // Both positives name one fixture group, so the profile cell collapses from two (the snapshot groups) to one, while `positiveAxes` counts the
  // legacy `<category>/<group>` axes (two categories); the null control counts toward no axis.
  assert.deepEqual(f.fixtureProfile.cells.positiveContextAxisIds, ['ctx-one']);
  assert.equal(f.evidence.positiveAxes, 2);
  assert.deepEqual(f.evidence.benignAxisIds, ['placeholder']);
  assert.equal(base.fixtureProfile.cells.positiveContextAxes, 2);
  // It names axes only: every measured count is unchanged.
  for (const key of ['positiveCases', 'totalFixtures', 'benignCases', 'twinPairs', 'twinFailures', 'benignFalseAlarms']) assert.equal(f.evidence[key], base.evidence[key], key);
  assert.deepEqual(view.policy.axisOverlay, { id: overlay.id, population: 'pop-a', corpusDigest: overlay.snapshot.corpusDigest, contexts: 2, controls: 2 });
  assert.deepEqual(validateQualificationView(view), []);
  // A case the overlay does not name keeps the snapshot's own vocabulary.
  const partial = family(build({ methods: true }, product({ axisOverlay: { ...overlay, contexts: { 'a-p1': 'cat-x/ctx-one' }, controls: {} } })));
  assert.deepEqual(partial.fixtureProfile.cells.positiveContextAxisIds, ['axis-2', 'ctx-one']);
  assert.deepEqual(partial.evidence.benignAxisIds, ['axis-a', 'axis-b']);
  // It is bound to one snapshot, and to the floors population.
  assert.throws(() => build({ methods: true }, product({ axisOverlay: { ...overlay, snapshot: { ...overlay.snapshot, corpusDigest: DIGEST(999) } } })), /axis overlay is derived from corpus/);
  assert.throws(() => build({ methods: true }, product({ axisOverlay: { ...overlay, population: 'pop-b' } })), /axis overlay is for pop-b/);
});
