import { createHash } from "node:crypto";
import { beta8Corpus } from "./helpers.mjs";

// Issue #211 corpus (category `beta8-211`). See docs/specs/beta8-evidence.md.
// Four arrival families (benchmarks/lib/beta8/211.ts): github-fine-grained-pat,
// slack-app-level-token, stripe-webhook-signing-secret, notion-integration-token.
// Every value is a `synthetic("beta8:211:…")` seed or built from them in code;
// none was provider-issued, scanner-reported, copied from a provider example or
// derived from a real credential. Twins mutate only properties no cited source
// admits (see each contract's `fields`); none mutates a width or alphabet that a
// credible source treats as valid.

const UPPER_ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DIGITS = "0123456789";
const HEX = "0123456789abcdef";
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";
const URI = "URI scheme, user and host are not secret, but redacting the whole remote URL is acceptable; only the token in the password position must be covered.";

export function build211({ fixture, synthetic }) {
  const c = beta8Corpus(211, { fixture, synthetic });
  const s = (target, slug, part, len, chars) => synthetic(`beta8:211:${target}:${slug}:${part}`, len, chars);
  // A template receives `slot(value, envelope?)`: a secret span for a positive, plain text for its twin,
  // so a twin differs from its positive only inside the value.
  const secret = (value, envelope) => (envelope ? { secret: value, envelope } : { secret: value });
  const plain = (value, envelope) => (envelope ? envelope.before + value + envelope.after : value);
  const env = (before, after, reason) => ({ before, after, reason });
  const uuid = (seed) => { const h = synthetic(seed, 32, HEX); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

  /** Author one family: positives (with optional twins) and independent controls. */
  const family = (target, make, positives, controls) => {
    for (const p of positives) {
      const value = make(p.slug, p.variant);
      c.positive(target, p.axis, p.slug, p.tpl(secret, value), p.ext);
      for (const t of p.twins ?? [])
        c.twin(target, p.slug, t.slug, p.tpl(plain, t.mutate(value)), t.mutation, t.kind, p.ext);
    }
    for (const k of controls) c.control(target, k.axis, k.slug, k.parts, k.ext);
  };

  // ---------------------------------------------------------------------------
  // github:fine-grained-personal-access-token (#223)
  // github_pat_ + 22 + "_" + 59 alphanumerics. Some positives begin segment 1 with "11" (community anecdote)
  // and some do not, so no fixture depends on that unresolved lead.
  const GH = "github-fine-grained-pat";
  const ghValue = (slug, lead11) => {
    const seg1 = lead11 ? `11${s(GH, slug, "seg1", 20)}` : s(GH, slug, "seg1", 22);
    return `github_pat_${seg1}_${s(GH, slug, "seg2", 59)}`;
  };
  family(GH, ghValue, [
    { axis: "env", slug: "dotenv-gh-token", variant: true, ext: "env",
      tpl: (slot, v) => ["# GitHub fine-grained token for the release bot (repo: acme/widgets, contents: read)\nGH_TOKEN=", slot(v), "\n"],
      twins: [{ slug: "dotenv-gh-token-prefix", kind: "prefix", mutate: v => v.replace(/^github_pat_/, "github_pet_"),
        mutation: "prefix: github_pet_ vs the documented github_pat_ (one letter of the provider-documented prefix changed; no source issues github_pet_)" }] },
    { axis: "shell-export", slug: "export-github-pat", ext: "sh",
      tpl: (slot, v) => ["export GITHUB_PAT=", slot(v), "\nRscript -e 'gh::gh_whoami()'\n"] },
    { axis: "header", slug: "bearer-header", variant: true, ext: "http",
      tpl: (slot, v) => ["GET /repos/acme/widgets/issues?state=open HTTP/1.1\nHost: api.github.com\n", slot(v, env("Authorization: Bearer ", "", BEARER)), "\nX-GitHub-Api-Version: 2022-11-28\nAccept: application/vnd.github+json\n"],
      twins: [{ slug: "bearer-header-case", kind: "prefix", mutate: v => v.replace(/^github_pat_/, "GITHUB_PAT_"),
        mutation: "prefix: GITHUB_PAT_ vs the documented lowercase github_pat_ (case of the documented prefix changed; every cited rule is case-sensitive on the prefix)" }] },
    { axis: "url", slug: "git-remote-userinfo", ext: "gitconfig",
      tpl: (slot, v) => ["[remote \"origin\"]\n\turl = ", slot(v, env("https://octocat:", "@github.com/acme/widgets.git", URI)), "\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n"],
      twins: [{ slug: "git-remote-userinfo-boundary", kind: "boundary", mutate: v => `Q${v}`,
        mutation: "boundary: a letter glued directly before github_pat_, so the prefix is no longer at a token boundary (the value itself is unchanged)" }] },
    { axis: "structured-file", slug: "composer-auth-json", variant: true, ext: "json",
      tpl: (slot, v) => ["{\n  \"github-oauth\": {\n    \"github.com\": \"", slot(v), "\"\n  }\n}\n"],
      twins: [{ slug: "composer-auth-json-separator", kind: "alphabet", mutate: v => `${v.slice(0, 33)}.${v.slice(34)}`,
        mutation: "alphabet: the segment separator is '.' instead of '_' (no cited source admits '.' anywhere after the prefix; the 22/59 widths are unchanged)" }] },
    { axis: "ci-config", slug: "actions-env", ext: "yml",
      tpl: (slot, v) => ["name: sync\non: [workflow_dispatch]\njobs:\n  sync:\n    runs-on: ubuntu-latest\n    env:\n      GH_TOKEN: ", slot(v), "\n    steps:\n      - run: gh repo sync acme/widgets-mirror --source acme/widgets\n"] },
    { axis: "sdk-config", slug: "terraform-provider", variant: true, ext: "tf",
      tpl: (slot, v) => ["provider \"github\" {\n  owner = \"acme\"\n  token = \"", slot(v), "\"\n}\n"],
      twins: [{ slug: "terraform-provider-alphabet", kind: "alphabet", mutate: v => `${v.slice(0, 63)}!${v.slice(64)}`,
        mutation: "alphabet: one character in the middle of segment 2 replaced with '!', outside every cited alphabet ([A-Za-z0-9], \\w, [A-Za-z0-9_]); length unchanged" }] },
    { axis: "cli", slug: "gh-auth-login", ext: "sh",
      tpl: (slot, v) => ["$ echo \"", slot(v), "\" | gh auth login --hostname github.com --with-token\n"] },
    { axis: "log", slug: "octokit-debug-log", variant: true, ext: "log",
      tpl: (slot, v) => ["2026-09-24T10:15:02.114Z DEBUG octokit:request GET https://api.github.com/user headers={\"authorization\":\"token ", slot(v), "\",\"user-agent\":\"octokit-rest.js/21.0.2\"}\n"] },
    { axis: "container-config", slug: "compose-renovate", ext: "yml",
      tpl: (slot, v) => ["services:\n  renovate:\n    image: renovate/renovate:38\n    environment:\n      RENOVATE_PLATFORM: github\n      RENOVATE_TOKEN: ", slot(v), "\n"] },
  ], [
    { axis: "public-id", slug: "audit-log-token-id", ext: "json",
      parts: [`{"action":"personal_access_token.access_granted","actor":"octocat","org":"acme","token_id":${s(GH, "audit", "id", 8, DIGITS)},"programmatic_access_type":"Fine-grained personal access token","@timestamp":1727172902114}\n`] },
    { axis: "public-id", slug: "request-id-header", ext: "http",
      parts: [`HTTP/1.1 401 Unauthorized\nX-GitHub-Request-Id: ${s(GH, "reqid", "a", 4, "0123456789ABCDEF")}:${s(GH, "reqid", "b", 4, "0123456789ABCDEF")}:${s(GH, "reqid", "c", 7, "0123456789ABCDEF")}:${s(GH, "reqid", "d", 7, "0123456789ABCDEF")}:66F2D1A0\nX-GitHub-SSO: required; url=https://github.com/orgs/acme/sso\n`] },
    { axis: "encoded-value", slug: "audit-log-hashed-token", ext: "json",
      parts: [`{"action":"repo.download_zip","actor":"octocat","hashed_token":"${createHash("sha256").update("beta8:211:github-fine-grained-pat:hashed-token:never-a-token").digest("base64")}","token_id":${s(GH, "hashed", "id", 8, DIGITS)}}\n`] },
    { axis: "reference", slug: "actions-secret-reference", ext: "yml",
      parts: ["    env:\n      GH_TOKEN: ${{ secrets.GH_FINE_GRAINED_PAT }}\n"] },
    { axis: "reference", slug: "command-substitution", ext: "sh",
      parts: ["export GITHUB_PAT=\"$(gh auth token --hostname github.com)\"\n"] },
    { axis: "placeholder", slug: "angle-placeholder", ext: "env",
      parts: ["GH_TOKEN=github_pat_<your-fine-grained-token>\n"] },
    { axis: "placeholder", slug: "masked-list-entry", ext: "txt",
      parts: ["release-bot   github_pat_************************   Expires in 29 days   Last used within the last week\n"] },
    { axis: "near-miss", slug: "identifier-name", ext: "py",
      parts: ["def read_github_pat_from_keychain(service_name: str) -> str:\n    return keyring.get_password(service_name, \"github\")\n"] },
    { axis: "prose", slug: "docs-sentence", ext: "md",
      parts: ["Fine-grained personal access tokens start with github_pat_ and are created under Settings → Developer settings → Personal access tokens.\n"] },
  ]);

  // ---------------------------------------------------------------------------
  // slack:app-level-token (#222)
  // xapp-1-<11 upper alnum>-<13 digits>-<64 lowercase hex>: satisfies gitleaks, veles/kingfisher, the product's
  // interim floor and Slack CLI's prefix-only redaction. Widths/alphabet stay unresolved in the contract.
  const SL = "slack-app-level-token";
  const slValue = (slug, appLike) => {
    const sec2 = appLike ? `A${s(SL, slug, "sec2", 10, UPPER_ALNUM)}` : s(SL, slug, "sec2", 11, UPPER_ALNUM);
    return `xapp-1-${sec2}-${s(SL, slug, "sec3", 13, DIGITS)}-${s(SL, slug, "sec4", 64, HEX)}`;
  };
  family(SL, slValue, [
    { axis: "env", slug: "dotenv-app-token", variant: true, ext: "env",
      tpl: (slot, v) => ["SLACK_APP_TOKEN=", slot(v), "\nSLACK_SOCKET_MODE=true\n"],
      twins: [{ slug: "dotenv-app-token-prefix", kind: "prefix", mutate: v => v.replace(/^xapp-/, "xapq-"),
        mutation: "prefix: xapq- vs the documented xapp- (one letter of the provider-documented prefix changed; not a Slack token prefix)" }] },
    { axis: "shell-export", slug: "export-app-token", ext: "sh",
      tpl: (slot, v) => ["export SLACK_APP_TOKEN='", slot(v), "'\npython app.py\n"] },
    { axis: "header", slug: "connections-open-header", variant: true, ext: "http",
      tpl: (slot, v) => ["POST /api/apps.connections.open HTTP/1.1\nHost: slack.com\n", slot(v, env("Authorization: Bearer ", "", BEARER)), "\nContent-Type: application/x-www-form-urlencoded\n"],
      twins: [{ slug: "connections-open-header-boundary", kind: "boundary", mutate: v => `Q${v}`,
        mutation: "boundary: a letter glued directly before xapp-, so the prefix is no longer at a token boundary (the value itself is unchanged)" }] },
    { axis: "cli", slug: "curl-connections-open", ext: "sh",
      tpl: (slot, v) => ["curl -s -X POST https://slack.com/api/apps.connections.open -H \"Authorization: Bearer ", slot(v), "\"\n"] },
    { axis: "source-code", slug: "bolt-python-handler", ext: "py",
      tpl: (slot, v) => ["from slack_bolt.adapter.socket_mode import SocketModeHandler\n\nSocketModeHandler(app, app_token=\"", slot(v), "\").start()\n"],
      twins: [{ slug: "bolt-python-handler-separator", kind: "alphabet", mutate: v => `${v.slice(0, 18)}_${v.slice(19)}`,
        mutation: "alphabet: the separator between the second and third sections is '_' instead of '-' (no cited source puts '_' in an xapp- value; widths unchanged)" }] },
    { axis: "structured-file", slug: "cli-install-json", variant: true, ext: "json",
      tpl: (slot, v) => ["{\n  \"app_id\": \"A0", s(SL, "cli-json", "appid", 9, UPPER_ALNUM), "\",\n  \"api_access_tokens\": {\n    \"app_level\": \"", slot(v), "\"\n  }\n}\n"],
      twins: [{ slug: "cli-install-json-digit-section", kind: "alphabet", mutate: v => `${v.slice(0, 25)}Q${v.slice(26)}`,
        mutation: "alphabet: one character of the all-digit third section replaced with the letter Q (every cited source and provider placeholder gives that section as digits; widths unchanged)" }] },
    { axis: "sdk-config", slug: "agent-yaml", ext: "yml",
      tpl: (slot, v) => ["slack:\n  socket_mode: true\n  app_token: ", slot(v), "\n  bot_token_env: SLACK_BOT_TOKEN\n"],
      twins: [{ slug: "agent-yaml-alphabet", kind: "alphabet", mutate: v => `${v.slice(0, 12)}!${v.slice(13)}`,
        mutation: "alphabet: one character inside the second section replaced with '!', outside every cited alphabet; widths unchanged" }] },
    { axis: "container-config", slug: "dockerfile-env", variant: true, ext: "dockerfile",
      tpl: (slot, v) => ["FROM node:20-slim\nWORKDIR /app\nENV SLACK_APP_TOKEN=\"", slot(v), "\"\nCMD [\"node\", \"app.js\"]\n"] },
    { axis: "log", slug: "agent-env-echo", ext: "log",
      tpl: (slot, v) => ["[2026-09-24 10:15:02] gateway: loaded environment SLACK_APP_TOKEN=", slot(v), " SLACK_SOCKET_MODE=true\n"] },
    { axis: "prose", slug: "chat-message", variant: true, ext: "txt",
      tpl: (slot, v) => ["@channel the socket-mode token for the staging bot is ", slot(v), " until I rotate it after the demo.\n"] },
  ], [
    { axis: "public-id", slug: "app-id-url", ext: "md",
      parts: [`Manage the app at https://api.slack.com/apps/A0${s(SL, "appid", "id", 9, UPPER_ALNUM)}/general (App ID A0${s(SL, "appid", "id", 9, UPPER_ALNUM)}).\n`] },
    { axis: "public-id", slug: "team-and-client-id", ext: "env",
      parts: [`SLACK_TEAM_ID=T0${s(SL, "team", "id", 9, UPPER_ALNUM)}\nSLACK_CLIENT_ID=${s(SL, "client", "a", 13, DIGITS)}.${s(SL, "client", "b", 13, DIGITS)}\n`] },
    { axis: "placeholder", slug: "masked-env", ext: "env",
      parts: ["SLACK_APP_TOKEN=xapp-***\n"] },
    { axis: "placeholder", slug: "angle-placeholder", ext: "yml",
      parts: ["slack:\n  app_token: xapp-<your-app-level-token>\n"] },
    { axis: "reference", slug: "environ-lookup", ext: "py",
      parts: ["SocketModeHandler(app, os.environ[\"SLACK_APP_TOKEN\"]).start()\n"] },
    { axis: "reference", slug: "compose-interpolation", ext: "yml",
      parts: ["    environment:\n      SLACK_APP_TOKEN: ${SLACK_APP_TOKEN}\n"] },
    { axis: "near-miss", slug: "package-name", ext: "sh",
      parts: ["npm install --save xapp-store-client@2.4.1\n"] },
    { axis: "near-miss", slug: "prefix-only", ext: "env",
      parts: ["SLACK_APP_TOKEN=xapp-\n"] },
    { axis: "prose", slug: "docs-sentence", ext: "md",
      parts: ["Generate an app-level token (it starts with xapp-) under Basic Information → App-Level Tokens and give it the connections:write scope.\n"] },
  ]);

  // ---------------------------------------------------------------------------
  // stripe:webhook-signing-secret (#224) — context-gated: every positive carries a same-line Stripe context.
  // Bodies are alphanumeric, 32 (provider API example width) or 64 (provider-code placeholder width).
  const ST = "stripe-webhook-signing-secret";
  const stValue = (slug, wide) => `whsec_${s(ST, slug, "body", wide ? 64 : 32)}`;
  const weId = s(ST, "endpoint", "id", 24);
  family(ST, stValue, [
    { axis: "env", slug: "dotenv-webhook-secret", ext: "env",
      tpl: (slot, v) => ["STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}\nSTRIPE_WEBHOOK_SECRET=", slot(v), "\n"],
      twins: [{ slug: "dotenv-webhook-secret-public-prefix", kind: "public-prefix", mutate: v => v.replace(/^whsec_/, "pk_live_"),
        mutation: "public-prefix: pk_live_ (publishable key namespace, documented by docs.stripe.com/keys as safe to expose) replaces whsec_; body unchanged" }] },
    { axis: "shell-export", slug: "export-webhook-secret", ext: "sh",
      tpl: (slot, v) => ["export STRIPE_WEBHOOK_SECRET=", slot(v), "\nbundle exec rails server\n"],
      twins: [{ slug: "export-webhook-secret-case", kind: "prefix", mutate: v => v.replace(/^whsec_/, "WHSEC_"),
        mutation: "prefix: WHSEC_ vs the documented lowercase whsec_ (case of the documented prefix changed; Stripe's own scrubber and every cited rule are case-sensitive)" }] },
    { axis: "tool-output", slug: "stripe-listen-ready", ext: "txt",
      tpl: (slot, v) => ["$ stripe listen --forward-to localhost:4242/webhook\n> Ready! Your webhook signing secret is ", slot(v), " (^C to quit)\n"] },
    { axis: "source-code", slug: "python-construct-event", ext: "py",
      tpl: (slot, v) => ["endpoint_secret = '", slot(v), "'  # Stripe webhook signing secret\nevent = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)\n"],
      twins: [{ slug: "python-construct-event-separator", kind: "prefix", mutate: v => v.replace(/^whsec_/, "whsec-"),
        mutation: "prefix: whsec- with a dash separator vs the documented whsec_ (separator of the documented prefix changed; body unchanged)" }] },
    { axis: "source-code", slug: "node-construct-event-wide", variant: true, ext: "js",
      tpl: (slot, v) => ["const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], '", slot(v), "');\n"] },
    { axis: "structured-file", slug: "endpoint-create-response", ext: "json",
      tpl: (slot, v) => [`{\n  "id": "we_${weId}",\n  "object": "webhook_endpoint",\n  "secret": "`, slot(v), "\",\n  \"url\": \"https://example.com/stripe/webhook\"\n}\n"],
      twins: [{ slug: "endpoint-create-response-boundary", kind: "boundary", mutate: v => `Q${v}`,
        mutation: "boundary: a letter glued directly before whsec_, so the prefix is no longer at a token boundary (the value itself is unchanged)" }] },
    { axis: "sdk-config", slug: "rails-credentials-rolling", ext: "yml",
      tpl: (slot, v) => ["stripe:\n  private_key: <%= ENV[\"STRIPE_SECRET_KEY\"] %>\n  signing_secret: [", slot(v), ", ", slot(stValue("rails-credentials-rolling-previous")), "]\n"] },
    { axis: "container-config", slug: "compose-webhook-secret", variant: true, ext: "yml",
      tpl: (slot, v) => ["services:\n  api:\n    environment:\n      STRIPE_WEBHOOK_SECRET: ", slot(v), "\n"] },
    { axis: "log", slug: "webhook-verifier-log", ext: "log",
      tpl: (slot, v) => [`2026-09-24T10:15:02Z INFO stripe-webhooks: verifying events for we_${weId} with signing secret `, slot(v), "\n"],
      twins: [{ slug: "webhook-verifier-log-alphabet", kind: "alphabet", mutate: v => `${v.slice(0, 22)}!${v.slice(23)}`,
        mutation: "alphabet: one body character replaced with '!', outside every cited alphabet (alphanumeric, or base64 with + / =); length unchanged" }] },
    { axis: "ci-config", slug: "actions-env", ext: "yml",
      tpl: (slot, v) => ["jobs:\n  test:\n    env:\n      STRIPE_WEBHOOK_SECRET: ", slot(v), "\n    steps:\n      - run: npm test\n"] },
  ], [
    { axis: "encoded-value", slug: "stripe-signature-header", ext: "http",
      parts: [`POST /stripe/webhook HTTP/1.1\nStripe-Signature: t=1727172902,v1=${s(ST, "sig", "v1", 64, HEX)},v0=${s(ST, "sig", "v0", 64, HEX)}\n`] },
    { axis: "public-id", slug: "endpoint-object", ext: "json",
      parts: [`{"id": "we_${s(ST, "endpoint-object", "id", 24)}", "object": "webhook_endpoint", "enabled_events": ["checkout.session.completed"], "status": "enabled"}\n`] },
    { axis: "public-id", slug: "event-destination-log", ext: "log",
      parts: [`2026-09-24T10:15:03Z INFO delivered evt_${s(ST, "event", "id", 24)} to event destination ed_test_${s(ST, "destination", "id", 44)}\n`] },
    { axis: "public-id", slug: "publishable-key", ext: "env",
      parts: [`STRIPE_PUBLISHABLE_KEY=pk_test_${s(ST, "publishable", "body", 99)}\n`] },
    { axis: "placeholder", slug: "ellipsis", ext: "env",
      parts: ["STRIPE_WEBHOOK_SECRET=whsec_...\n"] },
    { axis: "placeholder", slug: "masked", ext: "py",
      parts: ["endpoint_secret = \"whsec_********\"  # Stripe webhook signing secret\n"] },
    { axis: "placeholder", slug: "fill-in", ext: "env",
      parts: ["STRIPE_WEBHOOK_SECRET=whsec_YOUR_SIGNING_SECRET\n"] },
    { axis: "reference", slug: "print-secret-substitution", ext: "sh",
      parts: ["export STRIPE_WEBHOOK_SECRET=$(stripe listen --print-secret)\n"] },
    { axis: "near-miss", slug: "prefix-only", ext: "env",
      parts: ["STRIPE_WEBHOOK_SECRET=whsec_\n"] },
    { axis: "prose", slug: "docs-sentence", ext: "md",
      parts: ["In Workbench → Webhooks, open the endpoint and click Reveal secret to copy the signing secret that begins with whsec_.\n"] },
  ]);

  // ---------------------------------------------------------------------------
  // notion:integration-token (#225) — internal-integration contexts only (roles are not merged).
  // ntn_ + 11 digits + 35 alphanumerics: satisfies gitleaks, secretlint, flare-redact (46 in 40–50) and lore's redaction.
  const NO = "notion-integration-token";
  const noValue = (slug) => `ntn_${s(NO, slug, "digits", 11, DIGITS)}${s(NO, slug, "body", 35)}`;
  family(NO, noValue, [
    { axis: "env", slug: "dotenv-notion-token", ext: "env",
      tpl: (slot, v) => ["NOTION_TOKEN=", slot(v), "\nNOTION_DATABASE_ID=", s(NO, "env-db", "id", 32, HEX), "\n"],
      twins: [{ slug: "dotenv-notion-token-prefix", kind: "prefix", mutate: v => v.replace(/^ntn_/, "ntx_"),
        mutation: "prefix: ntx_ vs the documented ntn_ (one letter of the provider-documented prefix changed; not a Notion token prefix)" }] },
    { axis: "shell-export", slug: "export-api-key", ext: "sh",
      tpl: (slot, v) => ["export NOTION_API_KEY=", slot(v), "\nnode sync-roadmap.js\n"],
      twins: [{ slug: "export-api-key-case", kind: "prefix", mutate: v => v.replace(/^ntn_/, "NTN_"),
        mutation: "prefix: NTN_ vs the documented lowercase ntn_ (case of the documented prefix changed; every cited rule is case-sensitive)" }] },
    { axis: "header", slug: "bearer-header", ext: "http",
      tpl: (slot, v) => ["POST /v1/databases/query HTTP/1.1\nHost: api.notion.com\n", slot(v, env("Authorization: Bearer ", "", BEARER)), "\nNotion-Version: 2025-09-03\n"],
      twins: [{ slug: "bearer-header-separator", kind: "prefix", mutate: v => v.replace(/^ntn_/, "ntn-"),
        mutation: "prefix: ntn- with a dash separator vs the documented ntn_ (separator of the documented prefix changed; body unchanged)" }] },
    { axis: "cli", slug: "curl-users-me", ext: "sh",
      tpl: (slot, v) => ["curl https://api.notion.com/v1/users/me -H 'Authorization: Bearer ", slot(v), "' -H 'Notion-Version: 2025-09-03'\n"] },
    { axis: "sdk-config", slug: "mcp-server-env", ext: "json",
      tpl: (slot, v) => ["{\n  \"mcpServers\": {\n    \"notion\": {\n      \"command\": \"npx\",\n      \"args\": [\"-y\", \"@notionhq/notion-mcp-server\"],\n      \"env\": { \"NOTION_TOKEN\": \"", slot(v), "\" }\n    }\n  }\n}\n"],
      twins: [{ slug: "mcp-server-env-boundary", kind: "boundary", mutate: v => `Q${v}`,
        mutation: "boundary: a letter glued directly before ntn_, so the prefix is no longer at a token boundary (the value itself is unchanged; the underscore-glued development_ntn_ shape is deliberately not used)" }] },
    { axis: "structured-file", slug: "escaped-openapi-headers", ext: "json",
      tpl: (slot, v) => ["{\n  \"env\": {\n    \"OPENAPI_MCP_HEADERS\": \"{\\\"Authorization\\\": \\\"Bearer ", slot(v), "\\\", \\\"Notion-Version\\\": \\\"2025-09-03\\\"}\"\n  }\n}\n"] },
    { axis: "source-code", slug: "js-client", ext: "js",
      tpl: (slot, v) => ["const { Client } = require('@notionhq/client');\nconst notion = new Client({ auth: \"", slot(v), "\" });\n"],
      twins: [{ slug: "js-client-alphabet", kind: "alphabet", mutate: v => `${v.slice(0, 32)}!${v.slice(33)}`,
        mutation: "alphabet: one character of the alphanumeric run replaced with '!', outside every cited alphabet (including lore's [A-Za-z0-9_-]); the digit run and length are unchanged" }] },
    { axis: "container-config", slug: "compose-mcp", ext: "yml",
      tpl: (slot, v) => ["services:\n  notion-mcp:\n    image: mcp/notion\n    environment:\n      NOTION_TOKEN: ", slot(v), "\n"] },
    { axis: "log", slug: "agent-session-jsonl", ext: "jsonl",
      tpl: (slot, v) => ["{\"type\":\"tool_call\",\"ts\":\"2026-09-24T10:15:02Z\",\"env\":{\"NOTION_API_KEY\":\"", slot(v), "\"},\"tool\":\"notion.search\"}\n"] },
    { axis: "ci-config", slug: "actions-env", ext: "yml",
      tpl: (slot, v) => ["jobs:\n  publish-changelog:\n    env:\n      NOTION_TOKEN: ", slot(v), "\n    steps:\n      - run: node scripts/publish-to-notion.js\n"] },
  ], [
    { axis: "public-id", slug: "page-url", ext: "md",
      parts: [`Roadmap: https://www.notion.so/acme/Launch-plan-${s(NO, "page", "id", 32, HEX)}\n`] },
    { axis: "public-id", slug: "oauth-ids", ext: "json",
      parts: [`{"token_type": "bearer", "bot_id": "${uuid("beta8:211:notion:bot")}", "workspace_id": "${uuid("beta8:211:notion:workspace")}", "workspace_name": "Acme"}\n`] },
    { axis: "public-id", slug: "database-id", ext: "env",
      parts: [`NOTION_DATABASE_ID=${s(NO, "database", "id", 32, HEX)}\n`] },
    { axis: "placeholder", slug: "masked-env", ext: "env",
      parts: ["NOTION_TOKEN=ntn_****\n"] },
    { axis: "placeholder", slug: "words-placeholder", ext: "env",
      parts: ["NOTION_API_KEY=ntn_yourinternalintegrationtokenhere\n"] },
    { axis: "reference", slug: "process-env", ext: "js",
      parts: ["const notion = new Client({ auth: process.env.NOTION_TOKEN });\n"] },
    { axis: "reference", slug: "docker-env-passthrough", ext: "sh",
      parts: ["docker run --rm -i -e NOTION_TOKEN mcp/notion\n"] },
    { axis: "near-miss", slug: "prefix-only", ext: "json",
      parts: ["{ \"NOTION_TOKEN\": \"ntn_\" }\n"] },
    { axis: "prose", slug: "docs-sentence", ext: "md",
      parts: ["Internal connections authenticate with the installation access token from the Configuration tab; newly generated tokens start with ntn_ instead of secret_.\n"] },
  ]);

  return c.fixtures;
}
