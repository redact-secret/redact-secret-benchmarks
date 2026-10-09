import { synthesize } from '../../harness/credential-carriers/synthesis.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AXES as BATCH2_AXES } from '../../harness/credential-carriers/axes.mjs';
import { ROW_IDS, SNAPSHOT } from './rows.mjs';
import { detokenize } from './tokens.mjs';

// Issue #752: the Group C baseline corpus, authored blind to the product from the credential-evidence Cases of
// snapshot-2026.10.06.5 and the Batch 2 generator conventions (benchmarks/corpora/credential-carriers/corpus-r2.mjs). Rules:
// - An expectation comes only from the evidence Case outcome and its span roles. `must-flag` -> `positive`: the
//   exact value span; `must-not-flag` -> `control`: no finding; `not-assertable` -> `unsupported`: observed, never scored.
// - Every stored fixture of those Cases is replayed verbatim (`fixture-replay-*`), with the Case's own spans.
// - Generated cases move the value through the carrier layouts the Case names and the Batch 2 axes (delimiters, line
//   endings, UTF-8, big preceding text, repeats, neighbours). The value is runtime filler; the Cases assert "flagged
//   because of where it sits, whatever its shape", so the span is always the value and nothing else.
// - Vendor-prefix shapes (the Cases' not-assertable probes that push protection refused to store) are assembled here at
//   run time from parts and are `unsupported` only; they are never an expectation.
// - Nothing is taken from product output or from the product repository. Expectation type/action: see TYPE_BASIS.
// The scorer is Batch 2's, unchanged (score-group-c.mjs re-exports it).

export const CORPUS_VERSION = 1;
export const ISSUE = 752;
export const SCHEMA = 'group-c-observations-v1';
export const PART = 'group-c';
export { SNAPSHOT };
export const AXES = {
  ...BATCH2_AXES,
  'fixture-replay': 'a stored credential-evidence fixture, byte for byte, with the fixture\'s own span roles',
  'value-shape': 'the Cases assert placement, not shape: hyphenated, dotted, long, short and kilobyte values in the same slot keep the same exact span',
  'vendor-probe': 'a vendor-prefix shape assembled at run time from parts, observed only (the Case stores no fixture for it)',
};
// Expectation type/action: the Cases say only "treated as a credential ... generic attribution". The scorer needs a type and
// an action, so the Batch 2 convention is carried unchanged: Bearer value -> bearer_token, Basic envelope ->
// authorization_credential, named field/member value -> contextual_secret, action redact. Layouts Batch 2 never defined
// (X-JFrog-Art-Api header, curl -u password, pipe-joined access_token secret) default to contextual_secret and are
// marked `assumed-generic-default`; their span expectation still comes from the Case, only the type label is assumed.
export const TYPE_BASIS = { 'batch2-convention': 'type/action as Batch 2 corpus-r2.mjs assigns the same carrier', 'assumed-generic-default': 'carrier has no Batch 2 type; generic contextual_secret/redact assumed' };

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = `${ALNUM}-_`;
const HEX = '0123456789abcdef';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DIGITS = '0123456789';
const B64 = `${ALNUM}+/`;

export function synth(seed, length, alphabet = ALNUM) {
  return synthesize('groupc:752', seed, length, alphabet);
}
const b64 = text => Buffer.from(text, 'utf8').toString('base64');

export const EVIDENCE = JSON.parse(readFileSync(new URL('./evidence-fixtures.json', import.meta.url), 'utf8'));
for (const c of EVIDENCE.cases) for (const fx of c.fixtures) fx.text = detokenize(fx.text);
const CASE_BY_ID = new Map(EVIDENCE.cases.map(c => [c.id, c]));

/** Contract claim (or open-question) ids each Case's rationale cites. `extract-evidence` supplies the ids that exist; the tests check these against them. */
export const CASE_CLAIMS = {
  'adobe-s2s-client-secret-token-request-parameter': ['s2s-client-secret-request-parameter'],
  'adobe-enterprise-web-app-client-secret-form-parameter': ['enterprise-web-app-client-secret-request-parameter'],
  'adobe-web-app-client-secret-basic-envelope': ['web-app-client-secret-basic-authorization'],
  'adobe-client-secret-placeholders-references-and-public-identifiers': ['s2s-client-secret-docs-placeholders', 'enterprise-web-app-client-secret-placeholders-only', 'web-app-client-secret-placeholders-only'],
  'adobe-client-secret-bare-p8e-prefixed-value-and-subtype': ['client-secret-p8e-prefix-consistency', 'client-secret-p8e-body-length-32', 'client-secret-p8e-body-alphabet-hyphen'],
  'adobe-enterprise-id-token-and-org-id-beside-client-secret': ['enterprise-web-app-client-secret-placeholders-only', 'enterprise-web-app-client-secret-request-parameter'],
  'adobe-web-app-client-secret-post-form-parameter-and-decoded-pair': ['web-app-metadata-lists-two-auth-methods'],
  'airtable-personal-access-token-bearer-header-value': ['existence', 'carrier-bearer-header-not-url-parameter', 'opaque-format'],
  'airtable-personal-access-token-placeholders-references-and-masks': ['carrier-bearer-header-not-url-parameter'],
  'airtable-personal-access-token-url-parameter-and-tool-layout': ['carrier-bearer-header-not-url-parameter', 'tool-artifacts-consistency', 'opaque-format', 'format-change-not-breaking'],
  'contentful-cma-personal-access-token-bearer-header-and-create-response-member': ['creation-api-bearer-carrier-shown-once', 'reference-example-token-shape-differs'],
  'contentful-cma-personal-access-token-documented-placeholders-and-masks': ['provider-placeholders-begin-cfpat'],
  'contentful-cma-personal-access-token-prefixed-and-hexadecimal-shapes': ['reference-example-token-shape-differs', 'cfpat-prefix-and-alphabet-consistency'],
  'dropbox-access-token-bearer-header-and-response-member': ['access-token-exists', 'token-response-member-opaque', 'access-token-documented-opaque'],
  'dropbox-access-token-placeholders-references-and-non-values': ['access-token-exists'],
  'dropbox-access-token-sl-prefixed-run-and-unnamed-carriers': ['access-token-documented-opaque', 'tool-length-bounds-differ'],
  'hubspot-private-app-access-token-bearer-header-and-token-key-member': ['private-app-token-exists', 'token-carried-in-info-request-body', 'no-hubspot-statement-of-token-layout'],
  'hubspot-private-app-access-token-placeholders-references-and-masks': ['private-app-token-exists'],
  'hubspot-private-app-token-layout-leads-and-info-response-identifiers': ['pat-prefix-lead', 'uuid-shape-tool-lead', 'no-hubspot-statement-of-token-layout', 'token-carried-in-info-request-body'],
  'jfrog-reference-token-header-and-basic-password-value': ['carriers-and-handling', 'length-64-versus-128-conflict'],
  'jfrog-reference-token-placeholders-references-and-masks': ['carriers-and-handling'],
  'jfrog-reference-token-sixty-four-and-one-hundred-twenty-eight-character-forms': ['identity-page-pattern-64', 'access-page-128-character-key', 'length-64-versus-128-conflict', 'eight-character-prefix-single-artifact'],
  'meta-app-secret-bare-thirty-two-character-values': ['body-length-32-consistency', 'alphabet-not-settled', 'format-undocumented'],
  'meta-app-secret-client-secret-query-parameter': ['carriers-client-secret-and-composite', 'alphabet-not-settled'],
  'meta-app-secret-in-app-id-pipe-access-token': ['carriers-client-secret-and-composite'],
  'meta-app-secret-pipe-placeholders-derived-proof-and-non-values': ['appsecret-proof-is-a-derived-output', 'carriers-client-secret-and-composite'],
  'salesforce-oauth-refresh-token-response-member-and-post-parameter': ['token-response-member-and-secret', 'refresh-request-carrier', 'format-not-documented'],
  'salesforce-oauth-refresh-token-placeholders-references-and-masks': ['refresh-request-carrier'],
  'salesforce-oauth-refresh-token-prefixed-values-and-get-query-carrier': ['tool-prefix', 'format-not-documented', 'refresh-request-carrier'],
  'x-oauth1-consumer-secret-signature-output-and-signing-key-placeholders': ['signing-key-input-signature-output', 'consumer-key-public-status'],
  'x-oauth1-consumer-secret-signing-key-and-bare-values': ['signing-key-input-signature-output', 'worked-example-lengths', 'length-50-consistency', 'length-35-to-44-single-artifact', 'artifacts-disagree-on-secret-length', 'token-secret-boundary', 'percent-containing-forms'],
};

/**
 * Reviewer rulings (one principle: a scored expectation must be supported by the evidence Case; otherwise the entry is kept
 * as observed-only `unsupported`, never deleted). [ruling, family regexp, layout regexp, original kind].
 */
