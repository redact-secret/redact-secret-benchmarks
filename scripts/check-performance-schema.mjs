/**
 * Schema drift check for the performance-evaluation intake (redact-secret#603
 * / #136). Validates:
 *   1. This repository's own committed criteria file against its schema.
 *   2. The committed baseline evidence summary against the pinned copy of
 *      core's result contract.
 *   3. With `--summary <path>`, a freshly produced core `CompleteAssessment`
 *      summary against that same pinned contract -- the actual drift check,
 *      run right after a CI workflow checks out core and runs
 *      `npm run assessment:all`. A shape core's schema no longer produces
 *      fails loudly here instead of the acceptance evaluator silently
 *      mis-reading fields.
 *
 * Usage: node scripts/check-performance-schema.mjs [--summary <path>]
 */
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const ajv = new Ajv({ strict: true, allErrors: true });

const [assessmentSchema, criteriaSchema] = await Promise.all([
  read('schemas/performance-assessment-v1.json'),
  read('schemas/performance-criteria-v1.json'),
]);
const validAssessment = ajv.compile(assessmentSchema);
const validCriteria = ajv.compile(criteriaSchema);

let failed = false;
function report(label, valid, validator) {
  if (valid) { console.log(`OK: ${label}`); return; }
  failed = true;
  console.error(`FAILED: ${label}`);
  for (const error of validator.errors ?? []) console.error(`  - ${error.instancePath || '/'}: ${error.message}`);
}

const criteria = await read('benchmarks/performance-criteria.json');
report('benchmarks/performance-criteria.json matches schemas/performance-criteria-v1.json', validCriteria(criteria), validCriteria);

const evidenceSummary = await read('evidence/603/summary.json');
report('evidence/603/summary.json matches schemas/performance-assessment-v1.json (pinned core result contract)', validAssessment(evidenceSummary), validAssessment);

const summaryFlagIndex = process.argv.indexOf('--summary');
if (summaryFlagIndex !== -1) {
  const summaryPath = process.argv[summaryFlagIndex + 1];
  if (!summaryPath) throw new Error('Usage: node scripts/check-performance-schema.mjs [--summary <path>]');
  const liveSummary = await read(summaryPath);
  report(`${summaryPath} matches schemas/performance-assessment-v1.json (pinned core result contract) -- core schema drift check`, validAssessment(liveSummary), validAssessment);
}

if (failed) throw new Error('Performance schema validation failed.');
console.log('Performance schema validation complete: 0 error(s).');
