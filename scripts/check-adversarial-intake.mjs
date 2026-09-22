/**
 * CI gate (#139): every external adversarial pack under adversarial/ satisfies
 * the intake contract (schemas/adversarial-intake-v1.json plus the rules in
 * benchmarks/lib/adversarial-intake.ts); the synthetic sample's rejection
 * cases are each rejected for the stated reason; no frozen first run changed
 * or disappeared since the base revision; and the rendered site never calls
 * project-authored evidence independent.
 *
 * Run: npm run adversarial:check [-- --base=<git-ref>]
 * The base defaults to origin/main. When that ref is unavailable (a shallow
 * clone without it), the first-run immutability step says so and is skipped;
 * the per-pack SHA-256 pin still holds.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fileDigest, firstRunImmutabilityProblems } from '../benchmarks/lib/adversarial-intake.ts';
import {
  firstRunDigests, loadPacks, packProblems, rejectionCaseProblems, uiLanguageProblems,
} from '../benchmarks/lib/adversarial-packs.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.argv.find(arg => arg.startsWith('--base='))?.slice('--base='.length) ?? 'origin/main';
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

const packs = loadPacks(root);
const failures = [...packProblems(packs)];

for (const pack of packs.filter(p => p.record.sample)) {
  const cases = JSON.parse(readFileSync(`${root}${pack.path}/rejections.json`, 'utf8')).cases;
  failures.push(...rejectionCaseProblems(pack, cases));
}

let baseRef = null;
try { baseRef = git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).trim(); } catch { /* unavailable */ }
if (baseRef) {
  const atBase = new Map();
  for (const path of git(['ls-tree', '-r', '--name-only', baseRef, '--', 'adversarial']).split('\n')) {
    const match = /^(adversarial\/(?:packs|samples)\/[^/]+)\/first-run\.json$/.exec(path);
    if (match) atBase.set(match[1], fileDigest(git(['show', `${baseRef}:${path}`])));
  }
  failures.push(...firstRunImmutabilityProblems(firstRunDigests(packs), atBase));
} else {
  console.log(`Note: base ${base} is unavailable; first-run immutability against the base revision was not checked.`);
}

failures.push(...uiLanguageProblems(root));

if (failures.length) {
  console.error(`Adversarial intake check failed:\n${failures.map(f => `  - ${f}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Adversarial intake check passed: ${packs.length} pack(s) valid, sample rejection cases rejected as stated${baseRef ? `, first runs unchanged since ${base}` : ''}, no independence claim in the site.`);
}
