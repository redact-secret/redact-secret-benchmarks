// Writes the generated, secret-free artifacts of the Group C corpus (#752):
//   corpus-index.json                 one row per corpus case: ids, expectation, text sha256 (never the text)
//   TRACEABILITY.md                   Case -> corpus cases and fixture -> replay case tables
//   FROZEN-group-c-errata-1.json.proposed   the errata-1 manifest PROPOSED for review (FROZEN-group-c.json, the original freeze, is never touched)
//   node benchmarks/group-c/build-artifacts.mjs
// It runs no scanner: it only generates the corpus text in memory and hashes it.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { AXES, cases, DOWNGRADES, CASE_CLAIMS, corpusDigest, CORPUS_VERSION, EVIDENCE, FAMILY_IDS, ISSUE, SCHEMA, SNAPSHOT, TYPE_BASIS } from './corpus-group-c.mjs';

const here = p => new URL(p, import.meta.url);
const sha = buf => createHash('sha256').update(buf).digest('hex');
const count = (list, key) => list.reduce((m, c) => { m[key(c)] = (m[key(c)] ?? 0) + 1; return m; }, {});

// ---- corpus-index.json ----
const index = cases.map(c => ({
  id: c.id, family: c.family, kind: c.kind, layout: c.layout, axes: c.axes, evidenceCase: c.evidenceCase, evidenceFixtures: c.evidenceFixtures, claims: c.claims,
  expected: c.expected, expectedExtra: c.expectedExtra, expectedType: c.expectedType, expectedAction: c.expectedAction, typeBasis: c.typeBasis,
  observedSpans: c.observedSpans, probeSpans: c.probeSpans, downgradedFrom: c.downgradedFrom, ruling: c.ruling, classExtension: c.classExtension,
  bytes: Buffer.byteLength(c.text), textSha256: sha(c.text),
}));
writeFileSync(here('./corpus-index.json'), `{"schema":"group-c-corpus-index-v1","issue":${ISSUE},"corpusSha256":"${corpusDigest()}","cases":[\n${index.map(r => JSON.stringify(r)).join(',\n')}\n]}\n`);

