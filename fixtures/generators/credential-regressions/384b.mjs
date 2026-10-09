import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";
import { BEDROCK_SHORT_HEAD, BEDROCK_SHORT_HEAD_TEXT, BEDROCK_LONG_HEAD } from "../../../benchmarks/lib/credential-regressions/384b.ts";

// Issue #384, slice b (category `beta8-384b`). See docs/specs/beta8-evidence.md.
//
// Beta.10 corpus for the two Amazon Bedrock API key families (research redact-secret#778
// long-term, #779 short-term; product redact-secret#864). Every key is built here from
// synthetic bytes: the long-term key is the Base64 of a BedrockAPIKey-<user>-at-000000000000:
// <secret> layout with a zero account and a random synthetic secret, the short-term key is
// the Base64 of a pre-signed CallWithBearerToken URL whose credential id, session token and
// signature are synthetic. Nothing is a provider example, a scanner report or an issued key,
// and the finished values exist only in the gitignored generated corpus.
//
// Deliberately not authored (see benchmarks/lib/credential-regressions/384b.ts field claims):
//   - a length, ceiling or head-less ABSK twin for the long-term key, and a length or ceiling
//     twin for the short-term key: no provider source states a width, and the T1 ruling is open;
//   - a URL-safe alphabet as a positive, and the decoded (Base64-free) pre-signed URL: a
//     separate lexical form of the same secret that needs its own ruling;
//   - AKIA or ASIA identifiers as controls: another family's real credential shape, which the
//     product reports as aws_access_key_id, so it is never a benign control here;
//   - a Claude Platform on AWS key (aws-external-anthropic-api-key-): a separate product.

const HEX = "0123456789abcdef";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const b64 = text => Buffer.from(text, "utf8").toString("base64");
const at = (value, index, ch) => value.slice(0, index) + ch + value.slice(index + 1);

