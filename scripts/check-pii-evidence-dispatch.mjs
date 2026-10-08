#!/usr/bin/env node
// The approval is a single attempt, even when its file is copied to another commit.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEvidenceComparisonPlan, PLAN_PATH, validateEvidenceExecutionSelection } from './lib/pii-evidence-comparison-plan.mjs';
import { evidenceDigest as comparisonDigest, validateEvidenceCostDecision } from './lib/pii-evidence-comparison-plan.mjs';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';

export function checkDispatch({ runId, attempt, decisionDigest, runs, decisions }) {
  if (String(attempt) !== '1' || !/^[0-9]+$/.test(String(runId))) throw new Error('single-attempt-required');
  if (!/^[a-f0-9]{64}$/.test(decisionDigest) || !Array.isArray(runs) || runs.length > 512) throw new Error('dispatch-history-invalid');
  const matching = runs.filter(run => decisions.get(run.head_sha) === decisionDigest);
  if (matching.length !== 1 || String(matching[0].id) !== String(runId)) throw new Error('cost-decision-already-spent-or-not-bound');
}

function api(endpoint, missingAllowed = false) {
  try {
    return execFileSync('gh', ['api', endpoint], { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (missingAllowed && /HTTP 404/.test(String(error.stderr))) return null;
    throw new Error('dispatch-history-read-failed');
  }
}

export function verifyCurrentDispatch({ plan, readApi = api, environment = process.env,
  readDecision = file => readFileSync(resolve(file), 'utf8') } = {}) {
  plan ??= readEvidenceComparisonPlan(environment.EVIDENCE_PLAN ?? PLAN_PATH);
  validateEvidenceExecutionSelection(plan, { planPath: environment.EVIDENCE_PLAN ?? PLAN_PATH });
  if (plan.dispatch.authorised !== true || !plan.dispatch.costDecisionSha256) throw new Error('fresh-cost-decision-required');
  if (environment.GITHUB_REPOSITORY !== 'redact-secret/redact-secret-benchmarks') throw new Error('dispatch-repository-mismatch');
  const repository = 'redact-secret/redact-secret-benchmarks';
  const runs = [];
  for (let page = 1; page <= 6; page++) {
    // GitHub metadata permits null (for example a running job's conclusion).
    // The stricter public-artifact format applies only to our committed decision.
    const result = JSON.parse(readApi(`repos/${repository}/actions/workflows/pii-official-run.yml/runs?event=workflow_dispatch&per_page=100&page=${page}`));
    if (!Array.isArray(result.workflow_runs) || result.total_count > 512) throw new Error('dispatch-history-invalid');
    runs.push(...result.workflow_runs);
    if (runs.length >= result.total_count) break;
    if (page === 6) throw new Error('dispatch-history-incomplete');
  }
  const decision = validateEvidenceCostDecision(parseEvidenceJson(readDecision(plan.dispatch.costDecision)), { preflight: plan.preflight, policy: plan.policy, populationIndexDigest: plan.populationIndexDigest, productTuple: plan.productTuple, executionPaths: plan.executionPaths });
  if (decision.state !== 'approved' || comparisonDigest(decision) !== plan.dispatch.costDecisionSha256) throw new Error('cost-decision-plan-mismatch');
  if (!/^refs\/heads\/(?!main$|develop$)[A-Za-z0-9._/-]+$/.test(environment.GITHUB_REF ?? '')) throw new Error('branch-only-evidence-dispatch-required');
  const since = Date.parse(decision.decidedAt);
  if (!Number.isFinite(since)) throw new Error('cost-decision-date-invalid');
  const eligible = runs.filter(run => Date.parse(run.created_at) >= since);
  const decisions = new Map();
  for (const sha of new Set(eligible.map(run => run.head_sha))) {
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('dispatch-history-invalid');
    const text = readApi(`repos/${repository}/contents/${plan.dispatch.costDecision}?ref=${sha}`, true);
    if (!text) continue;
    const content = JSON.parse(text);
    if (content.encoding !== 'base64' || typeof content.content !== 'string' || content.content.length > 100_000) throw new Error('cost-decision-content-invalid');
    const historical = parseEvidenceJson(Buffer.from(content.content, 'base64').toString('utf8'));
    decisions.set(sha, comparisonDigest(historical));
  }
  checkDispatch({ runId: environment.GITHUB_RUN_ID, attempt: environment.GITHUB_RUN_ATTEMPT, decisionDigest: plan.dispatch.costDecisionSha256, runs: eligible, decisions });
  console.log('Fresh cost decision is bound to exactly this first dispatch attempt.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) verifyCurrentDispatch();