// ---- FROZEN proposal ----
const kinds = count(cases, c => c.kind);
const perFamily = {};
for (const f of FAMILY_IDS) perFamily[f] = count(cases.filter(c => c.family === f), c => c.kind);
const axes = {};
for (const [a, tests] of Object.entries(AXES)) axes[a] = { tests, cases: cases.filter(c => c.axes.includes(a)).length };
const uniq = list => new Set(list.map(c => c.text)).size;
const uniqueInputs = { total: uniq(cases), perFamily: {} };
for (const f of FAMILY_IDS) {
  uniqueInputs.perFamily[f] = {};
  for (const k of ['positive', 'control', 'unsupported']) uniqueInputs.perFamily[f][k] = uniq(cases.filter(c => c.family === f && c.kind === k));
}
const downgrades = {};
for (const c of cases.filter(x => x.ruling)) { downgrades[c.ruling] ??= { cases: 0, from: {} }; downgrades[c.ruling].cases += 1; downgrades[c.ruling].from[c.downgradedFrom] = (downgrades[c.ruling].from[c.downgradedFrom] ?? 0) + 1; }
const classExtension = {};
for (const c of cases.filter(x => x.classExtension)) classExtension[c.family] = (classExtension[c.family] ?? 0) + 1;
const frozen = {
  schema: 'group-c-frozen-corpus-v1',
  status: 'PROPOSED errata 1: a new digest, to be signed off by the reviewer before re-measurement; FROZEN-group-c.json (the original freeze) is not touched',
  errata: {
    id: 'errata-1',
    previousSha256: 'f216ca0a72c52d2b268924662d7f4ab66372c9820d0cfe386e3eefa0110dc37d',
    principle: 'a scored expectation must be supported by the evidence Case; a control built from a value whose confidentiality the Case and contract leave unresolved is observed-only',
    change: 'nine controls carry an OAuth code= authorization-code value (Adobe confidentiality unstated) and are downgraded to unsupported; text kept, downgradedFrom/ruling/rulingReason recorded; no other case changed',
    ids: cases.filter(c => c.ruling === 'errata-1').map(c => c.id),
  },
  issue: ISSUE,
  group: 'C',
  corpusVersion: CORPUS_VERSION,
  sha256: corpusDigest(),
  digestRule: 'sha256 of JSON.stringify(cases) where cases is the exported array of benchmarks/group-c/corpus-group-c.mjs (the Batch 2 rule: FROZEN-r2.json, corpusDigest())',
  cases: cases.length,
  positives: kinds.positive ?? 0,
  controls: kinds.control ?? 0,
  unsupported: kinds.unsupported ?? 0,
  conflict: kinds.conflict ?? 0,
  families: FAMILY_IDS.length,
  perFamily,
  uniqueInputs,
  uniqueInputsNote: 'cases are kept as authored, including several that share one input text (the same replayed fixture under three Adobe rows, repeated layouts); uniqueInputs counts distinct texts per row and kind',
  downgrades,
  downgradesNote: 'reviewer rulings C-B1..C-B4, A1, A5, A6: a scored expectation must be supported by the evidence Case, otherwise the entry stays as observed-only unsupported (never deleted); each downgraded case carries downgradedFrom, ruling and rulingReason',
  classExtensionControls: classExtension,
  axes,
  inputs: {
    generator: { file: 'benchmarks/group-c/corpus-group-c.mjs', sha256: sha(readFileSync(here('./corpus-group-c.mjs'))) },
    evidenceFixtures: { file: 'benchmarks/group-c/evidence-fixtures.json', sha256: sha(readFileSync(here('./evidence-fixtures.json'))) },
    batch2Generator: { file: 'benchmarks/batch2/corpus-r2.mjs', use: 'AXES only', sha256: sha(readFileSync(here('../batch2/corpus-r2.mjs'))) },
  },
  scorer: { file: 'benchmarks/batch2/score-r2.mjs', unchanged: true, sha256: sha(readFileSync(here('../batch2/score-r2.mjs'))), reexportedBy: 'benchmarks/group-c/score-group-c.mjs' },
  headlineMetrics: ['exact', 'fullyCovered'],
  conventionDerivedMetrics: ['typeOk', 'actionOk'],
  metricsNote: 'The frozen headline metrics are `exact` (span exactly the value) and `fullyCovered`. `typeOk` and `actionOk` are reported separately and are convention-derived (Batch 2 carrier convention, see typeBasis), not Case-derived; `pass` (exact and type and action) is reported but is not a headline.',
  policyClassTolerance: 'Policy-class tolerance cannot be expressed: every must-flag Case is basis project-policy ("treated as a credential whatever its shape"), and the Batch 2 scorer has no policy or basis dimension and no tolerance. Nothing here is a tolerance; the scorer is unchanged.',
  observationSchema: SCHEMA,
  expectationSources: { evidence: SNAPSHOT, rule: 'must-flag -> positive (exact value span); must-not-flag -> control (no finding); not-assertable -> unsupported (observed only, never scored)' },
  typeBasis: TYPE_BASIS,
  frozenBeforeAnyScan: true,
  frozenBeforeAnyScanNote: 'asserted by the author: no scanner, CLI or product build was run, and no product repository, Batch 2 observation or ledger was read while authoring',
};
writeFileSync(here('./FROZEN-group-c-errata-1.json.proposed'), `${JSON.stringify(frozen, null, 2)}\n`);

