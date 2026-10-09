import { expect, test } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PiiCoverageMatrix } from '../../components/evaluation/domain/PiiCoverageMatrix.tsx';
import { resolvePiiCoverageView } from '../../resolvers/pii-coverage.ts';
import { coverageExportProblems } from '../../scripts/check-export-pii-coverage.mjs';
import { createCoverageRow, COVERAGE_STATES } from '../../../scripts/lib/pii-coverage-model.mjs';
import { summarizeCoverage } from '../../../scripts/lib/pii-coverage-summary.mjs';
import { buildPiiCoverageDelta } from '../../../scripts/lib/pii-coverage-delta.mjs';

const hex = character => character.repeat(64);
function identity(role, side) {
  return { snapshotId: `synthetic-${role}`, snapshotCommitment: hex(role === 'active' ? 'a' : 'b'), productCommitment: hex(side === 'baseline' ? '1' : '2'),
    mappingRevision: 2, mappingCommitment: hex('c'), protocol: 'synthetic-protocol/2', population: hex('d'), visibility: 'public',
    role: role === 'active' ? side : 'proposed', bindingCommitment: hex(side === 'baseline' ? '3' : '4') };
}
function rows(binding, proposal) {
  const base = { label: 'Synthetic kind', domains: ['PII', 'PHI'], jurisdictions: ['US', 'GB'],
    evidence: { availability: 'accepted', authoredCases: 2, importedCases: 2, fixtures: 2, variants: 2, occurrences: null, acceptedCases: 2 },
    capability: { state: 'declared', source: 'synthetic-declaration', productCommitment: binding.productCommitment },
    mapping: { state: 'faithful', losses: [], requiredAxes: ['identity'], representableAxes: ['identity'] },
    observation: { status: 'valid', identity: binding, source: 'synthetic-run', axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 2, missed: 0, unresolved: 0, withheld: 0 }] },
    applicability: { state: 'applicable', source: 'synthetic-contract' }, reasons: [] };
  const changes = [{},
    { observation: { ...base.observation, axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 1, missed: 1, unresolved: 0, withheld: 0 }] } },
    { mapping: { state: 'partial', losses: ['contexts-not-carried'], requiredAxes: ['identity', 'context'], representableAxes: ['identity'] } },
    { observation: { status: 'absent', identity: null, source: null, axes: [] } },
    { capability: { state: 'unknown', source: null, productCommitment: null } },
    { capability: { state: 'explicitly-absent', source: 'synthetic-exclusion', productCommitment: binding.productCommitment } },
    { mapping: { state: 'not-representable', losses: ['phi-domain-not-carried'], requiredAxes: ['domain'], representableAxes: [] } },
    { evidence: { ...base.evidence, availability: 'deferred', acceptedCases: 0 } },
    { applicability: { state: 'not-applicable', source: 'synthetic-exclusion-contract' } }];
  return changes.map((change, index) => createCoverageRow({ ...structuredClone(base), ...change, kindKey: `synthetic-kind-${index}`, label: `Synthetic kind ${index}`,
    ...(proposal ? { observation: { status: 'absent', identity: null, source: null, axes: [] } } : {}) }, binding));
}
function publication(empty = false) {
  const inventories = {}, matrices = {};
  for (const role of ['active', 'proposed']) {
    matrices[role] = {};
    for (const side of ['baseline', 'candidate']) {
      const binding = identity(role, side), kindRows = empty ? [] : rows(binding, role === 'proposed');
      const matrix = { schemaVersion: 1, identity: binding, rows: kindRows };
      matrices[role][side] = { matrix, summary: summarizeCoverage(matrix), binding: null, outcomes: [], familyMetrics: { state: 'unavailable', reason: 'synthetic-no-family-rate' },
        capabilityDeclarations: { state: 'provided-exact-product', reason: null } };
      if (side === 'baseline') inventories[role] = { role, source: { snapshot: { id: binding.snapshotId, contentDigest: binding.snapshotCommitment }, release: { repository: 'synthetic/evidence', commit: 'a'.repeat(40) } },
        totals: { kinds: kindRows.length, authoredCases: kindRows.length * 2, fixtures: kindRows.length * 2, importedCases: kindRows.length * 2, variants: kindRows.length * 2, occurrences: null },
        losses: { 'contexts-not-carried': 1 }, limitations: ['synthetic-per-kind-loss-count-unavailable'],
        rows: kindRows.map(row => ({ ...row, mapping: { ...row.mapping, families: ['synthetic-family'], reason: 'synthetic-source-mapping' }, research: { openQuestions: [] }, emptyReasons: [] })) };
    }
  }
  const deltas = Object.fromEntries(['baseline', 'candidate'].map(side => [side, buildPiiCoverageDelta({ previous: matrices.active[side].matrix, next: matrices.proposed[side].matrix, mode: 'active-vs-proposed' })]));
  return { schema: 'pii-coverage-publication/1', supportClaims: false, qualified: false, sources: [], coverage: { inventories, matrices }, deltas };
}
const render = value => renderToStaticMarkup(React.createElement(PiiCoverageMatrix, resolvePiiCoverageView(value)));
function mutate(html, change) { const container = document.createElement('div'); container.innerHTML = html; change(container); return container.innerHTML; }
const rejected = (html, value) => expect(coverageExportProblems(html, value).length).toBeGreaterThan(0);

