import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSupportMatrix, type SupportStatusReport } from './support/matrix.ts';
import { taxonomy } from './support/taxonomy.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

async function main() {
  const options: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(input|output)=(.+)$/.exec(arg);
    const key = match?.[1] ?? arg.slice(2);
    if (!match || key in options) throw new Error('Usage: npm run eval:matrix -- [--input=results-output/support-status.json] [--output=results-output/support-matrix.json]');
    options[key] = match[2];
  }
  const inputPath = path.resolve(root, typeof options.input === 'string' ? options.input : 'results-output/support-status.json');
  let statusReport: SupportStatusReport;
  try {
    statusReport = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${path.relative(root, inputPath)} — run \`npm run eval:classify\` first (A3, #504). ${error instanceof Error ? error.message : error}`);
  }
  const { distribution, stableDistribution, families } = buildSupportMatrix(statusReport);
  const output = {
    schemaVersion: 1 as const,
    taxonomySchemaVersion: taxonomy.schemaVersion,
    // Carried through verbatim so a stale support-status.json input (a format
    // change upstream, an unrefreshed evaluation run) surfaces here too, per
    // #509's provenance acceptance criterion — never re-stamped at generation
    // time, which is what keeps this generator byte-identical on unchanged input.
    sourceReport: {
      schemaVersion: statusReport.schemaVersion, generatedAt: statusReport.generatedAt, runId: statusReport.runId,
      revision: statusReport.revision, dirty: statusReport.dirty, criteriaSchemaVersion: statusReport.criteriaSchemaVersion,
      // Which redact-secret was measured: absent for the published package,
      // so a published-mode matrix stays byte-identical to before.
      ...(statusReport.product ? { product: statusReport.product } : {}),
      // The released package a published-mode run measured, when the report records it.
      ...(statusReport.publishedPackage ? { publishedPackage: statusReport.publishedPackage } : {}),
      scannerObservations: statusReport.scannerObservations,
    },
    providerCount: taxonomy.providers.length,
    familyCount: families.length,
    distribution,
    stableDistribution,
    families,
  };
  const target = path.resolve(root, typeof options.output === 'string' ? options.output : 'results-output/support-matrix.json');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(output, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
  console.log(`Distribution: ${JSON.stringify(distribution)} of ${families.length} taxonomy families.`);
  console.log(`Report: ${path.relative(root, target)}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
