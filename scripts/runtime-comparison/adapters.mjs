// Adapters for qualification/runtime-comparison-v2.json (#562, #563).
//
// The same three tools as scripts/peer-pii-runtime-throughput/adapters.mjs (#429), which stays unchanged because the
// v1 plan freezes it. The one difference: redact-secret's PII selectors come from the setting being measured, and the
// native add-on accepts one selection per process (a second, different `initializePii` throws
// PII_ACTIVATION_CONFLICT), so one setting is measured per process.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const packageVersion = async name => JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;

function loadRedactSecret(nodeAddonPath, selectors) {
  if (!nodeAddonPath) throw new Error('redact-secret-adapter: no node addon path supplied (see --redact-secret-addon or REDACT_SECRET_NODE_ADDON_PATH)');
  const resolved = path.resolve(nodeAddonPath);
  const addon = require(resolved);
  if (typeof addon.initializePii !== 'function' || typeof addon.scanAndRedact !== 'function' || typeof addon.version !== 'function' || typeof addon.piiActivation !== 'function')
    throw new Error(`redact-secret-adapter: ${resolved} is missing the expected exports (initializePii, scanAndRedact, piiActivation, version)`);
  addon.initializePii(selectors);
  const activation = addon.piiActivation();
  const expected = `selectors=${selectors.length ? selectors.join(',') : 'off'};`;
  if (!activation.includes(expected)) throw new Error(`redact-secret-adapter: unexpected PII activation identity: ${activation}`);
  return {
    id: 'redact-secret',
    version: addon.version(),
    provenance: { kind: 'local-source-build', piiActivation: activation },
    async: false,
    redact: text => addon.scanAndRedact(text).redacted,
  };
}

async function loadFlareRedact() {
  const { redact } = await import('flare-redact');
  return { id: 'flare-redact', version: await packageVersion('flare-redact'), provenance: { kind: 'published-npm-package', package: 'flare-redact' }, async: false, redact: text => redact(text) };
}

async function loadOpenRedaction() {
  const { OpenRedaction } = await import('@openredaction/core');
  const detector = new OpenRedaction();
  return { id: 'openredaction', version: await packageVersion('@openredaction/core'), provenance: { kind: 'published-npm-package', package: '@openredaction/core' }, async: true, redact: async text => (await detector.detect(text)).redacted };
}

export async function loadAdapters({ selectors, redactSecretAddonPath }) {
  const [redactSecret, flareRedact, openRedaction] = await Promise.all([
    loadRedactSecret(redactSecretAddonPath ?? process.env.REDACT_SECRET_NODE_ADDON_PATH ?? path.join(root, '..', 'redact-secret', 'bindings', 'node', 'redact-secret.linux-x64-gnu.node'), selectors),
    loadFlareRedact(),
    loadOpenRedaction(),
  ]);
  return { 'redact-secret': redactSecret, 'flare-redact': flareRedact, openredaction: openRedaction };
}
