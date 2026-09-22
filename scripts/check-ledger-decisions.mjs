/**
 * CI gate: every `benchmarks/review-ledger.json` entry marked `not-assertable`
 * must belong to an operator or decision class `benchmarks/ledger-decisions.json`
 * maps to an accepted ADR under `docs/decisions/` (issue #63). Bulk-reclassifying
 * a whole operator class with no paper trail is exactly the failure mode
 * `resolved` ledger entries are protected against by requiring a per-fixture
 * review; `not-assertable` is a per-class decision instead, and this gate is
 * its equivalent: no entry carries that status unless the class it names is
 * checked in as a decision, not merely asserted in a commit message.
 *
 * `benchmarks/ledger-decisions.json` maps each decided operator or decision
 * class id to the `docs/decisions/` file that decided it, e.g.:
 *   { "decided": { "lexical.invalid-alphabet": "2026-09-21-settle-mechanical-mutation-review-classes.md" } }
 * A ledger entry for a mutation operator carries `Class: operator=<id>`; one
 * for a decided class that is not a mutation operator (issue #125:
 * differential disagreements on `pending` T0 fixtures, which have no operator
 * at all) carries `Class: decision=<id>` instead. Both check against the same
 * map. This gate reads only that data file, never an ADR body (#135) --
 * `decidedOperators()`'s name is kept for the exported call shape existing
 * tests and callers already use.
 *
 * Run: npm run ledger:decisions:check
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const LEDGER_DECISIONS = new URL('benchmarks/ledger-decisions.json', root);

/** Every operator or class id `benchmarks/ledger-decisions.json` claims, mapped to the `docs/decisions/` file that claims it. */
export async function decidedOperators() {
  const { decided } = JSON.parse(await readFile(LEDGER_DECISIONS, 'utf8'));
  return new Map(Object.entries(decided));
}

const ledgerClassOf = note => /Class: (.+?)\.?\s*$/s.exec(note)?.[1] ?? 'unclassified';

/** Every not-assertable ledger entry whose `operator=`/`decision=` class no ADR decides, named with the entry id and the class it needs a decision for. */
export function undecidedNotAssertableEntries(ledger, decided) {
  const problems = [];
  for (const [id, entry] of Object.entries(ledger.entries)) {
    if (entry.status !== 'not-assertable') continue;
    const raw = ledgerClassOf(entry.note);
    const decidedId = /^(?:operator|decision)=(.+)$/.exec(raw)?.[1] ?? null;
    if (!decidedId || !decided.has(decidedId))
      problems.push(`${id}: marked not-assertable for class "${raw}", which benchmarks/ledger-decisions.json records no decision for`);
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
  else console.log('Ledger decisions gate passed: every not-assertable entry belongs to an ADR-decided operator or decision class.');
}
