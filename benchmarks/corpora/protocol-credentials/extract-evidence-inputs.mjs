#!/usr/bin/env node
// Group D (#753): one-time extraction of the evidence Cases and fixtures the corpus is authored from.
//   node benchmarks/corpora/protocol-credentials/extract-evidence-inputs.mjs <credential-evidence checkout at snapshot-2026.10.06.5> > benchmarks/corpora/protocol-credentials/evidence-inputs.json
// Reads only records/cases and records/fixtures (no observation, no product repo). A vendor prefix literal or a long fixed hex run is
// written as a {{token}} marker so that the committed file carries no scanner-shaped literal; the generator assembles it at run time.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: extract-evidence-inputs.mjs <evidence checkout>'); process.exit(2); }
const ROWS = ['algolia:admin-api-key', 'algolia:search-only-api-key', 'algolia:secured-api-key', 'algolia:write-api-key', 'algolia:analytics-api-key', 'algolia:monitoring-api-key', 'algolia:usage-api-key', 'contentful:delivery-api-access-token', 'contentful:preview-api-access-token', 'asana:service-account-token', 'dropbox:app-auth-token', 'elastic:cross-cluster-api-key', 'elastic:serverless-project-api-key', 'figma:plan-access-token', 'figma:cli-plan-access-token', 'hubspot:static-auth-access-token', 'jfrog:pairing-token', 'meta:instagram-app-secret', 'canva:authorization-code', 'meta:app-access-token', 'x:oauth1-access-token', 'zoom:build-platform-api-key', 'zoom:webhook-secret-token'];
// Adjacent Cases of other families that the Group D author listed as contradicting a Group D contract (handoff, "Existing Cases that disagree").
const ADJACENT = { 'x-oauth1-token-identity-and-signature-non-values': ['x-authored--oauth-authorization-header-identity-and-signature'], 'dropbox-app-secret-lookalikes-and-non-values': ['dropbox-authored--app-secret-lookalike-app-key-only'] };
const H16 = '0123456789abcdef';
const PREFIX_LITERALS = [[['fi', 'gd_'].join(''), '{{figd_}}'], [H16.repeat(4), '{{hex64}}'], [H16.repeat(2), '{{hex32}}']];
const mask = (t) => PREFIX_LITERALS.reduce((a, [lit, tok]) => a.split(lit).join(tok), t);

const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const cases = new Map();
for (const f of readdirSync(join(dir, 'records/cases'))) {
  const c = rd(join(dir, 'records/cases', f));
  const subj = c.families.filter((x) => ROWS.includes(x.family));
  if (subj.length || ADJACENT[c.id]) cases.set(c.id, { c, subj });
}
const fixtures = [];
for (const f of readdirSync(join(dir, 'records/fixtures'))) {
  const set = rd(join(dir, 'records/fixtures', f));
  for (const x of set.fixtures ?? []) {
    const e = cases.get(x.case);
    if (!e) continue;
    if (ADJACENT[x.case] && !ADJACENT[x.case].includes(x.id)) continue;
    const bytes = Buffer.from(x.text, 'utf8');
    fixtures.push({ id: x.id, case: x.case, set: set.id, context: x.context, outcome: x.expected.outcome, text: mask(x.text), sha256: x.sha256, spans: x.expected.spans.map((s) => ({ start: s.start, end: s.end, role: s.role, value: mask(bytes.subarray(s.start, s.end).toString('utf8')) })) });
  }
}
const out = {
  schema: 'group-d-evidence-inputs-v1',
  source: { repo: 'redact-secret/credential-evidence', tag: 'snapshot-2026.10.06.5' },
  cases: [...cases.values()].map(({ c, subj }) => ({
    id: c.id, caseTypes: c.caseTypes, outcome: c.expectation.outcome, basis: c.expectation.basis ?? null, lifecycle: c.lifecycle,
    families: c.families.map((x) => ({ family: x.family, role: x.role })), inRows: subj.map((x) => x.family), adjacent: Boolean(ADJACENT[c.id]),
    claimsCited: [...(c.rationale.match(/Contract claims cited: ([^.]*)\./)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)],
  })).sort((a, b) => a.id.localeCompare(b.id)),
  fixtures: fixtures.sort((a, b) => a.id.localeCompare(b.id)),
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
