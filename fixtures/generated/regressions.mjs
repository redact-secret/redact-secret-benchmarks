// Issue-driven fixtures remain separate from broad format/context baselines.
export function buildRegressions({ fixture, synthetic, wrap, quoted }) {
  const contexts = [
    ["bare", "Provider detection", "", "\n"],
    ["env-token", "Provider detection", "SENDGRID_TOKEN=", "\n"],
    ["env-key", "Provider detection", "SENDGRID_API_KEY=", "\n"],
    ["generic-key", "Generic fallback", "api_key=", "\n"],
    ["json", "Structured text", '{"sendgrid_token":"', '"}\n'],
    ["quoted-env", "Structured text", "SENDGRID_TOKEN='", "'\n"],
    ["unicode", "Encoding", "🔑 邮件 SENDGRID_TOKEN=", "\n"],
    ["crlf", "Encoding", "# mail config\r\nSENDGRID_TOKEN=", "\r\n"],
    ["markdown", "Documentation", "SendGrid credential: `", "`\n"],
    ["bearer", "Authorization", "Authorization: Bearer ", "\n"],
  ];
  const id = synthetic("sendgrid-regression:id", 22);
  const body = synthetic("sendgrid-regression:secret", 43);
  const variants = [
    ["base62", `SG.${id}.${body}`],
    [
      "url-safe",
      `SG.${id.slice(0, 10)}-_${id.slice(12)}.${body.slice(0, 20)}-_${body.slice(22)}`,
    ],
    ["trailing-dash", `SG.${id}.${body.slice(0, -1)}-`],
  ];
  const sendgrid = variants.flatMap(([variant, value]) =>
    contexts.map(([context, group, prefix, suffix]) =>
      fixture(`${variant}-${context}`, group, [
        prefix,
        { secret: value },
        suffix,
      ]),
    ),
  );
  // Negative twins (§2.5): the base62 shape across every context, plus the
  // url-safe shape's bare context, each with the final segment one character
  // shorter than the tool-corroborated 43. Currently dark for twin coverage
  // (issue #29); trailing-dash already carries its own truncation by
  // construction and is left as a distinct near-miss rather than re-twinned.
  const sendgridTwins = contexts.map(([context, group, prefix, suffix]) => ({
    ...fixture(`base62-${context}-twin`, group, [prefix, `SG.${id}.${body.slice(0, -1)}`, suffix]),
    detectors: ["sendgrid-token"],
    twinOf: `base62-${context}`,
    mutation: "length: 42 vs contracted 43",
    mutationKind: "length",
  }));
  const urlSafeValue = variants.find(([variant]) => variant === "url-safe")[1];
  sendgridTwins.push({
    ...fixture("url-safe-bare-twin", "Provider detection", ["", urlSafeValue.slice(0, -1), "\n"]),
    detectors: ["sendgrid-token"],
    twinOf: "url-safe-bare",
    mutation: "length: 42 vs contracted 43",
    mutationKind: "length",
  });
  // Bare malformed shapes: no generic credential field is present to create
  // an independent, valid contextual finding.
  for (const [name, value] of [
    ["short-id", `SG.${id.slice(0, -1)}.${body}`],
    ["short-secret", `SG.${id}.${body.slice(0, -1)}`],
    ["missing-separator", `SG.${id}${body}`],
    ["wrong-separator", `SG.${id}:${body}`],
    ["wrong-prefix", `SX.${id}.${body}`],
    ["prefix-only", "SG."],
    ["masked", "SG.[REDACTED].[REDACTED]"],
    [
      "documentation",
      "SendGrid keys contain a prefix and two URL-safe segments.",
    ],
  ])
    sendgrid.push(fixture(name, "Near-miss negatives", [value, "\n"]));

  const references = [
    [
      "python-settings",
      "Code expressions · #278",
      "password=settings.DATABASE_PASSWORD\n",
    ],
    [
      "typescript-config",
      "Code expressions · #278",
      "apiKey: config.anthropicApiKey,\n",
    ],
    [
      "terraform-resource",
      "Code expressions · #278",
      "password = random_password.db.result\n",
    ],
    [
      "python-environ",
      "Code expressions · #278",
      'api_key=os.environ["OPENAI_API_KEY"]\n',
    ],
    ["rust-type", "Code expressions · #278", "pub api_key: Option<String>,\n"],
    ["go-config", "Code expressions · #278", "password = cfg.RedisPassword\n"],
    ["azure-macro", "Interpolation · #279", "password: $(registryPassword)\n"],
    [
      "shell-command",
      "Interpolation · #279",
      'PASSWORD="$(pass show benchmark/database)"\n',
    ],
    [
      "ruby-interpolation",
      "Interpolation · #279",
      "password: \"#{ENV['DB_PASSWORD']}\"\n",
    ],
    [
      "env-substitution",
      "Interpolation · #279",
      '{"apiKey":"{env:ANTHROPIC_API_KEY}"}\n',
    ],
    ["windows-env", "Interpolation · #279", "PASSWORD=%DB_PASSWORD%\n"],
    ["sql-bind", "Interpolation · #279", "password = :new_password_hash\n"],
    [
      "onepassword",
      "Secret references · #280",
      "PASSWORD=op://Benchmark/database/password\n",
    ],
    [
      "litellm-env",
      "Secret references · #280",
      "api_key: os.environ/ANTHROPIC_API_KEY\n",
    ],
    [
      "gcp-resource",
      "Secret references · #280",
      "secret: projects/example-project/secrets/api-key/versions/latest\n",
    ],
    [
      "vault-reference",
      "Secret references · #280",
      "password: ref+vault://benchmark/database#/password\n",
    ],
    [
      "aws-reference",
      "Secret references · #280",
      "secret: arn:aws:secretsmanager:us-east-1:000000000000:secret:benchmark\n",
    ],
    [
      "azure-keyvault",
      "Secret references · #280",
      "password: @Microsoft.KeyVault(SecretUri=https://example.invalid/secrets/benchmark)\n",
    ],
    [
      "jinja",
      "Template controls · #263",
      'password: "{{ vault_db_password }}"\n',
    ],
    ["shell-env", "Template controls", "password=${DATABASE_PASSWORD}\n"],
  ].map(([id, group, content]) => fixture(id, group, [content]));
  // Paired literal-secret controls prevent a broad reference exclusion from
  // looking good merely because it suppresses all contextual detection.
  for (const [id, prefix, value, suffix, envelope] of [
    ["api-key", "api_key=", synthetic("reference-positive:api", 40), "\n"],
    [
      "password",
      "password=",
      synthetic("reference-positive:password", 32),
      "\n",
    ],
    [
      "dotted-password",
      "password=",
      `SYNTHETIC.${synthetic("reference-positive:dotted", 32)}`,
      "\n",
    ],
    ["quoted-password", "", quoted("password=", synthetic("reference-positive:quoted", 32)), "\n", true],
    [
      "client-secret",
      "client_secret=",
      synthetic("reference-positive:client", 40),
      "\n",
    ],
    [
      "unicode-crlf",
      "🔑\r\napi_key=",
      synthetic("reference-positive:unicode", 40),
      "\r\n",
    ],
  ])
    references.push(
      fixture(id, "Literal-secret positive controls", [
        prefix,
        envelope ? value : { secret: value },
        suffix,
      ]),
    );

  return {
    "sendgrid-regressions": {
      ...wrap([...sendgrid, ...sendgridTwins]),
      references: ["https://github.com/redact-secret/redact-secret/issues/285"],
      scope:
        "SendGrid-shaped strings, including URL-safe punctuation and generic fallback. Synthetic format coverage only; no liveness or provider validation.",
    },
    "reference-syntax": {
      ...wrap(references),
      references: [278, 279, 280, 263].map(
        (id) => `https://github.com/redact-secret/redact-secret/issues/${id}`,
      ),
      scope:
        "Milestone-6-inspired false-positive controls plus literal-secret positives. Tested against the installed package version, not unpublished milestone code. Findings of any policy action count as detections.",
    },
  };
}
