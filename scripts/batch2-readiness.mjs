#!/usr/bin/env node
// Batch 2 (#739) readiness inventory and 58-family disposition ledger.
//
// Reads the 58-family assignment (benchmarks/batch2/families.json), the observed external state
// (benchmarks/batch2/sources.json) and a credential-evidence checkout at the pinned commit, and writes
// evidence/739/readiness.{json,md} and evidence/739/ledger.json. It measures nothing and asserts no product
// output: a row is `ready` only when evidence has a reviewed contract that establishes the carrier layout.
//
//   node scripts/batch2-readiness.mjs --evidence-dir <credential-evidence checkout> [--out-dir evidence/739]
//
// Re-run after credential-evidence#235 progresses (update sources.json first if the pinned commit moves).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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

// Carrier layouts mentioned by a contract claim. Pattern hits are mentions in an unreviewed draft, never a
// reviewed layout: they only separate rows whose sources name a carrier from rows that establish existence.
const LAYOUTS = [
  ['authorization-header-bearer', /(authorization header[^.]*bearer|bearer[^.]*authorization header|as a bearer token|used as a bearer|passed as a bearer|bearer token on every)/i],
  ['authorization-header-apikey', /authorization header in the form apikey/i],
  ['authorization-header-basic', /(http basic|basic authorization header|basic authorization)/i],
  ['config-file', /(config file|global config)/i],
  ['request-or-response-field', /(oauth_token_secret|client_secret|access_token|refresh_token|request parameter|api field|write-only string)/i],
];
// Claims whose carrier-looking words do not describe where the secret value sits. A digest scheme is a
// wire hash, not the private key; an existence-level config mention names no field; x percent forms are tool leads.
const NOT_A_CARRIER = new Set(['digest-not-bearer', 'personal-access-key-exists', 'artifacts-bearer-leading-run-and-percent']);

// Rows whose evidence states a reason that is stronger than carrier presence. Each reason cites the contract
// claim or the owning issue; none of this is product policy.
const BLOCKS = {
  'x:app-only-bearer-token': {
    reason: 'representation-policy-undecided',
    detail: 'X states the Bearer Token is a byte array of unspecified format; the only percent-containing shape is a tool-corroborated lead (claim artifacts-bearer-leading-run-and-percent). Raw, serialized-escaped and percent forms have no source-established contract (redact-secret#1224 keeps them unassertable until policy is adopted).',
  },
  'mongodb-atlas:database-user-password': {
    reason: 'representation-policy-undecided',
    detail: 'The password is a caller-chosen write-only API field with no generated grammar (claims api-field, chosen-by-caller); user-specified passwords and percent encoding need explicit product-policy limits (redact-secret#1226).',
  },
};
const UNRESOLVED_NOTES = {
  'elastic:ece-api-key': 'ECE carrier is unconfirmed: the contract has only the lifecycle claim; redact-secret#1224 forbids reinterpreting it as Cloud ApiKey by name.',
  'hubspot:personal-access-key': 'The contract says the key is stored in a local global config file but names no config field; the exact HubSpot CLI config name is requested in #235 and redact-secret#1225.',
  'mongodb-atlas:programmatic-api-private-key': 'The private key is a Digest input; the wire header is a hash of it, not the key. The contract names no field or config slot that holds the plaintext key.',
  'jfrog:myjfrog-api-token': 'The contract establishes existence only; the MyJFrog header or field is not recorded (redact-secret#1225).',
};

