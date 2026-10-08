import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { loadViewSupportContext, viewMatrixProblems } from '../benchmarks/qualification/matrix-publication.ts';
import { buildPiiCurrentQualification } from '../benchmarks/support/pii-current-qualification.ts';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export function committedViewMatrixProblems(matrix, { schema, context, currentQualification }) {
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(matrix)) return validate.errors.map(error => `schema ${error.instancePath || '/'}: ${error.message}`);
  const problems = viewMatrixProblems(matrix, context);
  if (!equal(matrix.piiCurrentQualification, currentQualification)) problems.push('current PII qualification differs from the verified committed public comparison');
  return problems;
}

export async function checkSupportMatrixFromView() {
  const root = new URL('../', import.meta.url);
  const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
  const [matrix, schema, context, currentQualification] = await Promise.all([
    json('benchmarks/support-matrix-from-view.json'), json('schemas/support-matrix-from-view-v1.json'),
    loadViewSupportContext(), buildPiiCurrentQualification(fileURLToPath(root)),
  ]);
  return committedViewMatrixProblems(matrix, { schema, context, currentQualification });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await checkSupportMatrixFromView();
  if (problems.length) throw new Error(`Committed qualification-view support matrix rejected: ${problems.join('; ')}`);
  console.log('Committed qualification-view support matrix verified against schema, pins, policy, taxonomy and current public PII evidence');
}
