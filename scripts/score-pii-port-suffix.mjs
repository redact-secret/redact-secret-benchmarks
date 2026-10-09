/**
 * Score the IP port-suffix case (`net-p-port-suffix`, benchmarks #451) under the rule in
 * docs/decisions/2026-09-28-score-the-ip-port-suffix-outside-the-network-address-span.md.
 *
 * It only reads the frozen #428 observation (core 79c0a661, lockfile beta.10 baseline) and writes byte offsets, actions and a
 * verdict. It never writes input or output text and never re-measures a product, so no peer scanner runs and the pinned
 * trufflehog does not matter here.
 *
 * Run: node scripts/score-pii-port-suffix.mjs [--check]
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { measurementOutput, writeMeasurement } from './lib/measurement-output.mjs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const OBSERVATION = 'evidence/901/428/core-79c0a66119fb/pii-beta11-observation-v2.json';
const OBSERVATION_SHA256 = 'e2c6155c9c24c0aa45c94b56567706635e3caa1fa960734fbfb687ddcd2d57f7';
const SOURCE_REVISION = '65ffe7dcb3e7124e7f66cff96cab814f0365f69a';
const FAMILY = 'pii:global:network-address';
const CASE_ID = 'net-p-port-suffix';

// Authored truth, synthetic, fixed by the rule and not read from any observation. Input of the case: `ip: 10.60.1.5:8080`.
// The address `10.60.1.5` is UTF-8 bytes [4, 13). The `:8080` suffix is bytes [13, 18) and stays outside the span.
const INPUT = 'ip: 10.60.1.5:8080';
const ADDRESS = '10.60.1.5';
const start = Buffer.byteLength(INPUT.slice(0, INPUT.indexOf(ADDRESS)));
const TRUTH = { candidate: { start, end: start + Buffer.byteLength(ADDRESS) }, identity: 'valid', sensitivity: 'sensitive', action: 'redact',
  portBytes: { start: start + Buffer.byteLength(ADDRESS), end: Buffer.byteLength(INPUT) } };

function verdict(findings, selection) {
  if (selection === 'off') return findings.length === 0 ? 'no-finding-expected' : 'unexpected-finding';
  if (findings.length !== 1) return findings.length === 0 ? 'missed' : 'extra-findings';
  const [from, to, action] = findings[0];
  if (from === TRUTH.candidate.start && to === TRUTH.candidate.end && action === TRUTH.action) return 'exact';
  return to > TRUTH.candidate.end ? 'span-includes-port' : 'span-mismatch';
}

export function buildScoring(observation) {
  const side = key => observation[key].families.find(row => row.family === FAMILY).lanes.map(lane => {
    const row = lane.cases.find(item => item.id === CASE_ID);
    return { lane: lane.lane, selection: lane.selection, findings: row.family, verdict: verdict(row.family, lane.selection) };
  });
  const candidate = side('candidate'), baseline = side('baseline');
  const scored = [...candidate, ...baseline].filter(row => row.selection !== 'off');
  return {
    schemaVersion: 1, reportType: 'pii-network-port-suffix-scoring', issue: 'redact-secret-benchmarks#451',
    rule: 'The network-address span is the address literal only. A :port suffix (and the brackets around a bracketed IPv6 address) stay outside the span. The finding is the network-address family, and the port is neither a finding nor a leak.',
    decision: 'docs/decisions/2026-09-28-score-the-ip-port-suffix-outside-the-network-address-span.md',
    source: { observation: OBSERVATION, sourceCommit: observation.candidate.sourceCommit, baselineVersion: observation.baseline.version, freezeCommitment: observation.freeze.freezeCommitment },
    caseId: CASE_ID, family: FAMILY, view: 'qualification-plan', truth: TRUTH,
    candidate, baseline,
    summary: { scoredCells: scored.length, exact: scored.filter(row => row.verdict === 'exact').length,
      candidateExact: candidate.filter(row => row.selection !== 'off' && row.verdict === 'exact').length,
      baselineExact: baseline.filter(row => row.selection !== 'off' && row.verdict === 'exact').length,
      offSelectionFindings: [...candidate, ...baseline].filter(row => row.selection === 'off' && row.verdict !== 'no-finding-expected').length },
  };
}

export function render(observationFile) {
  if (!observationFile) throw new Error('Historical scoring requires --observation=<restored original archive member>; no implicit evidence input');
  const raw = readFileSync(observationFile);
  if (createHash('sha256').update(raw).digest('hex') !== OBSERVATION_SHA256)
    throw new Error('Restored observation differs from the original source-bound archive input');
  return `${JSON.stringify(buildScoring(JSON.parse(raw)), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(argument => {
    const match = /^--(observation|source-ref|output|check)=(.+)$/.exec(argument);
    if (!match) throw new Error('Use --observation=<archive file> --source-ref=<original commit> [--output=<ignored file>|--check=<archive scoring file>]');
    return [match[1], match[2]];
  }));
  if (args['source-ref'] !== SOURCE_REVISION) throw new Error('Historical replay must name original source revision ' + SOURCE_REVISION);
  const output = args.check ? null : measurementOutput(path.resolve(fileURLToPath(root), args.output ?? `results-output/pii-port-suffix/${Date.now()}/scoring.json`), fileURLToPath(root));
  const text = render(args.observation);
  if (args.check) {
    if (readFileSync(args.check, 'utf8') !== text) throw new Error('Restored scoring record differs from original observation derivation');
  } else writeMeasurement(output, text);
}
