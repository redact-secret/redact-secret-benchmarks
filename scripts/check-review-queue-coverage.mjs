/**
 * CI gate (#98): every differential/mutation review-queue id the current
 * fixture set generates must resolve against `benchmarks/review-ledger.json`
 * — `resolved`, `not-assertable`, or a deliberately recorded `open` row.
 * `benchmarks/support/evidence.ts`'s `unresolved()` already treats a missing
 * row the same as `open` for the stable-status gates, so a silent gap here
 * never blocks a family; it just accumulates invisibly until someone happens
 * to re-run `eval:classify` and notice. That is exactly how D1 (#62, 15
 * fixtures) and D6 (#65, 21 fixtures) built up 384 untriaged differential
 * ids that #63's D2 sweep never saw — this gate is #98's "the next fixture
 * batch does not silently recreate this backlog" guard.
 *
 * Uses the same validated suite-development peer snapshots as support
 * classification. Adapter/pin/corpus drift fails closed before the queue is
 * checked; only redact-secret executes during ordinary validation.
 *
 * Run: npm run queue:check
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanners as available } from '../scanners/index.mjs';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';
import { runEvaluation } from '../benchmarks/engine/runner.ts';
import { evaluationInputs } from '../benchmarks/engine/execution.ts';
import { inputIdentity, observationSuiteIdentity, readSnapshot, repositoryPeerIdentity, semanticIndexIdentity,
  snapshotObservation, snapshotPath } from '../benchmarks/lib/peer-observations.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Every current review-queue id with no ledger row at all, one problem string per id. */
export async function checkReviewQueueCoverage() {
  const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const ledger = JSON.parse(await readFile(path.join(root, 'benchmarks/review-ledger.json'), 'utf8'));
  const scanners = available.filter(s => Object.hasOwn(suite.scanners, s.id));
  const operators = createOperators(), methods = createMethods();
  const cases = (await loadCases(operators)).map(c => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
  const fixtures = evaluationInputs(cases, methods, operators).fixtures;
  const input = inputIdentity({ surface: 'evaluation/suite-development', suite: observationSuiteIdentity(suite),
    corpus: cases.map(c => ({ id: c.id, sourceHash: c.provenance.sourceHash, seed: c.provenance.seed })), fixtures,
    semanticIndex: await semanticIndexIdentity(root) });
  const peers = scanners.filter(s => s.id !== 'redact-secret');
  const reusedObservations = await Promise.all(peers.map(async peer => snapshotObservation(await readSnapshot(
    snapshotPath(root, 'evaluation/suite-development', peer.id), { input, peer: await repositoryPeerIdentity(peer, root) }))));
  const report = await runEvaluation({ cases, methods, operators, scanners: scanners.filter(s => s.id === 'redact-secret'), reusedObservations, ledger });
  const unknown = report.reviewQueue.filter(q => !Object.hasOwn(ledger.entries, q.id));
  return unknown.map(q => `${q.id.slice(0, 12)}: ${q.method} review-queue entry targeting [${q.targets.join(', ')}] (case ${q.caseId}) has no benchmarks/review-ledger.json row — resolve it, mark it not-assertable under a decided operator class, or record it open with a reason`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let problems;
  try {
    problems = await checkReviewQueueCoverage();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length) {
    console.error(`${problems.length} review-queue id(s) have no ledger row.`);
    process.exitCode = 1;
  } else console.log('Review queue coverage gate passed: every differential/mutation review-queue id resolves against the ledger.');
}
