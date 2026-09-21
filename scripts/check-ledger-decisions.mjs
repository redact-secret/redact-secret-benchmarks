/**
 * CI gate: every `benchmarks/review-ledger.json` entry marked `not-assertable`
 * must belong to an operator class an accepted ADR under `docs/decisions/`
 * actually records a decision for (issue #63). Bulk-reclassifying a whole
 * operator class with no paper trail is exactly the failure mode `resolved`
 * ledger entries are protected against by requiring a per-fixture review;
 * `not-assertable` is a per-class decision instead, and this gate is its
 * equivalent: no entry carries that status unless the class it names is
 * checked in as a decision, not merely asserted in a commit message.
 *
 * An ADR opts in with a machine-readable marker comment naming the operator
 * ids it decides, e.g.:
 *   <!-- decided-operators: lexical.invalid-alphabet, lexical.length-minus-one -->
 *
 * Run: npm run decisions:validate
 */
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const DECISIONS_DIR = new URL('docs/decisions/', root);
const MARKER = /<!--\s*decided-operators:\s*([^>]*?)\s*-->/g;

/** Every operator id an accepted ADR claims, mapped to the file that claims it. Throws on a duplicate claim: one decision per operator. */
export async function decidedOperators() {
  const files = (await readdir(DECISIONS_DIR)).filter(name => name.endsWith('.md'));
  const decided = new Map();
  for (const file of files) {
    const text = await readFile(new URL(file, DECISIONS_DIR), 'utf8');
    for (const match of text.matchAll(MARKER)) {
      for (const id of match[1].split(',').map(s => s.trim()).filter(Boolean)) {
        if (decided.has(id)) throw new Error(`operator "${id}" is claimed by both docs/decisions/${decided.get(id)} and docs/decisions/${file}`);
        decided.set(id, file);
      }
    }
  }
  return decided;
}

const ledgerClassOf = note => /Class: (.+?)\.?\s*$/s.exec(note)?.[1] ?? 'unclassified';

/** Every not-assertable ledger entry whose class no ADR decides, named with the entry id and the class it needs a decision for. */
export function undecidedNotAssertableEntries(ledger, decided) {
  const problems = [];
  for (const [id, entry] of Object.entries(ledger.entries)) {
    if (entry.status !== 'not-assertable') continue;
    const raw = ledgerClassOf(entry.note);
    const operator = raw.startsWith('operator=') ? raw.slice('operator='.length) : null;
    if (!operator || !decided.has(operator))
      problems.push(`${id}: marked not-assertable for class "${raw}", which no ADR under docs/decisions/ records a decision for`);
  }
  return problems;
}

export async function checkLedgerDecisions() {
  const [decided, ledger] = await Promise.all([
    decidedOperators(),
    readFile(new URL('benchmarks/review-ledger.json', root), 'utf8').then(JSON.parse),
  ]);
  return undecidedNotAssertableEntries(ledger, decided);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkLedgerDecisions();
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length) process.exitCode = 1;
  else console.log('Ledger decisions gate passed: every not-assertable entry belongs to an ADR-decided operator class.');
}
