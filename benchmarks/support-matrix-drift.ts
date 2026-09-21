import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import driftSchema from '../schemas/support-matrix-drift-v1.json';
import { buildSupportMatrixDrift } from './support/drift.ts';
import { supportMatrixProblem, type SupportMatrixFile } from '../src/support-model.ts';

/**
 * Support-matrix drift for a release candidate (issue #511, A10). Reads two
 * already-generated support matrices — a saved baseline and the candidate's
 * own, whether freshly built (`results-output/support-matrix.json`) or a
 * previously published artifact (`public/results/support-matrix-v1.json`) —
 * and emits their diff. Offline and deterministic: both inputs are local
 * files, and nothing here decides whether a regression blocks a release
 * (AGENTS.md boundary rule; the product release workflow owns that gate).
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const ajv = new Ajv({ strict: true });
const validDrift = ajv.compile(driftSchema);
const usage = 'Usage: npm run eval:matrix:drift -- --baseline=<path> [--candidate=results-output/support-matrix.json] [--output=results-output/support-matrix-drift.json]';

async function readMatrix(label: string, filePath: string): Promise<SupportMatrixFile> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} matrix ${path.relative(root, filePath)}. ${error instanceof Error ? error.message : error}`);
  }
  const problem = supportMatrixProblem(value);
  if (problem) throw new Error(`Refusing to diff an invalid ${label} matrix (${path.relative(root, filePath)}): ${problem}`);
  return value as SupportMatrixFile;
}

async function main() {
  const options: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(baseline|candidate|output)=(.+)$/.exec(arg);
    const key = match?.[1] ?? arg.slice(2);
    if (!match || key in options) throw new Error(usage);
    options[key] = match[2];
  }
  if (typeof options.baseline !== 'string') throw new Error(usage);

  const baselinePath = path.resolve(root, options.baseline);
  const candidatePath = path.resolve(root, typeof options.candidate === 'string' ? options.candidate : 'results-output/support-matrix.json');
  const [baseline, candidate] = await Promise.all([readMatrix('baseline', baselinePath), readMatrix('candidate', candidatePath)]);

  const drift = buildSupportMatrixDrift(baseline, candidate);
  const output = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    taxonomySchemaVersion: candidate.taxonomySchemaVersion,
    familyCount: candidate.familyCount,
    baseline: { generatedAt: baseline.sourceReport.generatedAt, runId: baseline.sourceReport.runId, revision: baseline.sourceReport.revision },
    candidate: { generatedAt: candidate.sourceReport.generatedAt, runId: candidate.sourceReport.runId, revision: candidate.sourceReport.revision },
    ...drift,
  };
  if (!validDrift(output)) throw new Error(`Computed drift does not satisfy its own schema (${JSON.stringify(validDrift.errors)})`);

  const target = path.resolve(root, typeof options.output === 'string' ? options.output : 'results-output/support-matrix-drift.json');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(output, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
  console.log(`Drift: ${JSON.stringify(output.summary)} of ${candidate.familyCount} families.`);
  console.log(`Report: ${path.relative(root, target)}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
