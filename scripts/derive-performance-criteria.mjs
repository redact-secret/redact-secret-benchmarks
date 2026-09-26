/**
 * Derives `benchmarks/performance-criteria.json` from one complete,
 * release-build `CompleteAssessment` summary, mechanically applying the
 * documented margin rule (`benchmarks/lib/performance-derivation.ts`). This
 * repository owns this criteria file per redact-secret#603 (DS11) / #136.
 *
 * `baseline.verifiedCommit` / `baseline.verificationPath` are not derived
 * from the summary: an ACCEPTED evaluation at a newer pin advances them
 * without re-deriving any threshold
 * (docs/decisions/2026-09-23-decouple-pin-freshness-from-pin-consistency.md).
 * They are carried over from the committed file while its `sourceCommit`
 * still matches the summary, reset to the derivation run itself on a
 * recalibration, and set explicitly with
 * `--verified-commit <sha> --verification-path <acceptance.json>`. Either
 * way the named acceptance.json must be an ACCEPTED evaluation of that exact
 * commit under this criteria id and fixed date.
 *
 * Usage:
 *   node --import tsx scripts/derive-performance-criteria.mjs --summary evidence/603/summary.json [--check]
 *   node --import tsx scripts/derive-performance-criteria.mjs --verified-commit <sha> --verification-path <path>
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

const target = new URL('../benchmarks/performance-criteria.json', import.meta.url);
const current = await readFile(target, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const committed = current === null ? null : JSON.parse(current);

let verification;
if (flag('--verified-commit') || flag('--verification-path')) {
  verification = { commit: flag('--verified-commit'), path: flag('--verification-path') };
  if (!verification.commit || !verification.path) throw new Error('Pass both --verified-commit and --verification-path.');
} else if (committed?.baseline?.verifiedCommit && committed.baseline.sourceCommit === summary.sourceCommit) {
  verification = { commit: committed.baseline.verifiedCommit, path: committed.baseline.verificationPath };
}

const criteria = deriveCriteria(summary, {
  criteriaId: 'rc-performance-resource-linux-x64-benchmarks-v1',
  fixedAt: '2026-09-23',
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
  verification,
});
validateAcceptanceCriteria(criteria);

const acceptance = JSON.parse(await readFile(new URL(criteria.baseline.verificationPath, root), 'utf8'));
if (
  acceptance.status !== 'accepted' ||
  acceptance.sourceCommit !== criteria.baseline.verifiedCommit ||
  acceptance.criteriaId !== criteria.criteriaId ||
  acceptance.criteriaFixedAt !== criteria.fixedAt ||
  (acceptance.failures ?? []).length !== 0
) {
  throw new Error(`${criteria.baseline.verificationPath} is not an ACCEPTED evaluation of ${criteria.baseline.verifiedCommit} against ${criteria.criteriaId} (fixed ${criteria.fixedAt}).`);
}

const serialized = `${JSON.stringify(criteria, null, 2)}\n`;

if (args.includes('--check')) {
  if (current !== serialized) throw new Error('Performance criteria drift. Run `npm run performance:criteria` and commit benchmarks/performance-criteria.json.');
  console.log('Performance criteria are up to date.');
} else if (current !== serialized) {
  await writeFile(target, serialized);
  console.log('Wrote benchmarks/performance-criteria.json');
} else {
  console.log('Performance criteria already up to date.');
}
