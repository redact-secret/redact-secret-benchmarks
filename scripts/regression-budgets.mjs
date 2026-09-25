#!/usr/bin/env node
/**
 * Reviewed performance-regression budgets (#143). Protocol:
 * docs/specs/regression-budgets.md. Library: benchmarks/lib/regression-budgets.ts.
 *
 *   ci-dispersion --commits <sha,...> --out <file>
 *       Freezes, from git history, each committed release-build summary's
 *       within-run p95/median dispersion and memory maxima, so derivation
 *       never needs history at check time.
 *   runner-reruns --runs <manifest.json> --out <file>
 *       Reduces several performance-evaluation.yml runs at one pinned core
 *       commit (their downloaded summary.json plus run provenance) into
 *       same-artifact rerun noise on the official GitHub-hosted Linux runner.
 *   snapshot --id <id> --product-version <v> --summary <f> --operational <f> --adapter <series> --out <f>
 *       Writes an immutable baseline snapshot of every budgeted metric.
 *   derive [--check]
 *       (Re)derives benchmarks/regression-budgets.json's triggers from the
 *       current baseline snapshot and the recorded noise; --check fails on drift.
 *   evaluate [--summary <f>] [--operational <f>] [--adapter <f>...] --source-commit <sha>
 *            [--json-out <f>] [--markdown-out <f>]
 *       Judges a candidate. Exit 0 accepted, 1 a measured regression,
 *       2 a measurement that cannot be judged (rerun it).
 *   check
 *       Ledger validity, baseline immutability and history, and derive --check.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  deriveTriggers, evaluateBudgets, exitCodeFor, historyProblems, ledgerProblems, metricsFromAdapterOverhead,
  metricsFromOperational, metricsFromPaired, metricsFromSummary, ratioDeviation, renderReportMarkdown, RULES, sha256OfText,
} from '../benchmarks/lib/regression-budgets.ts';
import { completeAssessmentProblem } from '../benchmarks/lib/performance-schema.ts';

const BUDGETS = 'benchmarks/regression-budgets.json';
const LEDGER = 'benchmarks/accepted-regressions.json';
const EVIDENCE = 'benchmarks/regression-evidence';
const NOISE_FILES = {
  ciDispersion: `${EVIDENCE}/ci-dispersion.json`,
  rerun: `${EVIDENCE}/rerun-noise-darwin-arm64.json`,
  adapter: `${EVIDENCE}/adapter-overhead-darwin-arm64.json`,
  // Same-job A/A paired runs on the official Linux runner: the timing noise term (#303).
  pairedAA: `${EVIDENCE}/paired-aa-linux-x64.json`,
};
// Same-job paired runs of historical revision pairs, replayed by `backtest` (#303).
const PAIRED_BACKTEST = `${EVIDENCE}/paired-backtest-linux-x64.json`;
// The review condition (#303): at least this many A/A runs at the baseline commit, each with its CPU model recorded.
const MINIMUM_AA_RUNS = 3;

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { out._.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : (i += 1, next);
    out[key] = key in out ? [out[key]].flat().concat(value) : value;
  }
  return out;
}

const spread = values => Math.max(...values) / Math.min(...values) - 1;
const nearestRankMedian = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length / 2) - 1];

function ciDispersion(args) {
  const commits = String(args.commits).split(',');
  const runs = commits.map(commit => {
    const summary = JSON.parse(execFileSync('git', ['show', `${commit}:evidence/603/summary.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    const rows = {};
    for (const run of summary.runs) {
      if (run.kind !== 'performance' || run.status !== 'complete') continue;
      const p = run.result.performance;
      rows[`${run.surface}/${run.profileId}`] = {
        processing: { p95: p.processing.p95, median: p.processing.median, dispersion: p.processing.p95 / p.processing.median - 1 },
        initialization: { p95: p.initialization.p95, median: p.initialization.median, dispersion: p.initialization.p95 / p.initialization.median - 1 },
        memoryMaximumBytes: Object.fromEntries(Object.entries(p.memory).filter(([, m]) => m.samples.length > 0)
          .map(([category, m]) => [category, Math.max(...m.samples.map(s => s.maximumObservedBytes))])),
      };
    }
    return { benchmarksCommit: execFileSync('git', ['rev-parse', commit], { encoding: 'utf8' }).trim(),
      productCommit: summary.sourceCommit, repetitions: summary.repetitions, rows };
  });
  writeJson(args.out, {
    schema: 'redact-secret-benchmarks/ci-dispersion-v1', issue: 143,
    description: 'Every committed release-build performance summary (evidence/603/summary.json across its git history), reduced to per-row within-run dispersion and memory maxima. Each run is a different product commit, so cross-run differences mix noise with real change; within-run dispersion is five fresh-process samples on one GitHub-hosted Linux x86_64 runner.',
    source: 'git show <benchmarksCommit>:evidence/603/summary.json',
    runs,
  });
  console.log(`Wrote ${args.out}: ${runs.length} runs`);
}

/**
 * The manifest lists each run as { runId, url, benchmarksCommit, benchmarksRef,
 * startedAt, completedAt, runner: { name, label }, artifact: { id, name, digest },
 * summary: <path to the downloaded summary.json> }. Only the reduced timing
 * and memory statistics are kept; raw logs and per-sample files are not.
 */
