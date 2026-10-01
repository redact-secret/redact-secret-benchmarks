/**
 * Prints the coverage `vitest run --coverage` measured, by directory, as a Markdown table, and adds
 * it to the job summary when GitHub provides one. Reads coverage/coverage-summary.json; the
 * thresholds themselves are enforced by vitest (vitest.config.mts), this only reports.
 *
 * Run: npm run coverage:summary
 */
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summary = JSON.parse(readFileSync(path.join(webRoot, 'coverage/coverage-summary.json'), 'utf8'));

const METRICS = ['lines', 'statements', 'functions', 'branches'];
const groups = new Map();
for (const [file, value] of Object.entries(summary)) {
  if (file === 'total') continue;
  const dir = path.relative(webRoot, file).split(path.sep)[0];
  const held = groups.get(dir) ?? Object.fromEntries(METRICS.map(m => [m, { covered: 0, total: 0 }]));
  for (const m of METRICS) { held[m].covered += value[m].covered; held[m].total += value[m].total; }
  groups.set(dir, held);
}

const pct = ({ covered, total }) => (total === 0 ? '100.0' : ((covered / total) * 100).toFixed(1));
const rows = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([dir, m]) => `| ${dir}/ | ${METRICS.map(k => `${pct(m[k])}% (${m[k].covered}/${m[k].total})`).join(' | ')} |`);
const total = summary.total;
rows.push(`| **all** | ${METRICS.map(k => `**${total[k].pct}%** (${total[k].covered}/${total[k].total})`).join(' | ')} |`);

const table = ['| Directory | Lines | Statements | Functions | Branches |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
console.log(`Web app coverage (V8, minimum 80% each):\n\n${table}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Web app coverage\n\n${table}\n\nThe HTML report is in the \`web-coverage\` artifact.\n`);
