import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPiiProtectedSupportOriginalEvidence } from '../benchmarks/evaluation/domains/pii/protected-support-binding.ts';
import { piiCurrentProtectedRoute } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';
import { projectPiiProtectedEvidence, validateCurrentPiiProtectedEvidence } from '../benchmarks/evaluation/domains/pii/protected-current-inputs.ts';
import { measurementOutput, writeMeasurement } from './lib/measurement-output.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(source-root|source-commit|output|promote|prepared)=(.+)$/.exec(arg);
  if (!match) throw new Error('Use --source-root=<restored original tree> --source-commit=<full SHA> [--output=<fresh ignored JSON> | --promote=benchmarks/inputs/pii/protected-route.json]');
  return [match[1], match[2]];
}));
if (!args['source-root'] || !/^[a-f0-9]{40}$/.test(args['source-commit'] ?? '') || (args.output && args.promote))
  throw new Error('Explicit original tree and full source commit required; output and promotion are separate operations');
const binding = piiCurrentProtectedRoute();
if (!binding) throw new Error('No reviewed protected route exists');
if (args.promote && !args.prepared) throw new Error('Promotion requires an explicit prepared receipt');
const current = JSON.parse(await readFile(args.prepared ? path.resolve(args.prepared) : path.join(root, 'benchmarks/inputs/pii/protected-route.json'), 'utf8'));
validateCurrentPiiProtectedEvidence(binding, { ...current.data, currentInput: current });
if (args['source-commit'] !== current.source.commit) throw new Error('Original source commit differs from the separately reviewed input');
const target = args.promote ? path.resolve(root, args.promote) : measurementOutput(path.resolve(root, args.output ?? `results-output/pii-input-preparation/${Date.now()}/protected-route.json`), root);
if (args.promote && target !== path.join(root, 'benchmarks/inputs/pii/protected-route.json')) throw new Error('Promotion target must be the reviewed protected input role');
if (args.promote && existsSync(target)) throw new Error('Accepted current input already exists; promotion cannot overwrite it');
const sourceRoot = path.resolve(args['source-root']);
const sources = [];
for (const expected of current.sources) {
  const bytes = await readFile(path.join(sourceRoot, expected.path));
  const original = execFileSync('git', ['show', `${args['source-commit']}:${expected.path}`], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (!bytes.equals(original) || sha256 !== expected.sha256 || bytes.length !== expected.bytes)
    throw new Error('Restored original input bytes do not match their preserved source commit');
  sources.push({ path: expected.path, sha256, bytes: bytes.length });
}
const original = await loadPiiProtectedSupportOriginalEvidence(sourceRoot, binding);
original.ledger = JSON.parse(await readFile(path.join(sourceRoot, 'benchmarks/accepted-pii-profile-cost.json'), 'utf8'));
const receipt = projectPiiProtectedEvidence(binding, original, current.source, sources);
validateCurrentPiiProtectedEvidence(binding, { ...receipt.data, currentInput: receipt });
// Exclusive publication refuses to replace an accepted input. The owner ledger and binding index are never written.
writeMeasurement(target, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Prepared validated current PII input: ${path.relative(root, target)}`);
