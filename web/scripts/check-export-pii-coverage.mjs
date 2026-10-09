import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { piiCoveragePublication, piiCoveragePublicationProblems } from '../../scripts/pii-coverage-publication.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = process.env.WEB_REPO_ROOT ?? path.resolve(webRoot, '..');
const countText = text => {
  const value = text.trim();
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})*)$/.test(value)) return null;
  const number = Number(value.replace(/,/g, ''));
  return Number.isSafeInteger(number) ? number : null;
};
const hiddenFromDefault = (node, allowDetails = false) => {
  if (!node) return true;
  for (let ancestor = node; ancestor?.nodeType === 1; ancestor = ancestor.parentElement) {
    if (ancestor.hasAttribute('hidden') || ancestor.getAttribute('aria-hidden') === 'true' || ancestor.classList.contains('hidden') ||
        ancestor.style.display === 'none' || ancestor.style.visibility === 'hidden' || ancestor.style.contentVisibility === 'hidden') return true;
    if (!allowDetails && ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
      const summary = [...ancestor.children].find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(node)) return true;
    }
  }
  return false;
};

const readableText = (node, allowDetails = false) => {
  if (!node || hiddenFromDefault(node, allowDetails) || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(node.tagName)) return '';
  return [...node.childNodes].map(child => child.nodeType === 3 ? child.textContent : readableText(child, allowDetails)).join('');
};

