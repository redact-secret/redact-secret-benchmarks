#!/usr/bin/env node
// `node scripts/triage-groups-cde.mjs --scores <scores.json> --out <gaps.json>` (groups C, D, E round 1).
// Groups every gap of the candidate (positive not exact/fully covered, control flagged) by shared root cause with rules over the
// case id, the row and the offsets/text of the finding. It reads the corpora's generators, never edits them, and writes only
// group ids, case ids and offsets (no matched text). Rules are listed in order; a gap takes the first rule that matches.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../benchmarks/group-c/corpus-group-c.mjs';
import * as D from '../benchmarks/group-d/corpus-group-d.mjs';
import * as E from '../benchmarks/group-e/corpus-e.mjs';

const { values } = parseArgs({ options: { scores: { type: 'string' }, out: { type: 'string' } } });
const scores = JSON.parse(readFileSync(values.scores, 'utf8'));
const mods = { c: C, d: D, e: E };

const GROUPS = {
  'G-brace': { triage: 'PRODUCT GAP', title: 'brace template placeholder `{NAME}` reported (span stops before the closing brace)' },
  'G-angle': { triage: 'PRODUCT GAP', title: 'angle placeholder `<...>` reported' },
  'G-docmask': { triage: 'PRODUCT GAP', title: 'documented mask/ellipsis/xxx/upper-case-name placeholder reported as a value' },
  'G-xapikey-clientid': { triage: 'POLICY QUESTION', title: '`x-api-key` header whose value the evidence names a public client ID (control flagged)' },
  'G-authcode': { triage: 'CORPUS ERRATUM CANDIDATE', title: 'control carries an OAuth `code=` value; the product reads it as a credential (warn)' },
  'G-meta-pipe-span': { triage: 'POLICY QUESTION', title: 'Meta `APP_ID|SECRET`: finding covers the whole pipe pair, expectation is the secret half only (over-span, fully covered)' },
  'G-token-member': { triage: 'PRODUCT GAP', title: 'bare `token` / `tokenKey` JSON member value not read (Contentful CMA PAT, HubSpot private-app token)' },
  'G-jfrog': { triage: 'PRODUCT GAP', title: '`X-JFrog-Art-Api` header and `curl -u user:<secret>` password not read (JFrog reference token / API key)' },
  'G-hapikey': { triage: 'PRODUCT GAP', title: 'HubSpot legacy `hapikey=` query parameter not read' },
  'G-reddit-token': { triage: 'PRODUCT GAP', title: 'Reddit revoke-form `token=` parameter not read' },
  'G-reddit-secret': { triage: 'PRODUCT GAP', title: 'Reddit client secret in `-u/--user id:secret` Basic password not read' },
  'G-zendesk-cred': { triage: 'PRODUCT GAP', title: 'Zendesk `email/token:<token>` credential string: not read in `curl -u`, over-spanned (email included, warn) in JSON/env' },
  'G-digits24': { triage: 'PRODUCT GAP', title: 'credential-named member/parameter whose value is 24 digits is silent (evidence: flagged by position, not shape)' },
  'G-elastic-encoded': { triage: 'PRODUCT GAP', title: 'Elastic cross-cluster `encoded` member (base64 `id:key`) not reported; only `api_key` is' },
};

const rules = [
  ['G-token-member', (c) => /^(contentful:cma-personal-access-token|hubspot:private-app-access-token)$/.test(c.family) && c.kind === 'positive'],
  ['G-jfrog', (c) => c.family.startsWith('jfrog:') && c.kind === 'positive'],
  ['G-hapikey', (c) => c.family === 'hubspot:legacy-api-key' && c.kind === 'positive'],
  ['G-reddit-token', (c) => c.family === 'reddit:oauth-access-token' && c.kind === 'positive' && !/digits24/.test(c.id)],
  ['G-reddit-secret', (c) => c.family === 'reddit:app-client-secret' && c.kind === 'positive'],
  ['G-zendesk-cred', (c) => c.family === 'zendesk:api-token' && c.kind === 'positive'],
  ['G-digits24', (c) => c.kind === 'positive' && /digits24/.test(c.id)],
  ['G-elastic-encoded', (c) => c.family === 'elastic:cross-cluster-api-key' && c.kind === 'positive'],
  ['G-meta-pipe-span', (c) => /^meta:(app-secret|app-access-token)$/.test(c.family) && c.kind === 'positive'],
  ['G-xapikey-clientid', (c) => c.kind === 'control' && /client-id-in-x-api-key-header/.test(c.id)],
  ['G-authcode', (c) => c.kind === 'control' && /public-client-request-client-id-only|:public-only-/.test(c.id)],
  ['G-brace', (c, t) => c.kind === 'control' && t.some((s) => s.startsWith('{'))],
  ['G-angle', (c, t) => c.kind === 'control' && t.some((s) => s.startsWith('<'))],
  ['G-docmask', (c, t) => c.kind === 'control' && t.some((s) => /^(CFPAT-|ZOOM_API_KEY)/.test(s))],
];

const out = { schema: 'groups-cde-gaps-v1', groups: {}, ungrouped: [] };
for (const g of Object.keys(GROUPS)) out.groups[g] = { ...GROUPS[g], cases: [] };
for (const [corp, list] of Object.entries(scores.gaps)) {
  const byId = new Map(mods[corp].cases.map((k) => [k.id, k]));
  for (const gap of list) {
    const kase = byId.get(gap.id);
    const buf = Buffer.from(kase.text);
    const texts = gap.observed.map((f) => buf.subarray(f.start, f.end).toString());
    const hit = rules.find(([, test]) => test(gap, texts));
    const rec = { corpus: corp.toUpperCase(), id: gap.id, layout: kase.layout, evidenceCase: kase.evidenceCase ?? kase.trace?.caseId ?? kase.case ?? null, claims: kase.claims ?? [], clause: kase.trace?.clause ?? null, family: gap.family, kind: gap.kind, expected: gap.expected ?? null, expectedExtra: gap.expectedExtra ?? [], observed: gap.observed.map(({ start, end, type, action, detector }) => ({ start, end, type, action, detector })), spanOutcomes: gap.spanOutcomes ?? null, leakedBytes: gap.leakedBytes ?? null, onPublished: gap.publishedGood ? 'ok' : 'also failing' };
    if (hit) out.groups[hit[0]].cases.push(rec); else out.ungrouped.push(rec);
  }
}
writeFileSync(values.out, `${JSON.stringify(out, null, 1)}\n`);
for (const [g, v] of Object.entries(out.groups)) {
  const byKind = v.cases.reduce((a, c) => ((a[c.kind] = (a[c.kind] || 0) + 1), a), {});
  const byCorp = v.cases.reduce((a, c) => ((a[c.corpus] = (a[c.corpus] || 0) + 1), a), {});
  console.log(g.padEnd(20), String(v.cases.length).padStart(4), JSON.stringify(byKind), JSON.stringify(byCorp));
}
console.log('ungrouped', out.ungrouped.length);
for (const u of out.ungrouped) console.log(' ', u.corpus, u.id, JSON.stringify(u.observed));
