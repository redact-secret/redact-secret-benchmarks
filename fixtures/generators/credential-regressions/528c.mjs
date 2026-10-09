import { beta8Corpus } from "./helpers.mjs";
import { HEX, at, authorPositives, guard, probeContexts } from "./528-shared.mjs";

// Issue #528, slice c (category `beta8-528c`). See docs/specs/beta8-evidence.md.
//
// Beta.12 corpus for SonarQube Server user tokens (squ_ + 40 lowercase hex) and analysis tokens (sqa_/sqp_ + 40
// lowercase hex); handoff redact-secret docs/audits/evidence/1014/sonarqube.md at 4f220ea; product redact-secret#1021.
// Every value is built here from a public `synthetic` seed.
//
// sqb_ project badge tokens are public in README badge URLs by design (Q5) and a bare 40-hex git SHA is the body
// without its prefix: both are controls, never positives. Unprefixed legacy tokens and SonarQube Cloud sqco_ tokens are
// credentials outside these families and are authored neither way.

export function build528c({ fixture, synthetic }) {
  const c = beta8Corpus("528c", { fixture, synthetic });
  const TU = "sonarqube-token", TA = "sonarqube-analysis-token";
  const seed = (t, slug) => `beta12:528c:${t}:${slug}`;
  const gu = guard("528c", TU), ga = guard("528c", TA);
  const user = slug => gu.check(`squ_${synthetic(seed(TU, slug), 40, HEX)}`);
  const analysis = slug => ga.check(`${/^(dotenv|bearer-header|json-token|sdk-kwarg|actions-env)$/.test(slug) ? "sqa" : "sqp"}_${synthetic(seed(TA, slug), 40, HEX)}`);
  const hex40 = (t, slug) => synthetic(seed(t, slug), 40, HEX);

  const host = "sonarqube.example.test";
  const actions = v => ["jobs:\n  sonar:\n    steps:\n      - uses: SonarSource/sonarqube-scan-action@v5\n        env:\n          SONAR_TOKEN: ", v, `\n          SONAR_HOST_URL: https://${host}\n`];
  const scanner = v => [`sonar-scanner -Dsonar.projectKey=payments -Dsonar.host.url=https://${host} -Dsonar.token=`, v, "\n"];
  const scannerLogin = v => [`sonar-scanner -Dsonar.projectKey=payments -Dsonar.host.url=https://${host} -Dsonar.login=`, v, "\n"];
  const properties = v => ["# sonar-project.properties\nsonar.projectKey=payments\nsonar.token=", v, "\n"];
  const gradle = v => ["# gradle.properties\nsystemProp.sonar.host.url=https://sonarqube.example.test\nsystemProp.sonar.token=", v, "\n"];

  const probeU = probeContexts({ env: "SONAR_TOKEN", name: "SonarQube", host, ctor: "SonarQubeClient" });
  const U = authorPositives(c, TU, [...probeU,
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "cli", slug: "scanner-token-flag", ext: "sh", build: scanner },
    { axis: "cli", slug: "scanner-login-flag", ext: "sh", build: scannerLogin },
    { axis: "structured-file", slug: "project-properties", ext: "properties", build: properties },
    { axis: "structured-file", slug: "gradle-system-prop", ext: "properties", build: gradle },
  ], user);
  const uBody = v => v.slice(4);

  c.twin(TU, "dotenv", "body-39", U.put("dotenv", gu.refuse(U.k.dotenv.slice(0, -1))), "length: a 39-byte body vs exactly 40", "length", "env");
  c.twin(TU, "export", "body-41", U.put("export", gu.refuse(`${U.k.export}${synthetic(seed(TU, "extra"), 1, HEX)}`)), "length: a 41-byte body vs exactly 40", "length", "sh");
  c.twin(TU, "json-token", "uppercase-hex-byte", U.put("json-token", gu.refuse(at(U.k["json-token"], 12, "B"))), "alphabet: one body byte as uppercase hex; Hex.encodeHexString is lowercase", "alphabet", "json");
  c.twin(TU, "json-api-key", "non-hex-letter", U.put("json-api-key", gu.refuse(at(U.k["json-api-key"], 20, "g"))), "alphabet: one body byte replaced by g, outside hex", "alphabet", "json");
  c.twin(TU, "bearer-header", "unknown-type-letter", U.put("bearer-header", gu.refuse(`sqx_${uBody(U.k["bearer-header"])}`)), "prefix: sqx_, a type letter TokenType does not define", "prefix", "http");
  c.twin(TU, "x-api-key-header", "uppercase-prefix", U.put("x-api-key-header", gu.refuse(`SQU_${uBody(U.k["x-api-key-header"])}`)), "prefix: SQU_ vs the lower-case squ_", "prefix", "http");
  c.twin(TU, "bare-prose", "leading-glue", U.put("bare-prose", gu.refuse(`x${U.k["bare-prose"]}`)), "boundary: x glued before squ_", "boundary", "md");
  c.twin(TU, "chat-paste", "leading-underscore", U.put("chat-paste", gu.refuse(`_${U.k["chat-paste"]}`)), "boundary: _ glued before squ_", "boundary", "txt");
  c.twin(TU, "sdk-kwarg", "trailing-underscore", U.put("sdk-kwarg", gu.refuse(`${U.k["sdk-kwarg"]}_x`)), "boundary: _x glued after the 40-hex body", "boundary", "py");

  c.control(TU, "public-id", "badge-token-url", [`[![Quality Gate](https://${host}/api/project_badges/measure?project=payments&metric=alert_status&token=sqb_${hex40(TU, "badge")})](https://${host}/dashboard?id=payments)\n`], "md");
  c.control(TU, "encoded-value", "git-sha", [`commit ${hex40(TU, "sha")}\nAuthor: CI <ci@example.test>\n`], "txt");
  c.control(TU, "encoded-value", "sha1-checksum", [`${hex40(TU, "sha1sum")}  sonar-scanner-cli-6.2.zip\n`], "txt");
  c.control(TU, "near-miss", "truncated", [`2026-09-29T11:30:12Z scanner: rejected truncated token squ_${synthetic(seed(TU, "short"), 12, HEX)}\n`], "log");
  c.control(TU, "placeholder", "ellipsis", ["Generate a user token (squ_...) under My Account > Security and set SONAR_TOKEN.\n"], "md");
  c.control(TU, "placeholder", "x-run", ["sonar.token=squ_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n"], "properties");
  c.control(TU, "reference", "actions-secret", ["          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}\n"], "yml");
  c.control(TU, "reference", "env-reference", ["SONAR_TOKEN=${SONAR_TOKEN}\n"], "env");
  c.control(TU, "prose", "token-guidance", ["SonarQube user tokens start with squ_; project badge tokens start with sqb_ and are meant to be public.\n"], "md");

  const probeA = probeContexts({ env: "SONAR_TOKEN", name: "SonarQube analysis", host, ctor: "SonarQubeClient" });
  const A = authorPositives(c, TA, [...probeA,
    { axis: "ci-config", slug: "actions-env", ext: "yml", build: actions },
    { axis: "cli", slug: "scanner-token-flag", ext: "sh", build: scanner },
    { axis: "structured-file", slug: "project-properties", ext: "properties", build: properties },
  ], analysis);
  const aBody = v => v.slice(4);

  c.twin(TA, "dotenv", "body-39", A.put("dotenv", ga.refuse(A.k.dotenv.slice(0, -1))), "length: a 39-byte body vs exactly 40", "length", "env");
  c.twin(TA, "export", "body-41", A.put("export", ga.refuse(`${A.k.export}${synthetic(seed(TA, "extra"), 1, HEX)}`)), "length: a 41-byte body vs exactly 40", "length", "sh");
  c.twin(TA, "json-token", "uppercase-hex-byte", A.put("json-token", ga.refuse(at(A.k["json-token"], 15, "C"))), "alphabet: one body byte as uppercase hex", "alphabet", "json");
  c.twin(TA, "x-api-key-header", "hyphen-separator", A.put("x-api-key-header", ga.refuse(`sqp-${aBody(A.k["x-api-key-header"])}`)), "prefix: sqp- in place of the sqp_ separator", "prefix", "http");
  c.twin(TA, "bearer-header", "uppercase-prefix", A.put("bearer-header", ga.refuse(`SQA_${aBody(A.k["bearer-header"])}`)), "prefix: SQA_ vs the lower-case sqa_", "prefix", "http");
  c.twin(TA, "bare-prose", "leading-glue", A.put("bare-prose", ga.refuse(`x${A.k["bare-prose"]}`)), "boundary: x glued before sqp_", "boundary", "md");
  c.twin(TA, "chat-paste", "trailing-hyphen", A.put("chat-paste", ga.refuse(`${A.k["chat-paste"]}-x`)), "boundary: -x glued after the 40-hex body", "boundary", "txt");

  c.control(TA, "public-id", "badge-token-markdown", [`![Coverage](https://${host}/api/project_badges/measure?project=ledger&metric=coverage&token=sqb_${hex40(TA, "badge")})\n`], "md");
  c.control(TA, "public-id", "project-key", ["sonar.projectKey=sqa_reporting_service\nsonar.projectName=Reporting\n"], "properties");
  c.control(TA, "encoded-value", "git-sha", [`Merge ${hex40(TA, "sha")} into main\n`], "txt");
  c.control(TA, "near-miss", "truncated", [`2026-09-29T11:31:40Z scanner: rejected truncated token sqp_${synthetic(seed(TA, "short"), 16, HEX)}\n`], "log");
  c.control(TA, "placeholder", "ellipsis", ["Use a project analysis token (sqp_...) for a single project, or a global analysis token (sqa_...).\n"], "md");
  c.control(TA, "placeholder", "angle-brackets", ["sonar-scanner -Dsonar.token=<your-analysis-token>\n"], "sh");
  c.control(TA, "reference", "actions-secret", ["          SONAR_TOKEN: ${{ secrets.SONAR_ANALYSIS_TOKEN }}\n"], "yml");
  c.control(TA, "reference", "gradle-reference", ["systemProp.sonar.token=${SONAR_TOKEN}\n"], "properties");
  c.control(TA, "prose", "token-guidance", ["SonarQube analysis tokens start with sqa_ (global) or sqp_ (one project) and can only submit analysis.\n"], "md");
  return c.fixtures;
}