/** Parse what readers receive; truthful marker attributes cannot excuse false visible text. */
export function coverageExportProblems(html, publication) {
  const dom = new JSDOM(html);
  try {
    const document = dom.window.document, problems = [];
    const panels = [...document.querySelectorAll('section[data-coverage-panel]')];
    const ids = ['active', 'proposed'].flatMap(role => ['baseline', 'candidate'].map(side => `coverage-${role}-${side}`));
    if (JSON.stringify(panels.map(panel => panel.getAttribute('data-coverage-panel')).sort()) !== JSON.stringify([...ids].sort())) problems.push('full-coverage-panel-roster-mismatch');
    for (const role of ['active', 'proposed']) for (const side of ['baseline', 'candidate']) {
      const id = `coverage-${role}-${side}`, joined = publication.coverage.matrices[role][side];
      const panel = panels.find(panel => panel.getAttribute('data-coverage-panel') === id);
      if (!panel) { problems.push(`missing:${id}`); continue; }
      const inventory = publication.coverage.inventories[role];
      if (panel.getAttribute('data-coverage-snapshot') !== inventory.source.snapshot.id) problems.push(`snapshot-attribute-mismatch:${id}`);
      if (hiddenFromDefault(panel)) problems.push(`hidden-default-panel:${id}`);
      const rows = [...panel.querySelectorAll('li[data-coverage-kind]')].filter(row => row.closest('[data-coverage-panel]') === panel);
      const actual = rows.map(row => [row.getAttribute('data-coverage-kind'), row.getAttribute('data-coverage-state')]);
      const expected = joined.matrix.rows.map(row => [row.kindKey, row.state]);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) problems.push(`dropped-duplicated-or-rewritten-row:${id}`);
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index], expectedRow = joined.matrix.rows[index];
        if (hiddenFromDefault(row)) problems.push(`hidden-default-row:${id}`);
        const state = row.querySelector('strong'), kind = row.querySelector('h4 code');
        if (!expectedRow || readableText(state).trim() !== expectedRow.state || hiddenFromDefault(state) ||
            readableText(kind).trim() !== expectedRow.kindKey || hiddenFromDefault(kind)) problems.push(`state-or-kind-not-visible:${id}`);
        if (expectedRow) {
          const paragraphs = [...row.children].filter(child => child.tagName === 'P');
          const capability = paragraphs.find(paragraph => paragraph.textContent.startsWith('Product capability: '));
          const mapping = paragraphs.find(paragraph => paragraph.textContent.startsWith('Evaluator: '));
          const observation = paragraphs.find(paragraph => paragraph.textContent.startsWith('Observation: '));
          if (!capability?.textContent.startsWith(`Product capability: ${expectedRow.capability.state};`) || hiddenFromDefault(capability) ||
              !mapping?.textContent.startsWith(`Evaluator: ${expectedRow.mapping.state};`) || hiddenFromDefault(mapping) ||
              !observation?.textContent.startsWith(`Observation: ${expectedRow.observation.status};`) || hiddenFromDefault(observation)) problems.push(`independent-axis-not-visible:${id}`);
          const format = number => number.toLocaleString('en-US');
          const counts = Object.entries(expectedRow.evidence).map(([grain, count]) => `${grain}: ${typeof count === 'string' ? count : count === null ? 'unavailable' : format(count)}`).join('; ');
          if (readableText(paragraphs[1]) !== counts) problems.push(`source-grain-not-visible:${id}`);
          const mappingAxes = `required axes ${expectedRow.mapping.requiredAxes.join(', ') || 'not recorded'}; representable axes ${expectedRow.mapping.representableAxes.join(', ') || 'unavailable'}; losses ${expectedRow.mapping.losses.join(', ') || 'no per-kind loss count available'}`;
          if (!readableText(mapping).includes(mappingAxes)) problems.push(`mapping-axes-not-visible:${id}`);
          if (expectedRow.capability.source && !readableText(capability).includes(expectedRow.capability.source) ||
              expectedRow.capability.productCommitment && !readableText(capability).includes(expectedRow.capability.productCommitment)) problems.push(`capability-binding-not-visible:${id}`);
          for (const axis of expectedRow.observation.axes) {
            const quantities = `${axis.axis}: eligible ${format(axis.eligible)}; measured ${format(axis.measured)}; satisfied ${format(axis.satisfied)}; missed ${format(axis.missed)}; unresolved ${format(axis.unresolved)}; withheld ${format(axis.withheld)}`;
            if (!readableText(observation).includes(quantities)) problems.push(`observation-denominator-not-visible:${id}`);
          }
          const details = row.querySelector('details');
          if (hiddenFromDefault(details, true) || expectedRow.reasons.some(reason => !readableText(details, true).includes(reason)) ||
              expectedRow.mapping.losses.some(loss => !readableText(mapping).includes(loss))) problems.push(`reason-or-loss-not-inspectable:${id}`);
        }

      }
      const expectedSummaries = [
        ['discovered', 'Discovered kinds (full evidence denominator)', joined.matrix.rows.length],
        ...Object.entries(joined.summary.states).map(([state, count]) => [`state-${state}`, state, count]),
        ...Object.entries(joined.summary.capability).map(([state, count]) => [`capability-${state}`, `Capability ${state} (kinds)`, count]),
        ...Object.entries(joined.summary.mapping).map(([state, count]) => [`mapping-${state}`, `Evaluator ${state} (kinds)`, count]),
        ['accepted-measurable', 'Kinds with accepted cases and representable axes', joined.summary.acceptedMeasurableKinds],
      ];
      const summaries = [...panel.querySelectorAll('[data-coverage-summary]')];
      if (JSON.stringify(summaries.map(summary => summary.getAttribute('data-coverage-summary'))) !== JSON.stringify(expectedSummaries.map(([key]) => key))) problems.push(`summary-roster:${id}`);
      for (let index = 0; index < summaries.length; index++) {
        const summary = summaries[index], expectedSummary = expectedSummaries[index];
        const label = summary.querySelector('dt'), visible = summary.querySelector('dd');
        if (!expectedSummary || countText(summary.getAttribute('data-coverage-value') ?? '') !== expectedSummary[2] ||
            countText(readableText(visible)) !== expectedSummary[2] || readableText(label).trim() !== expectedSummary[1] ||
            hiddenFromDefault(label) || hiddenFromDefault(visible)) problems.push(`summary-recount:${id}`);
      }
      const sourceDetails = [...panel.children].find(child => child.tagName === 'DETAILS' && child.querySelector('summary')?.textContent === 'Exact source and measurement identities');
      if (!sourceDetails || hiddenFromDefault(sourceDetails, true)) problems.push(`provenance-not-inspectable:${id}`);
      const text = readableText(sourceDetails, true);
      for (const identity of [inventory.source.snapshot.id, inventory.source.snapshot.contentDigest, joined.matrix.identity.mappingCommitment, joined.matrix.identity.population])
        if (!text.includes(identity)) problems.push(`missing-provenance:${id}`);
      for (const value of [joined.matrix.identity.productCommitment, joined.matrix.identity.bindingCommitment]) if (value && !text.includes(value)) problems.push(`missing-product-or-run:${id}`);
      if (role === 'proposed' && !readableText(panel.querySelector('h3')).includes('inactive, unmeasured')) problems.push(`proposal-not-labelled:${id}`);
    }
    const delta = document.querySelector('[data-coverage-delta="true"]');
    if (!delta || hiddenFromDefault(delta) || !document.body.textContent.includes('Kind counts are not detection accuracy')) problems.push('delta-or-grain-caveat-missing');
    return problems;
  } finally {
    dom.window.close();
  }
}

