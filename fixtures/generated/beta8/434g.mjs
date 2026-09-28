import { beta8Corpus } from "./helpers.mjs";
import { NANOID, HEX, at, guard, indexContexts } from "./434-shared.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #434, slice g (category `beta8-434g`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the Composio project (ak_ + 20), org (oak_ + 20) and user (uak_ + 43) API keys,
// URL-safe nanoid bodies (handoff redact-secret docs/audits/evidence/860/composio.md at 270faf8;
// product redact-secret#909). Every value is built here from a public `synthetic` seed; bodies that
// start or end with - or _ are forced where the handoff's test axes ask for them, and each is then
// followed by ", `,`, a space or the end of input.
//
// The bkend.ai ak_ + 64 hex key and a cak_/oak_/uak_ key in an ak_ position are other credentials,
// so they are twins, never benign controls. No key-shaped ck_ or cak_ value is authored (no shape
// is known); only their obvious placeholders are controls.

export function build434g({ fixture, synthetic }) {
  const c = beta8Corpus("434g", { fixture, synthetic });
  const seed = (target, slug) => `beta11:434g:${target}:${slug}`;
  const digest = slug => synthetic(`beta11:434g:digest:${slug}`, 64, HEX);

  for (const [T, prefix, width, env, header] of [
    ["composio-api-key", "ak_", 20, "COMPOSIO_API_KEY", "x-api-key"],
    ["composio-org-api-key", "oak_", 20, "COMPOSIO_ORG_API_KEY", "x-org-api-key"],
    ["composio-user-api-key", "uak_", 43, "COMPOSIO_USER_API_KEY", "x-user-api-key"],
  ]) {
    const { check, refuse } = guard("434g", T);
    const pattern = new RegExp(contracts[T].pattern);
    /** The first seeded body that satisfies the contract (only the ak_ mixed-case guard can reject one), with forced edge bytes. */
    const key = (slug, { first, last } = {}) => {
      for (let i = 0; ; i++) {
        let b = synthetic(seed(T, `${slug}:${i}`), width, NANOID);
        if (first) b = first + b.slice(1);
        if (last) b = b.slice(0, -1) + last;
        if (pattern.test(`${prefix}${b}`)) return check(`${prefix}${b}`);
      }
    };
    const contexts = indexContexts({ env, name: "Composio", host: "backend.composio.dev", ctor: "Composio" });
    const edge = { "bare-prose": { last: "-" }, dotenv: { first: "_" }, "json-token": { last: "_" }, "json-api-key": { first: "-" }, "chat-paste": { last: "_" } };
    const k = {};
    for (const x of contexts) {
      k[x.slug] = key(x.slug, edge[x.slug]);
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    }
    const headerCurl = v => [`curl -s https://backend.composio.dev/api/v3/toolkits -H "${header}: `, v, "\"\n"];
    const mcp = v => ["{\n  \"mcpServers\": {\n    \"composio\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@composio/mcp@latest\"],\n      \"env\": { \"", env, "\": \"", v, "\" }\n    }\n  }\n}\n"];
    const csv = v => ["name,key,created\nci-bot,", v, ",2026-09-28\n"];
    const eof = v => [`${env}=`, v];
    const extras = [
      { axis: "header", slug: "provider-header", ext: "sh", build: headerCurl, edge: { last: "-" } },
      { axis: "container-config", slug: "mcp-config", ext: "json", build: mcp, edge: {} },
      { axis: "structured-file", slug: "csv-comma", ext: "csv", build: csv, edge: { last: "-" } },
      { axis: "env", slug: "end-of-input", ext: "env", build: eof, edge: { last: "_" } },
    ];
    for (const x of extras) {
      k[x.slug] = key(x.slug, x.edge);
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    }
    const all = [...contexts, ...extras];
    const put = (slug, v) => all.find(x => x.slug === slug).build(v);
    const body = v => v.slice(prefix.length);

    c.twin(T, "export", "body-short", put("export", refuse(k.export.slice(0, -1))), `length: ${width - 1} body bytes vs exactly ${width}`, "length", "sh");
    c.twin(T, "bearer-header", "body-long", put("bearer-header", refuse(`${k["bearer-header"]}${synthetic(seed(T, "extra"), 1, "abcdefghij")}`)), `length: ${width + 1} body bytes vs exactly ${width} (rejected, never truncated)`, "length", "http");
    c.twin(T, "x-api-key-header", "dot-in-body", put("x-api-key-header", refuse(at(k["x-api-key-header"], prefix.length + 8, "."))), "alphabet: one body byte replaced by ., outside [A-Za-z0-9_-]", "alphabet", "http");
    c.twin(T, "sdk-kwarg", "plus-in-body", put("sdk-kwarg", refuse(at(k["sdk-kwarg"], prefix.length + 11, "+"))), "alphabet: one body byte replaced by +, outside [A-Za-z0-9_-]", "alphabet", "py");
    c.twin(T, "json-token", "uppercase-prefix", put("json-token", refuse(`${prefix.toUpperCase()}${body(k["json-token"])}`)), `prefix: ${prefix.toUpperCase()} vs the documented lower-case ${prefix}`, "prefix", "json");
    c.twin(T, "json-api-key", "hyphen-prefix", put("json-api-key", refuse(`${prefix.slice(0, -1)}-${body(k["json-api-key"])}`)), `prefix: ${prefix.slice(0, -1)}- in place of ${prefix}`, "prefix", "json");
    c.twin(T, "mcp-config", "trailing-glue", mcp(refuse(`${k["mcp-config"]}x`)), "boundary: an identifier byte glued after the body, so the key is embedded in a longer run", "boundary", "json");

    if (prefix === "ak_") {
      c.twin(T, "dotenv", "all-lowercase-body", put("dotenv", refuse(`ak_${body(k.dotenv).toLowerCase()}`)), "guard: the body lower-cased, so it has no uppercase letter (the ak_ mixed-case guard)", "alphabet", "env");
      c.twin(T, "chat-paste", "all-uppercase-body", put("chat-paste", refuse(`ak_${body(k["chat-paste"]).toUpperCase()}`)), "guard: the body upper-cased, so it has no lowercase letter (the ak_ mixed-case guard)", "alphabet", "txt");
      // ak_ inside another prefix must never read as a project key; a real oak_ key in this position is co-detection, not a false alarm.
      c.twin(T, "bare-prose", "inside-cak", put("bare-prose", refuse(`c${k["bare-prose"]}`)), "boundary: cak_ (an agent key of unknown shape) with the same body; ak_ is glued to c", "boundary", "md");
      c.twin(T, "provider-header", "inside-xak", headerCurl(refuse(`x${k["provider-header"]}`)), "boundary: x glued before ak_", "boundary", "sh");
      c.twin(T, "csv-comma", "inside-oak", csv(refuse(`o${k["csv-comma"]}`)), "prefix: oak_ with the same body, the org key (another credential class) in the project key's position", "prefix", "csv");
      c.twin(T, "end-of-input", "inside-uak", eof(refuse(`u${k["end-of-input"]}`)), "prefix: uak_ + 20, neither a project key (ak_ is glued to u) nor a user key (43)", "prefix", "env");
      c.twin(T, "json-api-key", "bkend-ak-64-hex", put("json-api-key", refuse(`ak_${synthetic(seed(T, "bkend"), 64, HEX)}`)), "length: ak_ + 64 hex, bkend.ai's key (another provider), vs exactly 20", "length", "json");
    } else if (prefix === "uak_") {
      c.twin(T, "dotenv", "legacy-width-20", put("dotenv", refuse(`uak_${body(k.dotenv).slice(0, 20)}`)), "length: uak_ + 20, the width a T2 code comment shows, vs the staff-stated 43", "length", "env");
      c.twin(T, "chat-paste", "body-44", put("chat-paste", refuse(`${k["chat-paste"]}${synthetic(seed(T, "extra-44"), 1, "abcdefghij")}`)), "length: a 44-byte body vs exactly 43", "length", "txt");
      c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before uak_", "boundary", "md");
    } else {
      c.twin(T, "dotenv", "body-19", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: 19 body bytes vs exactly 20", "length", "env");
      c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before oak_", "boundary", "md");
      c.twin(T, "chat-paste", "short-prefix", put("chat-paste", refuse(`ok_${body(k["chat-paste"])}`)), "prefix: ok_, missing the a", "prefix", "txt");
    }

    c.control(T, "placeholder", "ellipsis", [`Set ${env} to your ${prefix}... key from the Composio dashboard.\n`], "md");
    c.control(T, "placeholder", "sibling-placeholders", ["Fixtures use ck_test_dummy and cak_e2e_agent; real consumer keys look like ck_... and are never committed.\n"], "md");
    c.control(T, "reference", "env-reference", [`${env}=\${${env}}\n`], "env");
    c.control(T, "reference", "actions-secret", [`      ${env}: \${{ secrets.${env} }}\n`], "yml");
    c.control(T, "near-miss", "snake-case-identifier", ["ak_request_timeout_secs = 30\nak_default_toolkit_name = \"github\"\n"], "py");
    // A 20-byte kebab-case run after oak_ would be in the org-key contract (no guard there), so only ak_ gets the exact-width form.
    c.control(T, "near-miss", "kebab-case-identifier", [`<div class="${prefix === "ak_" ? "ak_connected-account-id" : `${prefix}connected-accounts-list`}">\n`], "html");
    c.control(T, "near-miss", "truncated", [`2026-09-28T10:40:02Z composio: rejected truncated key ${prefix}${synthetic(seed(T, "short"), 9, NANOID).replace(/[-_]/g, "a")} from client\n`], "log");
    c.control(T, "public-id", "project-id", [`{"project_id": "pr_${synthetic(seed(T, "pr"), 12, "abcdefghijklmnopqrstuvwxyz0123456789")}", "org_id": "${synthetic(seed(T, "org"), 12, "abcdefghijklmnopqrstuvwxyz0123456789")}"}\n`], "json");
    c.control(T, "encoded-value", "digest", [`# audit record\nkey_sha256=${digest(T)}\n`], "txt");
    c.control(T, "prose", "key-guidance", ["Composio project keys start with ak_, org keys with oak_ and user keys (from composio login) with uak_.\n"], "md");
  }
  return c.fixtures;
}