test('synthetic nine-state and empty pure resolver/component exports pass independent recount', () => {
  const value = publication();
  expect(value.coverage.matrices.active.baseline.matrix.rows.map(row => row.state)).toEqual(COVERAGE_STATES);
  expect(coverageExportProblems(render(value), value)).toEqual([]);
  const empty = publication(true), html = render(empty);
  expect(coverageExportProblems(html, empty)).toEqual([]);
  expect(html).toContain('Ratios are unavailable'); expect(html).not.toMatch(/0%|100%/);
});

test('source row deletion, duplication, state rewrite, hidden/default flags and summary errors refuse', () => {
  const value = publication(), html = render(value);
  const changes = [
    container => container.querySelector('[data-coverage-kind]').remove(),
    container => { const row = container.querySelector('[data-coverage-kind]'); row.parentNode.append(row.cloneNode(true)); },
    container => container.querySelector('[data-coverage-kind]').setAttribute('data-coverage-state', 'stable'),
    container => container.querySelector('[data-coverage-kind]').setAttribute('hidden', ''),
    container => container.querySelector('[data-coverage-kind]').setAttribute('style', 'display: none'),
    container => container.querySelector('[data-coverage-kind]').setAttribute('aria-hidden', 'true'),
    container => { container.querySelector('[data-coverage-kind] p:nth-of-type(3)').textContent = 'Product capability: stable'; },
    container => { container.querySelector('[data-coverage-kind] p:nth-of-type(4)').textContent = 'Evaluator: faithful'; },
    container => { container.querySelector('[data-coverage-kind] p:nth-of-type(5)').textContent = 'Observation: pass'; },
    container => container.querySelector('[data-coverage-panel] > details').setAttribute('hidden', ''),
    container => { container.querySelector('[data-coverage-kind] p:nth-of-type(2)').textContent = 'authoredCases: 999'; },
    container => { const observation = container.querySelector('[data-coverage-kind] p:nth-of-type(5)'); observation.textContent = observation.textContent.replace('eligible 2', 'eligible 999'); },
    container => container.querySelector('[data-coverage-summary="discovered"]').setAttribute('data-coverage-value', '999'),
  ];
  for (const change of changes) rejected(mutate(html, change), value);
});

test('visible state/count wording and duplicate summary controls cannot disagree with truthful metadata', () => {
  const value = publication(), html = render(value);
  rejected(mutate(html, container => { container.querySelector('[data-coverage-kind] strong').textContent = 'stable'; }), value);
  rejected(mutate(html, container => { container.querySelector('[data-coverage-summary="discovered"] dd').textContent = '999'; }), value);
  rejected(mutate(html, container => { const count = container.querySelector('[data-coverage-summary="discovered"] dd'); const hidden = document.createElement('span'); hidden.hidden = true; hidden.textContent = count.textContent; count.replaceChildren(hidden); }), value);
  rejected(mutate(html, container => { const summary = container.querySelector('[data-coverage-summary="discovered"]'); summary.parentNode.append(summary.cloneNode(true)); }), value);
});

test('hidden matrix ancestors and wrong snapshot attributes refuse full-denominator default exports', () => {
  const value = publication(), html = render(value);
  rejected(mutate(html, container => container.querySelector('[data-coverage-panel]').setAttribute('hidden', '')), value);
  rejected(mutate(html, container => container.querySelector('[data-coverage-panel] ul').setAttribute('hidden', '')), value);
  rejected(mutate(html, container => container.querySelector('[data-coverage-panel]').setAttribute('style', 'visibility: hidden')), value);
  rejected(mutate(html, container => container.querySelector('[data-coverage-summary="discovered"] dd').setAttribute('hidden', '')), value);
  rejected(mutate(html, container => container.querySelector('[data-coverage-panel]').setAttribute('data-coverage-snapshot', 'wrong-snapshot')), value);
});

test('source/run provenance, inactive labeling and baseline/candidate side identities refuse mixing', () => {
  const value = publication(), html = render(value);
  const changes = [
    text => text.replaceAll(hex('a'), hex('f')), text => text.replaceAll(hex('c'), hex('f')), text => text.replaceAll(hex('d'), hex('f')),
    text => text.replaceAll(hex('1'), hex('2')), text => text.replaceAll(hex('3'), hex('4')),
    text => text.replaceAll('inactive, unmeasured', 'released'),
    text => text.replace('data-coverage-panel="coverage-active-baseline"', 'data-coverage-panel="coverage-active-candidate"'),
    text => text.replace('data-coverage-delta="true"', 'data-coverage-delta="false"'),
    text => text.replace('Kind counts are not detection accuracy', 'Full product accuracy'),
  ];
  for (const change of changes) rejected(change(html), value);
});
