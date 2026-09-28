// Validate the frozen six-family PII gap ledger (benchmarks #422) and the files it freezes.
// Usage: npm run pii:ledger:check [-- --ledger=evidence/901/pii-gap-ledger-v1.json]
import { readFile } from 'node:fs/promises';
import { validatePiiGapLedger, piiGapLedgerFileDrift } from '../benchmarks/evaluation/domains/pii/gap-ledger.ts';

const argument = process.argv.slice(2).find(value => value.startsWith('--ledger='));
const file = argument ? argument.slice('--ledger='.length) : 'evidence/901/pii-gap-ledger-v1.json';
const ledger = validatePiiGapLedger(JSON.parse(await readFile(file, 'utf8')));
const drift = await piiGapLedgerFileDrift(ledger, process.cwd());
if (drift.length) {
  console.error(`Frozen files changed since the ledger was recorded: ${drift.join(', ')}`);
  process.exit(1);
}
const statuses = ledger.families.flatMap(row => row.blockers.map(blocker => blocker.status));
const count = status => statuses.filter(value => value === status).length;
console.log(`${file}: valid, commitment ${ledger.contentCommitment}`);
console.log(`final candidate ${ledger.finalCandidate.sourceCommit} (${ledger.finalCandidate.status}, PII evidence bound: ${ledger.finalCandidate.piiEvidenceBound})`);
console.log(`blockers: ${['passed', 'failed', 'not-measured', 'not-run', 'not-applicable'].map(status => `${status} ${count(status)}`).join(', ')}; backlog axes ${ledger.axisBacklog.length}`);
