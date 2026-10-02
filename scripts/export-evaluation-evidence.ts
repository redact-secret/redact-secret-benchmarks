/**
 * Write (or --check) the evaluation evidence file of the methods-enabled official run, derived from the product contracts
 * (benchmarks/qualification/evaluation-evidence.ts). The committed file is benchmarks/qualification/evaluation-evidence.json.
 *
 *   npm run qualification:evidence              write it
 *   npm run qualification:evidence -- --check   fail when the committed file is stale
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EVALUATION_EVIDENCE_FILE, evaluationEvidenceDigest, serializeEvaluationEvidence } from '../benchmarks/qualification/evaluation-evidence.ts';

const file = path.resolve(import.meta.dirname, '..', EVALUATION_EVIDENCE_FILE);
const bytes = serializeEvaluationEvidence();
if (process.argv.includes('--check')) {
  const current = await readFile(file, 'utf8').catch(() => '');
  if (current !== bytes) { console.error(`${EVALUATION_EVIDENCE_FILE} is stale; run npm run qualification:evidence`); process.exit(1); }
  console.log(`${EVALUATION_EVIDENCE_FILE} matches the product contracts (${evaluationEvidenceDigest()})`);
} else {
  await writeFile(file, bytes);
  console.log(`Wrote ${EVALUATION_EVIDENCE_FILE} (${evaluationEvidenceDigest()})`);
}
