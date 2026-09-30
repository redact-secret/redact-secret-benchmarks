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

// #405: the accepted run's own summary (the one the performance page reads its Measured columns from) is held to
// the same standard as a freshly submitted one, including naming which artifact served the node runs.
const acceptedPath = `${criteria.baseline.verificationPath.replace(/\/[^/]+$/, '')}/summary.json`;
const acceptedSummary = await read(acceptedPath);
report(`${acceptedPath} (accepted run at ${criteria.baseline.verifiedCommit.slice(0, 7)}) matches schemas/performance-assessment-v1.json`, validAssessment(acceptedSummary), validAssessment);
if (acceptedSummary.sourceCommit !== criteria.baseline.verifiedCommit) {
  failed = true;
  console.error(`FAILED: ${acceptedPath} sourceCommit ${acceptedSummary.sourceCommit} is not baseline.verifiedCommit ${criteria.baseline.verifiedCommit}`);
}
const nodeRunsMissingArtifact = summary => (summary.runs ?? []).filter(run =>
  run.surface === 'node' && run.kind === 'performance' && run.result?.provenance && run.result.provenance.resolvedArtifact === undefined);
if (nodeRunsMissingArtifact(acceptedSummary).length) {
  failed = true;
  console.error(`FAILED: ${acceptedPath} node performance runs must record provenance.resolvedArtifact`);
} else console.log(`OK: ${acceptedPath} node performance runs name their resolved artifact`);

const summaryFlagIndex = process.argv.indexOf('--summary');
if (summaryFlagIndex !== -1) {
  const summaryPath = process.argv[summaryFlagIndex + 1];
  if (!summaryPath) throw new Error('Usage: node scripts/check-performance-schema.mjs [--summary <path>]');
  const liveSummary = await read(summaryPath);
  report(`${summaryPath} matches schemas/performance-assessment-v1.json (pinned core result contract) -- core schema drift check`, validAssessment(liveSummary), validAssessment);

  // #405: unlike the frozen evidence/603 baseline above, a freshly submitted summary is held to naming
  // which artifact served a node performance run -- the loader may serve the N-API addon or fall back to
  // WebAssembly, and only the runner calling artifact() can tell.
  const missingResolvedArtifact = nodeRunsMissingArtifact(liveSummary);
  if (missingResolvedArtifact.length) {
    failed = true;
    console.error(`FAILED: ${summaryPath} node performance runs must record provenance.resolvedArtifact ("node-addon" or "wasm")`);
    // #415: the producer is core's own runner, not this repository; a candidate without it cannot pass.
    console.error('  produced by core\'s scripts/assessment-node-performance.mjs (from artifact()); this core commit predates that runner change (#415)');
    for (const run of missingResolvedArtifact) console.error(`  - ${run.surface}:${run.kind}:${run.profileId}`);
  } else {
    console.log(`OK: ${summaryPath} node performance runs name their resolved artifact`);
  }
}

if (failed) throw new Error('Performance schema validation failed.');
console.log('Performance schema validation complete: 0 error(s).');
