import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #379 (category `beta8-379`): Beta.11 independent positive, benign and twin evidence for the
// fifteen credential families selected by #377's frozen family/axis ledger
// (docs/reports/2026-09-28/beta-11-family-axis-ledger.json). See docs/specs/beta8-evidence.md.
//
// Every case below is authored against the frozen contract in benchmarks/lib/assessment.ts, never
// against a scanner's current behaviour, and every expectation was written before any scan of this
// corpus. Each credential-shaped value comes from a new public `synthetic` seed
// (`beta11:379:<family>:<slug>`), so neither the value nor its skeleton repeats an existing fixture;
// nothing is provider-issued, copied from a provider example or taken from a peer rule's test vector.
// Twins keep their positive's bytes except for exactly one property of the contract. Positives
// author `expectedAction: "redact"` (the ledger's stated action): a `warn` is detection, not
// sanitisation (#376, #380).
//
// Ledger revisions are recorded in REVISIONS below with their reason and are published with the
// #379 report; nothing in this file changes a contract, a tier, an envelope policy, a support
// status or a profile floor.

const HEX = "0123456789abcdef";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const B64URL = `${ALNUM}-_`;
const B64 = `${ALNUM}+/`;
const DIGITS = "0123456789";
const URI_ENVELOPE = "Whole URI may be redacted; only the credential must be.";

/** Ledger revisions: every departure from the frozen ledger, with the reason, keyed by family. */
export const REVISIONS = [
  { family: "new-relic-license-key", item: "benign public-identifier: NRAK- user API key as a sibling attribution control", action: "dropped", reason: "NRAK- is the contracted must-redact family new-relic-user-api-key (T1). A non-twin control is scored unscoped (benchmarks/scoring/lattice.ts scoreRow: any finding flags it), so it would assert silence on another family's secret; family-scoped scoring exists only for twins." },
  { family: "new-relic-license-key", item: "benign near-miss: 40-character hex value beside newrelic", action: "dropped", reason: "The contract review records a still-issued legacy all-hex 40-character license key outside the pattern and New Relic's own page still calls the key a 40-character hex string; silence on a 40-hex value beside newrelic is provider-undecided and cannot be a negative expectation (decision-stop-asserting-provider-undecided-format-properties)." },
  { family: "new-relic-license-key", item: "benign encoded-value: base64 of a license key in a Secret data: field", action: "dropped", reason: "The contract states no policy for an encoded license key, so a silence expectation on the Base64 of a live-shaped key would be asserted, not evidenced." },
  { family: "mailchimp-api-key", item: "benign public-identifier: Mailchimp Transactional (Mandrill) key", action: "dropped", reason: "No provider-owned source for the Mandrill key shape was established in this pass (the ledger's own drop condition), and as a live secret in an unscoped control it would assert global silence on a credential." },
  { family: "deepgram-api-key", item: "benign near-miss: 40-hex commit id beside deepgram; benign encoded-value: sha1 beside a deepgram model name", action: "dropped", reason: "The contract admits any 40-hex value beside a same-line deepgram name, so silence there would be asserted, not evidenced — the exclusion #384e already recorded for this family (fixtures/generated/beta8/384e.mjs header)." },
  { family: "deepgram-api-key", item: "twin context:keyword (ASSEMBLYAI_API_KEY in the HTTPie template)", action: "moved", reason: "The HTTPie positive's gate is the api.deepgram.com host, not a keyword, so a keyword swap there mutates nothing; the same one-property keyword swap is authored on the docker run -e positive, whose only gate is DEEPGRAM_API_KEY." },
  { family: "confluent-cloud-api-secret-legacy", item: "benign near-miss: 64-character image digest on a confluentinc/ line", action: "dropped", reason: "The contract admits any 64-character [A-Za-z0-9+/] value beside a same-line confluent keyword, and confluentinc contains it; silence there would be asserted, not evidenced." },
  { family: "confluent-cloud-api-secret-legacy", item: "twin context:pairing (key-id half removed)", action: "dropped", reason: "The contract's gate is the confluent keyword, not the key-id pairing; removing the key id leaves the value gated, so the twin would mutate no contract property." },
  { family: "twilio-auth-token", item: "benign encoded-value: MD5 beside a twilio dependency name", action: "dropped", reason: "The contract admits a 32-hex value beside the word twilio, so silence there would be asserted, not evidenced." },
  { family: "twilio-auth-token", item: "twins context:pairing and context:host on the userinfo URL", action: "dropped", reason: "The contract names two alternative gates (a same-line Account SID or the word twilio); the userinfo URL carries both, so removing either one leaves the other and neither mutation removes the gate." },
  { family: "cohere-api-key", item: "benign near-miss: 40-alphanumeric integrity-like token on a cohere package line", action: "dropped", reason: "The contract admits any 40-alphanumeric value after a same-line cohere name; the #384e exclusion for this family applies." },
  { family: "cohere-api-key", item: "twin context:host (Java builder pointed at another host)", action: "dropped", reason: "The Java positive's gate is the Cohere builder itself; changing a host would leave the value gated, and adding a host to the positive would give it two gates." },
  { family: "anthropic-api01-key", item: "twin boundary (identifier character after the Go const value)", action: "dropped", reason: "The body is open-length [A-Za-z0-9_-]{20,}; a trailing identifier character extends a still-valid key, so the twin is not lexically separable (docs/decisions/2026-09-21-check-lexical-separability.md)." },
  { family: "aws-bedrock-long-term-api-key", item: "benign near-miss: ABSK with a head that decodes to another label; twin head (one head character changed)", action: "dropped", reason: "The contract review states that an ABSK-only key with another head is a T2 shape it does not assert either way and that no fixture asserts silence on a head-less ABSK value." },
  { family: "aws-bedrock-long-term-api-key", item: "twins padding (three '=') and boundary (trailing identifier character)", action: "dropped", reason: "The body is open-length standard Base64 with optional padding; both mutated values still contain an isolated contract-valid key (the '=' ends the match), so neither twin is lexically separable." },
  { family: "openai-admin-api-key", item: "benign public-identifier: sk-proj- project key as a sibling attribution control", action: "dropped", reason: "sk-proj- is the contracted must-redact family openai-token; an unscoped control would assert silence on another family's secret." },
  { family: "connection-string", item: "twins context:scheme, context:field (commented example) and context:key (DOCS_EXAMPLE_URL)", action: "dropped", reason: "The contract is 'password in userinfo of a URI' and its twin source (RFC 3986) names only the ':' and '@' delimiters; a scheme swap, a comment marker or a variable rename leaves userinfo intact and mutates no contract property." },
  { family: "stripe-token", item: "benign public-identifier: whsec_ signing secret as a sibling attribution control", action: "dropped", reason: "whsec_ is the contracted T1 must-redact family stripe-webhook-signing-secret (#372); an unscoped control would assert silence on it." },
  { family: "stripe-token", item: "twin mode (sk_prod_)", action: "dropped", reason: "The pinned gitleaks 8.30.1 stripe rule admits a prod mode and Stripe's key page does not state that no other mode is issued, so the property is disputed and no provider decides it." },
  { family: "stripe-token", item: "benign placeholder sk_test_ + 32 X", action: "revised", reason: "32 X characters satisfy the frozen T1 pattern and fail lexical separability; the documentation placeholder is authored with 24 x characters." },
  { family: "stripe-token", item: "benign public-identifier pk_live_ tier", action: "noted", reason: "The ledger calls it a T1 control; the reviewed Beta.8 control rules score every non-twin public-identifier control at T2 (T1 controls require a twin with a provider source), so it lands at T2 without any contract change." },
  { family: "github-token", item: "benign public-identifier: github_pat_ as a sibling attribution control", action: "dropped", reason: "github_pat_ is the contracted must-redact family github-fine-grained-pat (#371); an unscoped control would assert silence on it." },
  { family: "anthropic-admin01-key", item: "twin boundary (identifier character after the AA tail)", action: "dropped", reason: "Dropped after the first scan, on contract text alone: the contract review states that no length, alphabet or tail twin is authored on the tool-only 93 + AA field and that the product keeps a >= 20 byte superset, so a trailing identifier character asserts an undecided length property. Dropped together with the stripe and github trailing twins, whatever each scored." },
  { family: "stripe-token", item: "twin boundary (identifier character after the 32-character body)", action: "dropped", reason: "Dropped after the first scan, on rule text alone: the pinned trufflehog 3.97.4 stripe rule matches [rs]k_live_[a-zA-Z0-9]{20,247} and gitleaks 8.30.1 (sk|rk)_(test|live|prod)_[a-zA-Z0-9]{10,99}, and the contract review calls the body length un-probeable, so a 33-character body is disputed, not tool-undisputed as the ledger recorded." },
  { family: "github-token", item: "twin boundary (identifier character after the 36-character body)", action: "dropped", reason: "Dropped after the first scan, on rule text alone: the pinned trufflehog 3.97.4 github rule matches (ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{36,255}, so a 37-character body is disputed by a pinned peer, not tool-undisputed as the ledger recorded. This twin scored clean; it is dropped for the same reason as the two that did not." },
  { family: "github-token", item: "benign placeholder ghp_ + 36 x", action: "revised", reason: "36 x characters satisfy the frozen T1 pattern and fail lexical separability; the placeholder is authored with 20 x characters." },
];

/** Per-case rationale, keyed by fixture id: contract, role, ledger axis/context, basis, provenance. */
export const RATIONALE = new Map();

