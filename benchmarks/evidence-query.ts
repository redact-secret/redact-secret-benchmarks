/**
 * Query one evidence class (#139): public adversarial, protected holdout, or
 * maintainer regression. Classes are never merged; asking for all of them
 * prints each under its own heading.
 *
 * Usage: npm run evidence:query -- --class=public-adversarial|protected-holdout|maintainer-regression|all [--json]
 */
import { fileURLToPath } from 'node:url';
import { evidenceSources, loadPacks } from './lib/adversarial-packs.ts';
import { EVIDENCE_CLASSES, EVIDENCE_CLASS_IDS, queryEvidence, type EvidenceClass } from './lib/evidence-classes.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const requested = process.argv.find(arg => arg.startsWith('--class='))?.slice('--class='.length);
const classes: EvidenceClass[] = requested === 'all' ? EVIDENCE_CLASS_IDS : [requested as EvidenceClass];
if (!classes.every(c => EVIDENCE_CLASS_IDS.includes(c))) {
  console.error(`Usage: npm run evidence:query -- --class=${[...EVIDENCE_CLASS_IDS, 'all'].join('|')} [--json]`);
  process.exit(2);
}

const sources = evidenceSources(root, loadPacks(root));
const result = Object.fromEntries(classes.map(c => [c, queryEvidence(sources, c)]));
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const c of classes) {
    console.log(`${EVIDENCE_CLASSES[c].label} (${c}): ${result[c].length} source(s)`);
    console.log(`  ${EVIDENCE_CLASSES[c].description}`);
    for (const row of result[c]) {
      const detail = Object.entries(row.detail).map(([key, value]) => `${key}=${value}`).join(' ');
      console.log(`  - ${row.id} [${row.source}]${detail ? ` ${detail}` : ''}`);
    }
  }
}
