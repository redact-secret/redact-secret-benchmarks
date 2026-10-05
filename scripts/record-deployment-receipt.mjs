#!/usr/bin/env node
/**
 * Record a staging or production deployment receipt of an ACCEPTED adoption in benchmarks/evidence-adoption.json (#690, #680). A receipt is evidence of a real deployment, so it is
 * built only from what can be checked: the publish workflow run (GitHub's own record: conclusion, event, branch, commit) and the deployed site (the pages are fetched and must carry
 * the accepted evidence release, the engine tag, the scanned product version and the maintainer-review disclosure). Nothing is written when a check fails, and a receipt is never typed in.
 *
 *   node scripts/record-deployment-receipt.mjs --environment staging|production --run <publish-site.yml run id> [--promotion <text>] [--write]
 *
 * Without --write the receipt is printed and nothing changes. The accepted adoption must exist (state `accepted`, an owner acceptance) and the run's commit must contain it, so a
 * deployment that predates the acceptance cannot be recorded as the acceptance's. The record is `candidate.deployment.<environment>`; a different receipt already recorded for the
 * environment is refused (a later deployment is a new receipt only with --replace). It never writes the authority file or an owner acceptance, and never promotes anything.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
export const SITES = { staging: 'https://staging.benchmarks.redactsecret.dev', production: 'https://benchmarks.redactsecret.dev' };
export const BRANCHES = { staging: 'develop', production: 'main' };
export const PAGES = ['/evaluation/credential/', '/report/', '/report/families/', '/evaluation/qualification/'];
export const DISCLOSURE = ['Maintainer-reviewed (independent review pending)', '메인테이너 검토 (독립 검토 대기)'];

/** Pure: the strings every deployed page of an accepted adoption must carry. */
export function expectedStamps(accepted) {
  return { evidenceRelease: accepted.evidenceRelease, engine: accepted.engine.tag.replace(/^v0\.1\.0-/, ''), product: accepted.product.version };
}

/** Pure: what is wrong with a run or a page set, or an empty list. `pages` maps a path to its text (or null when it could not be fetched). */
export function receiptProblems({ environment, run, pages, accepted, commitHasAcceptance }) {
  const problems = [];
  if (!SITES[environment]) return [`environment must be staging or production, not ${environment}`];
  if (run.conclusion !== 'success') problems.push(`run ${run.databaseId} concluded ${run.conclusion ?? 'nothing'}, not success`);
  if (run.event !== 'push') problems.push(`run ${run.databaseId} is a ${run.event} run; a deployment receipt is a push-triggered publish`);
  if (run.headBranch !== BRANCHES[environment]) problems.push(`run ${run.databaseId} ran on ${run.headBranch}; ${environment} is published from ${BRANCHES[environment]}`);
  if (!commitHasAcceptance) problems.push(`commit ${run.headSha} does not hold the owner acceptance of ${accepted.evidenceRelease}: this deployment is not the acceptance's`);
  const stamps = expectedStamps(accepted);
  for (const page of PAGES) {
    const text = pages[page];
    if (text == null) { problems.push(`${page} could not be fetched from ${SITES[environment]}`); continue; }
    for (const [name, value] of Object.entries(stamps)) if (!text.includes(value)) problems.push(`${page} does not carry the ${name} stamp ${value}`);
    for (const line of DISCLOSURE) if (!text.includes(line)) problems.push(`${page} lacks the disclosure "${line}"`);
  }
  return problems;
}

/** Pure: the receipt, in the shape the record already holds. Throws unless receiptProblems is empty. */
export function buildReceipt({ environment, run, pages, accepted, verifiedOn, promotion, commitHasAcceptance }) {
  const problems = receiptProblems({ environment, run, pages, accepted, commitHasAcceptance });
  if (problems.length) throw new Error(problems.join('; '));
  const stamps = expectedStamps(accepted);
  return {
    environment,
    site: SITES[environment],
    commit: run.headSha,
    workflowRun: `https://github.com/${REPOSITORY}/actions/runs/${run.databaseId}`,
    runId: String(run.databaseId),
    conclusion: run.conclusion,
    verifiedOn,
    verified: `${PAGES.join(', ')} fetched: each carries ${stamps.evidenceRelease}, credential-eval ${stamps.engine}, @redact-secret/core ${stamps.product} and the disclosure "${DISCLOSURE[0]}" / "${DISCLOSURE[1]}"`,
    ...(promotion ? { promotion } : {}),
  };
}

const sh = (command, args) => execFileSync(command, args, { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

async function fetchPages(environment) {
  const pages = {};
  for (const page of PAGES) {
    try { const response = await fetch(`${SITES[environment]}${page}`); pages[page] = response.ok ? await response.text() : null; } catch { pages[page] = null; }
  }
  return pages;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  try {
    const environment = option('environment'), runId = option('run');
    if (!SITES[environment] || !/^\d+$/.test(runId ?? '')) throw new Error('--environment staging|production and --run <publish-site.yml run id> are required');
    const file = path.join(root, 'benchmarks/evidence-adoption.json');
    const adoption = JSON.parse(readFileSync(file, 'utf8'));
    if (adoption.state !== 'accepted' || !adoption.candidate?.ownerAcceptance) throw new Error('there is no accepted adoption with an owner acceptance to record a deployment of');
    const accepted = adoption.candidate;
    const run = JSON.parse(sh('gh', ['run', 'view', runId, '-R', REPOSITORY, '--json', 'databaseId,conclusion,event,headBranch,headSha,workflowName']));
    if (run.workflowName !== 'Publish benchmarks site') throw new Error(`run ${runId} is ${run.workflowName}, not the publish workflow`);
    // The commit must hold the acceptance of this release: read the record as it was at that commit.
    let commitHasAcceptance = false;
    try {
      const at = JSON.parse(sh('git', ['show', `${run.headSha}:benchmarks/evidence-adoption.json`]));
      commitHasAcceptance = at.state === 'accepted' && at.candidate?.evidenceRelease === accepted.evidenceRelease && Boolean(at.candidate?.ownerAcceptance);
    } catch { commitHasAcceptance = false; }
    const receipt = buildReceipt({ environment, run, pages: await fetchPages(environment), accepted, commitHasAcceptance, verifiedOn: new Date().toISOString().slice(0, 10), promotion: option('promotion') });
    const existing = accepted.deployment?.[environment];
    if (existing && existing.runId !== receipt.runId && !args.includes('--replace')) throw new Error(`a receipt for run ${existing.runId} is recorded for ${environment}; pass --replace to record run ${receipt.runId}`);
    if (!args.includes('--write')) { console.log(JSON.stringify(receipt, null, 2)); process.exit(0); }
    writeFileSync(file, `${JSON.stringify({ ...adoption, candidate: { ...accepted, deployment: { ...(accepted.deployment ?? { staging: null, production: null }), [environment]: receipt } } }, null, 2)}\n`);
    console.log(`Recorded the ${environment} receipt of ${accepted.evidenceRelease} (run ${receipt.runId}).`);
  } catch (error) { console.error(`deployment receipt refused: ${error.message}`); process.exit(1); }
}
