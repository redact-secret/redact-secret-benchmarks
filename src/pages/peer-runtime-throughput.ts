import { commitmentChip, escapeHtml as e, statusMark } from '../components';
import plan from '../../qualification/peer-pii-runtime-throughput-v1.json';

/**
 * Runtime redaction libraries on the same PII inputs (#444, data from #429).
 *
 * Reads only the frozen `peer-pii-runtime-throughput` snapshot, never
 * `summary.scanners`: the roster is the plan's three runtime redaction
 * libraries, so repository secret scanners cannot appear here. Informational
 * only (AGENTS.md Boundary rule): rows stay in plan order, no value is marked,
 * sorted or compared, and every methodology note renders verbatim. The
 * snapshot is validated by `validatePeerRuntimeThroughputReport` in
 * tests/peer-runtime-section.test.mjs, not here: the validator hashes the
 * workload text, which this browser module does not ship.
 */
export const SNAPSHOT_PATH = 'evidence/429/peer-pii-runtime-throughput.json';

export interface PeerRuntimeSnapshot {
  generatedAt: string;
  runner: { platform: string; arch: string; node: string };
  tools: { id: string; version: string; provenance: { kind: string } }[];
  methodologyNotes: string[];
  observations: { tool: string; workload: string; workloadBytes: number; summary: { medianMs: number; p95Ms: number; medianBytesPerSecond: number } }[];
  artifactCommitment: string;
}

/** Absent until a measurement is committed; the section then reads Not measured. */
const committed = Object.values(import.meta.glob('../../evidence/429/peer-pii-runtime-throughput.json', { eager: true, import: 'default' }));
export const peerRuntimeSnapshot = committed[0] as PeerRuntimeSnapshot | undefined;

const NAME: Record<string, string> = { 'redact-secret': 'redact-secret', 'flare-redact': 'flare-redact', openredaction: 'OpenRedaction' };
/** Workload order and reader-facing descriptions; ids match qualification/pii-profile-cost-workloads-v1.json (tested). */
export const WORKLOADS = [
  { id: 'validator-heavy', description: 'Structured IDs checked by validators, plus near-misses that should fail validation.' },
  { id: 'multilingual-context', description: 'English and Korean context words, including Unicode variants and lookalikes that should not match.' },
] as const;

const fixed = (value: number, digits: number) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const kib = (bytes: number) => `${fixed(bytes / 1024, 1)} KiB`;
const intro = `<div class="rt-intro"><p class="eyebrow">RUNTIME REDACTION LIBRARIES ON THE SAME PII INPUTS</p><h2 class="h2-compact">How long does one redact call take?</h2><p class="small">Reference only. Not a ranking: libraries differ in scope, defaults and call shape. Listed in plan order.</p></div>`;

function libraries(snapshot: PeerRuntimeSnapshot, asyncNote: number): string {
  return `<div class="rt-libs">${plan.tools.map(tool => {
    const measured = snapshot.tools.find(t => t.id === tool.id);
    const build = measured?.provenance.kind === 'local-source-build' ? 'local build · unreleased' : 'npm';
    const shape = tool.async ? `async<a href="#rt-note-async" aria-label="Asynchronous call, see note ${asyncNote}">†</a>` : 'sync';
    return `<div class="rt-lib"><b>${e(NAME[tool.id])}</b><span>${e(measured?.version ?? '—')} <span class="chip">${build}</span></span><span><code>${e(tool.call)}()</code> ${shape}</span></div>`;
  }).join('')}</div>`;
}

function workloadTable(snapshot: PeerRuntimeSnapshot, workload: (typeof WORKLOADS)[number]): string {
  const rows = plan.tools.map(tool => ({ tool, observation: snapshot.observations.find(o => o.tool === tool.id && o.workload === workload.id) }));
  const bytes = rows.find(r => r.observation)?.observation?.workloadBytes;
  const size = bytes === undefined ? '' : `${kib(bytes)} · `;
  const body = rows.map(({ tool, observation }) => {
    if (!observation) return `<tr><th scope="row">${e(NAME[tool.id])}</th><td colspan="3">${statusMark('not-measured')}</td></tr>`;
    const s = observation.summary;
    return `<tr><th scope="row">${e(NAME[tool.id])}</th><td class="num" title="p95 ${fixed(s.p95Ms, 2)} ms">${fixed(s.medianMs, 2)}</td><td class="num rt-p95">${fixed(s.p95Ms, 2)}</td><td class="num" title="${Math.round(s.medianBytesPerSecond).toLocaleString('en-US')} B/s">${fixed(s.medianBytesPerSecond / 1e6, 1)}</td></tr>`;
  }).join('');
  return `<div class="rt-workload"><div class="rt-workload-head"><h3>${e(workload.id)}</h3><span class="small">${size}${e(workload.description)}</span></div>
    <div class="tbl"><table><caption class="visually-hidden">Redact call latency on ${e(workload.id)}${bytes === undefined ? '' : `, ${kib(bytes)}`}. Informational. Not a ranking.</caption>
    <thead><tr><th scope="col">Library</th><th scope="col" class="num">Median<small>ms</small></th><th scope="col" class="num rt-p95">p95<small>ms</small></th><th scope="col" class="num">Throughput<small>MB/s, median</small></th></tr></thead>
    <tbody>${body}</tbody></table></div></div>`;
}

/** `null` renders the Not measured state; the default is the committed snapshot, when there is one. */
export function peerRuntimeSection(snapshot: PeerRuntimeSnapshot | null = peerRuntimeSnapshot ?? null): string {
  const scope = '<p class="small">Same at every evidence level. Repository secret scanners are not listed: they scan files, not text at runtime. Thresholds for redact-secret alone are on <a href="/performance">Performance</a>.</p>';
  if (!snapshot)
    return `<section class="section rt" id="runtime-peers" aria-labelledby="runtime-peers-h">${intro.replace('<h2 ', '<h2 id="runtime-peers-h" ')}
      <div class="rt-empty"><p>${statusMark('not-measured')}</p><p class="small">No runtime comparison has been committed yet. The run needs a redact-secret Node addon built from source, so it is recorded by hand and published as a snapshot.</p>${scope}</div></section>`;
  const asyncIndex = snapshot.methodologyNotes.findIndex(n => /async|asynchronous|promise/i.test(n));
  const notes = snapshot.methodologyNotes.map((n, i) => `<li${i === asyncIndex ? ' id="rt-note-async"' : ''}>${e(n)}</li>`).join('');
  const protocol = plan.sampleProtocol;
  return `<section class="section rt" id="runtime-peers" aria-labelledby="runtime-peers-h">${intro.replace('<h2 ', '<h2 id="runtime-peers-h" ')}
    ${libraries(snapshot, asyncIndex + 1)}
    ${WORKLOADS.map(w => workloadTable(snapshot, w)).join('')}
    <p class="meta rt-run"><span>Measured <b>${e(snapshot.generatedAt.slice(0, 10))}</b></span><span>${e(snapshot.runner.platform)} ${e(snapshot.runner.arch)} · Node ${e(snapshot.runner.node)}</span><span>${protocol.samplesPerCell} samples per cell after ${protocol.warmupSamples} warmup calls, round-robin</span></p>
    <div class="rt-notes"><p class="eyebrow">HOW THESE WERE MEASURED</p><ol>${notes}</ol>${scope}</div>
    <div class="commitments">${commitmentChip({ label: 'Snapshot', commitment: snapshot.artifactCommitment, note: 'Validated by tests' })}<span class="chip">${e(SNAPSHOT_PATH)}</span></div>
  </section>`;
}
