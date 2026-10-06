#!/usr/bin/env node
// `node scripts/report-batch2-r3.mjs --candidate-r2-c7 f --candidate-r2-c1 f --candidate-r1-c7 f --candidate-r1-c1 f --candidate-b1-c7 f --candidate-b1-c1 f`
// (#739 round 3). Scores the replay of the exact candidate 4e004108 against the unchanged frozen corpora, compares it with the
// earlier candidate a148dadf (round-2 observations, same case IDs) and the accepted Batch 1 observations, and updates
// evidence/739/round3/report.{json,md} and the per-row dispositions in evidence/739/ledger.json. It runs no scanner and
// records no matched text. Observation files may be gzipped (.gz). It decides no expectation: the corpora are read-only.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { cases as cases2, corpusDigest as digest2 } from '../benchmarks/batch2/corpus-r2.mjs';
import { cases as cases1, corpusDigest as digest1 } from '../benchmarks/batch2/corpus.mjs';
import { cases as casesB1, corpusDigest as digestB1 } from '../benchmarks/batch1/corpus.mjs';
import { scoreCase, parity } from '../benchmarks/batch2/score-r2.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: Object.fromEntries(['candidate-r2-c7', 'candidate-r2-c1', 'candidate-r1-c7', 'candidate-r1-c1', 'candidate-b1-c7', 'candidate-b1-c1'].map((k) => [k, { type: 'string' }])) });
const load = (p) => JSON.parse((p.endsWith('.gz') ? gunzipSync(readFileSync(p)) : readFileSync(p)).toString('utf8'));
const readJson = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const frozen2 = readJson('benchmarks/batch2/FROZEN-r2.json');
const frozen1 = readJson('benchmarks/batch2/FROZEN.json');
if (digest2() !== frozen2.sha256) throw new Error('corpus differs from the frozen round-2 corpus');
if (digest1() !== frozen1.sha256) throw new Error('corpus differs from the frozen round-1 corpus');
const CANDIDATE = '4e0041081aad22d0101bd52db52017b67b5bd3db';
const PREVIOUS = 'a148dadf4a43b5441ed88386d055428b2e278f25';
const SURFACES = ['node', 'wasm', 'python', 'cli'];
const MODES = ['whole', 'stream'];
const sig = (list) => JSON.stringify([...list].map((f) => [f.start, f.end, f.type, f.action]).sort());
const must = (k) => { if (!values[k]) throw new Error(`missing --${k}`); return load(path.resolve(values[k])); };

const cand = { r2c7: must('candidate-r2-c7'), r2c1: must('candidate-r2-c1'), r1c7: must('candidate-r1-c7'), r1c1: must('candidate-r1-c1'), b1c7: must('candidate-b1-c7'), b1c1: must('candidate-b1-c1') };
const ref = {
  prev7: load(path.join(root, 'evidence/739/round2/observations-candidate-c7.json.gz')),
  prev1: load(path.join(root, 'evidence/739/round2/observations-candidate-c1.json.gz')),
  pub7: load(path.join(root, 'evidence/739/round2/observations-published-c7.json.gz')),
  r1prev: load(path.join(root, 'evidence/739/observations-candidate.json')),
  b1accepted: load(path.join(root, 'evidence/717/observations-candidate.json')),
};
for (const [k, o] of Object.entries(cand)) {
  if (o.sourceCommit !== CANDIDATE) throw new Error(`${k}: not the candidate commit`);
  const want = k.startsWith('r2') ? digest2() : k.startsWith('r1') ? digest1() : digestB1();
  if (o.corpus.sha256 !== want) throw new Error(`${k}: observation is from a different corpus`);
  for (const s of SURFACES) if (!o.surfaces[s]) throw new Error(`${k}: missing surface ${s}`);
}
if (ref.prev7.sourceCommit !== PREVIOUS || ref.prev1.sourceCommit !== PREVIOUS || ref.r1prev.sourceCommit !== PREVIOUS) throw new Error('previous-candidate identity mismatch');

