import { measurementOutput, writeMeasurement } from '../../../scripts/lib/measurement-output.mjs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
// Group E (#754) derived artifacts: the traceability table and the PROPOSED freeze. Pure: reads corpus-e.mjs only, runs no scanner.
//   node benchmarks/corpora/session-material/build-artifacts.mjs          write traceability-group-e.json, TRACEABILITY.md, FROZEN-group-e.json.proposed
//   node benchmarks/corpora/session-material/build-artifacts.mjs --check  fail when a committed artifact differs from what the generator produces
// The freeze is a proposal: nothing here freezes the corpus. Freezing is the owner's step (rename the .proposed file after review).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { AXES, CLAIMS, EVIDENCE, FAMILY_IDS, INEXPRESSIBLE, ISSUE, SCHEMA, cases, clauseOf, corpusDigest, counts } from './corpus-e.mjs';

const here = name => new URL(`./${name}`, import.meta.url);
const sha = s => createHash('sha256').update(s).digest('hex');
const rowDigest = f => sha(JSON.stringify(cases.filter(c => c.family === f)));

const GITLEAKS_NOTES = [
  ['curl-auth-user', 'benchmarks/corpora/session-material/evidence-group-e.json:1187', 'the evidence fixture `jfrog-authored--api-key-curl-basic-password`: `curl -u example-user:SYNTHETICJFrogApiKeyNeverIssued0003`'],
  ['jwt', 'benchmarks/corpora/session-material/evidence-group-e.json:810', 'the evidence fixture `adobe-authored--jwt-token-form-body`: a JWT-shaped `jwt_token` whose payload is the SYNTHETIC identifiers and whose signature is a never-issued literal'],
  ['jwt', 'benchmarks/corpora/session-material/evidence-group-e.json:819', 'the evidence fixture `adobe-authored--jwt-token-curl-form-argument`: the same synthetic JWT-shaped value'],
  ['curl-auth-header', 'benchmarks/corpora/session-material/corpus-e.mjs:587', 'generator template for the Reddit control `bearer-template-word-curl`: `curl -H "Authorization: bearer TOKEN"`, the documentation template word'],
  ['curl-auth-user', 'benchmarks/corpora/session-material/corpus-e.mjs:562', 'generator template `curl -H "X-JFrog-Art-Api: ` + a run-time filler value (downgraded case `header-mixed-case-name-curl`)'],
  ['curl-auth-user', 'benchmarks/corpora/session-material/corpus-e.mjs:660', 'generator template for the Reddit secret case `basic-user-same-shape-data`: `-u <id>:` + a run-time filler value'],
  ['curl-auth-user', 'benchmarks/corpora/session-material/corpus-e.mjs:699', 'generator template for the Zendesk case `credential-curl-u-double`: `-u "<email>/token:` + a run-time filler value'],
  ['curl-auth-user', 'benchmarks/corpora/session-material/corpus-e.mjs:714', 'generator template for the Zendesk case `credential-plus-address-email`'],
  ['curl-auth-user', 'benchmarks/corpora/session-material/corpus-e.mjs:719', 'generator template for the Zendesk case `credential-big-preceding`'],
];

export function traceability() {
  const first = new Map();
  return cases.map(c => {
    const key = `${c.family}\u0000${c.kind}\u0000${c.text}`;
    const dup = first.get(key);
    if (!dup) first.set(key, c.id);
    return { c, dup };
  }).map(({ c, dup }) => ({
    id: c.id, family: c.family, families: c.families, kind: c.kind, layout: c.layout, derivation: c.derivation,
    ...(c.variant ? { variant: c.variant } : {}), ...(c.downgraded ? { downgraded: c.downgraded } : {}), uniqueInput: !dup, ...(dup ? { duplicateOf: dup } : {}),
    case: c.case, caseOutcome: EVIDENCE.cases[c.case].outcome, fixture: c.fixture, claims: CLAIMS[c.case],
    clause: clauseOf(c),
  }));
}

