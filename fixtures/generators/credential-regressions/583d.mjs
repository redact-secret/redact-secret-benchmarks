import { beta8Corpus } from "./helpers.mjs";
import { authorPositives, guard, probeContexts, HEX, LOWER } from "./528-shared.mjs";

// Issue #583, slice d (category `beta8-583d`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Unkey root key (detector `unkey-root-key`; handoff redact-secret docs/audits/evidence/1014/unkey.md at
// 3b1a5aa; product redact-secret#1104): version 1 `unkey_` + 8 + `unkeyv1` + 42 base58 (the last six a real CRC-32C) and the
// dashboard `unkey_3Z` + 22 base58. Every value is built here from a public `synthetic` seed over the Bitcoin base58 alphabet,
// with the checksum computed by the CRC-32C below; nothing is copied from a provider example, a scanner vector or an issued key,
// and no complete key-shaped literal appears in this file.
//
// Unclaimed shapes (checksum mismatch, Q1; customer-prefixed version 1, Q10; the Go 21/22 form) are authored as twins that
// satisfy the lexical contract or sit outside it without a source: they are listed in
// benchmarks/evaluation/domains/credential/assessment.ts DISPUTED_PROPERTIES and score T0. Asserted twins differ from a
// positive by one lexical property.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** CRC-32C (Castagnoli, reflected polynomial 0x82F63B78) of a latin1 string, unsigned. */
const CRC32C_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32c(text) {
  let c = 0xffffffff;
  for (const byte of Buffer.from(text, "latin1")) c = CRC32C_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** The version 1 checksum: CRC-32C of the key before it, as a big-endian unsigned integer in base58, left-padded with 1 to 6. */
export function unkeyChecksum(unsigned) {
  let n = BigInt(crc32c(unsigned)), out = "";
  do { out = B58[Number(n % 58n)] + out; n /= 58n; } while (n > 0n);
  return out.padStart(6, "1");
}
const other = ch => B58[(B58.indexOf(ch) + 1) % B58.length];
const swapAt = (s, i, ch) => s.slice(0, i) + ch + s.slice(i + 1);

export function build583d({ fixture, synthetic }) {
  const c = beta8Corpus("583d", { fixture, synthetic });
  const T = "unkey-root-key";
  const seed = slug => `beta14:583d:${T}:${slug}`;
  const body = (slug, n, alphabet = B58) => synthetic(seed(slug), n, alphabet);
  const { check, refuse } = guard("583d", T);

  // Version 1: unkey_ + head[8] + unkeyv1 + random[36] + checksum[6]; the checksum covers the whole key before it.
  const v1Parts = (slug, valid = true) => {
    const head = body(`head:${slug}`, 8), rest = body(`rest:${slug}`, 36);
    const unsigned = `unkey_${head}unkeyv1${rest}`;
    const sum = unkeyChecksum(unsigned);
    return { head, rest, sum: valid ? sum : swapAt(sum, 5, other(sum[5])) };
  };
  const v1 = (slug, valid = true) => { const p = v1Parts(slug, valid); return `unkey_${p.head}unkeyv1${p.rest}${p.sum}`; };
  // Dashboard form: unkey_3Z + 22 base58, the third character between F and o in alphabet order (handoff derivation).
  const dash = slug => {
    let b = body(`dash:${slug}`, 22);
    if (!(b[0] >= "F" && b[0] <= "o")) b = swapAt(b, 0, "Q");
    return `unkey_3Z${b}`;
  };

  const DASH = new Set(["dashboard-dotenv", "dashboard-bearer", "dashboard-ts-sdk", "dashboard-json", "json-api-key"]);
  const key = slug => check(DASH.has(slug) ? dash(slug) : v1(slug));

  const probe = probeContexts({ env: "UNKEY_ROOT_KEY", name: "Unkey", host: "api.unkey.com", ctor: "Unkey" });
  const tsSdk = v => ["import { Unkey } from \"@unkey/api\";\n\nconst unkey = new Unkey({ rootKey: \"", v, "\" });\n"];
  const bearerCurl = v => ["curl -s -X POST https://api.unkey.com/v2/keys.createKey -H \"Authorization: Bearer ", v, "\" -H \"Content-Type: application/json\" -d '{\"apiId\":\"api_demo\"}'\n"];
  const actions = v => ["jobs:\n  provision:\n    steps:\n      - run: ./mint-keys.sh\n        env:\n          UNKEY_ROOT_KEY: ", v, "\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"unkey\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@unkey/mcp\"],\n      \"env\": { \"UNKEY_ROOT_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const docker = v => ["docker run --rm -e UNKEY_ROOT_KEY=", v, " key-provisioner:latest\n"];
  const dashEnv = v => ["# .env.local (key created in the dashboard)\nUNKEY_ROOT_KEY=", v, "\nUNKEY_API_ID=api_demo\n"];
  const dashBearer = v => ["POST /v2/apis.listKeys HTTP/1.1\nHost: api.unkey.com\nAuthorization: Bearer ", v, "\nContent-Type: application/json\n"];
  const dashTs = v => ["import { Unkey } from \"@unkey/api\";\n\nexport const unkey = new Unkey({ rootKey: \"", v, "\" });\n"];
  const dashJson = v => ["{\n  \"rootKey\": \"", v, "\",\n  \"apiId\": \"api_demo\"\n}\n"];
  const contexts = [...probe,
    { axis: "sdk-config", slug: "ts-sdk", ext: "ts", build: tsSdk },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: bearerCurl },
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "container-config", slug: "docker-env", ext: "sh", build: docker },
    { axis: "env", slug: "dashboard-dotenv", ext: "env", build: dashEnv },
    { axis: "header", slug: "dashboard-bearer", ext: "http", build: dashBearer },
    { axis: "sdk-config", slug: "dashboard-ts-sdk", ext: "ts", build: dashTs },
    { axis: "structured-file", slug: "dashboard-json", ext: "json", build: dashJson },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const tw = (slug, name, value, mutation, kind, ext) => c.twin(T, slug, name, put(slug, refuse(value)), mutation, kind, ext);
  const loose = (slug, name, value, mutation, kind, ext) => c.twin(T, slug, name, put(slug, value), mutation, kind, ext);

  // ---------------------------------------------------------------- asserted twins, version 1 (one property each)
  const p = slug => v1Parts(slug);
  const join = (q, { head = q.head, marker = "unkeyv1", rest = q.rest, sum = q.sum } = {}) => `unkey_${head}${marker}${rest}${sum}`;
  { const q = p("dotenv"); tw("dotenv", "uppercase-prefix", `UNKEY_${q.head}unkeyv1${q.rest}${q.sum}`, "prefix: uppercase UNKEY_ vs the case-sensitive unkey_", "prefix", "env"); }
  { const q = p("bearer-header"); tw("bearer-header", "marker-v2", join(q, { marker: "unkeyv2" }), "marker: unkeyv2 in place of unkeyv1", "prefix", "http"); }
  { const q = p("export"); tw("export", "marker-offset-9", `unkey_${q.head}${q.rest[0]}unkeyv1${q.rest.slice(1)}${q.sum}`, "marker offset: unkeyv1 at body offset 9 instead of 8, total width kept", "prefix", "sh"); }
  { const q = p("json-token"); tw("json-token", "marker-offset-7", `unkey_${q.head.slice(0, 7)}unkeyv1${q.head[7]}${q.rest}${q.sum}`, "marker offset: unkeyv1 at body offset 7 instead of 8, total width kept", "prefix", "json"); }
  { const q = p("sdk-kwarg"); tw("sdk-kwarg", "body-56", join(q, { rest: q.rest.slice(0, 35) }), "width: 41 after the marker (56 in the body) instead of 42", "length", "py"); }
  { const q = p("ts-sdk"); tw("ts-sdk", "body-58", `${join(q)}${body("extra:58", 1)}`, "width: 43 after the marker (58 in the body) instead of 42", "length", "ts"); }
  { const q = p("x-api-key-header"); tw("x-api-key-header", "zero-in-head", join(q, { head: swapAt(q.head, 3, "0") }), "alphabet: a 0 in the random head, outside base58", "alphabet", "http"); }
  { const q = p("curl-bearer"); tw("curl-bearer", "capital-o-in-tail", join(q, { rest: swapAt(q.rest, 17, "O") }), "alphabet: a capital O in the random tail, outside base58", "alphabet", "sh"); }
  { const q = p("actions-env"); tw("actions-env", "capital-i-in-head", join(q, { head: swapAt(q.head, 6, "I") }), "alphabet: a capital I in the random head, outside base58", "alphabet", "yml"); }
  { const q = p("mcp-env"); tw("mcp-env", "lowercase-l-in-tail", join(q, { rest: swapAt(q.rest, 30, "l") }), "alphabet: a lowercase l in the random tail, outside base58", "alphabet", "json"); }
  { const q = p("docker-env"); tw("docker-env", "underscore-in-checksum", join(q, { sum: swapAt(q.sum, 2, "_") }), "alphabet: an underscore inside the checksum characters, outside base58", "alphabet", "sh"); }
  tw("bare-prose", "leading-glue", `x${k["bare-prose"]}`, "boundary: x glued before unkey_", "boundary", "md");
  tw("chat-paste", "trailing-glue", `${k["chat-paste"]}x`, "boundary: x glued after the key", "boundary", "txt");

  // ---------------------------------------------------------------- asserted twins, dashboard form
  tw("dashboard-dotenv", "lead-3y", `unkey_3Y${k["dashboard-dotenv"].slice(8)}`, "lead: 3Y in place of the fixed 3Z lead", "prefix", "env");
  tw("dashboard-bearer", "trailing-21", `unkey_3Z${body("dash:t21", 21)}`, "width: 21 after 3Z instead of 22", "length", "http");
  tw("dashboard-ts-sdk", "trailing-23", `unkey_3Z${body("dash:t23", 23)}`, "width: 23 after 3Z instead of 22", "length", "ts");
  tw("dashboard-json", "zero-in-body", `unkey_3Z${swapAt(k["dashboard-json"].slice(8), 9, "0")}`, "alphabet: a 0 in the random part, outside base58", "alphabet", "json");
  tw("dashboard-dotenv", "underscore-in-body", `unkey_3Z${swapAt(k["dashboard-dotenv"].slice(8), 12, "_")}`, "alphabet: an underscore in the random part, outside base58", "alphabet", "env");
  tw("json-api-key", "dashboard-leading-glue", `x${k["json-api-key"]}`, "boundary: x glued before the dashboard-form key", "boundary", "json");

  // ---------------------------------------------------------------- unclaimed shapes (T0 via DISPUTED_PROPERTIES)
  loose("bearer-header", "checksum-mismatch-bearer", v1("checksum-mismatch:bearer", false), "checksum: the last character changed so the CRC-32C does not verify; whether a post-check rejects it is ruling Q1 (open), unclaimed", "checksum", "http");
  loose("json-token", "checksum-mismatch-json", v1("checksum-mismatch:json", false), "checksum: the CRC-32C does not verify; unclaimed (Q1)", "checksum", "json");
  loose("dotenv", "customer-prefixed-v1", (() => { const q = p("customer"); return `acme_${q.head}unkeyv1${q.rest}${q.sum}`; })(), "prefix: a customer-chosen acme_ prefix on a version 1 key; a customer product key, unclaimed pending ruling Q10", "prefix", "env");
  loose("export", "go-form-22", `unkey_${body("go:22", 22)}`, "shape: unkey_ + 22 base58 without the 3Z lead, the deprecated Go CreateKey form; unclaimed (not a shipped root-key shape)", "length", "sh");
  loose("curl-bearer", "go-form-21", `unkey_${body("go:21", 21)}`, "shape: unkey_ + 21 base58 without the 3Z lead, the deprecated Go CreateKey form; unclaimed", "length", "sh");

  // ---------------------------------------------------------------- benign, context-confusion, placeholder, reference and public-id controls
  c.control(T, "near-miss", "identifier-root-key", ["const table = \"unkey_root_key\";\nconst other = \"unkey_mutations\";\nconst scope = \"unkey_api_id\";\n"], "ts");
  c.control(T, "near-miss", "lowercase-run", [`unkey_${body("ctl:lower24", 24, LOWER)} is a generated label, not a credential\n`], "txt");
  c.control(T, "near-miss", "marker-prose", ["Version 1 Unkey keys carry the unkeyv1 marker after eight random characters; no key is printed here.\n"], "md");
  c.control(T, "near-miss", "prefix-only", ["Unkey root keys all start with unkey_ and are shown once at creation.\n"], "md");
  c.control(T, "encoded-value", "sha256-digest", [`artifact digest sha256:${body("ctl:digest", 64, HEX)}\n`], "txt");
  c.control(T, "public-id", "key-id", [`key_${body("ctl:keyid", 16)} was revoked at 2026-10-01T09:12:03Z\n`], "log");
  c.control(T, "public-id", "api-id", [`{ "apiId": "api_${body("ctl:apiid", 16)}", "name": "billing" }\n`], "json");
  c.control(T, "placeholder", "x-run", ["UNKEY_ROOT_KEY=unkey_xxxxxxxxxxxxxxxxxxxxxxxx\n"], "env");
  c.control(T, "placeholder", "angle-brackets", ["export UNKEY_ROOT_KEY=\"unkey_<your-root-key>\"\n"], "sh");
  c.control(T, "reference", "env-reference", ["UNKEY_ROOT_KEY=${UNKEY_ROOT_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          UNKEY_ROOT_KEY: ${{ secrets.UNKEY_ROOT_KEY }}\n"], "yml");
  c.control(T, "reference", "process-env", ["const unkey = new Unkey({ rootKey: process.env.UNKEY_ROOT_KEY });\n"], "ts");
  c.control(T, "prose", "key-guidance", ["An Unkey root key can create and revoke keys for a workspace; keep it in a secret store and rotate it if it leaks.\n"], "md");
  return c.fixtures;
}