function runnerReruns(args) {
  const manifest = readJson(args.runs);
  const series = new Map();
  const runs = [];
  let sourceCommit = null, workloadProfiles = null, repetitions = null;
  const environment = new Map();
  for (const entry of manifest.runs) {
    const text = readFileSync(entry.summary, 'utf8');
    const summary = JSON.parse(text);
    const problem = completeAssessmentProblem(summary);
    if (problem !== null) throw new Error(`runner-reruns:${entry.runId}:${problem}`);
    sourceCommit ??= summary.sourceCommit;
    workloadProfiles ??= summary.workloadProfiles;
    repetitions ??= summary.repetitions;
    if (summary.sourceCommit !== sourceCommit) throw new Error(`runner-reruns:${entry.runId}:different pinned commit ${summary.sourceCommit}`);
    if (summary.workloadProfiles.hash !== workloadProfiles.hash) throw new Error(`runner-reruns:${entry.runId}:different workload profiles`);
    if (summary.repetitions !== repetitions) throw new Error(`runner-reruns:${entry.runId}:different repetitions`);
    const { summary: _path, ...provenance } = entry;
    runs.push({ ...provenance, summarySha256: sha256OfText(text) });
    for (const run of summary.runs) {
      if (run.kind !== 'performance' || run.status !== 'complete') continue;
      const p = run.result.performance;
      const key = `${run.surface}/${run.profileId}`;
      const { os, cpu, runtime, buildProfile } = run.result.provenance;
      const env = JSON.stringify({ os, cpu, runtime, ...(buildProfile ? { buildProfile } : {}) });
      if (environment.has(run.surface) && environment.get(run.surface) !== env) throw new Error(`runner-reruns:${entry.runId}:${run.surface} environment changed`);
      environment.set(run.surface, env);
      if (!series.has(key)) series.set(key, { surface: run.surface, profileId: run.profileId, runs: [] });
      series.get(key).runs.push({
        runId: entry.runId,
        initialization: { p95: p.initialization.p95, median: p.initialization.median },
        processing: { p95: p.processing.p95, median: p.processing.median, samples: p.processing.samples },
        memoryMaximumBytes: Object.fromEntries(Object.entries(p.memory).filter(([, m]) => m.samples.length > 0)
          .map(([category, m]) => [category, Math.max(...m.samples.map(s => s.maximumObservedBytes))])),
      });
    }
  }
  for (const s of series.values()) {
    if (s.runs.length !== runs.length) throw new Error(`runner-reruns:${s.surface}/${s.profileId}:missing from some runs`);
  }
  writeJson(args.out, {
    schema: 'redact-secret-benchmarks/regression-noise-v1',
    issue: 143,
    measuredAt: runs.map(run => run.completedAt).sort().at(-1),
    method: {
      protocol: 'performance-evaluation.yml, dispatched repeatedly at one pinned core commit: each run checks the commit out, builds release artifacts, and runs core\'s bounded assessment (one fresh process per sample, one untimed warm-up pass, one timed pass)',
      samplesPerRun: repetitions,
      runs: runs.length,
      percentile: 'nearest-rank p95 over each run\'s samples, as core\'s summaries compute it',
      spread: 'maximum over minimum minus one, across runs',
      runsAreSequential: false,
      reducedBy: 'node --import tsx scripts/regression-budgets.mjs runner-reruns',
    },
    sourceCommit,
    artifacts: { build: 'release artifacts built by each run from the pinned core commit (same source, rebuilt per run)' },
    workloadProfiles: { hash: workloadProfiles.hash },
    environment: {
      runner: 'GitHub-hosted ubuntu-latest (official Linux x86_64 profile)',
      surfaces: Object.fromEntries([...environment].map(([surface, env]) => [surface, JSON.parse(env)])),
    },
    runs,
    series: [...series.values()],
    limitations: manifest.limitations,
  });
  console.log(`Wrote ${args.out}: ${runs.length} runs, ${series.size} series`);
}

