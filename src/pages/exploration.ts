import { taxonomy, familyById } from '../../benchmarks/support/taxonomy';
import { categories, scenarios, type Fixture } from '../catalog';
import { escapeHtml as e, evidenceCrumb } from '../components';

const n = (value: number) => value.toLocaleString('en-US');
const providerOf = (id: string | null) => taxonomy.providers.find(provider => provider.id === id);
export const familyHref = (id: string) => `/coverage/${id}`;

export function explorationSections(fixtures: Fixture[]): string {
  return `<section class="section" id="test-scenarios"><h2 class="h2-compact">Test scenarios</h2><p class="small">The questions exercised by the corpus. Membership overlaps, so scenario counts do not add up to the corpus or change its accounting.</p><div class="tbl"><table><thead><tr><th scope="col">Scenario</th><th scope="col" class="num">Fixtures</th><th scope="col">Question</th></tr></thead><tbody>${scenarios.map(scenario => `<tr><td><a href="/scenarios/${e(scenario.id)}">${e(scenario.title)}</a></td><td class="num">${n(fixtures.filter(fixture => fixture.scenarioIds.includes(scenario.id)).length)}</td><td>${e(scenario.description)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="section" id="development-history"><h2 class="h2-compact">Development history</h2><p class="small">Source suites preserve when fixtures were introduced and which corpus was executed. They are provenance, not a second scenario taxonomy.</p><div class="tbl"><table><thead><tr><th scope="col">Execution suite</th><th scope="col" class="num">Fixtures</th><th scope="col">Adoption context</th></tr></thead><tbody>${categories.map(category => `<tr><td><a href="/suites/${e(category.id)}">${e(category.title)}</a></td><td class="num">${n(fixtures.filter(fixture => fixture.category === category.id).length)}</td><td>${e(category.description)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

export function fixtureFamilyNavigation(fixture: Fixture): string {
  const resolved = fixture.familyIds.map(id => ({ id, family: familyById(id) }));
  if (!resolved.length) {
    const reason = fixture.unscopedReason || 'No reviewed credential-family relationship is recorded.';
    return `${evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: 'Unscoped' }, { label: fixture.id }])}<p class="small fixture-scope"><b>Unscoped fixture.</b> ${e(reason)}</p>`;
  }
  if (resolved.length === 1 && resolved[0].family) {
    const family = resolved[0].family, provider = providerOf(family.provider);
    return evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: provider?.name ?? 'Global', href: '/coverage' }, { label: family.name, href: familyHref(family.id) }, { label: fixture.id }]);
  }
  const items = resolved.map(({ id, family }) => {
    if (!family) return `<li><b>Unresolved family</b> <code>${e(id)}</code></li>`;
    const provider = providerOf(family.provider);
    return `<li>${e(provider?.name ?? 'Global')} <span aria-hidden="true">→</span> <a href="${e(familyHref(family.id))}">${e(family.name)}</a></li>`;
  }).join('');
  return `${evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: 'Multiple families' }, { label: fixture.id }])}<nav class="fixture-scope" aria-label="Fixture family relationships"><p class="small"><b>Reviewed family relationships</b></p><ul>${items}</ul></nav>`;
}

export function fixtureProjectionLinks(fixture: Fixture): string {
  const scenarioLinks = fixture.scenarioIds.map(id => {
    const scenario = scenarios.find(item => item.id === id);
    return scenario ? `<a href="/scenarios/${e(id)}">${e(scenario.title)}</a>` : `<span>Unresolved scenario <code>${e(id)}</code></span>`;
  }).join(' · ') || 'No scenario recorded';
  const category = categories.find(item => item.id === fixture.provenance.categoryId);
  return `<dl class="fixture-projections"><dt>Test scenarios</dt><dd>${scenarioLinks}</dd><dt>Development history</dt><dd><a href="/suites/${e(fixture.provenance.categoryId)}">${e(category?.title ?? fixture.provenance.categoryId)}</a>${fixture.provenance.issue ? ` · issue #${fixture.provenance.issue}` : ''}${fixture.provenance.milestone ? ` · ${e(fixture.provenance.milestone)}` : ''}${fixture.provenance.release ? ` · ${e(fixture.provenance.release)}` : ''}</dd></dl>`;
}
