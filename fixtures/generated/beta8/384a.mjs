import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #384, slice a (category `beta8-384a`). See docs/specs/beta8-evidence.md.
//
// Beta.10 corpus for three arrival families (research redact-secret#776 sk-ant-api01-,
// #775 sk-ant-admin01-, #777 sk-admin-; product redact-secret#862, #863). Every credential-
// shaped value is built here from a public `synthetic` seed; nothing is copied from a
// provider example, a scanner report or an issued key, and the finished values exist only
// in the gitignored generated corpus, never as literals in this source.
//
// Deliberately not authored (see benchmarks/lib/beta8/384a.ts field claims):
//   - a body length, alphabet or AA-tail twin for either Anthropic prefix: the product keeps
//     a >= 20 byte superset and no provider source states the body;
//   - sk-ant-api02-, sk-ant-admin02-, the unversioned sk-ant-admin- and sk-ant-oat01-/-ort01-
//     as negatives: no provider source decides them;
//   - a Base64-encoded copy of any key: its family scope is undecided;
//   - a 58/74 mixed-width sk-admin- key either way, and a marker-less sk-admin- body as a
//     positive: the product decision (redact-secret#863) puts marker-less bodies out of
//     contract, so they appear only as a negative twin.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const URLSAFE = `${ALNUM}_-`;
const HEX = "0123456789abcdef";