function adapterSeries(file) {
  const value = readJson(file);
  return value.schema === 'redact-secret-benchmarks/adapter-overhead-series-v1' ? value.outputs : [value];
}

function snapshot(args) {
  const summaryText = readFileSync(args.summary, 'utf8');
  const summary = JSON.parse(summaryText);
  const problem = completeAssessmentProblem(summary);
  if (problem !== null) throw new Error(`summary: ${problem}`);
  const operationalText = readFileSync(args.operational, 'utf8');
  const operational = JSON.parse(operationalText);
  const adapterText = readFileSync(args.adapter, 'utf8');
  const fromSummary = metricsFromSummary(summary);
  const fromAdapter = metricsFromAdapterOverhead(adapterSeries(args.adapter));
  const metrics = [...fromSummary.metrics, ...metricsFromOperational(operational), ...fromAdapter.metrics];
  if (operational.sourceCommit !== summary.sourceCommit) throw new Error('operational evidence and summary measure different commits');
  writeJson(args.out, {
    schemaVersion: '1', id: args.id, productVersion: args['product-version'], sourceCommit: summary.sourceCommit,
    takenAt: args['taken-at'] ?? new Date().toISOString().slice(0, 10),
    sources: {
      performanceSummary: { path: args.summary, sha256: sha256OfText(summaryText), repetitions: summary.repetitions },
      operationalEvidence: { path: args.operational, sha256: sha256OfText(operationalText), measuredAt: operational.measuredAt },
      adapterOverhead: { path: args.adapter, sha256: sha256OfText(adapterText), ...readJson(args.adapter).provenance },
    },
    profiles: { latency: fromSummary.profile, 'adapter-overhead': fromAdapter.profiles },
    metrics: Object.fromEntries(metrics.map(metric => [metric.id, metric])),
    detection: fromSummary.detection,
  });
  console.log(`Wrote ${args.out}: ${metrics.length} metrics`);
}

/** Largest A/A deviation of the paired ratios over the A/A runs, per row, for the p95 and the median. */
function pairedNoise() {
  const study = readJson(NOISE_FILES.pairedAA);
  const noise = { processing: { p95: {}, median: {} }, initialization: { p95: {}, median: {} } };
  for (const run of study.runs) {
    for (const metric of metricsFromPaired(run).metrics) {
      const statistic = metric.dimension === 'latency' ? 'processing' : 'initialization';
      const row = metric.id.split('/').slice(1, 3).join('/');
      noise[statistic].median[row] = Math.max(noise[statistic].median[row] ?? 0, ratioDeviation(metric.value));
      noise[statistic].p95[row] = Math.max(noise[statistic].p95[row] ?? 0, ratioDeviation(metric.tail.value));
    }
  }
  return noise;
}

