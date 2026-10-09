import { beta8Corpus } from "./helpers.mjs";

// Issue #213 corpus `213a` (category `beta8-213a`). See docs/specs/beta8-evidence.md.
//
// Restores nine T1 documented families that read stable at the beta.7
// publication and are held provisional under the Beta.8 criteria only by
// fixture-profile debt (docs/reports/2026-09-24-beta8-213-portfolio.md):
// sendgrid, microsoft-entra, github, slack, aws, digitalocean, docker, linear
// and npm. Each block adds only the untwinned positives on new context axes and
// the controls on a new confusion axis that the binding `documented.*` floors
// and the #206 `stable-documented` cells still lack; every family already holds
// at least five twin pairs, so no twin is added. Every value is synthetic
// (`synthetic()` seeds) and follows the contract in benchmarks/lib/assessment.ts;
// none is provider-issued or scanner-derived. Known product issues are avoided on
// purpose: no Entra secret starts with "-" (redact-secret#707) and no Docker
// value uses the 27-character dckr_oat_ body (redact-secret#708).

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const HEX = "0123456789abcdef";
const DIGITS = "0123456789";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ENTRA = `${ALNUM}_.~-`;
const URLSAFE = `${ALNUM}_-`;
const BEARER = "The header name and Bearer scheme are not secret, but redacting the whole Authorization header is acceptable.";

