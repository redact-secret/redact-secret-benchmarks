#!/usr/bin/env node
/**
 * Same-job paired timing measurement for the regression budgets (#303).
 * Protocol: docs/specs/regression-budgets.md. Decision:
 * docs/decisions/2026-09-25-judge-timing-budgets-on-same-job-paired-ratios.md.
 *
 * A hosted runner's machine class varies from job to job (#303: two of six
 * same-pin runs were 22% and 45% faster on every row), so an absolute timing
 * compared across jobs mixes the product change with the machine. Here the
 * baseline and the candidate are built side by side in one job and measured
 * on the same runner in counterbalanced rounds (A B B A A B ...), each round
 * one invocation of core's own bounded assessment with fresh-process samples.
 * Timing is then judged on the candidate/baseline ratio.
 *
 *   run --baseline-dir <core checkout> --candidate-dir <core checkout>
 *       --out-dir <dir> [--rounds 6] [--runs 2] [--python .venv/bin/python]
 *       Runs `node scripts/assessment-all.mjs` in each checkout, interleaved.
 *   reduce --dir <run out-dir> --baseline-revision <sha> --candidate-revision <sha>
 *          [--runner <runner.json>] --out <paired.json>
 *       Reduces the interleaved invocations into one paired evidence file:
 *       per row, every baseline and candidate sample, in round order.
 *   collect --runs <manifest.json> --out <file>
 *       Combines several paired evidence files (one per workflow run) with
 *       their run provenance into one committed study (A/A noise or backtest).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { completeAssessmentProblem } from '../benchmarks/lib/performance-schema.ts';
import { metricsFromSummary, pairedRatios, roundOrder, sha256OfText } from '../benchmarks/lib/regression-budgets.ts';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const SHA = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { out._.push(arg); continue; }
    const next = argv[i + 1];
    out[arg.slice(2)] = next === undefined || next.startsWith('--') ? true : (i += 1, next);
  }
  return out;
}

function run(args) {
  const rounds = Number(args.rounds ?? 6);
  const runs = Number(args.runs ?? 2);
  if (!Number.isSafeInteger(rounds) || rounds < 2 || rounds % 2 !== 0) throw new Error('--rounds must be an even integer of at least 2');
  const outDir = path.resolve(args['out-dir']);
  const dirs = { baseline: path.resolve(args['baseline-dir']), candidate: path.resolve(args['candidate-dir']) };
  const python = args.python ?? '.venv/bin/python';
  const invocations = [];
  for (const { side, round } of roundOrder(rounds)) {
    const output = path.join(outDir, `${String(invocations.length).padStart(2, '0')}-${side}`);
    const started = Date.now();
    const outcome = spawnSync(process.execPath, ['scripts/assessment-all.mjs', '--python', python, '--runs', String(runs), '--output-dir', output],
      { cwd: dirs[side], stdio: 'inherit' });
    if (outcome.error !== undefined || outcome.status !== 0) throw new Error(`paired-performance:${side}:round ${round} failed`);
    invocations.push({ side, round, output: path.basename(output), durationMs: Date.now() - started });
  }
  writeJson(path.join(outDir, 'invocations.json'), { rounds, runsPerInvocation: runs, invocations });
  console.log(`Ran ${invocations.length} interleaved invocations into ${outDir}`);
}

function reduce(args) {
  const dir = path.resolve(args.dir);
  for (const key of ['baseline-revision', 'candidate-revision']) if (!SHA.test(String(args[key]))) throw new Error(`--${key} must be a 40-hex commit`);
  const { rounds, runsPerInvocation, invocations } = readJson(path.join(dir, 'invocations.json'));
  const rows = {};
  const detection = {};
  const profiles = new Set();
  let workloadHash = null, profile = null;
  const invocationRecords = [];
  for (const invocation of invocations) {
    const summaryFile = path.join(dir, invocation.output, 'summary.json');
    const text = readFileSync(summaryFile, 'utf8');
    const summary = JSON.parse(text);
    const problem = completeAssessmentProblem(summary);
    if (problem !== null) throw new Error(`paired-performance:${invocation.output}:${problem}`);
    if (summary.status !== 'complete') throw new Error(`paired-performance:${invocation.output}:assessment incomplete`);
    const revision = args[`${invocation.side}-revision`];
    if (summary.sourceCommit !== revision) throw new Error(`paired-performance:${invocation.output}:measured ${summary.sourceCommit}, expected ${revision}`);
    workloadHash ??= summary.workloadProfiles.hash;
    if (summary.workloadProfiles.hash !== workloadHash) throw new Error(`paired-performance:${invocation.output}:workload profiles differ between sides`);
    const extracted = metricsFromSummary(summary);
    profile ??= extracted.profile;
    profiles.add(JSON.stringify(extracted.profile));
    detection[invocation.side] ??= extracted.detection;
    for (const entry of summary.runs) {
      if (entry.kind !== 'performance' || entry.status !== 'complete') continue;
      const key = `${entry.surface}/${entry.profileId}`;
      const p = entry.result.performance;
      const side = ((rows[key] ??= { baseline: { processing: [], initialization: [] }, candidate: { processing: [], initialization: [] } })[invocation.side]);
      side.processing.push(...p.processing.samples);
      side.initialization.push(...p.initialization.samples);
    }
    invocationRecords.push({ side: invocation.side, round: invocation.round, durationMs: invocation.durationMs, summarySha256: sha256OfText(text) });
  }
  if (profiles.size !== 1) throw new Error('paired-performance:the two sides ran under different profiles');
  const expected = rounds * runsPerInvocation;
  for (const [key, row] of Object.entries(rows)) {
    for (const side of ['baseline', 'candidate']) {
      if (row[side].processing.length !== expected) throw new Error(`paired-performance:${key}:${side} has ${row[side].processing.length} samples, expected ${expected}`);
    }
    row.ratios = {
      processing: pairedRatios(row.baseline.processing, row.candidate.processing),
      initialization: pairedRatios(row.baseline.initialization, row.candidate.initialization),
    };
  }
  const baselineRevision = args['baseline-revision'];
  const candidateRevision = args['candidate-revision'];
  writeJson(args.out, {
    schema: 'redact-secret-benchmarks/paired-performance-v1',
    baseline: { revision: baselineRevision },
    candidate: { revision: candidateRevision },
    aa: baselineRevision === candidateRevision,
    rounds, runsPerInvocation, samplesPerSide: expected,
    order: invocationRecords.map(r => r.side),
    runner: args.runner ? readJson(args.runner) : null,
    profile: { ...profile, sameJob: 'true' },
    detection,
    invocations: invocationRecords,
    rows,
  });
  console.log(`Wrote ${args.out}: ${Object.keys(rows).length} rows, ${expected} samples per side`);
}

/**
 * The manifest lists each run as { runId, url, benchmarksRef, benchmarksCommit,
 * startedAt, completedAt, artifact: { id, name, digest }, paired: <path to the
 * downloaded paired.json> } plus `purpose` and `limitations`.
 */
