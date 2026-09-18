export type PromotionStatus =
  | 'observed'
  | 'reviewed'
  | 'promoted'
  | 'fixed'
  | 'verified'
  | 'rejected'
  | 'policy-decision';

type Transition = { at: string; evidence: string[] };
type Finding = { start: number; end: number; type?: string; confidence?: string; action?: string };

export interface KnownGapRecord {
  id: string;
  title: string;
  url: string;
  number: number;
  fixtures: string[];
  kind: 'false-positive' | 'false-negative';
  status: PromotionStatus;
  candidate: { package: string; version: string; lockHash: string };
  expectationReview: { method: 'authored-independent-of-scanner-output'; evidence: string[] };
  history: Partial<Record<'observed' | 'reviewed' | 'promoted' | 'fixed' | 'verified', Transition>>;
  promotion?: {
    productIssue: string;
    productManifest: string;
    productManifestRecordId: string;
    canonicalFixtureIds: string[];
  };
  fix?: { commit: string; version?: string };
  verification?: {
    canonicalProductRegression: { manifestRecordId: string; fixtureIds: string[] };
    fixingCommitOrVersion: string;
    productConformanceEvidence: string[];
    benchmarkRerunEvidence: string[];
  };
  disposition?: { reason: string; evidence: string[] };
  evidence: { fixture: string; corpusHash: string; expected: Finding[]; actual: Finding[] }[];
}

export interface KnownGaps {
  schemaVersion: 1;
  lifecycleAuthority: string;
  measuredVersion: string;
  milestone: string;
  milestoneUrl: string;
  reviewedAt: string;
  issues: KnownGapRecord[];
}

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FIXTURE_ID = /^[a-z][a-z0-9-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\//;
const ACTIVE = ['observed', 'reviewed', 'promoted', 'fixed', 'verified'] as const;
const TERMINAL = ['rejected', 'policy-decision'] as const;

const fail = (id: string, code: string): never => {
  throw new TypeError(`Invalid promotion record ${id}: ${code}.`);
};
const uniqueStrings = (value: unknown, pattern: RegExp, allowEmpty = false): value is string[] =>
  Array.isArray(value) && (allowEmpty || value.length > 0) &&
  value.every(item => typeof item === 'string' && pattern.test(item)) &&
  new Set(value).size === value.length;
const only = (value: object, keys: string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
};
const transition = (id: string, value: unknown, name: string): void => {
  if (typeof value !== 'object' || value === null || !only(value, ['at', 'evidence'])) fail(id, `invalid-${name}-transition`);
  const row = value as Transition;
  if (!DATE.test(row.at) || !uniqueStrings(row.evidence, HTTPS)) fail(id, `invalid-${name}-transition`);
};
const finding = (value: Finding, actual: boolean): boolean =>
  typeof value === 'object' && value !== null &&
  only(value, actual ? ['start', 'end', 'type', 'confidence', 'action'] : ['start', 'end']) &&
  Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end) &&
  value.start >= 0 && value.end > value.start &&
  (!actual || (
    typeof value.type === 'string' && ID.test(value.type.replaceAll('_', '-')) &&
    ['high', 'medium', 'low'].includes(value.confidence ?? '') &&
    ['redact', 'warn', 'block', 'allow'].includes(value.action ?? '')
  ));

