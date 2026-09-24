import { createHmac } from "node:crypto";
import { crc32 } from "node:zlib";
import { beta8Corpus } from "./helpers.mjs";

// Issue #213, corpus key 213c (category `beta8-213c`). See docs/specs/beta8-evidence.md.
//
// Two jobs, one corpus:
//   1. Restore nine T1 documented families that were stable at beta.7 and are
//      provisional under the Beta.8 criteria only for fixture-profile debt
//      (docs/reports/2026-09-24-beta8-213-portfolio.md): grafana-service-account-token,
//      jwt, netlify-token, new-relic-license-key, new-relic-user-api-key,
//      pulumi-access-token, supabase-management-token, terraform-cloud-token and
//      vault-token. They gain positives on new source contexts and controls on
//      new confusion axes. Their twin pairs already clear the floor, so no twin is added.
//   2. Author the untwinned positives the #206 `stable-documented` cell still
//      lacks for azure-devops-personal-access-token, datadog-application-key,
//      notion-token, google-api-key, heroku-api-key and confluent-cloud-api-secret
//      (#209 re-measure). anthropic-token already meets the cell and gets nothing.
//
// Every value is synthetic (`synthetic()` seeds) or independently constructed here
// (JWT HMAC signatures over a synthetic key; the Confluent CRC32 checksum, from the
// algorithm docs.confluent.io publishes). No value is provider-issued or scanner-
// reported. Expectations come from each contract in benchmarks/lib/assessment.ts.
// Scoping choices: heroku uses only the 65-character HRKU-AA generation (the
// 41-character HRKU-<uuid> generation is redact-secret#740, already measured by
// beta8-209); google avoids firebaseConfig contexts (redact-secret#520 B3a decision
// pending); no new-relic-license-key positive uses the EU eu01xx region form.

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const BASE64 = `${ALNUM}+/`;
const URLSAFE = `${ALNUM}_-`;
const HEX = "0123456789abcdef";
const DIGITS = "0123456789";
const UPPER_DIGIT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LOWER_ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const NETLIFY_BODY = `${ALNUM}_`;
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";

/** docs.confluent.io's snippet: CRC32 of the 54 body characters (prefix excluded), little-endian, standard Base64, first 6. */
const cfltChecksum = body => { const b = Buffer.alloc(4); b.writeUInt32LE(crc32(Buffer.from(body, "ascii"))); return b.toString("base64").slice(0, 6); };
const b64url = value => Buffer.from(value).toString("base64url");

