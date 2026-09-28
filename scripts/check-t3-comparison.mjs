import { readFile } from 'node:fs/promises';
import { t3PeerRowFailures } from '../benchmarks/lib/t3-comparison.ts';

const path = 'docs/generated/release-comparison.md';
const markdown = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = t3PeerRowFailures(markdown);

if (failures.length) {
  console.error(`T3 comparison guard failed (#404):\n${failures.map(f => `  - ${f}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`No T3 peer rows in ${path}.`);
}
