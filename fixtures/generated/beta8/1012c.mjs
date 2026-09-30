import { beta8Corpus } from "./helpers.mjs";
import { gitlabRoutablePatValid } from "../../../benchmarks/lib/beta8/1012c.ts";
import { DIGITS, URLSAFE, authorPositives, guard, probeContexts, routablePatPayload, routableToken } from "./1012-shared.mjs";

// Issue #1012, slice c (category `beta8-1012c`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the routable GitLab personal access token (glpat- + base64url payload 27–300 + .01. + base36
// payload length + base36 CRC32); research redact-secret docs/audits/evidence/1012/gitlab-routable-personal-access-token.md
// at 4fb7882; product redact-secret#1022. Every value is built here: payloads are 16 synthetic bytes plus a synthetic
// o:/u: routing payload and its length byte, encoded as routable_token.rb does, then the base36 length holder and the
// base36 CRC32 are computed over the text; two positives take a synthetic base64url payload at the 27 and 300 bounds.
//
// The length holder and the CRC are provider offline checks (the contract's `validate`), so the checksum and
// length-holder twins are real twins. Not authored either way: the legacy glpat- + 20 value and glrt- runner tokens
// (other families' credentials, so neither a positive nor a benign control here), the unversioned routable form and
// instance or custom prefixes.