function collect(args) {
  const manifest = readJson(args.runs);
  const runs = manifest.runs.map(entry => {
    const text = readFileSync(entry.paired, 'utf8');
    const paired = JSON.parse(text);
    if (paired.schema !== 'redact-secret-benchmarks/paired-performance-v1') throw new Error(`paired-performance:${entry.runId}:not a paired evidence file`);
    if (manifest.purpose === 'aa' && !paired.aa) throw new Error(`paired-performance:${entry.runId}:not an A/A run`);
    const { paired: _path, ...provenance } = entry;
    return { ...provenance, pairedSha256: sha256OfText(text), ...paired, schema: undefined };
  });
  if (new Set(runs.map(r => r.runId)).size !== runs.length) throw new Error('paired-performance:a run is listed twice');
  writeJson(args.out, {
    schema: 'redact-secret-benchmarks/paired-performance-study-v1',
    issue: 303,
    purpose: manifest.purpose,
    description: manifest.description,
    reducedBy: 'node --import tsx scripts/paired-performance.mjs collect',
    runs: runs.map(({ schema, ...rest }) => rest),
    limitations: manifest.limitations ?? [],
  });
  console.log(`Wrote ${args.out}: ${runs.length} runs`);
}

const args = parseArgs(process.argv.slice(2));
const commands = { run, reduce, collect };
const command = commands[args._[0]];
if (command === undefined) {
  console.error(`usage: paired-performance.mjs <${Object.keys(commands).join('|')}> [options]`);
  process.exit(2);
}
command(args);
