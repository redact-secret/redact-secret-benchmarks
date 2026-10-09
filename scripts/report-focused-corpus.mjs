#!/usr/bin/env node
// `node scripts/report-focused-corpus.mjs --published <obs.json> --candidate <obs.json> --out-dir <dir>` (#717).
// Scores two observation files (scripts/measure-focused-corpus.mjs) against the authored expectations and writes the
// per-case, per-surface report: detection, exact span, resolved action, finding type, overlaps, whole/stream
// parity, cross-surface agreement and the published-to-candidate change. It records no matched text.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { measurementOutput, stagedMeasurementDirectory } from './lib/measurement-output.mjs';

const { values } = parseArgs({ options: { published: { type: 'string' }, candidate: { type: 'string' }, 'out-dir': { type: 'string', default: `results-output/focused-report-${Date.now()}` }, corpus: { type: 'string' }, scorer: { type: 'string' }, 'run-id': { type: 'string' } } });
const root = fileURLToPath(new URL('../', import.meta.url));
if (!values['run-id'] || !/^[a-zA-Z0-9._-]+$/.test(values['run-id'])) throw new Error('--run-id requires an explicit run identity');
const corpusFile = path.resolve(root, values.corpus ?? 'benchmarks/corpora/provider-shapes/corpus.mjs');
const scorerFile = path.resolve(root, values.scorer ?? 'benchmarks/corpora/provider-shapes/score.mjs');
const { cases, corpusDigest, FAMILY_IDS: authoredFamilies } = await import(pathToFileURL(corpusFile).href);
const FAMILY_IDS = authoredFamilies ?? [...new Set(cases.map(k => k.family))];
const { parity, scoreCase } = await import(pathToFileURL(scorerFile).href);
const output = measurementOutput(values['out-dir'], root, { directory: true });
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const runs = { published: read(values.published), candidate: read(values.candidate) };
for (const [label, run] of Object.entries(runs)) {
  if (!/^[a-f0-9]{40}$/.test(run.sourceCommit ?? '')) throw new Error(`${label}: exact product source commit required`);
  if (!run.surfaces?.node || !Object.keys(run.surfaces).length) throw new Error(`${label}: measured Node binding required for comparable changes`);
  if (!['batch1-observations-v1', 'batch2-observations-v1', 'batch2-observations-v2'].includes(run.schema)) throw new Error(`${label}: unknown observation schema`);
  if (run.corpus.sha256 !== corpusDigest()) throw new Error(`${label}: observations were taken on a different corpus (${run.corpus.sha256.slice(0, 12)} vs ${corpusDigest().slice(0, 12)})`);
}

/** One short signature of a scored case, comparable across surfaces and engines. */
const signature = (kase, score) => (kase.kind === 'positive' ? `${(score.spanOutcomes ?? [score.span]).join(',')}/${score.action}/${score.type}/pass:${score.pass}/covered:${score.fullyCovered}/leaked:${score.leakedBytes ?? 0}` : kase.kind === 'control' ? (score.flagged ? 'flagged' : 'clean') : `observed:${score.observed}`);

function evaluate(run) {
  const out = {};
  for (const [surface, data] of Object.entries(run.surfaces)) {
    out[surface] = { version: data.version, rangeUnit: data.rangeUnit, cases: {} };
    for (const kase of cases) {
      const observation = data.cases[kase.id];
      const whole = scoreCase(kase, observation.whole);
      out[surface].cases[kase.id] = { whole, signature: signature(kase, whole), streamAgrees: parity(observation.whole, observation.stream), findings: observation.whole.findings.length };
    }
  }
  return out;
}
const scored = { published: evaluate(runs.published), candidate: evaluate(runs.candidate) };

function familyRow(label, surface, family) {
  const mine = cases.filter(k => k.family === family);
  const rows = mine.map(k => ({ k, c: scored[label][surface].cases[k.id] }));
  const pos = rows.filter(r => r.k.kind === 'positive');
  const ctl = rows.filter(r => r.k.kind === 'control');
  return {
    positives: pos.length,
    exact: pos.filter(r => (r.c.whole.spanOutcomes ?? [r.c.whole.span]).every(span => span === 'exact')).length,
    missed: pos.filter(r => (r.c.whole.spanOutcomes ?? [r.c.whole.span]).some(span => span === 'miss')).length,
    inexact: pos.filter(r => { const spans = r.c.whole.spanOutcomes ?? [r.c.whole.span]; return !spans.includes('miss') && spans.some(span => span !== 'exact'); }).length,
    actionOk: pos.filter(r => r.c.whole.actionOk).length,
    genericType: pos.every(r => Object.hasOwn(r.c.whole, 'typeGeneric')) ? pos.filter(r => r.c.whole.typeGeneric).length : null,
    typeOk: pos.every(r => Object.hasOwn(r.c.whole, 'typeOk')) ? pos.filter(r => r.c.whole.typeOk).length : null,
    controls: ctl.length,
    controlsFlagged: ctl.filter(r => r.c.whole.flagged).length,
    streamDisagrees: rows.filter(r => !r.c.streamAgrees).length,
  };
}