export function build1012c({ fixture, synthetic }) {
  const c = beta8Corpus("1012c", { fixture, synthetic });
  const T = "gitlab-routable-personal-access-token";
  const g = guard("1012c", T);
  const seed = slug => `beta12:1012c:${T}:${slug}`;
  const n = (slug, digits) => Number(synthetic(seed(`${slug}:n`), digits, DIGITS)) + 1;
  const payloadFor = slug => slug === "payload-27" ? synthetic(seed(slug), 27, URLSAFE)
    : slug === "payload-300" ? synthetic(seed(slug), 300, URLSAFE)
    : routablePatPayload(synthetic, seed(slug), { o: n(`${slug}:o`, 6), u: n(`${slug}:u`, 7) });
  const token = slug => {
    const value = routableToken("glpat-", payloadFor(slug));
    if (!gitlabRoutablePatValid(value)) throw new Error(`beta8-1012c: authored ${slug} fails the provider check`);
    return g.check(value);
  };

  const probe = probeContexts({ env: "GITLAB_TOKEN", name: "GitLab", host: "gitlab.com", ctor: "Gitlab" });
  const privateHeader = v => ["GET /api/v4/projects?membership=true HTTP/1.1\nHost: gitlab.com\nPRIVATE-TOKEN: ", v, "\n"];
  const remoteUrl = v => ["[remote \"origin\"]\n\turl = https://oauth2:", v, "@gitlab.com/acme/platform.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n"];
  const pyGitlab = v => ["import gitlab\n\ngl = gitlab.Gitlab(\"https://gitlab.com\", private_token=\"", v, "\")\n"];
  const glabConfig = v => ["hosts:\n  gitlab.com:\n    api_protocol: https\n    token: ", v, "\n"];
  const npmrc = v => ["@acme:registry=https://gitlab.com/api/v4/projects/4242/packages/npm/\n//gitlab.com/api/v4/projects/4242/packages/npm/:_authToken=", v, "\n"];
  const contexts = [...probe,
    { axis: "header", slug: "private-token-header", ext: "http", build: privateHeader },
    { axis: "url", slug: "git-remote-url", ext: "txt", build: remoteUrl },
    { axis: "sdk-config", slug: "python-gitlab", ext: "py", build: pyGitlab },
    { axis: "cli", slug: "payload-27", ext: "yml", build: glabConfig },
    { axis: "structured-file", slug: "payload-300", ext: "txt", build: npmrc },
  ];
  const K = authorPositives(c, T, contexts, token);

  // One-property twins. Each keeps every other byte; where a field changes, the CRC is recomputed unless the CRC itself is the mutation.
  const v = K.k.dotenv, crc = v.slice(-7);
  const badCrc = v.slice(0, -1) + (crc.endsWith("0") ? "1" : "0");
  c.twin(T, "dotenv", "checksum-mismatch", K.put("dotenv", g.refuse(badCrc)), "checksum: the last 7 base36 characters are not the CRC32 of the text before them (every other byte unchanged); GitLab's validator rejects it", "checksum", "env");
  const lenPayload = payloadFor("export");
  c.twin(T, "export", "length-holder-mismatch", K.put("export", g.refuse(routableToken("glpat-", lenPayload, { length: lenPayload.length + 1 }))), "length: the base36 payload-length holder claims one more character than the payload carries (CRC recomputed, so only the holder is wrong)", "length", "sh");
  c.twin(T, "json-token", "version-one-char", K.put("json-token", g.refuse(routableToken("glpat-", payloadFor("json-token"), { version: "1" }))), "length: a 1-character version field vs exactly 2 base36 characters (CRC recomputed)", "length", "json");
  const noDot = (() => { const p = payloadFor("json-api-key"); const t = routableToken("glpat-", p); return t.slice(0, 6 + p.length) + t.slice(7 + p.length); })();
  c.twin(T, "json-api-key", "missing-separator", K.put("json-api-key", g.refuse(noDot)), "boundary: the . between the payload and the version is missing", "boundary", "json");
  const up = K.k["sdk-kwarg"], tail = up.slice(-9), i = [...tail].findIndex(ch => /[a-z]/.test(ch));
  if (i < 0) throw new Error("beta8-1012c: sdk-kwarg tail has no base36 letter");
  c.twin(T, "sdk-kwarg", "uppercase-base36", K.put("sdk-kwarg", g.refuse(up.slice(0, -9) + tail.slice(0, i) + tail[i].toUpperCase() + tail.slice(i + 1))), "alphabet: one base36 letter in the length/checksum tail uppercased; GitLab's generator and its own rules emit [0-9a-z] only", "alphabet", "py");
  c.twin(T, "payload-27", "payload-26", K.put("payload-27", g.refuse(routableToken("glpat-", payloadFor("payload-27").slice(0, 26)))), "length: a 26-character payload vs the documented minimum 27 (length holder and CRC recomputed)", "length", "yml");
  c.twin(T, "bare-prose", "leading-glue", K.put("bare-prose", g.refuse(`x${K.k["bare-prose"]}`)), "boundary: x glued before glpat-", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-glue", K.put("chat-paste", g.refuse(`${K.k["chat-paste"]}x`)), "boundary: x glued after the 7-character CRC", "boundary", "txt");

  c.control(T, "public-id", "project-path", ["CI_PROJECT_PATH=acme/platform\nCI_PROJECT_ID=4242\nCI_PIPELINE_URL=https://gitlab.com/acme/platform/-/pipelines/918273\n"], "env");
  c.control(T, "public-id", "token-metadata", ["{\n  \"id\": 7731,\n  \"name\": \"release-bot\",\n  \"scopes\": [\"api\", \"read_repository\"],\n  \"expires_at\": \"2027-01-31\"\n}\n"], "json");
  c.control(T, "placeholder", "angle", ["GITLAB_TOKEN=<your-personal-access-token>\n"], "env");
  c.control(T, "placeholder", "masked", ["token: glpat-****\n"], "yml");
  c.control(T, "reference", "env-reference", ["git clone https://oauth2:${GITLAB_TOKEN}@gitlab.com/acme/platform.git\n"], "sh");
  c.control(T, "reference", "ci-job-token", ["curl --header \"JOB-TOKEN: $CI_JOB_TOKEN\" https://gitlab.com/api/v4/projects/4242/packages\n"], "sh");
  c.control(T, "near-miss", "truncated", [`2026-09-29T12:05:11Z api: rejected truncated token glpat-${synthetic(seed("short"), 12, URLSAFE)}\n`], "log");
  c.control(T, "encoded-value", "base64-url", [`CI_SERVER_URL_B64=${Buffer.from("https://gitlab.com/").toString("base64")}\n`], "env");
  c.control(T, "prose", "token-guidance", ["GitLab personal access tokens start with glpat-; new tokens are routable and end in a version, a length and a checksum.\n"], "md");
  return c.fixtures;
}
