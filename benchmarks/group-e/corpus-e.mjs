import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AXES as BATCH2_AXES, synth } from '../batch2/corpus-r2.mjs';

// Group E (#754): a blind baseline corpus for the nine retired / current-source reconciliation rows
//   adobe:service-account-jwt-private-key   airtable:legacy-api-key   dropbox:legacy-long-lived-access-token
//   hubspot:legacy-api-key   jfrog:api-key   zendesk:api-token   reddit:app-client-secret   reddit:oauth-access-token   reddit:oauth-refresh-token
// in the Batch 2 layout (carrier axes, case shape and scorer of benchmarks/batch2/corpus-r2.mjs and score-r2.mjs).
//
// Authority. Every expectation comes from one credential-evidence Case (snapshot-2026.10.06.5, evidence-group-e.json) and nothing else:
//   must-flag        -> `positive`, scored: the span roles `secret` of the Case (the value only, or the whole encoded run for the Zendesk Basic header)
//   must-not-flag    -> `control`, scored: no finding
//   not-assertable   -> `unsupported`, observed and never scored
// A form no Case asserts is also `unsupported` (a `probe`), never a guess. The corpus was written without reading any scanner output,
// product source or Batch 2 observation. The Cases state an outcome and spans, not a finding type or an action, so
// `expectedType` and `expectedAction` are null: score-r2's `pass`, `typeOk` and `actionOk` are therefore never true for this corpus; the
// Case-derived metrics are `exact`, `fullyCovered`, `misses` (positives) and `controlFlagged` (controls).
//
// Values are synthetic filler built at run time (synth) from a seed; no vendor-shaped value is a literal in this file. Vendor-shaped
// probe values (a prefix, a width or a grouping some source or tool uses but the Cases do not claim) are assembled below at run time and
// appear only in `unsupported` probe cases, in prose and in the carrier slot.

export const ISSUE = 754;
export const CORPUS_VERSION = 1;
export const SCHEMA = 'group-e-observations-v1';
export const EVIDENCE = JSON.parse(readFileSync(new URL('./evidence-group-e.json', import.meta.url), 'utf8'));

export const AXES = {
  ...Object.fromEntries(Object.entries(BATCH2_AXES).filter(([k]) => !['value-entropy', 'jwt-overlap'].includes(k))),
  'near-miss-name': 'the name or header is not the slot the Case names, or a value has no carrier: observed only, no Case asserts it',
  'glued-name': 'a prefixed or suffixed name lookalike of the slot name: observed only, no Case asserts it',
  'era-words': 'the document says the credential is retired, legacy or deprecated: an era never justifies silence in these Cases',
  'shape-independence': 'the same slot with a value of a different alphabet and width: the Case flags by position, never by shape',
  'fixture-mirror': 'the credential-evidence fixture verbatim, with its fixture spans',
  'probe-vendor-shaped': 'a vendor-shaped value (a prefix, width or grouping the Cases do not claim) assembled at run time: observed, never scored',
};

export const ROWS = [
  'adobe:service-account-jwt-private-key', 'airtable:legacy-api-key', 'dropbox:legacy-long-lived-access-token', 'hubspot:legacy-api-key', 'jfrog:api-key',
  'zendesk:api-token', 'reddit:app-client-secret', 'reddit:oauth-access-token', 'reddit:oauth-refresh-token',
];
export const FAMILY_IDS = ROWS;

/** Claim and open-question ids the readiness inventory (docs/handoffs/group-e-cases.md) assigns to each Case. */
export const CLAIMS = {
  'adobe-jwt-service-account-identifiers-and-private-key-references': ['jwt-claim-identifier-formats', 'jwt-private-key-developer-generated', 'jwt-exchange-request-parameters'],
  'adobe-jwt-private-key-file-contents-unsettled': ['private-key-encoding-unstated', 'generic-private-key-boundary'],
  'adobe-jwt-signed-assertion-form-field-unsettled': ['jwt-assertion-short-lived-recommendation', 'jwt-signed-with-private-key-rs256', 'derived-assertion-and-secret-companions'],
  'airtable-legacy-api-key-url-parameter-value': ['legacy-api-key-url-parameter-named', 'legacy-key-account-wide-access', 'existing-keys-end-of-api-access-2024-02-01'],
  'airtable-legacy-api-key-placeholders-references-and-non-values': ['legacy-api-key-url-parameter-named'],
  'airtable-legacy-api-key-bearer-header-and-bare-value-unsettled': ['key-presentation-form-in-historical-docs', 'format-unstated-in-pinned-captures'],
  'dropbox-legacy-long-lived-access-token-response-member': ['legacy-token-response-example-shape'],
  'dropbox-legacy-long-lived-access-token-placeholders-and-references': ['legacy-token-response-example-shape'],
  'dropbox-legacy-long-lived-access-token-bare-value-and-lone-member-unsettled': ['legacy-versus-current-boundary', 'no-second-artifact-for-format'],
  'hubspot-legacy-api-key-hapikey-query-parameter-value': ['api-key-carried-in-hapikey-query-parameter', 'developer-api-key-current-hapikey-carrier', 'account-and-developer-api-keys-differ-only-by-account-type'],
  'hubspot-legacy-api-key-placeholders-masked-display-and-references': ['api-key-carried-in-hapikey-query-parameter', 'hubspot-hapikey-documentation-placeholders'],
  'hubspot-legacy-api-key-hyphen-grouped-bare-value-unsettled': ['uuid-shaped-key-body-consistency'],
  'jfrog-api-key-header-and-basic-password-value': ['carriers-header-and-basic-password'],
  'jfrog-api-key-lookalikes-and-non-values': ['carriers-header-and-basic-password'],
  'jfrog-api-key-bare-value-and-format-conflict-unsettled': ['two-provider-statements-of-form-unreconciled'],
  'zendesk-api-token-basic-credential-token-part': ['basic-credential-composition-and-encoding'],
  'zendesk-api-token-lookalikes-and-non-values': ['basic-credential-composition-and-encoding'],
  'zendesk-api-token-basic-credential-encoded-header-value': ['basic-credential-composition-and-encoding', 'basic-credential-composition-in-2022-capture'],
  'zendesk-api-token-bare-value-and-grammar-unsettled': ['opaque-grammar', 'variants-over-time'],
  'reddit-app-client-secret-basic-password': ['archived-docs-name-client-secret', 'archived-docs-secret-confidentiality-and-grants'],
  'reddit-installed-app-non-empty-basic-password-unsettled': ['installed-app-secret-presence-differs-between-pages'],
  'reddit-oauth-access-token-response-member': ['archived-docs-name-bearer-access-token', 'archived-docs-token-response-members-and-fragment'],
  'reddit-oauth-access-token-bearer-header-and-redirect-fragment': ['archived-docs-name-bearer-access-token', 'archived-docs-token-response-members-and-fragment', 'archived-docs-app-only-and-revocation-carriers'],
  'reddit-oauth-refresh-token-response-member-and-request-field': ['archived-docs-name-refresh-token', 'archived-docs-refresh-request-carrier-and-response', 'archived-docs-refresh-token-only-in-permanent-code-flow'],
  'reddit-oauth-revoke-token-request-body-token-field': ['archived-docs-app-only-and-revocation-carriers', 'archived-docs-name-refresh-token'],
  'reddit-oauth-documentation-template-words-references-and-non-values': ['archived-docs-name-client-secret', 'archived-docs-name-bearer-access-token', 'archived-docs-name-refresh-token'],
  'reddit-oauth-bare-values-and-encoded-basic-header-unsettled': ['opaque-token-attribution', 'secret-format-not-researched'],
};

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = `${ALNUM}-_`;
const HEX = '0123456789abcdef';
const DIGITS = '0123456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';
const D = '$';
const MB = '\u{1F680} caf\u00e9 \u65e5\u672c\u8a9e e\u0301';
const b64 = text => Buffer.from(text, 'utf8').toString('base64');

const seedOf = (family, slug, n, alpha) => synth(`group-e:754:${family}:${slug}`, n, alpha);
/** Value shapes for `shape-independence`. None is vendor-shaped; the Cases claim no shape for any row. */
const SHAPES = [['hex32', HEX, 32], ['alnum64', ALNUM, 64], ['urlsafe40', URLSAFE, 40], ['digits24', DIGITS, 24], ['lower16', LOWER, 16]];

// ---------------------------------------------------------------------------------------------------------------------------------

const ANY = /.*/;
const R = (ref, to, kind, family, layout, why) => ({ ref, to, kind, family, layout, why });
/** Reviewer rulings (E-B1..E-B3, A2, A6..A8). `to` is the observed-only kind the case is downgraded to. */
const RULINGS = [
  R('E-B2', 'unsupported', 'control', /^adobe:/, /^claims-(json-compact|json-metascopes|same-shape-identifiers|yaml)$/, 'the Cases leave the confidentiality of the Adobe identifiers open'),
  R('E-B2', 'conflict', 'control', /^zendesk:/, /^fx-api-token-lookalike-(email-and-subdomain-only|environment-reference|masked-display|separator-without-token)$/, 'the fixture carries a literal email address whose confidentiality the Case leaves open'),
  R('E-B3', 'unsupported', 'positive', /^zendesk:/, /^basic-proxy-header$/, 'the Case names the Authorization header only'),
  R('A2', 'unsupported', 'positive', /^(airtable|hubspot):/, /^query-(yaml-url-unquoted|html-href|fragment-after|log-line-crlf)$/, 'a container the Case does not name'),
  R('A2', 'unsupported', 'positive', /^(reddit:oauth-access-token|jfrog:)/, /^header-(yaml-map|json-map|json-map-spaced|json-pretty-crlf)$/, 'a container the Case does not name (not a Case fixture)'),
  R('A2', 'unsupported', 'positive', /^zendesk:/, /^(credential-yaml-quoted|credential-yaml-unquoted|basic-yaml-header)$/, 'a container the Case does not name'),
  R('A2', 'unsupported', 'positive', /^reddit:oauth-access-token/, /^fragment-(html-href|html-href-quote|log-line-crlf)$/, 'a container the Case does not name'),
  R('A2', 'unsupported', 'positive', /^dropbox:/, /^member-json-wrapped-(object|array)$/, 'a container the Case does not name'),
  R('A2-consistency', 'unsupported', 'positive', /^reddit:oauth-(access|refresh)-token/, /^member-json-wrapped-(object|array)$/, 'a container the Case does not name, ruled the same as the Dropbox wrapped members'),
  R('A6', 'unsupported', 'control', /^adobe:/, /^(exchange-client-id-form|exchange-client-id-curl|key-path-json|fx-jwt-claims-payload-identifiers)$/, 'an identifier literal whose confidentiality the Cases leave open'),
  R('A6', 'unsupported', 'control', /^hubspot:/, /^developer-key-(brace-placeholder-appid|empty)$/, 'an appId literal whose confidentiality the Case leaves open'),
  R('A7', 'unsupported', 'control', /^(dropbox|reddit:oauth-access-token|reddit:oauth-refresh-token)/, /^(member-null|form-null-undefined)$/, 'no Case lists null or undefined as a non-value'),
  R('A8', 'unsupported', 'positive', /^jfrog:/, /^header-mixed-case-name(-curl)?$/, 'the X-JFrog-Art-Api spelling comes from the reference-token contract, the API-key Case writes X-JFrog-Art-API'),
];
/** A13: variants of a non-value class the Cases do not spell out. */
const variantOf = (layout, kind) => kind !== 'control' || layout.startsWith('fx-') ? null : /masked-bullets|^form-masked$/.test(layout) ? 'bullet-mask' : /template-reference/.test(layout) ? 'secrets-template' : null;

