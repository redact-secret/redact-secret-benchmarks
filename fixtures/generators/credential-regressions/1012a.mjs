import { beta8Corpus } from "./helpers.mjs";
import { AWS_SECRET_ALPHABET, BASE32_UPPER, HEX, ALNUM, at, guard } from "./1012-shared.mjs";

// Issue #1012, slice a (category `beta8-1012a`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the AWS IAM user secret access key (exactly 40 [A-Za-z0-9/+], context-constrained); research
// redact-secret docs/audits/evidence/1012/aws-iam-user-secret-access-key.md at 4fb7882; product redact-secret#1028.
// Every value is built here from a public `synthetic` seed.
//
// Context-gated: a value is a positive only under an AWS secret key name on its own line or next to an AKIA access key
// id (on the same or the adjacent line, after the value; the id is a companion span). Each positive has a context twin that keeps the
// value byte-for-byte and removes that gate (the name renamed to an identifier name, or the AKIA id replaced by an AIDA
// IAM user unique id, which is not a key). Four structural twins keep the gate and break the value (39, 41, = and -).
//
// Deliberately not authored: a bare-value positive (a bare 40-character run is not attributable), a 41-character
// temporary secret either way, a session token, the AWS docs EXAMPLEKEY value, and a hash or id placed beside the
// gate as a control (the contract admits any 40-character Base64 value there, so silence would be asserted, not
// evidenced).

