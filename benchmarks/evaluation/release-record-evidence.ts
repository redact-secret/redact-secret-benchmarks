/**
 * #449: the file-reading half of schema 2 release-record validation. `validateReleaseRecordV2` re-assembles a record
 * from what it embeds; this module additionally re-derives, from committed repository evidence, the two things the
 * record can only cite: the reviewed v2 PII protected route (through `bindPiiProtectedSupport`) and a reviewed
 * source equivalence's credential parity (from the two committed full-suite candidate runs it names).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from './substrate/hash.ts';
import { validateEvidence, type QualificationSuite } from './evidence.ts';
import { bindPiiProtectedSupport } from './domains/pii/protected-support-binding.ts';
import { PII_PROTECTED_ROUTE } from './domains/pii/support-semantics.ts';
import { validateReleaseRecordV2, type ReleaseRecordV2, type ReleaseSourceEquivalence } from './release-record.ts';

const readJson = async (root: string, file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;

/** Re-derives a reviewed equivalence's credential parity: same benchmark commit, same fixtures, same outcome and finding count on every fixture. */
export async function verifySourceEquivalenceParity(root: string, entry: ReleaseSourceEquivalence) {
  const parity = entry.credentialParity;
  const load = async (side: 'from' | 'to', commit: string) => {
    const report = await readJson(root, parity[side].evidence);
    validateEvidence(report, 'candidate');
    if (hash(JSON.stringify(report)) !== parity[side].candidateEvidenceCommitment) throw new Error(`Source equivalence ${side} evidence commitment mismatch`);
    if (report.status !== 'complete' || report.selection?.scope !== 'full-suite' || report.benchmark?.dirty !== false ||
        report.candidate?.sourceState !== 'clean' || report.candidate?.sourceCommit !== commit || report.benchmark?.sourceCommit !== parity.benchmarkRevision)
      throw new Error(`Source equivalence ${side} evidence is not a clean full-suite run of its commit at the parity benchmark revision`);
    return report;
  };
  const from = await load('from', entry.fromCommit), to = await load('to', entry.toCommit);
  if (from.corpus.hash !== to.corpus.hash) throw new Error('Source equivalence parity runs measured different corpora');
  const outcomes = (report: any) => new Map<string, string>(report.results.map((row: any) => [row.fixtureId, `${row.outcome}|${row.actualFindings}`]));
  const a = outcomes(from), b = outcomes(to);
  let differing = 0;
  if (a.size !== b.size) throw new Error('Source equivalence parity runs cover different fixtures');
  for (const [id, value] of a) { if (!b.has(id)) throw new Error('Source equivalence parity runs cover different fixtures'); if (b.get(id) !== value) differing++; }
  if (a.size !== parity.fixtures || differing !== parity.differingFixtures) throw new Error('Source equivalence parity does not re-derive');
  return { fixtures: a.size, differingFixtures: differing };
}

/** Full validation of a schema 2 record against the repository at `root`. */
export async function verifyReleaseRecordEvidence(value: unknown, registryFamilies: readonly string[], root: string, suite?: QualificationSuite): Promise<ReleaseRecordV2> {
  const record = validateReleaseRecordV2(value, registryFamilies, suite);
  if (record.pii.route === PII_PROTECTED_ROUTE) {
    await bindPiiProtectedSupport(root, record.pii.binding);
    const committed = await readJson(root, `${record.pii.binding.evidenceDirectory}/pii-beta11-protected-disposition-v2.json`);
    if (JSON.stringify(canonical(committed)) !== JSON.stringify(canonical(record.pii.protectedDisposition)))
      throw new Error('Embedded PII protected disposition differs from the committed one');
  }
  if (record.sourceEquivalence) await verifySourceEquivalenceParity(root, record.sourceEquivalence);
  return record;
}
