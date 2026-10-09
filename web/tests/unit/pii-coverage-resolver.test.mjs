// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createCoverageRow, COVERAGE_STATES } from '../../../scripts/lib/pii-coverage-model.mjs';
import { summarizeCoverage } from '../../../scripts/lib/pii-coverage-summary.mjs';
import { resolvePiiCoverageView } from '../../resolvers/pii-coverage';
const identity = role => ({ snapshotId: `synthetic/${role}`, snapshotCommitment: 'a'.repeat(64), productCommitment: 'b'.repeat(64), mappingRevision: 1,
  mappingCommitment: 'c'.repeat(64), protocol: 'synthetic/1', population: 'd'.repeat(64), visibility: 'public', role, bindingCommitment: 'e'.repeat(64) });
function row(state, id) {
  const input = { kindKey: `synthetic/${state}`, label: `Synthetic ${state}`, domains: ['PII'], jurisdictions: ['synthetic'],
    evidence: { availability: 'accepted', authoredCases: 2, acceptedCases: 2, importedCases: 3, fixtures: 4, variants: 4, occurrences: 4 },
    capability: { state: 'declared', source: 'https://example.invalid/product-declaration', productCommitment: id.productCommitment },
    mapping: { state: 'faithful', losses: [], requiredAxes: ['identity'], representableAxes: ['identity'] },
    observation: { status: 'valid', source: 'synthetic-case-assertions', identity: id, axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 2, missed: 0, unresolved: 0, withheld: 0 }] },
    applicability: { state: 'applicable', source: 'https://example.invalid/applicability-contract' }, reasons: [] };
  if (state === 'measured-missed') Object.assign(input.observation.axes[0], { satisfied: 1, missed: 1 });
  if (state === 'measured-partial') Object.assign(input.mapping, { state: 'partial', losses: ['synthetic-context-loss'] });
  if (state === 'supported-unmeasured') input.observation = { status: 'absent', source: null, identity: null, axes: [] };
  if (state === 'measurement-unavailable') input.capability = { state: 'unknown', source: null, productCommitment: null };
  if (state === 'product-not-supported') input.capability.state = 'explicitly-absent';
  if (state === 'evaluator-not-representable') Object.assign(input.mapping, { state: 'not-representable', representableAxes: [] });
  if (state === 'evidence-deferred') Object.assign(input.evidence, { availability: 'deferred', acceptedCases: 0 });
  if (state === 'not-applicable') input.applicability.state = 'not-applicable';
  return createCoverageRow(input, id);
}
function publication(states = COVERAGE_STATES) {
  const inventories = {}, matrices = {};
  for (const role of ['active', 'proposed']) {
    const id = identity(role), rows = states.map(state => row(state, id));
    inventories[role] = { source: { release: { repository: 'synthetic/source', commit: 'f'.repeat(40) }, snapshot: { id: `synthetic/${role}`, contentDigest: id.snapshotCommitment, manifestSha256: '1'.repeat(64) } },
      totals: { kinds: rows.length, authoredCases: 2 * rows.length, fixtures: 4 * rows.length }, losses: { 'synthetic-context-loss': 1 }, limitations: ['synthetic-no-per-kind-loss-count'],
      rows: rows.map(record => ({ kindKey: record.kindKey, source: { repository: 'synthetic/source', commit: 'f'.repeat(40) }, research: { openQuestions: ['Synthetic unresolved scope'] }, emptyReasons: [], mapping: { families: ['synthetic:family'], reason: 'synthetic-explicit-mapping' } })) };
    matrices[role] = {};
    for (const side of ['baseline', 'candidate']) {
      const matrix = { schemaVersion: 1, identity: id, rows };
      matrices[role][side] = { matrix, summary: summarizeCoverage(matrix), binding: null, outcomes: [], familyMetrics: { state: 'unavailable', reason: 'synthetic-family-denominator-unavailable' }, capabilityDeclarations: { state: 'unknown', reason: 'synthetic-declaration-unavailable' } };
    }
  }
  const delta = { previous: { identity: identity('active') }, next: { identity: identity('proposed') }, totals: { kinds: { previous: states.length, next: states.length, delta: 0 } }, attribution: { productRegressionComparison: { reason: 'synthetic-no-exact-control' } }, rows: [] };
  return { coverage: { inventories, matrices }, deltas: { baseline: delta, candidate: delta } };
}
describe('full PII coverage pure resolver, synthetic inputs', () => {
  test('retains all states and source kinds separately for each role and product side', () => {
    const view = resolvePiiCoverageView(publication());
    expect(view.panels.map(panel => panel.id)).toEqual(['coverage-active-baseline', 'coverage-active-candidate', 'coverage-proposed-baseline', 'coverage-proposed-candidate']);
    for (const panel of view.panels) {
      expect(panel.rows.map(record => record.state)).toEqual(COVERAGE_STATES);
      expect(panel.rows.map(record => record.kind)).toEqual(COVERAGE_STATES.map(state => `synthetic/${state}`));
      expect(panel.summaries.find(summary => summary.id === 'discovered').value).toBe(String(COVERAGE_STATES.length));
      expect(panel.rows.every(record => record.id.startsWith(`${panel.id}-`))).toBe(true);
    }
    expect(new Set(view.panels.flatMap(panel => panel.rows.map(record => record.id))).size).toBe(COVERAGE_STATES.length * 4);
    expect(view.panels[2].title).toContain('inactive');
    expect(view.panels[2].note).toContain('No active observation is reused');
  });
  test('aggregate links name actual contributing kinds and preserve the full denominator', () => {
    for (const panel of resolvePiiCoverageView(publication()).panels) {
      expect(panel.summaries.find(summary => summary.id === 'discovered').rowIds).toEqual(panel.rows.map(record => record.id));
      for (const state of COVERAGE_STATES) {
        const summary = panel.summaries.find(item => item.id === `state-${state}`);
        expect(summary.value).toBe('1');
        expect(summary.rowIds).toEqual(panel.rows.filter(record => record.state === state).map(record => record.id));
      }
      for (const summary of panel.summaries) expect(summary.rowIds.every(id => panel.rows.some(record => record.id === id))).toBe(true);
    }
  });
  test('unavailable grains and absent measurements preserve explicit reasons', () => {
    const source = publication(['supported-unmeasured']);
    for (const role of ['active', 'proposed']) for (const side of ['baseline', 'candidate']) {
      const joined = source.coverage.matrices[role][side];
      Object.assign(joined.matrix.rows[0].evidence, { importedCases: null, variants: null, occurrences: null }); joined.summary = summarizeCoverage(joined.matrix);
    }
    for (const panel of resolvePiiCoverageView(source).panels) {
      for (const grain of ['importedCases', 'variants', 'occurrences']) expect(panel.rows[0].counts).toContain(`${grain}: unavailable`);
      expect(panel.rows[0].observation).toContain('absent; synthetic-family-denominator-unavailable');
      expect(panel.rows[0].observation).toContain('No compatible kind observation');
      expect(panel.rows[0].reasons).toContain('no-observation');
      expect(panel.rows[0].observation).not.toMatch(/0 bound variant|accuracy|recall/);
    }
  });
  test('variant observations keep authored IDs and withheld axes without becoming family rates', () => {
    const source = publication(['measured-partial']);
    source.coverage.matrices.active.baseline.outcomes = [{ kindKey: 'synthetic/measured-partial', outcomes: [{ caseId: 'synthetic-case',
      variantId: 'synthetic-variant', family: 'synthetic:family', outcome: { typeIdentity: 'unresolved', range: 'not-applicable', sensitivityContext: 'not-measured', action: { state: 'not-measured' } } }] }];
    const record = resolvePiiCoverageView(source).panels[0].rows[0];
    expect(record.reasons).toContain('synthetic-case'); expect(record.reasons).toContain('synthetic-variant');
    expect(record.reasons).toContain('unresolved'); expect(record.reasons).toContain('not-measured');
    expect(record.observation).toContain('1 bound variant records'); expect(record.observation).toContain('no family rate is inferred');
    expect(record.mapping).toContain('synthetic-context-loss');
  });
  test('empty inventories keep all panels and zero kind counts without invented ratios', () => {
    const view = resolvePiiCoverageView(publication([])); expect(view.panels).toHaveLength(4);
    for (const panel of view.panels) { expect(panel.rows).toEqual([]); expect(panel.summaries.find(summary => summary.id === 'discovered')).toMatchObject({ value: '0', rowIds: [] }); }
    expect(JSON.stringify(view)).not.toMatch(/NaN|Infinity/);
    expect(view.delta.notes.join(' ')).toContain('does not establish a product regression');
  });
  test('immutable links navigate the verified snapshot taxonomy and manifest', () => {
    for (const panel of resolvePiiCoverageView(publication(['measurement-unavailable'])).panels) {
      const root = `https://github.com/synthetic/source/blob/${'f'.repeat(40)}/snapshots/${panel.snapshot}`;
      expect(panel.rows[0].sources).toContainEqual({ label: 'Immutable source taxonomy', href: `${root}/taxonomy/privacy-kinds.json` });
      expect(panel.rows[0].sources).toContainEqual({ label: 'Immutable snapshot manifest', href: `${root}/manifest.json` });
      expect(panel.rows[0].sources).toContainEqual({ label: 'Bound coverage source and variant records', href: '/results/pii-coverage-view-v1.json' });
    }
  });
  test('explicit non-applicability requires a source contract, distinct from product absence', () => {
    const source = publication(['not-applicable', 'product-not-supported']), matrix = source.coverage.matrices.active.baseline.matrix;
    expect(matrix.rows[0].applicability.source).toBe('https://example.invalid/applicability-contract');
    expect(() => createCoverageRow({ ...matrix.rows[0], applicability: { state: 'not-applicable', source: null } }, matrix.identity)).toThrow(/applicability contract/);
    const panel = resolvePiiCoverageView(source).panels[0]; expect(panel.rows[0].state).toBe('not-applicable'); expect(panel.rows[0].capability).toContain('declared');
    expect(panel.rows[1].state).toBe('product-not-supported'); expect(panel.rows[1].capability).toContain('explicitly-absent');
  });
});
