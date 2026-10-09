import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { readAuthority, stampOf } from './lib/authority.mjs';
import { validateCredentialSupportInputs } from '../../benchmarks/lib/current-credential-support.mjs';

const normalize = text => text.replace(/\s+/g, ' ').trim();
const visible = node => {
  for (let ancestor = node; ancestor?.nodeType === 1; ancestor = ancestor.parentElement) {
    if (ancestor.hasAttribute('hidden') || ancestor.getAttribute('aria-hidden') === 'true' || ancestor.style.display === 'none' || ancestor.style.visibility === 'hidden') return false;
  }
  return !!node;
};
const definition = (root, label) => [...root.querySelectorAll('dt')].find(node => normalize(node.textContent) === label)?.nextElementSibling;
const number = value => /^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})*)$/.test(value) ? Number(value.replace(/,/g, '')) : null;
const hasLink = (root, href) => [...root.querySelectorAll('a[href]')].some(link => link.getAttribute('href') === href && visible(link));

/** Counts come from raw inputs, never from the page resolver or its marker attributes. */
export function credentialCoverageExportProblems(html, { taxonomy, fixtures, scope, scoredCount, authority, product, view }) {
  const dom = new JSDOM(html), problems = [];
  try {
    const root = dom.window.document;
    const familyIds = new Set(taxonomy.families.map(family => family.id));
    const fixtureBearing = new Set(fixtures.flatMap(fixture => fixture.familyIds ?? []).filter(id => familyIds.has(id)));
    for (const [label, expected] of [['Taxonomy families, not a support claim', taxonomy.families.length], ['Families with fixtures', fixtureBearing.size],
      ['Families with recorded capability declarations', null], ['Families in the bound qualification record', scoredCount]]) {
      const node = definition(root, label), actual = normalize(node?.textContent ?? '');
      if (!visible(node) || (expected === null ? actual !== 'Not recorded' : number(actual) !== expected)) problems.push(`coverage-count:${label}`);
    }
    const rows = [...root.querySelectorAll('li[id^="coverage-"]')];
    if (JSON.stringify(rows.map(row => row.id).sort()) !== JSON.stringify(taxonomy.families.map(family => `coverage-${family.id.replace(':', '--')}`).sort())) problems.push('coverage-family-roster');
    for (const row of rows) {
      const family = taxonomy.families.find(family => row.id === `coverage-${family.id.replace(':', '--')}`);
      if (!family || !visible(row)) { problems.push('coverage-family-hidden'); continue; }
      const declaration = definition(row, 'Declared capability');
      if (!visible(declaration) || !normalize(declaration.textContent).startsWith('Unknown:')) problems.push(`coverage-inferred-declaration:${family.id}`);
      if (!hasLink(row, `/report/families/${family.id.replace(':', '--')}/`)) problems.push(`coverage-family-detail:${family.id}`);
      const status = definition(row, 'Recorded qualification');
      const classifications = authority === 'new' ? view?.families.filter(item => item.taxonomyFamilies.some(item => item.id === family.id)) ?? [] : [];
      const expected = classifications.length ? classifications.map(item => `${item.family}: ${item.status.value}${item.status.qualificationProfile ? ` (${item.status.qualificationProfile})` : ''}`).join('; ') : 'Not recorded for this family and measured product.';
      if (!visible(status) || normalize(status.textContent) !== expected) problems.push(`coverage-qualification:${family.id}`);
    }
    for (const statement of scope.outOfScope) if (![...root.querySelectorAll('li')].some(node => visible(node) && normalize(node.textContent) === normalize(statement.text))) problems.push('coverage-scope-statement');
    const binding = normalize(definition(root, 'Scope binding')?.textContent ?? '');
    const expectedBinding = !product ? 'Unknown:' : product.version === scope.boundTo.release && product.mode === scope.boundTo.mode ? 'Current:' : 'Historical scope:';
    if (!binding.startsWith(expectedBinding)) problems.push('coverage-scope-binding');
    if (product?.version && !normalize(definition(root, 'Measured product')?.textContent ?? '').startsWith(product.version)) problems.push('coverage-measured-product');
    const stamp = stampOf(html);
    if (stamp?.pipeline !== authority || stamp?.role !== 'authority') problems.push('coverage-authority-stamp');
    for (const href of ['/evaluation/credential/', '/report/corpus/', '/report/families/', '/evaluation/qualification/']) if (!hasLink(root, href)) problems.push(`coverage-link:${href}`);
    if (root.querySelector('[aria-label="Breadcrumb"] a[href="/coverage/"]')) problems.push('coverage-breadcrumb-legacy-hub');
    return problems;
  } finally { dom.window.close(); }
}