export function build384a({ fixture, synthetic }) {
  const c = beta8Corpus("384a", { fixture, synthetic });
  const seed = (target, slug) => `beta10:384a:${target}:${slug}`;
  const check = (target, value) => {
    const pattern = new RegExp(contracts[target].pattern);
    if (!pattern.test(value)) throw new Error(`beta8-384a: authored ${target} positive fails its own contract: ${value.slice(0, 8)}...`);
    return value;
  };
  const refuse = (target, value) => {
    if (new RegExp(contracts[target].pattern).test(value)) throw new Error(`beta8-384a: ${target} twin value still satisfies the contract`);
    return value;
  };
  const digest = slug => synthetic(`beta10:384a:digest:${slug}`, 64, HEX);

  // ------------------------------------------------------ anthropic api01 / admin01
  const anthropic = (T, cfg) => {
    const prefix = cfg.prefix;
    const key = slug => check(T, `${prefix}${synthetic(seed(T, slug), 93, URLSAFE)}AA`);
    const k = Object.fromEntries(["dotenv", "export", "curl", "json", "python", "compose", "tool", "log", "pasted"].map(s => [s, key(s)]));
    const swap = (value, from, to) => `${to}${value.slice(from.length)}`;

    const dotenv = v => [`# .env\n${cfg.env}=`, v, "\nANTHROPIC_VERSION=2023-06-01\n"];
    const exportLine = v => [`export ${cfg.exportName}="`, v, "\"\n"];
    const curl = v => [`curl -s ${cfg.url} -H "x-api-key: `, v, "\" -H \"anthropic-version: 2023-06-01\"\n"];
    const json = v => [`{\n  "${cfg.jsonKey}": "`, v, "\",\n  \"organization\": \"acme\"\n}\n"];
    const python = v => ["import anthropic\n\nclient = anthropic.Anthropic(api_key=\"", v, "\")\n"];
    const compose = v => [`services:\n  ${cfg.service}:\n    image: registry.example.test/${cfg.service}:1.4\n    environment:\n      ${cfg.env}: `, v, "\n"];
    const tool = v => [`{"tool": "bash", "arguments": {"command": "curl -s ${cfg.url} -H 'x-api-key: `, v, "'\"}}\n"];
    const log = v => [`2026-09-26T10:04:11Z ${cfg.logSource}: using key `, v, " for org acme\n"];
    const pasted = v => ["Here is the key you asked for, please rotate it afterwards:\n", v, "\n"];

    c.positive(T, "env", "dotenv", dotenv({ secret: k.dotenv }), "env");
    c.positive(T, "shell-export", "export", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-x-api-key", curl({ secret: k.curl }), "sh");
    c.positive(T, "structured-file", "json-config", json({ secret: k.json }), "json");
    c.positive(T, "sdk-config", "python-sdk", python({ secret: k.python }), "py");
    c.positive(T, "container-config", "compose-env", compose({ secret: k.compose }), "yml");
    c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
    c.positive(T, "log", "job-log", log({ secret: k.log }), "log");
    c.positive(T, "prose", "pasted-key", pasted({ secret: k.pasted }), "txt");

    // Twins: each keeps the positive's context and changes exactly one documented property.
    c.twin(T, "dotenv", "api03-prefix", dotenv(swap(k.dotenv, prefix, "sk-ant-api03-")), "prefix: sk-ant-api03- (the Claude API key class) in place of this class; same body", "prefix", "env");
    c.twin(T, "export", `${cfg.sibling.slug}-prefix`, exportLine(swap(k.export, prefix, cfg.sibling.prefix)), `prefix: ${cfg.sibling.prefix} (${cfg.sibling.label}) in place of this class; same body`, "prefix", "sh");
    c.twin(T, "curl-x-api-key", "underscore-delimiters", curl(refuse(T, swap(k.curl, prefix, prefix.replaceAll("-", "_")))), `boundary: underscores in place of the provider-documented hyphens (${prefix.replaceAll("-", "_")})`, "boundary", "sh");
    c.twin(T, "json-config", "uppercase-prefix", json(refuse(T, swap(k.json, prefix, prefix.toUpperCase()))), "prefix: the documented lowercase prefix upper-cased", "prefix", "json");
    c.twin(T, "python-sdk", "embedded-leading", python(refuse(T, `x${k.python}`)), "boundary: one identifier character before the prefix, so the key is embedded in a longer token", "boundary", "py");
    c.twin(T, "pasted-key", "body-only", pasted(refuse(T, k.pasted.slice(prefix.length))), "prefix: the prefix removed, leaving the bare 95-character body", "prefix", "txt");

    // Independent benign controls.
    c.control(T, "placeholder", "docs-ellipsis", [`export ${cfg.exportName}=${prefix}...\n`], "sh");
    c.control(T, "placeholder", "angle-key", [`curl -s ${cfg.url} -H "x-api-key: ${prefix}<your-key>"\n`], "sh");
    c.control(T, "reference", "env-reference", [`${cfg.env}=\${${cfg.env}}\n`], "env");
    c.control(T, "reference", "actions-secret", [`      ${cfg.env}: \${{ secrets.${cfg.env} }}\n`], "yml");
    c.control(T, "prose", "prefix-guidance", [`${cfg.guidance}\n`], "md");
    c.control(T, "public-id", cfg.idSlug, [cfg.ids(seed(T, "ids"))], "json");
    c.control(T, "public-id", "version-and-org", [`anthropic-version: 2023-06-01\norganization_id: ${uuid(synthetic(seed(T, "org"), 32, HEX))}\nscope: read:compliance_user_data\n`], "txt");
    c.control(T, "near-miss", "prefix-only", [`# copy the key from the console and paste it after the ${prefix} prefix\n`], "sh");
    c.control(T, "encoded-value", "key-digest", [`# audit record\n${cfg.env.toLowerCase()}_sha256=${digest(T)}\n`], "txt");
  };
  const uuid = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;

  anthropic("anthropic-api01-key", {
    prefix: "sk-ant-api01-", env: "ANTHROPIC_COMPLIANCE_ACCESS_KEY", exportName: "ANTHROPIC_API_KEY", jsonKey: "complianceAccessKey",
    url: "https://api.anthropic.com/v1/compliance/activities", service: "compliance-export", logSource: "compliance-export",
    sibling: { slug: "admin01", prefix: "sk-ant-admin01-", label: "the Console Admin API key class" },
    guidance: "Enterprise organization keys start with sk-ant-api01-; the compliance scope is chosen when the key is created and is shown once, so store it in your secrets manager.",
    idSlug: "activity-ids",
    ids: s => `{\n  "activity": "activity_${synthetic(`${s}:a`, 22, ALNUM)}",\n  "api_key_id": "apikey_${synthetic(`${s}:k`, 22, ALNUM)}",\n  "actor": "user_${synthetic(`${s}:u`, 22, ALNUM)}"\n}\n`,
  });
  anthropic("anthropic-admin01-key", {
    prefix: "sk-ant-admin01-", env: "ANTHROPIC_ADMIN_API_KEY", exportName: "ANTHROPIC_ADMIN_KEY", jsonKey: "admin_api_key",
    url: "https://api.anthropic.com/v1/organizations/api_keys", service: "org-sync", logSource: "org-sync",
    sibling: { slug: "api01", prefix: "sk-ant-api01-", label: "the Claude Enterprise organization key class" },
    guidance: "Admin API keys start with sk-ant-admin01- and are created by organization admins in the Console; give each an expiration and revoke it when the integration is retired.",
    idSlug: "admin-api-ids",
    ids: s => `GET /v1/organizations/api_keys\n{\n  "id": "apikey_${synthetic(`${s}:k`, 22, ALNUM)}",\n  "workspace_id": "wrkspc_${synthetic(`${s}:w`, 22, ALNUM)}",\n  "created_by": "user_${synthetic(`${s}:u`, 22, ALNUM)}"\n}\n`,
  });

  // ------------------------------------------------------------ openai sk-admin-
  {
    const T = "openai-admin-api-key";
    const seg = (slug, n) => synthetic(seed(T, slug), n, URLSAFE);
    const key58 = slug => check(T, `sk-admin-${seg(`${slug}:a`, 58)}T3BlbkFJ${seg(`${slug}:b`, 58)}`);
    const key74 = slug => check(T, `sk-admin-${seg(`${slug}:a`, 74)}T3BlbkFJ${seg(`${slug}:b`, 74)}`);
    const k = { dotenv: key58("dotenv"), export: key74("export"), curl: key58("curl"), json: key58("json"), compose: key58("compose"), python: key58("python"), ts: key58("ts"), tool: key58("tool"), log: key58("log") };
    const [a58, b58] = ["dotenv", "curl"].map(s => [seg(`${s}:a`, 58), seg(`${s}:b`, 58)]);
    const [a74, b74] = [seg("export:a", 74), seg("export:b", 74)];

    const dotenv = v => ["# .env\nOPENAI_ADMIN_KEY=", v, "\nOPENAI_ORG_ID=org-acme-example\n"];
    const exportLine = v => ["export OPENAI_ADMIN_KEY=\"", v, "\"\n"];
    const curl = v => ["curl -s https://api.openai.com/v1/organization/costs -H \"Authorization: Bearer ", v, "\"\n"];
    const json = v => ["{\n  \"admin_api_key\": \"", v, "\",\n  \"organization\": \"acme\"\n}\n"];
    const compose = v => ["services:\n  usage-report:\n    image: registry.example.test/usage-report:2.0\n    environment:\n      OPENAI_ADMIN_KEY: ", v, "\n"];
    const python = v => ["from openai import OpenAI\n\nclient = OpenAI(admin_api_key=\"", v, "\")\n"];
    const ts = v => ["import OpenAI from 'openai';\n\nconst client = new OpenAI({ adminAPIKey: '", v, "' });\n"];
    const tool = v => ["{\"tool\": \"bash\", \"arguments\": {\"command\": \"export OPENAI_ADMIN_KEY=", v, " && ./usage.sh\"}}\n"];
    const log = v => ["2026-09-26T10:09:31Z usage-report: admin key ", v, " loaded for org acme\n"];

    c.positive(T, "env", "dotenv", dotenv({ secret: k.dotenv }), "env");
    c.positive(T, "shell-export", "export-74", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-bearer", curl({ secret: k.curl }), "sh");
    c.positive(T, "structured-file", "json-config", json({ secret: k.json }), "json");
    c.positive(T, "container-config", "compose-env", compose({ secret: k.compose }), "yml");
    c.positive(T, "sdk-config", "python-sdk", python({ secret: k.python }), "py");
    c.positive(T, "source-code", "ts-client", ts({ secret: k.ts }), "ts");
    c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
    c.positive(T, "log", "usage-log", log({ secret: k.log }), "log");

    c.twin(T, "dotenv", "short-first-segment", dotenv(refuse(T, `sk-admin-${a58[0].slice(0, 57)}T3BlbkFJ${b58[0]}`)), "length: 57 bytes before the marker vs the 58 (or 74) the contract requires", "length", "env");
    c.twin(T, "curl-bearer", "short-second-segment", curl(refuse(T, `sk-admin-${a58[1]}T3BlbkFJ${b58[1].slice(0, 57)}`)), "length: 57 bytes after the marker vs the 58 (or 74) the contract requires", "length", "sh");
    c.twin(T, "export-74", "short-first-segment-74", exportLine(refuse(T, `sk-admin-${a74.slice(0, 73)}T3BlbkFJ${b74}`)), "length: 73 bytes before the marker vs the 74 the 74/74 shape requires", "length", "sh");
    c.twin(T, "export-74", "short-second-segment-74", exportLine(refuse(T, `sk-admin-${a74}T3BlbkFJ${b74.slice(0, 73)}`)), "length: 73 bytes after the marker vs the 74 the 74/74 shape requires", "length", "sh");
    c.twin(T, "json-config", "marker-less-body", json(refuse(T, `sk-admin-${seg("json:a", 58)}${seg("json:marker", 8)}${seg("json:b", 58)}`)), "alphabet: the T3BlbkFJ marker replaced by eight body bytes, a marker-less 124-byte body that the product decision (redact-secret#863) puts out of contract", "alphabet", "json");
    c.twin(T, "compose-env", "lowercase-marker", compose(refuse(T, k.compose.replace("T3BlbkFJ", "t3blbkfj"))), "alphabet: the marker replaced by its lower-case spelling", "alphabet", "yml");
    c.twin(T, "python-sdk", "underscore-delimiter", python(refuse(T, `sk-admin_${k.python.slice(9)}`)), "boundary: sk-admin_ in place of the sk-admin- delimiter", "boundary", "py");
    c.twin(T, "ts-client", "embedded-leading", ts(refuse(T, `x${k.ts}`)), "boundary: one identifier character before the prefix, so the key is embedded in a longer token", "boundary", "ts");

    c.control(T, "placeholder", "docs-ellipsis", ["export OPENAI_ADMIN_KEY=sk-admin-...\n"], "sh");
    c.control(T, "placeholder", "your-key-here", ["OPENAI_ADMIN_KEY=sk-admin-your-key-here\n"], "env");
    c.control(T, "reference", "env-reference", ["OPENAI_ADMIN_KEY=${OPENAI_ADMIN_KEY}\n"], "env");
    c.control(T, "reference", "actions-secret", ["      OPENAI_ADMIN_KEY: ${{ secrets.OPENAI_ADMIN_KEY }}\n"], "yml");
    c.control(T, "prose", "prefix-guidance", ["Organization admin keys start with sk-admin- and can only be created by organization owners; store them in a secrets manager and rotate them.\n"], "md");
    c.control(T, "public-id", "key-resource", [`GET /v1/organization/admin_api_keys\n{\n  "id": "key_${synthetic(seed(T, "resource-id"), 24, ALNUM)}",\n  "name": "usage-report",\n  "redacted_value": "sk-admin-...${synthetic(seed(T, "redacted-tail"), 4, ALNUM)}"\n}\n`], "json");
    c.control(T, "public-id", "org-and-project", [`OPENAI_ORG_ID=org-${synthetic(seed(T, "org"), 24, ALNUM)}\nOPENAI_PROJECT_ID=proj_${synthetic(seed(T, "project"), 24, ALNUM)}\n`], "env");
    c.control(T, "near-miss", "prefix-only", ["curl -s https://api.openai.com/v1/organization/costs -H \"Authorization: Bearer sk-admin-\"\n"], "sh");
    c.control(T, "near-miss", "inside-identifier", [`request_trace=${seg("trace:a", 20)}sk-admin-${seg("trace:b", 20)}\n`], "txt");
    c.control(T, "encoded-value", "key-digest", [`# audit record\nopenai_admin_key_sha256=${digest(T)}\n`], "txt");
  }
  return c.fixtures;
}
