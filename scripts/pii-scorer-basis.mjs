#!/usr/bin/env node
// The per-metric comparison behind the PII scorer-basis decision (#795), derived and never typed:
//
//   node scripts/pii-scorer-basis.mjs [--write | --check] [--before-ref=<git ref holding the schema 1.2 artifacts>]
//
// For each of the four populations and each family cell it sets the benchmark scorer's number (`b11`, the frozen Beta.13 report
// `evidence/901/428/core-401158d09a67/pii-beta11-report-v2.json`) next to the `pii-v1` number of the committed schema 1.4 artifact, metric by
// metric, with the numerator, the denominator or eligible count, the effective N and the interval. It also records, for the `pii-v1` side, the
// numbers of the schema 1.2 artifacts before range-less memberships were carried (`--before-ref`; kept in the record with the retired semantic
// digests, which `--check` verifies against the pins). It states a difference and decides nothing: no threshold, tolerance, membership or
// verdict is read or written, and cells are never pooled across families or populations.
import { OFFICIAL_ARTIFACT, officialRecordExists } from './lib/pii-official-record.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ambiguousIds } from '../benchmarks/evaluation/domains/pii/metric-basis.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'docs/generated/pii-scorer-basis.json';
const readJson = file => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const fixed = d => (d ? Number(`${d.mantissa}e-${d.scale}`) : null);

const migration = readJson('benchmarks/pii-eval-migration.json');
const b11Report = readJson(migration.benchmarkPopulations.report.path);
if (sha256(readFileSync(path.join(ROOT, migration.benchmarkPopulations.report.path))) !== migration.benchmarkPopulations.report.sha256) throw new Error('the frozen Beta.13 report drifted');
const pins = readJson('benchmarks/pii-eval-population-pins.json');
const VIEWS = migration.benchmarkPopulations.views.map(v => v.id);
const FAMILIES = b11Report.families.map(f => f.family);
const METRICS = migration.engine.metrics;

const piiCell = m => ({
  numerator: m.counts.numerator, eligible: m.counts.eligible, effectiveN: m.effectiveN, total: m.counts.total, notApplicable: m.counts.notApplicable, unresolved: m.counts.unresolved,
  status: m.status, point: m.value.state === 'measured' ? fixed(m.value.point) : null, bound: m.value.state === 'measured' ? fixed(m.value.bound) : null, withheld: m.value.state === 'withheld' ? m.value.reason : null,
});

function rowsOf(artifact) {
  return new Map(artifact.semantic.productProjection.rows.map(row => [row.family, row]));
}

function build(beforeRef) {
  const populations = [];
  for (const view of VIEWS) {
    // The artifact the consumer pins name now: the recorded official execution when there is one, else the exploratory replay.
    const after = JSON.parse(readFileSync(path.join(ROOT, officialRecordExists(ROOT) ? OFFICIAL_ARTIFACT(view) : `benchmarks/pii-eval-population-dual-run/${view}.public-synthetic-artifact.json`), 'utf8'));
    const afterRows = rowsOf(after);
    let before = null, beforeRows = null;
    if (beforeRef) {
      before = JSON.parse(execFileSync('git', ['show', `${beforeRef}:benchmarks/pii-eval-population-dual-run/${view}.public-synthetic-artifact.json`], { encoding: 'utf8', maxBuffer: 1 << 28, cwd: ROOT }));
      beforeRows = rowsOf(before);
    }
    const cells = [];
    for (const family of FAMILIES) {
      const b11View = b11Report.families.find(f => f.family === family).views.reviewed.find(v => v.view === view);
      const row = afterRows.get(family);
      for (const id of METRICS) {
        const b = b11View.metrics.find(m => m.id === id) ?? null;
        const p = piiCell(row.metrics.find(m => m.metric.id === id));
        const q = beforeRows?.get(family)?.metrics.find(m => m.metric.id === id);
        cells.push({
          family, metric: id,
          b11: b ? { numerator: b.numerator, denominator: b.denominator, point: b.value?.point ?? null, bound: b.value?.bound ?? null, status: b.status } : null,
          piiV1: p,
          ...(q ? { piiV1Before: { numerator: q.counts.numerator, eligible: q.counts.eligible, effectiveN: q.effectiveN, total: q.counts.total, unresolved: q.counts.unresolved, point: q.value.state === 'measured' ? fixed(q.value.point) : null } } : {}),
          sameCounts: b ? b.numerator === p.numerator && b.denominator === p.eligible : false,
        });
      }
    }
    const summary = Object.fromEntries(METRICS.map(id => {
      const own = cells.filter(c => c.metric === id);
      return [id, { cells: own.length, b11Cells: own.filter(c => c.b11).length, sameCounts: own.filter(c => c.sameCounts).length,
        piiV1MeasuredCells: own.filter(c => c.piiV1.eligible > 0).length }];
    }));
    populations.push({
      view, artifactSemanticDigest: after.semanticDigest, memberships: after.semantic.populationCounts.authoredCases,
      unresolvedRangeMemberships: after.semantic.outcomes.filter(o => o.range === 'unresolved').length,
      b11NotEstablished: Object.fromEntries(FAMILIES.map(f => { const v = b11Report.families.find(x => x.family === f).views.reviewed.find(x => x.view === view); return [f, { cases: v.notEstablished.cases, falseAlarm: v.notEstablished.falseAlarm, scoredCases: v.scoredCases, unscoredCases: v.unscoredCases }]; })),
      ...(before ? { beforeArtifactSemanticDigest: before.semanticDigest, beforeSchemaVersion: before.schemaVersion, beforeMemberships: before.semantic.populationCounts.authoredCases } : {}),
      summary, cells,
    });
  }
  return populations;
}

