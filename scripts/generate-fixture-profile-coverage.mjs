/**
 * Regenerate, or with --check verify, the fixture-profile coverage report and
 * the criteria table embedded in docs/specs/support-status.md (#206). Nothing
 * here runs a scanner, so it is deterministic and safe for every CI run: a
 * corpus edit, a criteria edit or a hand-edited generated file all read as
 * drift and fail.
 *
 * Run: npm run profiles:generate | npm run profiles:check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { buildFixtureProfileCoverage, profileCriteriaTable, renderFixtureProfileCoverage } from '../benchmarks/support/profile-report.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const SPEC = 'docs/specs/support-status.md';
const BEGIN = '<!-- fixture-profiles:begin -->', END = '<!-- fixture-profiles:end -->';

const report = buildFixtureProfileCoverage(await loadCases(createOperators()));
const embedded = text => {
  const start = text.indexOf(BEGIN), end = text.indexOf(END);
  if (start < 0 || end < start) throw new Error(`${SPEC} must carry ${BEGIN} … ${END} around the generated criteria table`);
  return { before: text.slice(0, start + BEGIN.length), after: text.slice(end) };
};
const spec = await readFile(path.join(root, SPEC), 'utf8');
const { before, after } = embedded(spec);
const outputs = {
  'docs/generated/fixture-profile-coverage.json': JSON.stringify(report, null, 2) + '\n',
  'docs/generated/fixture-profile-coverage.md': renderFixtureProfileCoverage(report),
  [SPEC]: `${before}\n${profileCriteriaTable()}\n${after}`,
};

if (process.argv.includes('--check')) {
  const drifted = [];
  for (const [file, expected] of Object.entries(outputs)) {
    const actual = await readFile(path.join(root, file), 'utf8').catch(() => null);
    if (actual !== expected) drifted.push(file);
  }
  for (const file of drifted) console.error(`::error file=${file}::${file} has drifted from the corpus and fixture-profiles.json — run \`npm run profiles:generate\` and commit the result`);
  if (drifted.length) process.exitCode = 1;
  else console.log(`Fixture profile coverage is current: ${report.familyCount} families, ${Object.keys(outputs).length} generated files.`);
} else {
  for (const [file, text] of Object.entries(outputs)) await writeFile(path.join(root, file), text);
  console.log(`Wrote ${Object.keys(outputs).join(', ')}`);
}
