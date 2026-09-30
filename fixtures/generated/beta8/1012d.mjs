import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, BASE32_UPPER, UPPER_DIGITS, at, authorPositives, guard, probeContexts } from "./1012-shared.mjs";

// Issue #1012, slice d (category `beta8-1012d`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the AWS STS temporary access key id (ASIA + exactly 16 [A-Z0-9]); research redact-secret
// docs/audits/evidence/1012/aws-sts-temporary-access-key.md at 4fb7882; product redact-secret#1027. Every value is built
// here from a public `synthetic` seed. A bare id scores as project policy (benchmarks/lib/assessment.ts), as the
// registry aws-access-key's bare AKIA id does.
//
// Bodies mix the base32 class ([A-Z2-7]) and the wider [A-Z0-9] class the contract keeps (the research record bounds
// the alphabet contradiction; R8 forbids narrowing). Not authored either way: AKIA ids (aws-access-key's credential),
// the AWS docs EXAMPLE ids, the secret access key and session token that accompany an ASIA id, and an all-A run
// (contract-valid, so silence would be asserted, not evidenced).

export function build1012d({ fixture, synthetic }) {
  const c = beta8Corpus("1012d", { fixture, synthetic });
  const T = "aws-sts-temporary-access-key";
  const g = guard("1012d", T);
  const seed = slug => `beta12:1012d:${T}:${slug}`;
  const WIDE = ["dotenv", "json-token", "chat-paste", "sts-json", "credentials-file"];
  const id = slug => {
    let body = synthetic(seed(slug), 16, WIDE.includes(slug) ? UPPER_DIGITS : BASE32_UPPER);
    if (WIDE.includes(slug) && !/[0189]/.test(body)) body = at(body, 7, "8");
    return g.check(`ASIA${body}`);
  };
  const aida = slug => `AIDA${synthetic(seed(`${slug}:aida`), 16, BASE32_UPPER)}`;
  const aroa = slug => `AROA${synthetic(seed(`${slug}:aroa`), 16, BASE32_UPPER)}`;

  const probe = probeContexts({ env: "AWS_ACCESS_KEY_ID", name: "AWS", host: "sts.amazonaws.com", ctor: "Session" });
  const credsFile = v => ["[temp]\nregion = us-east-1\naws_access_key_id = ", v, "\n"];
  const stsJson = v => ["{\n  \"Credentials\": {\n    \"AccessKeyId\": \"", v, "\",\n    \"Expiration\": \"2026-09-29T13:00:00Z\"\n  },\n  \"AssumedRoleUser\": {\n    \"Arn\": \"arn:aws:sts::123456789012:assumed-role/deploy/ci\"\n  }\n}\n"];
  const cloudtrail = v => ["{\"eventName\": \"PutObject\", \"userIdentity\": {\"type\": \"AssumedRole\", \"accessKeyId\": \"", v, "\"}}\n"];
  const contexts = [...probe,
    { axis: "structured-file", slug: "credentials-file", ext: "ini", build: credsFile },
    { axis: "tool-output", slug: "sts-json", ext: "json", build: stsJson },
    { axis: "log", slug: "cloudtrail-event", ext: "json", build: cloudtrail },
  ];
  const K = authorPositives(c, T, contexts, id);
  const body = v => v.slice(4);

  c.twin(T, "dotenv", "body-15", K.put("dotenv", g.refuse(K.k.dotenv.slice(0, -1))), "length: a 15-character body vs exactly 16", "length", "env");
  c.twin(T, "export", "body-17", K.put("export", g.refuse(`${K.k.export}${synthetic(seed("extra"), 1, BASE32_UPPER)}`)), "length: a 17-character body vs exactly 16", "length", "sh");
  c.twin(T, "json-token", "lowercase-byte", K.put("json-token", g.refuse(at(K.k["json-token"], 10, K.k["json-token"][10].toLowerCase() === K.k["json-token"][10] ? "q" : K.k["json-token"][10].toLowerCase()))), "alphabet: one body byte lower-cased, outside [A-Z0-9]", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "asib-prefix", K.put("sdk-kwarg", g.refuse(`ASIB${body(K.k["sdk-kwarg"])}`)), "prefix: ASIB, not a documented IAM identifier prefix", "prefix", "py");
  c.twin(T, "bare-prose", "leading-glue", K.put("bare-prose", g.refuse(`X${K.k["bare-prose"]}`)), "boundary: X glued before ASIA", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-glue", K.put("chat-paste", g.refuse(`${K.k["chat-paste"]}Q`)), "boundary: Q glued after the 16-character body", "boundary", "txt");

  c.control(T, "public-id", "iam-user-id", [`{"UserName": "ci-deployer", "UserId": "${aida("user")}"}\n`], "json");
  c.control(T, "public-id", "role-id", [`{"RoleName": "deploy", "RoleId": "${aroa("role")}"}\n`], "json");
  c.control(T, "public-id", "account-and-arn", ["AWS_ACCOUNT_ID=123456789012\nAWS_ROLE_ARN=arn:aws:iam::123456789012:role/deploy\n"], "env");
  c.control(T, "near-miss", "region-word", ["Offices in ASIA and EMEA share the ap-southeast-1 and eu-west-1 regions.\n"], "md");
  c.control(T, "near-miss", "truncated", [`2026-09-29T12:31:09Z sts: truncated key id ASIA${synthetic(seed("short"), 8, BASE32_UPPER)} in request\n`], "log");
  c.control(T, "placeholder", "masked", ["AWS_ACCESS_KEY_ID=ASIA****************\n"], "env");
  c.control(T, "placeholder", "angle", ["aws_access_key_id = <temporary-access-key-id>\n"], "ini");
  c.control(T, "reference", "env-reference", ["AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}\n"], "env");
  c.control(T, "reference", "actions-output", ["      AWS_ACCESS_KEY_ID: ${{ steps.creds.outputs.aws-access-key-id }}\n"], "yml");
  c.control(T, "prose", "prefix-guidance", ["Temporary AWS credentials use access key IDs that begin with ASIA and always come with a session token.\n"], "md");
  // An identifier that starts with ASIA but is not 20 characters of [A-Z0-9].
  c.control(T, "near-miss", "identifier", [`const ASIA_PACIFIC_ENDPOINT = "https://${synthetic(seed("host"), 8, ALNUM).toLowerCase()}.example.test";\n`], "ts");
  return c.fixtures;
}
