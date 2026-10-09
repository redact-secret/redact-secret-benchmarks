import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { createCoverageRow, COVERAGE_STATES } from '../../../scripts/lib/pii-coverage-model.mjs';
import { summarizeCoverage } from '../../../scripts/lib/pii-coverage-summary.mjs';
import { resolvePiiCatalog, resolvePiiMethodology } from '../../resolvers/pii-overview';
import { resolvePiiView } from '../../resolvers/domains';
import { PiiCatalog } from '../../components/coverage/pii';
import { PiiMethodology } from '../../components/evaluation/pii';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogExportProblems, piiDetailDestinationsProblems } from '../../scripts/check-export-pii-coverage.mjs';
import { independenceClaims } from '../../../benchmarks/lib/evidence-classes';

const pii = (extra = {}) => ({ state: 'not-recorded', reason: 'synthetic absent', authority: { authority: 'legacy', protectedPending: ['synthetic-protected'], unmet: [], total: 0 }, ...extra });
function publication() {
  const identity = { snapshotId: 'synthetic-active', snapshotCommitment: 'a'.repeat(64), productCommitment: 'b'.repeat(64), mappingRevision: 1, mappingCommitment: 'c'.repeat(64), protocol: 'synthetic/1', population: 'd'.repeat(64), visibility: 'public', role: 'baseline', bindingCommitment: 'e'.repeat(64) };
  const rows = COVERAGE_STATES.map((state, index) => {
    const input = { kindKey: `synthetic/${state}`, label: `Synthetic ${state}`, domains: index % 2 ? ['PHI'] : ['PII'], jurisdictions: ['XX'],
      evidence: { availability: 'accepted', authoredCases: 2, acceptedCases: 2, fixtures: 4, variants: 4, occurrences: null, importedCases: 2 },
      capability: { state: 'declared', source: 'https://example.invalid/declaration', productCommitment: identity.productCommitment },
      mapping: { state: 'faithful', losses: [], requiredAxes: ['identity'], representableAxes: ['identity'] },
      observation: { status: 'valid', source: 'synthetic', identity, axes: [{ axis: 'identity', eligible: 2, measured: 2, satisfied: 2, missed: 0, unresolved: 0, withheld: 0 }] }, applicability: { state: 'applicable', source: 'synthetic' }, reasons: [] };
    if (state === 'supported-unmeasured') input.observation = { status: 'absent', source: null, identity: null, axes: [] };
    if (state === 'product-not-supported') input.capability.state = 'explicitly-absent';
    if (state === 'measurement-unavailable') input.capability = { state: 'unknown', source: null, productCommitment: null };
    if (state === 'evaluator-not-representable') Object.assign(input.mapping, { state: 'not-representable', representableAxes: [] });
    if (state === 'evidence-deferred') Object.assign(input.evidence, { availability: 'deferred', acceptedCases: 0 });
    if (state === 'not-applicable') input.applicability.state = 'not-applicable';
    if (state === 'measured-missed') Object.assign(input.observation.axes[0], { satisfied: 1, missed: 1 });
    if (state === 'measured-partial') Object.assign(input.mapping, { state: 'partial', losses: ['synthetic-context-loss'] });
    return createCoverageRow(input, identity);
  });
  const joined = { matrix: { schemaVersion: 1, identity, rows }, summary: summarizeCoverage({ schemaVersion: 1, identity, rows }),
    binding: { product: { version: 'synthetic-release', sourceCommit: 'f'.repeat(40) }, scanner: { activation: ['pii:synthetic'], configurationDigest: 'config-a', activationDigest: 'activation-a' }, engine: { commit: 'engine-a', binarySha256: 'binary-a' } },
    capabilityDeclarations: { state: 'provided-exact-product', reason: null }, familyMetrics: { state: 'unavailable', reason: 'synthetic-no-family-denominator' } };
  const inventory = { source: { snapshot: { id: 'synthetic-active' }, release: { repository: 'synthetic/evidence', commit: '1'.repeat(40) } }, limitations: ['synthetic-language-unavailable'] };
  return { coverage: { matrices: { active: { baseline: joined, candidate: { matrix: { rows: [{ label: 'Candidate must not enter catalog' }] } } }, proposed: { baseline: { matrix: { rows: [{ label: 'Proposal must not enter catalog' }] } } } }, inventories: { active: inventory } } };
}

