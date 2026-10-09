import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #528, slice d (category `beta8-528d`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the RubyGems.org API key (rubygems_ + 48 lowercase hex; handoff redact-secret
// docs/audits/evidence/1014/rubygems.md at 4f220ea; product redact-secret#1023). Every value is built here from a
// public `synthetic` seed. RubyGems sends the key in Authorization without a scheme, so that header is a positive.
// Gemspec metadata keys (rubygems_version, rubygems_mfa_required) and a bare 48-hex value are controls.

export function build528d({ fixture, synthetic }) {
  const c = beta8Corpus("528d", { fixture, synthetic });
  const T = "rubygems-api-key";
  const seed = slug => `beta12:528d:${T}:${slug}`;
  const { check, refuse } = guard("528d", T);
  const key = slug => check(`rubygems_${synthetic(seed(slug), 48, HEX)}`);

  const probe = probeContexts({ env: "GEM_HOST_API_KEY", name: "RubyGems", host: "rubygems.org", ctor: "Gems::Client.new" });
  const actions = v => ["jobs:\n  release:\n    steps:\n      - run: gem push pkg/acme-1.2.0.gem\n        env:\n          GEM_HOST_API_KEY: ", v, "\n"];
  const credentials = v => ["# ~/.gem/credentials\n---\n:rubygems_api_key: ", v, "\n"];
  const gemPush = v => ["GEM_HOST_API_KEY=", v, " gem push pkg/acme-1.2.0.gem\n"];
  const rawAuth = v => ["POST /api/v1/gems HTTP/1.1\nHost: rubygems.org\nAuthorization: ", v, "\nContent-Type: application/octet-stream\n"];
  const contexts = [...probe,
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "structured-file", slug: "gem-credentials-yaml", ext: "yml", build: credentials },
    { axis: "cli", slug: "gem-push-env", ext: "sh", build: gemPush },
    { axis: "header", slug: "authorization-no-scheme", ext: "http", build: rawAuth },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(9);

  c.twin(T, "dotenv", "body-47", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 47-byte body vs exactly 48", "length", "env");
  c.twin(T, "export", "body-49", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, HEX)}`)), "length: a 49-byte body vs exactly 48", "length", "sh");
  c.twin(T, "json-token", "uppercase-hex-byte", put("json-token", refuse(at(k["json-token"], 20, "D"))), "alphabet: one body byte as uppercase hex; SecureRandom.hex is lowercase", "alphabet", "json");
  c.twin(T, "json-api-key", "non-hex-letter", put("json-api-key", refuse(at(k["json-api-key"], 30, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`RUBYGEMS_${body(k["bearer-header"])}`)), "prefix: RUBYGEMS_ vs the lower-case rubygems_", "prefix", "http");
  c.twin(T, "x-api-key-header", "hyphen-separator", put("x-api-key-header", refuse(`rubygems-${body(k["x-api-key-header"])}`)), "prefix: rubygems- in place of the rubygems_ separator", "prefix", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before rubygems_", "boundary", "md");
  c.twin(T, "chat-paste", "trailing-underscore", put("chat-paste", refuse(`${k["chat-paste"]}_x`)), "boundary: _x glued after the 48-hex body", "boundary", "txt");
  c.twin(T, "sdk-kwarg", "trailing-letter", put("sdk-kwarg", refuse(`${k["sdk-kwarg"]}x`)), "boundary: x glued after the 48-hex body", "boundary", "py");

  c.control(T, "public-id", "gemspec-metadata", ["Gem::Specification.new do |spec|\n  spec.metadata[\"rubygems_mfa_required\"] = \"true\"\n  spec.required_rubygems_version = \">= 3.3\"\nend\n"], "rb");
  c.control(T, "public-id", "lockfile-version", ["RUBY VERSION\n   ruby 3.3.4p94\n\nBUNDLED WITH\n   2.5.18\n# rubygems_version: 3.5.18\n"], "lock");
  c.control(T, "encoded-value", "bare-48-hex", [`checksum: ${synthetic(seed("bare"), 48, HEX)}\n`], "yml");
  c.control(T, "near-miss", "truncated", [`2026-09-29T11:40:02Z gem push: rejected truncated key rubygems_${synthetic(seed("short"), 16, HEX)}\n`], "log");
  c.control(T, "placeholder", "credentials-placeholder", ["---\n:rubygems_api_key: rubygems_your_api_key_here\n"], "yml");
  c.control(T, "placeholder", "ellipsis", ["Create a scoped API key (rubygems_...) at rubygems.org/profile/api_keys and set GEM_HOST_API_KEY.\n"], "md");
  c.control(T, "reference", "env-reference", ["GEM_HOST_API_KEY=${GEM_HOST_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["          GEM_HOST_API_KEY: ${{ secrets.RUBYGEMS_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["RubyGems.org API keys start with rubygems_; scope them to push only and enable MFA.\n"], "md");
  return c.fixtures;
}
