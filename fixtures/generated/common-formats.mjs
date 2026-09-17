import { createPrivateKey, sign } from 'node:crypto';

// Public fixed seed for a test key, never deployed or associated with an account.
// Parsing and signing establish structure, not credential liveness.
export function publicTestKey() {
  return createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '86c1e3a759f0248bd690cfa83715e602496da85b9c037ea162bf74d0983256ac', 'hex'), format: 'der', type: 'pkcs8' });
}

export function buildCommonFormats({ fixture, synthetic, wrap }) {
  const fixtures = [];
  const value = (label, n, chars) => synthetic(`reviewed-formats:${label}`, n, chars);
  const add = (family, variant, parts, reason) => {
    for (const [context, before, after] of [['plain', '', '\n'], ['unicode-crlf', '# 🔑 reviewed format\r\n', '\r\n']]) {
      const f = fixture(`${family}-${variant}-${context}`, family, [before, ...parts, after]);
      fixtures.push({ ...f, detectors: [family], formatReason: reason });
    }
  };
  const token = (family, variant, secret, extra = '') => add(family, variant, [{ secret }, '\n', extra], 'Pinned source-backed lexical format; synthetic and never provider-issued. Any missing scanner support remains in the result.');
  const hex = '0123456789abcdef';
  for (const prefix of ['ghp', 'gho', 'ghu', 'ghs', 'ghr']) token('github-token', prefix, prefix + '_' + value(prefix, 36));
  token('gitlab-token', 'pat', 'glpat-' + value('gitlab', 20));
  token('anthropic-token', 'api03', 'sk-ant-api03-' + value('anthropic', 93) + 'AA');
  token('openai-token', 'legacy', 'sk-' + value('openai-left', 20) + 'T3BlbkFJ' + value('openai-right', 20));
  for (const variant of ['proj', 'svcacct']) token('openai-token', variant, `sk-${variant}-` + value(variant + ':left', 74) + 'T3BlbkFJ' + value(variant + ':right', 74));
  add('aws-access-key', 'pair', ['AWS_ACCESS_KEY_ID=', { secret: 'AKIA' + value('aws-id', 16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567') }, '\nAWS_SECRET_ACCESS_KEY=', { secret: value('aws-secret', 40, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/+') }], 'AKIA ID and separate 40-character secret together. Both secret components are expected; composite scanner output is mapped without consulting expected ranges. ASIA/session credentials are not covered.');
  for (const prefix of ['shpat_', 'shppa_']) token('shopify-token', prefix.slice(0, -1), prefix + value(prefix, 32, hex), 'SHOP_DOMAIN=benchmark-never-issued.myshopify.com');
  token('vault-token', 'service', 'hvs.' + value('vault', 100), 'VAULT_ADDR=https://benchmark-never-issued.hashicorp.cloud');
  for (const mode of ['live', 'test']) token('stripe-token', mode, `sk_${mode}_` + value('stripe:' + mode, 32));
  token('slack-token', 'bot', `xoxb-${value('slack-team', 12, '0123456789')}-${value('slack-bot', 12, '0123456789')}-${value('slack-secret', 24)}`);
  token('huggingface-token', 'user', 'hf_' + value('hf', 34, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'));
  token('docker-token', 'pat', 'dckr_pat_' + value('docker-pat', 27));
  token('docker-token', 'oat', 'dckr_oat_' + value('docker-oat', 32));
  token('cloudflare-token', 'user', 'cfut_' + value('cf', 40) + value('cf-suffix', 8, hex));
  for (const prefix of ['dop', 'doo', 'dor']) token('digitalocean-token', prefix, prefix + '_v1_' + value(prefix, 64, hex));
  token('linear-token', 'api', 'lin_api_' + value('linear', 40));
  token('npm-token', 'access', 'npm_' + value('npm', 36));
  token('sendgrid-token', 'segmented', `SG.${value('sg-id', 22)}.${value('sg-secret', 43)}`);
  const key = publicTestKey();
  add('private-key', 'ed25519', [{ secret: key.export({ type: 'pkcs8', format: 'pem' }).trimEnd() }], 'Locally parseable Ed25519 PKCS#8 private key from a fixed public test seed. Never deployed; not a provider-issued credential.');
  const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${encode({ alg: 'EdDSA', typ: 'JWT' })}.${encode({ sub: 'benchmark-only', iss: 'https://example.invalid', iat: 1700000000, exp: 4102444800 })}`;
  add('jwt', 'eddsa', [{ secret: unsigned + '.' + sign(null, Buffer.from(unsigned), key).toString('base64url') }], 'EdDSA JWT signed locally with the public test key. Syntax and signature are checked offline; no production issuer or trust is implied.');
  return { 'common-formats': { ...wrap(fixtures), scope: 'Source-reviewed synthetic lexical formats and locally parseable cryptographic controls. Selection is independent of scanner results. Unsupported formats and format-correct misses remain visible. This is not provider issuance validation or a product ranking.' } };
}