describe('PII coverage overview uses existing source-bound inventory', () => {
  test('independently recounts all states and never drops unsupported or unrepresentable kinds', () => {
    const source = publication(), catalog = resolvePiiCatalog(source, pii());
    expect(catalog.rows).toHaveLength(source.coverage.matrices.active.baseline.matrix.rows.length);
    expect(catalog.rows.map(row => row.state)).toEqual(COVERAGE_STATES);
    expect(catalog.summary).toContain(`${COVERAGE_STATES.length} source-exposed kinds`);
    expect(catalog.summary).not.toMatch(/\d+%|qualified coverage percentage/);
    expect(JSON.stringify(catalog)).not.toContain('Candidate must not enter catalog');
    expect(JSON.stringify(catalog)).not.toContain('Proposal must not enter catalog');
    expect(catalog.rows.every(row => row.href.startsWith('/evaluation/pii/evidence/#coverage-active-baseline-'))).toBe(true);
  });
  test('configuration differences retain exact identity and separate language from jurisdiction and PHI', () => {
    const source = publication(), a = resolvePiiCatalog(source, pii());
    source.coverage.matrices.active.baseline.binding.scanner = { activation: ['pii:other'], configurationDigest: 'config-b', activationDigest: 'activation-b' };
    const b = resolvePiiCatalog(source, pii());
    expect(a.facts.find(fact => fact.term === 'Catalog configuration').description).toContain('config-a');
    expect(b.facts.find(fact => fact.term === 'Catalog configuration').description).toContain('pii:other');
    expect(b.facts.find(fact => fact.term === 'Catalog configuration').description).toContain('config-b');
    for (const row of b.rows) { expect(row.jurisdictions).toBe('XX'); expect(row.language).toContain('Not recorded'); }
    expect(b.limitations.join(' ')).toContain('do not establish PHI');
    expect(b.qualification).toContain('not recorded');
  });
  test('absent publication, binding and empty inventory remain unavailable without made-up zero rates', () => {
    const absent = resolvePiiCatalog(null, pii(), 'synthetic binding invalid');
    expect(absent.rows).toEqual([]); expect(absent.emptyReason).toBe('synthetic binding invalid');
    expect(absent.facts[1].description).toContain('Not recorded');
    const source = publication(); source.coverage.matrices.active.baseline.binding = null; source.coverage.matrices.active.baseline.matrix.rows = [];
    const empty = resolvePiiCatalog(source, pii()); expect(empty.emptyReason).toContain('No coverage ratio');
    render(React.createElement(PiiCatalog, absent));
    expect(screen.getByText('Catalog unavailable')).toBeVisible();
    expect(screen.getByRole('link', { name: /Full evidence-kind inventory/ })).toHaveAttribute('href', '/evaluation/pii/evidence/');
  });
  test('installed baseline and candidate activation stay separate from public measurement and qualification', () => {
    const activation = selector => ({ surfaces: [{ surface: 'node-addon', checks: [{ artifact: 'addon', requestedSelectors: [selector], activationIdentity: selector }] }] });
    const target = { sourceCommit: 'current-target', publicMeasurement: { state: 'recorded' }, gates: { publicQualification: 'not-evaluated', protectedPath: 'pending-not-operational', protectedPartition: 'not-run' } };
    const comparison = { state: 'recorded', baseline: { version: 'synthetic-release', sourceCommit: 'baseline', packageTreeSha256: 'tree-a' }, candidate: { version: 'synthetic-candidate', sourceCommit: 'current-target', packageTreeSha256: 'tree-b' }, activation: { baseline: activation('pii:baseline'), candidate: activation('pii:candidate') } };
    const catalog = resolvePiiCatalog(publication(), pii({ currentQualification: target, candidateComparison: comparison }));
    expect(catalog.activation[0].text).toContain('pii:baseline'); expect(catalog.activation[1].text).toContain('pii:candidate');
    expect(catalog.activation[1].title).toContain('not a release');
    expect(catalog.qualification).toContain('qualification not established'); expect(catalog.qualification).toContain('protected partition not-run');
    expect(catalog.rows[0].capability).not.toContain('current-target');
    const absentDeclaration = catalog.rows.find(row => row.state === 'measurement-unavailable');
    expect(absentDeclaration.capability).toContain('unknown'); expect(absentDeclaration.declarationHref).toBeUndefined();
  });
  test('activation metadata starts collapsed while qualification limitations stay visible', () => {
    const catalog = resolvePiiCatalog(publication(), pii());
    catalog.activation = [{ title: 'Synthetic baseline activation', text: 'Exact synthetic addon and WASM activation identities retained.' },
      { title: 'Synthetic candidate activation, not a release', text: 'Exact synthetic candidate selector and configuration retained.' }];
    const { container } = render(React.createElement(PiiCatalog, catalog));
    const disclosures = [...container.querySelectorAll('details')].filter(details => catalog.activation.some(item => item.title === details.querySelector('summary')?.textContent));
    expect(disclosures).toHaveLength(2);
    for (const details of disclosures) expect(details).not.toHaveAttribute('open');
    expect(screen.getByText(catalog.activation[0].text)).not.toBeVisible();
    expect(screen.getByText(catalog.activation[1].text)).not.toBeVisible();
    expect(screen.getByText(catalog.qualification)).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Exact kind evidence and reasons', hidden: true }).every(link => link.parentElement.tagName === 'P')).toBe(true);
  });
});

