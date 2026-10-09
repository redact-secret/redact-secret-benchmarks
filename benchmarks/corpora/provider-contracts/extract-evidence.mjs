// Group C (#752): extracts the credential-evidence Cases, stored fixtures and contract claim ids that the 11 Group C rows
// use into evidence-fixtures.json. Reads files only (a checkout of the pinned snapshot tag); runs nothing else.
//   node benchmarks/corpora/provider-contracts/extract-evidence.mjs --evidence-dir <checkout at snapshot-2026.10.06.5>
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROW_IDS, SNAPSHOT } from './rows.mjs';
import { detokenize, tokenize } from './tokens.mjs';

const dir = process.argv[process.argv.indexOf('--evidence-dir') + 1];
if (!dir) throw new Error('usage: --evidence-dir <checkout>');
const json = p => JSON.parse(readFileSync(join(dir, p), 'utf8'));
const rows = new Set(ROW_IDS);

const cases = [];
const wanted = new Map();
for (const f of readdirSync(join(dir, 'records/cases')).sort()) {
  const c = json(`records/cases/${f}`);
  if (c.families.some(x => rows.has(x.family))) wanted.set(c.id, c);
}
const fixtures = new Map();
for (const f of readdirSync(join(dir, 'records/fixtures')).sort()) {
  const set = json(`records/fixtures/${f}`);
  for (const x of set.fixtures) if (x.case && wanted.has(x.case)) fixtures.set(x.id, { ...x, set: set.id });
}
const families = new Set();
for (const c of wanted.values()) {
  const fx = [...fixtures.values()].filter(x => x.case === c.id).map(x => {
    if (/[^\x00-\x7f]/.test(x.text)) throw new Error(`non-ASCII fixture ${x.id}`);
    if (createHash('sha256').update(x.text).digest('hex') !== x.sha256) throw new Error(`fixture sha256 mismatch ${x.id}`);
    if (detokenize(tokenize(x.text)) !== x.text) throw new Error(`tokenize round trip failed ${x.id}`);
    return { id: x.id, set: x.set, context: x.context ?? null, sha256: x.sha256, text: tokenize(x.text), outcome: x.expected.outcome, spans: x.expected.spans.map(s => ({ start: s.start, end: s.end, role: s.role })) };
  });
  for (const x of c.families) families.add(x.family);
  cases.push({
    id: c.id,
    caseTypes: c.caseTypes,
    outcome: c.expectation.outcome,
    basis: c.expectation.basis,
    families: c.families,
    sourceIds: [...new Set((c.expectation.sources ?? []).map(s => s.sourceId))].sort(),
    probesAssembledAtRunTime: /assemble such shapes at run time/.test(c.expectation.rationale),
    fixtures: fx,
  });
}
const contractClaims = {};
for (const prov of readdirSync(join(dir, 'records/contracts')).sort()) {
  for (const f of readdirSync(join(dir, 'records/contracts', prov)).sort()) {
    const k = json(`records/contracts/${prov}/${f}`);
    if (!families.has(k.family) || !rows.has(k.family)) continue;
    contractClaims[k.family] = [...new Set([...(contractClaims[k.family] ?? []), ...k.claims.map(c => c.id), ...(k.openQuestions ?? []).map(q => q.id)])].sort();
  }
}
const out = { schema: 'group-c-evidence-fixtures-v1', issue: 752, snapshot: SNAPSHOT, rows: ROW_IDS, cases, contractClaims };
writeFileSync(new URL('./evidence-fixtures.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
console.log(`cases ${cases.length}, fixtures ${cases.reduce((a, c) => a + c.fixtures.length, 0)}`);
