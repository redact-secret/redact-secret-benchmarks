// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { syntheticEvidenceComparison } from '../../../tests/helpers/pii-evidence-comparison-fixture.mjs';
import { loadPiiEvidenceComparison } from '../../../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
import { resolvePiiOutcomeSummary, resolvePiiEvidenceView, evidenceMetricText, evidenceOutcomeText } from '../../resolvers/pii-evidence';
import { piiCoveragePublication } from '../../../scripts/pii-coverage-publication.mjs';
import { overlay, REAL_ROOT } from './overlay';

const directory = 'benchmarks/pii-evidence-comparison';
const unavailable = state => ({ state, reason: 'synthetic-unavailable', publicOnly: true, supportClaims: false, qualified: false });
const recorded = () => {
  const result = loadPiiEvidenceComparison(syntheticEvidenceComparison());
  if (result.state !== 'recorded') throw new Error(`Synthetic fixture invalid: ${result.reason}`);
  return result;
};
const table = (view, id) => view.coverage.tables.find(row => row.id === id);
afterEach(() => { vi.doUnmock('../../services/pii-coverage'); vi.unstubAllEnvs(); vi.resetModules(); });

function files(input) {
  return {
    [`${directory}/plan.json`]: JSON.stringify(input.plan),
    [`${directory}/receipt.json`]: JSON.stringify(input.receipt),
    [`${directory}/record.json`]: null,
    [`${directory}/population-index.json`]: JSON.stringify(input.populationIndex),
    ...Object.fromEntries(input.artifacts.map(row => [`${directory}/${row.side}.public-synthetic-artifact.json`, row.text])),
  };
}
async function service(overrides) {
  vi.resetModules(); vi.stubEnv('WEB_REPO_ROOT', overlay(overrides));
  return import('../../services/pii-evidence');
}

describe('independent public PII evidence, pure projection', () => {
  test.each(['absent', 'invalid'])('%s record never supplies placeholder measurements', state => {
    const view = resolvePiiEvidenceView(unavailable(state));
    expect(view.glance.every(row => row.value === null)).toBe(true);
    expect(view.coverage.tables).toHaveLength(1);
    expect(view.status.groups[0].rows[0].statusWord).toBe(state === 'invalid' ? 'Unusable' : 'Not recorded');
    expect(JSON.stringify(view)).not.toMatch(/0 source cases|0 imported cases|0 public variants/);
  });

  test('change counts retain unresolved overlap and do not classify changes as improvements', () => {
    const source = recorded();
    const row = source.outcomes[0];
    const unresolved = { ...row.baseline, typeIdentity: 'unresolved' };
    const summary = resolvePiiOutcomeSummary({ ...source, outcomes: [
      { ...row, changed: true, baseline: unresolved },
      { ...row, variantId: 'synthetic-other', changed: false, baseline: unresolved },
    ] });
    expect([summary.total, summary.changed, summary.unchanged, summary.unresolved]).toEqual(['2', '1', '1', '2']);
    expect(summary.rows[0].baseline.typeIdentity).toBe('unresolved');
    expect(resolvePiiOutcomeSummary(unavailable('invalid'))).toBeNull();
    expect(JSON.stringify(summary)).not.toMatch(/improved|regressed/);
  });

  test('each metric retains its own counts and each outcome its own authored membership', () => {
    const result = recorded(), view = resolvePiiEvidenceView(result);
    const metrics = table(view, 'evidence-metrics'), outcomes = table(view, 'evidence-outcomes');
    expect(metrics.rows).toHaveLength(result.metrics.length);
    expect(outcomes.rows).toHaveLength(result.outcomes.length);
    expect(outcomes.rows.map(row => row.id)).toEqual(result.outcomes.map(row => row.variantId));
    for (const [index, row] of result.metrics.entries()) {
      expect(metrics.rows[index].cells[0].detail).toBe(evidenceMetricText(row.baseline));
      expect(metrics.rows[index].cells[1].detail).toBe(evidenceMetricText(row.candidate));
    }
    expect(JSON.stringify(view)).toContain('not measured');
    expect(JSON.stringify(view)).toContain('not applicable');
    expect(view.status.groups.flatMap(group => group.rows).find(row => row.id === 'evidence-qualification').statusWord).toBe('Not qualified');
  });

  test('membership counts and overlapping losses remain separate from metric denominators', () => {
    const result = recorded(), view = resolvePiiEvidenceView(result);
    expect(table(view, 'evidence-family-inventory').rows).toHaveLength(Object.keys(result.mappedFamilies).length);
    expect(table(view, 'evidence-losses').rows).toHaveLength(Object.keys(result.losses).length);
    expect(table(view, 'evidence-losses').note).toMatch(/overlap.*Do not add/);
    expect(JSON.stringify(view)).toContain('Source cases and imported cases are different grains');
    expect(JSON.stringify(view)).toContain(result.population.digest);
    expect(JSON.stringify(view)).toContain(result.evidence.snapshot.contentDigest);
    expect(JSON.stringify(view)).toContain('PHI and context claims');
    expect(JSON.stringify(view)).toContain('Unavailable');
  });

  test('withheld, partial and unresolved cells retain their exact state, not an inferred zero', () => {
    const value = recorded().metrics[0].baseline;
    const held = { ...value, status: 'not-measured', value: { state: 'withheld', reason: 'synthetic-not-measured' } };
    expect(evidenceMetricText(held)).toContain('Withheld: synthetic-not-measured');
    const view = resolvePiiEvidenceView({ ...recorded(), metrics: [{ metric: held.metric, baseline: held, candidate: held, delta: null }] });
    expect(table(view, 'evidence-metrics').rows[0].cells.every(row => row.figure === null)).toBe(true);
    expect(evidenceOutcomeText({ typeIdentity: 'unresolved', range: 'not-applicable', sensitivityContext: 'not-measured', action: { state: 'not-measured' } })).toContain('unresolved');
  });

  test('measured decimals preserve point and interval precision', () => {
    const value = recorded().metrics[0].baseline;
    expect(evidenceMetricText({ ...value, value: { state: 'measured', point: { mantissa: 125, scale: 3 }, bound: { mantissa: 9, scale: 2 } } })).toContain('point 0.125; bound 0.09');
  });


});

