// Group E (#754) evidence extraction. Reads ONLY the credential-evidence snapshot's Case and fixture records for the nine Group E
// rows (git object reads, no checkout, no scanner, no product) and writes evidence-group-e.json, the one input of corpus-e.mjs.
//
//   node benchmarks/corpora/session-material/extract-evidence.mjs --evidence-dir <credential-evidence clone> [--check]
//
// --check recomputes and fails when the committed evidence-group-e.json differs.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const SNAPSHOT_TAG = 'snapshot-2026.10.06.5';
export const FIXTURE_SETS = ['adobe', 'airtable', 'dropbox', 'hubspot', 'jfrog', 'reddit', 'zendesk'];
export const CASE_IDS = [
  'adobe-jwt-service-account-identifiers-and-private-key-references', 'adobe-jwt-private-key-file-contents-unsettled', 'adobe-jwt-signed-assertion-form-field-unsettled',
  'airtable-legacy-api-key-url-parameter-value', 'airtable-legacy-api-key-placeholders-references-and-non-values', 'airtable-legacy-api-key-bearer-header-and-bare-value-unsettled',
  'dropbox-legacy-long-lived-access-token-response-member', 'dropbox-legacy-long-lived-access-token-placeholders-and-references', 'dropbox-legacy-long-lived-access-token-bare-value-and-lone-member-unsettled',
  'hubspot-legacy-api-key-hapikey-query-parameter-value', 'hubspot-legacy-api-key-placeholders-masked-display-and-references', 'hubspot-legacy-api-key-hyphen-grouped-bare-value-unsettled',
  'jfrog-api-key-header-and-basic-password-value', 'jfrog-api-key-lookalikes-and-non-values', 'jfrog-api-key-bare-value-and-format-conflict-unsettled',
  'zendesk-api-token-basic-credential-token-part', 'zendesk-api-token-lookalikes-and-non-values', 'zendesk-api-token-basic-credential-encoded-header-value', 'zendesk-api-token-bare-value-and-grammar-unsettled',
  'reddit-app-client-secret-basic-password', 'reddit-installed-app-non-empty-basic-password-unsettled', 'reddit-oauth-access-token-response-member', 'reddit-oauth-access-token-bearer-header-and-redirect-fragment',
  'reddit-oauth-refresh-token-response-member-and-request-field', 'reddit-oauth-revoke-token-request-body-token-field', 'reddit-oauth-documentation-template-words-references-and-non-values', 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled',
];

export function extract(evidenceDir) {
  const git = (...a) => execFileSync('/usr/bin/git', ['-C', evidenceDir, ...a], { encoding: 'buffer', maxBuffer: 1 << 26 });
  const commit = git('rev-list', '-n', '1', SNAPSHOT_TAG).toString().trim();
  const cases = {};
  for (const id of CASE_IDS) {
    const raw = git('show', `${SNAPSHOT_TAG}:records/cases/${id}.json`);
    const c = JSON.parse(raw.toString('utf8'));
    cases[id] = {
      sha256: createHash('sha256').update(raw).digest('hex'),
      outcome: c.expectation.outcome,
      basis: c.expectation.basis,
      lifecycle: c.lifecycle,
      families: c.families.map(f => ({ family: f.family, role: f.role })),
      scenarios: c.scenarios,
      sources: c.expectation.sources.map(s => ({ sourceId: s.sourceId, locator: s.locator })),
    };
  }
  const fixtures = [];
  for (const set of FIXTURE_SETS) {
    const raw = git('show', `${SNAPSHOT_TAG}:records/fixtures/${set}-authored.json`);
    for (const f of JSON.parse(raw.toString('utf8')).fixtures) {
      if (!cases[f.case]) continue;
      fixtures.push({ id: f.id, case: f.case, context: f.context, sha256: f.sha256, text: f.text, outcome: f.expected.outcome, spans: (f.expected.spans ?? []).map(s => ({ start: s.start, end: s.end, role: s.role })) });
    }
  }
  return { schema: 'group-e-evidence-v1', snapshot: { repo: 'redact-secret/credential-evidence', tag: SNAPSHOT_TAG, commit }, cases, fixtures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dir = args[args.indexOf('--evidence-dir') + 1];
  if (!dir) { console.error('usage: extract-evidence.mjs --evidence-dir <clone> [--check]'); process.exit(2); }
  const out = `${JSON.stringify(extract(dir), null, 1)}\n`;
  const path = new URL('./evidence-group-e.json', import.meta.url);
  if (args.includes('--check')) {
    if (readFileSync(path, 'utf8') !== out) { console.error('evidence-group-e.json differs from the snapshot'); process.exit(1); }
    console.log('evidence-group-e.json matches the snapshot');
  } else writeFileSync(path, out);
}
