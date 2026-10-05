#!/usr/bin/env node
// `node scripts/report-batch2.mjs --published obs.json --candidate obs.json [--batch1-candidate obs.json] [--out-dir evidence/739]` (#739).
// Scores the two observation files against the frozen Batch 2 corpus, writes report.json / report.md, and fills the
// 58-row disposition ledger. It runs no scanner and records no matched text.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { cases, corpusDigest, CONFLICTS } from '../benchmarks/batch2/corpus.mjs';
import { scoreCase, parity, summarize } from '../benchmarks/batch2/score.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { published: { type: 'string' }, candidate: { type: 'string' }, 'batch1-candidate': { type: 'string' }, 'out-dir': { type: 'string', default: 'evidence/739' } } });
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));
const frozen = readJson(path.join(root, 'benchmarks/batch2/FROZEN.json'));
const readiness = readJson(path.join(root, 'evidence/739/readiness.json'));
const sources = readJson(path.join(root, 'benchmarks/batch2/sources.json'));
const published = readJson(values.published);
const candidate = readJson(values.candidate);
const outDir = path.resolve(root, values['out-dir']);
if (corpusDigest() !== frozen.sha256) throw new Error('corpus differs from the frozen one');
for (const o of [published, candidate]) if (o.corpus.sha256 !== frozen.sha256) throw new Error(`observation ${o.label} is from a different corpus`);

const SURFACES = ['node', 'wasm', 'python', 'cli'];
const key = f => JSON.stringify([f.start, f.end, f.type, f.action]);
const sig = list => JSON.stringify([...list].map(key).sort());

function evaluate(obs, family) {
  const mine = cases.filter(c => c.family === family);
  const out = { surfaces: {}, crossSurfaceAgree: 0, streamEqualsWhole: 0, entries: 0, failing: [], overlapsOverOne: 0 };
  for (const c of mine) {
    const sigs = new Set();
    for (const s of SURFACES) {
      const ob = obs.surfaces[s]?.cases[c.id];
      if (!ob) continue;
      out.entries += 1;
      if (parity(ob.whole, ob.stream)) out.streamEqualsWhole += 1;
      sigs.add(sig(ob.whole.findings));
      sigs.add(sig(ob.stream.findings));
    }
    if (sigs.size === 1) out.crossSurfaceAgree += 1;
  }
  for (const s of SURFACES) {
    if (!obs.surfaces[s]) { out.surfaces[s] = 'unavailable'; continue; }
    const whole = {};
    const stream = {};
    for (const c of mine) { whole[c.id] = obs.surfaces[s].cases[c.id].whole; stream[c.id] = obs.surfaces[s].cases[c.id].stream; }
    out.surfaces[s] = { whole: summarize(mine, whole), stream: summarize(mine, stream) };
  }
  const node = obs.surfaces.node.cases;
  for (const c of mine) {
    const sc = scoreCase(c, node[c.id].whole);
    if (c.kind === 'positive') {
      if (sc.overlaps > 1) out.overlapsOverOne += 1;
      if (!sc.pass) out.failing.push({ case: c.id, span: sc.span, type: sc.type, action: sc.action, leakedBytes: sc.leakedBytes });
    } else if (c.kind === 'control' && sc.flagged) out.failing.push({ case: c.id, flagged: sc.findings });
  }
  out.cases = mine.length;
  out.crossSurfaceAgreeOf = mine.length;
  return out;
}

