/**
 * Surface-neutral #427 job runner for the `@redact-secret/core` JavaScript API. The Node addon, the Node Wasm fallback
 * and the browser Wasm page all call `runJob` with the module they loaded, so every JavaScript surface executes the
 * same operations in the same order. Ranges stay native (UTF-16 code units); the harness converts them.
 *
 * This file must stay browser-safe: no `node:` import, no Node global.
 */
const codeOf = error => (error && typeof error.code === 'string' ? error.code : 'UNCODED_ERROR');
const findingRow = finding => ({ type: finding.type, detector: finding.detector, action: finding.action, confidence: finding.confidence ?? null,
  start: finding.start, end: finding.end });
const chunksOf = (input, cuts) => {
  const points = Array.from(input), chunks = []; let previous = 0;
  for (const cut of [...cuts, points.length]) { chunks.push(points.slice(previous, cut).join('')); previous = cut; }
  return chunks;
};

function attempt(action) {
  try { return { status: 'ok', ...action() }; } catch (error) { return { status: 'error', errorCode: codeOf(error) }; }
}

function session(api, limits, chunks) {
  let sanitizer;
  try { sanitizer = api.createIncrementalSanitizer({ limits }); } catch (error) { return { status: 'error', errorCode: codeOf(error), text: '', findings: [], state: null }; }
  let text = ''; const findings = [];
  try {
    for (const chunk of chunks) { const result = sanitizer.append(chunk); text += result.text; findings.push(...result.findings.map(findingRow)); }
    const result = sanitizer.finalize(); text += result.text; findings.push(...result.findings.map(findingRow));
    return { status: 'ok', text, findings, state: sanitizer.state };
  } catch (error) {
    return { status: 'error', errorCode: codeOf(error), text, findings, state: sanitizer.state };
  }
}

const jsLimits = limits => ({ maxInputCodeUnits: limits.maxInput, maxBufferedCodeUnits: limits.maxBuffered,
  maxTokenCodeUnits: limits.maxToken, maxMultilineCodeUnits: limits.maxMultiline });

export function runJob(api, job) {
  const identity = { rangeUnit: api.RANGE_UNIT ?? null, version: api.VERSION ?? null,
    artifact: typeof api.artifact === 'function' ? api.artifact() : null, piiActivation: typeof api.piiActivation === 'function' ? api.piiActivation() : null };
  const cases = job.cases.map(row => {
    const scan = attempt(() => ({ findings: api.scan(row.input).map(findingRow) }));
    const redact = attempt(() => ({ text: api.redact(row.input, api.scan(row.input)) }));
    const scanAndRedact = attempt(() => { const result = api.scanAndRedact(row.input); return { text: result.text, findings: result.findings.map(findingRow) }; });
    const partitions = row.partitions.map(partition => ({ id: partition.id, ...session(api, jsLimits(job.incrementalLimits), chunksOf(row.input, partition.cuts)) }));
    const wholeLimits = row.wholeLimits.map(limit => {
      const limits = { maxInputBytes: limit.maxInputBytes, maxFindings: limit.maxFindings };
      return { id: limit.id,
        scan: attempt(() => ({ count: api.scan(row.input, { limits }).length })),
        redact: attempt(() => ({ text: api.redact(row.input, api.scan(row.input), { limits }) })),
        scanAndRedact: attempt(() => ({ text: api.scanAndRedact(row.input, { limits }).text })) };
    });
    const incrementalFailures = row.incrementalFailures.map(failure => ({ id: failure.id,
      ...session(api, jsLimits(failure.limits), chunksOf(row.input, failure.cuts)) }));
    return { key: row.key, scan, redact, scanAndRedact, partitions, wholeLimits, incrementalFailures };
  });
  return { identity, cases };
}
