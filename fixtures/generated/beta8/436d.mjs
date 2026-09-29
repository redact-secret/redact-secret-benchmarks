import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, at, authorPositives, guard, probeContexts } from "./436-shared.mjs";

// Issue #436, slice d (category `beta8-436d`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Resend API key (re_ + 8 + _ + 24 alphanumerics; handoff redact-secret
// docs/audits/evidence/860/resend.md at 54fe385; product redact-secret#915). Every value is built here
// from a public `synthetic` seed in the documented layout, and every positive body is mixed case.
//
// Deliberately not authored: a random all-lower-case or all-upper-case body, either way. The product's
// mixed-case guard is false-positive policy, not a provider fact, so neither a random nor a word-built
// one-case value of the exact 8/_/24 layout is authored (it would satisfy the contract pattern, #84). A whsec_ webhook secret is
// another credential class, so it is a prefix twin, never a benign control.

const mixedCase = v => /[A-Z]/.test(v.slice(3)) && /[a-z]/.test(v.slice(3));

export function build436d({ fixture, synthetic }) {
  const c = beta8Corpus("436d", { fixture, synthetic });
  const T = "resend-api-key";
  const seed = slug => `beta11:436d:${T}:${slug}`;
  const { check, refuse } = guard("436d", T);
  const key = slug => {
    const v = check(`re_${synthetic(seed(`${slug}:a`), 8, ALNUM)}_${synthetic(seed(`${slug}:b`), 24, ALNUM)}`);
    if (!mixedCase(v)) throw new Error(`beta8-436d: ${slug} positive body is not mixed case`);
    return v;
  };

  const probe = probeContexts({ env: "RESEND_API_KEY", name: "Resend", host: "api.resend.com", ctor: "Resend" });
  const tsClient = v => ["import { Resend } from 'resend';\n\nconst resend = new Resend('", v, "');\nawait resend.emails.send({ from: 'ops@example.test', to: 'team@example.test', subject: 'Deploy', html: '<p>ok</p>' });\n"];
  const pyModule = v => ["import resend\n\nresend.api_key = \"", v, "\"\nresend.Emails.send({\"from\": \"ops@example.test\", \"to\": \"team@example.test\", \"subject\": \"Deploy\", \"html\": \"<p>ok</p>\"})\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"resend\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"resend-mcp\"],\n      \"env\": { \"RESEND_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const curl = v => ["curl -s -X POST https://api.resend.com/emails -H \"Authorization: Bearer ", v, "\" -H \"Content-Type: application/json\" -d '{\"from\": \"ops@example.test\", \"to\": \"team@example.test\", \"subject\": \"hi\", \"text\": \"hi\"}'\n"];
  const contexts = [...probe,
    { axis: "source-code", slug: "ts-client", ext: "ts", build: tsClient },
    { axis: "sdk-config", slug: "python-module", ext: "py", build: pyModule },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const seg1 = v => v.slice(3, 11), seg2 = v => v.slice(12);

  c.twin(T, "dotenv", "segment1-7", put("dotenv", refuse(`re_${seg1(k.dotenv).slice(0, 7)}_${seg2(k.dotenv)}`)), "length: a 7-character first segment vs exactly 8", "length", "env");
  c.twin(T, "export", "segment1-9", put("export", refuse(`re_${seg1(k.export)}${synthetic(seed("extra1"), 1, ALNUM)}_${seg2(k.export)}`)), "length: a 9-character first segment vs exactly 8", "length", "sh");
  c.twin(T, "json-token", "segment2-23", put("json-token", refuse(k["json-token"].slice(0, -1))), "length: a 23-character second segment vs exactly 24", "length", "json");
  c.twin(T, "json-api-key", "segment2-25", put("json-api-key", refuse(`${k["json-api-key"]}${synthetic(seed("extra2"), 1, ALNUM)}`)), "length: a 25-character second segment vs exactly 24", "length", "json");
  c.twin(T, "bearer-header", "hyphen-separator", put("bearer-header", refuse(at(k["bearer-header"], 11, "-"))), "boundary: - in place of the _ separator at offset 11", "boundary", "http");
  c.twin(T, "x-api-key-header", "second-underscore", put("x-api-key-header", refuse(at(k["x-api-key-header"], 22, "_"))), "alphabet: a second _ inside the 24-character segment", "alphabet", "http");
  c.twin(T, "sdk-kwarg", "uppercase-prefix", put("sdk-kwarg", refuse(`RE_${k["sdk-kwarg"].slice(3)}`)), "prefix: RE_ vs the re_ the provider CLI requires", "prefix", "py");
  c.twin(T, "bare-prose", "are-glue", put("bare-prose", refuse(`a${k["bare-prose"]}`)), "boundary: a glued before re_, so the value reads are_…", "boundary", "md");
  c.twin(T, "chat-paste", "underscore-glue", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before re_", "boundary", "txt");
  c.twin(T, "curl-bearer", "trailing-glue", curl(refuse(`${k["curl-bearer"]}-x`)), "boundary: -x glued after the second segment", "boundary", "sh");
  c.twin(T, "mcp-env", "webhook-secret", mcp(refuse(`whsec_${synthetic(seed("whsec"), 32, ALNUM)}`)), "prefix: a whsec_ webhook signing secret, another credential class", "prefix", "json");

  c.control(T, "placeholder", "digits", ["RESEND_API_KEY=re_123456789\n"], "env");
  c.control(T, "placeholder", "x-run", ["const resend = new Resend('re_xxxxxxxxx');\n"], "ts");
  c.control(T, "placeholder", "masked", ["Created API key \"production\" (re_*********), full access.\n"], "md");
  c.control(T, "placeholder", "your-key", ["resend.api_key = \"re_yourkey\"\n"], "py");
  c.control(T, "reference", "env-reference", ["RESEND_API_KEY=${RESEND_API_KEY}\n"], "env");
  c.control(T, "public-id", "python-re-names", ["import re\n\nre_compile = re.compile\nre_pattern_cache = {}\n"], "py");
  c.control(T, "public-id", "pre-identifier", ["def pre_process_all_inputs_now(batch):\n    return [x.strip() for x in batch]\n"], "py");
  c.control(T, "near-miss", "truncated", [`2026-09-28T12:40:10Z mailer: rejected truncated key re_${synthetic(seed("short"), 8, ALNUM)}_ (length 12)\n`], "log");
  c.control(T, "prose", "key-guidance", ["Resend API keys start with re_ and are shown once; store RESEND_API_KEY in your secret manager.\n"], "md");
  return c.fixtures;
}
