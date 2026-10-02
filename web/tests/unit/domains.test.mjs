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
const pii = (over = {}) => ({
  state: 'recorded', mode: 'candidate', core: { commit: 'abcdef1234567890', versionString: '0.0.0' }, route: { id: 'route-x', record: 'evidence/1/2.md', maximumStatus: 'provisional' },
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
    expect(text(resolvePiiView({ state: 'not-recorded', reason: 'x' }))).not.toMatch(forbidden);
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

  test('a view that is not bound is Not recorded in its cells, and a family with no protected count hides the total', () => {
    const v = resolvePiiView(pii({ families: [family('pii:global:a', { views: null, protectedRun: { state: 'not-recorded', reason: 'not-recorded', cases: null } })] }));
    expect(v.coverage.tables[0].rows[0].cells.every(c => c.figure === null)).toBe(true);
    expect(v.glance[2].value).toBeNull();
  });

  test('no record: every fact is Not recorded, the reason is stated, the method still reads', () => {
    const v = resolvePiiView({ state: 'not-recorded', reason: 'The binding did not validate.' });
    expect(v.glance.map(g => g.value)).toEqual([null, null, null]);
    expect(v.head.meta.find(m => m.label === 'Mode').value).toBe('Not recorded');
    expect(v.coverage.tables[0].text).toContain('did not validate');
    expect(v.status.groups[0].rows[0].statusWord).toBe('Not recorded');
    expect(v.method.vocabularies[0].rows.length).toBeGreaterThan(0);
    expect(v.method.metrics.rows).toEqual([]);
    expect(resolvePiiView({ state: 'not-recorded', reason: 'x' }).coverage.scope[1].text).toBe('Not recorded.');
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
