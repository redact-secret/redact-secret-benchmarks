import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, HEX, at, uuid, guard, indexContexts } from "./434-shared.mjs";

// Issue #434, slice d (category `beta8-434d`). See docs/specs/beta8-evidence.md.
//
// Beta.11 corpus for the PostHog personal API key (phx_) and project secret API key (phs_),
// each + 42–49 of [0-9A-Za-z] (handoff redact-secret docs/audits/evidence/860/posthog.md at
// 270faf8; product redact-secret#906). Every value is built here from a public `synthetic` seed:
// base57 bodies of 48 and 49 and base62 bodies of 42, 43, 46, 47 and 48, as the handoff's test
// axes list.
//
// The phc_ project token is public by design and is authored only as a benign control, and only
// outside credential-named assignments (generic detection redacts a credential-named phc_ today;
// that is generic-token's verdict). Bodies of 41 or fewer that some base62-era keys rendered at
// (below 0.03% of any era) are an accepted false negative and are asserted by no fixture.

const BASE57 = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const WIDTHS = [[48, BASE57], [49, BASE57], [42, ALNUM], [43, ALNUM], [46, ALNUM], [47, ALNUM], [48, ALNUM]];

export function build434d({ fixture, synthetic }) {
  const c = beta8Corpus("434d", { fixture, synthetic });
  const seed = (target, slug) => `beta11:434d:${target}:${slug}`;

  for (const [T, prefix, env, role] of [
    ["posthog-token", "phx_", "POSTHOG_PERSONAL_API_KEY", "personal API key"],
    ["posthog-project-secret-api-key", "phs_", "POSTHOG_PROJECT_SECRET_API_KEY", "project secret API key"],
  ]) {
    const { check, refuse } = guard("434d", T);
    let n = 0;
    const key = slug => {
      const [width, alphabet] = WIDTHS[n++ % WIDTHS.length];
      return check(`${prefix}${synthetic(seed(T, slug), width, alphabet)}`);
    };
    const contexts = indexContexts({ env, name: "PostHog", host: "us.posthog.com", ctor: "Posthog" });
    const mcp = v => ["{\n  \"mcpServers\": {\n    \"posthog\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"mcp-remote@latest\", \"https://mcp.posthog.com/sse\", \"--header\", \"Authorization:${AUTH}\"],\n      \"env\": { \"AUTH\": \"Bearer ", v, "\" }\n    }\n  }\n}\n"];
    const curl = v => ["curl -s https://us.posthog.com/api/projects/ -H \"Authorization: Bearer ", v, "\"\n"];
    const all = [...contexts,
      { axis: "container-config", slug: "mcp-config", ext: "json", build: mcp },
      { axis: "cli", slug: "curl-projects", ext: "sh", build: curl },
    ];
    const k = {};
    for (const x of all) {
      k[x.slug] = key(x.slug);
      c.positive(T, x.axis, x.slug, x.build({ secret: k[x.slug] }), x.ext);
    }
    const put = (slug, v) => all.find(x => x.slug === slug).build(v);
    const body = v => v.slice(4);

    c.twin(T, "dotenv", "body-41", put("dotenv", refuse(`${prefix}${synthetic(seed(T, "body-41"), 41, ALNUM)}`)), "length: a 41-byte body vs the 42–49 band", "length", "env");
    c.twin(T, "export", "body-50", put("export", refuse(`${prefix}${synthetic(seed(T, "body-50"), 50, ALNUM)}`)), "length: a 50-byte body vs the 42–49 band (rejected, never truncated)", "length", "sh");
    c.twin(T, "json-token", "underscore-in-body", put("json-token", refuse(at(k["json-token"], 20, "_"))), "alphabet: one body byte replaced by _, outside every era's alphabet", "alphabet", "json");
    c.twin(T, "json-api-key", "hyphen-in-body", put("json-api-key", refuse(at(k["json-api-key"], 24, "-"))), "alphabet: one body byte replaced by -, outside every era's alphabet", "alphabet", "json");
    c.twin(T, "bearer-header", "hyphen-prefix", put("bearer-header", refuse(`${prefix.slice(0, 3)}-${body(k["bearer-header"])}`)), `prefix: ${prefix.slice(0, 3)}- in place of ${prefix}`, "prefix", "http");
    c.twin(T, "x-api-key-header", "uppercase-prefix", put("x-api-key-header", refuse(`${prefix.toUpperCase()}${body(k["x-api-key-header"])}`)), `prefix: ${prefix.toUpperCase()} vs the documented lower-case ${prefix}`, "prefix", "http");
    c.twin(T, "sdk-kwarg", "short-prefix", put("sdk-kwarg", refuse(`ph_${body(k["sdk-kwarg"])}`)), "prefix: ph_, missing the role letter", "prefix", "py");
    c.twin(T, "mcp-config", "unknown-role-prefix", mcp(refuse(`phy_${body(k["mcp-config"])}`)), "prefix: phy_, an undocumented role letter", "prefix", "json");
    c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), `boundary: x glued before ${prefix}`, "boundary", "md");
    c.twin(T, "chat-paste", "trailing-glue", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the body", "boundary", "txt");
    // The public project token in this secret's position: a different credential class with a public role, so a prefix twin.
    c.twin(T, "curl-projects", "project-token-prefix", curl(refuse(`phc_${body(k["curl-projects"])}`)), "prefix: phc_, the public project token, in place of the secret prefix", "prefix", "sh");

    const phc = (slug, width) => `phc_${synthetic(seed(T, slug), width, width === 44 ? BASE57 : ALNUM)}`;
    c.control(T, "public-id", "project-token-bare", [`Our PostHog project token is ${phc("phc-bare", 43)}; it is public and ships in the web bundle.\n`], "md");
    c.control(T, "public-id", "project-token-init", ["<script>\n  posthog.init('", phc("phc-init", 44), "', { api_host: 'https://us.i.posthog.com', person_profiles: 'identified_only' })\n</script>\n"], "html");
    c.control(T, "public-id", "project-token-html", [`<meta name="posthog-project" content="${phc("phc-meta", 44)}">\n`], "html");
    c.control(T, "public-id", "host-urls", ["api_host: https://us.i.posthog.com\nui_host: https://us.posthog.com\n"], "yml");
    c.control(T, "placeholder", "ellipsis", [`Create a ${role} in Settings; it starts with ${prefix}... and is shown once.\n`], "md");
    c.control(T, "placeholder", "masked", [`Key ${prefix}***${synthetic(seed(T, "mask"), 4, "0123456789")} last used 2026-09-27\n`], "md");
    c.control(T, "reference", "env-reference", [`${env}=\${${env}}\n`], "env");
    c.control(T, "reference", "actions-secret", [`      ${env}: \${{ secrets.${env} }}\n`], "yml");
    c.control(T, "near-miss", "truncated", [`2026-09-28T10:20:13Z api: rejected truncated key ${prefix}${synthetic(seed(T, "short"), 14, ALNUM)}\n`], "log");
    c.control(T, "encoded-value", "event-uuid", [`{"event": "$pageview", "uuid": "${uuid(synthetic(seed(T, "uuid"), 32, HEX))}"}\n`], "json");
    c.control(T, "prose", "key-guidance", ["Project tokens (phc_) are public; personal API keys (phx_) and project secret keys (phs_) are secrets.\n"], "md");
  }
  return c.fixtures;
}