const FORM_QUERY = /^(client_secret|refresh_token)-form-(query-request-line|query-request-line-last|curl-url-double-quoted|query-continues|query-html-href|url-fragment)$/;
export const DOWNGRADES = [
  ['C-B1', /^adobe:enterprise-web-app-client-secret$/, FORM_QUERY, 'positive', 'the Case names the raw form body, curl -d and curl --data-urlencode only; the query is documented for Server-to-Server only'],
  ['C-B2', /^salesforce:oauth-refresh-token$/, FORM_QUERY, 'positive', 'the Case documents the POST body only; a GET query is a separate not-assertable Case'],
  ['C-B3', /^meta:app-secret$/, /^fixture-replay-app-pair-lookalike-(masked-secret|appsecret-proof-derived|generation-call-placeholder)$/, 'control', 'the contract leaves app-id and appsecret_proof disclosure undecided'],
  ['C-B3', /^meta:app-secret$/, /^appsecret-proof-[01]$/, 'control', 'the contract leaves appsecret_proof disclosure undecided'],
  ['A1', /^(contentful:cma-personal-access-token|dropbox:access-token|hubspot:private-app-access-token)$/, /^bearer-header-map-(compact|spaced)$/, 'positive', 'a JSON header-map container the Case does not name'],
  ['errata-1', /^adobe:(oauth-server-to-server-client-secret|enterprise-web-app-client-secret|oauth-web-app-client-secret)$/, /^(fixture-replay-public-client-request-client-id-only|public-only-0|public-only-0-utf8)$/, 'control', 'the control carries an OAuth code= authorization-code value whose confidentiality the Adobe Case and contract leave unresolved'],
  ['A1', /^adobe:oauth-web-app-client-secret$/, /^basic-header-map$/, 'positive', 'a JSON header-map container the Case does not name (it names the raw request, the curl refresh header and the revocation request)'],
  ['A1', /^jfrog:reference-token$/, /^header-x-jfrog-art-api-header-map-(compact|spaced)$/, 'positive', 'a JSON header-map container the Case does not name'],
  ['A1', /^(contentful:cma-personal-access-token|dropbox:access-token|hubspot:private-app-access-token|salesforce:oauth-refresh-token)$/, /-member-json-nested-array$/, 'positive', 'a nested array container the Case does not name'],
  ['A1', /^adobe:oauth-server-to-server-client-secret$/, /^client_secret-form-(query-html-href|url-fragment)$/, 'positive', 'an HTML href / URL fragment container the Case does not name'],
  ['A1', /^meta:app-secret$/, /^client_secret-form-(query-html-href|url-fragment)$/, 'positive', 'an HTML href / URL fragment container the Case does not name'],
  ['A1', /^meta:app-secret$/, /^access-token-pipe-(html-href|json-string|form-body)$/, 'positive', 'a container the Case does not name'],
  ['A5', /^x:oauth1-consumer-secret$/, /^(oauth-signature-(authorization-header|query-string|eof|utf8)|fixture-replay-consumer-secret-lookalike-(authorization-header|query-string)-signature-output)$/, 'control', 'a derived output whose disclosure the contract does not state'],
  ['A6', /^adobe:/, /^fixture-replay-enterprise-client-secret-angle-placeholder$/, 'control', 'an identifier literal (org_id) in the control'],
];
const downgradeOf = (family, layout, kind) => DOWNGRADES.find(([, f, l, k]) => k === kind && f.test(family) && l.test(layout));
/**
 * Class extension (by construction, never by text): a generated benign-value control whose value is a mask (`****`), a `${ENV}`
 * reference, a `{{ template }}`, an `XXXXXX` run, an `<angle>` placeholder or a `{brace}` placeholder extends the Case-listed
 * non-value categories to more layouts. Square-bracket placeholders, bare schemes, prose and verbatim fixture replays are not tagged.
 */
const SHAPES = [/^\*{4,}$/, /^\$\{[A-Z_]+\}$/, /^\{\{ [^}]* \}\}$/, /^X{6,}$/, /^<[^<>]*>$/, /^\{[^{}]*\}$/];
const isClassExt = b => typeof b === 'string' && b !== '' && b.replace(/@APPID/g, '{your-app_id}').replace(/&$/, '').split('|').every(part => SHAPES.some(r => r.test(part)));

const host = 'api.example.test';
const MB = '\u{1F680} café 日本語 é';
const cat = (...x) => x.join('');
const CURL_U = cat('curl ', '-', 'u');
const BIG = `${'x'.repeat(63)}\n`.repeat(80);
const slugOf = f => f.replace(/[^a-z0-9]+/gi, '_').toUpperCase();

// ------------------------------------------------------------------------------------------------------------
// Row definitions. `slots` are the carriers of the row's must-flag Case. `benign` lists the value forms of its
// must-not-flag Case. `probes` are the runtime-assembled / carrier probes of its not-assertable Case (observed only).
// ------------------------------------------------------------------------------------------------------------
const CID = ['client_id', LOWER, 24];

export const ROWS = {
  'adobe:oauth-server-to-server-client-secret': {
    slots: [{ kind: 'form', name: 'client_secret', case: 'adobe-s2s-client-secret-token-request-parameter', path: '/token', lead: ['grant_type=client_credentials'], pub: [CID], trail: ['scope=openid'] }],
    controlCase: 'adobe-client-secret-placeholders-references-and-public-identifiers',
    benign: ['{CLIENT_SECRET}', '<YOUR_CLIENT_SECRET>', 'XXXXXXXXXXXXX', '${ADOBE_CLIENT_SECRET}', '********'],
    publicOnly: ['grant_type=authorization_code&client_id=@CID&code=@CODE'],
  },
  'adobe:enterprise-web-app-client-secret': {
    slots: [{ kind: 'form', name: 'client_secret', case: 'adobe-enterprise-web-app-client-secret-form-parameter', path: '/token', lead: ['grant_type=client_credentials'], pub: [CID], trail: ['scope=SYNTHETIC-scope', 'org_id=@ORG'], urlencode: true }],
    controlCase: 'adobe-client-secret-placeholders-references-and-public-identifiers',
    benign: ['{CLIENT_SECRET}', '<YOUR_CLIENT_SECRET>', 'XXXXXXXXXXXXX', '${ADOBE_CLIENT_SECRET}', '********'],
    publicOnly: ['grant_type=authorization_code&client_id=@CID&code=@CODE'],
  },
  'adobe:oauth-web-app-client-secret': {
    slots: [{ kind: 'basic', case: 'adobe-web-app-client-secret-basic-envelope', cidLen: 24 }],
    controlCase: 'adobe-client-secret-placeholders-references-and-public-identifiers',
    benign: ['{AUTHORIZATION}'],
    publicOnly: ['grant_type=authorization_code&client_id=@CID&code=@CODE'],
  },
  'airtable:personal-access-token': {
    slots: [{ kind: 'bearer', case: 'airtable-personal-access-token-bearer-header-value', path: '/v0/SYNTHETIC-base-id/SYNTHETIC-table', map: true }],
    controlCase: 'airtable-personal-access-token-placeholders-references-and-masks',
    benign: [null, '<YOUR_TOKEN>', '${AIRTABLE_TOKEN}', '{{ airtable_token }}', '********'],
  },
  'contentful:cma-personal-access-token': {
    slots: [
      { kind: 'bearer', case: 'contentful-cma-personal-access-token-bearer-header-and-create-response-member', path: '/spaces' },
      { kind: 'member', name: 'token', case: 'contentful-cma-personal-access-token-bearer-header-and-create-response-member', pub: [['name', null]], response: false },
    ],
    controlCase: 'contentful-cma-personal-access-token-documented-placeholders-and-masks',
    benign: [null, '<token>', '${CONTENTFUL_MANAGEMENT_TOKEN}', '********'],
    memberBenign: ['********'],
    extraControls: [
      ['cfpat-placeholder-cli', v => `$ node client.js [--ssl] --token '${v}' --space 'cfexample'\n`, ['CFPAT-123...789', 'CFPAT-xxx']],
      ['cfpat-placeholder-env', v => `CONTENTFUL_INTEGRATION_TEST_CMA_TOKEN=${v} \\\n`, ['CFPAT-123...789', 'CFPAT-xxx']],
    ],
  },
  'dropbox:access-token': {
    slots: [
      { kind: 'bearer', case: 'dropbox-access-token-bearer-header-and-response-member', path: '/2/users/get_current_account', method: 'POST', kb: true },
      { kind: 'member', name: 'access_token', case: 'dropbox-access-token-bearer-header-and-response-member', pub: [['expires_in', 'num']], response: true },
    ],
    controlCase: 'dropbox-access-token-placeholders-references-and-non-values',
    benign: [null, '<TOKEN>', '${DROPBOX_ACCESS_TOKEN}', '********'],
    memberBenign: ['********'],
    publicOnly: ['{"expires_in": 14400}\n'],
  },
  'hubspot:private-app-access-token': {
    slots: [
      { kind: 'bearer', case: 'hubspot-private-app-access-token-bearer-header-and-token-key-member', path: '/crm/v3/objects/contacts' },
      { kind: 'member', name: 'tokenKey', case: 'hubspot-private-app-access-token-bearer-header-and-token-key-member', pub: [], curlData: true, onlyMember: true },
    ],
    controlCase: 'hubspot-private-app-access-token-placeholders-references-and-masks',
    benign: [null, '[YOUR_TOKEN]', '${HUBSPOT_PRIVATE_APP_TOKEN}', '********'],
    memberBenign: ['[YOUR_TOKEN]', '********'],
  },
  'jfrog:reference-token': {
    slots: [
      { kind: 'header', name: 'X-JFrog-Art-Api', case: 'jfrog-reference-token-header-and-basic-password-value', path: '/artifactory/api/system/ping' },
      { kind: 'basicpw', case: 'jfrog-reference-token-header-and-basic-password-value' },
    ],
    controlCase: 'jfrog-reference-token-placeholders-references-and-masks',
    benign: [null, '<reference token>', '${JFROG_REFERENCE_TOKEN}', '********'],
  },
  'meta:app-secret': {
    slots: [
      { kind: 'form', name: 'client_secret', case: 'meta-app-secret-client-secret-query-parameter', path: '/oauth/access_token', method: 'GET', queryOnly: true, lead: [], pub: [['client_id', DIGITS, 16]], trail: ['grant_type=client_credentials'] },
      { kind: 'pipe', case: 'meta-app-secret-in-app-id-pipe-access-token' },
    ],
    controlCase: 'meta-app-secret-pipe-placeholders-derived-proof-and-non-values',
    benign: ['<your-app-secret>', '${META_APP_SECRET}', '{your-app_secret}', '********'],
    pipeBenign: ['{your-app_id}|{your-app_secret}', '${META_APP_ID}|${META_APP_SECRET}', '@APPID|********', '@APPID|<your-app-secret>'],
  },
  'salesforce:oauth-refresh-token': {
    slots: [
      { kind: 'member', name: 'refresh_token', case: 'salesforce-oauth-refresh-token-response-member-and-post-parameter', pub: [['token_type', 'bearer']], response: true },
      { kind: 'form', name: 'refresh_token', case: 'salesforce-oauth-refresh-token-response-member-and-post-parameter', path: '/services/oauth2/token', lead: ['grant_type=refresh_token'], pub: [['client_id', 'SYNTHETIC-consumer-key']], trail: [] },
    ],
    controlCase: 'salesforce-oauth-refresh-token-placeholders-references-and-masks',
    benign: ['<refresh_token>', '${SALESFORCE_REFRESH_TOKEN}', '********'],
    memberBenign: ['********'],
    publicOnly: ['grant_type=refresh_token&client_id=@CONSUMERKEY\n', '{\n  "token_type": "Bearer"\n}\n'],
  },
  'x:oauth1-consumer-secret': {
    slots: [],
    controlCase: 'x-oauth1-consumer-secret-signature-output-and-signing-key-placeholders',
    benign: [],
  },
};
export const FAMILY_IDS = Object.keys(ROWS);
if (JSON.stringify(FAMILY_IDS.slice().sort()) !== JSON.stringify(ROW_IDS.slice().sort())) throw new Error('rows.mjs and ROWS disagree');

