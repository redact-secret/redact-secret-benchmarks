import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { joinLegacyToSnapshot, type SnapshotLike } from './axis-overlay.ts';
import type { LegacyOccurrence } from './ledger-rekey.ts';
import type { ReviewLedger } from '../evaluation/model/review-ledger.ts';

/**
 * The one place the new path's tooling reaches the legacy evaluator (#660). `qualification:derive-inputs` re-keys the review ledger from the legacy
 * review queue, which only the legacy engine computes (the development corpora, the validated peer snapshots, redact-secret executed): this module
 * recomputes it exactly as `queue:check` does and joins it to the snapshot cases. Nothing here decides anything.
 *
 * Every import below is a literal path, so `node scripts/legacy-callers.mjs benchmarks/engine/runner.ts` lists this file as a caller. They are dynamic
 * so that loading `derived-inputs.ts` (or anything that only reads a derived directory) never loads the engine. This file is what has to change, and
 * the only one, when the engine is retired: the re-key mapping is then frozen or regenerated from artifacts (docs/specs/qualification-cutover.md).
 */
export interface LegacyReview { ledger: ReviewLedger; legacyQueue: LegacyOccurrence[]; joined: Map<string, string> }
export type LegacyReviewSource = (snapshot: SnapshotLike) => Promise<LegacyReview>;

const root = fileURLToPath(new URL('../../', import.meta.url));
const readJson = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

export const legacyReview: LegacyReviewSource = async (snapshot) => {
  const { scanners: available } = await import('../../scanners/index.mjs');
  const { credentialDomain } = await import('../evaluation/domains/credential/contract.ts');
  const { runEvaluation } = await import('../engine/runner.ts');
  const { evaluationInputs } = await import('../engine/execution.ts');
  const peerObservations = await import('../lib/peer-observations.ts');
  const ledger = await readJson('benchmarks/review-ledger.json');
  const suite = await readJson('qualification/suite-v1.json');
  const scanners = available.filter((s: { id: string }) => Object.hasOwn(suite.scanners, s.id));
  const operators = credentialDomain.createOperators(), engineMethods = credentialDomain.createMethods();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cases = (await credentialDomain.loadCases(operators)).map((c: any) => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
  const input = peerObservations.inputIdentity({
    surface: 'evaluation/suite-development', suite: peerObservations.observationSuiteIdentity(suite),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    corpus: cases.map((c: any) => ({ id: c.id, sourceHash: c.provenance.sourceHash, seed: c.provenance.seed })), fixtures: evaluationInputs(cases, engineMethods, operators).fixtures,
    semanticIndex: await peerObservations.semanticIndexIdentity(root),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reusedObservations = await Promise.all(scanners.filter((s: { id: string }) => s.id !== 'redact-secret').map(async (peer: any) => peerObservations.snapshotObservation(await peerObservations.readSnapshot(
    peerObservations.snapshotPath(root, 'evaluation/suite-development', peer.id), { input, peer: await peerObservations.repositoryPeerIdentity(peer, root) }))));
  const legacy = await runEvaluation({ cases, methods: engineMethods, operators, scanners: scanners.filter((s: { id: string }) => s.id === 'redact-secret'), reusedObservations, ledger, normalizeFinding: credentialDomain.normalizeFinding });
  return { ledger, legacyQueue: legacy.reviewQueue, joined: await joinLegacyToSnapshot(snapshot) };
};
