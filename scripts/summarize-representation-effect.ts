/**
 * What the representation contract (credential-eval v1.3, ADR 0005; credential-eval#34, credential-evidence#150) changes in an adoption's measurement, kept apart from
 * the corpus effect and from the product. It adds `replay.representationEffect` to a change report. Reporting only: nothing here asserts product behaviour, and a
 * decoded or fragment semantic is claimed only where the engine verified it (the run artifact's own `manifest.representation` counts and the findings' `mapping`).
 *
 *   node --import tsx scripts/summarize-representation-effect.ts --report FILE --snapshot SNAPSHOT.json --previous-engine DIR --candidate DIR [--previous-engine-new-corpus DIR]
 *
 * Each DIR holds `artifact.json` (the plain run). `previous-engine` is the superseded candidate (same corpus family) measured by the previous engine; `candidate` is the
 * candidate corpus on the new engine; `previous-engine-new-corpus` (optional) is the superseded candidate's corpus on the new engine, which separates the engine
 * effect (same corpus) from the corpus effect (same engine).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readRunArtifact, type RunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { outcomeSignature } from './evidence-adoption.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const arg = (name: string, required = true) => { const i = process.argv.indexOf(`--${name}`); if (i < 0) { if (required) throw new Error(`--${name} is required`); return undefined; } return process.argv[i + 1]; };
const report: Json = JSON.parse(readFileSync(arg('report')!, 'utf8'));
const snapshot: Json = JSON.parse(readFileSync(arg('snapshot')!, 'utf8'));
const load = (dir: string): RunArtifact => readRunArtifact(readFileSync(path.join(dir, 'artifact.json'))).artifact;
const D = load(arg('previous-engine')!), C = load(arg('candidate')!);
const E = arg('previous-engine-new-corpus', false) ? load(arg('previous-engine-new-corpus', false)!) : null;

/** The class(es) of representation fact a case carries, from the snapshot. A case with no facts is `none`. */
function classes(c: Json): string[] {
  const r = c.representation;
  if (!r) return ['none'];
  const out = new Set<string>();
  for (const s of r.transformation?.steps ?? []) {
    if (s.op === 'encode') out.add(`encode:${s.codec}`);
    else if (s.op === 'fragment') out.add('fragment');
    else if (['escape', 'normalize', 'insert-codepoints'].includes(s.op)) out.add(s.op);
    else out.add('carrier-or-placement');
  }
  if (r.input_validity) out.add(`expected-rejection:${r.input_validity}`);
  if (r.chunking) out.add('chunked');
  for (const e of c.expected ?? []) {
    if (e.fragments?.length) out.add('expected-span-with-fragments');
    if (e.decoded) for (const v of e.decoded.via) out.add(`expected-span-decoded-via:${v.codec}`);
  }
  if (!out.size) out.add('authored-base');
  return [...out].sort();
}
const caseClasses = new Map<string, string[]>(snapshot.cases.map((c: Json) => [c.id, classes(c)]));

const bucket = (r: Json): string => {
  const sig = outcomeSignature(r);
  if (sig === 'pending' || sig === 'not-measured') return sig;
  if (sig.startsWith('positive:')) { const o = sig.slice(9).split(','); return o.every(x => x === 'EXACT') ? 'positive:exact' : o.every(x => x === 'MISS') ? 'positive:miss' : 'positive:other'; }
  return sig;
};
const sorted = <T>(o: Record<string, T>) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const bump = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] ?? 0) + n; };

/** Per scanner and fact class: how many cases sit in each outcome bucket. A bucket `pending` or `not-measured` is in no denominator. */
function buckets(a: RunArtifact) {
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const s of a.scanners) {
    const byClass: Record<string, Record<string, number>> = {};
    for (const c of s.cases) for (const k of caseClasses.get(c.case_id) ?? ['none']) bump((byClass[k] ??= {}), bucket(c));
    out[s.scanner] = sorted(Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, sorted(v)])));
  }
  return out;
}

/** Findings the adapters placed from decoded coordinates, by mapping, per scanner (candidate run). */
function mappings(a: RunArtifact) {
  const out: Record<string, Json> = {};
  for (const s of a.scanners) {
    const byMapping: Record<string, number> = {}, casesByBucket: Record<string, number> = {}, cases = new Set<string>();
    for (const c of s.cases as Json[]) for (const f of c.actual ?? []) if (f.mapping) {
      bump(byMapping, `${f.mapping.bound} | layers ${f.mapping.layers} | ${(f.mapping.codecs ?? []).join('+')}`);
      if (!cases.has(c.case_id)) { cases.add(c.case_id); bump(casesByBucket, bucket(c)); }
    }
    out[s.scanner] = { findingsByMapping: sorted(byMapping), cases: cases.size, casesByOutcome: sorted(casesByBucket) };
  }
  return out;
}