function noiseInputs() {
  const ci = readJson(NOISE_FILES.ciDispersion);
  const memoryValues = {};
  for (const run of ci.runs) {
    for (const [row, values] of Object.entries(run.rows)) {
      for (const [category, bytes] of Object.entries(values.memoryMaximumBytes)) {
        (memoryValues[`${row}/${category}`] ??= []).push(bytes);
      }
    }
  }
  const rerun = readJson(NOISE_FILES.rerun);
  const rerunMemory = Math.max(...rerun.series.flatMap(s => Object.keys(s.runs[0].memoryMaximumBytes)
    .map(category => spread(s.runs.map(r => r.memoryMaximumBytes[category])))));
  const adapterTraversal = {};
  const outputs = adapterSeries(NOISE_FILES.adapter);
  for (const output of outputs) {
    for (const result of output.results) (adapterTraversal[`${result.host}/${result.profileId}`] ??= []).push(result.derived.traversal);
  }
  const adapter = Object.fromEntries(Object.entries(adapterTraversal).map(([key, values]) => {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const standardDeviation = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    return [key, { spread: (Math.max(...values) - Math.min(...values)) / Math.abs(nearestRankMedian(values)), standardDeviation }];
  }));
  return {
    paired: pairedNoise(),
    ciMemorySpread: Object.fromEntries(Object.entries(memoryValues).map(([key, values]) => [key, spread(values)])),
    rerunMemorySpread: rerunMemory,
    adapterTraversal: adapter,
  };
}

function derive(args) {
  const budgets = readJson(BUDGETS);
  const current = budgets.baselines.find(record => record.id === budgets.baseline);
  const noise = noiseInputs();
  const round = value => Math.round(value * 10_000) / 10_000;
  const next = {
    ...budgets,
    noise: {
      sources: NOISE_FILES,
      summary: {
        pairedAA: {
          runs: readJson(NOISE_FILES.pairedAA).runs.length,
          cpuModels: [...new Set(readJson(NOISE_FILES.pairedAA).runs.map(run => run.runner?.cpuModel ?? 'unrecorded'))].sort(),
          p95RatioDeviationMax: {
            processing: round(Math.max(...Object.values(noise.paired.processing.p95))),
            initialization: round(Math.max(...Object.values(noise.paired.initialization.p95))),
          },
          medianRatioDeviationMax: {
            processing: round(Math.max(...Object.values(noise.paired.processing.median))),
            initialization: round(Math.max(...Object.values(noise.paired.initialization.median))),
          },
        },
        rerunMemorySpread: round(noise.rerunMemorySpread),
        ciRuns: readJson(NOISE_FILES.ciDispersion).runs.length,
        adapterProcesses: adapterSeries(NOISE_FILES.adapter).length,
      },
    },
    rules: RULES,
    triggers: deriveTriggers(readJson(current.file), noise),
  };
  const text = `${JSON.stringify(next, null, 2)}\n`;
  if (args.check) {
    if (text !== readFileSync(BUDGETS, 'utf8')) {
      console.error(`${BUDGETS} does not match what the derivation produces from the recorded baseline and noise; run \`npm run performance:budgets:derive\``);
      process.exit(1);
    }
    console.log(`${BUDGETS}: ${next.triggers.length} triggers match their derivation`);
    return;
  }
  writeFileSync(BUDGETS, text);
  console.log(`Wrote ${BUDGETS}: ${next.triggers.length} triggers`);
}