const claimText = (c) => c.statement;
const rows = [];
for (const f of fams) {
  const [provider, name] = f.family.split(':');
  const contractPath = `records/contracts/${provider}/${name}@1.json`;
  const familyPath = `records/families/${provider}/${name}.json`;
  const reviewPath = `records/reviews/${provider}/${name}.json`;
  const have = (p) => existsSync(join(evidenceDir, p));
  const contract = have(contractPath) ? readJson(join(evidenceDir, contractPath)) : null;
  const family = have(familyPath) ? readJson(join(evidenceDir, familyPath)) : null;
  const review = have(reviewPath) ? readJson(join(evidenceDir, reviewPath)) : null;
  const claims = contract?.claims ?? [];
  const claimIds = claims.map((c) => c.id);
  const mentions = [];
  for (const c of claims) {
    if (NOT_A_CARRIER.has(c.id)) continue;
    for (const [layout, re] of LAYOUTS) if (re.test(claimText(c))) mentions.push({ claimId: c.id, layout });
  }
  const reviewedEvents = (review?.events ?? []).filter((e) => e.type !== 'authored');
  const siblingDir = join(evidenceDir, 'records/siblings', provider);
  const siblings = existsSync(siblingDir)
    ? readdirSync(siblingDir)
        .filter((n) => n.endsWith('.json'))
        .map((n) => readJson(join(siblingDir, n)))
        .filter((s) => (s.families ?? []).includes(f.family))
        .map((s) => ({ id: s.id, class: s.siblingClass }))
    : [];
  const reviewed =
    !!contract && contract.period !== 'proposed' && contract.lifecycle !== 'draft' && !!family?.currentContract && reviewedEvents.length > 0;
  const authoredCaseRefs = ['cases', 'fixtures', 'fixture-plans', 'scenarios', 'variants'].flatMap((d) => {
    const dir = join(evidenceDir, 'records', d);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((n) => n.endsWith('.json'))
      .filter((n) => readFileSync(join(dir, n), 'utf8').includes(`"${f.family}"`))
      .map((n) => `records/${d}/${n}`);
  });
  const mismatchedClaims = {
    missingFromContract: f.handoffClaimIds.filter((id) => !claimIds.includes(id)),
    notInHandoff: claimIds.filter((id) => !f.handoffClaimIds.includes(id)),
  };

  let status;
  let reason;
  let detail;
  if (reviewed && mentions.length) {
    status = 'ready';
    reason = 'reviewed-carrier';
    detail = 'Reviewed contract names a carrier layout.';
  } else if (BLOCKS[f.family]) {
    status = 'blocked';
    ({ reason, detail } = BLOCKS[f.family]);
  } else if (mentions.length) {
    status = 'blocked';
    reason = 'awaiting-evidence-review';
    detail = `The draft contract names a provider-documented carrier (${[...new Set(mentions.map((m) => m.layout))].join(', ')}) but it is proposed/draft, authored by an agent run and unreviewed; #235 posts no per-row ready status.`;
  } else {
    status = 'carrier-unresolved';
    reason = 'carrier-source-missing';
    detail =
      UNRESOLVED_NOTES[f.family] ??
      'The contract establishes existence/role/lifecycle only; no provider-documented header, field or config slot is recorded. Missing source: the provider page that names where the secret value is carried.';
  }
  rows.push({
    family: f.family,
    group: f.group,
    measurementIssue: f.measurementIssue,
    coreIssue: f.coreIssue,
    status,
    reason,
    detail,
    evidence: {
      contract: contract ? { path: contractPath, id: contract.id, revision: contract.revision, period: contract.period, lifecycle: contract.lifecycle } : null,
      familyLifecycle: family?.lifecycle ?? null,
      currentContract: family?.currentContract ?? null,
      researchState: family?.research?.state ?? null,
      reviewEvents: (review?.events ?? []).map((e) => e.type),
      reviewedByHuman: reviewedEvents.length > 0,
      handoffClaimIds: f.handoffClaimIds,
      claimIds,
      claimIdMismatch: mismatchedClaims,
      carrierMentions: mentions,
      openQuestionIds: (contract?.openQuestions ?? []).map((q) => q.id),
      publicSiblings: siblings,
      authoredCaseRecords: authoredCaseRefs,
    },
    productContractAdopted: false,
    independentBaseline: false,
  });
}

const count = (key) => {
  const out = {};
  for (const r of rows) {
    out[r.group] ??= { ready: 0, 'carrier-unresolved': 0, blocked: 0, total: 0 };
    out[r.group][r.status] += 1;
    out[r.group].total += 1;
  }
  const total = { ready: 0, 'carrier-unresolved': 0, blocked: 0, total: 0 };
  for (const g of Object.values(out)) for (const k of Object.keys(total)) total[k] += g[k];
  out.total = total;
  return out;
};
const counts = count();
if (counts.total.total !== 58) throw new Error('count mismatch');
const mismatches = rows.filter((r) => r.evidence.claimIdMismatch.missingFromContract.length || r.evidence.claimIdMismatch.notInHandoff.length);

