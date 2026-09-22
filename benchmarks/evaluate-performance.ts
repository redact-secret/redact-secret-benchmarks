/**
 * Evaluates one core `CompleteAssessment` summary against this repository's
 * pinned performance criteria and writes a machine-readable and Markdown
 * verdict. Owns the step redact-secret#603 (DS11) moves out of core:
 * "acceptance evaluation and reports."
 *
 * Usage:
 *   node --import tsx benchmarks/evaluate-performance.ts \
 *     --summary assessment-output/summary.json \
 *     [--criteria benchmarks/performance-criteria.json] \
 *     [--json-out performance-output/acceptance.json] \
 *     [--markdown-out performance-output/acceptance.md]
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { completeAssessmentProblem } from './lib/performance-schema.ts';
import { evaluateAcceptance, renderAcceptanceMarkdown } from './lib/performance-acceptance.ts';

const usage = 'node --import tsx benchmarks/evaluate-performance.ts --summary <path> [--criteria <path>] [--json-out <path>] [--markdown-out <path>]';
const args = process.argv.slice(2), options: Record<string, string> = {};
for (let i = 0; i < args.length; i += 2) {
  const match = /^--(summary|criteria|json-out|markdown-out)$/.exec(args[i]);
  if (!match || args[i + 1] === undefined) throw new Error(usage);
  options[match[1]] = args[i + 1];
}
if (!options.summary) throw new Error(usage);

const root = new URL('../', import.meta.url);
const summary = JSON.parse(await readFile(new URL(options.summary, root), 'utf8'));
const problem = completeAssessmentProblem(summary);
if (problem) throw new Error(`Refusing to evaluate: ${problem}`);

const criteriaPath = options.criteria ?? 'benchmarks/performance-criteria.json';
const criteria = JSON.parse(await readFile(new URL(criteriaPath, root), 'utf8'));

const evaluation = evaluateAcceptance(summary, criteria);
const markdown = renderAcceptanceMarkdown(evaluation);

if (options['json-out']) {
  const target = new URL(options['json-out'], root);
  await mkdir(new URL(path.dirname(options['json-out']) + '/', root), { recursive: true });
  await writeFile(target, `${JSON.stringify(evaluation, null, 2)}\n`);
}
if (options['markdown-out']) {
  const target = new URL(options['markdown-out'], root);
  await mkdir(new URL(path.dirname(options['markdown-out']) + '/', root), { recursive: true });
  await writeFile(target, markdown);
}
if (!options['json-out'] && !options['markdown-out']) console.log(markdown);

console.log(`Performance acceptance: ${evaluation.status.toUpperCase()} (${evaluation.checks.length} checks, ${evaluation.failures.length} failures)`);
process.exitCode = evaluation.status === 'accepted' ? 0 : 1;