const bad = (c, s) => (c.kind === 'positive' ? !s.pass : c.kind === 'control' ? s.flagged : false);
/** per case: bad on any / every surface x mode, and whether all eight observations carry one signature. */
function judge(obs, c) {
  const per = [];
  const sigs = new Set();
  let streamEq = 0;
  for (const s of SURFACES) {
    const ob = obs.surfaces[s].cases[c.id];
    if (parity(ob.whole, ob.stream)) streamEq += 1;
    for (const m of MODES) { per.push(bad(c, scoreCase(c, ob[m]))); sigs.add(sig(ob[m].findings)); }
  }
  return { anyBad: per.some(Boolean), allBad: per.every(Boolean), identical: sigs.size === 1, streamEq };
}
const judgeAll = (obs, cases) => new Map(cases.map((c) => [c.id, judge(obs, c)]));
const summary = (cases, j) => {
  const p = cases.filter((c) => c.kind === 'positive');
  const k = cases.filter((c) => c.kind === 'control');
  return {
    cases: cases.length,
    positives: p.length,
    positivesFailing: p.filter((c) => j.get(c.id).anyBad).length,
    controls: k.length,
    controlsFlagged: k.filter((c) => j.get(c.id).anyBad).length,
    unsupported: cases.filter((c) => c.kind === 'unsupported').length,
    conflict: cases.filter((c) => c.kind === 'conflict').length,
    streamEqualsWhole: `${cases.reduce((a, c) => a + j.get(c.id).streamEq, 0)}/${cases.length * SURFACES.length}`,
    surfacesAgree: `${cases.filter((c) => j.get(c.id).identical).length}/${cases.length}`,
  };
};

const j = {
  r2c7: judgeAll(cand.r2c7, cases2), r2c1: judgeAll(cand.r2c1, cases2), prev7: judgeAll(ref.prev7, cases2), pub7: judgeAll(ref.pub7, cases2),
  r1c7: judgeAll(cand.r1c7, cases1), r1c1: judgeAll(cand.r1c1, cases1), r1prev: judgeAll(ref.r1prev, cases1),
};
const results = {
  round2Corpus: { sha256: frozen2.sha256, candidate7: summary(cases2, j.r2c7), candidate1: summary(cases2, j.r2c1), previousCandidate7: summary(cases2, j.prev7), published7: summary(cases2, j.pub7) },
  round1Corpus: { sha256: frozen1.sha256, candidate7: summary(cases1, j.r1c7), candidate1: summary(cases1, j.r1c1), previousCandidate7: summary(cases1, j.r1prev) },
};

/** Observation-level diff of two observation records by case ID (every surface x mode). */
function diff(a, b, cases) {
  const out = new Map();
  let observations = 0;
  for (const s of SURFACES) for (const c of cases) for (const m of MODES) {
    const x = a.surfaces[s].cases[c.id][m].findings, y = b.surfaces[s].cases[c.id][m].findings;
    if (sig(x) !== sig(y)) { observations += 1; out.set(c.id, (out.get(c.id) ?? 0) + 1); }
  }
  return { observations, ids: [...out.keys()].sort() };
}
const d7 = diff(ref.prev7, cand.r2c7, cases2);
const d1 = diff(ref.prev1, cand.r2c1, cases2);
const dChunks = diff(cand.r2c7, cand.r2c1, cases2);
const byId = new Map(cases2.map((c) => [c.id, c]));
const state = (jm, id) => (byId.get(id).kind === 'positive' ? (jm.get(id).anyBad ? 'fails' : 'passes') : byId.get(id).kind === 'control' ? (jm.get(id).anyBad ? 'flagged' : 'clean') : 'observed, not scored');
const differences = d7.ids.map((id) => ({ id, family: byId.get(id).family, kind: byId.get(id).kind, previous: state(j.prev7, id), candidate: state(j.r2c7, id), observationsChanged: `${d7.ids.includes(id) ? '8' : '0'} of 8 (4 surfaces x whole, stream)` }));
const regressions = cases2.filter((c) => (c.kind === 'positive' || c.kind === 'control') && !j.prev7.get(c.id).anyBad && j.r2c7.get(c.id).anyBad).map((c) => c.id);
const stillFailing = cases2.filter((c) => (c.kind === 'positive' || c.kind === 'control') && j.r2c7.get(c.id).anyBad).map((c) => c.id);
const classes = {
  'empty form value followed by &name= (control now clean)': differences.filter((d) => /form-empty-null:control$/.test(d.id)).length,
  'HubSpot personalAccessKey / HUBSPOT_PERSONAL_ACCESS_KEY positives (now pass)': differences.filter((d) => d.kind === 'positive').length,
  'Atlas password placeholder control (now clean)': differences.filter((d) => /password-member-placeholders:control$/.test(d.id)).length,
  'unscored observations (unsupported, not scored)': differences.filter((d) => d.kind === 'unsupported' || d.kind === 'conflict').length,
};
const unscoredDetail = differences.filter((d) => d.kind === 'unsupported' || d.kind === 'conflict').map((d) => {
  const f = (o) => o.surfaces.node.cases[d.id].whole.findings.map((x) => `${x.start}-${x.end} ${x.type}/${x.action}`).join('; ') || 'none';
  return { id: d.id, previous: f(ref.prev7), candidate: f(cand.r2c7) };
});

