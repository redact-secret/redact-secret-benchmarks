// redact-secret#1247: independent corpus for the `curl -u` / `--user` password carrier.
//
// Authored BEFORE any reader exists, by someone who is not the implementer. The
// expected outcome of every case is stated from curl's documented argument
// semantics (man curl: `-u, --user <user:password>`, the password follows the first
// colon; no colon means curl prompts), never from a scanner's output. Nothing in
// this file runs or imports a scanner.
//
// Values are built at run time from public SHA-256 seeds (`synthetic`), never
// issued by any provider. No secret-shaped literal is stored in this file, so the
// repository holds no plaintext password.
//
// Expectation vocabulary (field `expectation`):
//   must-redact   a reader of this carrier claims exactly `expected` (password only).
//   must-not-flag the carrier reader must stay silent; `rationale` says why by
//                 construction (no password, a reference, another tool, ...).
//   accepted-fn   a real password sits in a form the decision does not read.
//                 `unread` holds the span a reader would need; `expected` is [].
//
// Offsets are UTF-16 code-unit indices into `content` (`start`/`end`) with the
// UTF-8 byte offsets alongside (`byteStart`/`byteEnd`), end exclusive.
import { createHash } from "node:crypto";

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HEX = "0123456789abcdef";

export function synthetic(label, length, chars = ALNUM) {
  let value = "";
  for (let block = 0; value.length < length; block++) {
    const bytes = createHash("sha256").update(`secret-benchmark:never-issued:v2:curl-user-1247:${label}:${block}`).digest();
    for (const byte of bytes) value += chars[byte % chars.length];
  }
  return value.slice(0, length);
}