const readiness = {
  schemaVersion: 1,
  kind: 'batch2-readiness-inventory',
  epic: 739,
  generatedBy: 'scripts/batch2-readiness.mjs',
  inputs: {
    assignment: 'benchmarks/batch2/families.json',
    observedState: 'benchmarks/batch2/sources.json',
    evidenceCommit: head,
    handoffIssue: 'redact-secret/credential-evidence#235',
  },
  rule:
    'ready = a reviewed (non-proposed, non-draft, adopted currentContract, human review event) evidence contract names the carrier layout; carrier-unresolved = no provider-documented carrier is recorded (missing source named); blocked = a carrier is mentioned only in an unreviewed draft, or the representation needs a product-policy decision. None of the classes counts as FN, TN or passing coverage.',
  productContractAdopted: sources.core.packages,
  counts,
  families: rows,
};

const ledgerRows = rows.map((r) => ({
  family: r.family,
  group: r.group,
  carrierContractRevision: r.evidence.contract ? `${r.evidence.contract.id} (${r.evidence.contract.period}, ${r.evidence.contract.lifecycle}, evidence ${head.slice(0, 8)})` : null,
  readiness: r.status,
  readinessReason: r.reason,
  caseIds: [],
  baseline: { identity: sources.baseline.publishedPin.version, integrity: sources.baseline.publishedPin.integrity, measured: false },
  candidate: { identity: null, measured: false, note: 'no candidate pinned: no ready row was measured, and the Batch 1 identity af1e71e0 is not proof for Batch 2' },
  surfaces: { 'node': 'not measured', wasm: 'not measured', python: 'not measured', rust: 'not measured', cli: 'not measured' },
  findings: null,
  overlapOutcome: 'not measured',
  streamParity: 'not measured',
  coverage: 'not-measured',
  gapIssue: null,
  unresolvedOrUnsupportedVariants: r.detail,
  coreIssueForRow: `redact-secret#${r.coreIssue}`,
}));
const ledger = {
  schemaVersion: 1,
  kind: 'batch2-disposition-ledger',
  epic: 739,
  complete: false,
  note: 'One entry per family. Rows are not measured until evidence marks the carrier reviewed and a baseline exists; nothing here is a false negative, true negative or passing coverage.',
  counts: { families: ledgerRows.length, measured: 0, notMeasured: ledgerRows.length },
  families: ledgerRows,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'readiness.json'), `${JSON.stringify(readiness, null, 2)}\n`);
writeFileSync(join(outDir, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);

const md = [];
md.push('# Batch 2 (#739) readiness inventory');
md.push('');
md.push(`Generated by \`scripts/batch2-readiness.mjs\` from credential-evidence \`${head}\` and \`benchmarks/batch2/*.json\`. Reproduce: \`node scripts/batch2-readiness.mjs --evidence-dir <checkout at the pin>\`.`);
md.push('');
md.push(readiness.rule);
md.push('');
md.push('## Counts');
md.push('');
md.push('| group | ready | carrier-unresolved | blocked | total |');
md.push('| --- | ---: | ---: | ---: | ---: |');
for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'total']) {
  const c = counts[g];
  md.push(`| ${g} | ${c.ready} | ${c['carrier-unresolved']} | ${c.blocked} | ${c.total} |`);
}
md.push('');
md.push('## Context for every row');
md.push('');
md.push(`- Product contract: not adopted. redact-secret#1223 to #1226 are open with 0 of 8 gates ticked; no \`docs/audits/evidence/<issue>/\` exists on core main (${sources.core.mainCommitObserved.slice(0, 8)}). Source-backed cases may be authored, but no intended output exists to freeze.`);
md.push(`- Independent baseline: none. The Batch 1 corpus covers five other families; published pin would be \`@redact-secret/core\` ${sources.baseline.publishedPin.version}.`);
md.push(`- Evidence handoff (#235): every row has a living proposed contract, all \`proposed\`/\`draft\` with \`currentContract: null\`, agent-authored, no human review event, no authored case or fixture records except the three Atlas public-sibling records. The handoff carries no per-row status.`);
md.push(`- Claim-ID check against the #235 table: ${mismatches.length} mismatching rows.`);
md.push('');
md.push('## Rows');
md.push('');
md.push('| family | group | status | reason | public siblings | detail |');
md.push('| --- | --- | --- | --- | --- | --- |');
for (const r of rows) md.push(`| \`${r.family}\` | ${r.group} | ${r.status} | ${r.reason} | ${r.evidence.publicSiblings.map((s) => s.id).join(', ') || '-'} | ${r.detail} |`);
md.push('');
writeFileSync(join(outDir, 'readiness.md'), md.join('\n'));
console.log(JSON.stringify(counts));
