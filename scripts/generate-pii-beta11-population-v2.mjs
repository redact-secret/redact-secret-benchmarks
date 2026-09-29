// Regenerate (or --check) the pii-context/v2 population plan set of benchmarks #428 from its authored truth.
// Usage: npm run pii:beta11:plans [-- --check]
import { readFile, writeFile } from 'node:fs/promises';
import { B11_V2_PLAN_FILES, serializeB11V2Plan } from '../benchmarks/evaluation/domains/pii/beta11-population-v2.ts';

const check = process.argv.includes('--check');
let drift = 0;
for (const [family, file] of Object.entries(B11_V2_PLAN_FILES)) {
  const next = serializeB11V2Plan(family);
  const current = await readFile(file, 'utf8').catch(() => null);
  if (current === next) { console.log(`${file}: up to date`); continue; }
  if (check) { drift += 1; console.error(`${file}: differs from its authored truth`); continue; }
  await writeFile(file, next);
  console.log(`${file}: written`);
}
if (drift) process.exit(1);
