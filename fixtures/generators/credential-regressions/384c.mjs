import { beta8Corpus } from "./helpers.mjs";
import { contracts } from "../../../benchmarks/lib/assessment.ts";

// Issue #384, slice c (category `beta8-384c`). See docs/specs/beta8-evidence.md.
//
// Beta.10 corpus for the ElevenLabs API key (research redact-secret#788; product
// redact-secret#865). Every credential-shaped value is built here from a public `synthetic`
// seed: sk_ + 48 lowercase hex. Nothing is copied from an SDK docstring, a scanner report or an
// issued key, and the finished values exist only in the gitignored generated corpus. The Stripe
// twin's sk_live_ value is assembled from a synthetic body at generation time, so no
// Stripe-shaped literal is committed.
//
// Deliberately not authored (see benchmarks/lib/credential-regressions/384c.ts field claims):
//   - a length or non-hex-alphabet twin of the body: the 2026-09-27 maintainer ruling (redact-secret#788) leaves the 48-hex body
//     T2, so the three body twins are recorded in DISPUTED_PROPERTIES and read unmeasured; the twins here mutate the T1 prefix or
//     boundary only;
//   - uppercase hex as a negative: trufflehog v2 and betterleaks disagree and no provider
//     source decides it;
//   - a bare 32-hex legacy key either way, and a Pollinations sk_ + 32 value as a control: the
//     first has tool-only evidence, the second is a plan, not a shipped format;
//   - an empty _residency_ suffix as a twin: whether the suffix belongs in the finding is the
//     product's decision, so the residency positive carries it as an envelope only.

const HEX = "0123456789abcdef";
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const RESIDENCY = "Quoted assignment: key name and enclosing quotes are not secret, and neither is the _residency_<region> label a data-residency key carries after the key, but redacting them with the value is acceptable.";

