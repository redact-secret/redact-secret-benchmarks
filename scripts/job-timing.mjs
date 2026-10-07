#!/usr/bin/env node
/**
 * Wall time and runner-minutes of the jobs and steps of workflow runs (#657, #651 item 4).
 *
 *   node scripts/job-timing.mjs <run-id>... [--min-step-seconds 10]
 *
 * Reads `gh run view <id> --json jobs` only. Runner-minutes are billed per job as ceil(seconds / 60) on a Linux runner (the rate is
 * 1x; this repository's public status does not change the arithmetic, which is reported as the arithmetic and nothing more). One
 * run is one observation, not an average.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = args.indexOf('--min-step-seconds');
const minStep = flag >= 0 ? Number(args.splice(flag, 2)[1]) : 10;
const seconds = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 1000);
for (const id of args) {
  const { jobs } = JSON.parse(execFileSync('gh', ['run', 'view', id, '--json', 'jobs'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  let wall = [Infinity, 0], minutes = 0;
  console.log(`run ${id}`);
  for (const job of jobs) {
    if (!job.startedAt || !job.completedAt) continue;
    const s = seconds(job.startedAt, job.completedAt);
    minutes += Math.ceil(s / 60);
    wall = [Math.min(wall[0], Date.parse(job.startedAt)), Math.max(wall[1], Date.parse(job.completedAt))];
    console.log(`  job ${job.name}: ${s}s (${Math.ceil(s / 60)} runner-minute(s))`);
    for (const step of job.steps) {
      if (!step.startedAt || !step.completedAt) continue;
      const d = seconds(step.startedAt, step.completedAt);
      if (d >= minStep) console.log(`    ${String(d).padStart(5)}s  ${step.name}`);
    }
  }
  console.log(`  wall ${Math.round((wall[1] - wall[0]) / 1000)}s, runner-minutes ${minutes}`);
}
