#!/usr/bin/env node
// `node scripts/report-batch2-r2.mjs --published-c7 f --candidate-c7 f --published-c1 f --candidate-c1 f [--gaps file] [--out-dir evidence/739]` (#739 round 2).
// Scores the round-2 observations against the frozen round-2 corpus, writes evidence/739/round2/report.{json,md}
// and the 58-row ledger. It runs no scanner and records no matched text. Observation files may be gzipped (.gz).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { cases, corpusDigest, partDigest, AXES, CONFLICTS } from '../benchmarks/batch2/corpus-r2.mjs';
import { scoreCase, parity } from '../benchmarks/batch2/score-r2.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { 'published-c7': { type: 'string' }, 'candidate-c7': { type: 'string' }, 'published-c1': { type: 'string' }, 'candidate-c1': { type: 'string' }, gaps: { type: 'string' }, 'out-dir': { type: 'string', default: 'evidence/739' } } });
const load = p => JSON.parse((p.endsWith('.gz') ? gunzipSync(readFileSync(p)) : readFileSync(p)).toString('utf8'));
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const frozen = readJson(path.join(root, 'benchmarks/batch2/FROZEN-r2.json'));
const readiness = readJson(path.join(root, 'evidence/739/readiness.json'));
const round1 = readJson(path.join(root, 'evidence/739/ledger-round1.json'));
const sources = readJson(path.join(root, 'benchmarks/batch2/sources.json'));
const gapRules = values.gaps ? readJson(path.resolve(root, values.gaps)) : { rules: [] };
if (corpusDigest() !== frozen.sha256) throw new Error('corpus differs from the frozen round-2 corpus');
const obs = { pub7: load(values['published-c7']), cand7: load(values['candidate-c7']), pub1: load(values['published-c1']), cand1: load(values['candidate-c1']) };
for (const o of Object.values(obs)) if (o.corpus.sha256 !== frozen.sha256) throw new Error(`observation ${o.label} is from a different corpus`);
const outDir = path.resolve(root, values['out-dir'], 'round2');
mkdirSync(outDir, { recursive: true });

const SURFACES = ['node', 'wasm', 'python', 'cli'];
const sig = list => JSON.stringify([...list].map(f => [f.start, f.end, f.type, f.action]).sort());
const byId = new Map(cases.map(c => [c.id, c]));

/** One case on one engine/chunk: score per surface x mode; consistent when every surface and mode agrees. */
function judge(o, c) {
  const per = [];
  const sigs = new Set();
  let streamEq = 0;
  for (const s of SURFACES) {
    const ob = o.surfaces[s].cases[c.id];
    if (parity(ob.whole, ob.stream)) streamEq += 1;
    for (const m of ['whole', 'stream']) { per.push(scoreCase(c, ob[m])); sigs.add(sig(ob[m].findings)); }
  }
  const bad = per.map(p => (c.kind === 'positive' ? !p.pass : c.kind === 'control' ? p.flagged : false));
  return { allBad: bad.every(Boolean), anyBad: bad.some(Boolean), consistentSurfaces: sigs.size === 1, streamEq, first: per[0] };
}
const results = { pub7: new Map(), cand7: new Map(), pub1: new Map(), cand1: new Map() };
for (const [k, o] of Object.entries(obs)) for (const c of cases) results[k].set(c.id, judge(o, c));

const isBad = (k, c) => results[k].get(c.id).anyBad;
const rowsOut = [];
for (const rd of readiness.families) {
  const mine = cases.filter(c => c.family === rd.family);
  const pos = mine.filter(c => c.kind === 'positive');
  const ctl = mine.filter(c => c.kind === 'control');
  const part = mine[0]?.part ?? null;
  const cnt = (k, kind) => mine.filter(c => c.kind === kind && isBad(k, c)).length;
  const failing = k => mine.filter(c => (c.kind === 'positive' || c.kind === 'control') && isBad(k, c)).map(c => c.id);
  const candFail = failing('cand7');
  const pubFail = failing('pub7');
  const rule = id => gapRules.rules.find(r => new RegExp(r.match).test(id));
  rowsOut.push({
    family: rd.family,
    group: rd.group,
    part,
    cases: mine.length,
    positives: pos.length,
    controls: ctl.length,
    unsupportedObserved: mine.filter(c => c.kind === 'unsupported').length,
    conflictCases: mine.filter(c => c.kind === 'conflict').map(c => c.id),
    published: { positivesFailing: cnt('pub7', 'positive'), controlsFlagged: cnt('pub7', 'control'), failingCases: pubFail },
    candidate: { positivesFailing: cnt('cand7', 'positive'), controlsFlagged: cnt('cand7', 'control'), failingCases: candFail, chunk1SameAsChunk7: JSON.stringify(failing('cand1')) === JSON.stringify(candFail) },
    fixedByExistingCoreFix: pubFail.filter(id => !candFail.includes(id)),
    gaps: candFail.map(id => ({ case: id, issue: rule(id)?.issue ?? null, rule: rule(id)?.name ?? null })),
    parity: {
      candidateChunk7: `${mine.reduce((a, c) => a + results.cand7.get(c.id).streamEq, 0)}/${mine.length * SURFACES.length}`,
      candidateChunk1: `${mine.reduce((a, c) => a + results.cand1.get(c.id).streamEq, 0)}/${mine.length * SURFACES.length}`,
      identicalAcrossSurfacesAndModes: `${mine.filter(c => results.cand7.get(c.id).consistentSurfaces).length}/${mine.length}`,
    },
    contractEvidenceConflict: CONFLICTS[rd.family] ?? null,
  });
}

