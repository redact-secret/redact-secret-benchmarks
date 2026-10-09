import { synthesize } from '../../harness/credential-carriers/synthesis.mjs';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AXES as BATCH2_AXES } from '../../harness/credential-carriers/axes.mjs';

// Issue #753, Group D (23 rows): an independent baseline corpus authored blind to the product.
//
// Inputs, and only these: the credential-evidence snapshot `snapshot-2026.10.06.5` (Cases and fixtures for the 23 rows,
// extracted into evidence-inputs.json by extract-evidence-inputs.mjs) and the Group D readiness inventory in that
// snapshot (docs/handoffs/group-d-cases-and-readiness.md). No scanner, CLI, product build, product repository or
// Batch 2 observation was read or run to write this file.
//
// Rules:
//  - An expectation comes from a Case outcome and its span roles only. `positive` needs a must-flag Case; `control`
//    needs a must-not-flag Case; everything else is `unsupported` (observed, never scored) and a Case fixture the Group D
//    author listed as contradicting its contract is `conflict` (observed, never scored).
//  - The Cases state an outcome, not a finding type or an action, so expectedType and expectedAction are null. The
//    Batch 2 scorer's `pass` therefore cannot be true; consume `exact`, `fullyCovered`, `misses` and `controlFlagged`.
//  - Values are runtime-built filler (synth) or the fixed SYNTHETIC markers the evidence fixtures use. A vendor-prefix
//    shape the evidence leaves open is assembled from parts below and is only ever observed.

export const CORPUS_VERSION = 1;
export const ISSUE = 753;
export const SCHEMA = 'group-d-observations-v1';
export const EVIDENCE = { repo: 'redact-secret/credential-evidence', tag: 'snapshot-2026.10.06.5', commit: '574b52ba367e2071d5a9bea3e2da7a9c5057f633', inventory: 'docs/handoffs/group-d-cases-and-readiness.md' };
export const SCORER = 'benchmarks/harness/credential-carriers/score-multispan.mjs';

export const AXES = {
  ...BATCH2_AXES,
  'value-shape-agnostic': 'the Case admits the value by its slot, whatever its shape: short, long, marker-style and punctuated values all sit in the span',
  'endpoint-context': 'the Case attributes the value by the request it sits in; the same carrier in another request is policy-limited and observed',
  'multi-span': 'two members of one document are both spans (api_key and encoded)',
  'prefix-shape': 'a vendor-prefix shape the evidence leaves open, assembled at run time: observed only',
  'role-ambiguity': 'the slot is shared by several roles or the carrier is unresolved in the evidence: observed only',
  'policy-limited': 'confidentiality is unstated or the value is public by design in the evidence: observed only',
  'derived-value': 'a value derived from a secret (signature, proof, HMAC, JWT) whose confidentiality the evidence does not state: observed only',
  'class-extension': 'a non-value variant (bullet mask, {{ secrets.* }} template) that extends the Case\'s own categories to a sibling form; the Case does not list this exact form',
  'contradiction': 'a Case fixture the Group D author recorded as contradicting its contract: observed only',
};

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = `${ALNUM}-_`;
const HEX = '0123456789abcdef';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DIGITS = '0123456789';
const B64TOKEN = `${ALNUM}-._~+/`;

export function synth(seed, length, alphabet = ALNUM) {
  return synthesize('groupd:753', seed, length, alphabet);
}
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');
const b64url = (t) => Buffer.from(t, 'utf8').toString('base64url');
const MB = '\u{1F680} café 日本語 é';

// Vendor-prefix literals are never written whole in this repository.
const PREFIX = { figma: ['fi', 'gd_'].join(''), dropbox: ['s', 'l.'].join(''), hubspot: ['p', 'at-na1-'].join('') };
const H16 = '0123456789abcdef';
const expand = (t) => t.split('{{figd_}}').join(PREFIX.figma).split('{{hex64}}').join(H16.repeat(4)).split('{{hex32}}').join(H16.repeat(2));

const evidence = JSON.parse(readFileSync(new URL('./evidence-inputs.json', import.meta.url), 'utf8'));
export const EVIDENCE_INPUTS = evidence;
const CASES = new Map(evidence.cases.map((c) => [c.id, c]));
const FIXTURES = evidence.fixtures.map((f) => ({ ...f, text: expand(f.text), spans: f.spans.map((s) => ({ ...s, value: expand(s.value) })) }));
const fixturesOf = (caseId) => FIXTURES.filter((f) => f.case === caseId).map((f) => f.id);

/** Per row: the contract claims (inventory table) and the Cases. `scored` rows have a must-flag Case. */
const R = (claims, cases = {}) => ({ claims, ...cases });
export const ROWS = {
  'algolia:admin-api-key': R(['admin-api-key-create-key-endpoint-requires-admin', 'admin-api-key-handling', 'admin-api-key-intended-use'], { pos: 'algolia-admin-api-key-create-key-request-header-value', ctl: 'algolia-api-key-placeholders-references-and-index-names-non-values' }),
  'algolia:search-only-api-key': R(['search-only-api-key-exposure', 'search-only-api-key-restricted-derivation-and-mitigation', 'search-only-api-key-index-names-are-public'], { na: 'algolia-search-only-api-key-frontend-exposure-unsettled' }),
  'algolia:secured-api-key': R(['secured-api-key-construction-documented', 'secured-api-key-frontend-delivery', 'secured-api-key-inherits-restrictions'], { na: 'algolia-secured-api-key-derived-value-confidentiality-unsettled' }),
  'algolia:write-api-key': R(['write-api-key-handling', 'write-api-key-write-acls', 'write-api-key-header-carrier'], { na: 'algolia-write-api-key-header-carrier-shared-with-every-role-unsettled' }),
  'algolia:analytics-api-key': R(['analytics-api-key-accepts-any-key-with-acl', 'analytics-api-key-regional-hosts'], { na: 'algolia-analytics-api-key-acl-profile-and-data-sensitivity-unsettled' }),
  'algolia:monitoring-api-key': R(['monitoring-api-key-infrastructure-scope', 'monitoring-api-key-plan-and-host'], { na: 'algolia-monitoring-api-key-confidentiality-unsettled' }),
  'algolia:usage-api-key': R(['usage-api-key-acl-and-source', 'usage-api-key-monitoring-usage-endpoints-deprecated'], { na: 'algolia-usage-api-key-confidentiality-and-era-unsettled' }),
  'contentful:delivery-api-access-token': R(['delivery-api-token-transport', 'delivery-api-key-resource-carries-access-token', 'delivery-api-key-read-only-and-environment-scoped'], { na: 'contentful-delivery-api-access-token-public-or-confidential-unsettled', ctl: 'contentful-api-token-placeholders-and-token-free-preview-url-non-values' }),
  'contentful:preview-api-access-token': R(['preview-token-is-distinct-from-delivery-token', 'preview-token-purpose-unpublished-content', 'preview-token-not-in-preview-url'], { na: 'contentful-preview-api-access-token-confidentiality-unsettled', ctl: 'contentful-api-token-placeholders-and-token-free-preview-url-non-values' }),
  'asana:service-account-token': R(['sa-org-wide-access-and-endpoints', 'audit-log-page-calls-it-a-personal-access-token', 'pat-page-carrier-is-authorization-header'], { na: 'asana-service-account-token-carrier-unconfirmed' }),
  'dropbox:app-auth-token': R(['app-auth-token-bearer-carrier', 'app-auth-token-exists', 'app-auth-token-request-inputs', 'app-auth-token-response-undocumented'], { pos: 'dropbox-app-auth-token-bearer-authorization-header-value', ctl: 'dropbox-app-auth-token-placeholders-and-references-non-values', na: 'dropbox-app-auth-token-response-member-and-lifetime-undocumented' }),
  'elastic:cross-cluster-api-key': R(['cross-cluster-response-members-match-user-key', 'cross-cluster-key-carrier-is-local-cluster-keystore', 'cross-cluster-key-refused-on-rest-interface', 'cross-cluster-key-optional-certificate-identity', 'cross-cluster-key-effective-access'], { pos: 'elastic-cross-cluster-api-key-create-response-members', ctl: 'elastic-cross-cluster-api-key-binding-attributes-and-references-non-values', na: 'elastic-cross-cluster-api-key-keystore-slot-unconfirmed' }),
  'elastic:serverless-project-api-key': R(['encoded-carrier', 'stack-page-calls-serverless-keys-equivalent', 'serverless-create-response-type-is-shared'], { pos: 'elastic-serverless-project-api-key-authorization-header-value', ctl: 'elastic-serverless-project-api-key-placeholders-and-references-non-values' }),
  'figma:plan-access-token': R(['x-figma-token-header-shared-with-personal-token', 'plan-token-secret-shown-once-id-viewable', 'plan-token-refresh-previous-secret-valid-24h'], { pos: 'figma-x-figma-token-header-value', ctl: 'figma-x-figma-token-lookalikes-and-non-values', na: 'figma-plan-access-token-id-refresh-window-and-category-grammar-unsettled' }),
  'figma:cli-plan-access-token': R(['cli-token-creation-fixed-scope-plan-wide', 'code-connect-cli-carrier-documented-for-personal-token'], { na: 'figma-cli-plan-access-token-carrier-unstated' }),
  'hubspot:static-auth-access-token': R(['static-auth-token-exists', 'bearer-carrier-shared-by-oauth-static-and-private-app-tokens', 'static-auth-placeholder-is-not-a-format-statement', 'pages-do-not-relate-static-auth-and-private-app-tokens'], { pos: 'hubspot-static-auth-access-token-bearer-authorization-header-value', ctl: 'hubspot-static-auth-access-token-masked-placeholder-and-references-non-values', na: 'hubspot-static-auth-access-token-private-app-and-service-key-relation-unsettled' }),
  'jfrog:pairing-token': R(['pairing-token-purpose-and-signed-extension', 'pairing-token-generation-display', 'pairing-result-is-a-master-token'], { na: 'jfrog-pairing-token-form-and-exchange-carrier-unstated' }),
  'meta:instagram-app-secret': R(['instagram-app-secret-carrier-in-code-exchange', 'instagram-app-secret-carrier-in-long-lived-exchange', 'instagram-docs-use-short-placeholder-secret', 'instagram-app-secret-shown-with-instagram-app-id', 'instagram-app-id-differs-by-login-type'], { pos: 'meta-instagram-app-secret-client-secret-parameter', ctl: 'meta-instagram-app-secret-placeholders-and-references-non-values', na: 'meta-instagram-app-id-and-secret-relation-unsettled', bare: 'meta-app-secret-bare-thirty-two-character-values' }),
  'canva:authorization-code': R(['code-redirect-query-parameter', 'code-exchange-inputs', 'single-use-stated-for-refresh-token-only'], { na: 'canva-authorization-code-redirect-query-parameter-unsettled' }),
  'meta:app-access-token': R(['app-id-secret-pair-alternative', 'generation-call', 'exposure-statements', 'token-length-variable'], { pos: 'meta-app-secret-in-app-id-pipe-access-token', ctl: 'meta-app-secret-pipe-placeholders-derived-proof-and-non-values', na: 'meta-app-access-token-generated-token-response-unstated' }),
  'x:oauth1-access-token': R(['access-token-in-authorization-header', 'signature-derived-from-two-secrets', 'token-exchange-carrier', 'temporary-and-token-credentials-share-names'], { na: 'x-oauth1-access-token-half-and-request-token-collision-unsettled', adjacent: 'x-oauth1-token-identity-and-signature-non-values' }),
  'zoom:build-platform-api-key': R(['api-request-carriers', 'usage-guidance-key-versus-jwt', 'bearer-slot-is-shared'], { pos: 'zoom-build-api-key-x-api-key-header-value', ctl: 'zoom-build-api-key-placeholders-and-non-values', na: 'zoom-build-platform-api-key-authorization-bearer-slot-shared-with-jwt' }),
  'zoom:webhook-secret-token': R(['secret-token-sent-wording', 'secret-token-hash-wording', 'carrier-wording-conflict', 'signature-input-and-output', 'endpoint-validation-challenge'], { ctl: 'zoom-webhook-signature-and-challenge-derived-values-non-values', na: 'zoom-webhook-secret-token-carrier-wording-conflict' }),
};
export const FAMILY_IDS = Object.keys(ROWS);
export const SCORED_ROWS = FAMILY_IDS.filter((f) => ROWS[f].pos);
export const PARTS = ['ready-rows', 'observed-only-rows'];
const partOf = (family) => (ROWS[family].pos ? 'ready-rows' : 'observed-only-rows');

/** Case fixtures the Group D author listed as contradicting their contract (handoff, "Existing Cases that disagree").
 *  The last entry is not on that list: it carries the same unresolved-confidentiality app-ID literal as the listed
 *  `app-pair-lookalike-masked-secret` fixture and is downgraded for the same reason (interpretation I1). */
export const CONTRADICTIONS = {
  'x-authored--oauth-authorization-header-identity-and-signature': { row: 'x:oauth1-access-token', note: 'handoff contradiction 1: whole-input must-not-flag over an oauth_token whose confidentiality is unsettled (token-half-sensitivity-still-unsettled, request-token-collision-confirmed)' },
  'figma-authored--token-id-header-with-public-id': { row: 'figma:plan-access-token', note: 'handoff contradiction 2: a plan token id is treated as a public identifier although its disclosure status is unstated (plan-token-secret-shown-once-id-viewable)' },
  'meta-authored--app-pair-lookalike-masked-secret': { row: 'meta:app-access-token', note: 'handoff contradiction 3: asserts an app ID next to a masked secret is not a credential; the contract does not say the app ID is non-secret' },
  'meta-authored--app-pair-lookalike-appsecret-proof-derived': { row: 'meta:app-access-token', note: 'handoff contradiction 3: asserts a derived appsecret_proof is not a credential although the Case text decides nothing about it' },
  'zoom-authored--webhook-lookalike-signature-and-timestamp-headers': { row: 'zoom:webhook-secret-token', note: 'handoff contradiction 4: asserts a derived x-zm-signature is not a credential; secret-input-versus-derived-output does not say Zoom documents it as non-secret' },
  'zoom-authored--webhook-lookalike-validation-response': { row: 'zoom:webhook-secret-token', note: 'handoff contradiction 4: asserts plainToken and encryptedToken are not credentials; same reason' },
  'dropbox-authored--app-secret-lookalike-app-key-only': { row: 'dropbox:app-auth-token', note: 'handoff contradiction 5 (adjacent family dropbox:app-secret): treats the app key as a public identifier; the app-auth-token contract records the page does not label it non-secret' },
  'meta-authored--app-pair-lookalike-generation-call-placeholder': { row: 'meta:app-access-token', note: 'interpretation I1, not on the handoff list: client_id is an app-ID literal beside a placeholder secret, the same defect as contradiction 3' },
};

/** Cases downgraded from positive to unsupported by blind-review rulings (D-B2, A3). */
const DOWNGRADED = {
  'elastic:cross-cluster-api-key:gd:repeat-response-and-log:unsupported': 'D-B2: a log line `encoded=` is not a container the Case names',
  'elastic:cross-cluster-api-key:gd:yaml-response:unsupported': 'D-B2: a YAML rendering is not among the Case-named containers',
  'meta:instagram-app-secret:gd:curl-data:unsupported': 'A3: the Case names curl form field (-F), not curl -d',
  'meta:instagram-app-secret:gd:curl-data-single:unsupported': 'A3: the Case names curl form field (-F), not curl --data',
  'meta:instagram-app-secret:gd:long-lived-url-fragment:unsupported': 'A3: no Case names a URL fragment container',
  'meta:app-access-token:gd:html-href:unsupported': 'A3: no Case names an HTML href container',
  'meta:app-access-token:gd:url-fragment:unsupported': 'A3: no Case names a URL fragment container',
};
/** The 8 cases the blind reviewer found byte-identical to Group C's meta:app-secret replays (3 positives, 5 controls).
 *  Recorded as an explicit list: Group C's corpus is not read here, so identity is as listed by the reviewer. */