/** Validate the known-gap lifecycle without exposing fixture content in errors. */
export function validateKnownGaps(value: KnownGaps): KnownGaps {
  if (
    typeof value !== 'object' || value === null ||
    !only(value, ['schemaVersion', 'lifecycleAuthority', 'measuredVersion', 'milestone', 'milestoneUrl', 'reviewedAt', 'issues']) ||
    value.schemaVersion !== 1 || !HTTPS.test(value.lifecycleAuthority) ||
    typeof value.measuredVersion !== 'string' || typeof value.milestone !== 'string' ||
    !HTTPS.test(value.milestoneUrl) || !DATE.test(value.reviewedAt) || !Array.isArray(value.issues)
  ) fail('manifest', 'invalid-metadata');

  const ids = new Set<string>();
  const fixtureIds = new Set<string>();
  for (const record of value.issues) {
    const id = typeof record?.id === 'string' && ID.test(record.id) ? record.id : 'unknown';
    if (ids.has(id)) fail(id, 'duplicate-id');
    ids.add(id);
    if (
      id === 'unknown' || !only(record, [
        'id', 'title', 'url', 'number', 'fixtures', 'kind', 'status', 'candidate',
        'expectationReview', 'history', 'promotion', 'fix', 'verification', 'disposition', 'evidence',
      ]) ||
      typeof record.title !== 'string' || record.title.length === 0 ||
      record.url !== `https://github.com/redact-secret/redact-secret/issues/${record.number}` ||
      !Number.isSafeInteger(record.number) || record.number < 1 ||
      !uniqueStrings(record.fixtures, FIXTURE_ID) ||
      !['false-positive', 'false-negative'].includes(record.kind) ||
      ![...ACTIVE, ...TERMINAL].includes(record.status as never) ||
      typeof record.candidate !== 'object' || record.candidate === null ||
      !only(record.candidate, ['package', 'version', 'lockHash']) ||
      record.candidate.package !== '@redact-secret/core' ||
      typeof record.candidate.version !== 'string' || !SHA256.test(record.candidate.lockHash) ||
      typeof record.expectationReview !== 'object' || record.expectationReview === null ||
      !only(record.expectationReview, ['method', 'evidence']) ||
      record.expectationReview.method !== 'authored-independent-of-scanner-output' ||
      !uniqueStrings(record.expectationReview.evidence, HTTPS) ||
      typeof record.history !== 'object' || record.history === null ||
      !only(record.history, [...ACTIVE]) ||
      !Array.isArray(record.evidence) || record.evidence.length !== record.fixtures.length
    ) fail(id, 'invalid-metadata');

    for (const fixtureId of record.fixtures) {
      if (fixtureIds.has(fixtureId)) fail(id, 'duplicate-benchmark-fixture');
      fixtureIds.add(fixtureId);
    }
    if (
      record.evidence.some(row =>
        !only(row, ['fixture', 'corpusHash', 'expected', 'actual']) ||
        !record.fixtures.includes(row.fixture) || !SHA256.test(row.corpusHash) ||
        !Array.isArray(row.expected) || !row.expected.every(item => finding(item, false)) ||
        !Array.isArray(row.actual) || !row.actual.every(item => finding(item, true))) ||
      new Set(record.evidence.map(row => row.fixture)).size !== record.fixtures.length
    ) fail(id, 'invalid-observation-evidence');

    const activeIndex = ACTIVE.indexOf(record.status as typeof ACTIVE[number]);
    const requiredThrough = activeIndex >= 0 ? activeIndex : 1;
    let previousDate = '';
    for (let index = 0; index <= requiredThrough; index += 1) {
      const name = ACTIVE[index];
      transition(id, record.history[name], name);
      const currentDate = record.history[name]!.at;
      if (currentDate < previousDate) fail(id, 'out-of-order-transition');
      previousDate = currentDate;
    }
    for (let index = requiredThrough + 1; index < ACTIVE.length; index += 1) {
      if (record.history[ACTIVE[index]] !== undefined) fail(id, 'future-transition-present');
    }

    if (requiredThrough >= 2) {
      if (
        typeof record.promotion !== 'object' || record.promotion === null ||
        !only(record.promotion, ['productIssue', 'productManifest', 'productManifestRecordId', 'canonicalFixtureIds']) ||
        record.promotion.productIssue !== record.url || !HTTPS.test(record.promotion.productManifest) ||
        !ID.test(record.promotion.productManifestRecordId) ||
        !uniqueStrings(record.promotion.canonicalFixtureIds, ID, true)
      ) fail(id, 'invalid-promotion-evidence');
    }
    if (requiredThrough >= 3 && (
      typeof record.fix !== 'object' || record.fix === null ||
      !only(record.fix, ['commit', 'version']) || !COMMIT.test(record.fix.commit) ||
      (record.fix.version !== undefined && typeof record.fix.version !== 'string')
    )) fail(id, 'invalid-fix-evidence');
    if (record.status === 'verified') {
      const verified = record.verification;
      if (
        typeof verified !== 'object' || verified === null ||
        !only(verified, ['canonicalProductRegression', 'fixingCommitOrVersion', 'productConformanceEvidence', 'benchmarkRerunEvidence']) ||
        typeof verified.canonicalProductRegression !== 'object' || verified.canonicalProductRegression === null ||
        !only(verified.canonicalProductRegression, ['manifestRecordId', 'fixtureIds']) ||
        verified.canonicalProductRegression.manifestRecordId !== record.promotion?.productManifestRecordId ||
        !uniqueStrings(verified.canonicalProductRegression.fixtureIds, ID) ||
        typeof verified.fixingCommitOrVersion !== 'string' ||
        !uniqueStrings(verified.productConformanceEvidence, HTTPS) ||
        !uniqueStrings(verified.benchmarkRerunEvidence, HTTPS)
      ) fail(id, 'invalid-verification-evidence');
    } else if (record.verification !== undefined) fail(id, 'premature-verification-evidence');

    if (TERMINAL.includes(record.status as typeof TERMINAL[number])) {
      if (
        typeof record.disposition !== 'object' || record.disposition === null ||
        !only(record.disposition, ['reason', 'evidence']) ||
        typeof record.disposition.reason !== 'string' || record.disposition.reason.length === 0 ||
        !uniqueStrings(record.disposition.evidence, HTTPS)
      ) fail(id, 'invalid-disposition');
    } else if (record.disposition !== undefined) fail(id, 'unexpected-disposition');
  }
  return value;
}