export function build213c({ fixture, synthetic }) {
  const c = beta8Corpus("213c", { fixture, synthetic });
  const seed = (target, slug) => `beta8:213c:${target}:${slug}`;
  const uuid = label => { const h = synthetic(label, 32, HEX); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
  const bearer = v => ({ secret: v, envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } });

  // ---------------------------------------------------------------- grafana glsa_
  {
    const T = "grafana-service-account-token";
    // Grafana documents the glsa prefix; 32 alphanumerics, "_" and 8 hex are tool-corroborated.
    const token = slug => `glsa_${synthetic(seed(T, slug), 32)}_${synthetic(seed(T, `${slug}-tail`), 8, HEX)}`;
    c.positive(T, "env", "env-service-account-token", ["GRAFANA_URL=https://grafana.example.internal\nGRAFANA_SERVICE_ACCOUNT_TOKEN=", { secret: token("env") }, "\n"], "env");
    c.positive(T, "header", "http-api-bearer", ["GET /api/search?type=dash-db HTTP/1.1\nHost: grafana.example.internal\n", bearer(token("header")), "\nAccept: application/json\n"], "http");
    c.positive(T, "sdk-config", "terraform-provider", ['provider "grafana" {\n  url  = "https://grafana.example.internal"\n  auth = "', { secret: token("terraform") }, '"\n}\n'], "tf");
    c.positive(T, "container-config", "compose-renderer-env", ["services:\n  dashboard-sync:\n    image: registry.example.internal/dashboard-sync:1.4\n    environment:\n      GRAFANA_API_URL: https://grafana.example.internal\n      GRAFANA_TOKEN: ", { secret: token("compose") }, "\n"], "yml");
    c.positive(T, "ci-config", "github-actions-dashboards", ["jobs:\n  publish-dashboards:\n    runs-on: ubuntu-latest\n    env:\n      GRAFANA_AUTH: ", { secret: token("ci") }, "\n    steps:\n      - run: grr apply dashboards/\n"], "yml");
    c.positive(T, "source-code", "python-requests-client", ['import requests\n\nsession = requests.Session()\nsession.headers["Authorization"] = "Bearer ', { secret: token("python") }, '"\nsession.get("https://grafana.example.internal/api/folders")\n'], "py");
    c.control(T, "public-id", "service-account-listing", [`GET /api/serviceaccounts/search\n{"totalCount":1,"serviceAccounts":[{"id":${synthetic(seed(T, "sa-id"), 3, DIGITS)},"uid":"${synthetic(seed(T, "sa-uid"), 14, LOWER_ALNUM)}","name":"dashboard-sync","login":"sa-1-dashboard-sync","orgId":1,"role":"Editor","tokens":1}]}\n`], "json");
    c.control(T, "encoded-value", "audit-token-hash", [`logger=accesscontrol t=2026-09-20T12:00:00Z level=info msg="service account token rotated" serviceAccountId=7 tokenName=dashboard-sync hash_sha256=${synthetic(seed(T, "hash"), 64, HEX)}\n`], "log");
    c.control(T, "prose", "rotation-note", ["Grafana service account tokens start with glsa_. Give each automation its own service account and rotate its token when the owner changes teams.\n"]);
  }

  // ---------------------------------------------------------------- new relic NRAK-
  {
    const T = "new-relic-user-api-key";
    // New Relic: most user keys begin with NRAK-; 27 of [A-Z0-9] are tool-corroborated.
    const key = slug => `NRAK-${synthetic(seed(T, slug), 27, UPPER_DIGIT)}`;
    c.positive(T, "header", "nerdgraph-api-key-header", ["POST /graphql HTTP/1.1\nHost: api.newrelic.com\nContent-Type: application/json\nAPI-Key: ", { secret: key("header") }, '\n\n{"query":"{ actor { user { name } } }"}\n'], "http");
    c.positive(T, "env", "env-api-key", ["NEW_RELIC_ACCOUNT_ID=", synthetic(seed(T, "env-account"), 7, DIGITS), "\nNEW_RELIC_API_KEY=", { secret: key("env") }, "\nNEW_RELIC_REGION=US\n"], "env");
    c.positive(T, "sdk-config", "terraform-provider", ['provider "newrelic" {\n  account_id = ', synthetic(seed(T, "tf-account"), 7, DIGITS), '\n  api_key    = "', { secret: key("terraform") }, '"\n  region     = "US"\n}\n'], "tf");
    c.positive(T, "cli", "newrelic-profiles-add", ["$ newrelic profiles add --profile ops --region us --apiKey ", { secret: key("cli") }, " --accountId ", synthetic(seed(T, "cli-account"), 7, DIGITS), "\n"], "sh");
    c.positive(T, "ci-config", "gitlab-ci-variables", ["deploy-marker:\n  stage: deploy\n  variables:\n    NEW_RELIC_API_KEY: ", { secret: key("ci") }, "\n  script:\n    - newrelic entity deployment create --guid \"$ENTITY_GUID\" --version \"$CI_COMMIT_SHA\"\n"], "yml");
    c.positive(T, "source-code", "python-nerdgraph-client", ['import requests\n\nresp = requests.post(\n    "https://api.newrelic.com/graphql",\n    headers={"API-Key": "', { secret: key("python") }, '"},\n    json={"query": "{ actor { accounts { id } } }"},\n)\n'], "py");
    c.control(T, "public-id", "account-and-entity-ids", [`NEW_RELIC_ACCOUNT_ID=${synthetic(seed(T, "account"), 7, DIGITS)}\nENTITY_GUID=${b64url(`${synthetic(seed(T, "guid-account"), 7, DIGITS)}|APM|APPLICATION|${synthetic(seed(T, "guid-app"), 9, DIGITS)}`)}\n`], "env");
    c.control(T, "encoded-value", "key-fingerprint", [`2026-09-20T12:00:00Z audit api_key.rotated type=USER name=ops-cli fingerprint_sha256=${synthetic(seed(T, "fingerprint"), 64, HEX)}\n`], "log");
    c.control(T, "prose", "key-types-note", ["New Relic user keys begin with NRAK- and act as the user who created them. Use a license key for data ingest, never a user key.\n"]);
  }

  // ---------------------------------------------------------------- new relic license ...FFFFNRAL
  {
    const T = "new-relic-license-key";
    // New Relic: 40 characters with the NRAL suffix; the 32 lower-hex body and FFFF are tool/provider-code corroborated.
    const key = slug => `${synthetic(seed(T, slug), 32, HEX)}FFFFNRAL`;
    c.positive(T, "env", "env-license-key", ["NEW_RELIC_APP_NAME=checkout-api\nNEW_RELIC_LICENSE_KEY=", { secret: key("env") }, "\n"], "env");
    c.positive(T, "structured-file", "newrelic-yml", ["common: &default_settings\n  license_key: '", { secret: key("yml") }, "'\n  app_name: checkout-api\n  distributed_tracing:\n    enabled: true\n"], "yml");
    c.positive(T, "sdk-config", "newrelic-js-config", ["'use strict'\n\nexports.config = {\n  app_name: ['checkout-api'],\n  license_key: '", { secret: key("js") }, "',\n  logging: { level: 'info' },\n}\n"], "js");
    c.positive(T, "header", "log-api-license-header", ["POST /log/v1 HTTP/1.1\nHost: log-api.newrelic.com\nContent-Type: application/json\nX-License-Key: ", { secret: key("header") }, '\n\n[{"logs":[{"message":"checkout completed"}]}]\n'], "http");
    c.positive(T, "container-config", "helm-bundle-values", ["global:\n  cluster: prod-eu-1\n  licenseKey: ", { secret: key("helm") }, "\nnewrelic-infrastructure:\n  enabled: true\n"], "yml");
    c.positive(T, "shell-export", "shell-export-license", ["export NEW_RELIC_LICENSE_KEY=", { secret: key("export") }, "\nnewrelic-infra-ctl --version\n"], "sh");
    c.control(T, "public-id", "account-and-app-ids", [`NEW_RELIC_ACCOUNT_ID=${synthetic(seed(T, "account"), 7, DIGITS)}\nNEW_RELIC_APP_ID=${synthetic(seed(T, "app"), 10, DIGITS)}\n`], "env");
    c.control(T, "encoded-value", "config-checksum", [`newrelic.yml sha256=${synthetic(seed(T, "checksum"), 64, HEX)} size=1482\n`], "log");
    c.control(T, "prose", "ingest-note", ["The ingest license key ends in NRAL and is 40 characters long. It is tied to one account, so rotate it from the API keys page if it leaks.\n"]);
  }

  // ---------------------------------------------------------------- jwt (RFC 7519)
  {
    const T = "jwt";
    // RFC 7519 compact serialization: three base64url segments. HS256 over a synthetic key.
    const jwt = (slug, claims) => {
      const signingInput = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
      return `${signingInput}.${createHmac("sha256", synthetic(seed(T, `${slug}-key`), 32)).update(signingInput).digest("base64url")}`;
    };
    const claims = (slug, extra = {}) => ({ sub: uuid(seed(T, `${slug}-sub`)), iss: "https://auth.example.invalid", aud: "api.example.invalid", iat: 1758000000, exp: 1758003600, ...extra });
    c.positive(T, "header", "api-bearer-header", ["GET /v1/orders HTTP/1.1\nHost: api.example.invalid\n", bearer(jwt("header", claims("header", { scope: "orders:read" }))), "\n"], "http");
    c.positive(T, "url", "websocket-query-token", ["wss://realtime.example.invalid/socket?vsn=2.0.0&token=", { secret: jwt("url", claims("url")) }, "\n"]);
    c.positive(T, "env", "env-id-token", ["SERVICE_ID_TOKEN=", { secret: jwt("env", claims("env", { azp: "billing-worker" })) }, "\n"], "env");
    c.positive(T, "structured-file", "token-response-json", ['{\n  "access_token": "', { secret: jwt("json", claims("json", { scope: "profile email" })) }, '",\n  "token_type": "Bearer",\n  "expires_in": 3600\n}\n'], "json");
    c.positive(T, "log", "debug-request-log", ['2026-09-20T12:00:00.123Z DEBUG http.client outgoing request url=/v1/invoices session_token=', { secret: jwt("log", claims("log", { sid: synthetic(seed(T, "log-sid"), 16) })) }, "\n"], "log");
    c.positive(T, "tool-output", "kubectl-create-token", ["$ kubectl create token deploy-bot --namespace ci --duration 1h\n", { secret: jwt("kubectl", claims("kubectl", { iss: "https://kubernetes.default.svc.cluster.local", aud: "https://kubernetes.default.svc.cluster.local" })) }, "\n"]);
    c.control(T, "public-id", "jwks-key-ids", [`{"keys":[{"kty":"oct","use":"sig","alg":"HS256","kid":"${synthetic(seed(T, "kid"), 22, URLSAFE)}"}],"issuer":"https://auth.example.invalid","jwks_uri":"https://auth.example.invalid/.well-known/jwks.json"}\n`], "json");
    c.control(T, "encoded-value", "token-digest-audit", [`2026-09-20T12:00:00Z audit session.revoked user=ops token_sha256=${synthetic(seed(T, "digest"), 64, HEX)}\n`], "log");
    c.control(T, "near-miss", "dotted-trace-context", [`trace=${synthetic(seed(T, "trace"), 32, HEX)}.${synthetic(seed(T, "span"), 16, HEX)}.01 service=billing-worker\n`], "log");
  }

  // ---------------------------------------------------------------- netlify nfp_
  {
    const T = "netlify-token";
    // Netlify announcement: nfp prefix, 40 characters; "_" and [A-Za-z0-9_] body are tool-corroborated.
    const token = slug => `nfp_${synthetic(seed(T, slug), 36, NETLIFY_BODY)}`;
    c.positive(T, "header", "api-bearer-header", ["GET /api/v1/sites HTTP/1.1\nHost: api.netlify.com\n", bearer(token("header")), "\n"], "http");
    c.positive(T, "cli", "netlify-deploy-auth-flag", ["$ netlify deploy --prod --dir dist --site ", uuid(seed(T, "cli-site")), " --auth ", { secret: token("cli") }, "\n"], "sh");
    c.positive(T, "ci-config", "github-actions-deploy", ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    env:\n      NETLIFY_AUTH_TOKEN: ", { secret: token("ci") }, "\n    steps:\n      - run: npx netlify-cli deploy --prod\n"], "yml");
    c.positive(T, "source-code", "js-api-client", ['import { NetlifyAPI } from "netlify";\n\nconst client = new NetlifyAPI("', { secret: token("js") }, '");\nconst sites = await client.listSites();\n'], "js");
    c.control(T, "encoded-value", "deploy-digest", [`Deploy ${synthetic(seed(T, "deploy-id"), 24, HEX)} uploaded 12 files, sha1 ${synthetic(seed(T, "deploy-sha"), 40, HEX)}\n`], "log");
    c.control(T, "prose", "token-format-note", ["Netlify personal access tokens start with nfp_. Create one per machine in User settings and revoke it there when the machine is retired.\n"]);
  }

  // ---------------------------------------------------------------- pulumi pul-
  {
    const T = "pulumi-access-token";
    // Pulumi documents the pul- prefix; 40 lower hex are tool-corroborated.
    const token = slug => `pul-${synthetic(seed(T, slug), 40, HEX)}`;
    c.positive(T, "env", "env-access-token", ["PULUMI_ACCESS_TOKEN=", { secret: token("env") }, "\nPULUMI_BACKEND_URL=https://api.pulumi.com\n"], "env");
    c.positive(T, "header", "rest-api-token-header", ["GET /api/user/stacks HTTP/1.1\nHost: api.pulumi.com\nAccept: application/vnd.pulumi+8\nAuthorization: token ", { secret: token("header") }, "\n"], "http");
    c.positive(T, "ci-config", "github-actions-preview", ["jobs:\n  preview:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: pulumi/actions@v6\n        with:\n          command: preview\n          stack-name: acme/web/prod\n        env:\n          PULUMI_ACCESS_TOKEN: ", { secret: token("ci") }, "\n"], "yml");
    c.control(T, "public-id", "token-create-response-id", [`{"id":"${uuid(seed(T, "token-id"))}","description":"ci preview","lastUsed":0}\n`], "json");
    c.control(T, "prose", "token-kinds-note", ["Pulumi personal, organization and team access tokens all start with pul-. Prefer an organization token for CI so a person leaving does not break deploys.\n"]);
  }

  // ---------------------------------------------------------------- supabase sbp_
  {
    const T = "supabase-management-token";
    // Supabase documents sbp_ / sbp_v0_; 40 of [a-z0-9] are tool-corroborated.
    const token = (slug, prefix = "sbp_") => `${prefix}${synthetic(seed(T, slug), 40, LOWER_ALNUM)}`;
    c.positive(T, "env", "env-access-token", ["SUPABASE_ACCESS_TOKEN=", { secret: token("env") }, "\n"], "env");
    c.positive(T, "header", "management-api-bearer", ["GET /v1/projects HTTP/1.1\nHost: api.supabase.com\n", bearer(token("header")), "\n"], "http");
    c.positive(T, "cli", "supabase-login-token", ["$ supabase login --token ", { secret: token("cli") }, "\nYou are now logged in. Happy coding!\n"], "sh");
    c.positive(T, "ci-config", "github-actions-db-push", ["jobs:\n  migrate:\n    runs-on: ubuntu-latest\n    env:\n      SUPABASE_ACCESS_TOKEN: ", { secret: token("ci") }, "\n    steps:\n      - uses: supabase/setup-cli@v1\n      - run: supabase db push\n"], "yml");
    c.positive(T, "sdk-config", "terraform-provider-v0", ['provider "supabase" {\n  access_token = "', { secret: token("terraform", "sbp_v0_") }, '"\n}\n'], "tf");
    c.positive(T, "source-code", "ts-management-client", ['const res = await fetch("https://api.supabase.com/v1/projects", {\n  headers: { Authorization: `Bearer ', { secret: token("ts") }, '` },\n});\n'], "ts");
    c.control(T, "public-id", "project-ref", [`SUPABASE_PROJECT_REF=${synthetic(seed(T, "ref"), 20, LOWER)}\nSUPABASE_URL=https://${synthetic(seed(T, "ref"), 20, LOWER)}.supabase.co\n`], "env");
    c.control(T, "encoded-value", "migration-checksum", [`Applying migration 20260920120000_orders.sql checksum=${synthetic(seed(T, "checksum"), 64, HEX)}\n`], "log");
    c.control(T, "prose", "token-scope-note", ["A Supabase personal access token starts with sbp_ and can manage every project you can. Keep it out of client code and revoke it from the dashboard.\n"]);
  }

  // ---------------------------------------------------------------- terraform cloud .atlasv1.
  {
    const T = "terraform-cloud-token";
    // HashiCorp API reference examples: 14 bytes, .atlasv1., 67 bytes.
    const token = slug => `${synthetic(seed(T, slug), 14)}.atlasv1.${synthetic(seed(T, `${slug}-tail`), 67)}`;
    c.positive(T, "structured-file", "credentials-tfrc-json", ['{\n  "credentials": {\n    "app.terraform.io": {\n      "token": "', { secret: token("tfrc") }, '"\n    }\n  }\n}\n'], "json");
    c.positive(T, "env", "env-tf-token-host", ["TF_TOKEN_app_terraform_io=", { secret: token("env") }, "\nTF_CLOUD_ORGANIZATION=acme\n"], "env");
    c.positive(T, "header", "api-v2-bearer", ["GET /api/v2/organizations/acme/workspaces HTTP/1.1\nHost: app.terraform.io\nContent-Type: application/vnd.api+json\n", bearer(token("header")), "\n"], "http");
    c.control(T, "public-id", "workspace-and-run-ids", [`workspace_id = "ws-${synthetic(seed(T, "ws"), 16)}"\nrun_id       = "run-${synthetic(seed(T, "run"), 16)}"\norganization = "acme"\n`], "tf");
    c.control(T, "prose", "token-kinds-note", ["HCP Terraform issues user, team and organization API tokens. Use a team token for automation and keep user tokens for people.\n"]);
  }

  // ---------------------------------------------------------------- vault hvs./hvb.
  {
    const T = "vault-token";
    // HashiCorp documents hvs./hvb./hvr. and 24+ random characters; the contract names an HCP Vault endpoint.
    // Widths follow the shapes HashiCorp's own examples show: a ~95-character service token and a
    // much longer batch token (an encrypted blob; the batch-token docs' example runs well past 138).
    const addr = "https://vault-cluster-public-vault-3f2a91c4.7c1e5d2b.z1.hashicorp.cloud:8200";
    const token = (slug, prefix = "hvs.") => `${prefix}${synthetic(seed(T, slug), prefix === "hvb." ? 160 : 91, URLSAFE)}`;
    c.positive(T, "env", "env-vault-token", [`VAULT_ADDR=${addr}\nVAULT_NAMESPACE=admin\nVAULT_TOKEN=`, { secret: token("env") }, "\n"], "env");
    c.positive(T, "header", "x-vault-token-header", [`GET /v1/secret/data/payments HTTP/1.1\nHost: ${addr.slice(8)}\nX-Vault-Namespace: admin\nX-Vault-Token: `, { secret: token("header", "hvb.") }, "\n"], "http");
    c.positive(T, "cli", "vault-login", [`$ export VAULT_ADDR=${addr}\n$ vault login -no-print `, { secret: token("cli") }, "\n"], "sh");
    c.control(T, "public-id", "token-lookup-ids", [`VAULT_ADDR=${addr}\nentity_id        ${uuid(seed(T, "entity"))}\npolicies         [default payments-read]\nttl              767h59m\n`]);
    c.control(T, "encoded-value", "audit-hmac", [`{"time":"2026-09-20T12:00:00Z","type":"request","auth":{"client_token":"hmac-sha256:${synthetic(seed(T, "hmac"), 64, HEX)}","policies":["default"]},"request":{"path":"secret/data/payments"}}\n`], "json");
    c.control(T, "prose", "token-types-note", ["Vault service tokens start with hvs., batch tokens with hvb. and recovery tokens with hvr. Revoke a leaked token and its children with vault token revoke.\n"]);
  }

  // ---------------------------------------------------------------- #206 positives for the 209 families
  {
    const T = "azure-devops-personal-access-token";
    // Microsoft Learn: 84 characters with AZDO at positions 76-80; Purview: [A-Za-z0-9].
    const pat = slug => { const s = synthetic(seed(T, slug), 80); return `${s.slice(0, 76)}AZDO${s.slice(76)}`; };
    c.positive(T, "container-config", "self-hosted-agent-compose", ["services:\n  azp-agent:\n    image: registry.example.internal/azp-agent:ubuntu-22.04\n    environment:\n      AZP_URL: https://dev.azure.com/contoso\n      AZP_TOKEN: ", { secret: pat("compose") }, "\n      AZP_POOL: linux-builders\n"], "yml");
    c.positive(T, "sdk-config", "terraform-provider", ['provider "azuredevops" {\n  org_service_url       = "https://dev.azure.com/contoso"\n  personal_access_token = "', { secret: pat("terraform") }, '"\n}\n'], "tf");
    c.positive(T, "shell-export", "shell-export-ext-pat", ["export AZURE_DEVOPS_EXT_PAT=", { secret: pat("export") }, "\naz devops project list --organization https://dev.azure.com/contoso\n"], "sh");
    c.positive(T, "source-code", "python-sdk-connection", ["from azure.devops.connection import Connection\nfrom msrest.authentication import BasicAuthentication\n\ncredentials = BasicAuthentication(\"\", \"", { secret: pat("python") }, "\")\nconnection = Connection(base_url=\"https://dev.azure.com/contoso\", creds=credentials)\n"], "py");
    c.positive(T, "ci-config", "github-actions-boards-sync", ["jobs:\n  sync-boards:\n    runs-on: ubuntu-latest\n    env:\n      ADO_PAT: ", { secret: pat("ci") }, "\n    steps:\n      - run: ./scripts/sync-work-items.sh\n"], "yml");
  }
  {
    const T = "datadog-application-key";
    // docs.datadoghq.com documents the ddapp_ prefix; 34 alphanumerics come from Datadog-owned code.
    const key = slug => `ddapp_${synthetic(seed(T, slug), 34)}`;
    c.positive(T, "env", "env-app-key", ["DD_SITE=datadoghq.eu\nDD_APP_KEY=", { secret: key("env") }, "\n"], "env");
    c.positive(T, "shell-export", "shell-export-app-key", ["export DD_APPLICATION_KEY=", { secret: key("export") }, "\ndatadog-ci synthetics run-tests --public-id abc-def-ghi\n"], "sh");
    c.positive(T, "ci-config", "gitlab-ci-variables", ["synthetics:\n  stage: test\n  variables:\n    DATADOG_APP_KEY: ", { secret: key("ci") }, "\n  script:\n    - npx @datadog/datadog-ci synthetics run-tests\n"], "yml");
    c.positive(T, "container-config", "helm-values", ["datadog:\n  site: datadoghq.com\n  appKey: ", { secret: key("helm") }, "\nclusterAgent:\n  enabled: true\n  metricsProvider:\n    enabled: true\n"], "yml");
    c.positive(T, "structured-file", "datadog-ci-json", ['{\n  "appKey": "', { secret: key("json") }, '",\n  "datadogSite": "datadoghq.com",\n  "files": ["synthetics/*.synthetics.json"]\n}\n'], "json");
  }
  {
    const T = "notion-token";
    // Notion changelog: secret_ is the legacy (still valid) prefix; 43 alphanumerics are tool-corroborated.
    const token = slug => `secret_${synthetic(seed(T, slug), 43)}`;
    c.positive(T, "shell-export", "shell-export-token", ["export NOTION_TOKEN=", { secret: token("export") }, "\nnode scripts/export-roadmap.mjs\n"], "sh");
    c.positive(T, "sdk-config", "mcp-server-env", ['{\n  "mcpServers": {\n    "notion": {\n      "command": "npx",\n      "args": ["-y", "@notionhq/notion-mcp-server"],\n      "env": { "NOTION_TOKEN": "', { secret: token("mcp") }, '" }\n    }\n  }\n}\n'], "json");
    c.positive(T, "cli", "curl-bearer", ["$ curl -s -H 'Notion-Version: 2022-06-28' -H '", bearer(token("curl")), "' -d '{\"query\":\"Roadmap\"}' https://api.notion.com/v1/search\n"], "sh");
    c.positive(T, "container-config", "compose-env", ["services:\n  roadmap-sync:\n    image: registry.example.internal/roadmap-sync:2.1\n    environment:\n      NOTION_API_KEY: ", { secret: token("compose") }, "\n"], "yml");
    c.positive(T, "log", "debug-client-log", ["2026-09-20T12:00:00Z DEBUG notion-client request POST /v1/pages auth=", { secret: token("log") }, " status=200\n"], "log");
  }
  {
    const T = "google-api-key";
    // Provider example only: AIza + 35 of [A-Za-z0-9_-] (body tool-corroborated). No firebaseConfig context.
    const key = slug => `AIza${synthetic(seed(T, slug), 35, URLSAFE)}`;
    c.positive(T, "env", "env-maps-key", ["GOOGLE_MAPS_API_KEY=", { secret: key("env") }, "\n"], "env");
    c.positive(T, "shell-export", "shell-export-gemini", ["export GEMINI_API_KEY=", { secret: key("export") }, "\npython summarize.py report.pdf\n"], "sh");
    c.positive(T, "cli", "curl-generate-content", ['$ curl -s -H "x-goog-api-key: ', { secret: key("curl") }, '" -H "Content-Type: application/json" -d \'{"contents":[{"parts":[{"text":"hello"}]}]}\' "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"\n'], "sh");
    c.positive(T, "ci-config", "github-actions-places", ["jobs:\n  geocode:\n    runs-on: ubuntu-latest\n    env:\n      PLACES_API_KEY: ", { secret: key("ci") }, "\n    steps:\n      - run: node scripts/refresh-store-locations.mjs\n"], "yml");
    c.positive(T, "container-config", "k8s-secret-stringdata", ["apiVersion: v1\nkind: Secret\nmetadata:\n  name: geocoder\ntype: Opaque\nstringData:\n  GOOGLE_API_KEY: ", { secret: key("k8s") }, "\n"], "yml");
  }
  {
    const T = "heroku-api-key";
    // 65-character G2 generation only: HRKU-AA + 58 of [A-Za-z0-9_-] (AA example/tool-observed).
    const g2 = slug => `HRKU-AA${synthetic(seed(T, slug), 58, URLSAFE)}`;
    c.positive(T, "shell-export", "shell-export-api-key", ["export HEROKU_API_KEY=", { secret: g2("export") }, "\nheroku apps:info --app checkout-api\n"], "sh");
    c.positive(T, "ci-config", "github-actions-deploy", ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    env:\n      HEROKU_API_KEY: ", { secret: g2("ci") }, "\n    steps:\n      - run: heroku container:release web --app checkout-api\n"], "yml");
    c.positive(T, "sdk-config", "terraform-provider", ['provider "heroku" {\n  email   = "ops@example.com"\n  api_key = "', { secret: g2("terraform") }, '"\n}\n'], "tf");
    c.positive(T, "container-config", "compose-env", ["services:\n  release-bot:\n    image: registry.example.internal/release-bot:3.0\n    environment:\n      HEROKU_API_KEY: ", { secret: g2("compose") }, "\n"], "yml");
    c.positive(T, "source-code", "python-heroku3-client", ['import heroku3\n\nconn = heroku3.from_key("', { secret: g2("python") }, '")\napp = conn.apps()["checkout-api"]\n'], "py");
  }
  {
    const T = "confluent-cloud-api-secret";
    // cflt + 54 of [A-Za-z0-9+/] + 6-character checksum (CRC32 LE, standard Base64, first 6).
    const keyId = slug => synthetic(seed(T, `key-id-${slug}`), 16, UPPER_DIGIT);
    const secret = slug => { const b = synthetic(seed(T, slug), 54, BASE64); return `cflt${b}${cfltChecksum(b)}`; };
    c.positive(T, "shell-export", "shell-export-secret", [`export CONFLUENT_CLOUD_API_KEY=${keyId("export")}\nexport CONFLUENT_CLOUD_API_SECRET=`, { secret: secret("export") }, "\n"], "sh");
    c.positive(T, "ci-config", "github-actions-connector-deploy", [`jobs:\n  connectors:\n    runs-on: ubuntu-latest\n    env:\n      CONFLUENT_CLOUD_API_KEY: ${keyId("ci")}\n      CONFLUENT_CLOUD_API_SECRET: `, { secret: secret("ci") }, "\n    steps:\n      - run: terraform apply -auto-approve\n"], "yml");
    c.positive(T, "container-config", "k8s-secret-stringdata", [`apiVersion: v1\nkind: Secret\nmetadata:\n  name: kafka-client\ntype: Opaque\nstringData:\n  KAFKA_SASL_USERNAME: ${keyId("k8s")}\n  KAFKA_SASL_PASSWORD: `, { secret: secret("k8s") }, "\n"], "yml");
    c.positive(T, "source-code", "python-producer-config", [`from confluent_kafka import Producer\n\nproducer = Producer({\n    "bootstrap.servers": "pkc-4n7dq.us-west-2.aws.confluent.cloud:9092",\n    "security.protocol": "SASL_SSL",\n    "sasl.mechanisms": "PLAIN",\n    "sasl.username": "${keyId("python")}",\n    "sasl.password": "`, { secret: secret("python") }, '",\n})\n'], "py");
    c.positive(T, "cli", "confluent-api-key-store", [`$ confluent api-key store ${keyId("cli")} `, { secret: secret("cli") }, " --resource lkc-8w6q3p\nStored secret for API key \"", keyId("cli"), "\".\n"], "sh");
    c.positive(T, "basic-auth", "curl-basic-auth", [`$ curl -u "${keyId("curl")}:`, { secret: secret("curl") }, '" https://api.confluent.cloud/iam/v2/service-accounts\n'], "sh");
  }

  return c.fixtures;
}