function evaluate(args) {
  const budgets = readJson(BUDGETS);
  const record = budgets.baselines.find(r => r.id === budgets.baseline);
  const baseline = readJson(record.file);
  const metrics = {}, profiles = {}, sources = [];
  let detection = null;
  const invalidSource = [];
  if (args.summary) {
    sources.push(args.summary);
    const summary = readJson(args.summary);
    const problem = completeAssessmentProblem(summary);
    if (problem !== null) invalidSource.push(`summary: ${problem}`);
    else {
      const extracted = metricsFromSummary(summary);
      // Absolute latency and initialization metrics stay in the report as informational rows only.
      for (const metric of extracted.metrics) metrics[metric.id] = metric;
      profiles.memory = extracted.profile;
      detection = extracted.detection;
    }
  }
  if (args.paired) {
    sources.push(args.paired);
    const extracted = metricsFromPaired(readJson(args.paired));
    for (const metric of extracted.metrics) metrics[metric.id] = metric;
    profiles.latency = extracted.profile;
    profiles.initialization = extracted.profile;
  }
  if (args.operational) {
    sources.push(args.operational);
    for (const metric of metricsFromOperational(readJson(args.operational))) metrics[metric.id] = metric;
    profiles.size = {};
  }
  for (const file of [args.adapter ?? []].flat()) {
    sources.push(file);
    const extracted = metricsFromAdapterOverhead(adapterSeries(file));
    for (const metric of extracted.metrics) metrics[metric.id] = metric;
    profiles['adapter-overhead'] = { ...(profiles['adapter-overhead'] ?? {}), ...extracted.profiles };
  }
  const report = evaluateBudgets(budgets, baseline,
    { sourceCommit: args['source-commit'] ?? null, sources, metrics, profiles, detection }, readJson(LEDGER));
  const final = invalidSource.length > 0 ? { ...report, status: 'invalid-measurement', sourceProblems: invalidSource } : report;
  if (args['json-out']) writeJson(args['json-out'], final);
  const markdown = renderReportMarkdown(final);
  if (args['markdown-out']) writeFileSync(args['markdown-out'], markdown);
  else process.stdout.write(markdown);
  // Distinct annotations, so CI shows which kind of failure it is.
  const github = process.env.GITHUB_ACTIONS === 'true';
  for (const result of final.triggers) {
    if (result.verdict === 'regression') console.error(`${github ? '::error title=Budget regression::' : 'REGRESSION '}${result.id}: ${result.baseline} -> ${result.candidate} ${result.unit}`);
    if (result.verdict === 'not-evaluated' && (result.dimension === 'latency' || result.dimension === 'initialization') && args.summary && !args.paired) {
      console.error(`NOT JUDGED ${result.id}: timing needs a same-job paired run (--paired)`);
    }
    if (result.verdict === 'invalid-measurement') console.error(`${github ? '::warning title=Measurement invalid, rerun::' : 'INVALID '}${result.id}: ${result.reason}`);
  }
  for (const problem of invalidSource) console.error(`${github ? '::error title=Measurement invalid, rerun::' : 'INVALID '}${problem}`);
  process.exit(invalidSource.length > 0 && final.status !== 'regression' ? 2 : exitCodeFor(final));
}

/**
 * The review condition (#303): `reviewed` budgets need at least three same-job
 * A/A runs of the current baseline commit on the hosted runner, each naming
 * its CPU model, as the timing noise source.
 */
function reviewProblems(budgets) {
  if (budgets.reviewStatus !== 'reviewed') return [];
  const pinned = budgets.baselines.find(record => record.id === budgets.baseline)?.sourceCommit;
  const runs = existsSync(NOISE_FILES.pairedAA) ? readJson(NOISE_FILES.pairedAA).runs : [];
  const problems = [];
  const valid = runs.filter(run => run.aa && run.baseline.revision === pinned && run.candidate.revision === pinned && run.runner?.cpuModel);
  if (new Set(valid.map(run => run.runId)).size < MINIMUM_AA_RUNS) {
    problems.push(`reviewed budgets need at least ${MINIMUM_AA_RUNS} same-job A/A runs of ${pinned} with a recorded CPU model in ${NOISE_FILES.pairedAA}`);
  }
  return problems;
}

function check() {
  const budgets = readJson(BUDGETS);
  const ledger = readJson(LEDGER);
  const problems = [
    ...ledgerProblems(ledger, new Set(budgets.triggers.map(t => t.id))),
    ...historyProblems(budgets, file => readFileSync(file, 'utf8'), ledger),
  ];
  for (const record of budgets.baselines) if (!existsSync(record.file)) problems.push(`baseline ${record.id}: ${record.file} is missing`);
  problems.push(...reviewProblems(budgets));
  for (const [dimension] of Object.entries(RULES)) {
    if (!budgets.triggers.some(t => t.dimension === dimension)) problems.push(`no trigger covers the ${dimension} dimension`);
  }
  for (const trigger of budgets.triggers) {
    for (const field of ['profile', 'metric', 'direction', 'threshold', 'minimumSamples']) {
      if (trigger[field] === undefined) problems.push(`trigger ${trigger.id}: ${field} is missing`);
    }
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`regression budgets: ${problem}`);
    process.exit(1);
  }
  console.log(`regression budgets: ${budgets.triggers.length} triggers, ${budgets.baselines.length} baseline(s), ${ledger.length} accepted tradeoff(s); history and ledger are consistent`);
  derive({ check: true });
}

