/**
 * One-time migration for #173: rewrite `benchmarks/review-ledger.json` keys from
 * the old id (product identity hashed in) to the new one (product identity
 * excluded), keeping every entry's status and note. Run it with the published
 * product package installed at the version the ledger was authored under, so
 * the old ids are reproduced exactly.
 *
 * Run: node --import tsx scripts/rekey-review-ledger.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanners as available } from '../scanners/index.mjs';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { runEvaluation } from '../benchmarks/engine/runner.ts';
import { reviewEntryId } from '../benchmarks/engine/execution.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const ledgerPath = path.join(root, 'benchmarks/review-ledger.json');
const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
const scanners = available.filter((s: { id: string }) => Object.hasOwn(suite.scanners, s.id));
const operators = createOperators(), methods = createMethods();
const cases = (await loadCases(operators)).map((c: any) => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
const sourceHash = new Map(cases.map((c: any) => [c.id, c.provenance.sourceHash]));
const report = await runEvaluation({ cases, methods, operators, scanners, ledger });

const renamed = new Map<string, string>();
for (const q of report.reviewQueue as any[]) {
  const { id, caseId, method, targets, ...entry } = q;
  if (!('evidence' in entry)) continue;
  const legacy = reviewEntryId(caseId, sourceHash.get(caseId), entry, true);
  if (legacy !== id && Object.hasOwn(ledger.entries, legacy)) {
    if (renamed.has(legacy) && renamed.get(legacy) !== id) throw new Error(`ambiguous rekey for ${legacy.slice(0, 12)}`);
    renamed.set(legacy, id);
  }
}
const entries: Record<string, unknown> = {};
for (const [key, value] of Object.entries(ledger.entries)) {
  const next = renamed.get(key) ?? key;
  if (next in entries) throw new Error(`rekey collision on ${next.slice(0, 12)}`);
  entries[next] = value;
}
await writeFile(ledgerPath, `${JSON.stringify({ ...ledger, entries }, null, 2)}\n`);
console.log(`Rekeyed ${renamed.size} of ${Object.keys(ledger.entries).length} entries; ${Object.keys(ledger.entries).length - renamed.size} keys unchanged.`);
