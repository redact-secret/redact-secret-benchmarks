import { escapeHtml as e } from '../components';
import criteria from '../../benchmarks/performance-criteria.json';
import operational from '../../benchmarks/operational-evidence.json';
import accepted from '../../evidence/603/verified-4227160/summary.json';
import type { AcceptanceCriteria, PerformanceCriterion } from '../../benchmarks/lib/performance-acceptance.ts';
import type { CompleteAssessment } from '../../benchmarks/lib/performance-schema.ts';
import { measuredRows, workloadGuidance, type MeasuredRow } from '../../benchmarks/lib/measured-performance.ts';

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
const ms = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ms`;
const RESOLVED_ARTIFACT_LABEL: Record<string, string> = { 'node-addon': 'N-API addon', wasm: 'WebAssembly fallback' };

/**
 * Measured columns (#405): the currently accepted run's own summary, pinned in the same directory as the acceptance
 * verdict `benchmarks/performance-criteria.json` `baseline.verificationPath` names. A test keeps the two in step.
 */
const ACCEPTED = accepted as unknown as CompleteAssessment;
const MEASURED = new Map<string, MeasuredRow>(measuredRows(ACCEPTED).map(r => [`${r.surface}/${r.profileId}`, r]));
const notMeasured = '<span class="st st-nm" data-status="not-measured">Not measured</span>';
const mbps = (bytesPerSecond: number) => `${(bytesPerSecond / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })} MB/s`;

/** Operational evidence (#141), the beta.7 baseline: its own section, never mixed into the accepted-run columns. */
const OPS = operational as any;

function row(criterion: PerformanceCriterion): string {
  const caps = Object.entries(criterion.memoryCapsBytes).map(([category, cap]) => `${MEMORY_LABEL[category] ?? category} ${mib(cap!)}`).join(', ') || '—';
  const measured = MEASURED.get(`${criterion.surface}/${criterion.profileId}`);
  const processingMeasured = measured ? `${ms(measured.processingMedianMs)} / ${ms(measured.processingP95Ms)}` : notMeasured;
  const throughputMeasured = measured ? `${n(Math.round(measured.throughputMedianBytesPerSecond))} B/s` : notMeasured;
  const dispatch = measured ? `<span title="${e(measured.dispatch.detail)}">${e(measured.dispatch.label)}</span>` : '—';
  const artifact = criterion.surface !== 'node' ? '—' : measured?.resolvedArtifact
    ? e(RESOLVED_ARTIFACT_LABEL[measured.resolvedArtifact] ?? measured.resolvedArtifact)
    : '<span class="st st-nm" data-status="not-measured">Not recorded</span>';
  return `<tr><td><code>${e(criterion.surface)}</code></td><td><code>${e(criterion.profileId)}</code></td><td>${dispatch}</td><td>${n(criterion.maxInitializationP95Ms)} ms</td><td>${n(criterion.maxProcessingP95Ms)} ms</td><td>${n(criterion.minThroughputBytesPerSecond)} B/s</td><td>${e(caps)}</td><td>${processingMeasured}</td><td>${throughputMeasured}</td><td>${artifact}</td></tr>`;
}

/** The measured source line and the workload guidance, both derived from the pinned accepted run (#405). */
function measuredSource(): string {
  const identities = [...new Set([...MEASURED.values()].map(r => `${r.surface} ${r.artifactIdentity}`))].sort();
  return `Measured columns are the accepted run's own summary (<code>evidence/603/verified-4227160/summary.json</code>): product commit <code>${e(ACCEPTED.sourceCommit ?? '')}</code>, ${n(ACCEPTED.repetitions)} repetitions, environment <code>${e(DATA.environment.id)}</code>, artifacts ${identities.map(i => `<code>${e(i)}</code>`).join(', ')} — read the same way the floors are, so it cannot drift from what CI accepted. A floor is half the observed minimum throughput of the run it was derived from, rounded down: a regression tripwire, not the product's speed.`;
}

function guidance(): string {
  const g = workloadGuidance([...MEASURED.values()]);
  const smallWhole = [...MEASURED.values()].filter(r => r.profileId === 'scale-logs-small-whole').map(r => r.throughputMedianBytesPerSecond);
  return `<p class="prose"><b class="strong">Workload guidance.</b> On the one-shot rows above, one core scans ${mbps(g.slowestBytesPerSecond)} to ${mbps(g.fastestBytesPerSecond)} (median; the <code>scale-logs-small-whole</code> profile ranges ${mbps(Math.min(...smallWhole))} to ${mbps(Math.max(...smallWhole))} across surfaces). At those rates, scanning a single-digit-kilobyte AI-context or tool-result payload per request (9 KiB here) costs ${g.smallPayloadMsFastest.toLocaleString('en-US', { maximumFractionDigits: 2 })} to ${g.smallPayloadMsSlowest.toLocaleString('en-US', { maximumFractionDigits: 2 })} ms of processing, which fits inline with a request. An inline high-volume log hot path has a different shape: sustaining 100 MB/s would need about ${Math.ceil(g.coresFor100MbpsFastest)} to ${Math.ceil(g.coresFor100MbpsSlowest)} cores of scanning alone, so that workload needs sampling or an off-request-path placement rather than inline scanning. These are medians of ${n(ACCEPTED.repetitions)} repetitions on shared CI hardware, not a guarantee.</p>`;
}

/** Fixed RC performance/resource acceptance criteria this repository owns, with the currently accepted run's measurements shown beside each floor (#405): a floor is a regression tripwire, not what the product does. */
export function performancePage(): string {
  return `<div class="page-head"><div><p class="eyebrow">REDACT-SECRET#603 (DS11) · #136</p><h1>Performance acceptance</h1><div class="meta"><span>Criteria <code>${e(DATA.criteriaId)}</code> · fixed ${e(DATA.fixedAt)} · environment <code>${e(DATA.environment.id)}</code></span></div></div></div>
  <section class="section prose"><h2 class="h2-compact">Ownership</h2><p>This repository owns performance results, acceptance criteria, recalibration, and publication for the product's cross-language assessment; core (<code>redact-secret/redact-secret</code>) keeps the per-surface runners, the result schema, the workload generator and profiles, and the accuracy corpus. <b class="strong">Linux x86_64 is the only official profile.</b> Full rationale: <code>docs/decisions/2026-09-22-own-performance-evaluation-recalibrate-linux-thresholds.md</code>. Protocol: <code>docs/specs/performance-acceptance.md</code>.</p></section>
  <section class="section prose"><h2 class="h2-compact">Derivation</h2><p>Derived mechanically from one complete, ${n(DATA.derivation.repetitions)}-repetition, release-build run (never hand-picked): timing ceilings at the observed ${e(DATA.derivation.percentile)}, doubled and rounded up; throughput floors at half the observed minimum, rounded down; memory caps at 2.5x the observed maximum, rounded up to the nearest mebibyte.</p><p class="small">${e(DATA.derivation.margin)}</p></section>
  <section class="section"><h2 class="h2-compact">Baseline provenance</h2><div class="tbl"><table><tbody>
    <tr><th scope="row">Source commit</th><td><code>${e(DATA.baseline.sourceCommit)}</code></td></tr>
    <tr><th scope="row">Latest accepted commit</th><td><code>${e(DATA.baseline.verifiedCommit)}</code> — <code>${e(DATA.baseline.verificationPath)}</code></td></tr>
    <tr><th scope="row">Accuracy corpus</th><td>version ${e(DATA.baseline.accuracyCorpusVersion)}, <code>${e(DATA.baseline.accuracyCorpusHash)}</code></td></tr>
    <tr><th scope="row">Workload profiles</th><td>version ${e(DATA.baseline.workloadProfilesVersion)}, <code>${e(DATA.baseline.workloadProfilesHash)}</code></td></tr>
    <tr><th scope="row">Raw evidence</th><td><code>${e(DATA.baseline.summaryPath)}</code> — see <code>evidence/603/README.md</code></td></tr>
  </tbody></table></div></section>
  <section class="section"><h2 class="h2-compact">Thresholds</h2><p class="small">${measuredSource()}</p><div class="tbl"><table><thead><tr><th scope="col">Surface</th><th scope="col">Profile</th><th scope="col">Dispatch model</th><th scope="col">Init p95 ≤</th><th scope="col">Processing p95 ≤</th><th scope="col">Throughput ≥</th><th scope="col">Memory caps ≤</th><th scope="col">Measured processing (median / p95)</th><th scope="col">Measured throughput (median)</th><th scope="col">Artifact</th></tr></thead><tbody>${DATA.performance.map(row).join('')}</tbody></table></div>
  <p class="small">The <code>node</code> row's artifact is a recorded fact, not an inference from the run command: the Node loader may serve the N-API addon or fall back to the browser WebAssembly artifact (product decision-add-node-webassembly-fallback), and only the runner calling <code>artifact()</code> can tell which one actually ran. The accepted run records it from the runner's own <code>artifact()</code> call (<code>provenance.resolvedArtifact</code>); a run that does not read Not recorded rather than assuming the addon.</p>
  <p class="small"><b class="strong">Dispatch model (#450).</b> Rows are not all the same kind of work: the CLI dispatches each line separately (about 983 <code>detect()</code> calls per 64 KiB) while the library surfaces make one call, or feed 4 KiB chunks. A ratio between rows of different dispatch models mixes dispatch cost with detector cost, so compare a row only with rows of its own model. Regression budgets already compare each surface with itself, paired in one job.</p>
  ${guidance()}
  <p class="small">To see redact-secret next to flare-redact and OpenRedaction on the same PII inputs, go to <a href="/report#runtime-peers">Report → Runtime redaction libraries</a> (#444, informational).</p>
  </section>
  <section class="section prose"><h2 class="h2-compact">Running an evaluation</h2><p>A fresh candidate run is evaluated against these criteria the same way <code>evidence/603/summary.json</code> — this baseline's own run — was: <code>npm run performance:evaluate -- --summary &lt;path&gt;/summary.json</code>. <code>.github/workflows/performance-evaluation.yml</code> runs this in CI against the exact commit <code>benchmarks/pin-manifest.json</code> pins.</p></section>
  ${operationalSection()}`;
}

/** Operational evidence (#141): measurements, then the separate verdict, then sizes and limitations. */
const kib = (bytes: number) => `${(bytes / 1024).toLocaleString('en-US', { maximumFractionDigits: 1 })} KiB`;
const sizeRows = (list: { target: string; file: string; bytes: number }[]) =>
  list.map(a => `<tr><td><code>${e(a.target)}</code></td><td><code>${e(a.file)}</code></td><td>${kib(a.bytes)}</td></tr>`).join('');

function operationalSection(): string {
  const m = OPS.measurements, p = OPS.provenance, j = OPS.judgement;
  const timing = m.timings.map((t: any) => `<tr><td><code>${e(t.surface)}</code></td><td><code>${e(t.profileId)}</code></td><td>${e(t.path)}</td><td>${ms(t.initialization.median)} / ${ms(t.initialization.p95)}</td><td>${ms(t.processing.median)} / ${ms(t.processing.p95)}</td><td>${n(Math.round(t.throughput.minimum))} B/s</td><td>${e(t.environment.runtime ?? '—')}</td></tr>`).join('');
  const wasm = m.artifacts.wasm.map((w: any) => `<tr><td>${e(w.profile)}</td><td>${kib(w.rawBytes)}</td><td>${kib(w.gzipBytes)}</td><td>${kib(w.brotliBytes)}</td><td>${w.jsGlueBytes === null ? '—' : kib(w.jsGlueBytes)}</td></tr>`).join('');
  const npm = m.artifacts.npmPackages.map((x: any) => `<tr><td><code>${e(x.label)}</code></td><td>${kib(x.packedBytes)}</td><td>${kib(x.unpackedBytes)}</td><td>${n(x.files)}</td></tr>`).join('');
  const b = m.browserBundle.totals;
  return `<section class="section"><h2 class="h2-compact" id="operational-evidence">Operational evidence (#141)</h2>
    <p class="small">Product <code>${e(OPS.sourceCommit)}</code> (${e(OPS.productVersion)}), measured ${e(OPS.measuredAt)}. Timings: performance run <code>${e(p.performanceRun)}</code>, ${n(p.repetitions)} repetitions, ${e(p.officialProfile)}. Build: ${e(p.buildProfile)}. Sizes: product artifact-qualification run <code>${e(p.qualificationRun)}</code>. Data: <code>benchmarks/operational-evidence.json</code>.</p>
    <h3>Measurements · initialization and processing (median / p95), beta.7 baseline</h3>
    <div class="tbl"><table><thead><tr><th scope="col">Surface</th><th scope="col">Profile</th><th scope="col">Path</th><th scope="col">Initialization</th><th scope="col">Processing</th><th scope="col">Throughput (min)</th><th scope="col">Runtime</th></tr></thead><tbody>${timing}</tbody></table></div>
    <h3>Judgement</h3>
    <p>Against <code>${e(j.criteriaId)}</code> (fixed ${e(j.criteriaFixedAt)}): <b class="strong">${e(j.status)}</b>, ${n(j.checksPassed)} of ${n(j.checksTotal)} checks. ${e(j.note)}</p>
    <h3>WebAssembly size</h3>
    <div class="tbl"><table><thead><tr><th scope="col">Profile</th><th scope="col">Raw</th><th scope="col">gzip -9</th><th scope="col">brotli 11</th><th scope="col">JS glue</th></tr></thead><tbody>${wasm}</tbody></table></div>
    <h3>npm packages</h3>
    <div class="tbl"><table><thead><tr><th scope="col">Package</th><th scope="col">Packed</th><th scope="col">Unpacked</th><th scope="col">Files</th></tr></thead><tbody>${npm}</tbody></table></div>
    <h3>Minimal browser bundle</h3>
    <p>${e(m.browserBundle.tool)}, ${e(m.browserBundle.entry)}: JavaScript ${kib(b.jsBytes)} (${kib(b.jsGzipBytes)} gzip), WebAssembly ${kib(b.wasmBytes)} (${kib(b.wasmGzipBytes)} gzip), all files ${kib(b.allBytes)} (${kib(b.allGzipBytes)} gzip).</p>
    <h3>Native Node addons</h3><div class="tbl"><table><thead><tr><th scope="col">Target</th><th scope="col">File</th><th scope="col">Size</th></tr></thead><tbody>${sizeRows(m.artifacts.nativeAddons)}</tbody></table></div>
    <h3>Python wheels</h3><div class="tbl"><table><thead><tr><th scope="col">Target</th><th scope="col">File</th><th scope="col">Size</th></tr></thead><tbody>${sizeRows(m.artifacts.pythonWheels)}</tbody></table></div>
    <h3>CLI binaries</h3><div class="tbl"><table><thead><tr><th scope="col">Target</th><th scope="col">File</th><th scope="col">Size</th></tr></thead><tbody>${sizeRows(m.artifacts.cli)}</tbody></table></div>
    <h3>Limitations</h3><ul class="prose">${OPS.limitations.map((l: string) => `<li>${e(l)}</li>`).join('')}</ul>
  </section>`;
}
