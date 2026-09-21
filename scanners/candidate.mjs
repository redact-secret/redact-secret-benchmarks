import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { findingFamily, familyMappingVersion } from './families.mjs';

const exec = promisify(execFile);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export const candidateConfiguration = Object.freeze({
  adapterVersion: 1,
  familyMappingVersion,
  detectors: 'default',
  runtime: 'node',
  installation: 'isolated-npm-tarballs-with-overrides',
});

export async function installCandidate({ core, node, wasm }) {
  const root = await mkdtemp(path.join(tmpdir(), 'redact-secret-candidate-'));
  try {
    const manifest = {
      name: 'redact-secret-candidate-consumer', private: true, type: 'module',
      dependencies: { '@redact-secret/core': `file:${core}` },
      overrides: {
        '@redact-secret/wasm': `file:${wasm}`,
        [await nodePackageName(node)]: `file:${node}`,
      },
    };
    await writeFile(path.join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await exec(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], {
      cwd: root, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, npm_config_update_notifier: 'false' },
    });
    const packageJson = JSON.parse(await readFile(path.join(root, 'node_modules/@redact-secret/core/package.json'), 'utf8'));
    if (packageJson.name !== '@redact-secret/core' || typeof packageJson.version !== 'string') throw new Error('identity');
    return { root, packageName: packageJson.name, declaredVersion: packageJson.version };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw new Error('candidate-installation-failed', { cause: error });
  }
}

async function nodePackageName(tarball) {
  const root = await mkdtemp(path.join(tmpdir(), 'redact-secret-node-identity-'));
  try {
    await exec('tar', ['-xzf', tarball, '-C', root, 'package/package.json'], { timeout: 30_000 });
    const value = JSON.parse(await readFile(path.join(root, 'package/package.json'), 'utf8'));
    if (typeof value.name !== 'string' || !/^@redact-secret\/node-/.test(value.name)) throw new Error('identity');
    return value.name;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function loadCandidate(installation, ruleset) {
  try {
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?candidate=${Date.now()}`);
    if (typeof module.initialize !== 'function' || typeof module.scan !== 'function') throw new Error('api');
    await module.initialize();
    const options = ruleset ? { ruleset } : undefined;
    return {
      version: typeof module.VERSION === 'string' ? module.VERSION : installation.declaredVersion,
      async scan(root, fixtures) {
        const results = [];
        for (const fixture of fixtures) {
          const text = await readFile(path.join(root, fixture.path), 'utf8');
          const findings = module.scan(text, options);
          if (!Array.isArray(findings)) throw new Error('scan');
          for (const finding of findings) results.push({
            path: fixture.path,
            start: Buffer.byteLength(text.slice(0, finding.start)),
            end: Buffer.byteLength(text.slice(0, finding.end)),
            ...findingFamily('redact-secret', finding.detector),
          });
        }
        return results;
      },
    };
  } catch (error) {
    throw new Error('candidate-initialization-failed', { cause: error });
  }
}

export async function removeCandidate(installation) {
  if (installation?.root) await rm(installation.root, { recursive: true, force: true });
}