export function proposedFreeze() {
  const axes = {};
  for (const [a, tests] of Object.entries(AXES)) axes[a] = { tests, cases: cases.filter(c => c.axes.includes(a)).length };
  const byRow = {};
  const k = counts();
  for (const f of FAMILY_IDS) byRow[f] = { ...k[f], sha256: rowDigest(f) };
  return {
    schema: 'group-e-frozen-corpus-v1',
    issue: ISSUE,
    status: 'proposed',
    frozen: false,
    note: 'Proposed, not frozen. Rename to FROZEN-group-e.json only after the owner accepts the corpus; nothing has scanned it. Written blind to the product and to every Batch 2 observation.',
    observationSchema: SCHEMA,
    sha256: corpusDigest(),
    cases: cases.length,
    positives: cases.filter(c => c.kind === 'positive').length,
    controls: cases.filter(c => c.kind === 'control').length,
    unsupported: cases.filter(c => c.kind === 'unsupported').length,
    conflict: cases.filter(c => c.kind === 'conflict').length,
    uniqueInputTotals: Object.fromEntries(['positive', 'control', 'unsupported', 'conflict', 'total'].map(x => [x, FAMILY_IDS.reduce((a, f) => a + k[f].uniqueInputs[x], 0)])),
    uniqueInputKeyings: { perRowAndKind: 'distinct texts per row and kind (uniqueInputs, uniqueInputTotals)', globalDistinctTexts: new Set(cases.map(c => c.text)).size, globalDuplicates: cases.length - new Set(cases.map(c => c.text)).size },
    uniqueInputs: Object.fromEntries(FAMILY_IDS.map(f => [f, k[f].uniqueInputs])),
    policyClassTolerance: INEXPRESSIBLE.find(i => i.id === 'policy-class-tolerance').what + ' ' + INEXPRESSIBLE.find(i => i.id === 'policy-class-tolerance').carriedAs,
    rows: byRow,
    axes,
    scorer: {
      path: 'benchmarks/harness/credential-carriers/score-multispan.mjs', changed: false, via: 'benchmarks/corpora/session-material/score-e.mjs re-export',
      sha256: { 'benchmarks/harness/credential-carriers/score-multispan.mjs': sha(readFileSync(new URL('../../harness/credential-carriers/score-multispan.mjs', import.meta.url))), 'benchmarks/harness/credential-carriers/score.mjs': sha(readFileSync(new URL('../../harness/credential-carriers/score.mjs', import.meta.url))) },
    },
    expectationSources: {
      snapshot: EVIDENCE.snapshot,
      evidenceInputSha256: sha(readFileSync(here('evidence-group-e.json'))),
      cases: Object.fromEntries(Object.entries(EVIDENCE.cases).map(([id, c]) => [id, { sha256: c.sha256, outcome: c.outcome, lifecycle: c.lifecycle }])),
      fixtures: EVIDENCE.fixtures.length,
    },
    inexpressible: INEXPRESSIBLE.map(i => i.id),
  };
}

