import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { piiProfileCostCommitment, piiProfileCostPlan } from '../benchmarks/evaluation/domains/pii/profile-cost-v2.ts';
import { sha256, verifyImplementationFreeze } from './pii-profile-cost/adapter-protocol.mjs';

await verifyImplementationFreeze(piiProfileCostPlan);

const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--([a-z-]+)=(.+)$/.exec(argument);
  if (!match || Object.hasOwn(args, match[1])) throw new Error('Invalid Linux preparation argument');
  args[match[1]] = path.resolve(match[2]);
}
const required = ['product', 'inventory', 'node-native-root', 'node-wasm-root', 'browser-root', 'browser-common-root',
  'python', 'cli', 'rust-helper', 'playwright', 'output'];
required.push('python-wheel');
if (required.some(key => !args[key])) throw new Error(`Required: ${required.map(key => `--${key}=<path>`).join(' ')}`);
const git = (...rest) => execFileSync('git', rest, { cwd: args.product, encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== piiProfileCostPlan.inputs.candidateProductCommit || git('status', '--porcelain') !== '')
  throw new Error('Product checkout is not the exact clean candidate commit');
const inventoryBytes = await readFile(args.inventory), inventory = JSON.parse(inventoryBytes);
if (sha256(inventoryBytes) !== piiProfileCostPlan.inputs.candidateInventorySha256 ||
    inventory.sourceCommit !== piiProfileCostPlan.inputs.candidateProductCommit ||
    Number(inventory.workflowRun) !== piiProfileCostPlan.inputs.candidateQualificationRun)
  throw new Error('Candidate inventory identity mismatch');
const playwrightPackage = JSON.parse(await readFile(path.join(path.dirname(args.playwright), 'package.json'), 'utf8'));
const browsers = JSON.parse(await readFile(path.join(path.dirname(args.playwright), '../playwright-core/browsers.json'), 'utf8'));
if (playwrightPackage.version !== piiProfileCostPlan.officialLinuxExecution.playwrightVersion ||
    Number(browsers.browsers?.find(row => row.name === 'chromium')?.revision) !== piiProfileCostPlan.officialLinuxExecution.chromiumRevision)
  throw new Error('Playwright or Chromium identity mismatch');
const file = async value => ({ path: value, sha256: sha256(await readFile(value)) });
const qualified = async (family, target, value) => {
  const identity = await file(value);
  if (inventory.artifacts.filter(row => row.family === family && row.target === target && row.sha256 === identity.sha256).length !== 1)
    throw new Error(`File is not the qualified ${family}/${target ?? 'portable'} artifact`);
  return identity;
};
const adapterRoot = path.resolve('scripts/pii-profile-cost');
const definitions = {
  node: path.join(adapterRoot, 'node-sample.mjs'), chromium: path.join(adapterRoot, 'chromium-sample.mjs'),
  python: path.join(adapterRoot, 'python-sample.py'), cli: path.join(adapterRoot, 'cli-sample.mjs'),
  rust: path.join(adapterRoot, 'rust-sample.rs'), protocol: path.join(adapterRoot, 'adapter-protocol.mjs'),
};
const artifacts = [
  { id: 'candidate-inventory', sha256: piiProfileCostPlan.inputs.candidateInventorySha256 },
  { id: 'node-native', ...(await qualified('node-addon', 'x86_64-unknown-linux-gnu',
    path.join(args['node-native-root'], 'node_modules/@redact-secret/node-linux-x64-gnu/redact-secret.linux-x64-gnu.node'))) },
  { id: 'node-forced-wasm', ...(await qualified('browser', null,
    path.join(args['node-wasm-root'], 'node_modules/@redact-secret/wasm/redact_secret_wasm_bg.wasm'))) },
  { id: 'browser-full-wasm', ...(await qualified('browser', null, path.join(args['browser-root'], 'redact_secret_wasm_bg.wasm'))) },
  { id: 'browser-common-wasm', ...(await qualified('browser-common', null, path.join(args['browser-common-root'], 'redact_secret_wasm_common_bg.wasm'))) },
  { id: 'python-wheel-install', ...(await qualified('python-wheel', 'x86_64-unknown-linux-gnu', args['python-wheel'])) },
  { id: 'cli-linux-x64', ...(await qualified('cli', 'x86_64-unknown-linux-gnu', args.cli)) },
  { id: 'rust-release-helper', ...(await file(args['rust-helper'])) },
].map(({ id, sha256: digest }) => ({ id, sha256: digest }));
const executable = async value => ({ path: value, sha256: sha256(await readFile(value)) });
const surface = async (id, command, commandArgs, artifactIds, credentialProfiles, extraDefinitions = []) => {
  const definitionFiles = await Promise.all(extraDefinitions.map(async ([role, value]) => ({ role, path: value, sha256: sha256(await readFile(value)) })));
  const cwd = path.resolve('.'), executableIdentity = await executable(command);
  return { id, cwd, executable: executableIdentity, args: commandArgs, definitionFiles,
    definitionCommitment: piiProfileCostCommitment({ cwd, executableSha256: executableIdentity.sha256, args: commandArgs,
      files: definitionFiles.map(({ role, sha256: digest }) => ({ role, sha256: digest })) }), artifactIds, credentialProfiles };
};
const nodeArgs = root => ['--expose-gc', definitions.node, `--full-module=${path.join(root, 'node_modules/@redact-secret/core/dist/index.js')}`,
  `--common-module=${path.join(root, 'node_modules/@redact-secret/core/dist/common.js')}`];
const surfaces = [
  await surface('rust-native', args['rust-helper'], [], ['rust-release-helper'], ['full', 'common'], [['adapter-source', definitions.rust]]),
  await surface('node-native', process.execPath, nodeArgs(args['node-native-root']), ['node-native'], ['full', 'common'], [['adapter', definitions.node], ['protocol', definitions.protocol]]),
  await surface('node-wasm', process.execPath, nodeArgs(args['node-wasm-root']), ['node-forced-wasm'], ['full', 'common'], [['adapter', definitions.node], ['protocol', definitions.protocol]]),
  await surface('chromium-wasm', process.execPath, [definitions.chromium, `--playwright=${args.playwright}`,
    `--full-root=${args['browser-root']}`, '--full-entry=redact_secret_wasm.js', `--common-root=${args['browser-common-root']}`,
    '--common-entry=redact_secret_wasm_common.js'], ['browser-full-wasm', 'browser-common-wasm'], ['full', 'common'],
  [['adapter', definitions.chromium], ['protocol', definitions.protocol], ['playwright', args.playwright]]),
  await surface('python', args.python, [definitions.python], ['python-wheel-install'], ['full'], [['adapter', definitions.python]]),
  await surface('cli', process.execPath, [definitions.cli, `--binary=${args.cli}`], ['cli-linux-x64'], ['full'],
    [['adapter', definitions.cli], ['protocol', definitions.protocol]]),
];
const projection = { schemaVersion: 1, sourceCommit: piiProfileCostPlan.inputs.candidateProductCommit,
  producer: { id: 'prepare-pii-profile-cost-linux-v2', sha256: sha256(await readFile(new URL(import.meta.url))) },
  qualification: { candidateRun: piiProfileCostPlan.inputs.candidateQualificationRun,
    candidateInventorySha256: piiProfileCostPlan.inputs.candidateInventorySha256 },
  productCheckout: { path: args.product, commit: piiProfileCostPlan.inputs.candidateProductCommit }, artifacts, surfaces };
await writeFile(args.output, `${JSON.stringify({ ...projection, configCommitment: piiProfileCostCommitment(projection) }, null, 2)}\n`);