export function build379({ fixture, synthetic }) {
  const c = beta8Corpus("379", { fixture, synthetic });
  RATIONALE.clear();
  const seed = (target, slug) => `beta11:379:${target}:${slug}`;
  const provenance = (target, slug) => `Authored for #379 from the #377 ledger against the frozen ${target} contract; value from public seed ${seed(target, slug)}, never provider-issued.`;
  const note = (id, target, role, axis, rationale, extra = {}) =>
    RATIONALE.set(id, { contract: target, role, axis, rationale, provenance: extra.provenance ?? `Authored for #379 from the #377 ledger against the frozen ${target} contract; no credential value.`, ...extra });
  const positives = new Map();

  /** A positive whose value is authored against the contract; `parts` holds one `{ secret }`. */
  const P = (target, axis, slug, ext, pre, value, post, rationale, envelope) => {
    const pattern = contracts[target].pattern ? new RegExp(contracts[target].pattern) : null;
    if (pattern && !pattern.test(value)) throw new Error(`beta8-379: ${target}-${slug} value fails its own frozen contract`);
    const secret = envelope ? { secret: value, envelope: { before: envelope.before, after: envelope.after, reason: URI_ENVELOPE } } : { secret: value };
    const f = c.positive(target, axis, slug, [...[].concat(pre), secret, ...[].concat(post)], ext);
    f.expectedAction = "redact";
    positives.set(`${target}-${slug}`, { pre, value, post, envelope, ext });
    note(f.id, target, "positive", axis, rationale, { provenance: provenance(target, slug), expectedAction: "redact" });
    return f;
  };
  /** A non-twin benign control on one CONTROL_SUFFIXES axis. */
  const C = (target, axis, slug, ext, text, rationale) => {
    const f = c.control(target, axis, slug, [text], ext);
    note(f.id, target, "benign", axis, rationale);
    return f;
  };
  /** A twin of an authored positive: `mutate` returns the positive's text with exactly one property changed. */
  const T = (target, positiveSlug, slug, kind, basis, mutation, mutate) => {
    const p = positives.get(`${target}-${positiveSlug}`);
    if (!p) throw new Error(`beta8-379: twin ${slug} has no positive ${positiveSlug}`);
    const flat = parts => [].concat(parts).map(x => (typeof x === "string" ? x : x.companion)).join("");
    const whole = { pre: flat(p.pre) + (p.envelope?.before ?? ""), value: p.value, post: (p.envelope?.after ?? "") + flat(p.post) };
    const text = mutate(whole);
    if (text === whole.pre + whole.value + whole.post) throw new Error(`beta8-379: twin ${slug} mutates nothing`);
    const f = c.twin(target, positiveSlug, slug, [text], `${mutation} (basis: ${basis})`, kind, p.ext);
    note(f.id, target, "twin", kind, mutation, { basis, twinOf: f.twinOf });
    return f;
  };
  const whole = w => w.pre + w.value + w.post;
  const hex = (t, s, n) => synthetic(seed(t, s), n, HEX);
  const uuid = (t, s) => { const h = hex(t, s, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  const sid = (t, s) => `AC${hex(t, s, 32)}`;

  // ------------------------------------------------------------ new-relic-license-key (T1)
  {
    const T_ = "new-relic-license-key";
    const us = s => `${hex(T_, s, 32)}FFFFNRAL`;
    const eu = s => `eu01xx${hex(T_, s, 26)}FFFFNRAL`;
    P(T_, "container-config", "k8s-secret-stringdata", "yml",
      "apiVersion: v1\nkind: Secret\nmetadata:\n  name: newrelic-agent\n  namespace: observability\ntype: Opaque\nstringData:\n  NEW_RELIC_LICENSE_KEY: ", us("k8s-secret-stringdata"), "\n",
      "Kubernetes Secret stringData literal; a new container-config skeleton beside the existing Helm values file.");
    P(T_, "sdk-config", "python-newrelic-ini", "ini",
      "[newrelic]\nlicense_key = ", us("python-newrelic-ini"), "\napp_name = checkout-service\nmonitor_mode = true\n",
      "Python agent newrelic.ini; the existing sdk-config positive is the Node newrelic.js.");
    P(T_, "header", "otel-collector-api-key", "yml",
      "exporters:\n  otlphttp/newrelic:\n    endpoint: https://otlp.nr-data.net\n    headers:\n      api-key: ", us("otel-collector-api-key"), "\n",
      "OTLP exporter api-key header inside an OpenTelemetry Collector config; the existing header positive is the Log API curl.");
    P(T_, "structured-file", "terraform-tfvars-eu", "tfvars",
      "newrelic_accounts = {\n  eu_prod = {\n    account_id  = 4400123\n    region      = \"EU\"\n    license_key = \"", eu("terraform-tfvars-eu"), "\"\n  }\n}\n",
      "Terraform tfvars map with the EU-region eu01xx form, which no existing positive exercises.");
    P(T_, "tool-output", "agent-startup-json", "log",
      "{\"level\":\"debug\",\"component\":\"newrelic-agent\",\"msg\":\"effective configuration\",\"config\":{\"app_name\":\"billing\",\"license_key\":\"", us("agent-startup-json"), "\",\"host\":\"collector.newrelic.com\"}}\n",
      "Agent startup JSON diagnostic echoing the configured key.");
    P(T_, "ci-config", "actions-step-env", "yml",
      "jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Record deployment\n        env:\n          NEW_RELIC_LICENSE_KEY: ", us("actions-step-env"), "\n        run: ./scripts/record-deploy.sh\n",
      "GitHub Actions step env literal; no ci-config positive existed.");
    C(T_, "public-id", "dashboard-permalink", "md",
      `Dashboard: https://one.newrelic.com/dashboards/detail/${Buffer.from(`4400123|VIZ|DASHBOARD|${synthetic(seed(T_, "guid"), 8, DIGITS)}`).toString("base64").replace(/=+$/, "")}?account=4400123\n`,
      "Entity GUID (Base64 of account|domain|type|id) and account id in a dashboard permalink: public identifiers.");
    C(T_, "placeholder", "erb-template", "yml",
      "common: &default_settings\n  license_key: '<%= license_key %>'\n  app_name: storefront\n",
      "newrelic.yml ERB template with no value.");
    C(T_, "reference", "helm-values-indirection", "yml",
      "newrelic-infrastructure:\n  licenseKey: {{ .Values.global.licenseKey }}\n",
      "Helm values indirection; no literal.");
    T(T_, "actions-step-env", "suffix-nrai", "prefix", "provider",
      "literal marker: FFFFNRAL -> FFFFNRAI on an otherwise valid 40-character value (the NRAL suffix is provider-documented)",
      w => w.pre + w.value.replace(/FFFFNRAL$/, "FFFFNRAI") + w.post);
    T(T_, "otel-collector-api-key", "length-41", "length", "provider",
      "total length 41: one extra hex body character before FFFFNRAL (the provider fixes 40)",
      w => w.pre + w.value.replace(/FFFFNRAL$/, `${hex(T_, "extra", 1)}FFFFNRAL`) + w.post);
    T(T_, "terraform-tfvars-eu", "length-39-eu", "length", "provider",
      "total length 39: EU form eu01xx + 25 hex + FFFFNRAL (the provider fixes 40)",
      w => w.pre + w.value.replace(/.FFFFNRAL$/, "FFFFNRAL") + w.post);
    T(T_, "k8s-secret-stringdata", "trailing-identifier", "boundary", "provider",
      "boundary: the value is continued by one identifier character after NRAL",
      w => `${w.pre}${w.value}Z${w.post}`);
  }

  // ------------------------------------------------------------ mailchimp-api-key (T2)
  {
    const T_ = "mailchimp-api-key";
    const key = (s, dc) => `${hex(T_, s, 32)}-${dc}`;
    P(T_, "basic-auth", "python-requests-auth", "py",
      "import requests\n\nresp = requests.get(\n    \"https://us14.api.mailchimp.com/3.0/lists\",\n    auth=(\"anystring\", \"", key("python-requests-auth", "us14"), "\"),\n    timeout=10,\n)\n",
      "Python requests Basic-auth tuple: a second, independent Basic-auth template beside curl -u.");
    P(T_, "url", "userinfo-url", "txt",
      "", key("userinfo-url", "us21"), "\n",
      "https://anystring:<key>@us21.api.mailchimp.com userinfo URL; the whole URL is the authored envelope.",
      { before: "https://anystring:", after: "@us21.api.mailchimp.com/3.0/" });
    P(T_, "prose", "ticket-paragraph", "md",
      "The nightly export broke after the account move. The key in the runbook is ", key("ticket-paragraph", "us6"), ". Can someone confirm it was revoked?\n",
      "Support-ticket prose quoting the key mid-sentence with trailing punctuation.");
    P(T_, "sdk-config", "node-setconfig", "js",
      "import mailchimp from \"@mailchimp/mailchimp_marketing\";\n\nmailchimp.setConfig({\n  apiKey: \"", key("node-setconfig", "us6"), "\",\n  server: \"us6\",\n});\n",
      "Node @mailchimp/mailchimp_marketing setConfig with server matching the key's data-center suffix.");
    P(T_, "tool-output", "debug-request-headers", "txt",
      "> GET /3.0/campaigns HTTP/1.1\n> Host: us19.api.mailchimp.com\n> Authorization: apikey ", key("debug-request-headers", "us19"), "\n> User-Agent: mc-sync/2.4\n",
      "Script debug dump of request headers (Authorization: apikey <key>).");
    C(T_, "public-id", "list-and-web-id", "json",
      `{"id": "${hex(T_, "list-id", 10)}", "web_id": ${synthetic(seed(T_, "web-id"), 6, DIGITS)}, "name": "Newsletter", "stats": {"member_count": 1204}}\n`,
      "Audience (list) id and campaign web_id in an API response: public identifiers.");
    C(T_, "encoded-value", "subscriber-hash-path", "txt",
      `PATCH /3.0/lists/${hex(T_, "list-id", 10)}/members/${createHash("md5").update("reader@example.test").digest("hex")}\n`,
      "subscriber_hash (MD5 of a lowercased synthetic email) in a members path.");
    C(T_, "near-miss", "s3-region-key", "txt",
      `s3://exports-archive/${hex(T_, "s3-digest", 32)}-us-east-1/manifest.json\n`,
      "32-hex digest followed by -us-east-1 (an AWS region after an unrelated hash): no -us<digits> suffix.");
    C(T_, "placeholder", "usx-template", "env",
      "# .env.example (copy to .env and fill in)\nMAILCHIMP_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-usX\n",
      "Documentation template with x body and usX suffix.");
    C(T_, "prose", "datacenter-move", "md",
      "We moved the account from us6 to us19 last week; update the server setting in each client after the move.\n",
      "Changelog prose about a data-center move, no key.");
    T(T_, "python-requests-auth", "underscore-suffix", "prefix", "provider",
      "literal marker: the -us14 data-center suffix separator becomes _us14 (the -<dc> suffix is provider-stated)",
      w => w.pre + w.value.replace(/-us14$/, "_us14") + w.post);
    T(T_, "python-requests-auth", "suffix-removed", "prefix", "provider",
      "literal marker: the -us14 data-center suffix is removed, leaving the 32-hex body",
      w => w.pre + w.value.replace(/-us14$/, "") + w.post);
  }

  // ------------------------------------------------------------ deepgram-api-key (T2, context-gated)
  {
    const T_ = "deepgram-api-key";
    const v = s => hex(T_, s, 40);
    P(T_, "header", "httpie-token", "sh",
      "http --verbose POST https://api.deepgram.com/v1/listen model==nova-3 'Authorization:Token ", v("httpie-token"), "' < call.wav\n",
      "HTTPie verbose request to api.deepgram.com with the provider-documented Token scheme.");
    P(T_, "source-code", "go-client-literal", "go",
      "package transcribe\n\nimport deepgram \"github.com/deepgram/deepgram-go-sdk/v3/pkg/client/listen\"\n\nvar client = deepgram.NewRESTWithDefaults(context.Background(), \"", v("go-client-literal"), "\")\n",
      "Go client construction with the key as a literal beside the deepgram import.");
    P(T_, "log", "worker-json-log", "log",
      "{\"ts\":\"2026-09-28T08:14:02Z\",\"worker\":\"transcribe-7\",\"provider\":\"deepgram\",\"auth\":\"", v("worker-json-log"), "\",\"status\":401}\n",
      "Structured JSON log from a transcription worker with provider=deepgram and the key in an auth field.");
    P(T_, "container-config", "docker-run-env", "sh",
      "docker run --rm -e DEEPGRAM_API_KEY=", v("docker-run-env"), " ghcr.io/example/stt-worker:1.8\n",
      "docker run -e DEEPGRAM_API_KEY command line.");
    P(T_, "ci-config", "gitlab-ci-variables", "yml",
      "variables:\n  DEEPGRAM_API_KEY: \"", v("gitlab-ci-variables"), "\"\n  STT_MODEL: nova-3\n",
      "GitLab CI variables block literal.");
    P(T_, "structured-file", "agent-stt-yaml", "yml",
      "stt:\n  provider: deepgram\n  api_key: ", v("agent-stt-yaml"), "\n  model: nova-3\n",
      "Agent-framework YAML with stt provider deepgram and api_key (block gate, as the #384e LiteLLM positive).");
    C(T_, "public-id", "usage-response", "json",
      `{"request_id": "${uuid(T_, "request")}", "project_id": "${uuid(T_, "project")}", "audio_sha1": "${hex(T_, "audio-sha", 40)}", "duration": 42.7}\n`,
      "Usage response with request_id, project_id and a 40-hex audio digest, with no deepgram name or host in the file.");
    C(T_, "placeholder", "actions-secret-expression", "yml",
      "      - run: ./transcribe.sh\n        env:\n          DEEPGRAM_API_KEY: ${{ secrets.DEEPGRAM_API_KEY }}\n",
      "Workflow secrets expression (a different skeleton from the existing actions-secret control).");
    C(T_, "prose", "key-scopes-readme", "md",
      "Deepgram keys carry member, admin or owner scopes; create a member-scoped key for the transcription worker and keep it in the secrets manager.\n",
      "README prose on key scopes without any value.");
    C(T_, "reference", "secret-key-ref", "yml",
      "env:\n  - name: DEEPGRAM_API_KEY\n    valueFrom:\n      secretKeyRef:\n        name: deepgram\n        key: api-key\n",
      "Kubernetes secretKeyRef; no literal.");
    T(T_, "docker-run-env", "assemblyai-keyword", "context", "context",
      "context:keyword: DEEPGRAM_API_KEY renamed ASSEMBLYAI_API_KEY; the value is kept byte-for-byte",
      w => whole(w).replace("DEEPGRAM_API_KEY", "ASSEMBLYAI_API_KEY"));
    T(T_, "httpie-token", "other-host", "context", "context",
      "context:host: api.deepgram.com replaced by api.example-speech.test; the value is kept byte-for-byte",
      w => whole(w).replace("api.deepgram.com", "api.example-speech.test"));
    T(T_, "httpie-token", "bearer-scheme", "context", "context",
      "context:scheme: Authorization Token replaced by Bearer, the scheme the provider documents for temporary JWTs, not API keys; the value is kept byte-for-byte",
      w => whole(w).replace("Authorization:Token ", "Authorization:Bearer "));
    T(T_, "agent-stt-yaml", "model-revision-field", "context", "context",
      "context:field: the api_key field renamed model_revision; the value is kept byte-for-byte",
      w => whole(w).replace("  api_key: ", "  model_revision: "));
    T(T_, "go-client-literal", "length-39", "length", "tool-undisputed",
      "length: 39 hex characters vs the 40 both pinned tools agree on, beside the same gate",
      w => w.pre + w.value.slice(0, -1) + w.post);
  }

  // ------------------------------------------------------------ heroku-api-key-legacy (T2, context-gated)
  {
    const T_ = "heroku-api-key-legacy";
    P(T_, "tool-output", "authorizations-info", "txt",
      "$ heroku authorizations:info $AUTH_ID\nClient:      <none>\nDescription: ci deploy\nScope:       global\nToken:       ", uuid(T_, "authorizations-info"), "\nUpdated at:  2026-09-02T10:14:31Z\n",
      "heroku authorizations:info table output with the token row.");
    P(T_, "log", "ci-debug-echo", "log",
      "2026-09-28T11:02:45.118Z [debug] + echo HEROKU_API_KEY=", uuid(T_, "ci-debug-echo"), "\n",
      "CI deploy log echoing HEROKU_API_KEY during a debug step (a new skeleton beside deploy-log).");
    P(T_, "structured-file", "deploy-config-json", "json",
      "{\n  \"heroku\": { \"app\": \"example-app\", \"api_key\": \"", uuid(T_, "deploy-config-json"), "\" },\n  \"region\": \"us\"\n}\n",
      "JSON deploy config with an api_key field beside heroku.");
    P(T_, "sdk-config", "platform-api-ruby", "rb",
      "require \"platform-api\"\n\nheroku = PlatformAPI.connect_oauth(\"", uuid(T_, "platform-api-ruby"), "\")\n",
      "Ruby platform-api connect_oauth with a literal.");
    P(T_, "url", "git-config-remote", "txt",
      "[remote \"production\"]\n\turl = ", uuid(T_, "git-config-remote"), "\n\tfetch = +refs/heads/*:refs/remotes/production/*\n",
      "git config [remote] section URL with the key as userinfo password (distinct from git remote add); the whole URL is the envelope.",
      { before: "https://:", after: "@git.heroku.com/example-app.git" });
    C(T_, "public-id", "apps-info-json", "json",
      `$ heroku apps:info --json\n{"app": {"id": "${uuid(T_, "app-id")}", "name": "example-app", "stack": {"id": "${uuid(T_, "stack-id")}", "name": "heroku-24"}}}\n`,
      "apps:info --json with the app and stack UUIDs (identifier-keyed public ids), no key.");
    C(T_, "public-id", "router-request-id", "log",
      `2026-09-28T09:15:02.418Z heroku[router]: at=info method=GET path="/" host=example-app.herokuapp.com request_id=${uuid(T_, "request-id")} status=200 bytes=1532\n`,
      "Router log request_id UUID (identifier-keyed).");
    C(T_, "public-id", "oauth-client-masked", "txt",
      `$ heroku clients:info $CLIENT_ID\nName:   release-bot\nID:     ${uuid(T_, "client-id")}\nSecret: ************************************\n`,
      "OAuth client id with the secret column masked.");
    C(T_, "near-miss", "releases-path", "txt",
      `curl -n https://api.heroku.com/apps/${uuid(T_, "path-app")}/releases -H "Accept: application/vnd.heroku+json; version=3"\n`,
      "App UUID that appears only as a URL path segment.");
    C(T_, "placeholder", "zero-uuid", "env",
      "# release pipeline settings\nHEROKU_API_KEY=00000000-0000-0000-0000-000000000000\n",
      "Documentation all-zero UUID.");
    C(T_, "reference", "makefile-auth-token", "mk",
      "deploy:\n\tHEROKU_API_KEY=$$(heroku auth:token) ./scripts/release.sh\n",
      "heroku auth:token command substitution in a Makefile.");
    C(T_, "prose", "hrku-migration-note", "md",
      "Legacy UUID keys keep working until regenerated; new authorizations are issued with the HRKU- prefix, so rotate old keys during the next release window.\n",
      "Migration note on legacy keys vs HRKU- tokens, no value.");
    T(T_, "ci-debug-echo", "sentry-keyword", "context", "context",
      "context:keyword: HEROKU_API_KEY renamed SENTRY_RELEASE_ID; the value is kept byte-for-byte",
      w => whole(w).replace("HEROKU_API_KEY", "SENTRY_RELEASE_ID"));
    T(T_, "git-config-remote", "other-git-host", "context", "context",
      "context:host: git.heroku.com replaced by git.example.test; the value is kept byte-for-byte",
      w => whole(w).replace("git.heroku.com", "git.example.test"));
    T(T_, "authorizations-info", "client-id-row", "context", "context",
      "context:field: the Token row relabelled Client ID; the value is kept byte-for-byte",
      w => whole(w).replace("Token:       ", "Client ID:   "));
    T(T_, "platform-api-ruby", "short-last-group", "length", "tool-undisputed",
      "length: the UUID's last group has 11 hex digits instead of 12 (both pinned tools match the exact 8-4-4-4-12 shape)",
      w => w.pre + w.value.slice(0, -1) + w.post);
  }

  // ------------------------------------------------------------ confluent-cloud-api-secret-legacy (T2, context-gated)
  {
    const T_ = "confluent-cloud-api-secret-legacy";
    const v = s => synthetic(seed(T_, s), 64, B64);
    const keyId = s => synthetic(seed(T_, `${s}:key-id`), 16, UPPER_ALNUM);
    const idNote = "Confluent API key id: documented as not secret; may be redacted with the secret at no collateral cost.";
    P(T_, "sdk-config", "java-client-properties", "properties",
      ["bootstrap.servers=pkc-7xq2m.us-west2.gcp.confluent.cloud:9092\nsecurity.protocol=SASL_SSL\nsasl.mechanism=PLAIN\nsasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username='", { companion: keyId("java-client-properties"), note: idNote }, "' password='"],
      v("java-client-properties"), "';\n",
      "Java client.properties sasl.jaas.config with a confluent.cloud bootstrap; the key id is a companion span.");
    P(T_, "basic-auth", "schema-registry-user-info", "properties",
      ["schema.registry.url=https://psrc-3n9vd.us-east-2.aws.confluent.cloud\nbasic.auth.credentials.source=USER_INFO\nbasic.auth.user.info=", { companion: keyId("schema-registry-user-info"), note: idNote }, ":"],
      v("schema-registry-user-info"), "\n",
      "Schema Registry basic.auth.user.info=<key-id>:<secret>.");
    P(T_, "log", "connect-worker-config", "log",
      "[2026-09-28 07:12:44,118] INFO ProducerConfig values:\n\tbootstrap.servers = [pkc-9wq3x.us-east-1.aws.confluent.cloud:9092]\n\tsasl.jaas.config = org.apache.kafka.common.security.plain.PlainLoginModule required username=\"" + keyId("connect-worker-config") + "\" password=\"", v("connect-worker-config"), "\";\n",
      "Kafka Connect worker log printing the resolved producer config.");
    P(T_, "container-config", "compose-jaas", "yml",
      `services:\n  connect:\n    image: confluentinc/cp-kafka-connect:7.7.1\n    environment:\n      CONNECT_BOOTSTRAP_SERVERS: pkc-5v1ry.eu-west-1.aws.confluent.cloud:9092\n      CONNECT_SASL_JAAS_CONFIG: org.apache.kafka.common.security.plain.PlainLoginModule required username="${keyId("compose-jaas")}" password="`, v("compose-jaas"), "\";\n",
      "docker-compose CONNECT_SASL_JAAS_CONFIG literal.");
    P(T_, "cli", "client-config-create", "sh",
      `$ confluent kafka client-config create java --api-key ${keyId("client-config-create")} --api-secret `, v("client-config-create"), "\n",
      "confluent kafka client-config create invocation carrying the secret.");
    C(T_, "public-id", "api-key-list", "txt",
      `$ confluent api-key list --resource lkc-8m2vq\n  Current |       Key        | Description | Owner      | Resource ID\n----------+------------------+-------------+------------+------------\n          | ${keyId("list-key")} | connect     | sa-4k21jd  | lkc-8m2vq\n`,
      "confluent api-key list table: key id only, no secret column.");
    C(T_, "public-id", "terraform-state-ids", "json",
      "{\n  \"type\": \"confluent_kafka_cluster\",\n  \"instances\": [{ \"attributes\": { \"id\": \"lkc-8m2vq\", \"environment\": [{ \"id\": \"env-p1x6o3\" }], \"display_name\": \"orders\" } }]\n}\n",
      "Terraform state excerpt with cluster id lkc-… and environment id env-….");
    C(T_, "placeholder", "jaas-template", "properties",
      "sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username='{{ CLUSTER_API_KEY }}' password='{{ CLUSTER_API_SECRET }}';\n",
      "sasl.jaas.config template placeholders.");
    C(T_, "reference", "config-provider", "properties",
      "config.providers=file\nconfig.providers.file.class=org.apache.kafka.common.config.provider.FileConfigProvider\nsasl.jaas.config=${file:/secrets/confluent.properties:sasl.jaas.config}\n",
      "Kafka Connect FileConfigProvider reference.");
    C(T_, "prose", "rotation-runbook", "md",
      "Rotate a Confluent Cloud key pair by creating the new key, rolling clients, then deleting the old key; never reuse a secret across environments.\n",
      "Rotation runbook prose, no value.");
    T(T_, "java-client-properties", "self-hosted-bootstrap", "context", "context",
      "context:keyword: the confluent.cloud bootstrap host replaced by broker.internal.example.test, so no confluent keyword remains; the value is kept byte-for-byte",
      w => whole(w).replace("pkc-7xq2m.us-west2.gcp.confluent.cloud", "broker.internal.example.test"));
    T(T_, "connect-worker-config", "self-hosted-log", "context", "context",
      "context:host: the *.confluent.cloud broker in the logged config replaced by a self-hosted kafka-1.internal.example.test; the value is kept byte-for-byte",
      w => whole(w).replace("pkc-9wq3x.us-east-1.aws.confluent.cloud", "kafka-1.internal.example.test"));
    T(T_, "compose-jaas", "length-63", "length", "tool-undisputed",
      "length: 63 characters vs the 64 both pinned tools match exactly",
      w => w.pre + w.value.slice(0, -1) + w.post);
  }

  // ------------------------------------------------------------ twilio-auth-token (T2, context-gated)
  {
    const T_ = "twilio-auth-token";
    const v = s => hex(T_, s, 32);
    const sidNote = "Twilio Account SID: a public identifier paired with the token; may be redacted with it at no collateral cost.";
    P(T_, "log", "validator-debug", "log",
      "2026-09-28T09:02:11Z DEBUG twilio auth_token=", v("validator-debug"), " path=/sms/inbound\n",
      "Webhook signature-validation debug log naming twilio with the token.");
    P(T_, "prose", "incident-chat", "md",
      ["@oncall pasting the prod creds so you can reproduce: SID ", { companion: sid(T_, "incident-chat"), note: sidNote }, " and token "], v("incident-chat"), " (rotate after).\n",
      "Incident chat message with SID and token in one sentence.");
    P(T_, "source-code", "csharp-init", "cs",
      ["using Twilio;\n\nTwilioClient.Init(\"", { companion: sid(T_, "csharp-init"), note: sidNote }, "\", \""], v("csharp-init"), "\");\n",
      "C# TwilioClient.Init(accountSid, authToken) literals.");
    P(T_, "structured-file", "serverless-yml", "yml",
      `provider:\n  name: aws\n  environment:\n    TWILIO_ACCOUNT_SID: ${sid(T_, "serverless-yml")}\n    TWILIO_AUTH_TOKEN: `, v("serverless-yml"), "\n",
      "serverless.yml environment block with TWILIO_AUTH_TOKEN.");
    P(T_, "url", "userinfo-url", "txt",
      "", v("userinfo-url"), "\n",
      "https://AC…:<token>@api.twilio.com userinfo URL; the whole URL is the envelope.",
      { before: `https://${sid(T_, "userinfo-url")}:`, after: "@api.twilio.com/2010-04-01/Accounts.json" });
    P(T_, "tool-output", "profiles-auth-token", "txt",
      "$ twilio profiles:list --properties authToken\nID     Auth Token\nprod   ", v("profiles-auth-token"), "\n",
      "twilio profiles:list style CLI table with an Auth Token column.");
    C(T_, "public-id", "message-resource", "json",
      `{"sid": "SM${hex(T_, "message-sid", 32)}", "account_sid": "${sid(T_, "message-account")}", "from": "+15555550123", "to": "+15555550188", "status": "delivered"}\n`,
      "Message resource JSON with SIDs and phone numbers, no token.");
    C(T_, "public-id", "api-key-sid-masked", "txt",
      `$ twilio api:core:keys:list\nSID                                 Friendly Name  Secret\nSK${hex(T_, "key-sid", 32)}  ci-sender      ********\n`,
      "API key SID (SK…) with its secret masked.");
    C(T_, "near-miss", "signature-header", "txt",
      `POST /sms/inbound HTTP/1.1\nX-Twilio-Signature: ${synthetic(seed(T_, "signature"), 27, B64)}=\nContent-Type: application/x-www-form-urlencoded\n`,
      "X-Twilio-Signature header: a Base64 HMAC, not a 32-hex token.");
    C(T_, "placeholder", "quickstart-token", "env",
      "# Quickstart: paste the token from the Console before running send_sms.py\nexport TWILIO_AUTH_TOKEN=your_auth_token\n",
      "Quickstart placeholder (a new skeleton; the bare assignment already exists in beta8-207).");
    C(T_, "reference", "functions-context", "js",
      "exports.handler = (context, event, callback) => {\n  const client = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);\n  callback(null, 'ok');\n};\n",
      "Twilio Functions context.AUTH_TOKEN reference.");
    T(T_, "validator-debug", "etag-keyword", "context", "context",
      "context:keyword: the 'twilio auth_token=' gate replaced by 'cache etag='; the value is kept byte-for-byte",
      w => whole(w).replace("twilio auth_token=", "cache etag="));
    T(T_, "profiles-auth-token", "account-sid-column", "context", "context",
      "context:field: the Auth Token column relabelled Account SID; the value is kept byte-for-byte",
      w => whole(w).replace("ID     Auth Token", "ID     Account SID"));
  }

  // ------------------------------------------------------------ anthropic-admin01-key (T1 prefix)
  {
    const T_ = "anthropic-admin01-key";
    const v = s => `sk-ant-admin01-${synthetic(seed(T_, s), 93, B64URL)}AA`;
    P(T_, "header", "httpie-admin-api", "sh",
      "http GET https://api.anthropic.com/v1/organizations/users x-api-key:", v("httpie-admin-api"), " anthropic-version:2023-06-01\n",
      "x-api-key header in an HTTPie call to the Admin API.");
    P(T_, "structured-file", "org-admin-provider-block", "tf",
      "provider \"anthropic_admin\" {\n  admin_key    = \"", v("org-admin-provider-block"), "\"\n  organization = \"org-automation\"\n}\n",
      "Terraform-style provider block for an org-admin automation.");
    P(T_, "shell-export", "fish-set-gx", "fish",
      "set -gx ANTHROPIC_ADMIN_KEY ", v("fish-set-gx"), "\n",
      "fish shell set -gx export.");
    P(T_, "ci-config", "circleci-environment", "yml",
      "version: 2.1\njobs:\n  audit:\n    docker:\n      - image: cimg/python:3.12\n    environment:\n      ANTHROPIC_ADMIN_KEY: ", v("circleci-environment"), "\n",
      "CircleCI job environment literal.");
    P(T_, "source-code", "ts-fetch-literal", "ts",
      "const res = await fetch(\"https://api.anthropic.com/v1/organizations/api_keys\", {\n  headers: { \"x-api-key\": \"", v("ts-fetch-literal"), "\", \"anthropic-version\": \"2023-06-01\" },\n});\n",
      "TypeScript fetch() with an x-api-key header literal.");
    P(T_, "log", "audit-stderr-headers", "log",
      "audit-script: outgoing request headers {'x-api-key': '", v("audit-stderr-headers"), "', 'anthropic-version': '2023-06-01'}\n",
      "Audit-script stderr dump of outgoing request headers.");
    C(T_, "placeholder", "markdown-table-ellipsis", "md",
      "| Variable | Example | Scope |\n| --- | --- | --- |\n| ANTHROPIC_ADMIN_KEY | `sk-ant-admin01-...` | organization admin |\n",
      "Prefix-plus-ellipsis placeholder inside a Markdown table cell (new skeleton).");
    C(T_, "placeholder", "angle-comment", "ts",
      "// export ANTHROPIC_ADMIN_KEY=sk-ant-admin01-<YOUR_ADMIN_KEY>\nconst adminKey = process.env.ANTHROPIC_ADMIN_KEY;\n",
      "Angle-bracket placeholder in a code comment.");
    C(T_, "public-id", "api-keys-listing", "json",
      `{"data": [{"id": "apikey_${synthetic(seed(T_, "apikey-id"), 24, ALNUM)}", "workspace_id": "wrkspc_${synthetic(seed(T_, "workspace-id"), 24, ALNUM)}", "status": "active"}], "has_more": false}\n`,
      "Admin API listing of api key ids and workspace ids, no secret.");
    C(T_, "public-id", "masked-console", "txt",
      `Admin keys\n  automation-bot   sk-ant-admin01-****…****${synthetic(seed(T_, "last-four"), 4, ALNUM)}   created 2026-08-11\n`,
      "Console-style masked display (prefix + last four characters).");
    C(T_, "near-miss", "prefix-constant", "py",
      "ADMIN_KEY_PREFIX = \"sk-ant-admin01-\"\n\ndef is_admin_key(value: str) -> bool:\n    return value.startswith(ADMIN_KEY_PREFIX)\n",
      "Prefix-only string constant in SDK source (new skeleton).");
    C(T_, "reference", "one-password-ref", "env",
      "export ANTHROPIC_ADMIN_KEY=\"op://vault/anthropic-admin/credential\"\nop run -- ./rotate-keys.sh\n",
      "1Password secret reference resolved by op run.");
    C(T_, "prose", "rotation-policy", "md",
      "Admin keys can manage every workspace in the organization; rotate them every 90 days and never use one for model requests.\n",
      "Security policy prose on admin-key rotation.");
    T(T_, "httpie-admin-api", "underscore-after-version", "prefix", "provider",
      "prefix: sk-ant-admin01- becomes sk-ant-admin01_ (only the separator after the version changes)",
      w => w.pre + w.value.replace(/^sk-ant-admin01-/, "sk-ant-admin01_") + w.post);
    T(T_, "circleci-environment", "admim-letter", "prefix", "provider",
      "prefix: one letter of the documented prefix changes (sk-ant-admim01-)",
      w => w.pre + w.value.replace(/^sk-ant-admin01-/, "sk-ant-admim01-") + w.post);
  }

  // ------------------------------------------------------------ cohere-api-key (T2, context-gated)
  {
    const T_ = "cohere-api-key";
    const v = s => synthetic(seed(T_, s), 40, ALNUM);
    P(T_, "log", "litellm-proxy-debug", "log",
      "18:22:04 - LiteLLM Proxy:DEBUG: router.py:1841 - cohere/command-r-plus call failed; masked_api_key=", v("litellm-proxy-debug"), " reason=AuthenticationError\n",
      "LiteLLM proxy debug log for the cohere provider with the full key in a masked-labelled field.");
    P(T_, "sdk-config", "llamaindex-rerank", "py",
      "from llama_index.postprocessor.cohere_rerank import CohereRerank\n\nreranker = CohereRerank(api_key=\"", v("llamaindex-rerank"), "\", top_n=5)\n",
      "LlamaIndex CohereRerank(api_key=...) construction.");
    P(T_, "source-code", "java-builder-token", "java",
      "Cohere cohere = Cohere.builder().token(\"", v("java-builder-token"), "\").clientName(\"search-api\").build();\n",
      "Java Cohere builder .token(\"…\") literal.");
    P(T_, "ci-config", "azure-pipelines-vars", "yml",
      "variables:\n  COHERE_API_KEY: ", v("azure-pipelines-vars"), "\n  RERANK_TOP_N: 5\n",
      "Azure Pipelines variables literal.");
    P(T_, "tool-output", "mcp-config-print", "txt",
      "Loaded MCP server config:\n{\n  \"mcpServers\": {\n    \"search\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"cohere-mcp\"],\n      \"env\": {\n        \"CO_API_KEY\": \"", v("mcp-config-print"), "\"\n      }\n    }\n  }\n}\n",
      "MCP server config as an agent host prints it, with env CO_API_KEY.");
    C(T_, "public-id", "embed-response", "json",
      `{"id": "${uuid(T_, "embed-id")}", "meta": {"api_version": {"version": "2"}, "billed_units": {"input_tokens": 118}}, "response_type": "embeddings_floats"}\n`,
      "Embed response with id, api_version and billed_units, no key.");
    C(T_, "public-id", "finetune-listing", "txt",
      `DATASET ID                          MODEL ID                                 STATUS\nsupport-tickets-${synthetic(seed(T_, "dataset"), 6, LOWER_ALNUM)}              ${uuid(T_, "finetune-model")}-ft     READY\n`,
      "Dataset id and fine-tuned model id in a job listing.");
    C(T_, "placeholder", "notebook-trial-key", "md",
      "Set `CO_API_KEY=<trial key>` in the notebook environment before running the cells below.\n",
      "Notebook markdown placeholder.");
    C(T_, "reference", "langchain-environ", "py",
      "import os\nfrom langchain_cohere import ChatCohere\n\nllm = ChatCohere(cohere_api_key=os.environ[\"COHERE_API_KEY\"])\n",
      "LangChain environment read; no literal.");
    C(T_, "prose", "trial-vs-production", "md",
      "Trial and production Cohere keys look the same; the difference is rate limits and billing, so treat both as secrets.\n",
      "Documentation paragraph comparing trial and production keys.");
    T(T_, "mcp-config-print", "voyage-keyword", "context", "context",
      "context:keyword: CO_API_KEY renamed VOYAGE_API_KEY on the value's line; the value is kept byte-for-byte",
      w => whole(w).replace("\"CO_API_KEY\"", "\"VOYAGE_API_KEY\""));
    T(T_, "llamaindex-rerank", "model-field", "context", "context",
      "context:field: the value passed as model= instead of api_key=; the value is kept byte-for-byte",
      w => whole(w).replace("CohereRerank(api_key=", "CohereRerank(model="));
    T(T_, "llamaindex-rerank", "length-39", "length", "tool-undisputed",
      "length: 39 characters vs the 40 the pinned gitleaks rule fixes, beside the same gate",
      w => w.pre + w.value.slice(0, -1) + w.post);
  }

  // ------------------------------------------------------------ anthropic-api01-key (T1 prefix, open body)
  {
    const T_ = "anthropic-api01-key";
    const v = (s, n, tail = "") => `sk-ant-api01-${synthetic(seed(T_, s), n, B64URL)}${tail}`;
    P(T_, "structured-file", "compliance-export-yaml", "yml",
      "compliance_export:\n  schedule: \"0 3 * * *\"\n  api_key: ", v("compliance-export-yaml", 20), "\n  destination: s3://audit-archive.example.test/claude/\n",
      "Compliance-export job YAML at the minimum body width the contract admits (20).");
    P(T_, "header", "httpx-client", "py",
      "client = httpx.Client(base_url=\"https://api.anthropic.com\", headers={\"x-api-key\": \"", v("httpx-client", 93, "AA"), "\"})\n",
      "x-api-key header in a Python httpx client (distinct from the curl template).");
    P(T_, "prose", "ticket-paren", "md",
      "Rotated the organization key (the old one was ", v("ticket-paren", 64), ".) Please update the vault entry.\n",
      "Key followed immediately by a period and a closing parenthesis in a ticket.");
    P(T_, "source-code", "go-const-long", "go",
      "package compliance\n\nconst complianceKey = \"", v("go-const-long", 120), "\"\n",
      "Go const with a body longer than 100 characters, exercising the open upper bound.");
    P(T_, "ci-config", "buildkite-env", "yml",
      "steps:\n  - label: \":lock: compliance sync\"\n    command: ./sync.sh\n    env:\n      ANTHROPIC_COMPLIANCE_KEY: ", v("buildkite-env", 93, "AA"), "\n",
      "Buildkite pipeline env literal.");
    P(T_, "tool-output", "secretsmanager-get", "json",
      `{\n  "ARN": "arn:aws:secretsmanager:us-east-1:111122223333:secret:anthropic/compliance-Qx7pLm",\n  "Name": "anthropic/compliance",\n  "SecretString": "`, v("secretsmanager-get", 80), `",\n  "VersionId": "${uuid(T_, "version")}"\n}\n`,
      "secretsmanager get-secret-value JSON with SecretString holding the key.");
    C(T_, "public-id", "activity-feed", "json",
      `{"data": [{"type": "api_request", "actor": {"id": "user_${synthetic(seed(T_, "actor"), 24, ALNUM)}"}, "organization_uuid": "${uuid(T_, "org")}"}]}\n`,
      "Compliance API activity feed with actor ids and an organization uuid, no key.");
    C(T_, "placeholder", "masked-display", "txt",
      "Current key: sk-ant-api01-XXXXXXXX…XXXX (created 2026-07-30)\n",
      "Masked display: an 8-character run, an ellipsis and a 4-character run (no 20-character body).");
    C(T_, "near-miss", "allowlist-comment", "toml",
      "# prefix sk-ant-api01- is matched by the org rule below; do not add it to the allowlist\n[[allowlist]]\nregexes = ['''EXAMPLE_[A-Z]+''']\n",
      "Prefix-only mention inside a secret-scanner config comment (new skeleton).");
    C(T_, "reference", "vault-path", "hcl",
      "data \"vault_kv_secret_v2\" \"anthropic\" {\n  mount = \"secret\"\n  name  = \"anthropic#api01\"\n}\n",
      "Vault path reference.");
    C(T_, "encoded-value", "fingerprint-table", "md",
      `| key name | sha256 fingerprint |\n| --- | --- |\n| compliance-export | ${hex(T_, "fingerprint", 64)} |\n`,
      "SHA-256 fingerprint of a key in an audit table.");
    C(T_, "prose", "procurement-note", "md",
      "Procurement approved the Compliance Access Key add-on for the enterprise organization; security owns issuance.\n",
      "Procurement note naming the product, no value.");
    T(T_, "httpx-client", "apl-letter", "prefix", "provider",
      "prefix: one letter of the documented prefix changes (sk-ant-apl01-)",
      w => w.pre + w.value.replace(/^sk-ant-api01-/, "sk-ant-apl01-") + w.post);
  }

  // ------------------------------------------------------------ aws-bedrock-long-term-api-key (T1)
  {
    const T_ = "aws-bedrock-long-term-api-key";
    const v = s => {
      const user = synthetic(seed(T_, `${s}:user`), 4, LOWER_ALNUM);
      const account = synthetic(seed(T_, `${s}:account`), 12, DIGITS);
      const secret = createHash("sha256").update(seed(T_, `${s}:secret-a`)).digest().subarray(0, 32);
      const secret2 = createHash("sha256").update(seed(T_, `${s}:secret-b`)).digest().subarray(0, 12);
      return `ABSK${Buffer.from(`BedrockAPIKey-${user}-at-${account}:${Buffer.concat([secret, secret2]).toString("base64")}`).toString("base64")}`;
    };
    P(T_, "structured-file", "litellm-model-list", "yml",
      "model_list:\n  - model_name: claude-bedrock\n    litellm_params:\n      model: bedrock/anthropic.claude-sonnet-4\n      aws_bedrock_api_key: ", v("litellm-model-list"), "\n      aws_region_name: us-east-1\n",
      "LiteLLM model_list entry with aws_bedrock_api_key.");
    P(T_, "container-config", "k8s-secret-bearer", "yml",
      "apiVersion: v1\nkind: Secret\nmetadata:\n  name: bedrock-client\ntype: Opaque\nstringData:\n  AWS_BEARER_TOKEN_BEDROCK: ", v("k8s-secret-bearer"), "\n",
      "Kubernetes Secret stringData AWS_BEARER_TOKEN_BEDROCK.");
    P(T_, "header", "java-httpclient", "java",
      "HttpRequest req = HttpRequest.newBuilder(URI.create(endpoint + \"/model/\" + modelId + \"/converse\"))\n    .header(\"Authorization\", \"Bearer ", v("java-httpclient"), "\")\n    .POST(body)\n    .build();\n",
      "Authorization: Bearer in a Java HttpClient builder.");
    P(T_, "log", "access-log-authorization", "log",
      "10.0.4.17 - - [28/Sep/2026:08:41:09 +0000] \"POST /model/anthropic.claude-haiku/invoke HTTP/1.1\" 200 812 authorization=\"Bearer ", v("access-log-authorization"), "\"\n",
      "Proxy access log line with the full Authorization header (new skeleton).");
    P(T_, "cli", "inline-assignment", "sh",
      "AWS_BEARER_TOKEN_BEDROCK=", v("inline-assignment"), " aws bedrock-runtime converse --model-id amazon.nova-lite-v1:0 --messages file://msg.json\n",
      "aws bedrock-runtime call preceded by an inline AWS_BEARER_TOKEN_BEDROCK assignment.");
    C(T_, "public-id", "service-credential-listing", "json",
      `{"ServiceSpecificCredentials": [{"UserName": "BedrockAPIKey-${synthetic(seed(T_, "alias-user"), 4, LOWER_ALNUM)}", "Status": "Active", "ServiceName": "bedrock.amazonaws.com", "ServiceSpecificCredentialId": "ACCA${synthetic(seed(T_, "credential-id"), 17, UPPER_ALNUM)}"}]}\n`,
      "IAM service-specific credential listing (credential id and user name alias), no secret.");
    C(T_, "public-id", "inference-profile-output", "yml",
      "Outputs:\n  ModelArn:\n    Value: arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-4-5\n  InferenceProfileId:\n    Value: us.anthropic.claude-haiku-4-5-v1:0\n",
      "Model ARN and inference-profile id in a CloudFormation output.");
    C(T_, "encoded-value", "kubeconfig-ca-data", "yml",
      `clusters:\n  - name: dev\n    cluster:\n      certificate-authority-data: ${Buffer.from(synthetic(seed(T_, "ca-blob"), 180, ALNUM)).toString("base64")}\n      server: https://k8s.example.test\n`,
      "Long standard-Base64 blob with no ABSK head.");
    C(T_, "placeholder", "devcontainer-paste", "json",
      "{\n  \"name\": \"bedrock-dev\",\n  \"remoteEnv\": { \"AWS_BEARER_TOKEN_BEDROCK\": \"<paste key>\" }\n}\n",
      "devcontainer.json placeholder.");
  }

  // ------------------------------------------------------------ together-ai-api-key (T2)
  {
    const T_ = "together-ai-api-key";
    const v = s => `tgp_v1_${synthetic(seed(T_, s), 43, B64URL)}`;
    P(T_, "prose", "chat-backticks", "md",
      "here's the key for the eval box: `", v("chat-backticks"), "`\n",
      "Key inside backticks at the end of a chat message.");
    P(T_, "sdk-config", "vercel-ai-sdk", "ts",
      "import { createTogetherAI } from \"@ai-sdk/togetherai\";\n\nconst together = createTogetherAI({ apiKey: \"", v("vercel-ai-sdk"), "\" });\n",
      "Vercel AI SDK createTogetherAI literal.");
    P(T_, "log", "openai-client-repr", "log",
      "DEBUG client=OpenAI(base_url='https://api.together.xyz/v1', api_key='", v("openai-client-repr"), "', max_retries=2)\n",
      "Python logging of an OpenAI-compatible client repr() including api_key.");
    P(T_, "cli", "files-upload-history", "sh",
      "  512  together files upload --api-key ", v("files-upload-history"), " ./train.jsonl\n",
      "together files upload --api-key flag in shell history.");
    C(T_, "public-id", "finetune-job-listing", "json",
      `{"id": "ft-${uuid(T_, "ft-job")}", "training_file": "file-${uuid(T_, "file")}", "status": "completed"}\n`,
      "Fine-tune job id and uploaded file id in a list response.");
    C(T_, "near-miss", "truncated-dashboard", "txt",
      `API key: tgp_v1_${synthetic(seed(T_, "truncated"), 20, B64URL)}… (click to reveal)\n`,
      "tgp_v1_ followed by a 20-character truncated body and an ellipsis.");
    C(T_, "placeholder", "docs-ellipsis", "env",
      "# eval runner settings\nTOGETHER_API_KEY=tgp_v1_...\n",
      "Documentation placeholder.");
    C(T_, "reference", "doppler-ref", "yml",
      "# doppler.yaml: TOGETHER_API_KEY is injected at runtime by `doppler run -- python eval.py`\nsetup:\n  project: eval\n  config: prd\n",
      "Doppler project reference with no literal (a new skeleton; a workflow-expression reference already exists).");
    C(T_, "prose", "base-url-readme", "md",
      "Together exposes an OpenAI-compatible API at api.together.xyz/v1, so switching providers only changes the base URL and the model name.\n",
      "README comparing Together and OpenAI base URLs.");
    T(T_, "vercel-ai-sdk", "long-body", "length", "tool-undisputed",
      "length: 44-character body vs the 43 the contract fixes",
      w => `${w.pre}${w.value}${synthetic(seed(T_, "extra"), 1, ALNUM)}${w.post}`);
    T(T_, "files-upload-history", "hyphen-separators", "prefix", "tool-undisputed",
      "prefix: tgp_v1_ written with hyphens (tgp-v1-)",
      w => w.pre + w.value.replace(/^tgp_v1_/, "tgp-v1-") + w.post);
  }

  // ------------------------------------------------------------ openai-admin-api-key (T2)
  {
    const T_ = "openai-admin-api-key";
    const v = (s, n) => ({ a: synthetic(seed(T_, `${s}:a`), n, B64URL), b: synthetic(seed(T_, `${s}:b`), n, B64URL) });
    const join = ({ a, b }) => `sk-admin-${a}T3BlbkFJ${b}`;
    const segs = {};
    const k = (s, n) => { segs[s] = v(s, n); return join(segs[s]); };
    P(T_, "structured-file", "tfvars-admin-key", "tfvars",
      "openai_admin_key = \"", k("tfvars-admin-key", 58), "\"\nopenai_org      = \"org-analytics\"\n",
      "Terraform tfvars admin_key (58/58 form).");
    P(T_, "shell-export", "powershell-env", "ps1",
      "$env:OPENAI_ADMIN_KEY = \"", k("powershell-env", 58), "\"\n",
      "PowerShell $env: assignment (58/58; redact-secret#1013 authors no 74/74 admin value).");
    P(T_, "ci-config", "actions-usage-export", "yml",
      "jobs:\n  usage-export:\n    runs-on: ubuntu-latest\n    env:\n      OPENAI_ADMIN_KEY: ", k("actions-usage-export", 58), "\n    steps:\n      - run: python export_usage.py --since 7d\n",
      "GitHub Actions env literal on a usage-export job.");
    P(T_, "log", "requests-debug", "log",
      "send: b'GET /v1/organization/usage/completions?start_time=1759017600 HTTP/1.1\\r\\nHost: api.openai.com\\r\\nAuthorization: Bearer ", k("requests-debug", 58), "\\r\\n'\n",
      "requests debug log with Authorization: Bearer on the admin usage endpoint.");
    P(T_, "prose", "oncall-handoff", "md",
      "Handoff: the usage dashboards read from the admin key ", k("oncall-handoff", 58), " until Friday's rotation.\n",
      "On-call handoff note pasting the key.");
    P(T_, "source-code", "go-const", "go",
      "package billing\n\nconst adminKey = \"", k("go-const", 58), "\"\n",
      "Go const (58/58; redact-secret#1013 authors no 74/74 admin value).");
    C(T_, "public-id", "admin-keys-listing", "json",
      `{"object": "list", "data": [{"object": "organization.admin_api_key", "id": "key_${synthetic(seed(T_, "key-id"), 16, ALNUM)}", "name": "usage-export", "redacted_value": "sk-admin-${synthetic(seed(T_, "redacted-head"), 4, ALNUM)}...${synthetic(seed(T_, "redacted-tail"), 4, ALNUM)}"}]}\n`,
      "admin_api_keys list response with id, name and redacted_value.");
    C(T_, "near-miss", "markerless-test-name", "ts",
      `it("rejects sk-admin-${synthetic(seed(T_, "markerless"), 58, B64URL)} without the marker", () => {});\n`,
      "sk-admin- followed by one 58-character segment without the T3BlbkFJ marker, inside a test name.");
    C(T_, "placeholder", "console-mask", "txt",
      "Admin key: sk-admin-************************\n",
      "Console mask of asterisks.");
    C(T_, "reference", "secrets-manager-arn", "env",
      "OPENAI_ADMIN_KEY_ARN=arn:aws:secretsmanager:us-east-1:111122223333:secret:openai/admin-key-R2d7Qa\n",
      "AWS Secrets Manager ARN for the admin key.");
    C(T_, "prose", "permissions-paragraph", "md",
      "Admin keys can read usage and manage projects and members, but cannot call models; create them only for automation that needs organization access.\n",
      "Documentation paragraph on admin-key permissions.");
    T(T_, "tfvars-admin-key", "marker-fk", "prefix", "tool-undisputed",
      "marker: T3BlbkFJ becomes T3BlbkFK; both segments are byte-identical to the positive",
      w => w.pre + w.value.replace("T3BlbkFJ", "T3BlbkFK") + w.post);
    T(T_, "actions-usage-export", "first-segment-57", "length", "tool-undisputed",
      "length: the first segment has 57 characters (its last byte removed); the marker and the second segment are byte-identical",
      w => w.pre + `sk-admin-${segs["actions-usage-export"].a.slice(0, -1)}T3BlbkFJ${segs["actions-usage-export"].b}` + w.post);
    T(T_, "go-const", "admn-prefix", "prefix", "provider",
      "prefix: sk-admin- becomes sk-admn- (one letter dropped)",
      w => w.pre + w.value.replace(/^sk-admin-/, "sk-admn-") + w.post);
  }

  // ------------------------------------------------------------ connection-string (T3 policy)
  {
    const T_ = "connection-string";
    const pw = s => synthetic(seed(T_, s), 22, ALNUM);
    const U = (before, after) => ({ before, after });
    P(T_, "env", "database-url-query", "env",
      "DATABASE_URL=", pw("database-url-query"), "\n",
      "DATABASE_URL with query parameters after the host; password in userinfo.",
      U("postgresql://app:", "@db.internal:5432/app?sslmode=require&application_name=api"));
    P(T_, "structured-file", "rails-database-yml", "yml",
      "production:\n  adapter: postgresql\n  url: ", pw("rails-database-yml"), "\n  pool: 10\n",
      "Rails database.yml url: key.",
      U("postgres://rails:", "@pg-primary.example.test:5432/storefront"));
    P(T_, "source-code", "sqlalchemy-ipv6", "py",
      "engine = create_engine(\"", pw("sqlalchemy-ipv6"), "\")\n",
      "SQLAlchemy create_engine() literal with an IPv6 host in brackets.",
      U("postgresql+psycopg://report:", "@[2001:db8:4::15]:5432/reports"));
    P(T_, "log", "orm-connection-error", "log",
      "2026-09-28 06:30:12 ERROR sequelize: connection refused for ", pw("orm-connection-error"), " (ECONNREFUSED)\n",
      "ORM connection error log printing the full DSN.",
      U("mysql://svc_orders:", "@10.20.0.14:3306/orders"));
    P(T_, "cli", "psql-history", "sh",
      "   88  psql \"", pw("psql-history"), "\"\n",
      "psql connection URI in shell history.",
      U("postgresql://analyst:", "@warehouse.example.test:5432/metrics?sslmode=verify-full"));
    P(T_, "structured-file", "celery-amqps", "py",
      "broker_url = \"", pw("celery-amqps"), "\"\n",
      "amqps:// broker URL in a Celery config (a scheme no positive covered).",
      U("amqps://celery:", "@mq.example.test:5671/tasks"));
    C(T_, "public-id", "user-only-uri", "env",
      "READONLY_URL=postgresql://app@db.internal:5432/app\n",
      "postgresql URI with a user and no password.");
    C(T_, "public-id", "jdbc-user-param", "properties",
      "spring.datasource.url=jdbc:postgresql://db.internal:5432/app?user=app&ssl=true\n",
      "JDBC URL with ?user= and no password parameter.");
    C(T_, "encoded-value", "percent-template", "py",
      "DSN_TEMPLATE = \"postgresql://%s:%s@%s:%d/%s\"\n",
      "Percent-format DSN template with %s placeholders.");
    C(T_, "near-miss", "at-in-path", "txt",
      "https://registry.example.test/packages/@scope/tool:1.4.2\n",
      "HTTP URL with @ in the path, not userinfo.");
    C(T_, "placeholder", "docs-uppercase", "md",
      "Use a URI of the form `postgres://USER:PASSWORD@HOST/DB`.\n",
      "Documentation placeholder URI.");
    C(T_, "reference", "interpolated-password", "env",
      "DATABASE_URL=postgresql://app:${DB_PASSWORD}@db/app\n",
      "Environment interpolation in the password position.");
    C(T_, "prose", "email-colon", "md",
      "Questions go to dba@example.test: see the runbook for the failover steps.\n",
      "Email address followed by a colon in prose.");
    C(T_, "public-id", "git-ssh-remote", "txt",
      "git remote add origin git@github.com:example-org/storefront.git\n",
      "git SSH remote (user@host:path, no password).");
    T(T_, "rails-database-yml", "at-to-slash", "context", "context",
      "context:host-delimiter: the '@' ending userinfo replaced by '/', so the value becomes a path segment; the value is kept byte-for-byte",
      w => w.pre + w.value + w.post.replace(/^@/, "/"));
    T(T_, "psql-history", "colon-removed", "context", "context",
      "context:delimiter: the user:password ':' removed, so the value joins the user name; the value is kept byte-for-byte",
      w => w.pre.replace(/analyst:$/, "analyst") + w.value + w.post);
  }

  // ------------------------------------------------------------ stripe-token (T1)
  {
    const T_ = "stripe-token";
    const body = s => synthetic(seed(T_, s), 32, ALNUM);
    P(T_, "env", "env-with-publishable", "env",
      `# Stripe test-mode keys for local checkout\nSTRIPE_PUBLISHABLE_KEY=pk_test_${body("env-publishable-neighbour")}\nSTRIPE_SECRET_KEY=`, `sk_test_${body("env-with-publishable")}`, "\n",
      "Mixed document: .env with the secret key beside a publishable pk_test_ key; only the sk_test_ span is expected.");
    P(T_, "container-config", "compose-restricted", "yml",
      "services:\n  billing-worker:\n    image: registry.example.test/billing:2.3\n    environment:\n      STRIPE_API_KEY: ", `rk_live_${body("compose-restricted")}`, "\n",
      "docker-compose environment with a restricted rk_live_ key.");
    P(T_, "header", "httpie-bearer", "sh",
      "http POST https://api.stripe.com/v1/refunds 'Authorization:Bearer ", `sk_live_${body("httpie-bearer")}`, "' payment_intent=pi_example\n",
      "Authorization: Bearer in an HTTPie call.");
    P(T_, "log", "stripe-node-debug", "log",
      "[stripe-node] request POST /v1/payment_intents headers={\"Authorization\":\"Bearer ", `sk_test_${body("stripe-node-debug")}`, "\",\"Stripe-Version\":\"2026-08-27\"}\n",
      "stripe-node debug log with the request's Authorization header.");
    P(T_, "structured-file", "rails-credentials", "yml",
      "stripe:\n  secret_key: ", `sk_live_${body("rails-credentials")}`, "\n  webhook_tolerance: 300\n",
      "Rails credentials YAML stripe: secret_key:.");
    P(T_, "tool-output", "stripe-config-list", "txt",
      "$ stripe config --list\n[default]\n  device_name = \"build-agent-3\"\n  test_mode_api_key = \"", `sk_test_${body("stripe-config-list")}`, "\"\n",
      "stripe config --list output with the secret key row.");
    C(T_, "public-id", "publishable-frontend", "js",
      `const stripe = Stripe("pk_live_${body("frontend-publishable")}");\n`,
      "pk_live_ publishable key in frontend JS; the provider documents it as safe to expose.");
    C(T_, "public-id", "webhook-payload-ids", "json",
      `{"id": "evt_${synthetic(seed(T_, "evt"), 24, ALNUM)}", "account": "acct_${synthetic(seed(T_, "acct"), 16, ALNUM)}", "data": {"object": {"customer": "cus_${synthetic(seed(T_, "cus"), 14, ALNUM)}"}}}\n`,
      "Connected-account and customer ids in a webhook payload.");
    C(T_, "near-miss", "dashboard-last-four", "md",
      `Customer reported a failing key ending sk_live_…${synthetic(seed(T_, "last-four"), 4, ALNUM)}; asked them to roll it from the dashboard.\n`,
      "Dashboard-style truncated display (prefix + ellipsis + last four).");
    C(T_, "placeholder", "docs-x-body", "env",
      "# checkout service settings\nSTRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxx\n",
      "Documentation placeholder (24 x characters; see REVISIONS).");
    C(T_, "reference", "process-env", "js",
      "Stripe.apiKey = process.env.STRIPE_SECRET_KEY;\n",
      "process.env reference.");
    C(T_, "encoded-value", "signature-header", "txt",
      `Stripe-Signature: t=1759050000,v1=${hex(T_, "sig-v1", 64)}\n`,
      "Stripe-Signature header: timestamp and HMAC hex.");
    C(T_, "prose", "test-vs-live", "md",
      "Test-mode keys only touch test data; live-mode keys move real money, so restrict them and keep them out of source control.\n",
      "Documentation paragraph on test vs live mode.");
    T(T_, "compose-restricted", "publishable-prefix", "public-prefix", "provider",
      "public-prefix: rk_live_ becomes pk_live_, the publishable namespace the provider documents as safe to expose",
      w => w.pre + w.value.replace(/^rk_live_/, "pk_live_") + w.post);
    T(T_, "httpie-bearer", "hyphen-separators", "prefix", "provider",
      "prefix: sk_live_ written with hyphens (sk-live-)",
      w => w.pre + w.value.replace(/^sk_live_/, "sk-live-") + w.post);
  }

  // ------------------------------------------------------------ github-token (T1)
  {
    const T_ = "github-token";
    const tok = (p, s) => `${p}_${synthetic(seed(T_, s), 36, ALNUM)}`;
    P(T_, "cli", "gh-login-herestring", "sh",
      "gh auth login --hostname github.com --with-token <<< ", tok("ghp", "gh-login-herestring"), "\n",
      "gh auth login --with-token here-string in shell history.");
    P(T_, "url", "installation-clone-url", "sh",
      "git clone ", tok("ghs", "installation-clone-url"), "\n",
      "https://x-access-token:ghs_…@github.com clone URL with an installation token; the whole URL is the envelope.",
      { before: "https://x-access-token:", after: "@github.com/example-org/deploy-config.git" });
    P(T_, "structured-file", "npmrc-authtoken", "npmrc",
      "@example-org:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=", tok("ghp", "npmrc-authtoken"), "\n",
      ".npmrc _authToken for the GitHub npm registry.");
    P(T_, "tool-output", "gh-auth-status-token", "txt",
      "github.com\n  ✓ Logged in to github.com account octo-fixture (keyring)\n  - Active account: true\n  - Git operations protocol: https\n  - Token: ", tok("gho", "gh-auth-status-token"), "\n  - Token scopes: 'gist', 'read:org', 'repo'\n",
      "gh auth status --show-token output line.");
    C(T_, "public-id", "app-manifest-ids", "yml",
      `app_id: ${synthetic(seed(T_, "app-id"), 6, DIGITS)}\ninstallation_id: ${synthetic(seed(T_, "installation-id"), 8, DIGITS)}\nclient_id: Iv1.${hex(T_, "client-id", 16)}\n`,
      "GitHub App id, installation id and client id (Iv1.…).");
    C(T_, "near-miss", "masked-commit-message", "txt",
      "commit 1f2e3d4c\n\n    Remove leaked token ghp_**** from the deploy script\n",
      "ghp_ followed by a masked body in a commit message.");
    C(T_, "placeholder", "x-body", "env",
      "# release workflow settings\nGH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx\n",
      "Placeholder with 20 x characters (see REVISIONS).");
    C(T_, "reference", "workflow-expressions", "yml",
      "env:\n  GH_TOKEN: ${{ github.token }}\n  RELEASE_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n",
      "Workflow token expressions.");
    C(T_, "encoded-value", "audit-fingerprint", "json",
      `{"action": "oauth_access.create", "hashed_token": "${Buffer.from(createHash("sha256").update(seed(T_, "hashed")).digest()).toString("base64")}", "actor": "octo-fixture"}\n`,
      "SHA-256 token fingerprint from an audit log export.");
    C(T_, "prose", "prefix-list", "md",
      "GitHub token prefixes identify the type: ghp_ for classic PATs, gho_ for OAuth, ghu_ and ghs_ for app tokens and ghr_ for refresh tokens.\n",
      "Documentation listing the five prefixes with no bodies.");
    C(T_, "public-id", "commit-and-digest", "txt",
      `Built ${hex(T_, "commit", 40)} -> ghcr.io/example-org/api@sha256:${hex(T_, "digest", 64)}\n`,
      "40-hex commit SHA and a ghcr.io image digest.");
    T(T_, "npmrc-authtoken", "ghx-prefix", "prefix", "provider",
      "prefix: ghp_ becomes ghx_, a letter outside the documented ghp/gho/ghu/ghs/ghr set",
      w => w.pre + w.value.replace(/^ghp_/, "ghx_") + w.post);
    T(T_, "gh-login-herestring", "hyphen-separator", "prefix", "provider",
      "prefix: ghp_ written with a hyphen (ghp-)",
      w => w.pre + w.value.replace(/^ghp_/, "ghp-") + w.post);
    T(T_, "installation-clone-url", "short-body-35", "length", "tool-undisputed",
      "length: the ghs_ body has 35 characters vs the 36 the contract fixes",
      w => w.pre + w.value.slice(0, -1) + w.post);
  }

  return c.fixtures;
}
