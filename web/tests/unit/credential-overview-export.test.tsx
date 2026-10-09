// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CredentialCoverage } from '../../components/coverage/credential';
import { exampleCoverage } from '../../components/coverage/credential/CredentialCoverage.stories';
import { CredentialMethodology } from '../../components/evaluation/credential';
import { resolveCredentialMethodology } from '../../resolvers/credential-methodology';
import { view } from '../../components/evaluation/domain/storyData';
import { credentialCoverageExportProblems, credentialMethodologyExportProblems } from '../../scripts/check-export-credential-overviews.mjs';

const stamp = <aside data-pipeline="legacy" data-role="authority">Synthetic source</aside>;
const expected = {
  authority: 'legacy', taxonomy: { families: [{ id: 'example:token' }] }, fixtures: [{ familyIds: ['example:token'] }],
  scope: { boundTo: { release: 'synthetic', mode: 'default' }, outOfScope: [{ text: 'Example optional profile is off.' }] }, scoredCount: null,
};
const coverage = () => renderToStaticMarkup(<CredentialCoverage {...exampleCoverage}
  binding="Unknown: synthetic no run." providers={exampleCoverage.providers.map(provider => ({ ...provider, rows: provider.rows.map(row => ({ ...row, href: '/report/families/example--token/', qualification: 'Not recorded for this family and measured product.' })) }))}
  counts={[{ label: 'Taxonomy families, not a support claim', value: '1' }, { label: 'Families with fixtures', value: '1' },
    { label: 'Families with recorded capability declarations', value: 'Not recorded' }, { label: 'Families in the bound qualification record', value: 'Not recorded' }]} sourceContent={stamp} />);

describe('independent credential overview export guards', () => {
  test('recounts raw taxonomy and unique fixture memberships and keeps source-bound absence', () => {
    expect(credentialCoverageExportProblems(coverage(), expected)).toEqual([]);
    expect(credentialCoverageExportProblems(coverage(), { ...expected, fixtures: [{ familyIds: ['example:token'] }, { familyIds: ['example:token'] }] })).toEqual([]);
  });
  test('rejects a changed visible count, absent row, hidden declaration or inferred qualification', () => {
    const html = coverage();
    expect(credentialCoverageExportProblems(html.replace('>1</dd>', '>999</dd>'), expected)).toContain('coverage-count:Taxonomy families, not a support claim');
    expect(credentialCoverageExportProblems(html.replace('id="coverage-example--token"', 'id="removed"'), expected)).toContain('coverage-family-roster');
    expect(credentialCoverageExportProblems(html.replace('Unknown: no source-bound declaration.', 'Declared supported'), expected)).toContain('coverage-inferred-declaration:example:token');
    expect(credentialCoverageExportProblems(html.replace('Not recorded for this family and measured product.', 'Stable for current product'), expected)).toContain('coverage-qualification:example:token');
    expect(credentialCoverageExportProblems(html.replace('id="coverage-example--token"', 'hidden="" id="coverage-example--token"'), expected)).toContain('coverage-family-hidden');
  });
  test('scope mismatch and omitted source statements cannot pass using metadata markers', () => {
    expect(credentialCoverageExportProblems(coverage(), { ...expected, product: { version: 'other', mode: 'default' } })).toContain('coverage-scope-binding');
    expect(credentialCoverageExportProblems(coverage().replace('Example optional profile is off.', 'Everything is active.'), expected)).toContain('coverage-scope-statement');
  });
  test('methodology retains all repository, policy and method detail links and excludes result inventories', () => {
    const html = renderToStaticMarkup(<CredentialMethodology {...resolveCredentialMethodology(view)} sourceContent={stamp} />);
    expect(credentialMethodologyExportProblems(html, 'legacy')).toEqual([]);
    expect(credentialMethodologyExportProblems(html.replace('href="https://github.com/redact-secret/credential-eval"', 'href="/wrong/"'), 'legacy')).toContain('methodology-link:https://github.com/redact-secret/credential-eval');
    expect(credentialMethodologyExportProblems(`${html}<table><caption>Fixtures by kind and level</caption></table>`, 'legacy')).toContain('methodology-result-inventory');
    expect(credentialMethodologyExportProblems(html.replace('id="by-kind"', 'id="old-bookmark-lost"'), 'legacy')).toContain('methodology-bookmark:by-kind');
  });
});
