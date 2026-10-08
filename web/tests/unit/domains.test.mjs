// Unit tests for the evaluation-domain resolvers (#611). Synthetic data only: no ledger value is asserted, so a repin cannot break them.
import { describe, expect, test } from 'vitest';
import { PII_SENSITIVITY_STATES, PII_TYPE_STATES } from '../../../benchmarks/evaluation/domains/pii/outcome-validation.ts';
import {
  CREDENTIAL_OUTCOME_MEANING, DOMAIN_HREF, PII_SENSITIVITY_MEANING, PII_TYPE_MEANING, distributionText, resolveCredentialView, resolvePiiView,
} from '../../resolvers/domains.ts';

const views = { 'oracle-plan': { cases: 5, sensitive: 2, nonSensitive: 2, notEstablished: 1 }, 'qualification-plan': { cases: 6, sensitive: 3, nonSensitive: 2, notEstablished: 1 },
  'diagnostic-balanced': { cases: 7, sensitive: 3, nonSensitive: 2, notEstablished: 2 }, 'benign-heavy-stress': { cases: 8, sensitive: 1, nonSensitive: 4, notEstablished: 3 } };
const family = (id, over = {}) => ({
  id, name: `Family ${id}`, scope: 'global', jurisdiction: null, validatorApplicable: true, coverage: 'Global', status: 'provisional', reasonCodes: [], activation: 'not-measured',
  views, protectedRun: { state: 'met', reason: 'protected-gates-met', cases: 10 }, publicGates: { met: 4, notMet: 0, unresolved: 0, acceptedTradeoffs: 1 }, ...over,
});
const stamp = { authority: 'legacy', from: 'committed', source: 'The benchmark-owned scorer over the frozen evidence.', unmet: ['criterion-a', 'criterion-b'], total: 7, protectedPending: ['protected-path-live'], authorisation: null, decidedBy: 'the owner', reviewOn: '2027-01-02' };
const pii = (over = {}) => ({
  authority: stamp, state: 'recorded', mode: 'candidate', core: { commit: 'abcdef1234567890', versionString: '0.0.0' }, route: { id: 'route-x', record: 'evidence/1/2.md', maximumStatus: 'provisional' },
  profile: { id: 'pii-v1', version: 1, evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1' }, distribution: { pending: 1, provisional: 1, stable: 0, unsupported: 0 },
  families: [family('pii:global:a'), family('pii:xx:b', { jurisdiction: 'XX', status: 'pending', reasonCodes: ['why'], protectedRun: { state: 'not-met', reason: 'protected-gates-not-met:x', cases: 3 } })],
  productActivation: 'not-measured', populationComparisons: [{ id: 'p', verdict: 'not-measured' }],
  metrics: [{ id: 'm-one', population: 'pop', numerator: 'num', denominator: 'den', direction: 'upper', applicability: 'required' }, { id: 'm-two', population: 'pop', numerator: 'num', denominator: 'den', direction: 'lower', applicability: 'required' }],
  costAcceptance: { cells: 3, sizeRows: 2 }, languages: ['en', 'ko'], jurisdictionStandard: { id: 'ISO', codeCount: 9 }, ...over,
});

const rowsOf = view => view.status.groups.flatMap(g => g.rows);
const text = view => JSON.stringify(view);

describe('the two pages are a pair', () => {
  test('one shape, the same sections in the same order, a switch that names both domains', () => {
    const p = resolvePiiView(pii());
    expect(Object.keys(p)).toEqual(['head', 'glance', 'method', 'coverage', 'status', 'reading']);
    expect(p.head.pair.map(x => x.href)).toEqual([DOMAIN_HREF.credential, DOMAIN_HREF.pii]);
    expect(p.glance).toHaveLength(3);
    expect(p.method.steps.map(s => s.title)).toEqual(['Author', 'Run', 'Compare', 'Record']);
    expect(p.status.groups.map(g => g.title)).toEqual(['Recorded', 'Not measured yet', 'Known gaps']);
  });

  test('no copy ranks, grades or says what a product outputs', () => {
    const forbidden = /\b(best|worst|winner|fastest|slowest|better than|outperform)/i;
    expect(text(resolvePiiView(pii()))).not.toMatch(forbidden);
    expect(text(resolvePiiView({ authority: stamp, state: 'not-recorded', reason: 'x' }))).not.toMatch(forbidden);
  });
});

describe('PII view', () => {
  test('words the axes with the states the benchmark defines, so a new state cannot go unexplained', () => {
    expect(Object.keys(PII_TYPE_MEANING).sort()).toEqual([...PII_TYPE_STATES].sort());
    expect(Object.keys(PII_SENSITIVITY_MEANING).sort()).toEqual([...PII_SENSITIVITY_STATES].sort());
  });

  test('records: a count per family and view with its split, a total of protected cases, and the mode on every status', () => {
    const v = resolvePiiView(pii());
    expect(v.head.meta.find(m => m.label === 'Mode').value).toBe('Candidate, core abcdef1');
    expect(v.glance[0].value).toBe('2 families');
    expect(v.glance[0].detail).toContain('1 jurisdictional (XX)');
    expect(v.glance[1].value).toBe('1 provisional, 1 pending');
    expect(v.glance[1].detail).toContain('unreleased');
    expect(v.glance[2].value).toBe('13 protected cases');
    const table = v.coverage.tables[0];
    expect(table.columns).toEqual(['Oracle plan', 'Qualification plan', 'Diagnostic-balanced', 'Benign-heavy', 'Protected']);
    expect(table.rows[0].cells[0]).toEqual({ figure: '5', detail: '2 · 2 · 1' });
    expect(v.method.metrics.rows.map(r => r.better)).toEqual(['Lower', 'Higher']);
    const family = rowsOf(v).find(r => r.id === 'family-status');
    expect(family.detail).toContain('Pending: Family pii:xx:b (why)');
  });

  test('a gate that is accepted as a tradeoff says so; families that disagree on gates are not summarised', () => {
    const agree = rowsOf(resolvePiiView(pii())).find(r => r.id === 'public-gates');
    expect(agree.value).toContain('1 accepted as a tradeoff');
    expect(agree.detail).toContain('3 cells and 2 size rows');
    const noCost = rowsOf(resolvePiiView(pii({ costAcceptance: null }))).find(r => r.id === 'public-gates');
    expect(noCost.detail).toContain('met or accepted');
    const differ = pii({ families: [family('pii:global:a'), family('pii:global:b', { publicGates: { met: 1, notMet: 0, unresolved: 0, acceptedTradeoffs: 0 } })] });
    expect(rowsOf(resolvePiiView(differ)).find(r => r.id === 'public-gates').statusWord).toBe('Not recorded');
    const unbound = pii({ families: [family('pii:global:a', { publicGates: null })] });
    expect(rowsOf(resolvePiiView(unbound)).find(r => r.id === 'public-gates').status).toBe('not-measured');
  });

  test('what is not measured is dashed and names its owner; a recorded activation or comparison is shown as recorded', () => {
    const rows = rowsOf(resolvePiiView(pii()));
    for (const id of ['activation', 'validator', 'population']) expect(rows.find(r => r.id === id).status).toBe('not-measured');
    expect(rows.find(r => r.id === 'activation').link.href).toMatch(/issues\/\d+$/);
    const better = rowsOf(resolvePiiView(pii({ productActivation: 'trusted', populationComparisons: [{ id: 'p', verdict: 'no-regression' }], distribution: { pending: 0, provisional: 1, stable: 1, unsupported: 0 } })));
    expect(better.find(r => r.id === 'activation').status).toBe('info');
    expect(better.find(r => r.id === 'population').value).toContain('no-regression');
    expect(better.find(r => r.id === 'stable').status).toBe('info');
  });

  test('validated pii-eval evidence is named without filling schema 1.1 projection gaps or changing status', () => {
    const measurement = { complete: true, populations: [{}, {}], build: { commit: 'a'.repeat(40), binarySha256: 'b'.repeat(64) } };
    const row = rowsOf(resolvePiiView(pii({ piiEvalMeasurement: measurement }))).find(item => item.id === 'pii-eval');
    expect(row.statusWord).toBe('Validated');
    expect(row.value).toContain('2 public populations');
    expect(row.detail).toContain('unavailable');
    expect(row.detail).toContain('does not change a family status');
  });

  test('a schema 1.2 projection is shown per family and view with strata and mode, and nothing is called unavailable', () => {
    const metric = id => ({ metric: { id }, status: 'measured', effectiveN: 4, counts: { numerator: 1, measured: 4, eligible: 4, unresolved: 0, notMeasured: 0 },
      value: id === 'type-miss-rate' ? { state: 'withheld', reason: 'insufficient-evidence' } : { state: 'measured', point: { mantissa: 25, scale: 2 }, bound: { mantissa: 4, scale: 1 } } });
    const cell = (cases) => ({ counts: { authoredCases: cases, occurrences: cases, variants: cases }, metrics: [metric('type-miss-rate'), metric('measurable-share')] });
    const population = (state, over = {}) => ({ populationId: 'synthetic-pop', population: { populationDigest: 'c'.repeat(64), populationVersion: 1 },
      productBinding: { state, candidateSourceCommit: null }, scanners: [{ scannerId: 's', metrics: [], identity: { product: { kind: 'candidate' }, scannerVersion: '1.2.3' } }],
      productProjection: { requiredViews: ['oracle-plan'], rosterDigest: 'd'.repeat(64), rows: [
        { family: 'pii:global:email', view: 'oracle-plan', mode: 'exploratory', binding: { scannerId: 's' }, methodCoverage: [{ method: { id: 'schema-only', version: 1 }, cases: 3, variants: 3 }], ...cell(3), byLanguage: [{ language: 'en', ...cell(2) }, { language: 'ko', ...cell(1) }], byControlClass: [{ controlClass: 'test-value', ...cell(1) }] },
        { family: 'pii:us:ssn', view: 'oracle-plan', mode: 'exploratory', binding: { scannerId: 's' }, methodCoverage: [{ method: { id: 'schema-only', version: 1 }, cases: 2, variants: 2 }], ...cell(2), byLanguage: [{ language: 'en', ...cell(2) }] },
      ] }, ...over });
    const build = { commit: 'a'.repeat(40), binarySha256: 'b'.repeat(64) };
    const view = resolvePiiView(pii({ piiEvalMeasurement: { complete: true, populations: [population('other-product')], build } }));
    const group = view.status.groups.find(g => g.title.includes('product projection'));
    expect(group.title).toContain('Exploratory');
    expect(group.rows.map(r => r.label)).toEqual(['Measured product', 'pii:global:email · oracle-plan', 'pii:us:ssn · oracle-plan']);
    const email = group.rows[1];
    expect(email.value).toBe('3 cases · 3 variants');
    expect(email.statusWord).toBe('Exploratory');
    expect(email.detail).toContain('type-miss-rate 1/4 withheld (insufficient-evidence)');
    expect(email.detail).toContain('Languages: en 2, ko 1.');
    expect(email.detail).toContain('Control classes: test-value 1.');
    expect(group.rows[2].detail).toContain('Control classes: none authored.');
    expect(group.rows[0].detail).toContain('another product');
    expect(group.rows[0].detail).toContain('never an official qualification run');
    const row = rowsOf(view).find(item => item.id === 'pii-eval');
    expect(row.detail).toContain('schema 1.2 product projection');
    expect(row.detail).not.toContain('are unavailable');
    expect(row.detail).toContain('does not change a family status');
    const same = resolvePiiView(pii({ piiEvalMeasurement: { complete: true, populations: [population('measures-publication-product')], build } }));
    expect(rowsOf(same).find(r => r.id === 'synthetic-pop:projection-binding').detail).toContain('measures the product this publication measured');
    const none = resolvePiiView(pii({ piiEvalMeasurement: { complete: true, populations: [population('publication-product-not-measured')], build } }));
    expect(rowsOf(none).find(r => r.id === 'synthetic-pop:projection-binding').detail).toContain('no product is claimed');
    // A 1.1 population next to a 1.2 one keeps its unavailable fields.
    const mixed = resolvePiiView(pii({ piiEvalMeasurement: { complete: true, populations: [population('other-product'), { populationId: 'old', scanners: [], population: {} }], build } }));
    expect(rowsOf(mixed).find(item => item.id === 'pii-eval').detail).toContain('1 read under schema 1.1 does not carry it');
    expect(text(view)).not.toMatch(/\b(best|worst|winner|fastest|slowest|better than|outperform)/i);
    // An official-mode population says what it is: an execution under the engine contract, evidence and not an accepted verdict.
    const official = population('measures-publication-product');
    official.productProjection.rows.forEach(row => { row.mode = 'official'; });
    const officialView = resolvePiiView(pii({ piiEvalMeasurement: { complete: true, populations: [official], build } }));
    const officialGroup = officialView.status.groups.find(g => g.title.includes('product projection'));
    expect(officialGroup.title).toContain('Official');
    expect(officialGroup.rows[1].statusWord).toBe('Official');
    expect(officialGroup.rows[0].detail).toContain('official-mode execution');
    expect(officialGroup.rows[0].detail).toContain('not a qualification verdict');
    expect(officialGroup.rows[0].detail).not.toContain('never an official qualification run');
  });

  test('custodian conformance is visibly synthetic and never described as protected qualification', () => {
    const custodianConformance = { projections: [{}], feed: { sequence: 2 } };
    const row = rowsOf(resolvePiiView(pii({ custodianConformance }))).find(item => item.id === 'custodian-conformance');
    expect(row.statusWord).toBe('Synthetic only');
    expect(row.detail).toContain('not live protected evidence');
    expect(row.detail).toContain('not signed in the projection');
  });

  test('public measurement survives absent protected evidence without showing product support or protected counts', () => {
    const value = pii();
    const measurement = { populations: [{}], build: { commit: 'a'.repeat(40), binarySha256: 'b'.repeat(64) } };
    const view = resolvePiiView({ authority: stamp, state: 'public-recorded', profile: value.profile, metrics: value.metrics,
      piiEvalMeasurement: measurement, custodianConformance: null, protectedReason: 'Protected binding did not validate.' });
    expect(rowsOf(view).find(row => row.id === 'pii-eval').statusWord).toBe('Validated');
    expect(rowsOf(view).find(row => row.id === 'protected-evidence').detail).toContain('did not validate');
    expect(rowsOf(view).some(row => row.id === 'family-status')).toBe(false);
    expect(view.glance.every(item => item.value === null)).toBe(true);
    expect(view.head.meta.find(item => item.label === 'Mode').value).toBe('Public synthetic only');
  });

  test('public metric rows retain effective N and withheld reasons without computing a rate', () => {
    const measurement = { populations: [{ populationId: 'synthetic', scanners: [{ scannerId: 'scanner', metrics: [
      { metric: { id: 'measurable-share' }, status: 'partial', effectiveN: 6,
        counts: { numerator: 5, measured: 5, eligible: 6, unresolved: 1, notMeasured: 0 },
        value: { state: 'measured', point: { mantissa: 833333, scale: 6 }, bound: { mantissa: 436491, scale: 6 } } },
      { metric: { id: 'type-miss-rate' }, status: 'measured', effectiveN: 3,
        counts: { numerator: 1, measured: 3, eligible: 3, unresolved: 0, notMeasured: 0 },
        value: { state: 'withheld', reason: 'insufficient-evidence' } },
    ] }] }], build: { commit: 'a'.repeat(40), binarySha256: 'b'.repeat(64) } };
    const rows = rowsOf(resolvePiiView(pii({ piiEvalMeasurement: measurement })));
    expect(rows.find(row => row.label.endsWith('(pii-v1:measurable-share)')).value).toBe('5 / 6 effective N');
    expect(rows.find(row => row.label.endsWith('(pii-v1:measurable-share)')).detail).toContain('0.833333, interval bound 0.436491');
    expect(rows.find(row => row.label.endsWith('(pii-v1:type-miss-rate)'))).toMatchObject({ statusWord: 'Withheld', detail: expect.stringContaining('insufficient-evidence') });
  });

  test('a view that is not bound is Not recorded in its cells, and a family with no protected count hides the total', () => {
    const v = resolvePiiView(pii({ families: [family('pii:global:a', { views: null, protectedRun: { state: 'not-recorded', reason: 'not-recorded', cases: null } })] }));
    expect(v.coverage.tables[0].rows[0].cells.every(c => c.figure === null)).toBe(true);
    expect(v.glance[2].value).toBeNull();
  });

  test('no record: every fact is Not recorded, the reason is stated, the method still reads', () => {
    const v = resolvePiiView({ authority: stamp, state: 'not-recorded', reason: 'The binding did not validate.' });
    expect(v.glance.map(g => g.value)).toEqual([null, null, null]);
    expect(v.head.meta.find(m => m.label === 'Mode').value).toBe('Not recorded');
    expect(v.coverage.tables[0].text).toContain('did not validate');
    expect(v.status.groups[0].rows[0].statusWord).toBe('Not recorded');
    expect(v.method.vocabularies[0].rows.length).toBeGreaterThan(0);
    expect(v.method.metrics.rows).toEqual([]);
    expect(resolvePiiView({ authority: stamp, state: 'not-recorded', reason: 'x' }).coverage.scope[1].text).toBe('Not recorded.');
  });

  test('a published record is called published, and a binding with no reviewed route says so', () => {
    const v = resolvePiiView(pii({ mode: 'published' }));
    expect(v.head.meta.find(m => m.label === 'Mode').value).toMatch(/^Published/);
    expect(v.glance[1].detail).not.toContain('unreleased');
  });
});

describe('distributionText', () => {
  test('lists the states with a count in a fixed order, and says when there are none', () => {
    expect(distributionText({ stable: 1, provisional: 0, pending: 2, unsupported: 0 })).toBe('1 stable, 2 pending');
    expect(distributionText({ stable: 0, provisional: 0, pending: 0, unsupported: 0 })).toBe('none classified');
  });
});

// ---- credential ---------------------------------------------------------------------------------

const fixture = (kind, tier, familyIds = []) => ({ kind, tier, familyIds });
const catalog = {
  fixtures: [fixture('must-redact', 'T1', ['a:one']), fixture('must-redact', 'T1', ['a:one']), fixture('must-not-flag', 'T2'), fixture('policy', 'T3'), fixture('must-redact', 'T0')],
  taxonomy: { providers: [{ id: 'a' }], families: [{ id: 'a:one' }, { id: 'a:two' }] },
  fixturesByFamily: new Map([['a:one', [{}, {}]]]), suites: [{ id: 's1' }, { id: 's2' }],
};
const run = { state: 'measured', mode: 'published', productVersion: '1.2.3', generatedAt: '2030-05-06T00:00:00Z', suiteCount: 2, scanners: [{ id: 'x' }, { id: 'y' }] };
const support = { mode: 'published', version: '1.2.3', sourceCommit: null, generatedAt: '2030-05-07T00:00:00Z', path: 'evidence/1/a/support-status-published.json', familyCount: 4,
  distribution: { stable: 3, provisional: 1, pending: 0, unsupported: 0 }, stable: { documented: 2, empirical: 1, policyQualified: 0 } };
const qualification = { status: 'execution-qualified', supportClaims: false, finishedAt: '2030-05-01T00:00:00Z', path: 'docs/q.json', methods: [{ method: 'twin', cases: 4, variants: 8 }, { method: 'holdout', cases: 2, variants: 2 }] };
const findings = { reviewedAt: '2030-01-01', measuredVersion: '0.0.1', issues: [{ status: 'fixed' }, { status: 'fixed' }, { status: 'verified' }] };
const pipeline = { authority: 'legacy', from: 'committed' };
const credential = (over = {}) => ({ pipeline, run, catalog, findings, support, qualification, profiles: { evaluationProfile: 'eval-x', domainAccountingVersion: 'acct-y' }, ...over });

describe('credential view', () => {
  test('words the outcomes with the five the benchmark records', () => {
    expect(Object.keys(CREDENTIAL_OUTCOME_MEANING)).toEqual(['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS']);
  });

  test('counts fixtures by kind and level from the catalog, and names the mode of the stable count', () => {
    const v = resolveCredentialView(credential());
    const [kinds, methods] = v.coverage.tables;
    expect(kinds.columns).toEqual(['T1', 'T2', 'T3', 'T0']);
    expect(kinds.rows.find(r => r.id === 'must-redact').cells.map(c => c.figure)).toEqual(['2', '0', '0', '1']);
    expect(methods.rows.map(r => r.label)).toEqual(['Twin', 'Holdout']);
    expect(v.glance[0].detail).toContain('5 fixtures in 2 suites');
    expect(v.glance[0].detail).toContain('1 families have at least one fixture');
    expect(v.glance[1].value).toBe('3 of 4 stable');
    expect(v.glance[1].detail).toMatch(/^Published, 1\.2\.3, recorded 2030-05-07/);
    expect(v.glance[2].value).toBe('2 public holdout cases');
    expect(v.head.meta.find(m => m.label === 'Mode').value).toContain('published');
    expect(rowsOf(v).find(r => r.id === 'findings').detail).toContain('2 fixed, 1 verified');
    expect(rowsOf(v).find(r => r.id === 'pending').value).toBe('1 fixture');
  });

  test('a candidate record is called candidate', () => {
    const v = resolveCredentialView(credential({ support: { ...support, mode: 'candidate', version: '2.0.0-rc', distribution: { stable: 4, provisional: 0, pending: 0, unsupported: 0 } } }));
    expect(v.glance[1].detail).toMatch(/^Candidate, 2\.0\.0-rc/);
    expect(v.glance[1].detail).toContain('No family is in another state');
  });

  test('no run, no support record, no qualification: Not recorded, with the corpus counts still shown', () => {
    const v = resolveCredentialView(credential({ run: { state: 'not-published', reason: 'x' }, support: undefined, qualification: undefined, profiles: undefined }));
    expect(v.glance[1].value).toBeNull();
    expect(v.glance[2].value).toBeNull();
    expect(v.head.meta.map(m => m.value)).toContain('Not recorded');
    expect(v.coverage.tables[1].text).toContain('No qualification record');
    const rows = rowsOf(v);
    expect(rows.find(r => r.id === 'run').status).toBe('not-measured');
    expect(rows.find(r => r.id === 'support').status).toBe('not-measured');
    expect(rows.find(r => r.id === 'qualification')).toBeUndefined();
    expect(v.coverage.tables[0].rows).toHaveLength(3);
    expect(v.method.methods.length).toBeGreaterThan(0);
    expect(v.coverage.scope[0].text).not.toContain('support record scores');
  });

  test('what is not measured is dashed and the policy holdout names its issue', () => {
    const rows = rowsOf(resolveCredentialView(credential()));
    expect(rows.find(r => r.id === 'policy-qualified')).toMatchObject({ status: 'not-measured', link: { href: expect.stringMatching(/issues\/\d+$/) } });
    for (const id of ['validity', 'real-world']) expect(rows.find(r => r.id === id).status).toBe('not-measured');
  });
});

describe('the PII authority row (#666)', () => {
  const authorityRow = view => rowsOf(view).find(item => item.id === 'pii-authority');

  test('legacy says the benchmark scorer is the authority, the pii-eval measurement is exploratory, what is unmet, who decides, and that it is independent of the credential authority', () => {
    const row = authorityRow(resolvePiiView(pii()));
    expect(row.statusWord).toBe('Legacy');
    expect(row.value).toBe('5 of 7 public exit criteria met');
    expect(row.detail).toContain('benchmark-owned scorer');
    expect(row.detail).toContain('exploratory evidence and decides nothing');
    expect(row.detail).toContain('Not yet met: criterion-a, criterion-b');
    expect(row.detail).toContain('decided by the owner, reviewed on 2027-01-02');
    expect(row.detail).toContain('Independent of the credential authority');
  });

  test('it is the last row of the first group on every state, so the page keeps its shape', () => {
    for (const view of [resolvePiiView(pii()), resolvePiiView({ authority: stamp, state: 'not-recorded', reason: 'x' })]) {
      expect(view.status.groups[0].rows.at(-1).id).toBe('pii-authority');
    }
    expect(resolvePiiView(pii()).status.groups.map(g => g.title)).toEqual(['Recorded', 'Not measured yet', 'Known gaps']);
  });

  test('new says the pii-eval artifacts are the authority under a recorded owner authorisation and that the legacy pipeline is the oracle', () => {
    const authorisation = { acceptedBy: 'the owner', acceptedOn: '2000-01-01', scope: 'public-synthetic-measurement-authority', engine: 'redact-secret/pii-eval@synthetic', officialRunId: 1, source: 'https://example.invalid/synthetic' };
    const row = authorityRow(resolvePiiView(pii({ authority: { ...stamp, authority: 'new', unmet: [], authorisation } })));
    expect(row.statusWord).toBe('New');
    expect(row.value).toBe('7 of 7 public exit criteria met');
    expect(row.detail).toContain('pii-eval artifacts are the authority for the public synthetic measurement');
    expect(row.detail).toContain('authorised by the owner on 2000-01-01 for official run 1');
    expect(row.detail).toContain('bounded oracle and rollback source');
    expect(row.detail).toContain('Product qualification, thresholds and support status stay with the benchmarks');
  });

  test('new says the protected path is pending and does not gate the public measurement, and an operational one is not called pending', () => {
    const pending = authorityRow(resolvePiiView(pii({ authority: { ...stamp, authority: 'new', unmet: [] } })));
    expect(pending.detail).toContain('pending and not operational, and do not gate this measurement (protected-path-live)');
    const live = authorityRow(resolvePiiView(pii({ authority: { ...stamp, authority: 'new', unmet: [], protectedPending: [] } })));
    expect(live.detail).not.toContain('pending and not operational');
  });
});


test('family anchors distinguish scanners and survive value changes; every row uses its own scanner identity', () => {
  const pop = { populationId: 'public-one', schemaVersion: '1.4', population: { populationDigest: 'a'.repeat(64) },
    productBinding: { state: 'other-product', candidateSourceCommit: 'b'.repeat(40) },
    scanners: [
      { scannerId: 'one', metrics: [], identity: { product: { kind: 'candidate' }, scannerVersion: '1.0.0' } },
      { scannerId: 'two', metrics: [], identity: { product: { kind: 'released' }, scannerVersion: '2.0.0' } },
    ], productProjection: { requiredViews: ['oracle-plan'], rosterDigest: 'c'.repeat(64), rows: ['one', 'two'].map(scannerId => ({
      family: 'pii:global:email', view: 'oracle-plan', mode: 'official', binding: { scannerId }, counts: { authoredCases: 2, variants: 2 }, metrics: [], methodCoverage: [],
    })) } };
  const input = { complete: true, build: { commit: 'd'.repeat(40), binarySha256: 'e'.repeat(64) }, populations: [pop] };
  const groupOf = value => resolvePiiView(pii({ piiEvalMeasurement: value })).status.groups.find(g => g.title.includes('product projection'));
  const group = groupOf(input);
  const rows = group.rows.slice(1);
  expect(rows[0].detail).toContain('Candidate one 1.0.0');
  expect(rows[1].detail).toContain('Released two 2.0.0');
  expect(rows[1].detail).toContain('Source commit Not recorded');
  expect(rows[0].link.href).toContain('b'.repeat(40));
  expect(rows[1].link).toBeUndefined();
  expect(new Set(rows.map(row => row.id)).size).toBe(2);
  expect(new Set(rows.map(row => row.anchor)).size).toBe(2);
  expect(group.navigation.map(link => decodeURIComponent(link.href.split('#')[1]))).toEqual(rows.map(row => row.anchor));
  const changed = structuredClone(input); changed.populations[0].productProjection.rows[0].counts.authoredCases = 7;
  expect(groupOf(changed).rows[1].anchor).toBe(rows[0].anchor);
});

test('historical b11 quantities keep their own denominator and threshold and never qualify the public measurement', () => {
  const metric = { id: 'context-discrimination-rate', numerator: 1, denominator: 2, threshold: 0.5, direction: 'lower', status: 'not-met',
    value: { point: 0.5, bound: 0.1, n: 2, direction: 'lower' } };
  const value = pii({ families: [family('pii:global:email', { views: { ...views, 'oracle-plan': { ...views['oracle-plan'], metrics: [metric, { ...metric, id: 'range-collateral-rate', denominator: 0, value: null, status: 'not-applicable' }, { ...metric, value: 'insufficient-evidence', status: 'insufficient-denominator' }] } } })] });
  const group = resolvePiiView(value).status.groups.find(group => group.title.includes('historical benchmark'));
  expect(group.rows[1].label).toContain('b11:context-discrimination-rate');
  expect(group.rows[1].detail).toContain('twin pairs');
  expect(group.rows[1].detail).toContain('Historical b11 threshold 0.5');
  expect(group.rows[2]).toMatchObject({ status: 'not-measured', statusWord: 'not-applicable' });
  expect(group.rows[2].detail).toContain('records no interval');
  expect(group.rows[3]).toMatchObject({ status: 'not-measured', statusWord: 'insufficient-denominator' });
  expect(group.rows[3].detail).toContain('insufficient-evidence');
  expect(group.rows[3].detail).not.toContain('undefined');
  expect(group.rows[0].detail).toContain('not the current public pii-v1 measurement');
  const without = resolvePiiView({ ...value, state: 'public-recorded', piiEvalMeasurement: null, protectedReason: 'Unbound' });
  expect(without.status.groups.some(group => group.title.includes('historical benchmark'))).toBe(false);
});


test('current comparison absent or invalid remains separate from historical qualification', () => {
  for (const state of ['absent', 'invalid']) {
    const view = resolvePiiView(pii({ candidateComparison: { state, reason: 'comparison-plan-mismatch', publicOnly: true, supportClaims: false, qualified: false } }));
    const row = rowsOf(view).find(row => row.id === 'current-public-comparison');
    expect(row.status).toBe('not-measured');
    expect(row).not.toHaveProperty('value');
    expect(row.detail).toContain('comparison-plan-mismatch');
    expect(row.detail).toContain('No current activation');
    expect(rowsOf(view).find(row => row.id === 'family-status').label).toContain('historical');
  }
});

test('current public paired quantities preserve both denominators, withheld delta and installed-only activation', () => {
  const metric = (n, numerator, withheld = false) => ({ metric: { id: 'sensitive-miss-rate' }, status: withheld ? 'withheld' : 'measured', effectiveN: n,
    counts: { numerator, measured: n, eligible: n + 1, unresolved: 1, notMeasured: 0 },
    value: withheld ? { state: 'withheld', reason: 'insufficient-evidence' } : { state: 'measured', point: { mantissa: 25, scale: 2 }, bound: { mantissa: 4, scale: 1 } } });
  const product = (sourceCommit, version) => ({ sourceCommit, version, packageTreeSha256: 'a'.repeat(64) });
  const activation = { surfaces: [{ surface: 'node-addon', checks: [{ requestedSelectors: [] }, { requestedSelectors: ['pii:global', 'pii:us'] }] },
    { surface: 'node-forced-wasm', checks: [{ requestedSelectors: ['pii:global'] }] }] };
  const comparison = { state: 'recorded', publicOnly: true, supportClaims: false, qualified: false, mode: 'exploratory',
    baseline: product('b'.repeat(40), '1.0.0'), candidate: product('c'.repeat(40), '1.1.0-beta.1'), activation: { baseline: activation, candidate: activation },
    validator: { state: 'not-measured', reason: 'product-validator-primitive-seam-unavailable' },
    populations: [{ view: 'oracle-plan', memberships: 7, population: { populationId: 'synthetic-current', populationDigest: 'd'.repeat(64) },
      metrics: [{ key: 'email/family/sensitive-miss-rate', family: 'pii:global:email', stratum: 'family', metricId: 'sensitive-miss-rate',
        baseline: metric(4, 1), candidate: metric(3, 1, true), delta: null }] }] };
  const value = pii({ candidateComparison: comparison });
  const view = resolvePiiView(value);
  const rows = rowsOf(view);
  expect(rows.find(row => row.id === 'current-public:candidate').link.href).toContain('c'.repeat(40));
  expect(rows.find(row => row.id === 'current-public:baseline:activation').detail).toContain('PII off');
  expect(rows.find(row => row.id === 'current-public:baseline:activation').detail).toContain('no trusted qualification activation');
  const group = view.status.groups.find(group => group.title.includes('current public comparison') && group.title.includes('email'));
  expect(group.rows[1]).toMatchObject({ status: 'not-measured', statusWord: 'Delta withheld' });
  expect(group.rows[1].detail).toContain('Baseline 1/4 effective N');
  expect(group.rows[1].detail).toContain('Candidate 1/3 effective N');
  expect(group.rows[1].detail).toContain('withheld (insufficient-evidence)');
  expect(group.rows[1].detail).toContain('No pooled total or qualification verdict');
  expect(rows.find(row => row.id === 'current-public:validator').status).toBe('not-measured');
  expect(rows.find(row => row.id === 'current-public:qualification').statusWord).toBe('Not qualified');
  const officialRows = rowsOf(resolvePiiView(pii({ candidateComparison: { ...comparison, mode: 'official' } })));
  expect(officialRows.find(row => row.id === 'current-public:baseline').statusWord).toBe('Official');
  expect(officialRows.find(row => row.id === 'current-public:qualification').statusWord).toBe('Not qualified');
  expect(value.distribution).toEqual({ pending: 1, provisional: 1, stable: 0, unsupported: 0 });
});
