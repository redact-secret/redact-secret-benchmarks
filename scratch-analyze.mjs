import { readFile, writeFile } from 'node:fs/promises';

const ledger = JSON.parse(await readFile('benchmarks/review-ledger.json', 'utf8'));
const pre = JSON.parse(await readFile('results-output/queue-dump-prefix.json', 'utf8')).reviewQueue;
const post = JSON.parse(await readFile('results-output/queue-dump-postfix.json', 'utf8')).reviewQueue;

const contentKey = e => {
  if (e.method === 'mutation') return JSON.stringify({ caseId: e.caseId, variant: e.variant });
  // differential: everything except `id` and the hash-reshuffled `source`/sourceHash-derived id.
  const { id, ...rest } = e;
  return JSON.stringify(rest);
};

const disposedMap = new Map(); // contentKey -> { status, note, oldId }
for (const e of pre) {
  const rec = ledger.entries[e.id];
  if (rec && (rec.status === 'resolved' || rec.status === 'not-assertable')) {
    disposedMap.set(contentKey(e), { status: rec.status, note: rec.note, oldId: e.id });
  }
}

const isNew = id => !ledger.entries[id];
const newEntries = post.filter(e => isNew(e.id));

const carryForward = [], trulyNew = [];
for (const e of newEntries) {
  const key = contentKey(e);
  const disposed = disposedMap.get(key);
  if (disposed) carryForward.push({ newId: e.id, ...disposed, method: e.method, targets: e.targets, caseId: e.caseId });
  else trulyNew.push(e);
}

console.log('new total:', newEntries.length, 'carry-forward:', carryForward.length, 'truly new:', trulyNew.length);

const byFamilyMethod = {};
for (const e of trulyNew) for (const t of e.targets) {
  byFamilyMethod[t] = byFamilyMethod[t] || { differential: 0, mutation: 0 };
  byFamilyMethod[t][e.method]++;
}
console.log('truly-new breakdown:', JSON.stringify(byFamilyMethod, null, 1));

await writeFile('results-output/carry-forward.json', JSON.stringify(carryForward, null, 2));
await writeFile('results-output/truly-new.json', JSON.stringify(trulyNew, null, 2));
console.log('wrote results-output/carry-forward.json and results-output/truly-new.json');
