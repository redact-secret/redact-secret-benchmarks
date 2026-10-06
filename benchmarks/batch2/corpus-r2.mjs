import { createHash } from 'node:crypto';
import { FAMILIES as ROUND1, CONFLICTS as ROUND1_CONFLICTS } from './corpus.mjs';

// Issue #739, round 2: an adversarial corpus for all 58 families, in two parts.
//   part `new-rows`            the 28 rows that were carrier-unresolved in round 1 and are ready at credential-evidence
//                              65602481 (Groups C/D/E research, snapshot-2026.10.06). Authored from the handoff research
//                              docs (docs/handoffs/batch-2-research-r1..r3.md) and the adopted product contract
//                              (redact-secret PR #1231, merge a148dadf).
//   part `round1-adversarial`  the 30 round-1 rows again, with the same adversarial axes, to test whether round 1 was
//                              too easy. Round 1's own frozen corpus (74fed382...) is not edited.
//
// Rules are those of round 1 (corpus.mjs): runtime-built filler values, no provider key literal, expectations only from
// the evidence slot and the adopted contract, never from observed output; `unsupported` and `conflict` cases are observed
// and never scored. What is new is the axes (AXES below): every case names the axes it exercises.

export const CORPUS_VERSION = 2;
export const ISSUE = 739;
export const SCHEMA = 'batch2-observations-v2';
export const CONTRACT = { repo: 'redact-secret/redact-secret', pr: 1231, merge: 'a148dadf4a43b5441ed88386d055428b2e278f25' };
export const HANDOFF = { repo: 'redact-secret/credential-evidence', commit: '65602481b83532b8acd6caf0d51b8552873e0d98', docs: ['docs/handoffs/batch-2-bounded-carriers.md', 'docs/handoffs/batch-2-research-r1.md', 'docs/handoffs/batch-2-research-r2.md', 'docs/handoffs/batch-2-research-r3.md'] };

/** What each axis tests. Cases reference these by name. */
export const AXES = {
  'direct-slot': 'the value sits in the evidence-established slot in its plainest layout',
  'delimiter-after': 'the byte right after the value (quote, ampersand, comma, brace, space, semicolon, CRLF, end of input) decides the span end',
  'delimiter-before': 'the byte right before the value (quote, equals, space, colon, tab) decides the span start',
  'neighbouring-public-field': 'a public lookalike (id, expiry, type, scope) next to the secret must stay outside the span',
  'same-shape-neighbour': 'a public value with the same alphabet and length as the secret sits next to it: shape alone must not decide',
  'neighbouring-secret': 'a second credential in the same document does not shift the first span',
  'repeat-secret': 'the same value appears twice in one document: both occurrences are the sensitive span',
  'utf8-preceding': 'multi-byte text (emoji, CJK, combining marks) before the slot: byte vs UTF-16 vs code point offsets',
  'utf8-following': 'multi-byte text right after the value or delimiter',
  'end-of-input': 'the value is the last bytes of the input, with no terminator (finalize path)',
  'line-ending': 'CRLF, tabs, indentation and trailing whitespace around the slot',
  'nesting': 'the slot is inside a nested JSON array/object, YAML list or URL with other parameters',
  'big-preceding': 'a few KB of unrelated text before the slot',
  'glued-name': 'a name lookalike glued to the slot name (suffix) that must stay a control, or a prefixed name observed as unsupported',
  'near-miss-value': 'the name is right but the value is a placeholder, reference, mask, empty, null or too short',
  'near-miss-name': 'the value is secret-shaped but the name or header is not the slot',
  'alphabet': 'Bearer values using the whole RFC 6750 b64token alphabet and padding',
  'value-entropy': 'a low-entropy literal in the slot: medium confidence and warn',
  'representation': 'a variant the handoff or the contract leaves unassertable (percent forms, quote styles, case, ambiguous layouts): observed only',
  'stream-cut': 'tiny chunk boundaries (7-byte and 1-byte runs): a cut inside the name, between name and value, inside the value and at the delimiter',
  'jwt-overlap': 'a JWT-shaped value under Bearer: one final finding, exact JWT',
};

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = `${ALNUM}-_`;
const HEX = '0123456789abcdef';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DIGITS = '0123456789';
const B64 = `${ALNUM}+/`;

