/**
 * Real core-schema drift check for the performance-evaluation intake
 * (redact-secret#603 / #136, follow-up #150). Reads core's own
 * `assessment/complete.ts` and `assessment/schema.ts` at the exact commit
 * `.github/workflows/performance-evaluation.yml` already checked out into
 * `--core-repo`, and fails if the schema-version constant, required
 * surfaces, or result-contract field shapes have moved against this
 * repository's pinned copy (`benchmarks/lib/performance-schema.ts`) --
 * instead of only trusting that hand-maintained copy, per #150's ask that
 * schema drift be detected automatically against core's actual source.
 *
 * Usage: node scripts/check-performance-schema-drift.mjs --core-repo <path>
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { checkCoreSchemaDrift } from '../benchmarks/lib/performance-schema-drift.ts';

const args = process.argv.slice(2);
const coreRepoIndex = args.indexOf('--core-repo');
const coreRepo = coreRepoIndex === -1 ? undefined : args[coreRepoIndex + 1];
if (!coreRepo) throw new Error('Usage: node scripts/check-performance-schema-drift.mjs --core-repo <path>');

const [completeSource, schemaSource] = await Promise.all([
  readFile(path.join(coreRepo, 'assessment/complete.ts'), 'utf8'),
  readFile(path.join(coreRepo, 'assessment/schema.ts'), 'utf8'),
]);

const failures = checkCoreSchemaDrift(completeSource, schemaSource);
if (failures.length) {
  console.error(`Core schema drift detected against ${coreRepo}:\n${failures.map(f => `  - ${f}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`No core schema drift: ${coreRepo}'s assessment/complete.ts and assessment/schema.ts still match the pinned contract.`);
}