export function markdown() {
  const t = traceability();
  const k = counts();
  const L = [];
  L.push('# Group E (#754) traceability');
  L.push('');
  L.push(`Generated by \`benchmarks/corpora/session-material/build-artifacts.mjs\` from \`corpus-e.mjs\`. Every test case maps to one credential-evidence Case (snapshot \`${EVIDENCE.snapshot.tag}\`, commit \`${EVIDENCE.snapshot.commit}\`), the evidence fixture it mirrors or extends, and the claim ids the readiness inventory (\`docs/handoffs/group-e-cases.md\`) assigns to that Case. The machine-readable form is \`traceability-group-e.json\`.`);
  L.push('');
  L.push('Derivation: `fixture-mirror` is a fixture verbatim; `carrier-extension` is a positive in the Case-named carrier with other surrounding bytes; `class-extension` is a control of a non-value class a Case lists (empty, placeholder, reference, mask, name in prose); `unsettled-case` is a form an unsettled Case names; `probe` is a form no Case asserts (observed, never scored; the nearest Case is shown).');
  L.push('');
  L.push('## Counts per row and kind');
  L.push('');
  L.push('Each cell is `cases / unique inputs` (distinct texts per row and kind; a text repeated under another layout name is one input).');
  L.push('');
  L.push('| row | positive | control | unsupported (observed) | conflict (observed) | total |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  const cell = (f, key) => `${k[f][key]} / ${k[f].uniqueInputs[key]}`;
  for (const f of FAMILY_IDS) L.push(`| \`${f}\` | ${cell(f, 'positive')} | ${cell(f, 'control')} | ${cell(f, 'unsupported')} | ${cell(f, 'conflict')} | ${cell(f, 'total')} |`);
  const sum = key => FAMILY_IDS.reduce((a, f) => a + k[f][key], 0);
  const usum = key => FAMILY_IDS.reduce((a, f) => a + k[f].uniqueInputs[key], 0);
  L.push(`| total | ${['positive', 'control', 'unsupported', 'conflict', 'total'].map(x => `${sum(x)} / ${usum(x)}`).join(' | ')} |`);
  L.push('');
  L.push('The Reddit revocation `token` slot is shared by `reddit:oauth-access-token` and `reddit:oauth-refresh-token` (one Case, both subjects): its cases are counted once, under the access-token row, and carry both rows in `families`.');
  L.push('');
  const distinctGlobal = new Set(cases.map(c => c.text)).size;
  L.push(`Two duplicate keyings, which give different numbers: (a) **per row and kind** distinct texts, the \`unique\` figure above, ${cases.length - FAMILY_IDS.reduce((a, f) => a + k[f].uniqueInputs.total, 0)} duplicates, a text counts again only when it recurs in the same row and kind; (b) **global** distinct texts over all ${cases.length} cases, regardless of row and kind: ${distinctGlobal}, so ${cases.length - distinctGlobal} duplicates (this also counts a text repeated across rows, such as the masked-display control shared by the Airtable and JFrog fixtures, or the prose control shared by Dropbox and Reddit; the remaining duplicates are generated controls that coincide with a fixture mirror).`);
  L.push('');
  L.push('## Observed-only rows and Cases');
  L.push('');
  L.push('- `adobe:service-account-jwt-private-key` has no scored positive: its only positive Cases are `not-assertable` (`adobe-jwt-private-key-file-contents-unsettled`, `adobe-jwt-signed-assertion-form-field-unsettled`), so the row is controls (the identifiers and key references are not the key) plus observed probes.');
  L.push('- Every `not-assertable` Case is observed and never scored: ' + Object.entries(EVIDENCE.cases).filter(([, c]) => c.outcome === 'not-assertable').map(([id]) => `\`${id}\``).join(', ') + '.');
  L.push('- Vendor-shaped probe values (JFrog `AKCp`+69, `AKCp8`+68 and the 44-character base64-punctuation form; the HubSpot 8-4-4-4-12 grouping; the Airtable `key`+14 form; the Dropbox 64-character and `sl.`-prefixed forms; the Reddit digits-dash-27 form; the Zendesk 40-character form; PEM-labelled Adobe key blocks) are assembled at run time in the generator and appear only as `unsupported` cases with the axis `probe-vendor-shaped`.');
  L.push('');
  L.push('## Reviewer rulings applied (blind review of Group E: approve with errata)');
  L.push('');
  L.push('A scored expectation must be supported by the evidence Case; otherwise the case is observed only (`unsupported`, or `conflict` for the four Zendesk fixture mirrors that carry a literal email), never deleted. A downgraded case keeps its text and its `observedSpans`; its row in the tables below shows the ruling in the `downgraded` field of `traceability-group-e.json`.');
  L.push('');
  const dg = {};
  for (const c of cases.filter(x => x.downgraded)) { const key = `${c.downgraded.ref}: ${c.downgraded.from} -> ${c.kind}: ${c.downgraded.why}`; dg[key] = (dg[key] ?? 0) + 1; }
  for (const [key, n] of Object.entries(dg)) L.push(`- ${n} cases, ${key}`);
  L.push('- E-B1: the Reddit bearer positives that lacked the host now carry `Host: oauth.reddit.com`; the Reddit and JFrog JSON/YAML header-map renderings are observed only (A2). A9: `jfrog:api-key` `basic-curl-u-eof` now carries the Artifactory URL. A13: bullet-mask and `{{ secrets.* }}` controls carry the `variant` tag `bullet-mask` / `secrets-template` (derivation `class-extension`).');
  L.push('');
  L.push('## gitleaks triage (commit range origin/develop..HEAD, `gitleaks detect --no-banner --redact`)');
  L.push('');
  L.push('Nine findings, all false positives: the matched strings are template code or credential-evidence fixtures built from `SYNTHETIC` words and never-issued filler. None is a credential. Line numbers refer to the tree of the commit that carries this table.');
  L.push('');
  L.push('| rule | file:line | what it matches |');
  L.push('| --- | --- | --- |');
  for (const [rule, where, what] of GITLEAKS_NOTES) L.push(`| ${rule} | \`${where}\` | ${what} |`);
  L.push('');
  L.push('## Expectations the unchanged scorer cannot express');
  L.push('');
  for (const i of INEXPRESSIBLE) L.push(`- **${i.id}**: ${i.what} Carried as: ${i.carriedAs}`);
  L.push('');
  for (const f of FAMILY_IDS) {
    L.push(`## \`${f}\``);
    L.push('');
    L.push('| test case (layout) | kind | derivation | Case | fixture | claims |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of t.filter(x => x.family === f)) L.push(`| \`${r.layout}\` | ${r.kind} | ${r.derivation} | \`${r.case}\` | ${r.fixture ? `\`${r.fixture}\`` : '(none: the Case has no fixture)'} | ${r.claims.map(c => `\`${c}\``).join(', ')} |`);
    L.push('');
  }
  return `${L.join('\n')}\n`;
}

const outputs = () => [
  ['traceability-group-e.json', `${JSON.stringify(traceability(), null, 1)}\n`],
  ['TRACEABILITY.md', markdown()],
  ['FROZEN-group-e.json.proposed', `${JSON.stringify(proposedFreeze(), null, 2)}\n`],
];

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const check = process.argv.includes('--check');
  const outputArg = process.argv.indexOf('--out');
  if (!check && outputArg < 0) throw new Error('Provide --out results-output/<fresh-corpus-artifacts> or --check');
  const output = check ? null : measurementOutput(process.argv[outputArg + 1], fileURLToPath(new URL('../../../', import.meta.url)), { directory: true });
  let bad = 0;
  for (const [name, body] of outputs().filter(([name]) => !check || name === 'traceability-group-e.json')) {
    if (check) {
      let cur = null;
      try { cur = readFileSync(here(name), 'utf8'); } catch { /* missing */ }
      if (cur !== body) { console.error(`${name} is stale`); bad += 1; }
    } else writeMeasurement(join(output, name), body);
  }
  if (bad) process.exit(1);
  console.log(check ? 'artifacts match the generator' : 'artifacts written');
}
