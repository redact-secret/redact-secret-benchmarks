import { beta8Corpus } from "./helpers.mjs";
import { ALNUM, URLSAFE, HEX, at, authorPositives, guard, probeContexts } from "./464-shared.mjs";

// Issue #464, slice c (category `beta8-464c`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the NVIDIA API key (nvapi- + at least 60 [A-Za-z0-9_-], open-ended; handoff redact-secret
// docs/audits/evidence/860/nvidia.md at 8b6a5fd; product redact-secret#972). Every value is built here from a public
// `synthetic` seed; bodies are 60 (the provider floor), 64 (trufflehog's exact width), 70 and 128 (the cap).
//
// POLICY, not T1: the 128-byte upper bound. The provider rule is open-ended, so a body over 128 is not authored
// either way (no 129 twin). The legacy prefixless 84-character NGC key is another credential class and is not
// authored. A dot in the body is a twin only where it leaves no run of 60 or more, which holds under every rule.

export function build464c({ fixture, synthetic }) {
  const c = beta8Corpus("464c", { fixture, synthetic });
  const T = "nvidia-api-key";
  const seed = slug => `beta12:464c:${T}:${slug}`;
  const { check, refuse } = guard("464c", T);
  const width = { "json-token": 60, "chat-nvidia": 70, "curl-bearer": 128, "openai-compat": 60 };
  const key = slug => check(`nvapi-${synthetic(seed(slug), width[slug] ?? 64, URLSAFE)}`);

  const probe = probeContexts({ env: "NVIDIA_API_KEY", name: "NVIDIA", host: "integrate.api.nvidia.com", ctor: "ChatNVIDIA" });
  const chat = v => ["from langchain_nvidia_ai_endpoints import ChatNVIDIA\n\nllm = ChatNVIDIA(model=\"meta/llama-3.1-70b-instruct\", api_key=\"", v, "\")\n"];
  const openai = v => ["from openai import OpenAI\n\nclient = OpenAI(base_url=\"https://integrate.api.nvidia.com/v1\", api_key=\"", v, "\")\n"];
  const ngcEnv = v => ["# .env\nNGC_API_KEY=", v, "\nNIM_CACHE_PATH=/opt/nim/.cache\n"];
  const curl = v => ["curl -s https://integrate.api.nvidia.com/v1/chat/completions -H \"Authorization: Bearer ", v, "\" -H \"Content-Type: application/json\"\n"];
  const dockerLogin = v => ["echo \"", v, "\" | docker login nvcr.io --username '$oauthtoken' --password-stdin\n"];
  const contexts = [...probe,
    { axis: "sdk-config", slug: "chat-nvidia", ext: "py", build: chat },
    { axis: "sdk-config", slug: "openai-compat", ext: "py", build: openai },
    { axis: "env", slug: "dotenv-ngc", ext: "env", build: ngcEnv },
    { axis: "cli", slug: "curl-bearer", ext: "sh", build: curl },
    { axis: "cli", slug: "docker-login-stdin", ext: "sh", build: dockerLogin },
  ];
  const { k, put } = authorPositives(c, T, contexts, key);
  const body = v => v.slice(6);

  c.twin(T, "dotenv", "body-59", put("dotenv", refuse(k.dotenv.slice(0, 6 + 59))), "length: a 59-byte body, one below the provider floor of 60", "length", "env");
  c.twin(T, "export", "dot-in-body", put("export", refuse(at(k.export, 6 + 30, "."))), "alphabet: one body byte replaced by ., leaving a 30 and a 33-byte run, both under the floor", "alphabet", "sh");
  c.twin(T, "bearer-header", "uppercase-prefix", put("bearer-header", refuse(`NVAPI-${body(k["bearer-header"])}`)), "prefix: NVAPI- vs the lower-case nvapi- the provider constant requires", "prefix", "http");
  c.twin(T, "x-api-key-header", "underscore-prefix", put("x-api-key-header", refuse(`nvapi_${body(k["x-api-key-header"])}`)), "boundary: nvapi_ in place of the nvapi- separator", "boundary", "http");
  c.twin(T, "bare-prose", "leading-glue", put("bare-prose", refuse(`x${k["bare-prose"]}`)), "boundary: x glued before nvapi-", "boundary", "md");
  c.twin(T, "chat-paste", "leading-underscore", put("chat-paste", refuse(`_${k["chat-paste"]}`)), "boundary: _ glued before nvapi-", "boundary", "txt");

  c.control(T, "public-id", "sdk-crate-names", ["[dependencies]\nnvapi-sys = \"0.1\"\nnvapi-rs = { git = \"https://example.test/nvapi-rs\" }\n"], "toml");
  c.control(T, "public-id", "sdk-package-name", ["pip install nvapi-sys-bindings nvapi-wrapper\n"], "sh");
  c.control(T, "placeholder", "ellipsis", ["Set NVIDIA_API_KEY to your key (nvapi-...) from build.nvidia.com.\n"], "md");
  c.control(T, "placeholder", "x-run", ["NVIDIA_API_KEY=nvapi-xxxx\n"], "env");
  c.control(T, "placeholder", "your-key", ["api_key = \"nvapi-<your-key>\"\n"], "py");
  c.control(T, "near-miss", "body-59", [`2026-09-29T10:13:01Z nim: rejected short key nvapi-${synthetic(seed("short59"), 59, URLSAFE)} (length 65)\n`], "log");
  c.control(T, "near-miss", "prefix-at-eol", ["2026-09-29T10:13:12Z nim: expected a key that starts with nvapi-\n"], "log");
  c.control(T, "near-miss", "other-prefix-64", [`token: nvsdk-${synthetic(seed("other-prefix"), 64, URLSAFE)}\n`], "yml");
  c.control(T, "reference", "env-reference", ["NVIDIA_API_KEY=${NVIDIA_API_KEY}\n"], "env");
  c.control(T, "reference", "actions-secret", ["      NGC_API_KEY: ${{ secrets.NGC_API_KEY }}\n"], "yml");
  c.control(T, "prose", "key-guidance", ["NVIDIA API keys typically start with nvapi- and are issued as NGC Personal, NGC Service or build.nvidia.com keys.\n"], "md");
  return c.fixtures;
}
