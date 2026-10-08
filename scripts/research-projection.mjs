/**
 * Write or check the research projection (#590, #591; docs/specs/research-records.md).
 *
 *   node scripts/research-projection.mjs [--dir <download dir>]   (npm run research:project)
 *   node scripts/research-projection.mjs --check                    (npm run research:check)
 *
 * Write: downloads `release-manifest.json` and `records-bundle.json` of the evidence release `benchmarks/official-runs.json` pins for
 * `public-evidence-snapshot` (skipped when both are already in --dir), refuses unless they are the pinned release (manifest digest,
 * tag, records tree, the bundle bytes the manifest lists, schema revision), and writes `benchmarks/support/research-projection.json`
 * for the families of `benchmarks/support/taxonomy.json`. Nothing else is written.
 *
 * Check (offline, CI): the committed projection validates against `schemas/research-projection-v1.json`, names only taxonomy
 * families, cites only listed sources, and was taken from the release the registry pins today. A repin changes the pin, so the
 * repin regenerates the projection with the write command.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANIFEST_ASSET, RECORDS_ASSET, EVIDENCE_REPOSITORY, bindingProblems, evidencePin, projectResearch, projectionProblems, releaseProblems, sourceOf,
} from '../benchmarks/support/research-projection.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const PROJECTION_FILE = 'benchmarks/support/research-projection.json';
const readJson = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

/** The problems of the committed projection against the schema, the taxonomy and today's pin. */
export function checkProjection({ projection = readJson(PROJECTION_FILE), taxonomy = readJson('benchmarks/support/taxonomy.json'), registry = readJson('benchmarks/official-runs.json') } = {}) {
  const problems = projectionProblems(projection, { familyIds: taxonomy.families.map(f => f.id) });
  if (problems.length) return problems;
  return bindingProblems(projection, evidencePin(registry)).map(p => `${p}; run npm run research:project`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = checkProjection();
    if (problems.length) {
      console.error(`${PROJECTION_FILE} is not usable:\n${problems.map(p => `  - ${p}`).join('\n')}`);
      process.exit(1);
    }
    const projection = readJson(PROJECTION_FILE);
    console.log(`${PROJECTION_FILE}: ${Object.keys(projection.families).length} families from ${projection.source.release}, valid and bound to the pin`);
  } else {
    const pin = evidencePin(readJson('benchmarks/official-runs.json'));
    const at = process.argv.indexOf('--dir');
    const dir = path.resolve(at >= 0 ? process.argv[at + 1] : path.join(tmpdir(), `research-projection-${pin.release.tag}`));
    mkdirSync(dir, { recursive: true });
    if (![MANIFEST_ASSET, RECORDS_ASSET].every(f => existsSync(path.join(dir, f))))
      execFileSync('gh', ['release', 'download', pin.release.tag, '-R', EVIDENCE_REPOSITORY, '-D', dir, '-p', MANIFEST_ASSET, '-p', RECORDS_ASSET, '--clobber'], { stdio: 'inherit' });
    const manifestBytes = readFileSync(path.join(dir, MANIFEST_ASSET));
    const bundleBytes = readFileSync(path.join(dir, RECORDS_ASSET));
    const problems = releaseProblems({ pin, manifestBytes, bundleBytes });
    if (problems.length) {
      console.error(`The downloaded ${pin.release.tag} is not the pinned release:\n${problems.map(p => `  - ${p}`).join('\n')}`);
      process.exit(3);
    }
    const taxonomy = readJson('benchmarks/support/taxonomy.json');
    const projection = projectResearch({ bundle: JSON.parse(bundleBytes), familyIds: taxonomy.families.map(f => f.id), source: sourceOf({ manifestBytes, bundleBytes }) });
    const invalid = projectionProblems(projection, { familyIds: taxonomy.families.map(f => f.id) });
    if (invalid.length) {
      console.error(`The projection does not validate:\n${invalid.map(p => `  - ${p}`).join('\n')}`);
      process.exit(1);
    }
    writeFileSync(path.join(root, PROJECTION_FILE), `${JSON.stringify(projection, null, 1)}\n`);
    const missing = taxonomy.families.filter(f => !projection.families[f.id]).map(f => f.id);
    console.log(`Wrote ${PROJECTION_FILE}: ${Object.keys(projection.families).length} families from ${pin.release.tag}; ${missing.length} taxonomy families have no record there (${missing.join(', ') || 'none'})`);
  }
}
