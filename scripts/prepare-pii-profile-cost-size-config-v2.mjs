import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { sha256 } from './pii-profile-cost/adapter-protocol.mjs';
import { piiProfileCostCommitment, piiProfileCostPlan,
  validatePiiProfileCostBrowserBundleManifest } from '../benchmarks/evaluation/domains/pii/profile-cost-v2.ts';

const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(baseline|candidate|output)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('Invalid size preparation argument');
  args[match[1]] = path.resolve(match[2]);
}
if (!args.baseline || !args.candidate || !args.output) throw new Error('Required: --baseline=<dir> --candidate=<dir> --output=<json>');
// redact-secret#937: the `_pii` builds ship beside the defaults in the same qualified browser artifacts.
const piiWasm = async qualified => {
  const { access } = await import('node:fs/promises');
  const rows = [];
  for (const [profile, value] of [['pii:full', 'wasm-web/redact_secret_wasm_pii_bg.wasm'], ['pii:common', 'wasm-web-common/redact_secret_wasm_common_pii_bg.wasm']])
    if (await access(path.join(qualified, value)).then(() => true, () => false)) rows.push([profile, value]);
  return rows;
};
const side = async root => {
  const product = path.join(root, 'product');
  const git = (...arguments_) => execFileSync('git', arguments_, { cwd: product, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain') !== '') throw new Error(`Size product checkout is dirty: ${product}`);
  const inventory = path.join(root, 'qualified/artifact-inventory/artifact-inventory.json');
  const tarballs = (await import('node:fs/promises')).readdir(path.join(root, 'candidate'));
  const files = await tarballs;
  const npm = id => files.find(file => file.startsWith(`redact-secret-${id}-`) && file.endsWith('.tgz'));
  const bundle = async profile => JSON.parse(await readFile(path.join(root, `bundle-${profile}.json`), 'utf8'));
  const artifact = async value => ({ path: value, sha256: sha256(await readFile(value)) });
  return { productCheckout: { path: product, commit: git('rev-parse', 'HEAD') },
    inventory, inventorySha256: sha256(await readFile(inventory)),
    npmTarballs: await Promise.all(['core', 'node', 'wasm'].map(async id => ({ id, ...(await artifact(path.join(root, 'candidate', npm(id)))) }))),
    // Default full/common payloads, plus the `_pii` payloads when the candidate has them (redact-secret#937).
    wasm: await Promise.all([['full', 'wasm-web/redact_secret_wasm_bg.wasm'],
      ['common', 'wasm-web-common/redact_secret_wasm_common_bg.wasm'], ...await piiWasm(path.join(root, 'qualified'))]
      .map(async ([profile, value]) => ({ profile, ...(await artifact(path.join(root, 'qualified', value))) }))),
    browserBundles: await Promise.all(['full', 'common'].map(async profile => {
      const manifest = await bundle(profile);
      const entry = profile === 'full' ? '@redact-secret/core' : '@redact-secret/core/common';
      if (!Array.isArray(manifest.files)) throw new Error(`Invalid ${profile} browser bundle manifest`);
      const manifestProjection = { profile: manifest.profile, tool: manifest.tool, entry: manifest.entry,
        files: manifest.files.map(({ relativePath, sha256: digest }) => ({ relativePath, sha256: digest })) };
      validatePiiProfileCostBrowserBundleManifest({ ...manifestProjection,
        bundleManifestCommitment: manifest.bundleManifestCommitment }, profile);
      if (manifest.profile !== profile || manifest.tool !== 'vite-8.3.0' || manifest.entry !== entry ||
          manifest.bundleManifestCommitment !== piiProfileCostCommitment(manifestProjection))
        throw new Error(`Invalid ${profile} browser bundle manifest`);
      return { profile, tool: manifest.tool, entry: manifest.entry,
        bundleManifestCommitment: manifest.bundleManifestCommitment, files: manifest.files };
    })) };
};
const producer = piiProfileCostPlan.implementationFreeze.files.find(row => row.path === 'scripts/prepare-pii-profile-cost-size-config-v2.mjs');
await writeFile(args.output, `${JSON.stringify({ schemaVersion: 1,
  producer: { id: 'prepare-pii-profile-cost-size-config-v2', sha256: producer.sha256 },
  baseline: await side(args.baseline), candidate: await side(args.candidate) }, null, 2)}\n`);
