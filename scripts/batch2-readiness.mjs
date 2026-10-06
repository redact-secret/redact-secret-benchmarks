#!/usr/bin/env node
// Batch 2 (#739) readiness inventory and 58-family disposition ledger.
//
// Reads the 58-family assignment (benchmarks/batch2/families.json), the observed external state
// (benchmarks/batch2/sources.json) and a credential-evidence checkout at the pinned commit, and writes
// evidence/739/readiness.{json,md}. The ledger is written by scripts/report-batch2.mjs after measurement. It measures nothing and asserts no product
// output: a row is `ready` only when evidence has a reviewed contract that establishes the carrier layout.
//
//   node scripts/batch2-readiness.mjs --evidence-dir <credential-evidence checkout> [--out-dir evidence/739]
//
// Re-run after credential-evidence#235 progresses (update sources.json first if the pinned commit moves).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const evidenceDir = opt('evidence-dir', process.env.CREDENTIAL_EVIDENCE_DIR);
const outDir = resolve(ROOT, opt('out-dir', 'evidence/739'));
if (!evidenceDir) {
  console.error('usage: batch2-readiness.mjs --evidence-dir <credential-evidence checkout>');
  process.exit(2);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const assignment = readJson(join(ROOT, 'benchmarks/batch2/families.json'));
const sources = readJson(join(ROOT, 'benchmarks/batch2/sources.json'));

const head = execFileSync('git', ['-C', evidenceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== sources.evidence.commit) {
  console.error(`evidence checkout is at ${head}, sources.json pins ${sources.evidence.commit}; check out the pin or update sources.json`);
  process.exit(2);
}

// Assignment invariants: exactly 58 unique families, group sizes as recorded in #739.
const fams = assignment.families;
const unique = new Set(fams.map((f) => f.family));
if (fams.length !== 58 || unique.size !== 58) throw new Error(`expected 58 unique families, got ${fams.length}/${unique.size}`);
for (const [g, meta] of Object.entries(assignment.groups)) {
  const n = fams.filter((f) => f.group === g).length;
  if (n !== meta.expected) throw new Error(`${g}: ${n} families, expected ${meta.expected}`);
}

// The ready / carrier-unresolved flag is evidence's (docs/handoffs/batch-2-bounded-carriers.md, credential-evidence#235),
// not a benchmark judgment. The script parses that table; it never infers a carrier from claim text.
const handoffPath = join(evidenceDir, 'docs/handoffs/batch-2-bounded-carriers.md');
const handoffText = readFileSync(handoffPath, 'utf8');
const handoff = new Map();
for (const line of handoffText.split('\n')) {
  if (!/^\| `[^`]+` \|/.test(line)) continue;
  const c = line.split('|').slice(1, -1).map((x) => x.trim());
  if (c.length !== 7) throw new Error(`handoff row has ${c.length} cells: ${line.slice(0, 60)}`);
  handoff.set(c[0].replace(/`/g, ''), {
    status: c[1].split(/[ (]/)[0],
    statusNote: c[1],
    researchDoc: (c[1].match(/\(([^)]*\.md)\)/) ?? [])[1] ?? null,
    slot: c[2],
    publicLookalikes: c[3],
    claimIds: c[4].split(',').map((x) => x.trim()),
    contractSha12: c[5].replace(/`/g, ''),
    followUp: c[6],
  });
}
if (handoff.size !== 58) throw new Error(`handoff table has ${handoff.size} rows`);

const rows = [];
for (const f of fams) {
  const h = handoff.get(f.family);
  if (!h) throw new Error(`no handoff row for ${f.family}`);
  if (!['ready', 'carrier-unresolved'].includes(h.status)) throw new Error(`unknown handoff status ${h.status}`);
  const [provider, name] = f.family.split(':');
  const contractPath = `records/contracts/${provider}/${name}@1.json`;
  const contract = existsSync(join(evidenceDir, contractPath)) ? readFileSync(join(evidenceDir, contractPath)) : null;
  const sha = contract ? createHash('sha256').update(contract).digest('hex') : null;
  const parsed = contract ? JSON.parse(contract) : null;
  const claimIds = (parsed?.claims ?? []).map((c) => c.id);
  rows.push({
    family: f.family,
    group: f.group,
    measurementIssue: f.measurementIssue,
    coreIssue: f.coreIssue,
    // Evidence's status. A ready row still has no adopted product contract (core #1223-#1226 are open).
    status: h.status,
    statusNote: h.statusNote,
    researchDoc: h.researchDoc,
    handoff: { slot: h.slot, publicLookalikes: h.publicLookalikes, claimIds: h.claimIds, followUp: h.followUp === 'none' ? null : h.followUp },
    contract: {
      path: contractPath,
      period: parsed?.period ?? null,
      lifecycle: parsed?.lifecycle ?? null,
      frozenSha12InHandoff: h.contractSha12,
      sha12AtEvidenceCommit: sha?.slice(0, 12) ?? null,
      unchangedSinceHandoff: sha ? sha.startsWith(h.contractSha12) : false,
      claimIdsMatchHandoff: JSON.stringify([...claimIds].sort()) === JSON.stringify([...h.claimIds].sort()),
    },
    productContractAdopted: false,
    independentBaseline: false,
    expectationBasis: h.status === 'ready' ? 'source-established slot only (handoff row and contract claims); no adopted product contract, so no action or finding type is asserted' : null,
  });
}

const counts = {};
for (const g of Object.keys(assignment.groups)) {
  const sub = rows.filter((r) => r.group === g);
  counts[g] = { ready: sub.filter((r) => r.status === 'ready').length, 'carrier-unresolved': sub.filter((r) => r.status === 'carrier-unresolved').length, total: sub.length };
}
counts.total = { ready: 0, 'carrier-unresolved': 0, total: 0 };
for (const g of Object.keys(assignment.groups)) for (const k of Object.keys(counts.total)) counts.total[k] += counts[g][k];
if (counts.total.total !== 58 || counts.total.ready + counts.total['carrier-unresolved'] !== 58) throw new Error('count mismatch');

const readiness = {
  schemaVersion: 2,
  kind: 'batch2-readiness-inventory',
  epic: 739,
  generatedBy: 'scripts/batch2-readiness.mjs',
  inputs: {
    assignment: 'benchmarks/batch2/families.json',
    observedState: 'benchmarks/batch2/sources.json',
    evidenceCommit: head,
    handoff: 'credential-evidence docs/handoffs/batch-2-bounded-carriers.md (issue #235)',
  },
  rule:
    'ready / carrier-unresolved is evidence\'s status from the reviewed handoff, copied verbatim. A ready row means the existing provider-documented claims name the carrier; it is not a product contract. Core #1223-#1226 are open, so no row has an adopted product contract: expectations come only from the handoff slot. carrier-unresolved is not a false negative, true negative or passing coverage.',
  productContractAdopted: sources.core.packages,
  counts,
  families: rows,
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'readiness.json'), `${JSON.stringify(readiness, null, 2)}\n`);

const stale = rows.filter((r) => !r.contract.unchangedSinceHandoff).map((r) => r.family);
const md = [];
md.push('# Batch 2 (#739) readiness inventory');
md.push('');
md.push(`Generated by \`scripts/batch2-readiness.mjs\` from credential-evidence \`${head}\` (handoff \`docs/handoffs/batch-2-bounded-carriers.md\`) and \`benchmarks/batch2/*.json\`. Reproduce: \`node scripts/batch2-readiness.mjs --evidence-dir <checkout at the pin>\`.`);
md.push('');
md.push(readiness.rule);
md.push('');
md.push('## Counts');
md.push('');
md.push('| group | ready | carrier-unresolved | total |');
md.push('| --- | ---: | ---: | ---: |');
for (const g of [...Object.keys(assignment.groups), 'total']) md.push(`| ${g} | ${counts[g].ready} | ${counts[g]['carrier-unresolved']} | ${counts[g].total} |`);
md.push('');
md.push(`- Product contract: none adopted; redact-secret#1223 to #1226 are open with 0 of 8 gates ticked (core main ${sources.core.mainCommitObserved.slice(0, 8)}).`);
md.push('- Independent baseline: none existed for these rows before this work; Batch 2 builds one from the handoff slots (benchmarks/batch2/corpus.mjs).');
md.push(`- Contract drift since the handoff froze its digests: ${stale.length ? stale.join(', ') : 'none (every contract sha256 prefix matches)'}; claim IDs differing from the handoff: ${rows.filter((r) => !r.contract.claimIdsMatchHandoff).length}.`);
md.push('');
md.push('## Rows');
md.push('');
md.push('| family | group | status | slot established (handoff) | follow-up source when unresolved |');
md.push('| --- | --- | --- | --- | --- |');
for (const r of rows) md.push(`| \`${r.family}\` | ${r.group} | ${r.status} | ${r.handoff.slot} | ${r.handoff.followUp ?? '-'} |`);
md.push('');
writeFileSync(join(outDir, 'readiness.md'), md.join('\n'));
console.log(JSON.stringify(counts));
