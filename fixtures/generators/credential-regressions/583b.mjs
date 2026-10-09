import { crc32 } from "node:zlib";
import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, DIGITS, HEX, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #583, slice b (category `beta8-583b`). See docs/specs/beta8-evidence.md.
//
// Beta.14 corpus for the Xata API key: `xau_` (user) or `xao_` (organization) + the bit-packed base62 of 20 random bytes and
// their little-endian CRC32 (handoff redact-secret docs/audits/evidence/1014/xata.md at 3b1a5aa; product redact-secret#1102;
// provider code xataio/xata internal/api/key/key.go at fc4ac97 and the jxskiss/base62 encoder it calls). Every value is built
// here at generation time: the 20 random bytes come from a public `synthetic` seed, the CRC32 and the bit-packed base62 are
// computed by a port of the provider's generator, and the result is round-tripped through a port of its decoder. Nothing is
// copied from a provider example, a scanner test vector or an issued key, and no complete key-shaped literal appears in
// this file.
//
// The CRC32 is policy (ruling Q1), so the CRC-mismatch twins are UNCLAIMED (benchmarks/evaluation/domains/credential/
// assessment.ts DISPUTED_PROPERTIES, scored T0). Bodies of 35 and 36 characters cannot be reached by a real key (probability
// below 1e-7), so those two positives are lexical-only values with no valid checksum.

const B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Port of jxskiss/base62 encodeV2: read the byte string from the end in 6-bit groups; a group whose low five bits are 11110 or 11111 is emitted as 5 bits. */
function base62Encode(src) {
  let pos = src.length * 8, out = "";
  while (pos > 0) {
    let size = 6;
    const r0 = pos & 7;
    let i = pos >> 3, r = r0;
    if (r === 0) { i -= 1; r = 8; }
    let b = src[i] >> (8 - r);
    if (r < 6 && i > 0) b |= src[i - 1] << r;
    b &= 0x3f;
    if ((b & 0x1e) === 0x1e) {
      if (pos > 6 || b > 0x1f) size = 5;
      b &= 0x1f;
    }
    out += B62[b];
    pos -= size;
  }
  return out;
}

/** Port of the matching decoder (first character is the least significant group). */
function base62Decode(text) {
  const dst = new Array(Math.floor(text.length * 6 / 8) + 1).fill(0);
  let idx = dst.length, pos = 0, acc = 0;
  for (let i = 0; i < text.length; i++) {
    const x = B62.indexOf(text[i]);
    if (x < 0) return null;
    if (i === text.length - 1) { acc |= x << pos; pos += x === 0 ? 0 : 32 - Math.clz32(x); }
    else if ((x & 0x1e) === 0x1e) { acc |= x << pos; pos += 5; }
    else { acc |= x << pos; pos += 6; }
    if (pos >= 8) { idx--; dst[idx] = acc & 0xff; pos %= 8; acc >>= 8; }
  }
  if (pos > 0) { idx--; dst[idx] = acc & 0xff; }
  return Buffer.from(dst.slice(idx));
}

const crcLE = bytes => { const b = Buffer.alloc(4); b.writeUInt32LE(crc32(Buffer.from(bytes)) >>> 0); return b; };
const encodeKeyBody = (random20, crc4) => base62Encode(Buffer.concat([Buffer.from(random20), crc4]));
/** True when the body decodes and its trailing little-endian CRC32 matches the bytes before it (the provider's IsValid, minus the length cap). */
function crcVerifies(body) {
  const d = base62Decode(body);
  return !!d && d.length >= 4 && d.subarray(d.length - 4).equals(crcLE(d.subarray(0, d.length - 4)));
}

/** A genuine-shaped body of exactly `width` characters: search deterministic seeds for 20 random bytes whose encoding has that width. */
function realBody(synthetic, seed, width) {
  for (let n = 0; n < 200000; n++) {
    const random = Buffer.from(synthetic(`${seed}:${n}`, 40, HEX), "hex");
    const body = encodeKeyBody(random, crcLE(random));
    if (body.length !== width) continue;
    if (!crcVerifies(body)) throw new Error(`beta8-583b: port round trip failed for width ${width}`);
    return { body, random };
  }
  throw new Error(`beta8-583b: no 20-byte input encodes to width ${width}`);
}