function build() {
  const cases = [];
  const ids = new Set();

  /**
   * `parts` mixes literal strings and `{ secret }` objects; the spans of the secrets, in UTF-8 bytes, are the expectation.
   * meta: { case, fixture, derivation, families? }.
   */
  const add = (family, kind0, layout, parts, note, axes, meta) => {
    // reviewer rulings: a scored expectation must be supported by the evidence Case, else the case is observed only (never deleted)
    const ruling = RULINGS.find(r => r.kind === kind0 && r.family.test(family) && r.layout.test(layout));
    const kind = ruling ? ruling.to : kind0;
    const id = `${family}:e:${layout}:${kind}`;
    if (ids.has(id)) throw new Error(`group-e: duplicate case id ${id}`);
    if (!meta?.case || !EVIDENCE.cases[meta.case]) throw new Error(`group-e: ${id} names no evidence Case`);
    ids.add(id);
    let text = '';
    const spans = [];
    for (const part of parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = Buffer.byteLength(text);
      text += part.secret;
      spans.push({ start, end: Buffer.byteLength(text) });
    }
    if (kind === 'positive' && !spans.length) throw new Error(`group-e: positive ${id} has no span`);
    if (kind === 'control' && spans.length) throw new Error(`group-e: control ${id} names a span`);
    cases.push({
      id, family, families: meta.families ?? [family], kind, layout, axes, text,
      expected: kind === 'positive' ? spans[0] : null,
      expectedExtra: kind === 'positive' ? spans.slice(1) : [],
      expectedType: null, expectedAction: null,
      // an `unsupported` probe records where its filler value sits so a report can show what was observed there; it is never scored
      observedSpans: kind === 'unsupported' || kind === 'conflict' ? spans : [],
      case: meta.case, fixture: meta.fixture ?? null, derivation: meta.derivation, claims: CLAIMS[meta.case], note,
      ...(ruling ? { downgraded: { ref: ruling.ref, from: kind0, why: ruling.why }, downgradedFrom: kind0, ruling: ruling.ref } : {}),
      ...(variantOf(layout, kind) ? { variant: variantOf(layout, kind) } : {}),
    });
  };

  // ---- the evidence fixtures themselves ---------------------------------------------------------------------------------------
  const FIXTURE_FAMILY = (f) => {
    const families = EVIDENCE.cases[f.case].families.map(x => x.family);
    if (families.length === 1) return families[0];
    const n = f.id.split('--')[1];
    if (/revoke|revocation-success/.test(n)) return 'reddit:oauth-access-token';
    if (/refresh/.test(n)) return 'reddit:oauth-refresh-token';
    if (/bearer|access-token|access-response|access-carrier|token-response-without/.test(n)) return 'reddit:oauth-access-token';
    return 'reddit:app-client-secret';
  };
  for (const f of EVIDENCE.fixtures) {
    const c = EVIDENCE.cases[f.case];
    const kind = c.outcome === 'must-flag' ? 'positive' : c.outcome === 'must-not-flag' ? 'control' : 'unsupported';
    if (f.outcome !== c.outcome) throw new Error(`group-e: fixture ${f.id} disagrees with its Case`);
    const parts = [];
    let at = 0;
    const bytes = Buffer.from(f.text, 'utf8');
    for (const s of f.spans) {
      if (s.role !== 'secret') throw new Error(`group-e: fixture ${f.id} has a span role ${s.role}`);
      parts.push(bytes.subarray(at, s.start).toString('utf8'), { secret: bytes.subarray(s.start, s.end).toString('utf8') });
      at = s.end;
    }
    parts.push(bytes.subarray(at).toString('utf8'));
    const family = FIXTURE_FAMILY(f);
    const shared = c.families.map(x => x.family);
    add(family, kind, `fx-${f.id.split('--')[1]}`, parts, `credential-evidence fixture ${f.id}, verbatim`, ['fixture-mirror', 'direct-slot'], {
      case: f.case, fixture: f.id, derivation: 'fixture-mirror', families: shared.length > 1 && f.case !== 'reddit-oauth-documentation-template-words-references-and-non-values' && f.case !== 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled' ? shared : [family],
    });
  }

  // helpers shared by the slot builders
  const sec = (family, slug, n, alpha = ALNUM) => ({ secret: seedOf(family, slug, n, alpha) });
  const lit = (family, slug, n, alpha = ALNUM) => seedOf(family, slug, n, alpha);
  const envName = family => family.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
  const dir = {
    positive: (family, c, fx) => (layout, parts, note, axes, derivation = 'carrier-extension') => add(family, 'positive', layout, parts, note, axes, { case: c, fixture: fx, derivation }),
    control: (family, c, fx) => (layout, parts, note, axes = ['near-miss-value'], derivation = 'class-extension') => add(family, 'control', layout, parts, note, axes, { case: c, fixture: fx, derivation }),
    unsupported: (family, c, fx, derivation = 'probe') => (layout, parts, note, axes = ['representation'], d = derivation) => add(family, 'unsupported', layout, parts, note, axes, { case: c, fixture: fx, derivation: d }),
  };

  /**
   * One value-in-a-slot template set. `slot(v, tail)` returns the parts of a plain document that holds secret `v` in the slot
   * (`tail` is what follows it); the other layouts wrap that. `slotNote` names the slot for the notes.
   */

  // ======================================================= query parameter (airtable api_key, hubspot hapikey) =======================================================
  const queryRow = (family, { name, host, path, pub, extraQuery, caseIds, fx, pubName }) => {
    const P = dir.positive(family, caseIds.pos, fx.pos);
    const C = dir.control(family, caseIds.ctl, fx.ctl);
    const U = dir.unsupported(family, caseIds.uns, fx.uns);
    const v = (s, n = 32, a = ALNUM) => sec(family, s, n, a);
    const base = `https://${host}${path}`;
    const q0 = pub; // e.g. count=10
    P('query-raw-http-middle', [`GET ${path}?${q0}&${name}=`, v('q1'), `&view=Grid HTTP/1.1\r\nHost: ${host}\r\n\r\n`], 'raw request line, value then a public parameter', ['direct-slot', 'delimiter-after']);
    P('query-raw-http-first', [`GET ${path}?${name}=`, v('q2'), `&${q0} HTTP/1.1\r\nHost: ${host}\r\n\r\n`], 'first parameter', ['delimiter-before', 'delimiter-after']);
    P('query-raw-http-last-space', [`GET ${path}?${q0}&${name}=`, v('q3'), ` HTTP/1.1\r\nHost: ${host}\r\n\r\n`], 'last parameter, a space then the HTTP version ends it', ['delimiter-after']);
    P('query-curl-double', [`curl "${base}?${name}=`, v('q4'), '"\n'], 'double-quoted curl URL, the closing quote ends it', ['delimiter-after']);
    P('query-curl-double-amp', [`curl "${base}?${name}=`, v('q5'), `&${q0}"\n`], 'double-quoted curl URL, an ampersand ends it', ['delimiter-after']);
    P('query-curl-single', [`curl '${base}?${q0}&${name}=`, v('q6'), "'\n"], 'single-quoted curl URL', ['delimiter-after']);
    P('query-curl-unquoted', [`curl ${base}?${name}=`, v('q7'), ' -H "Accept: application/json"\n'], 'unquoted curl URL, a space ends it', ['delimiter-after']);
    P('query-json-config-url', [`{\n  "baseUrl": "${base}?${name}=`, v('q8'), '",\n  "timeout": 30\n}\n'], 'a URL held in a JSON configuration file', ['nesting', 'delimiter-after']);
    P('query-json-config-url-last', [`{"timeout":30,"baseUrl":"${base}?${q0}&${name}=`, v('q9'), '"}'], 'URL value at the end of the input', ['nesting', 'end-of-input']);
    P('query-yaml-url-unquoted', [`# ${MB}\nurl: ${base}?${name}=`, v('q10'), '\ntimeout: 30\n'], 'unquoted YAML URL, a comment with multi-byte text first', ['nesting', 'utf8-preceding', 'delimiter-after']);
    P('query-fragment-after', [`${base}?${name}=`, v('q11'), '#section\n'], 'a URL fragment marker ends it', ['delimiter-after']);
    P('query-eof', [`${base}?${q0}&${name}=`, v('q12')], 'the value is the last bytes of the input', ['end-of-input', 'stream-cut']);
    P('query-log-line-crlf', [`[2026-10-06T10:00:00Z] GET ${base}?${name}=`, v('q13'), ' 200 12ms\r\n'], 'a log line with CRLF', ['line-ending', 'delimiter-after']);
    P('query-trailing-whitespace', [`${base}?${name}=`, v('q14'), '   \t\r\n'], 'trailing spaces, a tab and CRLF', ['line-ending', 'delimiter-after']);
    P('query-html-href', [`<a href="${base}?${name}=`, v('q15'), '">open</a>\n'], 'inside an HTML href, the closing quote ends it', ['nesting', 'delimiter-after']);
    P('query-percent-neighbours', [`${base}?redirect=https%3A%2F%2Fapp.example.test%2Fcb&${name}=`, v('q16'), '&code=abc%3D\n'], 'percent-encoded public neighbours (the value itself has no escape)', ['neighbouring-public-field', 'delimiter-after']);
    P('query-same-shape-neighbour', [`${base}?client_ref=${lit(family, 'q17a', 32)}&${name}=`, v('q17'), `&request_ref=${lit(family, 'q17b', 32)}\n`], 'public parameters with the value\'s alphabet and width on both sides', ['same-shape-neighbour', 'neighbouring-public-field']);
    P('query-utf8-before-after', [`# ${MB}\ncurl "${base}?${name}=`, v('q18'), `" # ${MB}\n`], 'multi-byte text before the slot and after the delimiter', ['utf8-preceding', 'utf8-following']);
    P('query-big-preceding', [`${'x'.repeat(63)}\n`.repeat(80), `curl "${base}?${name}=`, v('q19'), '"\n'], 'about 5 KB of unrelated lines first', ['big-preceding']);
    P('query-repeat', [`curl "${base}?${name}=`, v('rep'), `"\nlog: GET ${path}?${name}=`, { secret: lit(family, 'rep', 32) }, ' 200\n'], 'the same value twice', ['repeat-secret']);
    P('query-neighbouring-secret', [`curl "${base}?${name}=`, v('q20'), `" -H "X-Api-Key: ${lit(family, 'q20o', 24)}"\n`], 'a second credential header in the same command', ['neighbouring-secret', 'delimiter-after']);
    P('query-era-words', [`# legacy key, retired and no longer accepted by the service\ncurl "${base}?${name}=`, v('q21'), '"\n'], 'the document calls the key retired: the era never justifies silence', ['era-words']);
    P('query-era-words-after', [`curl "${base}?${name}=`, v('q22'), '" # deprecated key kept for the old script\n'], 'a deprecation remark after the value', ['era-words', 'delimiter-after']);
    for (const [slug, alpha, n] of SHAPES) P(`query-shape-${slug}`, [`GET ${path}?${q0}&${name}=`, v(`shape-${slug}`, n, alpha), ` HTTP/1.1\r\nHost: ${host}\r\n\r\n`], `a ${slug} value: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);
    P('query-no-http-version', [`GET ${path}?${name}=`, v('q23'), '\r\n'], 'a request line with no HTTP version: the line end ends it', ['line-ending', 'delimiter-after']);

    // controls: non-values the Case lists (empty, placeholders, references, masks, the name in prose)
    C('query-empty-value-eol', [`curl "${base}?${q0}&${name}="\n`], 'empty value, the closing quote follows', ['near-miss-value']);
    C('query-empty-value-amp', [`GET ${path}?${name}=&${q0} HTTP/1.1\r\n\r\n`], 'empty value followed by another parameter', ['near-miss-value']);
    C('query-angle-placeholder', [`curl "${base}?${name}=<your-key>"\n`], 'angle-bracket placeholder', ['near-miss-value']);
    C('query-upper-placeholder', [`curl "${base}?${name}=YOUR_${name.toUpperCase()}"\n`], 'upper-case YOUR_ placeholder', ['near-miss-value']);
    C('query-brace-placeholder', [`curl "${base}?${name}={YOUR_KEY}"\n`], 'brace placeholder', ['near-miss-value']);
    C('query-env-reference', [`curl "${base}?${name}=${D}{${envName(family)}}"\n`], 'shell environment reference with braces', ['near-miss-value']);
    C('query-env-reference-bare', [`curl "${base}?${name}=${D}${envName(family)}"\n`], 'shell environment reference without braces', ['near-miss-value']);
    C('query-template-reference', [`GET ${path}?${name}={{ secrets.${name} }} HTTP/1.1\r\n\r\n`], 'template reference', ['near-miss-value']);
    C('query-masked-stars', [`curl "${base}?${name}=********************"\n`], 'fully masked display', ['near-miss-value']);
    C('query-masked-partial', [`curl "${base}?${name}=SY************01"\n`], 'masked display that keeps two characters at each end', ['near-miss-value']);
    C('query-name-in-prose', [`Older integrations pass the key in the ${name} query parameter of each request. See /docs/${name}.\n`], 'the parameter name in prose and a path', ['near-miss-name']);
    C('query-name-no-equals', [`curl "${base}?${name}&${q0}"\n`], 'the name with no value and no equals sign', ['near-miss-value']);
    C('query-public-parameters-only', [`GET ${path}?${q0}&view=Grid&redirect=https%3A%2F%2Fapp.example.test%2Fcb HTTP/1.1\r\n\r\n`], 'only public parameters', ['neighbouring-public-field']);

    // observed only
    U('query-uppercase-name', [`curl "${base}?${name.toUpperCase()}=`, v('u1'), '"\n'], 'upper-case parameter name: case of the name is unstated', ['representation']);
    U('query-prefixed-name', [`curl "${base}?old_${name}=`, v('u2'), '"\n'], 'a prefixed name may carry the same credential', ['glued-name', 'representation']);
    U('query-suffixed-name', [`curl "${base}?${name}_id=`, v('u3'), '"\n'], 'a suffixed name', ['glued-name']);
    U('query-below-eight', [`curl "${base}?${name}=`, v('u4', 6), '"\n'], 'a 6-byte value in the slot: no Case states a width floor', ['near-miss-value']);
    U('query-percent-value', [`curl "${base}?${name}=${lit(family, 'u5a', 14)}%2B${lit(family, 'u5b', 10)}%3D&${q0}"\n`], 'a percent-containing value in the slot', ['representation']);
    U('query-json-member', [`{"${name}":"`, v('u6'), '"}\n'], 'the same name as a JSON member: not the carrier the Case names', ['near-miss-name', 'representation']);
    U('query-assignment', [`${name} = "`, v('u7'), '"\n'], 'the same name as a quoted assignment: not the carrier the Case names', ['near-miss-name', 'representation']);
    U('query-secret-shaped-public-name', [`${base}?client_ref=${lit(family, 'u8', 32)}&request_ref=${lit(family, 'u8b', 32)}\n`], 'secret-shaped values under other names: no Case asserts them benign', ['same-shape-neighbour', 'near-miss-name']);
    U('query-newline-value', [`curl "${base}?${name}=\n`, v('u9'), '"\n'], 'the value on the next line', ['representation']);
    U('query-bearer-header-value', [`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Bearer `, v('u10'), '\r\n'], 'the value in a Bearer header: not the carrier the Case names', ['near-miss-name', 'representation']);
  };

  // ---- airtable
  queryRow('airtable:legacy-api-key', {
    name: 'api_key', host: 'api.airtable.example.test', path: '/v0/appSYNTHETIC0001/Table', pub: 'maxRecords=3',
    caseIds: { pos: 'airtable-legacy-api-key-url-parameter-value', ctl: 'airtable-legacy-api-key-placeholders-references-and-non-values', uns: 'airtable-legacy-api-key-bearer-header-and-bare-value-unsettled' },
    fx: { pos: 'airtable-authored--raw-http-api-key-query', ctl: 'airtable-authored--angle-placeholder', uns: 'airtable-authored--bearer-header-value' },
  });
  // ---- hubspot
  queryRow('hubspot:legacy-api-key', {
    name: 'hapikey', host: 'api.hubspot.example.test', path: '/contacts/v1/lists/all/contacts/all', pub: 'count=10',
    caseIds: { pos: 'hubspot-legacy-api-key-hapikey-query-parameter-value', ctl: 'hubspot-legacy-api-key-placeholders-masked-display-and-references', uns: 'hubspot-legacy-api-key-hyphen-grouped-bare-value-unsettled' },
    fx: { pos: 'hubspot-authored--raw-http-hapikey-query', ctl: 'hubspot-authored--angle-placeholder', uns: 'hubspot-authored--grouped-value-in-prose' },
  });
  {
    const family = 'hubspot:legacy-api-key';
    const P = dir.positive(family, 'hubspot-legacy-api-key-hapikey-query-parameter-value', 'hubspot-authored--curl-developer-key-with-app-id');
    const C = dir.control(family, 'hubspot-legacy-api-key-placeholders-masked-display-and-references', 'hubspot-authored--documented-developer-key-placeholder');
    const base = 'https://api.hubspot.example.test/integrators/timeline/v3/events';
    P('developer-key-curl-appid-after', ['curl -X POST "' + base + '?hapikey=', sec(family, 'dk1', 36, LOWER), '&appId=SYNTHETICAPPID0001"\n'], 'developer key, the public appId follows', ['neighbouring-public-field', 'delimiter-after']);
    P('developer-key-curl-appid-before', ['curl -X POST "' + base + '?appId=SYNTHETICAPPID0001&hapikey=', sec(family, 'dk2', 36, LOWER), '"\n'], 'developer key, the public appId first', ['neighbouring-public-field', 'delimiter-before']);
    P('developer-key-raw-http', ['POST /integrators/timeline/v3/events?hapikey=', sec(family, 'dk3', 36, LOWER), '&appId=SYNTHETICAPPID0001 HTTP/1.1\r\nHost: api.hubspot.example.test\r\nContent-Type: application/json\r\n\r\n{"eventTemplateId":"1"}\r\n'], 'developer key in a raw request line', ['direct-slot', 'delimiter-after']);
    P('developer-key-same-shape-appid', ['curl -X POST "' + base + '?hapikey=', sec(family, 'dk4', 36, LOWER), '&appId=' + lit(family, 'dk4a', 36, LOWER) + '"\n'], 'the appId given the key\'s alphabet and width', ['same-shape-neighbour', 'neighbouring-public-field']);
    C('developer-key-brace-placeholder-appid', ['curl -X POST "' + base + '?hapikey={YOUR_DEVELOPER_API_KEY}&appId=SYNTHETICAPPID0001"\n'], 'the documented developer-key placeholder with an appId', ['near-miss-value']);
    C('developer-key-empty', ['curl -X POST "' + base + '?hapikey=&appId=SYNTHETICAPPID0001"\n'], 'empty developer key', ['near-miss-value']);
  }

  // ======================================================= member of a JSON response =======================================================
  const memberRow = (family, { name, sibs, ctlSibs = sibs, caseIds, fx, expiresNote, era }) => {
    const P = dir.positive(family, caseIds.pos, fx.pos);
    const C = dir.control(family, caseIds.ctl, fx.ctl);
    const U = dir.unsupported(family, caseIds.uns, fx.uns);
    const v = (s, n = 40, a = URLSAFE) => sec(family, s, n, a);
    const sibList = s => sibs(s).map(([k, x]) => `"${k}":${typeof x === 'number' ? x : `"${x}"`}`);
    const sibJson = (s, sep = ',') => sibList(s).join(sep);
    // controls carry only members the Cases call public: the Dropbox account_id and uid are not asserted either way
    const ctlJson = s => ctlSibs(s).map(([k, x]) => `"${k}":"${x}"`).join(',');
    const sibPretty = s => sibs(s).map(([k, x]) => `  "${k}": ${typeof x === 'number' ? x : `"${x}"`}`);
    P('member-json-pretty-first', ['{\n  "' + name + '": "', v('m1'), '",\n' + sibPretty('m1').join(',\n') + '\n}\n'], 'pretty JSON, the member first', ['direct-slot', 'delimiter-after']);
    P('member-json-pretty-last', ['{\n' + sibPretty('m2').join(',\n') + ',\n  "' + name + '": "', v('m2'), '"\n}\n'], 'pretty JSON, the member last', ['delimiter-after']);
    P('member-json-compact-first', ['{"' + name + '":"', v('m3'), '",' + sibJson('m3') + '}\n'], 'compact JSON, the member first', ['direct-slot', 'delimiter-after']);
    P('member-json-compact-middle', ['{' + sibList('m4')[0] + ',"' + name + '":"', v('m4'), '",' + sibList('m4').slice(1).join(',') + '}\n'], 'compact JSON, public members on both sides', ['neighbouring-public-field', 'delimiter-before', 'delimiter-after']);
    P('member-json-compact-eof', ['{' + sibJson('m5') + ',"' + name + '":"', v('m5'), '"}'], 'compact JSON, the closing brace is the last byte of the input', ['end-of-input', 'stream-cut']);
    P('member-json-crlf-tabs', ['{\r\n\t"' + name + '": "', v('m6'), '",\r\n\t' + sibs('m6').map(([k, x]) => `"${k}": ${typeof x === 'number' ? x : `"${x}"`}`).join(',\r\n\t') + '\r\n}\r\n'], 'CRLF and tabs', ['line-ending', 'delimiter-before']);
    P('member-json-spaced-colon', ['{"' + name + '" : "', v('m7'), '" , ' + sibJson('m7', ', ') + '}\n'], 'whitespace around the colon and comma', ['delimiter-before', 'delimiter-after']);
    P('member-json-wrapped-object', ['{"status":"ok","response":{"' + name + '":"', v('m8'), '",' + sibJson('m8') + '}}\n'], 'inside a nested response object', ['nesting', 'delimiter-after']);
    P('member-json-wrapped-array', ['{"data":[{' + sibJson('m9a') + ',"' + name + '":"', v('m9'), '"},{' + sibJson('m9b') + '}]}\n'], 'inside the first entry of an array', ['nesting', 'neighbouring-public-field']);
    P('member-http-response-compact', ['HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"' + name + '":"', v('m10'), '",' + sibJson('m10') + '}\n'], 'raw HTTP response with a compact JSON body', ['direct-slot', 'nesting']);
    P('member-http-response-eof', ['HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{' + sibJson('m11') + ',"' + name + '":"', v('m11'), '"}'], 'raw HTTP response, body is the last bytes', ['end-of-input']);
    P('member-curl-output', ['$ curl -s https://api.example.test/oauth2/token -d grant_type=authorization_code -d code=SYNTHETICCODE0001\n{"' + name + '": "', v('m12'), '", ' + sibJson('m12', ', ') + '}\n'], 'a command and its output', ['direct-slot', 'delimiter-after']);
    P('member-same-shape-neighbour', ['{"request_ref":"' + lit(family, 'm13a', 40, URLSAFE) + '","' + name + '":"', v('m13'), '","trace_ref":"' + lit(family, 'm13b', 40, URLSAFE) + '",' + sibJson('m13') + '}\n'], 'public members with the value\'s alphabet and width on both sides', ['same-shape-neighbour', 'neighbouring-public-field']);
    P('member-utf8-before-after', ['{"note":"' + MB + '","' + name + '":"', v('m14'), '","after":"' + MB + '",' + sibJson('m14') + '}\n'], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
    P('member-big-preceding', [`${'x'.repeat(63)}\n`.repeat(80), '{"' + name + '":"', v('m15'), '",' + sibJson('m15') + '}\n'], 'about 5 KB of unrelated lines first', ['big-preceding']);
    P('member-repeat', ['{"' + name + '":"', v('rep'), '",' + sibJson('rep') + '}\nlog: ' + name + ' response again: {"' + name + '":"', { secret: lit(family, 'rep', 40, URLSAFE) }, '",' + sibJson('rep2') + '}\n'], 'the same value in two responses', ['repeat-secret']);
    P('member-neighbouring-secret', ['{"' + name + '":"', v('m16'), '","client_secret":"' + lit(family, 'm16o', 24) + '",' + sibJson('m16') + '}\n'], 'a different credential in the same object', ['neighbouring-secret']);
    P('member-era-words', ['{"_comment":"' + era + '","' + name + '":"', v('m17'), '",' + sibJson('m17') + '}\n'], 'the object says the credential is retired or archived: the era never justifies silence', ['era-words']);
    P('member-era-words-yamlish-comment', ['// ' + era + '\n{"' + name + '":"', v('m18'), '",' + sibJson('m18') + '}\n'], 'a comment line about the era first', ['era-words', 'utf8-preceding']);
    for (const [slug, alpha, n] of SHAPES) P(`member-shape-${slug}`, ['{"' + name + '":"', v(`shape-${slug}`, n, alpha), '",' + sibJson('shape') + '}\n'], `a ${slug} value: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);

    C('member-angle-placeholder', ['{"' + name + '":"<' + name.replace(/_/g, '-') + '>",' + ctlJson('c1') + '}\n'], 'angle-bracket placeholder', ['near-miss-value']);
    C('member-upper-placeholder', ['{"' + name + '":"YOUR_' + name.toUpperCase() + '",' + ctlJson('c2') + '}\n'], 'upper-case YOUR_ placeholder', ['near-miss-value']);
    C('member-template-reference', ['{"' + name + '":"{{ ' + name + ' }}",' + ctlJson('c3') + '}\n'], 'template reference', ['near-miss-value']);
    C('member-env-reference', ['{"' + name + '":"' + D + '{' + envName(family) + '}",' + ctlJson('c4') + '}\n'], 'environment reference inside a JSON string', ['near-miss-value']);
    C('member-masked-stars', ['{"' + name + '":"********",' + ctlJson('c5') + '}\n'], 'masked display', ['near-miss-value']);
    C('member-masked-bullets', ['{"' + name + '":"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",' + ctlJson('c6') + '}\n'], 'bullet-masked display', ['near-miss-value']);
    C('member-empty', ['{"' + name + '":"",' + ctlJson('c7') + '}\n'], 'empty string', ['near-miss-value']);
    C('member-null', ['{"' + name + '":null,' + ctlJson('c8') + '}\n'], 'null', ['near-miss-value']);
    C('member-public-members-only', ['{' + ctlJson('c9') + '}\n'], 'a response with no credential member', ['neighbouring-public-field']);
    C('member-name-in-prose', ['The ' + name + ' member of the response holds the credential; do not log it. See /' + name + '/docs.\n'], 'the member name in prose and a path', ['near-miss-name']);

    U('member-yaml-unquoted', ['response:\n  ' + name + ': ', v('u1'), '\n'], 'a YAML mapping: not the JSON member the Case names', ['representation']);
    U('member-single-quoted', ["{'" + name + "':'", v('u2'), "'}\n"], 'single-quoted (Python repr) member', ['representation']);
    U('member-json-in-string', ['{"body":"{\\"' + name + '\\":\\"', v('u3'), '\\"}"}\n'], 'a member inside an escaped JSON string', ['representation', 'nesting']);
    U('member-prefixed-name', ['{"old_' + name + '":"', v('u4'), '"}\n'], 'a prefixed member name', ['glued-name', 'representation']);
    U('member-suffixed-name', ['{"' + name + '_id":"', v('u5'), '"}\n'], 'a suffixed member name', ['glued-name']);
    U('member-below-eight', ['{"' + name + '":"', v('u6', 6), '",' + sibJson('u6') + '}\n'], 'a 6-byte value: no Case states a width floor', ['near-miss-value']);
    U('member-secret-shaped-public-name', ['{"request_ref":"' + lit(family, 'u7', 40, URLSAFE) + '","trace_ref":"' + lit(family, 'u7b', 40, URLSAFE) + '"}\n'], 'secret-shaped values under other names: no Case asserts them benign', ['same-shape-neighbour', 'near-miss-name']);
    U('member-with-expires-in', ['{"' + name + '":"', v('u8'), '","expires_in":3600,' + sibJson('u8') + '}\n'], expiresNote, ['near-miss-name', 'representation']);
  };

  // ---- dropbox (legacy-shaped response: token_type, account_id, uid, no expires_in)
  {
    const family = 'dropbox:legacy-long-lived-access-token';
    const sibs = s => [['token_type', 'bearer'], ['account_id', `SYNTHETIC-account-id-${lit(family, `acct:${s}`, 8, DIGITS)}`], ['uid', `SYNTHETIC-uid-${lit(family, `uid:${s}`, 8, DIGITS)}`]];
    memberRow(family, {
      name: 'access_token', sibs, ctlSibs: () => [['token_type', 'bearer']], era: 'legacy long-lived token, retired',
      caseIds: { pos: 'dropbox-legacy-long-lived-access-token-response-member', ctl: 'dropbox-legacy-long-lived-access-token-placeholders-and-references', uns: 'dropbox-legacy-long-lived-access-token-bare-value-and-lone-member-unsettled' },
      fx: { pos: 'dropbox-authored--pretty-json-response', ctl: 'dropbox-authored--access-token-angle-placeholder', uns: 'dropbox-authored--lone-access-token-member' },
      expiresNote: 'an expires_in beside the member: the Case does not use its absence or presence to separate the legacy token from the short-lived one',
    });
    const C = dir.control(family, 'dropbox-legacy-long-lived-access-token-placeholders-and-references', 'dropbox-authored--access-token-environment-reference');
    const U = dir.unsupported(family, 'dropbox-legacy-long-lived-access-token-bare-value-and-lone-member-unsettled', 'dropbox-authored--lone-access-token-member', 'unsettled-case');
    C('bearer-env-reference-curl-double', ['curl -s https://api.example.test/oauth2/token_info -H "Authorization: Bearer ' + D + '{DROPBOX_ACCESS_TOKEN}"\n'], 'environment reference in a Bearer header', ['near-miss-value']);
    C('bearer-env-reference-bare', ['curl -s https://api.example.test/2/users/get_current_account -H "Authorization: Bearer ' + D + 'DROPBOX_ACCESS_TOKEN"\n'], 'environment reference without braces', ['near-miss-value']);
    U('lone-member-compact', ['{"access_token":"', sec(family, 'lm1', 40, URLSAFE), '"}\n'], 'a lone member with no sibling: no provider statement separates it from the short-lived token', ['representation']);
    U('lone-member-crlf', ['{\r\n  "access_token": "', sec(family, 'lm2', 40, URLSAFE), '"\r\n}\r\n'], 'a lone member, CRLF', ['representation', 'line-ending']);
    U('bare-value-prose-saved', ['Saved token: ', sec(family, 'bv1', 40, URLSAFE), '\n'], 'a bare value with no carrier', ['near-miss-name']);
    U('bare-value-alone-on-line', [sec(family, 'bv2', 40, URLSAFE), '\n'], 'a bare value alone on a line', ['near-miss-name']);
    U('bare-value-eof', ['export TOKEN=', sec(family, 'bv3', 40, URLSAFE)], 'a bare value after an assignment of another name, at the end of the input', ['near-miss-name', 'end-of-input']);
  }

  // ======================================================= form body / query field (reddit refresh_token, revoke token) =======================================================
  const formRow = (family, { name, pathReq, grant, caseId, ctlCase, uns, fxPos, fxCtl, host, families, extraPublic }) => {
    const meta = (kind, c, fx) => (layout, parts, note, axes, derivation) => add(family, kind, layout, parts, note, axes, { case: c, fixture: fx, derivation, families });
    const P = (l, p, n, a) => meta('positive', caseId, fxPos)(l, p, n, a, 'carrier-extension');
    const C = (l, p, n, a = ['near-miss-value']) => meta('control', ctlCase, fxCtl)(l, p, n, a, 'class-extension');
    const U = (l, p, n, a = ['representation']) => meta('unsupported', uns ?? caseId, fxPos)(l, p, n, a, 'probe');
    const v = (s, n = 40, a = URLSAFE) => sec(family, s, n, a);
    const http = (body, extra = '') => `POST ${pathReq} HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/x-www-form-urlencoded\r\n${extra}\r\n`;
    const url = `https://${host}${pathReq}`;
    P('form-body-middle', [http(), `${grant}&${name}=`, v('f1'), '&scope=identity\r\n'], 'form body, value then a public parameter', ['direct-slot', 'delimiter-after']);
    P('form-body-first-eof', [http(), `${name}=`, v('f2'), `&${extraPublic}`], 'first parameter, a public parameter ends the input', ['delimiter-before', 'end-of-input']);
    P('form-body-last-eol', [http(), `${grant}&${name}=`, v('f3'), '\n'], 'last parameter, then a newline', ['delimiter-after']);
    P('form-body-last-eof', [http(), `${grant}&${name}=`, v('f4')], 'last parameter, the value ends the input', ['end-of-input', 'stream-cut']);
    P('form-body-crlf', [http(), `${grant}&${name}=`, v('f5'), '\r\n'], 'last parameter, CRLF', ['line-ending']);
    P('form-curl-d-unquoted', [`curl -X POST ${url} -d ${grant} -d ${name}=`, v('f6'), " --user 'CLIENT_ID:CLIENT_SECRET'\n"], 'curl -d, unquoted, a space ends it', ['delimiter-after']);
    P('form-curl-d-unquoted-eof', [`curl -X POST ${url} -d ${name}=`, v('f7')], 'curl -d at the end of the input', ['end-of-input']);
    P('form-curl-d-double', [`curl -s -d "${grant}&${name}=`, v('f8'), `&scope=identity" ${url}\n`], 'curl -d double-quoted body, an ampersand ends it', ['delimiter-after']);
    P('form-curl-d-double-last', [`curl -s -d "${grant}&${name}=`, v('f9'), `" ${url}\n`], 'curl -d double-quoted body, the quote ends it', ['delimiter-after']);
    P('form-curl-data-single', [`curl -s --data '${name}=`, v('f10'), `' ${url}\n`], "curl --data single-quoted, the quote ends it", ['delimiter-after']);
    P('form-curl-data-urlencode', [`curl -s --data-urlencode ${name}=`, v('f11'), ` ${url}\n`], 'curl --data-urlencode', ['delimiter-after']);
    P('form-percent-neighbours', [http(), `redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb&${name}=`, v('f12'), '&code=abc%3D\n'], 'percent-encoded public neighbours', ['neighbouring-public-field', 'delimiter-after']);
    P('form-same-shape-neighbour', [http(), `client_ref=${lit(family, 'f13a', 40, URLSAFE)}&${name}=`, v('f13'), `&request_ref=${lit(family, 'f13b', 40, URLSAFE)}\n`], 'public parameters with the value\'s alphabet and width', ['same-shape-neighbour', 'neighbouring-public-field']);
    P('form-utf8-before-after', [`# ${MB}\n${name}=`, v('f14'), `&note=${MB}\n`], 'multi-byte text before the slot and after the delimiter', ['utf8-preceding', 'utf8-following']);
    P('form-big-preceding', [`${'x'.repeat(63)}\n`.repeat(80), http(), `${name}=`, v('f15'), '\n'], 'about 5 KB first', ['big-preceding']);
    P('form-repeat', [`${name}=`, v('rep'), `&again=1\ncurl -d "${name}=`, { secret: lit(family, 'rep', 40, URLSAFE) }, '" ' + url + '\n'], 'the same value twice', ['repeat-secret']);
    P('form-neighbouring-secret', [http(), `${name}=`, v('f16'), `&client_secret=${lit(family, 'f16o', 24)}\n`], 'a different credential parameter in the same body', ['neighbouring-secret']);
    P('form-era-words', [`# archived OAuth wiki; the old flow may be retired\ncurl -X POST ${url} -d ${name}=`, v('f18'), '\n'], 'the document says the flow is archived or retired: the era never justifies silence', ['era-words']);
    for (const [slug, alpha, n] of SHAPES) P(`form-shape-${slug}`, [http(), `${grant}&${name}=`, v(`shape-${slug}`, n, alpha), '\n'], `a ${slug} value: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);

    C('form-template-word', [`curl -X POST ${url} -d ${grant} -d ${name}=TOKEN --user 'CLIENT_ID:CLIENT_SECRET'\n`], 'the documentation template word', ['near-miss-value']);
    C('form-angle-placeholder', [`${name}=<${name.replace(/_/g, '-')}>\n`], 'angle placeholder', ['near-miss-value']);
    C('form-upper-placeholder', [`${name}=YOUR_${name.toUpperCase()}\n`], 'upper-case placeholder', ['near-miss-value']);
    C('form-env-reference', [`curl -X POST ${url} -d ${grant} -d ${name}=${D}{REDDIT_TOKEN}\n`], 'shell environment reference', ['near-miss-value']);
    C('form-template-reference', [`${name}={{ secrets.${name} }}\n`], 'template reference', ['near-miss-value']);
    C('form-masked', [`${name}=********\n${name}=\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\n`], 'masked displays', ['near-miss-value']);
    C('form-empty', [http(), `${grant}&${name}=&scope=identity\n`], 'empty value', ['near-miss-value']);
    C('form-null-undefined', [`${name}=null\n${name}=undefined\n`], 'null and undefined', ['near-miss-value']);
    C('form-name-in-prose', [`Send the ${name} in the request body. See https://docs.example.test/${name}/reference.\n`], 'the field name in prose and a path', ['near-miss-name']);
    C('form-public-parameters-only', [http(), `${grant}&scope=identity&redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb\n`], 'only public parameters', ['neighbouring-public-field']);

    U('form-uppercase-name', [`${name.toUpperCase()}=`, v('u1'), '\n'], 'upper-case field name', ['representation']);
    U('form-prefixed-name', [`old_${name}=`, v('u2'), '\n'], 'a prefixed field name', ['glued-name', 'representation']);
    U('form-suffixed-name', [`${name}_hint=`, v('u3'), '\n'], 'a suffixed field name', ['glued-name']);
    U('form-below-eight', [`${name}=`, v('u4', 6), '\n'], 'a 6-byte value: no Case states a width floor', ['near-miss-value']);
    U('form-percent-value', [`${name}=${lit(family, 'u5a', 14)}%2B${lit(family, 'u5b', 10)}%3D&x=1\n`], 'a percent-containing value', ['representation']);
    U('form-newline-value', [`${name}=\n`, v('u6'), '\n'], 'the value on the next line', ['representation']);
    U('form-other-path', [`POST /api/v1/unrelated HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\n${name}=`, v('u7'), '\n'], 'the same field on a path the Case does not name', ['near-miss-name']);
    U('form-spaced-assignment', [`${name} = "`, v('f17'), '"\n'], 'a spaced quoted assignment of the same field name: not a request-body field', ['delimiter-before', 'representation']);
    U('form-json-body', [`{"${name}":"`, v('u8'), '"}\n'], 'the same name in a JSON request body: not the carrier the Case names', ['representation']);
    U('form-secret-shaped-public-name', [`client_ref=${lit(family, 'u9', 40, URLSAFE)}&request_ref=${lit(family, 'u9b', 40, URLSAFE)}\n`], 'secret-shaped values under other names: no Case asserts them benign', ['same-shape-neighbour', 'near-miss-name']);
  };

  const redditHost = 'www.reddit.example.test';
  formRow('reddit:oauth-refresh-token', {
    name: 'refresh_token', pathReq: '/api/v1/access_token', grant: 'grant_type=refresh_token', host: redditHost, extraPublic: 'grant_type=refresh_token',
    caseId: 'reddit-oauth-refresh-token-response-member-and-request-field', ctlCase: 'reddit-oauth-documentation-template-words-references-and-non-values', uns: 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled',
    fxPos: 'reddit-authored--refresh-raw-http-form-request', fxCtl: 'reddit-authored--non-value-refresh-token-template-word', families: ['reddit:oauth-refresh-token'],
  });
  // revocation: the shared `token` slot of both token rows (one case set, both families recorded)
  formRow('reddit:oauth-access-token', {
    name: 'token', pathReq: '/api/v1/revoke_token', grant: 'token_type_hint=access_token', host: redditHost, extraPublic: 'token_type_hint=access_token',
    caseId: 'reddit-oauth-revoke-token-request-body-token-field', ctlCase: 'reddit-oauth-documentation-template-words-references-and-non-values', uns: 'reddit-oauth-revoke-token-request-body-token-field',
    fxPos: 'reddit-authored--revoke-raw-http-form-request-no-hint', fxCtl: 'reddit-authored--non-value-revocation-success-response', families: ['reddit:oauth-access-token', 'reddit:oauth-refresh-token'],
  });

  // ======================================================= JSON response member (reddit) =======================================================
  memberRow('reddit:oauth-access-token', {
    name: 'access_token', sibs: s => [['token_type', 'bearer'], ['scope', 'identity']], era: 'archived OAuth wiki example',
    caseIds: { pos: 'reddit-oauth-access-token-response-member', ctl: 'reddit-oauth-documentation-template-words-references-and-non-values', uns: 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled' },
    fx: { pos: 'reddit-authored--access-response-pretty-json-response', ctl: 'reddit-authored--non-value-access-token-angle-placeholder', uns: 'reddit-authored--unsettled-bare-access-token-like-value' },
    expiresNote: 'an expires_in beside the member: its unit is unresolved in the evidence, so no Case asserts a response that carries it',
  });
  memberRow('reddit:oauth-refresh-token', {
    name: 'refresh_token', sibs: s => [['token_type', 'bearer'], ['scope', 'identity']], era: 'archived OAuth wiki example',
    caseIds: { pos: 'reddit-oauth-refresh-token-response-member-and-request-field', ctl: 'reddit-oauth-documentation-template-words-references-and-non-values', uns: 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled' },
    fx: { pos: 'reddit-authored--refresh-pretty-json-response', ctl: 'reddit-authored--non-value-refresh-token-masked-display', uns: 'reddit-authored--unsettled-bare-refresh-token-like-value' },
    expiresNote: 'an expires_in beside the member: its unit is unresolved in the evidence, so no Case asserts a response that carries it',
  });

  // ======================================================= URL fragment (reddit access_token, implicit flow) =======================================================
  {
    const family = 'reddit:oauth-access-token';
    const P = dir.positive(family, 'reddit-oauth-access-token-bearer-header-and-redirect-fragment', 'reddit-authored--access-carrier-redirect-fragment');
    const C = dir.control(family, 'reddit-oauth-documentation-template-words-references-and-non-values', 'reddit-authored--non-value-access-token-angle-placeholder');
    const U = dir.unsupported(family, 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled', 'reddit-authored--unsettled-bare-access-token-like-value');
    const v = (s, n = 40, a = URLSAFE) => sec(family, s, n, a);
    const cb = 'https://client.example.test/callback';
    P('fragment-redirect-first', ['Location: ' + cb + '#access_token=', v('g1'), '&token_type=bearer&scope=identity&state=SYNTHETICSTATE0001\r\n'], 'a redirect fragment, the value first', ['direct-slot', 'delimiter-after']);
    P('fragment-state-first', [cb + '#state=SYNTHETICSTATE0001&access_token=', v('g2'), '&token_type=bearer&scope=identity\n'], 'a public parameter first', ['delimiter-before', 'delimiter-after']);
    P('fragment-last-eof', [cb + '#token_type=bearer&scope=identity&access_token=', v('g3')], 'last fragment parameter, end of input', ['end-of-input', 'stream-cut']);
    P('fragment-html-href', ['<a href="' + cb + '#access_token=', v('g4'), '&token_type=bearer">continue</a>\n'], 'inside an HTML href, an ampersand ends it', ['nesting', 'delimiter-after']);
    P('fragment-html-href-quote', ['<a href="' + cb + '#access_token=', v('g5'), '">continue</a>\n'], 'the closing quote of the href ends it', ['nesting', 'delimiter-after']);
    P('fragment-log-line-crlf', ['[2026-10-06T10:00:00Z] redirect ' + cb + '#access_token=', v('g6'), '&token_type=bearer 302\r\n'], 'a log line with CRLF', ['line-ending']);
    P('fragment-same-shape-neighbour', [cb + '#state=' + lit(family, 'g7a', 40, URLSAFE) + '&access_token=', v('g7'), '&session=' + lit(family, 'g7b', 40, URLSAFE) + '\n'], 'public parameters with the value\'s alphabet and width', ['same-shape-neighbour']);
    P('fragment-utf8', [`# ${MB}\n${cb}#access_token=`, v('g8'), `&note=${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
    P('fragment-curl-url', ['curl -L "' + cb + '#access_token=', v('g9'), '"\n'], 'a quoted URL on a command line', ['delimiter-after']);
    P('fragment-repeat', [cb + '#access_token=', v('rep'), '&token_type=bearer\nvisited ' + cb + '#access_token=', { secret: lit(family, 'rep', 40, URLSAFE) }, '\n'], 'the same value twice', ['repeat-secret']);
    P('fragment-era-words', ['# archived OAuth wiki implicit flow\n' + cb + '#access_token=', v('g10'), '&token_type=bearer\n'], 'the era never justifies silence', ['era-words']);
    for (const [slug, alpha, n] of SHAPES) P(`fragment-shape-${slug}`, [cb + '#access_token=', v(`shape-${slug}`, n, alpha), '&token_type=bearer&scope=identity\n'], `a ${slug} value: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);
    C('fragment-template-word', [cb + '#access_token=TOKEN&token_type=bearer\n'], 'documentation template word', ['near-miss-value']);
    C('fragment-angle-placeholder', [cb + '#access_token=<access_token>&token_type=bearer\n'], 'angle placeholder', ['near-miss-value']);
    C('fragment-env-reference', [cb + '#access_token=' + D + '{REDDIT_ACCESS_TOKEN}&token_type=bearer\n'], 'environment reference', ['near-miss-value']);
    C('fragment-masked', [cb + '#access_token=********&token_type=bearer\n'], 'masked display', ['near-miss-value']);
    C('fragment-empty', [cb + '#access_token=&token_type=bearer\n'], 'empty value', ['near-miss-value']);
    C('fragment-public-only', [cb + '#token_type=bearer&scope=identity&state=SYNTHETICSTATE0001\n'], 'only public fragment parameters', ['neighbouring-public-field']);
    U('fragment-query-position', [cb + '?access_token=', v('u1'), '&token_type=bearer\n'], 'the same name in the query, not the fragment: not the carrier the Case names', ['representation']);
    U('fragment-prefixed-name', [cb + '#old_access_token=', v('u2'), '\n'], 'a prefixed name', ['glued-name', 'representation']);
    U('fragment-below-eight', [cb + '#access_token=', v('u3', 6), '\n'], 'a 6-byte value: no Case states a width floor', ['near-miss-value']);
  }

  // ======================================================= Authorization header (jfrog art-api, reddit bearer, zendesk Basic) =======================================================
  /**
   * cfg.header: the header name; cfg.prefix: text between the colon-space and the value; cfg.val(slug, shape) the value part;
   * cfg.hostLine: Host header; cfg.target: the request target; cfg.curlUrl.
   */
  const headerRow = (family, cfg) => {
    const { header, prefix, val, host, target, caseIds, fx, ctls, uns, needHost = false } = cfg;
    const HL = needHost ? `Host: ${host}\r\n` : ''; // the Case attributes the bare bearer value by the header AND the host
    const P = dir.positive(family, caseIds.pos, fx.pos);
    const C = dir.control(family, caseIds.ctl, fx.ctl);
    const U = dir.unsupported(family, caseIds.uns, fx.uns);
    const h = `${header}: ${prefix}`;
    const url = `https://${host}${target}`;
    P('header-raw-http-crlf', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\n${h}`, val('h1'), '\r\nAccept: application/json\r\n\r\n'], 'raw header then CRLF', ['direct-slot', 'delimiter-after']);
    P('header-raw-http-lf', [`GET ${target} HTTP/1.1\nHost: ${host}\n${h}`, val('h2'), '\n'], 'raw header, LF line ends, last line', ['delimiter-after', 'line-ending']);
    P('header-eof', [`GET ${target} HTTP/1.1\r\n${HL}${h}`, val('h3')], 'the value is the last bytes of the input', ['end-of-input', 'stream-cut']);
    P('header-curl-double', [`curl -H "${h}`, val('h4'), `" ${url}\n`], 'double-quoted curl -H, the closing quote ends it', ['delimiter-after']);
    P('header-curl-single', [`curl -H '${h}`, val('h5'), `' ${url}\n`], 'single-quoted curl -H', ['delimiter-after']);
    P('header-curl-long-option', [`curl --header "${h}`, val('h6'), `" ${url}\n`], 'curl --header', ['delimiter-after']);
    P('header-json-map', [`{"headers":{"Accept":"application/json","${header}":"${prefix}`, val('h7'), '","X-Id":"1"}}\n'], 'JSON header map, a quote and comma end it', ['nesting', 'delimiter-after']);
    P('header-json-map-spaced', [`{ "headers" : { "${header}" : "${prefix}`, val('h8'), '" } }\n'], 'JSON with spaces around colons', ['delimiter-before', 'nesting']);
    P('header-json-pretty-crlf', [`{\r\n\t"headers": {\r\n\t\t"${header}": "${prefix}`, val('h9'), '",\r\n\t\t"Accept": "application/json"\r\n\t}\r\n}\r\n'], 'pretty JSON header map, CRLF and tabs', ['line-ending', 'nesting']);
    P('header-yaml-map', [`headers:\n  Accept: application/json\n  ${header}: "${prefix}`, val('h10'), '"\n'], 'YAML header map, quoted', ['nesting', 'delimiter-after']);
    P('header-trailing-whitespace', [`${HL}${h}`, val('h11'), '   \t\r\n'], 'trailing spaces and a tab', ['line-ending', 'delimiter-after']);
    P('header-utf8-before-after', [`// ${MB}\nGET ${target} HTTP/1.1\r\n${HL}${h}`, val('h12'), `\r\nX-Note: ${MB}\r\n\r\n`], 'multi-byte text before the header and after the value', ['utf8-preceding', 'utf8-following']);
    P('header-big-preceding', [`${'y'.repeat(63)}\n`.repeat(80), HL + h, val('h13'), '\r\n'], 'about 5 KB first', ['big-preceding']);
    P('header-repeat', [HL + h, val('rep'), `\r\n\r\ncurl -H "${h}`, { secret: val('rep').secret }, `" ${url}\n`], 'the same value twice', ['repeat-secret']);
    P('header-neighbouring-secret', [HL + h, val('h14'), `\r\nX-Api-Key: ${lit(family, 'h14o', 24)}\r\nCookie: sid=${lit(family, 'h14c', 24, HEX)}\r\n`], 'other credentials in neighbouring headers', ['neighbouring-secret']);
    P('header-same-shape-neighbour', [`X-Request-Id: ${lit(family, 'h15a', 36)}\r\n${HL}${h}`, val('h15'), `\r\nX-Trace: ${lit(family, 'h15b', 36)}\r\n`], 'same-shape public header values on both sides', ['same-shape-neighbour']);
    P('header-after-other-headers', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: example/1.0\r\nAccept: */*\r\n${h}`, val('h16'), '\r\nConnection: close\r\n\r\n'], 'after several public headers', ['delimiter-before', 'neighbouring-public-field']);
    P('header-era-words', [`# retired, deprecated credential kept in an old script\ncurl -H "${h}`, val('h17'), `" ${url}\n`], 'the era never justifies silence', ['era-words']);
    P('header-era-words-after', [`curl -H "${h}`, val('h18'), `" ${url} # legacy\n`], 'an era remark after the command', ['era-words', 'delimiter-after']);
    for (const [slug, alpha, n] of SHAPES) P(`header-shape-${slug}`, [`GET ${target} HTTP/1.1\r\n${HL}${h}`, val(`shape-${slug}`, n, alpha, slug), '\r\n\r\n'], `a ${slug} value: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);
    for (const [layout, parts, note, axes] of ctls) C(layout, parts, note, axes);
    for (const [layout, parts, note, axes, d] of uns(U, val)) U(layout, parts, note, axes, d);
  };

  // ---- jfrog: X-JFrog-Art-API header and the Basic password
  {
    const family = 'jfrog:api-key';
    const host = 'example-host.jfrog.example.test';
    const target = '/artifactory/api/system/ping';
    const valFn = (slug, n, alpha) => sec(family, slug, n ?? 36, alpha ?? ALNUM);
    const url = `https://${host}${target}`;
    const ctls = [
      ['header-name-only-empty', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nX-JFrog-Art-API:\r\n\r\n`], 'the header name with no value', ['near-miss-value']],
      ['header-angle-placeholder', [`curl -H "X-JFrog-Art-API: <YOUR_API_KEY>" ${url}\n`], 'angle placeholder', ['near-miss-value']],
      ['header-upper-placeholder', [`curl -H "X-JFrog-Art-API: YOUR_API_KEY" ${url}\n`], 'upper-case placeholder', ['near-miss-value']],
      ['header-env-reference', [`curl -H "X-JFrog-Art-API: ${D}{JFROG_API_KEY}" ${url}\n`], 'environment reference with braces', ['near-miss-value']],
      ['header-env-reference-bare', [`curl -H "X-JFrog-Art-API: ${D}JFROG_API_KEY" ${url}\n`], 'environment reference without braces', ['near-miss-value']],
      ['header-template-reference', [`{"headers":{"X-JFrog-Art-API":"{{ secrets.JFROG_API_KEY }}"}}\n`], 'template reference', ['near-miss-value']],
      ['header-masked-stars', [`curl -H "X-JFrog-Art-API: ********************" ${url}\n`], 'masked display', ['near-miss-value']],
      ['header-masked-json-apikey', [`{\n  "apiKey": "********"\n}\n`], 'a masked apiKey member', ['near-miss-value']],
      ['header-name-in-prose', ['Send the key in the X-JFrog-Art-API header; do not log it.\n'], 'the header name in prose', ['near-miss-name']],
      ['basic-username-only', [`curl -u example-user ${url}\n`], 'a username with no password', ['near-miss-value']],
      ['basic-username-colon-empty', [`curl -u example-user: ${url}\n`], 'a username and colon with an empty password', ['near-miss-value']],
      ['basic-angle-placeholder', [`curl -u example-user:<API_KEY> ${url}\n`], 'angle placeholder as the password', ['near-miss-value']],
      ['basic-env-reference', [`curl -u example-user:${D}{JFROG_API_KEY} ${url}\n`], 'environment reference as the password', ['near-miss-value']],
      ['basic-masked', [`curl -u example-user:******** ${url}\n`], 'masked password', ['near-miss-value']],
      ['documented-pattern-prose-regex', ['The pattern for an API key is .*\\bAKCp[A-Za-z0-9]{69}\\b.* in the reference.\n'], 'the documented pattern quoted as prose, no value', ['near-miss-name']],
      ['documented-pattern-prose-words', ['An API key is written as the four characters AKCp followed by 69 alphanumeric characters, 73 in all.\n'], 'the documented pattern described in words, no value', ['near-miss-name']],
    ];
    const uns = (U, val2) => {
      const bare = (slug, n, a) => lit(family, `u:${slug}`, n, a);
      const akcp = bare('akcp', 69, ALNUM); // 'AKCp' + 69 alphanumerics: assembled at run time
      const akcp8 = `8${bare('akcp8', 68, ALNUM)}`;
      const b64ish = bare('b64', 41, ALNUM) + '+/=' ; // 44 characters with base64 punctuation, no AKCp prefix
      const forms = [['akcp69', `AKCp${akcp}`], ['akcp8-73', `AKCp${akcp8}`], ['b64-44', b64ish]];
      const out = [];
      for (const [slug, value] of forms) {
        out.push([`probe-${slug}-bare-prose`, [`Key to rotate: ${value}\n`], `a ${slug} bare value in prose: the two JFrog statements of the form are unreconciled`, ['probe-vendor-shaped', 'near-miss-name'], 'unsettled-case']);
        out.push([`probe-${slug}-bare-line`, [`${value}\n`], `a ${slug} bare value alone on a line`, ['probe-vendor-shaped', 'near-miss-name'], 'unsettled-case']);
        out.push([`probe-${slug}-json-apikey`, [`{\n  "apiKey": "${value}"\n}\n`], `a ${slug} value as the apiKey member of a create-key style response`, ['probe-vendor-shaped', 'near-miss-name']]);
        out.push([`probe-${slug}-in-header-slot`, [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nX-JFrog-Art-API: ${value}\r\n\r\n`], `a ${slug} value in the documented header: observed, never scored`, ['probe-vendor-shaped', 'direct-slot']]);
        out.push([`probe-${slug}-in-basic-password`, [`curl -u example-user:${value} ${url}\n`], `a ${slug} value as the Basic password: observed, never scored`, ['probe-vendor-shaped', 'direct-slot']]);
      }
      out.push(['header-name-lowercase', [`GET ${target} HTTP/1.1\r\nhost: ${host}\r\nx-jfrog-art-api: `, val2('u1', 36)], 'lower-case header name', ['representation']]);
      out.push(['header-prefixed-name', [`X-Forwarded-X-JFrog-Art-API: `, val2('u2', 36), '\r\n'], 'a prefixed header name', ['glued-name', 'representation']]);
      out.push(['header-no-space', [`X-JFrog-Art-API:`, val2('u3', 36), '\r\n'], 'no space after the colon', ['representation']]);
      out.push(['header-value-on-next-line', ['X-JFrog-Art-API:\r\n', val2('u4', 36), '\r\n'], 'the value on the next line', ['representation']]);
      out.push(['header-below-eight', ['X-JFrog-Art-API: ', val2('u5', 6), '\r\n'], 'a 6-byte value: no Case states a width floor', ['near-miss-value']]);
      out.push(['header-python-dict', [`requests.get("${url}", headers={'X-JFrog-Art-API': '`, val2('u6', 36), "'})\n"], 'a Python dictionary literal', ['representation', 'nesting']]);
      out.push(['basic-encoded-header', [`Authorization: Basic ${b64(`example-user:${lit(family, 'u:enc', 36)}`)}\r\n`], 'a base64 Basic header: JFrog states no encoding step in the pinned evidence', ['representation']]);
      out.push(['basic-url-userinfo', [`curl https://example-user:`, val2('u7', 36), `@${host}${target}\n`], 'URL userinfo form: not a carrier the Case names', ['representation']]);
      out.push(['basic-long-option-user', [`curl --user example-user:`, val2('u8', 36), ` ${url}\n`], 'curl --user: the Case names the password position, the option spelling is unstated', ['representation']]);
      out.push(['secret-shaped-public-header', [`X-Request-Id: ${lit(family, 'u9', 36)}\r\nETag: "${lit(family, 'u9b', 36)}"\r\n`], 'secret-shaped values under public header names: no Case asserts them benign', ['same-shape-neighbour', 'near-miss-name']]);
      return out;
    };
    headerRow(family, {
      header: 'X-JFrog-Art-API', prefix: '', host, target, val: valFn, ctls, uns,
      caseIds: { pos: 'jfrog-api-key-header-and-basic-password-value', ctl: 'jfrog-api-key-lookalikes-and-non-values', uns: 'jfrog-api-key-bare-value-and-format-conflict-unsettled' },
      fx: { pos: 'jfrog-authored--api-key-raw-http-art-api-header', ctl: 'jfrog-authored--api-key-lookalike-header-name-only', uns: 'jfrog-authored--api-key-bare-value-in-prose' },
    });
    const P = dir.positive(family, 'jfrog-api-key-header-and-basic-password-value', 'jfrog-authored--api-key-curl-basic-password');
    const v = (s, n = 36, a = ALNUM) => sec(family, s, n, a);
    P('header-mixed-case-name', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nX-JFrog-Art-Api: `, v('hm1'), '\r\n\r\n'], 'the header spelled X-JFrog-Art-Api, as the reference page writes it', ['direct-slot', 'delimiter-after']);
    P('header-mixed-case-name-curl', [`curl -H "X-JFrog-Art-Api: `, v('hm2'), `" ${url}\n`], 'the same spelling in curl -H', ['delimiter-after']);
    P('basic-curl-u-unquoted', [`curl -u example-user:`, v('b1'), ` ${url}\n`], 'curl -u, unquoted, a space ends it', ['direct-slot', 'delimiter-after']);
    P('basic-curl-u-eof', [`curl ${url} -u example-user:`, v('b2')], 'curl -u at the end of the input', ['end-of-input', 'stream-cut']);
    P('basic-curl-u-double', [`curl -u "example-user:`, v('b3'), `" ${url}\n`], 'curl -u, double-quoted', ['delimiter-after']);
    P('basic-curl-u-single', [`curl -u 'example-user:`, v('b4'), `' ${url}\n`], 'curl -u, single-quoted', ['delimiter-after']);
    P('basic-curl-u-after-url', [`curl ${url} -u example-user:`, v('b5'), ' -X GET\n'], 'curl -u after the URL, a space then another option', ['delimiter-after']);
    P('basic-curl-u-continuation', [`curl -u example-user:`, v('b6'), ` \\\n  ${url}\n`], 'curl -u, a backslash continuation follows', ['delimiter-after', 'line-ending']);
    P('basic-curl-u-crlf', [`curl -u example-user:`, v('b7'), ` ${url}\r\n`], 'curl -u, CRLF', ['line-ending']);
    P('basic-curl-u-utf8', [`# ${MB}\ncurl -u example-user:`, v('b8'), ` ${url} # ${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
    P('basic-curl-u-big-preceding', [`${'z'.repeat(63)}\n`.repeat(80), `curl -u example-user:`, v('b9'), ` ${url}\n`], 'about 5 KB first', ['big-preceding']);
    P('basic-curl-u-same-shape-user', [`curl -u ${lit(family, 'b10u', 36)}:`, v('b10'), ` ${url}\n`], 'a username with the password\'s alphabet and width', ['same-shape-neighbour']);
    P('basic-curl-u-repeat', [`curl -u example-user:`, v('rep2'), ` ${url}\ncurl -u example-user:`, { secret: lit(family, 'rep2', 36) }, ` ${url}\n`], 'the same password twice', ['repeat-secret']);
    P('basic-curl-u-era-words', [`# the old API key, deprecated by the vendor\ncurl -u example-user:`, v('b11'), ` ${url}\n`], 'the era never justifies silence', ['era-words']);
    for (const [slug, alpha, n] of SHAPES) P(`basic-shape-${slug}`, [`curl -u example-user:`, v(`bshape-${slug}`, n, alpha), ` ${url}\n`], `a ${slug} password: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);
  }

  // ---- reddit access token: bearer header to oauth.reddit.com
  {
    const family = 'reddit:oauth-access-token';
    const host = 'oauth.reddit.com';
    const target = '/api/v1/scopes';
    const url = `https://${host}${target}`;
    const valFn = (slug, n, alpha) => sec(family, `bearer:${slug}`, n ?? 40, alpha ?? URLSAFE);
    const ctls = [
      ['bearer-template-word', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nAuthorization: bearer TOKEN\r\n\r\n`], 'the documentation template word', ['near-miss-value']],
      ['bearer-template-word-curl', [`curl -H "Authorization: bearer TOKEN" ${url}\n`], 'the template word in curl', ['near-miss-value']],
      ['bearer-angle-placeholder', [`curl -H "Authorization: bearer <access_token>" ${url}\n`], 'angle placeholder', ['near-miss-value']],
      ['bearer-upper-placeholder', [`curl -H "Authorization: bearer YOUR_ACCESS_TOKEN" ${url}\n`], 'upper-case placeholder', ['near-miss-value']],
      ['bearer-env-reference', [`curl -H "Authorization: bearer ${D}{REDDIT_ACCESS_TOKEN}" ${url}\n`], 'environment reference with braces', ['near-miss-value']],
      ['bearer-env-reference-bare', [`curl -H "Authorization: bearer ${D}REDDIT_ACCESS_TOKEN" ${url}\n`], 'environment reference without braces', ['near-miss-value']],
      ['bearer-template-reference', [`{"headers":{"Authorization":"bearer {{ secrets.reddit_token }}"}}\n`], 'template reference', ['near-miss-value']],
      ['bearer-masked', [`Authorization: bearer ********************\r\n`], 'masked display', ['near-miss-value']],
      ['bearer-empty', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nAuthorization: bearer\r\n\r\n`], 'the scheme with no value', ['near-miss-value']],
      ['bearer-prose', ['Send the token in an Authorization header with the bearer scheme to oauth.reddit.com.\n'], 'the scheme named in prose', ['near-miss-name']],
    ];
    const uns = (U, val2) => {
      const out = [];
      const n = lit(family, 'vendor:n', 8, DIGITS);
      const bare = `${n}-${lit(family, 'vendor:t', 27, URLSAFE)}`; // <digits>-<27 url-safe>: a shape assembled at run time, never a Case claim
      out.push(['probe-vendor-bare-prose', [`Last token: ${bare}\n`], 'a digits-dash-token shaped bare value in prose', ['probe-vendor-shaped', 'near-miss-name'], 'unsettled-case']);
      out.push(['probe-vendor-bare-line', [`${bare}\n`], 'a digits-dash-token shaped bare value alone on a line', ['probe-vendor-shaped', 'near-miss-name'], 'unsettled-case']);
      out.push(['probe-vendor-in-bearer-slot', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nAuthorization: bearer ${bare}\r\n\r\n`], 'a digits-dash-token shaped value in the documented bearer slot: observed, never scored', ['probe-vendor-shaped', 'direct-slot']]);
      out.push(['probe-vendor-in-member-slot', [`{"access_token":"${bare}","token_type":"bearer","scope":"identity"}\n`], 'a digits-dash-token shaped value in the response member: observed, never scored', ['probe-vendor-shaped', 'direct-slot']]);
      out.push(['bearer-capital-scheme', [`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Bearer `, val2('u1', 40), '\r\n\r\n'], 'a capitalised scheme: the Case spells it lower-case', ['representation']]);
      out.push(['bearer-other-host', [`GET ${target} HTTP/1.1\r\nHost: api.example.test\r\nAuthorization: bearer `, val2('u2', 40), '\r\n\r\n'], 'a bearer header to a host the Case does not name', ['near-miss-name']]);
      out.push(['bearer-below-eight', ['Authorization: bearer ', val2('u3', 6), '\r\n'], 'a 6-byte value: no Case states a width floor', ['near-miss-value']]);
      out.push(['bearer-no-space', ['Authorization:bearer ', val2('u4', 40), '\r\n'], 'no space after the colon', ['representation']]);
      out.push(['bearer-prefixed-header', ['X-Forwarded-Authorization: bearer ', val2('u5', 40), '\r\n'], 'a prefixed header name', ['glued-name', 'representation']]);
      out.push(['bearer-newline-between', ['Authorization: bearer\r\n', val2('u6', 40), '\r\n'], 'the value on the next line', ['representation']]);
      out.push(['secret-shaped-public-header', [`X-Request-Id: ${lit(family, 'u7', 40, URLSAFE)}\r\nETag: "${lit(family, 'u7b', 40, URLSAFE)}"\r\n`], 'secret-shaped values under public header names: no Case asserts them benign', ['same-shape-neighbour', 'near-miss-name']]);
      return out;
    };
    headerRow(family, {
      header: 'Authorization', prefix: 'bearer ', host, target, val: valFn, ctls, uns, needHost: true,
      caseIds: { pos: 'reddit-oauth-access-token-bearer-header-and-redirect-fragment', ctl: 'reddit-oauth-documentation-template-words-references-and-non-values', uns: 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled' },
      fx: { pos: 'reddit-authored--access-carrier-bearer-raw-http', ctl: 'reddit-authored--non-value-bearer-template-word', uns: 'reddit-authored--unsettled-bare-access-token-like-value' },
    });
  }

  // ---- reddit refresh token: bare and vendor-shaped probes (no Case asserts a bare value)
  {
    const family = 'reddit:oauth-refresh-token';
    const U = dir.unsupported(family, 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled', 'reddit-authored--unsettled-bare-refresh-token-like-value', 'unsettled-case');
    const n = lit(family, 'vendor:n', 8, DIGITS);
    const bare = `${n}-${lit(family, 'vendor:t', 27, URLSAFE)}`;
    U('probe-vendor-bare-prose', ['Permanent token: ' + bare + '\n'], 'a digits-dash-token shaped bare value in prose', ['probe-vendor-shaped', 'near-miss-name']);
    U('probe-vendor-bare-line', [bare + '\n'], 'a digits-dash-token shaped bare value alone on a line', ['probe-vendor-shaped', 'near-miss-name']);
    U('probe-vendor-in-member-slot', ['{"refresh_token":"' + bare + '","token_type":"bearer","scope":"identity"}\n'], 'a digits-dash-token shaped value in the response member: observed, never scored', ['probe-vendor-shaped', 'direct-slot'], 'probe');
    U('probe-vendor-in-form-slot', ['grant_type=refresh_token&refresh_token=' + bare + '\n'], 'a digits-dash-token shaped value in the request field: observed, never scored', ['probe-vendor-shaped', 'direct-slot'], 'probe');
    U('bare-prose-plain', ['Permanent token: ', sec(family, 'bare1', 40, URLSAFE), '\n'], 'a bare value with no carrier', ['near-miss-name']);
    U('bare-eof', ['REFRESH=', sec(family, 'bare2', 40, URLSAFE)], 'a bare value after an assignment of another name, at the end of the input', ['near-miss-name', 'end-of-input']);
  }

  // ======================================================= reddit client secret: the Basic password beside the client id =======================================================
  {
    const family = 'reddit:app-client-secret';
    const P = dir.positive(family, 'reddit-app-client-secret-basic-password', 'reddit-authored--secret-curl-user-code-flow');
    const C = dir.control(family, 'reddit-oauth-documentation-template-words-references-and-non-values', 'reddit-authored--non-value-basic-user-template-words');
    const U = dir.unsupported(family, 'reddit-oauth-bare-values-and-encoded-basic-header-unsettled', 'reddit-authored--unsettled-bare-client-secret-like-value');
    const Ui = dir.unsupported(family, 'reddit-installed-app-non-empty-basic-password-unsettled', 'reddit-authored--installed-installed-client-non-empty-password', 'unsettled-case');
    const url = 'https://www.reddit.example.test/api/v1/access_token';
    const cid = s => lit(family, `cid:${s}`, 22, URLSAFE);
    const sv = (s, n = 30, a = URLSAFE) => sec(family, s, n, a);
    const data = "-d 'grant_type=authorization_code&code=CODE&redirect_uri=URI'";
    P('basic-user-single', [`curl -X POST ${url} ${data} --user '${cid('s1')}:`, sv('s1'), "'\n"], 'curl --user single-quoted: the secret after the colon', ['direct-slot', 'delimiter-after']);
    P('basic-user-double', [`curl -X POST ${url} ${data} --user "${cid('s2')}:`, sv('s2'), '"\n'], 'curl --user double-quoted', ['delimiter-after']);
    P('basic-user-unquoted', [`curl -X POST ${url} ${data} --user ${cid('s3')}:`, sv('s3'), '\n'], 'curl --user unquoted, the line end ends it', ['delimiter-after']);
    P('basic-u-unquoted-space', [`curl -X POST ${url} -u ${cid('s4')}:`, sv('s4'), ' -d grant_type=client_credentials\n'], 'curl -u unquoted, a space ends it', ['delimiter-after']);
    P('basic-u-single', [`curl -X POST ${url} -d grant_type=client_credentials -u '${cid('s5')}:`, sv('s5'), "'\n"], 'curl -u single-quoted', ['delimiter-after']);
    P('basic-u-eof', [`curl -X POST ${url} -d grant_type=client_credentials -u ${cid('s6')}:`, sv('s6')], 'curl -u at the end of the input', ['end-of-input', 'stream-cut']);
    P('basic-u-before-data', [`curl -u ${cid('s7')}:`, sv('s7'), ` -X POST ${url} -d grant_type=client_credentials\n`], 'the option before the URL', ['delimiter-after', 'delimiter-before']);
    P('basic-user-revocation', [`curl -X POST https://www.reddit.example.test/api/v1/revoke_token -d token=TOKEN --user '${cid('s8')}:`, sv('s8'), "'\n"], 'the revocation endpoint', ['delimiter-after']);
    P('basic-user-refresh', [`curl -X POST ${url} -d grant_type=refresh_token -d refresh_token=TOKEN --user '${cid('s9')}:`, sv('s9'), "'\n"], 'the refresh request', ['delimiter-after']);
    P('basic-user-continuation', [`curl -X POST ${url} \\\n  -d grant_type=client_credentials \\\n  --user '${cid('s10')}:`, sv('s10'), "'\n"], 'a multi-line command with backslash continuations', ['line-ending', 'delimiter-after']);
    P('basic-user-crlf', [`curl -X POST ${url} -d grant_type=client_credentials -u ${cid('s11')}:`, sv('s11'), '\r\n'], 'CRLF', ['line-ending']);
    P('basic-user-utf8', [`# ${MB}\ncurl -X POST ${url} -u ${cid('s12')}:`, sv('s12'), ` # ${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
    P('basic-user-big-preceding', [`${'z'.repeat(63)}\n`.repeat(80), `curl -X POST ${url} -u ${cid('s13')}:`, sv('s13'), '\n'], 'about 5 KB first', ['big-preceding']);
    P('basic-user-same-shape-id', [`curl -X POST ${url} -u ${lit(family, 's14id', 30, URLSAFE)}:`, sv('s14'), ' -d grant_type=client_credentials\n'], 'a client id with the secret\'s alphabet and width beside it', ['same-shape-neighbour', 'neighbouring-public-field']);
    P('basic-user-same-shape-data', [`curl -X POST ${url} -d code=${lit(family, 's15c', 30, URLSAFE)} -u ${cid('s15')}:`, sv('s15'), '\n'], 'a same-shape public data field before it', ['same-shape-neighbour']);
    P('basic-user-repeat', [`curl -u ${cid('rep')}:`, sv('rep'), ` ${url}\ncurl -u ${cid('rep')}:`, { secret: lit(family, 'rep', 30, URLSAFE) }, ` ${url}\n`], 'the same secret twice', ['repeat-secret']);
    P('basic-user-neighbouring-secret', [`curl -u ${cid('s16')}:`, sv('s16'), ` -H "X-Api-Key: ${lit(family, 's16o', 24)}" ${url}\n`], 'a second credential in the same command', ['neighbouring-secret']);
    P('basic-user-era-words', [`# archived OAuth wiki example for script apps\ncurl -X POST ${url} -u ${cid('s17')}:`, sv('s17'), '\n'], 'the era never justifies silence', ['era-words']);
    for (const [slug, alpha, n] of SHAPES) P(`basic-shape-${slug}`, [`curl -X POST ${url} -u ${cid('shape')}:`, sv(`shape-${slug}`, n, alpha), '\n'], `a ${slug} secret: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);
    C('basic-template-words-u', [`curl -X POST ${url} -u CLIENT_ID:CLIENT_SECRET -d grant_type=client_credentials\n`], 'the documentation template words, unquoted', ['near-miss-value']);
    C('basic-template-words-double', [`curl -X POST ${url} --user "CLIENT_ID:CLIENT_SECRET"\n`], 'the template words, double-quoted', ['near-miss-value']);
    C('basic-env-reference-bare', [`curl -X POST ${url} --user ${D}REDDIT_CLIENT_ID:${D}REDDIT_CLIENT_SECRET\n`], 'environment references without braces', ['near-miss-value']);
    C('basic-env-reference-secret-only', [`curl -X POST ${url} -u CLIENT_ID:${D}{REDDIT_CLIENT_SECRET}\n`], 'a literal id and an environment reference as the secret', ['near-miss-value']);
    C('basic-angle-placeholder', [`curl -X POST ${url} --user 'CLIENT_ID:<client_secret>'\n`], 'angle placeholder as the secret', ['near-miss-value']);
    C('basic-upper-placeholder', [`curl -X POST ${url} --user 'CLIENT_ID:YOUR_CLIENT_SECRET'\n`], 'upper-case placeholder as the secret', ['near-miss-value']);
    C('basic-masked', [`curl -X POST ${url} --user 'CLIENT_ID:********'\n`], 'masked secret', ['near-miss-value']);
    C('basic-installed-empty-password-u', [`curl -X POST ${url} -d 'grant_type=https://oauth.reddit.com/grants/installed_client&device_id=DO_NOT_TRACK_THIS_DEVICE' -u 'CLIENT_ID:'\n`], 'an installed-app request with an empty password', ['near-miss-value']);
    C('basic-id-only', [`curl -X POST ${url} -u CLIENT_ID -d grant_type=client_credentials\n`], 'a client id with no colon and no secret', ['near-miss-value']);
    C('basic-device-id-literal', [`device_id=DO_NOT_TRACK_THIS_DEVICE\n`], 'the documented device id literal', ['near-miss-value']);
    C('basic-secret-in-prose', ['The app secret is the password of the HTTP Basic authentication; never commit it.\n'], 'the role named in prose', ['near-miss-name']);
    Ui('installed-non-empty-password-single', [`curl -X POST ${url} -d 'grant_type=https://oauth.reddit.com/grants/installed_client&device_id=DO_NOT_TRACK_THIS_DEVICE' --user '${cid('i1')}:`, sv('i1'), "'\n"], 'an installed-app request with a non-empty password: the two archived pages disagree', ['representation']);
    Ui('installed-non-empty-password-u', [`curl -X POST ${url} -d grant_type=https://oauth.reddit.com/grants/installed_client -d device_id=DO_NOT_TRACK_THIS_DEVICE -u ${cid('i2')}:`, sv('i2'), '\n'], 'the same with -u', ['representation']);
    U('basic-encoded-header-assembled', [`POST /api/v1/access_token HTTP/1.1\r\nHost: www.reddit.example.test\r\nAuthorization: Basic ${b64(`${cid('e1')}:${lit(family, 'e1s', 30, URLSAFE)}`)}\r\nContent-Type: application/x-www-form-urlencoded\r\n`], 'the encoded Basic header: Reddit states no encoding step', ['representation']);
    U('basic-encoded-header-curl', [`curl -H "Authorization: Basic ${b64(`${cid('e2')}:${lit(family, 'e2s', 30, URLSAFE)}`)}" -X POST ${url}\n`], 'the encoded Basic header in curl', ['representation']);
    U('bare-prose-app-secret', ['App secret: ', sv('b1'), '\n'], 'a bare value with no carrier', ['near-miss-name']);
    U('bare-line', [sv('b2'), '\n'], 'a bare value alone on a line', ['near-miss-name']);
    U('probe-vendor-bare-prose', ['App secret: ' + lit(family, 'vendor:s', 30, URLSAFE) + '\n'], 'a 30-character url-safe value in prose: a shape assembled at run time, never a Case claim', ['probe-vendor-shaped', 'near-miss-name']);
    U('probe-vendor-in-password-slot', [`curl -X POST ${url} -u ${cid('v1')}:${lit(family, 'vendor:s2', 30, URLSAFE)}\n`], 'the same shape in the documented password slot: observed, never scored', ['probe-vendor-shaped', 'direct-slot'], 'probe');
    U('basic-python-auth-tuple', [`requests.post("${url}", auth=("${cid('u1')}", "`, sv('u1'), '"))\n'], 'a Python auth tuple: not the carrier the Case names', ['representation'], 'probe');
    U('basic-url-userinfo', [`curl https://${cid('u2')}:`, sv('u2'), '@www.reddit.example.test/api/v1/access_token\n'], 'URL userinfo: not the carrier the Case names', ['representation'], 'probe');
    U('basic-below-eight', [`curl -X POST ${url} -u ${cid('u3')}:`, sv('u3', 6), '\n'], 'a 6-byte password: no Case states a width floor', ['near-miss-value'], 'probe');
  }

  // ======================================================= zendesk: {email}/token:{api_token} =======================================================
  {
    const family = 'zendesk:api-token';
    const host = 'example-subdomain.zendesk.example.test';
    const url = `https://${host}/api/v2/users.json`;
    const P = dir.positive(family, 'zendesk-api-token-basic-credential-token-part', 'zendesk-authored--api-token-curl-basic-credential');
    const C = dir.control(family, 'zendesk-api-token-lookalikes-and-non-values', 'zendesk-authored--api-token-lookalike-documented-template');
    const U = dir.unsupported(family, 'zendesk-api-token-bare-value-and-grammar-unsettled', 'zendesk-authored--api-token-bare-value-in-prose', 'unsettled-case');
    const t = (s, n = 32, a = ALNUM) => sec(family, `t:${s}`, n, a);
    const em = 'agent@example.test';
    P('credential-curl-u-double', [`curl ${url} -u "${em}/token:`, t('c1'), '"\n'], 'curl -u double-quoted: the token after /token:', ['direct-slot', 'delimiter-after']);
    P('credential-curl-u-single', [`curl ${url} -u '${em}/token:`, t('c2'), "'\n"], 'curl -u single-quoted', ['delimiter-after']);
    P('credential-curl-u-unquoted', [`curl ${url} -u ${em}/token:`, t('c3'), ' -H "Accept: application/json"\n'], 'curl -u unquoted, a space ends it', ['delimiter-after']);
    P('credential-curl-u-eof', [`curl ${url} -u ${em}/token:`, t('c4')], 'at the end of the input', ['end-of-input', 'stream-cut']);
    P('credential-curl-user-long', [`curl ${url} --user "${em}/token:`, t('c5'), '"\n'], 'curl --user', ['delimiter-after']);
    P('credential-curl-u-before-url', [`curl -u "${em}/token:`, t('c6'), `" ${url}\n`], 'the option before the URL', ['delimiter-before', 'delimiter-after']);
    P('credential-json-string', [`{\n  "zendesk": {\n    "credentials": "${em}/token:`, t('c7'), '"\n  }\n}\n'], 'a credentials string in a JSON file', ['nesting', 'delimiter-after']);
    P('credential-json-string-comma', [`{"credentials":"${em}/token:`, t('c8'), '","subdomain":"example-subdomain"}\n'], 'JSON, a quote and comma end it', ['delimiter-after', 'neighbouring-public-field']);
    P('credential-json-last-eof', [`{"subdomain":"example-subdomain","credentials":"${em}/token:`, t('c9'), '"}'], 'JSON, the closing brace ends the input', ['end-of-input']);
    P('credential-yaml-quoted', [`zendesk:\n  credentials: "${em}/token:`, t('c10'), '"\n'], 'a quoted YAML scalar', ['nesting', 'delimiter-after']);
    P('credential-yaml-unquoted', [`zendesk:\n  credentials: ${em}/token:`, t('c11'), '\n  subdomain: example-subdomain\n'], 'an unquoted YAML scalar', ['nesting', 'delimiter-after']);
    P('credential-env-assignment', [`ZENDESK_BASIC_CREDENTIALS=${em}/token:`, t('c12'), '\n'], 'an environment assignment', ['delimiter-after']);
    P('credential-env-assignment-quoted', [`ZENDESK_BASIC_CREDENTIALS="${em}/token:`, t('c13'), '"\n'], 'a quoted environment assignment', ['delimiter-after']);
    P('credential-env-export-crlf', [`export ZENDESK_BASIC_CREDENTIALS=${em}/token:`, t('c14'), '\r\nNEXT=1\r\n'], 'CRLF env file', ['line-ending']);
    P('credential-trailing-whitespace', [`ZENDESK_BASIC_CREDENTIALS=${em}/token:`, t('c15'), '   \t\r\n'], 'trailing spaces and a tab', ['line-ending']);
    P('credential-plus-address-email', [`curl ${url} -u "agent+ops@example.test/token:`, t('c16'), '"\n'], 'a plus-addressed email', ['delimiter-before']);
    P('credential-subdomain-email', [`curl ${url} -u "first.last@mail.example.test/token:`, t('c17'), '"\n'], 'a dotted local part and a subdomain email', ['delimiter-before']);
    P('credential-uppercase-email', [`curl ${url} -u "AGENT@EXAMPLE.TEST/token:`, t('c18'), '"\n'], 'an upper-case email', ['delimiter-before']);
    P('credential-token-with-hyphen-underscore', [`curl ${url} -u "${em}/token:`, t('c19', 36, URLSAFE), '"\n'], 'a url-safe token alphabet', ['shape-independence']);
    P('credential-utf8-before-after', [`# ${MB}\ncurl ${url} -u "${em}/token:`, t('c20'), `" # ${MB}\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
    P('credential-big-preceding', [`${'w'.repeat(63)}\n`.repeat(80), `curl ${url} -u "${em}/token:`, t('c21'), '"\n'], 'about 5 KB first', ['big-preceding']);
    P('credential-same-shape-neighbour', [`subdomain=${lit(family, 'c22a', 32)} curl ${url} -u "${em}/token:`, t('c22'), `" -H "X-Request-Id: ${lit(family, 'c22b', 32)}"\n`], 'public values with the token\'s alphabet and width around it', ['same-shape-neighbour']);
    P('credential-repeat', [`curl ${url} -u "${em}/token:`, t('rep'), `"\nZENDESK_BASIC_CREDENTIALS=${em}/token:`, { secret: lit(family, 't:rep', 32) }, '\n'], 'the same token twice', ['repeat-secret']);
    P('credential-neighbouring-secret', [`curl ${url} -u "${em}/token:`, t('c23'), `" -H "X-Api-Key: ${lit(family, 'c23o', 24)}"\n`], 'a second credential in the same command', ['neighbouring-secret']);
    P('credential-era-words', [`# Zendesk API tokens are deprecated and retire in 2027; this one is still in the script\ncurl ${url} -u "${em}/token:`, t('c24'), '"\n'], 'the era never justifies silence', ['era-words']);
    P('credential-era-words-env', [`# deprecated token\nZENDESK_BASIC_CREDENTIALS=${em}/token:`, t('c25'), '\n'], 'an era remark above an assignment', ['era-words']);
    for (const [slug, alpha, n] of SHAPES) P(`credential-shape-${slug}`, [`curl ${url} -u "${em}/token:`, t(`shape-${slug}`, n, alpha), '"\n'], `a ${slug} token: flagged by position, not by shape`, ['shape-independence', 'direct-slot']);

    C('lookalike-email-subdomain-json', [`{\n  "subdomain": "example-subdomain",\n  "email": "{email_address}"\n}\n`], 'an email and a subdomain only', ['neighbouring-public-field']);
    C('lookalike-email-yaml', [`zendesk:\n  subdomain: example-subdomain\n  email: {email_address}\n`], 'an email and a subdomain, YAML', ['neighbouring-public-field']);
    C('lookalike-documented-template', [`curl ${url} -u {email_address}/token:{api_token}\n`], 'the documented template', ['near-miss-value']);
    C('lookalike-documented-template-quoted', [`curl ${url} -u "{email_address}/token:{api_token}"\n`], 'the documented template, quoted', ['near-miss-value']);
    C('lookalike-angle-placeholder', [`curl ${url} -u "{email_address}/token:<api_token>"\n`], 'angle placeholder', ['near-miss-value']);
    C('lookalike-upper-placeholder', [`curl ${url} -u "{email_address}/token:YOUR_API_TOKEN"\n`], 'upper-case placeholder', ['near-miss-value']);
    C('lookalike-env-reference', [`curl ${url} -u "{email_address}/token:${D}{ZENDESK_API_TOKEN}"\n`], 'environment reference with braces', ['near-miss-value']);
    C('lookalike-env-reference-bare', [`curl ${url} -u "{email_address}/token:${D}ZENDESK_API_TOKEN"\n`], 'environment reference without braces', ['near-miss-value']);
    C('lookalike-template-reference', [`ZENDESK_BASIC_CREDENTIALS={email_address}/token:{{ secrets.zendesk_token }}\n`], 'template reference', ['near-miss-value']);
    C('lookalike-masked', [`ZENDESK_BASIC_CREDENTIALS={email_address}/token:********\n`], 'masked display', ['near-miss-value']);
    C('lookalike-separator-without-token', [`curl ${url} -u "{email_address}/token"\n`], 'the separator with no colon and no token', ['near-miss-value']);
    C('lookalike-separator-colon-empty', [`curl ${url} -u "{email_address}/token:"\n`], 'the separator and colon with an empty token', ['near-miss-value']);
    C('lookalike-token-in-prose', ['Use the form {email_address}/token:{api_token} for the credentials; the token is a password.\n'], 'the composition in prose', ['near-miss-name']);

    U('bare-prose', ['Token to rotate: ', t('b1'), '\n'], 'a bare token with no carrier', ['near-miss-name']);
    U('bare-line', [t('b2'), '\n'], 'a bare token alone on a line', ['near-miss-name']);
    U('json-token-member', ['{\n  "token": "', t('b3'), '"\n}\n'], 'a token member', ['near-miss-name']);
    U('env-api-token-assignment', ['ZENDESK_API_TOKEN=', t('b4'), '\n'], 'an environment assignment of a token name the Case does not name', ['near-miss-name'], 'probe');
    const forty = lit(family, 'vendor:z40', 40, ALNUM);
    U('probe-vendor-40-bare-prose', [`Token to rotate: ${forty}\n`], 'a 40-character letters-and-digits bare value, the width of the documented example: observed, never scored', ['probe-vendor-shaped', 'near-miss-name']);
    U('probe-vendor-40-bare-line', [`${forty}\n`], 'the same alone on a line', ['probe-vendor-shaped', 'near-miss-name']);
    U('probe-vendor-40-in-credential', [`curl ${url} -u "${em}/token:${forty}"\n`], 'the same in the documented position: observed, never scored', ['probe-vendor-shaped', 'direct-slot'], 'probe');
    U('probe-vendor-40-in-env-name', [`ZENDESK_API_TOKEN=${forty}\n`], 'the same under a token-named environment variable', ['probe-vendor-shaped', 'near-miss-name'], 'probe');
    U('url-userinfo-percent', [`curl https://agent%40example.test%2Ftoken:`, t('u1'), `@${host}/api/v2/users.json\n`], 'URL userinfo with %2F: documented for HTTP authentication only', ['representation'], 'probe');
    U('credential-below-eight', [`curl ${url} -u "${em}/token:`, t('u2', 6), '"\n'], 'a 6-byte token: no Case states a width floor', ['near-miss-value'], 'probe');
    U('credential-prefixed-token-name', [`curl ${url} -u "${em}/old_token:`, t('u3'), '"\n'], 'a different separator word', ['glued-name', 'representation'], 'probe');
    U('credential-no-email', [`curl ${url} -u "/token:`, t('u4'), '"\n'], 'the separator with no email address before it', ['near-miss-name'], 'probe');
    U('basic-email-password-encoded', [`Authorization: Basic ${b64(`${em}:${lit(family, 'u5', 24)}`)}\r\n`], 'a Basic header whose decoded form is email:password with no /token', ['near-miss-name', 'representation'], 'probe');

    // the base64 Basic header: the whole encoded run is the span
    const encoded = (s, n, a = ALNUM, e = em) => ({ secret: b64(`${e}/token:${lit(family, `bt:${s}`, n, a)}`) });
    const E = {
      pos: (layout, parts, note, axes) => dir.positive(family, 'zendesk-api-token-basic-credential-encoded-header-value', 'zendesk-authored--api-token-basic-raw-http')(layout, parts, note, axes),
      ctl: (layout, parts, note, axes = ['near-miss-value']) => dir.control(family, 'zendesk-api-token-lookalikes-and-non-values', 'zendesk-authored--api-token-lookalike-documented-template')(layout, parts, note, axes),
      uns: (layout, parts, note, axes) => dir.unsupported(family, 'zendesk-api-token-basic-credential-encoded-header-value', 'zendesk-authored--api-token-basic-raw-http')(layout, parts, note, axes),
    };
    const pad0 = 32; const pad2 = 33; const pad1 = 34; // 25 chars of "agent@example.test/token:" + n: n=32 no pad, 33 two pads, 34 one pad
    E.pos('basic-raw-http-crlf', [`GET /api/v2/users.json HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic `, encoded('e1', pad0), '\r\nAccept: application/json\r\n\r\n'], 'whole encoded run then CRLF, no padding', ['direct-slot', 'delimiter-after']);
    E.pos('basic-raw-http-pad1', [`GET /api/v2/users.json HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic `, encoded('e2', pad1), '\r\n\r\n'], 'one = padding byte is part of the run', ['alphabet', 'delimiter-after']);
    E.pos('basic-raw-http-pad2', [`GET /api/v2/users.json HTTP/1.1\r\nHost: ${host}\r\nAuthorization: Basic `, encoded('e3', pad2), '\r\n\r\n'], 'two = padding bytes are part of the run', ['alphabet', 'delimiter-after']);
    E.pos('basic-eof', [`GET /api/v2/users.json HTTP/1.1\r\nAuthorization: Basic `, encoded('e4', pad0)], 'the run is the last bytes of the input', ['end-of-input', 'stream-cut']);
    E.pos('basic-eof-pad2', [`GET /api/v2/users.json HTTP/1.1\r\nAuthorization: Basic `, encoded('e5', pad2)], 'a padded run at the end of the input', ['end-of-input', 'alphabet']);
    E.pos('basic-curl-double', [`curl -H "Authorization: Basic `, encoded('e6', pad0), `" ${url}\n`], 'double-quoted curl -H', ['delimiter-after']);
    E.pos('basic-curl-single', [`curl -H 'Authorization: Basic `, encoded('e7', pad1), `' ${url}\n`], 'single-quoted curl -H, one padding byte', ['delimiter-after']);
    E.pos('basic-curl-long-option', [`curl --header "Authorization: Basic `, encoded('e8', pad2), `" ${url}\n`], 'curl --header, two padding bytes', ['delimiter-after']);
    E.pos('basic-json-header-map', [`{\n  "headers": {\n    "Authorization": "Basic `, encoded('e9', pad0), '",\n    "Accept": "application/json"\n  }\n}\n'], 'a JSON header map', ['nesting', 'delimiter-after']);
    E.pos('basic-json-header-map-compact', [`{"headers":{"Authorization":"Basic `, encoded('e10', pad1), '","X-Id":"1"}}\n'], 'a compact JSON header map', ['nesting', 'delimiter-after']);
    E.pos('basic-yaml-header', [`headers:\n  Authorization: "Basic `, encoded('e11', pad2), '"\n'], 'a quoted YAML header', ['nesting']);
    E.pos('basic-proxy-header', [`GET / HTTP/1.1\r\nProxy-Authorization: Basic `, encoded('e12', pad0), '\r\n\r\n'], 'Proxy-Authorization carrying the same string', ['direct-slot']);
    E.pos('basic-trailing-whitespace', [`Authorization: Basic `, encoded('e13', pad1), '   \t\r\n'], 'trailing spaces and a tab', ['line-ending']);
    E.pos('basic-utf8-before-after', [`// ${MB}\nGET /api/v2/users.json HTTP/1.1\r\nAuthorization: Basic `, encoded('e14', pad0), `\r\nX-Note: ${MB}\r\n\r\n`], 'multi-byte text before and after', ['utf8-preceding', 'utf8-following']);
    E.pos('basic-big-preceding', [`${'v'.repeat(63)}\n`.repeat(80), 'Authorization: Basic ', encoded('e15', pad2), '\r\n'], 'about 5 KB first', ['big-preceding']);
    E.pos('basic-repeat', ['Authorization: Basic ', encoded('rep', pad0), '\r\n\r\ncurl -H "Authorization: Basic ', { secret: encoded('rep', pad0).secret }, `" ${url}\n`], 'the same run twice', ['repeat-secret']);
    E.pos('basic-neighbouring-secret', ['Authorization: Basic ', encoded('e16', pad0), `\r\nX-Api-Key: ${lit(family, 'e16o', 24)}\r\n`], 'another credential header', ['neighbouring-secret']);
    E.pos('basic-same-shape-neighbour', [`X-Request-Id: ${lit(family, 'e17a', 56, ALNUM)}\r\nAuthorization: Basic `, encoded('e17', pad0), `\r\nX-Trace: ${lit(family, 'e17b', 56, ALNUM)}\r\n`], 'public values of the run\'s alphabet and width around it', ['same-shape-neighbour']);
    E.pos('basic-plus-address-email', ['Authorization: Basic ', encoded('e18', 30, ALNUM, 'agent+ops@example.test'), '\r\n'], 'a plus-addressed email in the encoded string', ['delimiter-after']);
    E.pos('basic-era-words', [`# deprecated Zendesk token, retired in phases\nAuthorization: Basic `, encoded('e19', pad0), '\r\n'], 'the era never justifies silence', ['era-words']);
    for (const [slug, alpha, n] of SHAPES) E.pos(`basic-shape-${slug}`, ['Authorization: Basic ', encoded(`shape-${slug}`, n, alpha), '\r\n'], `a ${slug} token inside the encoded string`, ['shape-independence', 'direct-slot']);
    E.ctl('basic-empty', ['GET /api/v2/users.json HTTP/1.1\r\nAuthorization: Basic \r\n\r\n'], 'the scheme with no value', ['near-miss-value']);
    E.ctl('basic-angle-placeholder', ['Authorization: Basic <base64(email_address/token:api_token)>\r\n'], 'angle placeholder', ['near-miss-value']);
    E.ctl('basic-upper-placeholder', [`curl -H "Authorization: Basic BASE64_CREDENTIALS" ${url}\n`], 'upper-case placeholder', ['near-miss-value']);
    E.ctl('basic-env-reference', [`curl -H "Authorization: Basic ${D}{ZENDESK_BASIC_AUTH}" ${url}\n`], 'environment reference', ['near-miss-value']);
    E.ctl('basic-env-reference-bare', [`Authorization: Basic ${D}ZENDESK_BASIC_AUTH\r\n`], 'environment reference without braces', ['near-miss-value']);
    E.ctl('basic-masked', ['Authorization: Basic ************************\r\n'], 'masked display', ['near-miss-value']);
    E.ctl('basic-prose', ['The credential string is base64-encoded into an Authorization: Basic header.\n'], 'the header in prose', ['near-miss-name']);
    E.uns('basic-lowercase-scheme', [`authorization: basic ${encoded('u6', pad0).secret}\r\n`], 'lower-case header name and scheme', ['representation']);
    E.uns('basic-below-eight-token', [`Authorization: Basic ${encoded('u7', 6).secret}\r\n`], 'an encoded string around a 6-byte token', ['near-miss-value']);
    E.uns('basic-value-on-next-line', [`Authorization: Basic\r\n${encoded('u8', pad0).secret}\r\n`], 'the run on the next line', ['representation']);
    E.uns('basic-url-safe-base64', [`Authorization: Basic ${encoded('u9', pad2).secret.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}\r\n`], 'the url-safe base64 alphabet without padding', ['representation']);
  }

  // ======================================================= adobe: the signing key is never a public identifier (controls) and the unsettled forms (observed) =======================================================
  {
    const family = 'adobe:service-account-jwt-private-key';
    const ID = 'adobe-jwt-service-account-identifiers-and-private-key-references';
    const C = dir.control(family, ID, 'adobe-authored--jwt-claims-payload-identifiers');
    const U = dir.unsupported(family, 'adobe-jwt-signed-assertion-form-field-unsettled', 'adobe-authored--jwt-token-form-body', 'unsettled-case');
    const Uk = dir.unsupported(family, 'adobe-jwt-private-key-file-contents-unsettled', null, 'unsettled-case');
    const org = lit(family, 'org', 24, 'ABCDEF0123456789');
    const tech = lit(family, 'tech', 24, 'ABCDEF0123456789');
    const apikey = lit(family, 'apikey', 32, LOWER);
    C('claims-json-compact', [`{"iss":"${org}@AdobeOrg","sub":"${tech}@techacct.adobe.com","aud":"https://ims-na1.adobelogin.example.test/c/${apikey}","exp":1791200000}\n`], 'the JWT claims with the public identifiers', ['neighbouring-public-field']);
    C('claims-json-metascopes', [`{\n  "iss": "${org}@AdobeOrg",\n  "sub": "${tech}@techacct.adobe.com",\n  "https://ims-na1.adobelogin.example.test/s/ent_analytics_bulk_ingest_sdk": true,\n  "aud": "https://ims-na1.adobelogin.example.test/c/${apikey}"\n}\n`], 'claims with a metascope member', ['neighbouring-public-field']);
    C('claims-same-shape-identifiers', [`{"iss":"${lit(family, 'ss1', 40, ALNUM)}@AdobeOrg","sub":"${lit(family, 'ss2', 40, ALNUM)}@techacct.adobe.com","aud":"https://ims-na1.adobelogin.example.test/c/${lit(family, 'ss3', 40, ALNUM)}"}\n`], 'identifiers given a long mixed-case alphanumeric shape: public identifiers are not the key', ['same-shape-neighbour']);
    C('claims-yaml', [`jwt:\n  iss: ${org}@AdobeOrg\n  sub: ${tech}@techacct.adobe.com\n  aud: https://ims-na1.adobelogin.example.test/c/${apikey}\n`], 'the claims as YAML', ['neighbouring-public-field']);
    C('exchange-client-id-form', [`POST /ims/exchange/jwt/ HTTP/1.1\r\nHost: ims-na1.adobelogin.example.test\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\nclient_id=${apikey}\r\n`], 'the exchange request\'s client_id, a public identifier, with no assertion', ['neighbouring-public-field']);
    C('exchange-client-id-curl', [`curl -X POST https://ims-na1.adobelogin.example.test/ims/exchange/jwt/ -F client_id=${apikey}\n`], 'the same in curl -F', ['neighbouring-public-field']);
    C('keygen-openssl-command', ['openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate_pub.crt\n'], 'the key generation command', ['near-miss-name']);
    C('keygen-openssl-command-crlf', ['openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate_pub.crt\r\n'], 'the same with CRLF', ['line-ending', 'near-miss-name']);
    C('key-path-env', ['ADOBE_PRIVATE_KEY_PATH=./private.key\n'], 'an environment path reference', ['near-miss-value']);
    C('key-path-env-quoted', ['ADOBE_PRIVATE_KEY_PATH="./private.key"\n'], 'a quoted path reference', ['near-miss-value']);
    C('key-path-yaml', ['adobe:\n  private_key_file: ./private.key\n'], 'a YAML path reference', ['near-miss-value']);
    C('key-path-json', ['{"privateKeyFile":"./private.key","clientId":"' + apikey + '"}\n'], 'a JSON path reference and a public client id', ['near-miss-value', 'neighbouring-public-field']);
    C('key-path-absolute', ['key=/etc/adobe/private.key\n'], 'an absolute path reference', ['near-miss-value']);
    C('key-path-utf8', [`# ${MB}\nADOBE_PRIVATE_KEY_PATH=./private.key # ${MB}\n`], 'a path reference with multi-byte text around it', ['utf8-preceding', 'utf8-following']);
    C('certificate-upload-prose', ['Upload the public certificate (certificate_pub.crt) when you create the integration; keep private.key on your own machine.\n'], 'prose about the public certificate and the key file name', ['near-miss-name']);
    C('certificate-public-reference', ['certificate: ./certificate_pub.crt\n'], 'a public certificate path', ['near-miss-value']);
    C('key-env-reference', [`ADOBE_PRIVATE_KEY=${D}{ADOBE_PRIVATE_KEY}\n`], 'an environment reference', ['near-miss-value']);
    C('key-template-reference', ['private_key: "{{ secrets.adobe_private_key }}"\n'], 'a template reference', ['near-miss-value']);
    C('key-angle-placeholder', ['private_key: <contents of private.key>\n'], 'an angle placeholder', ['near-miss-value']);
    C('key-masked', ['private_key: ********\n'], 'a masked display', ['near-miss-value']);
    C('key-name-in-prose', ['The private key signs the JWT with RS256; never share it.\n'], 'the key named in prose', ['near-miss-name']);

    // the signed assertion (unsettled): header.payload.signature assembled at run time from encoded JSON objects
    const b64u = text => Buffer.from(text, 'utf8').toString('base64url');
    const jwt = slug => `${b64u(JSON.stringify({ alg: 'RS256' }))}.${b64u(JSON.stringify({ iss: `${org}@AdobeOrg`, sub: `${tech}@techacct.adobe.com`, aud: `https://ims-na1.adobelogin.example.test/c/${apikey}`, exp: 1791200000 }))}.${lit(family, `jwt:${slug}`, 86, URLSAFE)}`;
    U('assertion-form-body', [`POST /ims/exchange/jwt/ HTTP/1.1\r\nHost: ims-na1.adobelogin.example.test\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\nclient_id=${apikey}&jwt_token=${jwt('a1')}\r\n`], 'the assertion in the exchange form field', ['representation']);
    U('assertion-form-body-eof', [`client_id=${apikey}&client_secret=${lit(family, 'a2s', 32)}&jwt_token=${jwt('a2')}`], 'the assertion at the end of the input beside a client secret', ['representation', 'end-of-input']);
    U('assertion-curl-form-argument', [`curl -X POST https://ims-na1.adobelogin.example.test/ims/exchange/jwt/ -F client_id=${apikey} -F jwt_token=${jwt('a3')}\n`], 'the assertion in curl -F', ['representation']);
    U('assertion-curl-data-urlencode', [`curl -X POST https://ims-na1.adobelogin.example.test/ims/exchange/jwt/ --data-urlencode client_id=${apikey} --data-urlencode jwt_token=${jwt('a4')}\n`], 'the assertion in curl --data-urlencode', ['representation'], 'probe');
    U('assertion-json-member', [`{"client_id":"${apikey}","jwt_token":"${jwt('a5')}"}\n`], 'the assertion as a JSON member', ['representation'], 'probe');
    U('assertion-bare-prose', [`Signed assertion: ${jwt('a6')}\n`], 'the assertion as a bare value in prose', ['near-miss-name'], 'probe');
    U('assertion-bearer-header', [`Authorization: Bearer ${jwt('a7')}\r\n`], 'the assertion as a Bearer value', ['near-miss-name'], 'probe');

    // the key file's text (unsettled; no encoding, label or length is stated): probes assembled at run time from fragments
    const dash = '-----';
    const pem = (label, body) => `${dash}BEGIN ${label}${dash}\n${body}\n${dash}END ${label}${dash}\n`;
    const body = slug => Array.from({ length: 4 }, (_, i) => lit(family, `pem:${slug}:${i}`, 64, `${ALNUM}+/`)).join('\n');
    const lbl = a => [a, 'PRIVATE', 'KEY'].filter(Boolean).join(' ');
    Uk('key-file-pkcs8-block', [pem(lbl(''), body('p8'))], 'a PKCS8-labelled block of filler: no Adobe statement of the encoding, label or length', ['representation', 'probe-vendor-shaped']);
    Uk('key-file-rsa-block', [pem(lbl('RSA'), body('rsa'))], 'an RSA-labelled block of filler', ['representation', 'probe-vendor-shaped']);
    Uk('key-file-block-crlf', [pem(lbl(''), body('crlf')).replace(/\n/g, '\r\n')], 'a labelled block with CRLF line ends', ['representation', 'line-ending', 'probe-vendor-shaped']);
    Uk('key-file-block-in-json-escaped', [`{"private_key":"${pem(lbl(''), body('esc')).replace(/\n/g, '\\n')}"}\n`], 'a labelled block inside a JSON string with escaped newlines', ['representation', 'nesting', 'probe-vendor-shaped']);
    Uk('key-file-block-in-env', [`ADOBE_PRIVATE_KEY="${pem(lbl(''), body('env')).replace(/\n/g, '\\n')}"\n`], 'a labelled block in an environment assignment', ['representation', 'probe-vendor-shaped']);
    Uk('key-file-body-unlabelled', [`${body('raw')}\n`], 'the base64 body alone, with no label', ['representation', 'probe-vendor-shaped']);
    Uk('key-file-body-single-line', [`private_key=${lit(family, 'pem:sl', 1600, ALNUM)}\n`], 'one unwrapped base64-looking line under a key name', ['representation', 'probe-vendor-shaped']);
  }

  // ======================================================= vendor-shaped probes for the rows whose bare-value Cases are unsettled =======================================================
  // Each value is assembled here at run time. None is a Case claim; every one is observed and never scored.
  {
    const probes = (family, caseId, fx, shapes, slots) => {
      const U = dir.unsupported(family, caseId, fx, 'unsettled-case');
      for (const [slug, value] of shapes) {
        U(`probe-${slug}-bare-prose`, [`Old key: ${value}\n`], `a ${slug} bare value in prose`, ['probe-vendor-shaped', 'near-miss-name']);
        U(`probe-${slug}-bare-line`, [`${value}\n`], `a ${slug} bare value alone on a line`, ['probe-vendor-shaped', 'near-miss-name']);
        for (const [slotSlug, make] of slots) U(`probe-${slug}-in-${slotSlug}`, [make(value)], `a ${slug} value in the ${slotSlug}: observed, never scored`, ['probe-vendor-shaped', 'direct-slot'], 'probe');
      }
    };
    const hx = (slug, n) => lit('hubspot:legacy-api-key', `vendor:${slug}`, n, HEX);
    const uuid = slug => `${hx(`${slug}a`, 8)}-${hx(`${slug}b`, 4)}-${hx(`${slug}c`, 4)}-${hx(`${slug}d`, 4)}-${hx(`${slug}e`, 12)}`;
    probes('hubspot:legacy-api-key', 'hubspot-legacy-api-key-hyphen-grouped-bare-value-unsettled', 'hubspot-authored--grouped-value-in-prose',
      [['uuid-lower', uuid('l')], ['uuid-upper', uuid('u').toUpperCase()]],
      [['hapikey-slot', v => `curl "https://api.hubspot.example.test/contacts/v1/lists/all/contacts/all?hapikey=${v}"\n`]]);
    probes('airtable:legacy-api-key', 'airtable-legacy-api-key-bearer-header-and-bare-value-unsettled', 'airtable-authored--bare-value-in-prose',
      [['key14', `key${lit('airtable:legacy-api-key', 'vendor:k14', 14, ALNUM)}`]],
      [['api-key-slot', v => `curl "https://api.airtable.example.test/v0/appSYNTHETIC0001/Table?api_key=${v}"\n`], ['bearer-header', v => `GET /v0/appSYNTHETIC0001/Table HTTP/1.1\r\nHost: api.airtable.example.test\r\nAuthorization: Bearer ${v}\r\n`]]);
    probes('dropbox:legacy-long-lived-access-token', 'dropbox-legacy-long-lived-access-token-bare-value-and-lone-member-unsettled', 'dropbox-authored--bare-value-in-prose',
      [['urlsafe64', lit('dropbox:legacy-long-lived-access-token', 'vendor:u64', 64, URLSAFE)], ['sl-prefixed', `sl.${lit('dropbox:legacy-long-lived-access-token', 'vendor:sl', 136, URLSAFE)}`]],
      [['member-slot', v => `{"access_token":"${v}","token_type":"bearer","account_id":"SYNTHETIC-account-id-0009","uid":"SYNTHETIC-uid-0009"}\n`]]);
  }

  return cases;
}

export const cases = build();

export const KINDS = ['positive', 'control', 'unsupported', 'conflict'];
export function corpusDigest() {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}
export function counts() {
  const out = {};
  for (const c of cases) {
    out[c.family] ??= { positive: 0, control: 0, unsupported: 0, conflict: 0, total: 0, uniqueInputs: { positive: 0, control: 0, unsupported: 0, conflict: 0, total: 0 } };
    out[c.family][c.kind] += 1;
    out[c.family].total += 1;
  }
  // unique inputs: distinct texts per row and kind (a text repeated under another layout name is one input)
  for (const f of Object.keys(out)) {
    const seen = {};
    for (const k of KINDS) seen[k] = new Set(cases.filter(c => c.family === f && c.kind === k).map(c => c.text));
    for (const k of KINDS) out[f].uniqueInputs[k] = seen[k].size;
    out[f].uniqueInputs.total = KINDS.reduce((a, k) => a + seen[k].size, 0);
  }
  return out;
}

/**
 * Expectations a Case states that Batch 2's scorer (score-r2.mjs, unchanged) cannot express. Each is carried by the corpus as the nearest
 * expressible form named here, never silently dropped.
 */
export const INEXPRESSIBLE = [
  { id: 'finding-type-and-action', what: 'The Cases state an outcome (must-flag) and span roles, never a finding type or an action (redact, warn).', carriedAs: 'expectedType and expectedAction are null on every positive. score-r2 `pass`, `typeOk` and `actionOk` are therefore never true for this corpus; the Case-derived metrics are exact, fullyCovered and misses (positives) and controlFlagged (controls).' },
  { id: 'any-shape', what: 'Every positive Case flags a value by its position "whatever its shape": a universal over values.', carriedAs: 'Five non-vendor shapes (hex32, alnum64, urlsafe40, digits24, lower16) in the same slot, axis shape-independence. The scorer cannot say "any value".' },
  { id: 'unasserted-neighbours', what: 'The Cases decline to assert the Zendesk email address inside the Basic envelope, the Reddit client id, the Dropbox account_id and uid, the confidentiality of the Adobe identifiers and of the HubSpot appId.', carriedAs: 'Positives expect only the secret span (the scorer ignores a finding that does not touch it), so a finding on an unasserted neighbour inside a positive is invisible, not a pass or a fail. Controls: the generated Reddit controls use the CLIENT_ID template word, the generated Dropbox controls carry only token_type and the generated Zendesk controls use the documented {email_address} template; controls and fixture mirrors that carry such a literal are observed only (`unsupported`, or `conflict` for the four Zendesk fixture mirrors that carry a literal email), never scored. A "don\'t care" byte range has no scorer form.' },
  { id: 'policy-class-tolerance', what: 'Every scored Case rests on project policy (maintainer-only, basis project-policy): the policy does not fix one defensible extent, attribution, type or action for a flagged value, so a tolerance class (for example a wider or narrower span that still covers the value, or a different family attribution) is part of what the Case allows.', carriedAs: 'Not expressible. The unchanged scorer reports exact, over, under and partial as separate outcomes and `pass` requires exact; this corpus reports exact, fullyCovered and misses, and a non-exact outcome on a positive is a measurement to be read against the Case, not a verdict of the Case.' },
  { id: 'shared-slot-attribution', what: 'The Reddit revocation `token` field is the shared slot of the access-token and refresh-token rows (both are subjects of one Case).', carriedAs: 'One case set under reddit:oauth-access-token with `families` naming both rows. The scorer has no per-family attribution, so which row a finding belongs to is not scored.' },
  { id: 'era-neutrality', what: 'An era (retired, deprecated, archived) never justifies silence.', carriedAs: 'Positives with era words in the document (axis era-words). The scorer cannot express "independent of the document\'s era claims", only the positive outcome of those instances.' },
  { id: 'carrier-currency', what: 'The Reddit carriers rest on archived pages the provider points to, the Airtable parameter is named only in a negative sentence, and the Dropbox date conflict: the Cases flag them under project policy and record the limit.', carriedAs: 'Plain positives. The limit is in the Case, not in a score.' },
  { id: 'whole-encoded-run', what: 'The Zendesk Basic header Case expects the whole encoded run (padding included) as one span, not a decoded token-only span.', carriedAs: 'One expected span over the run, exactly as the Case says; the encoded-versus-decoded distinction is a property of the span, not a scorer concept.' },
];

/** Where a case's expectation comes from, in words. */
export function clauseOf(c) {
  const e = EVIDENCE.cases[c.case];
  if (c.downgraded) return `${c.case}: observed only (ruling ${c.downgraded.ref}, was ${c.downgraded.from}): ${c.downgraded.why}`;
  if (c.kind === 'positive') return `${c.case}: ${e.outcome} (${e.basis}); span role secret = ${c.case === 'zendesk-api-token-basic-credential-encoded-header-value' ? 'the whole encoded run' : 'the value only'}`;
  if (c.kind === 'control') return `${c.case}: ${e.outcome} (${e.basis}); lookalike or non-value, no finding`;
  if (c.derivation === 'unsettled-case') return `${c.case}: ${e.outcome} (${e.basis}); the Case names this form and asserts nothing`;
  if (c.derivation === 'fixture-mirror') return `${c.case}: ${e.outcome} (${e.basis}); fixture verbatim`;
  return `no Case asserts this form (probe); nearest Case ${c.case}`;
}
