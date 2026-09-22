import { escapeHtml as e } from '../components';
import criteria from '../../benchmarks/performance-criteria.json';
import type { AcceptanceCriteria, PerformanceCriterion } from '../../benchmarks/lib/performance-acceptance.ts';

/**
 * Performance acceptance criteria (issue #136, paired with redact-secret#603
 * / DS11). This repository owns these thresholds now; the page reads them
 * straight from the committed `benchmarks/performance-criteria.json`, the
 * same file `npm run performance:evaluate` checks a fresh run against, so
 * nothing here can drift from what CI actually enforces.
 */
const DATA = criteria as unknown as AcceptanceCriteria;

const n = (value: number) => value.toLocaleString('en-US');
const mib = (bytes: number) => `${(bytes / (1024 * 1024)).toLocaleString('en-US')} MiB`;
const MEMORY_LABEL: Record<string, string> = {
  nodeHeap: 'Node heap', nodeRss: 'Node RSS', nodeExternal: 'Node external', browserJsHeap: 'Browser JS heap',
  wasmLinearMemory: 'WASM linear memory', pythonHeap: 'Python heap', processRss: 'Process RSS', streamingBuffer: 'Streaming buffer',
};

function row(criterion: PerformanceCriterion): string {
  const caps = Object.entries(criterion.memoryCapsBytes).map(([category, cap]) => `${MEMORY_LABEL[category] ?? category} ${mib(cap!)}`).join(', ') || '—';
  return `<tr><td><code>${e(criterion.surface)}</code></td><td><code>${e(criterion.profileId)}</code></td><td>${n(criterion.maxInitializationP95Ms)} ms</td><td>${n(criterion.maxProcessingP95Ms)} ms</td><td>${n(criterion.minThroughputBytesPerSecond)} B/s</td><td>${e(caps)}</td></tr>`;
}

/** Fixed RC performance/resource acceptance criteria this repository owns. No evaluation result is fetched: publishing a live run's verdict here is a follow-up, not this page's job. */
export function performancePage(): string {
  return `<div class="page-head"><div><p class="eyebrow">REDACT-SECRET#603 (DS11) · #136</p><h1>Performance acceptance</h1><div class="meta"><span>Criteria <code>${e(DATA.criteriaId)}</code> · fixed ${e(DATA.fixedAt)} · environment <code>${e(DATA.environment.id)}</code></span></div></div></div>
  <section class="section prose"><h2 class="h2-compact">Ownership</h2><p>This repository owns performance results, acceptance criteria, recalibration, and publication for the product's cross-language assessment; core (<code>redact-secret/redact-secret</code>) keeps the per-surface runners, the result schema, the workload generator and profiles, and the accuracy corpus. <b class="strong">Linux x86_64 is the only official profile.</b> Full rationale: <code>docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md</code>. Protocol: <code>docs/specs/performance-acceptance.md</code>.</p></section>
  <section class="section prose"><h2 class="h2-compact">Derivation</h2><p>Derived mechanically from one complete, ${n(DATA.derivation.repetitions)}-repetition, release-build run (never hand-picked): timing ceilings at the observed ${e(DATA.derivation.percentile)}, doubled and rounded up; throughput floors at half the observed minimum, rounded down; memory caps at 2.5x the observed maximum, rounded up to the nearest mebibyte.</p><p class="small">${e(DATA.derivation.margin)}</p></section>
  <section class="section"><h2 class="h2-compact">Baseline provenance</h2><div class="tbl"><table><tbody>
    <tr><th scope="row">Source commit</th><td><code>${e(DATA.baseline.sourceCommit)}</code></td></tr>
    <tr><th scope="row">Accuracy corpus</th><td>version ${e(DATA.baseline.accuracyCorpusVersion)}, <code>${e(DATA.baseline.accuracyCorpusHash)}</code></td></tr>
    <tr><th scope="row">Workload profiles</th><td>version ${e(DATA.baseline.workloadProfilesVersion)}, <code>${e(DATA.baseline.workloadProfilesHash)}</code></td></tr>
    <tr><th scope="row">Raw evidence</th><td><code>${e(DATA.baseline.summaryPath)}</code> — see <code>evidence/603/README.md</code></td></tr>
  </tbody></table></div></section>
  <section class="section"><h2 class="h2-compact">Thresholds</h2><div class="tbl"><table><thead><tr><th scope="col">Surface</th><th scope="col">Profile</th><th scope="col">Init p95 ≤</th><th scope="col">Processing p95 ≤</th><th scope="col">Throughput ≥</th><th scope="col">Memory caps ≤</th></tr></thead><tbody>${DATA.performance.map(row).join('')}</tbody></table></div></section>
  <section class="section prose"><h2 class="h2-compact">Running an evaluation</h2><p>A fresh candidate run is evaluated against these criteria the same way <code>evidence/603/summary.json</code> — this baseline's own run — was: <code>npm run performance:evaluate -- --summary &lt;path&gt;/summary.json</code>. <code>.github/workflows/performance-evaluation.yml</code> runs this in CI against the exact commit <code>benchmarks/pin-manifest.json</code> pins.</p></section>`;
}