/** Recount the product overview against the active baseline, independently of its resolver. */
export function catalogExportProblems(html, publication) {
  const dom = new JSDOM(html);
  try {
    const document = dom.window.document, problems = [];
    const source = publication.coverage.matrices.active.baseline;
    const rows = [...document.querySelectorAll('li[data-pii-catalog-kind]')];
    if (JSON.stringify(rows.map(row => row.getAttribute('data-pii-catalog-kind'))) !== JSON.stringify(source.matrix.rows.map(row => row.kindKey))) problems.push('catalog-source-kind-roster');
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index], expected = source.matrix.rows[index], summary = row.querySelector('summary');
      if (!expected) continue;
      if (hiddenFromDefault(row) || hiddenFromDefault(summary) || readableText(summary?.querySelector('code')).trim() !== expected.kindKey ||
          readableText(summary?.querySelector('strong')).trim() !== expected.state || !readableText(summary).includes(expected.label)) problems.push(`catalog-visible-kind-state:${expected.kindKey}`);
      const facts = new Map([...row.querySelectorAll('dt')].map(term => [term.textContent, readableText(term.nextElementSibling, true)]));
      if (!facts.get('Declared implementation')?.startsWith(`${expected.capability.state};`) ||
          !facts.get('Public synthetic measurement')?.startsWith(`${expected.observation.status};`)) problems.push(`catalog-independent-axis:${expected.kindKey}`);
      if (facts.get('Evidence domains') !== (expected.domains.join(', ') || 'Not recorded') ||
          facts.get('Evidence jurisdictions') !== (expected.jurisdictions.join(', ') || 'Not recorded')) problems.push(`catalog-scope-rewrite:${expected.kindKey}`);
      const details = row.querySelector('details');
      if (hiddenFromDefault(details, true) || !facts.get('Language and context requirements')?.includes('language and jurisdiction are separate')) problems.push(`catalog-context-not-inspectable:${expected.kindKey}`);
      if (expected.capability.productCommitment && !facts.get('Declared implementation')?.includes(expected.capability.productCommitment)) problems.push(`catalog-product-binding:${expected.kindKey}`);
      if ([...expected.mapping.losses, ...expected.reasons].some(reason => !facts.get('Limitations')?.includes(reason))) problems.push(`catalog-loss-or-reason:${expected.kindKey}`);
      for (const axis of expected.observation.axes) {
        const quantities = `${axis.axis}: ${axis.measured.toLocaleString('en-US')} measured of ${axis.eligible.toLocaleString('en-US')} eligible; ${axis.unresolved.toLocaleString('en-US')} unresolved; ${axis.withheld.toLocaleString('en-US')} withheld`;
        if (!facts.get('Public synthetic measurement')?.includes(quantities)) problems.push(`catalog-axis-denominator:${expected.kindKey}`);
      }
      const expectedHref = `/evaluation/pii/evidence/#coverage-active-baseline-${encodeURIComponent(expected.kindKey).replace(/%/g, '-')}`;
      const hrefs = [...row.querySelectorAll('a')].map(anchor => anchor.getAttribute('href'));
      if (!hrefs.includes(expectedHref) || expected.capability.source && !hrefs.includes(expected.capability.source)) problems.push(`catalog-bound-detail-link:${expected.kindKey}`);
    }
    const summary = document.querySelector('[data-pii-catalog-summary]'), summaryText = readableText(summary);
    if (!summaryText.startsWith(`${source.matrix.rows.length.toLocaleString('en-US')} source-exposed kinds`) || hiddenFromDefault(summary)) problems.push('catalog-full-inventory-denominator');
    const states = new Map();
    for (const row of source.matrix.rows) states.set(row.state, (states.get(row.state) ?? 0) + 1);
    for (const [state, count] of states) if (countText(summaryText.match(new RegExp(`${state}: ([0-9,]+)(?:;|\\.)`))?.[1] ?? '') !== count) problems.push(`catalog-state-recount:${state}`);
    const body = readableText(document.body, true);
    const pageFacts = new Map([...document.querySelectorAll('dt')].map(term => [term.textContent, readableText(term.nextElementSibling, true)]));
    for (const [term, value] of [
      ['Catalog evidence', publication.coverage.inventories.active.source.snapshot.id],
      ['Published catalog product', source.matrix.identity.productCommitment],
      ['Published catalog product', source.binding?.product?.version], ['Published catalog product', source.binding?.product?.sourceCommit],
      ['Catalog configuration', source.binding?.scanner?.configurationDigest], ['Catalog configuration', source.binding?.scanner?.activationDigest],
    ]) {
      if (value && !pageFacts.get(term)?.includes(value)) problems.push('catalog-exact-source-identity');
    }
    if (!body.includes('not detection accuracy') || !body.includes('qualification') || !body.includes('Proposed snapshots and candidate builds')) problems.push('catalog-material-boundary');
    for (const href of ['/evaluation/pii/', '/evaluation/pii/results/', '/evaluation/pii/evidence/'])
      if (!document.querySelector(`a[href="${href}"]`)) problems.push(`catalog-destination:${href}`);
    return problems;
  } finally { dom.window.close(); }
}

