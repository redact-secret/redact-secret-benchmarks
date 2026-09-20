import { createPrivateKey, createPublicKey, sign } from 'node:crypto';

// Public fixed seed for a test key, never deployed or associated with an account.
// Parsing and signing establish structure, not credential liveness.
export function publicTestKey() {
  return createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '86c1e3a759f0248bd690cfa83715e602496da85b9c037ea162bf74d0983256ac', 'hex'), format: 'der', type: 'pkcs8' });
}

export function buildCommonFormats({ fixture, synthetic, wrap }) {
  const fixtures = [];
  const value = (label, n, chars) => synthetic(`reviewed-formats:${label}`, n, chars);
  const contexts = [['plain', '', '\n'], ['unicode-crlf', '# 🔑 reviewed format\r\n', '\r\n']];
  const add = (family, variant, parts, reason) => {
    for (const [context, before, after] of contexts) {
      const f = fixture(`${family}-${variant}-${context}`, family, [before, ...parts, after]);
      fixtures.push({ ...f, detectors: [family], formatReason: reason });
    }
  };
  // Negative twin (§2.5): the same context with exactly one structural property
  // mutated. `twin` is the mutated literal; silence follows from construction.
  // `twinVariant` lets a second twin of the same positive (different mutation
  // axis) get its own fixture id while `twinOf` still points at the positive.
  const addTwin = (family, variant, twin, mutationKind, mutation, extra = '', twinVariant = variant) => {
    for (const [context, before, after] of contexts) {
      const f = fixture(`${family}-${twinVariant}-${context}-twin`, family, [before, twin, '\n', extra, after]);
      fixtures.push({ ...f, detectors: [family], twinOf: `${family}-${variant}-${context}`, mutation, mutationKind });
    }
  };
  const token = (family, variant, secret, extra = '') => add(family, variant, [{ secret }, '\n', extra], 'Pinned source-backed lexical format; synthetic and never provider-issued. Any missing scanner support remains in the result.');
  const hex = '0123456789abcdef';
  for (const prefix of ['ghp', 'gho', 'ghu', 'ghs', 'ghr']) {
    const body = value(prefix, 36);
    token('github-token', prefix, prefix + '_' + body);
    addTwin('github-token', prefix, prefix + '_' + body.slice(0, 35), 'length', 'length: 35 vs contracted 36');
  }
  const gitlab = value('gitlab', 20);
  token('gitlab-token', 'pat', 'glpat-' + gitlab);
  addTwin('gitlab-token', 'pat', 'glpat-' + gitlab.slice(0, 19), 'length', 'length: 19 vs contracted 20');
  const anthropic = value('anthropic', 93);
  token('anthropic-token', 'api03', 'sk-ant-api03-' + anthropic + 'AA');
  addTwin('anthropic-token', 'api03', 'sk-ant-api04-' + anthropic + 'AA', 'prefix', 'prefix namespace: sk-ant-api04- vs contracted sk-ant-api03-');
  const openaiLeft = value('openai-left', 20), openaiRight = value('openai-right', 20);
  token('openai-token', 'legacy', 'sk-' + openaiLeft + 'T3BlbkFJ' + openaiRight);
  addTwin('openai-token', 'legacy', 'sk-' + openaiLeft + 'T3BlbkFK' + openaiRight, 'boundary', 'internal marker: T3BlbkFK vs contracted T3BlbkFJ');
  for (const variant of ['proj', 'svcacct']) {
    const left = value(variant + ':left', 74), right = value(variant + ':right', 74);
    token('openai-token', variant, `sk-${variant}-` + left + 'T3BlbkFJ' + right);
    addTwin('openai-token', variant, `sk-${variant}-` + left.slice(0, 73) + 'T3BlbkFJ' + right, 'length', 'length: 73-character left segment vs contracted 74');
  }
  add('aws-access-key', 'pair', ['AWS_ACCESS_KEY_ID=', { secret: 'AKIA' + value('aws-id', 16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567') }, '\nAWS_SECRET_ACCESS_KEY=', { secret: value('aws-secret', 40, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/+') }], 'AKIA ID and separate 40-character secret together. Both secret components are expected; composite scanner output is mapped without consulting expected ranges. ASIA/session credentials are not covered.');
  for (const prefix of ['shpat_', 'shppa_']) {
    const body = value(prefix, 32, hex);
    token('shopify-token', prefix.slice(0, -1), prefix + body, 'SHOP_DOMAIN=benchmark-never-issued.myshopify.com');
    addTwin('shopify-token', prefix.slice(0, -1), 'shpxx_' + body, 'prefix', `prefix namespace: shpxx_ vs contracted ${prefix}`, 'SHOP_DOMAIN=benchmark-never-issued.myshopify.com');
  }
  const vault = value('vault', 100);
  token('vault-token', 'service', 'hvs.' + vault, 'VAULT_ADDR=https://benchmark-never-issued.hashicorp.cloud');
  addTwin('vault-token', 'service', 'hvs.' + vault.slice(0, 23), 'length', 'length: 23 vs provider-documented minimum 24', 'VAULT_ADDR=https://benchmark-never-issued.hashicorp.cloud');
  for (const mode of ['live', 'test']) {
    const body = value('stripe:' + mode, 32);
    token('stripe-token', mode, `sk_${mode}_` + body);
    addTwin('stripe-token', mode, `pk_${mode}_` + body, 'public-prefix', `public prefix: pk_${mode}_ (documented as safe to expose) vs secret sk_${mode}_`);
  }
  const team = value('slack-team', 12, '0123456789'), bot = value('slack-bot', 12, '0123456789'), slackSecret = value('slack-secret', 24);
  token('slack-token', 'bot', `xoxb-${team}-${bot}-${slackSecret}`);
  addTwin('slack-token', 'bot', `xoxb-${team}-${bot}${slackSecret}`, 'boundary', 'boundary: missing dash before the secret section');
  const hf = value('hf', 34, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
  token('huggingface-token', 'user', 'hf_' + hf);
  addTwin('huggingface-token', 'user', 'hf_' + hf.slice(0, 33), 'length', 'length: 33 vs contracted 34');
  const dockerPat = value('docker-pat', 27), dockerOat = value('docker-oat', 32);
  token('docker-token', 'pat', 'dckr_pat_' + dockerPat);
  addTwin('docker-token', 'pat', 'dckr_pat_' + dockerPat.slice(0, 26), 'length', 'length: 26 vs contracted 27');
  token('docker-token', 'oat', 'dckr_oat_' + dockerOat);
  addTwin('docker-token', 'oat', 'dckr_oat_' + dockerOat.slice(0, 31), 'length', 'length: 31 vs contracted 32');
  const cf = value('cf', 40);
  token('cloudflare-token', 'user', 'cfut_' + cf + value('cf-suffix', 8, hex));
  addTwin('cloudflare-token', 'user', 'cfut_' + cf + 'ghijklmn', 'alphabet', 'alphabet: non-hexadecimal eight-character suffix');
  for (const prefix of ['dop', 'doo', 'dor']) {
    const body = value(prefix, 64, hex);
    token('digitalocean-token', prefix, prefix + '_v1_' + body);
    addTwin('digitalocean-token', prefix, prefix + '_v1_' + body.slice(0, 63), 'length', 'length: 63 vs contracted 64');
  }
  const linear = value('linear', 40);
  token('linear-token', 'api', 'lin_api_' + linear);
  addTwin('linear-token', 'api', 'lin_api_' + linear.slice(0, 39), 'length', 'length: 39 vs contracted 40');
  const npm = value('npm', 36);
  token('npm-token', 'access', 'npm_' + npm);
  addTwin('npm-token', 'access', 'npm_' + npm.slice(0, 35), 'length', 'length: 35 vs contracted 36');
  const sgId = value('sg-id', 22), sgSecret = value('sg-secret', 43);
  token('sendgrid-token', 'segmented', `SG.${sgId}.${sgSecret}`);
  addTwin('sendgrid-token', 'segmented', `SG.${sgId}:${sgSecret}`, 'boundary', 'boundary: colon instead of the dot separator between segments');
  addTwin('sendgrid-token', 'segmented', `SG.${sgId}.${sgSecret.slice(0, -1)}`, 'length', 'length: 68-character key vs SendGrid-documented fixed 69-character length', '', 'segmented-length');
  const key = publicTestKey();
  add('private-key', 'ed25519', [{ secret: key.export({ type: 'pkcs8', format: 'pem' }).trimEnd() }], 'Locally parseable Ed25519 PKCS#8 private key from a fixed public test seed. Never deployed; not a provider-issued credential.');
  addTwin('private-key', 'ed25519', createPublicKey(key).export({ type: 'spki', format: 'pem' }).trimEnd(), 'public-prefix', 'public material: RFC 7468 PUBLIC KEY block of the same test key vs PRIVATE KEY');
  const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${encode({ alg: 'EdDSA', typ: 'JWT' })}.${encode({ sub: 'benchmark-only', iss: 'https://example.invalid', iat: 1700000000, exp: 4102444800 })}`;
  add('jwt', 'eddsa', [{ secret: unsigned + '.' + sign(null, Buffer.from(unsigned), key).toString('base64url') }], 'EdDSA JWT signed locally with the public test key. Syntax and signature are checked offline; no production issuer or trust is implied.');
  addTwin('jwt', 'eddsa', unsigned + '.', 'boundary', 'boundary: signature segment absent (unsigned header.payload.)');
  return { 'common-formats': { ...wrap(fixtures), scope: 'Source-reviewed synthetic lexical formats and locally parseable cryptographic controls, each paired with one or more negative twins, every twin mutating exactly one structural property. Selection is independent of scanner results. Unsupported formats and format-correct misses remain visible. This is not provider issuance validation or a product ranking.' } };
}
