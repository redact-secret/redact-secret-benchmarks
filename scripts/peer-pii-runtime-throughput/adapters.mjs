// Adapters for qualification/peer-pii-runtime-throughput-v1.json (#429).
//
// Each adapter exposes { id, version, provenance, async, redact(text) }. The
// orchestrator (scripts/measure-peer-pii-runtime-throughput.mjs) times
// `redact()` itself with performance.now(), awaiting it when `async` is
// true — this file never times anything, so every tool is timed the same
// way regardless of how differently each one is loaded or activated.
//
// Every `redact()` call performs the tool's actual redact operation (finds
// PII and returns the replaced text), never a position-only scan — see the
// plan's `tools[].call` field, which names the exact function each of these
// wraps, and the ADR's item 3 for why.

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const packageVersion = async (name) => JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;

// #429 measures redact-secret's PII redaction with pii:global active. That
// selector is not in any published @redact-secret/core release yet (it is
// source-only on redact-secret's main branch as of this plan), so this
// adapter loads a locally built native addon rather than the npm package
// scanners/index.mjs and the rest of this repo's accuracy pipeline use.
// This is a deliberate scope boundary (ADR "Consequences"): this plan does
// not stand up the multi-surface candidate-build pipeline
// qualification/pii-profile-cost-v1.json already owns. The addon path is
// supplied by the caller (env var or CLI flag), never guessed silently, so
// a missing/misconfigured build fails closed instead of measuring nothing.
async function loadRedactSecretAdapter(nodeAddonPath) {
  if (!nodeAddonPath) throw new Error('redact-secret-adapter: no node addon path supplied (see --redact-secret-addon or REDACT_SECRET_NODE_ADDON_PATH)');
  const resolved = path.resolve(nodeAddonPath);
  const addon = require(resolved);
  if (typeof addon.initializePii !== 'function' || typeof addon.scanAndRedact !== 'function' || typeof addon.version !== 'function')
    throw new Error(`redact-secret-adapter: ${resolved} is missing the expected exports (initializePii, scanAndRedact, version)`);
  addon.initializePii(['pii:global']);
  const activation = typeof addon.piiActivation === 'function' ? addon.piiActivation() : null;
  if (activation && !activation.includes('selectors=pii:global')) throw new Error(`redact-secret-adapter: unexpected PII activation identity: ${activation}`);
  return {
    id: 'redact-secret',
    version: addon.version(),
    provenance: { kind: 'local-source-build', piiActivation: activation },
    async: false,
    redact: (text) => addon.scanAndRedact(text).redacted,
  };
}

// flare-redact's own PII detectors run at their package default (no
// `disable`), unlike this repo's accuracy adapter (scanners/index.mjs),
// which disables `pii` because the accuracy corpus is secrets-only. Here
// PII detection is exactly what's being timed.
async function loadFlareRedactAdapter() {
  const { redact } = await import('flare-redact');
  return {
    id: 'flare-redact',
    version: await packageVersion('flare-redact'),
    provenance: { kind: 'published-npm-package', package: 'flare-redact' },
    async: false,
    redact: (text) => redact(text),
  };
}

// OpenRedaction's constructor default options: every built-in pattern
// category enabled. `detect()` is Promise-returning (see plan/spec for the
// async-vs-sync measurement caveat this implies).
async function loadOpenRedactionAdapter() {
  const { OpenRedaction } = await import('@openredaction/core');
  const detector = new OpenRedaction();
  return {
    id: 'openredaction',
    version: await packageVersion('@openredaction/core'),
    provenance: { kind: 'published-npm-package', package: '@openredaction/core' },
    async: true,
    redact: async (text) => (await detector.detect(text)).redacted,
  };
}

export async function loadAdapters({ redactSecretAddonPath } = {}) {
  const [redactSecret, flareRedact, openRedaction] = await Promise.all([
    loadRedactSecretAdapter(redactSecretAddonPath ?? process.env.REDACT_SECRET_NODE_ADDON_PATH ??
      path.join(root, '..', 'redact-secret', 'bindings', 'node', 'redact-secret.linux-x64-gnu.node')),
    loadFlareRedactAdapter(),
    loadOpenRedactionAdapter(),
  ]);
  return { 'redact-secret': redactSecret, 'flare-redact': flareRedact, openredaction: openRedaction };
}
