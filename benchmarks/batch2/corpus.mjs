import { createHash } from 'node:crypto';

// Issue #739: the focused Batch 2 corpus for the 30 families credential-evidence#235 marked READY
// (docs/handoffs/batch-2-bounded-carriers.md at credential-evidence 005a7331).
//
// Authoring rules
// - Every value is built here at runtime from a public seed with SHA-256: repeated filler, never a provider-issued
//   credential, a scanner result or an example from a provider page. No realistic provider key literal appears.
// - An expectation comes only from the family's handoff row (the established slot and its public lookalikes)
//   and the adopted product contract (redact-secret PR #1231, merge a148dadf, docs/audits/evidence/1223..1226):
//   field value -> contextual_secret, exactly the value; explicit Bearer -> bearer_token, exactly the value;
//   Basic and ApiKey -> authorization_credential, the whole encoded value; default action redact, warn for a
//   low-entropy literal at medium confidence; URI userinfo password -> connection_string_password. The contract
//   asserts generic types only: provider attribution is never an expectation. Expectations are never taken from
//   observed product output.
// - `conflict`    a case where the adopted contract and the evidence handoff disagree: recorded, observed and
//                 never scored (not resolved here).
// - `positive`    the slot is in an established layout; expected = the value span (UTF-8 byte offsets).
// - `control`     public lookalikes, placeholders, references, masks, HMAC/digest outputs: no finding expected.
// - `unsupported` variants the handoff does not establish (prefixed names, percent forms, newline-separated,
//                 undeclared members). Observed and reported, never FN, TN or passing coverage.
// Lineage: every case id is `<family>:<layout>:<kind>` and carries its handoff claim IDs. A shared layout
// (e.g. an Authorization Bearer header) shares execution across families but not lineage: a generic engine
// result is not provider attribution.

