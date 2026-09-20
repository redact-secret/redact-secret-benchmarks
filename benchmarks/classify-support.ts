import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { platform, arch } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanners as available } from '../scanners/index.mjs';
import { createMethods } from './methods/index.ts';
import { createOperators } from './operators/index.ts';
import { loadCases } from './engine/cases.ts';
import type { ReviewLedger } from './engine/types.ts';
import { runEvaluation } from './engine/runner.ts';
import { contracts } from './lib/assessment.ts';
import { classifyFamilySupport, statusCriteria, type SupportStatus } from './support/status.ts';
import { familiesForDetector } from './support/taxonomy.ts';
import { familyEvidence } from './support/evidence.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

async function main() {
  const options: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(output)=(.+)$/.exec(arg);
    const key = match?.[1] ?? arg.slice(2);
    if (!match || key in options) throw new Error('Usage: npm run eval:classify -- [--output=results-output/support-status.json]');
    options[key] = match[2];
  }
  const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const ledger: ReviewLedger = JSON.parse(await readFile(path.join(root, 'benchmarks/review-ledger.json'), 'utf8'));
  // The suite's pinned scanner set: what the checked-in review ledger was triaged against.
  const scanners = available.filter((s: { id: string }) => Object.hasOwn(suite.scanners, s.id));
  const operators = createOperators(), methods = createMethods();
  const cases = (await loadCases(operators)).map(c => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
  let revision = 'unknown', dirty: boolean | null = null;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  } catch {}
  console.log(`Running every registered family's evidence through the profile: ${cases.length} cases with ${scanners.map((s: { id: string }) => s.id).join(', ')}…`);
  const report = await runEvaluation({ cases, methods, operators, scanners, ledger, onProgress: console.log });
  // The unit is a registered detector (issue #504's "42", pinned to the beta.5 registry
  // snapshot), not a taxonomy sub-family: `contracts` keys are exactly `detectors.json`'s ids.
  const families = Object.keys(contracts).sort();
  const results = families.map(family => {
    const evidence = familyEvidence(family, report.byDetector, report.reviewQueue, ledger);
    const assessment = classifyFamilySupport(evidence);
    // Un-probeable (#33) is carried alongside the status, never folded silently
    // into a bare "not enough twins" reading: zero twin pairs reads differently
    // when the provider gives nothing a twin could mutate.
    const unprobeable = contracts[family].unprobeable ?? null;
    return { ...assessment, taxonomyFamilies: familiesForDetector(family).map(f => f.id), evidence, unprobeable };
  });
  const distribution = results.reduce((d, r) => { d[r.status] = (d[r.status] ?? 0) + 1; return d; },
    { stable: 0, provisional: 0, pending: 0, unsupported: 0 } as Record<SupportStatus, number>);
  const output = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), runId: report.runId,
    revision, dirty, criteriaSchemaVersion: statusCriteria.schemaVersion,
    scanners: scanners.map((s: { id: string }) => s.id), caseCount: report.caseCount, variantCount: report.variantCount,
    familyCount: families.length, distribution, families: results,
  };
  const target = path.resolve(root, typeof options.output === 'string' ? options.output : 'results-output/support-status.json');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${report.runId}.tmp`;
  await writeFile(temporary, JSON.stringify(output, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
  console.log(`Distribution: ${JSON.stringify(distribution)} of ${families.length} families.`);
  console.log(`Report: ${path.relative(root, target)}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
