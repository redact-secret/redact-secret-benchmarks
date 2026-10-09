#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';
import { PLAN_PATH, COST_PATH, readEvidenceComparisonPlan, evidenceComparisonPlan, validateEvidenceExecutionSelection, validateEvidenceCostPath, same } from './lib/pii-evidence-comparison-plan.mjs';
export * from './lib/pii-evidence-comparison-plan.mjs';
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const read = name => option(name) ? parseEvidenceJson(readFileSync(resolve(option(name)), 'utf8')) : undefined;
  const runtime = { preflight: read('preflight'), policy: read('policy'), populationIndex: read('population-index'), productTuple: read('product-tuple'), executionPaths: read('execution-paths') };
  const future = Object.values(runtime).some(value => value !== undefined);
  const selected = option('plan') ?? process.env.EVIDENCE_PLAN ?? PLAN_PATH;
  let plan;
  if (process.argv.includes('--check') || process.argv.includes('--github-output') || option('snapshot-pin-output')) {
    plan = readEvidenceComparisonPlan(selected);
    const activeCopy = selected === PLAN_PATH && plan.executionPaths !== undefined;
    const costFile = option('cost-decision') ?? (activeCopy && process.argv.includes('--check') ? COST_PATH : plan.dispatch.costDecision);
    if (process.argv.includes('--github-output') || option('snapshot-pin-output')) validateEvidenceExecutionSelection(plan, { planPath: selected, costDecisionPath: costFile });
    validateEvidenceCostPath(costFile);
    const cost = parseEvidenceJson(readFileSync(costFile, 'utf8'));
    const wanted = evidenceComparisonPlan({ costDecision: cost, preflight: plan.preflight, policy: plan.policy, populationIndexDigest: plan.populationIndexDigest, productTuple: plan.productTuple, executionPaths: plan.executionPaths });
    if (!same(plan, wanted)) throw new Error('evidence-plan-stale');
  } else plan = evidenceComparisonPlan({ ...runtime, costDecision: read('cost-decision') });
  const text = JSON.stringify(plan, null, 1) + '\n';
  if (option('snapshot-pin-output')) {
    writeFileSync(resolve(option('snapshot-pin-output')), JSON.stringify(plan.evidence, null, 1) + '\n', { flag: 'wx' });
  } else if (process.argv.includes('--write')) {
    const out = option('out');
    if (future && !out) throw new Error('future-plan-needs-separate-output');
    const destination = out ? resolve(out) : PLAN_PATH;
    if (future && resolve(destination) === resolve(PLAN_PATH)) throw new Error('future-plan-cannot-overwrite-current');
    mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, text, { flag: out ? 'wx' : 'w' });
  }
  else if (process.argv.includes('--check')) { /* All checks above are read-only. */ }
  else if (process.argv.includes('--github-output')) {
    if (!plan.dispatch.authorised) throw new Error('fresh-evidence-cost-decision-required');
    process.stdout.write(`has_candidate=${plan.candidate !== null}\nproduct_sha=${plan.candidate?.sourceCommit ?? ''}\nqualification_run_id=${plan.candidate?.qualificationRunId ?? ''}\nbaseline_version=${plan.baseline.version}\ncandidate_version=${plan.candidate?.version ?? ''}\n`);
  } else process.stdout.write(text);
}
