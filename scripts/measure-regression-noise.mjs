#!/usr/bin/env node
/**
 * Same-artifact rerun noise for the regression budgets (#143).
 *
 * The committed release-build summaries (`evidence/603/summary.json` and its
 * history) each hold one run of five fresh-process samples per surface and
 * profile, and every one of them is a different product commit, so their
 * spread mixes noise with real change. This script measures the missing
 * term: how far one metric moves when the *same* published release artifact
 * is measured again, run after run, with core's own per-sample protocol (a
 * fresh process per sample, one untimed warm-up pass, one timed pass).
 *
 *   node scripts/measure-regression-noise.mjs --core-repo <redact-secret checkout> \
 *     --python <python with redact-secret installed> [--runs 6] [--samples 5] --out <file>
 *
 * Node samples use this repository's installed `@redact-secret/core` (the
 * release package `package.json` pins). Python samples run core's own
 * `scripts/assessment-python-worker.py` under `--python`. Workloads come from
 * core's `assessment/generate.ts` and `assessment/fixtures/workload-profiles.json`
 * at `--core-repo`; the output records that file's hash so it can be matched
 * to the summaries it is compared with. Measures only; no verdict.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROFILES = ["scale-logs-small-whole", "scale-logs-medium-fixed4096"];
const SELF = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = { runs: 6, samples: 5, python: "python3", out: "-", surfaces: ["node", "python"] };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--sample-node") return { sampleNode: true, coreRepo: value, profile: argv[i + 2] };
    const key = { "--core-repo": "coreRepo", "--python": "python", "--runs": "runs", "--samples": "samples", "--out": "out", "--surfaces": "surfaces" }[flag];
    if (key === undefined) throw new Error(`unknown argument: ${flag}`);
    options[key] = key === "runs" || key === "samples" ? Number(value) : key === "surfaces" ? value.split(",") : value;
  }
  if (!options.coreRepo) throw new Error("--core-repo is required");
  return options;
}

async function workload(coreRepo, profileId) {
  const generate = await import(pathToFileURL(path.join(coreRepo, "assessment", "generate.ts")).href);
  const metrics = await import(pathToFileURL(path.join(coreRepo, "assessment", "adapters", "performance.ts")).href);
  const document = JSON.parse(readFileSync(path.join(coreRepo, "assessment", "fixtures", "workload-profiles.json"), "utf8"));
  const profile = document.profiles.find(p => p.id === profileId);
  if (profile === undefined) throw new Error(`unknown profile ${profileId}`);
  const input = generate.generateWorkloadInput(profile);
  return { profile, input, chunks: metrics.partitionInput(input, profile.chunkProfile) };
}

/** One fresh-process Node sample, mirroring core's `scripts/assessment-node-performance.mjs` `measureOne`. */
async function sampleNode(coreRepo, profileId) {
  const { profile, input, chunks } = await workload(coreRepo, profileId);
  const inputBytes = Buffer.byteLength(input);
  const api = await import("@redact-secret/core");
  const started = performance.now();
  await api.initialize();
  const initializationMs = performance.now() - started;
  const run = () => {
    if (profile.chunkProfile === "whole") {
      const result = api.scanAndRedact(input);
      return result.text.length + result.findings.length;
    }
    const session = api.createIncrementalSanitizer({
      limits: { maxInputCodeUnits: inputBytes + 1, maxBufferedCodeUnits: 32_896, maxTokenCodeUnits: 8_192, maxMultilineCodeUnits: 32_768 },
    });
    let sink = 0;
    for (const chunk of chunks) {
      const result = session.append(chunk);
      sink += result.text.length + result.findings.length;
    }
    const final = session.finalize();
    return sink + final.text.length + final.findings.length;
  };
  run();
  const before = process.memoryUsage();
  const t0 = performance.now();
  run();
  const processingMs = performance.now() - t0;
  const after = process.memoryUsage();
  process.stdout.write(`${JSON.stringify({
    initializationMs, processingMs,
    nodeHeap: Math.max(before.heapUsed, after.heapUsed), nodeRss: Math.max(before.rss, after.rss),
  })}\n`);
}

function samplePython(options, request) {
  const worker = path.join(options.coreRepo, "scripts", "assessment-python-worker.py");
  const attempt = () => spawnSync(options.python, [worker, "performance-sample"], {
    input: JSON.stringify(request), encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 60_000,
  });
  // A worker that stalls (seen once on a loaded workstation: asleep, 0% CPU) is
  // killed and the sample retaken once; a second failure stops the study.
  let result = attempt();
  if (result.status !== 0) result = attempt();
  if (result.status !== 0) throw new Error("python worker failed");
  const out = JSON.parse(result.stdout);
  return {
    initializationMs: out.initializationMs, processingMs: out.processingMs,
    pythonHeap: out.pythonHeap.maximumObservedBytes, processRss: out.processRss?.maximumObservedBytes ?? null,
    version: out.version, runtime: out.runtime,
  };
}