export function build1012a({ fixture, synthetic }) {
  const c = beta8Corpus("1012a", { fixture, synthetic });
  const T = "aws-secret-access-key";
  const g = guard("1012a", T);
  const seed = slug => `beta12:1012a:${T}:${slug}`;
  const secret = slug => g.check(synthetic(seed(slug), 40, AWS_SECRET_ALPHABET));
  const akia = slug => `AKIA${synthetic(seed(`${slug}:akia`), 16, BASE32_UPPER)}`;
  const aida = slug => `AIDA${synthetic(seed(`${slug}:aida`), 16, BASE32_UPPER)}`;
  const idNote = "The paired AKIA access key ID: the public half of the key pair, redactable with the secret at no collateral cost.";

  /** One context: `build(v, gate)` renders the text; the positive uses the gate, the twin `twinGate` and the same value. */
  const ctx = (axis, slug, ext, build, gate, twinGate, twinSlug, mutation) => ({ axis, slug, ext, build, gate, twinGate, twinSlug, mutation });
  const renamed = (from, to) => `context: ${from} renamed ${to}, an identifier name; the value is kept byte-for-byte`;
  const noAkia = "context: the adjacent AKIA access key ID replaced by an AIDA IAM user unique ID (an identifier, not a key); the value is kept byte-for-byte";
  const contexts = [
    ctx("structured-file", "credentials-file", "ini", (v, n) => ["[default]\nregion = us-east-1\n", `${n} = `, v, "\n"], "aws_secret_access_key", "aws_role_session_name", "session-name-credentials-file", renamed("aws_secret_access_key", "aws_role_session_name")),
    ctx("env", "dotenv", "env", (v, n) => ["# .env\nAWS_REGION=us-east-1\n", `${n}=`, v, "\n"], "AWS_SECRET_ACCESS_KEY", "AWS_ROLE_SESSION_NAME", "session-name-dotenv", renamed("AWS_SECRET_ACCESS_KEY", "AWS_ROLE_SESSION_NAME")),
    ctx("shell-export", "export", "sh", (v, n) => [`export ${n}="`, v, "\"\n"], "AWS_SECRET_ACCESS_KEY", "AWS_KMS_KEY_ALIAS", "kms-alias-export", renamed("AWS_SECRET_ACCESS_KEY", "AWS_KMS_KEY_ALIAS")),
    ctx("structured-file", "json-member", "json", (v, n) => ["{\n  \"UserName\": \"ci-deployer\",\n  \"Status\": \"Active\",\n  ", `"${n}": "`, v, "\"\n}\n"], "SecretAccessKey", "SessionName", "session-name-json", renamed("SecretAccessKey", "SessionName")),
    ctx("tool-output", "create-access-key-yaml", "yml", (v, n) => ["AccessKey:\n  UserName: ci-deployer\n  Status: Active\n  ", `${n}: `, v, "\n  CreateDate: '2026-09-29T10:12:03+00:00'\n"], "SecretAccessKey", "PolicyDigest", "policy-digest-yaml", renamed("SecretAccessKey", "PolicyDigest")),
    ctx("container-config", "compose-env", "yml", (v, n) => ["services:\n  worker:\n    image: registry.example.test/worker:2.4\n    environment:\n      ", `${n}: `, v, "\n"], "AWS_SECRET_ACCESS_KEY", "AWS_ROLE_SESSION_NAME", "session-name-compose", renamed("AWS_SECRET_ACCESS_KEY", "AWS_ROLE_SESSION_NAME")),
    ctx("ci-config", "actions-env", "yml", (v, n) => ["jobs:\n  deploy:\n    runs-on: ubuntu-24.04\n    env:\n      ", `${n}: `, v, "\n    steps:\n      - run: ./deploy.sh\n"], "AWS_SECRET_ACCESS_KEY", "AWS_ARTIFACT_DIGEST", "artifact-digest-actions", renamed("AWS_SECRET_ACCESS_KEY", "AWS_ARTIFACT_DIGEST")),
    ctx("sdk-config", "boto3-kwarg", "py", (v, n) => ["import boto3\n\ns3 = boto3.client(\"s3\", ", `${n}="`, v, "\")\n"], "aws_secret_access_key", "role_session_name", "session-name-boto3", renamed("aws_secret_access_key", "role_session_name")),
    ctx("source-code", "js-credentials", "ts", (v, n) => ["const s3 = new S3Client({ region: \"us-east-1\", credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, ", `${n}: "`, v, "\" } });\n"], "secretAccessKey", "sessionName", "session-name-js", renamed("secretAccessKey", "sessionName")),
    ctx("structured-file", "tfvars", "tfvars", (v, n) => ["region = \"us-east-1\"\n", `${n} = "`, v, "\"\n"], "aws_secret_key", "aws_session_name", "session-name-tfvars", renamed("aws_secret_key", "aws_session_name")),
    ctx("prose", "chat-phrase", "txt", (v, n) => [`Here is the ${n} for the staging user: `, v, " please rotate it after the demo.\n"], "secret access key", "build digest", "build-digest-chat", "context: the phrase secret access key replaced by build digest, so no AWS secret key name remains on the line; the value is kept byte-for-byte"),
  ];
  // AKIA adjacency: no key name; the gate is an AKIA id on the same or the previous line (companion span).
  const adjacency = [
    // The value precedes the id, so the value is the fixture's first expected span (the id follows as a companion).
    ["prose", "akia-next-line", "txt", (v, id) => ["New credentials for the staging user (value, then key id):\n", v, "\n", id, "\n"]],
    ["log", "akia-same-line", "log", (v, id) => ["2026-09-29T10:14:22Z rotate-keys: issued ", v, " paired with ", id, " for ci-deployer\n"]],
  ];

  const values = new Map();
  for (const x of contexts) {
    const v = secret(x.slug);
    values.set(x.slug, v);
    c.positive(T, x.axis, x.slug, x.build({ secret: v }, x.gate), x.ext);
    c.twin(T, x.slug, x.twinSlug, x.build(v, x.twinGate), x.mutation, "context", x.ext);
  }
  // Profile completion (Beta.12 graduation, 2026-09-30): the context-constrained profile needs one positive that is not
  // a twin's pair. A named profile in the shared credentials file, the research record's first context.
  c.positive(T, "structured-file", "credentials-file-named-profile", ["[ci-deployer]\naws_secret_access_key=", { secret: secret("credentials-file-named-profile") }, "\n"], "ini");
  for (const [axis, slug, ext, build] of adjacency) {
    const v = secret(slug);
    values.set(slug, v);
    c.positive(T, axis, slug, build({ secret: v }, { companion: akia(slug), note: idNote }), ext);
    c.twin(T, slug, `aida-${slug}`, build(v, aida(slug)), noAkia, "context", ext);
  }

  // Structural twins: the gate is kept and one value property breaks the contract.
  const dot = contexts.find(x => x.slug === "dotenv"), exp = contexts.find(x => x.slug === "export");
  const json = contexts.find(x => x.slug === "json-member"), ini = contexts.find(x => x.slug === "credentials-file");
  c.twin(T, "dotenv", "value-39", dot.build(g.refuse(values.get("dotenv").slice(0, -1)), dot.gate), "length: 39 characters vs exactly 40, beside the same key name", "length", "env");
  c.twin(T, "export", "value-41", exp.build(g.refuse(`${values.get("export")}${synthetic(seed("extra"), 1, ALNUM)}`), exp.gate), "length: 41 characters vs exactly 40, beside the same key name (the temporary-secret width is not claimed)", "length", "sh");
  c.twin(T, "json-member", "equals-inside", json.build(g.refuse(at(values.get("json-member"), 20, "=")), json.gate), "alphabet: one byte replaced by =, outside [A-Za-z0-9/+] (30 bytes encode to 40 characters without padding)", "alphabet", "json");
  c.twin(T, "credentials-file", "hyphen-inside", ini.build(g.refuse(at(values.get("credentials-file"), 17, "-")), ini.gate), "alphabet: one byte replaced by -, outside [A-Za-z0-9/+]", "alphabet", "ini");

  // Independent benign controls: gate-free values, identifiers, placeholders, references, encoded values and prose.
  const bare = synthetic(seed("bare-control"), 40, AWS_SECRET_ALPHABET);
  const b64 = text => Buffer.from(text, "utf8").toString("base64");
  const uuid = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  c.control(T, "near-miss", "bare-line", [`${bare}\n`]);
  c.control(T, "near-miss", "bare-in-prose", [`The export finished with checksum ${bare} and no warnings.\n`], "md");
  c.control(T, "near-miss", "bare-in-log", [`2026-09-29T10:20:11Z cache-sync: object ${synthetic(seed("object"), 40, AWS_SECRET_ALPHABET)} stored\n`], "log");
  c.control(T, "near-miss", "truncated", [`AWS_SECRET_ACCESS_KEY=${synthetic(seed("short"), 12, AWS_SECRET_ALPHABET)}\n`], "env");
  c.control(T, "public-id", "git-sha", [`commit ${synthetic(seed("git-sha"), 40, HEX)}\nAuthor: CI Bot <ci@example.test>\n`]);
  c.control(T, "public-id", "iam-user-id", [`{\n  "UserName": "ci-deployer",\n  "UserId": "${aida("user-id")}",\n  "Arn": "arn:aws:iam::123456789012:user/ci-deployer"\n}\n`], "json");
  c.control(T, "public-id", "request-id", [`x-amz-request-id: ${uuid(synthetic(seed("request-id"), 32, HEX))}\n`]);
  c.control(T, "public-id", "role-arn", ["AWS_ROLE_ARN=arn:aws:iam::123456789012:role/github-actions-deploy\n"], "env");
  c.control(T, "encoded-value", "etag", [`{"ETag": "\\"${synthetic(seed("etag"), 32, HEX)}\\"", "ChecksumSHA1": "${b64(synthetic(seed("sha1"), 20, ALNUM)).slice(0, 28)}"}\n`], "json");
  c.control(T, "encoded-value", "sha256-name", [`sha256: ${synthetic(seed("sha256"), 64, HEX)}\n`], "yml");
  c.control(T, "encoded-value", "data-uri", [`![diagram](data:image/png;base64,${b64(synthetic(seed("png"), 48, ALNUM))})\n`], "md");
  c.control(T, "placeholder", "angle-placeholder", ["AWS_SECRET_ACCESS_KEY=<your-secret-access-key>\n"], "env");
  c.control(T, "placeholder", "upper-placeholder", ["aws_secret_access_key = YOUR_SECRET_ACCESS_KEY\n"], "ini");
  c.control(T, "placeholder", "masked", [`aws_secret_access_key = ${"*".repeat(40)}\n`], "ini");
  c.control(T, "placeholder", "configure-list", ["      Name                    Value             Type    Location\n      ----                    -----             ----    --------\n   profile                <not set>             None    None\naccess_key     ****************WXYZ shared-credentials-file\nsecret_key     ****************QRST shared-credentials-file\n"]);
  c.control(T, "reference", "env-reference", ["AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}\n"], "env");
  c.control(T, "reference", "python-environ", ["import os\n\nsecret = os.environ[\"AWS_SECRET_ACCESS_KEY\"]\n"], "py");
  c.control(T, "reference", "actions-secret", ["      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}\n"], "yml");
  c.control(T, "prose", "rotation-guidance", ["Rotate the secret access key every 90 days and never commit it; prefer IAM roles and short-lived credentials.\n"], "md");
  c.control(T, "prose", "docs-note", ["An access key has two parts: an access key ID and a secret access key. You need both to sign requests.\n"], "md");
  return c.fixtures;
}