export function build384c({ fixture, synthetic }) {
  const c = beta8Corpus("384c", { fixture, synthetic });
  const seed = (slug) => `beta10:384c:elevenlabs-api-key:${slug}`;
  const T = "elevenlabs-api-key";
  const check = value => {
    if (!new RegExp(contracts[T].pattern).test(value)) throw new Error(`beta8-384c: authored positive fails its own contract: ${value.slice(0, 5)}...`);
    return value;
  };
  const refuse = value => {
    if (new RegExp(contracts[T].pattern).test(value)) throw new Error("beta8-384c: twin value still satisfies the contract");
    return value;
  };
  const hex = (slug, n = 48) => synthetic(seed(slug), n, HEX);
  const key = slug => check(`sk_${hex(slug)}`);
  const mid = (value, index, ch) => value.slice(0, index) + ch + value.slice(index + 1);
  const k = Object.fromEntries(["bare", "dotenv", "export", "yaml", "curl", "python", "python-multi", "js", "tool", "residency"].map(s => [s, key(s)]));

  const dotenv = v => ["# .env\nELEVENLABS_API_KEY=", v, "\nELEVENLABS_VOICE=rachel\n"];
  const exportLine = v => ["export XI_API_KEY=\"", v, "\"\n"];
  const yaml = v => ["tts:\n  provider: elevenlabs\n  api_key: ", v, "\n  model: eleven_multilingual_v2\n"];
  const curl = v => ["curl -s https://api.elevenlabs.io/v1/user -H \"xi-api-key: ", v, "\"\n"];
  const python = v => ["from elevenlabs import ElevenLabs\n\nclient = ElevenLabs(api_key=\"", v, "\")\n"];
  const pythonMulti = v => ["from elevenlabs.client import ElevenLabs\n\nclient = ElevenLabs(\n    api_key=\"", v, "\",\n)\n"];
  const js = v => ["import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';\n\nconst client = new ElevenLabsClient({ apiKey: '", v, "' });\n"];
  const tool = v => ["{\"tool\": \"bash\", \"arguments\": {\"command\": \"curl -s https://api.elevenlabs.io/v1/voices -H 'xi-api-key: ", v, "'\"}}\n"];
  const bare = v => ["Here is the key for the studio account, rotate it once the demo is over:\n", v, "\n"];

  c.positive(T, "prose", "pasted-key", bare({ secret: k.bare }), "txt");
  c.positive(T, "env", "dotenv", dotenv({ secret: k.dotenv }), "env");
  c.positive(T, "shell-export", "export-xi-api-key", exportLine({ secret: k.export }), "sh");
  c.positive(T, "structured-file", "yaml-config", yaml({ secret: k.yaml }), "yml");
  c.positive(T, "header", "curl-xi-api-key", curl({ secret: k.curl }), "sh");
  c.positive(T, "sdk-config", "python-single-line", python({ secret: k.python }), "py");
  c.positive(T, "sdk-config", "python-multi-line", pythonMulti({ secret: k["python-multi"] }), "py");
  c.positive(T, "source-code", "js-client", js({ secret: k.js }), "ts");
  c.positive(T, "tool-output", "tool-call", tool({ secret: k.tool }), "json");
  c.positive(T, "env", "residency-suffix", ["# .env (EU isolated environment)\n", { secret: k.residency, envelope: { before: "ELEVENLABS_API_KEY=\"", after: "_residency_eu\"", reason: RESIDENCY } }, "\nELEVENLABS_API_URL=https://api.eu.residency.elevenlabs.io\n"], "env");

  c.twin(T, "dotenv", "short-body", dotenv(refuse(k.dotenv.slice(0, 50))), "length: 47 hex characters vs the 48 the tools and samples corroborate", "length", "env");
  c.twin(T, "export-xi-api-key", "long-body", exportLine(refuse(`${k.export}${hex("export:extra", 1)}`)), "length: 49 hex characters vs the 48 the tools and samples corroborate", "length", "sh");
  c.twin(T, "curl-xi-api-key", "non-hex-body", curl(refuse(mid(k.curl, 10, "g"))), "alphabet: one body character replaced by g, outside the lowercase-hex alphabet", "alphabet", "sh");
  c.twin(T, "python-single-line", "stripe-shaped", python(refuse(`sk_live_${synthetic(seed("stripe-body"), 32, ALNUM)}`)), "prefix: the Stripe live-key shape (sk_live_ + 32 alphanumerics, a documented Stripe key type) in place of sk_ + 48 hex", "prefix", "py");
  c.twin(T, "yaml-config", "ak-prefix", yaml(refuse(`ak_${k.yaml.slice(3)}`)), "prefix: ak_ in place of sk_", "prefix", "yml");
  c.twin(T, "js-client", "embedded-leading", js(refuse(`x${k.js}`)), "boundary: one identifier character before sk_, so the key is embedded in a longer token", "boundary", "ts");
  c.twin(T, "tool-call", "missing-underscore", tool(refuse(`sk${k.tool.slice(3)}`)), "prefix: the underscore after sk removed", "prefix", "json");
  // Research redact-secret#788 lists pk_ (Pollinations' planned publishable prefix), a hyphen in place of the underscore and the Stripe test-key
  // family as one-property prefix twins. They mutate only the T1 prefix, so they survive the 2026-09-27 ruling that leaves the body T2.
  c.twin(T, "dotenv", "pk-prefix", dotenv(refuse(`pk_${k.dotenv.slice(3)}`)), "prefix: pk_ in place of sk_ (a publishable-key stem another issuer plans, never an ElevenLabs key)", "prefix", "env");
  c.twin(T, "curl-xi-api-key", "hyphen-prefix", curl(refuse(`sk-${k.curl.slice(3)}`)), "prefix: sk- in place of sk_ (the OpenAI and Anthropic stem)", "prefix", "sh");
  c.twin(T, "js-client", "stripe-test-shaped", js(refuse(`sk_test_${synthetic(seed("stripe-test-body"), 24, ALNUM)}`)), "prefix: the Stripe test-key shape (sk_test_ + 24 alphanumerics, a documented Stripe key type) in place of sk_ + 48 hex", "prefix", "ts");

  c.control(T, "placeholder", "your-api-key", ["ELEVENLABS_API_KEY=sk_your_api_key_here\n"], "env");
  c.control(T, "placeholder", "docs-ellipsis", ["client = ElevenLabs(api_key=\"sk_...\")\n"], "py");
  c.control(T, "placeholder", "masked-stars", [`ELEVENLABS_API_KEY=sk_${"*".repeat(48)}\n`], "env");
  c.control(T, "reference", "env-reference", ["ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}\n"], "env");
  c.control(T, "prose", "residency-hosts", ["Isolated environments use a different API URL and a different API key: api.eu.residency.elevenlabs.io, api.in.residency.elevenlabs.io and api.sg.residency.elevenlabs.io.\n"], "md");
  c.control(T, "public-id", "key-hint", [`{"name": "studio", "hint": "sk_****${hex("hint", 4)}", "is_disabled": false}\n`], "json");
  c.control(T, "public-id", "key-id", [`{"key_id": "${synthetic(seed("key-id"), 32, ALNUM)}", "name": "studio"}\n`], "json");
  c.control(T, "public-id", "voice-id", [`voice_id: ${synthetic(seed("voice-id"), 20, ALNUM)}\nmodel_id: eleven_multilingual_v2\n`], "yml");
  c.control(T, "near-miss", "unprefixed-hex", [`build_checksum=${hex("checksum")}\n`], "env");
  c.control(T, "encoded-value", "hashed-key", [`{"hashed_xi_api_key": "${hex("hashed", 64)}"}\n`], "json");
  return c.fixtures;
}