const uuidShape = label => {
  const h = synthetic(label, 32, HEX);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const HOST = "https://api.example.invalid/v1/items";
const cases = [];
const ids = new Set();

// parts: strings, { secret }, or { unread }. A secret/unread part marks the span.
function add(id, group, expectation, parts, rationale, extra = {}) {
  if (ids.has(id)) throw new Error(`duplicate case id ${id}`);
  ids.add(id);
  let content = "";
  const expected = [];
  const unread = [];
  const spans = [];
  for (const part of parts) {
    if (typeof part === "string") { content += part; continue; }
    const value = part.secret ?? part.unread;
    const span = { start: content.length, end: content.length + value.length };
    span.byteStart = Buffer.byteLength(content, "utf8");
    span.byteEnd = span.byteStart + Buffer.byteLength(value, "utf8");
    content += value;
    (part.secret !== undefined ? expected : unread).push(span);
    spans.push(span);
  }
  if (expectation === "must-redact" && expected.length === 0) throw new Error(`${id}: must-redact needs a { secret } part`);
  if (expectation !== "must-redact" && expected.length > 0) throw new Error(`${id}: only must-redact carries { secret }`);
  if (expectation === "accepted-fn" && unread.length === 0) throw new Error(`${id}: accepted-fn needs an { unread } part`);
  cases.push({ id, group, expectation, content, expected, unread, rationale, ...extra });
}
const pw = (id, n = 20, chars = ALNUM) => synthetic(`pw:${id}`, n, chars);

// ---------------------------------------------------------------- positives
// Plain spellings. The span is the password only: everything after the first colon
// of the argument, up to the end of the argument.
for (const [slug, flag, joiner] of [
  ["short-flag", "-u", " "], ["long-flag", "--user", " "], ["long-equals", "--user", "="],
  ["short-attached", "-u", ""], ["proxy-long", "--proxy-user", " "], ["proxy-short", "-U", " "],
]) {
  const v = pw(`spell-${slug}`);
  add(`spelling-${slug}`, "spelling", "must-redact",
    ["curl ", flag, joiner, "svc_reader:", { secret: v }, ` ${HOST}\n`],
    `curl takes the text after the first colon of the ${flag} argument as the password.`);
}
{
  const v = pw("flag-after-url");
  add("order-flag-after-url", "spelling", "must-redact",
    [`curl ${HOST} -X GET -H 'Accept: application/json' -u svc_reader:`, { secret: v }, "\n"],
    "curl accepts options after the URL; the credential argument is the same.");
}
{
  const v = pw("cluster");
  add("spelling-short-cluster", "spelling", "must-redact",
    ["curl -sSfLku svc_reader:", { secret: v }, ` ${HOST}\n`],
    "-u closes a cluster of argument-less short options and takes the next word as its argument.");
}
{
  const v = pw("exe");
  add("command-curl-exe", "command-word", "must-redact",
    ["curl.exe -u svc_reader:", { secret: v }, ` ${HOST}\r\n`],
    "curl.exe is curl on Windows; the argument is unchanged, CRLF ends the command.");
}
{
  const v = pw("abs-path");
  add("command-absolute-path", "command-word", "must-redact",
    ["/usr/bin/curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "A path-qualified command word is still curl.");
}
{
  const v = pw("sudo");
  add("command-after-sudo", "command-word", "must-redact",
    ["sudo curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "A wrapper word before curl does not change curl's arguments.");
}
{
  const v = pw("pipe");
  add("command-before-pipe", "command-word", "must-redact",
    ["curl -sS -u svc_reader:", { secret: v }, ` ${HOST} | jq .items\n`],
    "The argument ends at whitespace; the pipe is another command.");
}
{
  const a = pw("two-a"), b = pw("two-b");
  add("two-commands-one-line", "command-word", "must-redact",
    ["curl -u alpha:", { secret: a }, ` ${HOST} && curl -u beta:`, { secret: b }, ` ${HOST}\n`],
    "Each curl command carries its own credential argument.");
}
{
  const v = pw("subst");
  add("command-in-substitution", "command-word", "must-redact",
    ["BODY=$(curl -s -u svc_reader:", { secret: v }, ` ${HOST})\n`],
    "curl inside $( ) is still curl; the password argument ends at whitespace, well before the closing parenthesis.");
}
{
  const v = pw("bash-c");
  add("command-inside-bash-c", "command-word", "must-redact",
    ["bash -c \"curl -u svc_reader:", { secret: v }, ` ${HOST}\"\n`],
    "The inner command line is text curl receives unchanged.");
}
{
  const v = pw("continuation");
  add("continuation-backslash", "continuation", "must-redact",
    [`curl -X GET \\\n  -H 'Accept: application/json' \\\n  -u svc_reader:`, { secret: v }, ` \\\n  ${HOST}\n`],
    "A backslash-newline continues the command line; the option sits in the same command.");
}
{
  const v = pw("continuation-crlf");
  add("continuation-crlf", "continuation", "must-redact",
    [`curl -X GET \\\r\n  -u svc_reader:`, { secret: v }, ` \\\r\n  ${HOST}\r\n`],
    "Backslash-CRLF continues the command line on Windows-edited scripts.");
}
{
  const v = pw("single");
  add("quote-single", "quoting", "must-redact",
    ["curl -u 'svc_reader:", { secret: v }, `' ${HOST}\n`],
    "Single quotes group the argument; the shell removes them, the password is inside.");
}
{
  const v = pw("double");
  add("quote-double", "quoting", "must-redact",
    ['curl -u "svc_reader:', { secret: v }, `" ${HOST}\n`],
    "Double quotes group the argument; the password is inside.");
}
{
  const v = pw("quoted-space", 8) + " " + pw("quoted-space-2", 8);
  add("quote-with-space", "quoting", "must-redact",
    ['curl -u "svc_reader:', { secret: v }, `" ${HOST}\n`],
    "Inside quotes a space is a password byte; the argument ends at the closing quote.");
}
{
  const v = pw("single-with-dq", 8) + '"' + pw("single-with-dq-2", 8);
  add("quote-single-containing-double", "quoting", "must-redact",
    ["curl -u 'svc_reader:", { secret: v }, `' ${HOST}\n`],
    "A double quote inside single quotes is a literal password byte.");
}
{
  const v = pw("dq-with-sq", 8) + "'" + pw("dq-with-sq-2", 8);
  add("quote-double-containing-single", "quoting", "must-redact",
    ['curl -u "svc_reader:', { secret: v }, `" ${HOST}\n`],
    "A single quote inside double quotes is a literal password byte.");
}
{
  const v = "!" + pw("bang", 6) + "\\$" + pw("bang-2", 6) + "\\!";
  add("quote-none-backslash-escapes", "quoting", "must-redact",
    ["curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "In an unquoted word a backslash escapes the next byte; the span is the raw text as written, not the shell-decoded value.");
}
{
  const v = pw("colon-a", 6) + ":" + pw("colon-b", 6);
  add("password-contains-colon", "password-shape", "must-redact",
    ["curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "curl splits at the FIRST colon only; a later colon belongs to the password.");
}
{
  const v = pw("at-a", 6) + "@" + pw("at-b", 6);
  add("password-contains-at", "password-shape", "must-redact",
    ["curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "No URL parsing happens: an @ in the argument is a password byte (a URL-userinfo reader would reject this).");
}
{
  const v = pw("pct-a", 6) + "%zz" + pw("pct-b", 6);
  add("password-contains-percent", "password-shape", "must-redact",
    ["curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "No percent-decoding for -u: a literal percent sequence is kept as written.");
}
{
  const v = pw("empty-user");
  add("empty-user-with-password", "password-shape", "must-redact",
    ["curl -u :", { secret: v }, ` ${HOST}\n`],
    "An empty username with a non-empty password still sends that password.");
}
{
  const v = pw("weak-admin", 5, "abcdefghij");
  add("short-weak-password", "password-shape", "must-redact",
    ["curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "A short low-entropy password is still the password slot; the carrier, not the value, makes it a credential.");
}
{
  const v = pw("korean-user");
  add("non-ascii-user-and-comment", "password-shape", "must-redact",
    ["# \uc11c\ube44\uc2a4 \ud638\ucd9c\ncurl -u \uc0ac\uc6a9\uc790:", { secret: v }, ` ${HOST}\n`],
    "Non-ASCII text before the span moves UTF-8 offsets away from UTF-16 offsets; the span is still the password.");
}
{
  const v = pw("both-userinfo-and-flag");
  const u = pw("both-userinfo-and-flag-2");
  add("flag-and-url-userinfo", "composition", "must-redact",
    ["curl -u svc_reader:", { secret: v }, ` https://other:`, { secret: u }, "@api.example.invalid/v1\n"],
    "Both the flag password and the URL userinfo password are credentials; each is claimed once, no overlap.");
}

// Contexts the carrier appears in.
for (const [slug, prefix, suffix] of [
  ["shell-script", "#!/bin/sh\nset -eu\nURL=https://api.example.invalid/v1\n", `\n`],
  ["markdown-prompt", "Run this against the sandbox:\n\n```sh\n$ ", "\n```\n"],
  ["dockerfile-run", "FROM alpine:3.20\nRUN apk add --no-cache curl && ", "\n"],
  ["ci-yaml-run", "steps:\n  - run: ", "\n"],
  ["makefile-recipe", "fetch:\n\t@", "\n"],
  ["powershell-here", "PS C:\\> ", "\r\n"],
]) {
  const v = pw(`ctx-${slug}`);
  const quote = slug === "ci-yaml-run" ? ["'curl -sS -u svc_reader:", { secret: v }, ` ${HOST}'`] : ["curl -sS -u svc_reader:", { secret: v }, ` ${HOST}`];
  add(`context-${slug}`, "context", "must-redact", [prefix, ...quote, suffix],
    `The curl command line is the same text in a ${slug.replace(/-/g, " ")}; the shell or YAML layer does not alter the argument.`);
}
{
  const v = pw("sh-var");
  add("context-var-assignment-prefix", "context", "must-redact",
    ["LC_ALL=C curl -u svc_reader:", { secret: v }, ` ${HOST}\n`],
    "An environment assignment before the command word does not change curl's arguments.");
}

// The three provider carriers named by the issue.
{
  const token = pw("zendesk", 40);
  add("provider-zendesk-email-token", "provider-carrier", "must-redact",
    [`curl ${HOST} -u jdoe@example.invalid/token:`, { secret: token }, "\n"],
    "Zendesk documents `{email}/token:{token}` as the Basic username and password; the token is the password after the first colon, the email and the literal /token stay unclaimed.");
}
{
  const token = pw("zendesk-quoted", 40);
  add("provider-zendesk-email-token-quoted", "provider-carrier", "must-redact",
    [`curl ${HOST} --user "jdoe@example.invalid/token:`, { secret: token }, '"\n'],
    "Same carrier, quoted long spelling.");
}
{
  const key = "AKC" + "p" + pw("jfrog-key", 69);
  add("provider-jfrog-api-key", "provider-carrier", "must-redact",
    ["curl -u svc_reader:", { secret: key }, " https://acme.jfrog.invalid/artifactory/api/repositories\n"],
    "JFrog accepts an API key as the Basic password; the password slot is the whole argument remainder.");
}
{
  const ref = pw("jfrog-ref", 64);
  add("provider-jfrog-reference-token", "provider-carrier", "must-redact",
    ["curl --user svc_reader:", { secret: ref }, " https://acme.jfrog.invalid/artifactory/api/repositories\n"],
    "JFrog accepts a reference token as the Basic password; the carrier, not the token grammar, makes the span.");
}
{
  const priv = uuidShape("atlas-private");
  add("provider-atlas-digest-private-key", "provider-carrier", "must-redact",
    ['curl --user "', pw("atlas-public", 8, "abcdefghijklmnopqrstuvwxyz"), ":", { secret: priv }, '" --digest \\\n  --header "Accept: application/json" \\\n  --request GET "https://cloud.mongodb.invalid/api/atlas/v2/groups"\n'],
    "Atlas sends `public:private` with HTTP Digest; --digest changes the wire scheme, not the argument, so the private key after the first colon is the password and the public key stays unclaimed.");
}
{
  const priv = uuidShape("atlas-private-2");
  add("provider-atlas-digest-before-user", "provider-carrier", "must-redact",
    ["curl --digest -u ", pw("atlas-public-2", 8, "abcdefghijklmnopqrstuvwxyz"), ":", { secret: priv }, " https://cloud.mongodb.invalid/api/atlas/v2/groups\n"],
    "Option order is free; --digest before -u reads the same password.");
}
{
  const priv = uuidShape("atlas-private-3");
  add("provider-atlas-anyauth", "provider-carrier", "must-redact",
    ["curl --anyauth -u ", pw("atlas-public-3", 8, "abcdefghijklmnopqrstuvwxyz"), ":", { secret: priv }, " https://cloud.mongodb.invalid/api/atlas/v2/groups\n"],
    "--anyauth lets curl pick the scheme; the credential argument is unchanged.");
}

// Documented weak literals are NOT excluded here: only the placeholder vocabulary,
// reference forms and masks are (see benign below). A real service can use these.
for (const word of ["admin", "pass", "test1234", "hunter2"]) {
  add(`weak-literal-${word}`, "weak-literal", "must-redact",
    ["curl -u svc_reader:", { secret: word }, ` ${HOST}\n`],
    "Not a placeholder, reference or mask: a weak but real-shaped password. Redacting it is the security-first default; in documentation it is an accepted false positive.");
}

// ------------------------------------------------------------------ benign
const quiet = (id, group, parts, rationale, extra) => add(id, group, "must-not-flag", parts, rationale, extra);

// Forms with no password.
quiet("nopass-user-only", "no-password", [`curl -u svc_reader ${HOST}\n`], "No colon: curl prompts for the password; there is none in the text.");
quiet("nopass-user-colon-empty", "no-password", [`curl -u svc_reader: ${HOST}\n`], "A colon with an empty remainder sends an empty password.");
quiet("nopass-colon-only", "no-password", [`curl -u : ${HOST}\n`], "Both parts empty.");
quiet("nopass-negotiate-colon", "no-password", [`curl --negotiate -u : ${HOST}\n`], "The documented Kerberos idiom: `-u :` with --negotiate carries no secret.");
quiet("nopass-quoted-colon-only", "no-password", [`curl -u ":" ${HOST}\n`], "Quoted empty user and password.");
quiet("nopass-user-quoted-empty-pass", "no-password", [`curl -u 'svc_reader:' ${HOST}\n`], "Quoted empty password.");
quiet("nopass-spaced-colon-word", "no-password", [`curl -u svc_reader : ${HOST}\n`], "The colon is a separate word, not part of the -u argument.");
quiet("nopass-long-user-only-equals", "no-password", [`curl --user=svc_reader ${HOST}\n`], "No colon in the argument.");

// Other ways to authenticate with no secret in the command line.
quiet("alt-netrc", "alt-auth", [`curl --netrc ${HOST}\n`], "Credentials come from ~/.netrc, not the command line.");
quiet("alt-netrc-short", "alt-auth", [`curl -n ${HOST}\n`], "-n is --netrc.");
quiet("alt-netrc-optional", "alt-auth", [`curl --netrc-optional ${HOST}\n`], "Same, optional.");
quiet("alt-netrc-file", "alt-auth", [`curl --netrc-file "$HOME/.config/svc/netrc" ${HOST}\n`], "A file path, not a credential.");
quiet("alt-digest-only", "alt-auth", [`curl --digest ${HOST}\n`], "--digest alone selects the scheme and carries no credential.");
quiet("alt-anyauth-netrc", "alt-auth", [`curl --anyauth --netrc ${HOST}\n`], "Scheme selection plus netrc.");
quiet("alt-cert-auth", "alt-auth", [`curl --cert ./client.pem --key ./client.key ${HOST}\n`], "Client certificate paths.");
quiet("alt-bearer-env", "alt-auth", [`curl -H "Authorization: Bearer $API_TOKEN" ${HOST}\n`], "A reference to an environment variable.");

// References and placeholders in the password slot.
for (const [slug, text, why] of [
  ["env-braced", "${CURL_PASS}", "Whole-value environment reference."],
  ["env-bare", "$CURL_PASS", "Whole-value environment reference."],
  ["env-windows", "%CURL_PASS%", "Whole-value Windows environment reference."],
  ["command-substitution", "$(cat /run/secrets/svc_pass)", "Whole-value command substitution; the secret is read at run time."],
  ["backtick-substitution", "`pass show svc/api`", "Whole-value backtick substitution."],
  ["angle-placeholder", "<password>", "Angle-bracket fill-in marker."],
  ["angle-your-password", "<your password>", "Angle-bracket fill-in marker."],
  ["mask-stars", "********", "Mask."],
  ["mask-x", "xxxxxxxxxxxx", "Mask."],
  ["mask-dots", "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", "Mask."],
  ["vocab-your-password", "YOUR_PASSWORD_HERE", "Fill-in prose."],
  ["vocab-replace-me", "replace_me", "Fill-in prose."],
  ["vocab-changeme", "changeme", "Placeholder vocabulary."],
  ["vocab-example", "example", "Placeholder vocabulary."],
  ["literal-password", "password", "The documented literal naming the slot (curl documentation style `user:password`)."],
  ["literal-secret", "secret", "Documentation literal."],
  ["literal-changeit", "changeit", "A documented default shipped with every JDK, not an operator secret."],
  ["template-double-brace", "{{ secrets.SVC_PASS }}", "Template reference."],
]) {
  const quote = text.startsWith("`") || text.includes(" ") || text.includes("$(");
  const arg = quote ? `"svc_reader:${text}"` : `svc_reader:${text}`;
  quiet(`ref-${slug}`, "placeholder-reference", [`curl -u ${arg} ${HOST}\n`], why);
}
quiet("ref-env-in-both-parts", "placeholder-reference", [`curl -u "$CURL_USER:$CURL_PASS" ${HOST}\n`], "Both parts are variable references.");
quiet("ref-env-braced-both-parts", "placeholder-reference", [`curl -u "\${CURL_USER}:\${CURL_PASS}" ${HOST}\n`], "Both parts are braced variable references.");
quiet("ref-github-actions-expression", "placeholder-reference", [`steps:\n  - run: curl -u "\${{ secrets.SVC_USER }}:\${{ secrets.SVC_PASS }}" ${HOST}\n`], "A workflow expression resolves at run time.");

// Options that merely share a prefix or letter with -u.
quiet("lookalike-user-agent", "lookalike-option", [`curl --user-agent "svc/1.0:build" ${HOST}\n`], "--user-agent is not --user; its argument is a header value.");
quiet("lookalike-short-user-agent", "lookalike-option", [`curl -A "svc/1.0:build" ${HOST}\n`], "-A is --user-agent.");
quiet("lookalike-upload-file", "lookalike-option", [`curl -T ./report:2026.txt ${HOST}/upload\n`], "-T uploads a file.");
quiet("lookalike-unix-socket", "lookalike-option", [`curl --unix-socket /var/run/svc.sock:ro http://localhost/info\n`], "--unix-socket takes a path.");
quiet("lookalike-header-with-colons", "lookalike-option", [`curl -H "X-User: svc_reader:build" ${HOST}\n`], "A header value.");
quiet("lookalike-data-form", "lookalike-option", [`curl -d "u=svc_reader:build" ${HOST}\n`], "Form data, not a credential argument.");
quiet("lookalike-proxy-with-userinfo-free", "lookalike-option", [`curl -x http://proxy.example.invalid:3128 ${HOST}\n`], "A proxy host and port.");
quiet("lookalike-resolve", "lookalike-option", [`curl --resolve api.example.invalid:443:192.0.2.10 ${HOST}\n`], "Host:port:address mapping.");

// -u of other tools (uid:gid, update, upstream, user).
for (const [slug, line, why] of [
  ["docker-run-uid-gid", "docker run --rm -u 1000:1000 alpine:3.20 id", "docker -u is user[:group]."],
  ["docker-run-names", "docker run --rm -u appuser:appgroup alpine:3.20 id", "docker -u names, not a password."],
  ["docker-exec", "docker exec -u root:root svc_container ls /", "docker exec -u is user[:group]."],
  ["sudo-user", "sudo -u postgres psql -c 'select 1'", "sudo -u runs as a user."],
  ["git-push-upstream", "git push -u origin main", "git -u is --set-upstream."],
  ["unzip-update", "unzip -u archive.zip -d out", "unzip -u updates existing files."],
  ["tar-update", "tar -uf archive.tar notes.txt", "tar -u appends newer files."],
  ["cp-update", "cp -u src.txt dst.txt", "cp -u copies when newer."],
  ["rsync-update", "rsync -avu ./src/ host.example.invalid:/dst/", "rsync -u skips newer files."],
  ["useradd-uid", "useradd -u 1001 -g 1001 svc_reader", "useradd -u is a numeric uid."],
  ["ps-user", "ps -u svc_reader -o pid,cmd", "ps -u selects a user."],
  ["nc-udp", "nc -u 192.0.2.1 5353", "nc -u is UDP."],
  ["pip-upgrade", "pip install -U requests", "pip -U is --upgrade."],
  ["chown-user-group", "chown -R www-data:www-data /srv/app", "chown user:group."],
  ["crontab-user", "crontab -u svc_reader -l", "crontab -u selects a user."],
  ["psql-user", "psql -h db.example.invalid -U svc_reader -d app", "psql -U is a user name."],
  ["ssh-user", "ssh -l svc_reader host.example.invalid", "ssh -l is a user name."],
]) quiet(`other-tool-${slug}`, "other-tool", [line, "\n"], why);
quiet("other-tool-curl-word-in-url", "other-tool", ["docker run -u 1000:1000 curlimages/curl:8.10.1 --version\n"], "The image name contains curl, but the -u belongs to docker and is a uid:gid.");

// The command-word boundary: -u in a different command is not curl's.
quiet("bound-after-semicolon", "command-boundary", [`curl -sS ${HOST}; docker run -u 1000:1000 alpine:3.20 id\n`], "A semicolon ends the curl command; the -u is docker's.");
quiet("bound-after-and", "command-boundary", [`curl -sS ${HOST} && sudo -u postgres psql\n`], "&& ends the curl command.");
quiet("bound-after-pipe", "command-boundary", [`curl -sS ${HOST} | docker run -i -u 1000:1000 alpine:3.20 cat\n`], "A pipe ends the curl command.");
quiet("bound-next-line", "command-boundary", [`curl -sS ${HOST}\ndocker run -u 1000:1000 alpine:3.20 id\n`], "A newline without a continuation ends the command.");
quiet("bound-before-curl", "command-boundary", [`echo -u 1000:1000 | curl -sS ${HOST}\n`], "The -u precedes curl and belongs to echo.");
quiet("bound-wrapper-name", "command-boundary", [`mycurl -u 1000:1000 ${HOST}\n`], "mycurl is not the curl command word.");
quiet("bound-prose-mention", "command-boundary", ["The `-u svc_reader:2026` flag of the wrapper takes a uid pair.\n"], "No curl command word anywhere near the option.");

// ---------------------------------------------------------- accepted false negatives
const fn = (id, group, parts, rationale, extra) => add(id, group, "accepted-fn", parts, rationale, extra);
{
  const v = pw("curlrc");
  fn("fn-curlrc-user", "unread-carrier", ["# ~/.curlrc\nuser = \"svc_reader:", { unread: v }, "\"\n"],
    "The curl config-file carrier (-K, ~/.curlrc) is a different grammar and is not read by this decision.");
}
{
  const v = pw("python-list");
  fn("fn-python-argv-list", "unread-carrier", ["subprocess.run([\"curl\", \"-u\", \"svc_reader:", { unread: v }, `", "${HOST}"])\n`],
    "The command is a language argument list, not a shell command line; no whitespace-separated option word exists.");
}
{
  const v = pw("json-argv");
  fn("fn-json-argv-array", "unread-carrier", ["{\"command\": [\"curl\", \"--user\", \"svc_reader:", { unread: v }, "\"]}\n"],
    "Same: an argument array in JSON.");
}
{
  const v = pw("wget");
  fn("fn-wget-password-flag", "other-tool-credential", ["wget --user=svc_reader --password=", { unread: v }, ` ${HOST}\n`],
    "A different tool and a split user/password pair; not the curl carrier.");
}
{
  const v = pw("httpie");
  fn("fn-httpie-auth", "other-tool-credential", ["http -a svc_reader:", { unread: v }, ` ${HOST}\n`],
    "HTTPie -a takes the same shape but is another tool; named a stated false negative.");
}
{
  const v = pw("mysql");
  fn("fn-mysql-attached-password", "other-tool-credential", ["mysql -u svc_reader -p", { unread: v }, " app\n"],
    "mysql -u takes a user only; the attached -p password is another carrier.");
}
{
  const v = pw("unterminated", 16);
  fn("fn-unterminated-quote-eof", "malformed", ['curl -u "svc_reader:', { unread: v }],
    "An unterminated quote leaves the end of the argument undefined; the reader stays silent rather than invent a span.");
}
{
  const v = pw("heredoc");
  fn("fn-variable-built-argument", "unread-carrier", ["AUTH=svc_reader:", { unread: v }, `\ncurl -u "$AUTH" ${HOST}\n`],
    "The credential is assigned to a variable on another line; the -u argument is a reference (read by the assignment rule, not by this carrier).");
}
{
  const v = pw("long", 4200);
  fn("fn-over-bound-password", "malformed", ["curl -u svc_reader:", { unread: v }, ` ${HOST}\n`],
    "A password above the shared connection-string bound (4096 bytes) is outside the reader.");
}
{
  const v = pw("nested-bash-quote", 16);
  fn("fn-nested-escaped-quote", "malformed", ["bash -c \"curl -u \\\"svc_reader:", { unread: v }, `\\\" ${HOST}\"\n`],
    "A quote escaped inside a quoted command string needs a second shell-decoding pass; not performed.");
}

export { cases };
export default cases;
