import { readFile } from 'node:fs/promises';
import { reviewLedgerProblem } from '../benchmarks/engine/review-ledger.ts';
import { reviewClasses } from '../src/evaluation-model.ts';

const ledger = JSON.parse(await readFile(new URL('../benchmarks/review-ledger.json', import.meta.url), 'utf8'));
const problem = reviewLedgerProblem(ledger);
if (problem) throw new Error(problem);
const classes = reviewClasses(ledger);
const total = classes.reduce((sum, group) => sum + group.open + group.resolved + group['not-assertable'], 0);
if (total !== Object.keys(ledger.entries).length) throw new Error(`Review category accounting lost ${Object.keys(ledger.entries).length - total} entries`);
const unmapped = classes.find(group => group.id === 'unmapped');
if (unmapped?.open) throw new Error(`${unmapped.open} open review entries use ${unmapped.rawClasses.length} unmapped classes; classify them explicitly`);
console.log(`Review ledger v2 valid: ${total} entries; ${unmapped?.rawClasses.length ?? 0} closed legacy classes remain explicitly unmapped.`);
