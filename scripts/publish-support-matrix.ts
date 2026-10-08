import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPiiCurrentQualification } from '../benchmarks/support/pii-current-qualification.ts';
import { supportMatrixProblem } from '../benchmarks/shared/support-model.ts';

/**
 * Publish the support matrix for the benchmark site (#509; #657 for the view matrix).
 * The file is copied, never edited: the validator that applies to the file runs here first, so an artifact a reader would reject never reaches `public/results/`.
 *
 *  - legacy (default): the matrix `eval:matrix` writes from the legacy engine, validated by `supportMatrixProblem`, published as `support-matrix-v1.json`.
 *    This is the `legacy` qualification authority's matrix and the rollback path; the view matrix is refused here.
 *  - `--from-view`: the matrix `qualification:matrix` writes from the validated qualification view, validated against the registry, the policy and the
 *    taxonomy of this checkout (`viewMatrixProblems`), published as its own file `support-matrix-view-v1.json` so that the public v1 contract never changes shape.
 *    A legacy matrix, a candidate projection or a matrix of other pins is refused. The flag, not the file, picks the validator: a wrong file fails.
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const fromView = args.includes('--from-view');
const options = Object.fromEntries(args.filter(arg => arg !== '--from-view').map(arg => {
  const match = /^--(input|output)=(.+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:publish:matrix -- [--from-view] [--input=results-output/support-matrix.json] [--output=public/results/support-matrix-v1.json]\n  --from-view: [--input=results-output/support-matrix-from-view.json] [--output=public/results/support-matrix-view-v1.json]');
  return [match[1], match[2]];
}));

const inputPath = path.resolve(root, options.input ?? (fromView ? 'results-output/support-matrix-from-view.json' : 'results-output/support-matrix.json'));
let matrix: unknown;
try {
  matrix = JSON.parse(await readFile(inputPath, 'utf8'));
} catch (error) {
  throw new Error(`Cannot read ${path.relative(root, inputPath)} — run ${fromView ? '`npm run qualification:matrix`' : '`npm run eval:classify` then `npm run eval:matrix`'} first. ${error instanceof Error ? error.message : error}`);
}
if (fromView) {
  const { loadViewSupportContext, viewMatrixProblems } = await import('../benchmarks/qualification/matrix-publication.ts');
  const problems = viewMatrixProblems(matrix, await loadViewSupportContext());
  if (problems.length) throw new Error(`Refusing to publish ${path.relative(root, inputPath)} as the view support matrix: ${problems.join('; ')}`);
} else {
  const problem = supportMatrixProblem(matrix);
  if (problem) throw new Error(`Refusing to publish ${path.relative(root, inputPath)}: ${problem}`);
}

const current = (matrix as { piiCurrentQualification?: unknown }).piiCurrentQualification;
if (current && JSON.stringify(current) !== JSON.stringify(await buildPiiCurrentQualification(root)))
  throw new Error('Refusing to publish current PII qualification that disagrees with verified public comparison evidence');

const target = path.resolve(root, options.output ?? (fromView ? 'public/results/support-matrix-view-v1.json' : 'public/results/support-matrix-v1.json'));
await mkdir(path.dirname(target), { recursive: true });
const temporary = `${target}.tmp`;
await writeFile(temporary, JSON.stringify(matrix) + '\n');
await rename(temporary, target);
const { familyCount, distribution } = matrix as { familyCount: number; distribution: Record<string, number> };
if (fromView) console.log(`Published ${familyCount} families from the qualification view: ${JSON.stringify(distribution)}; stable profiles ${JSON.stringify((matrix as { stableDistribution: unknown }).stableDistribution)}`);
else console.log(`Published ${familyCount} families: ${JSON.stringify(distribution)}; stable profiles ${JSON.stringify((matrix as { stableDistribution: unknown }).stableDistribution)}`);
console.log(`Report: ${path.relative(root, target)}`);
