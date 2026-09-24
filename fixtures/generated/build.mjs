import { createHash } from "node:crypto";
import { buildRegressions } from "./regressions.mjs";
import { buildDetectorCoverage, documentedTwins } from "./detector-coverage.mjs";
import { buildClosedMilestone } from "./closed-milestone.mjs";
import { buildCommonFormats } from "./common-formats.mjs";
import { buildContextFamilies } from "./context-families.mjs";
import { buildBeta8 } from "./beta8/index.mjs";
import { classifyFixture } from "../../benchmarks/lib/assessment.ts";

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

// Parts: literal strings, `{ secret }` spans, or `{ secret, envelope: { before, after, reason } }`
// where `before`/`after` are emitted around the secret and the authored
// envelope covers all three. Envelopes are written from construction, never
// widened in response to scanner output (docs/specs/measurement-v4.md §2.2).
export function fixture(id, group, parts, extension = "txt") {
  let content = "";
  const expected = [];
  for (const part of parts) {
    if (typeof part === "string") content += part;
    else {
      const envelope = part.envelope;
      const outer = Buffer.byteLength(content);
      if (envelope) content += envelope.before;
      const start = Buffer.byteLength(content);
      content += part.secret;
      const end = Buffer.byteLength(content);
      if (envelope) content += envelope.after;
      expected.push({
        start,
        end,
        role: "secret",
        note: "Locally constructed synthetic value; never issued by a provider.",
        ...(envelope ? { envelope: { start: outer, end: Buffer.byteLength(content), reason: envelope.reason } } : {}),
      });
    }
  }
  return { id, group, path: `cases/${id}.${extension}`, content, expected };
}

export const ENVELOPES = {
  uri: "URI scheme, user and host are not secret, but redacting the whole connection URI is acceptable; only the password must be covered.",
  otp: "The otpauth label and issuer are not secret, but redacting the whole URI is acceptable; only the seed must be covered.",
  bearer: "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.",
  quoted: "Quoted assignment: key name and enclosing quotes are not secret, but redacting them with the value is acceptable.",
};
/** Secret inside a `key="value"` assignment: the assignment is the envelope. */
export const quoted = (key, secret, quote = '"') => ({ secret, envelope: { before: `${key}${quote}`, after: quote, reason: ENVELOPES.quoted } });
/** Password inside `scheme://user:password@host/db`: the URI is the envelope. */
export const uri = (before, secret, after) => ({ secret, envelope: { before, after, reason: ENVELOPES.uri } });

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
  // Negative twins (§2.5): one character shorter than the contracted/tool-
  // corroborated body, holding the surrounding `<ID>_TOKEN=` assignment fixed.
  const formatTwinFamilies = {
    ghp: ["github-token", "length: 35 vs contracted 36"],
    gho: ["github-token", "length: 35 vs contracted 36"],
    ghu: ["github-token", "length: 35 vs contracted 36"],
    gitlab: ["gitlab-token", "length: 19 vs contracted 20"],
    sendgrid: ["sendgrid-token", "length: 42 vs contracted 43"],
  };
  const formatTwins = shapes
    .filter(([id]) => id in formatTwinFamilies)
    .flatMap(([id, group, make]) => {
      const [family, mutation] = formatTwinFamilies[id];
      return [1, 2, 3].map((sample) => ({
        ...fixture(
          `${id}-${sample}-twin`,
          group,
          [`${id.toUpperCase()}_TOKEN=`, make(`${id}:${sample}`).slice(0, -1), "\n"],
          "env",
        ),
        detectors: [family],
        twinOf: `${id}-${sample}`,
        mutation,
        mutationKind: "length",
      }));
    });
  const secret = { secret: `ghp_${synthetic("context-primary", 36)}` };
  const other = { secret: `ghp_${synthetic("context-secondary", 36)}` };
  const contextDefs = [
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
  ];
  const contexts = contextDefs.map(([id, group, parts, ext]) => fixture(id, group, parts, ext));
  // Negative twins (§2.5): every single-secret context gets a paired control
  // whose github-token body is one character shorter than the contracted 36,
  // holding the surrounding context byte-for-byte constant.
  const contextTwinValue = `ghp_${synthetic("context-primary", 36).slice(0, -1)}`;
  const contextTwins = contextDefs
    .filter(([id]) => !["two-secrets", "repeated-lines", "same-line-distinct"].includes(id))
    .map(([id, group, parts, ext]) => ({
      ...fixture(`${id}-twin`, group, parts.map(p => (p === secret ? contextTwinValue : p)), ext),
      detectors: ["github-token"],
      twinOf: id,
      mutation: "length: 35 vs contracted 36",
      mutationKind: "length",
    }));
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
    schemaVersion: 2,
    reviewStatus: "draft — independent human review required",
    provenance:
      "Generated by fixtures/generated/build.mjs from public deterministic SHA-256 seeds; all credential-shaped values are synthetic and never provider-issued. Ground truth comes from construction, not scanner output. No live verification.",
    fixtures,
  });
  const corpora = {
    "credential-formats": wrap([...formats, ...formatTwins]),
    "context-edges": wrap([...contexts, ...contextTwins, ...buildContextFamilies({ fixture, synthetic }, documentedTwins)]),
    "negative-controls": wrap(negatives),
    ...buildRegressions({ fixture, synthetic, wrap, quoted }),
    ...buildClosedMilestone({ fixture, synthetic, wrap, quoted, uri }),
    ...buildDetectorCoverage({ fixture, synthetic, wrap, quoted, uri, ENVELOPES }),
    ...buildCommonFormats({ fixture, synthetic, wrap }),
    ...buildBeta8({ fixture, synthetic, wrap }),
  };
  for (const [category, corpus] of Object.entries(corpora))
    for (const f of corpus.fixtures) f.assessment = classifyFixture(category, f);
  return corpora;
}
