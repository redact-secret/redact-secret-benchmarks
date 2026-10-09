#!/usr/bin/env node
import { measurementOutput, writeMeasurement } from '../../../scripts/lib/measurement-output.mjs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
// Group D (#753): writes the generated corpus, the traceability table and the proposed (not frozen) digest file.
//   node benchmarks/corpora/protocol-credentials/generate.mjs [--check] [--corpus-out <path>]
// It runs no scanner. --check fails when a committed output differs from what the generator produces.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { AXES, cases, corpusDigest, partDigest, PARTS, FAMILY_IDS, ROWS, EVIDENCE, ISSUE, CORPUS_VERSION, SCHEMA, SCORER, CONTRADICTIONS, EVIDENCE_INPUTS } from './corpus-group-d.mjs';

const dir = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);
const sha = (p) => createHash('sha256').update(readFileSync(new URL(p, root))).digest('hex');
const KINDS = ['positive', 'control', 'unsupported', 'conflict'];

const count = (list) => Object.fromEntries(KINDS.map((k) => [k, list.filter((c) => c.kind === k).length]));
const groupC = (c) => c.trace.sharedWithGroupC;
const uniq = (list) => new Set(list.map((c) => c.text)).size;
const uniqueBy = (list) => Object.fromEntries(KINDS.map((k) => [k, uniq(list.filter((c) => c.kind === k))]));
const perRow = Object.fromEntries(FAMILY_IDS.map((f) => {
  const ownAll = cases.filter((c) => c.family === f);
  const own = ownAll.filter((c) => !groupC(c));
  const shared = cases.filter((c) => c.family !== f && c.trace.sharedWith?.includes(f));
  return [f, { ...count(own), positivesSharedWithGroupC: ownAll.filter((c) => groupC(c) && c.kind === 'positive').length, controlsSharedWithGroupC: ownAll.filter((c) => groupC(c) && c.kind === 'control').length, uniqueInputs: uniqueBy(own), sharedControlsFromOtherRows: shared.length, scored: ownAll.some((c) => c.kind === 'positive') }];
}));
const axisCounts = Object.fromEntries(Object.keys(AXES).map((a) => [a, { tests: AXES[a], cases: cases.filter((c) => c.axes.includes(a)).length }]));

export const INEXPRESSIBLE = [
  'Finding type and action: the Cases state an outcome (must-flag / must-not-flag) and span roles, never a type or an action, so expectedType and expectedAction are null and the Batch 2 `pass` flag is false by construction. Read exact, fullyCovered, misses, over/under/partial (positives) and controlFlagged (controls).',
  'Policy-class tolerance (may-flag, either behaviour acceptable): no Case states one and the corpus cannot carry it (ADR 0021, ADR 0023). Every policy-limited and carrier-unresolved row is `unsupported`, observed and never scored.',
  'Role or family attribution: an observation has a type and a detector but no family, so "the header does not identify the role; no subtype is inferred" and the endpoint-conditional admin attribution of algolia:admin-api-key cannot be scored. Only the span of the create-key request is expressed.',
  'Per-span must-not-flag inside a document that also has a must-flag span (the app ID before the pipe, the id member of a cross-cluster response, the application ID header): only the positive span is scored, so a finding on the sibling is seen as over/partial overlap or not at all.',
  'Layout-identical cases whose role differs (app-ID|client-token versus app-ID|secret): expressible only as an observed probe; the contract says the client-token layout is not secret and the layout cannot tell them apart.',
  'The cross-field consistency of encoded = base64(id:api_key) in a cross-cluster response: both spans are scored independently.',
  'Policy-class tolerance is inexpressible: the scorer has no may-flag, accept-either or severity-tolerance outcome, and the snapshot cannot carry one (ADR 0021, ADR 0023); no scored expectation in this corpus depends on one.',
  'Observation parity of a repeated value across carriers (the same secret in two documents) and the nine rows\' stream-cut behaviour beyond what the Batch 2 stream observation already measures.',
];
export const INTERPRETATIONS = [
  'I1 Eight fixtures are `conflict` (observed, never scored): the seven fixtures of the five contradictions the Group D author listed, plus meta-authored--app-pair-lookalike-generation-call-placeholder, which holds the same app-ID literal (client_id) beside a placeholder secret as the listed masked-secret fixture and has the same defect.',
  'I2 A vendor-prefix shape beyond a Case\'s own fixtures (the Figma personal-token prefix, the Dropbox user-token prefix, the legacy HubSpot private-app prefix, JWT shapes for JFrog and Zoom) is assembled at run time and only observed. The Figma Case\'s own five fixtures keep their Figma-prefixed values (assembled from a {{figd_}} marker at run time) and stay scored, because that Case flags a value after X-Figma-Token whatever its shape.',
  'I3 The Case fixtures are reproduced verbatim as scored cases (layout fixture-*), then widened with generated variants. Generated positives vary the value shape (12, 40, 96 bytes, hex, punctuated, marker form) only where the Case says the value is admitted by its slot; the one 32-hexadecimal Algolia example the Case names as role-unattributed is not the primary shape.',
  'I4 A generated carrier is scored only if the Case names it (raw request, curl -H, JSON header map, form body, query, response JSON members, the pair in a query) or is a delimiter/offset/nesting variant of one; YAML, environment-variable, configuration and other renderings of the same slot are observed.',
  'I5 Controls use only the non-value categories a Case lists (angle placeholder, environment or template reference, mask, empty value, bare scheme, prose, documented placeholder, the public identifiers the Case names) and never an identifier literal with unresolved confidentiality (app IDs, Algolia application ID, Dropbox app key, space and environment IDs, token ids). The Algolia and Contentful control Cases are shared by several rows; the control cases are attached to the first row of the Case with sharedWith listing the others.',
  'I6 Null, undefined, percent-encoded values, upper-cased names, prefixed names and below-floor values are observed (no Case asserts them), mirroring Batch 2 round 2\'s `unsupported` class.',
  'I7 expectedType and expectedAction are null (see the first inexpressible item); the corpus test therefore does not require them, unlike Batch 2 round 2.',
  'I8 The evidence snapshot pinned is the tag snapshot-2026.10.06.5 (commit 574b52ba367e2071d5a9bea3e2da7a9c5057f633); evidence-inputs.json is the extraction of its Cases and fixtures for the 23 rows plus the two adjacent Cases named by the handoff.',
];