function record(beforeRef, previous) {
  const populations = build(beforeRef);
  const before = beforeRef ? null : previous;
  return {
    schemaVersion: 1, reportType: 'pii-scorer-basis-comparison', supportClaims: false, authorityChanged: false,
    note: 'Descriptive. Two scorers use the same ten metric ids for different quantities (benchmarks/evaluation/domains/pii/metric-basis.mjs). This record decides nothing: no threshold, membership or verdict is read or written, and cells are never pooled across families or populations. The decision on which protocol defines a product value is docs/decisions/2026-10-07-propose-the-pii-scorer-basis-and-metric-semantics.md.',
    identities: {
      engine: { commit: migration.pins.piiEvalProjection, artifactSchema: migration.engine.artifactSchema.version },
      b11Report: { path: migration.benchmarkPopulations.report.path, sha256: migration.benchmarkPopulations.report.sha256 },
      artifacts: pins.populations.map(p => ({ view: p.label, semanticDigest: p.artifactDigest, retiredSemanticDigests: p.retiredArtifactDigests })),
    },
    metricsWithDifferentDefinitions: ambiguousIds(),
    populations: before ? populations.map((p, i) => ({ ...p, ...Object.fromEntries(Object.entries(before.populations[i]).filter(([k]) => k.startsWith('before'))),
      cells: p.cells.map((c, j) => ({ ...c, ...(before.populations[i].cells[j].piiV1Before ? { piiV1Before: before.populations[i].cells[j].piiV1Before } : {}) })) })) : populations,
  };
}

const sortKeys = v => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v);
const text = value => `${JSON.stringify(sortKeys(value), null, 1)}\n`;
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'print';
const previous = (() => { try { return readJson(OUT); } catch { return null; } })();
const next = record(arg('before-ref'), previous);
if (mode === 'write') { writeFileSync(path.join(ROOT, OUT), text(next)); console.log(`wrote ${OUT}`); }
else if (mode === 'check') {
  if (!previous) throw new Error(`${OUT} is absent`);
  if (text(next) !== text(previous)) throw new Error(`${OUT} differs from a fresh derivation (run: node scripts/pii-scorer-basis.mjs --write)`);
  // The `before` figures are the schema 1.2 artifacts, which are no longer in the tree: each must name a retired semantic digest of its pin.
  for (const p of previous.populations) {
    const pin = pins.populations.find(x => x.label === p.view);
    if (p.beforeArtifactSemanticDigest && !pin.retiredArtifactDigests.includes(p.beforeArtifactSemanticDigest)) throw new Error(`${p.view}: the recorded before-artifact is not a retired digest of its pin`);
  }
  console.log(`${OUT} equals a fresh derivation`);
} else console.log(text(next).slice(0, 2000));