/** Outcome transitions of the same cases between two runs, by scanner, with the fact classes of the cases that moved. */
function transitions(from: RunArtifact, to: RunArtifact, only?: Set<string>) {
  const out: Record<string, Json> = {};
  for (const s of to.scanners) {
    const before = new Map<string, string>((from.scanners.find(x => x.scanner === s.scanner)?.cases ?? []).map(c => [c.case_id, bucket(c)]));
    const moves: Record<string, number> = {}, byClass: Record<string, number> = {}, cases: Record<string, string[]> = {};
    let compared = 0, same = 0;
    for (const c of s.cases) {
      if (only && !only.has(c.case_id)) continue;
      const was = before.get(c.case_id); if (was === undefined) continue;
      compared++;
      const now = bucket(c);
      if (was === now) { same++; continue; }
      const key = `${was} -> ${now}`;
      bump(moves, key);
      for (const k of caseClasses.get(c.case_id) ?? ['none']) bump(byClass, `${key} | ${k}`);
      (cases[key] ??= []).push(c.case_id);
    }
    out[s.scanner] = { compared, unchanged: same, moves: sorted(moves), movesByFactClass: sorted(byClass), cases: Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, v.sort().slice(0, 40)])) };
  }
  return out;
}

const unmeasured = (a: RunArtifact) => Object.fromEntries(a.scanners.map(s => { const reasons: Record<string, number> = {}; for (const u of s.unmeasured_cases ?? []) bump(reasons, String(u.reason)); return [s.scanner, { unmeasured: s.unmeasured_cases?.length ?? 0, reasons: sorted(reasons) }]; }));
const changedByCorpus = new Set<string>((report.supersededCandidateDiff?.diff?.changed ?? []).map((x: Json) => x.id));
const manifestOf = (a: RunArtifact) => (a as Json).manifest?.representation ?? null;

report.replay = {
  ...(report.replay ?? {}),
  representationEffect: {
    note: 'The representation contract (credential-eval v1.3) kept apart from the corpus and the product. Facts are the release\'s; verified means the engine re-derived them (manifest.representation); mapped findings carry a mapping and are scored by the unchanged lattice against the span as authored. Cases whose expectation is pending (T0) or an expected rejection, and cases a scanner left unmeasured, are in no denominator and never a zero detection. Nothing here is a product assertion.',
    engines: { previous: { manifestRepresentation: manifestOf(D) }, candidate: { manifestRepresentation: manifestOf(C) } },
    factClasses: Object.fromEntries([...new Set([...caseClasses.values()].flat())].sort().map(k => [k, [...caseClasses.values()].filter(v => v.includes(k)).length])),
    unmeasuredPlain: { previousEngine: unmeasured(D), previousEngineNewCorpus: E ? unmeasured(E) : null, candidate: unmeasured(C) },
    mappedFindings: { previousEngine: mappings(D), candidate: mappings(C) },
    outcomesByFactClass: { previousEngine: buckets(D), previousEngineNewCorpus: E ? buckets(E) : null, candidate: buckets(C) },
    engineEffect: E ? { note: 'The superseded candidate corpus measured by the previous engine versus by the new engine: the same cases, the same expectations.', scanners: transitions(D, E) } : null,
    corpusEffect: E ? { note: 'The new engine on the superseded candidate corpus versus on this candidate corpus: the engine fixed. Cases whose expectation the release changed (representation facts on expected spans) are listed apart from the rest.', changedExpectationCases: changedByCorpus.size, scanners: transitions(E, C), changedExpectationOnly: transitions(E, C, changedByCorpus) } : null,
    combined: { note: 'The superseded candidate (previous engine, previous release) versus this candidate (new engine, new release): both effects together.', scanners: transitions(D, C) },
  },
};
writeFileSync(arg('report')!, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ unmeasured: report.replay.representationEffect.unmeasuredPlain, mapped: report.replay.representationEffect.mappedFindings.candidate, combined: Object.fromEntries(Object.entries(report.replay.representationEffect.combined.scanners).map(([k, v]: any) => [k, v.moves])) }, null, 1));