export const CORPUS_VERSION = 1;
export const ISSUE = 739;
export const SCHEMA = 'batch2-observations-v1';
export const CONTRACT = { repo: 'redact-secret/redact-secret', pr: 1231, merge: 'a148dadf4a43b5441ed88386d055428b2e278f25', docs: ['docs/audits/evidence/1223/README.md', 'docs/audits/evidence/1224/README.md', 'docs/audits/evidence/1225/README.md', 'docs/audits/evidence/1226/README.md'] };
export const HANDOFF = { repo: 'redact-secret/credential-evidence', commit: '005a7331cf90403bd4ce4abcb93bd8b085d315a9', doc: 'docs/handoffs/batch-2-bounded-carriers.md' };

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = `${ALNUM}-_`;
const HEX = '0123456789abcdef';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function synth(seed, length, alphabet = ALNUM) {
  let out = '';
  for (let block = 0; out.length < length; block += 1) {
    const digest = createHash('sha256').update(`batch2:739:${seed}:${block}`).digest();
    for (const byte of digest) {
      if (out.length === length) break;
      out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}
const b64 = text => Buffer.from(text, 'utf8').toString('base64');

/**
 * The 30 ready rows. `layouts` are the layout classes the handoff slot establishes; `claims` are the handoff
 * claim IDs; `publicFields` are the row's named public lookalikes (name, value alphabet, length).
 * Width and alphabet of the secret are never established by the handoff: `body` varies them on purpose.
 */
const F = (group, layouts, claims, publicFields, body, extra = {}) => ({ group, layouts, claims, publicFields, body, ...extra });
const CID = ['client_id', LOWER, 24];
export const FAMILIES = {
  // G1
  'adobe:oauth-server-to-server-access-token': F('G1', ['member:access_token'], ['s2s-access-token-bearer-expiry'], [CID, ['expires_in', '0123456789', 5]], [URLSAFE, 36], { jsonNeighbours: ['"token_type":"bearer"', '"expires_in":86399999'] }),
  'airtable:oauth-access-token': F('G1', ['bearer'], ['existence', 'opaque-format'], [CID, ['expires_in', '0123456789', 4]], [ALNUM, 41]),
  'asana:personal-access-token': F('G1', ['bearer'], ['existence', 'presentation-bearer-header', 'format-opaque'], [['gid', '0123456789', 16], ['workspace', '0123456789', 16]], [URLSAFE, 44]),
  'canva:access-token': F('G1', ['member:access_token'], ['existence'], [CID], [URLSAFE, 52], { jsonNeighbours: ['"token_type":"Bearer"', '"expires_in":14400'] }),
  'elastic:access-token': F('G1', ['bearer'], ['existence'], [['id', LOWER, 20]], [ALNUM, 48]),
  'elastic:service-account-token': F('G1', ['bearer'], ['existence', 'secret-string-length', 'no-expiry'], [['name', LOWER, 12]], [ALNUM, 70]),
  'figma:oauth-access-token': F('G1', ['member:access_token', 'bearer'], ['existence'], [CID, ['file_key', ALNUM, 22], ['user_id', '0123456789', 19]], [ALNUM, 38], { jsonNeighbours: ['"expires_in":7776000'] }),
  'figma:scim-api-token': F('G1', ['bearer'], ['existence'], [['file_key', ALNUM, 22]], [URLSAFE, 40]),
  'hubspot:oauth-access-token': F('G1', ['bearer'], ['oauth-access-token-exists'], [CID, ['hubId', '0123456789', 8]], [URLSAFE, 45]),
  'hubspot:service-key': F('G1', ['bearer'], ['service-key-exists'], [['hubId', '0123456789', 8]], [ALNUM, 56]),
  'mongodb-atlas:service-account-access-token': F('G1', ['bearer'], ['issuance-and-lifetime', 'bearer-carrier', 'ip-access-list'], [['clientId', HEX, 24, 'mdb_sa_id_'], ['expires_in', '0123456789', 4]], [URLSAFE, 60]),
  'spotify:access-token': F('G1', ['bearer'], ['existence'], [CID], [URLSAFE, 90]),
  'x:oauth2-user-access-token': F('G1', ['bearer'], ['issued-by-authorization-code-flow', 'lifetime-two-hours'], [CID, ['user_id', '0123456789', 18]], [URLSAFE, 50]),
  'zendesk:oauth-access-token': F('G1', ['bearer'], ['existence', 'documented-maximum-length', 'lifetime-and-legacy-clients', 'global-token-context'], [CID, ['subdomain', LOWER, 9]], [ALNUM, 120], { maxBody: 184 }),
  'zoom:server-to-server-access-token': F('G1', ['bearer'], ['existence', 'jwt-app-mention'], [['account_id', ALNUM, 22], CID], [URLSAFE, 64]),
  // G2
  'adobe:oauth-user-refresh-token': F('G2', ['member:refresh_token'], ['refresh-token-offline-access'], [CID, ['scope', LOWER, 10]], [URLSAFE, 66], { jsonNeighbours: ['"token_type":"bearer"', '"expires_in":86399999'] }),
  'canva:refresh-token': F('G2', ['member:refresh_token'], ['existence'], [CID], [URLSAFE, 58], { jsonNeighbours: ['"token_type":"Bearer"', '"expires_in":14400'] }),
  'figma:oauth-refresh-token': F('G2', ['member:refresh_token'], ['existence'], [CID], [ALNUM, 42]),
  'spotify:refresh-token': F('G2', ['member:refresh_token'], ['existence'], [CID], [URLSAFE, 80], { jsonNeighbours: ['"token_type":"Bearer"', '"expires_in":3600'] }),
  'zoom:oauth-refresh-token': F('G2', ['member:refresh_token'], ['existence'], [CID], [URLSAFE, 72], { jsonNeighbours: ['"token_type":"bearer"', '"expires_in":3599'] }),
  // G3
  'dropbox:app-secret': F('G3', ['field:client_secret'], ['app-secret-exists'], [['client_id', LOWER, 15]], [LOWER, 20], { signatureHeader: 'X-Dropbox-Signature' }),
  'figma:oauth-client-secret': F('G3', ['basic'], ['existence'], [['client_id', ALNUM, 22]], [ALNUM, 30]),
  'x:oauth2-client-secret': F('G3', ['basic'], ['confidential-clients-receive-secret', 'used-for-token-endpoint-auth'], [['client_id', ALNUM, 25], ['oauth_consumer_key', ALNUM, 25]], [URLSAFE, 50]),
  'zendesk:oauth-client-secret': F('G3', ['field:client_secret'], ['existence'], [['client_id', LOWER, 18]], [ALNUM, 64]),
  // G4
  'elastic:cloud-api-key': F('G4', ['apikey'], ['existence', 'authorization-carrier', 'lifecycle', 'not-for-hosted-elasticsearch'], [['id', LOWER, 20]], [URLSAFE, 0]),
  'x:app-only-bearer-token': F('G4', ['bearer'], ['generated-from-consumer-credentials', 'format-unspecified', 'sensitivity-and-rotation', 'artifacts-bearer-leading-run-and-percent'], [['oauth_consumer_key', ALNUM, 25]], [ALNUM, 62], { percentUnsupported: true }),
  // G5
  'x:oauth1-access-token-secret': F('G5', ['field:oauth_token_secret'], ['paired-secret-of-access-token', 'distinct-from-oauth2-client-credentials'], [['oauth_token', URLSAFE, 50], ['oauth_signature', ALNUM, 27], ['oauth_consumer_key', ALNUM, 25]], [ALNUM, 45]),
  // G6
  'mongodb-atlas:database-user-password': F('G6', ['atlas-password'], ['api-field', 'chosen-by-caller'], [['username', LOWER, 8], ['databaseName', LOWER, 8]], [ALNUM, 18]),
  'mongodb-atlas:programmatic-api-private-key': F('G6', ['digest-only'], ['two-part-key', 'legacy-method', 'private-key-unredacted-once', 'public-key-length', 'digest-not-bearer', 'no-ui-or-data-access'], [['publicKey', LOWER, 8]], [HEX, 32]),
  'mongodb-atlas:service-account-secret': F('G6', ['basic'], ['pair-and-role', 'shown-once', 'example-prefix', 'client-id-pattern', 'expiry-and-rotation', 'basic-carrier', 'recommended-method'], [['clientId', HEX, 24, 'mdb_sa_id_']], [URLSAFE, 52], { basicClientId: ['mdb_sa_id_', HEX, 24] }),
};
/** Rows where the adopted contract and the evidence handoff disagree. Recorded, never resolved here. */
export const CONFLICTS = {
  'x:oauth1-access-token-secret': 'oauth_token: the evidence handoff names it a public lookalike; the adopted contract (#1225) keeps the default that reads it as contextual_secret and asserts nothing for it. The secret-half expectation is not in conflict.',
  'mongodb-atlas:programmatic-api-private-key': 'readiness: the evidence handoff marks the row ready (a client-configured Digest input, no wire carrier); the adopted contract (#1226) treats no layout as named and starts it at P2. Only the controls both sides agree on were observed.',
  'mongodb-atlas:database-user-password': 'percent encoding in a connection-string password: the contract keeps escapes in the span; the evidence records it as unresolved. The password field and plain URI userinfo expectations are not in conflict.',
};
export const FAMILY_IDS = Object.keys(FAMILIES);

const host = 'api.example.test';

function build() {
  const cases = [];
  const ids = new Set();
  const add = (family, kind, layout, parts, note, axes = []) => {
    const id = `${family}:${layout}:${kind}`;
    if (ids.has(id)) throw new Error(`batch2: duplicate case id ${id}`);
    ids.add(id);
    let text = '';
    let span = null;
    for (const part of parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = Buffer.byteLength(text);
      text += part.secret;
      span = { start, end: Buffer.byteLength(text) };
    }
    if (kind === 'positive' && !span) throw new Error(`batch2: positive ${id} has no secret span`);
    let expectedType = null;
    let expectedAction = null;
    if (kind === 'positive') {
      expectedAction = layout.includes('lowentropy') ? 'warn' : 'redact';
      if (layout.startsWith('bearer')) expectedType = 'bearer_token';
      else if (layout.startsWith('basic') || layout.startsWith('apikey')) expectedType = 'authorization_credential';
      else if (layout.startsWith('password-uri')) expectedType = 'connection_string_password';
      else expectedType = 'contextual_secret';
    }
    cases.push({ id, family, group: FAMILIES[family].group, kind, layout, axes, claims: FAMILIES[family].claims, text, expected: kind === 'positive' ? span : null, expectedType, expectedAction, note });
  };

  for (const [family, def] of Object.entries(FAMILIES)) {
    const [alphabet, baseLen] = def.body;
    const secret = (slug, n = baseLen) => ({ secret: synth(`${family}:${slug}`, n, alphabet) });
    const pub = (slug) => def.publicFields.map(([name, alpha, len, prefix = '']) => [name, `${prefix}${synth(`${family}:pub:${slug}:${name}`, len, alpha)}`]);
    const short = family.split(':')[1].toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const envName = `${family.split(':')[0].toUpperCase()}_${short}`;
    const jsonPub = slug => pub(slug).map(([k, v]) => `"${k}":"${v}"`).join(',');
    const formPub = slug => pub(slug).map(([k, v]) => `${k}=${v}`).join('&');

    for (const layoutName of def.layouts) {
      // ---- Authorization: Bearer header carriers ---------------------------------
      if (layoutName === 'bearer') {
        add(family, 'positive', 'bearer-raw-http', [`GET /v1/resource HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Bearer `, secret('raw'), '\r\nAccept: application/json\r\n\r\n'], 'Authorization header, raw HTTP', ['direct-header', 'delimiter-crlf']);
        add(family, 'positive', 'bearer-raw-http-proxy', [`GET /v1/resource HTTP/1.1\r\nHost: ${host}\r\nProxy-Authorization: Bearer `, secret('proxy', baseLen + 3), '\r\n\r\n'], 'Proxy-Authorization header', ['direct-header']);
        add(family, 'positive', 'bearer-curl', [`curl -s -H "Authorization: Bearer `, secret('curl'), `" https://${host}/v1/resource\n`], 'quoted curl -H', ['direct-header', 'delimiter-quote']);
        add(family, 'positive', 'bearer-curl-single', [`curl -s -H 'Authorization: Bearer `, secret('curl1'), `' https://${host}/v1/resource\n`], 'single-quoted curl -H', ['direct-header', 'delimiter-quote']);
        add(family, 'positive', 'bearer-json-header-map', [`{"method":"GET","url":"https://${host}/v1/resource","headers":{"Accept":"application/json","Authorization":"Bearer `, secret('map'), '"}}\n'], 'JSON header map', ['direct-header', 'delimiter-quote']);
        add(family, 'positive', 'bearer-unicode-prefix', ['// notiz: café \u{1F680} Übertragung\n', `GET /v1/resource HTTP/1.1\r\nAuthorization: Bearer `, secret('uni'), '\r\n\r\n'], 'a non-ASCII line first: UTF-8 byte, UTF-16 and code point offsets differ', ['utf8-preceding']);
        add(family, 'positive', 'bearer-long', [`GET / HTTP/1.1\r\nAuthorization: Bearer `, secret('long', Math.min(def.maxBody ?? 160, 160)), '\r\n\r\n'], 'a long value (width is not established; bounded by the documented maximum when one exists)', ['value-width']);
        add(family, 'control', 'bearer-public-fields', [`{"${pub('b')[0][0]}":"${pub('b')[0][1]}",${jsonPub('b2')}}\n`], 'the handoff\'s public lookalikes', ['neighbouring-public-field']);
        add(family, 'control', 'bearer-placeholder', ['Authorization: Bearer <your-access-token>\r\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'bearer-placeholder-curl', [`curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" https://${host}/v1/resource\n`], 'placeholder', ['placeholder']);
        add(family, 'control', 'bearer-reference-env', [`curl -H "Authorization: Bearer \${${envName}}" https://${host}/v1/resource\n`], 'environment reference', ['reference']);
        add(family, 'control', 'bearer-reference-template', ['{"headers":{"Authorization":"Bearer {{ secrets.access_token }}"}}\n'], 'template reference', ['reference']);
        add(family, 'control', 'bearer-masked', ['Authorization: Bearer ********************\r\n'], 'masked value', ['mask']);
        add(family, 'control', 'bearer-scheme-prose', ['Send the token with the Bearer scheme in the Authorization header.\n'], 'prose naming the scheme', ['benign-prose']);
        add(family, 'unsupported', 'bearer-below-floor', ['Authorization: Bearer ', { secret: synth(`${family}:floor`, 11, alphabet) }, '\r\n'], 'under the 12-byte Bearer floor: a documented limit, never scored as a miss', ['value-width']);
        add(family, 'unsupported', 'bearer-newline-between', ['Authorization: Bearer\r\n', secret('nl'), '\r\n'], 'value on the next line is not a header value', ['delimiter-newline']);
        add(family, 'unsupported', 'bearer-prefixed-name', [`X-Forwarded-Authorization: Bearer ${synth(`${family}:xfa`, 36, alphabet)}\r\n`], 'prefixed header name may carry the same credential: observed, not a control', ['header-name-lookalike']);
        if (def.percentUnsupported) {
          const pv = `${synth(`${family}:pct1`, 18, ALNUM)}%2F${synth(`${family}:pct2`, 10, ALNUM)}%3D`;
          add(family, 'unsupported', 'bearer-percent-raw', [`Authorization: Bearer ${pv}\r\n`], 'percent-containing wire form: the handoff keeps raw, serialized-escaped and percent forms unresolved', ['representation']);
          add(family, 'unsupported', 'bearer-percent-json-escaped', [`{"Authorization":"Bearer ${pv.replace(/%/g, '\\u0025')}"}\n`], 'serialized-escaped percent form: a distinct input identity', ['representation']);
          add(family, 'unsupported', 'bearer-percent-curl', [`curl -H "Authorization: Bearer ${pv}" https://${host}/2/tweets\n`], 'percent form in curl', ['representation']);
        }
      }
      // ---- token response members (access_token / refresh_token) -----------------
      if (layoutName.startsWith('member:')) {
        const member = layoutName.slice('member:'.length);
        const n = (def.jsonNeighbours ?? []).join(',');
        const tail = n ? `,${n}` : '';
        add(family, 'positive', `${member}-json`, [`{"${member}":"`, secret('json'), `"${tail},${jsonPub('j')}}\n`], `token response member ${member} followed by neighbours`, ['direct-field', 'delimiter-comma', 'neighbouring-public-field']);
        add(family, 'positive', `${member}-json-last`, [`{${jsonPub('jl')},"${member}":"`, secret('jlast', baseLen + 4), '"}\n'], 'member is the last key: value ends at the closing quote', ['direct-field', 'delimiter-quote']);
        add(family, 'positive', `${member}-json-pretty`, [`{\n  "${member}": "`, secret('pretty'), `",\n  "${def.publicFields[0][0]}": "${pub('p')[0][1]}"\n}\n`], 'pretty-printed token response', ['direct-field']);
        add(family, 'positive', `${member}-http-response`, [`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"${member}":"`, secret('http'), `"${tail}}\r\n`], 'raw HTTP response body', ['direct-field']);
        add(family, 'positive', `${member}-unicode-prefix`, ['{"note":"café \u{1F680}",', `"${member}":"`, secret('uni'), '"}\n'], 'a non-ASCII member first', ['utf8-preceding']);
        add(family, 'positive', `${member}-curl-response`, [`$ curl -s -X POST https://${host}/oauth/token -d grant_type=authorization_code\n{"${member}":"`, secret('cresp'), '"}\n'], 'shell transcript followed by the response', ['direct-field']);
        add(family, 'positive', `${member}-lowentropy`, [`{"${member}":"`, { secret: 'abcabcabcabca' }, '"}\n'], 'a 13-byte low-entropy literal in the slot: contract expectation is medium confidence and warn', ['value-entropy']);
        add(family, 'unsupported', `${member}-below-floor`, [`{"${member}":"`, { secret: synth(`${family}:floor`, 7, alphabet) }, '"}\n'], 'under the 8-byte field floor: documented limit, never scored as a miss', ['value-width']);
        add(family, 'control', `${member}-public-fields`, [`{${jsonPub('pf')},"token_type":"bearer","expires_in":3600}\n`], 'public lookalikes beside the member name', ['neighbouring-public-field']);
        add(family, 'control', `${member}-placeholder`, [`{"${member}":"<${member.replace('_', '-')}>"}\n`], 'placeholder', ['placeholder']);
        add(family, 'control', `${member}-reference-env`, [`${member.toUpperCase()}=\${${envName}}\n`], 'environment reference', ['reference']);
        add(family, 'control', `${member}-reference-template`, [`{"${member}":"{{ secrets.${member} }}"}\n`], 'template reference', ['reference']);
        add(family, 'control', `${member}-masked`, [`{"${member}":"****************************"}\n`], 'masked read', ['mask']);
        add(family, 'control', `${member}-name-lookalike`, [`{"${member}_expires_at":${1791200000},"${member}_count":3}\n`], 'name-suffix lookalikes with public values', ['header-name-lookalike']);
        add(family, 'unsupported', `${member}-prefixed-name`, [`{"old_${member}":"${synth(`${family}:old`, 36, alphabet)}"}\n`], 'prefixed member name may carry the same credential: observed, not a control', ['header-name-lookalike']);
      }
      // ---- client_secret request field ------------------------------------------
      if (layoutName === 'field:client_secret') {
        add(family, 'positive', 'client_secret-form', [`POST /oauth2/token HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ngrant_type=authorization_code&code=AUTHCODE0&client_id=${pub('f')[0][1]}&client_secret=`, secret('form'), '&redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb\r\n'], 'form body: the span stops at the delimiter', ['direct-field', 'delimiter-ampersand', 'neighbouring-public-field']);
        add(family, 'positive', 'client_secret-form-last', [`grant_type=refresh_token&client_id=${pub('fl')[0][1]}&client_secret=`, secret('formlast'), '\n'], 'form body, last parameter', ['direct-field', 'delimiter-eol']);
        add(family, 'positive', 'client_secret-curl-data', [`curl -s -d "grant_type=authorization_code&client_id=${pub('cd')[0][1]}&client_secret=`, secret('curl'), `" https://${host}/oauth2/token\n`], 'curl -d form body', ['direct-field', 'delimiter-quote']);
        add(family, 'positive', 'client_secret-json', [`{"grant_type":"authorization_code","client_id":"${pub('j')[0][1]}","client_secret":"`, secret('json'), '"}\n'], 'JSON request body', ['direct-field', 'delimiter-quote']);
        add(family, 'positive', 'client_secret-assignment', ['client_secret=', secret('as'), '\n'], 'direct assignment', ['direct-field']);
        add(family, 'positive', 'client_secret-unicode-prefix', ['# café \u{1F680} Konfiguration\nclient_secret = "', secret('uni'), '"\n'], 'a non-ASCII line first', ['utf8-preceding']);
        add(family, 'positive', 'client_secret-lowentropy', ['client_secret=', { secret: 'abcabcabcabca' }, '\n'], 'a 13-byte low-entropy literal in the slot: contract expectation is medium confidence and warn', ['value-entropy']);
        add(family, 'unsupported', 'client_secret-below-floor', ['client_secret=', { secret: synth(`${family}:floor`, 7, alphabet) }, '\n'], 'under the 8-byte field floor: documented limit', ['value-width']);
        if (def.signatureHeader) add(family, 'control', 'client_secret-webhook-signature', [`POST /webhook HTTP/1.1\r\n${def.signatureHeader}: ${synth(`${family}:sig`, 64, HEX)}\r\n\r\n`], 'HMAC output of the app secret is not the secret', ['neighbouring-public-field']);
        add(family, 'control', 'client_secret-public-fields', [`${formPub('pf')}&grant_type=authorization_code\n`], 'public ids and HMAC outputs beside the carrier', ['neighbouring-public-field']);
        add(family, 'control', 'client_secret-placeholder', ['client_secret=<your-client-secret>\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'client_secret-placeholder-upper', ['client_secret=YOUR_CLIENT_SECRET\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'client_secret-reference-env', [`client_secret=\${${envName}}\n`], 'environment reference', ['reference']);
        add(family, 'control', 'client_secret-reference-template', ['{"client_secret":"{{ secrets.client_secret }}"}\n'], 'template reference', ['reference']);
        add(family, 'control', 'client_secret-masked', ['client_secret=****************\n'], 'masked value', ['mask']);
        add(family, 'control', 'client_secret-name-lookalike', [`client_secret_expires_at=${1791200000}&client_secret_id=${synth(`${family}:csid`, 12, LOWER)}\n`], 'name-suffix lookalikes', ['header-name-lookalike']);
        add(family, 'unsupported', 'client_secret-prefixed-name', [`old_client_secret=${synth(`${family}:old`, 24, alphabet)}\n`], 'prefixed name may carry the same credential: observed, not a control', ['header-name-lookalike']);
      }
      // ---- Authorization: Basic envelope ----------------------------------------
      if (layoutName === 'basic') {
        const cid = (slug) => def.basicClientId ? `${def.basicClientId[0]}${synth(`${family}:cid:${slug}`, def.basicClientId[2], def.basicClientId[1])}` : synth(`${family}:cid:${slug}`, def.publicFields[0][2], def.publicFields[0][1]);
        const envelope = (slug) => ({ secret: b64(`${cid(slug)}:${synth(`${family}:${slug}`, baseLen, alphabet)}`) });
        add(family, 'positive', 'basic-raw-http', [`POST /oauth/token HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic `, envelope('raw'), '\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ngrant_type=client_credentials\r\n'], 'Basic envelope: the encoded credential, not a decoded secret-only span', ['direct-header', 'delimiter-crlf']);
        add(family, 'positive', 'basic-curl', ['curl -s -H "Authorization: Basic ', envelope('curl'), `" -d grant_type=client_credentials https://${host}/oauth/token\n`], 'Basic envelope, quoted curl -H', ['direct-header', 'delimiter-quote']);
        add(family, 'positive', 'basic-json-header-map', ['{"headers":{"Content-Type":"application/x-www-form-urlencoded","Authorization":"Basic ', envelope('map'), '"}}\n'], 'JSON header map', ['direct-header']);
        add(family, 'positive', 'basic-unicode-prefix', ['# café \u{1F680} Zugriff\nPOST /oauth/token HTTP/1.1\r\nAuthorization: Basic ', envelope('uni'), '\r\n\r\n'], 'a non-ASCII line first', ['utf8-preceding']);
        add(family, 'unsupported', 'basic-curl-user-flag', [`curl -s --user ${cid('u')}:`, { secret: synth(`${family}:userflag`, baseLen, alphabet) }, ` -d grant_type=client_credentials https://${host}/oauth/token\n`], 'curl --user id:secret is not an Authorization header layout the handoff or the contract names: observed, not scored', ['representation']);
        add(family, 'control', 'basic-client-id', [`client_id=${cid('ctl')}\n`], 'public client identifier', ['neighbouring-public-field']);
        add(family, 'control', 'basic-client-id-json', [`{"client_id":"${cid('ctl2')}","name":"Example app"}\n`], 'public client identifier', ['neighbouring-public-field']);
        add(family, 'control', 'basic-placeholder', ['Authorization: Basic <base64-client-credentials>\r\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'basic-placeholder-curl', [`curl -H "Authorization: Basic BASE64_CLIENT_CREDENTIALS" https://${host}/oauth/token\n`], 'placeholder', ['placeholder']);
        add(family, 'control', 'basic-reference-env', [`curl -H "Authorization: Basic \${${envName}_BASIC}" https://${host}/oauth/token\n`], 'environment reference', ['reference']);
        add(family, 'control', 'basic-masked', ['Authorization: Basic ************************\r\n'], 'masked value', ['mask']);
        add(family, 'control', 'basic-scheme-prose', ['Confidential clients send the client id and secret in a Basic Authorization header.\n'], 'prose naming the scheme', ['benign-prose']);
        add(family, 'unsupported', 'basic-below-floor', ['Authorization: Basic ', { secret: synth(`${family}:floor`, 11, URLSAFE) }, '\r\n'], 'under the 12-byte Basic floor: documented limit', ['value-width']);
        add(family, 'unsupported', 'basic-newline-between', ['Authorization: Basic\r\n', envelope('nl'), '\r\n'], 'value on the next line', ['delimiter-newline']);
      }
      // ---- Authorization: ApiKey (Batch 1 generic envelope) -----------------------
      if (layoutName === 'apikey') {
        const key = slug => ({ secret: b64(`${synth(`${family}:${slug}:id`, 20, URLSAFE)}:${synth(`${family}:${slug}:key`, 22, URLSAFE)}`) });
        add(family, 'positive', 'apikey-raw-http', [`GET /api/v1/deployments HTTP/1.1\r\nHost: ${host}\r\nAuthorization: ApiKey `, key('raw'), '\r\nAccept: application/json\r\n\r\n'], 'Authorization header', ['direct-header', 'delimiter-crlf']);
        add(family, 'positive', 'apikey-curl', ['curl -s -H "Authorization: ApiKey ', key('curl'), `" https://${host}/api/v1/deployments\n`], 'quoted curl -H', ['direct-header', 'delimiter-quote']);
        add(family, 'positive', 'apikey-curl-single', ['curl -s -H \'Authorization: ApiKey ', key('curl1'), `' https://${host}/api/v1/deployments\n`], 'single-quoted curl -H', ['direct-header', 'delimiter-quote']);
        add(family, 'positive', 'apikey-json-header-map', ['{"headers":{"Accept":"application/json","Authorization":"ApiKey ', key('map'), '"}}\n'], 'JSON header map', ['direct-header']);
        add(family, 'positive', 'apikey-unicode-prefix', ['# café \u{1F680}\nGET / HTTP/1.1\r\nAuthorization: ApiKey ', key('uni'), '\r\n\r\n'], 'a non-ASCII line first', ['utf8-preceding']);
        add(family, 'positive', 'apikey-proxy', [`GET / HTTP/1.1\r\nProxy-Authorization: ApiKey `, key('proxy'), '\r\n\r\n'], 'Proxy-Authorization header', ['direct-header']);
        add(family, 'control', 'apikey-public-fields', [`{"id":"${synth(`${family}:pubid`, 20, LOWER)}","name":"ci-key","expiration":1791200000000}\n`], 'key id and public metadata', ['neighbouring-public-field']);
        add(family, 'control', 'apikey-placeholder', ['Authorization: ApiKey <your-api-key>\r\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'apikey-reference-env', [`curl -H "Authorization: ApiKey \${${envName}}" https://${host}/\n`], 'environment reference', ['reference']);
        add(family, 'control', 'apikey-masked', ['Authorization: ApiKey ****************************\r\n'], 'masked value', ['mask']);
        add(family, 'control', 'apikey-scheme-prose', ['Send the key after the ApiKey scheme in the Authorization header.\n'], 'prose naming the scheme', ['benign-prose']);
        add(family, 'unsupported', 'apikey-newline-between', ['Authorization: ApiKey\r\n', key('nl'), '\r\n'], 'value on the next line', ['delimiter-newline']);
      }
      // ---- OAuth 1.0a token secret ----------------------------------------------
      if (layoutName === 'field:oauth_token_secret') {
        const [tokName] = ['oauth_token'];
        add(family, 'positive', 'oauth_token_secret-form', [`oauth_token=${pub('f')[0][1]}&oauth_token_secret=`, secret('form'), '&oauth_callback_confirmed=true\n'], 'form-encoded token response: the span stops at the delimiter', ['direct-field', 'delimiter-ampersand', 'neighbouring-public-field']);
        add(family, 'positive', 'oauth_token_secret-form-last', [`oauth_token=${pub('fl')[0][1]}&oauth_token_secret=`, secret('formlast'), '\n'], 'form body, last parameter', ['direct-field', 'delimiter-eol']);
        add(family, 'positive', 'oauth_token_secret-json', [`{"oauth_token":"${pub('j')[0][1]}","oauth_token_secret":"`, secret('json'), '"}\n'], 'JSON member', ['direct-field', 'delimiter-quote']);
        add(family, 'positive', 'oauth_token_secret-assignment', ['oauth_token_secret=', secret('as'), '\n'], 'direct assignment', ['direct-field']);
        add(family, 'positive', 'oauth_token_secret-http-response', [`HTTP/1.1 200 OK\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\noauth_token=${pub('h')[0][1]}&oauth_token_secret=`, secret('http'), '\r\n'], 'raw HTTP response body', ['direct-field']);
        add(family, 'positive', 'oauth_token_secret-unicode-prefix', ['# café \u{1F680}\noauth_token_secret = "', secret('uni'), '"\n'], 'a non-ASCII line first', ['utf8-preceding']);
        add(family, 'positive', 'oauth_token_secret-lowentropy', ['oauth_token_secret=', { secret: 'abcabcabcabca' }, '\n'], 'a 13-byte low-entropy literal in the slot: contract expectation is medium confidence and warn', ['value-entropy']);
        add(family, 'unsupported', 'oauth_token_secret-below-floor', ['oauth_token_secret=', { secret: synth(`${family}:floor`, 7, alphabet) }, '\n'], 'under the 8-byte field floor: documented limit', ['value-width']);
        add(family, 'control', 'oauth_token_secret-signature', [`Authorization: OAuth oauth_consumer_key="${pub('s')[2][1]}", oauth_nonce="${synth(`${family}:nonce0`, 32, ALNUM)}", oauth_signature="${pub('s')[1][1]}%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1791200000", oauth_version="1.0"\r\n`], 'oauth_signature, consumer key, nonce, timestamp, method and version are not the secret half (contract: silent)', ['neighbouring-public-field']);
        add(family, 'control', 'oauth_token_secret-public-form', [`oauth_consumer_key=${pub('pf')[2][1]}&oauth_signature=${pub('pf')[1][1]}&oauth_nonce=${synth(`${family}:nonce`, 32, ALNUM)}\n`], 'public OAuth 1.0a parameters only', ['neighbouring-public-field']);
        add(family, 'conflict', 'oauth_token-as-public-lookalike', [`oauth_token=${pub('c')[0][1]}&oauth_callback_confirmed=true\n`], 'CONTRACT-EVIDENCE CONFLICT: the evidence handoff lists oauth_token as a public lookalike; the adopted contract (#1225) keeps the accepted default that reads a random value under oauth_token as contextual_secret and asserts nothing for it. Observed, not scored.', ['neighbouring-public-field']);
        add(family, 'control', 'oauth_token_secret-placeholder', ['oauth_token_secret=<token-secret>\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'oauth_token_secret-reference-env', [`oauth_token_secret=\${${envName}}\n`], 'environment reference', ['reference']);
        add(family, 'control', 'oauth_token_secret-masked', ['oauth_token_secret=********************\n'], 'masked value', ['mask']);
        add(family, 'control', 'oauth_token_secret-name-lookalike', [`oauth_token_secret_expires=${1791200000}&oauth_token_secret_id=${synth(`${family}:tsid`, 12, LOWER)}\n`], 'name-suffix lookalikes', ['header-name-lookalike']);
        add(family, 'unsupported', 'oauth_token_secret-prefixed-name', [`old_oauth_token_secret=${synth(`${family}:old`, 30, alphabet)}\n`], 'prefixed name may carry the same credential: observed, not a control', ['header-name-lookalike']);
        void tokName;
      }
      // ---- Atlas database user password -----------------------------------------
      if (layoutName === 'atlas-password') {
        add(family, 'positive', 'password-json-body', [`{"databaseName":"admin","username":"${pub('b')[0][1]}","password":"`, secret('json'), '","roles":[{"roleName":"readWrite","databaseName":"app"}]}\n'], 'create-database-user request property `password`', ['direct-field', 'delimiter-quote', 'neighbouring-public-field']);
        add(family, 'positive', 'password-curl-data', [`curl -s -X POST -H "Content-Type: application/json" -d '{"username":"${pub('c')[0][1]}","password":"`, secret('curl'), `"}' https://${host}/api/atlas/v2/groups/GROUP0/databaseUsers\n`], 'curl -d JSON body', ['direct-field', 'delimiter-quote']);
        add(family, 'positive', 'password-json-pretty', ['{\n  "username": "', synth(`${family}:pu`, 8, LOWER), '",\n  "password": "', secret('pretty'), '"\n}\n'], 'pretty-printed request body', ['direct-field']);
        add(family, 'positive', 'password-unicode-prefix', ['{"note":"café \u{1F680}","password":"', secret('uni'), '"}\n'], 'a non-ASCII member first', ['utf8-preceding']);
        add(family, 'positive', 'password-json-last-key', [`{"password":"`, secret('first'), '"}\n'], 'sole member', ['direct-field']);
        add(family, 'positive', 'password-uri-userinfo', [`mongodb+srv://${synth(`${family}:uu`, 8, LOWER)}:`, { secret: synth(`${family}:uri`, 14, ALNUM) }, '@cluster0.example.test/app?retryWrites=true\n'], 'mongodb+srv URI userinfo: the adopted contract (#1226) reads the password substring, undecoded; host, path and query stay outside', ['direct-field', 'delimiter-at']);
        add(family, 'positive', 'password-lowentropy', ['{"username":"app","password":"', { secret: 'abcabcabcabca' }, '"}\n'], 'a 13-byte low-entropy literal in the slot: contract expectation is medium confidence and warn', ['value-entropy']);
        add(family, 'unsupported', 'password-below-floor', ['{"username":"app","password":"', { secret: synth(`${family}:floor`, 6, ALNUM) }, '"}\n'], 'under the 8-byte field floor: user-chosen passwords are a stated blind spot, never scored as a miss', ['value-width']);
        add(family, 'conflict', 'password-uri-percent-escapes', [`mongodb+srv://${synth(`${family}:up`, 8, LOWER)}:${synth(`${family}:upw`, 8, ALNUM)}%40${synth(`${family}:upx`, 4, ALNUM)}@cluster0.example.test/app\n`], 'CONTRACT-EVIDENCE CONFLICT: the contract keeps valid %XX escapes inside the span undecoded; the evidence records Atlas percent encoding in a connection string as unresolved. Observed, not scored.', ['representation']);
        add(family, 'control', 'password-public-fields', [`{"databaseName":"${pub('pf')[1][1]}","username":"${pub('pf')[0][1]}","roles":[]}\n`], 'user name and database name only (a read response carries no password)', ['neighbouring-public-field']);
        add(family, 'control', 'password-placeholder', ['{"username":"app","password":"<password>"}\n'], 'placeholder', ['placeholder']);
        add(family, 'control', 'password-reference-env', [`{"username":"app","password":"\${${envName}}"}\n`], 'environment reference', ['reference']);
        add(family, 'control', 'password-reference-template', ['{"username":"app","password":"{{ secrets.db_password }}"}\n'], 'template reference', ['reference']);
        add(family, 'control', 'password-masked', ['{"username":"app","password":"********"}\n'], 'masked value', ['mask']);
        add(family, 'control', 'password-name-lookalike', [`{"passwordLastChangedAt":"2026-10-05","passwordPolicy":"scram"}\n`], 'name lookalikes with public values', ['header-name-lookalike']);
      }
      // ---- Atlas programmatic API key: Digest input only, no wire carrier ----------
      if (layoutName === 'digest-only') {
        const nonce = synth(`${family}:nonce`, 24, ALNUM);
        add(family, 'control', 'digest-authorization', [`GET /api/atlas/v2/groups HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Digest username="${pub('d')[0][1]}", realm="MMS Public API", nonce="${nonce}", uri="/api/atlas/v2/groups", response="${synth(`${family}:resp`, 32, HEX)}", qop=auth, nc=00000001, cnonce="${synth(`${family}:cn`, 16, HEX)}"\r\n\r\n`], 'a Digest wire header holds a hash and the public key, not the private key', ['neighbouring-public-field']);
        add(family, 'control', 'digest-curl', [`curl -s --digest -u ${pub('dc')[0][1]}:\${ATLAS_PRIVATE_KEY} https://${host}/api/atlas/v2/groups\n`], 'curl --digest with a reference for the private half', ['reference']);
        add(family, 'control', 'digest-public-key-only', [`{"publicKey":"${pub('pk')[0][1]}","desc":"ci key","roles":[{"roleName":"GROUP_READ_ONLY"}]}\n`], 'the 8-character public key', ['neighbouring-public-field']);
        add(family, 'control', 'digest-redacted-read', [`{"publicKey":"${pub('rr')[0][1]}","privateKey":"********-****-****-${synth(`${family}:rr`, 12, HEX).replace(/[0-9a-f]/g, '*')}"}\n`], 'later reads return a redacted private key', ['mask']);
        add(family, 'unsupported', 'digest-curl-user-literal', [`curl -s --digest --user ${pub('du')[0][1]}:${synth(`${family}:du`, 36, HEX)} https://${host}/api/atlas/v2/groups\n`], 'the contract says this layout is not read today and is a new carrier decision: observed, not scored', ['representation']);
        add(family, 'unsupported', 'digest-privateKey-member', [`{"publicKey":"${pub('um')[0][1]}","privateKey":"${synth(`${family}:um`, 36, HEX + '-')}"}\n`], 'the handoff names no member for the unredacted creation response: observed, not scored (positive carrier not established)', ['representation']);
        add(family, 'unsupported', 'digest-private-key-assignment', [`ATLAS_PRIVATE_KEY=${synth(`${family}:env`, 36, HEX)}\n`], 'a client-configured Digest input has no established wire or config slot', ['representation']);
      }
    }
  }
  return cases;
}

export const cases = build();

export function corpusDigest() {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}