const axisTable = {};
for (const a of Object.keys(AXES)) {
  const sel = cases.filter(c => c.axes.includes(a));
  const p = sel.filter(c => c.kind === 'positive');
  const k = sel.filter(c => c.kind === 'control');
  axisTable[a] = { tests: AXES[a], cases: sel.length, positives: p.length, positivesFailingCandidate: p.filter(c => isBad('cand7', c)).length, positivesFailingPublished: p.filter(c => isBad('pub7', c)).length, controls: k.length, controlsFlaggedCandidate: k.filter(c => isBad('cand7', c)).length, unsupportedObserved: sel.filter(c => c.kind === 'unsupported').length };
}

const partSummary = {};
for (const part of ['new-rows', 'round1-adversarial']) {
  const sel = cases.filter(c => c.part === part);
  const p = sel.filter(c => c.kind === 'positive');
  const k = sel.filter(c => c.kind === 'control');
  partSummary[part] = { cases: sel.length, positives: p.length, controls: k.length, unsupported: sel.filter(c => c.kind === 'unsupported').length, conflict: sel.filter(c => c.kind === 'conflict').length,
    published: { positivesPass: p.filter(c => !isBad('pub7', c)).length, controlsClean: k.filter(c => !isBad('pub7', c)).length },
    candidate: { positivesPass: p.filter(c => !isBad('cand7', c)).length, controlsClean: k.filter(c => !isBad('cand7', c)).length },
    candidateChunk1: { positivesPass: p.filter(c => !isBad('cand1', c)).length, controlsClean: k.filter(c => !isBad('cand1', c)).length },
    sha256: partDigest(part) };
}

// unsupported / conflict observations on the candidate (not scored)
const unsupportedObs = {};
for (const c of cases.filter(c => c.kind === 'unsupported' || c.kind === 'conflict')) {
  const f = obs.cand7.surfaces.node.cases[c.id].whole.findings;
  const tag = c.layout.replace(/^.*?-(?=(below-floor|prefixed|upper|single-quoted|percent|newline|lowercase|no-space|curl-user|legacy|basic-reference|unterminated|prefixed-header|bare)).*/, '$1');
  unsupportedObs[tag] ??= { cases: 0, withFindings: 0 };
  unsupportedObs[tag].cases += 1;
  if (f.length) unsupportedObs[tag].withFindings += 1;
}

