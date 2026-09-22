/**
 * Derives `benchmarks/performance-criteria.json` from one complete,
 * release-build `CompleteAssessment` summary, mechanically applying the
 * documented margin rule (`benchmarks/lib/performance-derivation.ts`). This
 * repository owns this criteria file per redact-secret#603 (DS11) / #136.
 *
 * Usage:
 *   node --import tsx scripts/derive-performance-criteria.mjs --summary evidence/603/summary.json [--check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { deriveCriteria } from '../benchmarks/lib/performance-derivation.ts';
import { completeAssessmentProblem } from '../benchmarks/lib/performance-schema.ts';
import { validateAcceptanceCriteria } from '../benchmarks/lib/performance-acceptance.ts';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const flag = name => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const summaryPath = flag('--summary') ?? 'evidence/603/summary.json';
const summary = JSON.parse(await readFile(new URL(summaryPath, root), 'utf8'));

const problem = completeAssessmentProblem(summary);
if (problem) throw new Error(`Cannot derive criteria: ${problem}`);

const criteria = deriveCriteria(summary, {
  criteriaId: 'rc-performance-resource-linux-x64-benchmarks-v1',
  fixedAt: '2026-09-22',
  summaryPath: 'evidence/603/summary.json',
  environment: {
    id: 'linux-x64-node22-chromium',
    osPrefixes: ['linux-'],
    cpus: ['x86_64', 'x64'],
    runtimePrefixes: {
      'rust-core': ['rustc-'],
      python: ['cpython-3.'],
      node: ['node-22.'],
      'browser-wasm': ['chromium-'],
      cli: ['rustc '],
    },
  },
});
validateAcceptanceCriteria(criteria);

const target = new URL('../benchmarks/performance-criteria.json', import.meta.url);
const serialized = `${JSON.stringify(criteria, null, 2)}\n`;
const current = await readFile(target, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});

if (args.includes('--check')) {
  if (current !== serialized) throw new Error('Performance criteria drift. Run `npm run performance:criteria` and commit benchmarks/performance-criteria.json.');
  console.log('Performance criteria are up to date.');
} else if (current !== serialized) {
  await writeFile(target, serialized);
  console.log('Wrote benchmarks/performance-criteria.json');
} else {
  console.log('Performance criteria already up to date.');
}