const rows = [];
for (const r of readiness.families) {
  if (r.status !== 'ready') {
    rows.push({ family: r.family, group: r.group, status: r.status, measured: false, followUp: r.handoff.followUp });
    continue;
  }
  const mine = cases.filter(c => c.family === r.family);
  const pub = evaluate(published, r.family);
  const cand = evaluate(candidate, r.family);
  const posN = mine.filter(c => c.kind === 'positive').length;
  const ctlN = mine.filter(c => c.kind === 'control').length;
  const pubNode = pub.surfaces.node.whole;
  const candNode = cand.surfaces.node.whole;
  const conflict = CONFLICTS[r.family] ?? null;
  const unsup = mine.filter(c => c.kind === 'unsupported').length;
  const observedUnsupported = mine.filter(c => c.kind === 'unsupported' || c.kind === 'conflict').map(c => ({
    case: c.id,
    kind: c.kind,
    candidateFindings: candidate.surfaces.node.cases[c.id].whole.findings.map(f => ({ start: f.start, end: f.end, type: f.type, action: f.action })),
  }));
  let coverage;
  if (r.family === 'mongodb-atlas:programmatic-api-private-key') coverage = 'contract-evidence conflict';
  else if (candNode.pass !== candNode.positives || candNode.controlFlagged > 0) coverage = 'reproduced product gap';
  else if (pubNode.pass !== pubNode.positives || pubNode.controlFlagged > 0) coverage = 'fixed in candidate by an existing core fix (no new gap)';
  else coverage = 'already-covered / no-code';
  const boundary = r.family === 'x:app-only-bearer-token' ? 'unsupported-policy boundary (percent-containing and escaped forms)' : null;
  rows.push({
    family: r.family,
    group: r.group,
    status: r.status,
    measured: true,
    cases: mine.length,
    positives: posN,
    controls: ctlN,
    unsupportedObserved: unsup,
    conflictCases: mine.filter(c => c.kind === 'conflict').length,
    coverage,
    boundary,
    contractEvidenceConflict: conflict,
    published: { node: pubNode, positivesPassOnEverySurface: SURFACES.every(s => pub.surfaces[s].whole.pass === posN && pub.surfaces[s].stream.pass === posN), failing: pub.failing },
    candidate: { node: candNode, positivesPassOnEverySurface: SURFACES.every(s => cand.surfaces[s].whole.pass === posN && cand.surfaces[s].stream.pass === posN), controlsCleanOnEverySurface: SURFACES.every(s => cand.surfaces[s].whole.controlFlagged === 0 && cand.surfaces[s].stream.controlFlagged === 0), failing: cand.failing },
    parity: { candidateStreamEqualsWholeEntries: `${cand.streamEqualsWhole}/${cand.entries}`, candidateCrossSurfaceIdenticalCases: `${cand.crossSurfaceAgree}/${mine.length}`, publishedStreamEqualsWholeEntries: `${pub.streamEqualsWhole}/${pub.entries}`, publishedCrossSurfaceIdenticalCases: `${pub.crossSurfaceAgree}/${mine.length}` },
    overlap: { positivesWithMoreThanOneFinding: cand.overlapsOverOne },
    observedUnsupported,
  });
}

const measured = rows.filter(r => r.measured);
const tally = {};
for (const g of Object.keys(readiness.counts).filter(k => k !== 'total')) {
  const sub = rows.filter(r => r.group === g);
  tally[g] = { total: sub.length, measured: sub.filter(r => r.measured).length, notMeasuredCarrierUnresolved: sub.filter(r => !r.measured).length };
  for (const r of sub.filter(x => x.measured)) tally[g][r.coverage] = (tally[g][r.coverage] ?? 0) + 1;
}

let batch1 = null;
if (values['batch1-candidate']) {
  const now = readJson(values['batch1-candidate']);
  const base = readJson(path.join(root, 'evidence/717/observations-candidate.json'));
  let n = 0;
  let diff = 0;
  for (const s of Object.keys(base.surfaces)) for (const id of Object.keys(base.surfaces[s].cases)) for (const m of ['whole', 'stream']) { n += 1; if (JSON.stringify(now.surfaces[s].cases[id][m].findings) !== JSON.stringify(base.surfaces[s].cases[id][m].findings)) diff += 1; }
  batch1 = { corpusSha256: now.corpus.sha256, sameCorpusAsAccepted: now.corpus.sha256 === base.corpus.sha256, comparedEntries: n, differences: diff, candidateCommit: now.sourceCommit, acceptedCandidateCommit: base.sourceCommit };
}

const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const identity = {
  baseline: { source: 'npm @redact-secret/core 0.1.0-beta.13 (+ @redact-secret/wasm, node-darwin-arm64), PyPI redact-secret 0.1.0b13, crates.io redact-secret-cli 0.1.0-beta.13 built with cargo install --locked', integrity: sources.baseline.publishedPin.integrity, versions: Object.fromEntries(Object.entries(published.surfaces).map(([k, v]) => [k, v.version])), observationSha256: sha(values.published) },
  candidate: { source: 'unpublished redact-secret commit a148dadf4a43b5441ed88386d055428b2e278f25 (core main after PR #1231; code identical to 3b1a5aa9, includes the Batch 1 fixes af1e71e0, #1202/#1204/#1206 and the #1227 second-wave detectors)', commit: candidate.sourceCommit, versions: Object.fromEntries(Object.entries(candidate.surfaces).map(([k, v]) => [k, v.version])), observationSha256: sha(values.candidate) },
  platform: candidate.platform,
  node: candidate.node,
  chunkBytes: candidate.chunkBytes,
  corpusSha256: frozen.sha256,
};

writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify({ schema: 'batch2-report-v1', epic: 739, identity, corpus: { sha256: frozen.sha256, cases: frozen.cases, positives: frozen.positives, controls: frozen.controls, unsupported: frozen.unsupported, conflict: frozen.conflict }, tally, batch1Replay: batch1, rows }, null, 2)}\n`);

// ---- ledger ------------------------------------------------------------------
const SURFACE_NOTE = { node: 'Node (napi addon)', wasm: 'WASM', python: 'Python', cli: 'CLI (Rust, redact-secret-cli)' };
const ledger = {
  schemaVersion: 3,
  kind: 'batch2-disposition-ledger',
  epic: 739,
  complete: true,
  completeMeaning: 'every one of the 58 families has a disposition: measured (30) or not-measured/carrier-unresolved (28). It does not mean all 58 are covered.',
  baseline: identity.baseline,
  candidate: identity.candidate,
  counts: { families: rows.length, measured: measured.length, notMeasuredCarrierUnresolved: rows.length - measured.length, byCoverage: Object.fromEntries([...new Set(measured.map(r => r.coverage))].map(c => [c, measured.filter(r => r.coverage === c).length])) },
  families: rows.map(r => {
    const rd = readiness.families.find(f => f.family === r.family);
    const base = { family: r.family, group: r.group, carrierContract: `${rd.contract.path} (${rd.contract.period}/${rd.contract.lifecycle}, sha256 ${rd.contract.sha12AtEvidenceCommit}, evidence ${readiness.inputs.evidenceCommit.slice(0, 8)}; product contract redact-secret PR #1231 a148dadf, docs/audits/evidence/${rd.coreIssue}/README.md)`, evidenceStatus: r.status, coreIssue: `redact-secret#${rd.coreIssue}`, measurementIssue: `redact-secret-benchmarks#${rd.measurementIssue}` };
    if (!r.measured) return { ...base, caseIds: [], baseline: { measured: false }, candidate: { measured: false }, surfaces: Object.fromEntries([...SURFACES, 'rust'].map(s => [s, 'not measured'])), findings: null, overlapOutcome: 'not measured', streamParity: 'not measured', coverage: 'not-measured, carrier-unresolved', gapIssue: null, unresolvedOrUnsupportedVariants: `carrier-unresolved; follow-up source: ${r.followUp}` };
    const mine = cases.filter(c => c.family === r.family);
    const fam = mine.filter(c => c.kind === 'positive').length;
    return {
      ...base,
      caseIds: mine.map(c => c.id),
      caseCounts: { positive: fam, control: r.controls, unsupportedObserved: r.unsupportedObserved, conflict: r.conflictCases },
      baseline: { measured: true, identity: identity.baseline.versions, positivesPassNodeWhole: `${r.published.node.pass}/${r.positives}`, positivesPassOnEverySurfaceAndStream: r.published.positivesPassOnEverySurface, controlsFlaggedNode: r.published.node.controlFlagged, failingCases: r.published.failing.map(f => f.case) },
      candidate: { measured: true, identity: identity.candidate.commit, positivesPassNodeWhole: `${r.candidate.node.pass}/${r.positives}`, positivesPassOnEverySurfaceAndStream: r.candidate.positivesPassOnEverySurface, controlsFlaggedNode: r.candidate.node.controlFlagged, controlsCleanOnEverySurface: r.candidate.controlsCleanOnEverySurface },
      surfaces: { node: 'measured', wasm: 'measured', python: 'measured', cli: 'measured', rust: 'no separate Rust library harness exists; the CLI binary is the Rust surface' },
      findings: 'per-case findings (start, end, type, action; no matched text) are in observations-published.json and observations-candidate.json; contract expectation per case is in benchmarks/batch2/corpus.mjs',
      overlapOutcome: `${r.overlap.positivesWithMoreThanOneFinding} positives with more than one finding on the expected span (candidate, Node)`,
      streamParity: `candidate whole==stream ${r.parity.candidateStreamEqualsWholeEntries} entries; four surfaces identical on ${r.parity.candidateCrossSurfaceIdenticalCases} cases`,
      coverage: r.coverage,
      boundary: r.boundary,
      contractEvidenceConflict: r.contractEvidenceConflict,
      gapIssue: r.coverage.startsWith('fixed in candidate') ? 'redact-secret#1212 (Elastic ApiKey envelope, fixed by PR #1215); reused, no new issue' : null,
      unresolvedOrUnsupportedVariants: r.observedUnsupported.map(o => `${o.case} (${o.kind}; ${o.candidateFindings.length ? 'findings observed, not scored' : 'no finding, not scored'})`),
    };
  }),
};
writeFileSync(path.join(outDir, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);

// ---- markdown ------------------------------------------------------------------
const md = [];
md.push('# Batch 2 (#739): measured results');
md.push('');
md.push(`Frozen corpus \`sha256:${frozen.sha256}\` (${frozen.cases} cases: ${frozen.positives} positives, ${frozen.controls} controls, ${frozen.unsupported} unsupported, ${frozen.conflict} conflict), committed before any scan. Expectations come from the evidence handoff (credential-evidence \`${readiness.inputs.evidenceCommit.slice(0, 8)}\`) and the adopted product contract (redact-secret #1231, \`a148dadf\`), never from observed output.`);
md.push('');
md.push(`- Baseline: ${identity.baseline.source}. Versions: ${JSON.stringify(identity.baseline.versions)}.`);
md.push(`- Candidate: ${identity.candidate.source}. Versions: ${JSON.stringify(identity.candidate.versions)}.`);
md.push(`- Platform ${identity.platform}, Node ${identity.node}, streamed in ${identity.chunkBytes}-byte chunks. Surfaces measured: Node, WASM, Python, CLI (Rust). No separate Rust-library harness exists. Peers: not run (TruffleHog on PATH printed 3.97.6; product-only diagnostics, no peer classification).`);
if (batch1) md.push(`- Batch 1 replay on the candidate: same corpus as the accepted #717 run (${batch1.sameCorpusAsAccepted}); ${batch1.comparedEntries} surface x case x mode entries compared with the accepted \`af1e71e0\` observations, ${batch1.differences} differences.`);
md.push('');
md.push('## Per group');
md.push('');
md.push('| group | families | measured | not measured (carrier-unresolved) | already-covered / no-code | fixed by an existing core fix | contract-evidence conflict | reproduced gap |');
md.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const [g, t] of Object.entries(tally)) md.push(`| ${g} | ${t.total} | ${t.measured} | ${t.notMeasuredCarrierUnresolved} | ${t['already-covered / no-code'] ?? 0} | ${t['fixed in candidate by an existing core fix (no new gap)'] ?? 0} | ${t['contract-evidence conflict'] ?? 0} | ${t['reproduced product gap'] ?? 0} |`);
md.push('');
md.push('## Measured rows');
md.push('');
md.push('| family | group | positives pass baseline | positives pass candidate | controls flagged (baseline / candidate) | whole = stream, 4 surfaces identical (candidate) | disposition |');
md.push('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of measured) md.push(`| \`${r.family}\` | ${r.group} | ${r.published.node.pass}/${r.positives} | ${r.candidate.node.pass}/${r.positives} | ${r.published.node.controlFlagged} / ${r.candidate.node.controlFlagged} | ${r.parity.candidateStreamEqualsWholeEntries}; ${r.parity.candidateCrossSurfaceIdenticalCases} | ${r.coverage}${r.boundary ? `; ${r.boundary}` : ''}${r.contractEvidenceConflict ? '; conflict recorded' : ''} |`);
md.push('');
md.push('## Contract-evidence conflicts (recorded, not resolved)');
md.push('');
for (const [f, text] of Object.entries(CONFLICTS)) md.push(`- \`${f}\`: ${text}`);
md.push('');
md.push('## Not measured');
md.push('');
md.push(`${rows.length - measured.length} rows are carrier-unresolved per credential-evidence#235 and stay unmeasured: not false negatives, true negatives or passing coverage. The follow-up source for each is in \`ledger.json\` and \`readiness.md\`.`);
md.push('');
writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));
console.log(JSON.stringify(tally));