// ------------------------------------------------------------------------------------------------------------
// Vendor-shape probes (observed only). Prefixes are assembled from parts so no vendor-prefix literal sits in source.
// ------------------------------------------------------------------------------------------------------------
const P = {
  adobe: cat('p8', 'e-'),
  airtable: cat('p', 'at'),
  cfpat: cat('CF', 'PAT-'),
  dropbox: cat('s', 'l.'),
  dropboxU: cat('s', 'l.u.'),
  hubNa: cat('pa', 't-na1-'),
  hubEu: cat('pa', 't-eu1-'),
  jfrog: cat('cmV', 'md'),
  jfrog8: cat('cmV', 'mdGtu'),
  sf: cat('5Ae', 'p861'),
};

const P8E_CASE = 'adobe-client-secret-bare-p8e-prefixed-value-and-subtype';
/** The not-assertable Case a row's runtime probes belong to (a probe may name another Case of the same row). */
const PROBE_CASE = {
  'adobe:oauth-server-to-server-client-secret': P8E_CASE,
  'adobe:oauth-web-app-client-secret': 'adobe-web-app-client-secret-post-form-parameter-and-decoded-pair',
  'adobe:enterprise-web-app-client-secret': 'adobe-enterprise-id-token-and-org-id-beside-client-secret',
  'airtable:personal-access-token': 'airtable-personal-access-token-url-parameter-and-tool-layout',
  'contentful:cma-personal-access-token': 'contentful-cma-personal-access-token-prefixed-and-hexadecimal-shapes',
  'dropbox:access-token': 'dropbox-access-token-sl-prefixed-run-and-unnamed-carriers',
  'hubspot:private-app-access-token': 'hubspot-private-app-token-layout-leads-and-info-response-identifiers',
  'jfrog:reference-token': 'jfrog-reference-token-sixty-four-and-one-hundred-twenty-eight-character-forms',
  'meta:app-secret': 'meta-app-secret-bare-thirty-two-character-values',
  'salesforce:oauth-refresh-token': 'salesforce-oauth-refresh-token-prefixed-values-and-get-query-carrier',
  'x:oauth1-consumer-secret': 'x-oauth1-consumer-secret-signing-key-and-bare-values',
};

