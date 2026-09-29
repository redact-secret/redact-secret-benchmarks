import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, LOWER_ALNUM, URLSAFE, at, authorPositives, guard, probeContexts } from "./464-shared.mjs";

// Issue #464, slice e (category `beta8-464e`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Cerebras inference API key (csk- or csk_ + exactly 48 [A-Za-z0-9_-]; handoff redact-secret
// docs/audits/evidence/860/cerebras.md at 8b6a5fd; product redact-secret#975). Every value is built here from a
// public `synthetic` seed. Every probe context carries a positive for both prefixes.
//
// POLICY under ruling R10, not T1: the body alphabet [A-Za-z0-9_-]. The provider validator states only the length;
// tool rules say [a-z0-9], which R8 forbids narrowing to. So some positives are lowercase-alphanumeric only, some
// carry _ and -, and no fixture asserts silence on a byte outside the class (no dot or plus twin). The Pinecone pcsk_
// key is built at run time in its own 6 + _ + 63 shape and is a control, never a Cerebras positive.

const LOWER_SLUGS = new Set(["export", "json-api-key", "bearer-header-underscore", "dotenv-underscore"]);

export function build464e({ fixture, synthetic }) {
  const c = beta8Corpus("464e", { fixture, synthetic });
  const T = "cerebras-api-key";
  const seed = slug => `beta12:464e:${T}:${slug}`;
  const { check, refuse } = guard("464e", T);
  const key = slug => check(`csk${slug.endsWith("underscore") || slug === "python-sdk" ? "_" : "-"}${synthetic(seed(slug), 48, LOWER_SLUGS.has(slug) ? LOWER_ALNUM : URLSAFE)}`);
  const pinecone = slug => `pcsk_${synthetic(seed(`pcsk:${slug}:a`), 6, ALNUM)}_${synthetic(seed(`pcsk:${slug}:b`), 63, ALNUM)}`;

  const probe = probeContexts({ env: "CEREBRAS_API_KEY", name: "Cerebras", host: "api.cerebras.ai", ctor: "Cerebras" });
  const underscored = probe.map(x => ({ ...x, slug: `${x.slug}-underscore` }));
  const openai = v => ["from openai import OpenAI\n\nclient = OpenAI(base_url=\"https://api.cerebras.ai/v1\", api_key=\"", v, "\")\n"];
  const pySdk = v => ["from cerebras.cloud.sdk import Cerebras\n\nclient = Cerebras(api_key=\"", v, "\")\nchat = client.chat.completions.create(model=\"llama3.1-8b\", messages=[])\n"];
  const pineconeNeighbour = v => [`# .env\nPINECONE_API_KEY=${pinecone("neighbour")}\nCEREBRAS_API_KEY=`, v, "\n"];
  const contexts = [...probe, ...underscored,
    { axis: "sdk-config", slug: "openai-compat-underscore", ext: "py", build: openai },
    { axis: "sdk-config", slug: "python-sdk", ext: "py", build: pySdk },
    { axis: "env", slug: "pinecone-neighbour-dotenv", ext: "env", build: pineconeNeighbour },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(4);

  c.twin(T, "dotenv", "body-47", put("dotenv", refuse(k.dotenv.slice(0, -1))), "length: a 47-byte body vs exactly 48", "length", "env");
  c.twin(T, "export", "body-49", put("export", refuse(`${k.export}${synthetic(seed("extra"), 1, LOWER_ALNUM)}`)), "length: a 49-byte body vs exactly 48", "length", "sh");
  c.twin(T, "json-token", "uppercase-prefix", put("json-token", refuse(`CSK-${body(k["json-token"])}`)), "prefix: CSK- vs the lower-case csk- the validator requires", "prefix", "json");
  c.twin(T, "json-api-key", "dot-separator", put("json-api-key", refuse(`csk.${body(k["json-api-key"])}`)), "prefix: csk. in place of the csk- / csk_ separator", "prefix", "json");
  c.twin(T, "bearer-header-underscore", "pinecone-underscore-glue", put("bearer-header-underscore", refuse(`p${k["bearer-header-underscore"]}`)), "boundary: p glued before csk_, so the run reads pcsk_ (Pinecone's prefix)", "boundary", "http");
  c.twin(T, "x-api-key-header", "pinecone-hyphen-glue", put("x-api-key-header", refuse(`p${k["x-api-key-header"]}`)), "boundary: p glued before csk-, so the run reads pcsk-", "boundary", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before csk-", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before csk-", "boundary", "txt");

  c.control(T, "near-miss", "pinecone-key", [`PINECONE_API_KEY=${pinecone("ctl")}\n`], "env");
  c.control(T, "near-miss", "pinecone-hyphen-key", [`index = Pinecone(api_key="${pinecone("ctl-hyphen").replace("pcsk_", "pcsk-")}")\n`], "py");
  c.control(T, "near-miss", "truncated", [`2026-09-29T10:15:04Z cerebras: rejected truncated key csk-${synthetic(seed("short"), 20, LOWER_ALNUM)} (length 24)\n`], "log");
  c.control(T, "near-miss", "prefix-at-eol", ["2026-09-29T10:15:20Z cerebras: expected a key that starts with csk-\n"], "log");
  c.control(T, "placeholder", "your-key-here", ["CEREBRAS_API_KEY=csk-your-key-here\n"], "env");
  c.control(T, "placeholder", "ellipsis", ["Set CEREBRAS_API_KEY to your key (csk_...) from the dashboard.\n"], "md");
  c.control(T, "placeholder", "x-run", ["client = Cerebras(api_key=\"csk-xxxx\")\n"], "py");
  c.control(T, "public-id", "snake-case-name", ["from cerebras_config import csk_client_settings\n\ncsk_client_settings.load()\n"], "py");
  c.control(T, "reference", "env-reference", ["CEREBRAS_API_KEY=${CEREBRAS_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      CEREBRAS_API_KEY: ${{ secrets.CEREBRAS_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["Cerebras inference API keys start with csk-; Pinecone keys start with pcsk_ and are a different credential.\n"], "md");
  return c.fixtures;
}