describe('independent public service identity checks', () => {
  test('missing receipt is absent and repeated pages share the memoised load', async () => {
    const api = await service({ [`${directory}/receipt.json`]: null, [`${directory}/record.json`]: null });
    const first = api.loadPiiEvidenceComparisonPage();
    expect(api.loadPiiEvidenceComparisonPage()).toBe(first);
    expect((await first).state).toBe('absent');
  });

  test('synthetic verified artifacts remain usable without protected or authority inputs', async () => {
    const api = await service(files(syntheticEvidenceComparison()));
    expect((await api.loadPiiEvidenceComparisonPage()).state).toBe('recorded');
  });

  test.each(['snapshot', 'artifact', 'scanner'])('wrong %s pin fails closed', async kind => {
    const input = syntheticEvidenceComparison();
    if (kind === 'snapshot') input.plan.population.digest = 'f'.repeat(64);
    if (kind === 'artifact') input.receipt.baseline.artifactSha256 = 'f'.repeat(64);
    if (kind === 'scanner') input.receipt.baseline.packageTreeSha256 = 'f'.repeat(64);
    const api = await service(files(input));
    const result = await api.loadPiiEvidenceComparisonPage();
    expect(result.state).toBe('invalid');
    expect(resolvePiiEvidenceView(result).glance.every(row => row.value === null)).toBe(true);
  });

  test('page-level resolver assembles this service without accessing the benchmark-owned PII loader', async () => {
    await service({ [`${directory}/receipt.json`]: null, [`${directory}/record.json`]: null });
    // The page composes two independent services, use a real safe root for the sealed coverage service.
    vi.doMock('../../services/pii-coverage', () => ({ loadPiiCoveragePage: () => piiCoveragePublication(REAL_ROOT) }));
    const { resolvePiiEvidencePage } = await import('../../resolvers/pii-evidence-pages');
    expect((await resolvePiiEvidencePage()).head.currentHref).toBe('/evaluation/pii/evidence/');
  });
});
