import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPiiCurrentQualification, type PiiCurrentQualification } from './pii-current-qualification.ts';
import bindingsFile from '../evaluation/domains/pii/protected-support-bindings-v1.json';
import registryFile from '../evaluation/domains/pii/support-registry-v1.json';
import { PII_ORACLE_PLANS } from '../evaluation/domains/pii/identity-oracle.ts';

/**
 * The six opt-in PII families in the support matrix (#647), at the qualification the published Beta.11 disposition records
 * and no other. Nothing here decides or re-derives a status: each row is the reviewed `pii-v1` projection
 * (`benchmarks/evaluation/domains/pii/protected-support-bindings-v1.json`, entry `beta11-8b6a5fd-pii-protected`) checked
 * field by field against the published aggregate protected disposition it was written from
 * (`evidence/901/428/core-8b6a5fde52ec/pii-beta11-protected-disposition-v2.json`). The binder `bindPiiProtectedSupport`
 * is deliberately not called: it re-derives the disposition from the sealed protected partition, which this generator never
 * opens. Only the committed aggregate, the freeze and the registry are read.
 *
 * The PII rows sit beside the credential families, never in them: `providerCount`, `familyCount`, `distribution` and
 * `stableDistribution` stay credential-only (docs/specs/support-matrix.md, "PII rows").
 */
export const PII_BINDING_ID = 'beta11-8b6a5fd-pii-protected';
/** The benchmarks merge that put the final record and the protected disposition on `develop`; the core cites its permalinks. */
export const PII_RECORD_REVISION = 'be0fb9f35045bf05e5b999a2c0ed368541f9e963';
const DISPOSITION_FILE = 'pii-beta11-protected-disposition-v2.json';
const FREEZE_FILE = 'pii-beta11-freeze-v2.json';
const COMMIT = /^[0-9a-f]{40}$/, DIGEST = /^[0-9a-f]{64}$/, EPOCH_OF_SEAL = /^holdout\/pii-b11-([0-9a-f]{12})-seal\.json$/;

export type PiiStatus = 'pending' | 'provisional';
export interface PiiMatrixRow {
  family: string;
  familyName: string;
  status: PiiStatus;
  /** The disposition's protected-gate reason code string, verbatim. */
  reason: string;
  coverage: { scope: string; jurisdiction: string | null; restriction: string | null; note: string };
  /** The public finding type the family's findings carry (the identity oracle plan's `findingType`). */
  findingTypes: string[];
  gates: {
    public: { met: number; notMet: string[]; unresolved: string[]; acceptedTradeoffs: string[] };
    protected: { state: 'met' | 'not-met'; reason: string; runs: string; epochCommitment: string; aggregateCommitment: string; trustCommitment: string };
  };
  /** The gates that did not pass, by name; empty when none failed. */
  failedGates: string[];
}
export interface PiiQualification {
  profile: 'pii-v1';
  route: string;
  binding: string;
  maximumStatus: 'provisional';
  qualifiedAt: { coreCommit: string; epoch: string; populationPlanSet: string };
  benchmarks: { recordRevision: string; freezeBaseRevision: string };
  record: string;
  disposition: string;
  commitments: { freeze: string; report: string; disposition: string; seal: string; protectedDisposition: string };
  costAcceptance: { id: string; entryCommitment: string; status: 'accepted'; cells: number; sizeRows: number };
  requalification: { state: 'not-requalified'; requalifiedOnCoreCommit: null; statement: string };
}
export interface PiiMatrixSection { piiCurrentQualification?: PiiCurrentQualification; piiQualification: PiiQualification; piiDistribution: Record<'stable' | 'provisional' | 'pending' | 'unsupported', number>; piiFamilies: PiiMatrixRow[] }

export const PII_REQUALIFICATION_STATEMENT =
  'These statuses were qualified at the Beta.11 core commit above and have not been re-qualified on any later core commit, including the Beta.13 candidate. '
  + 'The core email, IBAN, phone, payment-card and us-ssn code changed after that commit, so the statuses describe the Beta.11 code, not later code.';

