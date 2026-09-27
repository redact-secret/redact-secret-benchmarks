export function buildPolicyQualifiedCredentials({ fixture, synthetic, wrap, ENVELOPES }) {
  const fixtures = [];
  const positive = (family, id, axis, parts, expectedAction) => fixtures.push({
    ...fixture(`${family}-${id}`, family, parts), detectors: [family], policyFamily: family,
    policyConformance: true, contextAxis: axis, expectedAction,
  });
  const control = (family, id, axis, parts) => fixtures.push({
    ...fixture(`${family}-${id}`, family, parts), detectors: [family], policyFamily: family,
    policyConformance: true, contextAxis: axis,
  });
  const twin = (family, id, positiveId, parts, mutation, mutationKind) => fixtures.push({
    ...fixture(`${family}-${id}`, family, parts), detectors: [family], policyFamily: family,
    policyConformance: true, twinOf: `${family}-${positiveId}`, mutation, mutationKind,
  });

  const bearer = synthetic('policy-qualified:bearer', 32);
  positive('bearer-token', 'authorization-header', 'authorization-header',
    ['Authorization: Bearer ', { secret: bearer }, '\n'], 'redact');
  positive('bearer-token', 'proxy-header', 'proxy-authorization-header',
    ['Proxy-Authorization:\tBearer\t', { secret: synthetic('policy-qualified:bearer-proxy', 32) }, '\n'], 'redact');
  twin('bearer-token', 'authorization-header-twin', 'authorization-header', ['Authorization: Bearer shortvalue\n'],
    'length: credential value is below the frozen project-policy floor', 'length');
  control('bearer-token', 'reference', 'reference', ['Authorization: Bearer ${ACCESS_TOKEN}\n']);

  const postgresPassword = synthetic('policy-qualified:connection-postgres', 24);
  positive('connection-string', 'postgres-userinfo', 'postgres-userinfo',
    ['postgres://fixture:', { secret: postgresPassword }, '@db.example.invalid/benchmark\n'], 'redact');
  positive('connection-string', 'rediss-password-only', 'redis-password-only',
    ['rediss://:', { secret: synthetic('policy-qualified:connection-rediss', 24) }, '@cache.example.invalid/0\n'], 'redact');
  twin('connection-string', 'postgres-userinfo-twin', 'postgres-userinfo',
    [`postgres://fixture${postgresPassword}@db.example.invalid/benchmark\n`],
    'context: the userinfo password colon is absent while the value is unchanged', 'context');
  control('connection-string', 'reference', 'reference', ['postgres://fixture:${DB_PASSWORD}@db.example.invalid/benchmark\n']);

  const otp = suffix => synthetic(`policy-qualified:otp:${suffix}`, 32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
  positive('otpauth-uri', 'query-order', 'query-order',
    ['otpauth://totp/Benchmark:fixture?issuer=Benchmark&secret=', { secret: otp('query-order') }, '&algorithm=SHA1\n'], 'redact');
  positive('otpauth-uri', 'quoted-config', 'quoted-config',
    ['otp_uri="otpauth://hotp/Benchmark:fixture?secret=', { secret: otp('quoted') }, '&issuer=Benchmark&counter=0"\n'], 'redact');
  positive('otpauth-uri', 'unicode-crlf', 'unicode-crlf',
    ['# 🔑 密钥\r\notpauth://totp/Benchmark:fixture?secret=', { secret: otp('unicode') }, '&issuer=Benchmark\r\n'], 'redact');
  twin('otpauth-uri', 'query-order-twin', 'query-order',
    [`otpauth://totp/Benchmark:fixture?issuer=Benchmark&secret=${otp('query-order').slice(0, 8)}1${otp('query-order').slice(9)}&algorithm=SHA1\n`],
    'alphabet: one character is outside uppercase Base32', 'alphabet');
  control('otpauth-uri', 'lowercase-control', 'unsupported-case', ['otpauth://totp/Benchmark:fixture?secret=abcdefghijklmnop&issuer=Benchmark\n']);
  control('otpauth-uri', 'duplicate-first-control', 'duplicate-first', ['otpauth://totp/Benchmark:fixture?secret=ABC&secret=ABCDEFGHIJKLMNOP&issuer=Benchmark\n']);
  control('otpauth-uri', 'reference-control', 'reference', ['TOTP_URI=${TOTP_URI}\n']);

  const generic = synthetic('policy-qualified:generic', 28);
  positive('generic-token', 'high-signal-redact', 'high-signal-entropy', ['api_key="', { secret: generic }, '"\n'], 'redact');
  positive('generic-token', 'high-signal-warn', 'high-signal-short-direct-literal',
    ['password=', { secret: synthetic('policy-qualified:generic-warn', 12) }, '\n'], 'warn');
  twin('generic-token', 'high-signal-redact-twin', 'high-signal-redact', [`build_id="${generic}"\n`],
    'context: an ordinary build identifier replaces the high-signal credential field name', 'context');
  control('generic-token', 'reference', 'reference', ['api_key=${API_KEY}\n']);

  return wrap(fixtures);
}