export function credentialMethodologyExportProblems(html, authority) {
  const dom = new JSDOM(html), problems = [];
  try {
    const root = dom.window.document;
    for (const href of ['/coverage/credential/', '/report/corpus/', '/evaluation/qualification/', '/report/families/', '/comparison/scanner/',
      'https://github.com/redact-secret/credential-evidence', 'https://github.com/redact-secret/credential-eval',
      'https://github.com/redact-secret/redact-secret', 'https://github.com/redact-secret/redact-secret-benchmarks',
      'https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/benchmarks/support/policy-qualified-credentials.json',
      'https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/docs/specs/policy-qualified-credentials.md',
      ...['twin', 'benign', 'mutation', 'metamorphic', 'differential', 'holdout'].map(method => `/evaluation/method/${method}/`)]) {
      if (!hasLink(root, href)) problems.push(`methodology-link:${href}`);
    }
    if ([...root.querySelectorAll('table caption')].some(node => /Fixtures by kind|Cases and variants|Families by/.test(node.textContent))) problems.push('methodology-result-inventory');
    for (const [anchor, href] of [['by-kind', '/report/corpus/'], ['by-method', '/evaluation/qualification/']]) {
      const replacement = root.getElementById(anchor);
      if (!visible(replacement) || !hasLink(replacement, href)) problems.push(`methodology-bookmark:${anchor}`);
    }
    const stamp = stampOf(html);
    if (stamp?.pipeline !== authority || stamp?.role !== 'authority') problems.push('methodology-authority-stamp');
    return problems;
  } finally { dom.window.close(); }
}

async function main() {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const root = process.env.WEB_REPO_ROOT ?? path.resolve(webRoot, '..');
  const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const authority = await readAuthority(root), taxonomy = await read('benchmarks/support/taxonomy.json'), scope = await read('scanners/product-scope.json');
  let fixtures = [], scoredCount = null, product, view;
  if (authority === 'new') {
    view = await read('public/results/qualification-v1.json').catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
    const population = view?.populations.find(population => population.role === 'floors-and-gates');
    fixtures = population?.cases.map(item => ({ familyIds: item.family ? [item.family] : [] })) ?? [];
    product = population?.artifact.scanners.find(scanner => scanner.id === 'redact-secret');
    if (view) scoredCount = view.families.length;
  } else {
    fixtures = (await read('benchmarks/fixture-index.json')).fixtures;
    const summary = await read('public/results/summary.json').catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
    product = summary?.scanners.find(scanner => scanner.id === 'redact-secret');
    const records = validateCredentialSupportInputs(await read('benchmarks/inputs/credential/support-bindings.json'), await read('benchmarks/inputs/credential/support-bindings-index.json'));
    if (product?.mode.startsWith('Published ')) {
      const record = records.filter(record => record.mode === 'published' && record.data.publishedPackage?.version === product.version).sort((a, b) => b.data.generatedAt.localeCompare(a.data.generatedAt))[0];
      scoredCount = record?.data.familyCount ?? null;
    }
  }
  const coverage = await readFile(path.join(webRoot, 'out/coverage/credential/index.html'), 'utf8');
  const methodology = await readFile(path.join(webRoot, 'out/evaluation/credential/index.html'), 'utf8');
  const problems = [...credentialCoverageExportProblems(coverage, { taxonomy, fixtures, scope, scoredCount, authority, product, view }), ...credentialMethodologyExportProblems(methodology, authority)];
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(`credential overview export: ${taxonomy.families.length} family rows and independent inventory counts, source binding, separate declarations/qualification, policy/repository/detail links verified (${authority})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