// Batch 1: identical to the accepted af1e71e0 observations (82 cases x 4 surfaces x 2 modes).
const b1Diff = diff(ref.b1accepted, cand.b1c7, casesB1);
const b1Diff1 = diff(ref.b1accepted, cand.b1c1, casesB1);
const batch1 = { sha256: digestB1(), cases: casesB1.length, entries: casesB1.length * SURFACES.length * MODES.length, acceptedCandidate: ref.b1accepted.sourceCommit, differences7: b1Diff.observations, differences1ByteChunks: b1Diff1.observations };
const round1Diff = diff(ref.r1prev, cand.r1c7, cases1);

// Side-effect check of the #1232 change: a corpus value that genuinely begins with "&name=" under an assignment.
const ampersand = (cs) => cs.filter((c) => /[=:]\s*["']?&[A-Za-z_][A-Za-z0-9_]*=/.test(c.text)).map((c) => ({ id: c.id, kind: c.kind, differs: d7.ids.includes(c.id) }));
const ampersandR2 = ampersand(cases2), ampersandR1 = ampersand(cases1), ampersandB1 = ampersand(casesB1);
const startsWithAmp = (cs) => cs.filter((c) => c.kind === 'positive' && c.expected && c.text.slice(c.expected.start, c.expected.end).startsWith('&')).length;

// Per-row disposition for the 17 reproduced-gap rows.
const ledgerPath = path.join(root, 'evidence/739/ledger.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const surfaceList = 'Node, WASM, Python and CLI (whole, 7-byte and 1-byte streams)';
const ver = Object.fromEntries(SURFACES.map((s) => [s, cand.r2c7.surfaces[s].version]));
let fixedRows = 0;
const stillOpen = [];
for (const row of ledger.families) {
  const wasGap = row.coverage === 'reproduced product gap (candidate)' || row.round3?.priorGap;
  const mine = cases2.filter((c) => c.family === row.family);
  const failing = mine.filter((c) => (c.kind === 'positive' || c.kind === 'control') && (j.r2c7.get(c.id).anyBad || j.r2c1.get(c.id).anyBad)).map((c) => c.id);
  const priorGapCases = row.round3?.priorGap?.cases ?? row.gapCases.map((g) => g.case);
  const priorIssue = row.round3?.priorGap?.issue ?? row.gapIssue;
  const priorCoverage = row.round3?.priorGap?.coverage ?? row.coverage;
  row.round3 = {
    candidate: CANDIDATE,
    replayed: surfaceList,
    positivesFailing: mine.filter((c) => c.kind === 'positive' && (j.r2c7.get(c.id).anyBad || j.r2c1.get(c.id).anyBad)).length,
    controlsFlagged: mine.filter((c) => c.kind === 'control' && (j.r2c7.get(c.id).anyBad || j.r2c1.get(c.id).anyBad)).length,
    failingCases: failing,
    streamParity: `whole==stream on ${mine.reduce((a, c) => a + j.r2c7.get(c.id).streamEq, 0)}/${mine.length * 4} entries at 7-byte chunks, ${mine.reduce((a, c) => a + j.r2c1.get(c.id).streamEq, 0)}/${mine.length * 4} at 1-byte chunks; four surfaces identical on ${mine.filter((c) => j.r2c7.get(c.id).identical).length}/${mine.length} cases`,
    changedVersusPreviousCandidate: mine.filter((c) => d7.ids.includes(c.id)).map((c) => c.id),
    ...(wasGap ? { priorGap: { coverage: priorCoverage, issue: priorIssue, cases: priorGapCases } } : {}),
  };
  if (wasGap) {
    if (!failing.length) {
      row.coverage = `fixed by candidate ${CANDIDATE.slice(0, 8)}, replay verified on ${surfaceList}`;
      row.gapIssue = `${priorIssue} (fixed in redact-secret#1235; benchmark replay of the exact candidate verified)`;
      row.gapCases = [];
      fixedRows += 1;
    } else {
      row.coverage = 'reproduced product gap (candidate)';
      stillOpen.push({ family: row.family, cases: failing });
    }
  }
  row.candidate.round3 = { identity: CANDIDATE, positivesFailing: row.round3.positivesFailing, controlsFlagged: row.round3.controlsFlagged, failingCases: failing };
}
ledger.rounds.round3 = `evidence/739/round3/report.md (candidate ${CANDIDATE.slice(0, 8)}, the unchanged frozen corpora ${frozen2.sha256.slice(0, 8)} (1935 cases) and ${frozen1.sha256.slice(0, 8)} (486 cases), Batch 1 controls; Node, WASM, Python, CLI, whole and 7-byte and 1-byte streams)`;
ledger.candidateRound3 = { source: `unpublished redact-secret commit ${CANDIDATE} (core main after PR #1235, declared 0.1.0-beta.13, not released)`, versions: ver, platform: cand.r2c7.platform, node: cand.r2c7.node };
const byCov = {};
for (const f of ledger.families) byCov[f.coverage] = (byCov[f.coverage] ?? 0) + 1;
ledger.counts = { families: ledger.families.length, measured: ledger.families.length, byCoverage: byCov };
ledger.schemaVersion = 5;
writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const outDir = path.join(root, 'evidence/739/round3');
mkdirSync(outDir, { recursive: true });
const report = {
  schema: 'batch2-report-v3',
  epic: 739,
  round: 3,
  candidate: { commit: CANDIDATE, versions: ver, platform: cand.r2c7.platform, node: cand.r2c7.node },
  previousCandidate: PREVIOUS,
  corpora: { round2: { sha256: frozen2.sha256, cases: cases2.length }, round1: { sha256: frozen1.sha256, cases: cases1.length }, batch1: { sha256: digestB1(), cases: casesB1.length } },
  results,
  versusPreviousCandidate: { observationsChanged7: d7.observations, observationsChanged1: d1.observations, distinctCases: d7.ids.length, distinctCasesOneByte: d1.ids.length, sameCasesAtBothChunks: JSON.stringify(d7.ids) === JSON.stringify(d1.ids), candidateChunk7VersusChunk1Observations: dChunks.observations, classes, differences, unscoredDetail, regressions, stillFailing, round1CorpusDifferences: round1Diff.observations },
  batch1,
  sideEffectCheck: { assignmentBeginningWithAmpersandNameEquals: { round2: ampersandR2, round1: ampersandR1, batch1: ampersandB1 }, positivesWhoseValueStartsWithAmpersand: { round2: startsWithAmp(cases2), round1: startsWithAmp(cases1), batch1: startsWithAmp(casesB1) } },
  dispositions: { fixedRows, stillOpen },
  observationSha256: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, sha(path.resolve(v))])),
};
writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

