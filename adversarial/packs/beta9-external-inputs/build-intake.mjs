/**
 * Authoring tool for the `beta9-external-inputs` pack (#140).
 *
 * Every fixture below is either a verbatim excerpt of an externally authored,
 * redistributable public source, or a composition of such excerpts. The
 * expected ranges are not typed as numbers: each credential part is marked in
 * the source text below (`S(...)`), and this script turns the marks into UTF-8
 * byte ranges. No scanner is imported or run here, and the expectations digest
 * is computed before any scanner sees the pack.
 *
 * The pack is assembled by the project, so it is `maintainer-regression`, never
 * `externally-authored`: the inputs were written outside the project, but the
 * selection, composition, actions and ranges were not. See ./README.md.
 *
 * Run once, at submission: node --import tsx adversarial/packs/beta9-external-inputs/build-intake.mjs
 * It refuses to overwrite an intake that has left `submitted`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectationsDigest } from '../../../benchmarks/lib/adversarial-intake.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SUBMITTED_AT = '2026-09-25T13:26:01Z';
const ASSEMBLER = 'redact-secret-benchmarks maintainers';

/** Externally authored sources, each pinned to the exact revision the excerpt was copied from. */
export const SOURCES = {
  'rfc6749': { title: 'RFC 6749, The OAuth 2.0 Authorization Framework', url: 'https://www.rfc-editor.org/rfc/rfc6749.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'D. Hardt, Ed. (IETF)' },
  'rfc6750': { title: 'RFC 6750, OAuth 2.0 Bearer Token Usage', url: 'https://www.rfc-editor.org/rfc/rfc6750.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'M. Jones, D. Hardt (IETF)' },
  'rfc7617': { title: "RFC 7617, The 'Basic' HTTP Authentication Scheme", url: 'https://www.rfc-editor.org/rfc/rfc7617.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'J. Reschke (IETF)' },
  'rfc8959': { title: "RFC 8959, The 'secret-token' URI Scheme", url: 'https://www.rfc-editor.org/rfc/rfc8959.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'M. Nottingham (IETF)' },
  'rfc7515': { title: 'RFC 7515, JSON Web Signature (JWS)', url: 'https://www.rfc-editor.org/rfc/rfc7515.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'M. Jones, J. Bradley, N. Sakimura (IETF)' },
  'rfc7519': { title: 'RFC 7519, JSON Web Token (JWT)', url: 'https://www.rfc-editor.org/rfc/rfc7519.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'M. Jones, J. Bradley, N. Sakimura (IETF)' },
  'rfc7636': { title: 'RFC 7636, Proof Key for Code Exchange (PKCE)', url: 'https://www.rfc-editor.org/rfc/rfc7636.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'N. Sakimura, Ed., J. Bradley, N. Agarwal (IETF)' },
  'rfc3986': { title: 'RFC 3986, URI Generic Syntax', url: 'https://www.rfc-editor.org/rfc/rfc3986.txt', license: 'IETF Trust Legal Provisions (code components: BSD-3-Clause)', authors: 'T. Berners-Lee, R. Fielding, L. Masinter (IETF)' },
  'detect-secrets': { title: 'Yelp/detect-secrets test suite', url: 'https://github.com/Yelp/detect-secrets/tree/5e141933554a0b74e7341841f318be21e895339c/tests', license: 'Apache-2.0', authors: 'Yelp, Inc. and detect-secrets contributors' },
  'noseyparker': { title: 'praetorian-inc/noseyparker built-in rule examples', url: 'https://github.com/praetorian-inc/noseyparker/tree/2e6e7f36ce36619852532bbe698d8cb7a26d2da7/crates/noseyparker/data/default/builtin/rules', license: 'Apache-2.0', authors: 'Praetorian Security, Inc. and Nosey Parker contributors' },
  'blns': { title: 'The Big List of Naughty Strings', url: 'https://github.com/minimaxir/big-list-of-naughty-strings/blob/db33ec7b1d5d9616a88c76394b7d0897bd0b97eb/blns.txt', license: 'MIT', authors: 'Max Woolf and contributors' },
  'trojan-source': { title: 'Trojan Source proof-of-concept files', url: 'https://github.com/nickboucher/trojan-source/tree/e3dc153fcf465f4a84424ea874ff39be29adb1f7/JavaScript', license: 'MIT', authors: 'Nicholas Boucher, Ross Anderson' },
  'aws-cli': { title: 'aws/aws-cli command examples (iam create-access-key)', url: 'https://github.com/aws/aws-cli/blob/4a54791df2da35778bca1325f71b1cb0b4ba770a/awscli/examples/iam/create-access-key.rst', license: 'Apache-2.0', authors: 'Amazon.com, Inc. or its affiliates' },
};

/** A credential part of a fixture. Everything else is context. */
const S = text => ({ secret: text });

function build(parts) {
  let content = '';
  let offset = 0;
  const expected = [];
  for (const part of parts) {
    const text = typeof part === 'string' ? part : part.secret;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (typeof part !== 'string') {
      const last = expected.at(-1);
      if (last && last.end === offset) last.end += bytes;
      else expected.push({ start: offset, end: offset + bytes });
    }
    content += text;
    offset += bytes;
  }
  return { content, expected };
}

const DS_COMMON = 'm{{h}o)p${e]nob(ody[finds>-_$#thisone}}';
const DS_WHITES = 'value with quotes and spaces';
const DS_LETTER = 'A,.:-¨@*¿?!';
const RFC7519_JWT_LINES = [
  'eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9',
  '.',
  'eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFt',
  'cGxlLmNvbS9pc19yb290Ijp0cnVlfQ',
  '.',
  'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
];
const RFC7519_JWT = RFC7519_JWT_LINES.join('');
const RFC7515_K = 'AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow';
const BASIC_ALADDIN = 'QWxhZGRpbjpvcGVuIHNlc2FtZQ==';
const SECRET_TOKEN = 'secret-token:E92FB7EB-D882-47A4-A265-A0B6135DC842%20foo';

/**
 * [id, path, category from #140, schema threat categories, source keys,
 *  'verbatim' | 'composed', parts, rationale]
 * `verbatim` excerpts drop only the RFC figure indentation (the leading spaces
 * every line of an RFC figure carries) and add a final newline.
 */
const F = [
  // URLs and query strings
  ['rfc6750-query-access-token', 'urls/resource-url.txt', 'urls-and-query-strings', ['embedded-structure'], ['rfc6750'], 'verbatim',
    ['https://server.example.com/resource?access_token=', S('mF_9.B5f-4.1JqM'), '&p=q\n'],
    'RFC 6750 section 2.3: the access_token query value is a bearer token; the host, path and the p=q parameter are not.'],
  ['rfc6750-get-request-line', 'urls/get-request.http', 'urls-and-query-strings', ['embedded-structure'], ['rfc6750'], 'verbatim',
    ['GET /resource?access_token=', S('mF_9.B5f-4.1JqM'), ' HTTP/1.1\nHost: server.example.com\n'],
    'RFC 6750 section 2.3: a bearer token in an HTTP request-line query string.'],
  ['rfc6749-implicit-fragment-display-break', 'urls/implicit-redirect.http', 'urls-and-query-strings', ['embedded-structure', 'multiline-structure'], ['rfc6749'], 'verbatim',
    ['HTTP/1.1 302 Found\nLocation: http://example.com/cb#access_token=', S('2YotnFZFEjr1zCsicMWpAA'), '\n          &state=xyz&token_type=example&expires_in=3600\n'],
    'RFC 6749 section 4.2.2: an access token in a URL fragment, with the RFC display line break kept; state, token_type and expires_in are not secrets.'],
  ['rfc6749-authorization-code-location', 'urls/code-redirect.http', 'urls-and-query-strings', ['embedded-structure', 'multiline-structure'], ['rfc6749'], 'verbatim',
    ['HTTP/1.1 302 Found\nLocation: https://client.example.com/cb?code=', S('SplxlOBeZQQYbYS6WxSbIA'), '\n          &state=xyz\n'],
    'RFC 6749 section 4.1.2: the authorization code is exchangeable for tokens until it expires, so it is redacted; state is not.'],
  ['rfc7636-code-challenge-query', 'urls/pkce-challenge.txt', 'token-like-benign-identifiers', ['benign-lookalike', 'embedded-structure'], ['rfc7636'], 'verbatim',
    ['code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM\n&code_challenge_method=S256\n'],
    'RFC 7636 section 4.3 / appendix B: the S256 code_challenge is a public hash sent in the front channel, not a credential.'],
  ['rfc7636-code-verifier', 'urls/pkce-verifier.txt', 'urls-and-query-strings', ['embedded-structure'], ['rfc7636'], 'verbatim',
    ['code_verifier=', S('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), '\n'],
    'RFC 7636 appendix B: the code_verifier is the secret that proves possession during the token exchange.'],
  ['rfc3986-example-uris', 'urls/example-uris.txt', 'urls-and-query-strings', ['benign-lookalike', 'embedded-structure'], ['rfc3986'], 'verbatim',
    ['ftp://ftp.is.co.za/rfc/rfc1808.txt\n\nhttp://www.ietf.org/rfc/rfc2396.txt\n\nldap://[2001:db8::7]/c=GB?objectClass?one\n\nmailto:John.Doe@example.com\n\nnews:comp.infosystems.www.servers.unix\n\ntel:+1-816-555-1212\n\ntelnet://192.0.2.16:80/\n\nurn:oasis:names:specification:docbook:dtd:xml:4.1.2\n'],
    'RFC 3986 section 1.1.2 example URIs: none carries userinfo, a token or a key.'],
  ['composed-userinfo-password-url', 'urls/userinfo.txt', 'urls-and-query-strings', ['embedded-structure'], ['rfc7617', 'rfc3986'], 'composed',
    ['https://Aladdin:', S('open%20sesame'), '@www.example.com/\n'],
    'The RFC 7617 user-id and password placed in RFC 3986 userinfo syntax; the percent-encoded password is the secret, the user-id and host are not.'],

  // Overlapping and multi-credential messages
  ['rfc6749-refresh-request-body', 'multi/refresh-request.txt', 'overlapping-credentials', ['embedded-structure', 'multiline-structure'], ['rfc6749'], 'verbatim',
    ['grant_type=refresh_token&refresh_token=', S('tGzv3JOkF0XG5Qx2TlKWIA'), '\n&client_id=s6BhdRkqt3&client_secret=', S('7Fjfp0ZBr1KtDRbnfVdmIw'), '\n'],
    'RFC 6749 section 2.3.1: refresh_token and client_secret are secrets; client_id is a public identifier.'],
  ['rfc6749-token-request-basic-and-code', 'multi/token-request.http', 'overlapping-credentials', ['embedded-structure', 'multiline-structure'], ['rfc6749'], 'verbatim',
    ['POST /token HTTP/1.1\nHost: server.example.com\nAuthorization: Basic ', S('czZCaGRSa3F0MzpnWDFmQmF0M2JW'), '\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code&code=', S('SplxlOBeZQQYbYS6WxSbIA'), '\n&redirect_uri=https%3A%2F%2Fclient%2Eexample%2Ecom%2Fcb\n'],
    'RFC 6749 section 4.1.3: the Basic client credentials and the authorization code are secrets; the percent-encoded redirect_uri is not.'],
  ['rfc6749-token-response-json', 'multi/token-response.json', 'nested-quoting-and-serialization', ['embedded-structure'], ['rfc6749'], 'verbatim',
    ['{\n  "access_token":"', S('2YotnFZFEjr1zCsicMWpAA'), '",\n  "token_type":"example",\n  "expires_in":3600,\n  "refresh_token":"', S('tGzv3JOkF0XG5Qx2TlKWIA'), '",\n  "example_parameter":"example_value"\n}\n'],
    'RFC 6749 section 4.1.4: access_token and refresh_token are secrets; token_type, expires_in and example_parameter are not.'],
  ['rfc6750-token-response-json', 'multi/bearer-response.json', 'nested-quoting-and-serialization', ['embedded-structure'], ['rfc6750'], 'verbatim',
    ['{\n  "access_token":"', S('mF_9.B5f-4.1JqM'), '",\n  "token_type":"Bearer",\n  "expires_in":3600,\n  "refresh_token":"', S('tGzv3JOkF0XG5Qx2TlKWIA'), '"\n}\n'],
    'RFC 6750 section 4: both tokens in the response are secrets; "Bearer" is a token type, not a token.'],
  ['rfc7617-basic-aladdin', 'multi/basic.http', 'overlapping-credentials', ['embedded-structure'], ['rfc7617'], 'verbatim',
    ['Authorization: Basic ', S(BASIC_ALADDIN), '\n'],
    'RFC 7617 section 2: base64 of user-id:password; the whole credential token is redacted.'],
  ['rfc7617-basic-utf8-proxy', 'multi/proxy-basic.http', 'overlapping-credentials', ['embedded-structure', 'encoding-obfuscation'], ['rfc7617'], 'verbatim',
    ['Proxy-Authorization: Basic ', S('dGVzdDoxMjPCow=='), '\n'],
    'RFC 7617 section 2.1: base64 of a UTF-8 user-pass (test:123 followed by a pound sign) in a proxy header.'],
  ['rfc8959-secret-token-folded-bearer', 'multi/secret-token-request.http', 'overlapping-credentials', ['multiline-structure', 'embedded-structure'], ['rfc8959'], 'verbatim',
    ['GET /authenticated/stuff HTTP/1.1\nHost: www.example.com\nAuthorization: Bearer\n  ', S(SECRET_TOKEN), '\n'],
    'RFC 8959 section 2: the entire secret-token URI is the bearer credential, presented on a folded continuation line after the Bearer scheme.'],
  ['rfc8959-secret-token-prose', 'multi/secret-token-note.md', 'placeholders-documentation-examples', ['context-camouflage'], ['rfc8959'], 'composed',
    ['Given the URI:\n\n', S(SECRET_TOKEN), '\n\nThis string will both be issued by the token authority and required for later access.\n'],
    'RFC 8959 section 2 prose, shortened: a secret-token URI in documentation prose is still a credential by its own scheme definition.'],
  ['composed-jwt-in-bearer-header', 'multi/jwt-bearer.http', 'overlapping-credentials', ['embedded-structure'], ['rfc7519', 'rfc6750'], 'composed',
    ['GET /resource HTTP/1.1\nHost: server.example.com\nAuthorization: Bearer ', S(RFC7519_JWT), '\n'],
    'The RFC 7519 section 3.1 JWT (display breaks joined) used as an RFC 6750 bearer token: one credential, one range, whichever detector claims it.'],

  // Multiline splits
  ['rfc7519-jwt-display-breaks', 'multiline/jwt-figure.txt', 'multiline-and-chunk-splits', ['multiline-structure', 'boundary-splitting'], ['rfc7519'], 'verbatim',
    [S(RFC7519_JWT_LINES.join('\n')), '\n'],
    'RFC 7519 section 3.1: one JWT printed across six lines; the whole printed token, dots and line breaks included, is one secret span.'],
  ['rfc7515-jwk-k-display-break', 'multiline/jwk.json', 'multiline-and-chunk-splits', ['multiline-structure', 'embedded-structure'], ['rfc7515'], 'verbatim',
    ['{"kty":"oct",\n "k":"', S('AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75\n      aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow'), '"\n}\n'],
    'RFC 7515 appendix A.1.1: a symmetric JWK key value broken across two lines; the key, including its display break, is one secret span.'],
  ['composed-jwk-k-single-line', 'multiline/jwk-compact.json', 'nested-quoting-and-serialization', ['embedded-structure'], ['rfc7515'], 'composed',
    ['{"kty":"oct","k":"', S(RFC7515_K), '"}\n'],
    'The RFC 7515 appendix A.1.1 symmetric key with the display break removed; kty is not secret.'],
  ['rfc7519-jose-header-only', 'multiline/jose-header.txt', 'token-like-benign-identifiers', ['benign-lookalike'], ['rfc7519'], 'composed',
    ['encoded JOSE header: eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9\n'],
    'RFC 7519 section 3.1: an encoded JOSE header alone ({"typ":"JWT","alg":"HS256"}) carries no claims and no signature, so it is not a credential.'],

  // Nested quoting and serialization
  ['composed-json-string-in-json-log', 'nested/log.jsonl', 'nested-quoting-and-serialization', ['embedded-structure'], ['rfc6749'], 'composed',
    ['{"level":"debug","body":"{\\"access_token\\":\\"', S('2YotnFZFEjr1zCsicMWpAA'), '\\",\\"token_type\\":\\"example\\",\\"expires_in\\":3600}"}\n'],
    'The RFC 6749 token response serialized as an escaped JSON string inside a JSON log line; only the token is secret.'],
  ['composed-yaml-block-scalar-json', 'nested/fixture.yaml', 'nested-quoting-and-serialization', ['embedded-structure', 'multiline-structure'], ['rfc6750'], 'composed',
    ['response: |\n  {\n    "access_token":"', S('mF_9.B5f-4.1JqM'), '",\n    "token_type":"Bearer"\n  }\n'],
    'The RFC 6750 token response inside a YAML literal block scalar.'],
  ['np-html-escaped-placeholder', 'nested/escaped.json', 'placeholders-documentation-examples', ['benign-lookalike', 'embedded-structure'], ['noseyparker'], 'verbatim',
    ['"password": "&lt;YOURPASSWROD&gt;"\n'],
    'Nosey Parker np.generic.5 negative example: an HTML-escaped angle-bracket placeholder, not a password.'],
  ['composed-percent-encoded-url-in-json', 'nested/redirect.json', 'nested-quoting-and-serialization', ['embedded-structure', 'encoding-obfuscation'], ['rfc6750'], 'composed',
    ['{"redirect":"https://server.example.com/resource?access_token%3D', S('mF_9.B5f-4.1JqM'), '%26p%3Dq"}\n'],
    'The RFC 6750 query URL with its = and & percent-encoded inside a JSON string; the token characters themselves are unchanged.'],
  ['composed-curl-single-quoted-json', 'nested/curl.sh', 'nested-quoting-and-serialization', ['embedded-structure', 'context-camouflage'], ['rfc6749'], 'composed',
    ["curl -H 'Authorization: Basic ", S('czZCaGRSa3F0MzpnWDFmQmF0M2JW'), '\' -d \'{"refresh_token":"', S('tGzv3JOkF0XG5Qx2TlKWIA'), '"}\' https://server.example.com/token\n'],
    'RFC 6749 client credentials and refresh token inside single-quoted shell arguments, one of them JSON.'],
  ['ds-keyword-quoted-spaces', 'nested/config-spaces.conf', 'nested-quoting-and-serialization', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['password = "', S(DS_WHITES), '"\n'],
    'detect-secrets keyword_test.py CONFIG_TEST_CASES asserts the secret is the whole quoted phrase, spaces included.'],
  ['ds-keyword-template-chars-in-secret', 'nested/config-braces.conf', 'shell-env-template-sql-references', ['context-camouflage', 'benign-lookalike'], ['detect-secrets'], 'verbatim',
    ['apikey = ', S(DS_COMMON), '\n'],
    'detect-secrets COMMON_SECRET: a literal secret containing ${, {{ and }} that must not be mistaken for a template reference.'],
  ['ds-keyword-go-short-assign', 'nested/secret.go', 'shell-env-template-sql-references', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['apikey := "', S(DS_COMMON), '"\n'],
    'detect-secrets GOLANG_TEST_CASES: the same literal behind a Go short variable declaration.'],
  ['ds-keyword-reversed-comparison', 'nested/check.js', 'nested-quoting-and-serialization', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['if ("', S(DS_COMMON), '" == my_super_password) {\n'],
    'detect-secrets QUOTES_REQUIRED_TEST_CASES: the literal precedes the credential name in a comparison.'],
  ['ds-keyword-non-ascii-secret', 'nested/db.yaml', 'invisible-and-formatting-characters', ['unicode-confusable', 'context-camouflage'], ['detect-secrets'], 'verbatim',
    ["db_pass: '", S(DS_LETTER), "'\n"],
    'detect-secrets LETTER_SECRET: a password made of punctuation and non-ASCII letters (U+00A8, U+00BF).'],
  ['ds-cpp-string-constructor', 'nested/secret.cpp', 'nested-quoting-and-serialization', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['std::string secret("', S(DS_COMMON), '");\n'],
    'detect-secrets C_PLUS_PLUS_TEST_CASES: the literal passed to a string constructor named secret.'],
  ['ds-objc-at-string', 'nested/secret.m', 'nested-quoting-and-serialization', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['password = @"', S(DS_COMMON), '";\n'],
    'detect-secrets COMMON_C_TEST_CASES: an Objective-C @"..." literal.'],
  ['np-generic-password-dollar', 'nested/settings.py', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['password = "', S('super$ecret'), '"\n'],
    'Nosey Parker np.generic.5 example: a literal password containing a $ that must not be read as a shell reference.'],
  ['np-generic-user-password-pair', 'nested/client.py', 'overlapping-credentials', ['context-camouflage', 'multiline-structure'], ['noseyparker', 'rfc7617'], 'verbatim',
    ["user = 'Aladdin'\npassword = '", S('open sesame'), "'\n"],
    'Nosey Parker np.generic.3 example (the RFC 7617 pair): the password is secret, the user name is not.'],

  // Shell, environment, template and SQL references
  ['ds-template-dollar-brace', 'refs/link.conf', 'shell-env-template-sql-references', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['password: ${link}\n'],
    'detect-secrets keyword_test.py: a ${...} reference, not a value.'],
  ['ds-template-single-brace', 'refs/brace.conf', 'shell-env-template-sql-references', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['secret = {hunter2}\n'],
    'detect-secrets heuristic_filter_test.py is_templated_secret: a {name} template slot.'],
  ['ds-template-angle', 'refs/angle.conf', 'shell-env-template-sql-references', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['secret = <hunter2>\n'],
    'detect-secrets heuristic_filter_test.py is_templated_secret: an <name> template slot.'],
  ['ds-indirect-function-call', 'refs/call.py', 'shell-env-template-sql-references', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['secret = get_secret_key()\n'],
    'detect-secrets is_indirect_reference: the value is computed by a call, not written here.'],
  ['ds-indirect-subscript', 'refs/subscript.py', 'shell-env-template-sql-references', ['context-camouflage'], ['detect-secrets'], 'verbatim',
    ['secret = request.headers["apikey"]\n'],
    'detect-secrets is_indirect_reference: a header lookup whose key string is a name, not a secret.'],
  ['np-shell-command-substitution', 'refs/setup.sh', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['USERNAME=donjuan\nPASSWORD=$($(dirname $0)/../bin/get-django-setting LOCAL_DATABASE_PASSWORD)\n'],
    'Nosey Parker np.generic.3 negative example: the password comes from command substitution.'],
  ['np-export-variable-reference', 'refs/export.sh', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['export PGPASSWORD="$gdcapi_db_password"\n'],
    'Nosey Parker np.generic.5 negative example: a quoted shell variable reference.'],
  ['np-echo-concatenated-reference', 'refs/ci.yml', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['- echo \'export DATABASE_PASSWORD="\'$PRECOMPILE_PASSWORD\'"\' >> .env\n'],
    'Nosey Parker np.generic.5 negative example: quote-juggled variable expansion writing a reference into .env.'],
  ['np-env-attribute-reference', 'refs/perkeep.star', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['username = env.PERKEEP_TEST_USERNAME\npassword = env.PERKEEP_TEST_PASSWORD\n'],
    'Nosey Parker np.generic.4 negative example: environment attribute references.'],
  ['np-puppet-empty-default', 'refs/authfetch.pp', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['define wget::authfetch($source,$destination,$user,$password="",$timeout="0",$verbose=false) {\n'],
    'Nosey Parker np.generic.5 negative example: a parameter list with an empty password default.'],
  ['np-php-array-reference', 'refs/config.php', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['echo \'password = \'.$p[\'config\'][\'daemon_password\']."\\n";\n'],
    'Nosey Parker np.generic.6 negative example: a PHP array lookup concatenated after a password label.'],
  ['np-java-getter-concatenation', 'refs/Config.java', 'shell-env-template-sql-references', ['context-camouflage'], ['noseyparker'], 'verbatim',
    ['sb.append("MasterUserPassword: " + getMasterUserPassword() + ",");\n'],
    'Nosey Parker np.generic.5 negative example: a getter call, not a literal.'],
  ['blns-sql-injection', 'refs/sql-injection.txt', 'shell-env-template-sql-references', ['context-camouflage'], ['blns'], 'verbatim',
    ["1;DROP TABLE users\n1'; DROP TABLE users-- 1\n' OR 1=1 -- 1\n' OR '1'='1\n'; EXEC sp_MSForEachTable 'DROP TABLE ?'; --\n \n%\n_\n"],
    'BLNS "SQL Injection" section: hostile SQL fragments with no credential in them.'],
  ['blns-server-code-injection', 'refs/code-injection.txt', 'shell-env-template-sql-references', ['context-camouflage'], ['blns'], 'verbatim',
    ['-\n--\n--version\n--help\n$USER\n/dev/null; touch /tmp/blns.fail ; echo\n`touch /tmp/blns.fail`\n$(touch /tmp/blns.fail)\n@{[system "touch /tmp/blns.fail"]}\n'],
    'BLNS "Server Code Injection" section: shell expansions and command substitutions with no credential in them.'],
  ['blns-unwanted-interpolation', 'refs/interpolation.txt', 'shell-env-template-sql-references', ['context-camouflage'], ['blns'], 'verbatim',
    ["$HOME\n$ENV{'HOME'}\n%d\n%s%s%s%s%s\n{0}\n%*.*s\n%@\n%n\nFile:///\n"],
    'BLNS "Unwanted Interpolation" section: format and environment references with no credential in them.'],
  ['blns-jinja2-injection', 'refs/jinja.txt', 'shell-env-template-sql-references', ['context-camouflage'], ['blns'], 'verbatim',
    ["{% print 'x' * 64 * 1024**3 %}\n{{ \"\".__class__.__mro__[2].__subclasses__()[40](\"/etc/passwd\").read() }}\n"],
    'BLNS "jinja2 injection" section: template expressions with no credential in them.'],

  // Placeholders, documentation and example values
  ['awscli-create-access-key-example', 'docs/create-access-key.json', 'placeholders-documentation-examples', ['benign-lookalike'], ['aws-cli'], 'verbatim',
    ['{\n    "AccessKey": {\n        "UserName": "Bob",\n        "Status": "Active",\n        "CreateDate": "2015-03-09T18:39:23.411Z",\n        "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYzEXAMPLEKEY",\n        "AccessKeyId": "AKIAIOSFODNN7EXAMPLE"\n    }\n}\n'],
    'AWS CLI documentation output: both values are the vendor-published non-functional examples and visibly end in EXAMPLE / EXAMPLEKEY.'],
  ['ds-fake-in-value', 'docs/fake.conf', 'placeholders-documentation-examples', ['benign-lookalike'], ['detect-secrets'], 'verbatim',
    ['password = "somefakekey"\n'],
    'detect-secrets keyword_test.py: a value that names itself fake.'],
  ['ds-empty-values', 'docs/empty.conf', 'placeholders-documentation-examples', ['benign-lookalike'], ['detect-secrets'], 'verbatim',
    ['api_key = ""\nsecret: \'\'\n'],
    'detect-secrets keyword_test.py: empty quoted values.'],
  ['ds-asterisk-mask', 'docs/masked.conf', 'placeholders-documentation-examples', ['benign-lookalike'], ['detect-secrets'], 'composed',
    ['password = "*****"\n'],
    'detect-secrets is_not_alphanumeric_string("*****") placed in a password assignment: a fully masked value.'],
  ['np-hash-masked-password', 'docs/authn.rb', 'placeholders-documentation-examples', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    [":authn_dbd_params => 'host=db_host port=3306 user=apache password=###### dbname=apache_auth',\n"],
    'Nosey Parker np.generic.3 negative example: the password is a ###### mask.'],
  ['np-x-masked-password', 'docs/Backend.cs', 'placeholders-documentation-examples', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    ['#if DEBUG\n          string backend_host = "amazon-subdomain-for-database.string.us-east-1.rds.amazonaws.com";\n          string backend_user = "root";\n          string backend_pass = "XXXXXXXXXXXXX";\n          string backend_db = "database_db";\n          string backend_port = "1234";\n'],
    'Nosey Parker np.generic.3 negative example: the password is an X filler mask.'],

  // Token-like benign identifiers
  ['ds-uuids', 'ids/uuids.txt', 'token-like-benign-identifiers', ['benign-lookalike'], ['detect-secrets'], 'verbatim',
    ['3636dd46-ea21-11e9-81b4-2a2ae2dbcce4\n97fb0431-46ac-41df-9ef9-1a18545ce2a0\nprefix-3636dd46-ea21-11e9-81b4-2a2ae2dbcce4-suffix\n'],
    'detect-secrets test_is_potential_uuid: UUIDs with no credential context.'],
  ['ds-sequential-strings', 'ids/sequences.txt', 'token-like-benign-identifiers', ['benign-lookalike'], ['detect-secrets'], 'verbatim',
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZ\n0123456789abcdefghijklmnopqrstuvwxyz\nABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/\n0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/\n'],
    'detect-secrets TestIsSequentialString: alphabet sequences that look high-entropy but are not.'],
  ['ds-id-assignments', 'ids/ids.yaml', 'token-like-benign-identifiers', ['benign-lookalike'], ['detect-secrets'], 'verbatim',
    ['id: RANDOM_STRING\nuserid=RANDOM_STRING\ndata test_id = RANDOM_STRING\nmy_ids: RANDOM_STRING, RANDOM_STRING\n'],
    'detect-secrets TestIsLikelyIdString: identifiers assigned to id-named keys.'],
  ['np-iam-managed-policy-arn', 'ids/policy.tf', 'token-like-benign-identifiers', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    ['IAMUserChangePassword = "arn:aws:iam::aws:policy/IAMUserChangePassword"\n'],
    'Nosey Parker np.generic.5 negative example: a public AWS managed-policy ARN under a Password-named key.'],
  ['np-css-selector', 'ids/form.js', 'token-like-benign-identifiers', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    ['this.addPassword = "#add-password";\n'],
    'Nosey Parker np.generic.5 negative example: a DOM selector.'],
  ['np-ui-labels', 'ids/labels.js', 'token-like-benign-identifiers', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    ['usernameLabel:"Username or email:",passwordLabel:"Password:",rememberMeLabel:"Remember me:"\n'],
    'Nosey Parker np.generic.6 negative example: user-interface label text.'],
  ['np-docs-redirect-map', 'ids/redirects.json', 'token-like-benign-identifiers', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    ['"/en/enterprise/3.0/authentication/keeping-your-account-and-data-secure/creating-a-strong-password":"/en/enterprise-server@3.0/auth"\n'],
    'Nosey Parker np.generic.5 negative example: documentation paths.'],
  ['np-html-attribute-access-key', 'ids/plugin.html', 'token-like-benign-identifiers', ['benign-lookalike'], ['noseyparker'], 'verbatim',
    ['name="ws_plugin__s2member_amazon_s3_comp_files_access_key" id="ws-plugin--s2member-amazon-s3-comp-files-access-key"\n'],
    'Nosey Parker np.generic.2 negative example: form field names containing access_key.'],

  // Invisible and formatting characters
  ['ts-commenting-out-js', 'unicode/commenting-out.js', 'invisible-and-formatting-characters', ['unicode-confusable'], ['trojan-source'], 'verbatim',
    ['#!/usr/bin/env node\n\nvar isAdmin = false;\n/*\u202e } \u2066if (isAdmin)\u2069 \u2066 begin admins only */\n    console.log("You are an admin.");\n/* end admins only \u202e { \u2066*/\n'],
    'Trojan Source commenting-out.js: bidirectional override and isolate controls in code with no credential.'],
  ['ts-invisible-function-js', 'unicode/invisible-function.js', 'invisible-and-formatting-characters', ['unicode-confusable'], ['trojan-source'], 'verbatim',
    ['#!/usr/bin/env node\n\nfunction isAdmin() {\n    return false;\n}\n\nfunction is\u200bAdmin() {\n    return true;\n}\n\nif (is\u200bAdmin()) {\n    console.log("You are an admin\\n");\n} else {\n    console.log("You are NOT an admin.\\n");\n}\n'],
    'Trojan Source invisible-function.js: a zero-width space inside an identifier; no credential.'],
  ['ts-stretched-string-js', 'unicode/stretched-string.js', 'invisible-and-formatting-characters', ['unicode-confusable'], ['trojan-source'], 'verbatim',
    ['#!/usr/bin/env node\n\nvar accessLevel = "user";\nif (accessLevel != "user\u202e \u2066// Check if admin\u2069 \u2066") {\n    console.log("You are an admin.");\n}\n'],
    'Trojan Source stretched-string.js: bidi controls hide a comment inside a string literal; no credential.'],
  ['blns-format-controls-and-bom', 'unicode/format-controls.txt', 'invisible-and-formatting-characters', ['unicode-confusable'], ['blns'], 'verbatim',
    [null],
    'BLNS Cf line and byte-order-mark lines: every Unicode format control with no credential.'],
  ['blns-trick-unicode', 'unicode/trick.txt', 'invisible-and-formatting-characters', ['unicode-confusable'], ['blns'], 'verbatim',
    ['\u202a\u202atest\u202a\n\u202btest\u202b\n\u2029test\u2029\ntest\u2060test\u202b\n\u2066test\u2067\n'],
    'BLNS "Trick Unicode" section: embedding, separator and isolate controls with no credential.'],
  ['composed-zero-width-inside-bearer', 'unicode/zwsp-bearer.http', 'invisible-and-formatting-characters', ['unicode-confusable', 'encoding-obfuscation'], ['rfc6750', 'trojan-source'], 'composed',
    ['Authorization: Bearer ', S('mF_9.B5f\u200b-4.1JqM'), '\n'],
    'The RFC 6750 bearer token with the Trojan Source zero-width space inserted inside it; the whole visible token, the invisible character included, is the secret span.'],
  ['composed-rlo-after-token', 'unicode/rlo-token.env', 'invisible-and-formatting-characters', ['unicode-confusable'], ['rfc6749', 'trojan-source'], 'composed',
    ['ACCESS_TOKEN=', S('2YotnFZFEjr1zCsicMWpAA'), '\u202e # expires 3600\u202c\n'],
    'The RFC 6749 access token followed by a Trojan Source right-to-left override; the control characters are not part of the token.'],
  ['composed-bom-crlf-basic', 'unicode/bom-basic.http', 'invisible-and-formatting-characters', ['unicode-confusable', 'multiline-structure'], ['rfc7617', 'blns'], 'composed',
    ['\ufeffAuthorization: Basic ', S(BASIC_ALADDIN), '\r\nHost: www.example.com\r\n'],
    'The RFC 7617 header after a BLNS byte-order mark, with CRLF line endings.'],

  // Prefix truncation and extension
  ['composed-secret-token-uppercase-scheme', 'prefix/uppercase-scheme.txt', 'prefix-truncation-and-extension', ['format-mimicry'], ['rfc8959', 'rfc3986'], 'composed',
    ['token = ', S('SECRET-TOKEN:E92FB7EB-D882-47A4-A265-A0B6135DC842%20foo'), '\n'],
    'RFC 3986 section 3.1 makes URI schemes case-insensitive, so an upper-case secret-token URI is still the RFC 8959 credential.'],
  ['composed-secret-token-empty-body', 'prefix/empty-scheme.toml', 'prefix-truncation-and-extension', ['format-mimicry', 'benign-lookalike'], ['rfc8959'], 'composed',
    ['token_uri_prefix = "secret-token:"\n'],
    'The bare RFC 8959 scheme with no token after it carries no secret.'],
  ['composed-extended-key-names-benign', 'prefix/extended-keys.txt', 'prefix-truncation-and-extension', ['format-mimicry', 'benign-lookalike'], ['rfc6749', 'rfc6750'], 'composed',
    ['access_token_type=Bearer&refresh_token_expires_in=3600\n'],
    'Parameter names that extend access_token and refresh_token; their values are a token type and a lifetime, not tokens.'],
  ['composed-prefixed-key-name-secret', 'prefix/prefixed-key.env', 'prefix-truncation-and-extension', ['format-mimicry'], ['rfc6750'], 'composed',
    ['X_ACCESS_TOKEN=', S('mF_9.B5f-4.1JqM'), '\n'],
    'An access_token name with an extra prefix still holds the RFC 6750 bearer token.'],
  ['composed-basic-lowercase-scheme', 'prefix/lowercase-basic.http', 'prefix-truncation-and-extension', ['format-mimicry'], ['rfc7617'], 'composed',
    ['authorization: basic ', S(BASIC_ALADDIN), '\n'],
    'HTTP field names and auth schemes are case-insensitive (RFC 7617 section 2 via RFC 7235), so a lower-case Basic header is still a credential.'],

  // Bounded oversized and high-finding-count inputs
  ['ds-long-base64-data-uri', 'bounded/long-line.html', 'bounded-oversized-inputs', ['other', 'benign-lookalike'], ['detect-secrets'], 'composed',
    [`<img src="data:image/png;base64,b'${Buffer.from('7'.repeat(24000)).toString('base64')}'\n"\n>\n`],
    'detect-secrets LONG_LINE (24000 repeated digits, base64-encoded, in a data URI); the test draws the digit at random, and 7 was fixed here. An inline image payload, not a credential.'],
  ['composed-two-hundred-basic-headers', 'bounded/many-headers.log', 'bounded-high-finding-count', ['other', 'embedded-structure'], ['rfc7617'], 'composed',
    Array.from({ length: 200 }, () => ['Authorization: Basic ', S(BASIC_ALADDIN), '\n']).flat(),
    'Two hundred copies of the RFC 7617 header: each occurrence is its own credential span.'],
];

const BLNS_CF = '\u00ad\u0600\u0601\u0602\u0603\u0604\u0605\u061c\u06dd\u070f\u180e\u200b\u200c\u200d\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\u206a\u206b\u206c\u206d\u206e\u206f\ufeff\ufff9\ufffa\ufffb\ud804\udcbd\ud82f\udca0\ud82f\udca1\ud82f\udca2\ud82f\udca3\ud834\udd73\ud834\udd74\ud834\udd75\ud834\udd76\ud834\udd77\ud834\udd78\ud834\udd79\ud834\udd7a\udb40\udc01\udb40\udc20\udb40\udc21\udb40\udc22\udb40\udc23\udb40\udc24\udb40\udc25\udb40\udc26\udb40\udc27\udb40\udc28\udb40\udc29\udb40\udc2a\udb40\udc2b\udb40\udc2c\udb40\udc2d\udb40\udc2e\udb40\udc2f\udb40\udc30\udb40\udc31\udb40\udc32\udb40\udc33\udb40\udc34\udb40\udc35\udb40\udc36\udb40\udc37\udb40\udc38\udb40\udc39\udb40\udc3a\udb40\udc3b\udb40\udc3c\udb40\udc3d\udb40\udc3e\udb40\udc3f\udb40\udc40\udb40\udc41\udb40\udc42\udb40\udc43\udb40\udc44\udb40\udc45\udb40\udc46\udb40\udc47\udb40\udc48\udb40\udc49\udb40\udc4a\udb40\udc4b\udb40\udc4c\udb40\udc4d\udb40\udc4e\udb40\udc4f\udb40\udc50\udb40\udc51\udb40\udc52\udb40\udc53\udb40\udc54\udb40\udc55\udb40\udc56\udb40\udc57\udb40\udc58\udb40\udc59\udb40\udc5a\udb40\udc5b\udb40\udc5c\udb40\udc5d\udb40\udc5e\udb40\udc5f\udb40\udc60\udb40\udc61\udb40\udc62\udb40\udc63\udb40\udc64\udb40\udc65\udb40\udc66\udb40\udc67\udb40\udc68\udb40\udc69\udb40\udc6a\udb40\udc6b\udb40\udc6c\udb40\udc6d\udb40\udc6e\udb40\udc6f\udb40\udc70\udb40\udc71\udb40\udc72\udb40\udc73\udb40\udc74\udb40\udc75\udb40\udc76\udb40\udc77\udb40\udc78\udb40\udc79\udb40\udc7a\udb40\udc7b\udb40\udc7c\udb40\udc7d\udb40\udc7e\udb40\udc7f';

export function fixtures() {
  return F.map(([id, path, issueCategory, threatCategories, sources, excerpt, parts, rationale]) => {
    const resolved = parts[0] === null ? [`${BLNS_CF}\n\n\ufeff\n\ufffe\n`] : parts;
    const { content, expected } = build(resolved);
    return {
      fixture: {
        id, path, content,
        action: expected.length ? 'must-redact' : 'must-not-flag',
        expected, threatCategories, credentialStatus: 'synthetic',
        rationale: `${rationale} Source: ${sources.join(', ')} (${excerpt}).`,
      },
      source: { id, issueCategory, sources, excerpt },
    };
  });
}

function main() {
  const out = join(here, 'intake.json');
  if (existsSync(out) && JSON.parse(readFileSync(out, 'utf8')).status !== 'submitted') {
    throw new Error('intake.json has left submitted; its fixtures are frozen and this script must not rewrite them');
  }
  const built = fixtures();
  const list = built.map(b => b.fixture);
  const categories = [...new Set(list.flatMap(f => f.threatCategories))].sort();
  const record = {
    schemaVersion: 1,
    id: 'beta9-external-inputs',
    title: 'Beta.9 adversarial pack assembled from externally authored public inputs',
    sample: false,
    status: 'submitted',
    qualification: 'maintainer-regression',
    author: {
      attribution: `${ASSEMBLER} (assembled by a maintainer-directed agent from externally authored public sources)`,
      attributionKind: 'organization',
      affiliation: 'project-maintainer',
      contact: 'github:redact-secret',
    },
    implementationExposure: {
      inspectedDetectorImplementation: true,
      detail: 'The assembler works inside the project and had read the product contextual-detection spec (placeholder, template and masking rules) before choosing actions. The upstream authors of the excerpted inputs never saw redact-secret; that does not make this pack externally authored, because selection, composition, actions and ranges are the project\'s.',
    },
    provenance: {
      credentialStatus: 'synthetic',
      construction: 'No value was generated or altered to look like a live credential. Every credential-like value is a published, non-functional example copied verbatim from an IETF RFC (6749, 6750, 7515, 7519, 7617, 7636, 8959), the AWS CLI documentation, or the detect-secrets and Nosey Parker test suites, whose authors wrote them as fakes. Nosey Parker positive examples of uncertain origin were excluded. Composed fixtures only place those same values into new context. Per-fixture sources are in sources.json.',
    },
    license: {
      spdx: 'MIT AND Apache-2.0 AND BSD-3-Clause',
      redistribution: true,
      grant: 'Excerpts keep their upstream licenses: detect-secrets, Nosey Parker and aws-cli under Apache-2.0; the Big List of Naughty Strings and Trojan Source under MIT; RFC examples under the IETF Trust Legal Provisions (code components under BSD-3-Clause). Assembly and compositions are contributed under this repository\'s MIT license. Attribution: sources.json and README.md.',
    },
    threatCategories: categories,
    expectations: {
      authoring: 'Actions and ranges were authored from each value\'s published meaning (the RFC or test that defines it) and marked in build-intake.mjs as credential parts; the script converts the marks to UTF-8 byte ranges. No scanner, including redact-secret, Gitleaks, TruffleHog and flare-redact, was run on any fixture before this digest was committed.',
      scannerOutputConsulted: false,
      digest: expectationsDigest(list),
    },
    fixtures: list,
    submittedAt: SUBMITTED_AT,
    history: [{ status: 'submitted', at: SUBMITTED_AT, by: ASSEMBLER }],
    maintainerEdits: [],
  };
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(join(here, 'sources.json'), `${JSON.stringify({
    schemaVersion: 1,
    packId: record.id,
    description: 'Per-fixture provenance for beta9-external-inputs. issueCategory is the #140 category; verbatim excerpts drop only RFC figure indentation and add a final newline.',
    sources: SOURCES,
    fixtures: built.map(b => b.source),
  }, null, 2)}\n`);
  console.log(`wrote ${list.length} fixtures (${list.filter(f => f.action === 'must-redact').length} must-redact), digest ${record.expectations.digest}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
