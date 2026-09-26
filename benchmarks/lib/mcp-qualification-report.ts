/**
 * Markdown rendering of a `mcp-qualification-v1` report (#281, resources/read
 * since #321). It renders only what the report carries: identities,
 * outcomes, counts and timings.
 */

interface Verdict { id: string; area: string; surface?: string; containment: string; sinks: string[]; checks: { name: string; passed: boolean }[]; conforms: boolean; exclusion?: string }
interface Counts { cases: number; controlsDetected: number; leaks: number; knownFalseNegatives: number; deliveredByPolicy: number; deviations: number; hostResponsibility?: number }
interface ResourceRow {
  host: string; profileId: string; processes: number; resultBytes: number; scannerCallsPerEvent: number; scannedCodeUnitsPerEvent: number;
  backstopScannerCallsPerEvent: number; backstopScannedCodeUnitsPerEvent: number; unprotectedMedian: number; protectedMedian: number; protectedP95: number;
  adapterOverhead: number; traversal: number; coreScan: number; leafPassMedian?: number; backstop?: number; throughputMiBPerSecond?: number;
}
interface Cell {
  node: string; line: string; endpoint: string; sdk: Record<string, string>; transport: string; protocolVersion: string | null; status: string; failure?: string;
  summary?: Counts & { resources?: Counts };
  processOutput?: { hostStdout: boolean; hostStderr: boolean; serverStderr: boolean };
  cases?: Verdict[];
}
interface OverheadRow { host: string; profileId: string; processes: number; scannerCallsPerEvent: number; unprotectedMedian: number; protectedMedian: number; protectedP95: number; adapterOverhead: number; traversal: number; coreScan: number; relativeOverhead: number | null }
interface Report {
  issue: number; status: string; quick: boolean; startedAt: string; finishedAt: string;
  benchmark: { commit: string; dirty: boolean };
  contract: { reference: string; resourcesReference?: string };
  artifacts: {
    core: { sourceCommit: string; packages: { role: string; file: string; sha256: string; packedBytes: number; unpackedBytes: number; files: number }[] };
    adapters: { commit: string; pinSource: { sha256: string }; packages: { name: string; version: string; contentDigest: string; packedBytes: number; unpackedBytes: number; files: number }[] };
    compatibility: { sha256: string; runtimeRange: string };
  };
  host: { os: string; arch: string; cpuModel: string | null };
  summary: {
    cells: number; completeCells: number; caseRuns: number; leaks: number; deviations: number; knownFalseNegatives: number; deliveredByPolicy: number; processOutputLeaks: number;
    hostResponsibility?: number; resourceCaseRuns?: number; resourceLeaks?: number; resourceDeviations?: number; resourceKnownFalseNegatives?: number; resourceControlsDetected?: number;
  };
  matrix: Cell[];
  operational: {
    overhead: { runtime: string; summary: OverheadRow[]; series: { outputs: { memory?: { profileId: string; calls: number; retainedHeapHost: number; retainedHeapAdapterCore: number; maxRssBytes: number } | null }[] } };
    initialization: { processes: number; core: { median: number; p95: number }; adapter: { median: number; p95: number }; adapterOverMedian: number } | null;
    resources?: { runtime: string; summary: ResourceRow[]; outputs: { memory?: { profileId: string; reads: number; retainedHeapHost: number; retainedHeapAdapterCore: number; maxRssBytes: number } | null }[] };
  };
  notMeasured: string[];
}