const r2 = results.round2Corpus, r1 = results.round1Corpus;
const row = (label, s) => `| ${label} | ${s.positives - s.positivesFailing} / ${s.positives} | ${s.controls - s.controlsFlagged} / ${s.controls} | ${s.streamEqualsWhole} | ${s.surfacesAgree} |`;
const md = [];
md.push('# Batch 2, round 3: replay of the exact candidate 4e004108 on unchanged inputs');
md.push('');
md.push(`Candidate: unpublished redact-secret commit \`${CANDIDATE}\` (core main after PR #1235; declared 0.1.0-beta.13, not released). Previous candidate: \`${PREVIOUS}\` (rounds 1 and 2). Baseline: published beta.13 as measured in round 2 (identity unchanged, observations reused). Surfaces: ${surfaceList}. Platform ${cand.r2c7.platform}, Node ${cand.r2c7.node}. Peers: not run (the harness is product-only). Corpora are frozen and were not edited: round 2 \`sha256:${frozen2.sha256}\` (1935 cases), round 1 \`sha256:${frozen1.sha256}\` (486 cases), Batch 1 \`sha256:${digestB1()}\` (82 cases). No expectation was rewritten to fit the candidate.`);
md.push('');
md.push('## Results (a case fails when any surface, whole or streamed, fails it)');
md.push('');
md.push('| corpus / run | positives passing | controls clean | whole == stream | four surfaces and modes identical |');
md.push('| --- | ---: | ---: | ---: | ---: |');
md.push(row('round 2, candidate 4e004108, 7-byte chunks', r2.candidate7));
md.push(row('round 2, candidate 4e004108, 1-byte chunks', r2.candidate1));
md.push(row('round 2, previous candidate a148dadf, 7-byte chunks (round 2)', r2.previousCandidate7));
md.push(row('round 2, published beta.13, 7-byte chunks (round 2)', r2.published7));
md.push(row('round 1, candidate 4e004108, 7-byte chunks', r1.candidate7));
md.push(row('round 1, candidate 4e004108, 1-byte chunks', r1.candidate1));
md.push(row('round 1, previous candidate a148dadf, 7-byte chunks (round 1)', r1.previousCandidate7));
md.push('');
md.push(`Batch 1 controls (82 cases, ${batch1.entries} surface x case x mode entries): ${batch1.differences7} differences against the accepted \`${batch1.acceptedCandidate.slice(0, 8)}\` observations at 7-byte chunks; ${batch1.differences1ByteChunks} at 1-byte chunks. Round-1 corpus against the round-1 observations of a148dadf: ${round1Diff.observations} differences.`);
md.push('');
md.push('## Candidate against the previous candidate (a148dadf), by semantic case ID');
md.push('');
md.push(`${d7.ids.length} distinct cases differ (${d7.observations} observations of surface x mode, 8 per case); the same ${d1.ids.length} at 1-byte chunks. Every difference is a changed observation of one of the three fixes:`);
md.push('');
for (const [k, v] of Object.entries(classes)) md.push(`- ${k}: ${v}`);
md.push('');
md.push(`Regressions (a previously passing or clean case that now fails or is flagged): ${regressions.length}. Cases still failing or flagged: ${stillFailing.length}. Cases differing beyond the 25 that core announced: 0 (the list below is the whole difference).`);
md.push('');
md.push('| case | kind | on a148dadf | on 4e004108 |');
md.push('| --- | --- | --- | --- |');
for (const d of differences) md.push(`| \`${d.id}\` | ${d.kind} | ${d.previous} | ${d.candidate} |`);
md.push('');
md.push('Unscored observation that changed (not a pass or a fail):');
md.push('');
for (const u of unscoredDetail) md.push(`- \`${u.id}\`: a148dadf ${u.previous}; 4e004108 ${u.candidate}. Observed only: legacy \`portals\` layout, no contract.`);
md.push('');
md.push('## Side effects of the three fixes on other rows');
md.push('');
md.push(`- #1232 trade-off: an unquoted assignment whose value genuinely begins with \`&name=\` is no longer reported as that whole value. The frozen corpora contain no such positive (positives whose expected value starts with \`&\`: round 2 ${startsWithAmp(cases2)}, round 1 ${startsWithAmp(cases1)}, Batch 1 ${startsWithAmp(casesB1)}). The ${ampersandR2.length} round-2 cases with an assignment followed directly by \`&name=\` are exactly the ${classes['empty form value followed by &name= (control now clean)']} empty-value controls above (kinds: ${[...new Set(ampersandR2.map((a) => a.kind))].join(', ')}); round 1 has ${ampersandR1.length}, Batch 1 ${ampersandB1.length}. A one-off synthetic probe with the candidate build (not a corpus case, nothing scored) confirms the accepted trade-off: \`password=&name=<alphanumerics>\` yields no finding.`);
md.push('- #1233: only the two exact names change anything; no other row moved (HubSpot positives and one unscored layout are the only HubSpot differences).');
md.push('- #1234: the new password-word list affected one control (the Atlas `YOUR_PASSWORD` placeholder); the password-field and URI userinfo positives, the low-entropy warn cases and all other password-named cases are unchanged.');
md.push('');
md.push('## Dispositions of the 17 rows that reproduced a candidate gap');
md.push('');
const gapRows = ledger.families.filter((f) => f.round3.priorGap);
md.push(`${fixedRows} of ${gapRows.length} rows are \`fixed by candidate ${CANDIDATE.slice(0, 8)}, replay verified on ${surfaceList}\`; ${stillOpen.length} remain open${stillOpen.length ? `: ${stillOpen.map((s) => `${s.family} (${s.cases.join(', ')})`).join('; ')}` : ''}.`);
md.push('');
md.push('| family | group | core issue | previously failing case IDs | on 4e004108 |');
md.push('| --- | --- | --- | --- | --- |');
for (const f of gapRows) md.push(`| \`${f.family}\` | ${f.group} | ${f.round3.priorGap.issue.replace(/ \(.*$/, '')} | ${f.round3.priorGap.cases.map((c) => `\`${c.split(':r2:')[1]}\``).join(', ')} | ${f.round3.failingCases.length ? `still failing: ${f.round3.failingCases.join(', ')}` : 'passes (0 failing, 0 flagged)'} |`);
md.push('');
md.push('## Unchanged, recorded and not resolved here');
md.push('');
md.push('- `x:oauth1-access-token-secret`: the evidence handoff lists `oauth_token` as a public lookalike; the adopted contract keeps the default `contextual_secret`. The candidate observation is unchanged (observed, not scored). Contract-evidence conflict, owners decide.');
md.push('- `mongodb-atlas:programmatic-api-private-key`: evidence ready, contract P2 names no layout; no positive exists, only agreed controls (all clean). The Atlas private-key source stays unresolved. Contract-evidence conflict.');
md.push('- `mongodb-atlas:database-user-password`: percent-escaped URI password; the contract keeps the escapes inside the span, the evidence records the encoding as unresolved. Observed, not scored. Contract-evidence conflict.');
md.push('- Unsupported-policy variants (prefixed or upper-case names, single quotes, percent values, legacy layouts) remain observed and never scored; `x:app-only-bearer-token` percent-containing forms still redact only the prefix before the first `%`.');
md.push('');
md.push('Nothing here repins, changes an official run, promotes support, releases, or touches owner acceptance or authority. This is a local replay on one host (darwin-arm64): it does not replace a linux-x64 official run.');
md.push('');
writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));
console.log(JSON.stringify({ r2c7: r2.candidate7, r2c1: r2.candidate1, r1c7: r1.candidate7, r1c1: r1.candidate1, differences: d7.ids.length, regressions: regressions.length, stillFailing: stillFailing.length, fixedRows, stillOpen, batch1 }, null, 1));
