import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { build, version as viteVersion } from 'vite';
import { piiProfileCostCommitment, validatePiiProfileCostBrowserBundleManifest } from '../benchmarks/evaluation/domains/pii/profile-cost.ts';
import { sha256 } from './pii-profile-cost/adapter-protocol.mjs';

const run = promisify(execFile), args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(profile|core|wasm|work|output)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('Invalid browser bundle argument');
  args[match[1]] = match[2];
}
if (!['full', 'common'].includes(args.profile) || ['core', 'wasm', 'work', 'output'].some(key => !args[key]))
  throw new Error('Required: --profile=full|common --core=<tgz> --wasm=<tgz> --work=<dir> --output=<json>');
if (viteVersion !== '8.3.0') throw new Error('PII profile-cost browser bundle requires Vite 8.3.0');
const work = path.resolve(args.work), output = path.resolve(args.output);
await rm(work, { recursive: true, force: true }); await mkdir(work, { recursive: true });
await writeFile(path.join(work, 'package.json'), `${JSON.stringify({ private: true, type: 'module' })}\n`);
await run('npm', ['install', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund', path.resolve(args.core), path.resolve(args.wasm)],
  { cwd: work, timeout: 120_000 });
const entry = args.profile === 'full' ? '@redact-secret/core' : '@redact-secret/core/common';
await writeFile(path.join(work, 'index.html'), '<!doctype html><script type="module" src="/main.js"></script>\n');
await writeFile(path.join(work, 'main.js'), `import{initialize,scan}from'${entry}';await initialize({pii:['pii:global']});scan('bundle-smoke');\n`);
const dist = path.join(work, 'dist');
await build({ root: work, logLevel: 'error', build: { outDir: dist, emptyOutDir: true, minify: true } });
const files = [];
for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) if (entry.isFile()) {
  const value = path.join(entry.parentPath, entry.name), bytes = await readFile(value);
  files.push({ path: value, relativePath: path.relative(dist, value), sha256: sha256(bytes) });
}
files.sort((a, b) => a.path.localeCompare(b.path));
if (!files.some(row => row.path.endsWith('.js')) || !files.some(row => row.path.endsWith('.wasm')))
  throw new Error('Browser consumer bundle is incomplete');
const projection = { profile: args.profile, tool: `vite-${viteVersion}`, entry,
  files: files.map(({ relativePath, sha256: digest }) => ({ relativePath, sha256: digest })) };
validatePiiProfileCostBrowserBundleManifest({ ...projection, bundleManifestCommitment: piiProfileCostCommitment(projection) }, args.profile);
await writeFile(output, `${JSON.stringify({ ...projection, bundleManifestCommitment: piiProfileCostCommitment(projection), files }, null, 2)}\n`);
