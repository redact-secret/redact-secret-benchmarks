import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { platform, arch } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanners } from '../scanners/index.mjs';
import { createMethods } from './methods/index.ts';
import { createOperators } from './operators/index.ts';
import { loadCases } from './engine/cases.ts';
import { hash } from './engine/model.ts';
import { runEvaluation, exitCode } from './engine/runner.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = 'npm run eval -- [--method=twin,benign] [--detector=github-token] [--scanner=redact-secret,gitleaks,trufflehog] [--seed=experiment-1] [--strict] [--fail-on-assertions] [--output=results-output/evaluation.json]';
const args = process.argv.slice(2), options: Record<string, string | boolean> = {};
for (const arg of args) {
  const match = /^--(method|detector|scanner|output|seed)=(.+)$/.exec(arg);
  const key = match?.[1] ?? arg.slice(2);
  if ((!match && !['--strict', '--fail-on-assertions', '--help'].includes(arg)) || key in options) throw new Error(usage);
  options[key] = match?.[2] ?? true;
}
if (options.help) { console.log(usage); process.exit(0); }
const methods = createMethods(), operators = createOperators();
let cases = await loadCases(operators);
const select = (value: string | boolean | undefined, available: string[], label: string) => {
  if (!value) return available;
  const ids = String(value).split(',');
  if (new Set(ids).size !== ids.length || ids.some(id => !available.includes(id))) throw new Error(`Unknown or duplicate ${label} selection`);
  return ids;
};
const methodIds = select(options.method, methods.values().map(m => m.id), 'method');
const detectorIds = select(options.detector, [...new Set(cases.flatMap(c => c.targets))], 'detector');
const scannerIds = select(options.scanner, scanners.map(s => s.id), 'scanner');
cases = cases.filter(c => methodIds.includes(c.method) && (!options.detector || c.targets.some(t => detectorIds.includes(t))));
if (!cases.length) throw new Error('Selection contains no evaluation cases');
if (options.seed) {
  if (typeof options.seed !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(options.seed)) throw new Error('Seed must be a short experiment identifier');
  cases = cases.map(c => ({ ...c, provenance: { ...c.provenance, seed: `${options.seed}/${c.provenance.seed}` } }));
}
let revision = 'unknown', dirty: boolean | null = null;
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
} catch {}
console.log(`Evaluating ${cases.length} cases with ${scannerIds.join(', ')}…`);
const report = await runEvaluation({ cases, methods, operators,
  scanners: scanners.filter(s => scannerIds.includes(s.id)), onProgress: message => console.log(message),
  provenance: { revision, dirty, seed: options.seed ?? 'corpus-default', lockHash: hash(await readFile(path.join(root, 'package-lock.json'))),
    runtime: { node: process.version, platform: platform(), arch: arch() },
    selection: { methods: methodIds, detectors: options.detector ? detectorIds : 'all', scanners: scannerIds } },
});
const target = path.resolve(root, typeof options.output === 'string' ? options.output : 'results-output/evaluation.json');
await mkdir(path.dirname(target), { recursive: true });
const temporary = `${target}.${report.runId}.tmp`;
await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
await rename(temporary, target);
console.log(`${report.caseCount} cases / ${report.variantCount} variants; ${report.generationErrors.length} generation errors; ${report.failures.length} failed assertions; ${report.reviewQueue.length} review entries.`);
console.log(`Report: ${path.relative(root, target)}`);
process.exitCode = exitCode(report, { strict: Boolean(options.strict), failOnAssertions: Boolean(options['fail-on-assertions']) });
