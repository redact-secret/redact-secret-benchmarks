#!/usr/bin/env node
// Public comparison inputs only. A plan neither authorises dispatch nor changes PII authority.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalize } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { buildPlan } from './pii-official-plan.mjs';
export const PLAN_PATH = 'benchmarks/pii-candidate-comparison/plan.json';
export function comparisonPlan({ costDecision } = {}) {
  const old = buildPlan();
  const costPath = 'benchmarks/pii-candidate-comparison/cost-decision.json';
  let dispatch = { authorised: false, requires: 'fresh concrete official-run cost decision' };
  if (costDecision !== null && (costDecision !== undefined || existsSync(costPath))) {
    const cost = costDecision ?? JSON.parse(readFileSync(costPath));
    if (cost.schema !== 'pii-candidate-comparison-cost-decision/1' || cost.state !== 'approved' || !cost.decidedBy || !cost.decidedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(cost.decidedAt) || cost.baselineSourceCommit !== '0c62fd38bca75c5b28b042dc79789b708ebf1d17' || cost.candidateSourceCommit !== '5696d7e1a2950bdf54fa21244f351e1c4b171f25' || cost.engineCommit !== old.engine.commit || String(cost.qualificationRunId) !== '37772337995' || cost.inventorySha256 !== 'ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74' || cost.runs !== 8 || cost.replaysPerRun !== 2 || cost.protectedRuns !== 0 || cost.maxJobs !== 1 || cost.timeoutMinutes !== 15) throw new Error('cost decision does not bind this exact public comparison');
    dispatch = { authorised: true, costDecision: costPath, costDecisionSha256: createHash('sha256').update(canonicalize(cost)).digest('hex') };
  }
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  const packages = Object.fromEntries(Object.entries(lock.packages).filter(([name]) => /^node_modules\/@redact-secret\/(core|wasm|node-[a-z0-9-]+)$/.test(name)).map(([name, value]) => [name.slice(13), { version: value.version, integrity: value.integrity, resolved: value.resolved }]));
  return {
    schema: 'pii-candidate-comparison-plan/1', supportClaims: false, publicOnly: true,
    mode: dispatch.authorised ? 'official' : 'exploratory', runClass: 'public-synthetic', engineProductPin: 'candidate',
    engine: { ...old.engine, shimSha256: '21664407345b099d3f5e44db26bcfb037b2e981635dec0a7b5383b42b737e0a8' }, protocol: old.protocol, scanner: old.scanner,
    baseline: { provenance: 'published-npm-lockfile', version: '0.1.0-beta.14', sourceCommit: '0c62fd38bca75c5b28b042dc79789b708ebf1d17', packages },
    candidate: { provenance: 'qualified-unpublished-artifacts', version: '0.1.0-beta.14', sourceCommit: '5696d7e1a2950bdf54fa21244f351e1c4b171f25', qualificationRunId: '37772337995', inventorySha256: 'ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74', coreTarballSha256: '42c0447c124ace12c128768b30e33d83b4c58b8af2d0d8502c6d42f795c62c35', piiWasmTarballSha256: '77af5822255f28f13b4fc6e2de3ce393abdfe6ce205e7d2e61cb858808c4c037', nativeLinuxTarballSha256: 'cc9bda9802092fdc60d1458657f27f04d74f4789b64f31685a3abb721a43ea72', localNativeDarwinTarballSha256: '1e165fe460548f6df664870d647f8c077b331e4e4da453f76b3895d82bcc91b9', piiWasmBinarySha256: 'f52314fa95a51a064a42d0e03458ab8575dd32b4c42398191dc015e6983201e3' },
    populations: old.populations.map(({ manifestDigest, currentMode, expectedMode, ...p }) => p),
    execution: { sides: 2, populationsPerSide: 4, runs: 8, replaysPerRun: 2, protectedRuns: 0, canonicalPlatform: 'linux-x64', localDarwin: 'exploratory only; never compared with a canonical Linux run', localDarwinBinarySha256: '3bb255edc4775cfd7f92ab937f126c478d8aaa9c2437ea88c59236202e98d4d9' },
    qualification: { state: 'not-qualified', activation: 'installed-product configuration capture only', validator: 'product-validator-primitive-seam-unavailable', protected: 'not-operational', profileCost: 'not-measured-for-current-candidate' },
    dispatch,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = JSON.stringify(comparisonPlan(), null, 1) + '\n';
  if (process.argv.includes('--write')) { mkdirSync(dirname(PLAN_PATH), { recursive: true }); writeFileSync(PLAN_PATH, text); }
  else if (process.argv.includes('--check')) { if (readFileSync(PLAN_PATH, 'utf8') !== text) throw new Error('comparison plan is stale'); }
  else if (process.argv.includes('--github-output')) { const p = comparisonPlan(); process.stdout.write(`engine_commit=${p.engine.commit}\nproduct_sha=${p.candidate.sourceCommit}\nqualification_run_id=${p.candidate.qualificationRunId}\nbaseline_version=${p.baseline.version}\ncandidate_version=${p.candidate.version}\n`); }
  else process.stdout.write(text);
}
