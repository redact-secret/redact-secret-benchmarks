import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supportMatrixProblem } from '../src/support-model.ts';

/**
 * Publish the generated support matrix (#509) for the benchmark UI (#50, A9).
 * The file is copied, never edited: the same validator the page applies before
 * rendering runs here first, so an artifact the UI would reject never reaches
 * `public/results/`.
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(input|output)=(.+)$/.exec(arg);
  if (!match) throw new Error('Usage: npm run eval:publish:matrix -- [--input=results-output/support-matrix.json] [--output=public/results/support-matrix-v1.json]');
  return [match[1], match[2]];
}));

const inputPath = path.resolve(root, options.input ?? 'results-output/support-matrix.json');
let matrix: unknown;
try {
  matrix = JSON.parse(await readFile(inputPath, 'utf8'));
} catch (error) {
  throw new Error(`Cannot read ${path.relative(root, inputPath)} — run \`npm run eval:classify\` then \`npm run eval:matrix\` first. ${error instanceof Error ? error.message : error}`);
}
const problem = supportMatrixProblem(matrix);
if (problem) throw new Error(`Refusing to publish ${path.relative(root, inputPath)}: ${problem}`);

const target = path.resolve(root, options.output ?? 'public/results/support-matrix-v1.json');
await mkdir(path.dirname(target), { recursive: true });
const temporary = `${target}.tmp`;
await writeFile(temporary, JSON.stringify(matrix) + '\n');
await rename(temporary, target);
const { familyCount, distribution, stableDistribution } = matrix as { familyCount: number; distribution: Record<string, number>; stableDistribution: { documented: number; empirical: number } };
console.log(`Published ${familyCount} families: ${JSON.stringify(distribution)}; stable profiles ${JSON.stringify(stableDistribution)}`);
console.log(`Report: ${path.relative(root, target)}`);