export const SHARED_WITH_GROUP_C = [
  'meta:app-access-token:gd:fixture-app-pair-curl-url:positive',
  'meta:app-access-token:gd:fixture-app-pair-raw-http:positive',
  'meta:app-access-token:gd:fixture-app-pair-url-query-continues:positive',
  'meta:app-access-token:gd:fixture-app-pair-lookalike-documented-template:control',
  'meta:app-access-token:gd:fixture-app-pair-lookalike-environment-reference:control',
  'meta:app-access-token:gd:fixture-app-pair-lookalike-prose-mention:control',
  'meta:app-access-token:gd:curl-doc-template:control',
  'meta:app-access-token:gd:prose:control',
];

const host = 'api.example.test';

function build() {
  const cases = [];
  const ids = new Set();
  const row = (family) => ROWS[family];

  /**
   * add({ family, kind, layout, parts, note, axes, caseId, fixtures, clause })
   * kind: positive | control | unsupported | conflict. parts: strings and { secret } objects.
   */
  const add = ({ family, kind, layout, parts, note, axes, caseId, fixtures, clause, sharedWith, source = 'generated', reason }) => {
    const id = `${family}:gd:${layout}:${kind}`;
    if (ids.has(id)) throw new Error(`group-d: duplicate case id ${id}`);
    ids.add(id);
    const c = CASES.get(caseId);
    if (!c) throw new Error(`group-d: unknown Case ${caseId} for ${id}`);
    let text = '';
    const spans = [];
    for (const part of parts) {
      if (typeof part === 'string') { text += part; continue; }
      const start = Buffer.byteLength(text);
      text += part.secret;
      spans.push({ start, end: Buffer.byteLength(text) });
    }
    if (kind === 'positive' && !spans.length) throw new Error(`group-d: positive ${id} has no span`);
    if (kind === 'control' && spans.length) throw new Error(`group-d: control ${id} has a secret part`);
    const classExt = kind === 'control' && source === 'generated' && (text.includes('\u2022') || /\{\{ (secrets|outputs)\./.test(text));
    cases.push({
      id, family, group: 'D', part: partOf(family), kind, layout, axes: classExt ? [...axes, 'class-extension'] : axes, claims: row(family).claims, text,
      expected: kind === 'positive' ? spans[0] : null, expectedExtra: kind === 'positive' ? spans.slice(1) : [],
      expectedType: null, expectedAction: null, note,
      ...(kind === 'unsupported' || kind === 'conflict' ? { probeSpans: spans } : {}),
      trace: { caseId, caseOutcome: c.outcome, fixtureIds: fixtures ?? [], clause, source, ...(SHARED_WITH_GROUP_C.includes(id) ? { sharedWithGroupC: 'meta:app-secret' } : {}), ...(DOWNGRADED[id] ? { downgraded: true, downgradedFrom: 'positive', ruling: DOWNGRADED[id] } : {}), ...(sharedWith?.length ? { sharedWith } : {}), ...(reason ? { observedReason: reason } : {}) },
    });
  };
  const obs = (family, layout, parts, note, axes, caseId, reason, clause, fixtures) => add({ family, kind: 'unsupported', layout, parts, note, axes, caseId, fixtures, clause: clause ?? 'no outcome asserted by the Case', reason });

  // ======================= verbatim Case fixtures =======================
  for (const f of FIXTURES) {
    const c = CASES.get(f.case);
    const contradiction = CONTRADICTIONS[f.id];
    const family = contradiction?.row ?? c.inRows[0];
    if (!family) throw new Error(`group-d: fixture ${f.id} has no row`);
    const sharedWith = c.inRows.filter((x) => x !== family);
    let kind;
    if (contradiction) kind = 'conflict';
    else if (f.outcome === 'must-flag') kind = 'positive';
    else if (f.outcome === 'must-not-flag') kind = 'control';
    else kind = 'unsupported';
    let parts;
    if (kind === 'positive') {
      parts = [];
      let at = 0;
      const bytes = Buffer.from(f.text, 'utf8');
      for (const s of [...f.spans].sort((a, b) => a.start - b.start)) {
        if (s.role !== 'secret') throw new Error(`group-d: ${f.id} span role ${s.role}`);
        parts.push(bytes.subarray(at, s.start).toString('utf8'), { secret: bytes.subarray(s.start, s.end).toString('utf8') });
        at = s.end;
      }
      parts.push(bytes.subarray(at).toString('utf8'));
    } else parts = [f.text];
    const shortId = f.id.replace(/^[a-z0-9-]+?--/, '');
    add({
      family, kind, layout: `fixture-${shortId}`, parts, source: 'fixture', sharedWith,
      note: contradiction ? `${contradiction.note}. Observed only, not a scored control.` : `evidence fixture ${f.id} (${f.context}), text verbatim`,
      axes: contradiction ? ['contradiction', 'near-miss-value'] : kind === 'positive' ? ['direct-slot', 'delimiter-after'] : kind === 'control' ? ['near-miss-value'] : ['role-ambiguity', 'policy-limited'],
      caseId: f.case, fixtures: [f.id], clause: contradiction ? contradiction.note : kind === 'positive' ? 'span = the fixture secret span only (Case extent)' : kind === 'control' ? 'whole-input must-not-flag (Case outcome)' : 'Case outcome not-assertable',
      reason: contradiction ? 'contradiction' : kind === 'unsupported' ? 'not-assertable fixture' : undefined,
    });
  }

  // ======================= header / Bearer / ApiKey carriers (scored rows) =======================
  const headerRow = (family, S) => {
    const name = S.name;
    const scheme = S.scheme ?? '';
    const req = S.req;
    const [alpha, len0] = S.body;
    const len = len0 || 60;
    const val = (slug, n = len, a = alpha) => (S.value ? S.value(slug) : synth(`${family}:${slug}`, n, a));
    const sec = (slug, n, a) => ({ secret: val(slug, n, a) });
    const pubLine = S.pub ? `${S.pub[0]}: ${S.pub[1]}\r\n` : '';
    const pubLineLf = S.pub ? `${S.pub[0]}: ${S.pub[1]}\n` : '';
    const caseId = S.pos;
    const fx = fixturesOf(caseId);
    const P = (layout, parts, note, axes, clause = 'span = value after the header name (and scheme) only; Case extent') =>
      add({ family, kind: 'positive', layout, parts, note, axes, caseId, fixtures: fx, clause });
    const hv = `${name}: ${scheme}`;
    P('raw-http-crlf', [`${req}\r\nHost: ${S.host ?? host}\r\n${pubLine}${hv}`, sec('p1'), '\r\nContent-Type: application/json\r\n\r\n'], 'raw request, CRLF, public header before', ['direct-slot', 'delimiter-after', 'line-ending', 'neighbouring-public-field']);
    P('raw-http-lf', [`${req}\nHost: ${S.host ?? host}\n${pubLineLf}${hv}`, sec('p2'), '\nContent-Type: application/json\n\n{"acl":["addObject"],"validity":3600}\n'], 'raw request, LF, JSON body after', ['direct-slot', 'delimiter-after']);
    P('raw-http-eof', [`${req}\r\nHost: ${S.host ?? host}\r\n${hv}`, sec('p3')], 'value is the last byte of the input', ['end-of-input', 'stream-cut']);
    const rq = S.ctx ? `${req}\r\n` : '';
    const jurl = S.ctx ? `"method": "POST", "url": "https://${S.host ?? host}${S.path ?? '/synthetic'}", ` : '';
    const curlCtx = S.ctx ? `curl -X POST "https://${S.host ?? host}${S.path ?? '/synthetic'}" -H "` : 'curl -s -H "';
    P('raw-http-first-header', [`${rq}${hv}`, sec('p4'), `\r\nHost: ${S.host ?? host}\r\n`], 'slot is the first line of the input', ['direct-slot', 'delimiter-before']);
    P('raw-http-trailing-whitespace', [`${req}\r\n${hv}`, sec('p5'), '   \t\r\nHost: x.example.test\r\n'], 'trailing spaces and a tab before the line end', ['line-ending', 'delimiter-after']);
    P('curl-double', [`curl -X POST "https://${S.host ?? host}${S.path ?? '/synthetic'}" -H "${S.pub ? `${S.pub[0]}: ${S.pub[1]}" -H "` : ''}${hv}`, sec('p6'), '" -d \'{"acl":["addObject"]}\'\n'], 'double-quoted curl -H, value then closing quote', ['delimiter-after', 'neighbouring-public-field']);
    P('curl-single', [`curl -X POST 'https://${S.host ?? host}${S.path ?? '/synthetic'}' -H '${hv}`, sec('p7'), `' -H 'Content-Type: application/json'\n`], 'single-quoted curl -H', ['delimiter-after']);
    P('curl-eof-quote', [curlCtx + hv, sec('p8'), '"'], 'closing quote is the last byte', ['delimiter-after', 'end-of-input']);
    P('json-header-map', [`{\n  "method": "POST",\n  "url": "https://${S.host ?? host}${S.path ?? '/synthetic'}",\n  "headers": {\n    ${S.pub ? `"${S.pub[0]}": "${S.pub[1]}",\n    ` : ''}"${name}": "${scheme}`, sec('p9'), '"\n  }\n}\n'], 'pretty JSON header map, value then quote and newline', ['delimiter-after', 'nesting', 'neighbouring-public-field']);
    P('json-header-map-compact', [`{${jurl}"headers":{"Accept":"application/json","${name}":"${scheme}`, sec('p10'), '","X-Id":"1"}}\n'], 'compact JSON, value then quote and comma', ['delimiter-after', 'nesting']);
    P('json-header-map-spaced', [`{ ${jurl}"headers" : { "${name}" : "${scheme}`, sec('p11'), '" } }\n'], 'spaces around the colons', ['delimiter-before', 'delimiter-after']);
    P('json-header-map-crlf-tabs', [`{\r\n\t${S.ctx ? `"url": "https://${S.host ?? host}${S.path ?? '/synthetic'}",\r\n\t` : ''}"headers": {\r\n\t\t"${name}": "${scheme}`, sec('p12'), '",\r\n\t\t"Accept": "*/*"\r\n\t}\r\n}\r\n'], 'CRLF and tabs', ['line-ending', 'delimiter-before']);
    P('json-nested-array', [`{"requests":[{"headers":{"Accept":"x"}},{${jurl}"headers":{"${name}":"${scheme}`, sec('p13'), '"}}],"n":2}\n'], 'inside the second element of an array', ['nesting']);
    P('utf8-before-after', [`// ${MB}\n${rq}${hv}`, sec('p14'), `\r\nX-Note: ${MB}\r\n`], 'multi-byte text before the slot and after the value', ['utf8-preceding', 'utf8-following']);
    P('utf8-json', [`{"note":"${MB}",${jurl}"headers":{"${name}":"${scheme}`, sec('p15'), `","after":"${MB}"}}\n`], 'multi-byte text around a JSON slot', ['utf8-preceding', 'utf8-following', 'nesting']);
    P('big-preceding', [`${'x'.repeat(63)}\n`.repeat(80), `${rq}${hv}`, sec('p16'), '\r\n'], 'about 5 KB of unrelated lines first', ['big-preceding']);
    P('neighbouring-secret', [`${rq}${hv}`, sec('p17'), `\r\nCookie: sid=${synth(`${family}:sid`, 24, HEX)}\r\nX-Other-Secret: ${synth(`${family}:os`, 24, ALNUM)}\r\n`], 'other credentials in neighbouring headers', ['neighbouring-secret']);
    P('same-shape-neighbour', [`${rq}X-Request-Id: ${synth(`${family}:ss1`, len, alpha)}\r\n${hv}`, sec('p18'), `\r\nX-Trace: ${synth(`${family}:ss2`, len, alpha)}\r\n`], 'public headers with the secret value alphabet and length on both sides', ['same-shape-neighbour']);
    P('repeat', [`${rq}${hv}`, sec('rep'), `\r\n\r\n${S.ctx ? curlCtx : 'curl -H "'}${hv}`, { secret: val('rep') }, '" https://x.example.test/\n'], 'the same value twice', ['repeat-secret']);
    if (!S.value) {
      P('shape-short', [`${req}\r\n${hv}`, sec('sh1', 12, ALNUM), '\r\n'], 'a 12-byte value: the Case admits a value by its slot, not by shape', ['value-shape-agnostic']);
      P('shape-long', [`${req}\r\n${hv}`, sec('sh2', 96, URLSAFE), '\r\n'], 'a 96-byte value', ['value-shape-agnostic']);
      P('shape-marker', [`${req}\r\n${hv}`, { secret: `SYNTHETIC-${family.replace(/[^a-z0-9]+/gi, '-')}-never-issued-0${synth(`${family}:mk`, 3, DIGITS)}` }, '\r\n'], 'the evidence fixtures\' own marker form', ['value-shape-agnostic']);
      P('shape-punctuated', [`${req}\r\n${hv}`, sec('sh3', 40, B64TOKEN), '\r\n'], 'value over the whole RFC 6750 b64token alphabet', ['value-shape-agnostic', 'alphabet']);
      P('shape-hex', [`${req}\r\n${hv}`, sec('sh4', 32, HEX), '\r\n'], 'a 32-hexadecimal value (admitted by slot, not by shape)', ['value-shape-agnostic', 'alphabet']);
    }
    // controls: the Case's own non-value categories on every carrier it names
    const ctlCase = S.ctl;
    const cfx = fixturesOf(ctlCase);
    const C = (layout, parts, note, axes, clause = 'whole-input must-not-flag (Case: placeholder, reference, mask, empty value or prose carries no value)') =>
      add({ family, kind: 'control', layout, parts, note, axes, caseId: ctlCase, fixtures: cfx, clause, sharedWith: S.sharedWith });
    const ph = (S.placeholders ?? []);
    const slots = [
      ['angle', `<${S.angle ?? 'API_KEY'}>`],
      ['env-reference', `$${S.env ?? 'API_KEY'}`],
      ['env-braces', `\${${S.env ?? 'API_KEY'}}`],
      ['template', `{{ secrets.${S.env ?? 'API_KEY'} }}`],
      ['mask-stars', '********'],
      ['mask-bullets', '••••••••'],
      ...ph.map((p, i) => [`documented-${i}`, p]),
    ];
    for (const [slug, v] of slots) {
      C(`raw-${slug}`, [`${req}\r\nHost: ${S.host ?? host}\r\n${hv}${v}\r\n`], `${slug} in the slot, raw request`, ['near-miss-value']);
      C(`curl-${slug}`, [`curl -H "${hv}${v}" https://${S.host ?? host}${S.path ?? '/synthetic'}\n`], `${slug} in a curl -H`, ['near-miss-value']);
      C(`json-${slug}`, [`{"headers":{"${name}":"${scheme}${v}","Accept":"application/json"}}\n`], `${slug} in a JSON header map`, ['near-miss-value', 'nesting']);
    }
    C('raw-empty', [`${req}\r\nHost: ${S.host ?? host}\r\n${name}:\r\n`], 'header with no value', ['near-miss-value']);
    C('raw-empty-eof', [`${name}:`], 'empty header at the end of the input', ['near-miss-value', 'end-of-input']);
    if (scheme) {
      C('raw-scheme-only', [`${req}\r\nHost: ${S.host ?? host}\r\n${name}: ${scheme.trim()}\r\n`], 'scheme with no value', ['near-miss-value']);
      C('raw-scheme-only-eof', [`${name}: ${scheme.trim()}`], 'scheme with no value, end of input', ['near-miss-value', 'end-of-input']);
    }
    C('prose', [`Send the key in the ${name} header${scheme ? ` after the ${scheme.trim()} scheme` : ''} and keep it out of frontend code.\n`], 'prose naming the slot', ['near-miss-name']);
    C('prose-path', [`See https://docs.example.test/${name}/reference for the ${name} header.\n`], 'the name inside a path', ['near-miss-name']);
    for (const extra of S.extraControls ?? []) C(extra.layout, extra.parts, extra.note, extra.axes, extra.clause);
    // observed (representation and boundary variants the Case does not settle)
    const O = (layout, parts, note, axes, clause) => obs(family, layout, parts, note, axes, caseId, 'representation or boundary variant the Case does not assert', clause ?? 'variant the Case does not name; observed only', fx);
    O('upper-name', [`${req}\r\n${S.upperName ?? name.toUpperCase()}: ${scheme}`, sec('o1'), '\r\n'], 'upper-cased header name', ['representation']);
    O('prefixed-name', [`${req}\r\nX-Forwarded-${name}: ${scheme}`, sec('o2'), '\r\n'], 'a longer header name ending in the slot name', ['glued-name', 'representation']);
    O('name-suffix', [`${req}\r\n${name}-Id: ${scheme}`, sec('o3'), '\r\n'], 'the slot name with a suffix', ['glued-name', 'representation']);
    O('no-space-after-colon', [`${req}\r\n${name}:${scheme}`, sec('o4'), '\r\n'], 'no space after the colon', ['representation', 'delimiter-before']);
    O('value-on-next-line', [`${req}\r\n${name}:${scheme ? scheme.trim() : ''}\r\n`, sec('o5'), '\r\n'], 'value on the following line', ['representation']);
    O('below-floor-7', [`${req}\r\n${hv}`, sec('o6', 7), '\r\n'], 'a 7-byte value', ['near-miss-value', 'value-shape-agnostic']);
    O('lowentropy', [`${req}\r\n${hv}`, { secret: 'abcabcabcabca' }, '\r\n'], 'a 13-byte low-entropy literal', ['value-entropy', 'value-shape-agnostic']);
    O('null-undefined', [`${req}\r\n${hv}null\r\n${hv}undefined\r\n`], 'null and undefined literals (not a Case category)', ['near-miss-value']);
    O('percent-value', [`${req}\r\n${hv}${synth(`${family}:pc1`, 20)}%2F${synth(`${family}:pc2`, 12)}%3D\r\n`], 'percent-containing value', ['representation']);
    O('single-quoted-json', [`{'${name}': '${scheme}`, sec('o7'), `'}\n`], 'Python-style single quotes', ['representation']);
    O('yaml-header', [`headers:\n  ${name}: ${scheme}`, sec('o8'), '\n'], 'YAML mapping', ['representation', 'direct-slot']);
    O('env-assignment', [`${S.envVar ?? name.toUpperCase().replace(/-/g, '_')}=`, sec('o9'), '\n'], 'environment-variable assignment named for the slot', ['representation']);
    O('proxy-authorization', [`${req}\r\nProxy-Authorization: ${scheme || 'Bearer '}`, sec('o10'), '\r\n'], 'Proxy-Authorization is not the named carrier', ['representation']);
    for (const extra of S.extraObserved ?? []) O(extra.layout, extra.parts, extra.note, extra.axes, extra.clause);
  };

  // ---- algolia:admin-api-key (create-key request header; same header elsewhere is policy-limited)
  headerRow('algolia:admin-api-key', {
    name: 'x-algolia-api-key', req: 'POST /synthetic-create-api-key HTTP/1.1', host: 'example-dsn.example.test', path: '/synthetic-create-api-key',
    body: [ALNUM, 40], pub: ['x-algolia-application-id', `SYNTHETIC-${synth('algolia:appid', 12, LOWER)}`], pos: ROWS['algolia:admin-api-key'].pos, ctl: ROWS['algolia:admin-api-key'].ctl,
    ctx: true, angle: 'ALGOLIA_ADMIN_API_KEY', env: 'ALGOLIA_WRITE_API_KEY', upperName: 'X-Algolia-API-Key', envVar: 'ALGOLIA_ADMIN_API_KEY',
    sharedWith: ['algolia:search-only-api-key', 'algolia:secured-api-key', 'algolia:write-api-key'],
  });
  // the shared Algolia controls are attached to the row above; add the Case's index-name control variants
  for (const [slug, text, note] of [
    ['index-name-json', '{\n  "indexName": "synthetic_products",\n  "params": "query=shoes"\n}\n', 'index name in a body with no key'],
    ['index-name-url', 'POST /1/indexes/synthetic_products/query HTTP/1.1\r\nHost: example-dsn.example.test\r\n\r\n{"params":"query=shoes"}\r\n', 'index name in the path, no key header'],
    ['index-name-curl', 'curl "https://example-dsn.example.test/1/indexes/synthetic_products/query" -d \'{"params":"query=shoes"}\'\n', 'index name in a curl URL, no key header'],
    ['index-name-long', `{"indexName":"${synth('algolia:idx', 32, LOWER)}","params":"query=${synth('algolia:q', 24, LOWER)}"}\n`, 'an index name with the shape of a key but no key slot (the Case states index names are public)'],
  ]) add({ family: 'algolia:admin-api-key', kind: 'control', layout: slug, parts: [text], note, axes: ['neighbouring-public-field', 'same-shape-neighbour'], caseId: ROWS['algolia:admin-api-key'].ctl, fixtures: fixturesOf(ROWS['algolia:admin-api-key'].ctl), clause: 'index names are public (search-only-api-key-index-names-are-public); no key slot', sharedWith: ['algolia:search-only-api-key', 'algolia:secured-api-key', 'algolia:write-api-key'] });
  // observed: the same header on a request that is not the create-key endpoint
  {
    const fam = 'algolia:admin-api-key';
    const k = (slug) => ({ secret: synth(`${fam}:else:${slug}`, 32, HEX) });
    const na = ROWS[fam].pos;
    const o = (layout, parts, note, axes) => obs(fam, layout, parts, note, axes, na, 'policy-limited: the same x-algolia-api-key header outside the create-key request (Case rationale: every role travels in this header, search-only is frontend-safe)', 'attribution by endpoint context only', fixturesOf(na));
    o('other-endpoint-search-raw', ['POST /1/indexes/synthetic_products/query HTTP/1.1\r\nHost: example-dsn.example.test\r\nx-algolia-api-key: ', k('s1'), '\r\n\r\n{"params":"query=shoes"}\r\n'], 'header on a search request', ['endpoint-context', 'role-ambiguity']);
    o('other-endpoint-index-write-raw', ['POST /1/indexes/synthetic_products HTTP/1.1\r\nHost: example-dsn.example.test\r\nx-algolia-api-key: ', k('s2'), '\r\n\r\n{"name":"x"}\r\n'], 'header on an indexing request', ['endpoint-context', 'role-ambiguity']);
    o('other-endpoint-curl', ['curl "https://example-dsn.example.test/1/indexes/synthetic_products/query" -H "x-algolia-api-key: ', k('s3'), '"\n'], 'curl on a search request', ['endpoint-context', 'role-ambiguity']);
    o('other-endpoint-json', ['{"url":"https://example-dsn.example.test/1/indexes/synthetic_products/query","headers":{"x-algolia-api-key":"', k('s4'), '"}}\n'], 'JSON header map on a search request', ['endpoint-context', 'role-ambiguity']);
    o('create-key-path-different-verb', ['GET /synthetic-create-api-key HTTP/1.1\r\nHost: example-dsn.example.test\r\nx-algolia-api-key: ', k('s5'), '\r\n'], 'the stand-in create-key path with a GET', ['endpoint-context']);
    o('admin-named-variable', ['ALGOLIA_ADMIN_API_KEY=', k('s6'), '\n'], 'variable named for the admin role (role from a variable name only)', ['role-ambiguity', 'representation']);
    o('admin-in-prose', ['The Algolia admin API key is ', k('s7'), ' and must stay on the backend.\n'], 'a value stated in prose as the admin key', ['role-ambiguity', 'representation']);
  }

  // ---- Bearer rows
  headerRow('dropbox:app-auth-token', {
    name: 'Authorization', scheme: 'Bearer ', req: 'POST /2/synthetic-app-authenticated-call HTTP/1.1', path: '/2/synthetic-app-authenticated-call',
    body: [B64TOKEN, 48], pos: ROWS['dropbox:app-auth-token'].pos, ctl: ROWS['dropbox:app-auth-token'].ctl, angle: 'OAUTH2_APP_AUTH_TOKEN', env: 'DROPBOX_APP_AUTH_TOKEN', placeholders: ['<OAUTH2_APP_AUTH_TOKEN>'], upperName: 'AUTHORIZATION',
    extraControls: [
      { layout: 'client-credentials-request-placeholders', parts: ['grant_type=client_credentials&client_id=<APP_KEY>&client_secret=<APP_SECRET>\n'], note: 'client credentials request whose app key and secret are placeholders', axes: ['near-miss-value'], clause: 'Case: app key and app secret appear only as placeholders' },
      { layout: 'client-credentials-curl-env', parts: ['curl -X POST https://api.example.test/oauth2/token -d grant_type=client_credentials -d client_id=$DROPBOX_APP_KEY -d client_secret=$DROPBOX_APP_SECRET\n'], note: 'client credentials request with environment references', axes: ['near-miss-value'], clause: 'Case: references carry no value' },
      { layout: 'basic-header-angle-placeholder', parts: ['POST /oauth2/token HTTP/1.1\r\nHost: api.example.test\r\nAuthorization: Basic <BASE64_OF_APP_KEY_COLON_APP_SECRET>\r\n'], note: 'Basic header over a placeholder', axes: ['near-miss-value'], clause: 'Case: Basic header over a placeholder' },
    ],
  });
  headerRow('hubspot:static-auth-access-token', {
    name: 'Authorization', scheme: 'Bearer ', req: 'GET /crm/v3/objects/contacts HTTP/1.1', path: '/crm/v3/objects/contacts',
    body: [B64TOKEN, 44], pos: ROWS['hubspot:static-auth-access-token'].pos, ctl: ROWS['hubspot:static-auth-access-token'].ctl, angle: 'STATIC_AUTH_ACCESS_TOKEN', env: 'STATIC_AUTH_ACCESS_TOKEN', placeholders: ['***-***-*********-****-****-****-************', '********-****-****-****-************'], upperName: 'AUTHORIZATION',
    extraControls: [
      { layout: 'prose-app-settings', parts: ['The static auth access token is found in the app settings and is sent as a Bearer token.\n'], note: 'prose naming the token and the slot', axes: ['near-miss-name'], clause: 'Case: prose that names the slot' },
    ],
    extraObserved: [
      { layout: 'uuid-shaped-value', parts: ['GET /crm/v3/objects/contacts HTTP/1.1\r\nAuthorization: Bearer ', { secret: [8, 4, 4, 4, 12].map((n, i) => synth(`hubspot:uuid:${i}`, n, HEX)).join('-') }, '\r\n'], note: 'a UUID-shaped value (the placeholder has seven groups; no shape is stated)', axes: ['value-shape-agnostic', 'role-ambiguity'], clause: 'static-auth-placeholder-is-not-a-format-statement' },
      { layout: 'legacy-prefix-shape', parts: ['GET /crm/v3/objects/contacts HTTP/1.1\r\nAuthorization: Bearer ', { secret: `${PREFIX.hubspot}${[8, 4, 4, 4, 12].map((n, i) => synth(`hubspot:pat:${i}`, n, HEX)).join('-')}` }, '\r\n'], note: 'a legacy private-app-token-shaped value assembled at run time; the relation to static auth is unresolved', axes: ['prefix-shape', 'role-ambiguity'], clause: 'pages-do-not-relate-static-auth-and-private-app-tokens' },
    ],
  });
  // ---- ApiKey row
  {
    const sf = (slug) => b64(`${synth(`elastic:serverless:${slug}:id`, 20, URLSAFE)}:${synth(`elastic:serverless:${slug}:key`, 22, URLSAFE)}`);
    headerRow('elastic:serverless-project-api-key', {
      name: 'Authorization', scheme: 'ApiKey ', req: 'GET /synthetic-search HTTP/1.1', host: 'project.example.test', path: '/synthetic-search',
      body: [URLSAFE, 0], value: sf, pos: ROWS['elastic:serverless-project-api-key'].pos, ctl: ROWS['elastic:serverless-project-api-key'].ctl, angle: 'ENCODED_API_KEY', env: 'API_KEY', upperName: 'AUTHORIZATION',
      extraObserved: [
        { layout: 'create-response-encoded-member', parts: ['{"id":"', synth('elastic:serverless:resp:id', 20, URLSAFE), '","name":"synthetic-key","encoded":"', { secret: sf('resp') }, '"}\n'], note: 'the shared create-response type with an encoded member (serverless-create-response-type-is-shared); no Serverless response Case', axes: ['role-ambiguity', 'nesting'], clause: 'serverless-create-response-type-is-shared' },
        { layout: 'bearer-scheme', parts: ['GET /synthetic-search HTTP/1.1\r\nAuthorization: Bearer ', { secret: sf('bearer') }, '\r\n'], note: 'the encoded key under the Bearer scheme', axes: ['representation'], clause: 'variant the Case does not name' },
        { layout: 'lowercase-scheme', parts: [`authorization: apikey ${sf('lc')}\r\n`], note: 'lower-case header name and scheme', axes: ['representation'], clause: 'variant the Case does not name' },
      ],
    });
  }
  // ---- plain header rows
  headerRow('figma:plan-access-token', {
    name: 'X-Figma-Token', req: 'GET /v1/files/SYNTHETICfileKey01 HTTP/1.1', path: '/v1/files/SYNTHETICfileKey01', body: [URLSAFE, 40],
    pos: ROWS['figma:plan-access-token'].pos, ctl: ROWS['figma:plan-access-token'].ctl, angle: 'YOUR_FIGMA_TOKEN', env: 'FIGMA_TOKEN', upperName: 'X-FIGMA-TOKEN', envVar: 'FIGMA_ACCESS_TOKEN',
    extraControls: [
      { layout: 'public-file-key-and-user-id', parts: ['{\n  "file_key": "SYNTHETICfileKey01",\n  "user_id": "1234567890123"\n}\n'], note: 'file key and user id are public identifiers (Case)', axes: ['neighbouring-public-field', 'near-miss-name'], clause: 'Case: a file key or user id is a public identifier' },
      { layout: 'suffixed-header-with-public-id', parts: ['GET /v1/me HTTP/1.1\r\nHost: api.example.test\r\nX-Figma-Token-Owner: user-1234567890\r\n'], note: 'a longer header name carrying a public user id (Case: a different header)', axes: ['glued-name', 'near-miss-name'], clause: 'Case: longer or suffixed header names carrying an identifier' },
      { layout: 'suffixed-header-count', parts: ['GET /v1/me HTTP/1.1\r\nHost: api.example.test\r\nX-Figma-Token-Owner: 9876543210123\r\n'], note: 'same, different identifier', axes: ['glued-name', 'near-miss-name'], clause: 'Case: longer or suffixed header names carrying an identifier' },
    ],
    extraObserved: [
      { layout: 'prefix-shape-raw', parts: [`GET /v1/me HTTP/1.1\r\nHost: api.example.test\r\nX-Figma-Token: `, { secret: `${PREFIX.figma}${synth('figma:pfx1', 40, URLSAFE)}` }, '\r\n'], note: 'a personal-token-style prefix assembled at run time (beyond the Case fixtures)', axes: ['prefix-shape', 'direct-slot'], clause: 'the Case admits the value by slot, whatever its shape; prefix shapes beyond its fixtures are observed' },
      { layout: 'prefix-shape-curl', parts: [`curl -H "X-Figma-Token: `, { secret: `${PREFIX.figma}${synth('figma:pfx2', 36, ALNUM)}` }, '" https://api.example.test/v1/me\n'], note: 'same in a curl', axes: ['prefix-shape'], clause: 'as above' },
      { layout: 'prefix-shape-bare', parts: ['token: ', { secret: `${PREFIX.figma}${synth('figma:pfx3', 40, URLSAFE)}` }, '\n'], note: 'a prefix-shaped value with no slot', axes: ['prefix-shape', 'near-miss-name'], clause: 'no carrier; observed only' },
    ],
  });
  headerRow('zoom:build-platform-api-key', {
    name: 'x-api-key', req: 'GET /v2/videosdk/sessions HTTP/1.1', path: '/v2/videosdk/sessions', body: [ALNUM, 40],
    pos: ROWS['zoom:build-platform-api-key'].pos, ctl: ROWS['zoom:build-platform-api-key'].ctl, angle: 'ZOOM_API_KEY', env: 'ZOOM_API_KEY', placeholders: ['ZOOM_API_KEY'], upperName: 'X-API-KEY',
    extraControls: [
      { layout: 'bearer-template', parts: ['curl https://api.example.test/v2/videosdk/sessions -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json"\n'], note: 'documented Bearer template text', axes: ['near-miss-value'], clause: 'Case: the Bearer template is documentation text' },
      { layout: 'prose-either-slot', parts: ['Send the API key in the x-api-key header, or send an API key or a JWT in an Authorization Bearer header.\n'], note: 'prose naming both carriers', axes: ['near-miss-name'], clause: 'Case: prose that names the header' },
    ],
  });

  // ======================= Elastic cross-cluster response members =======================
  {
    const family = 'elastic:cross-cluster-api-key';
    const caseId = ROWS[family].pos;
    const fx = fixturesOf(caseId);
    const id = (slug) => synth(`${family}:${slug}:id`, 20, URLSAFE);
    const key = (slug) => synth(`${family}:${slug}:key`, 22, URLSAFE);
    const enc = (slug) => b64(`${id(slug)}:${key(slug)}`);
    const members = (slug, o = {}) => ({ id: id(slug), key: key(slug), enc: o.enc ?? enc(slug) });
    const P = (layout, parts, note, axes) => add({ family, kind: 'positive', layout, parts, note, axes, caseId, fixtures: fx, clause: 'spans = api_key member value and encoded member value (both); id member outside the spans and unasserted' });
    const j = (slug, pre = '', post = '') => { const m = members(slug); return { m, parts: [pre, `{"id":"${m.id}","name":"synthetic-cross-cluster-key","api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, `"}${post}`] }; };
    P('pretty-json', (() => { const m = members('a1'); return [`{\n  "id": "${m.id}",\n  "name": "synthetic-cross-cluster-key",\n  "api_key": "`, { secret: m.key }, '",\n  "encoded": "', { secret: m.enc }, '"\n}\n']; })(), 'pretty JSON response', ['direct-slot', 'multi-span', 'delimiter-after']);
    P('compact-json-raw-http', j('a2', 'HTTP/1.1 200 OK\r\ncontent-type: application/json\r\n\r\n', '\n').parts, 'raw HTTP response, compact JSON', ['direct-slot', 'multi-span']);
    P('curl-output', j('a3', '$ curl -s -X POST "https://cluster.example.test/synthetic-create-cross-cluster-api-key"\n', '\n').parts, 'curl output', ['multi-span', 'delimiter-after']);
    P('eof', j('a4').parts, 'the closing brace is the last byte', ['multi-span', 'end-of-input', 'stream-cut']);
    P('crlf-tabs', (() => { const m = members('a5'); return [`{\r\n\t"id": "${m.id}",\r\n\t"api_key": "`, { secret: m.key }, '",\r\n\t"encoded": "', { secret: m.enc }, '",\r\n\t"name": "synthetic"\r\n}\r\n']; })(), 'CRLF and tabs', ['multi-span', 'line-ending']);
    P('spaced-colons', (() => { const m = members('a6'); return [`{ "id" : "${m.id}" , "api_key" : "`, { secret: m.key }, '" , "encoded" : "', { secret: m.enc }, '" }\n']; })(), 'spaces around colons and commas', ['multi-span', 'delimiter-before', 'delimiter-after']);
    P('encoded-first', (() => { const m = members('a7'); return [`{"encoded":"`, { secret: m.enc }, `","id":"${m.id}","api_key":"`, { secret: m.key }, '"}\n']; })(), 'members in a different order', ['multi-span']);
    P('expiration-member', (() => { const m = members('a8'); return [`{"id":"${m.id}","name":"k","expiration":1791200000000,"api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, '"}\n']; })(), 'the optional expiration member between id and api_key', ['multi-span', 'neighbouring-public-field']);
    P('nested-array', (() => { const m = members('a9'); return [`{"results":[{"id":"x","name":"other"},{"id":"${m.id}","api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, '"}]}\n']; })(), 'inside the second element of an array', ['multi-span', 'nesting']);
    P('utf8-before-after', (() => { const m = members('a10'); return [`// ${MB}\n{"id":"${m.id}","api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, `","note":"${MB}"}\n`]; })(), 'multi-byte text before and after', ['multi-span', 'utf8-preceding', 'utf8-following']);
    P('big-preceding', (() => { const m = members('a11'); return [`${'x'.repeat(63)}\n`.repeat(80), `{"id":"${m.id}","api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, '"}\n']; })(), 'about 5 KB first', ['multi-span', 'big-preceding']);
    P('same-shape-id', (() => { const m = members('a12'); return [`{"id":"${synth(`${family}:ss`, 20, URLSAFE)}","name":"${synth(`${family}:ssn`, 22, URLSAFE)}","api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, '"}\n']; })(), 'public members with the key alphabet and width', ['multi-span', 'same-shape-neighbour']);
    const D = (layout, parts, note, axes) => obs(family, layout, parts, note, axes, caseId, 'container or repeat carrier not named by the Case (downgraded by blind-review erratum D-B2)', 'Case names JSON response members only', fx);
    D('repeat-response-and-log', (() => { const m = members('a13'); return [`{"api_key":"`, { secret: m.key }, '","encoded":"', { secret: m.enc }, '"}\nlog: encoded=', { secret: m.enc }, '\n']; })(), 'the encoded value repeated in a log line (a repeat of the same secret is still the secret)', ['multi-span', 'repeat-secret']);
    P('api-key-member-only', (() => { const m = members('a14'); return [`{"id":"${m.id}","api_key":"`, { secret: m.key }, '"}\n']; })(), 'a document with only the api_key member', ['direct-slot']);
    P('encoded-member-only', (() => { const m = members('a15'); return [`{"id":"${m.id}","encoded":"`, { secret: m.enc }, '"}\n']; })(), 'a document with only the encoded member', ['direct-slot']);
    P('encoded-padding-variants', [`{"api_key":"`, { secret: synth(`${family}:pv1`, 22, URLSAFE) }, '","encoded":"', { secret: `${b64(`${synth(`${family}:pv2:id`, 20, URLSAFE)}:${synth(`${family}:pv2:key`, 21, URLSAFE)}`)}` }, '"}\n'], 'encoded value with a different tail length (padding present or not follows the input)', ['multi-span', 'alphabet']);
    D('yaml-response', (() => { const m = members('a16'); return [`id: ${m.id}\nname: synthetic\napi_key: `, { secret: m.key }, '\nencoded: ', { secret: m.enc }, '\n']; })(), 'YAML rendering of the response members', ['multi-span', 'delimiter-after']);
    // controls (Case: binding attributes, placeholders, masks, empty, references, prose)
    const cc = ROWS[family].ctl;
    const cfx = fixturesOf(cc);
    const C = (layout, parts, note, axes, clause = 'whole-input must-not-flag (Case: binding attribute, placeholder, mask, empty member, reference or prose)') => add({ family, kind: 'control', layout, parts, note, axes, caseId: cc, fixtures: cfx, clause });
    for (const [slug, a, e] of [['angle', '<API_KEY>', '<ENCODED_API_KEY>'], ['mask', '********', '********'], ['empty', '', ''], ['template', '{{ outputs.api_key }}', '{{ outputs.encoded }}'], ['env-ref', '${ELASTIC_API_KEY}', '${ELASTIC_ENCODED}'], ['bullets', '••••••', '••••••']]) {
      C(`response-${slug}-pretty`, [`{\n  "name": "synthetic-cross-cluster-key",\n  "api_key": "${a}",\n  "encoded": "${e}"\n}\n`], `${slug} in both members, pretty`, ['near-miss-value']);
      C(`response-${slug}-compact`, [`HTTP/1.1 200 OK\r\n\r\n{"name":"synthetic-cross-cluster-key","api_key":"${a}","encoded":"${e}"}\n`], `${slug} in both members, compact raw response`, ['near-miss-value']);
    }
    C('request-certificate-identity', ['{\n  "name": "synthetic-cross-cluster-key",\n  "access": {\n    "search": [ { "names": [ "synthetic-index-*" ] } ]\n  },\n  "certificate_identity": "CN=remote-cluster.example.test"\n}\n'], 'request body: access and certificate_identity (Case: binding attributes)', ['neighbouring-public-field']);
    C('request-certificate-identity-compact', ['{"name":"k","access":{"replication":[{"names":["synthetic-*"]}]},"certificate_identity":"CN=remote.example.test,OU=ops"}\n'], 'compact request body with replication access', ['neighbouring-public-field']);
    C('request-expiration', ['{"name":"k","expiration":"30d","access":{"search":[{"names":["a"]}]}}\n'], 'request body with an expiration', ['neighbouring-public-field']);
    C('prose-members', ['Copy the encoded member of the response to a safe place; it is needed for the local cluster configuration.\n'], 'prose naming the members', ['near-miss-name']);
    C('prose-api-key-member', ['The api_key member and the encoded member of the response hold the key.\n'], 'prose naming both members', ['near-miss-name']);
    // observed
    const O = (layout, parts, note, axes, clause, reason) => obs(family, layout, parts, note, axes, ROWS[family].na, reason ?? 'carrier unresolved or not a named carrier', clause, fixturesOf(ROWS[family].na));
    const m = members('o1');
    O('keystore-add-command', [`echo "`, { secret: m.enc }, '" | elasticsearch-keystore add --stdin cluster.remote.synthetic_remote.credentials\n'], 'keystore slot; the setting name is not recorded in the evidence, this one is a stand-in', ['role-ambiguity', 'representation'], 'cross-cluster-key-carrier-is-local-cluster-keystore (setting name not recorded)');
    O('keystore-yaml-setting', ['cluster:\n  remote:\n    synthetic_remote:\n      credentials: ', { secret: m.enc }, '\n'], 'a YAML setting with the encoded value', ['role-ambiguity', 'representation'], 'carrier unconfirmed');
    O('authorization-apikey-header', ['GET /synthetic-search HTTP/1.1\r\nAuthorization: ApiKey ', { secret: m.enc }, '\r\n'], 'the encoded value as an Authorization ApiKey header (Elastic: refused on the REST interface)', ['representation', 'role-ambiguity'], 'cross-cluster-key-refused-on-rest-interface');
    O('id-member-only', [`{"id":"${m.id}","name":"synthetic-cross-cluster-key"}\n`], 'the id member alone (confidentiality unasserted)', ['neighbouring-public-field', 'role-ambiguity'], 'id member not asserted either way');
    O('encoded-without-members', ['encoded=', { secret: m.enc }, '\n'], 'a bare encoded assignment', ['representation'], 'not a named carrier');
    O('response-member-upper', [`{"API_KEY":"${synth(`${family}:up`, 22, URLSAFE)}","ENCODED":"${enc('up')}"}\n`], 'upper-cased member names', ['representation'], 'case variant not named');
    O('response-below-floor', [`{"api_key":"${synth(`${family}:bf`, 7, URLSAFE)}","encoded":"${synth(`${family}:bfe`, 7, URLSAFE)}"}\n`], '7-byte member values', ['near-miss-value'], 'short values');
  }

  // ======================= Instagram client_secret =======================
  {
    const family = 'meta:instagram-app-secret';
    const caseId = ROWS[family].pos;
    const fx = fixturesOf(caseId);
    const sv = (slug, n = 32, a = ALNUM) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const cid = (slug) => `1000000000${synth(`${family}:cid:${slug}`, 6, DIGITS)}`;
    const P = (layout, parts, note, axes) => add({ family, kind: 'positive', layout, parts, note, axes, caseId, fixtures: fx, clause: 'span = client_secret value only; Instagram App ID and other parameters outside the span' });
    P('form-post-middle', [`POST /oauth/access_token HTTP/1.1\r\nHost: api.instagram.example.test\r\nContent-Type: application/x-www-form-urlencoded\r\n\r\nclient_id=${cid('a')}&client_secret=`, sv('f1'), '&grant_type=authorization_code&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback&code={authorization-code}\r\n'], 'form body, parameters before and after', ['direct-slot', 'delimiter-after', 'neighbouring-public-field']);
    P('form-post-first', ['client_secret=', sv('f2'), `&client_id=${cid('b')}&grant_type=authorization_code`], 'first parameter, last one is the end of input', ['delimiter-before', 'end-of-input']);
    P('form-post-last-newline', [`client_id=${cid('c')}&grant_type=authorization_code&client_secret=`, sv('f3'), '\n'], 'last parameter then newline', ['delimiter-after']);
    P('form-post-eof', [`grant_type=authorization_code&client_secret=`, sv('f4')], 'value is the last byte', ['end-of-input', 'stream-cut']);
    P('curl-form-field', [`curl -X POST "https://api.instagram.example.test/oauth/access_token" -F client_id=${cid('d')} -F client_secret=`, sv('f5'), ' -F grant_type=authorization_code -F code={authorization-code}\n'], 'curl -F, value then space', ['delimiter-after']);
    P('curl-form-quoted', [`curl -X POST https://api.instagram.example.test/oauth/access_token -F "client_secret=`, sv('f6'), '" -F grant_type=authorization_code\n'], 'curl -F with quotes, value then quote', ['delimiter-after']);
    const D = (layout, parts, note, axes) => obs(family, layout, parts, note, axes, caseId, 'container not named by the Case (A3: the Case names curl form field -F, a form POST and a GET query)', 'Case names form POST, curl -F and GET query only', fx);
    D('curl-data', [`curl -s -d "client_id=${cid('e')}&client_secret=`, sv('f7'), '&grant_type=authorization_code" https://api.instagram.example.test/oauth/access_token\n'], 'curl -d body', ['delimiter-after']);
    D('curl-data-single', ["curl -s --data 'client_secret=", sv('f8'), "&grant_type=authorization_code' https://api.instagram.example.test/oauth/access_token\n"], 'curl --data single-quoted', ['delimiter-after']);
    P('long-lived-query', ['GET /access_token?grant_type=ig_exchange_token&client_secret=', sv('q1'), '&access_token={short-lived-access-token} HTTP/1.1\r\nHost: graph.instagram.example.test\r\n'], 'GET query, followed by & and an HTTP version later', ['direct-slot', 'delimiter-after', 'nesting']);
    P('long-lived-query-space', ['GET /access_token?grant_type=ig_exchange_token&access_token={short-lived-access-token}&client_secret=', sv('q2'), ' HTTP/1.1\r\nHost: graph.instagram.example.test\r\n'], 'last query parameter, then space and HTTP version', ['delimiter-after']);
    P('long-lived-curl-url', ['curl -i -X GET "https://graph.instagram.example.test/access_token?grant_type=ig_exchange_token&client_secret=', sv('q3'), '&access_token={short-lived-access-token}"\n'], 'curl URL', ['nesting', 'delimiter-after']);
    D('long-lived-url-fragment', ['https://graph.instagram.example.test/access_token?grant_type=ig_exchange_token&client_secret=', sv('q4'), '#section\n'], 'value ends at a URL fragment marker', ['delimiter-after', 'nesting']);
    P('form-crlf-env-file', ['NOTE=1\r\nclient_secret=', sv('f9'), '\r\nNEXT=1\r\n'], 'CRLF key=value lines', ['line-ending']);
    P('utf8-before-after', [`# ${MB}\nclient_secret=`, sv('f10'), `&note=${MB}\n`], 'multi-byte text around the slot', ['utf8-preceding', 'utf8-following']);
    P('big-preceding', [`${'x'.repeat(63)}\n`.repeat(80), 'client_secret=', sv('f11'), '&x=1\n'], 'about 5 KB first', ['big-preceding']);
    P('same-shape-neighbour', [`client_id=${synth(`${family}:ssn1`, 32, ALNUM)}&client_secret=`, sv('f12'), `&code=${synth(`${family}:ssn2`, 32, ALNUM)}\n`], 'same-shape public values on both sides', ['same-shape-neighbour']);
    P('neighbouring-secret', ['client_secret=', sv('f13'), `&code=${synth(`${family}:ns`, 40, URLSAFE)}&access_token=${synth(`${family}:nsa`, 60, ALNUM)}\n`], 'other credentials in the same body', ['neighbouring-secret']);
    P('repeat', ['client_secret=', sv('rep'), '&x=1\ncurl -d "client_secret=', { secret: synth(`${family}:rep`, 32, ALNUM) }, '" https://x.example.test/\n'], 'the same value twice', ['repeat-secret']);
    P('shape-short', ['client_secret=', sv('sh1', 12), '&grant_type=authorization_code\n'], 'a 12-byte value (the evidence states no length)', ['value-shape-agnostic']);
    P('shape-hex32', ['client_secret=', sv('sh2', 32, HEX), '&grant_type=authorization_code\n'], 'a 32-hexadecimal value', ['value-shape-agnostic', 'alphabet']);
    P('shape-marker', ['client_secret=', { secret: 'SYNTHETIC-meta-instagram-app-secret-never-issued-0' + synth(`${family}:mk`, 3, DIGITS) }, '&grant_type=authorization_code\n'], 'the fixture marker form', ['value-shape-agnostic']);
    const cc = ROWS[family].ctl;
    const cfx = fixturesOf(cc);
    const C = (layout, parts, note, axes) => add({ family, kind: 'control', layout, parts, note, axes, caseId: cc, fixtures: cfx, clause: 'whole-input must-not-flag (Case: placeholder, reference, mask, empty field or prose carries no value; no App ID literal appears)' });
    for (const [slug, v] of [['angle', '<INSTAGRAM_APP_SECRET>'], ['env-reference', '${INSTAGRAM_APP_SECRET}'], ['env-dollar', '$INSTAGRAM_APP_SECRET'], ['template', '{{ secrets.INSTAGRAM_APP_SECRET }}'], ['mask', '********'], ['bullets', '••••••••'], ['short-doc-placeholder', '{app-secret}']]) {
      C(`form-${slug}`, [`client_secret=${v}&grant_type=authorization_code\n`], `${slug}, form body`, ['near-miss-value']);
      C(`query-${slug}`, [`GET /access_token?grant_type=ig_exchange_token&client_secret=${v}&access_token={short-lived-access-token} HTTP/1.1\r\nHost: graph.instagram.example.test\r\n`], `${slug}, long-lived exchange query`, ['near-miss-value', 'nesting']);
      C(`curl-form-${slug}`, [`curl -F client_secret=${v} -F grant_type=authorization_code "https://api.instagram.example.test/oauth/access_token"\n`], `${slug}, curl -F`, ['near-miss-value']);
    }
    C('form-empty', ['client_secret=&grant_type=authorization_code\n'], 'empty field', ['near-miss-value']);
    C('query-empty', ['GET /access_token?grant_type=ig_exchange_token&client_secret=&access_token={short-lived-access-token} HTTP/1.1\r\n'], 'empty query parameter', ['near-miss-value']);
    C('prose', ['Send your Instagram App Secret as the client_secret field from server-side code only.\n'], 'prose naming the field', ['near-miss-name']);
    C('prose-server-side', ['The long-lived exchange includes the app secret and must be made in server-side code.\n'], 'prose naming the exchange', ['near-miss-name']);
    const O = (layout, parts, note, axes, clause, ca = ROWS[family].na) => obs(family, layout, parts, note, axes, ca, 'carrier or relation the Case does not settle', clause, fixturesOf(ca));
    O('app-id-beside-secret-env', [`INSTAGRAM_APP_ID=${cid('o1')}\nINSTAGRAM_APP_SECRET=`, sv('o1'), '\n'], 'an App ID variable beside a named secret variable', ['role-ambiguity', 'neighbouring-public-field'], 'instagram-app-secret-shown-with-instagram-app-id');
    O('json-client-secret-member', ['{"client_secret":"', sv('o2'), '","client_id":"', cid('o2'), '"}\n'], 'client_secret as a JSON member (not a named carrier)', ['representation']);
    O('percent-value', [`client_secret=${synth(`${family}:pc1`, 20)}%2F${synth(`${family}:pc2`, 10)}%3D&grant_type=authorization_code\n`], 'percent-containing value', ['representation']);
    O('upper-name', ['CLIENT_SECRET=', sv('o3'), '\n'], 'upper-cased name', ['representation']);
    O('prefixed-name', ['instagram_client_secret=', sv('o4'), '\n'], 'prefixed name', ['glued-name', 'representation']);
    O('below-floor-7', ['client_secret=', sv('o5', 7), '\n'], '7-byte value', ['near-miss-value']);
    O('lowentropy', ['client_secret=', { secret: 'abcabcabcabca' }, '\n'], 'low-entropy literal', ['value-entropy']);
    O('meta-app-secret-same-value', [`access_token=${cid('o6')}|`, sv('o6'), `\nclient_secret=`, { secret: synth(`${family}:o6`, 32, ALNUM) }, '\n'], 'the same value as a Meta app-secret pair and an Instagram client_secret (same-value relation unresolved)', ['role-ambiguity', 'repeat-secret'], 'instagram-secret-same-value-as-meta-app-secret');
    O('appsecret-proof-instagram', [`GET /me?access_token={token}&appsecret_proof=${synth(`${family}:prf`, 64, HEX)} HTTP/1.1\r\n`], 'an appsecret_proof-style derived value on an Instagram call (applicability unstated)', ['derived-value', 'policy-limited'], 'instagram-secret-derived-outputs-unstated');
  }

  // ======================= Meta app-id-and-secret pair =======================
  {
    const family = 'meta:app-access-token';
    const caseId = ROWS[family].pos;
    const fx = fixturesOf(caseId);
    const aid = (slug, n = 16) => `1${synth(`${family}:aid:${slug}`, n - 1, DIGITS)}`;
    const sv = (slug, n = 32, a = ALNUM) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const P = (layout, parts, note, axes) => add({ family, kind: 'positive', layout, parts, note, axes, caseId, fixtures: fx, clause: 'span = the part after the pipe of an app-id|secret access_token value; the app ID before it is outside the span' });
    P('raw-get-line', [`GET /v26.0/me?access_token=${aid('a')}|`, sv('a1'), ' HTTP/1.1\r\nHost: graph.example.test\r\n'], 'request line, secret then space', ['direct-slot', 'delimiter-after']);
    P('curl-url-quoted', [`curl -i -X GET "https://graph.example.test/v26.0/me?access_token=${aid('b')}|`, sv('a2'), '"\n'], 'curl URL, secret then closing quote', ['delimiter-after']);
    P('query-continues', [`https://graph.example.test/v26.0/me?fields=id&access_token=${aid('c')}|`, sv('a3'), '&debug=all\n'], 'query continues with another parameter', ['delimiter-after', 'nesting']);
    P('eof', [`access_token=${aid('d')}|`, sv('a4')], 'secret is the last byte', ['end-of-input', 'stream-cut']);
    P('query-first-param', [`GET /v26.0/me?access_token=${aid('e')}|`, sv('a5'), '&fields=id,name HTTP/1.1\r\n'], 'first query parameter', ['delimiter-after']);
    const D = (layout, parts, note, axes) => obs(family, layout, parts, note, axes, caseId, 'container not named by the Case (A3)', 'Case names request line, curl URL and query string only', fx);
    D('url-fragment', [`https://graph.example.test/v26.0/me?access_token=${aid('f')}|`, sv('a6'), '#x\n'], 'secret then fragment marker', ['delimiter-after']);
    P('curl-single-quoted', [`curl 'https://graph.example.test/v26.0/me?access_token=${aid('g')}|`, sv('a7'), `'\n`], 'single-quoted curl URL', ['delimiter-after']);
    D('html-href', [`<a href="https://graph.example.test/v26.0/me?access_token=${aid('h')}|`, sv('a8'), '&x=1">link</a>\n'], 'inside an HTML href', ['nesting', 'delimiter-after']);
    P('crlf-end', [`GET /v26.0/me?access_token=${aid('i')}|`, sv('a9'), '\r\n'], 'CRLF right after the value', ['line-ending', 'delimiter-after']);
    P('app-id-15-digits', [`GET /v26.0/me?access_token=${aid('j', 15)}|`, sv('a10'), ' HTTP/1.1\r\n'], 'a 15-digit app ID', ['neighbouring-public-field']);
    P('app-id-17-digits', [`GET /v26.0/me?access_token=${aid('k', 17)}|`, sv('a11'), ' HTTP/1.1\r\n'], 'a 17-digit app ID', ['neighbouring-public-field']);
    P('utf8-before-after', [`# ${MB}\nGET /v26.0/me?access_token=${aid('l')}|`, sv('a12'), ` HTTP/1.1\r\nX-Note: ${MB}\r\n`], 'multi-byte text around the slot', ['utf8-preceding', 'utf8-following']);
    P('big-preceding', [`${'x'.repeat(63)}\n`.repeat(80), `access_token=${aid('m')}|`, sv('a13'), '&x=1\n'], 'about 5 KB first', ['big-preceding']);
    P('same-shape-neighbour', [`GET /v26.0/me?client_ref=${synth(`${family}:ss1`, 32, ALNUM)}&access_token=${aid('n')}|`, sv('a14'), `&request_id=${synth(`${family}:ss2`, 32, ALNUM)} HTTP/1.1\r\n`], 'same-shape public values around the pair', ['same-shape-neighbour']);
    P('neighbouring-secret', [`GET /v26.0/me?access_token=${aid('o')}|`, sv('a15'), `&other_token=${synth(`${family}:nst`, 60, ALNUM)} HTTP/1.1\r\n`], 'another credential in the query', ['neighbouring-secret']);
    P('repeat', [`access_token=${aid('p')}|`, sv('rep'), '\ncurl "https://x.example.test/?access_token=', aid('p'), '|', { secret: synth(`${family}:rep`, 32, ALNUM) }, '"\n'], 'the same pair twice', ['repeat-secret']);
    P('shape-hex32', [`GET /v26.0/me?access_token=${aid('q')}|`, sv('a16', 32, HEX), ' HTTP/1.1\r\n'], 'a 32-hexadecimal secret part', ['value-shape-agnostic', 'alphabet']);
    P('shape-short', [`GET /v26.0/me?access_token=${aid('r')}|`, sv('a17', 12), ' HTTP/1.1\r\n'], 'a 12-byte secret part', ['value-shape-agnostic']);
    P('shape-marker', [`GET /v26.0/me?access_token=${aid('s')}|`, { secret: `SYNTHETIC-meta-app-secret-never-issued-0${synth(`${family}:mk`, 3, DIGITS)}` }, ' HTTP/1.1\r\n'], 'the fixture marker form', ['value-shape-agnostic']);
    P('shape-long', [`GET /v26.0/me?access_token=${aid('t')}|`, sv('a18', 64, URLSAFE), ' HTTP/1.1\r\n'], 'a 64-byte secret part', ['value-shape-agnostic']);
    const cc = ROWS[family].ctl;
    const cfx = fixturesOf(cc);
    const C = (layout, parts, note, axes, clause = 'whole-input must-not-flag (Case: template, reference, mask or placeholder carries no secret; no app-ID literal appears)') => add({ family, kind: 'control', layout, parts, note, axes, caseId: cc, fixtures: cfx, clause });
    for (const [slug, p] of [['doc-template', '{your-app_id}|{your-app_secret}'], ['env-braces', '${META_APP_ID}|${META_APP_SECRET}'], ['env-dollar', '$META_APP_ID|$META_APP_SECRET'], ['template-secrets', '{{ secrets.META_APP_ID }}|{{ secrets.META_APP_SECRET }}'], ['angle', '<APP_ID>|<APP_SECRET>'], ['angle-secret-only', '{your-app_id}|<APP_SECRET>'], ['mask', '{your-app_id}|********'], ['bullets', '{your-app_id}|••••••••'], ['empty-secret', '{your-app_id}|']]) {
      C(`query-${slug}`, [`GET /v26.0/me?access_token=${p} HTTP/1.1\r\nHost: graph.example.test\r\n`], `${slug}, request line`, ['near-miss-value']);
      C(`curl-${slug}`, [`curl -i -X GET "https://graph.example.test/{api-endpoint}?access_token=${p}"\n`], `${slug}, curl`, ['near-miss-value']);
    }
    C('user-token-template', ['GET /v26.0/me?access_token={user-access-token} HTTP/1.1\r\n'], 'a user access token template', ['near-miss-value']);
    C('generation-call-env', ['curl -X GET "https://graph.example.test/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&grant_type=client_credentials"\n'], 'generation call with environment references', ['near-miss-value']);
    C('generation-call-angle', ['curl -X GET "https://graph.example.test/oauth/access_token?client_id=<your-app-id>&client_secret=<your-app-secret>&grant_type=client_credentials"\n'], 'generation call with angle placeholders (no app-ID literal)', ['near-miss-value']);
    C('prose', ['The app id and the app secret can be joined by a pipe and passed in the access_token parameter of a server-side call.\n'], 'prose naming the parameter', ['near-miss-name']);
    C('prose-exposure', ['Hard-coding the app access token in client code exposes the app secret.\n'], 'prose naming the exposure statement', ['near-miss-name']);
    const O = (layout, parts, note, axes, clause, ca = ROWS[family].na) => obs(family, layout, parts, note, axes, ca, 'carrier or role the Case does not settle', clause, fixturesOf(ca));
    for (const n of [20, 48, 90, 160]) O(`generated-token-response-${n}`, ['{"access_token":"', sv(`g${n}`, n, URLSAFE), '","token_type":"bearer"}\n'], `a generated token of ${n} bytes in an access_token member (the response member is not documented; length varies)`, ['role-ambiguity', 'value-shape-agnostic'], 'token-length-variable; generated-token-response-shape-unstated');
    O('generated-token-query', ['GET /v26.0/me?access_token=', sv('gq', 40, URLSAFE), ' HTTP/1.1\r\n'], 'a single generated token in access_token (no pipe)', ['role-ambiguity'], 'generated token standing unresolved');
    O('generated-token-bearer', ['GET /v26.0/me HTTP/1.1\r\nAuthorization: Bearer ', sv('gb', 40, URLSAFE), '\r\n'], 'a generated token as a Bearer value', ['role-ambiguity'], 'generated token carrier unstated');
    O('client-token-pair', [`GET /v26.0/me?access_token=${aid('ct')}|`, sv('ct', 32, HEX), ' HTTP/1.1\r\n'], 'identical layout to the positives, but the Case rationale says the same layout with a client token is documented as not secret; the layout cannot tell the roles apart', ['role-ambiguity', 'same-shape-neighbour'], 'rationale: the same layout with a client token is documented as not secret (not expressible as a layout expectation)', ROWS[family].pos);
    O('pair-in-form-body', [`access_token=${aid('fb')}|`, sv('fb'), '&fields=id\n'], 'the pair as a form field rather than a query (the Case fixtures are query layouts)', ['representation'], 'layout the Case does not name', ROWS[family].pos);
    O('pair-in-json-member', [`{"access_token":"${aid('jm')}|`, sv('jm'), '"}\n'], 'the pair as a JSON member', ['representation', 'nesting'], 'layout the Case does not name', ROWS[family].pos);
    O('pair-lowercase-param', [`GET /v26.0/me?ACCESS_TOKEN=${aid('uc')}|`, sv('uc'), ' HTTP/1.1\r\n'], 'upper-cased parameter name', ['representation'], 'layout the Case does not name', ROWS[family].pos);
    O('pair-percent-pipe', [`GET /v26.0/me?access_token=${aid('pp')}%7C`, sv('pp'), ' HTTP/1.1\r\n'], 'the pipe percent-encoded', ['representation'], 'layout the Case does not name', ROWS[family].pos);
  }

  // ======================= observed-only rows =======================
  // ---- Algolia roles 2-7
  {
    const alg = (family, o) => {
      const na = ROWS[family].na;
      const fx = fixturesOf(na);
      const why = `${o.why}: role defined by ACL or context in a header shared by every role; confidentiality or carrier unresolved`;
      const k = (slug, n = 32, a = HEX) => ({ secret: synth(`${family}:${slug}`, n, a) });
      const O = (layout, parts, note, axes, clause = o.clause) => obs(family, layout, parts, note, axes, na, why, clause, fx);
      const nm = o.header ?? 'x-algolia-api-key';
      O('raw-http', [`${o.req}\r\nHost: ${o.host}\r\nx-algolia-application-id: SYNTHETIC-${synth(`${family}:app`, 12, LOWER)}\r\n${nm}: `, k('r1'), '\r\n\r\n'], 'role header on its documented request', ['direct-slot', 'role-ambiguity', 'policy-limited']);
      O('curl', [`curl "https://${o.host}${o.path}" -H "${nm}: `, k('c1'), '"\n'], 'curl -H', ['role-ambiguity', 'policy-limited']);
      O('json-header-map', [`{"url":"https://${o.host}${o.path}","headers":{"${nm}":"`, k('j1'), '"}}\n'], 'JSON header map', ['nesting', 'role-ambiguity', 'policy-limited']);
      O('env-assignment', [`${o.env}=`, k('e1', 32, ALNUM), '\n'], 'variable named for the role', ['representation', 'role-ambiguity']);
      O('env-export-quoted', [`export ${o.env}="`, k('e2', 32, ALNUM), '"\n'], 'exported, quoted', ['representation', 'delimiter-before']);
      O('config-yaml', [`algolia:\n  ${o.cfg}: `, k('y1', 32, ALNUM), '\n'], 'configuration-file field named for the role', ['representation', 'role-ambiguity']);
      O('prose-description', [`${o.prose} `, k('p1'), '\n'], 'a value described in prose as this role', ['representation', 'role-ambiguity']);
      O('lowercase-hex-vs-marker', [`${o.req}\r\nHost: ${o.host}\r\n${nm}: `, { secret: `SYNTHETIC-algolia-${family.split(':')[1]}-never-issued-0${synth(`${family}:mk`, 3, DIGITS)}` }, '\r\n'], 'the evidence fixtures\' marker form', ['value-shape-agnostic', 'role-ambiguity']);
      for (const x of o.extra ?? []) O(x.layout, x.parts, x.note, x.axes, x.clause);
    };
    alg('algolia:search-only-api-key', { why: 'policy-limited (frontend-safe by documentation, exposure documented as a risk)', clause: 'search-only-api-key-exposure', req: 'POST /1/indexes/synthetic_products/query HTTP/1.1', host: 'example-dsn.example.test', path: '/1/indexes/synthetic_products/query', env: 'ALGOLIA_SEARCH_ONLY_API_KEY', cfg: 'searchOnlyApiKey', prose: 'The search-only API key is',
      extra: [
        { layout: 'frontend-js-client', parts: ["const client = algoliasearch('SYNTHETICAPPID', '", { secret: synth('algolia:so:js', 32, HEX) }, "');\n"], note: 'a key as the second argument of a client constructor in frontend code', axes: ['role-ambiguity', 'policy-limited', 'representation'], clause: 'search-only-api-key-exposure (frontend intent)' },
        { layout: 'frontend-public-env', parts: ['NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=', { secret: synth('algolia:so:pub', 32, HEX) }, '\n'], note: 'a public-prefixed frontend variable', axes: ['role-ambiguity', 'policy-limited', 'representation'], clause: 'search-only-api-key-exposure (frontend intent)' },
        { layout: 'html-script-config', parts: ['<script>window.algoliaConfig = {appId: "SYNTHETICAPPID", apiKey: "', { secret: synth('algolia:so:html', 32, HEX) }, '"};</script>\n'], note: 'a key in an inline page script', axes: ['role-ambiguity', 'policy-limited', 'representation'], clause: 'search-only-api-key-exposure (frontend intent)' },
      ] });
    {
      const family = 'algolia:secured-api-key';
      const parent = synth(`${family}:parent`, 32, HEX);
      const params = 'filters=user_id%3A42&validUntil=1791200000';
      const hex = createHmac('sha256', parent).update(params).digest('hex');
      const raw = createHmac('sha256', parent).update(params).digest('base64');
      const derived = [['hex-hmac', b64(`${hex}${params}`)], ['raw-hmac', b64(`${raw}${params}`)], ['hex-hmac-urlsafe', b64url(`${hex}${params}`)]];
      const na = ROWS[family].na; const fx = fixturesOf(na);
      const why = 'policy-limited: derived value (HMAC and URL-encoded parameters, base64) whose confidentiality, encoding and layout the Case leaves open; no bytes can be built without guessing, so each encoding here is a guess';
      const O = (layout, parts, note, axes, clause = 'secured-api-key-construction-documented; secured-api-key-frontend-delivery') => obs(family, layout, parts, note, axes, na, why, clause, fx);
      for (const [slug, v] of derived) {
        O(`header-${slug}`, ['POST /1/indexes/synthetic_products/query HTTP/1.1\r\nHost: example-dsn.example.test\r\nx-algolia-api-key: ', { secret: v }, '\r\n'], `derived value (${slug}) in the shared header`, ['derived-value', 'policy-limited', 'role-ambiguity']);
        O(`frontend-js-${slug}`, ["const client = algoliasearch('SYNTHETICAPPID', '", { secret: v }, "');\n"], `derived value (${slug}) in frontend code`, ['derived-value', 'policy-limited', 'representation']);
      }
      O('parent-key-backend', [`const securedKey = client.generateSecuredApiKey('`, { secret: parent }, `', { filters: 'user_id:42' });\n`], 'the parent key as the secret input of the construction (an unspecified main-key role)', ['role-ambiguity', 'representation'], 'secured-api-key-construction-documented (parent key is a main key of unspecified role)');
      O('parent-key-env', ['ALGOLIA_PARENT_API_KEY=', { secret: parent }, '\n'], 'parent key in a variable', ['role-ambiguity', 'representation']);
      O('env-secured', ['ALGOLIA_SECURED_API_KEY=', { secret: derived[0][1] }, '\n'], 'derived value in a variable named for the role', ['derived-value', 'representation']);
    }
    alg('algolia:write-api-key', { why: 'carrier-unresolved: header shared by every role, role by ACL only', clause: 'write-api-key-header-carrier', req: 'POST /1/indexes/synthetic_products HTTP/1.1', host: 'example-dsn.example.test', path: '/1/indexes/synthetic_products', env: 'ALGOLIA_WRITE_API_KEY', cfg: 'writeApiKey', prose: 'The write API key is',
      extra: [
        { layout: 'acl-listing-beside-key', parts: ['{"value":"', { secret: synth('algolia:w:acl', 32, HEX) }, '","acl":["addObject","deleteObject","deleteIndex","editSettings"]}\n'], note: 'a key beside a write ACL list (the role is attributable by ACL only)', axes: ['role-ambiguity', 'neighbouring-public-field'], clause: 'write-api-key-write-acls' },
        { layout: 'acl-search-only-beside-key', parts: ['{"value":"', { secret: synth('algolia:w:acl2', 32, HEX) }, '","acl":["search"]}\n'], note: 'the same layout with a search ACL', axes: ['role-ambiguity', 'neighbouring-public-field'], clause: 'write-api-key-write-acls' },
      ] });
    alg('algolia:analytics-api-key', { why: 'carrier-unresolved: ACL-defined role, data sensitivity open', clause: 'analytics-api-key-accepts-any-key-with-acl', req: 'GET /2/searches?index=synthetic_products HTTP/1.1', host: 'analytics.example.test', path: '/2/searches?index=synthetic_products', env: 'ALGOLIA_ANALYTICS_API_KEY', cfg: 'analyticsApiKey', prose: 'The analytics API key is' });
    alg('algolia:monitoring-api-key', { why: 'policy-limited: confidentiality not stated', clause: 'monitoring-api-key-infrastructure-scope', req: 'GET /1/status HTTP/1.1', host: 'status.example.test', path: '/1/status', env: 'ALGOLIA_MONITORING_API_KEY', cfg: 'monitoringApiKey', prose: 'The monitoring API key is' });
    alg('algolia:usage-api-key', { why: 'policy-limited: confidentiality not stated, migration undated', clause: 'usage-api-key-acl-and-source', req: 'GET /1/usage/synthetic HTTP/1.1', host: 'usage.example.test', path: '/1/usage/synthetic', header: 'X-Algolia-API-Key', env: 'ALGOLIA_USAGE_API_KEY', cfg: 'usageApiKey', prose: 'The usage API key is' });
  }

  // ---- Contentful (delivery, preview): public-or-confidential unsettled; controls shared
  {
    const ctl = ROWS['contentful:delivery-api-access-token'].ctl;
    const cfx = fixturesOf(ctl);
    const C = (family, layout, parts, note, axes, sharedWith) => add({ family, kind: 'control', layout, parts, note, axes, caseId: ctl, fixtures: cfx, clause: 'whole-input must-not-flag (Case: placeholder, reference, mask, empty parameter or token-free preview URL carries no token; space and environment ids appear only as braces placeholders)', sharedWith });
    const F = 'contentful:delivery-api-access-token';
    const sw = ['contentful:preview-api-access-token'];
    for (const [hostn, tag] of [['cdn.contentful.com', 'cdn'], ['preview.contentful.com', 'prev']]) {
      for (const [slug, v] of [['angle', '<DELIVERY_API_ACCESS_TOKEN>'], ['angle-preview', '<PREVIEW_API_ACCESS_TOKEN>'], ['env-dollar', '$CONTENTFUL_DELIVERY_TOKEN'], ['env-braces', '${CONTENTFUL_PREVIEW_TOKEN}'], ['template', '{{ secrets.CONTENTFUL_TOKEN }}'], ['mask', '********'], ['bullets', '••••••••']]) {
        C(F, `bearer-${tag}-${slug}`, [`GET /spaces/{space_id}/environments/master/entries HTTP/1.1\r\nHost: ${hostn}\r\nAuthorization: Bearer ${v}\r\n`], `${slug} in the Bearer slot, ${hostn}`, ['near-miss-value'], sw);
        C(F, `query-${tag}-${slug}`, [`https://${hostn}/spaces/{space_id}/environments/master/entries?access_token=${v}&content_type=page\n`], `${slug} in the access_token parameter, ${hostn}`, ['near-miss-value', 'nesting'], sw);
        C(F, `curl-${tag}-${slug}`, [`curl -H "Authorization: Bearer ${v}" "https://${hostn}/spaces/{space_id}/environments/master/entries"\n`], `${slug} in a curl -H, ${hostn}`, ['near-miss-value'], sw);
      }
      C(F, `bearer-${tag}-scheme-only`, [`GET /spaces/{space_id}/environments/master/entries HTTP/1.1\r\nHost: ${hostn}\r\nAuthorization: Bearer\r\n`], 'bare scheme', ['near-miss-value'], sw);
      C(F, `query-${tag}-empty`, [`https://${hostn}/spaces/{space_id}/environments/master/entries?access_token=&content_type=page\n`], 'empty access_token parameter', ['near-miss-value'], sw);
      C(F, `query-${tag}-empty-eof`, [`https://${hostn}/spaces/{space_id}/environments/master/entries?access_token=`], 'empty access_token parameter at the end of the input', ['near-miss-value', 'end-of-input'], sw);
    }
    C(F, 'preview-url-no-token', ['https://app.example.test/preview/{entry.fields.slug}\n'], 'content-preview URL with no token', ['near-miss-value'], sw);
    C(F, 'preview-url-no-token-query', ['https://app.example.test/preview/{entry.fields.slug}?secret={preview_secret}\n'], 'preview URL with a placeholder query', ['near-miss-value'], sw);
    C(F, 'prose-slots', ['Send the token in the Authorization header or in the access_token query parameter.\n'], 'prose naming both slots', ['near-miss-name'], sw);
    C(F, 'prose-preview-url', ['Never include an access token in the content preview URL.\n'], 'prose naming the preview-URL rule', ['near-miss-name'], sw);
    C(F, 'accessToken-property-placeholder', ['{"sys":{"type":"ApiKey"},"name":"synthetic","accessToken":"<DELIVERY_API_ACCESS_TOKEN>"}\n'], 'key resource accessToken property holding a placeholder', ['near-miss-value', 'nesting'], sw);
    C(F, 'accessToken-property-mask', ['{"sys":{"type":"ApiKey"},"name":"synthetic","accessToken":"********"}\n'], 'key resource accessToken property holding a mask', ['near-miss-value', 'nesting'], sw);
    C(F, 'accessToken-property-empty', ['{"sys":{"type":"ApiKey"},"name":"synthetic","accessToken":""}\n'], 'key resource accessToken property, empty', ['near-miss-value', 'nesting'], sw);
    // observed
    for (const [family, label, hosts, env] of [
      ['contentful:delivery-api-access-token', 'delivery', ['cdn.contentful.com'], 'CONTENTFUL_DELIVERY_ACCESS_TOKEN'],
      ['contentful:preview-api-access-token', 'preview', ['preview.contentful.com'], 'CONTENTFUL_PREVIEW_ACCESS_TOKEN'],
    ]) {
      const na = ROWS[family].na; const fx = fixturesOf(na);
      const hostn = hosts[0];
      const t = (slug, n = 43, a = URLSAFE) => ({ secret: synth(`${family}:${slug}`, n, a) });
      const O = (layout, parts, note, axes, clause) => obs(family, layout, parts, note, axes, na, 'policy-limited: the evidence does not say whether the token may be public or must be confidential', clause, fx);
      O('bearer-raw', [`GET /spaces/{space_id}/environments/master/entries HTTP/1.1\r\nHost: ${hostn}\r\nAuthorization: Bearer `, t('b1'), '\r\n'], 'Bearer slot, 43-byte URL-safe value', ['direct-slot', 'policy-limited'], ROWS[family].claims[0]);
      O('bearer-curl', [`curl -H "Authorization: Bearer `, t('b2'), `" "https://${hostn}/spaces/{space_id}/environments/master/entries"\n`], 'curl -H', ['policy-limited', 'delimiter-after'], ROWS[family].claims[0]);
      O('bearer-json-map', ['{"headers":{"Authorization":"Bearer ', t('b3'), '"}}\n'], 'JSON header map', ['policy-limited', 'nesting'], ROWS[family].claims[0]);
      O('query-access-token', [`https://${hostn}/spaces/{space_id}/environments/master/entries?access_token=`, t('q1'), '&content_type=page\n'], 'access_token query parameter', ['policy-limited', 'delimiter-after'], ROWS[family].claims[0]);
      O('query-access-token-eof', [`https://${hostn}/spaces/{space_id}/environments/master/entries?access_token=`, t('q2')], 'access_token at the end of the input', ['policy-limited', 'end-of-input'], ROWS[family].claims[0]);
      O('accessToken-property', ['{"sys":{"type":"ApiKey","id":"synthetic"},"name":"synthetic","accessToken":"', t('p1'), '"}\n'], 'accessToken property of a key resource', ['policy-limited', 'nesting'], ROWS[family].claims[1] ?? ROWS[family].claims[0]);
      O('accessToken-property-pair', ['{"items":[{"name":"a","accessToken":"', t('p2'), '"},{"name":"b","accessToken":"', t('p3'), '"}]}\n'], 'two key resources in one document', ['policy-limited', 'nesting', 'neighbouring-secret'], ROWS[family].claims[1] ?? ROWS[family].claims[0]);
      O('env-assignment', [`${env}=`, t('e1'), '\n'], 'variable named for the kind', ['representation', 'policy-limited'], ROWS[family].claims[0]);
      O('frontend-config', [`const client = createClient({ space: '{space_id}', accessToken: '`, t('f1'), `'${label === 'preview' ? ", host: 'preview.contentful.com'" : ''} });\n`], 'frontend client configuration', ['representation', 'policy-limited'], ROWS[family].claims[0]);
      O('shape-hex-64', [`https://${hostn}/spaces/{space_id}/entries?access_token=`, t('s1', 64, HEX)], '64-hexadecimal value (grammar unresolved)', ['value-shape-agnostic', 'policy-limited'], ROWS[family].claims[0]);
      O('shape-short', [`https://${hostn}/spaces/{space_id}/entries?access_token=`, t('s2', 12, ALNUM)], 'a 12-byte value', ['value-shape-agnostic', 'policy-limited'], ROWS[family].claims[0]);
      O('both-tokens-same-doc', ['{"delivery":"', { secret: synth('contentful:both:d', 43, URLSAFE) }, '","preview":"', { secret: synth('contentful:both:p', 43, URLSAFE) }, '"}\n'], 'delivery and preview tokens named as such in one document', ['role-ambiguity', 'neighbouring-secret'], 'preview-token-is-distinct-from-delivery-token');
    }
  }

  // ---- Asana service account token
  {
    const family = 'asana:service-account-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const t = (slug, n = 44, a = URLSAFE) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const O = (layout, parts, note, axes, clause = 'sa-org-wide-access-and-endpoints; carrier is an inference') => obs(family, layout, parts, note, axes, na, 'carrier-unresolved: no service account request example; a service account token is described as a personal access token on one page', clause, fx);
    O('bearer-audit-log-raw', ['GET /api/1.0/workspaces/{workspace_gid}/audit_log_events HTTP/1.1\r\nHost: app.example.test\r\nAuthorization: Bearer ', t('a1'), '\r\n'], 'Authorization header on an audit-log request', ['direct-slot', 'role-ambiguity', 'endpoint-context']);
    O('bearer-curl', ['curl -H "Authorization: Bearer ', t('a2'), '" "https://app.example.test/api/1.0/workspaces/{workspace_gid}/audit_log_events"\n'], 'curl -H on an audit-log request', ['role-ambiguity', 'delimiter-after']);
    O('bearer-json-map', ['{"headers":{"Authorization":"Bearer ', t('a3'), '"}}\n'], 'JSON header map', ['role-ambiguity', 'nesting']);
    O('bearer-scim', ['GET /scim/v2/Users HTTP/1.1\r\nHost: app.example.test\r\nAuthorization: Bearer ', t('a4'), '\r\n'], 'a SCIM request', ['role-ambiguity', 'endpoint-context']);
    O('env-assignment', ['ASANA_SERVICE_ACCOUNT_TOKEN=', t('e1'), '\n'], 'variable named for the role', ['representation', 'role-ambiguity']);
    O('env-pat-name', ['ASANA_PAT=', t('e2'), '\n'], 'a personal-access-token-named variable (one page calls the credential a PAT)', ['representation', 'role-ambiguity']);
    O('config-yaml', ['asana:\n  service_account_token: ', t('y1'), '\n'], 'configuration field', ['representation', 'role-ambiguity']);
    O('eof', ['Authorization: Bearer ', t('eof')], 'end of input', ['end-of-input', 'role-ambiguity']);
    O('shape-short', ['Authorization: Bearer ', t('s1', 12, ALNUM), '\r\n'], 'short value', ['value-shape-agnostic', 'role-ambiguity']);
    O('shape-slash-colon', ['Authorization: Bearer ', { secret: `1/${synth(`${family}:sc1`, 16, DIGITS)}:${synth(`${family}:sc2`, 32, HEX)}` }, '\r\n'], 'a number-slash-number-colon-hex shape (no shape is stated; formats are opaque)', ['value-shape-agnostic', 'role-ambiguity']);
  }

  // ---- Figma CLI plan token
  {
    const family = 'figma:cli-plan-access-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const t = (slug, n = 40, a = URLSAFE) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const O = (layout, parts, note, axes, clause = 'code-connect-cli-carrier-documented-for-personal-token (documented for the personal token only)') => obs(family, layout, parts, note, axes, na, 'carrier-unresolved: no page states how a CLI plan token is supplied', clause, fx);
    O('cli-token-arg', ['figma connect publish --token ', t('a1'), ' --dir ./src\n'], 'the --token argument documented for the personal token', ['role-ambiguity', 'delimiter-after']);
    O('cli-token-arg-equals', ['figma connect publish --token=', t('a2'), '\n'], '--token=value', ['role-ambiguity']);
    O('cli-token-arg-quoted', ['figma connect publish --token "', t('a3'), '" --dir ./src\n'], 'quoted argument', ['role-ambiguity', 'delimiter-after']);
    O('env-assignment', ['FIGMA_ACCESS_TOKEN=', t('e1'), '\n'], 'FIGMA_ACCESS_TOKEN as documented for the personal token', ['role-ambiguity', 'representation']);
    O('env-export', ['export FIGMA_ACCESS_TOKEN="', t('e2'), '"\n'], 'exported and quoted', ['role-ambiguity', 'representation']);
    O('config-json', ['{"codeConnect":{"accessToken":"', t('j1'), '"}}\n'], 'configuration file member', ['role-ambiguity', 'representation', 'nesting']);
    O('header-x-figma-token', ['GET /v1/me HTTP/1.1\r\nX-Figma-Token: ', t('h1'), '\r\n'], 'the REST header (the evidence reads the header statement as not covering CLI tokens)', ['role-ambiguity']);
    O('prefix-shape', ['figma connect publish --token ', { secret: `${PREFIX.figma}${synth(`${family}:pfx`, 40, URLSAFE)}` }, '\n'], 'a prefix-shaped value assembled at run time (no CLI grammar stated)', ['prefix-shape', 'role-ambiguity']);
  }

  // ---- Figma plan token (not-assertable properties): id, refresh window, categories
  {
    const family = 'figma:plan-access-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const O = (layout, parts, note, axes, clause) => obs(family, layout, parts, note, axes, na, 'policy-limited: token id disclosure, refreshed-secret carrier and category grammar are open', clause, fx);
    O('token-id-beside-secret', ['{"id":"', synth(`${family}:id1`, 13, DIGITS), '","secret":"', { secret: synth(`${family}:sec1`, 40, URLSAFE) }, '"}\n'], 'an id shown beside its secret', ['neighbouring-public-field', 'policy-limited'], 'plan-token-secret-shown-once-id-viewable');
    O('token-id-only', ['{"id":"', synth(`${family}:id2`, 13, DIGITS), '","name":"synthetic"}\n'], 'an id alone', ['policy-limited'], 'plan-token-secret-shown-once-id-viewable');
    O('refresh-two-secrets', ['{"id":"', synth(`${family}:id3`, 13, DIGITS), '","secret":"', { secret: synth(`${family}:new`, 40, URLSAFE) }, '","previous_secret":"', { secret: synth(`${family}:old`, 40, URLSAFE) }, '"}\n'], 'two secrets valid during the refresh window (no carrier is documented)', ['role-ambiguity', 'neighbouring-secret'], 'plan-token-refresh-previous-secret-valid-24h');
    O('npm-registry-auth-token', ['//registry.example.test/:_authToken=', { secret: synth(`${family}:npm`, 40, URLSAFE) }, '\n'], 'the npm registry category (carrier unstated; .npmrc form is a stand-in)', ['role-ambiguity', 'representation'], 'npm-registry-category-carrier-unstated');
    O('rest-category-env', ['FIGMA_PLAN_TOKEN=', { secret: synth(`${family}:env`, 40, URLSAFE) }, '\n'], 'variable named for the kind', ['role-ambiguity', 'representation'], 'plan-token-categories-share-one-grammar');
  }

  // ---- Dropbox response member and lifetime (not-assertable)
  {
    const family = 'dropbox:app-auth-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const t = (slug, n = 64, a = URLSAFE) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const O = (layout, parts, note, axes, clause = 'app-auth-token-response-undocumented') => obs(family, layout, parts, note, axes, na, 'carrier-unresolved: the response member, form and lifetime for client_credentials are not documented', clause, fx);
    O('response-access-token-member', ['{"access_token":"', t('r1'), '","token_type":"bearer","expires_in":14400}\n'], 'a guessed access_token member (the member name is not documented)', ['role-ambiguity', 'nesting']);
    O('response-app-auth-token-member', ['{"app_auth_token":"', t('r2'), '","token_type":"bearer"}\n'], 'a guessed app_auth_token member', ['role-ambiguity', 'nesting']);
    O('response-pretty', ['HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\n  "access_token": "', t('r3'), '",\n  "token_type": "bearer",\n  "expires_in": 14400\n}\n'], 'raw response, pretty JSON', ['role-ambiguity', 'nesting']);
    O('response-no-expiry', ['{"access_token":"', t('r4'), '"}\n'], 'a response with no lifetime', ['role-ambiguity']);
    O('response-sl-prefix-shape', ['{"access_token":"', { secret: `${PREFIX.dropbox}${synth(`${family}:sl`, 120, URLSAFE)}` }, '","token_type":"bearer"}\n'], 'a user-access-token-style prefix assembled at run time (the Case does not extend it to this role)', ['prefix-shape', 'role-ambiguity']);
    O('role-env-assignment', ['DROPBOX_APP_AUTH_TOKEN=', t('e1'), '\n'], 'variable named for the role', ['representation', 'role-ambiguity']);
    O('request-then-response', ['curl -X POST https://api.example.test/oauth2/token -d grant_type=client_credentials -u "<APP_KEY>:<APP_SECRET>"\n{"access_token":"', t('rr', 64), '","token_type":"bearer"}\n'], 'a client credentials request with placeholders followed by a response', ['role-ambiguity', 'nesting']);
    O('basic-app-auth', ['POST /2/synthetic-app-authenticated-call HTTP/1.1\r\nAuthorization: Basic ', { secret: b64(`${synth(`${family}:bk`, 15, LOWER)}:${synth(`${family}:bs`, 15, LOWER)}`) }, '\r\n'], 'App Authentication also accepts the app key and secret as Basic credentials (another family)', ['role-ambiguity', 'representation'], 'app-authentication-accepts-secret-or-token');
  }

  // ---- Hubspot relation (not-assertable) handled by extraObserved above; add relation probes
  {
    const family = 'hubspot:static-auth-access-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const O = (layout, parts, note, axes) => obs(family, layout, parts, note, axes, na, 'unresolved relation to legacy private app tokens and Service Keys, which share the Bearer header', 'pages-do-not-relate-static-auth-and-private-app-tokens', fx);
    O('legacy-private-app-beside-static', ['# static auth\nAuthorization: Bearer ', { secret: synth(`${family}:rel1`, 36, URLSAFE) }, '\n# legacy private app\nAuthorization: Bearer ', { secret: `${PREFIX.hubspot}${[8, 4, 4, 4, 12].map((n, i) => synth(`${family}:rel2:${i}`, n, HEX)).join('-')}` }, '\n'], 'both credentials named in comments, same header', ['role-ambiguity', 'neighbouring-secret', 'prefix-shape']);
    O('env-static-name', ['HUBSPOT_STATIC_AUTH_ACCESS_TOKEN=', { secret: synth(`${family}:rel3`, 36, URLSAFE) }, '\n'], 'variable named for the role', ['representation', 'role-ambiguity']);
    O('env-service-key-name', ['HUBSPOT_SERVICE_KEY=', { secret: synth(`${family}:rel4`, 36, URLSAFE) }, '\n'], 'a Service Key-named variable', ['representation', 'role-ambiguity']);
    O('env-private-app-name', ['HUBSPOT_PRIVATE_APP_ACCESS_TOKEN=', { secret: synth(`${family}:rel5`, 36, URLSAFE) }, '\n'], 'a private-app-named variable', ['representation', 'role-ambiguity']);
  }

  // ---- JFrog pairing token
  {
    const family = 'jfrog:pairing-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const jwt = (slug) => `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ sub: synth(`${family}:${slug}:sub`, 8, LOWER), ext: { base_url: 'https://mc.example.test', exchange_url: 'https://mc.example.test/pair' }, exp: 1791200300 }))}.${synth(`${family}:${slug}:sig`, 43, URLSAFE)}`;
    const O = (layout, parts, note, axes, clause = 'pairing-token-purpose-and-signed-extension (string form is an inference)') => obs(family, layout, parts, note, axes, na, 'carrier-unresolved: the string form and the exchange carrier are not stated; a JWT shape is an inference assembled at run time', clause, fx);
    O('bare-jwt-shape', ['Pairing token: ', { secret: jwt('a1') }, '\n'], 'a JWT-shaped value under a descriptive label', ['derived-value', 'role-ambiguity', 'prefix-shape']);
    O('bearer-exchange', ['POST /api/v1/pair HTTP/1.1\r\nHost: mc.example.test\r\nAuthorization: Bearer ', { secret: jwt('a2') }, '\r\n'], 'a JWT-shaped value as a Bearer value at a stand-in exchange URL', ['role-ambiguity', 'jwt-overlap', 'prefix-shape']);
    O('display-with-expiry-and-id', ['{"token":"', { secret: jwt('a3') }, '","expiresIn":300,"tokenId":"', synth(`${family}:tid`, 36, HEX), '"}\n'], 'the generation display: token, expiration and token ID', ['neighbouring-public-field', 'role-ambiguity', 'prefix-shape']);
    O('display-text', ['Token ID: ', synth(`${family}:tid2`, 36, HEX), '\nExpires: 300 seconds\nToken: ', { secret: jwt('a4') }, '\n'], 'the display as text lines', ['neighbouring-public-field', 'role-ambiguity']);
    O('opaque-form', ['pairing_token=', { secret: synth(`${family}:op`, 64, URLSAFE) }, '\n'], 'an opaque value in an assignment named for the kind', ['representation', 'role-ambiguity']);
    O('curl-exchange-body', ['curl -X POST https://mc.example.test/pair -d \'{"token":"', { secret: jwt('a5') }, '"}\'\n'], 'the token in an exchange request body', ['role-ambiguity', 'delimiter-after']);
    O('master-token-result', ['{"masterToken":"', { secret: jwt('a6') }, '"}\n'], 'the pairing result (a separate, longer-lived credential)', ['role-ambiguity', 'derived-value'], 'pairing-result-is-a-master-token');
    O('token-id-only', ['Token ID: ', synth(`${family}:tid3`, 36, HEX), '\n'], 'the token ID alone (confidentiality unstated)', ['policy-limited'], 'pairing-token-id-confidentiality');
  }

  // ---- Canva authorization code
  {
    const family = 'canva:authorization-code';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const t = (slug, n = 43, a = URLSAFE) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const state = (slug) => synth(`${family}:state:${slug}`, 20, URLSAFE);
    const O = (layout, parts, note, axes, clause = 'code-redirect-query-parameter') => obs(family, layout, parts, note, axes, na, 'policy-limited: the code is a by-design redirect parameter; confidentiality, lifetime and single use are not stated', clause, fx);
    O('redirect-get', ['GET /cb?code=', t('r1'), `&state=${state('r1')} HTTP/1.1\r\nHost: app.example.test\r\n`], 'redirect request line, code then state', ['direct-slot', 'delimiter-after', 'policy-limited']);
    O('redirect-state-first', [`GET /cb?state=${state('r2')}&code=`, t('r2'), ' HTTP/1.1\r\n'], 'state first, code last then space', ['delimiter-after', 'policy-limited']);
    O('redirect-eof', [`https://app.example.test/cb?state=${state('r3')}&code=`, t('r3')], 'end of input', ['end-of-input', 'policy-limited']);
    O('location-header', ['HTTP/1.1 302 Found\r\nLocation: https://app.example.test/cb?code=', t('r4'), `&state=${state('r4')}\r\n`], 'Location header of a redirect', ['nesting', 'policy-limited']);
    O('curl-callback', ['curl "https://app.example.test/cb?code=', t('r5'), `&state=${state('r5')}"\n`], 'curl on the callback URL', ['delimiter-after', 'policy-limited']);
    O('log-line', ['INFO callback received code=', t('r6'), ` state=${state('r6')}\n`], 'a log line', ['representation', 'policy-limited']);
    O('token-exchange-body', ['grant_type=authorization_code&code=', t('x1'), '&code_verifier=', synth(`${family}:cv`, 43, URLSAFE), '&redirect_uri=https%3A%2F%2Fapp.example.test%2Fcb\n'], 'the exchange body with the code_verifier (its confidentiality is stated by Canva, the code\'s is not)', ['neighbouring-secret', 'policy-limited'], 'code-exchange-inputs');
    O('code-challenge-derived', ['GET /authorize?code_challenge=', synth(`${family}:cc`, 43, URLSAFE), '&code_challenge_method=s256&state=', state('cc'), ' HTTP/1.1\r\n'], 'a code_challenge (derived; confidentiality unstated)', ['derived-value', 'policy-limited'], 'code-exchange-inputs');
    O('shape-hex', ['GET /cb?code=', t('s1', 32, HEX), '&state=', state('s1'), ' HTTP/1.1\r\n'], '32-hexadecimal code (no format stated)', ['value-shape-agnostic', 'policy-limited']);
    O('shape-short', ['GET /cb?code=', t('s2', 8, ALNUM), '&state=', state('s2'), ' HTTP/1.1\r\n'], 'an 8-byte code', ['value-shape-agnostic', 'near-miss-value']);
    O('fragment', ['https://app.example.test/cb#code=', t('f1'), '&state=', state('f1'), '\n'], 'code in a URL fragment', ['representation', 'policy-limited']);
    O('placeholder-code', ['GET /cb?code=<authorization-code>&state={state} HTTP/1.1\r\n'], 'placeholders in the redirect (no value)', ['near-miss-value']);
  }

  // ---- X OAuth 1.0a access token
  {
    const family = 'x:oauth1-access-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const tok = (slug) => `${synth(`${family}:${slug}:n`, 25, DIGITS)}-${synth(`${family}:${slug}:t`, 40, ALNUM)}`;
    const sig = (slug) => synth(`${family}:${slug}:sig`, 28, URLSAFE);
    const O = (layout, parts, note, axes, clause = 'access-token-in-authorization-header (sent in the clear by design; sensitivity of the token half alone unstated)') => obs(family, layout, parts, note, axes, na, 'policy-limited: the sensitivity of the token half alone and the request-token collision are unresolved', clause, fx);
    const oauth = (slug, token) => ['GET /1.1/account/verify_credentials.json HTTP/1.1\r\nHost: api.example.test\r\nAuthorization: OAuth oauth_consumer_key="', synth(`${family}:consumer`, 20, ALNUM), '", oauth_nonce="', synth(`${family}:${slug}:nonce`, 16, ALNUM), '", oauth_signature="', sig(slug), '", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1700000000", oauth_token="', { secret: token }, '", oauth_version="1.0"\r\n'];
    O('authorization-header', oauth('a1', tok('a1')), 'oauth_token inside a signed Authorization header', ['direct-slot', 'policy-limited', 'neighbouring-public-field']);
    O('authorization-header-short-token', oauth('a2', synth(`${family}:short`, 12, ALNUM)), 'a short oauth_token', ['value-shape-agnostic', 'policy-limited']);
    O('authorization-header-urlsafe', oauth('a3', synth(`${family}:urlsafe`, 50, URLSAFE)), 'a URL-safe-alphabet oauth_token (documentation examples differ in shape)', ['value-shape-agnostic', 'policy-limited']);
    O('authorization-header-curl', ['curl -H \'Authorization: OAuth oauth_consumer_key="', synth(`${family}:consumer`, 20, ALNUM), '", oauth_token="', { secret: tok('c1') }, '", oauth_signature="', sig('c1'), '"\' https://api.example.test/1.1/account/verify_credentials.json\n'], 'curl -H', ['delimiter-after', 'policy-limited']);
    O('access-token-response', ['oauth_token=', { secret: tok('r1') }, '&user_id=', synth(`${family}:uid`, 10, DIGITS), '&screen_name=synthetic\n'], 'access token response body (the secret half is another family and is omitted)', ['direct-slot', 'delimiter-after', 'policy-limited'], 'temporary-and-token-credentials-share-names');
    O('request-token-response', ['oauth_token=', { secret: synth(`${family}:req`, 27, ALNUM) }, '&oauth_callback_confirmed=true\n'], 'the temporary request token that shares the oauth_token name', ['role-ambiguity', 'policy-limited'], 'temporary-and-token-credentials-share-names');
    O('subject-token-exchange', ['grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Atoken-exchange&subject_token=', { secret: tok('s1') }, '&subject_token_type=oauth1\n'], 'subject_token in the OAuth 2.0 migration exchange', ['policy-limited', 'delimiter-after'], 'token-exchange-carrier');
    O('subject-token-curl', ['curl -d "subject_token=', { secret: tok('s2') }, '" https://api.example.test/2/oauth2/token\n'], 'subject_token in a curl -d', ['policy-limited', 'delimiter-after'], 'token-exchange-carrier');
    O('oauth-token-query', ['GET /oauth/authorize?oauth_token=', { secret: synth(`${family}:q`, 27, ALNUM) }, ' HTTP/1.1\r\n'], 'oauth_token in the authorize redirect (a request token)', ['role-ambiguity', 'policy-limited'], 'temporary-and-token-credentials-share-names');
    O('eof', ['oauth_token=', { secret: tok('e1') }], 'end of input', ['end-of-input', 'policy-limited']);
    O('oauth-token-placeholder', ['Authorization: OAuth oauth_token="<ACCESS_TOKEN>", oauth_signature="<SIGNATURE>"\n'], 'placeholders (no value)', ['near-miss-value']);
  }

  // ---- Zoom Build: Bearer slot shared with JWT
  {
    const family = 'zoom:build-platform-api-key';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const jwt = (slug) => `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: synth(`${family}:${slug}:iss`, 12, ALNUM), exp: 1791200000 }))}.${synth(`${family}:${slug}:sig`, 43, URLSAFE)}`;
    const O = (layout, parts, note, axes, clause = 'api-request-carriers; bearer-slot-is-shared') => obs(family, layout, parts, note, axes, na, 'carrier-unresolved: the Bearer slot carries either an API key or a JWT and the request cannot tell them apart', clause, fx);
    O('bearer-opaque', ['GET /v2/videosdk/sessions HTTP/1.1\r\nHost: api.example.test\r\nAuthorization: Bearer ', { secret: synth(`${family}:b1`, 40, ALNUM) }, '\r\n'], 'an opaque value in the Bearer slot', ['role-ambiguity', 'direct-slot']);
    O('bearer-jwt', ['GET /v2/videosdk/sessions HTTP/1.1\r\nHost: api.example.test\r\nAuthorization: Bearer ', { secret: jwt('b2') }, '\r\n'], 'a JWT in the Bearer slot (a different credential)', ['role-ambiguity', 'jwt-overlap', 'derived-value']);
    O('bearer-curl-opaque', ['curl https://api.example.test/v2/videosdk/sessions -H "Authorization: Bearer ', { secret: synth(`${family}:b3`, 40, ALNUM) }, '"\n'], 'curl, opaque value', ['role-ambiguity', 'delimiter-after']);
    O('bearer-curl-jwt', ['curl https://api.example.test/v2/videosdk/sessions -H "Authorization: Bearer ', { secret: jwt('b4') }, '"\n'], 'curl, JWT', ['role-ambiguity', 'jwt-overlap']);
    O('both-headers', ['GET /v2/videosdk/sessions HTTP/1.1\r\nx-api-key: ', { secret: synth(`${family}:b5k`, 40, ALNUM) }, '\r\nAuthorization: Bearer ', { secret: synth(`${family}:b5b`, 40, ALNUM) }, '\r\n'], 'both headers sent (x-api-key takes precedence)', ['role-ambiguity', 'neighbouring-secret']);
    O('bearer-same-value-as-x-api-key', ['x-api-key: ', { secret: synth(`${family}:b6`, 40, ALNUM) }, '\nAuthorization: Bearer ', { secret: synth(`${family}:b6`, 40, ALNUM) }, '\n'], 'the same value in both headers', ['role-ambiguity', 'repeat-secret']);
    O('key-and-secret-pair', ['{"apiKey":"', { secret: synth(`${family}:b7k`, 32, ALNUM) }, '","apiSecret":"', { secret: synth(`${family}:b7s`, 32, ALNUM) }, '"}\n'], 'a key and secret pair (whether the current flow has a pair is open)', ['role-ambiguity', 'neighbouring-secret'], 'key-secret-pair-or-single-string');
    O('key-id-only', ['{"keyId":"', synth(`${family}:kid`, 20, ALNUM), '","name":"synthetic"}\n'], 'the key ID shown for internal support (a different value)', ['neighbouring-public-field', 'role-ambiguity'], 'api-request-carriers');
  }

  // ---- Zoom webhook secret token
  {
    const family = 'zoom:webhook-secret-token';
    const na = ROWS[family].na; const fx = fixturesOf(na);
    const t = (slug, n = 22, a = ALNUM) => ({ secret: synth(`${family}:${slug}`, n, a) });
    const O = (layout, parts, note, axes, clause = 'carrier-wording-conflict') => obs(family, layout, parts, note, axes, na, 'carrier-unresolved: two pages disagree on whether the secret token itself or only a hash of the body is sent', clause, fx);
    O('event-body-secret-token-member', ['{"event":"synthetic.event","secret_token":"', t('a1'), '","payload":{"object":{"id":"1"}}}\n'], 'a secret_token member in an event notification (the wording says it is sent; no field is named)', ['role-ambiguity', 'nesting'], 'secret-token-sent-wording');
    O('authorization-header', ['POST /webhook HTTP/1.1\r\nHost: example.test\r\nauthorization: ', t('a2'), '\r\nContent-Type: application/json\r\n'], 'a value in an authorization header (the legacy verification-token style; era not pinned)', ['role-ambiguity', 'representation'], 'secret-token-sent-wording');
    O('env-assignment', ['ZOOM_WEBHOOK_SECRET_TOKEN=', t('e1'), '\n'], 'the variable named in the Case controls, holding a value', ['representation', 'role-ambiguity']);
    O('env-assignment-quoted', ['export ZOOM_WEBHOOK_SECRET_TOKEN="', t('e2'), '"\n'], 'exported and quoted', ['representation', 'delimiter-before']);
    O('hmac-key-in-code', ['const hash = crypto.createHmac("sha256", "', t('c1'), '").update(message).digest("hex");\n'], 'the secret as a string literal HMAC key', ['representation', 'role-ambiguity']);
    O('config-yaml', ['zoom:\n  webhook_secret_token: ', t('y1'), '\n'], 'configuration field', ['representation', 'role-ambiguity']);
    O('verification-token', ['{"verification_token":"', t('v1'), '"}\n'], 'the deprecated Verification Token (era not pinned)', ['role-ambiguity', 'nesting'], 'verification-token-era');
    O('signature-header-real-hmac', (() => { const m = 'v0:1700000000:{"event":"synthetic.event"}'; const sigv = createHmac('sha256', synth(`${family}:k`, 22, ALNUM)).update(m).digest('hex'); return ['POST /webhook HTTP/1.1\r\nx-zm-request-timestamp: 1700000000\r\nx-zm-signature: v0=', { secret: sigv }, '\r\n']; })(), 'an HMAC computed over the signed message string (derived output; confidentiality unstated)', ['derived-value', 'policy-limited'], 'signature-input-and-output');
  }

  return cases;
}

export const cases = build();

export function corpusDigest() {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}
export function partDigest(part) {
  return createHash('sha256').update(JSON.stringify(cases.filter((c) => c.part === part))).digest('hex');
}
