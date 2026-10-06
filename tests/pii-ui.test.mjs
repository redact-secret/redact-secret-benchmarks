import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { PII_METRIC_IDS } from '../benchmarks/evaluation/domains/pii/profile.ts';
import { PII_JURISDICTION_STANDARD } from '../benchmarks/evaluation/domains/pii/jurisdictions.ts';
import { buildEvaluationDomainsV2, domainDescriptorV2 } from '../src/evaluation-domains-v2.ts';
const credentialReference = { bundleId: 'a'.repeat(32), manifestSha256: 'b'.repeat(64) };
import { piiSupportPage, piiSupportQueryOf } from '../src/pages/pii-support.ts';
import { domainEvaluationPage } from '../src/pages/domain-evaluation.ts';
import { commitmentChip, domainBar } from '../src/components/index.ts';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const matrix = buildPiiSupportMatrixV2();
const descriptor = domainDescriptorV2(buildEvaluationDomainsV2(matrix.artifactCommitment, credentialReference), 'pii');
const page = (value = matrix, search = '?domain=pii') => piiSupportPage(descriptor, value, piiSupportQueryOf(search));
const piiSupportPiiPage = value => piiSupportPage(domainDescriptorV2(buildEvaluationDomainsV2(value.artifactCommitment, credentialReference), 'pii'), value, piiSupportQueryOf('?domain=pii'));
const piiEvaluation = { domain: 'pii', reportProfile: { id: 'pii-evaluation', version: 1 }, evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1',
  qualificationProfiles: [{ id: 'pii-v1', version: 1 }], evaluation: { state: 'schema-only', href: null }, support: { state: 'schema-only', href: null } };

test('DomainBar names the accounting it reads and marks exactly one domain', () => {
  const links = [{ href: '/a', label: 'A', current: true }, { href: '/b', label: 'B', current: false }];
  assert.match(domainBar({ label: 'Domain', links, identities: [{ label: 'Accounting', value: '<code>pii-v1</code>' }] }), /aria-current="page">A<\/a><a href="\/b">B/);
  assert.throws(() => domainBar({ label: 'Domain', links, identities: [{ label: 'Domain', value: 'pii' }] }), /accounting/);
  assert.throws(() => domainBar({ label: 'Domain', links: links.map(link => ({ ...link, current: true })), identities: [{ label: 'Accounting', value: 'x' }] }), /exactly one/);
});

test('CommitmentChip shows a recomputed SHA-256 short, the full value in its title, and absence as absence', () => {
  const hash = 'ab12'.padEnd(60, '0') + 'cd34';
  assert.match(commitmentChip({ label: 'Artifact', commitment: hash }), new RegExp(`title="${hash}".*<code>ab12…cd34</code>.*Recomputed`));
  assert.match(commitmentChip({ label: 'Product artifact', commitment: null }), /class="commit absent".*Not measured/);
  assert.throws(() => commitmentChip({ label: 'Artifact', commitment: 'not-a-hash' }), /SHA-256/);
});