const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const us = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} ms` : `${v.toFixed(1)} µs`);

export function renderMarkdown(input: unknown): string {
  const report = input as Report;
  const out: string[] = [];
  const s = report.summary;
  const hasResources = s.resourceCaseRuns !== undefined && s.resourceCaseRuns > 0;
  const controlsPerCell = hasResources ? 2 : 1;
  const flaggedCells = report.matrix.filter(c => (c.summary?.controlsDetected ?? 0) === controlsPerCell).length;
  out.push(`# MCP adapter black-box qualification (#${report.issue ?? 281}${hasResources ? ': tools/call and resources/read' : ''})`, '');
  out.push(`**Result.** ${report.status}${report.quick ? ' (quick run: not evidence)' : ''}: ${s.caseRuns} case runs over ${s.completeCells}/${s.cells} cells`
    + `${hasResources ? ` (${s.resourceCaseRuns} of them resources/read)` : ''}; `
    + `**${s.leaks} leaks**, ${s.processOutputLeaks} process-output leaks, ${s.deviations} contract deviations, `
    + `${s.knownFalseNegatives} known false negatives (documented exclusions), ${s.deliveredByPolicy} deliveries by an explicit or default warn/allow policy`
    + `${hasResources ? `, ${s.hostResponsibility ?? 0} documented host-responsibility observations (the 2.x response cache)` : ''}; `
    + `the unprotected control${hasResources ? 's (tools/call and resources/read) were' : ' was'} flagged in ${flaggedCells}/${s.completeCells} cells.`, '');
  if (hasResources) {
    out.push(`resources/read alone: ${s.resourceCaseRuns} case runs, **${s.resourceLeaks} leaks**, ${s.resourceDeviations} deviations, ${s.resourceKnownFalseNegatives} known false negatives, control flagged in ${s.resourceControlsDetected}/${s.completeCells} cells.`, '');
  }

  out.push('## Identity', '', '| Item | Value |', '| --- | --- |');
  out.push(`| Benchmark | redact-secret-benchmarks \`${report.benchmark.commit}\`${report.benchmark.dirty ? ' (dirty)' : ' (clean)'} |`);
  out.push(`| Core candidate | redact-secret \`${report.artifacts.core.sourceCommit}\` |`);
  for (const p of report.artifacts.core.packages) out.push(`| core ${p.role} tarball | \`${p.file}\` sha256 \`${p.sha256}\` |`);
  out.push(`| Adapters | redact-secret-adapters \`${report.artifacts.adapters.commit}\`, pin-source sha256 \`${report.artifacts.adapters.pinSource.sha256}\` |`);
  for (const p of report.artifacts.adapters.packages) out.push(`| ${p.name}@${p.version} | content digest \`${p.contentDigest}\` (verified) |`);
  out.push(`| Compatibility record | sha256 \`${report.artifacts.compatibility.sha256}\`, runtime ${report.artifacts.compatibility.runtimeRange} |`);
  out.push(`| Contract | ${report.contract.reference} |`);
  if (report.contract.resourcesReference) out.push(`| resources/read contract | ${report.contract.resourcesReference} |`);
  out.push(`| Host | ${report.host.os} ${report.host.arch}, ${report.host.cpuModel ?? 'unknown CPU'} |`, '');

  out.push('## Matrix executed', '', '| Node.js | SDK | Transport | Protocol | Status | Cases | Leaks | Deviations | Known FN | Control |', '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const c of report.matrix) {
    const sdk = Object.entries(c.sdk).map(([n, v]) => `${n.replace('@modelcontextprotocol/', '')}@${v}`).join(' + ');
    const sm = c.summary;
    out.push(`| ${c.node} | ${sdk} | ${c.transport} | ${c.protocolVersion ?? '—'} | ${c.status}${c.failure ? ` (${c.failure})` : ''} | ${sm?.cases ?? '—'} | ${sm?.leaks ?? '—'} | ${sm?.deviations ?? '—'} | ${sm?.knownFalseNegatives ?? '—'} | ${sm ? (sm.controlsDetected === controlsPerCell ? 'flagged' : 'MISSED') : '—'} |`);
  }
  out.push('');

  // Per case, across cells.
  const byCase = new Map<string, { area: string; surface: string; containment: Set<string>; conforming: number; total: number; failed: Set<string>; sinks: Set<string> }>();
  for (const c of report.matrix) for (const v of c.cases ?? []) {
    const row = byCase.get(v.id) ?? { area: v.area, surface: v.surface ?? 'tools/call', containment: new Set(), conforming: 0, total: 0, failed: new Set(), sinks: new Set() };
    row.containment.add(v.containment); row.total += 1; if (v.conforms) row.conforming += 1;
    for (const check of v.checks) if (!check.passed) row.failed.add(check.name);
    for (const sink of v.sinks) row.sinks.add(sink);
    byCase.set(v.id, row);
  }
  out.push('## Cases', '', 'Containment is what the leak scan found across the model context, host log, store, audit trail and error text (and, for server-wrapped tools and resources, the server\'s wire output and handler input; for the 2.x response-cache cases, the store the host handed its client). A case conforms when its outcome, fixed result or error and lifecycle checks match the contract and nothing leaked.', '');
  for (const surface of ['tools/call', 'resources/read']) {
    const rows = [...byCase].filter(([, row]) => row.surface === surface);
    if (rows.length === 0) continue;
    out.push(`### ${surface}`, '', '| Case | Area | Containment | Conforms | Failed checks | Sinks with plaintext |', '| --- | --- | --- | ---: | --- | --- |');
    for (const [id, row] of rows) {
      out.push(`| \`${id}\` | ${row.area} | ${[...row.containment].join(', ')} | ${row.conforming}/${row.total} | ${[...row.failed].join(', ') || '—'} | ${[...row.sinks].join(', ') || '—'} |`);
    }
    out.push('');
  }

  out.push('## Operational cost', '', `Per-call wall time on ${report.operational.overhead.runtime}, median over processes of each process's median. `
    + '"Unprotected" is the same host delivering the raw result; "protected" routes it through the boundary first. '
    + 'Traversal is the adapter over a core that finds nothing, minus the unprotected host; core scan is the rest. Measurements only: no MCP budget exists yet.', '');
  out.push('| Host path | Workload | Processes | Scanner calls/call | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const r of report.operational.overhead.summary) {
    out.push(`| ${r.host} | ${r.profileId} | ${r.processes} | ${r.scannerCallsPerEvent} | ${us(r.unprotectedMedian)} | ${us(r.protectedMedian)} / ${us(r.protectedP95)} | ${us(r.adapterOverhead)} | ${us(r.traversal)} | ${us(r.coreScan)} |`);
  }
  out.push('');
  const memory = report.operational.overhead.series.outputs.map(o => o.memory).filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);
  if (memory.length > 0) {
    const worst = memory.reduce((a, b) => (b.retainedHeapAdapterCore > a.retainedHeapAdapterCore ? b : a));
    const rss = Math.max(...memory.map(m => m.maxRssBytes));
    out.push(`Memory, ${memory.length} processes: after ${worst.calls} protected calls of \`${worst.profileId}\` and a full GC, retained heap is at most ${kib(worst.retainedHeapAdapterCore)} with the boundary `
      + `(${kib(Math.max(...memory.map(m => m.retainedHeapHost)))} without); peak RSS ${(rss / 1048576).toFixed(1)} MiB.`, '');
  }
  const init = report.operational.initialization;
  if (init) {
    out.push(`Initialization, ${init.processes} fresh processes each: core import + initialize ${init.core.median.toFixed(2)} ms median (p95 ${init.core.p95.toFixed(2)}); `
      + `adapter-mcp import + createMcpBoundary + one benign call ${init.adapter.median.toFixed(2)} ms median (p95 ${init.adapter.p95.toFixed(2)}); adapter share ${init.adapterOverMedian.toFixed(2)} ms.`, '');
  }
  const resources = report.operational.resources;
  if (resources && resources.summary.length > 0) {
    out.push('## resources/read operational profile', '', `Measured in its own processes on ${resources.runtime}, apart from tools/call, median over processes of each process's median, per read. `
      + 'Over the transport, 2.x reads use `cacheMode: "bypass"`. In process, "leaf pass" is the AI-context `sanitizeValue` of the result alone on the real core; '
      + '"backstop" is the protected read minus the leaf pass: the key-context backstop\'s second scan plus the resource shape pass. Backstop scanner calls and code units are counted through the public injection API. Measurements only: no budget exists.', '');
    out.push('| Host path | Workload | Bytes | Scanner calls (backstop) | Code units scanned (backstop) | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan | Backstop | Throughput |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const r of resources.summary) {
      out.push(`| ${r.host} | ${r.profileId} | ${r.resultBytes} | ${r.scannerCallsPerEvent} (${r.backstopScannerCallsPerEvent}) | ${r.scannedCodeUnitsPerEvent} (${r.backstopScannedCodeUnitsPerEvent}) | ${us(r.unprotectedMedian)} | ${us(r.protectedMedian)} / ${us(r.protectedP95)} | ${us(r.adapterOverhead)} | ${us(r.traversal)} | ${us(r.coreScan)} | ${r.backstop !== undefined ? us(r.backstop) : '—'} | ${r.throughputMiBPerSecond !== undefined ? `${r.throughputMiBPerSecond.toFixed(1)} MiB/s` : '—'} |`);
    }
    out.push('');
    const rmem = resources.outputs.map(o => o.memory).filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);
    if (rmem.length > 0) {
      const worst = rmem.reduce((a, b) => (b.retainedHeapAdapterCore > a.retainedHeapAdapterCore ? b : a));
      out.push(`Memory, ${rmem.length} processes: after ${worst.reads} protected reads of \`${worst.profileId}\` and a full GC, retained heap is at most ${kib(worst.retainedHeapAdapterCore)} with the boundary `
        + `(${kib(Math.max(...rmem.map(m => m.retainedHeapHost)))} without); peak RSS ${(Math.max(...rmem.map(m => m.maxRssBytes)) / 1048576).toFixed(1)} MiB.`, '');
    }
  }
  out.push('| Package | Packed | Unpacked | Files |', '| --- | ---: | ---: | ---: |');
  for (const p of report.artifacts.adapters.packages) out.push(`| ${p.name}@${p.version} | ${kib(p.packedBytes)} | ${kib(p.unpackedBytes)} | ${p.files} |`);
  for (const p of report.artifacts.core.packages) out.push(`| core candidate (${p.role}) | ${kib(p.packedBytes)} | ${kib(p.unpackedBytes)} | ${p.files} |`);
  out.push('', '## Not measured', '', ...report.notMeasured.map(n => `- ${n}`), '');
  return `${out.join('\n')}\n`;
}
