import { readFile, writeFile } from 'node:fs/promises';

const ledger = JSON.parse(await readFile('benchmarks/review-ledger.json', 'utf8'));
const dump = JSON.parse(await readFile('results-output/queue-dump-postfix.json', 'utf8'));
const runId = dump.runId;

const TEMPLATES = {
  'lexical.invalid-alphabet': "Mutation review-required by construction: operator `lexical.invalid-alphabet` replaces the last character of the secret value with a character outside the token's alphabet, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=lexical.invalid-alphabet.",
  'lexical.length-minus-one': "Mutation review-required by construction: operator `lexical.length-minus-one` removes the last character of the contracted secret value, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=lexical.length-minus-one.",
  'lexical.prefix-change': "Mutation review-required by construction: operator `lexical.prefix-change` swaps the first character of the secret value for a different letter, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=lexical.prefix-change.",
  'boundary.remove-delimiter': "Mutation review-required by construction: operator `boundary.remove-delimiter` removes one internal delimiter (., -, or _) from the secret value, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=boundary.remove-delimiter.",
  'lexical.length-plus-one': "Mutation review-required by construction: operator `lexical.length-plus-one` appends an extra character to the contracted secret value, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=lexical.length-plus-one.",
  'structural.remove-segment': "Mutation review-required by construction: operator `structural.remove-segment` removes one dash/dot-delimited segment from the secret value, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=structural.remove-segment.",
  'lexical.replace-last': "Mutation review-required by construction: operator `lexical.replace-last` replaces the last character of the contracted secret value with a different character, which breaks the fixture's lexical contract. Per the review-required strategy (benchmarks/engine/model.ts), no negative truth is inferable once a contract is broken — a different family or an independent contextual credential may still legitimately apply, and scanner silence or a match proves nothing either way. Ground truth requires a per-fixture authored decision that has not been made. Class: operator=lexical.replace-last.",
};

const isNew = id => !ledger.entries[id];
const newMutation = dump.reviewQueue.filter(e => isNew(e.id) && e.method === 'mutation');

let applied = 0, skipped = [];
for (const e of newMutation) {
  const template = TEMPLATES[e.variant];
  if (!template) { skipped.push(e); continue; }
  ledger.entries[e.id] = { status: 'not-assertable', firstSeenRun: runId, note: template };
  applied++;
}

console.log('applied:', applied, 'skipped (unknown operator):', skipped.length);
if (skipped.length) console.log(JSON.stringify(skipped.slice(0, 5), null, 1));

const sortedEntries = Object.fromEntries(Object.keys(ledger.entries).sort().map(k => [k, ledger.entries[k]]));
ledger.entries = sortedEntries;
await writeFile('benchmarks/review-ledger.json', JSON.stringify(ledger, null, 2) + '\n');
console.log('wrote benchmarks/review-ledger.json');
