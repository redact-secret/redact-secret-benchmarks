/**
 * CI gate (#142): custodian-held blind material never reaches a tracked file,
 * public/ or the built site; only a whitelisted aggregate may.
 *
 * Fails when any tracked file, or any file under public/ or dist/:
 *   - is a blind corpus, freeze record or ledger (by its JSON type marker); or
 *   - carries a blind aggregate that is not a standalone JSON document passing
 *     schemas/blind-aggregate-v1.json and its consistency rules.
 * The spec documents the private formats, so it is the one file allowed to
 * show the markers. Run it after `npm run build` so dist/ is covered.
 * Rules: docs/specs/blind-evaluation.md §6.
 *
 * Run: npm run blind:check-public [-- --root=<dir>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAggregate } from '../benchmarks/blind/aggregate.ts';

export const PUBLIC_DIRECTORIES = ['public', 'dist'];
/** Files that define or document the private formats and may name their markers. */
export const ALLOWED = new Set(['docs/specs/blind-evaluation.md']);
const PRIVATE_MARKERS = [
  /"corpusType"\s*:\s*"blind-custodian-fixtures"/,
  /"freezeType"\s*:\s*"blind-freeze"/,
  /"ledgerType"\s*:\s*"blind-ledger"/,
];
const AGGREGATE = /"reportType"\s*:\s*"blind-aggregate"/;
/** The runner's default release location; it must stay git-ignored. */
export const IGNORED_OUTPUT = 'results-output/blind/blind-aggregate-example.json';
const TEXT = /\.(json|jsonl|js|mjs|cjs|ts|html|css|txt|map|md|csv|svg|xml|ya?ml)$/i;

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else if (entry.isFile()) yield file;
  }
}

function tracked(root) {
  try { return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean); }
  catch { return []; }
}

/** Problems for one repository root; empty when no public or tracked surface carries blind material. */
export function blindPublicProblems(root, { files = tracked(root), checkIgnore = true } = {}) {
  const candidates = new Set(files);
  for (const name of PUBLIC_DIRECTORIES) {
    const directory = path.join(root, name);
    if (existsSync(directory) && statSync(directory).isDirectory()) for (const file of walk(directory)) candidates.add(path.relative(root, file));
  }
  const problems = [];
  for (const relative of [...candidates].sort()) {
    if (ALLOWED.has(relative) || !TEXT.test(relative)) continue;
    const file = path.join(root, relative);
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const text = readFileSync(file, 'utf8');
    if (PRIVATE_MARKERS.some(marker => marker.test(text))) {
      problems.push(`${relative}: carries a private blind corpus, freeze or ledger; these stay in the custodian's private root`);
      continue;
    }
    if (!AGGREGATE.test(text)) continue;
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { problems.push(`${relative}: embeds a blind aggregate that is not a standalone JSON document, so its shape cannot be checked`); continue; }
    try { validateAggregate(parsed); }
    catch (error) { problems.push(`${relative}: blind aggregate fails the release whitelist (${error.code ?? 'invalid'})`); }
  }
  if (checkIgnore) {
    try { execFileSync('git', ['check-ignore', '-q', IGNORED_OUTPUT], { cwd: root, stdio: 'ignore' }); }
    catch { problems.push(`.gitignore: ${IGNORED_OUTPUT} must stay ignored so a run's release cannot be committed by accident`); }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootArgument = process.argv.slice(2).find(a => a.startsWith('--root='));
  const root = rootArgument ? path.resolve(rootArgument.slice('--root='.length)) : fileURLToPath(new URL('../', import.meta.url));
  const problems = blindPublicProblems(root);
  if (problems.length) {
    console.error(`Blind evaluation publication check failed:\n${problems.map(p => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Blind evaluation publication check passed: no tracked file or file under ${PUBLIC_DIRECTORIES.join('/, ')}/ carries a blind corpus, freeze or ledger, and every blind aggregate passes the release whitelist.`);
  }
}