const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const identity = {
  baseline: { source: 'published @redact-secret/core 0.1.0-beta.13 (npm; integrity ' + sources.baseline.publishedPin.integrity + '), PyPI redact-secret 0.1.0b13, crates.io redact-secret-cli 0.1.0-beta.13 (cargo install --locked)', versions: Object.fromEntries(Object.entries(obs.pub7.surfaces).map(([k, v]) => [k, v.version])) },
  candidate: { source: 'unpublished redact-secret commit a148dadf4a43b5441ed88386d055428b2e278f25 (the round-1 candidate: core main has not moved; no candidate package was published by the core session)', versions: Object.fromEntries(Object.entries(obs.cand7.surfaces).map(([k, v]) => [k, v.version])) },
  platform: obs.cand7.platform,
  node: obs.cand7.node,
  chunks: { primary: obs.cand7.chunkBytes, adversarial: obs.cand1.chunkBytes },
  corpusSha256: frozen.sha256,
  observationSha256: Object.fromEntries(Object.entries(values).filter(([k]) => k.includes('-c')).map(([k, v]) => [k, sha(v)])),
};
writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({ schema: 'batch2-report-v2', epic: 739, round: 2, identity, corpus: { sha256: frozen.sha256, cases: frozen.cases, errata: frozen.errata.items.map(i => i.id), firstFreeze: frozen.firstFreeze }, parts: partSummary, axes: axisTable, unsupportedObservations: unsupportedObs, rows: rowsOut }, null, 2)}\n`);

// ---- ledger (58 rows) -------------------------------------------------------------
const r1 = new Map(round1.families.map(f => [f.family, f]));
const SURF = { node: 'measured', wasm: 'measured', python: 'measured', cli: 'measured', rust: 'no separate Rust library harness; the CLI binary is the Rust surface' };
const ledger = {
  schemaVersion: 4,
  kind: 'batch2-disposition-ledger',
  epic: 739,
  complete: true,
  completeMeaning: 'all 58 families are ready per credential-evidence 65602481 and have a measured disposition (round 1 for 30 rows, round 2 for the 28 newly ready rows; round 1 rows also got the round-2 adversarial axes). It does not mean all 58 are covered: see the per-row coverage and gap fields.',
  evidenceCommit: readiness.inputs.evidenceCommit,
  baseline: identity.baseline,
  candidate: identity.candidate,
  rounds: { round1: 'evidence/739/report.md (corpus 74fed382, 30 rows, 486 cases)', round2: 'evidence/739/round2/report.md (corpus ' + frozen.sha256.slice(0, 8) + ', ' + frozen.cases + ' cases, adversarial axes)' },
  families: rowsOut.map(r => {
    const rd = readiness.families.find(f => f.family === r.family);
    const prev = r1.get(r.family);
    const isNew = r.part === 'new-rows';
    const hasGap = r.gaps.length > 0;
    const coverage = r.family === 'mongodb-atlas:programmatic-api-private-key' && !r.cases ? prev.coverage
      : hasGap ? 'reproduced product gap (candidate)'
      : r.fixedByExistingCoreFix.length ? 'fixed in candidate by an existing core fix (no new gap)'
      : prev && prev.coverage && !isNew && prev.coverage !== 'already-covered / no-code' ? prev.coverage
      : 'already-covered / no-code';
    return {
      family: r.family,
      group: r.group,
      carrierContract: `${rd.contract.path} (${rd.contract.period}/${rd.contract.lifecycle}, sha256 ${rd.contract.sha12AtEvidenceCommit}, evidence ${readiness.inputs.evidenceCommit.slice(0, 8)}${rd.researchDoc ? `, carrier research ${rd.researchDoc}` : ''}; product contract redact-secret PR #1231 a148dadf, docs/audits/evidence/${rd.coreIssue}/README.md)`,
      evidenceStatus: rd.status,
      measuredIn: isNew ? ['round 2'] : r.family === 'mongodb-atlas:programmatic-api-private-key' ? ['round 1 (controls only)'] : ['round 1', 'round 2 adversarial'],
      coreIssue: `redact-secret#${rd.coreIssue}`,
      measurementIssue: `redact-secret-benchmarks#${rd.measurementIssue}`,
      caseIds: { round1: prev?.caseIds ?? [], round2Count: r.cases, round2Positives: r.positives, round2Controls: r.controls, round2Note: 'round-2 case ids are in benchmarks/batch2/corpus-r2.mjs (<family>:r2:<layout>:<kind>)' },
      baseline: { identity: identity.baseline.versions, round2: { positivesFailing: r.published.positivesFailing, controlsFlagged: r.published.controlsFlagged }, round1: prev?.baseline ?? null },
      candidate: { identity: 'a148dadf4a43b5441ed88386d055428b2e278f25', round2: { positivesFailing: r.candidate.positivesFailing, controlsFlagged: r.candidate.controlsFlagged, failingCases: r.candidate.failingCases, sameWithOneByteChunks: r.candidate.chunk1SameAsChunk7 }, round1: prev?.candidate ?? null },
      surfaces: SURF,
      findings: 'per-case findings (start, end, type, action; no matched text) are in observations-*.json.gz (round 2) and evidence/739/observations-*.json (round 1); expectations in benchmarks/batch2/corpus-r2.mjs and corpus.mjs',
      overlapOutcome: prev?.overlapOutcome ?? 'round 2: repeated-secret positives require every occurrence exact',
      streamParity: `round 2 candidate whole==stream: ${r.parity.candidateChunk7} entries at 7-byte chunks, ${r.parity.candidateChunk1} at 1-byte chunks; four surfaces identical on ${r.parity.identicalAcrossSurfacesAndModes} cases`,
      coverage,
      boundary: r.family === 'x:app-only-bearer-token' ? 'unsupported-policy boundary (percent-containing and escaped forms)' : null,
      contractEvidenceConflict: r.contractEvidenceConflict ?? prev?.contractEvidenceConflict ?? null,
      conflictCases: r.conflictCases,
      gapIssue: hasGap ? [...new Set(r.gaps.map(g => g.issue).filter(Boolean))].join(', ') || 'to be filed' : r.fixedByExistingCoreFix.length ? 'redact-secret#1212 (Elastic ApiKey envelope, PR #1215); reused, no new issue' : null,
      gapCases: r.gaps,
      unresolvedOrUnsupportedVariants: `${r.unsupportedObserved} round-2 variants observed and not scored (see report.md for the classes)${prev?.unresolvedOrUnsupportedVariants?.length ? `; round 1: ${prev.unresolvedOrUnsupportedVariants.length} observed` : ''}`,
    };
  }),
};
ledger.counts = { families: ledger.families.length, measured: ledger.families.length, byCoverage: Object.fromEntries([...new Set(ledger.families.map(f => f.coverage))].map(c => [c, ledger.families.filter(f => f.coverage === c).length])) };
writeFileSync(path.join(root, values['out-dir'], 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);

// ---- markdown ------------------------------------------------------------------
const md = [];
md.push('# Batch 2, round 2: adversarial measurement of newly ready rows and a harder re-test of round 1');
md.push('');
md.push(`Frozen corpus \`sha256:${frozen.sha256}\` (${frozen.cases} cases; first freeze ${frozen.firstFreeze.sha256.slice(0, 8)} in ${frozen.firstFreeze.commit}, three documented errata E1-E3 before the re-measurement; round 1's own corpus 74fed382 is untouched). Expectations: credential-evidence \`${readiness.inputs.evidenceCommit.slice(0, 8)}\` handoff and research docs, and the adopted contract (redact-secret #1231, \`a148dadf\`).`);
md.push('');
md.push(`- Baseline: ${identity.baseline.source}. Candidate: ${identity.candidate.source}. Same baseline and candidate as round 1.`);
md.push(`- Surfaces: Node, WASM, Python, CLI (Rust), whole and streamed at ${identity.chunks.primary}-byte and ${identity.chunks.adversarial}-byte chunks. Peers: not run. Platform ${identity.platform}, Node ${identity.node}.`);
md.push('');
md.push('## Parts');
md.push('');
md.push('| part | cases | positives (baseline pass / candidate pass / candidate 1-byte pass) | controls (baseline clean / candidate clean / candidate 1-byte clean) | unsupported observed | conflict |');
md.push('| --- | ---: | --- | --- | ---: | ---: |');
for (const [p, s] of Object.entries(partSummary)) md.push(`| ${p} | ${s.cases} | ${s.published.positivesPass} / ${s.candidate.positivesPass} / ${s.candidateChunk1.positivesPass} of ${s.positives} | ${s.published.controlsClean} / ${s.candidate.controlsClean} / ${s.candidateChunk1.controlsClean} of ${s.controls} | ${s.unsupported} | ${s.conflict} |`);
md.push('');
md.push('A case counts as failing when any surface, whole or streamed, fails it.');
md.push('');
md.push('## Axes: what each tests and whether it bit (candidate)');
md.push('');
md.push('| axis | tests | positives failing | controls flagged | unsupported observed |');
md.push('| --- | --- | ---: | ---: | ---: |');
for (const [a, t] of Object.entries(axisTable)) md.push(`| ${a} | ${t.tests} | ${t.positivesFailingCandidate} / ${t.positives} | ${t.controlsFlaggedCandidate} / ${t.controls} | ${t.unsupportedObserved} |`);
md.push('');
md.push('## Rows with a candidate failure');
md.push('');
md.push('| family | group | part | failing cases (candidate) | issue |');
md.push('| --- | --- | --- | --- | --- |');
for (const r of rowsOut.filter(x => x.gaps.length)) md.push(`| \`${r.family}\` | ${r.group} | ${r.part} | ${r.gaps.map(g => `\`${g.case.replace(`${r.family}:r2:`, '')}\``).join(', ')} | ${[...new Set(r.gaps.map(g => g.issue).filter(Boolean))].join(', ') || 'to be filed'} |`);
md.push('');
md.push('## Fixed in the candidate by an existing core fix');
md.push('');
for (const r of rowsOut.filter(x => x.fixedByExistingCoreFix.length)) md.push(`- \`${r.family}\`: ${r.fixedByExistingCoreFix.length} cases fail on the baseline and pass on the candidate (Elastic ApiKey envelope, core #1212 / PR #1215).`);
md.push('');
md.push('## Unsupported-variant observations (not scored)');
md.push('');
for (const [t, v] of Object.entries(unsupportedObs)) md.push(`- ${t}: ${v.cases} cases, ${v.withFindings} produced findings on the candidate`);
md.push('');
writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));
console.log(JSON.stringify(partSummary, null, 0));
