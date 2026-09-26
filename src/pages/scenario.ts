import { taxonomy, familyById } from '../../benchmarks/support/taxonomy';
import { actionEmptyState, escapeHtml as e, evidenceCrumb } from '../components';
import { categories, scenarios, type Fixture } from '../catalog';
import { familyHref } from './exploration';

const providerName = (id: string | null) => taxonomy.providers.find(provider => provider.id === id)?.name ?? 'Global';

export function scenarioPage(fixtures: Fixture[], id: string): string {
  const scenario = scenarios.find(item => item.id === id);
  const crumb = evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: 'Test scenarios', href: '/coverage#test-scenarios' }, { label: scenario?.title ?? id }]);
  if (!scenario) return `${crumb}<div class="page-head"><div><h1>No such test scenario</h1></div></div>${actionEmptyState({ title: `No test scenario is registered as “${e(id)}”`, body: `Scenarios come from <code>benchmarks/scenarios.json</code>: ${scenarios.map(item => `<a href="/scenarios/${e(item.id)}">${e(item.title)}</a>`).join(', ')}.` })}`;
  const selected = fixtures.filter(fixture => fixture.scenarioIds.includes(id));
  const head = `${crumb}<div class="page-head"><div><p class="eyebrow">TEST SCENARIO</p><h1>${e(scenario.title)}</h1><div class="meta"><span><b>${selected.length.toLocaleString('en-US')}</b> fixtures</span><span>Overlapping projection</span></div></div></div><p class="prose">${e(scenario.description)}</p><p class="small">Scenario membership projects the same canonical fixtures across questions. It does not change fixture bytes, accounting, source suites, or execution provenance.</p>`;
  if (!selected.length) return head + actionEmptyState({ title: 'No fixtures are assigned to this scenario', body: 'The scenario remains registered, but the semantic index does not currently attach a fixture to it.' });
  const familyCell = (fixture: Fixture) => fixture.familyIds.length ? fixture.familyIds.map(familyId => {
    const family = familyById(familyId);
    return family ? `${e(providerName(family.provider))} <span aria-hidden="true">→</span> <a href="${e(familyHref(family.id))}">${e(family.name)}</a>` : `Unresolved family <code>${e(familyId)}</code>`;
  }).join('<br>') : `<b>Unscoped</b><small>${e(fixture.unscopedReason ?? 'No reason recorded')}</small>`;
  return `${head}<div class="tbl wide" tabindex="0" role="region" aria-label="Fixtures in ${e(scenario.title)}"><table><thead><tr><th scope="col">Fixture</th><th scope="col">Credential family</th><th scope="col">Development history</th></tr></thead><tbody>${selected.map(fixture => {
    const category = categories.find(item => item.id === fixture.provenance.categoryId);
    return `<tr><td><a href="/fixture/${e(fixture.slug)}">${e(fixture.id)}</a><small><code>${e(fixture.slug)}</code></small></td><td>${familyCell(fixture)}</td><td><a href="/suites/${e(fixture.provenance.categoryId)}">${e(category?.title ?? fixture.provenance.categoryId)}</a>${fixture.provenance.issue ? `<small>Issue #${fixture.provenance.issue}</small>` : ''}${fixture.provenance.milestone ? `<small>${e(fixture.provenance.milestone)}</small>` : ''}${fixture.provenance.release ? `<small>${e(fixture.provenance.release)}</small>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