// ---- TRACEABILITY.md ----
const md = [];
md.push('# Group C corpus traceability (#752)', '');
md.push(`Generated by \`node benchmarks/group-c/build-artifacts.mjs\`; do not edit by hand. Corpus sha256 \`${corpusDigest()}\` (${cases.length} cases). Evidence: \`${SNAPSHOT.repo}\` tag \`${SNAPSHOT.tag}\` (${SNAPSHOT.commit}).`, '');
md.push('Rule: a Case outcome `must-flag` becomes `positive` (exact value span, the Case\'s span roles), `must-not-flag` becomes `control` (no finding), `not-assertable` becomes `unsupported` (observed, never scored). Every corpus case names its Case (`evidenceCase`), the stored fixtures that exhibit the same layout (`evidenceFixtures`) and the contract claims the Case cites; `corpus-index.json` carries that per corpus case id.', '');
md.push('## 1. Case to corpus cases', '');
md.push('| Case | outcome (basis) | rows (role) | claims cited | provider sources | stored fixtures | corpus cases (positive / control / unsupported) |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const c of EVIDENCE.cases) {
  const mine = cases.filter(x => x.evidenceCase === c.id);
  const k = count(mine, x => x.kind);
  const rows = c.families.filter(f => FAMILY_IDS.includes(f.family)).map(f => `${f.family} (${f.role})`).join('<br>');
  md.push(`| \`${c.id}\` | ${c.outcome} (${c.basis}) | ${rows} | ${(CASE_CLAIMS[c.id] ?? []).map(x => `\`${x}\``).join(', ')} | ${c.sourceIds.map(x => `\`${x}\``).join(', ')} | ${c.fixtures.length} | ${k.positive ?? 0} / ${k.control ?? 0} / ${k.unsupported ?? 0} |`);
}
md.push('', '## 2. Stored fixture to replay case', '');
md.push('Every stored fixture is replayed verbatim for each Group C row its Case names (a `must-flag` Case asserts the `subject` row only). Spans are the fixture\'s own.', '');
md.push('| fixture | Case | replayed as (corpus case ids) | kind |', '| --- | --- | --- | --- |');
for (const c of EVIDENCE.cases) for (const fx of c.fixtures) {
  const mine = cases.filter(x => x.evidenceFixtures.includes(fx.id) && x.axes.includes('fixture-replay'));
  md.push(`| \`${fx.id}\` | \`${c.id}\` | ${mine.length ? mine.map(x => `\`${x.id}\``).join('<br>') : '(not replayed: companion row of a must-flag Case)'} | ${[...new Set(mine.map(x => x.kind))].join(', ')} |`);
}
md.push('', '## 3. Runtime-assembled vendor-shape probes (unscored)', '');
md.push('The Cases state that vendor-prefix-shaped probes were not stored (push protection). The generator assembles them from parts as `unsupported` entries with the `vendor-probe` axis; they are never an expectation.', '');
md.push('| corpus case id | Case | shape |', '| --- | --- | --- |');
for (const c of cases.filter(x => x.axes.includes('vendor-probe'))) md.push(`| \`${c.id}\` | \`${c.evidenceCase}\` | ${c.note} |`);
md.push('', '## 4. Expectations the Batch 2 scorer cannot express (listed, not hacked)', '');
md.push(
  '1. Policy class. Every must-flag Case is `basis: project-policy` ("treated as a credential whatever its shape"); the scorer has no policy/basis dimension, so these score as ordinary exact-span positives and the basis is carried only in this table and `corpus-index.json`.',
  '2. Type and action. The Cases assert no type or action. The scorer requires them, so Batch 2\'s carrier convention is carried (Bearer value -> `bearer_token`, Basic envelope -> `authorization_credential`, named field or member value -> `contextual_secret`, action `redact`). X-JFrog-Art-Api, the `curl -u` password and the pipe-joined `access_token` secret have no Batch 2 type and default to `contextual_secret` (`typeBasis: assumed-generic-default`). `summarize` reports `exact`, `typeOk` and `actionOk` separately, so span results are readable without the type assumption.',
  '3. "No subtype is inferred / generic attribution". The Cases say provider attribution is not asserted; the scorer compares the generic type only and cannot require that attribution be absent beyond a type mismatch.',
  '4. Not-assertable outcomes. They are observed and counted (`unsupported`), never right or wrong; the scorer cannot express "either answer is acceptable" beyond that.',
  '5. Companion rows. `jfrog:api-key`, `meta:app-access-token` and `meta:instagram-app-secret` appear in some Cases as companions; no span is asserted for them and they are not Group C rows.',
  '6. Open questions the Cases leave out of scope (Basic decoded form, `redactedValue`, `org_id` and `id_token` confidentiality, `oauth_consumer_key` status) have no expectation of either kind. `org_id` appears as a neighbour inside positives only; the enterprise controls carry no `org_id` (reviewer C-B4), and the one stored control that did (the angle-placeholder fixture, three Adobe rows) is downgraded to `unsupported` (A6).',
  '7. Not authored because no Case supports them: the Batch 2 contract-derived controls and unsupported variants (suffix-glued names, below-floor values, lower-case or prefixed names, low-entropy `warn` literals, YAML/env layouts the Cases do not name). Adding any of them would take an expectation from the product contract rather than from the evidence Case.',
  '',
);
md.push('## 5. Rows without a positive', '');
md.push('`x:oauth1-consumer-secret` has no must-flag Case (its subject Case is not-assertable), so it carries controls and unsupported entries only. Every other row has positives, controls and unsupported entries.', '');
md.push('', '## 6. Reviewer rulings applied (blind review, APPROVE WITH ERRATA)', '');
md.push('Principle: a scored expectation must be supported by the evidence Case; otherwise the entry is observed-only `unsupported`, never deleted. A downgraded case keeps its text, changes kind (and so the id suffix) and records `downgradedFrom`, `ruling`, `rulingReason` in `corpus-index.json`.', '');
md.push('| ruling | downgraded cases | from | reason |', '| --- | --- | --- | --- |');
for (const [r, d] of Object.entries(downgrades).sort()) {
  const reasons = [...new Set(DOWNGRADES.filter(x => x[0] === r).map(x => x[4]))].join('; ');
  md.push(`| ${r} | ${d.cases} | ${Object.entries(d.from).map(([k, n]) => `${n} ${k}`).join(', ')} | ${reasons} |`);
}
md.push('', 'C-B3 (generated controls) and C-B4 are corrections in place: the Meta `client_secret` and pipe controls use the documented templates `{your-app_id}` instead of a numeric app ID, and the enterprise form controls carry no `org_id`.', '');
md.push('| downgraded corpus case id | ruling | from |', '| --- | --- | --- |');
for (const c of cases.filter(x => x.ruling)) md.push(`| \`${c.id}\` | ${c.ruling} | ${c.downgradedFrom} |`);
md.push('', '## 7. Unique inputs (A10)', '');
md.push('Cases are kept as authored; several share one input text. Distinct texts per row and kind, beside the totals (positive / control / unsupported):', '');
md.push('| row | cases | unique inputs |', '| --- | --- | --- |');
for (const f of FAMILY_IDS) { const t = perFamily[f]; const u = uniqueInputs.perFamily[f]; md.push(`| ${f} | ${t.positive ?? 0} / ${t.control ?? 0} / ${t.unsupported ?? 0} | ${u.positive} / ${u.control} / ${u.unsupported} |`); }
md.push('', `Total cases ${cases.length}, unique inputs ${uniqueInputs.total}.`, '');
md.push('## 8. Class-extension controls (A13)', '');
md.push('Tagged by construction (never by text): generated benign-value controls whose value is a mask (`********`), a `${ENV}` reference, a `{{ template }}` reference, an `XXXXXX` run, an `<angle>` placeholder or a `{brace}` placeholder. They extend the Case-listed non-value categories to more carrier layouts than the Case names. Not tagged: verbatim fixture replays, square-bracket placeholders such as `[YOUR_TOKEN]`, bare schemes, prose, empty values and the provider-published CFPAT placeholders. Tagged `classExtension: true` in `corpus-index.json`. Counts per row: ' + Object.entries(classExtension).map(([f, n]) => `${f} ${n}`).join('; ') + '.', '');
md.push('| class-extension control ids |', '| --- |');
for (const c of cases.filter(x => x.classExtension)) md.push(`| \`${c.id}\` |`);
md.push('');
writeFileSync(here('./TRACEABILITY.md'), `${md.join('\n')}\n`);
console.log(JSON.stringify({ cases: cases.length, kinds, sha256: corpusDigest() }));
