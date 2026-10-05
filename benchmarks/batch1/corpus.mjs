import { createHash } from 'node:crypto';

// Issue #717: the focused Batch 1 corpus for five bounded credential candidates
// (credential-evidence#232; product issues redact-secret#1209-#1213).
//
// Every value is built here from a public seed with SHA-256 and never from a
// scanner result, a provider-issued credential or an example in a provider page.
// An expectation is authored from the issue's bounded contract and nothing else:
//   - `positive`    the carrier is in a supported layout; the expected span is the
//                   credential value (the encoded envelope for Basic / ApiKey),
//                   the expected action is `redact`;
//   - `control`     must produce no finding that touches the carrier (public ids,
//                   HMAC outputs, placeholders, references, masked values,
//                   name lookalikes, delimiter spillover);
//   - `unsupported` outside the contract (bare prefixes, newline-separated
//                   values, a key id alone). Observed and reported, never scored
//                   as a pass or a false negative (issue: "preserve unknown/bare
//                   unsupported variants").
// Provider facts and project-policy expectations are kept apart in `FAMILIES`.

export const CORPUS_VERSION = 1;
export const EXPECTED_ACTION = 'redact';
/** The generic finding types the issue accepts; provider attribution is not promised. */
export const GENERIC_TYPES = ['contextual_secret', 'authorization_credential'];

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = `${ALNUM}-_`;
const HEX = '0123456789abcdef';