describe('independent PII catalog export recount', () => {
  const exported = source => renderToStaticMarkup(React.createElement(PiiCatalog, resolvePiiCatalog(source, pii())));
  const mutate = (html, change) => { const element = document.createElement('div'); element.innerHTML = html; change(element); return element.innerHTML; };
  test('closed native details preserve every visible kind and state and inspectable source metadata', () => {
    const source = publication(), html = exported(source);
    expect(catalogExportProblems(html, source)).toEqual([]);
    const empty = publication(); empty.coverage.matrices.active.baseline.matrix.rows = [];
    expect(catalogExportProblems(exported(empty), empty)).toEqual([]);
  });
  test('rejects dropped/hidden kinds, rewritten declarations, inflated counts and wrong source bindings', () => {
    const source = publication(), html = exported(source);
    for (const change of [
      element => element.querySelector('[data-pii-catalog-kind]').remove(),
      element => element.querySelector('[data-pii-catalog-kind]').setAttribute('hidden', ''),
      element => element.querySelector('[data-pii-catalog-kind] strong').textContent = 'qualified',
      element => element.querySelector('[data-pii-catalog-summary]').textContent = '999 source-exposed kinds',
      element => element.querySelector('[data-pii-catalog-summary]').textContent = element.querySelector('[data-pii-catalog-summary]').textContent.replace('measured-missed: 1;', 'measured-missed: 111;'),
      element => [...element.querySelectorAll('dt')].find(term => term.textContent === 'Declared implementation').nextElementSibling.textContent = 'supported',
      element => [...element.querySelectorAll('dt')].find(term => term.textContent === 'Catalog configuration').nextElementSibling.textContent = 'config-from-another-run',
    ]) expect(catalogExportProblems(mutate(html, change), source).length).toBeGreaterThan(0);
  });
  test('methodology and all bounded result controls and reciprocal evidence destinations remain reachable', () => {
    const methodology = renderToStaticMarkup(React.createElement(PiiMethodology, resolvePiiMethodology(resolvePiiView(pii()))));
    const results = '<label>Population or report</label><select><option>Synthetic population A</option><option>Synthetic population B</option></select><label>Metric or category</label><select><option>Withheld</option></select><label>Population and coverage</label><select><option>Unavailable</option></select><button>Sources and execution details</button>';
    const evidence = '<nav aria-label="PII evidence destinations"><a href="/coverage/pii/">Coverage</a><a href="/evaluation/pii/">Methodology</a><a href="/evaluation/pii/results/">Results</a></nav>';
    expect(piiDetailDestinationsProblems(methodology, results, evidence)).toEqual([]);
    expect(piiDetailDestinationsProblems(methodology, results.replace('Metric or category', 'Gone'), evidence)).toContain('results-selector:Metric or category');
    expect(piiDetailDestinationsProblems(methodology, results, evidence.replace('/coverage/pii/', '/other/'))).toContain('evidence-reciprocal-destination:/coverage/pii/');
  });
});

describe('PII methodology and preserved result destinations', () => {
  test('keeps authored type and sensitivity axes and six methods, independent denominators and all repository links', () => {
    const view = resolvePiiView(pii()), overview = resolvePiiMethodology(view);
    expect(independenceClaims(renderToStaticMarkup(React.createElement(PiiMethodology, overview)))).toEqual([]);
    expect(overview.method.vocabularies.map(row => row.title)).toEqual(['Type identity', 'Sensitivity in context']);
    expect(overview.method.methods).toHaveLength(6);
    expect(overview.repositories.map(repo => repo.href)).toContain('https://github.com/redact-secret/pii-evidence');
    expect(overview.repositories.map(repo => repo.href)).toContain('https://github.com/redact-secret/pii-eval');
    expect(overview.qualification).toContain('Not established');
    render(React.createElement(PiiMethodology, overview));
    expect(screen.getByRole('link', { name: 'Open PII coverage' })).toHaveAttribute('href', '/coverage/pii/');
    expect(screen.getByRole('link', { name: /Population results, all metric selectors/ })).toHaveAttribute('href', '/evaluation/pii/results/');
    expect(screen.getByRole('link', { name: /Complete ten-metric definitions/ })).toHaveAttribute('href', overview.definitionsHref);
    expect(overview.definitionsHref).toContain('/metric-basis.mjs');
    expect(screen.getByRole('link', { name: /Benchmark qualification profile/ })).toHaveAttribute('href', overview.policyHref);
    expect(overview.policyHref).toContain('/qualification/pii-v1.json');
    expect(screen.getByText('pii-v1 and b11 are different quantities.')).toBeVisible();
    expect(screen.getByText(/thresholds are not applied to pii-v1 observations/)).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/Synthetic rates are not production rates/)).toBeVisible();
  });
  test('missing presentation summary never infers qualification', () => {
    const view = resolvePiiView(pii()); delete view.presentationSummary;
    expect(resolvePiiMethodology(view).qualification).toContain('not recorded');
    view.method.metrics.rows = [{ id: 'type-miss-rate', population: 'synthetic authored occurrences', counts: 'synthetic numerator of resolved authored types', better: 'Lower' }];
    const metric = resolvePiiMethodology(view).method.metrics.rows[0];
    expect(metric.id).toBe('pii-v1:type-miss-rate');
    expect(metric.counts).toBe(view.method.metrics.rows[0].counts);
  });
});