// traceability
const short = (id) => id.replace(/^[a-z0-9-]+?--/, '');
const trace = cases.map((c) => ({ case: c.id, family: c.family, kind: c.kind, evidenceCase: c.trace.caseId, caseOutcome: c.trace.caseOutcome, fixtureIds: c.trace.fixtureIds, claims: c.claims, clause: c.trace.clause, source: c.trace.source, ...(c.trace.downgraded ? { downgraded: true, downgradedFrom: c.trace.downgradedFrom, ruling: c.trace.ruling } : {}), ...(c.trace.sharedWithGroupC ? { sharedWithGroupC: c.trace.sharedWithGroupC } : {}), ...(c.trace.sharedWith ? { sharedWith: c.trace.sharedWith } : {}), ...(c.trace.observedReason ? { observedReason: c.trace.observedReason } : {}) }));
let md = `# Group D traceability (#753)\n\nGenerated by \`node benchmarks/corpora/protocol-credentials/generate.mjs\`; do not edit. Each row: test case id, kind, evidence Case (outcome), evidence fixture id(s) the case is the fixture itself or is derived from, contract claim ids (the Group D readiness inventory row) and the clause of the Case it rests on. Evidence: \`${EVIDENCE.repo}\` tag \`${EVIDENCE.tag}\` (${EVIDENCE.commit.slice(0, 12)}). Algolia note (A11): the pasted \`index-name-json\` control body is the Case fixture's body verbatim and is left as is. Group C note (A14): \`meta:app-access-token\` positives come from a Case where the family is a companion; 8 of them (3 positives, 5 controls) are byte-identical to Group C replays and are marked \`sharedWithGroupC: meta:app-secret\`, scored once and excluded from per-row totals; the other positives are Group D inputs. Unique inputs (distinct text) per row and kind are in FROZEN-group-d.json.proposed. A \`fixture\` source row is the fixture verbatim; a \`generated\` row is a variant of that Case's layouts. Kinds: positive and control are scored; unsupported and conflict are observed only.\n`;
for (const f of FAMILY_IDS) {
  const rows = trace.filter((t) => t.family === f);
  const r = perRow[f];
  md += `\n## \`${f}\` (${r.scored ? 'scored' : 'observed-only'}; positive ${r.positive}${r.positivesSharedWithGroupC ? ` (+${r.positivesSharedWithGroupC} shared with Group C)` : ''}, control ${r.control}, unsupported ${r.unsupported}, conflict ${r.conflict}; unique inputs ${KINDS.map((k) => `${k} ${r.uniqueInputs[k]}`).join(', ')}${r.sharedControlsFromOtherRows ? `; plus ${r.sharedControlsFromOtherRows} shared controls attached to another row` : ''})\n\nClaims: ${ROWS[f].claims.map((x) => `\`${x}\``).join(', ')}\n\n| case | kind | evidence Case (outcome) | fixture id(s) | clause |\n| --- | --- | --- | --- | --- |\n`;
  for (const t of rows) md += `| \`${t.case.slice(f.length + 4)}\` | ${t.kind}${t.source === 'fixture' ? ' (fixture)' : ''} | \`${t.evidenceCase}\` (${t.caseOutcome}) | ${t.fixtureIds.length > 3 ? `${t.fixtureIds.slice(0, 3).map((x) => `\`${short(x)}\``).join(', ')} +${t.fixtureIds.length - 3}` : t.fixtureIds.map((x) => `\`${short(x)}\``).join(', ')} | ${t.clause.replace(/\|/g, '/')} |\n`;
}

const proposed = {
  schema: 'group-d-frozen-corpus-v1',
  status: 'proposed',
  frozen: false,
  note: 'Proposal only. Not frozen: freezing needs a maintainer decision after review of the corpus. Rename to FROZEN-group-d.json (set frozen true, frozenBeforeAnyScan true) at that time.',
  issue: ISSUE,
  corpusVersion: CORPUS_VERSION,
  observationSchema: SCHEMA,
  sha256: corpusDigest(),
  digestMethod: 'sha256 of JSON.stringify(cases) as exported by benchmarks/corpora/protocol-credentials/corpus-group-d.mjs',
  cases: cases.length,
  kinds: count(cases),
  kindsExcludingSharedWithGroupC: count(cases.filter((c) => !groupC(c))),
  positivesSharedWithGroupC: { count: cases.filter(groupC).filter((c) => c.kind === 'positive').length, controls: cases.filter(groupC).filter((c) => c.kind === 'control').length, ids: cases.filter(groupC).map((c) => c.id), family: 'meta:app-access-token', groupCFamily: 'meta:app-secret', note: 'only the byte-identical cases are flagged (3 positives, 5 controls, see SHARED_WITH_GROUP_C); the other meta:app-access-token positives are Group D inputs and stay in D totals' },
  policyClassTolerance: 'inexpressible: no may-flag or accept-either outcome exists in the scorer or the snapshot; policy-limited and carrier-unresolved rows are observed only (unsupported), never scored',
  uniqueInputs: { total: uniq(cases), duplicatesWithinCorpus: cases.length - uniq(cases), byKind: uniqueBy(cases) },
  errata: ['D-B1 algolia admin positives carry the create-key request context', 'D-B2 cross-cluster repeat-response-and-log and yaml-response downgraded to unsupported', 'A3 instagram curl-data, curl-data-single, long-lived-url-fragment and meta pair html-href, url-fragment downgraded to unsupported', 'A13 bullet-mask and template variants tagged class-extension', 'A14/D-F2 sharedWithGroupC set only on the 8 byte-identical cases (3 positives, 5 controls)', 'D-F1 downgraded cases carry downgraded, downgradedFrom and ruling'],
  parts: Object.fromEntries(PARTS.map((p) => [p, { sha256: partDigest(p), cases: cases.filter((c) => c.part === p).length, ...count(cases.filter((c) => c.part === p)), families: new Set(cases.filter((c) => c.part === p).map((c) => c.family)).size }])),
  perRow,
  observedOnlyRows: FAMILY_IDS.filter((f) => !perRow[f].scored),
  axes: axisCounts,
  scorer: { file: SCORER, sha256: sha(SCORER), baseScorer: 'benchmarks/harness/credential-carriers/score.mjs', baseScorerSha256: sha('benchmarks/harness/credential-carriers/score.mjs'), changed: false },
  expectationSources: { evidence: EVIDENCE, evidenceInputs: { file: 'benchmarks/corpora/protocol-credentials/evidence-inputs.json', sha256: sha('benchmarks/corpora/protocol-credentials/evidence-inputs.json'), cases: EVIDENCE_INPUTS.cases.length, fixtures: EVIDENCE_INPUTS.fixtures.length }, contradictions: Object.keys(CONTRADICTIONS) },
  inexpressibleExpectations: INEXPRESSIBLE,
  interpretations: INTERPRETATIONS,
};

// The expanded corpus (scanner-shaped synthetic values) is deliberately not committed: secret scanners and push protection
// flag it. `--corpus-out <path>` writes it for a consumer; the committed digest below identifies it.
const corpusOut = process.argv.includes('--corpus-out') ? process.argv[process.argv.indexOf('--corpus-out') + 1] : null;
if (corpusOut) writeMeasurement(measurementOutput(corpusOut, fileURLToPath(root)), `${JSON.stringify({ schema: 'group-d-corpus-v1', issue: ISSUE, corpusVersion: CORPUS_VERSION, sha256: corpusDigest(), cases }, null, 1)}\n`);
const outputs = [
  ['traceability.json', `${JSON.stringify({ schema: 'group-d-traceability-v1', evidence: EVIDENCE, rows: trace }, null, 1)}\n`],
];
const check = process.argv.includes('--check');
const outputArg = process.argv.indexOf('--out');
if (!check && outputArg < 0) throw new Error('Provide --out results-output/<fresh-corpus-artifacts> or --check');
const output = check ? null : measurementOutput(process.argv[outputArg + 1], fileURLToPath(root), { directory: true });
let bad = 0;
for (const [name, body] of outputs) {
  const url = new URL(name, dir);
  if (check) { if (!existsSync(url) || readFileSync(url, 'utf8') !== body) { console.error(`stale: ${name}`); bad += 1; } } else writeMeasurement(join(output, name), body);
}
if (check && bad) process.exit(1);
console.log(`${cases.length} cases, sha256 ${corpusDigest()}`);