/** Nearest-rank p95, exactly as core's `assessment/adapters/performance.ts` computes it (the maximum of five samples). */
function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function main() {
  const argv = process.argv.slice(2);
  const options = parseArgs(argv);
  if (options.sampleNode) return sampleNode(options.coreRepo, options.profile);

  const require = createRequire(import.meta.url);
  const coreVersion = JSON.parse(readFileSync(require.resolve("@redact-secret/core/package.json"), "utf8")).version;
  const profilesPath = path.join(options.coreRepo, "assessment", "fixtures", "workload-profiles.json");
  const series = [];
  for (const surface of options.surfaces) {
    for (const profileId of PROFILES) {
      const { profile, input, chunks } = surface === "python" ? await workload(options.coreRepo, profileId) : {};
      const runs = [];
      for (let run = 0; run < options.runs; run += 1) {
        const samples = [];
        for (let s = 0; s < options.samples; s += 1) {
          if (surface === "node") {
            const out = execFileSync(process.execPath, ["--import", "tsx", SELF, "--sample-node", options.coreRepo, profileId], { encoding: "utf8", timeout: 60_000 });
            samples.push(JSON.parse(out));
          } else {
            samples.push(samplePython(options, { input, chunks, chunkProfile: profile.chunkProfile }));
          }
        }
        const pick = key => samples.map(sample => sample[key]).filter(v => v !== null && v !== undefined);
        const memoryKeys = surface === "node" ? ["nodeHeap", "nodeRss"] : ["pythonHeap", "processRss"];
        runs.push({
          initialization: { p95: p95(pick("initializationMs")), median: median(pick("initializationMs")) },
          processing: { p95: p95(pick("processingMs")), median: median(pick("processingMs")), samples: pick("processingMs") },
          memoryMaximumBytes: Object.fromEntries(memoryKeys.map(key => [key, Math.max(...pick(key))])),
          loadAverage1m: os.loadavg()[0],
        });
      }
      const spread = values => Math.max(...values) / Math.min(...values) - 1;
      series.push({
        surface, profileId, runs,
        rerunSpread: {
          initializationP95: spread(runs.map(r => r.initialization.p95)),
          processingP95: spread(runs.map(r => r.processing.p95)),
          processingMedian: spread(runs.map(r => r.processing.median)),
          ...Object.fromEntries(Object.keys(runs[0].memoryMaximumBytes).map(key => [`memory.${key}`, spread(runs.map(r => r.memoryMaximumBytes[key]))])),
        },
      });
      console.error(`${surface}/${profileId}: processing p95 spread ${(series.at(-1).rerunSpread.processingP95 * 100).toFixed(1)}% over ${options.runs} runs`);
    }
  }
  const pythonMeta = options.surfaces.includes("python") ? samplePython(options, { input: "x", chunks: ["x"], chunkProfile: "whole" }) : null;
  const output = {
    schema: "redact-secret-benchmarks/regression-noise-v1",
    issue: 143,
    measuredAt: new Date().toISOString(),
    method: {
      protocol: "core's per-sample protocol: one fresh process per sample, one untimed warm-up pass, one timed pass",
      samplesPerRun: options.samples, runs: options.runs,
      percentile: "nearest-rank p95 over each run's samples, as core's summaries compute it",
      spread: "maximum over minimum minus one, across runs",
      runsAreSequential: true,
      sampleTimeoutMs: 60000,
    },
    artifacts: {
      node: `@redact-secret/core@${coreVersion} (published release package)`,
      python: pythonMeta === null ? null : `redact-secret==${pythonMeta.version} (published release wheel)`,
    },
    workloadProfiles: { hash: createHash("sha256").update(readFileSync(profilesPath)).digest("hex") },
    environment: {
      os: `${os.platform()}-${os.release()}`, arch: os.arch(), cpuModel: os.cpus()[0]?.model ?? null, logicalCpus: os.cpus().length,
      totalMemoryBytes: os.totalmem(), node: process.version, python: pythonMeta?.runtime ?? null,
    },
    series,
    limitations: [
      "One host, not the official Linux x86_64 runner: this bounds rerun noise on this host only.",
      "Runs are sequential on a shared workstation; other load is recorded per run as loadAverage1m.",
      "Rust, CLI and browser surfaces are not rerun here; their noise is inferred from the Node and Python spreads and the committed summaries.",
    ],
  };
  const text = `${JSON.stringify(output, null, 2)}\n`;
  if (options.out === "-") process.stdout.write(text);
  else writeFileSync(options.out, text);
}

await main();
