#!/usr/bin/env node
/**
 * Which stages of one population job succeeded in an earlier official-runs run (#707), so a retry reuses their receipts.
 *
 *   node scripts/retry-receipts.mjs --run <run id> --population <id>
 *
 * Prints `plain=reuse|fresh` and `methods=reuse|fresh` lines for $GITHUB_OUTPUT. A stage is reusable only when GitHub recorded that step as successful in the
 * earlier run's job for this population; the driver then still verifies the receipt's identity and binds it to the current pins, and measures fresh when it
 * does not hold. The earlier run must be this repository's official-runs.yml workflow. The step and job names are the workflow's.
 */
import { execFileSync } from 'node:child_process';

export const WORKFLOW_PATH = '.github/workflows/official-runs.yml';
export const PLAIN_STEP = 'Official run, twice, with the determinism check';
export const METHODS_STEP = 'Methods run, twice, with the determinism check (floors population only)';

/** The reusable stages of one job as GitHub reported it: { plain, methods } each 'reuse' or 'fresh'. */
export function reusableStages(job) {
  const ok = name => job?.steps?.some(step => step.name === name && step.conclusion === 'success') === true;
  return { plain: ok(PLAIN_STEP) ? 'reuse' : 'fresh', methods: ok(METHODS_STEP) ? 'reuse' : 'fresh' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  const run = value('--run'), population = value('--population');
  if (!/^\d+$/.test(run ?? '') || !population) throw new Error('Usage: retry-receipts --run <run id> --population <id>');
  const gh = path => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8' }));
  const repo = process.env.GITHUB_REPOSITORY;
  const info = gh(`repos/${repo}/actions/runs/${run}`);
  if (info.path !== WORKFLOW_PATH) throw new Error(`run ${run} is ${info.path}, not ${WORKFLOW_PATH}`);
  const { jobs } = gh(`repos/${repo}/actions/runs/${run}/jobs?per_page=100`);
  const stages = reusableStages(jobs.find(job => job.name === `Official run (${population})`));
  for (const [stage, verdict] of Object.entries(stages)) console.log(`${stage}=${verdict}`);
}
