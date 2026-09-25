#!/usr/bin/env node
/**
 * Records the machine a performance run measured on (#303): hosted runners
 * vary in CPU from job to job, so every performance evidence file names its
 * CPU model. Usage: record-runner.mjs [--cpu-model <lscpu model name>] --out <file>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const value = flag => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
const out = value('--out');
if (!out) { console.error('usage: record-runner.mjs [--cpu-model <name>] --out <file>'); process.exit(2); }
const runner = {
  cpuModel: value('--cpu-model') || os.cpus()[0]?.model || null,
  logicalCpus: os.cpus().length,
  totalMemoryBytes: os.totalmem(),
  kernel: os.release(),
  image: `${process.env.ImageOS ?? 'unknown'} ${process.env.ImageVersion ?? 'unknown'}`,
  runnerName: process.env.RUNNER_NAME ?? null,
};
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(runner, null, 2)}\n`);
console.log(JSON.stringify(runner));