test('PII support reads as its own domain: DomainBar, recomputed commitments, one row per family with profile and reasons', () => {
  const html = page();
  assert.match(html, /class="domain-bar"/);
  assert.match(html, /<a href="\/support\?domain=pii" aria-current="page">PII<\/a>/);
  assert.match(html, /<dt>Accounting<\/dt><dd><code>pii-v1<\/code>/);
  assert.match(html, new RegExp(`title="${matrix.artifactCommitment}"`));
  assert.match(html, new RegExp(`title="${matrix.registryCommitment}"`));
  assert.match(html, /class="commit absent"><b>Product artifact<\/b>/);
  const rows = [...html.matchAll(/<details class="pii-family" data-support-status="([^"]*)" data-family="([^"]*)"/g)];
  assert.deepEqual(rows.map(row => row[2]), matrix.families.map(row => row.family));
  for (const row of matrix.families) for (const code of row.status.reasonCodes) assert.ok(html.includes(code), code);
  assert.equal((html.match(/Profile <code>pii-v1@1<\/code>/g) ?? []).length, matrix.families.length);
  assert.doesNotMatch(html, /href="\/(?:coverage|fixture)\//, 'a PII row never links down to fixture bytes');
});

test('PII support statuses use the credential status marks, so provisional never reads as not measured', () => {
  const value = structuredClone(matrix);
  value.families[0].status.state = 'provisional'; value.families[1].status.state = 'stable'; value.families[2].status.state = 'unsupported';
  const html = page(value);
  const mark = family => new RegExp(`data-family="${family}"[\\s\\S]*?<span class="st ([a-z-]+)" data-status="([a-z-]+)">([A-Za-z ]+)</span>`).exec(html).slice(1);
  assert.deepEqual(mark(value.families[0].family), ['st-unstable', 'unstable', 'Provisional']);
  assert.deepEqual(mark(value.families[1].family), ['st-pass', 'pass', 'Stable']);
  assert.deepEqual(mark(value.families[2].family), ['st-held', 'withheld', 'Unsupported']);
  assert.deepEqual(mark(value.families[3].family), ['st-nm', 'not-measured', 'Pending']);
});

test('activation is a separate axis from support, with its selector', () => {
  const html = page();
  for (const row of matrix.families) assert.ok(html.includes(`<code>${row.activation.selector}</code>`), row.activation.selector);
  assert.match(text(html), /Activation not measured/);
  const value = structuredClone(matrix); value.families[0].activation.state = 'unavailable';
  assert.match(page(value), /<span class="st st-none">Not in the recorded activation<\/span>/);
});

test('jurisdictions are a list of registered families, and the standard size is never a coverage denominator', () => {
  const html = page(), words = text(html);
  const jurisdictional = matrix.families.filter(row => row.jurisdiction);
  assert.ok(jurisdictional.length > 0);
  for (const row of jurisdictional) assert.ok(html.includes(`href="/support?domain=pii&amp;jurisdiction=${row.jurisdiction}"`));
  assert.match(words, new RegExp(`${PII_JURISDICTION_STANDARD.codeCount} codes`));
  assert.doesNotMatch(words, new RegExp(`\\d+\\s*/\\s*${PII_JURISDICTION_STANDARD.codeCount}`));
  assert.doesNotMatch(page(matrix, '?domain=pii&jurisdiction=US'), /id="pii-jurisdictions"/, 'a narrowed view does not repeat the jurisdiction list');
});

test('population comparisons keep one card each and mark an absent verdict as not measured', () => {
  const html = page();
  for (const comparison of matrix.populationComparisons)
    assert.match(html, new RegExp(`<article class="popcmp nm" data-population="${comparison.id}" data-population-verdict="not-measured">`));
});

test('PII evaluation renders the contract: every metric with its own population, hatched unreachable outcome states, lossy evidence map', () => {
  const html = domainEvaluationPage(piiEvaluation);
  assert.match(html, /<a href="\/evaluation\/pii" aria-current="page">PII<\/a>/);
  assert.deepEqual([...html.matchAll(/<tr data-metric="([^"]+)">/g)].map(match => match[1]), [...PII_METRIC_IDS]);
  assert.doesNotMatch(html, /\bTotal\b|\b0%/);
  // type valid → 2 unreachable, invalid → 4; sensitive → 2, non-sensitive → 2, not-established → 3.
  assert.equal((html.match(/data-reachable="false"/g) ?? []).length, 13);
  assert.match(html, /<tr data-evidence-class="near-miss"><td><code>near-miss<\/code><\/td><td><span class="chip void">No accounting class<\/span>/);
  assert.match(html, /<tr data-evidence-class="cross-family-collision"><td><code>cross-family-collision<\/code><\/td><td><span class="chip void">No accounting class<\/span>/);
  assert.match(text(html), /Language support is not jurisdiction support/);
});

test('a bound product names the product and selectors its activation was recorded with', async () => {
  const { productEvidenceFor } = await import('../scripts/pii-publication-inputs.ts');
  const recorded = await productEvidenceFor({ sourceCommit: '2e1bdcf0905f7a374c4c54b7caac41303cd7d88b',
    coreSha256: 'ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1' }, 'evidence');
  const bound = buildPiiSupportMatrixV2({ product: recorded.binding });
  const html = piiSupportPiiPage(bound);
  assert.match(html, /Activation was recorded on product <code>2e1bdcf0905f<\/code> with selector <code>pii:global<\/code>/);
  assert.match(html, /<b>Product artifact<\/b> <code>ff0e…d1b1<\/code> <span>✓ Sanctioned binding<\/span>/);
  assert.match(html, /data-family="pii:us:ssn"[\s\S]*?Not in the recorded activation/);
  assert.match(page(), /No product activation record matches/);
});
