#!/usr/bin/env node
/**
 * Reviewed performance-regression budgets (#143). Protocol:
 * docs/specs/regression-budgets.md. Library: benchmarks/lib/regression-budgets.ts.
 *
 *   ci-dispersion --commits <sha,...> --out <file>
 *       Freezes, from git history, each committed release-build summary's
 *       within-run p95/median dispersion and memory maxima, so derivation
 *       never needs history at check time.
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
  metricsFromOperational, metricsFromSummary, renderReportMarkdown, RULES, sha256OfText,
} from '../benchmarks/lib/regression-budgets.ts';
import { completeAssessmentProblem } from '../benchmarks/lib/performance-schema.ts';

const BUDGETS = 'benchmarks/regression-budgets.json';
const LEDGER = 'benchmarks/accepted-regressions.json';
const EVIDENCE = 'benchmarks/regression-evidence';
const NOISE_FILES = {
  ciDispersion: `${EVIDENCE}/ci-dispersion.json`,
  rerun: `${EVIDENCE}/rerun-noise-darwin-arm64.json`,
  adapter: `${EVIDENCE}/adapter-overhead-darwin-arm64.json`,
};

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

function noiseInputs() {
  const ci = readJson(NOISE_FILES.ciDispersion);
  const processing = {}, initialization = {}, memoryValues = {};
  for (const run of ci.runs) {
    for (const [row, values] of Object.entries(run.rows)) {
      processing[row] = Math.max(processing[row] ?? 0, values.processing.dispersion);
      initialization[row] = Math.max(initialization[row] ?? 0, values.initialization.dispersion);
      for (const [category, bytes] of Object.entries(values.memoryMaximumBytes)) {
        (memoryValues[`${row}/${category}`] ??= []).push(bytes);
      }
    }
  }
  const rerun = readJson(NOISE_FILES.rerun);
  const rerunMedian = key => Math.max(...rerun.series.map(s => spread(s.runs.map(r => r[key].median))));
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
    ciDispersion: { processing, initialization },
    ciMemorySpread: Object.fromEntries(Object.entries(memoryValues).map(([key, values]) => [key, spread(values)])),
    rerunMedianSpread: { processing: rerunMedian('processing'), initialization: rerunMedian('initialization') },
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
        rerunMedianSpread: { processing: round(noise.rerunMedianSpread.processing), initialization: round(noise.rerunMedianSpread.initialization) },
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
      for (const metric of extracted.metrics) metrics[metric.id] = metric;
      for (const dimension of ['latency', 'initialization', 'memory']) profiles[dimension] = extracted.profile;
      detection = extracted.detection;
    }
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
    if (result.verdict === 'invalid-measurement') console.error(`${github ? '::warning title=Measurement invalid, rerun::' : 'INVALID '}${result.id}: ${result.reason}`);
  }
  for (const problem of invalidSource) console.error(`${github ? '::error title=Measurement invalid, rerun::' : 'INVALID '}${problem}`);
  process.exit(invalidSource.length > 0 && final.status !== 'regression' ? 2 : exitCodeFor(final));
}

function check() {
  const budgets = readJson(BUDGETS);
  const ledger = readJson(LEDGER);
  const problems = [
    ...ledgerProblems(ledger, new Set(budgets.triggers.map(t => t.id))),
    ...historyProblems(budgets, file => readFileSync(file, 'utf8'), ledger),
  ];
  for (const record of budgets.baselines) if (!existsSync(record.file)) problems.push(`baseline ${record.id}: ${record.file} is missing`);
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
 * Replays the latency, initialization and memory triggers over each
 * consecutive pair of committed Linux runs (ci-dispersion.json), treating the
 * earlier run as the baseline. It shows what the rules would have said about
 * real product changes; it is not a gate.
 */
function backtest(args) {
  const budgets = readJson(BUDGETS);
  const { runs } = readJson(NOISE_FILES.ciDispersion);
  const profile = readJson(budgets.baselines.find(r => r.id === budgets.baseline).file).profiles.latency;
  const asSnapshot = run => ({
    id: run.productCommit.slice(0, 7), sourceCommit: run.productCommit, profiles: { latency: profile },
    metrics: Object.fromEntries(Object.entries(run.rows).flatMap(([row, v]) => [
      [`latency/${row}/processing-p95`, { id: `latency/${row}/processing-p95`, dimension: 'latency', value: v.processing.p95, samples: run.repetitions, corroboration: { value: v.processing.median } }],
      [`initialization/${row}/initialization-p95`, { id: `initialization/${row}/initialization-p95`, dimension: 'initialization', value: v.initialization.p95, samples: run.repetitions, corroboration: { value: v.initialization.median } }],
      ...Object.entries(v.memoryMaximumBytes).map(([category, bytes]) => [`memory/${row}/${category}`, { id: `memory/${row}/${category}`, dimension: 'memory', value: bytes, samples: run.repetitions }]),
    ])),
  });
  const triggers = budgets.triggers.filter(t => ['latency', 'initialization', 'memory'].includes(t.dimension));
  const rows = [];
  for (let i = 1; i < runs.length; i += 1) {
    const before = asSnapshot(runs[i - 1]);
    const after = asSnapshot(runs[i]);
    const report = evaluateBudgets({ budgetsId: budgets.budgetsId, triggers }, before,
      { sourceCommit: after.sourceCommit, sources: [], metrics: after.metrics, profiles: { latency: profile, initialization: profile, memory: profile } }, []);
    const flagged = verdict => report.triggers.filter(t => t.verdict === verdict)
      .map(t => `${t.id.replace(/\/(processing|initialization)-p95$/, '')} ${t.relativeChange >= 0 ? '+' : ''}${(t.relativeChange * 100).toFixed(0)}%`);
    rows.push({ from: before.id, to: after.id, regression: flagged('regression'), invalid: flagged('invalid-measurement'),
      withinBudget: report.triggers.filter(t => t.verdict === 'within-budget').length });
  }
  if (args.json) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
  else for (const row of rows) console.log(`${row.from} -> ${row.to}: ${row.regression.length} regression, ${row.invalid.length} invalid, ${row.withinBudget} within budget\n  regression: ${row.regression.join('; ') || '-'}\n  invalid: ${row.invalid.join('; ') || '-'}`);
}

const args = parseArgs(process.argv.slice(2));
const commands = { 'ci-dispersion': ciDispersion, snapshot, derive, evaluate, check, backtest };
const command = commands[args._[0]];
if (command === undefined) {
  console.error(`usage: regression-budgets.mjs <${Object.keys(commands).join('|')}> [options]`);
  process.exit(2);
}
command(args);
