#!/usr/bin/env node
/**
 * Which stages of one population job an earlier official-runs run left behind, so a retry reuses their receipts (#707, #762).
 *
 *   node scripts/retry-receipts.mjs --run <run id> --population <id> --out <dir> [--attribution <id>] [--candidate]
 *
 * For each stage (plain; methods for the methods population) the earlier run's artifacts are listed and every one that can hold the stage is downloaded
 * (`stage-<stage>-<population>`, then `early-plain-<population>`, then the job-end `official-run-<population>`, whichever exist and have not expired).
 * Prints `plain=reuse|fresh`, `plain_dirs=<dir>,<dir>` and the same for methods, for $GITHUB_OUTPUT, plus a log line per source. The driver then checks each
 * offered directory WHOLE (stage receipt, run record identity, digests, the pins of this commit) and takes the first that is identical; a stage that
 * has no source, or whose sources all differ, measures fresh. Identities are never mixed, and a directory marked INCOMPLETE is never reused.
 * The earlier run must be this repository's official-runs.yml workflow.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveStage } from './stage-receipts.mjs';

export const WORKFLOW_PATH = '.github/workflows/official-runs.yml';
export const PLAIN_STEP = 'Official run, twice, with the determinism check';
export const METHODS_STEP = 'Methods run, twice, with the determinism check (floors population only)';

/** The stages GitHub recorded as successful in one job: { plain, methods } each 'reuse' or 'fresh'. Informational since #762 (an artifact is what is reused). */
export function reusableStages(job) {
  const ok = name => job?.steps?.some(step => step.name === name && step.conclusion === 'success') === true;
  return { plain: ok(PLAIN_STEP) ? 'reuse' : 'fresh', methods: ok(METHODS_STEP) ? 'reuse' : 'fresh' };
}

/** The stages a population has: every population has a plain stage; only the registry's methods population has a methods stage. */
export function stagesOf(population, registry) {
  return registry.methodsRun?.population === population ? ['plain', 'methods'] : ['plain'];
}

/** The output lines for $GITHUB_OUTPUT and the log, from the resolutions; `downloaded` maps an artifact name to its local directory. */
export function outputLines(resolutions, downloaded) {
  const lines = [];
  for (const r of resolutions) {
    const dirs = r.offered.filter(s => downloaded.has(s.artifact)).map(s => path.join(downloaded.get(s.artifact), s.subdir));
    lines.push(`${r.stage}=${dirs.length ? 'reuse' : 'fresh'}`, `${r.stage}_dirs=${dirs.join(',')}`);
  }
  return lines;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  const run = value('--run'), population = value('--population'), out = value('--out');
  const attribution = args.includes('--attribution') ? value('--attribution') : '';
  if (!/^\d+$/.test(run ?? '') || !population || !out) throw new Error('Usage: retry-receipts --run <run id> --population <id> --out <dir> [--attribution <id>] [--candidate]');
  const gh = apiPath => JSON.parse(execFileSync('gh', ['api', apiPath], { encoding: 'utf8' }));
  const repo = process.env.GITHUB_REPOSITORY;
  const info = gh(`repos/${repo}/actions/runs/${run}`);
  if (info.path !== WORKFLOW_PATH) throw new Error(`run ${run} is ${info.path}, not ${WORKFLOW_PATH}`);
  const { jobs } = gh(`repos/${repo}/actions/runs/${run}/jobs?per_page=100`);
  const job = jobs.find(j => j.name === `Official run (${population})`);
  const steps = reusableStages(job);
  const { artifacts } = gh(`repos/${repo}/actions/runs/${run}/artifacts?per_page=100`);
  const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
  const tag = attribution ? `attribution-${attribution}-` : '';
  const finalPrefix = attribution ? `attribution-${attribution}-` : args.includes('--candidate') ? 'candidate-run-' : 'official-run-';
  const resolutions = stagesOf(population, registry).map(stage => resolveStage({ stage, population, artifacts, tag, finalPrefix }));
  const downloaded = new Map();
  for (const r of resolutions) {
    console.error(`stage ${r.stage} of run ${run} (${population}): GitHub recorded the step as ${steps[r.stage] === 'reuse' ? 'successful' : 'not successful'}; ${r.offered.length ? `offered: ${r.offered.map(s => s.artifact).join(', ')}` : r.reason}`);
    for (const source of r.offered) {
      if (downloaded.has(source.artifact)) continue;
      const dir = path.join(out, source.artifact);
      try {
        execFileSync('gh', ['run', 'download', run, '-R', repo, '-n', source.artifact, '-D', dir], { stdio: ['ignore', 'ignore', 'inherit'] });
        downloaded.set(source.artifact, dir);
      } catch (error) { console.error(`stage ${r.stage}: ${source.artifact} could not be downloaded (${error.message}); it is not offered`); }
    }
  }
  for (const line of outputLines(resolutions, downloaded)) console.log(line);
  if (!stagesOf(population, registry).includes('methods')) console.log('methods=fresh\nmethods_dirs=');
}