const same = (what: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`PII binding ${PII_BINDING_ID} disagrees with the published disposition on ${what}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); };

export async function buildPiiMatrixSection(root: string): Promise<PiiMatrixSection> {
  const binding = bindingsFile.bindings.find(entry => entry.id === bindingsFile.current);
  if (!binding || binding.id !== PII_BINDING_ID) throw new Error(`The reviewed PII binding is not ${PII_BINDING_ID}; this matrix projection is bound to that entry.`);
  if (binding.maximumStatus !== 'provisional') throw new Error('The PII route must cap status at provisional.');
  const json = (file: string) => readFile(path.join(root, file), 'utf8').then(JSON.parse);
  const disposition = await json(path.posix.join(binding.evidenceDirectory, DISPOSITION_FILE));
  const freeze = await json(path.posix.join(binding.evidenceDirectory, FREEZE_FILE));
  if (disposition.reportType !== 'pii-beta11-protected-disposition' || disposition.supportClaims !== false || disposition.maximumStatus !== 'provisional') throw new Error('Not the published protected disposition.');
  same('core commit', binding.coreCommit, disposition.candidate.sourceCommit);
  same('core commit in the freeze', binding.coreCommit, freeze.candidate.sourceCommit);
  same('freeze commitment', binding.freezeCommitment, disposition.freezeCommitment);
  same('freeze commitment of the freeze file', binding.freezeCommitment, freeze.freezeCommitment);
  same('report commitment', binding.reportCommitment, disposition.reportCommitment);
  same('disposition commitment', binding.dispositionCommitment, disposition.dispositionCommitment);
  same('seal commitment', binding.sealCommitment, disposition.sealCommitment);
  same('protected disposition commitment', binding.artifactCommitment, disposition.artifactCommitment);
  same('cost acceptance', binding.costAcceptance.entryCommitment, disposition.costAcceptance.entryCommitment);
  same('cost acceptance id', binding.costAcceptance.id, disposition.costAcceptance.acceptedBy);
  if (disposition.costAcceptance.status !== 'accepted' || disposition.costAcceptance.excluded.length || disposition.costAcceptance.uncovered.length) throw new Error('The profile-cost acceptance is not a complete acceptance.');
  const epoch = EPOCH_OF_SEAL.exec(binding.sealRecord)?.[1];
  if (!epoch) throw new Error(`The seal record name does not carry an epoch: ${binding.sealRecord}`);
  const planSet = String(freeze.populationPlanSet), freezeBase = String(freeze.benchmark?.baseRevision);
  for (const [what, value] of [['core commit', binding.coreCommit], ['freeze base revision', freezeBase], ['record revision', PII_RECORD_REVISION]] as const) if (!COMMIT.test(value)) throw new Error(`The ${what} is not a full commit id.`);
  for (const value of [binding.freezeCommitment, binding.reportCommitment, binding.dispositionCommitment, binding.sealCommitment, binding.artifactCommitment, binding.costAcceptance.entryCommitment]) if (!DIGEST.test(value)) throw new Error('A PII commitment is not a SHA-256 digest.');
  if (binding.families.length !== disposition.families.length || binding.families.length !== registryFile.families.length) throw new Error('The PII binding, disposition and registry do not name the same families.');

  const rows: PiiMatrixRow[] = binding.families.map(entry => {
    const published = disposition.families.find((row: { family: string }) => row.family === entry.family);
    const registry = registryFile.families.find(row => row.family === entry.family);
    const plan = PII_ORACLE_PLANS[entry.family];
    if (!published || !registry || !plan) throw new Error(`PII family ${entry.family} is missing from the disposition, the registry or the identity oracle.`);
    same(`${entry.family} status`, entry.status, published.status);
    same(`${entry.family} reason`, entry.reason, published.protected.reason);
    same(`${entry.family} epoch commitment`, entry.epochCommitment, published.protected.epochCommitment);
    same(`${entry.family} aggregate commitment`, entry.aggregateCommitment, published.protected.aggregateCommitment);
    same(`${entry.family} trust commitment`, entry.trustCommitment, published.protected.trustCommitment);
    if (entry.status !== 'pending' && entry.status !== 'provisional') throw new Error(`${entry.family}: the Beta.11 route cannot carry ${entry.status}.`);
    if (published.protected.sealed !== true || published.protected.runs !== '1/1') throw new Error(`${entry.family}: the protected run is not a sealed single attempt.`);
    const protectedMet = published.protected.state === 'met';
    if ((entry.status === 'provisional') !== (protectedMet && published.publicGates.notMet.length === 0 && published.publicGates.unresolved.length === 0))
      throw new Error(`${entry.family}: the status does not follow from the recorded gates.`);
    return {
      family: entry.family, familyName: registry.displayName, status: entry.status as PiiStatus, reason: published.protected.reason,
      coverage: { scope: entry.coverage.scope, jurisdiction: entry.coverage.jurisdiction, restriction: entry.coverage.restriction, note: entry.coverage.note },
      findingTypes: [plan.findingType],
      gates: {
        public: { met: published.publicGates.met, notMet: [...published.publicGates.notMet], unresolved: [...published.publicGates.unresolved], acceptedTradeoffs: [...published.publicGates.acceptedTradeoffs] },
        protected: { state: published.protected.state, reason: published.protected.reason, runs: published.protected.runs, epochCommitment: entry.epochCommitment, aggregateCommitment: entry.aggregateCommitment, trustCommitment: entry.trustCommitment },
      },
      failedGates: [...published.publicGates.notMet, ...published.publicGates.unresolved, ...(protectedMet ? [] : ['protected-partition'])],
    };
  }).sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));
  const piiDistribution = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  for (const row of rows) piiDistribution[row.status]++;
  same('distribution', { pending: piiDistribution.pending, provisional: piiDistribution.provisional, stable: 0 }, disposition.distribution);
  return {
    piiQualification: {
      profile: 'pii-v1', route: binding.route, binding: binding.id, maximumStatus: 'provisional',
      qualifiedAt: { coreCommit: binding.coreCommit, epoch, populationPlanSet: planSet },
      benchmarks: { recordRevision: PII_RECORD_REVISION, freezeBaseRevision: freezeBase },
      record: binding.record, disposition: path.posix.join(binding.evidenceDirectory, DISPOSITION_FILE),
      commitments: { freeze: binding.freezeCommitment, report: binding.reportCommitment, disposition: binding.dispositionCommitment, seal: binding.sealCommitment, protectedDisposition: binding.artifactCommitment },
      costAcceptance: { id: binding.costAcceptance.id, entryCommitment: binding.costAcceptance.entryCommitment, status: 'accepted', cells: disposition.costAcceptance.accepted.cells, sizeRows: disposition.costAcceptance.accepted.sizeRows },
      requalification: { state: 'not-requalified', requalifiedOnCoreCommit: null, statement: PII_REQUALIFICATION_STATEMENT },
    },
    piiCurrentQualification: await buildPiiCurrentQualification(root),
    piiDistribution,
    piiFamilies: rows,
  };
}
