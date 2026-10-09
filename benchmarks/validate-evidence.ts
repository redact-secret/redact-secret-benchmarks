import { validateCurrentQualificationSuite } from './lib/current-qualification-suite.ts';
import { readFile } from 'node:fs/promises';
import { validateEvidence } from './evaluation/evidence.ts';

// Usage: validate-evidence <report.json> [--suite=<suite-v1.json>]
// Without --suite a report is checked against the live qualification/suite-v1.json, so new evidence is held to the current pin. A frozen
// record names the suite snapshot it was produced with (evidence/<issue>/suite-v1.json).
try {
  const [reportPath, ...flags] = process.argv.slice(2);
  if (!reportPath || reportPath.startsWith('--') || flags.length > 1 || (flags.length === 1 && !/^--suite=.+/.test(flags[0]))) throw new Error();
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  if (!['holdout', 'qualification', 'candidate'].includes(report.reportType)) throw new Error();
  const suitePath = flags[0]?.slice('--suite='.length);
  const suiteText = suitePath ? await readFile(suitePath, 'utf8') : undefined;
  const suite = suiteText === undefined ? undefined : suitePath === 'benchmarks/inputs/credential/qualification-suite.json'
    ? validateCurrentQualificationSuite(suiteText) : JSON.parse(suiteText);
  validateEvidence(report, report.reportType, suite);
  console.log('Evidence schema and consistency checks passed.');
} catch { console.error('Invalid or incomplete evidence.'); process.exitCode = 1; }
