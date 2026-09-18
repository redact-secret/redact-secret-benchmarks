import inventory from '../../benchmarks/detector-inventory.json';
import rawGaps from '../../benchmarks/known-gaps.json';
import { validateKnownGaps, type KnownGaps } from '../../benchmarks/lib/promotion';
import { filterInventory } from '../inventory.mjs';
import { title } from './browse';
import { escape as e } from '../types';

const tools = { gitleaks: 'Gitleaks', trufflehog: 'TruffleHog' };
const gaps = validateKnownGaps(rawGaps as unknown as KnownGaps);
type Entry = (typeof inventory.entries)[number];
const pageSize = 50;
const rows = (entries: Entry[]) => entries.map(row => `<tr><td class="wrap-cell"><a class="text-link" href="${e(row.sourceUrl)}" target="_blank" rel="noreferrer">${e(row.id)} ↗</a><small>${e(tools[row.tool as keyof typeof tools])} ${e(inventory.sources[row.tool as keyof typeof tools].version)}</small></td><td class="wrap-cell">${row.relatedDetector ? `<span class="outcome">Related family · parity unverified</span><small><a class="text-link" href="/benchmark/${e(row.relatedDetector)}">${e(row.relatedDetector)}</a></small>` : '<span class="outcome miss">No dedicated detector</span><small>Generic detection may still apply</small>'}</td><td class="wrap-cell">${row.activation === 'feature-gated' ? 'Feature-gated registration' : row.tool === 'gitleaks' ? 'Default rule' : 'Registered detector'}<small>${row.activation === 'feature-gated' ? e(row.featureFlag) : 'Source inventory · not runtime-tested here'}</small></td></tr>`).join('');