export function piiDetailDestinationsProblems(methodologyHtml, resultsHtml, evidenceHtml) {
  const documents = [methodologyHtml, resultsHtml, evidenceHtml].map(html => new JSDOM(html));
  try {
    const [methodology, results, evidence] = documents.map(dom => dom.window.document), problems = [];
    if (methodology.querySelector('select')) problems.push('methodology-result-selector-not-moved');
    for (const href of ['/coverage/pii/', '/evaluation/pii/results/', '/evaluation/pii/evidence/',
      'https://github.com/redact-secret/pii-evidence', 'https://github.com/redact-secret/pii-eval']) {
      if (!methodology.querySelector(`a[href="${href}"]`)) problems.push(`methodology-destination:${href}`);
    }
    const methodText = readableText(methodology.body, true);
    for (const text of ['pii-v1 and b11 are different quantities', 'thresholds are not applied to pii-v1 observations', 'Synthetic rates are not production rates'])
      if (!methodText.includes(text)) problems.push('methodology-protocol-or-population-boundary');
    const labels = [...results.querySelectorAll('label')].map(label => label.textContent);
    for (const label of ['Population or report', 'Metric or category', 'Population and coverage']) if (!labels.includes(label)) problems.push(`results-selector:${label}`);
    if (![...results.querySelectorAll('button')].some(button => button.textContent === 'Sources and execution details')) problems.push('results-source-diagnostic-control');
    for (const href of ['/coverage/pii/', '/evaluation/pii/', '/evaluation/pii/results/'])
      if (!evidence.querySelector(`nav[aria-label="PII evidence destinations"] a[href="${href}"]`)) problems.push(`evidence-reciprocal-destination:${href}`);
    return problems;
  } finally { documents.forEach(dom => dom.window.close()); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publication = await piiCoveragePublication(root);
  const html = await readFile(path.join(webRoot, 'out/evaluation/pii/evidence/index.html'), 'utf8');
  const [catalog, methodology, results] = await Promise.all(['coverage/pii', 'evaluation/pii', 'evaluation/pii/results'].map(route => readFile(path.join(webRoot, `out/${route}/index.html`), 'utf8')));
  const problems = [...await piiCoveragePublicationProblems(root), ...coverageExportProblems(html, publication),
    ...catalogExportProblems(catalog, publication), ...piiDetailDestinationsProblems(methodology, results, html)];
  if (problems.length) throw new Error(problems.join('; '));
  console.log('PII coverage export: all source kinds, states, summaries and exact identities recount');
}