export function synth(seed, length, alphabet = ALNUM) {
  let out = '';
  for (let block = 0; out.length < length; block += 1) {
    const digest = createHash('sha256').update(`batch2:739:r2:${seed}:${block}`).digest();
    for (const byte of digest) {
      if (out.length === length) break;
      out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}
const b64 = text => Buffer.from(text, 'utf8').toString('base64');
const b64url = text => Buffer.from(text, 'utf8').toString('base64url');

const CID = ['client_id', LOWER, 24];

/**
 * Rows new in round 2. `slots` are the carriers the handoff research establishes (kind + name); `claims` the research
 * claim ids; `pub` the named public lookalikes; `body` the value alphabet and length (never established by the evidence).
 */
const N = (group, slots, claims, pub, body, extra = {}) => ({ group, slots, claims, pub, body, ...extra });
const NEW_ROWS = {
  // G1
  'asana:oauth-access-token': N('G1', [['member', 'access_token'], ['bearer']], ['carrier-response-member-and-bearer-header'], [CID, ['gid', DIGITS, 16]], [URLSAFE, 44]),
  'box:oauth-access-token': N('G1', [['member', 'access_token'], ['bearer']], ['carrier-response-member-and-bearer-header'], [CID], [ALNUM, 32]),
  'contentful:oauth-application-access-token': N('G1', [['fragment', 'access_token']], ['redirect-uri-hash-fragment'], [['space', LOWER, 12], ['state', ALNUM, 20]], [URLSAFE, 43]),
  'meta:instagram-user-access-token': N('G1', [['member', 'access_token']], ['instagram-token-response-members'], [['user_id', DIGITS, 17], ['app_id', DIGITS, 15]], [ALNUM, 80]),
  'meta:page-access-token': N('G1', [['member', 'access_token']], ['accounts-response-member'], [['id', DIGITS, 16], ['app_id', DIGITS, 15]], [ALNUM, 96]),
  'meta:system-user-access-token': N('G1', [['member', 'access_token']], ['generation-response-and-refresh-member'], [['id', DIGITS, 16], ['business_id', DIGITS, 16]], [ALNUM, 88]),
  'meta:user-access-token': N('G1', [['form', 'access_token'], ['member', 'access_token']], ['access-token-carrier'], [['app_id', DIGITS, 15], ['user_id', DIGITS, 17]], [ALNUM, 72]),
  'salesforce:oauth-access-token': N('G1', [['member', 'access_token'], ['bearer']], ['token-response-member-and-bearer-header'], [['client_id', ALNUM, 40], ['instance_url', null]], [ALNUM, 90]),
  // G2
  'airtable:oauth-refresh-token': N('G2', [['member', 'refresh_token'], ['form', 'refresh_token']], ['carrier-response-member-and-refresh-field'], [CID, ['scope', LOWER, 12]], [ALNUM, 60]),
  'asana:oauth-refresh-token': N('G2', [['member', 'refresh_token'], ['form', 'refresh_token']], ['carrier-response-member-and-request-fields'], [CID], [URLSAFE, 40]),
  'box:oauth-refresh-token': N('G2', [['member', 'refresh_token'], ['form', 'refresh_token']], ['carrier-response-member-and-request-field'], [CID], [ALNUM, 64]),
  'dropbox:refresh-token': N('G2', [['member', 'refresh_token'], ['form', 'refresh_token']], ['carrier-response-member-and-request-field'], [['client_id', LOWER, 15], ['account_id', ALNUM, 40]], [URLSAFE, 64]),
  'elastic:refresh-token': N('G2', [['member', 'refresh_token']], ['refresh-token-request-and-response-member'], [['username', LOWER, 8]], [ALNUM, 45]),
  'hubspot:oauth-refresh-token': N('G2', [['member', 'refresh_token'], ['form', 'refresh_token']], ['refresh-token-member-and-form-field'], [CID, ['hub_id', DIGITS, 8]], [URLSAFE, 38]),
  'x:oauth2-refresh-token': N('G2', [['form', 'refresh_token'], ['member', 'refresh_token']], ['refresh-request-form-fields', 'exchange-response-refresh-token-member'], [CID, ['scope', LOWER, 12]], [URLSAFE, 52]),
  'zendesk:oauth-refresh-token': N('G2', [['member', 'refresh_token']], ['refresh-token-json-members'], [CID], [ALNUM, 64]),
  // G3
  'airtable:oauth-client-secret': N('G3', [['basic']], ['carrier-basic-authorization-header'], [CID], [ALNUM, 64], { basicUrlsafe: true }),
  'asana:oauth-client-secret': N('G3', [['form', 'client_secret']], ['carrier-token-request-field'], [CID, ['x-asana-request-signature', HEX, 64]], [LOWER, 32]),
  'box:oauth-client-secret': N('G3', [['form', 'client_secret']], ['carrier-token-request-field'], [CID], [ALNUM, 32]),
  'hubspot:app-client-secret': N('G3', [['form', 'client_secret']], ['client-secret-form-field'], [CID, ['app_id', DIGITS, 7]], [LOWER, 36]),
  'salesforce:external-client-app-consumer-secret': N('G3', [['form', 'client_secret'], ['basic']], ['client-secret-token-request-parameter'], [['client_id', ALNUM, 40]], [HEX.toUpperCase(), 64]),
  'spotify:client-secret': N('G3', [['basic']], ['basic-authorization-header'], [['client_id', HEX, 32]], [HEX, 32]),
  'zoom:oauth-app-client-secret': N('G3', [['basic'], ['form', 'client_secret']], ['basic-header-carrier', 'client-secret-form-field-development-example'], [CID, ['account_id', ALNUM, 22]], [ALNUM, 32]),
  'zoom:server-to-server-client-secret': N('G3', [['basic']], ['basic-header-carrier'], [CID, ['account_id', ALNUM, 22]], [ALNUM, 32]),
  // G4
  'elastic:ece-api-key': N('G4', [['apikey']], ['authorization-apikey-carrier'], [['id', LOWER, 20]], [URLSAFE, 0]),
  'jfrog:access-token': N('G4', [['bearer'], ['bearer-jwt']], ['authorization-bearer-header'], [['username', LOWER, 8]], [URLSAFE, 64]),
  // G5
  'hubspot:personal-access-key': N('G5', [['yamlenv', 'personalAccessKey', 'HUBSPOT_PERSONAL_ACCESS_KEY']], ['config-field-personal-access-key', 'environment-variable-carrier'], [['portalId', DIGITS, 8], ['authType', null]], [URLSAFE, 44]),
  'jfrog:myjfrog-api-token': N('G5', [['bearer']], ['myjfrog-portal-api-bearer'], [['username', LOWER, 8]], [URLSAFE, 48]),
};

/** Round-1 rows mapped to the round-2 slot kinds. `digest-only` has no wire slot, so it has no round-2 positives. */
function round1Row(def) {
  const slots = [];
  for (const l of def.layouts) {
    if (l === 'bearer') slots.push(['bearer']);
    else if (l.startsWith('member:')) slots.push(['member', l.slice(7)]);
    else if (l.startsWith('field:')) slots.push(['form', l.slice(6)], ['member', l.slice(6)]);
    else if (l === 'basic') slots.push(['basic']);
    else if (l === 'apikey') slots.push(['apikey']);
    else if (l === 'atlas-password') slots.push(['member', 'password'], ['atlas-uri']);
  }
  return { group: def.group, slots, claims: def.claims, pub: def.publicFields.filter(p => p[1]), body: def.body, basicClientId: def.basicClientId, round1: true };
}

export const ROWS = {};
for (const [f, d] of Object.entries(NEW_ROWS)) ROWS[f] = { ...d, part: 'new-rows', pub: d.pub.filter(p => p[1]) };
for (const [f, d] of Object.entries(ROUND1)) if (d.layouts.some(l => l !== 'digest-only')) ROWS[f] = { ...round1Row(d), part: 'round1-adversarial' };
export const FAMILY_IDS = Object.keys(ROWS);
export const PARTS = ['new-rows', 'round1-adversarial'];
export const CONFLICTS = {
  ...Object.fromEntries(Object.entries(ROUND1_CONFLICTS).filter(([f]) => ROWS[f])),
};

const host = 'api.example.test';
const MB = '\u{1F680} caf\u00e9 \u65e5\u672c\u8a9e e\u0301';

function build() {
  const cases = [];
  const ids = new Set();
  const add = (family, kind, layout, parts, note, axes, extra = {}) => {
    const id = `${family}:r2:${layout}:${kind}`;
    if (ids.has(id)) throw new Error(`batch2-r2: duplicate case id ${id}`);
    ids.add(id);
    let text = '';
    const spans = [];
    for (const part of parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = Buffer.byteLength(text);
      text += part.secret;
      spans.push({ start, end: Buffer.byteLength(text) });
    }
    if (kind === 'positive' && !spans.length) throw new Error(`batch2-r2: positive ${id} has no span`);
    const row = ROWS[family];
    let expectedType = null;
    let expectedAction = null;
    if (kind === 'positive') {
      expectedAction = axes.includes('value-entropy') ? 'warn' : 'redact';
      expectedType = extra.type ?? 'contextual_secret';
    }
    cases.push({ id, family, group: row.group, part: row.part, kind, layout, axes, claims: row.claims, text, expected: kind === 'positive' ? spans[0] : null, expectedExtra: kind === 'positive' ? spans.slice(1) : [], expectedType, expectedAction, note });
  };

  for (const [family, row] of Object.entries(ROWS)) {
    const [alphabet, baseLen] = row.body;
    const sec = (slug, n = baseLen, alpha = alphabet) => ({ secret: synth(`${family}:${slug}`, n, alpha) });
    const lit = (slug, n = baseLen, alpha = alphabet) => synth(`${family}:${slug}`, n, alpha);
    const pubv = (slug, i = 0) => { const p = row.pub[i % row.pub.length]; return [p[0], `${p[3] ?? ''}${synth(`${family}:pub:${slug}:${p[0]}`, p[2], p[1])}`]; };
    const shape = slug => lit(`shape:${slug}`, baseLen, alphabet);
    const env = family.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
    const slotNames = new Set();
    for (const slot of row.slots) {
      const [kind, N0, N1] = slot;
      const name = N0;
      const tag = kind + (name ? `-${name}` : '');
      if (slotNames.has(tag)) continue;
      slotNames.add(tag);

      // ============================== member (JSON / YAML member) ==============================
      if (kind === 'member') {
        const T = `${name}-member`;
        const [pk, pv] = pubv('m');
        add(family, 'positive', `${T}-json-compact`, ['{"', name, '":"', sec('m1'), `","token_type":"bearer","${pk}":"${pv}"}\n`].map((x, i) => i === 1 ? x : x), 'plain JSON member, public fields after', ['direct-slot', 'delimiter-after', 'neighbouring-public-field']);
        add(family, 'positive', `${T}-json-last`, [`{"${pk}":"${pv}","expires_in":3600,"${name}":"`, sec('m2'), '"}'], 'last member, closing brace is the last byte of the input', ['delimiter-after', 'end-of-input']);
        add(family, 'positive', `${T}-json-crlf-tabs`, [`{\r\n\t"${pk}": "${pv}",\r\n\t"${name}": "`, sec('m3'), '",\r\n\t"expires_in": 3600\r\n}\r\n'], 'pretty JSON with CRLF and tabs', ['line-ending', 'delimiter-before']);
        add(family, 'positive', `${T}-json-spaced-colon`, [`{"${name}" : "`, sec('m4'), '" , "x": 1}\n'], 'whitespace around the colon and comma', ['delimiter-before', 'delimiter-after']);
        add(family, 'positive', `${T}-json-nested-array`, [`{"data":[{"${pk}":"${pv}","${name}":"`, sec('m5'), `","name":"Example"},{"${pk}":"${pubv('m5b')[1]}","name":"Other"}],"paging":{"cursors":{}}}\n`], 'inside data[0] of an array of entries', ['nesting', 'neighbouring-public-field']);
        add(family, 'positive', `${T}-json-same-shape-neighbour`, [`{"client_id":"${shape('a')}","${name}":"`, sec('m6'), `","client_ref":"${shape('b')}"}\n`], 'public values with the secret\'s alphabet and length on both sides', ['same-shape-neighbour', 'neighbouring-public-field']);
        add(family, 'positive', `${T}-json-utf8-before-after`, [`{"note":"${MB}","${name}":"`, sec('m7'), `","after":"${MB}"}\n`], 'multi-byte text before and after the value', ['utf8-preceding', 'utf8-following']);
        add(family, 'positive', `${T}-json-big-preceding`, [`${'x'.repeat(63)}\n`.repeat(80), `{"${name}":"`, sec('m8'), '"}\n'], 'about 5 KB of unrelated lines first', ['big-preceding']);
        add(family, 'positive', `${T}-yaml-unquoted`, [`# ${MB}\nresponse:\n  ${name}: `, sec('m9'), '\n  expires_in: 3600\n'], 'YAML mapping, unquoted, comment with multi-byte text first', ['direct-slot', 'utf8-preceding', 'delimiter-after']);
        add(family, 'positive', `${T}-yaml-quoted-crlf`, [`${name}: "`, sec('m10'), '"\r\nother: 1\r\n'], 'YAML quoted value, CRLF', ['line-ending', 'delimiter-after']);
        add(family, 'positive', `${T}-assignment-eof`, [`${name} = "`, sec('m11')], 'assignment cut at the end of the input inside the value (no closing quote)', ['end-of-input', 'stream-cut']);
        add(family, 'positive', `${T}-repeat`, [`request: {"${name}":"`, sec('rep', baseLen), `"}\nlog: ${name}=`, { secret: synth(`${family}:rep`, baseLen, alphabet) }, '\n'], 'the same value twice, JSON then assignment', ['repeat-secret']);
        add(family, 'positive', `${T}-neighbouring-secret`, [`{"${name}":"`, sec('m12'), `","client_secret":"${lit('other-secret', 24, ALNUM)}","${name}_expires_at":1791200000}\n`], 'a different credential and an expiry lookalike in the same object', ['neighbouring-secret', 'glued-name']);
        add(family, 'positive', `${T}-lowentropy`, [`{"${name}":"`, { secret: 'abcabcabcabca' }, '"}\n'], 'a 13-byte low-entropy literal: contract expectation is medium confidence and warn', ['value-entropy']);
        add(family, 'control', `${T}-suffix-lookalikes`, [`{"${name}_type":"Bearer","${name}_expires_at":1791200000,"${name}_count":3,"${name}_id":"${lit('ctl:id', 12, LOWER)}"}\n`], 'suffix-glued names with public values', ['glued-name', 'near-miss-name']);
        add(family, 'control', `${T}-null-empty`, [`{"${name}":null,"x":{"${name}":""},"y":{"${name}":"  "}}\n`], 'null, empty and blank values', ['near-miss-value']);
        add(family, 'control', `${T}-placeholders`, [`{"${name}":"<${name.replace(/_/g, '-')}>","a":{"${name}":"YOUR_${name.toUpperCase()}"}}\n`], 'angle and upper-case placeholders', ['near-miss-value']);
        add(family, 'control', `${T}-references`, [`{"${name}":"\${${env}_TOKEN}","b":{"${name}":"{{ secrets.${name} }}"}}\n`], 'environment and template references', ['near-miss-value']);
        add(family, 'control', `${T}-masks`, [`{"${name}":"********************","b":{"${name}":"••••••••••••"}}\n`], 'masked reads', ['near-miss-value']);
        add(family, 'control', `${T}-public-only`, [`{"${pk}":"${pv}","${pubv('c', 1)[0]}":"${pubv('c', 1)[1]}","token_type":"bearer","expires_in":3600,"scope":"read"}\n`], 'only public lookalikes', ['neighbouring-public-field']);
        add(family, 'control', `${T}-name-in-prose`, [`The ${name} field in the response holds the credential; do not log it. See /${name}/docs.\n`], 'the name appears in prose and a path', ['near-miss-name']);
        add(family, 'control', `${T}-same-shape-public`, [`{"client_id":"${shape('c1')}","request_id":"${shape('c2')}","etag":"${shape('c3')}"}\n`], 'secret-shaped public values under public names', ['same-shape-neighbour', 'near-miss-name']);
        add(family, 'unsupported', `${T}-below-floor`, [`{"${name}":"`, sec('floor', 7), '"}\n'], 'under the 8-byte field floor: documented limit', ['near-miss-value']);
        add(family, 'unsupported', `${T}-prefixed-name`, [`{"old_${name}":"`, sec('old', 36), '"}\n'], 'prefixed name may carry the same credential', ['glued-name', 'representation']);
        add(family, 'unsupported', `${T}-upper-name`, [`{"${name.toUpperCase()}":"`, sec('upper', 36), '"}\n'], 'case-changed name: the handoff does not establish it', ['representation']);
        add(family, 'unsupported', `${T}-single-quoted`, [`{'${name}': '`, sec('sq', 36), `'}\n`], 'Python-style single quotes', ['representation']);
        add(family, 'unsupported', `${T}-percent-value`, [`{"${name}":"${lit('pct1', 20)}%2F${lit('pct2', 12)}%3D"}\n`], 'percent-containing value (adopted: unsupported)', ['representation']);
      }

      // ============================== form / query field ==============================
      if (kind === 'form') {
        const T = `${name}-form`;
        const [pk, pv] = pubv('f');
        add(family, 'positive', `${T}-body-middle`, [`POST /oauth/token HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ngrant_type=refresh_token&${pk}=${pv}&${name}=`, sec('f1'), '&scope=read\r\n'], 'form body, followed by another parameter', ['direct-slot', 'delimiter-after', 'neighbouring-public-field']);
        add(family, 'positive', `${T}-body-first`, [`${name}=`, sec('f2'), `&${pk}=${pv}`], 'first parameter, last parameter public, end of input', ['delimiter-before', 'end-of-input']);
        add(family, 'positive', `${T}-body-last-eol`, [`grant_type=refresh_token&${pk}=${pv}&${name}=`, sec('f3'), '\n'], 'last parameter then newline', ['delimiter-after']);
        add(family, 'positive', `${T}-query-url`, [`GET /v1/me?fields=id,name&${name}=`, sec('f4'), `&${pk}=${pv} HTTP/1.1\r\nHost: ${host}\r\n\r\n`], 'URL query, followed by space and HTTP version', ['nesting', 'delimiter-after']);
        add(family, 'positive', `${T}-url-fragment`, [`https://app.example.test/cb?state=${lit('state', 16)}&${name}=`, sec('f5'), '#section\n'], 'value ends at a URL fragment marker', ['nesting', 'delimiter-after']);
        add(family, 'positive', `${T}-curl-data-quoted`, [`curl -s -d "grant_type=refresh_token&${name}=`, sec('f6'), `&${pk}=${pv}" https://${host}/oauth/token\n`], 'curl -d double-quoted body', ['delimiter-after']);
        add(family, 'positive', `${T}-curl-data-single`, [`curl -s --data '${pk}=${pv}&${name}=`, sec('f7'), `' https://${host}/oauth/token\n`], 'curl --data single-quoted body, value then quote', ['delimiter-after']);
        add(family, 'positive', `${T}-percent-neighbours`, [`redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb%3Fa%3D1&${name}=`, sec('f8'), `&code=${lit('code', 24)}%3D\n`], 'percent-encoded public neighbours (the secret itself has no escape)', ['neighbouring-public-field']);
        add(family, 'positive', `${T}-same-shape-neighbour`, [`client_id=${shape('d')}&${name}=`, sec('f9'), `&client_ref=${shape('e')}\n`], 'same-shape public values on both sides', ['same-shape-neighbour']);
        add(family, 'positive', `${T}-utf8-before-after`, [`# ${MB}\n${name}=`, sec('f10'), `&note=${MB}\n`], 'multi-byte text before the slot and after the delimiter', ['utf8-preceding', 'utf8-following']);
        add(family, 'positive', `${T}-assignment-spaced`, [`${name} = "`, sec('f11'), '"\n'], 'spaced quoted assignment', ['delimiter-before']);
        add(family, 'positive', `${T}-crlf-env`, [`export ${name.toUpperCase()}_NOTE=1\r\n${name}=`, sec('f12'), '\r\nNEXT=1\r\n'], 'CRLF env-style file', ['line-ending']);
        add(family, 'positive', `${T}-repeat`, [`${name}=`, sec('rep', baseLen), `&again=1\ncurl -d "${name}=`, { secret: synth(`${family}:rep`, baseLen, alphabet) }, '"\n'], 'the same value twice', ['repeat-secret']);
        add(family, 'positive', `${T}-lowentropy`, [`${name}=`, { secret: 'abcabcabcabca' }, '\n'], 'a 13-byte low-entropy literal: medium confidence and warn', ['value-entropy']);
        add(family, 'control', `${T}-suffix-lookalikes`, [`${name}_expires_in=2592000&${name}_type=Bearer&${name}_id=${lit('ctl:id', 12, LOWER)}\n`], 'suffix-glued names', ['glued-name', 'near-miss-name']);
        add(family, 'control', `${T}-empty-null`, [`${name}=&other=1\n${name}=null\n${name}=undefined\n`], 'empty, null and undefined', ['near-miss-value']);
        add(family, 'control', `${T}-placeholders`, [`${name}=<${name.replace(/_/g, '-')}>\n${name}=YOUR_${name.toUpperCase()}\n`], 'placeholders', ['near-miss-value']);
        add(family, 'control', `${T}-references`, [`${name}=\${${env}}\n{"${name}":"{{ secrets.${name} }}"}\n`], 'references', ['near-miss-value']);
        add(family, 'control', `${T}-masks`, [`${name}=****************\n${name}=••••••••••••\n`], 'masked values', ['near-miss-value']);
        add(family, 'control', `${T}-public-only`, [`grant_type=refresh_token&${pk}=${pv}&scope=read&redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb\n`], 'only public parameters', ['neighbouring-public-field']);
        add(family, 'control', `${T}-name-in-prose-and-path`, [`Send the ${name} in the request body. See https://docs.example.test/${name}/reference.\n`], 'name in prose and a path', ['near-miss-name']);
        add(family, 'control', `${T}-same-shape-public`, [`client_id=${shape('f1')}&request_id=${shape('f2')}&nonce=${shape('f3')}\n`], 'secret-shaped values under public names', ['same-shape-neighbour', 'near-miss-name']);
        add(family, 'unsupported', `${T}-below-floor`, [`${name}=`, sec('floor', 7), '\n'], 'under the 8-byte floor', ['near-miss-value']);
        add(family, 'unsupported', `${T}-prefixed-name`, [`old_${name}=${lit('old', 30)}\n`], 'prefixed name may carry the same credential', ['glued-name', 'representation']);
        add(family, 'unsupported', `${T}-newline-value`, [`${name}=\n`, sec('nl', 30), '\n'], 'value on the next line', ['representation']);
        add(family, 'unsupported', `${T}-percent-value`, [`${name}=${lit('pct1', 20)}%2B${lit('pct2', 12)}%3D&x=1\n`], 'percent-containing value in a form body: adopted contract keeps the whole value to the delimiter', ['representation']);
      }

      // ============================== fragment (redirect URI hash) ==============================
      if (kind === 'fragment') {
        const T = `${name}-fragment`;
        const [pk, pv] = pubv('g');
        add(family, 'positive', `${T}-redirect`, [`Location: https://app.example.test/cb#${name}=`, sec('g1'), `&token_type=bearer&${pk}=${pv}\r\n`], 'hash fragment of the redirect URI, followed by public parameters', ['direct-slot', 'delimiter-after', 'nesting']);
        add(family, 'positive', `${T}-fragment-last`, [`https://app.example.test/cb#state=${pv}&${name}=`, sec('g2')], 'last fragment parameter, end of input', ['end-of-input', 'delimiter-before']);
        add(family, 'positive', `${T}-fragment-middle`, [`https://app.example.test/cb#expires_in=3600&${name}=`, sec('g3'), '&token_type=bearer\n'], 'middle fragment parameter', ['delimiter-after']);
        add(family, 'positive', `${T}-quoted-html`, [`<a href="https://app.example.test/cb#${name}=`, sec('g4'), '&token_type=bearer">continue</a>\n'], 'inside an HTML href, value ends at an ampersand', ['nesting']);
        add(family, 'positive', `${T}-html-ending-quote`, [`<a href="https://app.example.test/cb#${name}=`, sec('g5'), '">continue</a>\n'], 'value directly followed by the closing quote of the href', ['delimiter-after']);
        add(family, 'positive', `${T}-utf8`, [`# ${MB}\nhttps://app.example.test/cb#${name}=`, sec('g6'), `&note=${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
        add(family, 'positive', `${T}-same-shape-neighbour`, [`https://app.example.test/cb#state=${shape('h')}&${name}=`, sec('g7'), `&space_id=${shape('i')}\n`], 'same-shape public values', ['same-shape-neighbour']);
        add(family, 'positive', `${T}-lowentropy`, [`https://app.example.test/cb#${name}=`, { secret: 'abcabcabcabca' }, '&x=1\n'], 'low-entropy literal: warn', ['value-entropy']);
        add(family, 'control', `${T}-public-only`, [`https://app.example.test/cb#state=${pv}&token_type=bearer&expires_in=3600\n`], 'only public fragment parameters', ['neighbouring-public-field']);
        add(family, 'control', `${T}-suffix-lookalikes`, [`https://app.example.test/cb#${name}_type=bearer&${name}_expires_in=3600\n`], 'suffix-glued names', ['glued-name']);
        add(family, 'control', `${T}-placeholders-references`, [`https://app.example.test/cb#${name}=<${name}>&b=YOUR_${name.toUpperCase()}&c=\${${env}}\n`], 'placeholders and a reference', ['near-miss-value']);
        add(family, 'control', `${T}-mask`, [`https://app.example.test/cb#${name}=****************&x=1\n`], 'masked value', ['near-miss-value']);
        add(family, 'unsupported', `${T}-below-floor`, [`https://app.example.test/cb#${name}=`, sec('floor', 7), '\n'], 'under the floor', ['near-miss-value']);
        add(family, 'unsupported', `${T}-prefixed-name`, [`https://app.example.test/cb#old_${name}=${lit('old', 30)}\n`], 'prefixed name', ['glued-name', 'representation']);
      }

      // ============================== Authorization: Bearer ==============================
      if (kind === 'bearer' || kind === 'bearer-jwt') {
        const jwt = kind === 'bearer-jwt';
        const val = (slug, n = baseLen, alpha = alphabet) => jwt
          ? { secret: `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${synth(`${family}:${slug}:p`, 40, URLSAFE)}.${synth(`${family}:${slug}:s`, 43, URLSAFE)}` }
          : { secret: synth(`${family}:${slug}`, n, alpha) };
        const type = jwt ? 'jwt' : 'bearer_token';
        const T = jwt ? 'bearer-jwt' : 'bearer';
        const [pk, pv] = pubv('b');
        const x = { type };
        add(family, 'positive', `${T}-raw-http`, [`GET /v1/resource HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Bearer `, val('b1'), '\r\nAccept: application/json\r\n\r\n'], 'raw HTTP header then CRLF', ['direct-slot', 'delimiter-after'], x);
        add(family, 'positive', `${T}-eof`, [`GET / HTTP/1.1\r\nAuthorization: Bearer `, val('b2')], 'value is the last byte of the input (no CRLF)', ['end-of-input', 'stream-cut'], x);
        add(family, 'positive', `${T}-proxy`, [`GET / HTTP/1.1\r\nProxy-Authorization: Bearer `, val('b3'), '\r\n\r\n'], 'Proxy-Authorization', ['direct-slot'], x);
        add(family, 'positive', `${T}-curl-double`, [`curl -s -H "Authorization: Bearer `, val('b4'), `" https://${host}/v1/resource\n`], 'double-quoted curl -H, closing quote', ['delimiter-after'], x);
        add(family, 'positive', `${T}-curl-single`, [`curl -s -H 'Authorization: Bearer `, val('b5'), `' https://${host}/v1/resource\n`], 'single-quoted curl -H', ['delimiter-after'], x);
        add(family, 'positive', `${T}-header-map`, [`{"headers":{"Accept":"application/json","Authorization":"Bearer `, val('b6'), '","X-Id":"1"}}\n'], 'JSON header map, value then quote and comma', ['delimiter-after', 'nesting'], x);
        add(family, 'positive', `${T}-header-map-spaced`, [`{ "headers" : { "Authorization" : "Bearer `, val('b7'), '" } }\n'], 'JSON with spaces around colons', ['delimiter-before'], x);
        add(family, 'positive', `${T}-utf8-before-after`, [`// ${MB}\nGET / HTTP/1.1\r\nAuthorization: Bearer `, val('b8'), `\r\nX-Note: ${MB}\r\n\r\n`], 'multi-byte text before the header and after the value', ['utf8-preceding', 'utf8-following'], x);
        add(family, 'positive', `${T}-big-preceding`, [`${'y'.repeat(63)}\n`.repeat(80), 'Authorization: Bearer ', val('b9'), '\r\n'], 'about 5 KB first', ['big-preceding'], x);
        add(family, 'positive', `${T}-neighbouring-secret`, [`Authorization: Bearer `, val('b10'), `\r\nX-Api-Key: ${lit('nk', 24, ALNUM)}\r\nCookie: sid=${lit('sid', 24, HEX)}\r\n`], 'other credentials in neighbouring headers', ['neighbouring-secret'], x);
        add(family, 'positive', `${T}-repeat`, [`Authorization: Bearer `, val('rep'), '\r\n\r\ncurl -H "Authorization: Bearer ', { secret: val('rep').secret }, '" https://x.example.test/\n'], 'the same value twice', ['repeat-secret'], x);
        add(family, 'positive', `${T}-trailing-whitespace`, [`Authorization: Bearer `, val('b11'), '   \t\r\n'], 'trailing spaces and tab', ['line-ending', 'delimiter-after'], x);
        add(family, 'positive', `${T}-same-shape-neighbour`, [`X-Request-Id: ${shape('r')}\r\nAuthorization: Bearer `, val('b12'), `\r\nX-Trace: ${shape('t')}\r\n`], 'same-shape public header values', ['same-shape-neighbour'], x);
        if (!jwt) {
          add(family, 'positive', `${T}-alphabet-full`, [`Authorization: Bearer `, { secret: `${synth(`${family}:al1`, 20, ALNUM)}-._~+/${synth(`${family}:al2`, 10, ALNUM)}` }, '\r\n'], 'the whole RFC 6750 b64token alphabet', ['alphabet'], x);
          add(family, 'positive', `${T}-alphabet-padding`, [`Authorization: Bearer `, { secret: `${synth(`${family}:pad`, 30, B64)}==` }, '\r\n'], 'two trailing = padding bytes', ['alphabet'], x);
        }
        if (jwt) {
          add(family, 'positive', `${T}-bare-header-name-prefix`, [`jfrog token: `, val('b13')], 'a JWT with no Bearer header: the jwt detector, exact bytes, still generic type', ['jwt-overlap', 'end-of-input'], x);
        }
        add(family, 'control', `${T}-placeholders`, [`Authorization: Bearer <your-token>\r\ncurl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" https://${host}/\n`], 'placeholders', ['near-miss-value']);
        add(family, 'control', `${T}-references`, [`curl -H "Authorization: Bearer \${${env}}" https://${host}/\n{"Authorization":"Bearer {{ secrets.token }}"}\nAuthorization: Bearer $${env}\n`], 'references', ['near-miss-value']);
        add(family, 'control', `${T}-masks`, ['Authorization: Bearer ********************\r\nAuthorization: Bearer ••••••••••••\r\n'], 'masks', ['near-miss-value']);
        add(family, 'control', `${T}-empty-null`, ['Authorization: Bearer \r\nAuthorization: Bearer null\r\nAuthorization: Bearer undefined\r\n'], 'empty, null, undefined', ['near-miss-value']);
        add(family, 'control', `${T}-prose`, ['Send the token with the Bearer scheme in the Authorization header. A Bearer token is opaque.\n'], 'prose naming the scheme', ['near-miss-name']);
        add(family, 'control', `${T}-public-only`, [`{"${pk}":"${pv}","token_type":"Bearer","expires_in":3600,"scope":"read"}\n`], 'public lookalikes only', ['neighbouring-public-field']);
        add(family, 'control', `${T}-same-shape-public`, [`X-Request-Id: ${shape('c1')}\r\nETag: "${shape('c2')}"\r\nX-Trace: ${shape('c3')}\r\n`], 'secret-shaped values under public header names', ['same-shape-neighbour', 'near-miss-name']);
        add(family, 'unsupported', `${T}-below-floor`, ['Authorization: Bearer ', val('floor', 11), '\r\n'].map(x2 => x2), 'under the 12-byte Bearer floor', ['near-miss-value']);
        add(family, 'unsupported', `${T}-prefixed-header`, [`X-Forwarded-Authorization: Bearer ${lit('xfa', 36)}\r\n`], 'prefixed header name', ['glued-name', 'representation']);
        add(family, 'unsupported', `${T}-lowercase-scheme`, [`authorization: bearer ${lit('lc', 36)}\r\n`], 'lower-case header name and scheme', ['representation']);
        add(family, 'unsupported', `${T}-no-space`, [`Authorization:Bearer ${lit('ns', 36)}\r\n`], 'no space after the colon', ['representation']);
        add(family, 'unsupported', `${T}-newline-between`, ['Authorization: Bearer\r\n', val('nlb'), '\r\n'], 'value on the next line', ['representation']);
        if (row.part === 'new-rows' && family === 'jfrog:access-token') add(family, 'unsupported', `${T}-basic-reference-token`, [`Authorization: Basic ${b64(`${lit('bu', 8, LOWER)}:${lit('brt', 40, ALNUM)}`)}\r\n`], 'the handoff documents a reference token as a Basic password: representation unresolved, not asserted', ['representation']);
        if (family === 'x:app-only-bearer-token') {
          const pv1 = `${lit('p1', 18)}%2F${lit('p2', 10)}%3D`;
          add(family, 'unsupported', `${T}-percent-raw`, [`Authorization: Bearer ${pv1}\r\n`], 'percent-containing wire form (adopted: unsupported; only the prefix before % may be redacted)', ['representation']);
          add(family, 'unsupported', `${T}-percent-curl`, [`curl -H "Authorization: Bearer ${pv1}" https://${host}/2/tweets\n`], 'percent form in curl', ['representation']);
          add(family, 'unsupported', `${T}-percent-json-escaped`, [`{"Authorization":"Bearer ${pv1.replace(/%/g, '\\u0025')}"}\n`], 'serialized-escaped percent form', ['representation']);
        }
      }

      // ============================== Authorization: Basic ==============================
      if (kind === 'basic') {
        const cid = slug => row.basicClientId ? `${row.basicClientId[0]}${synth(`${family}:cid:${slug}`, row.basicClientId[2], row.basicClientId[1])}` : synth(`${family}:cid:${slug}`, row.pub[0][2], row.pub[0][1]);
        const raw = slug => `${cid(slug)}:${synth(`${family}:${slug}`, baseLen, alphabet)}`;
        const env64 = slug => ({ secret: row.basicUrlsafe ? b64url(raw(slug)) : b64(raw(slug)) });
        const T = 'basic';
        add(family, 'positive', `${T}-raw-http`, [`POST /oauth/token HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic `, env64('b1'), '\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ngrant_type=client_credentials\r\n'], 'whole encoded envelope then CRLF', ['direct-slot', 'delimiter-after'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-eof`, [`POST /oauth/token HTTP/1.1\r\nAuthorization: Basic `, env64('b2')], 'envelope is the last byte of the input', ['end-of-input', 'stream-cut'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-curl-double`, ['curl -s -H "Authorization: Basic ', env64('b3'), `" -d grant_type=client_credentials https://${host}/oauth/token\n`], 'double-quoted curl -H', ['delimiter-after'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-curl-single`, ["curl -s -H 'Authorization: Basic ", env64('b4'), `' -d grant_type=client_credentials https://${host}/oauth/token\n`], 'single-quoted curl -H', ['delimiter-after'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-header-map`, ['{"headers":{"Content-Type":"application/x-www-form-urlencoded","Authorization":"Basic ', env64('b5'), '"}}\n'], 'JSON header map', ['nesting', 'delimiter-after'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-utf8-before-after`, [`// ${MB}\nPOST /oauth/token HTTP/1.1\r\nAuthorization: Basic `, env64('b6'), `\r\nX-Note: ${MB}\r\n\r\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-proxy`, [`GET / HTTP/1.1\r\nProxy-Authorization: Basic `, env64('b7'), '\r\n\r\n'], 'Proxy-Authorization', ['direct-slot'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-neighbouring-secret`, ['Authorization: Basic ', env64('b8'), `\r\nX-Api-Key: ${lit('nk', 24, ALNUM)}\r\n`], 'another credential header', ['neighbouring-secret'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-repeat`, ['Authorization: Basic ', env64('rep'), '\r\ncurl -H "Authorization: Basic ', { secret: env64('rep').secret }, '" https://x.example.test/\n'], 'the same envelope twice', ['repeat-secret'], { type: 'authorization_credential' });
        add(family, 'positive', `${T}-padding-variants`, ['Authorization: Basic ', { secret: `${b64(raw('pad')).replace(/=+$/, '')}==` }, '\r\n'], 'two = padding bytes', ['alphabet'], { type: 'authorization_credential' });
        add(family, 'control', `${T}-client-id-only`, [`client_id=${cid('c1')}\n{"client_id":"${cid('c2')}","name":"Example"}\n`], 'public client id', ['neighbouring-public-field']);
        add(family, 'control', `${T}-placeholders`, ['Authorization: Basic <base64-client-credentials>\r\ncurl -H "Authorization: Basic BASE64_CLIENT_CREDENTIALS" https://x.example.test/\n'], 'placeholders', ['near-miss-value']);
        add(family, 'control', `${T}-references`, [`curl -H "Authorization: Basic \${${env}_BASIC}" https://x.example.test/\nAuthorization: Basic $${env}\n`], 'references', ['near-miss-value']);
        add(family, 'control', `${T}-masks`, ['Authorization: Basic ************************\r\n'], 'mask', ['near-miss-value']);
        add(family, 'control', `${T}-empty-null`, ['Authorization: Basic \r\nAuthorization: Basic null\r\n'], 'empty and null', ['near-miss-value']);
        add(family, 'control', `${T}-prose`, ['Confidential clients send the client id and secret in a Basic Authorization header.\n'], 'prose naming the scheme', ['near-miss-name']);
        add(family, 'control', `${T}-same-shape-public`, [`X-Request-Id: ${synth(`${family}:ss1`, 48, B64)}\r\nETag: "${synth(`${family}:ss2`, 48, B64)}"\r\n`], 'base64-shaped public values under public names', ['same-shape-neighbour', 'near-miss-name']);
        add(family, 'unsupported', `${T}-below-floor`, ['Authorization: Basic ', { secret: synth(`${family}:floor`, 11, URLSAFE) }, '\r\n'], 'under the 12-byte floor', ['near-miss-value']);
        add(family, 'unsupported', `${T}-newline-between`, ['Authorization: Basic\r\n', env64('nl'), '\r\n'], 'value on the next line', ['representation']);
        add(family, 'unsupported', `${T}-lowercase-scheme`, [`authorization: basic ${b64(raw('lc'))}\r\n`], 'lower-case header name and scheme', ['representation']);
        add(family, 'unsupported', `${T}-curl-user`, [`curl -s --user ${cid('u')}:${lit('uf', baseLen)} https://${host}/oauth/token\n`], 'curl --user is not an Authorization header layout', ['representation']);
      }

      // ============================== Authorization: ApiKey ==============================
      if (kind === 'apikey') {
        const key = slug => ({ secret: b64(`${synth(`${family}:${slug}:id`, 20, URLSAFE)}:${synth(`${family}:${slug}:key`, 22, URLSAFE)}`) });
        const T = 'apikey';
        const x = { type: 'authorization_credential' };
        add(family, 'positive', `${T}-raw-http`, [`GET /api/v1/deployments HTTP/1.1\r\nHost: ${host}\r\nAuthorization: ApiKey `, key('a1'), '\r\n\r\n'], 'raw header, CRLF', ['direct-slot', 'delimiter-after'], x);
        add(family, 'positive', `${T}-eof`, ['GET / HTTP/1.1\r\nAuthorization: ApiKey ', key('a2')], 'end of input', ['end-of-input', 'stream-cut'], x);
        add(family, 'positive', `${T}-curl-double`, ['curl -s -H "Authorization: ApiKey ', key('a3'), `" https://${host}/api/v1/deployments\n`], 'double-quoted curl -H', ['delimiter-after'], x);
        add(family, 'positive', `${T}-curl-single`, ["curl -s -H 'Authorization: ApiKey ", key('a4'), `' https://${host}/api/v1/deployments\n`], 'single-quoted curl -H', ['delimiter-after'], x);
        add(family, 'positive', `${T}-header-map`, ['{"headers":{"Accept":"application/json","Authorization":"ApiKey ', key('a5'), '"}}\n'], 'JSON header map', ['nesting'], x);
        add(family, 'positive', `${T}-proxy`, ['GET / HTTP/1.1\r\nProxy-Authorization: ApiKey ', key('a6'), '\r\n\r\n'], 'Proxy-Authorization', ['direct-slot'], x);
        add(family, 'positive', `${T}-utf8-before-after`, [`// ${MB}\nAuthorization: ApiKey `, key('a7'), `\r\nX-Note: ${MB}\r\n`], 'multi-byte before and after', ['utf8-preceding', 'utf8-following'], x);
        add(family, 'positive', `${T}-padding-and-urlsafe`, ['Authorization: ApiKey ', { secret: `${synth(`${family}:pu`, 40, URLSAFE)}==` }, '\r\n'], 'url-safe characters and two = padding bytes', ['alphabet'], x);
        add(family, 'positive', `${T}-neighbouring-secret`, ['Authorization: ApiKey ', key('a8'), `\r\nX-Api-Key: ${lit('nk', 24, ALNUM)}\r\n`], 'another credential header', ['neighbouring-secret'], x);
        add(family, 'positive', `${T}-repeat`, ['Authorization: ApiKey ', key('rep'), '\r\ncurl -H "Authorization: ApiKey ', { secret: key('rep').secret }, '" https://x.example.test/\n'], 'the same key twice', ['repeat-secret'], x);
        add(family, 'positive', `${T}-ece-variable-form`, ['curl -s -H "Authorization: ApiKey ', key('a9'), `" https://${host}:12443/api/v1/deployments\n`], 'ECE coordinator API example shape (port, path)', ['direct-slot'], x);
        add(family, 'control', `${T}-ece-reference-example`, [`curl -H "Authorization: ApiKey $ECE_API_KEY" https://${host}:12443/api/v1/deployments\n`], 'the documented example form uses a reference', ['near-miss-value']);
        add(family, 'control', `${T}-placeholders`, ['Authorization: ApiKey <your-api-key>\r\nAuthorization: ApiKey YOUR_API_KEY\r\n'], 'placeholders', ['near-miss-value']);
        add(family, 'control', `${T}-masks`, ['Authorization: ApiKey ****************************\r\n'], 'mask', ['near-miss-value']);
        add(family, 'control', `${T}-prose`, ['Send the key after the ApiKey scheme in the Authorization header.\n'], 'prose naming the scheme', ['near-miss-name']);
        add(family, 'control', `${T}-public-only`, [`{"id":"${synth(`${family}:pid`, 20, LOWER)}","name":"ci-key","expiration":1791200000000}\n`], 'key id and public metadata', ['neighbouring-public-field']);
        add(family, 'control', `${T}-name-suffix`, [`Authorization-Info: ApiKey ${b64(`${synth(`${family}:ns:id`, 20, URLSAFE)}:${synth(`${family}:ns:key`, 22, URLSAFE)}`)}\r\nX-Authorization: ApiKey ${b64(`${synth(`${family}:np:id`, 20, URLSAFE)}:${synth(`${family}:np:key`, 22, URLSAFE)}`)}\r\n`], 'header-name lookalikes (the adopted contract lists them as exclusions)', ['near-miss-name']);
        add(family, 'unsupported', `${T}-newline-between`, ['Authorization: ApiKey\r\n', key('nl'), '\r\n'], 'value on the next line', ['representation']);
        add(family, 'unsupported', `${T}-lowercase-scheme`, [`authorization: apikey ${b64(`${synth(`${family}:lc:id`, 20, URLSAFE)}:${synth(`${family}:lc:key`, 22, URLSAFE)}`)}\r\n`], 'lower-case header name and scheme', ['representation']);
      }

      // ============================== YAML config / environment variable (hubspot personal access key) ==============================
      if (kind === 'yamlenv') {
        const field = N0;
        const envName = N1;
        const [pk, pv] = pubv('y');
        add(family, 'positive', `${field}-yaml-account`, [`# ${MB}\ndefaultAccount: dev\naccounts:\n  - name: dev\n    portalId: ${pv}\n    authType: personalaccesskey\n    ${field}: `, sec('y1'), '\n    env: qa\n'], 'account entry in ~/.hscli/config.yml, multi-byte comment first', ['direct-slot', 'nesting', 'utf8-preceding', 'delimiter-after']);
        add(family, 'positive', `${field}-yaml-quoted`, [`accounts:\n  - ${field}: "`, sec('y2'), `"\n    portalId: ${pv}\n`], 'quoted, first key of the list item', ['delimiter-before', 'delimiter-after']);
        add(family, 'positive', `${field}-yaml-eof-crlf`, [`accounts:\r\n  - portalId: ${pv}\r\n    ${field}: `, sec('y3')], 'CRLF file, value is the last byte', ['line-ending', 'end-of-input', 'stream-cut']);
        add(family, 'positive', `${field}-yaml-same-shape`, [`accounts:\n  - name: ${shape('n')}\n    ${field}: `, sec('y4'), `\n    accountId: ${shape('a')}\n`], 'same-shape public values around it', ['same-shape-neighbour']);
        add(family, 'positive', `${envName}-env`, [`${envName}=`, sec('e1'), '\nUSE_ENVIRONMENT_HUBSPOT_CONFIG=true\n'], 'environment variable assignment, value then newline', ['direct-slot', 'delimiter-after']);
        add(family, 'positive', `${envName}-export-quoted`, [`export ${envName}="`, sec('e2'), '"\n'], 'export with quotes', ['delimiter-before', 'delimiter-after']);
        add(family, 'positive', `${envName}-env-eof`, [`USE_ENVIRONMENT_HUBSPOT_CONFIG=true\n${envName}=`, sec('e3')], 'last line, no newline', ['end-of-input', 'stream-cut']);
        add(family, 'positive', `${envName}-docker-compose`, [`services:\n  app:\n    environment:\n      - ${envName}=`, sec('e4'), '\n      - HUBSPOT_PORTAL_ID=12345\n'], 'docker-compose list item', ['nesting']);
        add(family, 'control', `${field}-yaml-public-only`, [`accounts:\n  - name: dev\n    portalId: ${pv}\n    authType: personalaccesskey\n    env: qa\n`], 'config without the key', ['neighbouring-public-field']);
        add(family, 'control', `${field}-placeholders-references`, [`${field}: <your-personal-access-key>\n${field}: \${HUBSPOT_PAK}\n${envName}=YOUR_PERSONAL_ACCESS_KEY\n${envName}=\${${envName}_SECRET}\n`], 'placeholders and references', ['near-miss-value']);
        add(family, 'control', `${field}-masks`, [`${field}: ********************\n${envName}=****************\n`], 'masks', ['near-miss-value']);
        add(family, 'control', `${field}-suffix-lookalikes`, [`${field}Id: ${synth(`${family}:sid`, 12, LOWER)}\n${field}ExpiresAt: 1791200000\n${envName}_FILE=/run/secrets/pak\n`], 'suffix-glued names with public values', ['glued-name', 'near-miss-name']);
        add(family, 'unsupported', `${field}-below-floor`, [`${field}: `, sec('floor', 7), '\n'], 'under the floor', ['near-miss-value']);
        add(family, 'unsupported', `${field}-legacy-portals`, [`portals:\n  - portalId: ${pv}\n    ${field}: ${synth(`${family}:lp`, 36, URLSAFE)}\n`], 'legacy portals layout: which layout a CLI version writes is not established', ['representation']);
        add(family, 'unsupported', `${field}-lowercase-name`, [`personalaccesskey: ${synth(`${family}:lcn`, 36, URLSAFE)}\n`], 'case-changed name', ['representation']);
      }

      // ============================== Atlas URI userinfo ==============================
      if (kind === 'atlas-uri') {
        const T = 'password-uri';
        const pw = (slug, n = 14) => ({ secret: synth(`${family}:${slug}`, n, ALNUM) });
        add(family, 'positive', `${T}-srv`, [`mongodb+srv://${lit('u1', 8, LOWER)}:`, pw('u1'), '@cluster0.example.test/app?retryWrites=true&w=majority\n'], 'mongodb+srv userinfo, query after', ['direct-slot', 'delimiter-after'], { type: 'connection_string_password' });
        add(family, 'positive', `${T}-plain`, [`MONGODB_URI=mongodb://${lit('u2', 8, LOWER)}:`, pw('u2'), '@host1.example.test:27017,host2.example.test:27017/app\n'], 'mongodb:// with multiple hosts', ['nesting'], { type: 'connection_string_password' });
        add(family, 'positive', `${T}-eof`, [`mongodb+srv://${lit('u3', 8, LOWER)}:`, pw('u3'), '@cluster0.example.test'], 'URI is the last text, no path', ['end-of-input', 'stream-cut'], { type: 'connection_string_password' });
        add(family, 'positive', `${T}-quoted-json`, [`{"uri":"mongodb+srv://${lit('u4', 8, LOWER)}:`, pw('u4'), '@cluster0.example.test/app"}\n'], 'inside a JSON string', ['nesting'], { type: 'connection_string_password' });
        add(family, 'positive', `${T}-utf8`, [`# ${MB}\nmongodb+srv://${lit('u5', 8, LOWER)}:`, pw('u5'), `@cluster0.example.test/app # ${MB}\n`], 'multi-byte before and after', ['utf8-preceding', 'utf8-following'], { type: 'connection_string_password' });
        add(family, 'control', `${T}-no-userinfo`, ['mongodb+srv://cluster0.example.test/app?retryWrites=true\n'], 'no userinfo', ['neighbouring-public-field']);
        add(family, 'control', `${T}-user-only`, [`mongodb+srv://${lit('u6', 8, LOWER)}@cluster0.example.test/app\n`], 'user name without a password', ['neighbouring-public-field']);
        add(family, 'control', `${T}-placeholder-ref`, ['mongodb+srv://app:<password>@cluster0.example.test/app\nmongodb+srv://app:${DB_PASSWORD}@cluster0.example.test/app\n'], 'placeholder and reference (Atlas documents <password>)', ['near-miss-value']);
        add(family, 'conflict', `${T}-percent-escapes`, [`mongodb+srv://${lit('u7', 8, LOWER)}:${lit('u7p', 8)}%40${lit('u7q', 4)}@cluster0.example.test/app\n`], 'CONTRACT-EVIDENCE CONFLICT (round 1): contract keeps %XX inside the span, evidence records the encoding as unresolved', ['representation']);
      }
    }
  }
  return cases;
}

export const cases = build();

export function corpusDigest() {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}
export function partDigest(part) {
  return createHash('sha256').update(JSON.stringify(cases.filter(c => c.part === part))).digest('hex');
}
