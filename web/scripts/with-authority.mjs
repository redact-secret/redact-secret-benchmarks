/**
 * Run a command with the committed qualification authority set to `legacy` or `new` for its duration, then put the file back (#608):
 *
 *   node scripts/with-authority.mjs legacy -- sh -c 'npm run build && npm run check:routes'
 *
 * This is how the other pipeline is built and checked from one checkout without a commit: the CI web job builds and browser-tests the
 * legacy pipeline this way (CI has no qualification view, so the committed `new` has no data pages to test), and a reviewer can rehearse
 * the rollback locally. It changes the one value the rollback changes, in the working tree only, and restores the file's own bytes
 * afterwards, also when the command fails or is interrupted. It is never run by a workflow that publishes anything.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = path.join(repoRoot, 'benchmarks/qualification-authority.json');
const [value, separator, ...command] = process.argv.slice(2);
if (!['legacy', 'new'].includes(value) || separator !== '--' || command.length === 0) {
  console.error('usage: node scripts/with-authority.mjs <legacy|new> -- <command> [args...]');
  process.exit(2);
}

const original = readFileSync(file, 'utf8');
const pattern = /("authority":\s*")(legacy|new)(")/;
if (!pattern.test(original)) { console.error(`${file} has no authority value to set`); process.exit(2); }
const restore = () => writeFileSync(file, original);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restore(); process.exit(130); });

writeFileSync(file, original.replace(pattern, `$1${value}$3`));
console.log(`authority ${original.match(pattern)[2]} -> ${value} for: ${command.join(' ')}`);
let status = 1;
try {
  status = spawnSync(command[0], command.slice(1), { stdio: 'inherit' }).status ?? 1;
} finally {
  restore();
  console.log(`authority restored to ${original.match(pattern)[2]}`);
}
process.exit(status);