export function build583b({ fixture, synthetic }) {
  const c = beta8Corpus("583b", { fixture, synthetic });
  const T = "xata-api-key";
  const seed = slug => `beta14:583b:${T}:${slug}`;
  const { check, refuse } = guard("583b", T);

  // Body width and prefix per positive context; widths 35 and 36 are lexical-only (no real key reaches them).
  const WIDTH = { "bare-prose": 33, dotenv: 33, export: 32, "bearer-header": 34, "x-api-key-header": 33, "json-token": 33, "json-api-key": 33,
    "sdk-kwarg": 32, "chat-paste": 33, "mcp-env": 33, "curl-bearer": 33, "actions-env": 32, "docker-env": 33, "node-sdk-client": 33,
    "dotenv-org": 33, "k8s-secret": 36, "toml-config": 35 };
  const ORG = new Set(["mcp-env", "actions-env", "dotenv-org", "k8s-secret"]);
  const prefixOf = slug => ORG.has(slug) ? "xao_" : "xau_";
  const bodyOf = slug => {
    const w = WIDTH[slug];
    return w >= 35 ? synthetic(seed(`lexical:${slug}`), w, ALNUM) : realBody(synthetic, seed(`body:${slug}`), w).body;
  };
  const key = slug => check(`${prefixOf(slug)}${bodyOf(slug)}`);

  const probe = probeContexts({ env: "XATA_API_KEY", name: "Xata", host: "api.xata.io", ctor: "XataClient" });
  const nodeSdk = v => ["import { XataClient } from \"./xata\";\n\nconst xata = new XataClient({ apiKey: \"", v, "\", branch: \"main\" });\n"];
  const mcp = v => ["{\n  \"mcpServers\": {\n    \"xata\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@xata.io/mcp\"],\n      \"env\": { \"XATA_API_KEY\": \"", v, "\" }\n    }\n  }\n}\n"];
  const curl = v => ["curl -s https://api.xata.io/organizations -H \"Authorization: Bearer ", v, "\"\n"];
  const actions = v => ["jobs:\n  migrate:\n    steps:\n      - run: ./run-migrations.sh\n        env:\n          XATA_API_KEY: ", v, "\n"];
  const docker = v => ["docker run --rm -e XATA_API_KEY=", v, " branch-preview:latest\n"];
  const dotenvOrg = v => ["# .env.production (organization key)\nXATA_ORGANIZATION_API_KEY=", v, "\nNODE_ENV=production\n"];
  const k8s = v => ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: xata-credentials\nstringData:\n  XATA_API_KEY: ", v, "\n"];
  const toml = v => ["[xata]\nregion = \"us-east-1\"\napi_key = \"", v, "\"\n"];
  const contexts = [...probe,
    { axis: "sdk-config", slug: "node-sdk-client", ext: "ts", build: nodeSdk },
    { axis: "tool-output", slug: "mcp-env", ext: "json", build: mcp },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "container-config", slug: "docker-env", ext: "sh", build: docker },
    { axis: "env", slug: "dotenv-org", ext: "env", build: dotenvOrg },
    { axis: "container-config", slug: "k8s-secret", ext: "yml", build: k8s },
    { axis: "structured-file", slug: "toml-config", ext: "toml", build: toml },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);

  // Asserted twins: one property each (prefix, separator, alphabet, length, boundary), over a positive's own context.
  const body = slug => bodyOf(slug);
  c.twin(T, "dotenv", "uppercase-prefix", put("dotenv", refuse(`XAU_${body("dotenv")}`)), "prefix: uppercase XAU_ vs the case-sensitive xau_", "prefix", "env");
  c.twin(T, "bearer-header", "xat-prefix", put("bearer-header", refuse(`xat_${body("bearer-header")}`)), "prefix: xat_ vs the generated xau_ and xao_", "prefix", "http");
  c.twin(T, "export", "hyphen-separator", put("export", refuse(`xau-${body("export")}`)), "separator: - in place of the _ after xau", "prefix", "sh");
  c.twin(T, "json-token", "hyphen-in-body", put("json-token", refuse(`xau_${at(body("json-token"), 14, "-")}`)), "alphabet: one body byte replaced by -, outside [0-9A-Za-z]", "alphabet", "json");
  c.twin(T, "json-api-key", "underscore-in-body", put("json-api-key", refuse(`xau_${at(body("json-api-key"), 21, "_")}`)), "alphabet: one body byte replaced by _; a second underscore fails the provider's one-underscore rule", "alphabet", "json");
  c.twin(T, "sdk-kwarg", "plus-in-body", put("sdk-kwarg", refuse(`xau_${at(body("sdk-kwarg"), 9, "+")}`)), "alphabet: one body byte replaced by +, outside [0-9A-Za-z]", "alphabet", "py");
  c.twin(T, "x-api-key-header", "body-31", put("x-api-key-header", refuse(`xau_${synthetic(seed("w31"), 31, ALNUM)}`)), "length: 31 after xau_, below the 32-character minimum a 24-byte input encodes to", "length", "http");
  c.twin(T, "chat-paste", "body-37", put("chat-paste", refuse(`xau_${synthetic(seed("w37"), 37, ALNUM)}`)), "length: 37 after xau_ (41 in all), past the provider's 40-character cap", "length", "txt");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`ma${k["bare-prose"]}`)), "boundary: ma glued before xau_, so the run does not start at the prefix (maxau_…)", "boundary", "md");
  c.twin(T, "mcp-env", "trailing-underscore-glue", put("mcp-env", refuse(`${k["mcp-env"]}_x`)), "boundary: _x glued after the body, so the run continues past the key", "boundary", "json");
  c.twin(T, "curl-bearer", "trailing-hyphen-glue", put("curl-bearer", refuse(`${k["curl-bearer"]}-`)), "boundary: a hyphen glued after the body", "boundary", "sh");

  // Unclaimed (ruling Q1: a checksum post-check is deferred). T0 via DISPUTED_PROPERTIES: a lexically valid key whose CRC32 does not verify.
  {
    const slug = "docker-env";
    const real = realBody(synthetic, seed(`body:${slug}`), WIDTH[slug]);
    const mismatch = (random, crc4, target) => {
      for (let n = 0; n < 5000; n++) {
        const r = Buffer.from(random), cc = Buffer.from(crc4);
        if (target === "data") { r[n % 20] ^= 1 << (n % 8); } else { cc[n % 4] ^= 1 << ((n >> 2) % 8); }
        const b = encodeKeyBody(r, cc);
        if (b.length >= 32 && b.length <= 36 && !crcVerifies(b)) return b;
      }
      throw new Error("beta8-583b: no checksum-mismatch body found");
    };
    c.twin(T, slug, "crc-data-byte", put(slug, `xau_${mismatch(real.random, crcLE(real.random), "data")}`), "checksum: one random-data bit flipped after the CRC32 was computed, so the stored CRC32 no longer verifies; unclaimed (ruling Q1)", "checksum", "sh");
    c.twin(T, "actions-env", "crc-stored-byte", put("actions-env", `xao_${mismatch(realBody(synthetic, seed("body:actions-env"), WIDTH["actions-env"]).random, crcLE(realBody(synthetic, seed("body:actions-env"), WIDTH["actions-env"]).random), "crc")}`), "checksum: one bit of the stored CRC32 flipped, so it no longer matches the random bytes; unclaimed (ruling Q1)", "checksum", "yml");
  }

  // Benign and context-confusion controls. None sits under a credential-named variable except where the value is a
  // reference or an obvious placeholder.
  c.control(T, "near-miss", "prefix-only", ["Xata user keys start with xau_ and organization keys with xao_; the rest of the value is never printed.\n"], "md");
  c.control(T, "near-miss", "snake-case-identifier", ["const xau_organization_billing_summary_rows = await loadBillingRows(orgId);\n"], "ts");
  c.control(T, "near-miss", "short-alnum-run", [`session ${"xau_" + synthetic(seed("ctl:short"), 20, ALNUM)} expired after 15 minutes of inactivity\n`], "log");
  c.control(T, "encoded-value", "hash-key-hex", [`key lookup hash: ${synthetic(seed("ctl:hashkey"), 64, HEX)}\n`], "txt");
  c.control(T, "encoded-value", "base64-blob", [`logo: data:image/png;base64,iVBORw0KGgo${synthetic(seed("ctl:b64:a"), 40, ALNUM)}E${"A".repeat(79)}${synthetic(seed("ctl:b64:b"), 40, ALNUM)}\n`], "yml");
  c.control(T, "public-id", "branch-and-database", [`branch: preview-${synthetic(seed("ctl:branch"), 8, "abcdefghijklmnopqrstuvwxyz")}  database: app_main  region: us-east-1\n`], "txt");
  c.control(T, "public-id", "postgres-url-no-password", ["DATABASE_URL=postgres://app@db.example.invalid:5432/main?sslmode=require\n"], "env");
  c.control(T, "public-id", "project-id", [`const projectId = "${synthetic(seed("ctl:project"), 12, "abcdefghijklmnopqrstuvwxyz0123456789")}"; // public project identifier\n`], "ts");
  c.control(T, "placeholder", "xau-test", ["XATA_API_KEY=xau_test\n"], "env");
  c.control(T, "placeholder", "xau-redacted", ["XATA_API_KEY=xau_redacted\n"], "env");
  c.control(T, "placeholder", "xau-some-key", ["const xata = new XataClient({ apiKey: \"xau_some_key\" });\n"], "ts");
  c.control(T, "placeholder", "cli-mask", [`XATA_API_KEY=xau_${"*".repeat(33)}\n`], "env");
  c.control(T, "reference", "env-reference", ["XATA_API_KEY=${XATA_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          XATA_API_KEY: ${{ secrets.XATA_API_KEY }}\n"], "yml");
  c.control(T, "reference", "process-env", ["const apiKey = process.env.XATA_API_KEY;\n"], "ts");
  c.control(T, "prose", "key-guidance", ["A Xata user key acts across every project the user can reach; an organization key is limited to one organization. Keep both in a secret store and revoke them from the dashboard if they leak.\n"], "md");
  return c.fixtures;
}
