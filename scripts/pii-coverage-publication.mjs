import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPiiCoverage } from './lib/pii-coverage-join.mjs';
import { summarizeCoverage, validateCoverageSummary } from './lib/pii-coverage-summary.mjs';
import { buildPiiCoverageDeltas } from './lib/pii-coverage-delta.mjs';
import { piiEvidencePublication } from './pii-evidence-publication.mjs';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';

export const PII_COVERAGE_VIEW = 'public/results/pii-coverage-view-v1.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const roles = ['active', 'proposed'], sides = ['baseline', 'candidate'];

/** Independently check denominator membership before projecting any summaries. */
export function validatePiiCoverageMembership(coverage) {
  for (const role of roles) for (const side of sides) {
    const inventory = coverage.inventories[role], joined = coverage.matrices[role][side];
    const keys = inventory.rows.map(row => row.kindKey).sort();
    const actual = joined.matrix.rows.map(row => row.kindKey).sort();
    if (new Set(keys).size !== keys.length || JSON.stringify(keys) !== JSON.stringify(actual) ||
        joined.matrix.identity.snapshotId !== inventory.source.snapshot.id ||
        joined.matrix.identity.snapshotCommitment !== inventory.source.snapshot.contentDigest) throw new Error('pii-coverage-source-membership-mismatch');
    for (const row of joined.matrix.rows) {
      const source = inventory.rows.find(kind => kind.kindKey === row.kindKey);
      const mapping = { state: source.mapping.state, losses: source.mapping.losses, requiredAxes: source.mapping.requiredAxes, representableAxes: source.mapping.representableAxes };
      if (row.label !== source.label || JSON.stringify(row.mapping) !== JSON.stringify(mapping) || JSON.stringify(row.evidence) !== JSON.stringify(source.evidence) || JSON.stringify(row.domains) !== JSON.stringify(source.domains) ||
          JSON.stringify(row.jurisdictions) !== JSON.stringify(source.jurisdictions)) throw new Error('pii-coverage-source-row-mismatch');
    }
    validateCoverageSummary(joined.summary, joined.matrix);
  }
  return coverage;
}

export async function piiCoveragePublication(root) {
  const evidencePublication = await piiEvidencePublication(root);
  const comparison = evidencePublication.view.comparison;
  if (comparison.state === 'invalid') throw new Error('pii-coverage-invalid-observation-source');
  const coverage = await loadPiiCoverage(root, { comparison });
  for (const role of roles) for (const side of sides) {
    const joined = coverage.matrices[role][side];
    joined.summary = summarizeCoverage(joined.matrix);
  }
  validatePiiCoverageMembership(coverage);
  const deltas = buildPiiCoverageDeltas(coverage);
  const paths = ['benchmarks/pii-population-policy.json', 'benchmarks/pii-evidence/candidate-runtimes.json',
    'scripts/lib/pii-evidence-contract.mjs', 'scripts/lib/pii-evidence-json.mjs', 'scripts/lib/pii-population-policy.mjs',
    'scripts/pii-evidence-publication.mjs', 'scripts/lib/pii-evidence-comparison-plan.mjs',
    'benchmarks/evaluation/domains/pii/evidence-comparison.mjs', 'benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs', ...roles.flatMap(role => {
    const pins = role === 'active' ? 'benchmarks/pii-evidence' : 'benchmarks/inputs/pii-evidence-snapshot-v2-candidate';
    return ['snapshot-pin', 'consumer-pin', 'preflight'].map(name => `${pins}/${name}.json`).concat([
      `benchmarks/inputs/pii-coverage/${role}/manifest.json`, `benchmarks/inputs/pii-coverage/${role}/privacy-kinds.json`]);
  }), ...sides.map(side => `benchmarks/inputs/pii-coverage/${side}-product-catalog.json`),
  'scripts/lib/pii-coverage-model.mjs', 'scripts/lib/pii-coverage-inventory.mjs', 'scripts/lib/pii-coverage-join.mjs',
  'scripts/lib/pii-coverage-summary.mjs', 'scripts/lib/pii-coverage-delta.mjs', 'scripts/pii-coverage-publication.mjs'];
  const sources = [...await Promise.all(paths.map(async file => ({ path: file, sha256: sha(await readFile(path.join(root, file))) }))), ...evidencePublication.view.sources];
  return { schema: 'pii-coverage-publication/1', supportClaims: false, qualified: false, sources, coverage, deltas };
}

export async function writePiiCoveragePublication(root) {
  const result = await piiCoveragePublication(root);
  await mkdir(path.join(root, 'public/results'), { recursive: true });
  await writeFile(path.join(root, PII_COVERAGE_VIEW), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
export async function piiCoveragePublicationProblems(root) {
  try {
    const expected = await piiCoveragePublication(root);
    const text = await readFile(path.join(root, PII_COVERAGE_VIEW), 'utf8');
    return JSON.stringify(parseEvidenceJson(text)) === JSON.stringify(expected) ? [] : ['pii-coverage-publication-stale-or-mixed'];
  } catch { return ['pii-coverage-publication-invalid-or-missing']; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !['--write', '--check'].includes(process.argv[2])) throw new Error('Use --write or --check');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (process.argv[2] === '--write') { await writePiiCoveragePublication(root); console.log('PII coverage: full source denominator, proposal inactive'); }
  else { const problems = await piiCoveragePublicationProblems(root); if (problems.length) throw new Error(problems.join('; ')); console.log('PII coverage: source contract and projection recount pass'); }
}
