/**
 * Adjudication of a frozen adversarial pack's submitted expectations
 * (redact-secret-benchmarks#322). An adjudication decides, per fixture,
 * whether a submitted expectation describes the product's raw-input contract,
 * a presentation-only example, or a downstream normalization scenario. It
 * never changes the expectation: `intake.json`, its digest and
 * `first-run.json` stay as frozen, so first-run counts are never rewritten.
 * Changing an expectation is a material maintainer edit instead.
 */
import type { IntakeRecord } from './adversarial-intake.ts';

export const ADJUDICATIONS = ['raw-input-contract', 'presentation-only-example', 'downstream-normalization-scenario'] as const;
export type AdjudicationKind = typeof ADJUDICATIONS[number];

type Range = { start: number; end: number };

export interface FixtureAdjudication {
  fixtureId: string;
  submittedAction: 'must-redact' | 'must-not-flag';
  submittedExpected: Range[];
  adjudication: AdjudicationKind;
  inRawInputContract: boolean;
  rationale: string;
  evidence: string[];
}

export interface Adjudication {
  schemaVersion: 1;
  id: string;
  packId: string;
  decidedAt: string;
  issue: string;
  expectationsDigest: string;
  firstRunSha256: string;
  contract: string;
  note: string;
  fixtures: FixtureAdjudication[];
  supersedes?: { record: string; field: string; source: string; value: unknown };
}

const HTTPS = /^https:\/\/\S+$/;
const KEYS = ['schemaVersion', 'id', 'packId', 'decidedAt', 'issue', 'expectationsDigest', 'firstRunSha256', 'contract', 'note', 'fixtures', 'supersedes'];
const FIXTURE_KEYS = ['fixtureId', 'submittedAction', 'submittedExpected', 'adjudication', 'inRawInputContract', 'rationale', 'evidence'];
const sameRanges = (a: readonly Range[], b: readonly Range[]) =>
  a.length === b.length && a.every((range, index) => range.start === b[index].start && range.end === b[index].end);

/** Problems with one pack's adjudication; empty when it is consistent with the frozen intake and first run. */
export function adjudicationProblems(adjudication: Adjudication, record: IntakeRecord, firstRunSha256: string | null): string[] {
  const problems: string[] = [];
  if (Object.keys(adjudication).some(key => !KEYS.includes(key)) || adjudication.schemaVersion !== 1) problems.push('adjudication has unknown fields or schema version');
  if (adjudication.packId !== record.id) problems.push(`adjudication packId ${adjudication.packId} is not ${record.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(adjudication.decidedAt ?? '') || adjudication.decidedAt < record.submittedAt.slice(0, 10)) problems.push('adjudication decidedAt must be a date on or after submission');
  if (!HTTPS.test(adjudication.issue ?? '')) problems.push('adjudication must link its issue');
  if (adjudication.expectationsDigest !== record.expectations.digest) problems.push('adjudication names a different expectations digest than the frozen intake');
  if (firstRunSha256 === null || adjudication.firstRunSha256 !== firstRunSha256) problems.push('adjudication must name the frozen first run it reads');
  if (!adjudication.contract || !adjudication.note) problems.push('adjudication must state the contract and what it does not change');
  const fixtures = new Map(record.fixtures.map(fixture => [fixture.id, fixture]));
  const seen = new Set<string>();
  for (const row of adjudication.fixtures ?? []) {
    const fixture = fixtures.get(row.fixtureId);
    const where = `adjudication ${row.fixtureId}`;
    if (!fixture) { problems.push(`${where}: no such fixture in the pack`); continue; }
    if (seen.has(row.fixtureId)) problems.push(`${where}: adjudicated twice`);
    seen.add(row.fixtureId);
    if (Object.keys(row).some(key => !FIXTURE_KEYS.includes(key))) problems.push(`${where}: unknown fields`);
    if (row.submittedAction !== fixture.action || !sameRanges(row.submittedExpected ?? [], fixture.expected)) {
      problems.push(`${where}: submitted action or ranges differ from the frozen intake; change an expectation only by a material maintainer edit`);
    }
    if (!ADJUDICATIONS.includes(row.adjudication)) problems.push(`${where}: unknown adjudication ${row.adjudication}`);
    if (row.inRawInputContract !== (row.adjudication === 'raw-input-contract')) problems.push(`${where}: inRawInputContract must be true exactly for raw-input-contract`);
    if (!row.rationale) problems.push(`${where}: needs a rationale`);
    if (!Array.isArray(row.evidence) || !row.evidence.length || !row.evidence.every(url => HTTPS.test(url))) problems.push(`${where}: needs https evidence`);
  }
  if (!seen.size) problems.push('adjudication adjudicates no fixture');
  return problems;
}
