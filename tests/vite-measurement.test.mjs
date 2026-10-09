import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build, version } from 'vite';
import { piiProfileCostCommitment, validatePiiProfileCostBrowserBundleManifest } from '../benchmarks/evaluation/domains/pii/profile-cost.ts';
import { validatePiiProfileCostBrowserBundleManifest as validateV2 } from '../benchmarks/evaluation/domains/pii/profile-cost-v2.ts';

test('the pinned measurement bundler emits JS and WASM under the existing manifest identity', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'vite-measurement-'));
  try {
    assert.equal(version, '8.3.0');
    await writeFile(path.join(directory, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(path.join(directory, 'main.js'), "import wasm from './synthetic.wasm?url'; console.log(wasm);");
    // A synthetic asset larger than Vite's inline threshold exercises real asset emission.
    await writeFile(path.join(directory, 'synthetic.wasm'), new Uint8Array(8192));
    await build({ configFile: false, root: directory, logLevel: 'silent', build: { minify: true } });
    const dist = path.join(directory, 'dist');
    const files = [];
    for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name);
      files.push({ relativePath: path.relative(dist, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
    }
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    assert.ok(files.some(file => file.relativePath.endsWith('.js')));
    assert.ok(files.some(file => file.relativePath.endsWith('.wasm')));
    const projection = { profile: 'full', tool: `vite-${version}`, entry: '@redact-secret/core', files };
    const manifest = { ...projection, bundleManifestCommitment: piiProfileCostCommitment(projection) };
    assert.doesNotThrow(() => validatePiiProfileCostBrowserBundleManifest(manifest, 'full'));
    assert.doesNotThrow(() => validateV2(manifest, 'full'));
    assert.throws(() => validateV2({ ...manifest, tool: 'vite-8.3.2' }, 'full'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('both browser builder CLIs load the pinned measurement bundler before rejecting incomplete requests', async () => {
  const run = promisify(execFile);
  for (const script of ['build-pii-profile-cost-browser-bundle.mjs', 'build-pii-profile-cost-browser-bundle-v2.mjs'])
    await assert.rejects(run(process.execPath, ['--import', 'tsx', `scripts/${script}`]), error => /Required: --profile/.test(error.stderr));
});