function probes(family) {
  const s = (slug, n, alpha = ALNUM) => synth(`${family}:probe:${slug}`, n, alpha);
  const uuid = slug => `${s(`${slug}a`, 8, HEX)}-${s(`${slug}b`, 4, HEX)}-${s(`${slug}c`, 4, HEX)}-${s(`${slug}d`, 4, HEX)}-${s(`${slug}e`, 12, HEX)}`;
  const out = [];
  const p = (layout, text, note, caseId) => out.push({ layout, parts: [text], note, case: caseId, axes: ['representation', 'vendor-probe'] });
  switch (family) {
    case 'adobe:oauth-server-to-server-client-secret':
      p('bare-prefixed-32-prose', `Keep this for later: ${P.adobe}${s('b32', 32, URLSAFE.replace('-', ''))}\n`, 'bare prefix + 32-character body, no carrier');
      p('bare-prefixed-32-hyphen-body-prose', `Keep this for later: ${P.adobe}${s('h1', 15)}-${s('h2', 16)}\n`, 'a 32-character body that contains a hyphen');
      p('bare-prefixed-32-env', `ADOBE_CLIENT_SECRET=${P.adobe}${s('e32', 32)}\n`, 'the prefixed shape in an environment assignment');
      break;
    case 'adobe:oauth-web-app-client-secret':
      p('bare-prefixed-32-prose', `Keep this for later: ${P.adobe}${s('b32', 32)}\n`, 'bare prefixed shape; subtype attribution not established', P8E_CASE);
      p('form-client-secret-parameter', `grant_type=authorization_code&client_id=${s('cid', 24, LOWER)}&client_secret=${s('fs', 40)}&code=${s('code', 24)}\n`, 'client_secret_post form of a Web App credential: not a documented Web App carrier');
      p('decoded-pair-prose', `The header was built from ${s('cid2', 24, LOWER)}:${s('dp', 40)} before encoding.\n`, 'decoded clientId:clientSecret text');
      break;
    case 'adobe:enterprise-web-app-client-secret':
      p('bare-prefixed-32-prose', `Keep this for later: ${P.adobe}${s('b32', 32)}\n`, 'bare prefixed shape; subtype attribution not established', P8E_CASE);
      p('consent-redirect-id-token', `https://app.example.test/callback?id_token=${b64(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=+$/, '')}.${b64(JSON.stringify({ iss: 'https://ims.example.test', org_id: s('o', 12, LOWER) })).replace(/=+$/, '')}.${s('sig', 30, URLSAFE)}&state=${s('st', 12, LOWER)}\n`, 'consent id_token: confidentiality unresolved');
      p('org-id-parameter-alone', `org_id=${s('org', 20, LOWER)}&scope=${s('sc', 8, LOWER)}\n`, 'customer org_id: confidentiality unresolved');
      break;
    case 'airtable:personal-access-token':
      p('api-key-url-parameter', `GET /v0/${s('base', 10, LOWER)}/${s('tbl', 8, LOWER)}?api_key=${s('ak', 40)} HTTP/1.1\r\nHost: ${host}\r\n`, 'the unsupported legacy api_key URL parameter');
      p('bare-pat-14-period-64hex-prose', `Keep this for later: ${P.airtable}${s('id14', 14)}.${s('h64', 64, HEX)}\n`, 'pat + 14 + period + 64 hex layout, bare');
      p('bare-pat-14-period-64hex-env', `AIRTABLE_TOKEN=${P.airtable}${s('id14e', 14)}.${s('h64e', 64, HEX)}\n`, 'the same layout in an environment assignment');
      break;
    case 'contentful:cma-personal-access-token':
      p('bare-cfpat-43-prose', `Keep this for later: ${P.cfpat}${s('c43', 43, URLSAFE)}\n`, 'bare prefixed value, 43 characters after the prefix');
      p('bare-cfpat-64-prose', `Keep this for later: ${P.cfpat}${s('c64', 64)}\n`, 'bare prefixed value, 64 characters after the prefix');
      p('bare-hex-64-prose', `Keep this for later: ${s('h64', 64, HEX)}\n`, 'bare 64-character lowercase hexadecimal value');
      p('redacted-value-member-only', `{"sys":{"redactedValue":"${s('rv', 4, DIGITS)}"}}\n`, 'a response member holding only a four-character redactedValue');
      p('bare-cfpat-43-env', `CONTENTFUL_MANAGEMENT_TOKEN=${P.cfpat}${s('c43e', 43, URLSAFE)}\n`, 'the prefixed shape in an environment assignment');
      break;
    case 'dropbox:access-token':
      p('bare-sl-135-prose', `Keep this for later: ${P.dropbox}${s('s135', 132, URLSAFE)}\n`, 'bare sl. run, 135 characters in all');
      p('bare-sl-u-152-prose', `Keep this for later: ${P.dropboxU}${s('su152', 147, URLSAFE)}\n`, 'bare sl.u. run, 152 characters in all');
      p('bare-unprefixed-140-prose', `Keep this for later: ${s('u140', 140, URLSAFE)}\n`, 'a long run with no prefix');
      p('sl-env-assignment', `DROPBOX_ACCESS_TOKEN=${P.dropbox}${s('se', 140, URLSAFE)}\n`, 'an sl. run in an environment assignment');
      p('sl-unnamed-env-assignment', `DB_TOKEN=${P.dropbox}${s('sn', 140, URLSAFE)}\n`, 'an sl. run in an environment variable Dropbox does not name');
      break;
    case 'hubspot:private-app-access-token':
      p('bare-pat-na1-uuid-prose', `Keep this for later: ${P.hubNa}${uuid('na')}\n`, 'pat-na1- + 8-4-4-4-12 hex groups');
      p('bare-pat-eu1-uuid-prose', `Keep this for later: ${P.hubEu}${uuid('eu')}\n`, 'pat-eu1- + 8-4-4-4-12 hex groups');
      p('bare-uuid-env', `HUBSPOT_PRIVATE_APP_TOKEN=${uuid('bu')}\n`, 'a bare UUID-shaped value beside a HubSpot word');
      p('info-response-identifiers', `{\n  "userId": "${s('u', 9, DIGITS)}",\n  "hubId": "${s('h', 8, DIGITS)}",\n  "appId": "${s('a', 7, DIGITS)}",\n  "scopes": ["crm.objects.contacts.read"]\n}\n`, 'access-token-info response identifiers: confidentiality unresolved');
      break;
    case 'jfrog:reference-token':
      p('bare-cmvmd-64-prose', `Keep this for later: ${P.jfrog}${s('r59', 59)}\n`, 'bare 5-character prefix + 59 alphanumerics (64 in all)');
      p('bare-8-char-prefix-64-prose', `Keep this for later: ${P.jfrog8}${s('r56', 56)}\n`, 'bare 8-character prefix + 56 alphanumerics');
      p('bare-128-prose', `Keep this for later: ${s('r128', 128)}\n`, 'bare 128-character alphanumeric value');
      p('bare-cmvmd-128-prose', `Keep this for later: ${P.jfrog}${s('r123', 123)}\n`, 'bare prefix + 123 alphanumerics (128 in all)');
      break;
    case 'meta:app-secret':
      p('bare-hex-32-prose', `Keep this for later: ${s('h32', 32, HEX)}\n`, 'bare 32-character lowercase hexadecimal value');
      p('facebook-env-alnum-32', `FACEBOOK_APP_SECRET=${s('a32', 32)}\n`, '32 alphanumerics in a Facebook app secret assignment');
      p('instagram-env-alnum-32', `INSTAGRAM_APP_SECRET=${s('i32', 32)}\n`, 'the same layout under an Instagram app secret name (boundary)');
      p('facebook-env-hex-32', `FACEBOOK_APP_SECRET=${s('x32', 32, HEX)}\n`, '32 lowercase hexadecimal in a Facebook app secret assignment');
      break;
    case 'salesforce:oauth-refresh-token':
      p('bare-prefixed-long-remainder-prose', `Keep this for later: ${P.sf}${s('l1', 40)}.${s('l2', 20)}_${s('l3', 20)}\n`, 'prefix + 80-character remainder containing a period and an underscore');
      p('bare-prefixed-short-remainder-hyphen-prose', `Keep this for later: ${P.sf}${s('s1', 20)}-${s('s2', 19)}\n`, 'prefix + 40-character remainder containing a hyphen');
      p('get-query-refresh-token', `GET /services/oauth2/token?grant_type=refresh_token&refresh_token=${s('gq', 60)} HTTP/1.1\r\nHost: ${host}\r\n`, 'refresh_token in a GET query string: not a documented carrier');
      p('bare-prefixed-env', `SALESFORCE_REFRESH_TOKEN=${P.sf}${s('se', 50)}\n`, 'the prefixed shape in an environment assignment');
      break;
    case 'x:oauth1-consumer-secret':
      p('signing-key-43-ampersand', `signing key: ${s('k43', 43)}&\n`, 'a signing key written as a consumer secret then an ampersand');
      p('bare-43-prose', `Keep this for later: ${s('b43', 43)}\n`, 'bare 43-character alphanumeric value');
      p('bare-50-prose', `Keep this for later: ${s('b50', 50)}\n`, 'bare 50-character alphanumeric value');
      p('oauth-consumer-secret-form-field', `oauth_consumer_key=${s('ck', 25, LOWER)}&oauth_consumer_secret=${s('cs', 50)}\n`, 'an oauth_consumer_secret form field: X documents no such carrier');
      p('signing-key-50-token-secret', `signing key: ${s('k50', 50)}&${s('ts', 45)}\n`, 'consumer secret + & + token secret: boundary not told apart by shape');
      break;
    default: break;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------------------
// Generator
// ------------------------------------------------------------------------------------------------------------
function build() {
  const cases = [];
  const ids = new Set();
  const add = (family, kind, layout, parts, note, axes, extra) => {
    const ruling = downgradeOf(family, layout, kind);
    const originalKind = kind;
    if (ruling) kind = 'unsupported';
    const id = `${family}:gc:${layout}:${kind}`;
    if (ids.has(id)) throw new Error(`group-c: duplicate case id ${id}`);
    ids.add(id);
    let text = '';
    const spans = [];
    for (const part of parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = Buffer.byteLength(text);
      text += part.secret;
      spans.push({ start, end: Buffer.byteLength(text) });
    }
    const observed = ruling ? spans.splice(0) : [];
    if (kind === 'positive' && !spans.length) throw new Error(`group-c: positive ${id} has no span`);
    if (kind !== 'positive' && spans.length) throw new Error(`group-c: ${id} must not carry a span`);
    const meta = CASE_BY_ID.get(extra.case);
    if (!meta) throw new Error(`group-c: unknown evidence case ${extra.case}`);
    cases.push({
      id, family, group: 'C', part: PART, kind, layout, axes, evidenceCase: extra.case, evidenceFixtures: extra.fixtures ?? [],
      claims: CASE_CLAIMS[extra.case] ?? [], text,
      expected: kind === 'positive' ? spans[0] : null, expectedExtra: kind === 'positive' ? spans.slice(1) : [],
      expectedType: kind === 'positive' ? extra.type : null, expectedAction: kind === 'positive' ? 'redact' : null,
      typeBasis: kind === 'positive' ? extra.typeBasis : null, note,
      ...(kind === 'unsupported' || kind === 'conflict' ? { observedSpans: observed, probeSpans: observed } : {}),
      ...(ruling ? { downgradedFrom: originalKind, ruling: ruling[0], rulingReason: ruling[4] } : {}),
      ...(originalKind === 'control' && !ruling && extra.classExt ? { classExtension: true } : {}),
    });
  };

  for (const [family, row] of Object.entries(ROWS)) {
    const L = (slug, n, alpha = ALNUM) => synth(`${family}:${slug}`, n, alpha);
    const sec = (slug, n = 40, alpha = ALNUM) => ({ secret: L(slug, n, alpha) });
    const shape = slug => L(`shape:${slug}`, 40);
    const caseFx = id => CASE_BY_ID.get(id).fixtures.map(f => f.id);
    const row2 = row;
    const pubVal = ([k, alpha, n]) => [k, alpha === null ? L(`pub:${k}`, 12, LOWER) : alpha === 'num' ? '14400' : alpha === 'bearer' ? 'Bearer' : n ? L(`pub:${k}`, n, alpha) : alpha];
    const used = new Set();

    // ---- replay every stored fixture of every Case that names this row ----
    for (const c of EVIDENCE.cases) {
      const role = c.families.find(f => f.family === family);
      if (!role) continue;
      for (const fx of c.fixtures) {
        const slug = fx.id.replace(/^[a-z0-9-]+?--/, '');
        if (c.outcome === 'must-flag') {
          if (role.role !== 'subject') continue;
          // a must-flag Case asserts the subject row only; a companion row's span is not asserted
          const odd = /(X-JFrog-Art-Api: |-u [A-Za-z0-9]+:|\|)$/;
          const parts = [];
          let at = 0;
          for (const sp of fx.spans) { parts.push(fx.text.slice(at, sp.start), { secret: fx.text.slice(sp.start, sp.end) }); at = sp.end; }
          parts.push(fx.text.slice(at));
          const lead = fx.text.slice(0, fx.spans[0].start);
          const type = /Bearer $/.test(lead) ? 'bearer_token' : /Basic $/.test(lead) ? 'authorization_credential' : 'contextual_secret';
          const typeBasis = odd.test(lead) ? 'assumed-generic-default' : 'batch2-convention';
          add(family, 'positive', `fixture-replay-${slug}`, parts, `stored fixture ${fx.id}, replayed verbatim`, ['fixture-replay'], { case: c.id, fixtures: [fx.id], type, typeBasis });
        } else if (c.outcome === 'must-not-flag') {
          add(family, 'control', `fixture-replay-${slug}`, [fx.text], `stored fixture ${fx.id}, replayed verbatim (role ${role.role})`, ['fixture-replay'], { case: c.id, fixtures: [fx.id] });
        } else {
          add(family, 'unsupported', `fixture-replay-${slug}`, [fx.text], `stored fixture ${fx.id}, replayed verbatim (not-assertable; role ${role.role})`, ['fixture-replay', 'representation'], { case: c.id, fixtures: [fx.id] });
        }
        used.add(fx.id);
      }
    }

    // ---- generated carrier variants ----
    const mk = (slotCase, extra = {}) => ({ case: slotCase, fixtures: caseFx(slotCase), ...extra });
    row.slots.forEach((slot, si) => {
      const tag = `${slot.kind}${slot.name ? `-${slot.name}` : ''}`;
      const ex = (type = 'contextual_secret', typeBasis = 'batch2-convention') => mk(slot.case, { type, typeBasis });
      const shapes = (T, layoutParts, axes0) => {
        // the Cases assert placement, not shape: the same slot with other value shapes keeps the exact span
        const vs = [
          ['hyphenated', `SYNTHETIC-${slugOf(family).slice(0, 12).toLowerCase()}-never-issued-${L(`vs:${tag}:h`, 4, DIGITS)}`],
          ['dotted-underscore', `${L(`vs:${tag}:d1`, 20)}.${L(`vs:${tag}:d2`, 20)}_${L(`vs:${tag}:d3`, 10)}`],
          ['long-150', L(`vs:${tag}:l`, 150, URLSAFE)],
          ['short-16', L(`vs:${tag}:s`, 16)],
        ];
        if (slot.kb) vs.push(['over-1kb', L(`vs:${tag}:k`, 1100, URLSAFE)]);
        for (const [n, v] of vs) layoutParts(`${T}-value-${n}`, { secret: v }, ['value-shape', ...axes0]);
      };

      if (slot.kind === 'member') {
        const T = `${slot.name}-member`;
        const ty = ex();
        const pubs = (slot.pub ?? []).map(pubVal);
        const pubJson = pubs.map(([k, v]) => `"${k}":${/^\d+$/.test(v) ? v : `"${v}"`}`);
        const after = pubJson.length ? `,${pubJson.join(',')}` : '';
        const before = pubJson.length ? `${pubJson.join(',')},` : '';
        const NAME = slot.name;
        if (slot.response) {
          add(family, 'positive', `${T}-pretty-json-response`, [`{\n  "${NAME}": "`, sec('m0'), `"${pubs.length ? `,\n${pubs.map(([k, v]) => `  "${k}": ${/^\d+$/.test(v) ? v : `"${v}"`}`).join(',\n')}` : ''}\n}\n`], 'pretty-printed token response', ['direct-slot', 'delimiter-after'], ty);
          add(family, 'positive', `${T}-raw-http-response-compact-json`, ['HTTP/1.1 200 OK\nContent-Type: application/json\n\n', `{"${NAME}":"`, sec('m0b'), `"${after}}\n`], 'raw HTTP response, compact JSON', ['direct-slot', 'delimiter-after'], ty);
        } else if (slot.curlData) {
          add(family, 'positive', `${T}-raw-http-json-body`, [`POST /oauth/v2/private-apps/get/access-token-info HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/json\r\n\r\n{"${NAME}":"`, sec('m0'), '"}\n'], 'raw HTTP JSON request body', ['direct-slot', 'delimiter-after'], ty);
          add(family, 'positive', `${T}-curl-data-single-quoted`, [`curl -X POST https://${host}/oauth/v2/private-apps/get/access-token-info -H "Content-Type: application/json" --data '{"${NAME}":"`, sec('m0b'), `"}'\n`], 'curl --data single-quoted JSON, value then quote, brace, quote', ['delimiter-after'], ty);
        } else {
          add(family, 'positive', `${T}-pretty-json-response`, [`{\n  "name": "SYNTHETIC-token-name",\n  "${NAME}": "`, sec('m0'), '"\n}\n'], 'pretty-printed create response', ['direct-slot', 'delimiter-after'], ty);
        }
        add(family, 'positive', `${T}-json-compact`, [`{"${NAME}":"`, sec('m1'), `"${after}}\n`], 'compact member, public members after', ['direct-slot', 'delimiter-after', 'neighbouring-public-field'], ty);
        add(family, 'positive', `${T}-json-last`, [`{${before}"${NAME}":"`, sec('m2'), '"}'], 'last member, the closing brace is the last byte of the input', ['delimiter-after', 'end-of-input'], ty);
        add(family, 'positive', `${T}-json-crlf-tabs`, [`{\r\n\t${pubJson.map(p => `${p},\r\n\t`).join('')}"${NAME}": "`, sec('m3'), '"\r\n}\r\n'], 'pretty JSON with CRLF and tabs', ['line-ending', 'delimiter-before'], ty);
        add(family, 'positive', `${T}-json-spaced-colon`, [`{"${NAME}" : "`, sec('m4'), '" , "x": 1}\n'], 'whitespace around the colon and comma', ['delimiter-before', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-json-nested-array`, [`{"data":[{${before}"${NAME}":"`, sec('m5'), '","name":"Example"},{"name":"Other"}],"paging":{}}\n'], 'inside data[0] of an array of entries', ['nesting'], ty);
        add(family, 'positive', `${T}-json-same-shape-neighbour`, [`{"client_id":"${shape('a')}","${NAME}":"`, sec('m6'), `","client_ref":"${shape('b')}"}\n`], 'public-named values with the secret\'s alphabet and length on both sides', ['same-shape-neighbour', 'neighbouring-public-field'], ty);
        add(family, 'positive', `${T}-json-utf8-before-after`, [`{"note":"${MB}","${NAME}":"`, sec('m7'), `","after":"${MB}"}\n`], 'multi-byte text before and after the value', ['utf8-preceding', 'utf8-following'], ty);
        add(family, 'positive', `${T}-json-big-preceding`, [BIG, `{"${NAME}":"`, sec('m8'), '"}\n'], 'about 5 KB of unrelated lines first', ['big-preceding'], ty);
        add(family, 'positive', `${T}-repeat`, [`request: {"${NAME}":"`, sec('rep'), `"}\nlog: {"${NAME}":"`, { secret: L('rep', 40) }, '"}\n'], 'the same value twice', ['repeat-secret'], ty);
        add(family, 'positive', `${T}-neighbouring-secret`, [`{"${NAME}":"`, sec('m12'), `","password":"${L('other-secret', 24)}"}\n`], 'a different credential member in the same object', ['neighbouring-secret'], ty);
        shapes(T, (layout, v, axes) => add(family, 'positive', layout, [`{"${NAME}":"`, v, '"}\n'], 'value shape varied in the plain member layout', axes, ty), ['direct-slot']);
        // controls from the Case's benign forms, in the same member layouts
        for (const [i, b] of (row.memberBenign ?? []).entries()) {
          add(family, 'control', `${T}-benign-${i}-compact`, [`{"${NAME}":"${b}"${after}}\n`], `benign value form ${JSON.stringify(b)} in the member`, ['near-miss-value'], { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) });
          add(family, 'control', `${T}-benign-${i}-pretty-utf8`, [`// ${MB}\n{\n  "${NAME}": "${b}"\n}\n`], `benign value form ${JSON.stringify(b)}, pretty, multi-byte text first`, ['near-miss-value', 'utf8-preceding'], { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) });
        }
      }

      if (slot.kind === 'form') {
        const NAME = slot.name;
        const T = `${NAME}-form`;
        const ty = ex();
        const pubs = (slot.pub ?? []).map(pubVal);
        const resolve = s => s.replace('@ORG', L('org', 20, LOWER));
        const leadQ = [...slot.lead.map(resolve), ...pubs.map(([k, v]) => `${k}=${v}`)];
        const trailQ = slot.trail.map(resolve);
        const leadS = leadQ.length ? `${leadQ.join('&')}&` : '';
        const trailS = trailQ.length ? `&${trailQ.join('&')}` : '';
        const method = slot.method ?? 'POST';
        const hdr = `${method} ${slot.path} HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n`;
        if (!slot.queryOnly) {
          add(family, 'positive', `${T}-raw-http-body-middle`, [hdr, `${leadS}${NAME}=`, sec('f1'), `${trailS || '&scope=openid'}\r\n`], 'form body, followed by another parameter', ['direct-slot', 'delimiter-after', 'neighbouring-public-field', 'line-ending'], ty);
          add(family, 'positive', `${T}-body-last-eol`, [`${leadS}${NAME}=`, sec('f3'), '\n'], 'last parameter then newline', ['delimiter-after'], ty);
          add(family, 'positive', `${T}-body-first-eof`, [`${NAME}=`, sec('f2'), ...(leadQ.length ? [`&${leadQ.join('&')}`] : [])], 'first parameter; the input ends after the last public parameter (or the value when none)', ['delimiter-before', 'end-of-input'], ty);
          add(family, 'positive', `${T}-body-value-eof`, [`${leadS}${NAME}=`, sec('f2e')], 'the value is the last byte of the input', ['end-of-input', 'stream-cut'], ty);
          add(family, 'positive', `${T}-curl-d-double`, [`curl -X ${method} "https://${host}${slot.path}" ${leadQ.map(q => `-d "${q}" `).join('')}-d "${NAME}=`, sec('f4'), `"${trailQ.map(q => ` -d "${q}"`).join('')}\n`], 'one curl -d double-quoted argument per parameter, value then closing quote', ['delimiter-after'], ty);
          add(family, 'positive', `${T}-curl-d-single`, [`curl -s -d '${leadS}${NAME}=`, sec('f5'), `${trailS}' https://${host}${slot.path}\n`], 'curl -d single-quoted body', ['delimiter-after'], ty);
          if (slot.urlencode) add(family, 'positive', `${T}-curl-data-urlencode`, [`curl -X ${method} "https://${host}${slot.path}" ${leadQ.map(q => `--data-urlencode "${q}" `).join('')}--data-urlencode "${NAME}=`, sec('f6'), `"${trailQ.map(q => ` --data-urlencode "${q}"`).join('')}\n`], 'curl --data-urlencode arguments', ['delimiter-after'], ty);
          add(family, 'positive', `${T}-percent-neighbours`, [`redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb%3Fa%3D1&${NAME}=`, sec('f8'), `&code=${L('code', 24)}%3D\n`], 'percent-encoded public neighbours (the value itself has no escape)', ['neighbouring-public-field'], ty);
          add(family, 'positive', `${T}-utf8-before-after`, [`# ${MB}\n${NAME}=`, sec('f10'), `&note=${MB}\n`], 'multi-byte text before the slot and after the delimiter', ['utf8-preceding', 'utf8-following'], ty);
          add(family, 'positive', `${T}-crlf-lines`, [`${leadS}${NAME}=`, sec('f12'), '\r\nNEXT=1\r\n'], 'value then CRLF', ['line-ending'], ty);
          add(family, 'positive', `${T}-big-preceding`, [BIG, `${NAME}=`, sec('f13'), '&x=1\n'], 'about 5 KB first', ['big-preceding'], ty);
          add(family, 'positive', `${T}-same-shape-neighbour`, [`client_id=${shape('d')}&${NAME}=`, sec('f9'), `&client_ref=${shape('e')}\n`], 'same-shape public-named values on both sides', ['same-shape-neighbour'], ty);
          add(family, 'positive', `${T}-neighbouring-secret`, [`X-Api-Key: ${L('nk', 24)}\r\n\r\n${leadS}${NAME}=`, sec('f14'), `&password=${L('f14-other', 20)}\n`], 'another credential in the same document', ['neighbouring-secret'], ty);
          add(family, 'positive', `${T}-repeat`, [`${NAME}=`, sec('rep'), '&again=1\ncurl -d "', `${NAME}=`, { secret: L('rep', 40) }, '"\n'], 'the same value twice', ['repeat-secret'], ty);
          shapes(T, (layout, v, axes) => add(family, 'positive', layout, [`${leadS}${NAME}=`, v, '\n'], 'value shape varied in the plain form layout', axes, ty), ['direct-slot']);
        }
        add(family, 'positive', `${T}-query-request-line`, [`${method} ${slot.path}?${leadS}${NAME}=`, sec('q1'), `${trailS} HTTP/1.1\r\nHost: ${host}\r\n`], 'URL query on the request line, value then ampersand or space', ['nesting', 'delimiter-after', 'neighbouring-public-field'], ty);
        add(family, 'positive', `${T}-query-request-line-last`, [`${method} ${slot.path}?${leadS}${NAME}=`, sec('q2'), ' HTTP/1.1\r\nHost: ' + host + '\r\n'], 'URL query, the value is the last parameter and the space ends it', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-curl-url-double-quoted`, [`curl -i -X ${method} "https://${host}${slot.path}?${leadS}${NAME}=`, sec('q3'), `${trailS}"\n`], 'curl URL in double quotes, value then ampersand or quote', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-query-continues`, [`https://${host}${slot.path}?${NAME}=`, sec('q4'), `${leadQ.length ? `&${leadQ.join('&')}` : ''}${trailS}&debug=all\n`], 'the secret is the first query parameter and more follow', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-query-html-href`, [`<a href="https://${host}${slot.path}?${NAME}=`, sec('q5'), '">link</a>\n'], 'inside an HTML href, value then closing quote', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-url-fragment`, [`https://app.example.test/cb?state=${L('state', 16)}&${NAME}=`, sec('q6'), '#section\n'], 'value ends at a URL fragment marker', ['nesting', 'delimiter-after'], ty);
        // controls: the Case's benign forms in the form layouts (no org_id in the trailer, no numeric app ID: reviewer C-B4, C-B3)
        const ctlTrail = trailQ.filter(q => !q.startsWith('org_id=')).length ? `&${trailQ.filter(q => !q.startsWith('org_id=')).join('&')}` : '';
        const ctlLead = family === 'meta:app-secret' ? 'client_id={your-app_id}&' : leadS;
        for (const [i, b] of row.benign.entries()) {
          const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) };
          add(family, 'control', `${T}-benign-${i}-body`, [`${ctlLead}${NAME}=${b}${ctlTrail}\n`], `benign value form ${JSON.stringify(b)} in the form body`, ['near-miss-value'], ctl);
          add(family, 'control', `${T}-benign-${i}-query-eof`, [`${method} ${slot.path}?${NAME}=${b}`], `benign value form ${JSON.stringify(b)} at the end of a query`, ['near-miss-value', 'end-of-input'], ctl);
          add(family, 'control', `${T}-benign-${i}-curl-utf8`, [`# ${MB}\ncurl -d "${ctlLead}${NAME}=${b}" https://${host}${slot.path} # ${MB}\n`], `benign value form ${JSON.stringify(b)} in curl -d, multi-byte text around`, ['near-miss-value', 'utf8-preceding', 'utf8-following'], ctl);
        }
      }

      if (slot.kind === 'bearer' || slot.kind === 'header') {
        const bearer = slot.kind === 'bearer';
        const H = bearer ? 'Authorization' : slot.name;
        const S = bearer ? 'Bearer ' : '';
        const T = bearer ? 'bearer' : `header-${slot.name.toLowerCase()}`;
        const ty = bearer ? ex('bearer_token') : ex('contextual_secret', 'assumed-generic-default');
        const method = slot.method ?? 'GET';
        const path = slot.path;
        const req = `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\n`;
        add(family, 'positive', `${T}-raw-http`, [req + `${H}: ${S}`, sec('b1'), '\r\nAccept: application/json\r\n\r\n'], 'raw HTTP header then CRLF', ['direct-slot', 'delimiter-after', 'line-ending'], ty);
        add(family, 'positive', `${T}-raw-http-lf`, [`${H}: ${S}`, sec('b1l'), '\nAccept: application/json\n'], 'header then bare LF', ['delimiter-after', 'line-ending'], ty);
        add(family, 'positive', `${T}-eof`, [`${req}${H}: ${S}`, sec('b2')], 'the value is the last byte of the input (no CRLF)', ['end-of-input', 'stream-cut'], ty);
        add(family, 'positive', `${T}-curl-double`, [`curl -H "${H}: ${S}`, sec('b4'), `" https://${host}${path}\n`], 'double-quoted curl -H, value then closing quote', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-curl-single`, [`curl -s -H '${H}: ${S}`, sec('b5'), `' https://${host}${path}\n`], 'single-quoted curl -H', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-curl-header-long`, [`curl -X ${method} https://${host}${path} --header "${H}: ${S}`, sec('b5b'), '"\n'], 'curl --header form, value then closing quote at the end of the line', ['delimiter-after'], ty);
        if (bearer && slot.map !== undefined) add(family, 'positive', `${T}-json-header-map`, [`{\n  "headers": {\n    "${H}": "${S}`, sec('b6'), '"\n  }\n}\n'], 'JSON header map, value then quote', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-header-map-compact`, [`{"headers":{"Accept":"application/json","${H}":"${S}`, sec('b6c'), '","X-Id":"1"}}\n'], 'compact JSON header map, value then quote and comma', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-header-map-spaced`, [`{ "headers" : { "${H}" : "${S}`, sec('b7'), '" } }\n'], 'JSON with spaces around colons', ['delimiter-before'], ty);
        add(family, 'positive', `${T}-utf8-before-after`, [`// ${MB}\n${req}${H}: ${S}`, sec('b8'), `\r\nX-Note: ${MB}\r\n\r\n`], 'multi-byte text before the header and after the value', ['utf8-preceding', 'utf8-following'], ty);
        add(family, 'positive', `${T}-big-preceding`, [BIG, `${H}: ${S}`, sec('b9'), '\r\n'], 'about 5 KB first', ['big-preceding'], ty);
        add(family, 'positive', `${T}-neighbouring-secret`, [`${H}: ${S}`, sec('b10'), `\r\nX-Api-Key: ${L('nk', 24)}\r\nCookie: sid=${L('sid', 24, HEX)}\r\n`], 'other credentials in neighbouring headers', ['neighbouring-secret'], ty);
        add(family, 'positive', `${T}-repeat`, [`${H}: ${S}`, sec('rep'), `\r\n\r\ncurl -H "${H}: ${S}`, { secret: L('rep', 40) }, '" https://x.example.test/\n'], 'the same value twice', ['repeat-secret'], ty);
        add(family, 'positive', `${T}-trailing-whitespace`, [`${H}: ${S}`, sec('b11'), '   \t\r\n'], 'trailing spaces and tab are outside the value', ['line-ending', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-same-shape-neighbour`, [`X-Request-Id: ${shape('r')}\r\n${H}: ${S}`, sec('b12'), `\r\nX-Trace: ${shape('t')}\r\n`], 'same-shape public header values', ['same-shape-neighbour'], ty);
        shapes(T, (layout, v, axes) => add(family, 'positive', layout, [`${H}: ${S}`, v, '\r\n'], 'value shape varied in the plain header layout', axes, ty), ['direct-slot']);
        for (const [i, b] of row.benign.entries()) {
          const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) };
          const v = b === null ? '' : b;
          const lead = `${H}:${b === null ? (bearer ? ' Bearer' : '') : ` ${S}${v}`}`;
          add(family, 'control', `${T}-benign-${i}-raw`, [`${req}${lead}\r\nAccept: application/json\r\n\r\n`], `benign form ${JSON.stringify(b)} in the raw header`, ['near-miss-value', 'line-ending'], ctl);
          add(family, 'control', `${T}-benign-${i}-eof`, [`${req}${lead}`], `benign form ${JSON.stringify(b)} at the end of the input`, ['near-miss-value', 'end-of-input'], ctl);
          add(family, 'control', `${T}-benign-${i}-curl-utf8`, [`// ${MB}\ncurl -H "${lead}" https://${host}${path} # ${MB}\n`], `benign form ${JSON.stringify(b)} in curl -H, multi-byte text around`, ['near-miss-value', 'utf8-preceding', 'utf8-following'], ctl);
        }
        for (const [name, render, vals] of (bearer ? row.extraControls ?? [] : [])) {
          for (const [i, v] of vals.entries()) {
            const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase) };
            add(family, 'control', `${name}-${i}`, [render(v)], `provider-published placeholder ${v}`, ['near-miss-value'], ctl);
            add(family, 'control', `${name}-${i}-utf8`, [`// ${MB}\n${render(v)}// ${MB}\n`], `provider-published placeholder ${v}, multi-byte text around`, ['near-miss-value', 'utf8-preceding', 'utf8-following'], ctl);
          }
        }
      }

      if (slot.kind === 'basicpw') {
        const ty = ex('contextual_secret', 'assumed-generic-default');
        const u = 'User1';
        const T = 'curl-u-password';
        add(family, 'positive', `${T}-plain`, [`${CURL_U} ${u}:`, sec('u1'), ` https://artifactory.example.test/artifactory/api/system/ping\n`], 'curl -u user:value, value then space', ['direct-slot', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-eof`, [`curl https://artifactory.example.test/artifactory/api/system/ping ${cat('-', 'u')} ${u}:`, sec('u2')], 'the value is the last byte of the input', ['end-of-input', 'stream-cut'], ty);
        add(family, 'positive', `${T}-double-quoted`, [`${CURL_U} "${u}:`, sec('u3'), '" https://artifactory.example.test/artifactory/api/system/ping\n'], 'double-quoted user:value argument', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-single-quoted`, [`${CURL_U} '${u}:`, sec('u4'), "' https://artifactory.example.test/artifactory/api/system/ping\n"], 'single-quoted user:value argument', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-flag-after`, [`${CURL_U} ${u}:`, sec('u5'), ' -X GET -H "Accept: application/json" https://artifactory.example.test/artifactory/api/system/ping\n'], 'another flag follows', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-utf8-before-after`, [`# ${MB}\n${CURL_U} ${u}:`, sec('u6'), ` https://artifactory.example.test/ # ${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following'], ty);
        add(family, 'positive', `${T}-crlf`, [`${CURL_U} ${u}:`, sec('u7'), ' https://artifactory.example.test/\r\n'], 'CRLF line ending', ['line-ending'], ty);
        add(family, 'positive', `${T}-big-preceding`, [BIG, `${CURL_U} ${u}:`, sec('u8'), ' https://artifactory.example.test/\n'], 'about 5 KB first', ['big-preceding'], ty);
        add(family, 'positive', `${T}-repeat`, [`${CURL_U} ${u}:`, sec('rep'), ` https://a.example.test/\n${CURL_U} other:`, { secret: L('rep', 40) }, ' https://b.example.test/\n'], 'the same value twice', ['repeat-secret'], ty);
        add(family, 'positive', `${T}-user-with-digits-and-dots`, [`${CURL_U} ci.user-01:`, sec('u9'), ' https://artifactory.example.test/\n'], 'a user name with dots, hyphen and digits', ['delimiter-before'], ty);
        shapes(T, (layout, v, axes) => add(family, 'positive', layout, [`${CURL_U} ${u}:`, v, ' https://artifactory.example.test/\n'], 'value shape varied in the plain curl -u layout', axes, ty), ['direct-slot']);
        for (const [i, b] of row.benign.entries()) {
          if (b === null || b === '********') continue;
          const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) };
          add(family, 'control', `${T}-benign-${i}`, [`${CURL_U} ${u}:${b} https://artifactory.example.test/artifactory/api/system/ping\n`], `benign form ${JSON.stringify(b)} as the curl -u password`, ['near-miss-value'], ctl);
          add(family, 'control', `${T}-benign-${i}-eof-utf8`, [`# ${MB}\n${CURL_U} ${u}:${b}`], `benign form ${JSON.stringify(b)}, end of input, multi-byte text first`, ['near-miss-value', 'end-of-input', 'utf8-preceding'], ctl);
        }
      }

      if (slot.kind === 'basic') {
        const ty = ex('authorization_credential');
        const cid = slug => `${L(`cid:${slug}`, slot.cidLen, LOWER)}`;
        const env = (slug, secLen = 40) => ({ secret: b64(`${cid(slug)}:${L(slug, secLen)}`) });
        const T = 'basic';
        add(family, 'positive', `${T}-raw-http-token-request`, ['POST /token HTTP/1.1\r\nHost: ' + host + '\r\nAuthorization: Basic ', env('b1'), '\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ngrant_type=authorization_code&code=SYNTHETIC-authorization-code\r\n'], 'whole encoded envelope then CRLF', ['direct-slot', 'delimiter-after', 'line-ending'], ty);
        add(family, 'positive', `${T}-curl-refresh-header`, ['curl -X POST -H "Authorization: Basic ', env('b3'), `" -d "grant_type=refresh_token" -d "refresh_token=SYNTHETIC-placeholder-refresh-reference" https://${host}/token\n`], 'refresh request, double-quoted curl -H', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-raw-http-revocation`, [`POST /revoke HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic `, env('b4'), '\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ntoken=SYNTHETIC-token-reference\r\n'], 'revocation request', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-eof`, ['POST /token HTTP/1.1\r\nAuthorization: Basic ', env('b2')], 'envelope is the last byte of the input', ['end-of-input', 'stream-cut'], ty);
        add(family, 'positive', `${T}-curl-single`, ["curl -s -H 'Authorization: Basic ", env('b5'), `' -d grant_type=authorization_code https://${host}/token\n`], 'single-quoted curl -H', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-header-map`, ['{"headers":{"Content-Type":"application/x-www-form-urlencoded","Authorization":"Basic ', env('b6'), '"}}\n'], 'JSON header map', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-utf8-before-after`, [`// ${MB}\nPOST /token HTTP/1.1\r\nAuthorization: Basic `, env('b7'), `\r\nX-Note: ${MB}\r\n\r\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following'], ty);
        add(family, 'positive', `${T}-big-preceding`, [BIG, 'Authorization: Basic ', env('b8'), '\r\n'], 'about 5 KB first', ['big-preceding'], ty);
        add(family, 'positive', `${T}-neighbouring-secret`, ['Authorization: Basic ', env('b9'), `\r\nX-Api-Key: ${L('nk', 24)}\r\n`], 'another credential header', ['neighbouring-secret'], ty);
        add(family, 'positive', `${T}-repeat`, ['Authorization: Basic ', env('rep'), '\r\ncurl -H "Authorization: Basic ', { secret: env('rep').secret }, '" https://x.example.test/\n'], 'the same envelope twice', ['repeat-secret'], ty);
        for (const n of [0, 1, 2]) add(family, 'positive', `${T}-padding-${n}`, ['Authorization: Basic ', { secret: b64(`${cid(`pad${n}`)}:${L(`pad${n}`, 40 + n)}`) }, '\r\n'], `encoded envelope whose base64 ends in ${n === 0 ? 'no' : n === 1 ? 'one' : 'two'} padding byte(s) depending on length`, ['alphabet'], ty);
        add(family, 'positive', `${T}-trailing-whitespace`, ['Authorization: Basic ', env('b10'), '   \t\r\n'], 'trailing spaces and tab are outside the envelope', ['line-ending', 'delimiter-after'], ty);
        for (const [i, b] of row.benign.entries()) {
          const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) };
          add(family, 'control', `${T}-benign-${i}-raw`, [`POST /token HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic ${b}\r\n\r\n`], `benign form ${JSON.stringify(b)} in the Basic header`, ['near-miss-value', 'line-ending'], ctl);
          add(family, 'control', `${T}-benign-${i}-eof-utf8`, [`// ${MB}\nAuthorization: Basic ${b}`], `benign form ${JSON.stringify(b)}, end of input, multi-byte text first`, ['near-miss-value', 'end-of-input', 'utf8-preceding'], ctl);
        }
      }

      if (slot.kind === 'pipe') {
        const ty = ex('contextual_secret', 'assumed-generic-default');
        const appId = slug => L(`appid:${slug}`, 16, DIGITS);
        const T = 'access-token-pipe';
        const q = slug => `access_token=${appId(slug)}|`;
        add(family, 'positive', `${T}-request-line`, [`GET /v26.0/me?${q('p1')}`, sec('p1'), ` HTTP/1.1\r\nHost: ${host}\r\n`], 'request line, value then space', ['direct-slot', 'delimiter-after', 'neighbouring-public-field'], ty);
        add(family, 'positive', `${T}-curl-url`, [`curl -i -X GET "https://${host}/v26.0/me?${q('p2')}`, sec('p2'), '"\n'], 'curl URL, value then closing quote', ['delimiter-after'], ty);
        add(family, 'positive', `${T}-query-continues`, [`https://${host}/v26.0/me?fields=id&${q('p3')}`, sec('p3'), '&debug=all\n'], 'the query continues with another parameter', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-query-eof`, [`https://${host}/v26.0/me?${q('p4')}`, sec('p4')], 'the value is the last byte of the input', ['end-of-input', 'stream-cut'], ty);
        add(family, 'positive', `${T}-html-href`, [`<a href="https://${host}/v26.0/me?${q('p5')}`, sec('p5'), '">link</a>\n'], 'inside an HTML href, value then quote', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-json-string`, [`{"url":"https://${host}/v26.0/me?${q('p6')}`, sec('p6'), '","method":"GET"}\n'], 'inside a JSON string', ['nesting', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-form-body`, [q('p7'), sec('p7'), '&fields=id\n'], 'as the first parameter of a form body', ['delimiter-before', 'delimiter-after'], ty);
        add(family, 'positive', `${T}-utf8-before-after`, [`# ${MB}\nGET /v26.0/me?${q('p8')}`, sec('p8'), ` HTTP/1.1 # ${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following'], ty);
        add(family, 'positive', `${T}-big-preceding`, [BIG, `GET /v26.0/me?${q('p9')}`, sec('p9'), ' HTTP/1.1\r\n'], 'about 5 KB first', ['big-preceding'], ty);
        add(family, 'positive', `${T}-repeat`, [`GET /v26.0/me?${q('rep')}`, sec('rep'), ' HTTP/1.1\r\ncurl "https://x.example.test/?access_token=' + appId('rep') + '|', { secret: L('rep', 40) }, '"\n'], 'the same secret twice', ['repeat-secret'], ty);
        add(family, 'positive', `${T}-same-shape-app-id`, [`GET /v26.0/me?access_token=${L('shape:aid', 40)}|`, sec('p10'), ' HTTP/1.1\r\n'], 'an app ID part with the secret\'s alphabet and length', ['same-shape-neighbour', 'neighbouring-public-field'], ty);
        shapes(T, (layout, v, axes) => add(family, 'positive', layout, [`GET /v26.0/me?${q('vs')}`, v, ' HTTP/1.1\r\n'], 'value shape varied in the plain pipe layout', axes, ty), ['direct-slot']);
        for (const [i, b] of (row.pipeBenign ?? []).entries()) {
          const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase), classExt: isClassExt(b) };
          const v = b.replace(/@APPID/g, '{your-app_id}');
          add(family, 'control', `${T}-benign-${i}-request-line`, [`GET /v26.0/me?access_token=${v} HTTP/1.1\r\nHost: ${host}\r\n`], `benign pair ${JSON.stringify(b)}`, ['near-miss-value'], ctl);
          add(family, 'control', `${T}-benign-${i}-curl-utf8`, [`# ${MB}\ncurl -i -X GET "https://${host}/v26.0/me?access_token=${v}" # ${MB}\n`], `benign pair ${JSON.stringify(b)}, multi-byte text around`, ['near-miss-value', 'utf8-preceding', 'utf8-following'], ctl);
        }
        // the derived appsecret_proof is a sha256 hex output, not the app secret
        for (const n of [0, 1]) add(family, 'control', `appsecret-proof-${n}`, [`GET /v26.0/me?access_token={user-access-token}&appsecret_proof=${L(`proof${n}`, 64, HEX)}${n ? '&debug=all' : ''} HTTP/1.1\r\nHost: ${host}\r\n`], 'a derived appsecret_proof (sha256 hex), the access token it protects is a template', ['near-miss-name'], { case: row.controlCase, fixtures: caseFx(row.controlCase) });
      }
    });

    // ---- public-only controls (identifiers and non-values the Case names) ----
    for (const [i, tpl] of (row.publicOnly ?? []).entries()) {
      const text = tpl.replace('@CID', L('pc:cid', 24, LOWER)).replace('@CODE', L('pc:code', 24)).replace('@CONSUMERKEY', L('pc:ck', 24, LOWER));
      add(family, 'control', `public-only-${i}`, [text], 'only public identifiers and non-values the Case names', ['neighbouring-public-field'], { case: row.controlCase, fixtures: caseFx(row.controlCase) });
      add(family, 'control', `public-only-${i}-utf8`, [`// ${MB}\n${text}// ${MB}\n`], 'public identifiers, multi-byte text around', ['neighbouring-public-field', 'utf8-preceding', 'utf8-following'], { case: row.controlCase, fixtures: caseFx(row.controlCase) });
    }
    if (family === 'adobe:oauth-server-to-server-client-secret' || family === 'adobe:enterprise-web-app-client-secret' || family === 'adobe:oauth-web-app-client-secret') {
      const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase) };
      add(family, 'control', 'client-id-in-x-api-key-header', [`GET /credentials HTTP/1.1\r\nHost: ${host}\r\nx-api-key: ${L('xapi', 32, LOWER)}\r\nAuthorization: Bearer {ACCESS_TOKEN}\r\n`], 'the client ID is the public identifier sent as x-api-key', ['neighbouring-public-field', 'same-shape-neighbour'], ctl);
      add(family, 'control', 'secret-uuid-in-delete-path', [`DELETE /credentials/${L('cred', 16, LOWER)}/clientsecrets/${L('u1', 8, HEX)}-${L('u2', 4, HEX)}-${L('u3', 4, HEX)}-${L('u4', 4, HEX)}-${L('u5', 12, HEX)} HTTP/1.1\r\nHost: ${host}\r\n`], 'a secret uuid identifies a secret without being it', ['neighbouring-public-field', 'same-shape-neighbour'], ctl);
      add(family, 'control', 'list-response-uuid-and-metadata-only', [`{\n  "client_secrets": [\n    {\n      "uuid": "${L('u1', 8, HEX)}-${L('u2', 4, HEX)}-${L('u3', 4, HEX)}-${L('u4', 4, HEX)}-${L('u5', 12, HEX)}",\n      "created_date": "2026-01-01T00:00:00Z"\n    }\n  ]\n}\n`], 'list response with uuid and metadata, no secret value', ['neighbouring-public-field', 'nesting'], ctl);
      add(family, 'control', 'prose-basic-expression', ['Send Authorization: Basic Base64(clientId:clientSecret) on the token request of a confidential client.\n'], 'prose that names the header and the expression', ['near-miss-name'], ctl);
    }
    if (family === 'x:oauth1-consumer-secret') {
      const ctl = { case: row.controlCase, fixtures: caseFx(row.controlCase) };
      const sig = slug => `${b64(L(`sig:${slug}`, 20, HEX)).slice(0, 27)}%3D`;
      const nonce = slug => L(`nonce:${slug}`, 32, LOWER);
      add(family, 'control', 'oauth-signature-authorization-header', [`POST /1.1/statuses/update.json HTTP/1.1\r\nHost: ${host}\r\nAuthorization: OAuth oauth_nonce="${nonce('a')}", oauth_signature="${sig('a')}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1318622958", oauth_version="1.0"\r\n`], 'derived oauth_signature in an OAuth header', ['near-miss-name', 'line-ending'], ctl);
      add(family, 'control', 'oauth-signature-query-string', [`GET /1.1/account/verify_credentials.json?oauth_nonce=${nonce('b')}&oauth_signature=${sig('b')}&oauth_signature_method=HMAC-SHA1 HTTP/1.1\r\nHost: ${host}\r\n`], 'derived oauth_signature in a query string', ['near-miss-name', 'delimiter-after'], ctl);
      add(family, 'control', 'oauth-signature-eof', [`oauth_signature="${sig('c')}"`], 'derived oauth_signature at the end of the input', ['near-miss-name', 'end-of-input'], ctl);
      add(family, 'control', 'oauth-signature-utf8', [`// ${MB}\nAuthorization: OAuth oauth_nonce="${nonce('d')}", oauth_signature="${sig('d')}", oauth_version="1.0" // ${MB}\n`], 'derived oauth_signature, multi-byte text around', ['near-miss-name', 'utf8-preceding', 'utf8-following'], ctl);
      for (const [i, [form, label]] of [['<consumer-secret>&', 'angle placeholder'], ['${X_CONSUMER_SECRET}&', 'environment reference'], ['********&', 'masked display'], ['{{ x_consumer_secret }}&', 'template reference']].entries()) {
        add(family, 'control', `signing-key-${i}-prose`, [`The signing key is ${form} when the token secret is not yet known.\n`], `signing key with a ${label}`, ['near-miss-value'], { ...ctl, classExt: isClassExt(form) });
        add(family, 'control', `signing-key-${i}-eof-utf8`, [`// ${MB}\nsigning key: ${form}`], `signing key with a ${label}, end of input, multi-byte text first`, ['near-miss-value', 'end-of-input', 'utf8-preceding'], { ...ctl, classExt: isClassExt(form) });
      }
    }

    // ---- not-assertable probes: carriers and shapes the Cases leave open (observed only) ----
    for (const pr of probes(family)) {
      add(family, 'unsupported', `probe-${pr.layout}`, pr.parts, pr.note, pr.axes, { case: pr.case ?? PROBE_CASE[family], fixtures: [] });
    }
  }
  return cases;
}

export const cases = build();

export function corpusDigest() {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}
