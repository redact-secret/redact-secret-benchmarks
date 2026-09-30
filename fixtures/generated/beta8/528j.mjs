import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, authorPositives, guard, probeContexts, uuidOf } from "./528-shared.mjs";

// Issue #528, slice j (category `beta8-528j`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for the Axiom API token (xaat- + lowercase-hex UUID) and personal access token (xapt- + the same body);
// handoff redact-secret docs/audits/evidence/1014/axiom.md at 4f220ea; product redact-secret#1035. Every value is built
// here from a public `synthetic` seed. The prefix is load-bearing: a bare UUID, org ids and xaat-your-api-token style
// placeholders are controls. An uppercase-hex body is outside the contract (not observed in any provider source), so it
// backs a twin; the handoff's recommended issuance check would confirm the layout and case.

export function build528j({ fixture, synthetic }) {
  const c = beta8Corpus("528j", { fixture, synthetic });
  const TA = "axiom-token", TP = "axiom-personal-token";
  const seed = (t, slug) => `beta12:528j:${t}:${slug}`;
  const ga = guard("528j", TA), gp = guard("528j", TP);
  const uuid = (t, slug) => uuidOf(synthetic(seed(t, slug), 32, HEX));
  const api = slug => ga.check(`xaat-${uuid(TA, slug)}`);
  const personal = slug => gp.check(`xapt-${uuid(TP, slug)}`);

  const vector = v => ["[sinks.axiom]\ntype = \"axiom\"\ninputs = [\"app_logs\"]\ndataset = \"app\"\ntoken = \"", v, "\"\n"];
  const fluentBit = v => ["[OUTPUT]\n    Name        http\n    Match       *\n    Host        api.axiom.co\n    URI         /v1/datasets/app/ingest\n    Header      Authorization Bearer ", v, "\n"];
  const otelEnv = v => ["OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co\nOTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ", v, ",X-Axiom-Dataset=traces\n"];
  const grafana = v => ["datasources:\n  - name: Axiom\n    type: postgres\n    url: pg.axiom.co:5432\n    user: service-account\n    secureJsonData:\n      password: ", v, "\n"];
  const probeA = probeContexts({ env: "AXIOM_TOKEN", name: "Axiom", host: "api.axiom.co", ctor: "Axiom" });
  const A = authorPositives(c, TA, [...probeA,
    { axis: "structured-file", slug: "vector-sink", ext: "toml", build: vector },
    { axis: "structured-file", slug: "fluent-bit-output", ext: "conf", build: fluentBit },
    { axis: "env", slug: "otel-env-bearer", ext: "env", build: otelEnv },
    { axis: "container-config", slug: "grafana-password", ext: "yml", build: grafana },
  ], api);

  c.twin(TA, "dotenv", "short-first-group", A.put("dotenv", ga.refuse(A.k.dotenv.slice(0, 5) + A.k.dotenv.slice(6))), "structure: a 7-character first UUID group vs 8", "length", "env");
  c.twin(TA, "export", "long-last-group", A.put("export", ga.refuse(`${A.k.export}${synthetic(seed(TA, "extra"), 1, HEX)}`)), "structure: a 13-character last UUID group vs 12", "length", "sh");
  c.twin(TA, "json-token", "uppercase-hex-byte", A.put("json-token", ga.refuse(at(A.k["json-token"], 7, "A"))), "alphabet: one body byte as uppercase hex, not observed in any provider source", "alphabet", "json");
  c.twin(TA, "json-api-key", "non-hex-letter", A.put("json-api-key", ga.refuse(at(A.k["json-api-key"], 20, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(TA, "bearer-header", "underscore-separator", A.put("bearer-header", ga.refuse(`xaat_${A.k["bearer-header"].slice(5)}`)), "prefix: xaat_ in place of xaat-", "prefix", "http");
  c.twin(TA, "x-api-key-header", "unknown-prefix", A.put("x-api-key-header", ga.refuse(`xabt-${A.k["x-api-key-header"].slice(5)}`)), "prefix: xabt-, a prefix IsValidToken does not accept", "prefix", "http");
  c.twin(TA, "bare-prose", "leading-glue", A.put("bare-prose", ga.refuse(`x${A.k["bare-prose"]}`)), "boundary: x glued before xaat-", "boundary", "md");
  c.twin(TA, "chat-paste", "trailing-underscore", A.put("chat-paste", ga.refuse(`${A.k["chat-paste"]}_x`)), "boundary: _x glued after the UUID", "boundary", "txt");

  c.control(TA, "placeholder", "your-api-token", ["AXIOM_TOKEN=xaat-your-api-token\n"], "env");
  c.control(TA, "placeholder", "x-filled", ["export AXIOM_TOKEN=xaat-xxxxxxxxxx-xxxxxxxxx-xxxxxxx\n"], "sh");
  c.control(TA, "public-id", "bare-uuid", [`X-Request-Id: ${uuid(TA, "request")}\n`], "http");
  c.control(TA, "public-id", "org-and-dataset", ["AXIOM_ORG_ID=acme-q7k2\nAXIOM_DATASET=app-logs\n"], "env");
  c.control(TA, "near-miss", "truncated", [`2026-09-29T12:30:10Z vector: rejected truncated token xaat-${synthetic(seed(TA, "short"), 8, HEX)}\n`], "log");
  c.control(TA, "reference", "env-reference", ["AXIOM_TOKEN=${AXIOM_TOKEN}\n"], "env");
  c.control(TA, "reference", "vector-env-interpolation", ["[sinks.axiom]\ntype = \"axiom\"\ntoken = \"${AXIOM_TOKEN}\"\n"], "toml");
  c.control(TA, "prose", "token-guidance", ["Axiom API tokens start with xaat- and personal access tokens with xapt-; a bare UUID is not a token.\n"], "md");

  const cliConfig = v => ["# ~/.axiom.toml\nactive_deployment = \"axiom\"\n\n[deployments.axiom]\nurl = \"https://api.axiom.co\"\ntoken = \"", v, "\"\norg_id = \"acme-q7k2\"\n"];
  const orgPair = v => ["AXIOM_ORG_ID=acme-q7k2\nAXIOM_TOKEN=", v, "\n"];
  const probeP = probeContexts({ env: "AXIOM_TOKEN", name: "Axiom personal", host: "api.axiom.co", ctor: "Axiom" });
  const P = authorPositives(c, TP, [...probeP,
    { axis: "structured-file", slug: "cli-config", ext: "toml", build: cliConfig },
    { axis: "env", slug: "org-id-pair", ext: "env", build: orgPair },
  ], personal);

  c.twin(TP, "dotenv", "missing-hyphen", P.put("dotenv", gp.refuse(P.k.dotenv.slice(0, 13) + P.k.dotenv.slice(14))), "structure: the UUID with its first - removed", "length", "env");
  c.twin(TP, "export", "long-last-group", P.put("export", gp.refuse(`${P.k.export}${synthetic(seed(TP, "extra"), 1, HEX)}`)), "structure: a 13-character last UUID group vs 12", "length", "sh");
  c.twin(TP, "json-token", "uppercase-hex-byte", P.put("json-token", gp.refuse(at(P.k["json-token"], 9, "B"))), "alphabet: one body byte as uppercase hex", "alphabet", "json");
  c.twin(TP, "bearer-header", "underscore-separator", P.put("bearer-header", gp.refuse(`xapt_${P.k["bearer-header"].slice(5)}`)), "prefix: xapt_ in place of xapt-", "prefix", "http");
  c.twin(TP, "bare-prose", "leading-glue", P.put("bare-prose", gp.refuse(`x${P.k["bare-prose"]}`)), "boundary: x glued before xapt-", "boundary", "md");
  c.twin(TP, "chat-paste", "trailing-hyphen", P.put("chat-paste", gp.refuse(`${P.k["chat-paste"]}-x`)), "boundary: -x glued after the UUID", "boundary", "txt");

  c.control(TP, "placeholder", "your-personal-token", ["AXIOM_TOKEN=xapt-your-personal-token\n"], "env");
  c.control(TP, "placeholder", "ellipsis", ["Create a personal access token (xapt-...) under Profile and pass it with your org id.\n"], "md");
  c.control(TP, "public-id", "trace-id-uuid", [`{"trace_id": "${uuid(TP, "trace")}", "status": "ok"}\n`], "json");
  c.control(TP, "public-id", "org-id-header", ["x-axiom-org-id: acme-q7k2\n"], "http");
  c.control(TP, "near-miss", "truncated", [`2026-09-29T12:31:40Z cli: rejected truncated token xapt-${synthetic(seed(TP, "short"), 13, HEX)}\n`], "log");
  c.control(TP, "reference", "env-reference", ["AXIOM_TOKEN=${AXIOM_PERSONAL_TOKEN}\n"], "env");
  c.control(TP, "reference", "actions-secret", ["          AXIOM_TOKEN: ${{ secrets.AXIOM_PERSONAL_TOKEN }}\n"], "yml");
  c.control(TP, "prose", "token-guidance", ["An Axiom personal access token carries the user's full access; prefer an API token scoped to one dataset.\n"], "md");
  return c.fixtures;
}