export function build384b({ fixture, synthetic }) {
  const c = beta8Corpus("384b", { fixture, synthetic });
  const seed = (target, slug) => `beta10:384b:${target}:${slug}`;
  const check = (target, value) => {
    if (!new RegExp(contracts[target].pattern).test(value)) throw new Error(`beta8-384b: authored ${target} positive fails its own contract: ${value.slice(0, 8)}...`);
    return value;
  };
  const refuse = (target, value) => {
    if (new RegExp(contracts[target].pattern).test(value)) throw new Error(`beta8-384b: ${target} twin value still satisfies the contract`);
    return value;
  };
  const digest = slug => synthetic(`beta10:384b:digest:${slug}`, 64, HEX);

  // ------------------------------------------------ aws-bedrock-long-term-api-key
  {
    const T = "aws-bedrock-long-term-api-key";
    // BedrockAPIKey-<user>[+1]-at-<account>:<secret>. A 4-character user and a 60-character Base64 secret (44 bytes) decode to
    // 95 bytes, which encode to 128 characters: 132 with ABSK. A +1 secondary key adds two bytes and reaches 136.
    const key = (slug, secondary = false) => {
      const user = `${synthetic(seed(T, `${slug}:user`), 4, ALNUM)}${secondary ? "+1" : ""}`;
      const secret = `${synthetic(seed(T, `${slug}:secret`), 59, ALNUM + "+/")}=`;
      const value = `ABSK${b64(`BedrockAPIKey-${user}-at-000000000000:${secret}`)}`;
      if (value.length !== (secondary ? 136 : 132)) throw new Error(`beta8-384b: ${slug} long-term key is ${value.length} characters`);
      return check(T, value);
    };
    const k = { dotenv: key("dotenv"), export: key("export", true), curl: key("curl"), python: key("python"), openai: key("openai"), yaml: key("yaml", true), settings: key("settings"), tool: key("tool"), log: key("log"), pasted: key("pasted") };

    const dotenv = v => ["# .env\nAWS_BEARER_TOKEN_BEDROCK=", v, "\nAWS_REGION=us-east-1\n"];
    const exportLine = v => ["export AWS_BEARER_TOKEN_BEDROCK=\"", v, "\"\n"];
    const curl = v => ["curl -s https://bedrock-runtime.us-east-1.amazonaws.com/model/example-model/converse -H \"Authorization: Bearer ", v, "\" -H \"Content-Type: application/json\"\n"];
    const python = v => ["import os\n\nos.environ[\"AWS_BEARER_TOKEN_BEDROCK\"] = \"", v, "\"\n"];
    const openai = v => ["from openai import OpenAI\n\nclient = OpenAI(base_url=\"https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1\", api_key=\"", v, "\")\n"];
    const yaml = v => ["jobs:\n  invoke:\n    runs-on: ubuntu-latest\n    env:\n      AWS_BEARER_TOKEN_BEDROCK: ", v, "\n    steps:\n      - run: ./scripts/invoke-model.sh\n"];
    const settings = v => ["{\n  \"provider\": \"bedrock\",\n  \"awsBearerTokenBedrock\": \"", v, "\",\n  \"region\": \"us-east-1\"\n}\n"];
    const tool = v => ["{\"tool\": \"bash\", \"arguments\": {\"command\": \"export AWS_BEARER_TOKEN_BEDROCK=", v, " && aws bedrock list-foundation-models\"}}\n"];
    const log = v => ["2026-09-26T10:15:02Z bedrock-proxy: forwarding with bearer ", v, " to us-east-1\n"];
    const pasted = v => ["Here is the Bedrock key for the sandbox account, delete it after the demo:\n", v, "\n"];

    c.positive(T, "env", "dotenv", dotenv({ secret: k.dotenv }), "env");
    c.positive(T, "shell-export", "export-136", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-bearer", curl({ secret: k.curl }), "sh");
    c.positive(T, "source-code", "python-environ", python({ secret: k.python }), "py");
    c.positive(T, "sdk-config", "openai-sdk", openai({ secret: k.openai }), "py");
    c.positive(T, "ci-config", "actions-env", yaml({ secret: k.yaml }), "yml");
    c.positive(T, "structured-file", "agent-settings", settings({ secret: k.settings }), "json");
    c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
    c.positive(T, "log", "proxy-log", log({ secret: k.log }), "log");
    c.positive(T, "prose", "pasted-key", pasted({ secret: k.pasted }), "txt");

    c.twin(T, "dotenv", "wrong-prefix", dotenv(refuse(T, `ABSX${k.dotenv.slice(4)}`)), "prefix: ABSX in place of ABSK", "prefix", "env");
    c.twin(T, "curl-bearer", "lowercase-prefix", curl(refuse(T, `absk${k.curl.slice(4)}`)), "prefix: the documented upper-case ABSK spelled lower case", "prefix", "sh");
    c.twin(T, "python-environ", "urlsafe-body", python(refuse(T, at(k.python, 22, "-"))), "alphabet: - (URL-safe Base64) as the byte right after the head, so the standard-Base64 run after ABSK stops at 18 characters", "alphabet", "py");
    c.twin(T, "agent-settings", "leading-equals", settings(refuse(T, at(k.settings, 22, "="))), "alphabet: = as the byte right after the head, where Base64 allows padding only at the end", "alphabet", "json");
    c.twin(T, "openai-sdk", "embedded-leading", openai(refuse(T, `X${k.openai}`)), "boundary: one Base64 character before ABSK, so the key is embedded in a longer run", "boundary", "py");
    c.twin(T, "pasted-key", "short-prefix", pasted(refuse(T, `ABK${k.pasted.slice(4)}`)), "prefix: ABK in place of ABSK, one letter of the prefix dropped", "prefix", "txt");

    const alias = `BedrockAPIKey-${synthetic(seed(T, "alias-user"), 4, ALNUM)}-at-000000000000`;
    const blob = synthetic(seed(T, "blob"), 132, ALNUM + "+/");
    c.control(T, "placeholder", "docs-ellipsis", ["AWS_BEARER_TOKEN_BEDROCK=ABSK...\n"], "env");
    c.control(T, "placeholder", "your-key", ["export AWS_BEARER_TOKEN_BEDROCK=<your-bedrock-api-key>\n"], "sh");
    c.control(T, "reference", "env-reference", ["AWS_BEARER_TOKEN_BEDROCK=${AWS_BEARER_TOKEN_BEDROCK}\n"], "env");
    c.control(T, "reference", "actions-secret", ["      AWS_BEARER_TOKEN_BEDROCK: ${{ secrets.AWS_BEARER_TOKEN_BEDROCK }}\n"], "yml");
    c.control(T, "prose", "key-guidance", ["Long-term Bedrock API keys start with ABSK, last until the expiration you set and create an IAM user with attached policies; prefer short-term keys where you can.\n"], "md");
    c.control(T, "public-id", "iam-alias", [`ServiceCredentialAlias: ${alias}\nUserName: ${alias.split("-at-")[0]}\nArn: arn:aws:iam::000000000000:user/${alias.split("-at-")[0]}\n`], "txt");
    c.control(T, "public-id", "model-and-endpoint", ["modelId: anthropic.claude-3-5-sonnet-20241022-v2:0\nendpoint: https://bedrock-runtime.us-east-1.amazonaws.com\n"], "yml");
    c.control(T, "near-miss", "prefix-only", ["Authorization: Bearer ABSK\n"], "txt");
    c.control(T, "near-miss", "truncated-head", [`AWS_BEARER_TOKEN_BEDROCK=ABSK${BEDROCK_LONG_HEAD.slice(0, 12)}\n`], "env");
    c.control(T, "encoded-value", "alias-base64", [`credential_alias_b64: ${b64(alias)}\n`], "yml");
    c.control(T, "encoded-value", "long-base64-blob", [`image_layer_digest: ${blob}==\n`], "txt");
  }

  // ----------------------------------------------- aws-bedrock-short-term-api-key
  {
    const T = "aws-bedrock-short-term-api-key";
    // The Base64 of a SigV4-presigned CallWithBearerToken URL plus &Version=1, as the AWS generators emit it. The credential id,
    // session token and signature are synthetic; the credential id is wrapped in Base64, so no plain-text access key id appears.
    const key = (slug, sessionTokenLength) => {
      const akid = `ASIA${synthetic(seed(T, `${slug}:akid`), 16, UPPER_ALNUM)}`;
      const query = [
        `${BEDROCK_SHORT_HEAD_TEXT}=${akid}%2F20260926%2Fus-east-1%2Fbedrock%2Faws4_request`,
        "X-Amz-Date=20260926T101500Z", "X-Amz-Expires=43200",
        ...(sessionTokenLength ? [`X-Amz-Security-Token=${synthetic(seed(T, `${slug}:session`), sessionTokenLength, ALNUM)}`] : []),
        "X-Amz-SignedHeaders=host", `X-Amz-Signature=${synthetic(seed(T, `${slug}:signature`), 64, HEX)}`,
      ].join("&");
      return check(T, `bedrock-api-key-${b64(`${query}&Version=1`)}`);
    };
    const k = { dotenv: key("dotenv", 0), export: key("export", 700), curl: key("curl", 0), python: key("python", 700), openai: key("openai", 1100), yaml: key("yaml", 700), settings: key("settings", 0), tool: key("tool", 700), log: key("log", 0), pasted: key("pasted", 1100) };
    for (const v of Object.values(k)) if (!v.startsWith(`bedrock-api-key-${BEDROCK_SHORT_HEAD}`)) throw new Error("beta8-384b: short-term key lost its fixed head");

    const dotenv = v => ["# .env\nAWS_BEARER_TOKEN_BEDROCK=", v, "\nAWS_REGION=us-east-1\n"];
    const exportLine = v => ["export AWS_BEARER_TOKEN_BEDROCK=\"", v, "\"\n"];
    const curl = v => ["curl -s https://bedrock-runtime.us-east-1.amazonaws.com/model/example-model/converse -H \"Authorization: Bearer ", v, "\" -H \"Content-Type: application/json\"\n"];
    const python = v => ["import os\n\nos.environ[\"AWS_BEARER_TOKEN_BEDROCK\"] = \"", v, "\"\n"];
    const openai = v => ["from openai import OpenAI\n\nclient = OpenAI(base_url=\"https://bedrock-mantle.us-east-1.api.aws/v1\", api_key=\"", v, "\")\n"];
    const yaml = v => ["jobs:\n  invoke:\n    runs-on: ubuntu-latest\n    env:\n      AWS_BEARER_TOKEN_BEDROCK: ", v, "\n    steps:\n      - run: ./scripts/invoke-model.sh\n"];
    const settings = v => ["{\n  \"provider\": \"bedrock\",\n  \"awsBearerTokenBedrock\": \"", v, "\",\n  \"region\": \"us-east-1\"\n}\n"];
    const tool = v => ["{\"tool\": \"bash\", \"arguments\": {\"command\": \"export AWS_BEARER_TOKEN_BEDROCK=", v, " && aws bedrock list-foundation-models\"}}\n"];
    const log = v => ["2026-09-26T10:15:02Z bedrock-proxy: forwarding with bearer ", v, " to us-east-1\n"];
    const pasted = v => ["Here is a short-term Bedrock key for the sandbox account, it expires tonight:\n", v, "\n"];

    c.positive(T, "env", "dotenv", dotenv({ secret: k.dotenv }), "env");
    c.positive(T, "shell-export", "export-with-session", exportLine({ secret: k.export }), "sh");
    c.positive(T, "header", "curl-bearer", curl({ secret: k.curl }), "sh");
    c.positive(T, "source-code", "python-environ", python({ secret: k.python }), "py");
    c.positive(T, "sdk-config", "openai-sdk-mantle", openai({ secret: k.openai }), "py");
    c.positive(T, "ci-config", "actions-env", yaml({ secret: k.yaml }), "yml");
    c.positive(T, "structured-file", "agent-settings", settings({ secret: k.settings }), "json");
    c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
    c.positive(T, "log", "proxy-log", log({ secret: k.log }), "log");
    c.positive(T, "prose", "pasted-key", pasted({ secret: k.pasted }), "txt");

    const prefixLength = "bedrock-api-key-".length;
    c.twin(T, "dotenv", "head-one-char-off", dotenv(refuse(T, at(k.dotenv, prefixLength + 10, k.dotenv[prefixLength + 10] === "Z" ? "Y" : "Z"))), "prefix: one character of the fixed 133-character head changed, inside its first 28 characters", "prefix", "env");
    c.twin(T, "curl-bearer", "plural-prefix", curl(refuse(T, `bedrock-api-keys-${k.curl.slice(prefixLength)}`)), "prefix: bedrock-api-keys- (plural) in place of bedrock-api-key-", "prefix", "sh");
    c.twin(T, "export-with-session", "capitalized-prefix", exportLine(refuse(T, `B${k.export.slice(1)}`)), "prefix: the documented lower-case bedrock-api-key- capitalized", "prefix", "sh");
    c.twin(T, "python-environ", "urlsafe-body", python(refuse(T, `bedrock-api-key-${BEDROCK_SHORT_HEAD}-${k.python.slice(prefixLength + 134)}`)), "alphabet: - (URL-safe Base64) as the first byte after the head, so the standard-Base64 body is empty", "alphabet", "py");
    c.twin(T, "agent-settings", "head-only", settings(refuse(T, `bedrock-api-key-${BEDROCK_SHORT_HEAD}`)), "length: prefix and fixed head with no body after it", "length", "json");
    c.twin(T, "openai-sdk-mantle", "embedded-leading", openai(refuse(T, `X${k.openai}`)), "boundary: one identifier character before the prefix, so the key is embedded in a longer token", "boundary", "py");

    const ruleHead = BEDROCK_SHORT_HEAD.slice(0, 28);
    const alias = `arn:aws:iam::000000000000:user/${synthetic(seed(T, "arn-user"), 8, ALNUM)}`;
    const blob = synthetic(seed(T, "blob"), 520, B64);
    c.control(T, "placeholder", "docs-angle", ["export AWS_BEARER_TOKEN_BEDROCK=<your-bedrock-api-key>\n"], "sh");
    c.control(T, "placeholder", "your-key-here", ["AWS_BEARER_TOKEN_BEDROCK=bedrock-api-key-YOUR_KEY_HERE\n"], "env");
    c.control(T, "reference", "env-reference", ["AWS_BEARER_TOKEN_BEDROCK=${AWS_BEARER_TOKEN_BEDROCK}\n"], "env");
    c.control(T, "reference", "python-getenv", ["import os\n\ntoken = os.environ[\"AWS_BEARER_TOKEN_BEDROCK\"]\n"], "py");
    c.control(T, "prose", "key-guidance", ["Short-term Bedrock API keys are pre-signed URLs that inherit the generating principal's permissions and last at most 12 hours, so generate one per session.\n"], "md");
    c.control(T, "public-id", "iam-action-and-arn", [`Action: bedrock:CallWithBearerToken\nPrincipal: ${alias}\nCondition: bedrock:bearerTokenType = SHORT_TERM\n`], "yml");
    c.control(T, "near-miss", "scanner-rule-anchor", [`# git-secrets pattern (28-character head only)\nbedrock-api-key-${ruleHead}\n`], "txt");
    c.control(T, "near-miss", "rule-with-body-class", [`# AWS blog scan pattern\nPattern: bedrock-api-key-${BEDROCK_SHORT_HEAD}[A-Za-z0-9+/]+={0,2}\n`], "txt");
    c.control(T, "encoded-value", "unrelated-base64", [`attachment_b64: ${blob}\n`], "yml");
    c.control(T, "encoded-value", "decoded-host-only", [`presign_host_b64: ${b64(BEDROCK_SHORT_HEAD_TEXT.slice(0, 21))}\nrequest_digest: ${digest(T)}\n`], "yml");
  }
  return c.fixtures;
}