export function coverageGaps() {
  const missing = inventory.entries.filter(row => row.status === 'no-dedicated-detector');
  const count = (tool: string) => missing.filter(row => row.tool === tool).length;
  return title('Coverage gaps', 'Competitor detector inventory and measured regressions tracked for the next release.', 'BENCHMARK / COVERAGE') + `
    <section class="stats"><article><span>GITLEAKS · NO DEDICATED EQUIVALENT</span><strong>${count('gitleaks')}</strong><small>Of ${inventory.entries.filter(r => r.tool === 'gitleaks').length} rules · v${e(inventory.sources.gitleaks.version)}</small></article><article><span>TRUFFLEHOG · NO DEDICATED EQUIVALENT</span><strong>${count('trufflehog')}</strong><small>Of ${inventory.entries.filter(r => r.tool === 'trufflehog').length} registrations · v${e(inventory.sources.trufflehog.version)}</small></article><article><span>MEASURED BETA.3 REGRESSIONS</span><strong>6</strong><small>3 false positives · 3 missed spans · 3 issues</small></article></section>
    <div class="notice"><div><strong>Missing a dedicated detector is different from missing a secret.</strong><p>This compares named detector families with redact-secret ${e(inventory.redactSecretVersion)}. Generic detection may still find a value. Related families can support different formats; their parity is unverified. Counts are tool entries, including versions, not unique providers. Feature-gated registrations may be disabled at runtime.</p></div></div>
    <section class="panel"><div class="section-heading"><div><h2>Competitor detectors</h2><p>Start with entries that have no dedicated equivalent. Search a provider or rule name.</p></div></div>
      <form class="inventory-filters" id="inventory-filters"><label>Search<input id="inventory-query" type="search" placeholder="e.g. Datadog, GCP, Notion…"></label><label>Scanner<select id="inventory-tool"><option value="all">Both scanners</option><option value="gitleaks">Gitleaks</option><option value="trufflehog">TruffleHog</option></select></label><label>Coverage<select id="inventory-status"><option value="no-dedicated-detector">No dedicated detector</option><option value="related-family">Related family · unverified parity</option><option value="all">All entries</option></select></label></form>
      <p id="inventory-count" role="status" aria-live="polite"></p><div class="table-scroll"><table class="inventory-table"><thead><tr><th>Detector / rule</th><th>redact-secret status</th><th>Upstream registration</th></tr></thead><tbody id="inventory-rows">${rows(missing.slice(0, pageSize))}</tbody></table></div><p id="inventory-empty" hidden>No detector entries match these filters.</p><div class="inventory-pagination"><button type="button" class="button" id="inventory-prev">← Previous</button><span id="inventory-page"></span><button type="button" class="button" id="inventory-next">Next →</button></div>
    </section>
    <section class="panel"><div class="section-heading"><div><h2>Measured regressions → beta.4</h2><p>Published npm ${e(gaps.measuredVersion)} · snapshot ${e(gaps.reviewedAt)}. These are measured fixture failures, separate from the inventory above.</p></div><a class="text-link" href="${e(gaps.milestoneUrl)}">Milestone ↗</a></div><div class="category-grid">${gaps.issues.map(issue => `<article class="category-card"><a class="text-link" href="${e(issue.url)}"><strong>#${issue.number} · ${e(issue.title)}</strong></a><small>${issue.kind === 'false-positive' ? 'False positives' : 'Missed secret spans'} · ${issue.fixtures.length} fixtures · lifecycle: ${e(issue.status)}</small>${issue.fixtures.map(slug => `<a class="gap-fixture text-link" href="/fixture/${e(slug)}">${e(slug.split('--')[1])} ↗</a>`).join('')}</article>`).join('')}</div><p class="footnote">Historical measurement, not live issue status. “Fixed” records still require product-conformance and fixed-candidate benchmark evidence before “verified.” #294 uses unescaped nested quotes in plain text; it does not assert valid JSON or shell syntax. See each issue for the exact reproduction and scope decision.</p></section>
    <section class="panel prose"><h2>Sources and method</h2><p>Snapshot ${e(inventory.reviewedAt)}. No scanner implementations are bundled; this page stores identifiers, registration metadata, mappings, and source links.</p><ul>${Object.entries(inventory.sources).map(([id, source]) => `<li><a class="text-link" href="${e(source.url)}">${e(tools[id as keyof typeof tools])} ${e(source.version)} registry ↗</a> · revision <code>${e(source.revision.slice(0, 12))}</code></li>`).join('')}<li><a class="text-link" href="https://github.com/redact-secret/redact-secret/blob/${e(inventory.redactSecretRevision)}/crates/secret-scan-core/src/detectors/mod.rs">redact-secret ${e(inventory.redactSecretVersion)} registry ↗</a></li></ul><p>Explicit provider-family mappings conservatively mark shared providers as “related”; they do not assert format support or equal verification behavior. Unmapped providers/formats have no named dedicated equivalent in the inspected 25-family registry. Commented-out TruffleHog registrations are excluded, feature-gated registrations are labeled, and versions remain separate.</p><p>These entries are candidates for future synthetic fixtures and scope review. They are not confirmed runtime false negatives or automatic commitments for beta.4. The three issues above track independently reproduced benchmark failures.</p></section>`;
}

export function bindInventory() {
  const form = document.querySelector<HTMLFormElement>('#inventory-filters');
  if (!form) return;
  let page = 0;
  const query = document.querySelector<HTMLInputElement>('#inventory-query')!;
  const tool = document.querySelector<HTMLSelectElement>('#inventory-tool')!;
  const status = document.querySelector<HTMLSelectElement>('#inventory-status')!;
  const previous = document.querySelector<HTMLButtonElement>('#inventory-prev')!;
  const next = document.querySelector<HTMLButtonElement>('#inventory-next')!;
  const render = () => {
    const selected = filterInventory(inventory.entries, { query: query.value, tool: tool.value, status: status.value }) as Entry[];
    const pages = Math.max(1, Math.ceil(selected.length / pageSize));
    page = Math.min(page, pages - 1);
    document.querySelector('#inventory-rows')!.innerHTML = rows(selected.slice(page * pageSize, (page + 1) * pageSize));
    document.querySelector('#inventory-count')!.textContent = `${selected.length} matching entries · ${inventory.entries.length} total`;
    document.querySelector<HTMLElement>('#inventory-empty')!.hidden = selected.length !== 0;
    document.querySelector('#inventory-page')!.textContent = `Page ${page + 1} of ${pages}`;
    previous.disabled = page === 0;
    next.disabled = page + 1 === pages;
  };
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { page = 0; render(); });
  form.addEventListener('change', () => { page = 0; render(); });
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  render();
}
