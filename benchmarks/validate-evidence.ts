import { readFile } from 'node:fs/promises';
import { validateEvidence } from './engine/evidence.ts';

try {
  if (process.argv.length !== 3) throw new Error();
  const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
  if (!['holdout', 'qualification'].includes(report.reportType)) throw new Error();
  validateEvidence(report, report.reportType);
  console.log('Evidence schema and consistency checks passed.');
} catch { console.error('Invalid or incomplete evidence.'); process.exitCode = 1; }
