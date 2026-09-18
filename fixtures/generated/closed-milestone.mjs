// Expectations follow the closed issues' final decisions at the recorded
// source revision. They do not assert that the installed release has the fixes.
export const closedBehaviorIssues = [
  254, 255, 256, 257, 262, 263, 264, 265, 266, 278, 280,
];
export const milestoneSnapshot = {
  milestone: 6,
  targetRelease: "0.1.0-beta.3",
  reviewedAt: "2026-09-16",
  sourceRevision: "530cafe9737eb5abc9702945394584aeb701d8c1",
  validation:
    "Published npm whole-input detection; measured scanner versions and outcomes are recorded in each report.",
  outOfScopeIssues: [
    {
      issue: 273,
      reason:
        "Upstream Linux workflow/host criteria selection; no scanner-input behavior.",
    },
    {
      issue: 274,
      reason:
        "Upstream RC baseline/corpus identity pinning; no scanner-input behavior.",
    },
    {
      issue: 275,
      reason:
        "Upstream Python scan/redact conformance; npm redaction tests here are not Python verification.",
    },
  ],
  unverifiedSurfaces: [
    "Python",
    "Browser WASM",
    "CLI stdin/file parity",
    "Incremental partition invariance",
  ],
};

export function buildClosedMilestone({ fixture, synthetic, wrap, quoted, uri }) {
  const fixtures = [];
  const add = (issue, id, title, parts) => {
    const f = fixture(`issue-${issue}-${id}`, `#${issue} · ${title}`, parts);
    f.issue = issue;
    fixtures.push(f);
  };
  const negative = (issue, id, title, content) =>
    add(issue, id, title, [content]);
  // Quoted assignments and connection URIs carry authored envelopes (§2.2):
  // the key/quotes or scheme/user/host may be redacted along with the secret.
  const positive = (issue, id, title, prefix, value, suffix = "\n") => {
    const quote = prefix.endsWith('"') && suffix.startsWith('"') ? '"' : null;
    if (quote) {
      const key = prefix.slice(prefix.lastIndexOf("\n") + 1, -1);
      return add(issue, id, title, [prefix.slice(0, prefix.length - key.length - 1), quoted(key, value), suffix.slice(1)]);
    }
    const connection = /^([a-z]+:\/\/[^:\s]+:)$/.exec(prefix) && suffix.startsWith("@") ? /^(@[^\n]*)(\n?)$/.exec(suffix) : null;
    if (connection) return add(issue, id, title, [uri(prefix, value, connection[1]), connection[2]]);
    return add(issue, id, title, [prefix, { secret: value }, suffix]);
  };
  const value = synthetic("closed-milestone:literal", 32);

  const awsId = "AKIAIOSFODNN7EXAMPLE";
  const awsSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  for (const [id, content] of [
    ["id-bare", awsId + "\n"],
    ["id-env", `AWS_ACCESS_KEY_ID=${awsId}\n`],
    ["secret-quoted", `secret="${awsSecret}"\n`],
    ["secret-json", `{"aws_secret_access_key":"${awsSecret}"}\n`],
  ])
    negative(254, id, "AWS documentation literals", content);
  positive(
    254,
    "changed-id",
    "AWS documentation literals",
    "AWS_ACCESS_KEY_ID=",
    awsId.slice(0, -1) + "F",
  );
  positive(
    254,
    "changed-secret",
    "AWS documentation literals",
    'aws_secret_access_key="',
    awsSecret.slice(0, -1) + "Z",
    '"\n',
  );

  for (const [scheme, password] of [
    ["postgres", "mysecretpassword"],
    ["mysql", "mysecretpassword"],
    ["mariadb", "changeit"],
    ["redis", "supersecretpassword"],
    ["mongodb", "changeit"],
  ]) {
    negative(
      255,
      `${scheme}-default`,
      "Tutorial URL passwords",
      `${scheme}://fixture:${password}@db.example.invalid/example\n`,
    );
    positive(
      255,
      `${scheme}-literal`,
      "Tutorial URL passwords",
      `${scheme}://fixture:`,
      value,
      "@db.example.invalid/example\n",
    );
  }
  for (const [i, password] of [
    "your_password_here",
    "insert-password-here",
    "REPLACE_ME_PASSWORD",
    "TODO_SET_PASSWORD",
    "root_password_here",
    "xxxxxxxxxxxx",
    "00000000000",
  ].entries())
    negative(
      256,
      `placeholder-${i + 1}`,
      "Connection placeholders",
      `postgres://fixture:${password}@db.example.invalid/example\n`,
    );
  for (const [id, password] of [
    ["filler-near-miss", "xxxxxxxxxxxY"],
    ["embedded-word", `Secret${value}`],
    ["unrelated-suffix", `password_${value}`],
  ])
    positive(
      256,
      id,
      "Connection placeholders",
      "postgres://fixture:",
      password,
      "@db.example.invalid/example\n",
    );

  for (const [id, content] of [
    ["leading-space", 'secret=" changeme"\n'],
    ["trailing-digit", 'secret_key="changeme2"\n'],
    ["compound", 'secret_key: "REDACTED-EXAMPLE"\n'],
    ["url-digit", "postgres://fixture:changeme2@db.example.invalid/example\n"],
    ["replace-me", 'secret_key="replace_me"\n'],
  ])
    negative(257, id, "Placeholder vocabulary", content);
  for (const [id, password] of [
    ["password-digit", "password1"],
    ["secret-digit", "SECRET01"],
    ["unlisted-word", "REDACTED-EXAMPLE-VALUE"],
    ["embedded-word", `mySecretKey${value}`],
  ])
    positive(
      257,
      id,
      "Placeholder vocabulary",
      'secret_key="',
      password,
      '"\n',
    );
  positive(
    257,
    "url-embedded",
    "Placeholder vocabulary",
    "postgres://fixture:",
    `mySecretKey${value}`,
    "@db.example.invalid/example\n",
  );

  for (const [id, content] of [
    ["yaml-block", "secret:\n  secretName: web-tls-cert\n"],
    ["prompt", "Password:\nPermission denied, please try again.\n"],
    [
      "ssh-prompt",
      "fixture@db.example.invalid's password:\nfixture@db.example.invalid: Permission denied (publickey,password).\n",
    ],
    ["crlf-tabs", "secret:\r\n\tsecretName: web-tls-cert\r\n"],
    ["blank-line", "secret:\n\n  secretName: web-tls-cert\n"],
    ["korean-prompt", "Password:\n실패함 다시 시도하세요\n"],
  ])
    negative(262, id, "Line boundaries", content);
  positive(262, "same-line", "Line boundaries", "password: ", value);
  positive(
    262,
    "horizontal-tab",
    "Line boundaries",
    "password:\t",
    value,
    "\r\n",
  );

  for (const [id, content] of [
    ["jinja-double", 'password: "{{ vault_db_password }}"\n'],
    ["jinja-single", "password: '{{ vault_db_password }}'\n"],
    ["json", '{"password":"{{ vault_db_password }}"}\n'],
    ["helm", 'password: "{{ .Values.postgresql.auth.password }}"\n'],
    ["go-template", 'client_secret: "{{ .ClientSecretRef }}"\n'],
    ["unquoted", "password: {{ vault_db_password }}\n"],
  ])
    negative(263, id, "Fully delimited templates", content);
  positive(
    263,
    "prefix-only",
    "Fully delimited templates",
    'password: "',
    `{{${value}`,
    '"\n',
  );
  positive(
    263,
    "embedded",
    "Fully delimited templates",
    'password: "',
    `${value}{{var}}${value}`,
    '"\n',
  );

  for (const [id, content] of [
    ["stars", "Password: ********\n"],
    ["bullets", "Password: ••••••••\n"],
    ["env", "PASSWORD=********\n"],
    ["quoted-bullets", 'password: "••••••••"\n'],
  ])
    negative(264, id, "Masked values", content);
  positive(264, "mixed-stars", "Masked values", "Password: ", "********x");
  positive(264, "mixed-bullets", "Masked values", "Password: ", "•••••••x");

  negative(
    265,
    "properties",
    "Nested YAML recall",
    "properties:\n  password:\n    minLength: 12\n",
  );
  negative(
    265,
    "secret-key-ref",
    "Nested YAML recall",
    "spec:\n  auth:\n    password:\n      secretKeyRef:\n",
  );
  for (const [id, prefix] of [
    ["database", "database:\n  password: "],
    ["auth", "auth:\n  password: "],
    ["deep", "spec:\n  auth:\n    password: "],
  ])
    positive(265, id, "Nested YAML recall", prefix, value);

  for (const [id, content] of [
    [
      "flow-object",
      "volumes: [{name: tls, secret: {secretName: web-tls-cert}}]\n",
    ],
    ["array", "secret: [configReference, anotherReference]\n"],
    ["flow-crlf", "secret: {secretName: web-tls-cert}\r\n"],
  ])
    negative(266, id, "Flow collections", content);
  positive(266, "block-literal", "Flow collections", "secret: ", value);
  positive(
    266,
    "quoted-brace",
    "Flow collections",
    'secret: "',
    `{${value}`,
    '"\n',
  );

  for (const [id, content] of [
    ["settings", "password=settings.DATABASE_PASSWORD\n"],
    ["config", "apiKey: config.anthropicApiKey,\n"],
    ["terraform", "password = random_password.db.result\n"],
    ["subscript", 'api_key=os.environ["OPENAI_API_KEY"]\n'],
    ["generic-type", "pub api_key: Option<String>,\n"],
    ["go-config", "password=cfg.RedisPassword\n"],
    ["rust-call", 'api_key=std::env::var("OPENAI_API_KEY")\n'],
    [
      "terraform-data",
      "password=data.aws_secretsmanager_secret_version.db.secret_string\n",
    ],
  ])
    negative(278, id, "Code reference exclusions", content);
  positive(
    278,
    "dotted-literal",
    "Code reference exclusions",
    "password: ",
    "SYNTHETIC.REVOKED.CONTEXT_VALUE",
  );
  positive(
    278,
    "underscored-literal",
    "Code reference exclusions",
    "password: ",
    "SYNTHETIC_REVOKED_CONTEXT_VALUE",
  );
  positive(
    278,
    "root-near-miss",
    "Code reference exclusions",
    "password: ",
    `selfhosted${value}`,
  );

  for (const [id, reference] of [
    ["onepassword", "op://Benchmark/database/password"],
    ["litellm", "os.environ/BENCHMARK_API_KEY"],
    ["gcp-version", "projects/example-project/secrets/api-key/versions/latest"],
    ["gcp-no-version", "projects/example-project/secrets/api-key"],
    ["vals", "ref+vault://secret/data/benchmark#/password"],
    ["bank-vaults", "vault:secret/data/benchmark#password"],
    ["aws", "arn:aws:secretsmanager:us-east-1:000000000000:secret:benchmark"],
    [
      "azure-uri",
      "@Microsoft.KeyVault(SecretUri=https://benchmark.vault.azure.net/secrets/example)",
    ],
    [
      "azure-fields",
      "@Microsoft.KeyVault(VaultName=benchmark;SecretName=example)",
    ],
  ])
    negative(280, id, "Secret-manager grammars", `secret="${reference}"\n`);
  for (const [id, invalidReference] of [
    ["onepassword-shape", `op://${value}`],
    ["litellm-identifier", `os.environ/${value}-invalid`],
    ["vault-missing-selector", `vault:${value}`],
    [
      "arn-account",
      `arn:aws:secretsmanager:us-east-1:not-an-account:secret:${value}`,
    ],
  ])
    positive(
      280,
      id,
      "Secret-manager grammars",
      'secret="',
      invalidReference,
      '"\n',
    );

  return {
    "milestone-6-closed": {
      ...wrap(fixtures),
      scope:
        "Regression expectations for closed milestone-6 fixes targeting beta.3. This cohort measures the installed published packages; misses and false positives remain visible against the independent expectations. Some placeholder expectations follow redact-secret's documented exclusions rather than universal credential policy. Connection-string positives label the password only, with the whole URI as the authored envelope; a whole-URI report is covered with measured collateral. Whole-input detection only; streaming, Python, and release acceptance are not evaluated.",
      references: closedBehaviorIssues.map(
        (id) => `https://github.com/redact-secret/redact-secret/issues/${id}`,
      ),
      milestoneReview: milestoneSnapshot,
    },
  };
}