const families = {};
for (const family of FAMILY_IDS) {
  families[family] = {};
  for (const label of Object.keys(scored)) {
    families[family][label] = Object.fromEntries(Object.keys(scored[label]).map(surface => [surface, familyRow(label, surface, family)]));
  }
}

const crossSurface = {};
for (const label of Object.keys(scored)) {
  const surfaces = Object.keys(scored[label]);
  crossSurface[label] = cases.filter(k => new Set(surfaces.map(s => scored[label][s].cases[k.id].signature)).size > 1).map(k => ({ id: k.id, signatures: Object.fromEntries(surfaces.map(s => [s, scored[label][s].cases[k.id].signature])) }));
}

const changes = cases.map(k => ({ id: k.id, family: k.family, kind: k.kind, published: scored.published.node.cases[k.id].signature, candidate: scored.candidate.node.cases[k.id].signature })).filter(c => c.published !== c.candidate);
const worse = changes.filter(c => {
  const k = cases.find(x => x.id === c.id);
  if (k.kind === 'positive') return scored.published.node.cases[k.id].whole.pass && !scored.candidate.node.cases[k.id].whole.pass;
  if (k.kind === 'control') return c.published === 'clean' && c.candidate === 'flagged';
  return false;
});

const report = {
  schema: 'focused-corpus-report-v1',
  runId: values['run-id'],
  identities: { corpusModule: path.relative(root, corpusFile), corpusModuleSha256: createHash('sha256').update(readFileSync(corpusFile)).digest('hex'), scorerModule: path.relative(root, scorerFile), scorerModuleSha256: createHash('sha256').update(readFileSync(scorerFile)).digest('hex'), observations: Object.fromEntries(Object.entries({published: values.published, candidate: values.candidate}).map(([label, file]) => [label, createHash('sha256').update(readFileSync(file)).digest('hex')])) },
  corpus: runs.published.corpus,
  engines: Object.fromEntries(Object.entries(runs).map(([label, run]) => [label, { sourceCommit: run.sourceCommit, platform: run.platform, node: run.node, surfaces: Object.fromEntries(Object.entries(run.surfaces).map(([s, d]) => [s, { version: d.version, rangeUnit: d.rangeUnit, artifact: d.artifact ?? null }])) }])),
  families,
  perCase: Object.fromEntries(cases.map(k => [k.id, { family: k.family, kind: k.kind, layout: k.layout, published: Object.fromEntries(Object.keys(scored.published).map(s => [s, scored.published[s].cases[k.id]])), candidate: Object.fromEntries(Object.keys(scored.candidate).map(s => [s, scored.candidate[s].cases[k.id]])) }])),
  crossSurfaceDisagreements: crossSurface,
  publishedToCandidate: { changed: changes, worse },
};


const cell = r => `${r.exact}/${r.positives} exact, ${r.missed} miss${r.inexact ? `, ${r.inexact} inexact` : ''} · ${r.controlsFlagged}/${r.controls} controls flagged`;
const lines = ['# Focused corpus measurement report', '', `Corpus \`sha256:${report.corpus.sha256.slice(0, 16)}\`, ${report.corpus.cases} cases. Generated by \`scripts/report-focused-corpus.mjs\`; no matched text is recorded.`, ''];
for (const label of Object.keys(scored)) {
  lines.push(`## ${label}`, '', Object.entries(report.engines[label].surfaces).map(([s, d]) => `${s} ${d.version}`).join(' · '), '', '| family | ' + Object.keys(scored[label]).join(' | ') + ' |', '| --- | ' + Object.keys(scored[label]).map(() => '---').join(' | ') + ' |');
  for (const family of FAMILY_IDS) lines.push(`| \`${family}\` | ` + Object.keys(scored[label]).map(s => cell(families[family][label][s])).join(' | ') + ' |');
  lines.push('', `Stream-versus-whole disagreements: ${Object.entries(scored[label]).map(([s]) => `${s} ${FAMILY_IDS.reduce((n, f) => n + families[f][label][s].streamDisagrees, 0)}`).join(', ')}. Cross-surface disagreements: ${crossSurface[label].length}.`, '');
}
lines.push('## Published to candidate (Node surface)', '', changes.length ? '| case | published | candidate |\n| --- | --- | --- |\n' + changes.map(c => `| \`${c.id}\` | ${c.published} | ${c.candidate} |`).join('\n') : 'No case changed.', '', `Regressions (a pass that no longer passes, or a clean control now flagged): ${worse.length}.`, '');
lines.push('## Per case (published, Node)', '', '| case | kind | outcome |', '| --- | --- | --- |', ...cases.map(k => `| \`${k.id}\` | ${k.kind} | ${scored.published.node.cases[k.id].signature} |`), '');
stagedMeasurementDirectory(output, dir => {
copyFileSync(values.published, path.join(dir, 'observations-published.json'));
copyFileSync(values.candidate, path.join(dir, 'observations-candidate.json'));
writeFileSync(path.join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

writeFileSync(path.join(dir, 'report.md'), lines.join('\n'));
});
console.log(lines.slice(0, 40).join('\n'));