export function build213a({ fixture, synthetic }) {
  const c = beta8Corpus("213a", { fixture, synthetic });
  const seed = (target, slug) => `beta8:213a:${target}:${slug}`;
  const uuid = label => { const h = synthetic(label, 32, HEX); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

  // ---------------------------------------------------------------- sendgrid SG.
  {
    const T = "sendgrid-token";
    // Held only by control axes 3/4 (near-miss, ordinary-prose, placeholder): add a public identifier.
    c.control(T, "public-id", "template-and-sender-ids", [`SENDGRID_TEMPLATE_ID=d-${synthetic(seed(T, "template-id"), 32, HEX)}\nSENDGRID_SENDER_ID=${synthetic(seed(T, "sender-id"), 7, DIGITS)}\nSENDGRID_FROM=billing@example.com\n`], "env");
  }

  // ---------------------------------------------------------------- microsoft-entra client secret
  {
    const T = "microsoft-entra-client-secret";
    // Provider examples (Add-MgApplicationPassword SecretText): 3 + 8Q~ + 34 = 40 characters.
    // The lead and final characters are alphanumeric, so no value starts with "-" (redact-secret#707).
    const secret = slug => {
      const lead = synthetic(seed(T, `${slug}:lead`), 3, ALNUM);
      const body = synthetic(seed(T, `${slug}:body`), 33, ENTRA);
      return `${lead}8Q~${body}${synthetic(seed(T, `${slug}:last`), 1, ALNUM)}`;
    };
    const appId = slug => uuid(seed(T, `${slug}:app-id`));
    const tenant = slug => uuid(seed(T, `${slug}:tenant-id`));
    c.positive(T, "env", "env-client-secret", [`AZURE_CLIENT_ID=${appId("env")}\nAZURE_TENANT_ID=${tenant("env")}\nAZURE_CLIENT_SECRET=`, { secret: secret("env") }, "\n"], "env");
    c.positive(T, "cli", "az-login-service-principal", [`$ az login --service-principal --username ${appId("cli")} --tenant ${tenant("cli")} --password `, { secret: secret("cli") }, "\n"], "sh");
    c.positive(T, "sdk-config", "appsettings-azuread", [`{\n  "AzureAd": {\n    "Instance": "https://login.microsoftonline.com/",\n    "TenantId": "${tenant("appsettings")}",\n    "ClientId": "${appId("appsettings")}",\n    "ClientSecret": "`, { secret: secret("appsettings") }, `"\n  }\n}\n`], "json");
    c.positive(T, "tool-output", "az-ad-sp-create-for-rbac", [`$ az ad sp create-for-rbac --name payments-deployer\n{\n  "appId": "${appId("rbac")}",\n  "displayName": "payments-deployer",\n  "password": "`, { secret: secret("rbac") }, `",\n  "tenant": "${tenant("rbac")}"\n}\n`]);
    c.positive(T, "source-code", "client-secret-credential-csharp", [`var credential = new ClientSecretCredential(\n    "${tenant("csharp")}",\n    "${appId("csharp")}",\n    "`, { secret: secret("csharp") }, `");\n`], "cs");
    c.positive(T, "container-config", "compose-environment", [`services:\n  worker:\n    image: contoso/payments-worker:1.4.2\n    environment:\n      AZURE_CLIENT_ID: ${appId("compose")}\n      AZURE_TENANT_ID: ${tenant("compose")}\n      AZURE_CLIENT_SECRET: `, { secret: secret("compose") }, "\n"], "yml");
    c.control(T, "public-id", "credential-listing", [`$ az ad app credential list --id ${appId("listing")}\n[\n  {\n    "displayName": "ci-deploy",\n    "endDateTime": "2027-03-01T00:00:00Z",\n    "hint": "${synthetic(seed(T, "listing-hint"), 3, ALNUM)}",\n    "keyId": "${uuid(seed(T, "listing-key-id"))}",\n    "secretText": null\n  }\n]\n`]);
  }

  // ---------------------------------------------------------------- github ghp_ family
  {
    const T = "github-token";
    // Held by controls 6/8 and control axes 3/4 (near-miss, placeholder, reference).
    c.control(T, "public-id", "github-app-identifiers", [`GITHUB_APP_ID=${synthetic(seed(T, "app-id"), 6, DIGITS)}\nGITHUB_APP_CLIENT_ID=Iv1.${synthetic(seed(T, "client-id"), 16, HEX)}\nGITHUB_APP_INSTALLATION_ID=${synthetic(seed(T, "installation-id"), 8, DIGITS)}\n`], "env");
    c.control(T, "prose", "token-expiry-note", ["Fine-grained personal access tokens can be limited to one repository and must expire. Prefer them to classic tokens for CI automation, and revoke any token that appears in a build log.\n"]);
  }

  // ---------------------------------------------------------------- slack xoxb-
  {
    const T = "slack-token";
    // Contract: xoxb- + 12 digits + 12 digits + 24 alphanumerics.
    const token = slug => `xoxb-${synthetic(seed(T, `${slug}:team`), 12, DIGITS)}-${synthetic(seed(T, `${slug}:bot`), 12, DIGITS)}-${synthetic(seed(T, slug), 24)}`;
    c.positive(T, "header", "bearer-header", ["POST /api/chat.postMessage HTTP/1.1\nHost: slack.com\nContent-Type: application/json; charset=utf-8\n", { secret: token("header"), envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\n"], "http");
    c.positive(T, "source-code", "bolt-app-python", ['from slack_bolt import App\n\napp = App(\n    token="', { secret: token("bolt") }, '",\n    signing_secret=os.environ["SLACK_SIGNING_SECRET"],\n)\n'], "py");
    c.control(T, "public-id", "workspace-identifiers", [`SLACK_TEAM_ID=T${synthetic(seed(T, "team-id"), 10, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}\nSLACK_CHANNEL_ID=C${synthetic(seed(T, "channel-id"), 10, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}\nSLACK_APP_ID=A${synthetic(seed(T, "app-id"), 10, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}\n`], "env");
  }

  // ---------------------------------------------------------------- aws AKIA
  {
    const T = "aws-access-key";
    // Contract: AKIA + 16 of [A-Z2-7]. The companion secret is only ever a reference here.
    const key = slug => `AKIA${synthetic(seed(T, slug), 16, BASE32)}`;
    c.positive(T, "ci-config", "configure-credentials-action", ["jobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: aws-actions/configure-aws-credentials@v4\n        with:\n          aws-access-key-id: ", { secret: key("actions") }, "\n          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}\n          aws-region: us-east-1\n"], "yml");
    c.positive(T, "source-code", "boto3-client", ['import os\nimport boto3\n\ns3 = boto3.client(\n    "s3",\n    aws_access_key_id="', { secret: key("boto3") }, '",\n    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],\n)\n'], "py");
    // IAM user unique IDs use the AIDA prefix and are not access keys (the contract's provider table).
    c.control(T, "public-id", "iam-user-identity", [`$ aws iam get-user --user-name ci-deploy\n{\n  "User": {\n    "UserName": "ci-deploy",\n    "UserId": "AIDA${synthetic(seed(T, "user-id"), 17, BASE32)}",\n    "Arn": "arn:aws:iam::${synthetic(seed(T, "account-id"), 12, DIGITS)}:user/ci-deploy"\n  }\n}\n`]);
    c.control(T, "prose", "rotation-note", ["Rotate IAM user access keys at least every 90 days, and prefer short-lived role credentials from IAM Identity Center for anything that runs on a laptop.\n"]);
  }

  // ---------------------------------------------------------------- digitalocean do[por]_v1_
  {
    const T = "digitalocean-token";
    // Contract: dop_v1_/doo_v1_/dor_v1_ + 64 lowercase hex.
    const token = (prefix, slug) => `${prefix}_v1_${synthetic(seed(T, slug), 64, HEX)}`;
    c.positive(T, "env", "env-access-token", ["DIGITALOCEAN_ACCESS_TOKEN=", { secret: token("dop", "env") }, "\n"], "env");
    c.positive(T, "cli", "doctl-auth-init", ["$ doctl auth init --context staging --access-token ", { secret: token("dop", "doctl") }, "\n"], "sh");
    c.positive(T, "header", "oauth-bearer-header", ["GET /v2/account HTTP/1.1\nHost: api.digitalocean.com\n", { secret: token("doo", "header"), envelope: { before: "Authorization: Bearer ", after: "", reason: BEARER } }, "\n"], "http");
    c.control(T, "public-id", "droplet-and-project-ids", [`DO_PROJECT_ID=${uuid(seed(T, "project-id"))}\nDO_DROPLET_ID=${synthetic(seed(T, "droplet-id"), 9, DIGITS)}\nDO_REGION=nyc3\n`], "env");
  }

  // ---------------------------------------------------------------- docker dckr_pat_
  {
    const T = "docker-token";
    // Contract: dckr_pat_ + 27 of [A-Za-z0-9_-]; the final character is alphanumeric. No dckr_oat_ (redact-secret#708).
    const pat = slug => `dckr_pat_${synthetic(seed(T, slug), 26, URLSAFE)}${synthetic(seed(T, `${slug}:last`), 1, ALNUM)}`;
    c.positive(T, "log", "ci-login-log", ["2026-09-20T14:02:11.482Z [release] + docker login -u release-bot -p ", { secret: pat("log") }, " registry-1.docker.io\n2026-09-20T14:02:11.913Z [release] WARNING! Using --password via the CLI is insecure. Use --password-stdin.\n2026-09-20T14:02:12.604Z [release] Login Succeeded\n"], "log");
    c.positive(T, "cli", "docker-login-stdin", ["$ echo ", { secret: pat("cli") }, " | docker login --username release-bot --password-stdin\nLogin Succeeded\n"], "sh");
    c.positive(T, "prose", "chat-handoff", ["Hand-off for the release rotation: the Hub robot account is release-bot and its current access token is ", { secret: pat("prose") }, " until Friday, when I will rotate it.\n"]);
    c.control(T, "public-id", "access-token-listing", [`{\n  "uuid": "${uuid(seed(T, "token-uuid"))}",\n  "token_label": "release-bot ci",\n  "creator_ua": "docker-cli",\n  "scopes": ["repo:read", "repo:write"],\n  "is_active": true\n}\n`], "json");
  }

  // ---------------------------------------------------------------- linear lin_api_
  {
    const T = "linear-token";
    // Contract: lin_api_ + 40 alphanumerics.
    const key = slug => `lin_api_${synthetic(seed(T, slug), 40)}`;
    c.positive(T, "header", "graphql-authorization-header", ["POST /graphql HTTP/1.1\nHost: api.linear.app\nContent-Type: application/json\nAuthorization: ", { secret: key("header") }, "\n"], "http");
    c.positive(T, "env", "env-api-key", ["LINEAR_API_KEY=", { secret: key("env") }, "\n"], "env");
    c.positive(T, "source-code", "linear-client-ts", ['import { LinearClient } from "@linear/sdk";\n\nconst linear = new LinearClient({ apiKey: "', { secret: key("sdk") }, '" });\n'], "ts");
    c.control(T, "public-id", "team-and-issue-ids", [`LINEAR_TEAM_ID=${uuid(seed(T, "team-id"))}\nLINEAR_TEAM_KEY=ENG\nLINEAR_ISSUE=ENG-${synthetic(seed(T, "issue-number"), 4, DIGITS)}\n`], "env");
  }

  // ---------------------------------------------------------------- npm npm_
  {
    const T = "npm-token";
    // Contract: npm_ + 36 alphanumerics.
    const token = slug => `npm_${synthetic(seed(T, slug), 36)}`;
    c.positive(T, "structured-file", "npmrc-auth-token", ["registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=", { secret: token("npmrc") }, "\n"], "npmrc");
    c.positive(T, "ci-config", "publish-workflow-env", ["      - run: npm publish --provenance --access public\n        env:\n          NODE_AUTH_TOKEN: ", { secret: token("actions") }, "\n"], "yml");
    c.control(T, "public-id", "token-list-output", [`$ npm token list --json\n[\n  {\n    "id": "${synthetic(seed(T, "token-id"), 6, HEX)}",\n    "created": "2026-09-01T12:00:00.000Z",\n    "readonly": false,\n    "cidr_whitelist": null\n  }\n]\n`]);
    c.control(T, "prose", "granular-token-note", ["Granular access tokens can be scoped to a single package and given an expiry date. Use one per publishing workflow and revoke it when the workflow is retired.\n"]);
  }

  return c.fixtures;
}
