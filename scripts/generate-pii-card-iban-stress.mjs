// Regenerate (or --check) the frozen #425 payment-card and IBAN stress plans from their authored truth.
// Usage: node --import tsx scripts/generate-pii-card-iban-stress.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { STRESS_PLAN_FILES, buildStressPlan } from '../benchmarks/evaluation/domains/pii/card-iban-stress/authoring.ts';

const check = process.argv.includes('--check');
let drift = 0;
for (const [family, file] of Object.entries(STRESS_PLAN_FILES)) {
  const text = `${JSON.stringify(buildStressPlan(family), null, 2)}\n`;
  if (check) {
    const current = await readFile(file, 'utf8').catch(() => null);
    if (current !== text) { console.error(`${file} drifted from its authored truth`); drift += 1; }
  } else await writeFile(file, text);
}
if (drift) process.exit(1);
console.log(check ? 'card/IBAN stress plans match their authored truth' : 'wrote card/IBAN stress plans');
