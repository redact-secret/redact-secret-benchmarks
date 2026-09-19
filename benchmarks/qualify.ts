import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadCases } from './engine/cases.ts';
import { createMethods } from './methods/index.ts';
import { createOperators } from './operators/index.ts';
import { runEvaluation } from './engine/runner.ts';
import { hash } from './engine/model.ts';
import { runtimeProvenance, repositoryRoot } from './engine/provenance.ts';
import { runHoldout } from '../holdout/lifecycle.ts';
import { validateEvidence, completenessReasons } from './engine/evidence.ts';
import type { Candidate } from '../holdout/types.ts';
import type { ReviewLedger } from './engine/types.ts';
import { ENGINE_VERSION } from './engine/execution.ts';
import { ACCOUNTING_VERSION, validateAccounting } from './lib/accounting.ts';
import { scanners as available } from '../scanners/index.mjs';

const asCandidate = (p: Candidate): Candidate => ({ sourceHash: p.sourceHash, lockHash: p.lockHash, candidateArtifactHash: p.candidateArtifactHash });

async function main() {
  const options: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(output|holdout-manifest)=(.+)$/.exec(arg);
    const key = match?.[1] ?? arg.slice(2);
    if ((!match && arg !== '--require-milestone-closed') || key in options) throw new Error('Invalid qualification arguments');
    options[key] = match?.[2] ?? true;
  }
  const suite = JSON.parse(await readFile(path.join(repositoryRoot, 'qualification/suite-v1.json'), 'utf8'));
  const milestone = JSON.parse(await readFile(path.join(repositoryRoot, 'qualification/milestone-status.json'), 'utf8'));
  if (options['require-milestone-closed'] && (milestone.status !== 'closed' || milestone.openPrerequisites.length)) {
    console.error('Milestone prerequisites are still open. Refresh the status snapshot after issue closure; no evaluation or holdout attempt was consumed.');
    process.exitCode = 1;
    return;
  }
  // The suite names the qualified tool set; other registered adapters are discovery-only.
  const scanners = available.filter((s: { id: string }) => Object.hasOwn(suite.scanners, s.id));
  const accounting = validateAccounting(suite.accounting);
  const ledger: ReviewLedger = JSON.parse(await readFile(path.join(repositoryRoot, 'benchmarks/review-ledger.json'), 'utf8'));
  const runId = randomUUID(), startedAt = new Date().toISOString();
  const provenance = await runtimeProvenance(), candidate = asCandidate(provenance);
  // Fail before accessing a protected corpus if the supported tool set drifted.
  for (const s of scanners) if (await s.version(repositoryRoot) !== suite.scanners[s.id]) throw new Error('Required scanner version is missing or differs from qualification/suite-v1.json');
  const operators = createOperators(), methods = createMethods();
  const cases = (await loadCases(operators)).map(c => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
  console.log('Running five development methods with all three scanners…');
  const development = await runEvaluation({ cases, methods, operators, scanners, runId, provenance, accounting, ledger, onProgress: console.log });
  console.log('Running isolated Holdout lifecycle…');
  const manifestFile = path.resolve(repositoryRoot, typeof options['holdout-manifest'] === 'string' ? options['holdout-manifest'] : suite.holdoutManifest);
  const holdout = await runHoldout({ manifestFile, scanners, candidate, runId,
    verifyCandidate: async () => asCandidate(await runtimeProvenance()) });
  const coverage = suite.methods.map((method: string) => {
    if (method === 'holdout') return { method, cases: holdout.caseCount, variants: holdout.variantCount,
      generationErrors: holdout.generationErrors, scanners: holdout.scanners.map(({ id, status, assertions }) => ({ id, status, assertions })) };
    const results = development.results.filter(r => r.method === method);
    return { method, cases: results.length, variants: results.reduce((n, r) => n + r.variants.length, 0),
      generationErrors: results.reduce((n, r) => n + r.generation.filter(g => g.status === 'error').length, 0),
      scanners: development.scanners.map(s => {
        const assertions = { pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 };
        for (const r of results) for (const a of r.scanners.find(x => x.scanner === s.id)?.assertions ?? []) assertions[a.status]++;
        return { id: s.id, status: s.status, assertions };
      }) };
  });
  const executed = coverage.every((c: any) => c.cases > 0 && c.generationErrors === 0 && c.scanners.every((s: any) => s.status === 'complete')) && holdout.status === 'complete';
  const reasons = completenessReasons({ executed, unresolvedGroups: development.unresolvedGroups, review: development.review });
  const complete = reasons.length === 0;
  const report = {
    schemaVersion: 2, reportType: 'qualification', engineVersion: ENGINE_VERSION, accountingVersion: ACCOUNTING_VERSION, suiteId: 'engine-v1', suiteHash: hash(suite),
    runId, startedAt, finishedAt: new Date().toISOString(), scope: holdout.independence === 'public-control' ? 'engine-conformance' : 'engine-with-protected-holdout',
    status: complete ? 'execution-qualified' : 'incomplete', supportClaims: false, provenance,
    development: { seed: suite.developmentSeed, casesHash: development.provenance.casesHash,
      corpusHashes: Object.fromEntries(cases.map(c => [c.source.category, c.provenance.sourceHash])),
      failures: development.failures.length, reviewEntries: development.reviewQueue.length, byDetector: development.byDetector },
    accounting: { reasons, unresolvedGroups: development.unresolvedGroups, review: development.review },
    methods: coverage, holdout, milestone,
  };
  validateEvidence(report, 'qualification');
  const target = path.resolve(repositoryRoot, typeof options.output === 'string' ? options.output : 'results-output/qualification/engine-v1.json');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${runId}.tmp`;
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
  if (reasons.length) console.log(`Incomplete: ${reasons.join(', ')}.`);
  console.log(`Six-method execution: ${report.status}. Holdout: ${holdout.independence}. Milestone: ${milestone.status}.`);
  console.log(`Evidence: ${path.relative(repositoryRoot, target)}`);
  process.exitCode = complete && (!options['require-milestone-closed'] || milestone.status === 'closed') ? 0 : 1;
}

main().catch(() => { console.error('Qualification failed: check pinned tools, manifests, storage permissions and schema validation. No protected details are logged.'); process.exitCode = 1; });
