import { createHash } from "node:crypto";
import { buildRegressions } from "./regressions.mjs";
import { buildDetectorCoverage } from "./detector-coverage.mjs";
import { buildClosedMilestone } from "./closed-milestone.mjs";
import { buildCommonFormats } from "./common-formats.mjs";
import { classifyFixture } from "../../benchmarks/lib/cohorts.mjs";

// Public, deterministic benchmark seed. These values were never provider-issued.
const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function synthetic(label, length, chars = alphabet) {
  let value = "";
  for (let block = 0; value.length < length; block++) {
    const bytes = createHash("sha256")
      .update(`secret-benchmark:never-issued:v2:${label}:${block}`)
      .digest();
    for (const byte of bytes) value += chars[byte % chars.length];
  }
  return value.slice(0, length);
}

export function fixture(id, group, parts, extension = "txt") {
  let content = "";
  const expected = [];
  for (const part of parts) {
    if (typeof part === "string") content += part;
    else {
      const start = Buffer.byteLength(content);
      content += part.secret;
      expected.push({
        start,
        end: Buffer.byteLength(content),
        note: "Locally constructed synthetic value; never issued by a provider.",
      });
    }
  }
  return { id, group, path: `cases/${id}.${extension}`, content, expected };
}

export function buildCorpora() {
  const shapes = [
    ...["ghp", "gho", "ghu", "ghs", "ghr"].map((prefix) => [
      prefix,
      `GitHub ${prefix}`,
      (seed) => `${prefix}_${synthetic(seed, 36)}`,
    ]),
    ["gitlab", "GitLab PAT", (seed) => `glpat-${synthetic(seed, 20)}`],
    [
      "npm",
      "npm token",
      (seed) =>
        `npm_${synthetic(seed, 36, "abcdefghijklmnopqrstuvwxyz0123456789")}`,
    ],
    [
      "sendgrid",
      "SendGrid key",
      (seed) =>
        `SG.${synthetic(seed + ":id", 22)}.${synthetic(seed + ":secret", 43)}`,
    ],
    [
      "slack",
      "Slack bot",
      (seed) =>
        `xoxb-${synthetic(seed + ":team", 12, "0123456789")}-${synthetic(seed + ":bot", 12, "0123456789")}-${synthetic(seed, 24)}`,
    ],
  ];
  const formats = shapes.flatMap(([id, group, make]) =>
    [1, 2, 3].map((sample) =>
      fixture(
        `${id}-${sample}`,
        group,
        [
          `${id.toUpperCase()}_TOKEN=`,
          { secret: make(`${id}:${sample}`) },
          "\n",
        ],
        "env",
      ),
    ),
  );
  const secret = { secret: `ghp_${synthetic("context-primary", 36)}` };
  const other = { secret: `ghp_${synthetic("context-secondary", 36)}` };
  const contexts = [
    ["bare", "Boundaries", [secret]],
    ["no-final-newline", "Boundaries", ["GITHUB_TOKEN=", secret]],
    ["single-quotes", "Quoting", ["GITHUB_TOKEN='", secret, "'\n"]],
    ["double-quotes", "Quoting", ['GITHUB_TOKEN="', secret, '"\n']],
    ["json", "Structured text", ['{"github_token":"', secret, '"}\n'], "json"],
    ["yaml", "Structured text", ['github_token: "', secret, '"\n'], "yaml"],
    ["toml", "Structured text", ['github_token = "', secret, '"\n'], "toml"],
    [
      "javascript",
      "Source code",
      ['const githubToken = "', secret, '";\n'],
      "js",
    ],
    ["python", "Source code", ["github_token = '", secret, "'\n"], "py"],
    ["markdown", "Documentation", ["GitHub token: `", secret, "`\n"], "md"],
    ["comment", "Documentation", ["# github token: ", secret, "\n"]],
    ["unicode", "Encoding", ["🔑 密钥 café GITHUB_TOKEN=", secret, "\n"]],
    ["combining-mark", "Encoding", ["e\u0301 GITHUB_TOKEN=", secret, "\n"]],
    ["bom", "Encoding", ["\ufeffGITHUB_TOKEN=", secret, "\n"]],
    ["crlf", "Line endings", ["# config\r\nGITHUB_TOKEN=", secret, "\r\n"]],
    ["blank-lines", "Line endings", ["\n\n\nGITHUB_TOKEN=", secret, "\n"]],
    [
      "two-secrets",
      "Multiple spans",
      ["GITHUB_TOKEN=", secret, "\nGITHUB_TOKEN=", other, "\n"],
    ],
    [
      "repeated-lines",
      "Multiple spans",
      ["GITHUB_TOKEN=", secret, "\nGITHUB_TOKEN=", secret, "\n"],
    ],
    [
      "same-line-distinct",
      "Multiple spans",
      ['github_tokens=["', secret, '","', other, '"]\n'],
    ],
    [
      "long-prefix",
      "Long input",
      ["# " + "benign text ".repeat(6000) + "\nGITHUB_TOKEN=", secret, "\n"],
    ],
  ].map(([id, group, parts, ext]) => fixture(id, group, parts, ext));
  const negatives = [
    ["empty", "Empty inputs", ""],
    ["whitespace", "Empty inputs", " \t\r\n\n"],
    ["empty-assignment", "Placeholders", "GITHUB_TOKEN=\n"],
    ["shell-reference", "Placeholders", "GITHUB_TOKEN=${GITHUB_TOKEN}\n"],
    [
      "template-reference",
      "Placeholders",
      "github_token: {{ secrets.github_token }}\n",
    ],
    ["redacted", "Placeholders", "GITHUB_TOKEN=[REDACTED]\n"],
    ["masked", "Placeholders", "GITHUB_TOKEN=********\n"],
    ["null-json", "Placeholders", '{"github_token":null}\n'],
    [
      "sha256",
      "Public identifiers",
      `checksum=${synthetic("checksum", 64, "0123456789abcdef")}\n`,
    ],
    [
      "commit-hash",
      "Public identifiers",
      `commit=${synthetic("commit", 40, "0123456789abcdef")}\n`,
    ],
    [
      "uuid",
      "Public identifiers",
      "request_id=85a3b910-b847-4ec7-8fb3-7ce4f7235c10\n",
    ],
    [
      "public-url",
      "Public identifiers",
      "https://example.invalid/docs?section=authentication\n",
    ],
    ["public-email", "Public identifiers", "support@example.invalid\n"],
    [
      "base64-text",
      "Benign encoded text",
      `message=${Buffer.from("This is a public benchmark document.").toString("base64")}\n`,
    ],
    [
      "unicode-prose",
      "Ordinary text",
      "🔑 密钥 means key; this sentence contains no credential.\n",
    ],
    [
      "token-variable",
      "Ordinary text",
      "const githubToken = process.env.GITHUB_TOKEN;\n",
    ],
    [
      "prefix-only",
      "Incomplete shapes",
      "ghp_ gho_ ghu_ ghs_ ghr_ glpat- npm_ SG. xoxb-\n",
    ],
    ["short-github", "Incomplete shapes", "GITHUB_TOKEN=ghp_abc123\n"],
    ["short-gitlab", "Incomplete shapes", "GITLAB_TOKEN=glpat-abc123\n"],
    ["short-npm", "Incomplete shapes", "NPM_TOKEN=npm_abc123\n"],
    ["short-sendgrid", "Incomplete shapes", "SENDGRID_KEY=SG.abc.def\n"],
    ["short-slack", "Incomplete shapes", "SLACK_TOKEN=xoxb-123-456-abc\n"],
    [
      "numbers",
      "Ordinary text",
      "build=20260916 duration=1234567890 count=42\n",
    ],
    [
      "pem-label-only",
      "Incomplete shapes",
      "The PEM label is BEGIN PRIVATE KEY; no key material follows.\n",
    ],
  ].map(([id, group, text]) => fixture(id, group, [text]));
  const wrap = (fixtures) => ({
    schemaVersion: 1,
    reviewStatus: "draft — independent human review required",
    provenance:
      "Generated by fixtures/generated/build.mjs from public deterministic SHA-256 seeds; all credential-shaped values are synthetic and never provider-issued. Ground truth comes from construction, not scanner output. No live verification.",
    fixtures,
  });
  const corpora = {
    "credential-formats": wrap(formats),
    "context-edges": wrap(contexts),
    "negative-controls": wrap(negatives),
    ...buildRegressions({ fixture, synthetic, wrap }),
    ...buildClosedMilestone({ fixture, synthetic, wrap }),
    ...buildDetectorCoverage({ fixture, synthetic, wrap }),
    ...buildCommonFormats({ fixture, synthetic, wrap }),
  };
  for (const [category, corpus] of Object.entries(corpora))
    for (const f of corpus.fixtures) f.assessment = classifyFixture(category, f);
  return corpora;
}
