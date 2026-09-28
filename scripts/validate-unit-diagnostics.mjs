// Validate a unit-diagnostics report (#380): JSON schema, then every arithmetic
// invariant. When the `.rows.json` sidecar sits beside it, segments are also
// recomputed from the rows. Usage: npm run eval:diagnostics:validate -- <report.json>...
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { reportProblem } from '../benchmarks/lib/unit-diagnostics.ts';

const schema = JSON.parse(await readFile(new URL('../schemas/unit-diagnostics-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
const files = process.argv.slice(2);
if (!files.length) { console.error('Usage: npm run eval:diagnostics:validate -- <report.json>...'); process.exit(1); }
let failed = false;
for (const file of files) {
  const report = JSON.parse(await readFile(file, 'utf8'));
  const rows = await readFile(file.replace(/\.json$/, '.rows.json'), 'utf8').then(JSON.parse, () => undefined);
  const problem = validate(report) ? reportProblem(report, rows) : `schema: ${validate.errors.map(e => `${e.instancePath} ${e.message}`).slice(0, 5).join('; ')}`;
  if (problem) { failed = true; console.error(`${file}: ${problem}`); }
  else console.log(`${file}: valid (${report.mode}, ${report.product.version}, digest ${report.digest.slice(0, 12)}${rows ? ', rows recomputed' : ''})`);
}
process.exitCode = failed ? 1 : 0;
