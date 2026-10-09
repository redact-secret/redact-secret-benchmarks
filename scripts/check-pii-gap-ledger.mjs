// Check current authoring inputs. Historical ledger replay requires restored original sources explicitly.
import { readFile } from 'node:fs/promises';
import { validatePiiGapLedger, piiGapLedgerFileDrift } from '../benchmarks/evaluation/domains/pii/gap-ledger.ts';
import { piiGapPolicy } from '../benchmarks/evaluation/domains/pii/current-inputs.ts';

const args = process.argv.slice(2);
if (!args.length) {
  console.log(`Current PII gap policy: valid, projection ${piiGapPolicy.projectionCommitment}`);
  console.log(`Source ledger ${piiGapPolicy.source.commit}:${piiGapPolicy.source.path}, commitment ${piiGapPolicy.source.contentCommitment}`);
  console.log(`Release reference ${piiGapPolicy.finalCandidate.sourceCommit}; authored backlog axes ${piiGapPolicy.axisBacklog.length}. No support status is asserted.`);
  process.exit(0);
}
if (args.length !== 2 || args.some(arg => !/^--(?:archived-ledger|source-root)=.+$/.test(arg)))
  throw new Error('Historical replay requires --archived-ledger=<restored ledger> and --source-root=<restored original source tree>');
const file = args.find(arg => arg.startsWith('--archived-ledger='))?.slice('--archived-ledger='.length);
const sourceRoot = args.find(arg => arg.startsWith('--source-root='))?.slice('--source-root='.length);
if (!file || !sourceRoot) throw new Error('Historical replay requires one archived ledger and its original source root');
const ledger = validatePiiGapLedger(JSON.parse(await readFile(file, 'utf8')));
const drift = await piiGapLedgerFileDrift(ledger, sourceRoot);
if (drift.length) {
  console.error(`Frozen files changed since the ledger was recorded: ${drift.join(', ')}`);
  process.exit(1);
}
const statuses = ledger.families.flatMap(row => row.blockers.map(blocker => blocker.status));
const count = status => statuses.filter(value => value === status).length;
console.log(`${file}: valid, commitment ${ledger.contentCommitment}`);
console.log(`final candidate ${ledger.finalCandidate.sourceCommit} (${ledger.finalCandidate.status}, PII evidence bound: ${ledger.finalCandidate.piiEvidenceBound})`);
console.log(`blockers: ${['passed', 'failed', 'not-measured', 'not-run', 'not-applicable'].map(status => `${status} ${count(status)}`).join(', ')}; backlog axes ${ledger.axisBacklog.length}`);