export function synth(seed, length, alphabet = ALNUM) {
  let out = '';
  for (let block = 0; out.length < length; block += 1) {
    const digest = createHash('sha256').update(`batch1:717:${seed}:${block}`).digest();
    for (const byte of digest) {
      if (out.length === length) break;
      out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

const b64 = text => Buffer.from(text, 'utf8').toString('base64');
const b64Bytes = (seed, count) => createHash('sha256').update(`batch1:717:${seed}:bytes`).digest().subarray(0, count).toString('base64');

export const FAMILIES = {
  'figma:personal-access-token': {
    issue: 1209,
    claim: 'explicit X-Figma-Token header value; PAT and plan tokens share the header, so no PAT subtype is inferred',
    providerFact: 'Figma REST API authenticates with an X-Figma-Token header (provider documentation).',
    projectPolicy: 'span is the header value; action redact; generic type; no bare figd_/figp_ grammar; no width claim',
    disposition: 'gap-expected',
  },
  'asana:webhook-secret': {
    issue: 1210,
    claim: 'the exact X-Hook-Secret header carrying the handshake shared secret',
    providerFact: 'Asana webhook handshake sends the shared secret in X-Hook-Secret; X-Hook-Signature is an HMAC of the body.',
    projectPolicy: 'span is the header value; action redact; generic type; no alphabet or width claim',
    disposition: 'gap-expected',
  },
  'airtable:webhook-mac-secret': {
    issue: 1211,
    claim: 'the documented macSecretBase64 field, the complete encoded value',
    providerFact: 'Airtable create-webhook responses carry macSecretBase64; notification MACs arrive in X-Airtable-Content-MAC.',
    projectPolicy: 'span is the whole encoded value including padding; no generalization of *Base64 fields; no width claim',
    disposition: 'gap-expected',
  },
  'elastic:elasticsearch-api-key': {
    issue: 1212,
    claim: 'Authorization / Proxy-Authorization: ApiKey envelope value, undecoded',
    providerFact: 'Elasticsearch accepts the base64 of id:api_key after the ApiKey scheme.',
    projectPolicy: 'span is the whole encoded value; generic authorization_credential; no Elastic attribution; no alphabet or width claim',
    disposition: 'gap-expected',
  },
  'canva:client-secret': {
    issue: 1213,
    claim: 'existing client_secret assignment / form-body / JSON and Authorization Basic envelope coverage',
    providerFact: 'Canva documents a cnvca prefix; separator, body length and alphabet are not documented.',
    projectPolicy: 'bounded credential-context expectations; Basic span is the encoded envelope; no bare-prefix detector',
    disposition: 'coverage-validation',
  },
};

export const FAMILY_IDS = Object.keys(FAMILIES);

function build() {
  const cases = [];
  const ids = new Set();
  /** `parts` is an array of strings and `{ secret }` objects; `unicode` prepends a non-ASCII line. */
  const add = (family, kind, layout, parts, note) => {
    const id = `${family.split(':')[0]}-${layout}-${kind}`;
    if (ids.has(id)) throw new Error(`batch1: duplicate case id ${id}`);
    ids.add(id);
    let text = '';
    let span = null;
    for (const part of parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = Buffer.byteLength(text);
      text += part.secret;
      span = { start, end: Buffer.byteLength(text) };
    }
    if (kind === 'positive' && !span) throw new Error(`batch1: positive ${id} has no secret span`);
    cases.push({ id, family, kind, layout, text, expected: span, action: span ? EXPECTED_ACTION : null, note });
  };
  const S = (seed, n, alphabet) => ({ secret: synth(seed, n, alphabet) });
  const raw = (v, ...head) => [`GET /v1/files/FILE0 HTTP/1.1\r\nHost: api.example.test\r\n`, ...head, `\r\nAccept: application/json\r\n\r\n`];

  // figma:personal-access-token -------------------------------------------------
  {
    const f = 'figma:personal-access-token';
    const key = (slug, n = 40) => S(`${f}:${slug}`, n, URLSAFE);
    add(f, 'positive', 'raw-http', raw(null, 'X-Figma-Token: ', key('raw'), ''), 'raw HTTP request header');
    add(f, 'positive', 'raw-http-unicode-prefix', ['// notiz: café \u{1F680} Figma-Datei\nGET /v1/me HTTP/1.1\r\nHost: api.example.test\r\nX-Figma-Token: ', key('uni', 43), '\r\n\r\n'], 'a non-ASCII line first: UTF-8 byte, UTF-16 and code point offsets differ');
    add(f, 'positive', 'curl-single', ['curl -s -H \'X-Figma-Token: ', key('c1', 32), '\' https://api.example.test/v1/files/FILE0\n'], 'quoted curl -H, single quotes');
    add(f, 'positive', 'curl-double', ['curl -s -H "X-Figma-Token: ', key('c2', 24), '" https://api.example.test/v1/files/FILE0\n'], 'quoted curl -H, double quotes');
    add(f, 'positive', 'json-header-map', ['{"method":"GET","url":"https://api.example.test/v1/files/FILE0","headers":{"Accept":"application/json","X-Figma-Token":"', key('map'), '"}}\n'], 'JSON header map');
    add(f, 'control', 'token-id-header', [`X-Figma-Token-Id: ${synth(`${f}:id`, 22, URLSAFE)}\r\n`], 'longer header name (-Id): an identifier, not the credential');
    add(f, 'control', 'suffixed-name-curl', [`curl -H 'X-Figma-Token-Hint: ${synth(`${f}:hint`, 32, URLSAFE)}' https://api.example.test/\n`], 'suffixed header name');
    add(f, 'unsupported', 'prefixed-name', [`X-Old-Figma-Token: ${synth(`${f}:old`, 32, URLSAFE)}\r\n`], 'prefixed header name: may carry the same credential, so observed, not a control');
    add(f, 'control', 'placeholder-angle', ['X-Figma-Token: <your-figma-token>\r\n'], 'placeholder');
    add(f, 'control', 'placeholder-example', ['curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" https://api.example.test/v1/me\n'], 'placeholder');
    add(f, 'control', 'reference-env', ['curl -H "X-Figma-Token: ${FIGMA_TOKEN}" https://api.example.test/v1/me\n'], 'environment reference');
    add(f, 'control', 'reference-template', ['{"headers":{"X-Figma-Token":"{{ secrets.figma_token }}"}}\n'], 'template reference');
    add(f, 'control', 'masked', ['X-Figma-Token: ****************\r\n'], 'masked display');
    add(f, 'control', 'masked-bullets', ['X-Figma-Token: ••••••••••••\r\n'], 'masked display');
    add(f, 'control', 'public-ids', [`{"planId":"${synth(`${f}:plan`, 19, '0123456789')}","user":{"id":"${synth(`${f}:user`, 19, '0123456789')}","handle":"example"}}\n`], 'public plan and user ids');
    add(f, 'unsupported', 'newline-separated', ['X-Figma-Token:\r\n', S(`${f}:nl`, 32, URLSAFE), '\r\n'], 'value on the next line is not a header value');
    add(f, 'unsupported', 'bare-figd-prose', [`Personal access tokens look like figd_${synth(`${f}:bare`, 40, URLSAFE)} in the account settings.\n`], 'bare figd_ prose is not part of this claim');
  }

  // asana:webhook-secret --------------------------------------------------------
  {
    const f = 'asana:webhook-secret';
    const key = (slug, n = 32) => S(`${f}:${slug}`, n, HEX + 'ghijklmnop');
    add(f, 'positive', 'raw-http', ['POST /receive-webhook HTTP/1.1\r\nHost: hooks.example.test\r\nX-Hook-Secret: ', key('raw'), '\r\nContent-Length: 0\r\n\r\n'], 'handshake request header');
    add(f, 'positive', 'raw-http-response', ['HTTP/1.1 200 OK\r\nX-Hook-Secret: ', key('resp', 40), '\r\nContent-Length: 0\r\n\r\n'], 'handshake response echo');
    add(f, 'positive', 'raw-http-unicode-prefix', ['# rückruf \u{1F512}\nPOST /h HTTP/1.1\r\nX-Hook-Secret: ', key('uni', 36), '\r\n\r\n'], 'a non-ASCII line first');
    add(f, 'positive', 'curl-single', ['curl -X POST -H \'X-Hook-Secret: ', key('c1', 28), '\' https://hooks.example.test/receive\n'], 'quoted curl -H');
    add(f, 'positive', 'curl-double', ['curl -X POST -H "X-Hook-Secret: ', key('c2', 44), '" https://hooks.example.test/receive\n'], 'quoted curl -H');
    add(f, 'positive', 'json-header-map', ['{"headers":{"Content-Type":"application/json","X-Hook-Secret":"', key('map'), '"},"body":{}}\n'], 'JSON header map');
    add(f, 'control', 'signature-hmac', [`X-Hook-Signature: ${synth(`${f}:sig`, 64, HEX)}\r\n`], 'HMAC output, not the shared secret');
    add(f, 'control', 'signature-curl', [`curl -H 'X-Hook-Signature: ${synth(`${f}:sig2`, 64, HEX)}' https://hooks.example.test/receive\n`], 'HMAC output');
    add(f, 'control', 'secret-id', [`X-Hook-Secret-Id: ${synth(`${f}:id`, 16, HEX)}\r\n`], 'longer header name');
    add(f, 'control', 'secrets-plural', [`X-Hook-Secrets: ${synth(`${f}:plural`, 32, HEX + 'ghijklmnop')}\r\n`], 'longer header-name lookalike');
    add(f, 'unsupported', 'prefixed-name', [`X-Old-Hook-Secret: ${synth(`${f}:old`, 32, HEX + 'ghijklmnop')}\r\n`], 'prefixed header name: may carry the same credential, so observed, not a control');
    add(f, 'control', 'placeholder', ['X-Hook-Secret: <hook-secret>\r\n'], 'placeholder');
    add(f, 'control', 'reference-env', ['curl -H "X-Hook-Secret: ${HOOK_SECRET}" https://hooks.example.test/receive\n'], 'environment reference');
    add(f, 'control', 'masked', ['X-Hook-Secret: ********\r\n'], 'masked value');
    add(f, 'control', 'bare-string', [`The handshake finished with ${synth(`${f}:bare`, 32, HEX + 'ghijklmnop')} in the log.\n`], 'bare arbitrary string');
  }

  // airtable:webhook-mac-secret -------------------------------------------------
  {
    const f = 'airtable:webhook-mac-secret';
    const mac = slug => ({ secret: b64Bytes(`${f}:${slug}`, 32) });
    add(f, 'positive', 'json', ['{"id":"ach', synth(`${f}:hook1`, 14), '","macSecretBase64":"', mac('json'), '","expirationTime":"2026-10-19T00:00:00.000Z"}\n'], 'create-webhook response');
    add(f, 'positive', 'json-pretty', ['{\n  "macSecretBase64": "', mac('pretty'), '",\n  "expirationTime": "2026-10-19T00:00:00.000Z"\n}\n'], 'pretty JSON');
    add(f, 'positive', 'yaml', ['webhook:\n  id: ach', synth(`${f}:hook2`, 14), '\n  macSecretBase64: ', mac('yaml'), '\n  expirationTime: 2026-10-19\n'], 'YAML mapping');
    add(f, 'positive', 'yaml-quoted', ['webhook:\n  macSecretBase64: "', mac('yamlq'), '"\n'], 'YAML mapping, quoted');
    add(f, 'positive', 'assignment-spaced', ['macSecretBase64 = "', mac('as1'), '"\n'], 'direct assignment');
    add(f, 'positive', 'assignment-env', ['macSecretBase64=', mac('as2'), '\nAIRTABLE_BASE=app', synth(`${f}:base`, 14), '\n'], 'env-file assignment');
    add(f, 'positive', 'json-unicode-prefix', ['{"note":"café \u{1F680}","macSecretBase64":"', mac('uni'), '"}\n'], 'a non-ASCII field first');
    add(f, 'control', 'content-mac-header', [`X-Airtable-Content-MAC: hmac-sha256=${synth(`${f}:cm`, 64, HEX)}\r\n`], 'HMAC output, not the shared secret');
    add(f, 'control', 'ids', [`{"id":"ach${synth(`${f}:id`, 14)}","baseId":"app${synth(`${f}:b`, 14)}","expirationTime":"2026-10-19T00:00:00.000Z"}\n`], 'hook and base ids, adjacent public fields');
    add(f, 'control', 'other-base64-field', [`{"thumbnailBase64":"${b64Bytes(`${f}:thumb`, 32)}","name":"logo.png"}\n`], 'another *Base64 field: no universal rule');
    add(f, 'control', 'suffix-lookalike', [`{"macSecretBase64Length":${44},"macSecretBase64Present":true}\n`], 'field-name suffix lookalike with public values');
    add(f, 'control', 'suffix-lookalike-value', [`{"macSecretBase64Id":"${synth(`${f}:mid`, 16)}"}\n`], 'field-name suffix lookalike');
    add(f, 'control', 'placeholder', ['macSecretBase64: <mac-secret-base64>\n'], 'placeholder');
    add(f, 'control', 'reference-env', ['macSecretBase64=${AIRTABLE_MAC_SECRET}\n'], 'environment reference');
    add(f, 'control', 'masked', ['{"macSecretBase64":"****************************************"}\n'], 'masked value');
  }

  // elastic:elasticsearch-api-key ----------------------------------------------
  {
    const f = 'elastic:elasticsearch-api-key';
    const key = slug => ({ secret: b64(`${synth(`${f}:${slug}:id`, 20, URLSAFE)}:${synth(`${f}:${slug}:key`, 22, URLSAFE)}`) });
    add(f, 'positive', 'raw-http', ['GET /_security/_authenticate HTTP/1.1\r\nHost: es.example.test:9200\r\nAuthorization: ApiKey ', key('raw'), '\r\nAccept: application/json\r\n\r\n'], 'Authorization header');
    add(f, 'positive', 'raw-http-proxy', ['GET /_cluster/health HTTP/1.1\r\nHost: es.example.test:9200\r\nProxy-Authorization: ApiKey ', key('proxy'), '\r\n\r\n'], 'Proxy-Authorization header');
    add(f, 'positive', 'raw-http-unicode-prefix', ['# café \u{1F680}\nGET / HTTP/1.1\r\nAuthorization: ApiKey ', key('uni'), '\r\n\r\n'], 'a non-ASCII line first');
    add(f, 'positive', 'curl-single', ['curl -s -H \'Authorization: ApiKey ', key('c1'), '\' https://es.example.test:9200/_cat/indices\n'], 'quoted curl -H');
    add(f, 'positive', 'curl-double', ['curl -s -H "Authorization: ApiKey ', key('c2'), '" https://es.example.test:9200/_cat/indices\n'], 'quoted curl -H');
    add(f, 'positive', 'curl-proxy', ['curl -x http://proxy.example.test:3128 -H "Proxy-Authorization: ApiKey ', key('c3'), '" https://es.example.test:9200/\n'], 'quoted curl -H, proxy header');
    add(f, 'positive', 'json-header-map', ['{"headers":{"Accept":"application/json","Authorization":"ApiKey ', key('map'), '"}}\n'], 'JSON header map');
    add(f, 'positive', 'json-header-map-proxy', ['{"headers":{"Proxy-Authorization":"ApiKey ', key('pmap'), '"}}\n'], 'JSON header map, proxy header');
    add(f, 'control', 'bare-apikey-prose', [`Send the key after the ApiKey scheme: ApiKey ${b64(`${synth(`${f}:p:id`, 20, URLSAFE)}:${synth(`${f}:p:key`, 22, URLSAFE)}`)} is how the docs show it.\n`], 'bare ApiKey prose without a header carrier');
    add(f, 'control', 'name-prefix', [`X-Authorization: ApiKey ${b64(`${synth(`${f}:np:id`, 20, URLSAFE)}:${synth(`${f}:np:key`, 22, URLSAFE)}`)}\r\n`], 'header-name prefix lookalike');
    add(f, 'control', 'name-suffix', [`Authorization-Info: ApiKey ${b64(`${synth(`${f}:ns:id`, 20, URLSAFE)}:${synth(`${f}:ns:key`, 22, URLSAFE)}`)}\r\n`], 'header-name suffix lookalike');
    add(f, 'control', 'newline-between', ['Authorization: ApiKey\r\n', `${b64(`${synth(`${f}:nl:id`, 20, URLSAFE)}:${synth(`${f}:nl:key`, 22, URLSAFE)}`)}\r\n`], 'newline between scheme and value');
    add(f, 'control', 'placeholder', ['Authorization: ApiKey <your-api-key>\r\n'], 'placeholder');
    add(f, 'control', 'placeholder-curl', ['curl -H "Authorization: ApiKey YOUR_API_KEY" https://es.example.test:9200/\n'], 'placeholder');
    add(f, 'control', 'reference-env', ['curl -H "Authorization: ApiKey ${ES_API_KEY}" https://es.example.test:9200/\n'], 'environment reference');
    add(f, 'control', 'masked', ['Authorization: ApiKey ****************************\r\n'], 'masked value');
    add(f, 'unsupported', 'key-id-alone', [`{"id":"${synth(`${f}:alone`, 20, URLSAFE)}","name":"ingest-key","expiration":1791200000000}\n`], 'a key id alone: not assumed benign, not claimed');
  }

  // canva:client-secret ---------------------------------------------------------
  {
    const f = 'canva:client-secret';
    const secret = slug => `cnvca${synth(`${f}:${slug}`, 38, URLSAFE)}`;
    const clientId = slug => `OC-${synth(`${f}:cid:${slug}`, 12)}`;
    const basic = slug => ({ secret: b64(`${clientId(slug)}:${secret(slug)}`) });
    add(f, 'positive', 'assignment', ['CANVA_APP_ORIGIN=https://app.example.test\nclient_secret=', { secret: secret('as') }, '\n'], 'direct assignment');
    add(f, 'positive', 'assignment-quoted', ['client_secret = "', { secret: secret('asq') }, '"\n'], 'quoted assignment');
    add(f, 'positive', 'form-body', ['POST /rest/v1/oauth/token HTTP/1.1\r\nHost: api.example.test\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\ngrant_type=authorization_code&client_id=', clientId('form'), '&client_secret=', { secret: secret('form') }, '&code=AUTHCODE0\r\n'], 'form body: the span stops at the delimiter');
    add(f, 'positive', 'form-body-last', ['grant_type=client_credentials&client_id=', clientId('last'), '&client_secret=', { secret: secret('last') }, '\n'], 'form body, last parameter');
    add(f, 'positive', 'json', ['{"client_id":"', clientId('json'), '","client_secret":"', { secret: secret('json') }, '","grant_type":"authorization_code"}\n'], 'JSON body');
    add(f, 'positive', 'json-unicode-prefix', ['{"note":"café \u{1F680}","client_secret":"', { secret: secret('uni') }, '"}\n'], 'a non-ASCII field first');
    add(f, 'positive', 'basic-raw-http', ['POST /rest/v1/oauth/token HTTP/1.1\r\nHost: api.example.test\r\nAuthorization: Basic ', basic('braw'), '\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n'], 'Basic envelope: the encoded credential, not a decoded secret-only span');
    add(f, 'positive', 'basic-curl', ['curl -s -H "Authorization: Basic ', basic('bcurl'), '" -d grant_type=client_credentials https://api.example.test/rest/v1/oauth/token\n'], 'Basic envelope, quoted curl -H');
    add(f, 'control', 'client-id', [`client_id=${clientId('ctl')}\n`], 'public app identifier');
    add(f, 'control', 'client-id-json', [`{"client_id":"${clientId('ctl2')}","name":"Example app"}\n`], 'public app identifier');
    add(f, 'control', 'placeholder', ['client_secret=<your-client-secret>\n'], 'placeholder');
    add(f, 'control', 'placeholder-upper', ['client_secret=YOUR_CLIENT_SECRET\n'], 'placeholder');
    add(f, 'control', 'reference-env', ['client_secret=${CANVA_CLIENT_SECRET}\n'], 'environment reference');
    add(f, 'control', 'reference-template', ['{"client_secret":"{{ secrets.canva_client_secret }}"}\n'], 'template reference');
    add(f, 'control', 'masked', ['client_secret=****************\n'], 'masked value');
    add(f, 'control', 'prefix-prose', ['Canva client secrets are issued with a cnvca prefix in the developer portal.\n'], 'cnvca prefix prose');
    add(f, 'control', 'form-delimiter-spillover', [`grant_type=authorization_code&client_id=${clientId('sp')}&redirect_uri=https%3A%2F%2Fapp.example.test%2Fcallback&state=${synth(`${f}:state`, 24)}\n`], 'public form parameters around the carrier');
    add(f, 'unsupported', 'bare-prefix', [`export CANVA_TOKEN_NOTE=${secret('bare')}\n`], 'bare cnvca value outside a credential context: no new bare-prefix detector');
  }
  return cases;
}

export const cases = build();

export function corpusDigest() {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}