/**
 * Replays the budgets over history; it shows what the rules would have said
 * about real product changes and is not a gate.
 *  - memory: each consecutive pair of committed Linux runs (ci-dispersion.json),
 *    the earlier run as the baseline;
 *  - timing: each committed same-job paired run of a historical revision pair
 *    (paired-backtest-linux-x64.json), judged on its paired ratios (#303).
 *    Absolute timing across jobs is not replayed: it is informational only.
 */
function backtest(args) {
  const budgets = readJson(BUDGETS);
  const { runs } = readJson(NOISE_FILES.ciDispersion);
  const profile = readJson(budgets.baselines.find(r => r.id === budgets.baseline).file).profiles.latency;
  const rows = [];
  const memoryTriggers = budgets.triggers.filter(t => t.dimension === 'memory');
  const summarize = (kind, from, to, report) => {
    const flagged = verdict => report.triggers.filter(t => t.verdict === verdict)
      .map(t => `${t.id.replace(/\/(processing|initialization)-ratio$/, '')} ${t.relativeChange >= 0 ? '+' : ''}${(t.relativeChange * 100).toFixed(0)}%`);
    rows.push({ kind, from, to, regression: flagged('regression'), invalid: flagged('invalid-measurement'),
      withinBudget: report.triggers.filter(t => t.verdict === 'within-budget').length });
  };
  for (let i = 1; i < runs.length; i += 1) {
    const asSnapshot = run => ({
      id: run.productCommit.slice(0, 7), sourceCommit: run.productCommit, profiles: { latency: profile },
      metrics: Object.fromEntries(Object.entries(run.rows).flatMap(([row, v]) => Object.entries(v.memoryMaximumBytes)
        .map(([category, bytes]) => [`memory/${row}/${category}`, { id: `memory/${row}/${category}`, dimension: 'memory', value: bytes, samples: run.repetitions }]))),
    });
    const before = asSnapshot(runs[i - 1]);
    const after = asSnapshot(runs[i]);
    summarize('memory', before.id, after.id, evaluateBudgets({ budgetsId: budgets.budgetsId, triggers: memoryTriggers }, before,
      { sourceCommit: after.sourceCommit, sources: [], metrics: after.metrics, profiles: { memory: profile } }, []));
  }
  if (existsSync(PAIRED_BACKTEST)) {
    const timingTriggers = budgets.triggers.filter(t => t.dimension === 'latency' || t.dimension === 'initialization');
    for (const run of readJson(PAIRED_BACKTEST).runs) {
      const extracted = metricsFromPaired(run);
      const before = { id: run.baseline.revision.slice(0, 7), sourceCommit: run.baseline.revision, profiles: { latency: profile }, metrics: {} };
      summarize(`paired timing (run ${run.runId}, ${run.runner?.cpuModel ?? 'unrecorded CPU'})`, before.id, run.candidate.revision.slice(0, 7),
        evaluateBudgets({ budgetsId: budgets.budgetsId, triggers: timingTriggers }, before,
          { sourceCommit: run.candidate.revision, sources: [], metrics: Object.fromEntries(extracted.metrics.map(m => [m.id, m])),
            profiles: { latency: extracted.profile, initialization: extracted.profile } }, []));
    }
  }
  if (args.json) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  else for (const row of rows) console.log(`${row.kind}: ${row.from} -> ${row.to}: ${row.regression.length} regression, ${row.invalid.length} invalid, ${row.withinBudget} within budget\n  regression: ${row.regression.join('; ') || '-'}\n  invalid: ${row.invalid.join('; ') || '-'}`);
}

const args = parseArgs(process.argv.slice(2));
const commands = { 'ci-dispersion': ciDispersion, 'runner-reruns': runnerReruns, snapshot, derive, evaluate, check, backtest };
const command = commands[args._[0]];
if (command === undefined) {
  console.error(`usage: regression-budgets.mjs <${Object.keys(commands).join('|')}> [options]`);
  process.exit(2);
}
command(args);
