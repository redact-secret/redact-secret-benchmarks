#!/usr/bin/env node
/**
 * Install a registered product candidate (benchmarks/product-candidates.json) over the Node shim's published install (#698).
 *
 *   node scripts/install-product-candidate.mjs --candidate <id> --node-dir <engine adapters/node> [--platform linux-x64] [--assets <dir>] [--receipt <file>]
 *
 * The candidate is an unpublished build, so it can only be measured as an exploratory run; what makes that safe is that the bytes are the registered ones:
 * every tarball is fetched from the registry's release (or read from --assets), refused unless its size and sha256 are the registered ones, and extracted
 * over `node_modules/<package>` (the directory is emptied first, so nothing of the published build is left). The shim then loads it and must report the
 * candidate's version. Nothing is fetched except the registered release assets and nothing is published. Writes a receipt: the candidate, its commit and
 * the digest of every file it installed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function readRegistry(file = path.join(root, 'benchmarks/product-candidates.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function candidateOf(registry, id) {
  const candidate = registry.candidates?.find(c => c.id === id);
  if (!candidate) throw new Error(`no product candidate ${id} in benchmarks/product-candidates.json`);
  return candidate;
}

/** The packages a platform installs: the platform-neutral ones and the one addon built for it. */
export function packagesFor(candidate, platform) {
  return candidate.packages.filter(p => p.platform === null || p.platform === platform);
}

/** Every file under `dir`, relative, with its sha256, in a stable order. */
export function treeDigest(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ path: path.relative(dir, full).split(path.sep).join('/'), sha256: sha256(readFileSync(full)) });
    }
  };
  walk(dir);
  return files;
}

function obtain(candidate, pkg, assets, scratch) {
  const target = path.join(scratch, pkg.file);
  if (assets) {
    cpSync(path.join(assets, pkg.file), target);
  } else {
    execFileSync('gh', ['release', 'download', candidate.release.tag, '-R', candidate.release.repository, '-p', pkg.file, '-D', scratch, '--clobber'], { stdio: 'inherit' });
  }
  const bytes = readFileSync(target);
  if (bytes.length !== pkg.size) throw new Error(`${pkg.file} has ${bytes.length} bytes, the registry pins ${pkg.size}`);
  if (sha256(bytes) !== pkg.sha256) throw new Error(`${pkg.file} has digest ${sha256(bytes)}, the registry pins ${pkg.sha256}`);
  return target;
}

export function install({ registry, id, nodeDir, platform, assets, receipt }) {
  const candidate = candidateOf(registry, id);
  if (candidate.platform !== platform) throw new Error(`candidate ${id} is built for ${candidate.platform}, not ${platform}`);
  const modules = path.join(nodeDir, 'node_modules');
  if (!existsSync(modules)) throw new Error(`${modules} does not exist: install the shim's published dependencies first (npm ci --ignore-scripts)`);
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'product-candidate-'));
  const installed = [];
  try {
    for (const pkg of packagesFor(candidate, platform)) {
      const tarball = obtain(candidate, pkg, assets, scratch);
      const into = path.join(scratch, `extract-${pkg.name.replace(/\W/g, '_')}`);
      mkdirSync(into, { recursive: true });
      execFileSync('tar', ['-xzf', tarball, '-C', into, '--strip-components=1']);
      const manifest = JSON.parse(readFileSync(path.join(into, 'package.json'), 'utf8'));
      if (manifest.name !== pkg.name || manifest.version !== candidate.product.version) throw new Error(`${pkg.file} is ${manifest.name}@${manifest.version}, expected ${pkg.name}@${candidate.product.version}`);
      const destination = path.join(modules, ...pkg.name.split('/'));
      rmSync(destination, { recursive: true, force: true });
      mkdirSync(path.dirname(destination), { recursive: true });
      cpSync(into, destination, { recursive: true });
      installed.push({ name: pkg.name, version: manifest.version, tarballSha256: pkg.sha256, files: treeDigest(destination) });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const result = {
    schema: 'redact-secret/product-candidate-receipt/v1',
    candidate: id, commit: candidate.product.commit, version: candidate.product.version, platform, runClass: candidate.runClass, publication: candidate.publication,
    packages: installed,
  };
  if (receipt) writeFileSync(receipt, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

/** The shim must load what was installed and report the candidate's version (the product's own VERSION export). */
export function verifyLoaded({ nodeDir, shim, expectedVersion }) {
  const run = spawnSync('node', [shim, 'version', 'redact-secret', nodeDir], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`the shim could not load the installed candidate: ${run.stderr.trim()}`);
  const reported = JSON.parse(run.stdout.trim().split('\n').pop()).version;
  if (reported !== expectedVersion) throw new Error(`the shim loaded ${reported}, the candidate is ${expectedVersion}`);
  return reported;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  const id = option('candidate'), nodeDir = option('node-dir');
  if (!id || !nodeDir) { console.error('usage: install-product-candidate.mjs --candidate <id> --node-dir <dir> [--platform linux-x64] [--assets <dir>] [--receipt <file>]'); process.exit(2); }
  const platform = option('platform') ?? 'linux-x64';
  const resolved = path.resolve(nodeDir);
  try {
    const registry = readRegistry();
    const result = install({ registry, id, nodeDir: resolved, platform, assets: option('assets') && path.resolve(option('assets')), receipt: option('receipt') && path.resolve(option('receipt')) });
    const loaded = verifyLoaded({ nodeDir: resolved, shim: path.join(resolved, 'shim.mjs'), expectedVersion: result.version });
    console.log(`product candidate ${id} (${result.commit.slice(0, 12)}) installed over ${resolved}: ${result.packages.map(p => `${p.name} ${p.tarballSha256.slice(7, 19)}`).join(', ')}; the shim loads ${loaded}`);
  } catch (error) {
    console.error(`install refused: ${error.message}`);
    process.exit(4);
  }
}
